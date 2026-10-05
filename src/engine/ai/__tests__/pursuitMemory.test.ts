import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';

/**
 * Two rooms joined by a corridor along y = 5: room A (x 1–12) and room B (x 25–38).
 * The hunter starts in room A with the hero in sight.
 */
function twoRooms() {
  const map = new GameMap(40, 11, TILES.WALL);
  for (let y = 1; y < 10; y++) for (let x = 1; x < 13; x++) map.setTile(x, y, TILES.FLOOR);
  for (let x = 13; x < 25; x++) map.setTile(x, 5, TILES.FLOOR);
  for (let y = 1; y < 10; y++) for (let x = 25; x < 39; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 8, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  const hunter = new Monster({
    id: 'hunter',
    name: 'Hunter',
    position: { x: 3, y: 5 },
    stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'melee',
    aiState: 'hunting',
    xpValue: 1,
    lootTable: [],
  });
  engine.addEntity(hunter);
  return { engine, player, hunter };
}

/** The hero slips away to the far corner of room B, out of the hunter's sight. */
function slipAway(engine: GameEngine, player: Player) {
  engine.map.moveEntity(player, 37, 9);
}

describe('hunters that lose sight of the hero', () => {
  it('go to where they last saw the hero, not to where the hero is now', () => {
    const { engine, player, hunter } = twoRooms();
    hunter.takeTurn(engine); // sees the hero at (8, 5)
    slipAway(engine, player);

    let farthestEast = hunter.x;
    for (let t = 0; t < 40; t++) {
      hunter.takeTurn(engine);
      farthestEast = Math.max(farthestEast, hunter.x);
    }

    // It reached the last-seen tile's neighbourhood and searched there, never down the corridor.
    expect(farthestEast).toBeGreaterThanOrEqual(7);
    expect(farthestEast).toBeLessThan(13);
  });

  it('search for a while, then give up and stand', () => {
    const { engine, player, hunter } = twoRooms();
    hunter.takeTurn(engine);
    slipAway(engine, player);

    const seen = new Set<string>();
    for (let t = 0; t < 12; t++) {
      hunter.takeTurn(engine);
      seen.add(`${hunter.x},${hunter.y}`);
    }
    expect(seen.size).toBeGreaterThan(3); // it moved about, searching

    for (let t = 0; t < 30; t++) hunter.takeTurn(engine);
    const restingAt = { x: hunter.x, y: hunter.y };
    for (let t = 0; t < 5; t++) hunter.takeTurn(engine);

    expect({ x: hunter.x, y: hunter.y }).toEqual(restingAt);
    expect(hunter.intent.type).toBe('idle');
  });

  it('take up the chase again on seeing the hero', () => {
    const { engine, player, hunter } = twoRooms();
    hunter.takeTurn(engine);
    slipAway(engine, player);
    for (let t = 0; t < 50; t++) hunter.takeTurn(engine);

    engine.map.moveEntity(player, hunter.x + 4, 5);
    const before = Math.abs(player.x - hunter.x);
    for (let t = 0; t < 3; t++) hunter.takeTurn(engine);

    expect(Math.abs(player.x - hunter.x)).toBeLessThan(before);
  });

  it('know where the hero is again when struck', () => {
    const { engine, player, hunter } = twoRooms();
    hunter.takeTurn(engine);
    slipAway(engine, player);
    for (let t = 0; t < 50; t++) hunter.takeTurn(engine);

    hunter.takeDamage(1);
    const before = Math.hypot(player.x - hunter.x, player.y - hunter.y);
    for (let t = 0; t < 12; t++) hunter.takeTurn(engine);

    expect(Math.hypot(player.x - hunter.x, player.y - hunter.y)).toBeLessThan(before - 8);
  });

  it('show the search on the Look card', () => {
    const { engine, player, hunter } = twoRooms();
    hunter.takeTurn(engine);
    slipAway(engine, player);
    for (let t = 0; t < 8; t++) hunter.takeTurn(engine);

    expect(hunter.intent.type).toBe('searching');
  });
});
