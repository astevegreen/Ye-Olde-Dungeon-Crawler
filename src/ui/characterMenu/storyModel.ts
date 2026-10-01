import {
  getCounter,
  getCurrentObjective,
  resolveLastFloor,
  type GameContentManifest,
  type GameEngine,
  type LoreEntryDefinition,
  type TrackedMilestoneDefinition,
  type WorldState,
} from '../../engine';

/**
 * What the Story tab shows, computed from the engine and the pack's manifest without
 * the DOM (ADR-0011's story-as-UI items). Every name and line of flavor is the pack's.
 */

/** Locked milestones shown as riddles before the rest are summed up as "untold". */
export const MAX_RIDDLES = 6;

export interface DescentBand {
  floor: number;
  /** The zone's name once reached; null while it is still unknown. */
  label: string | null;
}

export interface Descent {
  lastFloor: number;
  currentFloor: number;
  deepest: number;
  /** The zone the hero stands in, if any and known. */
  currentZone: string | null;
  bands: DescentBand[];
}

/** Deepest floor reached: the engine's count for this session, and the pack's own counter
 *  (`manifest.deepestFloorCounter`), which survives saves. */
export function deepestFloor(engine: GameEngine): number {
  const counter = engine.manifest.deepestFloorCounter;
  return Math.max(
    engine.currentFloor,
    engine.gameState?.deepestFloor ?? 0,
    counter ? getCounter(engine.worldState, counter) : 0
  );
}

/** The descent from floor 1 to the run's last floor, labeled from `atlas.tileZoneBands`. */
export function buildDescent(engine: GameEngine): Descent {
  const lastFloor = resolveLastFloor(engine);
  const deepest = deepestFloor(engine);
  const bands = [...(engine.manifest.atlas?.tileZoneBands ?? [])]
    .filter((b) => b.floor >= 1 && b.floor <= lastFloor)
    .sort((a, b) => a.floor - b.floor);
  const here = engine.currentFloor > 0 ? [...bands].reverse().find((b) => b.floor <= engine.currentFloor) : undefined;
  return {
    lastFloor,
    currentFloor: engine.currentFloor,
    deepest,
    currentZone: here?.label ?? null,
    bands: bands.map((b) => ({ floor: b.floor, label: b.floor <= deepest ? (b.label ?? null) : null })),
  };
}

export interface Saga {
  objective: string | null;
  achieved: TrackedMilestoneDefinition[];
  /** The first locked milestones, each its riddle or null ("? ? ?"). */
  riddles: Array<string | null>;
  /** Locked milestones beyond the riddles shown. */
  untold: number;
}

export function buildSaga(engine: GameEngine): Saga {
  const flags = engine.worldState.flags;
  const milestones = engine.manifest.trackedMilestones ?? [];
  const locked = milestones.filter((m) => !flags[m.flag]);
  return {
    objective: getCurrentObjective(engine)?.text ?? null,
    achieved: milestones.filter((m) => flags[m.flag]),
    riddles: locked.slice(0, MAX_RIDDLES).map((m) => m.riddle ?? null),
    untold: Math.max(0, locked.length - MAX_RIDDLES),
  };
}

export interface Verses {
  read: LoreEntryDefinition[];
  total: number;
}

export function buildVerses(worldState: WorldState, manifest: GameContentManifest): Verses {
  const entries = manifest.loreEntries ?? [];
  return { read: entries.filter((e) => worldState.flags[e.flag]), total: entries.length };
}

export type StandingTier = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'honored';

export interface FactionStanding {
  id: string;
  name: string;
  value: number;
  tier: StandingTier;
  label: string;
}

export interface Standing {
  met: FactionStanding[];
  /** Factions the hero has not met yet; they stay unnamed. */
  unmet: number;
}

const TIER_LABEL: Record<StandingTier, string> = {
  hostile: 'Hostile',
  unfriendly: 'Unfriendly',
  neutral: 'Neutral',
  friendly: 'Friendly',
  honored: 'Honored',
};

export function standingTier(value: number): StandingTier {
  if (value <= -50) return 'hostile';
  if (value <= -10) return 'unfriendly';
  if (value <= 9) return 'neutral';
  if (value <= 49) return 'friendly';
  return 'honored';
}

const titleCase = (id: string): string =>
  id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * Factions the hero has met (`FactionDefinition`): standing moved from where the pack
 * started it, the faction's `metFlag` is set, or the pack marks it `metAtStart`.
 */
export function buildStanding(worldState: WorldState, manifest: GameContentManifest): Standing {
  const initial = manifest.initialWorldState?.factions ?? {};
  const defs = new Map((manifest.factions ?? []).map((f) => [f.id, f]));
  const met: FactionStanding[] = [];
  let unmet = 0;
  for (const [id, raw] of Object.entries(worldState.factions ?? {})) {
    const value = Math.max(-100, Math.min(100, Number(raw) || 0));
    const def = defs.get(id);
    const isMet =
      Boolean(def?.metAtStart) ||
      Boolean(def?.metFlag && worldState.flags[def.metFlag]) ||
      value !== Math.max(-100, Math.min(100, Number(initial[id] ?? 0)));
    if (!isMet) {
      unmet++;
      continue;
    }
    const tier = standingTier(value);
    met.push({ id, name: def?.name ?? titleCase(id), value, tier, label: TIER_LABEL[tier] });
  }
  return { met, unmet };
}
