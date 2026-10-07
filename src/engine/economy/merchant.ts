import type { Item } from '../items/item';
import type { Player } from '../entities/player';
import {
  formatCurrency,
  getPlayerTotalCp,
  deductCurrencyFromPlayer,
  addCurrencyToPlayer,
  getPlayerCoinItems,
} from './currency';
import type { TransactionResult } from './types';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import { type WorldState, getFaction } from '../state/worldState';
import type { MerchantPricingRules } from '../types/manifest';

export type ShopType = 'general' | 'armory' | 'alchemist';

/** A merchant's price ratios (`MerchantConfig.markupRatio`/`markdownRatio`): what it asks and
 *  what it offers, as shares of an item's value. Unset, it asks the value and offers half. */
export interface MerchantRatios {
  markupRatio?: number;
  markdownRatio?: number;
}

const DEFAULT_MARKUP = 1;
const DEFAULT_MARKDOWN = 0.5;

/** `Math.floor` that a ratio's float error can't push below a whole number (0.45 × 60). */
const floorPrice = (cp: number) => Math.floor(cp + 1e-9);

/**
 * Calculates purchase price for an item in a merchant shop: its value times the merchant's
 * `markupRatio` (default 1) and the faction standing's multiplier. A trade moves the whole
 * Item, so a stack costs its unit price times its quantity.
 */
export function getItemBuyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules, markupRatio = DEFAULT_MARKUP): number {
  return unitBuyPrice(item, worldState, pricing, markupRatio) * (item.quantity ?? 1);
}

function unitBuyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules, markupRatio = DEFAULT_MARKUP): number {
  const basePrice = valueOrDefault(item, item.value);
  const multiplier = markupRatio * (worldState && pricing ? getMerchantPriceMultiplier(worldState, pricing) : 1);
  return multiplier !== 1 ? Math.max(1, floorPrice(basePrice * multiplier)) : basePrice;
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
 * Whether a merchant buys the item at all: coins are the banker's business, a quest item is
 * the hero's to keep (an Essence-Rune is spent at an altar, a relic carried home), and an
 * item its pack priced at nothing is worth nothing.
 */
export function isSellable(item: Item): boolean {
  if (item.category === 'currency' || item.category === 'quest') return false;
  return item.value > 0 || item.baseValue > 0;
}

/**
 * Calculates sell valuation for an item offered by the player (0 for one no merchant buys):
 * - Base sell rate is the merchant's `markdownRatio` of the item's value (default 50%).
 * - An unidentified item is mystery goods: a quarter of the plain item's rate, whatever
 *   it hides (Q21). Two unidentified items that look alike are offered the same price, so
 *   the counter is no longer a free appraisal; the +N and the family show up in the price
 *   only once the item is identified.
 * - Identified, a positive family pays +50% (the +N is already in the value) and a
 *   negative one sells for 10%. Chaotic is neither bonus nor scrap.
 * - A stack pays the unit price times its quantity.
 */
export function getItemSellPrice(item: Item, markdownRatio = DEFAULT_MARKDOWN): number {
  if (!isSellable(item)) return 0;
  return unitSellPrice(item, markdownRatio) * (item.quantity ?? 1);
}

function unitSellPrice(item: Item, markdownRatio: number): number {
  if (!item.identified) {
    return Math.max(1, Math.floor(floorPrice(valueOrDefault(item, item.baseValue) * markdownRatio) * 0.25));
  }

  let sellPrice = floorPrice(valueOrDefault(item, item.value) * markdownRatio);
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
  /** What it asks, as a share of an item's value (`MerchantConfig.markupRatio`, default 1). */
  public readonly markupRatio: number;
  /** What it offers, as a share of an item's value (`MerchantConfig.markdownRatio`, default 0.5). */
  public readonly markdownRatio: number;
  public stock: Item[];

  constructor(
    id: string,
    name: string,
    shopName: string,
    shopType: ShopType,
    greeting: string,
    initialStock: Item[],
    ratios: MerchantRatios = {}
  ) {
    this.id = id;
    this.name = name;
    this.shopName = shopName;
    this.shopType = shopType;
    this.greeting = greeting;
    this.markupRatio = ratios.markupRatio ?? DEFAULT_MARKUP;
    this.markdownRatio = ratios.markdownRatio ?? DEFAULT_MARKDOWN;
    this.stock = [...initialStock];
  }

  /** What this merchant asks for `item`: the price the shop shows and `buyItem` charges. */
  public buyPrice(item: Item, worldState?: WorldState, pricing?: MerchantPricingRules): number {
    return getItemBuyPrice(item, worldState, pricing, this.markupRatio);
  }

  /** What this merchant offers for `item`: the price the shop shows and `sellItem` pays. */
  public sellPrice(item: Item): number {
    return getItemSellPrice(item, this.markdownRatio);
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
    const costCp = this.buyPrice(item, worldState, pricing);

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
    const coinsBefore = getPlayerCoinItems(player);
    const deduction = deductCurrencyFromPlayer(player, costCp);
    if (!deduction.success) {
      return deduction;
    }

    // 4. Add to player pack, then take it off the shelf. The change can take the room the
    //    check above saw (a gold coin broken into silver): then the coins go back as they were.
    if (!player.inventory.primaryPack.addItem(item)) {
      for (const { container, item: coins } of getPlayerCoinItems(player)) container.removeItem(coins.id);
      for (const { container, item: coins } of coinsBefore) container.placeItem(coins);
      return {
        success: false,
        message: `Cannot carry ${item.name}: your change would take the room it needs.`,
        costInCp: costCp,
      };
    }
    this.stock.splice(itemIndex, 1);

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
    if (!isSellable(item)) {
      return { success: false, message: `No merchant will buy ${item.displayName}.` };
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
    const sellPriceCp = this.sellPrice(item);
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
