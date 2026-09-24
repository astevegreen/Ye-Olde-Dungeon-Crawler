import type { SpriteRecipe, TerrainArtConfig, TerrainStyle } from '../../../engine';
import { buildZoneRecipes, type ZoneArt } from './kit';
import { RIME_HOLLOWS } from './zones/rimeHollows';
import { DWARVEN_WORKS } from './zones/dwarvenWorks';
import { OBSIDIAN_SIPHON } from './zones/obsidianSiphon';
import { TARNISHED_SILVER } from './zones/tarnishedSilver';
import { WORLD_BARK } from './zones/worldBark';
import { MAW_OF_MALICE } from './zones/mawOfMalice';

/**
 * cotw's terrain art (ARCHITECTURE.md §3: art comes from the pack's recipes). Each zone is a
 * `ZoneArt`; the kit expands it into recipes, and `COTW_TERRAIN_ART` tells the renderer how
 * to pick among them (`atlas.terrain`).
 */
const ZONES: readonly ZoneArt[] = [
  RIME_HOLLOWS,
  DWARVEN_WORKS,
  OBSIDIAN_SIPHON,
  TARNISHED_SILVER,
  WORLD_BARK,
  MAW_OF_MALICE,
];

export const COTW_TERRAIN_SPRITES: Record<string, SpriteRecipe> = Object.assign({}, ...ZONES.map(buildZoneRecipes));

const floorStyles: Record<string, TerrainStyle> = Object.fromEntries(ZONES.map((z) => [`floor_${z.key}`, { ...z.floor, macro: true }]));

export const COTW_TERRAIN_ART: TerrainArtConfig = {
  styles: {
    ...floorStyles,
    wall: { kind: 'wall', faces: 2 },
    water: { kind: 'area', macro: true },
    chasm: { kind: 'area', macro: true },
  },
  contactShadows: true,
  entityShadows: true,
  torch: { radius: 8.5, color: '#ffb269', warmth: 0.65, falloff: 0.3 },
  memory: { desaturate: 0.7, flatten: 0.4, darken: 0.26, tint: '#0e1116', tintAmount: 0.12 },
  // Light sources per zone: lava, banked forge coals, sap, fungus, bile.
  emissive: {
    dwarven_works: { chasm: { color: '#ff8a3a', radius: 2.8, strength: 0.2 } },
    obsidian_siphon: {
      chasm: { color: '#ff7a2a', radius: 2.4, strength: 0.2 },
      shallow_water: { color: '#ff7a2a', radius: 1.8, strength: 0.12 },
    },
    world_bark: { shallow_water: { color: '#c9912f', radius: 2, strength: 0.09 } },
    maw_of_malice: {
      chasm: { color: '#d63a4f', radius: 2, strength: 0.08 },
      shallow_water: { color: '#c0394f', radius: 1.5, strength: 0.05 },
    },
  },
};
