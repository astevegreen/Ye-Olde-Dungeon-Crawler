import type { FindingCategory, FindingCounts, FindingTag, SoakOpening } from './types';

/**
 * The soak's oracle rules that need no page: pure, so `scripts/__tests__/` can test them
 * (Vitest skips `e2e/`). Nothing here imports Playwright.
 */

export interface RaidDeathInput {
  isAlive: boolean;
  turn: number;
  /** The turn the raid ended on (`OracleState.raidEndTurn`); null while it runs. */
  raidEndTurn: number | null;
  raidEndedReason?: string;
  opening: SoakOpening;
  /** The latest log lines, oldest first. */
  messages: string[];
}

/** `OracleState.raidEndedReason` when the opening was skipped and no raid was played. */
export const RAID_SKIPPED = 'skipped (triage)';

/**
 * The detail of the "died soon after the raid" finding, or null when it does not fire.
 * Only a played raid counts: a skipped opening (every deep start among them) marks the raid
 * ended on the first turn seen, so any early death would otherwise read as a raid death.
 */
export function diedAfterRaid(r: RaidDeathInput): string | null {
  if (r.isAlive || r.raidEndTurn === null) return null;
  if (r.opening === 'skip' || r.raidEndedReason === RAID_SKIPPED) return null;
  const after = r.turn - r.raidEndTurn;
  if (after >= 200) return null;
  return `died ${after} turns after the raid: ${r.messages.slice(-20).join(' | ')}`;
}

/**
 * Distinct signatures per category for a run's summary. Tagged findings (latency, pacing)
 * are noise-prone, so they are counted apart under `tagged` and leave the categories alone.
 */
export function countFindings(findings: Iterable<{ category: FindingCategory; tag?: FindingTag }>): FindingCounts {
  const counts: FindingCounts = { bug: 0, softlock: 0, text: 0, ux: 0, tagged: 0 };
  for (const f of findings) {
    if (f.tag) counts.tagged++;
    else counts[f.category]++;
  }
  return counts;
}

/**
 * Each tagged signature's tag, for a run's summary, so the report can list noise apart.
 * Untagged signatures are left out; a clean run gives `{}`, never nothing: a missing record
 * marks a summary from before the tags were kept.
 */
export function findingTagsOf(sigs: Iterable<[string, { tag?: FindingTag }]>): Record<string, FindingTag> {
  const tags: Record<string, FindingTag> = {};
  for (const [sig, { tag }] of sigs) if (tag) tags[sig] = tag;
  return tags;
}
