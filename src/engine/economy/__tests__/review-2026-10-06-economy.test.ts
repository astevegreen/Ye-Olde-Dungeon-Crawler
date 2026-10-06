import { describe, it, expect } from 'vitest';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { getItemBuyPrice, getItemSellPrice, isSellable, Merchant } from '../merchant';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { cotwManifest } from '../../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 5 (economy). Each test reproduces one finding from
 * `.prompts/codebase-review-2026-10-06/areas/05-items-economy.md` and is marked `it.fails` so
 * the suite stays green until the bug is fixed. Content is a fixture only (§3).
 */

function hero(): Player {
  const p = new Player({ id: 'h', name: 'H', position: { x: 1, y: 1 }, stats: { hp: 35, maxHp: 35, attack: 10, defense: 5 }, strength: 30 });
  p.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return p;
}

describe('R-econ-2 · selling a stack pays for one unit', () => {
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

describe('R-econ-6 · a zero-value quest item sells for the 2,000 CP category default', () => {
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
