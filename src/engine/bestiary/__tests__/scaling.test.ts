import { describe, it, expect } from 'vitest';
import { COTW_BESTIARY as BESTIARY } from '../../../content/cotw/monsters';
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
});
