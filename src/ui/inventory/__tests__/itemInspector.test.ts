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

  it('colors an unholy identified item profane violet', () => {
    const item = makeItem({ identified: true });
    item.modifiers = [{ id: 'unholy', name: 'Unholy', alignment: 'negative', category: 'unholy' }];
    expect(getItemThematicColor(item, theme)).toBe('#7c3aed');
  });

  it('colors a blessed identified item sky blue', () => {
    const item = makeItem({ identified: true, quality: 'blessed' as Item['quality'] });
    expect(getItemThematicColor(item, theme)).toBe('#38bdf8');
  });

  it('colors an enchanted identified item arcane violet', () => {
    const item = makeItem({ identified: true, quality: 'enchanted' });
    expect(getItemThematicColor(item, theme)).toBe('#c084fc');
  });
});
