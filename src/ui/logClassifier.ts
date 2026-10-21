/**
 * How a message-log line reads at a glance. The engine's log is plain strings, so
 * tone comes from two sources: domain events (a critical `damage_dealt` names its
 * log line, see `CriticalLineTracker`) and a few phrasings the engine uses
 * consistently, always checked against the hero's own name so "Kobold takes 5
 * damage" doesn't read as bad news for the player.
 */
export type LogTone = 'crit' | 'highlight' | 'danger' | 'heal' | 'hit' | 'arcane' | 'plain';

export interface ClassifiedLogLine {
  /** The line as shown: the engine's `*** … ***` emphasis markers removed. */
  text: string;
  tone: LogTone;
}

const EMPHASIS = /\s*\*{3}\s*/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function classifyLogLine(
  message: string,
  playerName: string,
  criticalLines?: ReadonlySet<string>
): ClassifiedLogLine {
  const emphasised = message.includes('***');
  const text = message.replace(EMPHASIS, ' ').trim();
  const lower = text.toLowerCase();
  const name = escapeRegExp(playerName.toLowerCase());

  // The hero on the receiving end (a critical against the hero reads as danger).
  const heroHurt =
    new RegExp(`\\b(attacks|hits|hitting|strikes|bites|claws|sears|burns) ${name}(?!\\w)`).test(lower) ||
    new RegExp(`^${name} (takes|suffers|is hit|is struck|is poisoned|is burned)`).test(lower) ||
    /\byou (take|suffer|are hit|are struck)\b/.test(lower) ||
    lower.includes(' perishes') ||
    lower.includes('you have been defeated');
  if (heroHurt) return { text, tone: 'danger' };

  if (criticalLines?.has(message)) return { text, tone: 'crit' };

  if (emphasised || lower.includes(' is slain') || lower.includes('level up')) {
    return { text, tone: 'highlight' };
  }

  if (/\b(heals?|healed|healing|restores?|restoring|recovers?|recovering|recovered)\b/.test(lower)) {
    return { text, tone: 'heal' };
  }

  // The hero dealing it out.
  if (new RegExp(`^(critical hit! )?${name}('s .+)? (attacks|strikes|fires|hits)\\b`).test(lower)) {
    return { text, tone: 'hit' };
  }

  if (/\bcasts?\b/.test(lower)) return { text, tone: 'arcane' };

  return { text, tone: 'plain' };
}

/**
 * Remembers which log lines were critical hits. A `damage_dealt` event is emitted
 * straight after its log line (`AttackAction`), so the engine's newest message at
 * that moment is the blow the event describes.
 */
export class CriticalLineTracker {
  private readonly lines = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly capacity = 64) {}

  public markNewest(messages: readonly string[]): void {
    const newest = messages[messages.length - 1];
    if (newest === undefined || this.lines.has(newest)) return;
    this.lines.add(newest);
    this.order.push(newest);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.lines.delete(oldest);
    }
  }

  public get set(): ReadonlySet<string> {
    return this.lines;
  }
}

/** One line of the log as shown, with how many times the engine wrote it (`collapseByAction`). */
export interface LogRun {
  message: string;
  count: number;
}

/**
 * The action each log line came from, by index into the log; `undefined` for a line that was
 * already there when the log was first observed (a loaded save's history).
 */
export type LogGroups = readonly (number | undefined)[];

/**
 * Draws the action boundary the engine's log does not carry: every line appended since the
 * last `observe` is one group. The HUD observes after every action, so a group is what one
 * action wrote. The log is capped (the engine drops its oldest line), so new lines are found
 * by overlap with the last observed log; an ambiguous overlap can only undercount new lines,
 * which collapses less, never shows wrong text.
 */
export class ActionLogGroups {
  private previous: readonly string[] = [];
  private groups: (number | undefined)[] = [];
  private nextGroup = 0;
  private primed = false;

  /** The group of each line of `messages`, giving the lines new since the last call a fresh one. */
  public observe(messages: readonly string[]): LogGroups {
    if (!this.primed) {
      this.primed = true;
      this.previous = messages.slice();
      this.groups = messages.map(() => undefined);
      return this.groups;
    }
    const shifted = this.shiftedSince(messages);
    const kept = this.previous.length - shifted;
    const groups = this.groups.slice(shifted);
    if (messages.length > kept) {
      const group = this.nextGroup++;
      for (let i = kept; i < messages.length; i++) groups.push(group);
    }
    this.previous = messages.slice();
    this.groups = groups;
    return groups;
  }

  /** A new engine is wired: its lines never join the old one's groups. */
  public reset(): void {
    this.previous = [];
    this.groups = [];
    this.primed = false;
  }

  /** The fewest old lines dropped from the front such that the rest of the old log starts `messages`. */
  private shiftedSince(messages: readonly string[]): number {
    const prev = this.previous;
    for (let shifted = Math.max(0, prev.length - messages.length); shifted < prev.length; shifted++) {
      let same = true;
      for (let i = shifted; i < prev.length; i++) {
        if (prev[i] !== messages[i - shifted]) {
          same = false;
          break;
        }
      }
      if (same) return shifted;
    }
    return prev.length;
  }
}

/**
 * The log as shown, with repeats folded: a pack of three Brim-Howlers each hitting for 2 wrote
 * three identical lines, pushing everything else out of the six-line strip under the map. The
 * engine's log keeps every line; only what is shown is collapsed. Within one action (group), a line
 * written again, even with other lines between, joins the row where it first appeared: a wolf
 * pack's "attacks", "waits", "attacks" reads as two rows. Across actions a line merges only with
 * the row just above it, and so does a line with no group (one shown before the first `observe`).
 */
export function collapseByAction(messages: readonly string[], groups?: LogGroups): LogRun[] {
  const runs: LogRun[] = [];
  const byGroup = new Map<number, Map<string, LogRun>>();
  messages.forEach((message, i) => {
    const group = groups?.[i];
    let seen: Map<string, LogRun> | undefined;
    if (group !== undefined) {
      seen = byGroup.get(group);
      if (!seen) byGroup.set(group, (seen = new Map()));
    }
    const last = runs[runs.length - 1];
    const run = last?.message === message ? last : seen?.get(message);
    if (run) {
      run.count++;
      seen?.set(message, run);
      return;
    }
    const fresh = { message, count: 1 };
    runs.push(fresh);
    seen?.set(message, fresh);
  });
  return runs;
}

/** A run as shown: "Brim-Howler attacks Sven for 2 damage. (×3)". */
export function runText(text: string, count: number): string {
  return count > 1 ? `${text} (×${count})` : text;
}
