import { describe, it, expect } from 'vitest';
import { getReflectedRayTrajectory } from '../reflectionSolver';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Actor } from '../../entities/actor';

describe('Specular Ray Reflection Solver (reflectionSolver.ts)', () => {
  it('reflects cleanly off a vertical wall (90-degree bounce)', () => {
    // 10x10 map surrounded by walls, with floor inside
    const map = new GameMap(10, 10, TILES.FLOOR);
    // Add vertical wall barrier at x = 7 from y = 0 to 9
    for (let y = 0; y < 10; y++) {
      map.setTile(7, y, TILES.WALL);
    }

    const origin = { x: 4, y: 5 };
    const velocity = { x: 1, y: 0 }; // Straight East

    // Max 1 bounce
    const traj = getReflectedRayTrajectory(origin, velocity, 1, map);

    expect(traj.length).toBeGreaterThan(1);
    // Should travel east to x=6 (tile before wall at x=7)
    expect(traj.some((t) => t.x === 6 && t.y === 5)).toBe(true);

    // After bounce on vertical face, velocity becomes (-1, 0), moving west back towards x=5, 4...
    const hitIndex = traj.findIndex((t) => t.x === 6 && t.y === 5);
    expect(hitIndex).toBeGreaterThan(0);

    // Next point after impact should be westward
    if (hitIndex + 1 < traj.length) {
      expect(traj[hitIndex + 1].x).toBeLessThan(6);
    }
  });

  it('reflects off diagonal angles (45-degree incidence into reflection)', () => {
    // 20x20 floor map with a north wall at y = 2
    const map = new GameMap(20, 20, TILES.FLOOR);
    for (let x = 0; x < 20; x++) {
      map.setTile(x, 2, TILES.WALL);
    }

    const origin = { x: 5, y: 6 };
    // Traveling northeast: dx = 1, dy = -1
    const velocity = { x: 1, y: -1 };

    const traj = getReflectedRayTrajectory(origin, velocity, 2, map);
    expect(traj.length).toBeGreaterThan(2);

    // Should strike wall at y=2 (closest passable tile is y=3)
    const bouncePoint = traj.find((t) => t.y === 3);
    expect(bouncePoint).toBeDefined();

    // After reflecting off horizontal wall (top face), vy becomes +1, so y increases (southeast)
    const afterBounce = traj.filter((_t, idx) => idx > traj.indexOf(bouncePoint!));
    expect(afterBounce.length).toBeGreaterThan(0);
    for (const pt of afterBounce) {
      expect(pt.y).toBeGreaterThanOrEqual(3);
    }
  });

  it('terminates immediately upon impacting a living entity', () => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    const origin = { x: 2, y: 7 };
    const velocity = { x: 1, y: 0 };

    // Place an entity at (8, 7)
    const targetMonster = new Actor({
      id: 'target-goblin',
      name: 'Goblin',
      type: 'monster',
      faction: 'hostile',
      position: { x: 8, y: 7 },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
    });
    map.addEntity(targetMonster);

    const traj = getReflectedRayTrajectory(origin, velocity, 3, map);

    // Last point must be the entity's position
    const last = traj[traj.length - 1];
    expect(last).toEqual({ x: 8, y: 7 });

    // Must not pass through the monster to x = 9
    expect(traj.some((t) => t.x > 8)).toBe(false);
  });

  it('respects maxBounces limit without infinite loops', () => {
    // 5x5 enclosed room
    const map = new GameMap(5, 5, TILES.WALL);
    for (let y = 1; y < 4; y++) {
      for (let x = 1; x < 4; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    const origin = { x: 2, y: 2 };
    const velocity = { x: 1, y: 1 };

    // Max 3 bounces
    const traj = getReflectedRayTrajectory(origin, velocity, 3, map);
    expect(traj.length).toBeGreaterThan(1);
    expect(traj.length).toBeLessThan(100); // Bounded length
  });
});
