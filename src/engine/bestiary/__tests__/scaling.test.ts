import { describe, it, expect } from 'vitest';
import { COTW_BESTIARY as BESTIARY } from '../../../content/cotw/monsters';
import { COTW_MONSTER_SCALING } from '../../../content/cotw/monsterScaling';
import { scaleMonsterStats } from '../../dungeon/spawner';

describe('Monster Stat Scaling & Bestiary Immutability', () => {
  it('preserves base stats on Floor 1 without affix', () => {
    const kobold = BESTIARY.kobold;
    const scaled = scaleMonsterStats(kobold, 1);

    expect(scaled.hp).toBe(kobold.stats.hp);
    expect(scaled.maxHp).toBe(kobold.stats.maxHp);
    expect(scaled.attack).toBe(kobold.stats.attack);
    expect(scaled.defense).toBe(kobold.stats.defense);
    expect(scaled.xpValue).toBe(kobold.xpValue);
    expect(scaled.name).toBe('Kobold');
  });

  it('correctly calculates scaled stats using the canonical math formula', () => {
    // Math formulas:
    // HP: Math.round(baseHP * (1 + 0.08 * (currentFloor - 1)))
    // Attack: baseAttack + Math.floor(0.6 * (currentFloor - 1))
    // Defense: baseDefense + Math.floor(0.4 * (currentFloor - 1))
    // XP: Math.round(baseXP * (1 + 0.10 * (currentFloor - 1)))

    const ogre = BESTIARY.ogre; // Base: HP 50, Atk 12, Def 4, XP 120, minFloor 12
    const floor = 21; // offset = 20

    const expectedHp = Math.round(50 * (1 + 0.08 * 20)); // 50 * 2.6 = 130
    const expectedAtk = 12 + Math.floor(0.6 * 20); // 12 + 12 = 24
    const expectedDef = 4 + Math.floor(0.4 * 20); // 4 + 8 = 12
    const expectedXp = Math.round(120 * (1 + 0.1 * 20)); // 120 * 3.0 = 360

    const scaled = scaleMonsterStats(ogre, floor);
    expect(scaled.hp).toBe(expectedHp);
    expect(scaled.attack).toBe(expectedAtk);
    expect(scaled.defense).toBe(expectedDef);
    expect(scaled.xpValue).toBe(expectedXp);
  });

  it('applies "Veteran " affix only when currentFloor - minFloor >= 10', () => {
    const rat = BESTIARY.giant_rat; // minFloor: 1

    // Floor 10: 10 - 1 = 9 -> no affix
    const f10 = scaleMonsterStats(rat, 10);
    expect(f10.name).toBe('Giant Rat');

    // Floor 11: 11 - 1 = 10 -> Veteran affix
    const f11 = scaleMonsterStats(rat, 11);
    expect(f11.name).toBe('Veteran Giant Rat');

    // Floor 25: 25 - 1 = 24 -> Veteran affix
    const f25 = scaleMonsterStats(rat, 25);
    expect(f25.name).toBe('Veteran Giant Rat');

    // Ogre with minFloor: 12
    const ogre = BESTIARY.ogre;
    // Floor 21: 21 - 12 = 9 -> no affix
    expect(scaleMonsterStats(ogre, 21).name).toBe('Ogre');
    // Floor 22: 22 - 12 = 10 -> Veteran affix
    expect(scaleMonsterStats(ogre, 22).name).toBe('Veteran Ogre');
  });

  it('guarantees MonsterDefinition templates remain strictly immutable after scaling', () => {
    const kobold = BESTIARY.kobold;
    const baseStatsSnapshot = { ...kobold.stats };
    const baseName = kobold.name;

    // Run scaling repeatedly on various depths
    scaleMonsterStats(kobold, 5);
    scaleMonsterStats(kobold, 25);
    scaleMonsterStats(kobold, 50);

    // Assert that the original BESTIARY template is unchanged
    expect(kobold.stats.hp).toBe(baseStatsSnapshot.hp);
    expect(kobold.stats.attack).toBe(baseStatsSnapshot.attack);
    expect(kobold.stats.defense).toBe(baseStatsSnapshot.defense);
    expect(kobold.name).toBe(baseName);
  });

  describe('with a MonsterScalingConfig (zone-tiered, difficulty-scaled — ARCHITECTURE.md §3)', () => {
    it('is a no-op at the first tier on Medium (multiplier 1.0)', () => {
      const kobold = BESTIARY.kobold; // Base: HP 10, Atk 3, Def 1, XP 15, minFloor 1
      const scaled = scaleMonsterStats(kobold, 1, undefined, undefined, COTW_MONSTER_SCALING, 'medium');

      expect(scaled.hp).toBe(10);
      expect(scaled.attack).toBe(3);
      expect(scaled.defense).toBe(1);
      expect(scaled.xpValue).toBe(15);
      expect(scaled.name).toBe('Kobold');
    });

    it('scales a regular monster through the difficulty knobs at a late-game tier (floor 43, Hard)', () => {
      const kobold = BESTIARY.kobold; // Base: HP 10, Atk 3, Def 1, XP 15, minFloor 1
      // Maw of Malice tier (floor 43) = 4.2; Hard = { base: 1.3, rate: 1.25 }.
      // multiplier = 1.3 * (1 + (4.2 - 1) * 1.25) = 1.3 * 5.0 = 6.5
      const scaled = scaleMonsterStats(kobold, 43, undefined, undefined, COTW_MONSTER_SCALING, 'hard');

      expect(scaled.hp).toBe(65); // round(10 * 6.5)
      expect(scaled.attack).toBe(20); // round(3 * 6.5) = round(19.5)
      expect(scaled.defense).toBe(7); // round(1 * 6.5) = round(6.5)
      expect(scaled.xpValue).toBe(98); // round(15 * 6.5) = round(97.5)
      expect(scaled.name).toBe('Veteran Kobold'); // 43 - 1 >= 10
    });

    it('guards the Act 1 climax boss on Easy — the boss floor dominates the plain curve', () => {
      const boss = BESTIARY.sun_chariot_warden; // Base: HP 220, Atk 22, Def 9, XP 1200, minFloor 25, tags include 'boss'
      // Obsidian Siphon tier (floor 25) = 1.85; Easy = { base: 0.75, rate: 0.8, bossFloor: 1.15 }.
      // Plain curve: 0.75 * (1 + (1.85 - 1) * 0.8) = 0.75 * 1.68 = 1.26
      // Boss guard:  1.85 * 1.15 = 2.1275 (wins, since it's higher than the plain curve)
      const scaled = scaleMonsterStats(boss, 25, undefined, undefined, COTW_MONSTER_SCALING, 'easy');

      expect(scaled.hp).toBe(468); // round(220 * 2.1275)
      expect(scaled.attack).toBe(47); // round(22 * 2.1275)
      expect(scaled.defense).toBe(19); // round(9 * 2.1275)
      expect(scaled.xpValue).toBe(2553); // round(1200 * 2.1275)
      expect(scaled.name).toBe('Veteran The Sun-Chariot Warden'); // multiplier >= 1.8
      // Still a real fight, nowhere near a one-shot: HP more than doubled vs. base.
      expect(scaled.hp).toBeGreaterThan(boss.stats.hp * 2);
    });

    it('never lets a difficulty knob scale a monster below its authored base stats', () => {
      const kobold = BESTIARY.kobold;
      // Even a hypothetically tiny multiplier is clamped by the existing Math.max floor guard.
      const tinyConfig = {
        tiers: [{ floor: 1, multiplier: 1.0 }],
        difficulty: {
          easy: { basePowerMultiplier: 0.01, scalingRateMultiplier: 0.01 },
          medium: { basePowerMultiplier: 0.01, scalingRateMultiplier: 0.01 },
          hard: { basePowerMultiplier: 0.01, scalingRateMultiplier: 0.01 },
        },
      };
      const scaled = scaleMonsterStats(kobold, 1, undefined, undefined, tinyConfig, 'easy');
      expect(scaled.hp).toBe(kobold.stats.hp);
      expect(scaled.attack).toBe(kobold.stats.attack);
      expect(scaled.defense).toBe(kobold.stats.defense);
    });
  });
});
