import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_BOSS_SPRITES } from '../sprites/bossSprites';
import { getMonsterDefinitionSpriteKey } from '../../../rendering/atlas/sprite-mapper';

const monsters = cotwManifest.monsters ?? [];
const pixelSprites = cotwManifest.pixelSprites ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in (cotwManifest.spriteRecipes ?? {});

describe('every cotw boss and named elite has its own drawing', () => {
  it('draws each boss and miniboss, and Glóð and Iviðja, from its own sprite, not the shared giant', () => {
    const bosses = monsters.filter((def) => def.tags?.some((tag) => tag === 'boss' || tag === 'miniboss')).map((def) => def.id);
    expect(bosses.length).toBeGreaterThanOrEqual(7);
    for (const id of [...bosses, 'glod', 'ividja']) {
      const def = monsters.find((m) => m.id === id);
      expect(def, id).toBeDefined();
      expect([id, getMonsterDefinitionSpriteKey(def!, hasSprite, cotwManifest.atlas?.spriteTagRules)]).toEqual([id, id]);
      expect(pixelSprites[id], id).toBe(COTW_BOSS_SPRITES[id]);
    }
  });

  it('keys every drawing by a real monster definition', () => {
    const ids = new Set(monsters.map((def) => def.id));
    for (const key of Object.keys(COTW_BOSS_SPRITES)) expect([key, ids.has(key)]).toEqual([key, true]);
  });
});

describe('the cotw boss sprites draw their own pixels', () => {
  const frames = Object.fromEntries(Object.entries(COTW_BOSS_SPRITES).map(([id, sprite]) => [id, sprite.render(0, 64)]));

  it('bake four idle frames of 64 × 64 pixels, the same every time, that move between frames', () => {
    for (const [id, sprite] of Object.entries(COTW_BOSS_SPRITES)) {
      expect([id, sprite.frames]).toEqual([id, 4]);
      expect(frames[id].length).toBe(64 * 64 * 4);
      expect(sprite.render(0, 64)).toEqual(frames[id]);
      expect(sprite.render(2, 64), id).not.toEqual(frames[id]);
    }
  });

  it('fill most of the cell and leave its corners clear', () => {
    for (const [id, px] of Object.entries(frames)) {
      const alpha = (x: number, y: number) => px[(y * 64 + x) * 4 + 3];
      expect([id, alpha(0, 0), alpha(63, 0)]).toEqual([id, 0, 0]);
      let solid = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] === 255) solid++;
      expect(solid / (64 * 64), id).toBeGreaterThan(0.25);
    }
  });

  it('keep the whole outline inside the cell, clear of its top and sides, in every frame', () => {
    // Only the body and the outline's inner ring are fully opaque, so a fully opaque edge pixel
    // means a horn or tip runs into the edge and loses its outline there.
    for (const [id, sprite] of Object.entries(COTW_BOSS_SPRITES)) {
      for (let f = 0; f < (sprite.frames ?? 1); f++) {
        const px = sprite.render(f, 64);
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
