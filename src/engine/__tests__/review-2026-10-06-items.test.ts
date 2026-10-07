import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Item } from '../items/item';
import { ItemFactory } from '../items/factory';
import { PotionItem, ScrollItem, WandItem } from '../items/consumables';
import { itemIndex } from '../items/itemIndex';
import { DrinkPotionAction, ReadScrollAction } from '../actions/spell-actions';
import { EquipAction, DropAction } from '../actions/inventory-actions';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../economy/currency';
import { cotwManifest } from '../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 5 (items, inventory): regression guards for the
 * findings fixed since. R-econ-1: a drink or a read from a stack uses one unit. R-econ-3: two
 * wands of a kind stay two items, each with its own charges. R-econ-4: equipping a belt over
 * a loaded one never destroys the old belt. R-econ-5: Drop on the Pack slot never leaves the
 * hero's primary pack on the ground, and a dropped purse hands its coins back first.
 * R-econ-7: "Sort by value" never orders unidentified items by their hidden +N. R-econ-13:
 * every minted coin pile stays in the item index after a merge. R-econ-11: `split_stack`
 * loses no unit, and the split pile weighs and fills what one unit of its stack does.
 */

function build() {
  const map = GameMap.createBoxRoom(10, 10);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, strength: 40 });
  const engine = new GameEngine({ map, player, seed: 7 });
  player.gainEnergy(1000);
  return { map, player, engine, pack: player.inventory.primaryPack };
}

const packQuantity = (pack: { getItems(): readonly Item[] }, pred: (i: Item) => boolean) =>
  pack.getItems().filter(pred).reduce((n, i) => n + (i.quantity ?? 1), 0);

describe('R-econ-1 · drinking or reading from a stack consumes one unit', () => {
  it('one drink from a stack of three leaves two', () => {
    const { player, engine, pack } = build();
    for (const id of ['pot-1', 'pot-2', 'pot-3']) pack.addItem(ItemFactory.createHealthPotion(id));
    expect(packQuantity(pack, (i) => i.id.startsWith('pot'))).toBe(3); // merged to one stack of 3
    player.hp = 5;

    new DrinkPotionAction(player, pack.getItems()[0] as never).perform(engine);

    expect(packQuantity(pack, (i) => i.id.startsWith('pot'))).toBe(2);
  });

  it('one read from a stack of two Scrolls of Identify leaves one', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, strength: 40 });
    const engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player, seed: 7, manifest: cotwManifest });
    const pack = player.inventory.primaryPack;
    for (const id of ['scr-1', 'scr-2']) pack.addItem(new ScrollItem({ id, name: 'Scroll of Identify', spellId: 'identify', identified: true }));
    pack.addItem(new Item({ id: 'ring', name: 'Ring', category: 'ring', identified: false, weight: 10, bulk: 5 } as never));
    expect(packQuantity(pack, (i) => i.id.startsWith('scr'))).toBe(2);

    const res = new ReadScrollAction(player, pack.getItems()[0] as never).perform(engine);

    expect(res.success).toBe(true);
    expect(packQuantity(pack, (i) => i.id.startsWith('scr'))).toBe(1);
  });
});

describe('R-econ-3 · wands don’t stack, so no merge drops a wand’s charges', () => {
  it('an empty and a full Wand of Lightning stay two items', () => {
    const { pack } = build();
    pack.addItem(new WandItem({ id: 'wa', definitionId: 'wand_lightning', name: 'Wand of Lightning', spellId: 'lightning_bolt', charges: 0, maxCharges: 8, identified: true } as never));
    pack.addItem(new WandItem({ id: 'wb', definitionId: 'wand_lightning', name: 'Wand of Lightning', spellId: 'lightning_bolt', charges: 8, maxCharges: 8, identified: true } as never));

    const charges = pack.getItems().filter((i) => i instanceof WandItem).reduce((n, i) => n + (i as WandItem).charges, 0);

    expect(charges).toBe(8);
  });
});

describe('R-econ-4 · equipping a belt over a loaded belt never destroys the old belt or its contents', () => {
  it('the displaced belt is still carried, or the swap is refused', () => {
    const { player, engine, pack } = build();
    const inv = player.inventory;
    const beltA = ItemFactory.createUtilityBelt('belt-A');
    inv.paperdoll.equip(beltA, 'waist');
    for (let i = 0; i < 4; i++) beltA.addItem(ItemFactory.createTorch(`torch-${i}`));
    pack.addItem(ItemFactory.createUtilityBelt('belt-B'));
    pack.addItem(ItemFactory.createPlateArmor('plate'));
    pack.addItem(ItemFactory.createLeatherArmor('leather'));

    const r = new EquipAction(player, 'belt-B').perform(engine);

    const stillCarried = inv.getAllCarriedItems().some((i) => i.id === 'belt-A');
    expect(!r.success || stillCarried).toBe(true);
  });

  it('with room in the pack, the swap goes through and the old belt keeps its torches', () => {
    const { player, engine, pack } = build();
    const inv = player.inventory;
    const beltA = ItemFactory.createUtilityBelt('belt-A');
    inv.paperdoll.equip(beltA, 'waist');
    for (let i = 0; i < 4; i++) beltA.addItem(ItemFactory.createTorch(`torch-${i}`));
    pack.addItem(ItemFactory.createUtilityBelt('belt-B'));

    const r = new EquipAction(player, 'belt-B').perform(engine);

    expect(r.success).toBe(true);
    expect(pack.getItem('belt-A')).toBe(beltA);
    expect((beltA as unknown as { getItems(): Item[] }).getItems()).toHaveLength(4);
  });
});

