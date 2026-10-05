import { createDungeonChest, createScaledItem } from '../../../engine';
import { COIN_BULK_CM3, type Item, type ItemDefinition, type LootDropRule, type Predicate } from '../../../engine';
import { COTW_ITEMS } from './index';
import { COTW_SPELL_TABLETS } from '../spellTablets';
import { COTW_COINAGE } from '../coinage';
import { COTW_ITEM_FAMILIES } from '../itemFamilies';
import { COTW_LOOT_RATES, COTW_MONSTER_DROP_SCALE } from '../loot';

/**
 * Items outside COTW_ITEMS, so never rolled as random floor loot: sold in town and
 * dropped by specific monsters. Priced on the pack's copper scale (starting purse
 * 350 CP, floor 1-9 coin drops 30-200 CP) — the engine's ItemFactory builders carry
 * legacy prices ~100x higher (a 20 GP loaf of bread).
 */
const NON_CATALOG_ITEMS: ItemDefinition[] = [
  {
    id: 'scroll_identify',
    name: 'Scroll of Identify',
    unidentifiedName: 'Parchment Scroll',
    category: 'consumable',
    tier: 1,
    weight: 50,
    bulk: 40,
    identified: true,
    description: 'A crisp parchment inscribed with golden revelation runes.',
    value: 40,
    itemType: 'scroll',
    scrollConfig: { spellId: 'identify' },
  },
  {
    id: 'charm_watchful_eye',
    name: 'Charm of the Watchful Eye',
    unidentifiedName: 'Engraved Charm',
    category: 'amulet',
    slot: 'neck',
    tier: 1,
    weight: 40,
    bulk: 20,
    stats: { defenseBonus: 2 },
    identified: true,
    description:
      "Astrid sets this aside only for adventurers whose reputation for uncovering the dungeon's secrets precedes them.",
    value: 150,
  },
  {
    // Q44 (2026-10-04): the first bigger purse, sold at Olaf's.
    id: 'ironclasp_purse',
    name: 'Ironclasp Purse',
    unidentifiedName: 'Iron-Clasped Purse',
    category: 'container',
    slot: 'purse',
    tier: 2,
    weight: 140,
    bulk: 180,
    identified: true,
    description: 'A stiff purse of oiled hide shut with an iron clasp. It holds 600 coins of any metal.',
    value: 120,
    itemType: 'container',
    containerConfig: {
      containerType: 'purse',
      maxWeightCapacity: 10000,
      maxBulkCapacity: 600 * COIN_BULK_CM3,
      acceptedCategories: ['currency'],
    },
  },
  {
    // Tracker 5.3: torches return with the dark floors. Held in the off hand (a light, in place
    // of a shield), it lets the hero see 5 paces instead of 2 where the light has been drunk.
    id: 'wooden_torch',
    name: 'Wooden Torch',
    unidentifiedName: 'Torch',
    category: 'light',
    slot: 'offHand',
    tier: 1,
    weight: 800,
    bulk: 600,
    identified: true,
    description:
      'A pitch-soaked branch. Held in the off hand, it pushes back the dark: where the light has been drunk you see 5 paces instead of 2. It gives no light you need elsewhere.',
    value: 15,
  },
  ...COTW_SPELL_TABLETS,
];

const DEFINITIONS: Record<string, ItemDefinition> = Object.fromEntries(
  [...COTW_ITEMS, ...NON_CATALOG_ITEMS].map((def) => [def.id, def])
);

function definitionFor(itemId: string): ItemDefinition {
  const def = DEFINITIONS[itemId];
  if (!def) {
    throw new Error(`No cotw item definition for: ${itemId}`);
  }
  return def;
}

/** Merchant stock: floor-1 stats at a fixed mid roll, no family, optionally gated by a predicate. */
export function makeShopItem(itemId: string, instanceId: string, predicate?: Predicate): Item {
  const def = definitionFor(itemId);
  return createScaledItem(predicate ? { ...def, predicate } : def, instanceId, 1, () => 0.5);
}

/** A monster's chest drop: filled as a dungeon chest on `floor` would be. */
export function makeLootChest(instanceId: string, rng: () => number, floor: number): Item {
  return createDungeonChest(instanceId, floor, COTW_ITEMS, rng, COTW_COINAGE, COTW_ITEM_FAMILIES, COTW_LOOT_RATES);
}

/** Loot scaled to `floor` (the floor a monster died on), rolled from the loot table's seeded rng. */
export function makeLootItem(itemId: string, instanceId: string, rng: () => number, floor = 1): Item {
  return createScaledItem(definitionFor(itemId), instanceId, Math.max(1, floor), rng, COTW_ITEM_FAMILIES);
}

/** A monster's ordinary drop: as makeLootItem, but nothing above the floor the item unlocks on. */
export function dropLootItem(itemId: string, instanceId: string, rng: () => number, floor = 1): Item | null {
  const def = definitionFor(itemId);
  return floor < (def.minFloor ?? 1) ? null : createScaledItem(def, instanceId, floor, rng, COTW_ITEM_FAMILIES);
}

/**
 * A monster's ordinary item drop (`dropLootItem`): `weight` is the table's chance before the
 * pack's loot volume, scaled by `COTW_MONSTER_DROP_SCALE` for gear or consumables (Q2 "C").
 */
export function itemDrop(weight: number, itemId: string): LootDropRule {
  const scale = definitionFor(itemId).category === 'consumable' ? COTW_MONSTER_DROP_SCALE.consumable : COTW_MONSTER_DROP_SCALE.gear;
  return { chance: weight * scale, generate: (id, rng, floor) => dropLootItem(itemId, id, rng, floor) };
}
