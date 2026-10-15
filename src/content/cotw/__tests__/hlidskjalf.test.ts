import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';
import { COTW_GRIMOIRES } from '../grimoires';

/** 4c-1: the seer's spells merged into Hliðskjálf, and the trickster's Switch. */
describe('cotw Hliðskjálf and Loki’s Switch', () => {
  const spell = (id: string) => cotwManifest.spells?.find((s) => s.id === id);

  it('channels two turns, and each element neighbour lends a raven layer', () => {
    const seer = spell('hlidskjalf')!;
    expect(seer.channel).toBe(2);
    expect(seer.spellType).toBeUndefined();
    for (const flavour of ['fire', 'cold', 'physical', 'lightning', 'poison', 'shadow', 'healing']) {
      expect(seer.lendOverrides?.[flavour]?.effects?.[0]?.type, flavour).toBe('reveal');
    }
    expect(seer.lendOverrides?.['blood-price']?.reachBonus).toBe(1);
    expect(seer.lendOverrides?.['arcane:Movement']?.reachBonus).toBe(1);
  });

  it('retires the Detect spells and Clairvoyance into it', () => {
    for (const id of ['detect_monsters', 'detect_objects', 'clairvoyance']) {
      expect(spell(id)).toBeUndefined();
      expect(COTW_GRIMOIRES.retired?.spells?.[id]).toBe('hlidskjalf');
    }
  });

  it('lets a healing neighbour hand the Switch’s afflictions over instead of cleansing', () => {
    expect(spell('loki_switch')?.lendOverrides?.healing?.effects).toEqual([{ type: 'handOver' }]);
  });
});
