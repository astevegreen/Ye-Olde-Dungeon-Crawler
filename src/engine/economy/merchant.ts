import type { Item } from '../items/item';
import type { Player } from '../entities/player';
import {
  formatCurrency,
  getPlayerTotalCp,
  deductCurrencyFromPlayer,
  addCurrencyToPlayer,
} from './currency';
import type { TransactionResult } from './types';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { type WorldState, getFaction } from '../state/worldState';
import type { MerchantPricingRules } from '../types/manifest';

export type ShopType = 'general' | 'armory' | 'alchemist';

/**
 * Calculates purchase price for an item in a merchant shop.
 */
export function getItemBuyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules): number {
  let basePrice = 0;
  if (item.value && item.value > 0) {
    basePrice = item.value;
  } else {
    // Default based on category
    switch (item.category) {
      case 'weapon':
        basePrice = 10000;
        break;
      case 'armor':
        basePrice = 15000;
        break;
      case 'shield':
        basePrice = 5000;
        break;
      case 'consumable':
        basePrice = 4000;
        break;
      case 'container':
        basePrice = 5000;
        break;
      default:
        basePrice = 2000;
        break;
    }
  }

  if (worldState && pricing) {
    const standing = getFaction(worldState, pricing.faction);
    const tier = pricing.tiers.find(
      (t) =>
        (t.minStanding === undefined || standing >= t.minStanding) &&
        (t.maxStanding === undefined || standing <= t.maxStanding)
    );
    if (tier) {
      return Math.max(1, Math.floor(basePrice * tier.multiplier));
    }
  }

  return basePrice;
}

/** True if the item carries a beneficial identity: blessed, artifact-tier, or enchanted/elemental. */
function hasPositiveAttribute(item: Item): boolean {
  return (
    item.isBlessed() ||
    item.quality === 'artifact' ||
    item.quality === 'enchanted' ||
    (item.enchantmentLevel ?? 0) > 0 ||
    !!item.elementalAffix
  );
}

/** True if the item carries a harmful identity: cursed, hexed, unholy, or chaotic. */
function hasNegativeAttribute(item: Item): boolean {
  return item.isCursed() || item.isHexed() || item.isUnholy() || item.isChaotic();
}

/**
 * Calculates sell valuation for an item offered by the player:
 * - Base sell rate is 50% of buy value.
 * - A merchant appraises anything crossing the counter, whether or not the seller ever
 *   paid to identify it. An unidentified item that turns out blessed/enchanted/artifact
 *   fetches a windfall price; one that turns out cursed/hexed/unholy/chaotic fetches scrap;
 *   a plain unidentified item still suffers the ordinary mystery-goods penalty.
 * - Once identified, enchanted items receive a +50% bonus and cursed items sell for 10%.
 */
export function getItemSellPrice(item: Item): number {
  const buyPrice = getItemBuyPrice(item);
  let sellPrice = Math.floor(buyPrice * 0.5);

  if (!item.identified) {
    // Negative takes priority: a cursed blade stays scrap even if it also rolled a stat bonus.
    if (hasNegativeAttribute(item)) {
      sellPrice = Math.floor(sellPrice * 0.1);
    } else if (hasPositiveAttribute(item)) {
      sellPrice = Math.floor(sellPrice * 2.0);
    } else {
      sellPrice = Math.floor(sellPrice * 0.25);
    }
  } else if (item.quality === 'enchanted') {
    sellPrice = Math.floor(sellPrice * 1.5);
  } else if (item.quality === 'cursed') {
    sellPrice = Math.floor(sellPrice * 0.1);
  }

  return Math.max(1, sellPrice);
}

export class Merchant {
  public readonly id: string;
  public readonly name: string;
  public readonly shopName: string;
  public readonly shopType: ShopType;
  public readonly greeting: string;
  public stock: Item[];

  constructor(
    id: string,
    name: string,
    shopName: string,
    shopType: ShopType,
    greeting: string,
    initialStock: Item[]
  ) {
    this.id = id;
    this.name = name;
    this.shopName = shopName;
    this.shopType = shopType;
    this.greeting = greeting;
    this.stock = [...initialStock];
  }

