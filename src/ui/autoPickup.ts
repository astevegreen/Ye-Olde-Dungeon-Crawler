import { PotionItem, ScrollItem, WandItem, type GameEngine, type Item } from '../engine';

/**
 * Auto-pickup by kind of item (tracker 2.5, Q2 "C"): the hero picks up what they step onto
 * when its kind is ticked in the settings. Coins are always picked up. `main.ts` dispatches
 * each pick-up through the command bus on entering a tile, as it does for coins.
 */
export type AutoPickupGroup = 'potions' | 'scrolls' | 'wands' | 'jewelry' | 'weapons' | 'armor';

export const AUTO_PICKUP_GROUPS: ReadonlyArray<{ id: AutoPickupGroup; label: string }> = [
  { id: 'potions', label: 'Potions' },
  { id: 'scrolls', label: 'Scrolls' },
  { id: 'wands', label: 'Wands' },
  { id: 'jewelry', label: 'Rings and amulets' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
];

/** Light and always worth carrying: the consumables. Gear is the hero's choice. */
export const DEFAULT_AUTO_PICKUP: Readonly<Record<AutoPickupGroup, boolean>> = {
  potions: true,
  scrolls: true,
  wands: true,
  jewelry: false,
  weapons: false,
  armor: false,
};

const ARMOR_CATEGORIES = new Set(['armor', 'shield', 'helmet', 'boots', 'gauntlets', 'bracers', 'cloak']);

/** The settings group an item falls in; null for what auto-pickup never takes (quest items, containers). */
export function autoPickupGroupOf(item: Item): AutoPickupGroup | null {
  if (item instanceof PotionItem) return 'potions';
  if (item instanceof ScrollItem) return 'scrolls';
  if (item instanceof WandItem) return 'wands';
  if (item.category === 'ring' || item.category === 'amulet') return 'jewelry';
  if (item.category === 'weapon') return 'weapons';
  if (ARMOR_CATEGORIES.has(item.category)) return 'armor';
  return null;
}

/**
 * What auto-pickup takes from the hero's tile: coins always; any other item whose group is
 * on, unless it is marked junk or neither the belt nor the pack has room for it.
 */
export function autoPickupTargets(engine: GameEngine, groups: Readonly<Record<AutoPickupGroup, boolean>>): Item[] {
  const inventory = engine.player.inventory;
  return (engine.map.getItemsAt(engine.player.x, engine.player.y) ?? []).filter((item) => {
    if (item.category === 'currency') return true;
    const group = autoPickupGroupOf(item);
    if (!group || !groups[group] || item.junk) return false;
    return Boolean(inventory.belt?.canContain(item).allowed) || inventory.primaryPack.canContain(item).allowed;
  });
}
