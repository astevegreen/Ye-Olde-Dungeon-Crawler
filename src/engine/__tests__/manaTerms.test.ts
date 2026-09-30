import { describe, it, expect } from 'vitest';
import { resolveManaTerms } from '../types/manifest';

describe('resolveManaTerms', () => {
  it('says Mana and MP for a pack that names neither', () => {
    expect(resolveManaTerms({})).toEqual({ name: 'Mana', unit: 'MP' });
    expect(resolveManaTerms(undefined)).toEqual({ name: 'Mana', unit: 'MP' });
  });

  it('writes amounts in the pack word when only the name is given', () => {
    expect(resolveManaTerms({ branding: { manaName: 'Seiðr' } })).toEqual({ name: 'Seiðr', unit: 'Seiðr' });
  });

  it('uses a unit the pack declares', () => {
    expect(resolveManaTerms({ branding: { manaName: 'Essence', manaUnit: 'EP' } })).toEqual({ name: 'Essence', unit: 'EP' });
  });
});
