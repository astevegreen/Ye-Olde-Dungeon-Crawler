import type { MonsterScalingConfig } from '../../engine';

/**
 * Zone-tiered, difficulty-scaled monster power for Blood of Thrym (ARCHITECTURE.md
 * §3). Replaces the old flat per-floor curve with a step function keyed to the
 * dungeon's seven monster zones (`monsters/*.ts`), continuing to climb straight
 * through the Act 1 -> Act 2 boundary rather than resetting — Act 2 has no
 * thematic tie-in (no giant-blood buff there, see `giantBlood.ts`), it's pure
 * escalating monster power.
 *
 * Tiers derive from the real `minFloor` bands of the seven-zone roster
 * (`monsters/index.ts`): Rime Hollows, Abandoned Dwarven Works, and Obsidian Siphon
 * make up Act 1 (floors 1-25); Tarnished Silver Veins, World Bark Descent, and Maw
 * of Malice make up Act 2 (floors 26-50), with a final step at floor 50 for the
 * Rotting Root climax itself.
 *
 * Difficulty controls exactly two knobs, per zone-tier multiplier:
 * - `basePowerMultiplier`: a uniform shift applied to every monster, including at
 *   the very first tier.
 * - `scalingRateMultiplier`: scales only the *growth above 1.0* the tier curve
 *   contributes, so it steepens or flattens how much harder later zones feel
 *   relative to floor 1, without changing floor 1 itself.
 * - `bossPowerFloorMultiplier`: guards `sun_chariot_warden` (floor 25, Act 1
 *   climax) and `nidhogg` (floor 50, Act 2 climax) — both tagged 'boss'/'miniboss'
 *   in `monsters/bosses.ts` — from ever dropping below a real fight, even on Easy.
 */
export const COTW_MONSTER_SCALING: MonsterScalingConfig = {
  tiers: [
    { floor: 1, multiplier: 1.0, label: 'Rime Hollows' },
    { floor: 10, multiplier: 1.35, label: 'Abandoned Dwarven Works' },
    { floor: 18, multiplier: 1.85, label: 'Obsidian Siphon' },
    { floor: 26, multiplier: 2.45, label: 'Tarnished Silver Veins' },
    { floor: 34, multiplier: 3.2, label: 'World Bark Descent' },
    { floor: 43, multiplier: 4.2, label: 'Maw of Malice' },
    { floor: 50, multiplier: 5.4, label: 'The Rotting Root' },
  ],
  difficulty: {
    easy: { basePowerMultiplier: 0.75, scalingRateMultiplier: 0.8, bossPowerFloorMultiplier: 1.15 },
    medium: { basePowerMultiplier: 1.0, scalingRateMultiplier: 1.0, bossPowerFloorMultiplier: 1.3 },
    hard: { basePowerMultiplier: 1.3, scalingRateMultiplier: 1.25, bossPowerFloorMultiplier: 1.5 },
  },
};
