import { describe, it, expect } from 'vitest';
import { Item } from '../../engine';
import { itemFrameColor } from '../itemFrame';
import { resolveThemeTokens } from '../theme';

/** Tracker 2.9 (N29): ground loot's square is framed in the item's family color once known. */
const blade = (identified: boolean, hexed: boolean) => {
  const item = new Item({ id: 'b', name: 'Blade', category: 'weapon', weight: 500, bulk: 300, identified });
  if (hexed) item.addModifier({ id: 'm', name: 'Hexed', alignment: 'negative', category: 'hexed' });
  return item;
};

describe('the ground frame (N29)', () => {
  it('draws a known family item in its theme color, and leaves the rest to the accent', () => {
    const theme = resolveThemeTokens({});
    expect(itemFrameColor(theme, blade(true, true))).toBe(theme.rarityHexed);
    expect(itemFrameColor(theme, blade(false, true))).toBeNull();
    expect(itemFrameColor(theme, blade(true, false))).toBeNull();
  });
});
