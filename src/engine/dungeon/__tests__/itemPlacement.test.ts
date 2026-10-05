import { describe, expect, it } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { populateDungeonLoot } from '../lootSpawner';
import { Container } from '../../items/container';
import { PRNG } from '../prng';
import { dropTile } from '../itemPlacement';
import { cotwManifest } from '../../../content/cotw';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';

/**
 * A walled 12x10 room (x 1-12, y 1-10) whose middle holds a pool, with a door in its east wall,
 * stairs in a corner, and a 1-wide passage stub off its north wall.
 */
function room() {
  const map = new GameMap(20, 14, TILES.WALL);
  for (let y = 1; y <= 10; y++) for (let x = 1; x <= 12; x++) map.setTile(x, y, TILES.FLOOR);
  for (let y = 4; y <= 6; y++) for (let x = 5; x <= 7; x++) map.setTile(x, y, TILES.SHALLOW_WATER);
  map.setTile(13, 5, TILES.DOOR_OPEN);
  map.setTile(1, 10, TILES.STAIRS_DOWN);
  map.setTile(10, 0, TILES.FLOOR); // the room's top edge row is the wall row 0: a stub out of it
  return map;
}

const box = { x1: 0, y1: 0, x2: 13, y2: 11 };
const wallSides = (map: GameMap, x: number, y: number) =>
  [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => !map.isPassable(x + dx, y + dy)).length;

describe('where loot is laid out (N22)', () => {
  it('a chest stands against a wall, in a corner where there is one', () => {
    let corners = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const map = room();
      const rng = new PRNG(seed);
      populateDungeonLoot(map, [box, box], 5, cotwManifest.items, () => rng.next(), undefined, undefined, { roomDropChance: 0, roomChestChance: 1 });
      const chests = map.getAllGroundItems().filter((g) => g.items.some((i) => i instanceof Container));
      expect(chests).toHaveLength(1);
      const { x, y } = chests[0];
      expect(wallSides(map, x, y), `${x},${y}`).toBeGreaterThanOrEqual(1);
      if (wallSides(map, x, y) >= 2) corners++;
    }
    expect(corners).toBe(60);
  });

  it('a loose item never lies in water, a doorway, a passage or on stairs', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = room();
      const rng = new PRNG(seed);
      populateDungeonLoot(map, [box, box], 5, cotwManifest.items, () => rng.next(), undefined, undefined, { roomDropChance: 1, roomChestChance: 0 });
      for (const { x, y } of map.getAllGroundItems()) {
        const tile = map.getTile(x, y)!;
        expect(tile.type, `${seed}: ${x},${y}`).toBe('floor');
        expect(x === 10 && y === 0, 'the passage stub').toBe(false);
      }
    }
  });

  it('a monster dying in a doorway, on stairs or in water drops its loot beside it, on open floor', () => {
    const map = room();
    for (const [x, y] of [[13, 5], [1, 10], [6, 5]]) {
      const at = dropTile(map, x, y);
      expect(map.getTile(at.x, at.y)?.type, `${x},${y}`).toBe('floor');
      expect(Math.max(Math.abs(at.x - x), Math.abs(at.y - y))).toBeLessThanOrEqual(2);
    }
    expect(dropTile(map, 3, 3)).toEqual({ x: 3, y: 3 });
  });

  it('on real cotw floors, no loose loot on stairs, doors, water or passages', () => {
    for (const floor of [2, 7, 12, 20, 28, 38]) {
      const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Lay', { seed: floor });
      engine.changeFloor(floor);
      const m = engine.map;
      for (const { x, y, items } of m.getAllGroundItems()) {
        if (items.some((i) => i.id.startsWith('cache-chest-') || i.id.startsWith('vault'))) continue;
        if (!items.some((i) => i.id.startsWith('loot-'))) continue;
        const tile = m.getTile(x, y)!;
        expect(tile.isDoor || tile.isStairs || tile.type.includes('water') || tile.type.startsWith('stairs') || tile.type.startsWith('door'), `floor ${floor} ${x},${y} ${tile.type}`).toBeFalsy();
      }
    }
  }, 30_000);
});
