import { describe, it, expect } from 'vitest';
import {
  COTW_SPRITE_RECIPES,
  COTW_TILE_SPRITES,
  COTW_MONSTER_SPRITES,
  COTW_ITEM_SPRITES,
} from '../sprites';

/**
 * Guards the sprite-recipe split (tiles/monsters/items + barrel).
 *
 * Before the split, every recipe lived in one object literal, so a duplicate
 * key was a TypeScript error ("An object literal cannot have multiple
 * properties with the same name"). After the split the barrel merges three
 * objects with a spread, and a key present in two files is silently resolved
 * in favour of whichever is spread last — tsc stays green, the merged key
 * count is unchanged, and the losing recipe simply never renders.
 *
 * These tests restore the compile-time guarantee at test time.
 */
describe('COTW sprite recipe groups', () => {
  const GROUPS = {
    tiles: COTW_TILE_SPRITES,
    monsters: COTW_MONSTER_SPRITES,
    items: COTW_ITEM_SPRITES,
  } as const;

  it('assigns every recipe key to exactly one group', () => {
    const owners = new Map<string, string[]>();
    for (const [group, recipes] of Object.entries(GROUPS)) {
      for (const key of Object.keys(recipes)) {
        owners.set(key, [...(owners.get(key) ?? []), group]);
      }
    }

    const collisions = [...owners.entries()]
      .filter(([, groups]) => groups.length > 1)
      .map(([key, groups]) => `${key} (in ${groups.join(' + ')})`);

    expect(collisions).toEqual([]);
  });

  it('merges without dropping a recipe', () => {
    const partTotal =
      Object.keys(COTW_TILE_SPRITES).length +
      Object.keys(COTW_MONSTER_SPRITES).length +
      Object.keys(COTW_ITEM_SPRITES).length;

    expect(Object.keys(COTW_SPRITE_RECIPES)).toHaveLength(partTotal);
  });

  it('exposes the same function instance the owning group declared', () => {
    const shadowed: string[] = [];
    for (const recipes of Object.values(GROUPS)) {
      for (const [key, recipe] of Object.entries(recipes)) {
        if (COTW_SPRITE_RECIPES[key] !== recipe) shadowed.push(key);
      }
    }

    expect(shadowed).toEqual([]);
  });
});
