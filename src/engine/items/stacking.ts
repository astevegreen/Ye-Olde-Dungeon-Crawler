import { Item, type ItemConfig } from './item';
import { PotionItem, ScrollItem, WandItem } from './consumables';
import { CoinItem } from '../economy/currency';

/**
 * Checks whether an item type is eligible for stack merging.
 * Potions, scrolls, ammunition, and coins can form stacks. A wand carries its own charges,
 * which a merge would lose, so it never stacks.
 */
export function isStackable(item: Item): boolean {
  if (item instanceof WandItem) return false;
  if (item instanceof CoinItem) return true;
  if (item instanceof PotionItem || item instanceof ScrollItem) return true;
  if (item.category === 'currency' || item.category === 'consumable') return true;
  if (item.rangedConfig && (item.rangedConfig.consumesSelf || item.rangedConfig.ammoType)) return true;
  return false;
}

/**
 * Determines whether two items can merge into a single stack.
 * Items must be stackable and possess matching identity, enchantment, affix, and quality.
 */
export function canStack(a: Item, b: Item): boolean {
  if (!isStackable(a) || !isStackable(b)) return false;

  // Coins carry their amount in `count` and in their name ("50 Gold Pieces"), so the
  // name-based identity below would never match two piles: stack by denomination.
  if (a instanceof CoinItem || b instanceof CoinItem) {
    return a instanceof CoinItem && b instanceof CoinItem && a.denomination === b.denomination;
  }

  // Junk is a mark on one pile: marking it never takes in the hero's good ones.
  if (a.junk !== b.junk) return false;

  // Containers and equipped items cannot stack
  if (a.slot !== undefined && b.slot !== undefined && a.slot !== b.slot) return false;

  // Must share identical identified status
  if (a.identified !== b.identified) return false;

  if (!a.identified) {
    // Unidentified items stack if they share the same unidentified appearance
    return a.unidentifiedName === b.unidentifiedName;
  }

  // Identified items must match base/definition identity and properties
  const idA = a.definitionId ?? a.name;
  const idB = b.definitionId ?? b.name;
  if (idA !== idB) return false;

  if (a.quality !== b.quality) return false;
  if (a.enchantmentLevel !== b.enchantmentLevel) return false;

  const affixA = a.elementalAffix?.name;
  const affixB = b.elementalAffix?.name;
  if (affixA !== affixB) return false;

  return true;
}

/**
 * Merges source stack into target stack.
 * Returns true if merged successfully.
 */
export function mergeItemStacks(target: Item, source: Item): boolean {
  if (!canStack(target, source)) return false;
  if (target instanceof CoinItem && source instanceof CoinItem) {
    target.add(source.count);
    return true;
  }
  target.quantity = (target.quantity ?? 1) + (source.quantity ?? 1);
  return true;
}

/**
 * Splits a specified amount from an item stack.
 * Decrements the original stack and returns a new Item clone, `splitId`, with the split quantity.
 */
export function splitItemStack(item: Item, amount: number, splitId: string): Item {
  const currentQty = item.quantity ?? 1;
  if (amount <= 0 || amount >= currentQty) {
    throw new Error(`Cannot split ${amount} from stack of size ${currentQty}`);
  }

  item.quantity = currentQty - amount;

  // The split is the same thing as the stack, unit for unit: its weight, bulk, hooks,
  // family and worth come from the original, not from a class's defaults.
  const config = configOf(item, splitId, amount);
  let cloned: Item;
  if (item instanceof PotionItem) {
    cloned = new PotionItem({ ...config, potionType: item.potionType, potency: item.potency, effects: [...item.effects] });
  } else if (item instanceof ScrollItem) {
    cloned = new ScrollItem({ ...config, spellId: item.spellId });
  } else if (item instanceof CoinItem) {
    cloned = new CoinItem({
      id: splitId,
      denomination: item.denomination,
      count: amount,
    });
    cloned.quantity = amount;
  } else {
    cloned = new Item(config);
  }
  cloned.junk = item.junk;

  return cloned;
}

/** What `item` was built from, under a new id and quantity. */
function configOf(item: Item, id: string, quantity: number): ItemConfig {
  return {
    id,
    definitionId: item.definitionId,
    name: item.name,
    unidentifiedName: item.unidentifiedName,
    category: item.category,
    slot: item.slot,
    weight: item.weight,
    unitWeight: item.unitWeight,
    bulk: item.bulk,
    quantity,
    quality: item.quality,
    identified: item.identified,
    stats: { ...item.stats },
    description: item.description,
    value: item.value,
    baseValue: item.baseValue,
    minFloor: item.minFloor,
    tier: item.tier,
    enchantmentLevel: item.enchantmentLevel,
    elementalAffix: item.elementalAffix ? { ...item.elementalAffix } : undefined,
    twoHanded: item.twoHanded,
    blocksSlot: item.blocksSlot,
    rangedConfig: item.rangedConfig ? { ...item.rangedConfig } : undefined,
    predicate: item.predicate,
    hooks: item.hooks,
    modifiers: item.modifiers,
    wornEffects: item.wornEffects,
    aspectState: item.aspectState,
  };
}
