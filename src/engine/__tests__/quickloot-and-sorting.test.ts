import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { COTW_MANIFEST } from '../../content/cotw';
import { ItemFactory } from '../items/factory';
import { Container } from '../items/container';
import { QuickLootAction } from '../actions/inventory-actions';
import { serializeSaveData, deserializeSaveData } from '../storage/serializer';

describe('Inventory Friction Reducers: QuickLoot, Sorting, and Coin Consolidation', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const map = GameMap.createBoxRoom(20, 20);
    const player = new Player({
      id: 'test_hero',
      name: 'Valiant',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      speed: 100,
    });
    engine = new GameEngine({ map, player, floor: 1, manifest: COTW_MANIFEST });
    engine.player.setPosition(5, 5);
  });

  it('QuickLootAction picks up multiple ground items in a single action', () => {
    const item1 = ItemFactory.createDagger('dagger-loot-1');
    const item2 = ItemFactory.createBroadsword('sword-loot-2');
    const item3 = ItemFactory.createHealthPotion('potion-loot-3');
    const item4 = ItemFactory.createGoldCoins('gold-loot-4', 25);

    engine.map.addItemAt(5, 5, item1);
    engine.map.addItemAt(5, 5, item2);
    engine.map.addItemAt(5, 5, item3);
    engine.map.addItemAt(5, 5, item4);

    expect(engine.map.getItemsAt(5, 5)).toHaveLength(4);

    const action = new QuickLootAction(engine.player);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    // All 4 items removed from map
    expect(engine.map.getItemsAt(5, 5)).toHaveLength(0);

    // Items are now stored in player inventory
    expect(engine.player.inventory.findItemById(item1.id)).toBeDefined();
    expect(engine.player.inventory.findItemById(item2.id)).toBeDefined();
    expect(engine.player.inventory.findItemById(item3.id)).toBeDefined();
    expect(engine.player.inventory.findItemById(item4.id)).toBeDefined();
  });

  it('QuickLootAction respects container weight/bulk thresholds and leaves excess on floor', () => {
    // Create a player with a tiny pouch container
    const tinyPack = new Container({
      id: 'tiny-pack',
      name: 'Tiny Pouch',
      category: 'container',
      slot: 'pack',
      containerType: 'pack',
      weight: 100,
      bulk: 500,
      maxWeightCapacity: 2000, // 2kg max
      maxBulkCapacity: 3000,
      identified: true,
    });
    engine.player.inventory.primaryPack = tinyPack;

    // Item 1 is 1500g (fits)
    const heavyItem1 = ItemFactory.createBroadsword('heavy-1'); // 1800g
    // Item 2 is 1800g (will exceed 2000g capacity)
    const heavyItem2 = ItemFactory.createBroadsword('heavy-2'); // 1800g

    engine.map.addItemAt(5, 5, heavyItem1);
    engine.map.addItemAt(5, 5, heavyItem2);

    const action = new QuickLootAction(engine.player);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    // 1 item was looted, 1 remaining on ground
    expect(engine.map.getItemsAt(5, 5)).toHaveLength(1);
    expect(engine.map.getItemsAt(5, 5)[0].id).toBe(heavyItem2.id);
  });

  it('Fast Purse Consolidation sweeps loose coins into equipped purse', () => {
    // Equip a leather purse in purse slot
    const purse = ItemFactory.createLeatherPurse('test-purse');
    engine.player.inventory.paperdoll.equip(purse, 'purse');

    // Put coins into primary pack
    const coins1 = ItemFactory.createGoldCoins('gold-stack-1', 10);
    const coins2 = ItemFactory.createCopperCoins('copper-stack-2', 50);
    engine.player.inventory.primaryPack.addItem(coins1);
    engine.player.inventory.primaryPack.addItem(coins2);

    // Also put a subcontainer chest in primary pack with coins inside
    const chest = ItemFactory.createIronChest('test-chest');
    const coins3 = ItemFactory.createSilverCoins('silver-stack-3', 20);
    chest.addItem(coins3);
    engine.player.inventory.primaryPack.addItem(chest);

    expect(purse.itemCount).toBe(0);
    expect(engine.player.inventory.primaryPack.getItems()).toHaveLength(3);

    // Consolidate coins
    const res = engine.player.inventory.consolidateCoins();
    expect(res.count).toBe(3);

    // Verify purse now contains all 3 coin stacks
    expect(purse.itemCount).toBe(3);
    expect(engine.player.inventory.primaryPack.getItems().filter((i) => i.category === 'currency')).toHaveLength(0);
    expect(chest.itemCount).toBe(0);
  });

  it('Container auto-sorting works for Category, Weight, and Bulk', () => {
    const pack = engine.player.inventory.primaryPack;
    // Clear pack
    for (const item of [...pack.getItems()]) {
      pack.removeItem(item.id);
    }

    const dagger = ItemFactory.createDagger('sort-dagger'); // weapon, ~400g
    const armor = ItemFactory.createChainmail('sort-armor'); // armor, ~12000g
    const potion = ItemFactory.createHealthPotion('sort-potion'); // consumable, ~350g
    const scroll = ItemFactory.createScrollOfTeleport('sort-scroll'); // consumable, ~100g

    pack.addItem(potion);
    pack.addItem(armor);
    pack.addItem(dagger);
    pack.addItem(scroll);

    // 1. Sort by Category (Weapons -> Armor -> Consumables)
    pack.sort('category');
    const itemsByCat = pack.getItems();
    expect(itemsByCat[0].category).toBe('weapon');
    expect(itemsByCat[1].category).toBe('armor');
    expect(itemsByCat[2].category).toBe('consumable');
    expect(itemsByCat[3].category).toBe('consumable');

    // 2. Sort by Weight (Heaviest first: Armor -> Dagger -> Potion -> Scroll)
    pack.sort('weight');
    const itemsByWeight = pack.getItems();
    expect(itemsByWeight[0].id).toBe(armor.id);
    expect(itemsByWeight[1].id).toBe(dagger.id);
    expect(itemsByWeight[2].id).toBe(potion.id);
    expect(itemsByWeight[3].id).toBe(scroll.id);

    // 3. Sort by Bulk (Bulkiest first)
    pack.sort('bulk');
    const itemsByBulk = pack.getItems();
    expect(itemsByBulk[0].id).toBe(armor.id);
  });

  it('persists sorted container states cleanly across serialize and deserialize', () => {
    const pack = engine.player.inventory.primaryPack;
    for (const item of [...pack.getItems()]) {
      pack.removeItem(item.id);
    }

    const dagger = ItemFactory.createDagger('persist-dagger');
    const potion = ItemFactory.createHealthPotion('persist-potion');
    pack.addItem(potion);
    pack.addItem(dagger);

    pack.sort('category'); // dagger (weapon) first, then potion (consumable)

    const serialized = serializeSaveData(engine);
    const restored = deserializeSaveData(serialized, COTW_MANIFEST);

    const restoredItems = restored.player.inventory.primaryPack.getItems();
    expect(restoredItems[0].category).toBe('weapon');
    expect(restoredItems[1].category).toBe('consumable');
  });
});
