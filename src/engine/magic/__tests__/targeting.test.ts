import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { traceProjectile, getAreaOfEffectTiles, getBresenhamLine } from '../targeting';

describe('Projectile Targeting and Raycasting', () => {
  function createTestCorridorMap(): GameMap {
    // 10x5 map
    // y = 0, 1, 3, 4 are walls
    // y = 2 is a floor corridor (x = 1..8)
    // x = 0, 9 are walls
    const map = new GameMap(10, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 10; x++) {
        if (y === 2 && x >= 1 && x <= 8) {
          map.setTile(x, y, TILES.FLOOR);
        } else {
          map.setTile(x, y, TILES.WALL);
        }
      }
    }
    return map;
  }

  function createTestRoomMap(): GameMap {
    // 10x10 empty room surrounded by walls
    const map = new GameMap(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (x === 0 || x === 9 || y === 0 || y === 9) {
          map.setTile(x, y, TILES.WALL);
        } else {
          map.setTile(x, y, TILES.FLOOR);
        }
      }
    }
    return map;
  }

  it('stops non-reflective projectile at solid wall without passing through', () => {
    const map = createTestCorridorMap();
    // Fire straight down corridor into dead end at x = 9
    const result = traceProjectile(map, 2, 2, 9, 2, 10, false);
    expect(result.hitWall).toBe(true);
    // Every tile in the path must be passable
    for (const step of result.path) {
      const tile = map.getTile(step.x, step.y);
      expect(tile?.passable).toBe(true);
    }
    expect(result.impactTile.x).toBe(8);
    expect(result.impactTile.y).toBe(2);
  });

  it('stops projectile when colliding with an entity', () => {
    const map = createTestCorridorMap();
    const monster = new Entity({
      id: 'target-goblin',
      name: 'Goblin',
      type: 'monster',
      faction: 'hostile',
      position: { x: 5, y: 2 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
    });
    map.addEntity(monster);

    const result = traceProjectile(map, 2, 2, 8, 2, 10, false, 'hero');
    expect(result.hitEntityId).toBe('target-goblin');
    expect(result.impactTile.x).toBe(5);
    expect(result.impactTile.y).toBe(2);
  });

  it('correctly reflects Lightning Bolt off solid walls without entering them', () => {
    const map = createTestRoomMap();
    // In room with walls at x=0, 9 and y=0, 9
    // Start at (2, 5), aim diagonally towards top wall (7, 0)
    const result = traceProjectile(map, 2, 5, 7, 0, 12, true, 'hero');

    expect(result.reflectionsCount).toBeGreaterThanOrEqual(1);

    // CRITICAL: Verify NO wall tiles were entered
    for (const step of result.path) {
      const tile = map.getTile(step.x, step.y);
      expect(tile?.passable).toBe(true);
      expect(step.x).toBeGreaterThan(0);
      expect(step.x).toBeLessThan(9);
      expect(step.y).toBeGreaterThan(0);
      expect(step.y).toBeLessThan(9);
    }
  });

  it('calculates area of effect tiles correctly', () => {
    const map = createTestRoomMap();
    const aoe = getAreaOfEffectTiles(map, 5, 5, 1);
    // 3x3 square = 9 tiles
    expect(aoe.length).toBe(9);
    expect(aoe).toContainEqual({ x: 4, y: 4 });
    expect(aoe).toContainEqual({ x: 5, y: 5 });
    expect(aoe).toContainEqual({ x: 6, y: 6 });
  });

  it('computes discrete Bresenham line points', () => {
    const line = getBresenhamLine(1, 1, 3, 1);
    expect(line).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });
});
