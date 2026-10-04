import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { PotionItem } from '../../items/consumables';
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

  it('keeps junk apart from the same item unmarked, and keeps the mark in a save', () => {
    const potion = (id: string) => new PotionItem({ id, name: 'Healing Draught', potionType: 'health', potency: 10, identified: true });
    const marked = potion('p1');
    marked.junk = true;
    expect(canStack(marked, potion('p2'))).toBe(false);
    expect(deserializeItem(serializeItem(marked)).junk).toBe(true);
    expect(deserializeItem(serializeItem(potion('p3'))).junk).toBe(false);
  });
});
