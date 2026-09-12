import { describe, it, expect } from 'vitest';
import {
  calculateHybridScaleFactor,
  scaleMonsterStats,
  createScaledMonster,
} from '../src/engine/dungeon/spawner';
import { COTW_BESTIARY as BESTIARY } from '../src/content/cotw/monsters';

describe('Relative Monster Power & Hybrid Depth Scaling', () => {
  describe('calculateHybridScaleFactor(D, Dmax, L)', () => {
    it('calculates frontier floor scale (D >= Dmax) at peak difficulty', () => {
      // Formula on frontier: 1.0 + (Dmax - 1) * 0.15
      expect(calculateHybridScaleFactor(1, 1, 1)).toBe(1.0);
      expect(calculateHybridScaleFactor(5, 5, 5)).toBeCloseTo(1.6, 5);
      expect(calculateHybridScaleFactor(10, 10, 10)).toBeCloseTo(2.35, 5);
      expect(calculateHybridScaleFactor(20, 20, 20)).toBeCloseTo(3.85, 5);
    });

    it('scales earlier floors (D < Dmax) relative to player progression', () => {
      // D = 1, Dmax = 5, L = 5
      // frontierScale = 1.0 + 4 * 0.15 = 1.60
      // cap = 1.60 * 0.88 = 1.408
      // raw = 1.0 + 0 * 0.10 + 4 * 0.03 + 4 * 0.02 = 1.20
      const scaleD1 = calculateHybridScaleFactor(1, 5, 5);
      expect(scaleD1).toBeCloseTo(1.2, 5);
      // Notice: scaleD1 (1.20) > base scale on floor 1 (1.0), so earlier floor scales up!
      expect(scaleD1).toBeGreaterThan(1.0);
    });

    it('strictly enforces the frontier invariant (scale <= frontierScale * 0.88) across all depths', () => {
      // Test comprehensive matrix of depths and player levels
      for (let Dmax = 2; Dmax <= 30; Dmax += 2) {
        const frontierScale = 1.0 + (Dmax - 1) * 0.15;
        const maxAllowed = frontierScale * 0.88;

        for (let D = 1; D < Dmax; D++) {
          for (let L = 1; L <= 40; L += 5) {
            const scale = calculateHybridScaleFactor(D, Dmax, L);

            // Invariant 1: Strictly less than or equal to frontierScale * 0.88
            expect(scale).toBeLessThanOrEqual(maxAllowed + 1e-9);

            // Invariant 2: Strictly weaker than frontier encounters at Dmax
            expect(scale).toBeLessThan(frontierScale);
          }
        }
      }
    });
  });

  describe('scaleMonsterStats() Backward Compatibility & Hybrid Mode', () => {
    it('preserves exact canonical math formula when deepestFloor & playerLevel are omitted', () => {
      const ogre = BESTIARY.ogre; // Base: HP 50, Atk 12, Def 4, XP 120, minFloor 12
      const floor = 21; // offset = 20

      const expectedHp = Math.round(50 * (1 + 0.08 * 20)); // 130
      const expectedAtk = 12 + Math.floor(0.6 * 20); // 24
      const expectedDef = 4 + Math.floor(0.4 * 20); // 12
      const expectedXp = Math.round(120 * (1 + 0.1 * 20)); // 360

      const scaled = scaleMonsterStats(ogre, floor);
      expect(scaled.hp).toBe(expectedHp);
      expect(scaled.attack).toBe(expectedAtk);
      expect(scaled.defense).toBe(expectedDef);
      expect(scaled.xpValue).toBe(expectedXp);
    });

    it('scales monster stats up on earlier floors when player has advanced deep into dungeon', () => {
      const kobold = BESTIARY.kobold; // Base: HP 8, Atk 2, Def 0, XP 10, minFloor 1

      // Level 1 player encountering Kobold on Floor 1
      const baselineKobold = scaleMonsterStats(kobold, 1, 1, 1);
      expect(baselineKobold.hp).toBe(kobold.stats.hp);
      expect(baselineKobold.attack).toBe(kobold.stats.attack);

      // Level 10 player returning to Floor 1 after reaching Floor 10
      const scaledKobold = scaleMonsterStats(kobold, 1, 10, 10);
      // Frontier scale at Floor 10: 1.0 + 9 * 0.15 = 2.35
      // Cap: 2.35 * 0.88 = 2.068
      // Raw: 1.0 + 0 + 9 * 0.03 + 9 * 0.02 = 1.45
      // HP: round(8 * 1.45) = 12
      expect(scaledKobold.hp).toBeGreaterThan(baselineKobold.hp);
      expect(scaledKobold.attack).toBeGreaterThanOrEqual(baselineKobold.attack);

      // Frontier encounter on Floor 10
      const frontierKobold = scaleMonsterStats(kobold, 10, 10, 10);
      // Frontier HP: round(8 * 2.35) = 19
      expect(scaledKobold.hp).toBeLessThan(frontierKobold.hp);
    });

    it('guarantees bestiary templates remain strictly immutable after hybrid scaling', () => {
      const kobold = BESTIARY.kobold;
      const originalHp = kobold.stats.hp;
      const originalAtk = kobold.stats.attack;

      scaleMonsterStats(kobold, 1, 20, 20);
      scaleMonsterStats(kobold, 5, 20, 20);

      expect(kobold.stats.hp).toBe(originalHp);
      expect(kobold.stats.attack).toBe(originalAtk);
    });
  });

  describe('createScaledMonster()', () => {
    it('creates monster with hybrid scaled stats and aiState set to sleeping', () => {
      const goblinDef = BESTIARY.goblin ?? BESTIARY.kobold;
      const monster = createScaledMonster(
        goblinDef,
        'scaled_goblin_1',
        { x: 10, y: 10 },
        1,
        8,
        8
      );

      expect(monster.id).toBe('scaled_goblin_1');
      expect(monster.aiState).toBe('sleeping');
      expect(monster.hp).toBeGreaterThanOrEqual(goblinDef.stats.hp);
      expect(monster.attack).toBeGreaterThanOrEqual(goblinDef.stats.attack);
    });
  });
});
