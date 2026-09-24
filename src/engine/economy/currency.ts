import { Item, type ItemConfig } from '../items/item';
import type { Player } from '../entities/player';
import type { Container } from '../items/container';
import {
  type CoinDenomination,
  COIN_VALUES,
  COIN_WEIGHT_GRAMS,
  COIN_NAMES,
  COIN_ABBREV,
  type CurrencyBreakdown,
  type TransactionResult,
} from './types';

export interface CoinItemConfig extends Partial<ItemConfig> {
  id: string;
  denomination: CoinDenomination;
  count: number;
}

export class CoinItem extends Item {
  public readonly denomination: CoinDenomination;
  public count: number;

  constructor(config: CoinItemConfig) {
    const denom = config.denomination;
    const count = Math.max(1, config.count);
    const singularOrPlural = count === 1 ? COIN_NAMES[denom].singular : COIN_NAMES[denom].plural;

    super({
      id: config.id,
      name: `${count} ${singularOrPlural}`,
      unidentifiedName: 'Pile of Coins',
      category: 'currency',
      weight: count * COIN_WEIGHT_GRAMS,
      bulk: Math.max(1, Math.ceil(count * 0.5)),
      quality: 'normal',
      identified: true,
      description: `Minted ${denom} coins of the realm. Each coin is worth ${COIN_VALUES[denom]} CP.`,
      stats: {},
      parentId: config.parentId,
      ownerId: config.ownerId,
    });

    this.denomination = denom;
    this.count = count;
  }

  public get valueInCp(): number {
    return this.count * COIN_VALUES[this.denomination];
  }

  public override totalWeight(): number {
    return this.count * COIN_WEIGHT_GRAMS;
  }

  public override totalBulk(): number {
    return Math.max(1, Math.ceil(this.count * 0.5));
  }

  public setCount(newCount: number): void {
    this.count = Math.max(0, newCount);
    const singularOrPlural = this.count === 1 ? COIN_NAMES[this.denomination].singular : COIN_NAMES[this.denomination].plural;
    (this as { name: string }).name = `${this.count} ${singularOrPlural}`;
    (this as { weight: number }).weight = this.count * COIN_WEIGHT_GRAMS;
    (this as { bulk: number }).bulk = Math.max(1, Math.ceil(this.count * 0.5));
  }

  public add(amount: number): void {
    this.setCount(this.count + amount);
  }

  public remove(amount: number): number {
    const removed = Math.min(this.count, amount);
    this.setCount(this.count - removed);
    return removed;
  }
}

/**
 * Converts a raw copper total into optimal physical denominations:
 * Platinum (1000 CP), Gold (100 CP), Silver (10 CP), Copper (1 CP).
 */
export function breakdownChange(totalCp: number): CurrencyBreakdown {
  let remaining = Math.max(0, Math.floor(totalCp));
  const platinum = Math.floor(remaining / COIN_VALUES.platinum);
  remaining %= COIN_VALUES.platinum;

  const gold = Math.floor(remaining / COIN_VALUES.gold);
  remaining %= COIN_VALUES.gold;

  const silver = Math.floor(remaining / COIN_VALUES.silver);
  remaining %= COIN_VALUES.silver;

  const copper = remaining;

  return { copper, silver, gold, platinum };
}

/**
 * Converts a CurrencyBreakdown into total value in Copper Pieces (CP).
 */
export function breakdownToCp(breakdown: CurrencyBreakdown): number {
  return (
    breakdown.copper * COIN_VALUES.copper +
    breakdown.silver * COIN_VALUES.silver +
    breakdown.gold * COIN_VALUES.gold +
    breakdown.platinum * COIN_VALUES.platinum
  );
}

/**
 * Formats a copper amount into readable string, e.g. "1 GP, 2 SP, 5 CP"
 */
export function formatCurrency(totalCp: number): string {
  const b = breakdownChange(totalCp);
  const parts: string[] = [];
  if (b.platinum > 0) parts.push(`${b.platinum} ${COIN_ABBREV.platinum}`);
  if (b.gold > 0) parts.push(`${b.gold} ${COIN_ABBREV.gold}`);
  if (b.silver > 0) parts.push(`${b.silver} ${COIN_ABBREV.silver}`);
  if (b.copper > 0 || parts.length === 0) parts.push(`${b.copper} ${COIN_ABBREV.copper}`);
  return parts.join(', ');
}

/**
 * Parses coin denomination from item name or properties if not an explicit CoinItem.
 */
