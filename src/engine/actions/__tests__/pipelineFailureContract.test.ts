import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { WaitAction } from '../wait';
import type { Action } from '../action';
import type { ActionHook } from '../actionPipeline';
import type { ActionResult } from '../../types';
import { flightRecorder } from '../../debug/flightRecorder';

function buildEngine(actionHooks: ActionHook[] = []) {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 2, y: 2 },
    stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
  });
  const engine = new GameEngine({
    map,
    player,
    manifest: { id: 'pipeline-contract', name: 'Pipeline Contract', actionHooks } as any,
  });
  return { engine, player };
}

function expectIsolatedFailure(result: ActionResult | undefined): void {
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
  expect(result!.success).toBe(false);
  expect(result!.cost).toBe(0);
  expect(result!.pipelineError).toBe(true);
}

function lastPipelineError() {
  const errors = flightRecorder
    .getEvents()
    .filter((e) => e.type === 'error' && (e.details as any)?.source === 'ActionPipeline.executeWithHooks');
  return errors[errors.length - 1];
}

describe('ActionPipeline failure contract: executeWithHooks always returns a valid ActionResult', () => {
  it('isolates a pre-hook that short-circuits without an ActionResult instead of returning undefined', () => {
    const malformedPreHook: ActionHook = {
      id: 'malformed-pre-hook',
      phase: 'pre',
      actionType: '*',
      execute: () => ({ proceed: false }) as any,
    };
    const { engine, player } = buildEngine([malformedPreHook]);

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expectIsolatedFailure(result);
    expect((lastPipelineError().details as any)?.phase).toBe('pre-hook');
    expect((lastPipelineError().details as any)?.hookId).toBe('malformed-pre-hook');
  });

  it('isolates a post-hook that replaces the result with a non-ActionResult', () => {
    const malformedPostHook: ActionHook = {
      id: 'malformed-post-hook',
      phase: 'post',
      actionType: '*',
      execute: () => ({ proceed: false, result: null }) as any,
    };
    const { engine, player } = buildEngine([malformedPostHook]);

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expectIsolatedFailure(result);
    expect((lastPipelineError().details as any)?.phase).toBe('post-hook');
  });

  it('isolates an action whose perform() returns no ActionResult', () => {
    const { engine } = buildEngine();
    const hollowAction: Action = { perform: () => undefined as unknown as ActionResult };

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.handlePlayerAction(hollowAction);
    }).not.toThrow();

    expectIsolatedFailure(result);
    expect((lastPipelineError().details as any)?.phase).toBe('action-perform');
  });

  it('catches an exception outside the per-phase boundaries at the top-level boundary', () => {
    const { engine } = buildEngine();
    const faultyAction = {
      get actionType(): string {
        throw new Error('ACTION_TYPE_GETTER_FAULT');
      },
      perform: (): ActionResult => ({ success: true, cost: 100 }),
    } as unknown as Action;

    let result: ActionResult | undefined;
    expect(() => {
      result = engine.actionPipeline.executeWithHooks(faultyAction, engine);
    }).not.toThrow();

    expectIsolatedFailure(result);
    const recorded = lastPipelineError();
    expect((recorded.details as any)?.phase).toBe('pipeline-top-level');
    expect(recorded.summary).toContain('ACTION_TYPE_GETTER_FAULT');
  });

  it('isolates and records non-Error thrown values', () => {
    const { engine } = buildEngine();
    const stringThrower: Action = {
      perform: () => {
        throw 'STRING_FAULT';
      },
    };
    const undefinedThrower: Action = {
      perform: () => {
        throw undefined;
      },
    };

    expectIsolatedFailure(engine.actionPipeline.executeWithHooks(stringThrower, engine));
    expect(lastPipelineError().summary).toContain('STRING_FAULT');

    expectIsolatedFailure(engine.actionPipeline.executeWithHooks(undefinedThrower, engine));
  });

  it('does not advance the world after an isolated player-action failure', () => {
    const { engine, player } = buildEngine();
    const monster = new Monster({
      id: 'watcher',
      name: 'Watcher',
      position: { x: 8, y: 8 },
      stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
      speed: 100,
      definitionId: 'watcher',
      aiType: 'melee',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(monster);

    const turnBefore = engine.turnCount;
    const monsterPos = { x: monster.x, y: monster.y };
    const monsterEnergy = monster.energy;
    const playerEnergy = player.energy;

    const faulty: Action = {
      perform: () => {
        throw new Error('PLAYER_ACTION_FAULT');
      },
    };
    const result = engine.handlePlayerAction(faulty);

    expectIsolatedFailure(result);
    expect(engine.turnCount).toBe(turnBefore);
    expect({ x: monster.x, y: monster.y }).toEqual(monsterPos);
    expect(monster.energy).toBe(monsterEnergy);
    expect(player.energy).toBe(playerEnergy);
  });
});
