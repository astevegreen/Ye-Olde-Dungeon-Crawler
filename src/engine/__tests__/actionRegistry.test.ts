import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ActionRegistry, type GameAction } from '../actions/actionRegistry';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { TILES } from '../grid/tile';

describe('Pluggable Action Command Registry', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(20, 20);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player, floor: 1 });
    ActionRegistry.resetToDefaults();
  });

  afterAll(() => {
    ActionRegistry.resetToDefaults();
  });

  it('has default engine actions registered (move, melee_attack, cast_spell, use_item, interact, wait)', () => {
    expect(ActionRegistry.has('move')).toBe(true);
    expect(ActionRegistry.has('melee_attack')).toBe(true);
    expect(ActionRegistry.has('cast_spell')).toBe(true);
    expect(ActionRegistry.has('use_item')).toBe(true);
    expect(ActionRegistry.has('interact')).toBe(true);
    expect(ActionRegistry.has('wait')).toBe(true);
  });

  it('executes default move action through ActionRegistry and updates player position', () => {
    const res = ActionRegistry.execute('move', player, { dx: 1, dy: 0 }, engine);
    expect(res.success).toBe(true);
    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
  });

  it('allows custom actions to be registered dynamically without modifying core player controller', () => {
    interface WhirlwindArgs {
      radius: number;
    }

    let whirlwindExecuted = false;

    const whirlwindAction: GameAction<WhirlwindArgs> = {
      id: 'custom_whirlwind',
      name: 'Whirlwind Slash',
      validate(_actor, args) {
        if (args.radius <= 0) {
          return { valid: false, reason: 'Invalid radius.' };
        }
        return { valid: true };
      },
      calculateEnergyCost(actor) {
        return actor.getActionCost(150);
      },
      execute(actor, args, eng) {
        whirlwindExecuted = true;
        eng.log(`${actor.name} unleashes a Whirlwind Slash with radius ${args.radius}!`);
        return {
          success: true,
          cost: 150,
          message: 'Whirlwind executed!',
        };
      },
    };

    ActionRegistry.register(whirlwindAction);
    expect(ActionRegistry.has('custom_whirlwind')).toBe(true);

    const res = ActionRegistry.execute('custom_whirlwind', player, { radius: 2 }, engine);
    expect(res.success).toBe(true);
    expect(res.cost).toBe(150);
    expect(whirlwindExecuted).toBe(true);
    expect(engine.messages.some((m) => m.includes('Whirlwind Slash with radius 2'))).toBe(true);
  });

  it('rejects execution if action validation fails', () => {
    const failingAction: GameAction = {
      id: 'teleport_out',
      validate() {
        return { valid: false, reason: 'Dimensional anchor prevents teleportation!' };
      },
      calculateEnergyCost() {
        return 100;
      },
      execute() {
        return { success: true, cost: 100 };
      },
    };

    ActionRegistry.register(failingAction);
    const res = ActionRegistry.execute('teleport_out', player, {}, engine);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Dimensional anchor prevents teleportation!');
  });
});
