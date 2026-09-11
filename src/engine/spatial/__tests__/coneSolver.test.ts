import { describe, it, expect } from 'vitest';
import { getConeCoordinates } from '../coneSolver';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';

describe('Cone Geometry Solver (coneSolver.ts)', () => {
  it('returns symmetrical tiles for cardinal east 90-degree cone', () => {
    // 15x15 open map filled with floor
    const map = new GameMap(15, 15, TILES.FLOOR);
    const origin = { x: 7, y: 7 };
    const target = { x: 10, y: 7 }; // Due East

    const tiles = getConeCoordinates(origin, target, 90, 4, map);
    expect(tiles.length).toBeGreaterThan(0);

    // All tiles should be to the east (x >= origin.x)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(origin.x);
    }

    // Check symmetry across horizontal axis y = 7
    const northTiles = tiles.filter((t) => t.y < 7);
    const southTiles = tiles.filter((t) => t.y > 7);
    expect(northTiles.length).toBe(southTiles.length);
  });

  it('respects 45-degree cone narrower dispersion', () => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    const origin = { x: 7, y: 7 };
    const target = { x: 12, y: 7 };

    const cone90 = getConeCoordinates(origin, target, 90, 4, map);
    const cone45 = getConeCoordinates(origin, target, 45, 4, map);

    expect(cone45.length).toBeLessThan(cone90.length);
    expect(cone45.length).toBeGreaterThan(0);

    // Center beam (8, 7), (9, 7), (10, 7), (11, 7) must be present
    expect(cone45.some((t) => t.x === 8 && t.y === 7)).toBe(true);
    expect(cone45.some((t) => t.x === 11 && t.y === 7)).toBe(true);
  });

  it('respects wall occlusions and casts shadows behind solid obstacles', () => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    const origin = { x: 7, y: 7 };
    const target = { x: 12, y: 7 };

    // Place a wall obstacle at (9, 7) directly in front of origin
    map.setTile(9, 7, TILES.WALL);

    const tiles = getConeCoordinates(origin, target, 90, 4, map);

    // Wall itself can be reached / seen (front face)
    expect(tiles.some((t) => t.x === 9 && t.y === 7)).toBe(true);

    // Tile directly behind wall (10, 7) and (11, 7) must be occluded
    expect(tiles.some((t) => t.x === 10 && t.y === 7)).toBe(false);
    expect(tiles.some((t) => t.x === 11 && t.y === 7)).toBe(false);

    // Tiles flanking the wall (e.g. at y = 6 or y = 8) should still be visible
    expect(tiles.some((t) => t.x === 9 && t.y === 6)).toBe(true);
    expect(tiles.some((t) => t.x === 9 && t.y === 8)).toBe(true);
  });

  it('handles origin equal to target gracefully', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const origin = { x: 5, y: 5 };
    const tiles = getConeCoordinates(origin, origin, 90, 3, map);
    expect(tiles).toEqual([{ x: 5, y: 5 }]);
  });
});
