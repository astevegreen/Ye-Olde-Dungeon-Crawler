import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Item } from '../items/item';
import { ItemFactory } from '../items/factory';
import { ScrollItem, WandItem } from '../items/consumables';
import { itemIndex } from '../items/itemIndex';
import { DrinkPotionAction, ReadScrollAction } from '../actions/spell-actions';
import { EquipAction, DropAction } from '../actions/inventory-actions';
import { addCurrencyToPlayer } from '../economy/currency';
import { cotwManifest } from '../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 5 (items, inventory). Each test reproduces one
 * finding from `.prompts/codebase-review-2026-10-06/areas/05-items-economy.md` and is marked
 * `it.fails` so the suite stays green until the bug is fixed.
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

describe('R-econ-1 · drinking from a stack consumes the whole stack', () => {
  it('one drink from a stack of three leaves two', () => {
    const { player, engine, pack } = build();
    for (const id of ['pot-1', 'pot-2', 'pot-3']) pack.addItem(ItemFactory.createHealthPotion(id));
    expect(packQuantity(pack, (i) => i.id.startsWith('pot'))).toBe(3); // merged to one stack of 3 (passes today)
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

describe('R-econ-3 · wands stack, and the merge drops the added wand’s charges', () => {
  it('an empty and a full Wand of Lightning stay two items', () => {
    const { pack } = build();
    pack.addItem(new WandItem({ id: 'wa', definitionId: 'wand_lightning', name: 'Wand of Lightning', spellId: 'lightning_bolt', charges: 0, maxCharges: 8, identified: true } as never));
    pack.addItem(new WandItem({ id: 'wb', definitionId: 'wand_lightning', name: 'Wand of Lightning', spellId: 'lightning_bolt', charges: 8, maxCharges: 8, identified: true } as never));

    const charges = pack.getItems().filter((i) => i instanceof WandItem).reduce((n, i) => n + (i as WandItem).charges, 0);

    expect(charges).toBe(8);
  });
});

describe('R-econ-4 · equipping a belt over a loaded belt can destroy the old belt and its contents', () => {
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

describe('R-econ-5 · Drop on the Pack slot leaves the pack on the ground and still the hero’s primaryPack', () => {
  it.fails('after a Drop on the pack slot, the hero’s primary pack is not an item on the floor', () => {
    const { map, player, engine, pack } = build();
    pack.addItem(ItemFactory.createDagger('dag-1'));

    new DropAction(player, pack, 'paperdoll', 'pack').perform(engine);

    expect(map.getItemsAt(3, 3)).not.toContain(player.inventory.primaryPack);
  });
});

describe('R-econ-7 · "Sort by value" orders unidentified items by their hidden +N', () => {
  it.fails('two unidentified Heavy Swords keep their order when sorted by value', () => {
    const { engine, pack } = build();
    const mk = (id: string, ench: number, value: number) =>
      new Item({ id, name: 'Steel Broadsword', unidentifiedName: 'Heavy Sword', category: 'weapon', slot: 'mainHand', weight: 1600, bulk: 1200, identified: false, value, baseValue: 15, enchantmentLevel: ench } as never);
    pack.addItem(mk('sword-plain', 0, 15));
    pack.addItem(mk('sword-plus3', 3, Math.round(15 * 2.2)));

    engine.commandBus.dispatch({ type: 'sort_pack', payload: { mode: 'value' } });

    expect(pack.getItems().map((i) => i.id)).toEqual(['sword-plain', 'sword-plus3']);
  });
});

describe('R-econ-13 · minted coin piles share an id, so a merge unregisters the surviving pile', () => {
  it.fails('every purse pile is still in the item index after two payments', () => {
    const { player } = build();
    player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
    addCurrencyToPlayer(player, 250);
    addCurrencyToPlayer(player, 250);

    const piles = player.inventory.purse!.getItems();
    expect(piles.length).toBeGreaterThan(0); // (passes today)
    expect(piles.every((p) => itemIndex.has(p.id))).toBe(true);
  });
});
