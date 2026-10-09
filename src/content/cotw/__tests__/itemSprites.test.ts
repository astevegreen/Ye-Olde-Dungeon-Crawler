import { describe, it, expect } from 'vitest';
import type { Item } from '../../../engine';
import { cotwManifest } from '..';
import { COTW_ITEM_PIXEL_SPRITES } from '../sprites/itemSprites';
import { COTW_SPELL_TABLETS } from '../spellTablets';
import { getItemSpriteKey } from '../../../rendering/atlas/sprite-mapper';

const pixelSprites = cotwManifest.pixelSprites ?? {};
const recipes = cotwManifest.spriteRecipes ?? {};
const hasSprite = (key: string) => key in pixelSprites || key in recipes;
/** Every item definition the game can make: the loot pool, the spell tablets and the two sold only in town. */
const definitions = [...(cotwManifest.items ?? []), ...COTW_SPELL_TABLETS];
const ids = new Set([...definitions.map((d) => d.id), 'ironclasp_purse', 'wooden_torch']);
/** What an item without its own sprite falls back to (`getItemSpriteKey`). */
const ARCHETYPES = ['gold_coins', 'purse', 'belt', 'travel_bread', 'rune_stone', 'iron_armor', 'mace', 'warhammer', 'ring', 'amulet', 'cloak', 'gauntlets', 'bracers', 'scroll', 'gem', 'key', 'torch'];
/** Relics drawn by their own recipe until they are sculpted (wave 8). */
const ON_RECIPES = ['sol_shard_focus', 'petrified_world_bark_tower_shield', 'antler_crowned_mask', 'marrow_gnawed_ring', 'duergar_lodestone'];

describe('the cotw items each have a drawing', () => {
  it('keys every sprite by a real item definition or a fallback archetype', () => {
    for (const key of Object.keys(COTW_ITEM_PIXEL_SPRITES)) expect([key, ids.has(key) || ARCHETYPES.includes(key)]).toEqual([key, true]);
    for (const key of ARCHETYPES) expect([key, key in COTW_ITEM_PIXEL_SPRITES]).toEqual([key, true]);
  });

  it('draws every definition from its own sprite, apart from the relics still on recipes', () => {
    for (const def of definitions) {
      if (ON_RECIPES.includes(def.id)) {
        expect([def.id, def.id in recipes]).toEqual([def.id, true]);
        continue;
      }
      const item = { id: `${def.id}-1`, definitionId: def.id, name: def.name, category: def.category } as unknown as Item;
      expect([def.id, getItemSpriteKey(item, hasSprite)]).toEqual([def.id, def.id]);
      expect(pixelSprites[def.id], def.id).toBe(COTW_ITEM_PIXEL_SPRITES[def.id]);
    }
  });
});

describe('the cotw item sprites draw their own pixels', () => {
  const baked = Object.fromEntries(
    Object.entries(COTW_ITEM_PIXEL_SPRITES).map(([id, sprite]) => [id, Array.from({ length: sprite.frames ?? 1 }, (_, f) => sprite.render(f, 64))]),
  );
  const first = Object.fromEntries(Object.entries(baked).map(([id, all]) => [id, all[0]]));

  it('bake 64 × 64 pixels, the same every time, and animated ones move', () => {
    for (const [id, sprite] of Object.entries(COTW_ITEM_PIXEL_SPRITES)) {
      expect(first[id].length).toBe(64 * 64 * 4);
      expect(sprite.render(0, 64)).toEqual(first[id]);
      if ((sprite.frames ?? 1) > 1) expect(baked[id][1], id).not.toEqual(first[id]);
    }
  }, 30_000);

  it('draw something and leave the corners clear', () => {
    for (const [id, px] of Object.entries(first)) {
      const alpha = (x: number, y: number) => px[(y * 64 + x) * 4 + 3];
      expect([id, alpha(0, 0), alpha(63, 0), alpha(0, 63), alpha(63, 63)]).toEqual([id, 0, 0, 0, 0]);
      let drawn = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) drawn++;
      expect(drawn / (64 * 64), id).toBeGreaterThan(0.04);
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

  it('give no two definitions the same look', () => {
    const defs = Object.keys(first).filter((id) => ids.has(id));
    const seen = new Map<string, string>();
    for (const id of defs) {
      const key = Buffer.from(first[id].buffer).toString('base64');
      expect([id, seen.get(key)]).toEqual([id, undefined]);
      seen.set(key, id);
    }
  });

  it('draw the cursed mace as a plain mace: alignment is the aura, shown once it is identified', () => {
    expect(first.cursed_mace).toEqual(first.mace);
  });
});
