import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../item';
import { Container } from '../container';
import { itemIndex, getItemById } from '../itemIndex';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import { CoinItem } from '../../economy/currency';
import { PickUpAction, QuickLootAction } from '../../actions/inventory-actions';

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

  // Picking up used to store the item (registering its container) and then clear the tile,
  // which unregistered it again: every picked-up item fell out of the index until a reload
  // rebuilt it, so command-bus actions on it failed with "not found".
  it('keeps a picked-up item indexed in its new container', () => {
    const { engine, map, player } = buildEngine();
    map.addItemAt(4, 4, makeItem('rock-1'));

    expect(new PickUpAction(player, 'rock-1').perform(engine).success).toBe(true);

    expect(itemIndex.locationOf('rock-1')).toEqual({ kind: 'container', containerId: player.inventory.primaryPack.id });
    const drop = engine.commandBus.dispatch({ type: 'drop_item', payload: { itemId: 'rock-1' } });
    expect(drop.success).toBe(true);
    expect(itemIndex.locationOf('rock-1')).toEqual({ kind: 'ground', x: 4, y: 4 });
  });

  it('keeps quick-looted items indexed', () => {
    const { engine, map, player } = buildEngine();
    map.addItemAt(4, 4, makeItem('rock-1'));
    map.addItemAt(4, 4, makeItem('rock-2'));

    expect(new QuickLootAction(player).perform(engine).success).toBe(true);

    expect(getItemById('rock-1')).toBeDefined();
    expect(getItemById('rock-2')).toBeDefined();
  });

  // A coin pile picked up onto a same-denomination pile merges into it and its id retires —
  // the same answer before and after a reload (the merged-id alias it replaced was never
  // saved, so it resolved only until the next load).
  it('retires a merged coin pile id and keeps the surviving pile findable across a reload', () => {
    const { engine, map, player } = buildEngine();
    map.addItemAt(4, 4, new CoinItem({ id: 'gold-a', denomination: 'gold', count: 5 }));
    map.addItemAt(4, 4, new CoinItem({ id: 'gold-b', denomination: 'gold', count: 7 }));

    expect(new PickUpAction(player, 'gold-a').perform(engine).success).toBe(true);
    expect(new PickUpAction(player, 'gold-b').perform(engine).success).toBe(true);

    const check = (e: GameEngine) => {
      const pile = e.player.inventory.findItemById('gold-a');
      expect(pile).toBeInstanceOf(CoinItem);
      expect((pile as CoinItem).count).toBe(12);
      expect(getItemById('gold-a')).toBe(pile);
      expect(e.player.inventory.findItemById('gold-b')).toBeUndefined();
      expect(getItemById('gold-b')).toBeUndefined();
    };
    check(engine);
    const restored = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine;
    restored.activate();
    check(restored);
  });

  it('matches a full structural scan after pickups', () => {
    const { engine, map, player } = buildEngine();
    map.addItemAt(4, 4, makeItem('rock-1'));
    map.addItemAt(4, 4, new CoinItem({ id: 'gold-a', denomination: 'gold', count: 5 }));
    map.addItemAt(4, 4, new CoinItem({ id: 'gold-b', denomination: 'gold', count: 7 }));
    new QuickLootAction(player).perform(engine);

    const scanned = scanWorld(engine);
    const indexed = new Set(itemIndex.entries().map((e) => e.item.id));
    expect(indexed).toEqual(scanned);
  });
});
