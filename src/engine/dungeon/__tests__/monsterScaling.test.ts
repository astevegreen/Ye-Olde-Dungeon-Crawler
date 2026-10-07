import { describe, it, expect } from 'vitest';
import { resolveMonsterPowerMultiplier, scaleMonsterStats } from '../spawner';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
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

describe('scaleMonsterStats defense under a scaling config (R-cotw-17)', () => {
  const knight: MonsterDefinition = {
    id: 'knight',
    name: 'Knight',
    minFloor: 1,
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 10 },
    speed: 100,
    xpValue: 10,
    aiType: 'melee',
    fleeHealthPercent: 0,
    lootTable: [],
  };

  it('takes the full multiplier for defense unless the pack sets defenseExponent', () => {
    const s = scaleMonsterStats(knight, 10, undefined, undefined, SYNTHETIC_CONFIG, 'medium');
    expect(s).toMatchObject({ maxHp: 200, attack: 20, defense: 20 });
  });

  it('raises the multiplier to defenseExponent for defense alone; HP and attack keep it whole', () => {
    const sqrt = { ...SYNTHETIC_CONFIG, defenseExponent: 0.5 };
    const s = scaleMonsterStats(knight, 10, undefined, undefined, sqrt, 'hard'); // x6
    expect(s).toMatchObject({ maxHp: 600, attack: 60, defense: Math.round(10 * Math.sqrt(6)) });
    // Never below the definition's own defense, even when the multiplier is under 1.
    expect(scaleMonsterStats(knight, 1, undefined, undefined, sqrt, 'easy').defense).toBe(10);
  });

  it('cotw: defense by the square root of the multiplier, so Níðhögg’s x7 gives defense x2.6', () => {
    const boss = { ...knight, tags: ['boss'], stats: { hp: 400, maxHp: 400, attack: 30, defense: 14 } };
    const m = resolveMonsterPowerMultiplier(COTW_MONSTER_SCALING, 50, 'medium', true);
    expect(m).toBeCloseTo(7.02, 2);
    const s = scaleMonsterStats(boss, 50, undefined, undefined, COTW_MONSTER_SCALING, 'medium');
    expect(s.defense).toBe(Math.round(14 * Math.sqrt(m))); // 37, not 98
    expect(s.attack).toBe(Math.round(30 * m));
    expect(s.maxHp).toBe(Math.round(400 * m));
  });
});

describe('scaleMonsterStats XP under a scaling config (Q4 "B", Q25)', () => {
  const brute: MonsterDefinition = {
    id: 'brute',
    name: 'Brute',
    minFloor: 1,
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
    speed: 100,
    xpValue: 100,
    aiType: 'melee',
    fleeHealthPercent: 0,
    lootTable: [],
    tags: ['boss'],
  };

  it('follows the zone tier alone: the same XP on every difficulty, bosses included', () => {
    for (const floor of [1, 10]) {
      const easy = scaleMonsterStats(brute, floor, undefined, undefined, SYNTHETIC_CONFIG, 'easy');
      const medium = scaleMonsterStats(brute, floor, undefined, undefined, SYNTHETIC_CONFIG, 'medium');
      const hard = scaleMonsterStats(brute, floor, undefined, undefined, SYNTHETIC_CONFIG, 'hard');
      expect(easy.xpValue).toBe(medium.xpValue);
      expect(hard.xpValue).toBe(medium.xpValue);
      // Power still differs by difficulty: only the XP is held to the tier.
      expect(hard.attack).toBeGreaterThan(easy.attack);
    }
    expect(scaleMonsterStats(brute, 1, undefined, undefined, SYNTHETIC_CONFIG, 'hard').xpValue).toBe(100);
    expect(scaleMonsterStats(brute, 10, undefined, undefined, SYNTHETIC_CONFIG, 'easy').xpValue).toBe(200);
  });
});
