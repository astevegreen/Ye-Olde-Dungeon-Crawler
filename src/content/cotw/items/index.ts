import type { ItemDefinition } from '../../../engine';
import { COTW_WEAPONS } from './weapons';
import { COTW_OFFHAND } from './offhand';
import { COTW_HEAD } from './head';
import { COTW_TORSO } from './torso';
import { COTW_CLOAKS } from './cloaks';
import { COTW_HANDS } from './hands';
import { COTW_FEET } from './feet';
import { COTW_BELTS } from './belts';
import { COTW_NECK } from './neck';
import { COTW_RINGS } from './rings';
import { COTW_CONTAINERS } from './containers';
import { COTW_CONSUMABLES } from './consumables';
import { COTW_LEGACY_ITEMS } from './legacy';
import { COTW_ESSENCE_RUNES } from './essences';

export * from './weapons';
export * from './offhand';
export * from './head';
export * from './torso';
export * from './cloaks';
export * from './hands';
export * from './feet';
export * from './belts';
export * from './neck';
export * from './rings';
export * from './containers';
export * from './consumables';
export * from './legacy';
export * from './essences';

/**
 * The CotW item catalog: the 83 items specified in CotW-Content-Pack.md, less the four
 * pulled as useless in tracker 1.9 (whetstone, ice-stave tablet, bark map, sealskin rucksack).
 */
export const COTW_CATALOG: ItemDefinition[] = [
  ...COTW_WEAPONS,
  ...COTW_OFFHAND,
  ...COTW_HEAD,
  ...COTW_TORSO,
  ...COTW_CLOAKS,
  ...COTW_HANDS,
  ...COTW_FEET,
  ...COTW_BELTS,
  ...COTW_NECK,
  ...COTW_RINGS,
  ...COTW_CONTAINERS,
  ...COTW_CONSUMABLES,
];

/**
 * Record map of the catalog items indexed by id.
 */
export const COTW_CATALOG_RECORD: Record<string, ItemDefinition> = Object.fromEntries(
  COTW_CATALOG.map((item) => [item.id, item]),
);

/**
 * Combined item pool including the catalog items and legacy items for backward compatibility.
 */
export const COTW_ITEMS: ItemDefinition[] = [
  ...COTW_CATALOG,
  ...COTW_LEGACY_ITEMS.filter((legacy) => !COTW_CATALOG_RECORD[legacy.id]),
  ...COTW_ESSENCE_RUNES,
];
