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
import { COIN_WEIGHT_GRAMS } from '../types';

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

  it('correctly calculates physical weight at 10 grams per coin and dynamic bulk', () => {
    const copperStack = new CoinItem({
      id: 'c1',
      denomination: 'copper',
      count: 100,
    });

    // 100 coins * 10g = 1000g (1 kg)
    expect(copperStack.totalWeight()).toBe(100 * COIN_WEIGHT_GRAMS);
    expect(copperStack.weight).toBe(1000);
    expect(copperStack.totalBulk()).toBe(50); // ceil(100 * 0.5)

    // Updating count dynamically updates name, weight, and bulk
    copperStack.setCount(250);
    expect(copperStack.name).toBe('250 Copper Pieces');
    expect(copperStack.totalWeight()).toBe(2500);
    expect(copperStack.totalBulk()).toBe(125);
  });

  it('calculates optimal change breakdown across denominations', () => {
    // 1357 CP -> 1 PP (1000), 3 GP (300), 5 SP (50), 7 CP (7)
    const breakdown = breakdownChange(1357);
    expect(breakdown).toEqual({
      platinum: 1,
      gold: 3,
      silver: 5,
      copper: 7,
    });

    expect(breakdownToCp(breakdown)).toBe(1357);
    expect(formatCurrency(1357)).toBe('1 PP, 3 GP, 5 SP, 7 CP');
  });

  it('automatically stacks coins into equipped coin purse', () => {
    const purse = player.inventory.purse as Container;
    expect(purse).toBeDefined();

    addCoinsToContainer(purse, 'copper', 50);
    expect(purse.itemCount).toBe(1);
    expect(purse.totalWeight()).toBe(50 * COIN_WEIGHT_GRAMS + purse.weight);

    // Adding more copper stacks onto the same CoinItem
    addCoinsToContainer(purse, 'copper', 30);
    expect(purse.itemCount).toBe(1);

    const coinItem = purse.getItems()[0] as CoinItem;
    expect(coinItem.count).toBe(80);
    expect(coinItem.name).toBe('80 Copper Pieces');
  });

  it('deposits currency to player and routes into coin purse', () => {
    const added = addCurrencyToPlayer(player, {
      copper: 25,
      silver: 10,
      gold: 5,
      platinum: 1,
    });

    expect(added).toBe(true);
    const breakdown = getPlayerCurrencyBreakdown(player);
    expect(breakdown.copper).toBe(25);
    expect(breakdown.silver).toBe(10);
    expect(breakdown.gold).toBe(5);
    expect(breakdown.platinum).toBe(1);

    // Total CP: 25 + 100 + 500 + 1000 = 1625 CP
    expect(getPlayerTotalCp(player)).toBe(1625);
  });

  it('deducts currency from player and provides optimal physical change', () => {
    // Give player 2 Gold (200 CP)
    addCurrencyToPlayer(player, { copper: 0, silver: 0, gold: 2, platinum: 0 });
    expect(getPlayerTotalCp(player)).toBe(200);

    // Deduct 45 CP (e.g., purchasing a Torch for 25 CP and Rations for 20 CP)
    const result = deductCurrencyFromPlayer(player, 45);
    expect(result.success).toBe(true);
    expect(getPlayerTotalCp(player)).toBe(155);

    // Change given: 155 CP -> 1 GP (100), 5 SP (50), 5 CP (5)
    const breakdown = getPlayerCurrencyBreakdown(player);
    expect(breakdown).toEqual({
      platinum: 0,
      gold: 1,
      silver: 5,
      copper: 5,
    });
  });

  it('rejects deduction and keeps funds intact when balance is insufficient', () => {
    addCurrencyToPlayer(player, { copper: 50, silver: 0, gold: 0, platinum: 0 });
    expect(getPlayerTotalCp(player)).toBe(50);

    const result = deductCurrencyFromPlayer(player, 100);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient funds');
    expect(getPlayerTotalCp(player)).toBe(50);
  });

  it('demonstrates strategic encumbrance reduction by exchanging copper into platinum', () => {
    // 1000 Copper = 10,000 grams (10 kg)
    const heavyCopper = new CoinItem({ id: 'c-heavy', denomination: 'copper', count: 1000 });
    expect(heavyCopper.totalWeight()).toBe(10000);

    // Equivalent value in Platinum: 1 Platinum Coin = 1000 CP = 10 grams!
    const lightPlat = new CoinItem({ id: 'p-light', denomination: 'platinum', count: 1 });
    expect(lightPlat.valueInCp).toBe(heavyCopper.valueInCp);
    expect(lightPlat.totalWeight()).toBe(10); // 9,990g weight saved!
  });
});
