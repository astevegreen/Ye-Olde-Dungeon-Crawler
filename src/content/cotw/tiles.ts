import type { TileDefinition } from '../../engine';

/** Bjarnarhaven's lanes and street furniture (townLayout.ts). */
const townThing = (type: string, name: string, glyph: string, description: string): TileDefinition => ({
  type,
  name,
  passable: false,
  walkable: false,
  transparent: true,
  blocksProjectiles: false,
  glyph,
  description,
});

/**
 * Castle of the Winds campaign-specific tile definitions (ARCHITECTURE.md §3).
 * Extracted from engine built-in TILES so the core engine remains completely pack-neutral.
 */
export const COTW_TILES: TileDefinition[] = [
  {
    type: 'town_road',
    name: 'Cobbled Lane',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: ',',
    description: 'Frost-heaved cobbles, swept clear of the worst of the snow.',
  },
  townThing('town_pine', 'Snow-laden Pine', 'T', 'A dark pine bowed under its load of snow.'),
  townThing('town_fountain', 'Frozen Fountain', 'F', 'The plaza fountain, frozen solid beneath a carved raven.'),
  townThing('town_statue', 'Statue of a Hero', 'A', 'A weathered stone warrior, hammer raised against the long winter.'),
  townThing('town_hay_cart', 'Hay Cart', 'H', 'A farm cart heaped with hay for the stables.'),
  townThing('town_goods_cart', 'Goods Cart', 'C', "A trader's cart stacked with crates and sacks."),
  townThing('town_barrels', 'Barrels', 'O', 'Iron-hooped barrels of ale, salt fish and pitch.'),
  townThing('town_woodpile', 'Woodpile', 'L', 'Split logs stacked for the hearths.'),
  townThing('town_market_stall', 'Market Stall', 'M', 'A market stall under a faded striped awning.'),
  {
    type: 'gateway_valhalla',
    name: 'Gateway to Valhalla',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '▲',
    description: 'A divine golden vortex radiating celestial light. Step through to claim eternal victory!',
    interactionHandlerId: 'quest_victory_portal',
    visual: 'portal',
    landmarkLabel: 'Valhalla Gateway ✨',
  },
  {
    type: 'altar_tyr',
    name: 'Ancient Altar of Tyr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '⛩',
    description: 'A weathered runic altar consecrated to Tyr, god of justice. Blood-stained defilement clings to the ancient runes.',
    interactionHandlerId: 'altar_tyr',
    landmarkLabel: 'Altar of Tyr ⚖️',
  },
  {
    // Stamped by the floor-22 siphon vault's layout legend (hostageRitual.ts).
    type: 'siphon_altar',
    name: 'Siphon Altar of Járnviðr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '_',
    description: 'An ancient obsidian altar marked with blood runes, its grooves pooled with dark vitriol.',
    interactionHandlerId: 'blood_altar_ritual',
    landmarkLabel: 'Siphon Altar 🩸',
  },
];
