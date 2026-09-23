import type { GameEngine } from '../engine';
import { incrementCounter, getCounter, setFlag, getFlag } from '../state/worldState';

/**
 * Milestone Renown Ledger (docs/architecture/content-progression-scaling.md).
 *
 * Per-character meta-progression: cumulative renown by category, backed entirely by the
 * existing generic WorldState primitives (`counters`, `flags`), which already serialize
 * with the character save. No new SaveData field, no migrator.ts step.
 */

const RENOWN_TOTAL_COUNTER = 'renown:total';

function categoryCounterKey(category: string): string {
  return `renown:${category}`;
}

function earnedFlagKey(milestoneId: string): string {
  return `renown_milestone_earned:${milestoneId}`;
}

export interface RecordMilestoneResult {
  awarded: boolean;
  reason?: 'unknown_milestone' | 'already_earned';
  renownValue?: number;
  category?: string;
  totalForCategory?: number;
  totalRenown?: number;
}

/**
 * Records a renown milestone by ID, looked up from the active manifest's
 * `renownMilestones`. A no-op (`{ awarded: false }`) if the manifest defines no
 * milestone with this ID — the same "engine calls a generic trigger, content may or
 * may not react to it" pattern as `emitDiscovery`/`actionHooks` — or if a non-repeatable
 * milestone already fired earlier this run.
 */
export function recordMilestone(engine: GameEngine, milestoneId: string): RecordMilestoneResult {
  const def = engine.manifest?.renownMilestones?.find((m) => m.id === milestoneId);
  if (!def) {
    return { awarded: false, reason: 'unknown_milestone' };
  }

  if (!def.repeatable) {
    if (getFlag(engine.worldState, earnedFlagKey(def.id))) {
      return { awarded: false, reason: 'already_earned' };
    }
    setFlag(engine.worldState, earnedFlagKey(def.id), true);
  }

  if (def.flag) {
    setFlag(engine.worldState, def.flag, true);
  }

  const totalForCategory = incrementCounter(engine.worldState, categoryCounterKey(def.category), def.renownValue);
  const totalRenown = incrementCounter(engine.worldState, RENOWN_TOTAL_COUNTER, def.renownValue);

  engine.log(`✦ Renown milestone: ${def.label} (+${def.renownValue} ${def.category} renown)`);

  return {
    awarded: true,
    renownValue: def.renownValue,
    category: def.category,
    totalForCategory,
    totalRenown,
  };
}

/** Current renown total, either for one category or across all categories. */
export function getRenownTotal(engine: GameEngine, category?: string): number {
  return getCounter(engine.worldState, category ? categoryCounterKey(category) : RENOWN_TOTAL_COUNTER);
}

/** Whether a (non-repeatable) milestone has already fired this run. */
export function hasEarnedMilestone(engine: GameEngine, milestoneId: string): boolean {
  return getFlag(engine.worldState, earnedFlagKey(milestoneId));
}

/**
 * Returns the highest-threshold title the current renown total qualifies for, from
 * `manifest.renownTitles`, or null if none are met yet (or the manifest defines none).
 */
export function getActiveTitle(engine: GameEngine): string | null {
  const titles = engine.manifest?.renownTitles;
  if (!titles || titles.length === 0) return null;

  let best: RenownActiveTitle | null = null;
  for (const t of titles) {
    const total = getRenownTotal(engine, t.category);
    if (total >= t.threshold && (!best || t.threshold > best.threshold)) {
      best = { title: t.title, threshold: t.threshold };
    }
  }
  return best?.title ?? null;
}

interface RenownActiveTitle {
  title: string;
  threshold: number;
}
