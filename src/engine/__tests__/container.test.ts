import { describe, it, expect } from 'vitest';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { ItemFactory } from '../items/factory';

describe('Container System', () => {
  it('calculates recursive total weight accurately', () => {
    const pack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      containerType: 'pack',
      weight: 1000,
      bulk: 2000,
      maxWeightCapacity: 20000,
      maxBulkCapacity: 15000,
    });

    const pouch = new Container({
      id: 'pouch-1',
      name: 'Pouch',
      category: 'container',
      containerType: 'pack',
      weight: 200,
      bulk: 400,
      maxWeightCapacity: 3000,
      maxBulkCapacity: 2000,
    });

    const dagger = ItemFactory.createDagger('dag-1'); // weight 450g, bulk 250cm³
    pouch.addItem(dagger);
    expect(pouch.containedWeight()).toBe(450);
    expect(pouch.totalWeight()).toBe(650);

    const sword = ItemFactory.createBroadsword('sw-1'); // weight 1600g, bulk 1200cm³
    pack.addItem(sword);
    pack.addItem(pouch);

    // Total weight = pack (1000) + sword (1600) + pouch (200) + dagger (450) = 3250g
    expect(pack.totalWeight()).toBe(3250);
  });

  it('handles rigid chest bulk vs expandable pack bulk correctly', () => {
    const chest = ItemFactory.createIronChest('chest-1');
    // Chest empty bulk = 18000, maxBulkCapacity = 18000
    expect(chest.totalBulk()).toBe(18000);

    const sword = ItemFactory.createBroadsword('sw-1');
    chest.addItem(sword);
    // Rigid chest bulk remains fixed at 18000
    expect(chest.totalBulk()).toBe(18000);

    const pack = new Container({
      id: 'pack-test',
      name: 'Leather Bag',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 1000,
      maxWeightCapacity: 10000,
      maxBulkCapacity: 8000,
    });

    // Expandable pack bulk = empty bulk (1000) + contained items (0) = 1000
    expect(pack.totalBulk()).toBe(1000);

    pack.addItem(sword); // bulk 1200
    // Expandable pack bulk = 1000 + 1200 = 2200
    expect(pack.totalBulk()).toBe(2200);
  });

  it('enforces weight and bulk capacity limits', () => {
    const smallPouch = new Container({
      id: 'small-pouch',
      name: 'Small Pouch',
      category: 'container',
      containerType: 'pack',
      weight: 100,
      bulk: 200,
      maxWeightCapacity: 1000, // 1kg
      maxBulkCapacity: 800,
    });

    const heavyItem = new Item({
      id: 'heavy-rock',
      name: 'Heavy Rock',
      category: 'misc',
      weight: 1500, // 1.5kg > 1kg
      bulk: 300,
    });

    const bulkyItem = new Item({
      id: 'bulky-hay',
      name: 'Hay',
      category: 'misc',
      weight: 200,
      bulk: 1000, // 1000 > 800
    });

    const canHoldHeavy = smallPouch.canContain(heavyItem);
    expect(canHoldHeavy.allowed).toBe(false);
    expect(smallPouch.addItem(heavyItem)).toBe(false);

    const canHoldBulky = smallPouch.canContain(bulkyItem);
    expect(canHoldBulky.allowed).toBe(false);
    expect(smallPouch.addItem(bulkyItem)).toBe(false);
  });

  it('enforces slot count limits for utility belts', () => {
    const belt = ItemFactory.createUtilityBelt('belt-1'); // maxSlots: 6
    expect(belt.maxSlots).toBe(6);

    for (let i = 0; i < 6; i++) {
      const item = ItemFactory.createDagger(`dag-${i}`);
      expect(belt.addItem(item)).toBe(true);
    }

    const seventhItem = ItemFactory.createDagger('dag-overflow');
    const check = belt.canContain(seventhItem);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('slot capacity');
    expect(belt.addItem(seventhItem)).toBe(false);
  });

  it('enforces category filtering for coin purses', () => {
    const purse = ItemFactory.createCoinPurse('purse-1'); // accepts 'currency' only
    const coin = new Item({
      id: 'coins-1',
      name: 'Gold Coins',
      category: 'currency',
      weight: 100,
      bulk: 50,
    });
    const dagger = ItemFactory.createDagger('dag-1');

    expect(purse.addItem(coin)).toBe(true);
    const daggerCheck = purse.canContain(dagger);
    expect(daggerCheck.allowed).toBe(false);
    expect(purse.addItem(dagger)).toBe(false);
  });

  it('prevents circular container nesting', () => {
    const bagA = new Container({
      id: 'bag-a',
      name: 'Bag A',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 1000,
      maxWeightCapacity: 10000,
      maxBulkCapacity: 8000,
    });

    const bagB = new Container({
      id: 'bag-b',
      name: 'Bag B',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 1000,
      maxWeightCapacity: 10000,
      maxBulkCapacity: 8000,
    });

    // Cannot put bagA into bagA
    expect(bagA.canContain(bagA).allowed).toBe(false);

    // Put bagB into bagA
    expect(bagA.addItem(bagB)).toBe(true);

    // Now try to put bagA into bagB -> circular reference
    expect(bagB.canContain(bagA).allowed).toBe(false);
    expect(bagB.addItem(bagA)).toBe(false);
  });
});
