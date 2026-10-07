import type { FloorHazardAdvisory, RoomDecorationBand } from '../../engine';
import { COTW_ITEMS } from './items';

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

/** A pack item's name; throws on an id the pack lacks, so a recommendation can't name a phantom. */
function itemName(id: string): string {
  const def = COTW_ITEMS.find((d) => d.id === id);
  if (!def) throw new Error(`floorBands: no item '${id}'`);
  return def.name;
}

/**
 * Elemental hazards the town sage warns about before a descent (manifest `floorHazards`),
 * keyed to the zones whose monsters deal the element (R-cotw-9, 2026-10-07; zone floors in
 * `monsterScaling.ts`):
 * - cold, floors 4-9: the Rime Hollows' brim-howlers (Freezing Mist Cone, from floor 4), winter
 *   hags (cold ray) and the Frost Warden. Floors 1-3 hold no cold attacker.
 * - nothing on 10-17: the Dwarven Works' foes strike, slow and blind, with no element to ward.
 * - fire, floors 18-25: the Obsidian Siphon's troll-wives (firebolt), the Captives of the
 *   Chariot (a fire sweep) and the Sun-Chariot Warden.
 * - poison, floors 26-42: the Silver Veins' leeches and root-wraiths (venomous bites), choke-damp
 *   phantasms (poison gas) and the World-Bark's rotwood crawlers.
 * - poison, floors 43 on: the Maw of Malice's grave-wyrmlings and Víðnir spit venom, as Níðhögg does.
 * The pack has no cold or poison ward to wear, so those recommendations name what it does have.
 */
export const COTW_FLOOR_HAZARDS: FloorHazardAdvisory[] = [
  {
    minFloor: 4,
    maxFloor: 9,
    element: 'cold',
    title: 'Vulnerable to Glacial Frost',
    message: 'On Floor {floor}, in the Rime Hollows, brim-howlers breathe freezing mist and winter hags cast rays of cold.',
    recommendation: `No charm in town wards off the cold. Carry ${itemName('hearth_broth_flask')}s to mend the frostbite, and answer the frost-kin with fire, which they dread.`,
  },
  {
    minFloor: 18,
    maxFloor: 25,
    element: 'fire',
    title: 'Vulnerable to Scorching Flame',
    message: 'Floor {floor} lies in the Obsidian Siphon, where troll-wives hurl firebolts and the Captives of the Chariot sweep chains of burning light.',
    recommendation: `Wear something that turns flame: the ${itemName('ring_of_the_slag_walker')}, the ${itemName('zealots_seared_crown')} or the ${itemName('obsidian_scale_cuirass')}, all found below.`,
  },
  {
    minFloor: 26,
    maxFloor: 42,
    element: 'poison',
    title: 'Vulnerable to Creeping Venom',
    message: 'On Floor {floor} quicksilver leeches, root-wraiths and rotwood crawlers bite with venom, and choke-damp phantasms burst into poison gas.',
    recommendation: `Carry ${itemName('birch_tar_poultice')}s, sold in town, or ${itemName('cure_poison_potion')}s to purge the venom; ${itemName('urdr_cleansing_water')} clears it and more.`,
  },
  {
    minFloor: 43,
    element: 'poison',
    title: 'Vulnerable to Wyrm Venom',
    message: 'Floor {floor} lies in the Maw of Malice, where Níðhögg’s brood spit corrosive bile.',
    recommendation: `Nothing worn turns venom: carry ${itemName('supreme_health_potion')}s and ${itemName('urdr_cleansing_water')} to outlast the bile.`,
  },
];
