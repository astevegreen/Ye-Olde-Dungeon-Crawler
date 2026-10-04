import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { Container } from '../../items/container';
import {
  CoinItem,
  breakdownChange,
  breakdownToCp,
  formatCurrency,
  addCoinsToContainer,
  addCurrencyToPlayer,
  deductCurrencyFromPlayer,
  getPlayerTotalCp,
  getPlayerCurrencyBreakdown,
} from '../currency';
import { COIN_BULK_CM3 } from '../types';

describe('Multi-Denomination Currency & Physical Coinage System', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player({
      id: 'test-hero',
      name: 'Torvald',
      position: { x: 5, y: 5 },
      stats: { hp: 35, maxHp: 35, attack: 10, defense: 5 },
      strength: 15,
    });
    const purse = ItemFactory.createCoinPurse('test-purse');
    player.inventory.paperdoll.equip(purse, 'purse');
  });

  it('coins weigh nothing and take COIN_BULK_CM3 each', () => {
    const copperStack = new CoinItem({
      id: 'c1',
      denomination: 'copper',
      count: 100,
    });

    expect(copperStack.totalWeight()).toBe(0);
    expect(copperStack.totalBulk()).toBe(100 * COIN_BULK_CM3);

    // Updating count dynamically updates name and bulk
    copperStack.setCount(250);
    expect(copperStack.name).toBe('250 Copper Coins');
    expect(copperStack.totalWeight()).toBe(0);
    expect(copperStack.totalBulk()).toBe(250 * COIN_BULK_CM3);
  });

  it('calculates optimal change breakdown across denominations', () => {
    // 1357 CP -> 13 GP (1300), 5 SP (50), 7 CP (7)
    const breakdown = breakdownChange(1357);
    expect(breakdown).toEqual({
      gold: 13,
      silver: 5,
      copper: 7,
    });

    expect(breakdownToCp(breakdown)).toBe(1357);
    expect(formatCurrency(1357)).toBe('1,357 CP');
    expect(formatCurrency(5000)).toBe('5,000 CP');
    expect(formatCurrency(5)).toBe('5 CP');
    expect(formatCurrency(0)).toBe('0 CP');
    expect(formatCurrency(123456789)).toBe('123,456,789 CP');
  });

  it('automatically stacks coins into equipped coin purse', () => {
    const purse = player.inventory.purse as Container;
    expect(purse).toBeDefined();

    addCoinsToContainer(purse, 'copper', 50);
    expect(purse.itemCount).toBe(1);
    expect(purse.totalWeight()).toBe(purse.weight);
    expect(purse.containedBulk()).toBe(50 * COIN_BULK_CM3);

    // Adding more copper stacks onto the same CoinItem
    addCoinsToContainer(purse, 'copper', 30);
    expect(purse.itemCount).toBe(1);

    const coinItem = purse.getItems()[0] as CoinItem;
    expect(coinItem.count).toBe(80);
    expect(coinItem.name).toBe('80 Copper Coins');
  });

  it('deposits currency to player and routes into coin purse', () => {
    const added = addCurrencyToPlayer(player, {
      copper: 25,
      silver: 10,
      gold: 15,
    });

    expect(added).toBe(true);
    const breakdown = getPlayerCurrencyBreakdown(player);
    expect(breakdown.copper).toBe(25);
    expect(breakdown.silver).toBe(10);
    expect(breakdown.gold).toBe(15);

    // Total CP: 25 + 100 + 1500 = 1625 CP
    expect(getPlayerTotalCp(player)).toBe(1625);
  });

  it('deducts currency from player and provides optimal physical change', () => {
    // Give player 2 Gold (200 CP)
    addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 2 });
    expect(getPlayerTotalCp(player)).toBe(200);

    // Deduct 45 CP (e.g., purchasing a Torch for 25 CP and Rations for 20 CP)
    const result = deductCurrencyFromPlayer(player, 45);
    expect(result.success).toBe(true);
    expect(getPlayerTotalCp(player)).toBe(155);

    // Change given: 155 CP -> 1 GP (100), 5 SP (50), 5 CP (5)
    const breakdown = getPlayerCurrencyBreakdown(player);
    expect(breakdown).toEqual({
      gold: 1,
      silver: 5,
      copper: 5,
    });
  });

  it('rejects deduction and keeps funds intact when balance is insufficient', () => {
    addCurrencyToPlayer(player, { copper: 50, silver: 0, gold: 0 });
    expect(getPlayerTotalCp(player)).toBe(50);

    const result = deductCurrencyFromPlayer(player, 100);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient funds');
    expect(getPlayerTotalCp(player)).toBe(50);
  });

  it('the same value in a higher metal takes a fraction of the space', () => {
    const copper = new CoinItem({ id: 'c-many', denomination: 'copper', count: 1000 });
    const gold = new CoinItem({ id: 'g-few', denomination: 'gold', count: 10 });
    expect(gold.valueInCp).toBe(copper.valueInCp);
    expect(gold.totalBulk()).toBe(copper.totalBulk() / 100);
  });
});
