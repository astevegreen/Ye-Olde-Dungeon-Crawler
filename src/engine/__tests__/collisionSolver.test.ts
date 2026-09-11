import { describe, it, expect } from 'vitest';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Entity } from '../entities/entity';
import { findSafeSpawnPosition } from '../spatial/collisionSolver';

describe('findSafeSpawnPosition', () => {
  it('returns preferredCoords immediately when tile is passable and unoccupied', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const result = findSafeSpawnPosition(map, { x: 5, y: 5 });
    expect(result).toEqual({ x: 5, y: 5 });
  });

  it('finds adjacent passable tile when preferredCoords is a wall', () => {
    const map = new GameMap(10, 10, TILES.WALL);
    // Open a single floor tile at (4, 5)
    map.setTile(4, 5, TILES.FLOOR);

    const result = findSafeSpawnPosition(map, { x: 5, y: 5 }, 3);
    expect(result).toEqual({ x: 4, y: 5 });
  });

  it('avoids occupied tiles and finds nearest unoccupied tile', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const blocker = new Entity({
      id: 'blocker-1',
      name: 'Goblin',
      type: 'monster',
      faction: 'hostile',
      position: { x: 5, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      speed: 100,
    });
    map.addEntity(blocker);

    const result = findSafeSpawnPosition(map, { x: 5, y: 5 }, 2);
    // Should NOT be (5, 5)
    expect(result).not.toEqual({ x: 5, y: 5 });
    // Distance should be 1
    const dist = Math.hypot(result.x - 5, result.y - 5);
    expect(dist).toBeCloseTo(1, 1);
    expect(map.getEntityAt(result.x, result.y)).toBeNull();
  });

  it('allows tile if occupant is entityToIgnore', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const self = new Entity({
      id: 'self-1',
      name: 'Player',
      type: 'player',
      faction: 'player',
      position: { x: 5, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
      speed: 100,
    });
    map.addEntity(self);

    const result = findSafeSpawnPosition(map, { x: 5, y: 5 }, 2, self);
    expect(result).toEqual({ x: 5, y: 5 });
  });

  it('guarantees zero entity co-occupation when multiple entities spawn at identical coordinates', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const spawnedPositions: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < 5; i++) {
      const pos = findSafeSpawnPosition(map, { x: 5, y: 5 }, 5);
      const entity = new Entity({
        id: `entity-${i}`,
        name: `Spawn-${i}`,
        type: 'monster',
        faction: 'hostile',
        position: pos,
        stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 },
        speed: 100,
      });
      const added = map.addEntity(entity);
      expect(added).toBe(true);
      spawnedPositions.push(pos);
    }

    // Verify all positions are unique
    const uniqueKeys = new Set(spawnedPositions.map((p) => `${p.x},${p.y}`));
    expect(uniqueKeys.size).toBe(5);
  });
});
