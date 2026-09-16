import { Item } from './item';
import { PotionItem, ScrollItem } from './consumables';
import { CoinItem } from '../economy/currency';

/**
 * Checks whether an item type is eligible for stack merging.
 * Potions, scrolls, ammunition, and coins can form stacks.
 */
export function isStackable(item: Item): boolean {
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
  target.quantity = (target.quantity ?? 1) + (source.quantity ?? 1);
  return true;
}

/**
 * Splits a specified amount from an item stack.
 * Decrements the original stack and returns a new Item clone with the split quantity.
 */
export function splitItemStack(item: Item, amount: number, rng: () => number): Item {
  const currentQty = item.quantity ?? 1;
  if (amount <= 0 || amount >= currentQty) {
    throw new Error(`Cannot split ${amount} from stack of size ${currentQty}`);
  }

  item.quantity = currentQty - amount;

  // Create clone of item with new ID and split quantity
  const splitId = `${item.id}-split-${Math.floor(rng() * 1000000)}`;

  let cloned: Item;
  if (item instanceof PotionItem) {
    cloned = new PotionItem({
      id: splitId,
      name: item.name,
      potionType: item.potionType,
      value: item.value,
      unidentifiedName: item.unidentifiedName,
      description: item.description,
      quantity: amount,
      potency: item.potency,
      effects: item.effects as any,
    });
    cloned.identified = item.identified;
  } else if (item instanceof ScrollItem) {
    cloned = new ScrollItem({
      id: splitId,
      name: item.name,
      spellId: item.spellId,
      value: item.value,
      unidentifiedName: item.unidentifiedName,
      description: item.description,
      quantity: amount,
    });
    cloned.identified = item.identified;
  } else if (item instanceof CoinItem) {
    cloned = new CoinItem({
      id: splitId,
      denomination: item.denomination,
      count: amount,
    });
    cloned.quantity = amount;
  } else {
    cloned = new Item({
      id: splitId,
      definitionId: item.definitionId,
      name: item.name,
      unidentifiedName: item.unidentifiedName,
      category: item.category,
      slot: item.slot,
      weight: item.weight,
      bulk: item.bulk,
      quality: item.quality,
      identified: item.identified,
      stats: { ...item.stats },
      description: item.description,
      value: item.value,
      minFloor: item.minFloor,
      tier: item.tier,
      enchantmentLevel: item.enchantmentLevel,
      elementalAffix: item.elementalAffix ? { ...item.elementalAffix } : undefined,
      twoHanded: item.twoHanded,
      blocksSlot: item.blocksSlot,
      rangedConfig: item.rangedConfig ? { ...item.rangedConfig } : undefined,
      quantity: amount,
    });
  }

  return cloned;
}
