import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_ITEM_AURAS } from '../sprites';
import { COTW_ITEM_PIXEL_SPRITES } from '../sprites/itemSprites';
import { FRAME_LEGEND } from '../../../ui/inventory/itemTone';

const SIZE = 64;
/** A long blade, a small ring and a round shield: the auras must fit around each. */
const SAMPLE = ['broadsword', 'ring', 'wooden_shield'];

describe('the cotw item auras', () => {
  const items = SAMPLE.map((id) => {
    expect(COTW_ITEM_PIXEL_SPRITES[id], id).toBeDefined();
    return COTW_ITEM_PIXEL_SPRITES[id].render(0, SIZE);
  });
  const tones: readonly string[] = COTW_ITEM_AURAS.tones;
  const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => Buffer.from(a.buffer).equals(Buffer.from(b.buffer));
  /** Per tone, per sample item, every frame. */
  const baked: Record<string, Uint8ClampedArray[][]> = Object.fromEntries(
    tones.map((tone: string) => [tone, items.map((px) => Array.from({ length: COTW_ITEM_AURAS.frames }, (_, f) => COTW_ITEM_AURAS.render(px, SIZE, tone, f)))]),
  );

  it('are the manifest’s, with one for every family an icon frame shows, looping over 16 frames', () => {
    expect(cotwManifest.itemAuras).toBe(COTW_ITEM_AURAS);
    expect([...tones].sort()).toEqual(FRAME_LEGEND.map((e) => e.tone).sort());
    expect(COTW_ITEM_AURAS.frames).toBe(16);
  });

  it('bake the same pixels every time, leave the item’s own untouched, and loop round', () => {
    const before = items.map((px) => px.slice());
    for (const tone of tones) {
      expect(COTW_ITEM_AURAS.render(items[0], SIZE, tone, 3)).toEqual(baked[tone][0][3]);
      expect(COTW_ITEM_AURAS.render(items[0], SIZE, tone, 16)).toEqual(baked[tone][0][0]);
    }
    expect(items).toEqual(before);
  }, 30_000);

  it('move, and look unlike the plain item and unlike each other', () => {
    const seen = new Map<string, string>();
    for (const tone of tones) {
      const frames = baked[tone][0];
      expect([tone, same(frames[0], frames[8]), same(frames[0], items[0])]).toEqual([tone, false, false]);
      const key = Buffer.from(frames[0].buffer).toString('base64');
      expect([tone, seen.get(key)]).toEqual([tone, undefined]);
      seen.set(key, tone);
    }
  });

  it('keep every frame clear of the cell’s top and sides', () => {
    for (const tone of tones) {
      baked[tone].forEach((frames, i) => {
        frames.forEach((px, f) => {
          const opaque = (x: number, y: number) => px[(y * SIZE + x) * 4 + 3] === 255;
          const edge: string[] = [];
          for (let k = 0; k < SIZE; k++) {
            if (opaque(k, 0)) edge.push(`top ${k}`);
            if (opaque(0, k)) edge.push(`left ${k}`);
            if (opaque(SIZE - 1, k)) edge.push(`right ${k}`);
          }
          expect([tone, SAMPLE[i], f, edge]).toEqual([tone, SAMPLE[i], f, []]);
        });
      });
    }
  });
});
