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
import type { WorldState } from '../state/worldState';

export type ShopType = 'general' | 'armory' | 'alchemist';

export const BASE_ITEM_VALUES_CP: Record<string, number> = {
  'Iron Dagger': 2000,
  'Steel Broadsword': 15000,
  'Bearded Battleaxe': 20000,
  'Frost Broadsword': 45000,
  'Spiked Mace': 12000,
  'Studded Leather Armor': 8000,
  'Iron Chainmail': 30000,
  'Full Plate Armor': 80000,
  'Reinforced Wooden Shield': 3000,
  'Iron Tower Shield': 12000,
  'Iron Helmet': 5000,
  'Traveler Boots': 3000,
  'Minor Health Potion': 5000,
  'Mana Draught': 7500,
  'Antidote Potion': 4000,
  'Scroll of Identify': 5000,
  'Scroll of Phase Door': 4000,
  'Wand of Lightning': 50000,
  'Wand of Fireballs': 60000,
  "Adventurer's Backpack": 5000,
  'Leather Utility Belt': 4000,
  'Wooden Torch': 500,
  'Iron Rations': 1000,
  'Thief Lockpicks': 2500,
};

/**
 * Calculates purchase price for an item in a merchant shop.
 */
export function getItemBuyPrice(item: Item): number {
  if (item.value && item.value > 0) {
    return item.value;
  }
  if (BASE_ITEM_VALUES_CP[item.name]) {
    return BASE_ITEM_VALUES_CP[item.name];
  }
  // Default based on category
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
 * - Unidentified items suffer a 75% penalty (merchants pay scrap for mystery goods).
 * - Enchanted items that are identified receive a +50% bonus.
 * - Cursed items sell for only 10% value.
 */
export function getItemSellPrice(item: Item): number {
  const buyPrice = getItemBuyPrice(item);
  let sellPrice = Math.floor(buyPrice * 0.5);

  if (!item.identified) {
    sellPrice = Math.floor(sellPrice * 0.25);
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
  public buyItem(player: Player, itemIndexOrId: number | string): TransactionResult {
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
    const costCp = getItemBuyPrice(item);

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

    // 3. Calculate sell price and deposit coins into purse
    const sellPriceCp = getItemSellPrice(item);
    addCurrencyToPlayer(player, sellPriceCp);

    // 4. Add sold item to merchant stock
    this.stock.push(item);

    return {
      success: true,
      message: `Sold ${item.displayName} for ${formatCurrency(sellPriceCp)}.`,
      costInCp: sellPriceCp,
    };
  }
}
