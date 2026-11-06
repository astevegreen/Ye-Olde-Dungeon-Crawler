import { describe, it, expect } from 'vitest';
import { calculateElementalDamage } from '../elements';
import type { ElementalAffinity, ElementType } from '../elements';

describe('Elemental Damage and Resistances', () => {
  it.each<[ElementalAffinity, ElementType, number, number, number]>([
    // affinity, element, base, multiplier, final
    ['neutral', 'fire', 20, 1.0, 20],
    ['weak', 'cold', 20, 1.5, 30],
    ['resistant', 'lightning', 20, 0.5, 10],
    ['immune', 'poison', 20, 0.0, 0],
    // Odd damage rounds half up, and a hit that lands is never below 1.
    ['weak', 'cold', 7, 1.5, 11],
    ['resistant', 'lightning', 7, 0.5, 4],
    ['resistant', 'lightning', 1, 0.5, 1],
  ])('%s to %s: %i damage x%f is %i', (affinity, element, base, multiplier, final) => {
    const res = calculateElementalDamage(base, element, affinity);
    expect(res.finalDamage).toBe(final);
    expect(res.multiplier).toBe(multiplier);
    expect(res.isHeal).toBe(false);
  });

  it('heals the target when absorbing an element', () => {
    const res = calculateElementalDamage(25, 'fire', 'absorbing');
    expect(res.finalDamage).toBe(-25);
    expect(res.isHeal).toBe(true);
  });
});
