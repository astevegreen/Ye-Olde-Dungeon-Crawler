import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_COMPANION_SPRITES, COTW_TOWNSFOLK_SPRITES } from '../sprites/allySprites';
import { COTW_COMPANIONS } from '../companions';
import { COTW_TOWN } from '../town';
import { IVALDA_ID } from '../ironClans';
import { getEntitySpriteKey } from '../../../rendering/atlas/sprite-mapper';
import { Companion } from '../../../engine/entities/companion';
import { NPC } from '../../../engine/entities/npc';

const pixelSprites = cotwManifest.pixelSprites ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in (cotwManifest.spriteRecipes ?? {});
const ALL = { ...COTW_COMPANION_SPRITES, ...COTW_TOWNSFOLK_SPRITES };

describe('the cotw companions and townsfolk have their own drawings', () => {
  it('keys each companion drawing by a real companion, and each townsfolk drawing by a real NPC', () => {
    const companions = new Set(COTW_COMPANIONS.map((c) => c.id));
    for (const key of Object.keys(COTW_COMPANION_SPRITES)) expect([key, companions.has(key)]).toEqual([key, true]);
    const npcs = new Set([...COTW_TOWN.npcs.map((n) => n.id), IVALDA_ID]);
    for (const key of Object.keys(COTW_TOWNSFOLK_SPRITES)) expect([key, npcs.has(key)]).toEqual([key, true]);
  });

  it('draws every hound as itself on the map, not as the enemy wolf', () => {
    for (const def of COTW_COMPANIONS) {
      const hound = new Companion({
        id: `companion-${def.id}-1`,
        name: def.name,
        position: { x: 1, y: 1 },
        stats: { ...def.stats },
        speed: def.speed,
        companionDefinitionId: def.id,
        packWeightCapacity: def.packWeightCapacity,
        packBulkCapacity: def.packBulkCapacity,
      });
      expect([def.id, getEntitySpriteKey(hound, hasSprite, cotwManifest.atlas?.spriteTagRules)]).toEqual([def.id, def.id]);
      expect(pixelSprites[def.id], def.id).toBe(COTW_COMPANION_SPRITES[def.id]);
    }
  });

  it('draws each drawn townsperson by their own id, ahead of the role sprite', () => {
    for (const id of Object.keys(COTW_TOWNSFOLK_SPRITES)) {
      const npc = new NPC({ id, name: id, role: 'merchant', position: { x: 1, y: 1 } });
      expect(getEntitySpriteKey(npc, hasSprite)).toBe(id);
      expect(pixelSprites[id], id).toBe(COTW_TOWNSFOLK_SPRITES[id]);
    }
  });
});

describe('the cotw companion and townsfolk sprites draw their own pixels', () => {
  // Baked once and shared, as for the families: baking per test outruns the default timeout.
  const baked = Object.fromEntries(
    Object.entries(ALL).map(([id, sprite]) => [id, Array.from({ length: sprite.frames ?? 1 }, (_, f) => sprite.render(f, 64))]),
  );
  const frames = Object.fromEntries(Object.entries(baked).map(([id, all]) => [id, all[0]]));

  it('bake four idle frames of 64 × 64 pixels, the same every time, that move between frames', () => {
    for (const [id, sprite] of Object.entries(ALL)) {
      expect([id, sprite.frames]).toEqual([id, 4]);
      expect(frames[id].length).toBe(64 * 64 * 4);
      expect(sprite.render(0, 64)).toEqual(frames[id]);
      expect(baked[id][2], id).not.toEqual(frames[id]);
    }
  }, 30_000);

  it('draw a figure and leave the corners clear', () => {
    for (const [id, px] of Object.entries(frames)) {
      const alpha = (x: number, y: number) => px[(y * 64 + x) * 4 + 3];
      expect([id, alpha(0, 0), alpha(63, 0)]).toEqual([id, 0, 0]);
      let drawn = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) drawn++;
      expect(drawn / (64 * 64), id).toBeGreaterThan(0.1);
    }
  });

  it('keep the whole outline inside the cell, clear of its top and sides, in every frame', () => {
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
