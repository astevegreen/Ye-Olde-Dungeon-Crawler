import type { ElementType } from '../magic/elements';

/**
 * Level-Scaled Elemental Resistance (ARCHITECTURE.md §3).
 *
 * A gap the existing derived-stat pipeline (`attributeCalculator.ts`) couldn't cleanly
 * express: content wants a character's resistance to a specific element to change with
 * *level* (heritage/training hardening or softening over time), not just with equipment
 * or a fixed per-monster affinity. `calculateAttribute` already reserves an
 * `'elementalResistance'` attribute key for this shape (base value stubbed to 0, never
 * previously consumed by any call site), so this module is the first real consumer of
 * that seam rather than a new one.
 *
 * Deliberately NOT wired into `Entity.takeElementalDamage`/`elementalResistances`
 * (the categorical weak/neutral/resistant/immune/absorbing system used by combat and
 * covered by existing tests) — that stays untouched. This is a separate, numeric,
 * opt-in mitigation a content-defined mechanic (e.g. an environmental exposure status
 * effect) applies explicitly, so adding it can't regress unrelated combat behavior.
 */

/** One point on an ascending level->resistance curve. `resistance` is a mitigation
 * fraction in [-1, 1]: 1 fully blocks, 0 is neutral, negative amplifies damage (a
 * physiological vulnerability), mirroring the range `calculateAttribute` already
 * clamps `'elementalResistance'` to. */
export interface LevelResistanceThreshold {
  level: number;
  resistance: number;
}

/** Thresholds must be given in ascending `level` order; the highest threshold at or
 * below the current level applies (a plain step curve, not interpolated). */
export type LevelResistanceCurve = LevelResistanceThreshold[];

/** Per-element curves a `ProgressionConfig` can declare (see `types/config.ts`). */
export type ElementalResistanceCurveConfig = Partial<Record<ElementType, LevelResistanceCurve>>;

/**
 * Resolves the resistance fraction a curve grants at `level`. Returns 0 (neutral) if
 * no curve is given or the level is below every threshold.
 */
export function resolveLevelScaledResistance(curve: LevelResistanceCurve | undefined, level: number): number {
  if (!curve || curve.length === 0) return 0;
  let resistance = 0;
  for (const threshold of curve) {
    if (level >= threshold.level) {
      resistance = threshold.resistance;
    } else {
      break;
    }
  }
  return Math.max(-1, Math.min(1, resistance));
}

/**
 * Applies a level-scaled resistance fraction to a raw damage amount and floors the
 * result at 0 (mitigation can reduce damage to nothing, but a vulnerability
 * multiplies rather than allowing this to go negative and heal).
 */
export function applyLevelScaledElementalMitigation(
  amount: number,
  level: number,
  curve: LevelResistanceCurve | undefined
): number {
  const resistance = resolveLevelScaledResistance(curve, level);
  return Math.max(0, Math.round(amount * (1 - resistance)));
}
