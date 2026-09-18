import type { GameDifficulty } from '../types';

/**
 * Zone-tiered, difficulty-scaled monster power (ARCHITECTURE.md §3). Generalizes the
 * old smooth per-floor curve (`dungeon/spawner.ts`'s original `scaleMonsterStats`,
 * still the fallback when no `MonsterScalingConfig` is supplied) into a step function
 * over content-declared breakpoints, with difficulty controlling only two knobs:
 * how strong monsters are at the first tier, and how steeply power climbs at each
 * later step. The breakpoints, multipliers, and difficulty numbers are all content
 * data — the engine only evaluates the step function and combines it with the
 * per-difficulty knobs (§3, No Engine Creep).
 */
export interface MonsterPowerTier {
  /** Floor at which this tier's multiplier takes effect, inclusive. Tiers must be
   * given in ascending `floor` order. */
  floor: number;
  /** Stat multiplier (>= 1.0) applied at and above this floor, until the next tier. */
  multiplier: number;
  /** Optional label for diagnostics/logs; not consulted by the engine. */
  label?: string;
}

export interface DifficultyPowerConfig {
  /** Uniform multiplier applied to every monster regardless of tier — the "base power" knob. */
  basePowerMultiplier: number;
  /** Scales how much of the tier's growth (above 1.0) actually applies — the "scaling rate" knob. */
  scalingRateMultiplier: number;
  /** Boss/miniboss guard: a tagged monster's multiplier is never allowed below
   * `tierMultiplier * bossPowerFloorMultiplier`, regardless of the two knobs above. */
  bossPowerFloorMultiplier?: number;
}

export interface MonsterScalingConfig {
  tiers: MonsterPowerTier[];
  difficulty: Record<GameDifficulty, DifficultyPowerConfig>;
  /** `MonsterDefinition.tags` that trigger the boss guard. Defaults to `['boss', 'miniboss']`. */
  bossTags?: string[];
}
