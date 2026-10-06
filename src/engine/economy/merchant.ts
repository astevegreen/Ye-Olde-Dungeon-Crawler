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
 * Calculates purchase price for an item in a merchant shop. A trade moves the whole Item,
 * so a stack costs its unit price times its quantity.
 */
export function getItemBuyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules): number {
  return unitBuyPrice(item, worldState, pricing) * (item.quantity ?? 1);
}

function unitBuyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules): number {
  const basePrice = valueOrDefault(item, item.value);

  if (worldState && pricing) {
    const multiplier = getMerchantPriceMultiplier(worldState, pricing);
    if (multiplier !== 1) {
      return Math.max(1, Math.floor(basePrice * multiplier));
    }
  }

  return basePrice;
}

/** The buy-price multiplier the faction's standing earns now: the first matching tier, else 1. */
export function getMerchantPriceMultiplier(worldState: WorldState, pricing: MerchantPricingRules): number {
  const standing = getFaction(worldState, pricing.faction);
  const tier = pricing.tiers.find(
    (t) =>
      (t.minStanding === undefined || standing >= t.minStanding) &&
      (t.maxStanding === undefined || standing <= t.maxStanding)
  );
  return tier?.multiplier ?? 1;
}

/** An item's price from `value`, or a category default when it has none. */
function valueOrDefault(item: Item, value: number): number {
  if (value > 0) return value;
  switch (item.category) {
    case 'weapon':
      return 10000;
    case 'armor':
      return 15000;
    case 'shield':
      return 5000;
    case 'consumable':
      return 4000;
    case 'container':
      return 5000;
    default:
      return 2000;
  }
}

/**
 * Calculates sell valuation for an item offered by the player:
 * - Base sell rate is 50% of buy value.
 * - An unidentified item is mystery goods: a quarter of the plain item's rate, whatever
 *   it hides (Q21). Two unidentified items that look alike are offered the same price, so
 *   the counter is no longer a free appraisal; the +N and the family show up in the price
 *   only once the item is identified.
 * - Identified, a positive family pays +50% (the +N is already in the value) and a
 *   negative one sells for 10%. Chaotic is neither bonus nor scrap.
 * - A stack pays the unit price times its quantity.
 */
export function getItemSellPrice(item: Item): number {
  return unitSellPrice(item) * (item.quantity ?? 1);
}

function unitSellPrice(item: Item): number {
  if (!item.identified) {
    return Math.max(1, Math.floor(Math.floor(valueOrDefault(item, item.baseValue) * 0.5) * 0.25));
  }

  let sellPrice = Math.floor(unitBuyPrice(item) * 0.5);
  if (item.modifiers.some((m) => m.alignment === 'negative')) {
    sellPrice = Math.floor(sellPrice * 0.1);
  } else if (item.modifiers.some((m) => m.alignment === 'positive')) {
    sellPrice = Math.floor(sellPrice * 1.5);
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

    // 1. A worn, bound item (a negative family) is not for sale until cleansed.
    if (item.isBound()) {
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

    // 3. The price is settled before the merchant looks the item over: an unidentified
    //    one sells as mystery goods.
    const sellPriceCp = getItemSellPrice(item);
    addCurrencyToPlayer(player, sellPriceCp);

    // 4. On the shelf the merchant knows what they bought: it is stocked identified, and
    //    it is no longer anyone's junk.
    item.identified = true;
    item.junk = false;
    this.stock.push(item);

    return {
      success: true,
      message: `Sold ${item.displayName} for ${formatCurrency(sellPriceCp)}.`,
      costInCp: sellPriceCp,
    };
  }
}