export function parseCoinItem(item: Item): { denomination: CoinDenomination; count: number } | null {
  if (item instanceof CoinItem) {
    return { denomination: item.denomination, count: item.count };
  }
  if (item.category === 'currency') {
    const lower = item.name.toLowerCase();
    let count = 1;
    const match = lower.match(/(\d+)/);
    if (match) count = parseInt(match[1], 10);

    if (lower.includes('platinum') || lower.includes('pp')) return { denomination: 'platinum', count };
    if (lower.includes('silver') || lower.includes('sp')) return { denomination: 'silver', count };
    if (lower.includes('copper') || lower.includes('bronze') || lower.includes('cp')) return { denomination: 'copper', count };
    return { denomination: 'gold', count }; // default gold
  }
  return null;
}

/**
 * Gathers all coin items across the player's equipped purse and primary backpack.
 */
export function getPlayerCoinItems(player: Player): Array<{ container: Container; item: Item; parsed: { denomination: CoinDenomination; count: number } }> {
  const results: Array<{ container: Container; item: Item; parsed: { denomination: CoinDenomination; count: number } }> = [];

  const checkContainer = (c: Container | null | undefined) => {
    if (!c) return;
    for (const item of c.getItems()) {
      const parsed = parseCoinItem(item);
      if (parsed) {
        results.push({ container: c, item, parsed });
      }
    }
  };

  checkContainer(player.inventory.purse);
  checkContainer(player.inventory.primaryPack);

  return results;
}

/**
 * Calculates current total currency breakdown held by player.
 */
export function getPlayerCurrencyBreakdown(player: Player): CurrencyBreakdown {
  const breakdown: CurrencyBreakdown = { copper: 0, silver: 0, gold: 0, platinum: 0 };
  const coins = getPlayerCoinItems(player);
  for (const { parsed } of coins) {
    breakdown[parsed.denomination] += parsed.count;
  }
  return breakdown;
}

/**
 * Calculates total purchasing power in CP across player's purse and backpack.
 */
export function getPlayerTotalCp(player: Player): number {
  return breakdownToCp(getPlayerCurrencyBreakdown(player));
}

/**
 * Automatically routes coins into the equipped coin purse first, stacking with
 * existing coin stacks of the same denomination, or falls back to backpack.
 */
export function addCoinsToContainer(
  container: Container,
  denomination: CoinDenomination,
  count: number,
  idPrefix = 'coin',
  rng: () => number = () => 0
): boolean {
  if (count <= 0) return true;

  // 1. Try to find existing CoinItem stack of same denomination
  for (const item of container.getItems()) {
    if (item instanceof CoinItem && item.denomination === denomination) {
      item.add(count);
      return true;
    }
  }

  // 2. Otherwise instantiate a new CoinItem
  const newCoin = new CoinItem({
    id: `${idPrefix}-${denomination}-${Math.floor(rng() * 1000000)}`,
    denomination,
    count,
  });

  return container.addItem(newCoin);
}

/**
 * Deposits currency to player, prioritizing purse before primaryPack.
 */
export function addCurrencyToPlayer(player: Player, amount: CurrencyBreakdown | number): boolean {
  const breakdown = typeof amount === 'number' ? breakdownChange(amount) : amount;
  const targetContainer = player.inventory.purse ?? player.inventory.primaryPack;
  const overflowContainer = player.inventory.primaryPack;

  const denoms: CoinDenomination[] = ['platinum', 'gold', 'silver', 'copper'];
  let allSuccess = true;

  for (const denom of denoms) {
    const count = breakdown[denom];
    if (count > 0) {
      const added = addCoinsToContainer(targetContainer, denom, count, `${player.id}-c`);
      if (!added && targetContainer !== overflowContainer) {
        const overflowAdded = addCoinsToContainer(overflowContainer, denom, count, `${player.id}-c-overflow`);
        if (!overflowAdded) allSuccess = false;
      } else if (!added) {
        allSuccess = false;
      }
    }
  }

  return allSuccess;
}

/**
 * Deducts specified cost in CP from player, removing appropriate coins and
 * placing canonical optimal change back into player's coin purse.
 */
export function deductCurrencyFromPlayer(player: Player, costInCp: number): TransactionResult {
  const totalCp = getPlayerTotalCp(player);
  if (totalCp < costInCp) {
    return {
      success: false,
      message: `Insufficient funds. Cost: ${formatCurrency(costInCp)}, Available: ${formatCurrency(totalCp)}.`,
      costInCp,
    };
  }

  // Calculate change
  const changeCp = totalCp - costInCp;
  const changeBreakdown = breakdownChange(changeCp);

  // Remove all existing coin items from purse and pack
  const coins = getPlayerCoinItems(player);
  for (const { container, item } of coins) {
    container.removeItem(item.id);
  }

  // Deposit the exact change back in optimal denominations
  addCurrencyToPlayer(player, changeBreakdown);

  return {
    success: true,
    message: `Paid ${formatCurrency(costInCp)}. Change returned: ${formatCurrency(changeCp)}.`,
    costInCp,
    changeGiven: changeBreakdown,
  };
}
