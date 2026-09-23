import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { serializeItem, deserializeItem } from '../storage/serializer';
import type { SerializedContainer } from '../storage/types';

function chest(id = 'chest-1'): Container {
  const c = new Container({
    id,
    name: 'Ironbound Chest',
    category: 'container',
    containerType: 'chest',
    weight: 20000,
    bulk: 20000,
    maxWeightCapacity: 50000,
    maxBulkCapacity: 50000,
  });
  c.addItem(new Item({ id: `${id}-gem`, name: 'Gem', category: 'misc', weight: 10, bulk: 10 }));
  return c;
}

function setup() {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
  const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
  const c = chest();
  engine.map.addItemAt(2, 2, c);
  return { engine, container: c };
}

describe('Container opened flag', () => {
  it('starts unopened', () => {
    expect(chest().wasOpened).toBe(false);
  });

  it('is set by looking inside (open_container) and by looting', () => {
    const a = setup();
    a.engine.commandBus.dispatch({ type: 'open_container', payload: { container: a.container } });
    expect(a.container.wasOpened).toBe(true);

    const b = setup();
    b.engine.commandBus.dispatch({ type: 'loot_all_container', payload: { container: b.container } });
    expect(b.container.wasOpened).toBe(true);

    const c = setup();
    c.engine.commandBus.dispatch({ type: 'quick_loot' });
    expect(c.container.wasOpened).toBe(true);
  });

  it('survives a save round-trip, and older saves without the field load unopened', () => {
    const opened = chest();
    opened.markOpened();
    const roundTripped = deserializeItem(JSON.parse(JSON.stringify(serializeItem(opened)))) as Container;
    expect(roundTripped.wasOpened).toBe(true);

    const legacy = serializeItem(chest('chest-2')) as SerializedContainer;
    delete legacy.opened;
    expect((deserializeItem(legacy) as Container).wasOpened).toBe(false);
  });
});
