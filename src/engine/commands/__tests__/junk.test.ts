import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { PotionItem } from '../../items/consumables';
import { Container } from '../../items/container';
import { canStack } from '../../items/stacking';
import { Merchant, getItemSellPrice } from '../../economy/merchant';
import { getPlayerTotalCp } from '../../economy/currency';
import { serializeItem, deserializeItem } from '../../storage/serializer';

/** Q2 "C" (tracker 2.5): the hero marks junk, and any shop buys all of it at once. */
function setup() {
  const engine = new GameEngine({ map: new GameMap(20, 20, TILES.FLOOR), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
  const merchant = new Merchant('m', 'Olaf', "Olaf's", 'general', 'Hail.', []);
  const sword = (id: string) => new Item({ id, name: 'Old Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, identified: true, value: 40 });
  return { engine, merchant, sword };
}

describe('junk (tracker 2.5)', () => {
  it('mark_junk toggles the mark on an item the hero carries', () => {
    const { engine, sword } = setup();
    const item = sword('s1');
    engine.player.inventory.primaryPack.addItem(item);
    expect(item.junk).toBe(false);
    expect(engine.commandBus.dispatch({ type: 'mark_junk', payload: { itemId: 's1' } }).success).toBe(true);
    expect(item.junk).toBe(true);
    engine.commandBus.dispatch({ type: 'mark_junk', payload: { itemId: 's1' } });
    expect(item.junk).toBe(false);
  });

  it('sell_junk sells every marked item in the pack, and only those', () => {
    const { engine, merchant, sword } = setup();
    const pack = engine.player.inventory.primaryPack;
    const a = sword('a');
    const b = sword('b');
    const keep = sword('keep');
    for (const item of [a, b, keep]) pack.addItem(item);
    a.junk = true;
    b.junk = true;
    const before = getPlayerTotalCp(engine.player);
    const res = engine.commandBus.dispatch({ type: 'sell_junk', payload: { merchant } });
    expect(res.success).toBe(true);
    expect(res.message).toContain('2');
    expect(pack.getItem('a')).toBeFalsy();
    expect(pack.getItem('b')).toBeFalsy();
    expect(pack.getItem('keep')).toBe(keep);
    expect(getPlayerTotalCp(engine.player) - before).toBe(getItemSellPrice(keep) * 2);
    // On the merchant's shelf it is no longer anyone's junk.
    expect(merchant.stock.find((i) => i.id === 'a')?.junk).toBe(false);
  });

  it('sell_junk with nothing marked says so and sells nothing', () => {
    const { engine, merchant, sword } = setup();
    engine.player.inventory.primaryPack.addItem(sword('x'));
    const res = engine.commandBus.dispatch({ type: 'sell_junk', payload: { merchant } });
    expect(res.success).toBe(false);
    expect(engine.player.inventory.primaryPack.getItem('x')).toBeTruthy();
  });

  const belt = (id: string) =>
    new Container({
      id,
      name: 'Spare Belt',
      category: 'container',
      slot: 'belt',
      containerType: 'belt',
      weight: 300,
      bulk: 300,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 5000,
      identified: true,
      value: 30,
    });

  it('refuses to mark a container that is not empty, and says why (R-econ-19)', () => {
    const { engine } = setup();
    const full = belt('belt-full');
    full.addItem(new PotionItem({ id: 'p-in', name: 'Healing Draught', potionType: 'health', potency: 10, identified: true }));
    engine.player.inventory.primaryPack.addItem(full);
    const res = engine.commandBus.dispatch({ type: 'mark_junk', payload: { itemId: 'belt-full' } });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Empty the Spare Belt/);
    expect(full.junk).toBe(false);

    const empty = belt('belt-empty');
    engine.player.inventory.primaryPack.addItem(empty);
    expect(engine.commandBus.dispatch({ type: 'mark_junk', payload: { itemId: 'belt-empty' } }).success).toBe(true);
    expect(empty.junk).toBe(true);
  });

  it('sell_junk keeps a junk container that has since been filled, with its contents, and says why (R-econ-19)', () => {
    const { engine, merchant, sword } = setup();
    const pack = engine.player.inventory.primaryPack;
    const marked = belt('belt-1');
    pack.addItem(marked);
    marked.junk = true;
    marked.addItem(new PotionItem({ id: 'p-kept', name: 'Healing Draught', potionType: 'health', potency: 10, identified: true }));
    const old = sword('old');
    pack.addItem(old);
    old.junk = true;

    const res = engine.commandBus.dispatch({ type: 'sell_junk', payload: { merchant } });
    expect(res.success).toBe(true);
    expect(pack.getItem('old')).toBeFalsy();
    expect(pack.getItem('belt-1')).toBe(marked);
    expect(marked.getItems().map((i) => i.id)).toEqual(['p-kept']);
    expect(merchant.stock.some((i) => i.id === 'belt-1')).toBe(false);
    expect(res.message).toMatch(/Spare Belt is not empty/);
  });

  it('sell_item refuses a container that is not empty, and says to empty it first', () => {
    const { engine, merchant } = setup();
    const pack = engine.player.inventory.primaryPack;
    const full = belt('belt-full');
    full.addItem(new PotionItem({ id: 'p-in', name: 'Healing Draught', potionType: 'health', potency: 10, identified: true }));
    pack.addItem(full);
    const before = getPlayerTotalCp(engine.player);

    const res = engine.commandBus.dispatch({ type: 'sell_item', payload: { merchant, item: full } });
    expect(res.success).toBe(false);
    expect(res.message).toBe('Empty the Spare Belt before selling it.');
    expect(pack.getItem('belt-full')).toBe(full);
    expect(full.getItems().map((i) => i.id)).toEqual(['p-in']);
    expect(merchant.stock.some((i) => i.id === 'belt-full')).toBe(false);
    expect(getPlayerTotalCp(engine.player)).toBe(before);

    const empty = belt('belt-empty');
    pack.addItem(empty);
    expect(engine.commandBus.dispatch({ type: 'sell_item', payload: { merchant, item: empty } }).success).toBe(true);
    expect(pack.getItem('belt-empty')).toBeFalsy();
  });

  it('keeps junk apart from the same item unmarked, and keeps the mark in a save', () => {
    const potion = (id: string) => new PotionItem({ id, name: 'Healing Draught', potionType: 'health', potency: 10, identified: true });
    const marked = potion('p1');
    marked.junk = true;
    expect(canStack(marked, potion('p2'))).toBe(false);
    expect(deserializeItem(serializeItem(marked)).junk).toBe(true);
    expect(deserializeItem(serializeItem(potion('p3'))).junk).toBe(false);
  });
});
