import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { getMonsterDefinitionSpriteKey } from '../../../rendering/atlas/sprite-mapper';

const monsters = cotwManifest.monsters ?? [];
const pixelSprites = cotwManifest.pixelSprites ?? {};
const portraits = cotwManifest.portraits ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in (cotwManifest.spriteRecipes ?? {});

// Wave 9a: Níðhögg, the draugr, Mímir. Wave 9b: the other eight bosses and four elites.
const CREATURES = [
  'nidhogg', 'draugr',
  'miniboss_frost_warden', 'sun_chariot_warden', 'miniboss_tar_abomination', 'miniboss_rot_matriarch',
  'miniboss_maw_herald', 'miniboss_marrow_eater', 'glod', 'ividja',
  'root_bound_berserker', 'ironwood_troll_wife', 'malice_weaver', 'hel_warden',
];

describe('cotw portraits (art waves 9a and 9b)', () => {
  it('keys each portrait by the sprite its creature or townsfolk draws with', () => {
    expect(Object.keys(portraits).sort()).toEqual([...CREATURES, 'npc-sage'].sort());
    for (const id of CREATURES) {
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
  }, 30_000);
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
