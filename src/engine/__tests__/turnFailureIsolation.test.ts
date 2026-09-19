import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { WaitAction } from '../actions/wait';
import { flightRecorder } from '../debug/flightRecorder';
import type { ActionResult } from '../types';

const THROWING_ROUTINE = 'test_throwing_routine';
const FAULTY_STATUS = 'test_faulty_status';

function buildEngine(manifest?: any) {
  const map = new GameMap(14, 14, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 2, y: 2 },
    stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 },
  });
  const fullManifest = manifest ? { id: 'test_manifest', name: 'Test Manifest', ...manifest } : undefined;
  const engine = new GameEngine({ map, player, manifest: fullManifest });
  return { engine, player };
}

function addMonster(
  engine: GameEngine,
  id: string,
  position: { x: number; y: number },
  extra: Record<string, unknown> = {}
): Monster {
  const monster = new Monster({
    id,
    name: id,
    position,
    stats: { hp: 30, maxHp: 30, attack: 1, defense: 0 },
    speed: 100,
    definitionId: id,
    aiType: 'melee',
    aiState: 'hunting',
    fleeHealthPercent: 0,
    xpValue: 1,
    lootTable: [],
    ...extra,
  });
  engine.addEntity(monster);
  return monster;
}

function lastMonsterTurnError() {
  const errors = flightRecorder
    .getEvents()
    .filter((e) => e.type === 'error' && (e.details as any)?.phase === 'monster-turn');
  return errors[errors.length - 1];
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('Whole-turn failure isolation: monster turns (ARCHITECTURE.md P-06)', () => {
  it('isolates a throwing monster AI routine, surfaces it as pipelineError, and does not spin the scheduler', () => {
    const { engine, player } = buildEngine({
      aiStrategies: [
        {
          id: THROWING_ROUTINE,
          name: 'Throwing Routine',
          decideAction: () => {
            throw new Error('AI_ROUTINE_FAULT');
          },
        },
      ],
    });
    const faulty = addMonster(engine, 'faulty-ai', { x: 10, y: 10 }, { aiRoutineId: THROWING_ROUTINE });
    const failuresBefore = engine.actionPipeline.caughtExceptionCount;

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expect(result!.pipelineError).toBe(true);
    expect(engine.lastActionResult?.pipelineError).toBe(true);

    // One monster, same speed as the player: one (at most two) failed turns per player turn.
    // Without energy consumption on failure the same monster is reselected up to 5000 times.
    const isolated = engine.actionPipeline.caughtExceptionCount - failuresBefore;
    expect(isolated).toBeGreaterThanOrEqual(1);
    expect(isolated).toBeLessThanOrEqual(2);

    const recorded = lastMonsterTurnError();
    expect(recorded.summary).toContain('AI_ROUTINE_FAULT');
    expect((recorded.details as any)?.entityId).toBe(faulty.id);
    expect(player.canAct()).toBe(true);
  });

  it('isolates a throwing status handler ticking on a monster', () => {
    const { engine, player } = buildEngine({
      statusHandlers: {
        [FAULTY_STATUS]: {
          onTick: () => {
            throw new Error('STATUS_TICK_FAULT');
          },
        },
      },
    });
    const afflicted = addMonster(engine, 'afflicted', { x: 10, y: 10 });
    afflicted.statusManager.applyStatus({ type: FAULTY_STATUS, duration: 5 }, [], afflicted, engine);

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expect(result!.pipelineError).toBe(true);
    expect(lastMonsterTurnError().summary).toContain('STATUS_TICK_FAULT');
  });

  it('keeps other monsters acting after one monster turn fails', () => {
    const { engine, player } = buildEngine({
      aiStrategies: [
        {
          id: THROWING_ROUTINE,
          name: 'Throwing Routine',
          decideAction: () => {
            throw new Error('AI_ROUTINE_FAULT');
          },
        },
      ],
    });
    addMonster(engine, 'a-faulty', { x: 12, y: 12 }, { aiRoutineId: THROWING_ROUTINE });
    const healthy = addMonster(engine, 'b-healthy', { x: 9, y: 2 });
    const startDistance = chebyshev(healthy, player);

    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));

    expect(chebyshev(healthy, player)).toBeLessThan(startDistance);
  });
});
