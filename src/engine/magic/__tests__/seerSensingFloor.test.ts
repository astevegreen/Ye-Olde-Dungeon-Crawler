import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { Visibility } from '../../fov/types';
import { SENSING_OBJECTS_STATUS, objectSensedAt } from '../../fov/sensing';
import { TileInspector } from '../../inspect/inspector';
import { activateRegistries } from '../../registries';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import { executeReveal } from '../reveal';
import type { StatusType } from '../../status/types';
import { cotwManifest } from '../../../content/cotw';

/**
 * Hliðskjálf's loot sensing (a `withinReach` items reveal) belongs to the floor it was cast on:
 * taking the stairs leaves it behind, and coming back while it lasts finds it again. A status
 * saved before the floor was recorded senses on whatever floor is current, as it always did.
 */

afterAll(() => activateRegistries(null));

const SIGHT = { type: 'reveal', target: 'items', withinReach: true, duration: 15 } as const;

function floorTwo(): { engine: GameEngine; hero: Player } {
  const map = new GameMap(57, 40, TILES.WALL);
  for (let y = 1; y < 39; y++) for (let x = 1; x < 56; x++) map.setTile(x, y, TILES.FLOOR);
  // A sealed closet south of the cast point: within reach, never in sight.
  for (let y = 28; y <= 32; y++) for (let x = 18; x <= 22; x++) map.setTile(x, y, TILES.WALL);
  map.setTile(20, 30, TILES.FLOOR);
  map.setTile(30, 20, TILES.STAIRS_DOWN);
  const hero = new Player({ id: 'hero', name: 'Hero', position: { x: 20, y: 20 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
  const engine = new GameEngine({ map, player: hero, floor: 2, manifest: cotwManifest });
  return { engine, hero };
}

const pile = (engine: GameEngine, x: number, y: number, id: string) =>
  engine.map.addItemAt(x, y, new Item({ id, name: 'Rock', category: 'misc', weight: 10, bulk: 10 }));

/** Puts a pile at (25,20) on the current floor, explored but out of the hero's sight. */
function hiddenPileAt2520(engine: GameEngine): void {
  pile(engine, 25, 20, 'far-rock');
  engine.fov.revealTile(25, 20);
  expect(engine.fov.getVisibility(25, 20)).toBe(Visibility.Explored);
}

const sensedSomething = (engine: GameEngine, x: number, y: number) =>
  TileInspector.inspectTile(engine, x, y).items.some((i) => i.sensed === true && i.name === 'Something');

describe("Hliðskjálf's loot sensing stays on the floor it was cast on", () => {
  it('senses nothing on the next floor down', () => {
    const { engine, hero } = floorTwo();
    executeReveal(engine, hero, SIGHT, 12);
    engine.changeFloor(3);
    expect(engine.currentFloor).toBe(3);
    hiddenPileAt2520(engine);
    expect(objectSensedAt(engine, 25, 20)).toBe(false);
    expect(sensedSomething(engine, 25, 20)).toBe(false);
  });

  it('senses the old floor again on coming back while it lasts', () => {
    const { engine, hero } = floorTwo();
    pile(engine, 20, 30, 'closet-rock');
    executeReveal(engine, hero, SIGHT, 12);
    engine.changeFloor(3);
    hiddenPileAt2520(engine);
    expect(objectSensedAt(engine, 25, 20)).toBe(false);
    engine.changeFloor(2);
    expect(engine.currentFloor).toBe(2);
    expect(hero.statusManager.hasStatus(SENSING_OBJECTS_STATUS as StatusType)).toBe(true);
    expect(engine.fov.getVisibility(20, 30)).not.toBe(Visibility.Visible);
    expect(objectSensedAt(engine, 20, 30)).toBe(true);
    expect(sensedSomething(engine, 20, 30)).toBe(true);
  });

  it('on the same floor, senses within its radius and not past it', () => {
    const { engine, hero } = floorTwo();
    executeReveal(engine, hero, SIGHT, 12);
    expect(objectSensedAt(engine, 20, 32)).toBe(true);
    expect(objectSensedAt(engine, 20, 33)).toBe(false);
    expect(objectSensedAt(engine, 33, 20)).toBe(false);
  });

  it('keeps its floor through a save and load', () => {
    const { engine, hero } = floorTwo();
    executeReveal(engine, hero, SIGHT, 12);
    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest).engine;
    expect(loaded.currentFloor).toBe(2);
    expect(objectSensedAt(loaded, 20, 32)).toBe(true);
    loaded.changeFloor(3);
    hiddenPileAt2520(loaded);
    expect(objectSensedAt(loaded, 25, 20)).toBe(false);
    expect(sensedSomething(loaded, 25, 20)).toBe(false);
  });

  it('a status with no floor (an older save) still senses on the current floor', () => {
    const { engine, hero } = floorTwo();
    engine.changeFloor(3);
    hero.statusManager.applyStatus(
      { type: SENSING_OBJECTS_STATUS as StatusType, duration: 15, data: { x: 20, y: 20, radius: 12 } },
      [],
      hero,
      engine
    );
    hiddenPileAt2520(engine);
    expect(objectSensedAt(engine, 25, 20)).toBe(true);
    expect(objectSensedAt(engine, 40, 20)).toBe(false);
  });

  it('Detect Objects still senses every tile on any floor', () => {
    const { engine, hero } = floorTwo();
    executeReveal(engine, hero, SIGHT, 12);
    engine.changeFloor(3);
    engine.detectObjectsTurns = 10;
    expect(objectSensedAt(engine, 25, 20)).toBe(true);
    expect(objectSensedAt(engine, 1, 1)).toBe(true);
  });
});
