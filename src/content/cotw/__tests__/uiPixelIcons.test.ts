import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_UI_PIXEL_ICONS } from '../sprites';

const SIZE = 64;
/** The header shows an icon at about 15 px; each is drawn on a 16 px grid. */
const BLOCK = SIZE / 16;

describe('HUD icons drawn for the HUD', () => {
  it('draws the backpack, coins, chest and rune stone as pixel icons, with no old recipe left under them', () => {
    expect(Object.keys(COTW_UI_PIXEL_ICONS).sort()).toEqual(['ui~chest', 'ui~inventory', 'ui~loot', 'ui~rune']);
    for (const key of Object.keys(COTW_UI_PIXEL_ICONS)) {
      expect(cotwManifest.pixelSprites?.[key]).toBe(COTW_UI_PIXEL_ICONS[key]);
      expect(cotwManifest.spriteRecipes?.[key]).toBeUndefined();
    }
  });

  it('fills most of the cell in whole 16 px pixels, so nothing smears at header size', () => {
    for (const [key, sprite] of Object.entries(COTW_UI_PIXEL_ICONS)) {
      const px = sprite.render(0, SIZE);
      expect(px.length, key).toBe(SIZE * SIZE * 4);
      let x0 = SIZE, x1 = -1, y0 = SIZE, y1 = -1;
      let offGrid = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = (y * SIZE + x) * 4;
          const block = ((y - (y % BLOCK)) * SIZE + (x - (x % BLOCK))) * 4;
          for (let c = 0; c < 4; c++) if (px[i + c] !== px[block + c]) offGrid++;
          if (px[i + 3] > 0) {
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
        }
      }
      expect(offGrid, key).toBe(0);
      expect(Math.max(x1 - x0, y1 - y0) + 1, key).toBeGreaterThanOrEqual(SIZE * 0.75);
      expect(sprite.render(0, SIZE), `${key} is deterministic`).toEqual(px);
    }
  });
});
