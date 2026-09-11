import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Entity } from '../entities/entity';

describe('GameMap - Spatial Grid & Tile Queries', () => {
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(10, 8, TILES.FLOOR);
  });

  it('initializes dimensions and default tiles correctly', () => {
    expect(map.width).toBe(10);
    expect(map.height).toBe(8);
    expect(map.getTile(0, 0)).toEqual(TILES.FLOOR);
    expect(map.getTile(9, 7)).toEqual(TILES.FLOOR);
  });

  it('rejects invalid dimensions in constructor', () => {
    expect(() => new GameMap(0, 5)).toThrow();
    expect(() => new GameMap(5, -1)).toThrow();
  });

  it('performs accurate coordinate bounds checking', () => {
    expect(map.inBounds(0, 0)).toBe(true);
    expect(map.inBounds(9, 7)).toBe(true);
    expect(map.inBounds(-1, 0)).toBe(false);
    expect(map.inBounds(0, -1)).toBe(false);
    expect(map.inBounds(10, 5)).toBe(false);
    expect(map.inBounds(5, 8)).toBe(false);
    expect(map.getTile(-1, 3)).toBeNull();
  });

  it('updates and queries individual tiles', () => {
    expect(map.setTile(2, 3, TILES.WALL)).toBe(true);
    expect(map.getTile(2, 3)).toEqual(TILES.WALL);
    expect(map.isPassable(2, 3)).toBe(false);
    expect(map.isTransparent(2, 3)).toBe(false);

    expect(map.setTile(4, 4, TILES.DOOR_CLOSED)).toBe(true);
    expect(map.isPassable(4, 4)).toBe(false);
    expect(map.isTransparent(4, 4)).toBe(false);

    expect(map.setTile(4, 4, TILES.DOOR_OPEN)).toBe(true);
    expect(map.isPassable(4, 4)).toBe(true);
    expect(map.isTransparent(4, 4)).toBe(true);

    expect(map.setTile(5, 5, TILES.STAIRS_DOWN)).toBe(true);
    expect(map.isPassable(5, 5)).toBe(true);
    expect(map.isTransparent(5, 5)).toBe(true);
  });

  it('indexes and queries entities spatially in O(1)', () => {
    const goblin = new Entity({
      id: 'goblin-1',
      name: 'Goblin',
      type: 'monster',
      faction: 'hostile',
      position: { x: 3, y: 3 },
      stats: { hp: 10, maxHp: 10, attack: 4, defense: 1 },
    });

    expect(map.addEntity(goblin)).toBe(true);
    expect(map.getEntityAt(3, 3)).toBe(goblin);
    expect(map.getEntityAt(3, 4)).toBeNull();

    // Prevent duplicate placement on occupied tile
    const orc = new Entity({
      id: 'orc-1',
      name: 'Orc',
      type: 'monster',
      faction: 'hostile',
      position: { x: 3, y: 3 },
      stats: { hp: 20, maxHp: 20, attack: 8, defense: 2 },
    });
    expect(map.addEntity(orc)).toBe(false);

    // Moving entity updates spatial index
    expect(map.moveEntity(goblin, 3, 4)).toBe(true);
    expect(map.getEntityAt(3, 3)).toBeNull();
    expect(map.getEntityAt(3, 4)).toBe(goblin);

    // Removing entity clears spatial index
    expect(map.removeEntity(goblin)).toBe(true);
    expect(map.getEntityAt(3, 4)).toBeNull();
  });
});
