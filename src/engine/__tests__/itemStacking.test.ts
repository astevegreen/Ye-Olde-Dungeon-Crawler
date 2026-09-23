import { describe, it, expect } from 'vitest';
import { ItemFactory } from '../items/factory';
import { Container } from '../items/container';
import { ScrollItem } from '../items/consumables';
import { isStackable, canStack, mergeItemStacks, splitItemStack } from '../items/stacking';
import { CoinItem } from '../economy/currency';

describe('Item Stacking & Multi-Selection Engine', () => {
  it('identifies stackable items vs non-stackables', () => {
    const potion = ItemFactory.createHealthPotion('hp-1');
    const scroll = new ScrollItem({ id: 'sc-1', name: 'Scroll of Teleport', spellId: 'phase_door' });
    const coins = new CoinItem({ id: 'c-1', denomination: 'gold', count: 50 });
    const dagger = ItemFactory.createDagger('w-1');
    const sack = new Container({
      id: 'bag-1',
      name: 'Small Bag',
      category: 'container',
      containerType: 'pack',
      weight: 100,
      bulk: 200,
      maxWeightCapacity: 1000,
      maxBulkCapacity: 1000,
    });

    expect(isStackable(potion)).toBe(true);
    expect(isStackable(scroll)).toBe(true);
    expect(isStackable(coins)).toBe(true);
    expect(isStackable(dagger)).toBe(false);
    expect(isStackable(sack)).toBe(false);
  });

  it('determines whether two items can merge into a stack based on identity and quality', () => {
    const potA = ItemFactory.createHealthPotion('hp-1');
    const potB = ItemFactory.createHealthPotion('hp-2');
    const manaPot = ItemFactory.createManaPotion('mp-1');

    expect(canStack(potA, potB)).toBe(true);
    expect(canStack(potA, manaPot)).toBe(false);

    // Unidentified items cannot stack with identified items
    potA.identified = true;
    potB.identified = false;
    expect(canStack(potA, potB)).toBe(false);

    // Items with different enchantments cannot stack
    potB.identified = true;
    potA.enchantmentLevel = 1;
    potB.enchantmentLevel = 0;
    expect(canStack(potA, potB)).toBe(false);
  });

  it('merges stacks correctly and updates quantity, weight, and bulk', () => {
    const potA = ItemFactory.createHealthPotion('hp-1');
    const potB = ItemFactory.createHealthPotion('hp-2');
    potA.quantity = 2;
    potB.quantity = 3;

    const baseWeight = potA.weight;
    const baseBulk = potA.bulk;

    expect(potA.totalWeight()).toBe(baseWeight * 2);
    expect(potA.totalBulk()).toBe(baseBulk * 2);

    const merged = mergeItemStacks(potA, potB);
    expect(merged).toBe(true);
    expect(potA.quantity).toBe(5);
    expect(potA.totalWeight()).toBe(baseWeight * 5);
    expect(potA.totalBulk()).toBe(baseBulk * 5);
    expect(potA.displayName).toContain('(x5)');
  });

  it('automatically merges stacks when added to a Container', () => {
    const pack = new Container({
      id: 'pack-1',
      name: 'Backpack',
      category: 'container',
      containerType: 'pack',
      weight: 500,
      bulk: 1000,
      maxWeightCapacity: 50000,
      maxBulkCapacity: 50000,
    });
    const pot1 = ItemFactory.createHealthPotion('hp-1');
    const pot2 = ItemFactory.createHealthPotion('hp-2');
    const pot3 = ItemFactory.createHealthPotion('hp-3');

    expect(pack.addItem(pot1)).toBe(true);
    expect(pack.addItem(pot2)).toBe(true);
    expect(pack.addItem(pot3)).toBe(true);

    // Should have only 1 item in container with quantity 3
    const items = pack.getItems();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(3);
    expect(items[0].id).toBe('hp-1');
  });

  it('splits item stacks accurately', () => {
    const pot = ItemFactory.createHealthPotion('hp-main');
    pot.quantity = 10;

    // Split 4 off
    const split = splitItemStack(pot, 4, Math.random);
    expect(split).not.toBeNull();
    expect(pot.quantity).toBe(6);
    expect(split?.quantity).toBe(4);
    expect(split?.id).not.toBe(pot.id);
    expect(split?.name).toBe(pot.name);

    // Splitting 0 or invalid amount throws
    expect(() => splitItemStack(pot, 0, Math.random)).toThrow();
    expect(() => splitItemStack(pot, 10, Math.random)).toThrow();
  });

  describe('coins', () => {
    const purse = () =>
      new Container({
        id: 'purse-1',
        name: 'Purse',
        category: 'container',
        containerType: 'purse',
        weight: 50,
        bulk: 50,
        maxWeightCapacity: 100000,
        maxBulkCapacity: 100000,
      });

    it('merges piles of one denomination into a single stack whatever their counts', () => {
      const bag = purse();
      bag.addItem(new CoinItem({ id: 'g-1', denomination: 'gold', count: 50 }));
      bag.addItem(new CoinItem({ id: 'g-2', denomination: 'gold', count: 30 }));

      const gold = bag.getItems().filter((i) => i instanceof CoinItem) as CoinItem[];
      expect(gold).toHaveLength(1);
      expect(gold[0].count).toBe(80);
      expect(gold[0].name).toBe('80 Gold Pieces');
      expect(gold[0].valueInCp).toBe(8000);
    });

    it('keeps different denominations apart', () => {
      const bag = purse();
      bag.addItem(new CoinItem({ id: 'g-1', denomination: 'gold', count: 5 }));
      bag.addItem(new CoinItem({ id: 's-1', denomination: 'silver', count: 5 }));
      expect(bag.getItems()).toHaveLength(2);
    });
  });
});
