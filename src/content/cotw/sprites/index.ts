import type { SpriteRecipe } from '../../../engine';
import { COTW_TILE_SPRITES } from './tiles';
import { COTW_MONSTER_SPRITES } from './monsters';
import { COTW_ITEM_SPRITES } from './items';

export { COTW_TILE_SPRITES, COTW_MONSTER_SPRITES, COTW_ITEM_SPRITES };

/**
 * Full CotW procedural sprite recipe set.
 *
 * Consumers look recipes up by string key (`SpriteAtlas` iterates `ATLAS_MAP`),
 * so merge order carries no meaning.
 */
export const COTW_SPRITE_RECIPES: Record<string, SpriteRecipe> = {
  ...COTW_TILE_SPRITES,
  ...COTW_MONSTER_SPRITES,
  ...COTW_ITEM_SPRITES,
};
