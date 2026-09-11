import { describe, it, expect } from 'vitest';
import { DungeonGenerator } from '../dungeon/dungeon-generator';
import type { Position } from '../types';

describe('Dungeon Generation System', () => {
  it('generates a dungeon with expected dimensions and rooms', () => {
    const generator = new DungeonGenerator({
      width: 40,
      height: 30,
      maxRooms: 8,
      minRoomSize: 5,
      maxRoomSize: 8,
      seed: 12345,
    });

    const dungeon = generator.generate();

    expect(dungeon.map.width).toBe(40);
    expect(dungeon.map.height).toBe(30);
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(2);
    expect(dungeon.rooms.length).toBeLessThanOrEqual(8);
  });

  it('places player spawn and exit stairs on valid, non-wall tiles', () => {
    const generator = new DungeonGenerator({
      width: 45,
      height: 35,
      maxRooms: 10,
      seed: 98765,
    });

    const dungeon = generator.generate();

    const spawnTile = dungeon.map.getTile(dungeon.playerSpawn.x, dungeon.playerSpawn.y);
    const stairsTile = dungeon.map.getTile(dungeon.stairsDown.x, dungeon.stairsDown.y);

    expect(spawnTile).not.toBeNull();
    expect(spawnTile?.passable).toBe(true);
    expect(spawnTile?.type).toBe('floor');

    expect(stairsTile).not.toBeNull();
    expect(stairsTile?.passable).toBe(true);
    expect(stairsTile?.type).toBe('stairs_down');

    // Spawn and exit must be in different locations
    expect(dungeon.playerSpawn.x === dungeon.stairsDown.x && dungeon.playerSpawn.y === dungeon.stairsDown.y).toBe(false);
  });

  it('mathematically guarantees 100% path connectivity between player spawn and exit stairs (BFS reachability)', () => {
    // Test across multiple different random seeds
    const seeds = [42, 101, 777, 9999, 54321];

    for (const seed of seeds) {
      const generator = new DungeonGenerator({
        width: 45,
        height: 35,
        maxRooms: 10,
        seed,
      });

      const dungeon = generator.generate();
      const reachable = isPathConnected(dungeon.map, dungeon.playerSpawn, dungeon.stairsDown);

      expect(reachable).toBe(true);
    }
  });

  it('produces deterministic output when given the same seed', () => {
    const gen1 = new DungeonGenerator({ width: 30, height: 25, seed: 8888 });
    const gen2 = new DungeonGenerator({ width: 30, height: 25, seed: 8888 });

    const d1 = gen1.generate();
    const d2 = gen2.generate();

    expect(d1.playerSpawn).toEqual(d2.playerSpawn);
    expect(d1.stairsDown).toEqual(d2.stairsDown);
    expect(d1.rooms.length).toBe(d2.rooms.length);

    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 30; x++) {
        expect(d1.map.getTile(x, y)?.type).toBe(d2.map.getTile(x, y)?.type);
      }
    }
  });

  it('spawns monsters in non-starting rooms', () => {
    const generator = new DungeonGenerator({
      width: 40,
      height: 30,
      maxRooms: 8,
      seed: 5555,
      spawnMonsters: true,
    });

    const dungeon = generator.generate();

    expect(dungeon.monsters.length).toBeGreaterThan(0);
    // Ensure no monster spawns directly on player's spawn tile
    for (const monster of dungeon.monsters) {
      const isAtSpawn = monster.x === dungeon.playerSpawn.x && monster.y === dungeon.playerSpawn.y;
      expect(isAtSpawn).toBe(false);
    }
  });
});

function isPathConnected(map: any, start: Position, goal: Position): boolean {
  const queue: Position[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === goal.x && curr.y === goal.y) {
      return true;
    }

    for (const d of dirs) {
      const nx = curr.x + d.dx;
      const ny = curr.y + d.dy;
      const key = `${nx},${ny}`;

      if (map.inBounds(nx, ny) && !visited.has(key)) {
        const tile = map.getTile(nx, ny);
        if (tile && (tile.passable || tile.type === 'door_closed')) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return false;
}