  /**
   * Returns items from stock that satisfy world state preconditions (or all if no worldState provided).
   */
  public getAvailableStock(worldState?: WorldState): Item[] {
    if (!worldState) {
      return [...this.stock];
    }
    return this.stock.filter((item) => evaluatePredicate(item.predicate, worldState));
  }

  /**
   * Purchases an item from the merchant and transfers it into the player's pack.
   */
  public buyItem(
    player: Player,
    itemIndexOrId: number | string,
    worldState?: WorldState,
    pricing?: MerchantPricingRules
  ): TransactionResult {
    let itemIndex = -1;
    if (typeof itemIndexOrId === 'number') {
      itemIndex = itemIndexOrId;
    } else {
      itemIndex = this.stock.findIndex((i) => i.id === itemIndexOrId);
    }

    if (itemIndex < 0 || itemIndex >= this.stock.length) {
      return { success: false, message: 'Item is no longer available in stock.' };
    }

    const item = this.stock[itemIndex];
    const costCp = getItemBuyPrice(item, worldState, pricing);

    // 1. Check player purchasing power
    const playerFundsCp = getPlayerTotalCp(player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `You cannot afford ${item.name}. Cost: ${formatCurrency(costCp)}, Funds: ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }

    // 2. Check player carry capacity (pack bulk & weight)
    const canContain = player.inventory.primaryPack.canContain(item);
    if (!canContain.allowed) {
      return {
        success: false,
        message: `Cannot carry ${item.name}: ${canContain.reason ?? 'Exceeds capacity'}.`,
        costInCp: costCp,
      };
    }

    // 3. Deduct currency with change
    const deduction = deductCurrencyFromPlayer(player, costCp);
    if (!deduction.success) {
      return deduction;
    }

    // 4. Remove item from stock and add to player pack
    this.stock.splice(itemIndex, 1);
    player.inventory.primaryPack.addItem(item);

    return {
      success: true,
      message: `Purchased ${item.name} for ${formatCurrency(costCp)}.`,
      costInCp: costCp,
      changeGiven: deduction.changeGiven,
    };
  }

  /**
   * Sells an item from player's inventory to the merchant.
   */
  public sellItem(player: Player, itemOrId: Item | string): TransactionResult {
    let item: Item | null = null;
    if (typeof itemOrId === 'string') {
      item = player.inventory.primaryPack.getItem(itemOrId) ??
             player.inventory.belt?.getItem(itemOrId) ??
             player.inventory.paperdoll.getAllEquipped().find((e) => e.item.id === itemOrId)?.item ?? null;
      if (!item) {
        return { success: false, message: `Could not locate item in your inventory.` };
      }
    } else {
      item = itemOrId;
    }

    // 1. Validate item is not equipped cursed gear
    if (item.quality === 'cursed') {
      const isEquipped = player.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === item!.id);
      if (isEquipped) {
        return {
          success: false,
          message: `${item.name} is cursed and bound to your body! Cleanse the curse at a town temple first.`,
        };
      }
    }

    // 2. Remove item from player inventory (paperdoll, belt, or pack)
    let removed = false;
    const equippedEntry = player.inventory.paperdoll.getAllEquipped().find((e) => e.item.id === item!.id);
    if (equippedEntry) {
      player.inventory.paperdoll.unequip(equippedEntry.slot);
      removed = true;
    } else if (player.inventory.belt?.removeItem(item.id)) {
      removed = true;
    } else if (player.inventory.primaryPack.removeItem(item.id)) {
      removed = true;
    }

    if (!removed) {
      return { success: false, message: `Could not locate ${item.name} in your inventory.` };
    }

    // 3. Calculate sell price (appraising the item's true nature, identified or not)
    //    before revealing it, then deposit coins into the player's purse.
    const sellPriceCp = getItemSellPrice(item);
    addCurrencyToPlayer(player, sellPriceCp);

    // 4. The merchant's appraisal identifies the item; it now shows its true color
    //    scheme and is added to stock as a known good.
    item.identified = true;
    this.stock.push(item);

    return {
      success: true,
      message: `Sold ${item.displayName} for ${formatCurrency(sellPriceCp)}.`,
      costInCp: sellPriceCp,
    };
  }
}
