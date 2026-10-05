import type { SpriteRecipe } from '../../../engine';
import { COTW_TILE_SPRITES } from './tiles';
import { COTW_MONSTER_SPRITES } from './monsters';
import { COTW_ITEM_SPRITES } from './items';
import { COTW_UI_ICONS } from './uiIcons';
import { COTW_SPELL_RUNES } from './spellRunes';
import { COTW_TERRAIN_SPRITES } from '../terrain';

export { COTW_TILE_SPRITES, COTW_MONSTER_SPRITES, COTW_ITEM_SPRITES, COTW_TERRAIN_SPRITES, COTW_UI_ICONS, COTW_SPELL_RUNES };

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
  ...COTW_TERRAIN_SPRITES,
  ...COTW_UI_ICONS,
  ...COTW_SPELL_RUNES,
  // Níðhögg wears the elder-dragon boss art rather than the generic boss giant.
  nidhogg: COTW_MONSTER_SPRITES.dragon_boss,
  // Ivalda (ironClans.ts), the living duergar smith, wears the dwarf art by her NPC id.
  'npc-ivalda': COTW_MONSTER_SPRITES.dwarf,
};
