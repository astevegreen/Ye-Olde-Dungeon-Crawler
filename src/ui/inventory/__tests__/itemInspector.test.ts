import { describe, it, expect } from 'vitest';
import { getItemThematicColor } from '../itemInspector';
import { resolveThemeTokens } from '../../../rendering/theme';
import { Item } from '../../../engine';

const theme = resolveThemeTokens(undefined);

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

describe('getItemThematicColor', () => {
  it('gives an unidentified item no special color, even one that would otherwise be enchanted', () => {
    const item = makeItem({ identified: false, quality: 'enchanted' });
    expect(getItemThematicColor(item, theme)).toBe(theme.hudText);
  });

  it('colors a cursed identified item crimson red', () => {
    const item = makeItem({ identified: true, quality: 'cursed' });
    expect(getItemThematicColor(item, theme)).toBe('#ef4444');
  });

  it('colors a hexed identified item amber', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'hex', name: 'Hexed', alignment: 'negative', category: 'hexed' }];
    expect(getItemThematicColor(item, theme)).toBe('#f97316');
  });

  it('colors an unholy identified item profane teal', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'unholy', name: 'Unholy', alignment: 'negative', category: 'unholy' }];
    expect(getItemThematicColor(item, theme)).toBe('#0d9488');
  });

  it('colors a holy identified item radiant gold, distinct from blessed', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'holy', name: 'of the Templar', alignment: 'positive', category: 'holy' }];
    expect(getItemThematicColor(item, theme)).toBe('#fbbf24');
  });

  it('colors a blessed identified item sky blue', () => {
    const item = makeItem({ identified: true, quality: 'blessed' as Item['quality'] });
    expect(getItemThematicColor(item, theme)).toBe('#38bdf8');
  });

  it('colors an enchanted identified item arcane violet, distinct from blessed and holy', () => {
    const item = makeItem({ identified: true, quality: 'enchanted' });
    expect(getItemThematicColor(item, theme)).toBe('#c084fc');
  });

  it('colors a chaotic identified item magenta, distinct from every other bucket', () => {
    const item = makeItem({ identified: true, quality: 'chaotic' as Item['quality'] });
    expect(getItemThematicColor(item, theme)).toBe('#e879f9');
  });

  it('gives every one of the eight alignment buckets (normal + 3 positive + 3 negative + chaotic) a unique color', () => {
    const identifiedNormal = makeItem({ identified: true });
    const blessed = makeItem({ identified: true, quality: 'blessed' as Item['quality'] });
    const enchanted = makeItem({ identified: true, quality: 'enchanted' });
    const holy = makeItem({ identified: true });
    holy.modifiers = [{ id: 'holy', name: 'of Dawn', alignment: 'positive', category: 'holy' }];
    const cursed = makeItem({ identified: true, quality: 'cursed' });
    const hexed = makeItem({ identified: true });
    hexed.modifiers = [{ id: 'hexed', name: 'Hexed', alignment: 'negative', category: 'hexed' }];
    const unholy = makeItem({ identified: true });
    unholy.modifiers = [{ id: 'unholy', name: 'Unholy', alignment: 'negative', category: 'unholy' }];
    const chaotic = makeItem({ identified: true, quality: 'chaotic' as Item['quality'] });

    const colors = [identifiedNormal, blessed, enchanted, holy, cursed, hexed, unholy, chaotic].map((i) =>
      getItemThematicColor(i, theme)
    );
    expect(new Set(colors).size).toBe(colors.length);
  });
});
