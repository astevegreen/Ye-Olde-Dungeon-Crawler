import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { TrapInstance } from '../../dungeon/traps';
import { DisarmTrapAction } from '../disarm';

/**
 * R-pipe-13: a failed disarm spends the hero's energy, but `handlePlayerAction` ran the
 * turn's bookkeeping only for a successful action, so the turn count, status ticks and
 * timers stood still while the monsters still moved on the next keypress.
 */
describe('R-pipe-13 · an action that spends energy is a turn, even when it fails', () => {
  it('a failed disarm advances the turn', () => {
    const map = GameMap.createBoxRoom(12, 12);
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 },
      dexterity: 3,
      intelligence: 3,
    });
    const engine = new GameEngine({ map, player, floor: 1 });
    // Beyond any d20 roll: the attempt always fails (and springs the alarm, which harms nobody).
    map.addTrap(new TrapInstance({ id: 't', type: 'alarm', x: 6, y: 5, revealed: true, disarmDifficulty: 99 }));
    const turn = engine.turnCount;

    const result = engine.handlePlayerAction(new DisarmTrapAction(player, 6, 5));

    expect(result.success).toBe(false);
    expect(result.cost).toBeGreaterThan(0);
    expect(engine.turnCount).toBe(turn + 1);
  });

  it('an action refused without spending energy is still no turn', () => {
    const map = GameMap.createBoxRoom(12, 12);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player, floor: 1 });
    const turn = engine.turnCount;

    const result = engine.handlePlayerAction(new DisarmTrapAction(player, 6, 5));

    expect(result.cost).toBe(0);
    expect(engine.turnCount).toBe(turn);
  });
});
