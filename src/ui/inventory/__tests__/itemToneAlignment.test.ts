import { describe, it, expect } from 'vitest';
import { itemTone } from '../itemTone';
import { Item } from '../../../engine';

function makeItem(overrides: Partial<Item> = {}): Item {
  const item = new Item({
    id: 'test-item',
    name: 'Test Blade',
    category: 'weapon',
    weight: 500,
    bulk: 300,
  });
  Object.assign(item, overrides);
  return item;
}

describe('itemTone: the eight alignment buckets', () => {
  it('gives an unidentified item no special color, even one that would otherwise be enchanted', () => {
    const item = makeItem({ identified: false, enchantmentLevel: 2 });
    item.modifiers = [{ id: 'blessed', name: 'Blessed', alignment: 'positive', category: 'blessed' }];
    expect(itemTone(item)).toBe(null);
  });

  it('colors a cursed identified item crimson red', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'cursed', name: 'Cursed', alignment: 'negative', category: 'cursed', binds: true }];
    expect(itemTone(item)).toBe('cursed');
  });

  it('colors a hexed identified item amber', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'hex', name: 'Hexed', alignment: 'negative', category: 'hexed' }];
    expect(itemTone(item)).toBe('hexed');
  });

  it('colors an unholy identified item profane teal', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'unholy', name: 'Unholy', alignment: 'negative', category: 'unholy' }];
    expect(itemTone(item)).toBe('unholy');
  });

  it('colors a holy identified item radiant gold, distinct from blessed', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'holy', name: 'of the Templar', alignment: 'positive', category: 'holy' }];
    expect(itemTone(item)).toBe('holy');
  });

  it('colors a blessed identified item sky blue', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'blessed', name: 'Blessed', alignment: 'positive', category: 'blessed' }];
    expect(itemTone(item)).toBe('blessed');
  });

  it('colors an enchanted identified item arcane violet, distinct from blessed and holy', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'enchanted', name: 'Enchanted', alignment: 'positive', category: 'enchanted' }];
    expect(itemTone(item)).toBe('enchanted');
  });

  it('colors a Blessed Broadsword +1 by its family, not by its +N', () => {
    const item = makeItem({ identified: true, enchantmentLevel: 1 });
    item.modifiers = [{ id: 'blessed', name: 'Blessed', alignment: 'positive', category: 'blessed' }];
    expect(itemTone(item)).toBe('blessed');
  });

  it('colors a chaotic identified item magenta, distinct from every other bucket', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'chaotic', name: 'Frenetic', alignment: 'chaotic', category: 'chaotic' }];
    expect(itemTone(item)).toBe('chaotic');
  });

  it('gives every one of the eight alignment buckets (normal + 3 positive + 3 negative + chaotic) its own tone', () => {
    const identifiedNormal = makeItem({ identified: true });
    const blessed = makeItem({ identified: true });
    blessed.modifiers = [{ id: 'blessed', name: 'Blessed', alignment: 'positive', category: 'blessed' }];
    const enchanted = makeItem({ identified: true });
    enchanted.modifiers = [{ id: 'enchanted', name: 'Enchanted', alignment: 'positive', category: 'enchanted' }];
    const holy = makeItem({ identified: true });
    holy.modifiers = [{ id: 'holy', name: 'of Dawn', alignment: 'positive', category: 'holy' }];
    const cursed = makeItem({ identified: true });
    cursed.modifiers = [{ id: 'cursed', name: 'Cursed', alignment: 'negative', category: 'cursed', binds: true }];
    const hexed = makeItem({ identified: true });
    hexed.modifiers = [{ id: 'hexed', name: 'Hexed', alignment: 'negative', category: 'hexed' }];
    const unholy = makeItem({ identified: true });
    unholy.modifiers = [{ id: 'unholy', name: 'Unholy', alignment: 'negative', category: 'unholy' }];
    const chaotic = makeItem({ identified: true });
    chaotic.modifiers = [{ id: 'chaotic', name: 'Frenetic', alignment: 'chaotic', category: 'chaotic' }];

    const colors = [identifiedNormal, blessed, enchanted, holy, cursed, hexed, unholy, chaotic].map((i) =>
      itemTone(i)
    );
    expect(new Set(colors).size).toBe(colors.length);
  });
});
