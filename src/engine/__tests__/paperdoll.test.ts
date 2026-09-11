import { describe, it, expect } from 'vitest';
import { Paperdoll } from '../inventory/paperdoll';
import { ItemFactory } from '../items/factory';
import { Item } from '../items/item';

describe('Paperdoll System', () => {
  it('equips armor and weapons, correctly accumulating attack and defense', () => {
    const doll = new Paperdoll();
    expect(doll.calculateStats()).toEqual({
      attackBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      strengthBonus: 0,
    });

    const sword = ItemFactory.createBroadsword('sw-1'); // attackBonus 8
    const shield = ItemFactory.createWoodenShield('sh-1'); // defenseBonus 3
    const chainmail = ItemFactory.createChainmail('cm-1'); // defenseBonus 8
    const helmet = ItemFactory.createIronHelmet('helm-1'); // defenseBonus 3
    const boots = ItemFactory.createBoots('bt-1'); // defenseBonus 1

    expect(doll.equip(sword).success).toBe(true);
    expect(doll.equip(shield).success).toBe(true);
    expect(doll.equip(chainmail).success).toBe(true);
    expect(doll.equip(helmet).success).toBe(true);
    expect(doll.equip(boots).success).toBe(true);

    const stats = doll.calculateStats();
    expect(stats.attackBonus).toBe(8);
    expect(stats.defenseBonus).toBe(15); // 3 + 8 + 3 + 1 = 15
  });

  it('swaps items in slot and returns previously equipped item', () => {
    const doll = new Paperdoll();
    const dagger = ItemFactory.createDagger('dag-1'); // attack 3
    const sword = ItemFactory.createBroadsword('sw-1'); // attack 8

    doll.equip(dagger);
    expect(doll.getItem('mainHand')?.id).toBe('dag-1');

    const swapResult = doll.equip(sword);
    expect(swapResult.success).toBe(true);
    expect(swapResult.unequippedItem?.id).toBe('dag-1');
    expect(doll.getItem('mainHand')?.id).toBe('sw-1');
  });

  it('allows rings to be equipped in left or right finger slot', () => {
    const doll = new Paperdoll();
    const ring1 = new Item({
      id: 'ring-1',
      name: 'Silver Ring',
      category: 'ring',
      weight: 10,
      bulk: 10,
    });
    const ring2 = new Item({
      id: 'ring-2',
      name: 'Gold Ring',
      category: 'ring',
      weight: 15,
      bulk: 10,
    });

    expect(doll.equip(ring1, 'fingerLeft').success).toBe(true);
    expect(doll.equip(ring2, 'fingerRight').success).toBe(true);
    expect(doll.getItem('fingerLeft')?.id).toBe('ring-1');
    expect(doll.getItem('fingerRight')?.id).toBe('ring-2');
  });

  it('prevents unequipping or replacing cursed items', () => {
    const doll = new Paperdoll();
    const cursedMace = ItemFactory.createCursedMace('mace-1');
    const sword = ItemFactory.createBroadsword('sw-1');

    doll.equip(cursedMace);
    expect(doll.getItem('mainHand')?.id).toBe('mace-1');

    // 1. Cannot unequip directly
    const unequipCheck = doll.canUnequip('mainHand');
    expect(unequipCheck.allowed).toBe(false);
    expect(unequipCheck.reason).toContain('cursed');

    const unequipResult = doll.unequip('mainHand');
    expect(unequipResult.success).toBe(false);
    expect(doll.getItem('mainHand')?.id).toBe('mace-1');

    // 2. Cannot replace with another weapon
    const replaceCheck = doll.canEquip(sword);
    expect(replaceCheck.allowed).toBe(false);
    expect(replaceCheck.reason).toContain('cursed');

    const replaceResult = doll.equip(sword);
    expect(replaceResult.success).toBe(false);
    expect(doll.getItem('mainHand')?.id).toBe('mace-1');
  });

  it('calculates total equipped weight', () => {
    const doll = new Paperdoll();
    const sword = ItemFactory.createBroadsword('sw-1'); // 1600g
    const boots = ItemFactory.createBoots('bt-1'); // 1200g

    doll.equip(sword);
    doll.equip(boots);

    expect(doll.totalWeight()).toBe(2800);
  });
});
