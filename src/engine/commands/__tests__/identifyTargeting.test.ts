import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { ScrollItem } from '../../items/consumables';
import { cotwManifest } from '../../../content/cotw';

function unidentified(id: string): Item {
  return new Item({ id, name: `Blade ${id}`, unidentifiedName: 'Rusty Blade', category: 'weapon', slot: 'mainHand', weight: 100, bulk: 100, identified: false });
}

function setup() {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
  const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player, manifest: cotwManifest });
  const first = unidentified('first');
  const second = unidentified('second');
  player.inventory.primaryPack.addItem(first);
  player.inventory.primaryPack.addItem(second);
  return { engine, player, first, second };
}

describe('identifying a chosen item from the inventory (itemTargetId)', () => {
  it('a Scroll of Identify identifies the targeted item, not the first unidentified one', () => {
    const { engine, player, first, second } = setup();
    const scroll = new ScrollItem({ id: 'scroll-id', name: 'Scroll of Identify', spellId: 'identify', identified: true });
    player.inventory.primaryPack.addItem(scroll);

    const res = engine.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: scroll.id, itemTargetId: second.id } });

    expect(res.success).toBe(true);
    expect(second.identified).toBe(true);
    expect(first.identified).toBe(false);
    expect(player.inventory.findItemById(scroll.id)).toBeUndefined();
  });

  it('the Identify spell identifies the targeted item', () => {
    const { engine, player, first, second } = setup();
    player.spellsKnown.push('identify');
    player.mana = player.maxMana = 50;

    engine.commandBus.dispatch({
      type: 'cast_spell',
      payload: { spellId: 'identify', targetX: player.x, targetY: player.y, itemTargetId: second.id },
    });

    expect(second.identified).toBe(true);
    expect(first.identified).toBe(false);
  });
});
