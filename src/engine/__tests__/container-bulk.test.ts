import { describe, it, expect } from 'vitest';
import { Container } from '../items/container';
import { Item } from '../items/item';

describe('Container Bulk Bubbling & Ancestry Capacity', () => {
  it('bubbles bulk upward through nested container ancestry chain', () => {
    // Outer backpack: capacity 5,000 bulk
    const backpack = new Container({
      id: 'pack-main',
      name: 'Backpack',
      category: 'container',
      containerType: 'pack',
      weight: 1000,
      bulk: 1000,
      maxWeightCapacity: 20000,
      maxBulkCapacity: 5000,
    });

    // Inner pouch: capacity 3,000 bulk, base bulk 300
    const pouch = new Container({
      id: 'belt-pouch',
      name: 'Pouch',
      category: 'container',
      containerType: 'pack',
      weight: 200,
      bulk: 300,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 3000,
    });

    backpack.addItem(pouch);
    expect(pouch.parent).toBe(backpack);

    // Initial bulk in backpack should include pouch's total bulk (base bulk 300 + 0 contained)
    expect(pouch.totalBulk()).toBe(300);
    expect(backpack.containedBulk()).toBe(300);

    // Add 1,000 bulk gem into pouch
    const gem1 = new Item({
      id: 'gem-1',
      name: 'Diamond',
      category: 'misc',
      weight: 100,
      bulk: 1000,
      quality: 'normal',
    });

    expect(pouch.canContain(gem1).allowed).toBe(true);
    const added1 = pouch.addItem(gem1);
    expect(added1).toBe(true);
    expect(gem1.parent).toBe(pouch);

    // Pouch contained bulk = 1,000; total bulk = 1,300
    expect(pouch.containedBulk()).toBe(1000);
    expect(pouch.totalBulk()).toBe(1300);

    // Backpack contained bulk reflects pouch totalBulk
    expect(backpack.containedBulk()).toBe(1300);
  });

  it('rejects adding item into inner container if outer parent bulk capacity would be exceeded', () => {
    // Outer pack has small capacity: 1,500 max bulk
    const backpack = new Container({
      id: 'small-pack',
      name: 'Small Pack',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 500,
      maxWeightCapacity: 10000,
      maxBulkCapacity: 1500,
    });

    // Pouch inside has high capacity (2,000), but backpack only has 1,500 total!
    const pouch = new Container({
      id: 'magic-pouch',
      name: 'Magic Pouch',
      category: 'container',
      containerType: 'pack',
      weight: 100,
      bulk: 200,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 2000,
    });

    backpack.addItem(pouch);
    // Pouch currently occupies 200 bulk in backpack. Remaining space in backpack = 1,300.

    // A large item of 1,400 bulk fits in pouch (1400 <= 2000), but exceeds backpack (200 + 1400 = 1600 > 1500)
    const largeStatue = new Item({
      id: 'statue-1',
      name: 'Golden Idol',
      category: 'misc',
      weight: 1000,
      bulk: 1400,
      quality: 'enchanted',
    });

    expect(pouch.canContain(largeStatue).allowed).toBe(false);
    expect(pouch.addItem(largeStatue)).toBe(false);
    expect(pouch.getItem('statue-1')).toBeNull();
  });

  it('rigid chest maintains fixed outer bulk and does not bubble internal delta bulk to outer parent', () => {
    // Room/Vault container
    const vault = new Container({
      id: 'vault-room',
      name: 'Treasure Vault',
      category: 'container',
      containerType: 'chest',
      weight: 10000,
      bulk: 10000,
      maxWeightCapacity: 100000,
      maxBulkCapacity: 10000,
    });

    // Rigid iron chest: fixed external bulk of 4,000
    const ironChest = new Container({
      id: 'iron-chest',
      name: 'Iron Chest',
      category: 'container',
      containerType: 'chest',
      weight: 5000,
      bulk: 4000,
      maxWeightCapacity: 50000,
      maxBulkCapacity: 4000,
    });

    vault.addItem(ironChest);
    expect(ironChest.parent).toBe(vault);

    // Initial total bulk of chest inside vault is 4,000
    expect(ironChest.totalBulk()).toBe(4000);
    expect(vault.containedBulk()).toBe(4000);

    // Add heavy bullion into chest
    const goldBar = new Item({
      id: 'gold-bar',
      name: 'Heavy Gold Bar',
      category: 'misc',
      weight: 10000,
      bulk: 2500,
      quality: 'normal',
    });

    // Fits inside iron chest
    expect(ironChest.canContain(goldBar).allowed).toBe(true);
    ironChest.addItem(goldBar);

    // Internal contained bulk of chest increases
    expect(ironChest.containedBulk()).toBe(2500);

    // BUT chest's outer total bulk remains fixed at 4,000!
    expect(ironChest.totalBulk()).toBe(4000);
    // Vault contained bulk also remains 4,000!
    expect(vault.containedBulk()).toBe(4000);
  });

  it('properly resets parent pointer when items are removed', () => {
    const pack = new Container({
      id: 'pack-1',
      name: 'Pack',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 500,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 5000,
    });

    const item = new Item({
      id: 'dagger-1',
      name: 'Dagger',
      category: 'weapon',
      weight: 300,
      bulk: 200,
      quality: 'normal',
    });

    pack.addItem(item);
    expect(item.parent).toBe(pack);

    const removed = pack.removeItem('dagger-1');
    expect(removed).toBe(item);
    expect(item.parent).toBeNull();
  });
});
