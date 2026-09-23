import type { SpriteRecipe } from '../../../engine';
import { COTW_TILE_SPRITES } from './tiles';
import { COTW_MONSTER_SPRITES } from './monsters';
import { COTW_ITEM_SPRITES } from './items';

export { COTW_TILE_SPRITES, COTW_MONSTER_SPRITES, COTW_ITEM_SPRITES };

/**
 * Full CotW procedural sprite recipe set.
 *
 * Keys are atlas sprite keys. A key the atlas doesn't build in gets its own cell, and a
 * key equal to a monster or item definition ID becomes that entity's sprite (the relic
 * recipes in items.ts work this way). Merge order carries no meaning.
 */
export const COTW_SPRITE_RECIPES: Record<string, SpriteRecipe> = {
  ...COTW_TILE_SPRITES,
  ...COTW_MONSTER_SPRITES,
  ...COTW_ITEM_SPRITES,
  // Níðhögg wears the elder-dragon boss art rather than the generic boss giant.
  nidhogg: COTW_MONSTER_SPRITES.dragon_boss,
  // Hrungnir is untagged (he predates the boss tags, and tagging him would change his
  // scaling), so his giant-boss art comes from his definition ID.
  boss_hrungnir: COTW_MONSTER_SPRITES.giant_boss,
};
