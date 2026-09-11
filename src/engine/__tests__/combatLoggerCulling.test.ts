import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { createTestGoblin } from '../__fixtures__/testHelpers';
import { WaitAction } from '../actions/wait';
import { PickUpAction } from '../actions/inventory-actions';
import { ItemFactory } from '../items/factory';

describe('CombatLogger FOV Culling & Narrative Telemetry', () => {
  it('culls ambient wait messages when monster is outside player FOV', () => {
    // Large map, player at (1, 1), monster at (25, 25)
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 1, y: 1 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const monster = createTestGoblin('gob-far', { x: 25, y: 25 });
    const engine = new GameEngine({ map, player, floor: 1 });
    engine.addEntity(monster);
    engine.updateFov();

    expect(engine.fov.isVisible(25, 25)).toBe(false);

    const initialMsgCount = engine.messages.length;
    const wait = new WaitAction(monster);
    wait.perform(engine);

    // Message should have been culled
    expect(engine.messages.length).toBe(initialMsgCount);
  });

  it('logs ambient wait messages when monster is visible in player FOV', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 10, y: 10 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const monster = createTestGoblin('gob-near', { x: 11, y: 10 });
    const engine = new GameEngine({ map, player, floor: 1 });
    engine.addEntity(monster);
    engine.updateFov();

    expect(engine.fov.isVisible(11, 10)).toBe(true);

    const initialMsgCount = engine.messages.length;
    const wait = new WaitAction(monster);
    wait.perform(engine);

    expect(engine.messages.length).toBe(initialMsgCount + 1);
    expect(engine.messages[engine.messages.length - 1]).toContain('waits a moment');
  });

  it('always logs wait messages for the player', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 1 });

    const initialMsgCount = engine.messages.length;
    const wait = new WaitAction(player);
    wait.perform(engine);

    expect(engine.messages.length).toBe(initialMsgCount + 1);
    expect(engine.messages[engine.messages.length - 1]).toContain('waits a moment');
  });

  it('formats verbose pickup messages with item quantity and destination', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 1 });

    const pot = ItemFactory.createHealthPotion('hp-1');
    pot.quantity = 3;
    map.addItemAt(5, 5, pot);

    const pickup = new PickUpAction(player);
    const result = pickup.perform(engine);

    expect(result.success).toBe(true);
    const lastMsg = engine.messages[engine.messages.length - 1];
    expect(lastMsg).toContain('You pick up');
    expect(lastMsg).toContain('(x3)');
    expect(lastMsg).toContain('stored in');
  });
});
