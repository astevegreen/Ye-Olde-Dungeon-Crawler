import { describe, it, expect } from 'vitest';
import { CoinItem, Item } from '../../../engine';
import { FRAME_LEGEND, itemFrameClass, itemFrameTone } from '../itemTone';

/** Tracker 2.9 (N29): an identified item's icon is framed in its family's color. */
const blade = (identified: boolean, category?: 'blessed' | 'hexed' | 'chaotic') => {
  const item = new Item({ id: 'b', name: 'Blade', category: 'weapon', weight: 500, bulk: 300, identified });
  if (category) item.addModifier({ id: 'm', name: category, alignment: category === 'hexed' ? 'negative' : category === 'chaotic' ? 'chaotic' : 'positive', category });
  return item;
};

describe('icon frames (N29)', () => {
  it('frames an identified item in its family’s tone, the one its name shows', () => {
    expect(itemFrameTone(blade(true, 'blessed'))).toBe('blessed');
    expect(itemFrameClass(blade(true, 'hexed'))).toBe(' it-frame it-frame-hexed');
    expect(itemFrameClass(blade(true, 'chaotic'))).toBe(' it-frame it-frame-chaotic');
  });

  it('leaves a plain item, an unidentified one and coins unframed', () => {
    expect(itemFrameClass(blade(true))).toBe('');
    expect(itemFrameClass(blade(false, 'hexed'))).toBe('');
    expect(itemFrameClass(new CoinItem({ id: 'c', denomination: 'gold', count: 3 }))).toBe('');
  });

  it('has a legend entry for every tone a frame can show', () => {
    expect(FRAME_LEGEND.map((e) => e.tone).sort()).toEqual(
      ['artifact', 'blessed', 'chaotic', 'cursed', 'enchanted', 'hexed', 'holy', 'unholy'].sort()
    );
  });
});
