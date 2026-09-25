import type { FloorLayoutBand } from '../../engine';
import { COTW_THRESHOLDS } from './thresholds';

/** Procedural floors are 57x40: about 30% more area than the engine's 50x35 default. */
export const COTW_FLOOR_SIZE = { width: 57, height: 40 };

/**
 * One layout strategy per zone (manifest `floorLayouts`), keyed to the zone bands in
 * `tileZones.ts`, so each zone differs in how it is built as well as in colour. Each
 * zone's first floor opens in its threshold room (`thresholds.ts`).
 */
export const COTW_FLOOR_LAYOUTS: FloorLayoutBand[] = [
  // Rime Hollows: frozen caverns around a walkable black-ice mere; a draugr barrow in the rock.
  { minFloor: 1, maxFloor: 9, strategy: 'caverns', params: { lake: true, landmarkVaultIds: ['draugr_barrow'] }, threshold: COTW_THRESHOLDS.rime_hollows },
  // Dwarven Works: a symmetric hall plan, ring road and workshops, with the great forge pit.
  { minFloor: 10, maxFloor: 17, strategy: 'halls', params: { centralPit: true, randomVaults: false }, threshold: COTW_THRESHOLDS.dwarven_works },
  // Obsidian Siphon: a magma rift crossed by bridges; the siphon pylon stands on one bank.
  { minFloor: 18, maxFloor: 25, strategy: 'rift', params: { bridges: 3, landmarkVaultIds: ['siphon_pylon'] }, threshold: COTW_THRESHOLDS.obsidian_siphon },
  // Tarnished Silver Veins: a lattice of mine drifts, ore chambers and a flooded sump.
  { minFloor: 26, maxFloor: 33, strategy: 'lattice', params: { sump: true }, threshold: COTW_THRESHOLDS.tarnished_silver },
  // World Bark Descent: root warrens around a knothole grove with a sap well.
  { minFloor: 34, maxFloor: 42, strategy: 'warrens', params: { grove: true }, threshold: COTW_THRESHOLDS.world_bark },
  // Maw of Malice: a spine passage with rib chambers, maw pits and the eye pool.
  { minFloor: 43, maxFloor: 49, strategy: 'spine', params: { pool: true, pits: 2 }, threshold: COTW_THRESHOLDS.maw_of_malice },
  // The Rotting Root: blighted caverns (floor 50 itself is the boss lair on Hard).
  { minFloor: 50, strategy: 'caverns', params: { wallChance: 0.42, pools: 3, pits: 2, groves: 3 } },
];
