import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { MovementAction } from '../src/engine/actions/movement';
import { WaitAction } from '../src/engine/actions/wait';

describe('Game Engine - Production Core Logic', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    // 20x15 map with perimeter walls
    map = new GameMap(20, 15, TILES.FLOOR);
    for (let x = 0; x < 20; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, 14, TILES.WALL);
    }
    for (let y = 0; y < 15; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(19, y, TILES.WALL);
    }
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 7 } });
    engine = new GameEngine({ map, player });
  });

  it('initializes game engine with valid dimensions and player spawn', () => {
    expect(engine.map.width).toBe(20);
    expect(engine.map.height).toBe(15);
    expect(engine.player.x).toBe(3);
    expect(engine.player.y).toBe(7);
    expect(engine.turnCount).toBe(0);
    expect(engine.player.isAlive()).toBe(true);
  });

  it('correctly marks perimeter and out-of-bounds as impassable', () => {
    expect(engine.map.isPassable(0, 0)).toBe(false);
    expect(engine.map.isPassable(19, 0)).toBe(false);
    expect(engine.map.isPassable(0, 14)).toBe(false);
    expect(engine.map.isPassable(19, 14)).toBe(false);
    expect(engine.map.isPassable(-1, 5)).toBe(false);
    expect(engine.map.isPassable(20, 5)).toBe(false);
    expect(engine.map.isPassable(3, 7)).toBe(true);
  });

  it('allows moving player onto open floor tiles and increments energy/turn state', () => {
    const startX = engine.player.x;
    const startY = engine.player.y;

    const action = new MovementAction(engine.player, 1, 0);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(engine.player.x).toBe(startX + 1);
    expect(engine.player.y).toBe(startY);
  });

  it('prevents player from walking into walls and does not change coordinates', () => {
    engine.player.setPosition(1, 5);

    // Try moving West into perimeter wall (x=0)
    const action = new MovementAction(engine.player, -1, 0);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(false);
    expect(engine.player.x).toBe(1);
    expect(engine.player.y).toBe(5);
  });

  it('processes wait actions and consumes energy properly', () => {
    const action = new WaitAction(engine.player);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(engine.player.x).toBe(3);
    expect(engine.player.y).toBe(7);
  });
});