describe('R-econ-5 · Drop on the Pack slot never leaves the hero’s primaryPack on the ground', () => {
  it('after a Drop on the pack slot, the hero’s primary pack is not an item on the floor', () => {
    const { map, player, engine, pack } = build();
    pack.addItem(ItemFactory.createDagger('dag-1'));

    new DropAction(player, pack, 'paperdoll', 'pack').perform(engine);

    expect(map.getItemsAt(3, 3)).not.toContain(player.inventory.primaryPack);
  });

  it('a dropped purse hands its coins back first: the hero keeps every coin', () => {
    const { map, player, engine } = build();
    const purse = ItemFactory.createCoinPurse('purse');
    player.inventory.paperdoll.equip(purse, 'purse');
    addCurrencyToPlayer(player, 250);
    const before = getPlayerTotalCp(player);
    expect(purse.getItems().length).toBeGreaterThan(0);

    const r = new DropAction(player, purse, 'paperdoll', 'purse').perform(engine);

    expect(r.success).toBe(true);
    expect(map.getItemsAt(3, 3)).toContain(purse);
    expect(purse.getItems()).toHaveLength(0);
    expect(getPlayerTotalCp(player)).toBe(before);
  });
});

describe('R-econ-7 · "Sort by value" never orders unidentified items by their hidden +N', () => {
  it('two unidentified Heavy Swords keep their order when sorted by value', () => {
    const { engine, pack } = build();
    const mk = (id: string, ench: number, value: number) =>
      new Item({ id, name: 'Steel Broadsword', unidentifiedName: 'Heavy Sword', category: 'weapon', slot: 'mainHand', weight: 1600, bulk: 1200, identified: false, value, baseValue: 15, enchantmentLevel: ench } as never);
    pack.addItem(mk('sword-plain', 0, 15));
    pack.addItem(mk('sword-plus3', 3, Math.round(15 * 2.2)));

    engine.commandBus.dispatch({ type: 'sort_pack', payload: { mode: 'value' } });

    expect(pack.getItems().map((i) => i.id)).toEqual(['sword-plain', 'sword-plus3']);
  });
});

describe('R-econ-13 · minted coin piles have their own ids, so a merge keeps the surviving pile registered', () => {
  it('every purse pile is still in the item index after two payments', () => {
    const { player } = build();
    player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
    addCurrencyToPlayer(player, 250);
    addCurrencyToPlayer(player, 250);

    const piles = player.inventory.purse!.getItems();
    expect(piles.length).toBeGreaterThan(0);
    expect(piles.every((p) => itemIndex.has(p.id))).toBe(true);
  });
});

describe('R-econ-11 · split_stack never destroys a unit, and its clone keeps the stack’s weight and bulk', () => {
  const flasks = (id: string, quantity: number) =>
    new PotionItem({ id, definitionId: 'flask', name: 'Hearth-Broth Flask', potionType: 'health', potency: 10, weight: 250, bulk: 150, identified: true, quantity, hooks: [] });

  it('the split flask weighs and fills what one flask of the stack does', () => {
    const { engine, pack } = build();
    pack.addItem(flasks('flask-a', 4));

    const res = engine.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'flask-a', amount: 1 } });

    expect(res.success).toBe(true);
    const split = (res.data as { splitItem: Item }).splitItem;
    expect([split.totalWeight(), split.totalBulk()]).toEqual([250, 150]);
    expect(packQuantity(pack, (i) => i.id.startsWith('flask'))).toBe(4);
  });

  it('a split with no room for a new pile leaves the stack whole', () => {
    const { player, engine } = build();
    const belt = ItemFactory.createUtilityBelt('belt');
    player.inventory.paperdoll.equip(belt, 'waist');
    belt.addItem(flasks('flask-a', 4));
    for (let i = 0; belt.getItems().length < (belt.maxSlots ?? 0); i++) belt.addItem(ItemFactory.createTorch(`torch-${i}`), false);

    const res = engine.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'flask-a', amount: 1, container: belt } });

    expect(res.success).toBe(false);
    expect(belt.getItem('flask-a')?.quantity).toBe(4);
  });

  it('a fractional amount is refused', () => {
    const { engine, pack } = build();
    pack.addItem(flasks('flask-a', 4));

    expect(engine.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'flask-a', amount: 1.5 } }).success).toBe(false);
    expect(pack.getItem('flask-a')?.quantity).toBe(4);
  });
});
