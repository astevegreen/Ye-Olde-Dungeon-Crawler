import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { getMonsterDefinitionSpriteKey } from '../../../rendering/atlas/sprite-mapper';

const monsters = cotwManifest.monsters ?? [];
const pixelSprites = cotwManifest.pixelSprites ?? {};
const portraits = cotwManifest.portraits ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in (cotwManifest.spriteRecipes ?? {});

describe('cotw portraits (art wave 9a)', () => {
  it('keys each portrait by the sprite its creature or townsfolk draws with', () => {
    expect(Object.keys(portraits).sort()).toEqual(['draugr', 'nidhogg', 'npc-sage']);
    for (const id of ['nidhogg', 'draugr']) {
      const def = monsters.find((m) => m.id === id);
      expect(def, id).toBeDefined();
      expect(getMonsterDefinitionSpriteKey(def!, hasSprite, cotwManifest.atlas?.spriteTagRules)).toBe(id);
    }
    expect('npc-sage' in pixelSprites).toBe(true);
  });

  it('paints four idle frames, each a full opaque square at the size asked', () => {
    for (const [key, sprite] of Object.entries(portraits)) {
      expect([key, sprite.frames]).toEqual([key, 4]);
      const px = sprite.render(0, 96);
      expect(px.length).toBe(96 * 96 * 4);
      let clear = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) clear++;
      expect([key, clear]).toEqual([key, 0]);
      expect(Buffer.from(sprite.render(2, 96)).equals(Buffer.from(px)), key).toBe(false);
    }
  });
});

describe('cotw painted screens (art wave 9a)', () => {
  const screens = cotwManifest.screenArt;

  it('paints the title, the death screen and each of the quest\'s endings', () => {
    expect(screens?.title).toBeDefined();
    expect(screens?.death).toBeDefined();
    const endings = Object.keys(cotwManifest.quest?.endings ?? {}).sort();
    expect(endings).toEqual(['ragnarok', 'sealed']);
    expect(Object.keys(screens?.endings ?? {}).sort()).toEqual(endings);
  });

  it('opens a painting that fills the window when scaled, with its boxes inside it', () => {
    for (const [w, h] of [[1366, 768], [390, 844]] as const) {
      const p = screens!.title!.open(w, h);
      expect(p.width * p.scale).toBeGreaterThanOrEqual(w);
      expect(p.height * p.scale).toBeGreaterThanOrEqual(h);
      expect(Number.isInteger(p.scale) && p.scale >= 1).toBe(true);
      for (const box of [p.text, p.calm]) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(w);
        expect(box.y + box.h).toBeLessThanOrEqual(h);
      }
      expect(p.paint(0).length).toBeGreaterThanOrEqual(p.width * p.height * 4);
    }
  });
});
