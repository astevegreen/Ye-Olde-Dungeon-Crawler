import { describe, it, expect } from 'vitest';
import { resolveMonsterPowerMultiplier } from '../spawner';
import type { MonsterScalingConfig } from '../../types/monsterScaling';
import { COTW_MONSTER_SCALING } from '../../../content/cotw/monsterScaling';

const SYNTHETIC_CONFIG: MonsterScalingConfig = {
  tiers: [
    { floor: 1, multiplier: 1.0 },
    { floor: 10, multiplier: 2.0 },
  ],
  difficulty: {
    easy: { basePowerMultiplier: 0.5, scalingRateMultiplier: 0.5, bossPowerFloorMultiplier: 1.2 },
    medium: { basePowerMultiplier: 1.0, scalingRateMultiplier: 1.0 },
    hard: { basePowerMultiplier: 2.0, scalingRateMultiplier: 2.0 },
  },
};

describe('resolveMonsterPowerMultiplier', () => {
  it('is a step function: no growth before the next tier boundary', () => {
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 1, 'medium', false)).toBe(1.0);
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 9, 'medium', false)).toBe(1.0);
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'medium', false)).toBe(2.0);
  });

  it('basePowerMultiplier shifts every tier uniformly, including the first', () => {
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 1, 'easy', false)).toBeCloseTo(0.5, 5);
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 1, 'hard', false)).toBeCloseTo(2.0, 5);
  });

  it('scalingRateMultiplier scales only the growth above 1.0', () => {
    // tier 2.0 at floor 10: growth above 1.0 is 1.0, scaled by each difficulty's rate.
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'easy', false)).toBeCloseTo(0.5 * (1 + 1.0 * 0.5), 5);
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'medium', false)).toBeCloseTo(2.0, 5);
    expect(resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'hard', false)).toBeCloseTo(2.0 * (1 + 1.0 * 2.0), 5);
  });

  it('the boss guard floors a tagged monster below the plain curve, but leaves untagged monsters alone', () => {
    const plain = resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'easy', false);
    const guarded = resolveMonsterPowerMultiplier(SYNTHETIC_CONFIG, 10, 'easy', true);
    expect(guarded).toBeGreaterThan(plain);
    expect(guarded).toBeCloseTo(2.0 * 1.2, 5); // tier * bossPowerFloorMultiplier
  });

  it('the guard never lowers a multiplier that already exceeds it', () => {
    // Hard's plain curve (6.0 at floor 10) is already well above tier(2.0) * guard(1.1) = 2.2.
    const configWithLenientGuard: MonsterScalingConfig = {
      ...SYNTHETIC_CONFIG,
      difficulty: {
        ...SYNTHETIC_CONFIG.difficulty,
        hard: { basePowerMultiplier: 2.0, scalingRateMultiplier: 2.0, bossPowerFloorMultiplier: 1.1 },
      },
    };
    const plain = resolveMonsterPowerMultiplier(configWithLenientGuard, 10, 'hard', false);
    const guarded = resolveMonsterPowerMultiplier(configWithLenientGuard, 10, 'hard', true);
    expect(guarded).toBe(plain);
  });

  describe('COTW_MONSTER_SCALING (real content config)', () => {
    it('climbs continuously through the Act 1 -> Act 2 boundary (floor 25 -> 26), no reset', () => {
      const floor25 = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 25, 'medium', false);
      const floor26 = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 26, 'medium', false);
      expect(floor26).toBeGreaterThan(floor25);
    });

    it('keeps climbing monotonically across every zone tier for a fixed difficulty', () => {
      const floors = [1, 9, 10, 17, 18, 25, 26, 33, 34, 42, 43, 50];
      const values = floors.map((f) => resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, f, 'hard', false));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it('guards the Act 1 climax boss (floor 25) from being trivial on Easy', () => {
      const plain = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 25, 'easy', false);
      const guarded = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 25, 'easy', true);
      expect(guarded).toBeGreaterThan(plain);
      // Guarded Sun-Chariot Warden HP (base 220) should still be a real fight, not a one-shot.
      expect(Math.round(220 * guarded)).toBeGreaterThan(220 * 1.5);
    });

    it('guards the Act 2 final boss (floor 50) from being trivial on Easy', () => {
      const plain = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 50, 'easy', false);
      const guarded = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 50, 'easy', true);
      expect(guarded).toBeGreaterThan(plain);
      // Guarded Níðhögg HP (base 400) should still be a real fight, not a one-shot.
      expect(Math.round(400 * guarded)).toBeGreaterThan(400 * 2.5);
    });

    it('Easy is always weaker than Medium, which is always weaker than Hard, at the same floor', () => {
      for (const floor of [1, 18, 26, 50]) {
        const easy = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, floor, 'easy', false);
        const medium = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, floor, 'medium', false);
        const hard = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, floor, 'hard', false);
        expect(easy).toBeLessThan(medium);
        expect(medium).toBeLessThan(hard);
      }
    });
  });
});
