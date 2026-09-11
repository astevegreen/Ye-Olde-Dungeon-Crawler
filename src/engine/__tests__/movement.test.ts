import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { MovementAction } from '../actions/movement';
import { DIRECTIONS, type DirectionName } from '../types';

describe('Movement System - 8-Directional & Collision Rules', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    // 10x10 map filled with floors and perimeter walls
    map = GameMap.createBoxRoom(10, 10);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });
    player.gainEnergy(100);
    engine = new GameEngine({ map, player });
  });

  const directions: DirectionName[] = [
    'North',
    'NorthEast',
    'East',
    'SouthEast',
    'South',
    'SouthWest',
    'West',
    'NorthWest',
  ];

  for (const dirName of directions) {
    const dir = DIRECTIONS[dirName];

    it(`correctly executes valid movement in ${dirName} direction`, () => {
      const startX = player.x;
      const startY = player.y;

      const action = new MovementAction(player, dir.dx, dir.dy);
      const result = action.perform(engine);

      expect(result.success).toBe(true);
      expect(result.cost).toBe(100);
      expect(player.x).toBe(startX + dir.dx);
      expect(player.y).toBe(startY + dir.dy);
      expect(map.getEntityAt(startX, startY)).toBeNull();
      expect(map.getEntityAt(player.x, player.y)).toBe(player);
    });
  }

  it('prevents movement into walls and does not consume energy', () => {
    // Place wall directly to the East of player
    map.setTile(6, 5, TILES.WALL);
    player.energy = 100;

    const action = new MovementAction(player, 1, 0); // East
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(player.energy).toBe(100); // Energy preserved
    expect(result.message).toContain('bumps into a wall');
  });

  it('prevents movement into closed doors and does not consume energy', () => {
    map.setTile(5, 4, TILES.DOOR_CLOSED); // North
    player.energy = 100;

    const action = new MovementAction(player, 0, -1);
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(player.energy).toBe(100);
    expect(result.message).toContain('closed door');
  });

  it('allows movement through open doors', () => {
    map.setTile(5, 4, TILES.DOOR_OPEN); // North
    player.energy = 100;

    const action = new MovementAction(player, 0, -1);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(100);
    expect(player.x).toBe(5);
    expect(player.y).toBe(4);
    expect(player.energy).toBe(0);
  });

  it('blocks movement at map boundary and does not consume energy', () => {
    // Teleport player adjacent to boundary edge
    map.moveEntity(player, 0, 0);
    player.energy = 100;

    // Attempt moving West beyond (x < 0)
    const actionWest = new MovementAction(player, -1, 0);
    const resultWest = actionWest.perform(engine);
    expect(resultWest.success).toBe(false);
    expect(resultWest.cost).toBe(0);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
    expect(player.energy).toBe(100);

    // Attempt moving North beyond (y < 0)
    const actionNorth = new MovementAction(player, 0, -1);
    const resultNorth = actionNorth.perform(engine);
    expect(resultNorth.success).toBe(false);
    expect(resultNorth.cost).toBe(0);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
    expect(player.energy).toBe(100);
  });
});
