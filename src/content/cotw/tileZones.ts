import type { TileZoneBand } from '../../engine';

/**
 * Floor-band tile zone mappings for Castle of the Winds.
 * Reuses the floor breakpoints established by monsterScaling.ts:
 * 1/10/18/26/34/43/50 -> Rime Hollows/Dwarven Works/Obsidian Siphon/Tarnished Silver Veins/World Bark Descent/Maw of Malice/The Rotting Root.
 */
export const COTW_TILE_ZONE_BANDS: TileZoneBand[] = [
  { floor: 1, zoneKey: 'rime_hollows', label: 'Rime Hollows' },
  { floor: 10, zoneKey: 'dwarven_works', label: 'Abandoned Dwarven Works' },
  { floor: 18, zoneKey: 'obsidian_siphon', label: 'Obsidian Siphon' },
  { floor: 26, zoneKey: 'tarnished_silver', label: 'Tarnished Silver Veins' },
  { floor: 34, zoneKey: 'world_bark', label: 'World Bark Descent' },
  { floor: 43, zoneKey: 'maw_of_malice', label: 'Maw of Malice' },
  { floor: 50, zoneKey: 'rotting_root', label: 'The Rotting Root' },
];
