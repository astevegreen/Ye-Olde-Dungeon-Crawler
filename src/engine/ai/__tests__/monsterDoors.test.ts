import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';

function monsterAt(x: number, y: number, hp: number): Monster {
  return new Monster({
    id: 'door-user',
    name: 'Door-User',
    position: { x, y },
    stats: { hp, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'melee',
    aiState: 'hunting',
    fleeHealthPercent: 0.5,
    xpValue: 1,
    lootTable: [],
  });
}

/** A room (x 1–8) with a closed door at (9, 3) onto a corridor east; the hero in the room. */
function roomWithDoor() {
  const map = new GameMap(20, 7, TILES.WALL);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 9; x++) map.setTile(x, y, TILES.FLOOR);
  map.setTile(9, 3, TILES.DOOR_CLOSED);
  for (let x = 10; x < 19; x++) map.setTile(x, 3, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 3, y: 3 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  return { engine, player, map };
}

describe('monsters and doors', () => {
  it('a fleeing monster opens a door to get away, and shuts it behind itself', () => {
    const { engine, map } = roomWithDoor();
    const runner = monsterAt(8, 3, 5); // below its flee line
    engine.addEntity(runner);

    for (let t = 0; t < 4; t++) runner.takeTurn(engine);

    expect(runner.x).toBeGreaterThanOrEqual(10);
    expect(map.getTile(9, 3)?.type).toBe('door_closed');
  });

  it('a fleeing monster leaves the door open when the hero is beside it', () => {
    const { engine, player, map } = roomWithDoor();
    map.setTile(9, 3, TILES.DOOR_OPEN);
    engine.map.moveEntity(player, 8, 3);
    const runner = monsterAt(10, 3, 5);
    engine.addEntity(runner);

    runner.takeTurn(engine);

    expect(map.getTile(9, 3)?.type).toBe('door_open');
    expect(runner.x).toBe(11);
  });

  it('a hunter takes the long way round rather than a locked door', () => {
    // Rooms A (x 1–8) and B (x 12–20) share a locked door at (10, 4); a corridor along y = 9
    // joins them the long way.
    const map = new GameMap(22, 11, TILES.WALL);
    for (let y = 1; y < 8; y++) for (let x = 1; x < 9; x++) map.setTile(x, y, TILES.FLOOR);
    for (let y = 1; y < 8; y++) for (let x = 12; x < 21; x++) map.setTile(x, y, TILES.FLOOR);
    map.setTile(9, 4, TILES.FLOOR);
    map.setTile(11, 4, TILES.FLOOR);
    map.setTile(10, 4, { ...TILES.DOOR_CLOSED, locked: true });
    for (let x = 2; x < 20; x++) map.setTile(x, 9, TILES.FLOOR);
    map.setTile(2, 8, TILES.FLOOR);
    map.setTile(19, 8, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 14, y: 4 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
    const engine = new GameEngine({ map, player });
    const hunter = monsterAt(7, 4, 40);
    engine.addEntity(hunter);

    let reached = false;
    for (let t = 0; t < 40 && !reached; t++) {
      hunter.takeTurn(engine);
      reached = Math.max(Math.abs(hunter.x - player.x), Math.abs(hunter.y - player.y)) <= 1;
    }

    expect(reached).toBe(true);
    expect(map.getTile(10, 4)?.locked).toBe(true);
  });
});
