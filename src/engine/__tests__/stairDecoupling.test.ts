import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { MovementAction } from '../actions/movement';
import { ClimbStairsAction } from '../actions/stairs';

describe('Stair Interaction Decoupling', () => {
  it('stepping onto stairs_down moves the player onto the tile without changing floors', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(5, 5, TILES.STAIRS_DOWN);

    const player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 4, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });

    const engine = new GameEngine({ map, player, floor: 1 });

    // Step right onto the stairs tile
    const moveAction = new MovementAction(player, 1, 0);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    // Floor must NOT have changed automatically!
    expect(engine.currentFloor).toBe(1);

    // Verify messages contain prompt
    expect(engine.messages.some((m) => m.includes("stairs leading down"))).toBe(true);
  });

  it('stepping onto stairs_up moves the player onto the tile without changing floors', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(5, 5, TILES.STAIRS_UP);

    const player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 5, y: 4 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });

    const engine = new GameEngine({ map, player, floor: 2 });

    // Step down onto the stairs tile
    const moveAction = new MovementAction(player, 0, 1);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(engine.currentFloor).toBe(2);

    expect(engine.messages.some((m) => m.includes("stairs leading up"))).toBe(true);
  });

  it('explicit ClimbStairsAction on stairs descends or ascends correctly', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(5, 5, TILES.STAIRS_DOWN);

    const player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });

    const engine = new GameEngine({ map, player, floor: 1 });

    const climbAction = new ClimbStairsAction(player);
    const result = climbAction.perform(engine);

    expect(result.success).toBe(true);
    expect(engine.currentFloor).toBe(2);
  });

  it('environmental traps and hazards still trigger immediately upon step entry', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    // Place a trap at (5, 5)
    let trapTriggered = false;
    map.addTrap({
      type: 'arrow',
      x: 5,
      y: 5,
      disarmed: false,
      revealed: true,
      concealment: 10,
      trigger: (_entity: any, _engine: any) => {
        trapTriggered = true;
      },
    } as any);

    const player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 4, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });

    const engine = new GameEngine({ map, player, floor: 1 });

    const moveAction = new MovementAction(player, 1, 0);
    moveAction.perform(engine);

    expect(trapTriggered).toBe(true);
  });
});
