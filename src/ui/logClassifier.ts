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
