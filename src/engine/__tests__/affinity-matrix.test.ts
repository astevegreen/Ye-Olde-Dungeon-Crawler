import { describe, it, expect } from 'vitest';
import {
  AffinityMatrix,
  DEFAULT_AFFINITY_MATRIX,
  calculateElementalDamage,
} from '../magic/elements';
import { Entity } from '../entities/entity';

describe('Data-Driven Elemental Affinity Matrix', () => {
  it('correctly uses default affinity matrix for standard classic CotW elements', () => {
    // Normal damage
    const normal = calculateElementalDamage(20, 'fire', 'neutral');
    expect(normal.finalDamage).toBe(20);
    expect(normal.isHeal).toBe(false);

    // Weakness (150%)
    const weak = calculateElementalDamage(20, 'fire', 'weak');
    expect(weak.finalDamage).toBe(30);

    // Resistance (50%)
    const res = calculateElementalDamage(20, 'fire', 'resistant');
    expect(res.finalDamage).toBe(10);

    // Immunity (0%)
    const imm = calculateElementalDamage(20, 'fire', 'immune');
    expect(imm.finalDamage).toBe(0);

    // Absorbing (Heals target)
    const abs = calculateElementalDamage(20, 'cold', 'absorbing');
    expect(abs.isHeal).toBe(true);
    expect(abs.finalDamage).toBe(-20);
  });

  it('queries behavioral flags: reflection, ground hazards, opposites', () => {
    expect(DEFAULT_AFFINITY_MATRIX.canReflect('lightning')).toBe(true);
    expect(DEFAULT_AFFINITY_MATRIX.canReflect('fire')).toBe(false);

    expect(DEFAULT_AFFINITY_MATRIX.isGroundHazard('poison')).toBe(true);
    expect(DEFAULT_AFFINITY_MATRIX.isGroundHazard('cold')).toBe(false);

    expect(DEFAULT_AFFINITY_MATRIX.getOpposite('fire')).toBe('cold');
    expect(DEFAULT_AFFINITY_MATRIX.getOpposite('cold')).toBe('fire');
    expect(DEFAULT_AFFINITY_MATRIX.getOpposite('lightning')).toBe('poison');
  });

  it('supports custom theme-forked elements (e.g. Holy, Shadow, Nature) with custom multipliers', () => {
    const warcraftMatrix = new AffinityMatrix({
      elements: [
        { id: 'holy', name: 'Holy', oppositeElementId: 'shadow' },
        { id: 'shadow', name: 'Shadow', oppositeElementId: 'holy', canReflect: true },
        { id: 'nature', name: 'Nature', groundHazard: true },
      ],
      defaultMultipliers: {
        weak: 2.0, // 200% instead of 150%
        neutral: 1.0,
        resistant: 0.25, // 25% instead of 50%
        immune: 0.0,
        absorbing: -1.5,
      },
      // Matrix overrides: Holy vs Undead (custom affinity 'undead_curse' takes 3.0x damage)
      matrix: {
        holy: {
          undead_curse: 3.0,
        },
      },
    });

    expect(warcraftMatrix.getOpposite('holy')).toBe('shadow');
    expect(warcraftMatrix.canReflect('shadow')).toBe(true);
    expect(warcraftMatrix.isGroundHazard('nature')).toBe(true);

    // Test custom default multipliers
    const weakHoly = warcraftMatrix.calculateDamage(20, 'holy', 'weak');
    expect(weakHoly.finalDamage).toBe(40); // 20 * 2.0

    const resShadow = warcraftMatrix.calculateDamage(20, 'shadow', 'resistant');
    expect(resShadow.finalDamage).toBe(5); // 20 * 0.25

    // Test custom matrix override
    const holySmite = warcraftMatrix.calculateDamage(20, 'holy', 'undead_curse' as any);
    expect(holySmite.finalDamage).toBe(60); // 20 * 3.0
  });

  it('integrates cleanly with Entity.takeElementalDamage', () => {
    const entity = new Entity({
      id: 'test-orc',
      name: 'Fel Orc',
      type: 'monster',
      faction: 'hostile',
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
      resistances: {
        fire: 'weak',
        shadow: 'resistant',
        healing: 'absorbing',
      },
    });

    // Fire damage (weak -> 150%)
    const fireRes = entity.takeElementalDamage(20, 'fire');
    expect(fireRes.finalDamage).toBe(30);
    expect(entity.hp).toBe(70);

    // Healing element (absorbing -> heals 20 HP)
    const healRes = entity.takeElementalDamage(20, 'healing');
    expect(healRes.isHeal).toBe(true);
    expect(healRes.healed).toBe(20);
    expect(entity.hp).toBe(90);

    // Custom matrix passed into takeElementalDamage
    const customMatrix = new AffinityMatrix({
      defaultMultipliers: {
        weak: 3.0, // 300%
        neutral: 1.0,
        resistant: 0.1,
        immune: 0.0,
        absorbing: -1.0,
      },
    });

    const superFire = entity.takeElementalDamage(10, 'fire', customMatrix);
    expect(superFire.finalDamage).toBe(30); // 10 * 3.0
    expect(entity.hp).toBe(60);
  });
});
