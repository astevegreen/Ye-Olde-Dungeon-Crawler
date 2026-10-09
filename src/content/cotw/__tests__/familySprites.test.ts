import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_FAMILY_SPRITES } from '../sprites/familySprites';
import { COTW_BOSS_SPRITES } from '../sprites/bossSprites';
import { getMonsterDefinitionSpriteKey } from '../../../rendering/atlas/sprite-mapper';

const monsters = cotwManifest.monsters ?? [];
const pixelSprites = cotwManifest.pixelSprites ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in (cotwManifest.spriteRecipes ?? {});

describe('the cotw monster families give each member its own drawing', () => {
  it('keys every drawing by a real monster definition, apart from the bosses', () => {
    const ids = new Set(monsters.map((def) => def.id));
    for (const key of Object.keys(COTW_FAMILY_SPRITES)) {
      expect([key, ids.has(key)]).toEqual([key, true]);
      expect([key, key in COTW_BOSS_SPRITES]).toEqual([key, false]);
    }
  });

  it('draws each family member from its own sprite on the map, ahead of the tag rules', () => {
    for (const [id, sprite] of Object.entries(COTW_FAMILY_SPRITES)) {
      const def = monsters.find((m) => m.id === id)!;
      expect([id, getMonsterDefinitionSpriteKey(def, hasSprite, cotwManifest.atlas?.spriteTagRules)]).toEqual([id, id]);
      expect(pixelSprites[id], id).toBe(sprite);
    }
  });
});

describe('the cotw family sprites draw their own pixels', () => {
  // Every frame is baked once and shared: with dozens of families, baking per test outran the test timeout.
  const baked = Object.fromEntries(
    Object.entries(COTW_FAMILY_SPRITES).map(([id, sprite]) => [id, Array.from({ length: sprite.frames ?? 1 }, (_, f) => sprite.render(f, 64))]),
  );
  const frames = Object.fromEntries(Object.entries(baked).map(([id, all]) => [id, all[0]]));

  it('bake four idle frames of 64 × 64 pixels, the same every time, that move between frames', () => {
    for (const [id, sprite] of Object.entries(COTW_FAMILY_SPRITES)) {
      expect([id, sprite.frames]).toEqual([id, 4]);
      expect(frames[id].length).toBe(64 * 64 * 4);
      expect(sprite.render(0, 64)).toEqual(frames[id]);
      expect(baked[id][2], id).not.toEqual(frames[id]);
    }
    // Re-rendering every family and comparing its pixels took 5.5 s under the full suite, past the 5 s default.
  }, 30_000);

  it('draw a figure and leave the corners clear', () => {
    for (const [id, px] of Object.entries(frames)) {
      const alpha = (x: number, y: number) => px[(y * 64 + x) * 4 + 3];
      expect([id, alpha(0, 0), alpha(63, 0)]).toEqual([id, 0, 0]);
      // counted by coverage, not opacity: the myling and the kirkegrim are see-through
      let drawn = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) drawn++;
      expect(drawn / (64 * 64), id).toBeGreaterThan(0.1);
    }
  });

  it('keep the whole outline inside the cell, clear of its top and sides, in every frame', () => {
    // As for the bosses: a fully opaque edge pixel is body or the outline's inner ring, so a
    // tip there runs into the edge and loses its outline.
    for (const [id, all] of Object.entries(baked)) {
      for (const [f, px] of all.entries()) {
        const opaque = (x: number, y: number) => px[(y * 64 + x) * 4 + 3] === 255;
        const edge: string[] = [];
        for (let i = 0; i < 64; i++) {
          if (opaque(i, 0)) edge.push(`top ${i}`);
          if (opaque(0, i)) edge.push(`left ${i}`);
          if (opaque(63, i)) edge.push(`right ${i}`);
        }
        expect([id, f, edge]).toEqual([id, f, []]);
      }
    }
  });

  it('look unlike one another', () => {
    const ids = Object.keys(frames);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(frames[ids[i]], `${ids[i]} vs ${ids[j]}`).not.toEqual(frames[ids[j]]);
  });
});
