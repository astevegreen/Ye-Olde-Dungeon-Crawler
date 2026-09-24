import { createScaledItem } from '../../../engine';
import type { Item, ItemDefinition, Predicate } from '../../../engine';
import { COTW_ITEMS } from './index';

/**
 * Items outside COTW_ITEMS, so never rolled as random floor loot: sold in town and
 * dropped by specific monsters. Priced on the pack's copper scale (starting purse
 * 350 CP, floor 1-9 coin drops 30-200 CP) — the engine's ItemFactory builders carry
 * legacy prices ~100x higher (a 20 GP loaf of bread).
 */
const NON_CATALOG_ITEMS: ItemDefinition[] = [
  {
    id: 'wooden_torch',
    name: 'Wooden Torch',
    unidentifiedName: 'Torch',
    category: 'misc',
    tier: 1,
    weight: 800,
    bulk: 600,
    identified: true,
    description: 'Pitch-soaked wooden branch providing essential light in subterranean depths.',
    value: 5,
  },
  {
    id: 'thief_lockpicks',
    name: 'Thief Lockpicks',
    unidentifiedName: 'Slender Metal Picks',
    category: 'misc',
    tier: 1,
    weight: 200,
    bulk: 100,
    identified: true,
    description: 'Delicate tempered steel tension tools for bypassing locked chests and gates.',
    value: 40,
  },
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

/** Merchant stock: floor-1 stats at a fixed mid roll, optionally gated by a predicate. */
export function makeShopItem(itemId: string, instanceId: string, predicate?: Predicate): Item {
  const def = definitionFor(itemId);
  return createScaledItem(predicate ? { ...def, predicate } : def, instanceId, 1, () => 0.5);
}

/** Monster loot: floor-1 stats rolled from the loot table's seeded rng. */
export function makeLootItem(itemId: string, instanceId: string, rng: () => number): Item {
  return createScaledItem(definitionFor(itemId), instanceId, 1, rng);
}
