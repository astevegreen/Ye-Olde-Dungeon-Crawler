import { describe, expect, it } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { TrapInstance } from '../../dungeon/traps';
import { createTestKobold } from '../../__fixtures__/testHelpers';
import { findFleeStep, findPath } from '../pathfinding';
import { stepAlongDistanceField } from '../distanceField';
import { flankAction } from '../packTactics';
import { huntUnseenAction } from '../pursuit';
import type { Monster } from '../../entities/monster';

/**
 * Trap review T3: monsters walked onto traps the hero had found, so a revealed pit between the
 * hero and a pack killed shallow monsters one by one, each paying XP. A revealed trap that isn't
 * disarmed is now a wall to every way a monster picks a step, as it is to the hero's travel.
 */

/** A 1-wide corridor along y = 2 from x = 1 to x = 18; `pitAt` puts a trap at (pitAt, 2). */
function corridor(pitAt: number, trap: { revealed: boolean; disarmed?: boolean }) {
  const map = new GameMap(20, 5, TILES.WALL);
  for (let x = 1; x < 19; x++) map.setTile(x, 2, TILES.FLOOR);
  const pit = new TrapInstance({ id: 'pit', type: 'pit', x: pitAt, y: 2, damage: 50, ...trap });
  map.addTrap(pit);
  return { map, pit };
}

/** A 20x7 room; a revealed pit at (10, 3), right on the straight line from (3, 3) to (17, 3). */
function roomWithPit() {
  const map = GameMap.createBoxRoom(20, 7);
  const pit = new TrapInstance({ id: 'pit', type: 'pit', x: 10, y: 3, damage: 50, revealed: true });
  map.addTrap(pit);
  return { map, pit };
}

const onPit = (p: { x: number; y: number }, pit: TrapInstance) => p.x === pit.x && p.y === pit.y;

describe('T3 · monsters step round the traps the hero has revealed', () => {
  it('a path goes round a revealed trap in the open', () => {
    const { map, pit } = roomWithPit();
    const path = findPath(map, { x: 3, y: 3 }, { x: 17, y: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => onPit(p, pit))).toBe(false);
  });

  it('a revealed trap that fills a corridor leaves no path', () => {
    const { map } = corridor(10, { revealed: true });
    expect(findPath(map, { x: 2, y: 2 }, { x: 17, y: 2 })).toEqual([]);
  });

  it('a hidden or disarmed trap is no obstacle', () => {
    expect(findPath(corridor(10, { revealed: false }).map, { x: 2, y: 2 }, { x: 17, y: 2 })).toHaveLength(15);
    expect(findPath(corridor(10, { revealed: true, disarmed: true }).map, { x: 2, y: 2 }, { x: 17, y: 2 })).toHaveLength(15);
  });

  it('a hero standing on a revealed trap can still be reached', () => {
    const { map } = corridor(10, { revealed: true });
    expect(findPath(map, { x: 2, y: 2 }, { x: 10, y: 2 })).toHaveLength(8);
  });

  it('the distance field a far monster follows does not lead across a revealed trap', () => {
    const { map } = corridor(10, { revealed: true });
    expect(stepAlongDistanceField(map, { x: 9, y: 2 }, { x: 17, y: 2 }, 1)).toBeNull();
    const room = roomWithPit();
    expect(stepAlongDistanceField(room.map, { x: 9, y: 3 }, { x: 17, y: 3 }, 1)).not.toEqual({ x: 10, y: 3 });
  });

  it('a fleeing monster does not jump into a revealed trap', () => {
    const { map, pit } = corridor(10, { revealed: true });
    expect(findFleeStep(map, { x: 9, y: 2 }, { x: 8, y: 2 })).toBeNull();
    expect(onPit(findFleeStep(map, { x: 11, y: 2 }, { x: 12, y: 2 }) ?? { x: -1, y: -1 }, pit)).toBe(false);
  });

  it('a pack flanker does not plan its way across a revealed trap', () => {
    const { map } = corridor(10, { revealed: true });
    const player = new Player({ position: { x: 14, y: 2 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
    const kobold = createTestKobold('flanker', { x: 6, y: 2 });
    map.addEntity(player);
    map.addEntity(kobold);
    const engine = new GameEngine({ map, player });
    expect(flankAction(engine, kobold, player)).toBeNull();
  });

  it('a searching monster does not wander onto a revealed trap', () => {
    // A 3x3 pocket: the monster in the middle, every neighbour a revealed trap.
    const map = new GameMap(12, 12, TILES.WALL);
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) map.setTile(x, y, TILES.FLOOR);
    for (let y = 4; y <= 6; y++) {
      for (let x = 4; x <= 6; x++) {
        if (x !== 5 || y !== 5) map.addTrap(new TrapInstance({ id: `t${x}${y}`, type: 'pit', x, y, revealed: true }));
      }
    }
    map.setTile(10, 10, TILES.FLOOR);
    const player = new Player({ position: { x: 10, y: 10 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
    const kobold: Monster = createTestKobold('searcher', { x: 5, y: 5 });
    map.addEntity(player);
    map.addEntity(kobold);
    const engine = new GameEngine({ map, player });
    kobold.pursuit = { x: 5, y: 5, searchTurns: 5, searching: true };

    for (let i = 0; i < 5; i++) {
      const action = huntUnseenAction(engine, kobold);
      expect(action.constructor.name).toBe('WaitAction');
    }
  });

  it('a hunting monster waits behind a revealed pit rather than walking in (the XP farm)', () => {
    const { map, pit } = corridor(10, { revealed: true });
    const player = new Player({ position: { x: 14, y: 2 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
    const kobold = createTestKobold('hunter', { x: 6, y: 2 });
    map.addEntity(player);
    map.addEntity(kobold);
    kobold.aiState = 'hunting';
    const engine = new GameEngine({ map, player });
    const hp = kobold.hp;

    for (let t = 0; t < 10; t++) kobold.takeTurn(engine);

    expect(pit.triggered).toBe(false);
    expect(kobold.hp).toBe(hp);
    expect(kobold.x).toBeLessThan(10);
  });
});
