import type { ItemCategory, ItemQuality } from './item';
import type { ItemModifier, ModifierAlignment, ModifierCategory } from './modifiers';

/**
 * Item families as pack data (ADR-0012). The engine knows seven family ids and three
 * alignments, and what each modifier *field* does in combat; a pack supplies the rest:
 * each family's tiers (names, numbers, the floor each tier starts on), how many of the
 * family a game should offer, the first floor it rolls on, and whether it binds.
 */

/** One tier of a family: the modifier it puts on an item, from `minFloor` down. */
export interface ItemFamilyTier extends Omit<ItemModifier, 'id' | 'category' | 'alignment' | 'binds'> {
  /** The first floor this tier rolls on; the deepest tier the floor reaches wins. */
  minFloor: number;
}

export interface ItemFamilyDefinition {
  category: ModifierCategory;
  alignment: ModifierAlignment;
  /**
   * How many items of this family a full game is expected to offer. With
   * `ItemFamilyConfig.itemsPerGame` it gives the chance per eligible item.
   */
  perGame: number;
  /** The first floor the family rolls on at all (its share goes to Normal before that). */
  minFloor?: number;
  /** A worn item of this family stays on until a cleansing takes the family off it. */
  binds?: boolean;
  /** Deepest tier last is conventional, not required: the roller picks by `minFloor`. */
  tiers: ItemFamilyTier[];
}

export interface ItemFamilyConfig {
  /** Equipment categories that may roll a family; anything else is always Normal. */
  categories: ItemCategory[];
  /**
   * About how many eligible items a full game offers (floors 1–50, ground, chests and
   * monster drops): `perGame / itemsPerGame` is a family's chance per eligible item.
   * Re-measure it with `npm run balance` when loot volume changes.
   */
  itemsPerGame: number;
  families: ItemFamilyDefinition[];
}

/** What the roller needs to know about an item definition. */
export interface FamilyRollSubject {
  category: ItemCategory;
  quality?: ItemQuality;
  /** Always this family, never another and never Normal (a cursed relic, say). */
  family?: ModifierCategory;
}

/**
 * The deepest tier the floor has reached; tiers sharing that floor are variants (the eight
 * Chaotic effects), one picked by `rng`, the first without it. A fixed-family item below the
 * family's first floor still gets its shallowest tier.
 */
function tierFor(family: ItemFamilyDefinition, floor: number, rng?: () => number): ItemFamilyTier | undefined {
  const reached = family.tiers.filter((t) => t.minFloor <= floor);
  const pool = reached.length > 0 ? reached : family.tiers;
  if (pool.length === 0) return undefined;
  const depth = reached.length > 0 ? Math.max(...pool.map((t) => t.minFloor)) : Math.min(...pool.map((t) => t.minFloor));
  const variants = pool.filter((t) => t.minFloor === depth);
  return variants.length > 1 && rng ? variants[Math.floor(rng() * variants.length)] : variants[0];
}

/**
 * The modifier a family puts on an item found on `floor`, or undefined when the pack has
 * no such family. The id is derived from the item's, so a reroll from the same seed is
 * the same modifier.
 */
export function familyModifier(
  config: ItemFamilyConfig,
  category: ModifierCategory,
  floor: number,
  itemId: string,
  rng?: () => number
): ItemModifier | undefined {
  const family = config.families.find((f) => f.category === category);
  const tier = family ? tierFor(family, floor, rng) : undefined;
  if (!family || !tier) return undefined;
  const { minFloor: _minFloor, ...fields } = tier;
  return {
    ...fields,
    id: `${itemId}:${category}`,
    category,
    alignment: family.alignment,
    binds: family.binds || undefined,
  };
}

/**
 * Rolls an item's family: Normal first, with the remaining chance split among the
 * families by `perGame`, then the family's tier for the floor. Consumes one `rng()`
 * for an eligible item and none for anything else, so a pack without families leaves
 * the loot stream untouched. A family not yet rolling on this floor (`minFloor`) gives
 * its share to Normal; an artifact or a non-equipment item is never rolled.
 */
export function rollItemFamily(
  subject: FamilyRollSubject,
  floor: number,
  rng: () => number,
  config: ItemFamilyConfig | undefined,
  itemId: string
): ItemModifier | undefined {
  if (!config) return undefined;
  if (subject.family) return familyModifier(config, subject.family, floor, itemId, rng);
  if (subject.quality === 'artifact' || !config.categories.includes(subject.category)) return undefined;

  const roll = rng();
  let cumulative = 0;
  for (const family of config.families) {
    if ((family.minFloor ?? 1) > floor) continue;
    cumulative += family.perGame / config.itemsPerGame;
    if (roll < cumulative) return familyModifier(config, family.category, floor, itemId, rng);
  }
  return undefined;
}
