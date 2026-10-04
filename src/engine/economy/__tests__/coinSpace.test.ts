import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import type { SaveData, SerializedContainer, SerializedItemNode } from '../../storage/types';
import { cotwManifest } from '../../../content/cotw';
import type { GameEngine } from '../../engine';
import { Container } from '../../items/container';
import { CoinItem, addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { BankService } from '../services';
import { PickUpAction } from '../../actions/inventory-actions';
import { COIN_BULK_CM3 } from '../types';

/**
 * Q3/Q24 (2026-10-03): coins weigh nothing but take space. The purse holds about 300 of them;
 * what doesn't fit goes to the pack. The Banker trades copper and silver for gold to save
 * space, for free.
 */
function newHero() {
  return new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Purse', { manifest: cotwManifest });
}

const coinsIn = (c: Container | null | undefined): number =>
  (c?.getItems() ?? []).reduce((n, i) => n + (i instanceof CoinItem ? i.count : 0), 0);

const purseCoins = (e: GameEngine) => coinsIn(e.player.inventory.purse);
const packCoins = (e: GameEngine) => coinsIn(e.player.inventory.primaryPack);

describe('coins take space, not weight', () => {
  it('a coin weighs nothing and takes the same space whatever its metal', () => {
    const copper = new CoinItem({ id: 'c', denomination: 'copper', count: 120 });
    const gold = new CoinItem({ id: 'g', denomination: 'gold', count: 120 });
    expect(copper.totalWeight()).toBe(0);
    expect(gold.totalWeight()).toBe(0);
    expect(copper.totalBulk()).toBe(120 * COIN_BULK_CM3);
    expect(gold.totalBulk()).toBe(copper.totalBulk());
  });

  it('the starting purse holds 300 coins', () => {
    const { engine } = newHero();
    const purse = engine.player.inventory.purse!;
    expect(purse.maxBulkCapacity / COIN_BULK_CM3).toBe(300);
  });

  it('a pile that only partly fits fills the purse and spills the rest into the pack', () => {
    const { engine } = newHero();
    const before = getPlayerTotalCp(engine.player);
    const inPurse = purseCoins(engine);
    const pile = new CoinItem({ id: 'pile', denomination: 'copper', count: 400 });

    const stored = engine.player.inventory.storeItem(pile);

    expect(stored.success).toBe(true);
    expect(purseCoins(engine)).toBe(300);
    expect(packCoins(engine)).toBe(inPurse + 400 - 300);
    expect(getPlayerTotalCp(engine.player)).toBe(before + 400);
  });

  it('picking up a pile that splits names the whole pile in the log', () => {
    const { engine } = newHero();
    const { x, y } = engine.player;
    engine.map.addItemAt(x, y, new CoinItem({ id: 'floor-pile', denomination: 'copper', count: 400 }));

    const result = engine.handlePlayerAction(new PickUpAction(engine.player));

    expect(result.message).toBe('You pick up 400 Copper Coins (stored in purse and pack).');
    expect(engine.map.getItemsAt(x, y)).toHaveLength(0);
    expect(purseCoins(engine)).toBe(300);
  });

  it('a pile that fits nowhere is left whole', () => {
    const { engine } = newHero();
    const pack = engine.player.inventory.primaryPack;
    const room = Math.floor((pack.maxBulkCapacity - pack.containedBulk()) / COIN_BULK_CM3);
    const purseRoom = 300 - purseCoins(engine);
    const pile = new CoinItem({ id: 'huge', denomination: 'copper', count: room + purseRoom + 1 });

    const stored = engine.player.inventory.storeItem(pile);

    expect(stored.success).toBe(false);
    expect(pile.count).toBe(room + purseRoom + 1);
    expect(packCoins(engine)).toBe(0);
  });

  it('coins paid to the hero fill the purse first, then the pack', () => {
    const { engine } = newHero();
    const inPurse = purseCoins(engine);
    addCurrencyToPlayer(engine.player, { copper: 500, silver: 0, gold: 0 });
    expect(purseCoins(engine)).toBe(300);
    expect(packCoins(engine)).toBe(inPurse + 500 - 300);
  });

  it('a save from before keeps every coin: what the purse cannot hold goes to the pack', () => {
    const { engine, profile } = newHero();
    const save: SaveData = JSON.parse(JSON.stringify(serializeGame(engine, profile)));
    // An older save: the pouch was sized by weight (5 kg of 10 g coins) and held 450 gold.
    const purse = Object.values(save.player.inventory.paperdoll).find(
      (n): n is SerializedContainer => !!n && (n as SerializedItemNode & { containerType?: string }).containerType === 'purse'
    )!;
    purse.maxBulkCapacity = 800;
    purse.items = [{ ...purse.items[0], id: 'old-gold', name: '450 Gold Coins', coinData: { denomination: 'gold', count: 450 } }];

    const loaded = deserializeGame(save, cotwManifest).engine;

    expect(getPlayerTotalCp(loaded.player)).toBe(45_000);
    expect(purseCoins(loaded)).toBe(300);
    expect(packCoins(loaded)).toBe(150);
  });

  it('a save holding platinum loads each platinum coin as 10 gold, overflow to the pack (Q42)', () => {
    const { engine, profile } = newHero();
    const save: SaveData = JSON.parse(JSON.stringify(serializeGame(engine, profile)));
    const purse = Object.values(save.player.inventory.paperdoll).find(
      (n): n is SerializedContainer => !!n && (n as SerializedItemNode & { containerType?: string }).containerType === 'purse'
    )!;
    purse.items = [{ ...purse.items[0], id: 'old-plat', name: '40 Platinum Coins', coinData: { denomination: 'platinum', count: 40 } }];
    save.player.inventory.primaryPack.items.push({ ...purse.items[0], id: 'pack-plat', name: '3 Platinum Coins', coinData: { denomination: 'platinum', count: 3 } });

    const loaded = deserializeGame(save, cotwManifest).engine;

    expect(getPlayerTotalCp(loaded.player)).toBe(43_000);
    const metals = loaded.player.inventory.getAllCarriedItems().filter((i): i is CoinItem => i instanceof CoinItem).map((c) => c.denomination);
    expect(new Set(metals)).toEqual(new Set(['gold']));
    expect(purseCoins(loaded)).toBe(300);
    expect(packCoins(loaded)).toBe(130);
  });

  it('wearing a bigger purse moves the coins into it, and the emptied old purse goes to the pack', () => {
    const { engine } = newHero();
    addCurrencyToPlayer(engine.player, { copper: 500, silver: 0, gold: 0 });
    const value = getPlayerTotalCp(engine.player);
    const oldPurse = engine.player.inventory.purse!;
    const bigger = new Container({
      id: 'bigger-purse',
      name: 'Bigger Purse',
      category: 'container',
      slot: 'purse',
      containerType: 'purse',
      weight: 100,
      bulk: 150,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 1500 * COIN_BULK_CM3,
      acceptedCategories: ['currency'],
      identified: true,
    });
    engine.player.inventory.primaryPack.addItem(bigger);

    const result = engine.player.inventory.equipFromPack('bigger-purse');

    expect(result.success).toBe(true);
    expect(engine.player.inventory.purse).toBe(bigger);
    expect(getPlayerTotalCp(engine.player)).toBe(value);
    expect(coinsIn(bigger)).toBe(562);
    expect(packCoins(engine)).toBe(0);
    expect(oldPurse.getItems()).toHaveLength(0);
    expect(engine.player.inventory.primaryPack.getItem(oldPurse.id)).toBe(oldPurse);
  });

  it('taking the purse off leaves its coins loose in the pack, where they still count', () => {
    const { engine } = newHero();
    const value = getPlayerTotalCp(engine.player);
    const inPurse = purseCoins(engine);

    expect(engine.player.inventory.unequipToPack('purse').success).toBe(true);

    expect(engine.player.inventory.purse).toBeNull();
    expect(packCoins(engine)).toBe(inPurse);
    expect(getPlayerTotalCp(engine.player)).toBe(value);
  });

  it('the Banker trades copper and silver for gold, for free, and the coins fit the purse again', () => {
    const { engine } = newHero();
    addCurrencyToPlayer(engine.player, { copper: 500, silver: 60, gold: 0 });
    const value = getPlayerTotalCp(engine.player);
    const coinsBefore = purseCoins(engine) + packCoins(engine);
    expect(packCoins(engine)).toBeGreaterThan(0);

    const result = BankService.compactCurrency(engine.player);

    expect(result.success).toBe(true);
    expect(result.costInCp).toBe(0);
    expect(getPlayerTotalCp(engine.player)).toBe(value);
    expect(packCoins(engine)).toBe(0);
    expect(result.coinsSaved).toBe(coinsBefore - purseCoins(engine));
  });
});
