import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Container } from '../items/container';
import { PotionItem } from '../items/consumables';
import { RuneOfReturnItem, findRuneOfReturn } from '../magic/runeOfReturn';

/**
 * Whole-codebase review, 2026-10-06: inventory lookups (prior-audit item R-prior-2 and
 * area 5). Each test is marked `it.fails` so the suite stays green until the bug is fixed.
 */

describe('R-prior-2 · InventoryManager.findItemById looks one level into the pack while getAllCarriedItems recurses', () => {
  it('a potion inside a belt carried in the pack is found by id, as the potion row lists it', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
    const belt = new Container({
      id: 'belt-1',
      name: 'Spare Belt',
      category: 'container',
      containerType: 'belt',
      weight: 300,
      bulk: 400,
      maxWeightCapacity: 3000,
      maxBulkCapacity: 2000,
    } as never);
    const potion = new PotionItem({ id: 'pot-1', name: 'Healing Draught', potionType: 'health', potency: 1, identified: true });
    belt.addItem(potion);
    player.inventory.primaryPack.addItem(belt);

    const listed = player.inventory.getAllCarriedItems().map((i) => i.id);
    expect(listed).toContain('pot-1'); // the potion row sees it (passes today)
    expect(player.inventory.findItemById('pot-1')).toBe(potion); // but the lookup the row dispatches with does not
  });
});

describe('R-econ-14 · a dormant Rune of Return carried in a belt survives its awakening and is found first', () => {
  it('once awakened, the rune the hero channels is the innate one, charged, whatever husk is still carried', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
    const belt = new Container({ id: 'belt-1', name: 'Spare Belt', category: 'container', containerType: 'belt', weight: 300, bulk: 400, maxWeightCapacity: 3000, maxBulkCapacity: 2000 } as never);
    const rune = new RuneOfReturnItem({ id: 'rune-found', name: 'Rune of Return', charges: 0 });
    belt.addItem(rune);
    player.inventory.primaryPack.addItem(belt);
    expect(findRuneOfReturn(player)).toBe(rune); // dormant: the carried rune (passes today)

    engine.absorbRuneOfReturn(rune);

    const found = findRuneOfReturn(player);
    expect(found).not.toBe(rune);
    expect(found?.charges).toBe(3);
  });

  it('a potion in a bag in the pack is removed by id, as it is found', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
    const bag = new Container({ id: 'bag-1', name: 'Sack', category: 'container', containerType: 'bag', weight: 300, bulk: 400, maxWeightCapacity: 3000, maxBulkCapacity: 2000 } as never);
    const potion = new PotionItem({ id: 'pot-1', name: 'Healing Draught', potionType: 'health', potency: 1, identified: true });
    bag.addItem(potion);
    player.inventory.primaryPack.addItem(bag);

    expect(player.inventory.removeItem('pot-1')).toBe(potion);
    expect(bag.getItems()).toHaveLength(0);
    expect(potion.parentId).toBeNull();
  });
});
