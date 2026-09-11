import { describe, it, expect } from 'vitest';
import { SynergyPipeline } from '../synergyPipeline';

describe('SynergyPipeline: Proc Normalization & Three-Bucket Damage', () => {
  it('normalizes proc activation probability, duration, and secondary damage with proc coefficient', () => {
    // Weapon with standard proc coefficient (1.0)
    const fullProc = SynergyPipeline.evaluateProcTrigger(
      {
        baseChance: 0.4,
        procCoefficient: 1.0,
        baseDuration: 6,
        baseSecondaryDamage: 12,
      },
      0.35 // roll < 0.40 -> triggers
    );
    expect(fullProc.triggered).toBe(true);
    expect(fullProc.effectiveChance).toBe(0.4);
    expect(fullProc.effectiveDuration).toBe(6);
    expect(fullProc.effectiveSecondaryDamage).toBe(12);

    // Fast weapon / secondary hitbox with reduced proc coefficient (0.50)
    const halfProc = SynergyPipeline.evaluateProcTrigger(
      {
        baseChance: 0.4,
        procCoefficient: 0.5,
        baseDuration: 6,
        baseSecondaryDamage: 12,
      },
      0.25 // roll > 0.20 -> fails
    );
    expect(halfProc.effectiveChance).toBe(0.2); // 0.4 * 0.5
    expect(halfProc.triggered).toBe(false);
    expect(halfProc.effectiveDuration).toBe(3); // 6 * 0.5
    expect(halfProc.effectiveSecondaryDamage).toBe(6); // 12 * 0.5
  });

  it('guarantees minimum duration of 1 turn for non-zero base duration even with small proc coefficient', () => {
    const microProc = SynergyPipeline.evaluateProcTrigger({
      baseChance: 0.5,
      procCoefficient: 0.1,
      baseDuration: 4,
    });
    expect(microProc.effectiveChance).toBe(0.05);
    expect(microProc.effectiveDuration).toBe(1); // max(1, round(4 * 0.1))
  });

  it('suppresses procs completely when proc coefficient is 0', () => {
    const zeroProc = SynergyPipeline.evaluateProcTrigger(
      {
        baseChance: 1.0,
        procCoefficient: 0.0,
        baseDuration: 5,
      },
      0.01
    );
    expect(zeroProc.effectiveChance).toBe(0.0);
    expect(zeroProc.triggered).toBe(false);
  });

  it('calculates final damage using strictly bounded three-bucket multiplicative categories', () => {
    // Formula: Base * (1 + sum(Additive)) * Vuln * Crit
    // Base = 20
    // Additive: +15% relic, +25% mastery -> sum = 0.40 -> factor = 1.40
    // Vulnerability = 1.50 (weakness)
    // Crit = 1.50
    // Expected: 20 * 1.40 * 1.50 * 1.50 = 63
    const result = SynergyPipeline.resolveThreeBucketDamage({
      baseDamage: 20,
      additiveModifiers: [0.15, 0.25],
      vulnerabilityMultiplier: 1.5,
      criticalMultiplier: 1.5,
    });

    expect(result.baseDamage).toBe(20);
    expect(result.additiveSum).toBeCloseTo(0.4);
    expect(result.vulnerabilityMultiplier).toBe(1.5);
    expect(result.criticalMultiplier).toBe(1.5);
    expect(result.finalDamage).toBe(63);
  });

  it('handles negative additive modifiers and neutral multipliers without falling below 1 damage', () => {
    const lowDmg = SynergyPipeline.resolveThreeBucketDamage({
      baseDamage: 5,
      additiveModifiers: [-0.9], // -90% curse
      vulnerabilityMultiplier: 0.5, // 50% resistance
    });
    // 5 * 0.10 * 0.5 * 1.0 = 0.25 -> clamped to 1
    expect(lowDmg.finalDamage).toBe(1);
  });
});
