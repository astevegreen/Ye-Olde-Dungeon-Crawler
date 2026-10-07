import { describe, it, expect } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { Item } from '../../items/item';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { getItemBuyPrice, getItemSellPrice, isSellable, Merchant } from '../merchant';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { cotwManifest } from '../../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 5 (economy): regression guards for the findings
 * fixed since. R-econ-2: a stack sells and buys for its unit price times its quantity, not
 * one unit's. R-econ-6: a quest item is not for sale (a zero-value one once fetched the
 * 2,000 CP category default). R-econ-12: a purchase whose change would take the room the
 * ware needs is refused, with the coins as they were. Content is a fixture only (§3).
 */

function hero(): Player {
  const p = new Player({ id: 'h', name: 'H', position: { x: 1, y: 1 }, stats: { hp: 35, maxHp: 35, attack: 10, defense: 5 }, strength: 30 });
  p.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return p;
}

describe('R-econ-2 · selling or buying a stack prices every unit', () => {
  it('five potions sold as one stack pay five times the unit price', () => {
    const player = hero();
    const stack = ItemFactory.createHealthPotion('stack-pot');
    const unit = getItemSellPrice(stack);
    stack.quantity = 5;
    player.inventory.primaryPack.addItem(stack);
    const before = getPlayerTotalCp(player);

    new Merchant('m', 'M', 'Shop', 'alchemist', 'hi', []).sellItem(player, stack);

    expect(getPlayerTotalCp(player) - before).toBe(unit * 5);
  });

  it('buying a stocked stack of five costs five times the unit price', () => {
    const player = hero();
    const stack = ItemFactory.createHealthPotion('shelf-pot');
    const unit = getItemBuyPrice(stack);
    stack.quantity = 5;
    addCurrencyToPlayer(player, unit * 10);
    const before = getPlayerTotalCp(player);

    const res = new Merchant('m', 'M', 'Shop', 'alchemist', 'hi', [stack]).buyItem(player, 'shelf-pot');

    expect(res.success).toBe(true);
    expect(before - getPlayerTotalCp(player)).toBe(unit * 5);
  });
});

describe('R-econ-6 · a quest item is not sold for money', () => {
  it('an Essence-Rune (value 0, category quest) cannot be sold for money', () => {
    const player = hero();
    const def = (cotwManifest.items as Array<{ id: string }>).find((i) => i.id === 'essence_uruz')!;
    const essence = createScaledItem(def as never, 'ess-1', 1, () => 0.5);
    player.inventory.primaryPack.addItem(essence);
    const before = getPlayerTotalCp(player);

    new Merchant('m', 'M', 'Shop', 'general', 'hi', []).sellItem(player, essence);

    expect(getPlayerTotalCp(player) - before).toBeLessThanOrEqual(1);
  });

  it('a priced quest relic is not for sale either, and stays in the pack', () => {
    const player = hero();
    const def = (cotwManifest.items as Array<{ id: string }>).find((i) => i.id === 'hearth_tear_fragment')!;
    const relic = createScaledItem(def as never, 'relic-1', 1, () => 0.5);
    player.inventory.primaryPack.addItem(relic);

    const res = new Merchant('m', 'M', 'Shop', 'general', 'hi', []).sellItem(player, relic);

    expect(res.success).toBe(false);
    expect(isSellable(relic)).toBe(false);
    expect(player.inventory.primaryPack.getItem('relic-1')).toBe(relic);
  });
});

describe('R-econ-12 · a purchase never takes the money and loses the item', () => {
  it('when the change takes the room the ware needed, the sale is refused and the coins are as they were', () => {
    const player = new Player({ id: 'h', name: 'H', position: { x: 1, y: 1 }, stats: { hp: 35, maxHp: 35, attack: 10, defense: 5 }, strength: 30 });
    const pack = player.inventory.primaryPack;
    addCurrencyToPlayer(player, 100); // one gold coin, in the pack (no purse worn)
    const filler = new Item({ id: 'filler', name: 'Bedroll', category: 'misc', weight: 10, bulk: pack.maxBulkCapacity - pack.containedBulk() - 120, identified: true });
    pack.addItem(filler);
    const candle = new Item({ id: 'candle', name: 'Candle', category: 'misc', weight: 10, bulk: 100, value: 20, identified: true });
    const merchant = new Merchant('m', 'M', 'Shop', 'general', 'hi', [candle]);
    const coinsBefore = pack.getItems().filter((i) => i.category === 'currency').map((i) => i.id);

    const res = merchant.buyItem(player, 'candle');

    expect(res.success).toBe(false);
    expect(getPlayerTotalCp(player)).toBe(100);
    expect(pack.getItems().filter((i) => i.category === 'currency').map((i) => i.id)).toEqual(coinsBefore);
    expect(merchant.stock).toContain(candle);
    expect(pack.containedBulk()).toBeLessThanOrEqual(pack.maxBulkCapacity);
  });
});
