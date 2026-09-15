import { describe, it, expect, vi } from 'vitest';
import { FloorManager } from '../floorManager';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';

const MAP_SIZE = 30;
const INTERVAL = 10;

function makeDef(overrides: Partial<MonsterDefinition> = {}): MonsterDefinition {
  return {
    id: 'cave_rat',
    name: 'Cave Rat',
    minFloor: 1,
    stats: { hp: 6, maxHp: 6, attack: 2, defense: 0 },
    speed: 100,
    xpValue: 5,
    aiType: 'melee',
    fleeHealthPercent: 0,
    lootTable: [],
    ...overrides,
  };
}

function makeEngine(monsters?: MonsterDefinition[]): { engine: GameEngine; floorManager: FloorManager } {
  const floorManager = new FloorManager({ clearedRespawnInterval: INTERVAL, maxBatchSpawns: 3 });
  const build = (manifest?: GameEngine['manifest']) =>
    new GameEngine({
      map: new GameMap(MAP_SIZE, MAP_SIZE, TILES.FLOOR),
      player: new Player({ id: 'tester', name: 'Tester', position: { x: 5, y: 5 } }),
      floor: 1,
      floorManager,
      manifest,
    });

  const base = build();
  const engine = monsters ? build({ ...base.manifest, monsters }) : base;
  return { engine, floorManager };
}

/** Advances the active floor one turn at a time, running the respawn check each turn. */
function advanceTurns(engine: GameEngine, floorManager: FloorManager, turns: number): void {
  for (let i = 0; i < turns; i++) {
    engine.map.floorTurnCount += 1;
    floorManager.checkClearedFloorRespawn(engine);
  }
}

describe('FloorManager.checkClearedFloorRespawn backoff', () => {
  it.each([
    ['an empty monster catalog', undefined],
    ['a catalog with no definition eligible for the floor', [makeDef({ minFloor: 5 })]],
  ])('does not rescan the map every turn with %s', (_label, monsters) => {
    const { engine, floorManager } = makeEngine(monsters);
    const isPassable = vi.spyOn(engine.map, 'isPassable');

    // Turn 0: floor has no monsters, so it is marked cleared.
    floorManager.checkClearedFloorRespawn(engine);
    expect(engine.map.isCleared).toBe(true);

    // Reach the respawn interval, then keep playing for three more intervals.
    advanceTurns(engine, floorManager, INTERVAL);
    const callsAtFirstAttempt = isPassable.mock.calls.length;

    advanceTurns(engine, floorManager, INTERVAL - 1);
    expect(isPassable.mock.calls.length).toBe(callsAtFirstAttempt);

    advanceTurns(engine, floorManager, INTERVAL * 2 + 1);
    const tilesPerScan = (MAP_SIZE - 2) * (MAP_SIZE - 2);
    // At most one scan per interval (turns 10, 20, 30, 40), never one per turn.
    expect(isPassable.mock.calls.length).toBeLessThanOrEqual(tilesPerScan * 4);
    expect(engine.map.isCleared).toBe(true);
  });

  it('backs off for a full interval when every spawn is rejected, then retries', () => {
    const { engine, floorManager } = makeEngine([makeDef()]);
    const isPassable = vi.spyOn(engine.map, 'isPassable');
    const addEntity = vi.spyOn(engine, 'addEntity').mockReturnValue(false);

    floorManager.checkClearedFloorRespawn(engine);
    advanceTurns(engine, floorManager, INTERVAL);

    const callsAfterFirstAttempt = isPassable.mock.calls.length;
    expect(callsAfterFirstAttempt).toBeGreaterThan(0);
    expect(addEntity).toHaveBeenCalled();
    expect(engine.map.lastRespawnTurn).toBe(INTERVAL);
    expect(engine.map.isCleared).toBe(true);

    // No rescans during the backoff window.
    advanceTurns(engine, floorManager, INTERVAL - 1);
    expect(isPassable.mock.calls.length).toBe(callsAfterFirstAttempt);

    // Retries once the interval elapses again.
    advanceTurns(engine, floorManager, 1);
    expect(isPassable.mock.calls.length).toBeGreaterThan(callsAfterFirstAttempt);
    expect(engine.map.lastRespawnTurn).toBe(INTERVAL * 2);
  });

  it('still spawns a batch and resets the cleared state when spawns succeed', () => {
    const { engine, floorManager } = makeEngine([makeDef()]);
    const log = vi.spyOn(engine, 'log');

    floorManager.checkClearedFloorRespawn(engine);
    advanceTurns(engine, floorManager, INTERVAL - 1);
    expect(engine.map.isCleared).toBe(true);

    engine.map.floorTurnCount += 1;
    const spawned = floorManager.checkClearedFloorRespawn(engine);

    expect(spawned).toHaveLength(3);
    expect(spawned.every((m) => m.aiState === 'sleeping')).toBe(true);
    expect(engine.map.lastRespawnTurn).toBe(INTERVAL);
    expect(engine.map.isCleared).toBe(false);
    expect(log).toHaveBeenCalledWith('You sense hostile presence returning to the shadowy halls...');
  });
});
