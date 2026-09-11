import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { FovManager } from '../fov/fov-manager';
import { Visibility } from '../fov/types';

describe('Field of View & Fog of War System', () => {
  let map: GameMap;
  let fov: FovManager;

  beforeEach(() => {
    // 20x20 room with floor
    map = new GameMap(20, 20, TILES.FLOOR);
    fov = new FovManager(20, 20);
  });

  it('initializes all tiles as Unexplored', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        expect(fov.getVisibility(x, y)).toBe(Visibility.Unexplored);
        expect(fov.isVisible(x, y)).toBe(false);
        expect(fov.isExplored(x, y)).toBe(false);
      }
    }
  });

  it('always marks the origin tile as Visible', () => {
    fov.update(map, 10, 10, 5);
    expect(fov.getVisibility(10, 10)).toBe(Visibility.Visible);
    expect(fov.isVisible(10, 10)).toBe(true);
    expect(fov.isExplored(10, 10)).toBe(true);
  });

  it('illuminates open floor within radius and respects circular boundary', () => {
    fov.update(map, 10, 10, 4);

    // Tiles within radius 4 must be visible
    expect(fov.isVisible(10, 9)).toBe(true);
    expect(fov.isVisible(10, 14)).toBe(true);
    expect(fov.isVisible(13, 10)).toBe(true);

    // Tiles beyond radius (e.g. distance > 4) must remain unexplored
    expect(fov.isVisible(10, 16)).toBe(false);
    expect(fov.getVisibility(10, 16)).toBe(Visibility.Unexplored);
    expect(fov.isVisible(0, 0)).toBe(false);
  });

  it('blocks line of sight behind solid walls while illuminating wall face', () => {
    // Erect a vertical wall column at x = 12 between y = 8 and y = 12
    for (let y = 8; y <= 12; y++) {
      map.setTile(12, y, TILES.WALL);
    }

    // Origin is at (10, 10)
    fov.update(map, 10, 10, 6);

    // Facing wall tile (12, 10) must be illuminated/visible to the player
    expect(fov.isVisible(12, 10)).toBe(true);

    // Shadowed tile directly behind wall (13, 10), (14, 10) must NOT be visible
    expect(fov.isVisible(13, 10)).toBe(false);
    expect(fov.isVisible(14, 10)).toBe(false);
    expect(fov.getVisibility(13, 10)).toBe(Visibility.Unexplored);
  });

  it('blocks sight through closed doors but permits sight through open doors', () => {
    // Wall with closed door at (12, 10)
    for (let y = 8; y <= 12; y++) {
      map.setTile(12, y, TILES.WALL);
    }
    map.setTile(12, 10, TILES.DOOR_CLOSED);

    fov.update(map, 10, 10, 6);
    expect(fov.isVisible(12, 10)).toBe(true); // Door face is visible
    expect(fov.isVisible(13, 10)).toBe(false); // Behind closed door is blocked

    // Open the door
    map.setTile(12, 10, TILES.DOOR_OPEN);
    fov.update(map, 10, 10, 6);

    expect(fov.isVisible(12, 10)).toBe(true);
    expect(fov.isVisible(13, 10)).toBe(true); // Behind open door is now visible
    expect(fov.isVisible(14, 10)).toBe(true);
  });

  it('transitions visible tiles to Explored (Fog of War) upon moving away', () => {
    // Player at (5, 5)
    fov.update(map, 5, 5, 3);
    expect(fov.getVisibility(5, 5)).toBe(Visibility.Visible);
    expect(fov.getVisibility(6, 5)).toBe(Visibility.Visible);

    // Player moves far away to (15, 15)
    fov.update(map, 15, 15, 3);

    // Old position is now Explored (dimmed geometry, hidden entities)
    expect(fov.getVisibility(5, 5)).toBe(Visibility.Explored);
    expect(fov.getVisibility(6, 5)).toBe(Visibility.Explored);
    expect(fov.isExplored(5, 5)).toBe(true);
    expect(fov.isVisible(5, 5)).toBe(false);

    // New position is now Visible
    expect(fov.getVisibility(15, 15)).toBe(Visibility.Visible);
    expect(fov.isVisible(15, 15)).toBe(true);

    // Unvisited area is still Unexplored
    expect(fov.getVisibility(0, 0)).toBe(Visibility.Unexplored);
  });
});
