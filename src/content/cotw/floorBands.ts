import type { FloorHazardAdvisory, RoomDecorationBand } from '../../engine';

/**
 * Per-zone room decoration for the CotW descent (manifest `roomDecoration`), keyed to
 * the zone floor bands in `tileZones.ts`.
 */
export const COTW_ROOM_DECORATION: RoomDecorationBand[] = [
  // Rime Hollows: cracked ice puddles, sparse architecture.
  { minFloor: 1, maxFloor: 9, puddleChance: 0.4, grandHallChance: 0.3, pillarChance: 0.25 },
  // Abandoned Dwarven Works: grand halls and iron-barred partitions.
  { minFloor: 10, maxFloor: 17, grandHallChance: 0.75, ironBarsChance: 0.5 },
  // Obsidian Siphon: chasm heat fissures among dense pillars.
  { minFloor: 18, maxFloor: 25, fissureChance: 0.35, grandHallChance: 0.75, pillarChance: 0.7 },
  // Tarnished Silver Veins: mine drainage runoff.
  { minFloor: 26, maxFloor: 33, puddleChance: 0.3 },
  // World-Bark Descent: root-pillared chambers.
  { minFloor: 34, maxFloor: 42, pillarChance: 0.7 },
  // Maw of Malice & the Rotting Root: abyssal void fissures.
  { minFloor: 43, fissureChance: 0.35 },
];

/** Elemental hazards the town sage warns about before a descent (manifest `floorHazards`). */
export const COTW_FLOOR_HAZARDS: FloorHazardAdvisory[] = [
  {
    minFloor: 8,
    maxFloor: 24,
    element: 'cold',
    title: 'Vulnerable to Glacial Frost',
    message: 'The icy caverns of Floor {floor} harbor frost drakes and winter wolves.',
    recommendation: 'Equip cold-warding shields or brew frost-resist elixirs to avoid crippling freeze damage.',
  },
  {
    minFloor: 25,
    maxFloor: 36,
    element: 'fire',
    title: 'Vulnerable to Scorching Flame',
    message: 'Floor {floor} descends into molten chasms with fire elementals and hell hounds.',
    recommendation: 'Equip flame-resistant plate armor or charms of fire protection before crossing the threshold.',
  },
  {
    minFloor: 37,
    element: 'lightning',
    title: 'Vulnerable to Storm Tempest',
    message: 'The summit depths of Floor {floor} crackle with Jotun lightning and thunderous strikes.',
    recommendation: 'Acquire lightning-resistant gear and warding runes from high-tier smiths or deep vaults.',
    escalateWhenWeak: false,
  },
];
