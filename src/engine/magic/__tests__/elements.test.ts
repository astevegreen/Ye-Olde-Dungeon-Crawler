import { describe, it, expect } from 'vitest';
import { calculateElementalDamage, ELEMENT_OPPOSITES } from '../elements';

describe('Elemental Damage and Resistances', () => {
  it('correctly maps opposing element pairs', () => {
    expect(ELEMENT_OPPOSITES.fire).toBe('cold');
    expect(ELEMENT_OPPOSITES.cold).toBe('fire');
    expect(ELEMENT_OPPOSITES.lightning).toBe('poison');
    expect(ELEMENT_OPPOSITES.poison).toBe('lightning');
  });

  it('scales damage for neutral affinity (1.0x)', () => {
    const res = calculateElementalDamage(20, 'fire', 'neutral');
    expect(res.finalDamage).toBe(20);
    expect(res.multiplier).toBe(1.0);
    expect(res.isHeal).toBe(false);
  });

  it('scales damage for weak affinity (1.5x)', () => {
    const res = calculateElementalDamage(20, 'cold', 'weak');
    expect(res.finalDamage).toBe(30);
    expect(res.multiplier).toBe(1.5);
    expect(res.isHeal).toBe(false);
  });

  it('scales damage for resistant affinity (0.5x)', () => {
    const res = calculateElementalDamage(20, 'lightning', 'resistant');
    expect(res.finalDamage).toBe(10);
    expect(res.multiplier).toBe(0.5);
    expect(res.isHeal).toBe(false);
  });

  it('negates damage completely for immune affinity (0.0x)', () => {
    const res = calculateElementalDamage(20, 'poison', 'immune');
    expect(res.finalDamage).toBe(0);
    expect(res.multiplier).toBe(0.0);
    expect(res.isHeal).toBe(false);
  });

  it('heals the target when absorbing an element', () => {
    const res = calculateElementalDamage(25, 'fire', 'absorbing');
    expect(res.finalDamage).toBe(-25);
    expect(res.isHeal).toBe(true);
  });
});
