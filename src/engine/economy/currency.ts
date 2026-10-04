import { Item, type ItemConfig } from '../items/item';
import type { Player } from '../entities/player';
import type { Container } from '../items/container';
import {
  type CoinDenomination,
  COIN_VALUES,
  COIN_BULK_CM3,
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
      weight: 0,
      bulk: count * COIN_BULK_CM3,
      quality: 'normal',
      identified: true,
      description: `Minted ${denom} coins of the realm. Each coin is worth ${formatCurrency(COIN_VALUES[denom])}.`,
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

  /** Coins weigh nothing; they take space instead (`COIN_BULK_CM3` each). */
  public override totalWeight(): number {
    return 0;
  }

  public override totalBulk(): number {
    return this.count * COIN_BULK_CM3;
  }

  public setCount(newCount: number): void {
    this.count = Math.max(0, newCount);
    const singularOrPlural = this.count === 1 ? COIN_NAMES[this.denomination].singular : COIN_NAMES[this.denomination].plural;
    (this as { name: string }).name = `${this.count} ${singularOrPlural}`;
    (this as { bulk: number }).bulk = this.count * COIN_BULK_CM3;
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
 * Formats an amount as one figure in copper pieces: "5 CP", "350 CP", "5,000 CP". Every
 * price, fee and purse uses it, so the player compares one number instead of a mix of
 * coins (ADR-0011); the coins themselves stay physical items in four denominations.
 */
export function formatCurrency(totalCp: number): string {
  const cp = Math.max(0, Math.floor(totalCp));
  return `${String(cp).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${COIN_ABBREV.copper}`;
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

/** How many more coins of one metal `container` can take, by its room and its ancestors'. */
export function coinRoom(container: Container, denomination: CoinDenomination): number {
  const fits = (count: number) => container.canContain(new CoinItem({ id: 'coin-room-probe', denomination, count })).allowed;
  let high = Math.max(0, Math.floor((container.maxBulkCapacity - container.containedBulk()) / COIN_BULK_CM3));
  if (high === 0 || !fits(1)) return 0;
  if (fits(high)) return high;
  let low = 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * Puts coins in `container` even past its room, onto a pile of the same metal when it has
 * one: money paid to a hero is never destroyed, even when nothing has room for it.
 */
export function stowCoins(container: Container, coins: CoinItem): void {
  const pile = container.getItems().find((i): i is CoinItem => i instanceof CoinItem && i.denomination === coins.denomination);
  if (pile) pile.add(coins.count);
  else container.placeItem(coins);
}

/**
 * Pays coins to the hero: the purse while it has room, then the pack (`storeItem`). Coins
 * neither can hold go to the pack anyway, past its room, so a sale or a reward is never lost.
 */
export function addCurrencyToPlayer(player: Player, amount: CurrencyBreakdown | number): boolean {
  const breakdown = typeof amount === 'number' ? breakdownChange(amount) : amount;
  const denoms: CoinDenomination[] = ['platinum', 'gold', 'silver', 'copper'];
  let allStored = true;

  for (const denom of denoms) {
    const count = breakdown[denom];
    if (count <= 0) continue;
    const coins = new CoinItem({ id: `${player.id}-c-${denom}-0`, denomination: denom, count });
    if (!player.inventory.storeItem(coins).success) {
      stowCoins(player.inventory.primaryPack, coins);
      allStored = false;
    }
  }

  return allStored;
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
