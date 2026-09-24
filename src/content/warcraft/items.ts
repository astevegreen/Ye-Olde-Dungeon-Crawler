import { createScaledItem } from '../../engine';
import type { Item, ItemDefinition } from '../../engine';

export const WARCRAFT_ITEMS: ItemDefinition[] = [
  {
    id: 'broadsword',
    name: 'Steel Broadsword',
    unidentifiedName: 'Heavy Sword',
    category: 'weapon',
    slot: 'mainHand',
    weight: 10,
    bulk: 7,
    value: 60,
    stats: { attackBonus: 8 },
    description: 'A well-balanced double-edged steel broadsword favored by footmen.',
  },
  {
    id: 'wooden_shield',
    name: 'Reinforced Wooden Shield',
    unidentifiedName: 'Round Shield',
    category: 'shield',
    slot: 'offHand',
    weight: 6,
    bulk: 4,
    value: 25,
    stats: { defenseBonus: 3 },
    description: 'Sturdy oak banded with iron.',
  },
  {
    id: 'warhammer',
    name: 'Iron Warhammer',
    category: 'weapon',
    slot: 'mainHand',
    weight: 8,
    bulk: 5,
    value: 40,
    stats: { attackBonus: 6 },
    description: 'A heavy dwarven forged warhammer capable of crushing armor.',
  },
  {
    id: 'greatsword',
    name: 'Alliance Greatsword',
    category: 'weapon',
    slot: 'mainHand',
    weight: 12,
    bulk: 8,
    value: 90,
    twoHanded: true,
    stats: { attackBonus: 12 },
    description: 'A massive two-handed blade wielded by knights of Stormwind.',
  },
  {
    id: 'alliance_shield',
    name: 'Lion Crest Shield',
    category: 'shield',
    slot: 'offHand',
    weight: 9,
    bulk: 6,
    value: 65,
    stats: { defenseBonus: 5 },
    description: 'An iron-rimmed heater shield bearing the royal golden lion of Stormwind.',
  },
  {
    id: 'mithril_plate',
    name: 'Mithril Platemail',
    category: 'armor',
    slot: 'torso',
    weight: 22,
    bulk: 14,
    value: 250,
    stats: { defenseBonus: 9 },
    description: 'Shining plate armor crafted from enchanted mithril.',
  },
  {
    id: 'health_potion',
    name: 'Healing Draught',
    category: 'potion',
    weight: 1,
    bulk: 1,
    value: 20,
    itemType: 'potion',
    potionConfig: {
      potionType: 'health',
      potency: 30,
      effects: [{ type: 'restore_hp', amount: 30 }],
    },
    description: 'A soothing red elixir brewed from peacebloom.',
  },
  {
    id: 'mana_potion',
    name: 'Mana Draught',
    category: 'potion',
    weight: 1,
    bulk: 1,
    value: 25,
    itemType: 'potion',
    potionConfig: {
      potionType: 'mana',
      potency: 30,
      effects: [{ type: 'restore_mana', amount: 30 }],
    },
    description: 'A glowing sapphire fluid distilled from silverleaf.',
  },
  {
    id: 'gold_coins',
    name: 'Gold Coins',
    category: 'misc',
    weight: 0.05,
    bulk: 0.02,
    value: 1,
    itemType: 'coin',
    coinConfig: {
      denomination: 'gold',
      count: 1,
    },
    description: 'Standard minted coins of the realm.',
  },
  {
    id: 'horde_war_banner',
    name: 'Horde War Banner',
    category: 'misc',
    weight: 5,
    bulk: 8,
    value: 1000,
    identified: true,
    description: 'The blood-stained war sigil of Warchief Blackhand. Proof of the Horde leader’s defeat.',
  },
];

export function makeWarcraftItem(
  itemId: string,
  instanceId: string,
  floor = 1,
  rng: () => number = () => 0.5
): Item {
  const def = WARCRAFT_ITEMS.find((item) => item.id === itemId);
  if (!def) {
    throw new Error(`No warcraft item definition for: ${itemId}`);
  }
  return createScaledItem(def, instanceId, floor, rng);
}

