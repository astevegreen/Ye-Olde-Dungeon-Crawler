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

/**
 * B2: standing on a trap already disarmed, Disarm scanned only the row in front of the hero
 * (dy = -1): the outer `break` tested the disarmed trap underfoot, so a known armed trap to
 * the west, east or south was missed and the game said it was "already been safely disarmed".
 */
describe('B2 · Disarm on a disarmed trap scans every neighbour', () => {
  const ALREADY = 'That trap has already been safely disarmed.';

  function setup(underfoot: boolean, armedAt: Array<[number, number]>, disarmedAround: Array<[number, number]> = []) {
    const map = GameMap.createBoxRoom(12, 12);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, dexterity: 3 });
    const engine = new GameEngine({ map, player, floor: 1 });
    if (underfoot) {
      map.addTrap(new TrapInstance({ id: 'under', type: 'alarm', x: 5, y: 5, revealed: true, disarmed: true }));
    }
    for (const [x, y] of disarmedAround) {
      map.addTrap(new TrapInstance({ id: `d${x}${y}`, type: 'alarm', x, y, revealed: true, disarmed: true }));
    }
    // Difficulty 1: any d20 roll jams it, so a disarmed trap proves the roll ran.
    const armed = armedAt.map(
      ([x, y]) => new TrapInstance({ id: `p${x}${y}`, type: 'pit', x, y, revealed: true, disarmDifficulty: 1 }),
    );
    for (const t of armed) map.addTrap(t);
    return { engine, player, armed };
  }

  it('finds an armed trap east of the hero', () => {
    const { engine, player, armed } = setup(true, [[6, 5]]);

    const result = engine.handlePlayerAction(new DisarmTrapAction(player));

    expect(result.message).not.toBe(ALREADY);
    expect(result.cost).toBeGreaterThan(0);
    expect(armed[0].disarmed).toBe(true);
  });

  it.each([
    ['south', 5, 6],
    ['south-west', 4, 6],
  ])('finds an armed trap %s of the hero', (_dir, x, y) => {
    const { engine, player, armed } = setup(true, [[x, y]]);

    const result = engine.handlePlayerAction(new DisarmTrapAction(player));

    expect(result.message).not.toBe(ALREADY);
    expect(result.cost).toBeGreaterThan(0);
    expect(armed[0].disarmed).toBe(true);
  });

  it('with nothing underfoot, still finds an armed trap east of the hero', () => {
    const { engine, player, armed } = setup(false, [[6, 5]]);

    const result = engine.handlePlayerAction(new DisarmTrapAction(player));

    expect(result.cost).toBeGreaterThan(0);
    expect(armed[0].disarmed).toBe(true);
  });

  it('with only disarmed traps underfoot and around, says so and spends nothing', () => {
    const { engine, player } = setup(true, [], [[6, 5], [5, 6], [4, 4]]);
    const turn = engine.turnCount;

    const result = engine.handlePlayerAction(new DisarmTrapAction(player));

    expect(result.message).toBe(ALREADY);
    expect(result.cost).toBe(0);
    expect(engine.turnCount).toBe(turn);
  });
});
