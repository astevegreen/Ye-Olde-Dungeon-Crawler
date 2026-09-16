/**
 * Synergy Proc Engine & Multiplicative Damage Buckets
 */

export interface ProcTriggerConfig {
  baseChance: number; // P_base in [0.0, 1.0]
  procCoefficient: number; // C_proc in [0.0, 1.0]
  baseDuration?: number;
  baseSecondaryDamage?: number;
}

export interface EffectiveProcResult {
  triggered: boolean;
  effectiveChance: number;
  effectiveDuration: number;
  effectiveSecondaryDamage: number;
}

export interface DamageResolutionBuckets {
  baseDamage: number;
  additiveModifiers: number[];
  vulnerabilityMultiplier?: number;
  criticalMultiplier?: number;
}

export interface ResolvedDamageResult {
  baseDamage: number;
  additiveSum: number;
  vulnerabilityMultiplier: number;
  criticalMultiplier: number;
  finalDamage: number;
}

export class SynergyPipeline {
  /**
   * Evaluates a secondary on-hit trigger using normalized proc coefficients:
   * P_effective = P_base * C_proc
   * Effective Duration = max(1, round(baseDuration * C_proc))
   * Effective Secondary Damage = round(baseSecondaryDamage * C_proc)
   */
  public static evaluateProcTrigger(
    config: ProcTriggerConfig,
    randomRoll: number
  ): EffectiveProcResult {
    const cProc = Math.min(1.0, Math.max(0.0, config.procCoefficient));
    const pBase = Math.min(1.0, Math.max(0.0, config.baseChance));
    const effectiveChance = pBase * cProc;

    const roll = randomRoll;
    const triggered = roll < effectiveChance;

    const effectiveDuration =
      config.baseDuration !== undefined && config.baseDuration > 0
        ? Math.max(1, Math.round(config.baseDuration * cProc))
        : 0;

    const effectiveSecondaryDamage =
      config.baseSecondaryDamage !== undefined && config.baseSecondaryDamage > 0
        ? Math.round(config.baseSecondaryDamage * cProc)
        : 0;

    return {
      triggered,
      effectiveChance,
      effectiveDuration,
      effectiveSecondaryDamage,
    };
  }

  /**
   * Resolves combat damage using strictly bounded three-bucket multiplicative categories:
   * Final Damage = Base Damage * (1 + sum(Additive Modifiers)) * Vulnerability Multiplier * Critical Multiplier
   */
  public static resolveThreeBucketDamage(
    buckets: DamageResolutionBuckets
  ): ResolvedDamageResult {
    const baseDamage = Math.max(0, buckets.baseDamage);
    const additiveSum = buckets.additiveModifiers.reduce((sum, mod) => sum + mod, 0);
    const additiveFactor = Math.max(0, 1 + additiveSum);
    const vulnerabilityMultiplier = Math.max(0, buckets.vulnerabilityMultiplier ?? 1.0);
    const criticalMultiplier = Math.max(1.0, buckets.criticalMultiplier ?? 1.0);

    const calculated =
      baseDamage * additiveFactor * vulnerabilityMultiplier * criticalMultiplier;
    const finalDamage = Math.max(1, Math.round(calculated));

    return {
      baseDamage,
      additiveSum,
      vulnerabilityMultiplier,
      criticalMultiplier,
      finalDamage,
    };
  }
}
