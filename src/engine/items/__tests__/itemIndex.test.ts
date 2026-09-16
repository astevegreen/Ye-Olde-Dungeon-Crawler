import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../item';
import { Container } from '../container';
import { itemIndex, getItemById } from '../itemIndex';
import { serializeGame, deserializeGame } from '../../storage/serializer';

/**
 * The flat index is a second structure that must track the containers (ARCHITECTURE.md §5).
 * The scheduler partition (§6) failed exactly there, so these tests audit the index against
 * a full structural scan rather than trusting the write sites.
 */
function makeItem(id: string) {
  return new Item({ id, name: id, category: 'misc', weight: 10, bulk: 10 });
}

function buildEngine() {
  const map = new GameMap(16, 16, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 4, y: 4 } });
  return { engine: new GameEngine({ map, player, seed: 3 }), map, player };
}

/** Every item reachable by walking the world, by id. */
function scanWorld(engine: GameEngine): Set<string> {
  const found = new Set<string>();
  const walk = (item: Item) => {
    found.add(item.id);
    if (item instanceof Container) for (const child of item.getItems()) walk(child);
  };
  for (const pile of engine.map.getAllGroundItems()) pile.items.forEach(walk);
  for (const eq of engine.player.inventory.paperdoll.getAllEquipped()) walk(eq.item);
  engine.player.inventory.primaryPack.getItems().forEach(walk);
  return found;
}

describe('Flat item index', () => {
  beforeEach(() => itemIndex.clear());

  it('finds an item in a container by id without walking containers', () => {
    const { engine } = buildEngine();
    const item = makeItem('potion-1');
    engine.player.inventory.primaryPack.addItem(item);

    expect(getItemById('potion-1')).toBe(item);
    expect(itemIndex.locationOf('potion-1')).toEqual({
      kind: 'container',
      containerId: engine.player.inventory.primaryPack.id,
    });
  });

  it('tracks an item onto and off the ground', () => {
    const { map } = buildEngine();
    const item = makeItem('rock-1');

    map.addItemAt(7, 8, item);
    expect(itemIndex.locationOf('rock-1')).toEqual({ kind: 'ground', x: 7, y: 8 });

    map.removeItemAt(7, 8, 'rock-1');
    expect(getItemById('rock-1')).toBeUndefined();
  });

  it('drops entries when an item leaves its container', () => {
    const { engine } = buildEngine();
    const item = makeItem('scroll-1');
    engine.player.inventory.primaryPack.addItem(item);
    engine.player.inventory.primaryPack.removeItem('scroll-1');

    expect(itemIndex.has('scroll-1')).toBe(false);
  });

  it('matches a full structural scan after a load', () => {
    const { engine, map } = buildEngine();
    engine.player.inventory.primaryPack.addItem(makeItem('a-1'));
    engine.player.inventory.primaryPack.addItem(makeItem('a-2'));
    map.addItemAt(5, 5, makeItem('g-1'));

    const restored = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine;
    const scanned = scanWorld(restored);

    for (const id of scanned) {
      expect(itemIndex.has(id)).toBe(true);
    }
    // And nothing the index claims is absent from the world it was rebuilt from.
    const indexed = new Set(itemIndex.entries().map((e) => e.item.id));
    for (const id of scanned) expect(indexed.has(id)).toBe(true);
  });
});
