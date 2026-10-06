import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { FovManager } from '../../fov/fov-manager';
import { Visibility } from '../../fov/types';
import { Monster } from '../../entities/monster';
import { SpawnSiteFilter } from '../spawnSites';

/**
 * The one rule for where a monster may be put (R-ai-5, -16): reachable without a secret
 * door, not on stairs, outside the clear radius, and out of view when asked.
 */
function room(): GameMap {
  const map = new GameMap(20, 12, TILES.WALL);
  for (let y = 1; y <= 10; y++) for (let x = 1; x <= 12; x++) map.setTile(x, y, TILES.FLOOR);
  // A 3x3 cache at x 15-17 behind a secret door at (14, 5), with a ring of rock.
  map.setTile(13, 5, TILES.FLOOR);
  map.setTile(14, 5, TILES.SECRET_DOOR);
  for (let y = 4; y <= 6; y++) for (let x = 15; x <= 17; x++) map.setTile(x, y, TILES.FLOOR);
  return map;
}

describe('SpawnSiteFilter', () => {
  it('refuses a secret cache, the stairs, an occupied tile and the clear radius; allows open floor', () => {
    const map = room();
    map.setTile(10, 9, TILES.STAIRS_DOWN);
    map.addEntity(new Monster({ id: 'm', name: 'M', position: { x: 9, y: 2 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } }));
    const sites = new SpawnSiteFilter(map, { anchor: { x: 2, y: 2 }, minDistance: 4 });

    expect(sites.allows(16, 5)).toBe(false); // the cache
    expect(sites.allows(10, 9)).toBe(false); // the stairs
    expect(sites.allows(9, 2)).toBe(false); // a monster stands there
    expect(sites.allows(4, 3)).toBe(false); // within 4 of the anchor
    expect(sites.allows(13, 5)).toBe(true); // in front of the secret door
    expect(sites.allows(8, 8)).toBe(true);
    expect(sites.sites().some((p) => p.x >= 15)).toBe(false);
  });

  it('refuses a tile in view when given the view', () => {
    const map = room();
    const fov = new FovManager(map.width, map.height);
    fov.setVisibility(8, 8, Visibility.Visible);
    const sites = new SpawnSiteFilter(map, { anchor: { x: 2, y: 2 }, minDistance: 4, hiddenFrom: fov });

    expect(sites.allows(8, 8)).toBe(false);
    expect(sites.allows(9, 8)).toBe(true);
  });

  it('walks through a closed door, which a monster can open', () => {
    const map = room();
    for (let y = 1; y <= 10; y++) map.setTile(6, y, TILES.WALL);
    map.setTile(6, 5, TILES.DOOR_CLOSED);
    const sites = new SpawnSiteFilter(map, { anchor: { x: 2, y: 2 }, minDistance: 1 });

    expect(sites.allows(10, 5)).toBe(true);
  });
});
