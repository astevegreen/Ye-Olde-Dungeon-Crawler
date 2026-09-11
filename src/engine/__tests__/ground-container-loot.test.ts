import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { PickUpAction, QuickLootAction } from '../actions/inventory-actions';
import { InputHandler } from '../../rendering/input-handler';
import { InventoryOverlay } from '../../rendering/inventory-overlay';

describe('Ground Container Nested Looting & Modal Pause', () => {
  function setup() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'p1',
      name: 'Freya',
      position: { x: 3, y: 3 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    player.energy = 100;
    const engine = new GameEngine({ map, player });
    return { engine, map, player };
  }

  it('PickUpAction loots the top item from a heavy ground container that exceeds pack bulk', () => {
    const { engine, map, player } = setup();

    // Create a heavy chest (bulk 35000) which cannot fit into the 25000 backpack
    const chest = new Container({
      id: 'heavy-chest-1',
      name: 'Ironbound Wooden Chest',
      category: 'container',
      weight: 12000,
      bulk: 35000,
      maxBulkCapacity: 35000,
      maxWeightCapacity: 50000,
      containerType: 'chest',
    });

    const ruby = new Item({
      id: 'ruby-1',
      name: 'Glowing Ruby',
      category: 'gem',
      weight: 50,
      bulk: 100,
    });

    const dagger = new Item({
      id: 'dagger-1',
      name: 'Iron Dagger',
      category: 'weapon',
      weight: 400,
      bulk: 500,
    });

    chest.addItem(ruby);
    chest.addItem(dagger);
    map.addItemAt(player.x, player.y, chest);

    // Player attempts to pick up the item on the tile (the chest)
    const action = new PickUpAction(player);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Took Glowing Ruby from Ironbound Wooden Chest');
    // Glowing Ruby is now in player's backpack
    expect(player.inventory.primaryPack.hasItem('ruby-1')).toBe(true);
    // Chest is still on the ground
    expect(map.getItemsAt(player.x, player.y)).toContain(chest);
    // Chest still contains the remaining dagger
    expect(chest.hasItem('dagger-1')).toBe(true);
    expect(chest.hasItem('ruby-1')).toBe(false);
  });

  it('QuickLootAction extracts all items from a ground container leaving the heavy chest behind', () => {
    const { engine, map, player } = setup();

    const chest = new Container({
      id: 'heavy-chest-2',
      name: 'Ironbound Wooden Chest',
      category: 'container',
      weight: 12000,
      bulk: 35000,
      maxBulkCapacity: 35000,
      maxWeightCapacity: 50000,
      containerType: 'chest',
    });

    const gem = new Item({
      id: 'sapphire-1',
      name: 'Blue Sapphire',
      category: 'gem',
      weight: 50,
      bulk: 100,
    });

    const scroll = new Item({
      id: 'scroll-1',
      name: 'Scroll of Identify',
      category: 'scroll',
      weight: 50,
      bulk: 100,
    });

    chest.addItem(gem);
    chest.addItem(scroll);
    map.addItemAt(player.x, player.y, chest);

    const quickLoot = new QuickLootAction(player);
    const result = quickLoot.perform(engine);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Blue Sapphire');
    expect(result.message).toContain('Scroll of Identify');

    // Both items are in player inventory
    expect(player.inventory.primaryPack.hasItem('sapphire-1')).toBe(true);
    expect(player.inventory.primaryPack.hasItem('scroll-1')).toBe(true);

    // Chest is empty and still on the ground
    expect(chest.getItems().length).toBe(0);
    expect(map.getItemsAt(player.x, player.y)).toContain(chest);
  });

  it('QuickLootAction safely restores contained item if backpack bulk is exceeded', () => {
    const { engine, map, player } = setup();

    // Fill player backpack to near capacity (capacity is 25000)
    const filler = new Item({
      id: 'filler-rock',
      name: 'Enormous Boulder',
      category: 'misc',
      weight: 1000,
      bulk: 24900,
    });
    player.inventory.primaryPack.addItem(filler);

    const chest = new Container({
      id: 'chest-small',
      name: 'Chest',
      category: 'container',
      weight: 5000,
      bulk: 30000,
      maxBulkCapacity: 20000,
      maxWeightCapacity: 50000,
      containerType: 'chest',
    });

    // Sub item that fits remaining 100 bulk
    const tinyRing = new Item({
      id: 'ring-1',
      name: 'Gold Ring',
      category: 'ring',
      weight: 10,
      bulk: 50,
    });

    // Sub item that does NOT fit (requires 5000 bulk, but only 100 remaining)
    const heavyPlate = new Item({
      id: 'plate-1',
      name: 'Iron Breastplate',
      category: 'armor',
      weight: 5000,
      bulk: 5000,
    });

    chest.addItem(tinyRing);
    chest.addItem(heavyPlate);
    map.addItemAt(player.x, player.y, chest);

    const quickLoot = new QuickLootAction(player);
    const result = quickLoot.perform(engine);

    expect(result.success).toBe(true);
    // tinyRing was successfully looted
    expect(player.inventory.primaryPack.hasItem('ring-1')).toBe(true);
    // heavyPlate could not fit, so it was safely placed back into chest
    expect(chest.hasItem('plate-1')).toBe(true);
  });

  it('InputHandler modalStack synchronizes engine.isPaused with inventory overlay lifecycle', () => {
    const { engine } = setup();
    const inventoryOverlay = new InventoryOverlay();
    let actionProcessed = false;
    const inputHandler = new InputHandler(
      engine,
      () => { actionProcessed = true; },
      inventoryOverlay
    );

    expect(engine.isPaused).toBe(false);

    // Toggle inventory open via inputHandler
    inputHandler.toggleInventory();
    expect(inventoryOverlay.isOpen).toBe(true);
    expect(engine.isPaused).toBe(true);

    // Toggle inventory closed via inputHandler
    inputHandler.toggleInventory();
    expect(inventoryOverlay.isOpen).toBe(false);
    expect(engine.isPaused).toBe(false);

    // Open again, then close via inventoryOverlay.close() directly (simulating canvas close button [X])
    inputHandler.toggleInventory();
    expect(inventoryOverlay.isOpen).toBe(true);
    expect(engine.isPaused).toBe(true);

    inventoryOverlay.close();
    expect(inventoryOverlay.isOpen).toBe(false);
    expect(engine.isPaused).toBe(false);
    expect(actionProcessed).toBe(true);

    inputHandler.destroy();
  });
});
