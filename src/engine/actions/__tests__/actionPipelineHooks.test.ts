import { describe, it, expect, beforeEach } from 'vitest';
import { ActionPipeline, type ActionHook } from '../actionPipeline';
import type { Action } from '../action';
import type { ActionResult } from '../../types';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { createTestKobold } from '../../__fixtures__/testHelpers';
import { MovementAction } from '../movement';
import { MeleeAttackAction } from '../combat';
import { WaitAction } from '../wait';
import { warcraftManifest, WARCRAFT_ACTION_HOOKS } from '../../../content/warcraft';
import type { GameContentManifest } from '../../types/manifest';
import { flightRecorder } from '../../debug/flightRecorder';

describe('Action Pipeline Hooks & Manifest Integration (Phase 3)', () => {
  let pipeline: ActionPipeline;
  let mockEngine: GameEngine;

  function createTestEngine(manifest?: Partial<GameContentManifest>) {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
    });
    const engine = new GameEngine({
      map,
      player,
      manifest: manifest as any,
    });
    return { engine, player, map };
  }

  beforeEach(() => {
    pipeline = new ActionPipeline();
    const setup = createTestEngine();
    mockEngine = setup.engine;
  });

  describe('Core ActionPipeline Unit Tests', () => {
    it('executes actions normally when no hooks are registered', () => {
      const action: Action = {
        perform: () => ({ success: true, cost: 100, message: 'Done' }),
      };
      const result = pipeline.executeWithHooks(action, mockEngine);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(100);
      expect(result.message).toBe('Done');
    });

    it('aliases execute to executeWithHooks', () => {
      const action: Action = {
        perform: () => ({ success: true, cost: 50 }),
      };
      expect(pipeline.execute(action, mockEngine)).toEqual({ success: true, cost: 50 });
    });

    it('allows a pre-hook to short-circuit execution', () => {
      let performed = false;
      const action: Action = {
        perform: () => {
          performed = true;
          return { success: true, cost: 100 };
        },
      };

      const blockHook: ActionHook = {
        id: 'block-all',
        phase: 'pre',
        actionType: '*',
        execute: () => ({
          proceed: false,
          result: { success: false, cost: 0, message: 'Blocked by magic barrier!' },
        }),
      };

      pipeline.registerHook(blockHook);
      const result = pipeline.executeWithHooks(action, mockEngine);

      expect(performed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toBe('Blocked by magic barrier!');
    });

    it('continues execution when pre-hook returns proceed: true', () => {
      let performed = false;
      let hookRan = false;

      const action: Action = {
        perform: () => {
          performed = true;
          return { success: true, cost: 100, message: 'Completed' };
        },
      };

      const passHook: ActionHook = {
        id: 'pass-hook',
        phase: 'pre',
        actionType: '*',
        execute: () => {
          hookRan = true;
          return { proceed: true };
        },
      };

      pipeline.registerHook(passHook);
      const result = pipeline.executeWithHooks(action, mockEngine);

      expect(hookRan).toBe(true);
      expect(performed).toBe(true);
      expect(result.success).toBe(true);
    });

    it('executes post-hooks observing action results', () => {
      let observedResult: ActionResult | undefined;
      let observedType = '';

      const action: Action = {
        perform: () => ({ success: true, cost: 120, message: 'Melee hit' }),
      };

      const auditHook: ActionHook = {
        id: 'audit',
        phase: 'post',
        actionType: '*',
        execute: (ctx) => {
          observedResult = ctx.result;
          observedType = ctx.actionType;
        },
      };

      pipeline.registerHook(auditHook);
      const result = pipeline.executeWithHooks(action, mockEngine);

      expect(result.success).toBe(true);
      expect(observedResult).toBeDefined();
      expect(observedResult?.cost).toBe(120);
      expect(observedResult?.message).toBe('Melee hit');
      expect(observedType).toBeDefined();
    });

    it('respects hook priority order (lower number runs first)', () => {
      const callOrder: string[] = [];

      pipeline.registerHook({
        id: 'hook-second',
        phase: 'pre',
        priority: 50,
        execute: () => {
          callOrder.push('second');
          return { proceed: true };
        },
      });

      pipeline.registerHook({
        id: 'hook-first',
        phase: 'pre',
        priority: 10,
        execute: () => {
          callOrder.push('first');
          return { proceed: true };
        },
      });

      pipeline.registerHook({
        id: 'hook-third',
        phase: 'pre',
        priority: 100,
        execute: () => {
          callOrder.push('third');
          return { proceed: true };
        },
      });

      pipeline.executeWithHooks({ perform: () => ({ success: true, cost: 100 }) }, mockEngine);
      expect(callOrder).toEqual(['first', 'second', 'third']);
    });

    it('filters hooks by actionType (exact, prefix, and wildcard)', () => {
      let meleeHookRan = false;
      let movementHookRan = false;
      let wildcardHookRan = false;

      pipeline.registerHook({
        id: 'melee-hook',
        phase: 'pre',
        actionType: 'melee', // prefix matching MeleeAttackAction
        execute: () => {
          meleeHookRan = true;
          return { proceed: true };
        },
      });

      pipeline.registerHook({
        id: 'movement-hook',
        phase: 'pre',
        actionType: 'movement', // prefix matching MovementAction
        execute: () => {
          movementHookRan = true;
          return { proceed: true };
        },
      });

      pipeline.registerHook({
        id: 'all-hook',
        phase: 'pre',
        actionType: '*',
        execute: () => {
          wildcardHookRan = true;
          return { proceed: true };
        },
      });

      const moveAction = new MovementAction(mockEngine.player, 1, 0);
      pipeline.executeWithHooks(moveAction, mockEngine);

      expect(movementHookRan).toBe(true);
      expect(wildcardHookRan).toBe(true);
      expect(meleeHookRan).toBe(false);
    });

    it('supports unregistering hooks and clearing all hooks', () => {
      let ran = false;
      const hook: ActionHook = {
        id: 'temp-hook',
        phase: 'pre',
        execute: () => {
          ran = true;
          return { proceed: true };
        },
      };

      pipeline.registerHook(hook);
      expect(pipeline.getHooks('pre').length).toBe(1);

      pipeline.unregisterHook('temp-hook');
      expect(pipeline.getHooks('pre').length).toBe(0);

      pipeline.executeWithHooks({ perform: () => ({ success: true, cost: 100 }) }, mockEngine);
      expect(ran).toBe(false);

      pipeline.registerHooks([hook, { ...hook, id: 'temp-2' }]);
      expect(pipeline.getHooks().length).toBe(2);
      pipeline.clearHooks();
      expect(pipeline.getHooks().length).toBe(0);
    });
  });

  describe('GameEngine & Manifest Action Hook Integration', () => {
    it('automatically registers manifest.actionHooks during engine construction', () => {
      let hookTriggered = false;

      const customHook: ActionHook = {
        id: 'test-manifest-hook',
        phase: 'post',
        actionType: '*',
        execute: () => {
          hookTriggered = true;
        },
      };

      const { engine, player } = createTestEngine({
        id: 'test-theme',
        name: 'Test Theme',
        actionHooks: [customHook],
      });

      expect(engine.actionPipeline.getHooks().some(h => h.id === 'test-manifest-hook')).toBe(true);

      engine.handlePlayerAction(new WaitAction(player));
      expect(hookTriggered).toBe(true);
    });

    it('allows a manifest pre-hook to short-circuit handlePlayerAction (e.g. Pacifist or Root)', () => {
      const rootHook: ActionHook = {
        id: 'entangling-roots',
        phase: 'pre',
        actionType: 'movement',
        execute: (ctx) => {
          ctx.engine.log('Entangling roots bind your feet to the earth!');
          return {
            proceed: false,
            result: { success: false, cost: 0, message: 'You cannot move while rooted!' },
          };
        },
      };

      const { engine, player } = createTestEngine({
        id: 'rooted-theme',
        name: 'Rooted Theme',
        actionHooks: [rootHook],
      });

      const initialPos = { x: player.x, y: player.y };
      const moveAction = new MovementAction(player, 1, 0);
      const result = engine.handlePlayerAction(moveAction);

      expect(result.success).toBe(false);
      expect(result.message).toContain('You cannot move while rooted');
      expect(engine.messages).toContain('Entangling roots bind your feet to the earth!');
      // Player did not move
      expect(player.x).toBe(initialPos.x);
      expect(player.y).toBe(initialPos.y);
    });

    it('wires WARCRAFT_ACTION_HOOKS in warcraftManifest correctly', () => {
      expect(warcraftManifest.actionHooks).toBeDefined();
      expect(warcraftManifest.actionHooks).toEqual(WARCRAFT_ACTION_HOOKS);

      const { engine, player } = createTestEngine(warcraftManifest);
      expect(engine.actionPipeline.getHooks().some(h => h.id === 'warcraft-battle-cry')).toBe(true);

      const orc = createTestKobold('grunt', { x: 5, y: 6 });
      engine.addEntity(orc);

      const melee = new MeleeAttackAction(player, orc);
      const actionRes = engine.handlePlayerAction(melee);
      expect(actionRes.success).toBe(true);
      expect(orc.hp).toBeLessThan(orc.maxHp);
    });
  });

  describe('Failure Isolation Contract (Gap 2)', () => {
    it('isolates content-style pre-hook exception: returns success: false, logs error, and trips CI counter', () => {
      const explodingHook: ActionHook = {
        id: 'exploding-content-hook',
        phase: 'pre',
        actionType: '*',
        execute: () => {
          throw new Error('CONTENT_HANDLER_CRASH_SIMULATION');
        },
      };

      const { engine, player } = createTestEngine({
        id: 'chaos-content-pack',
        name: 'Chaos Content Pack',
        actionHooks: [explodingHook],
      });

      const initialCounter = engine.actionPipeline.caughtExceptionCount;
      const initialPlayerHp = player.hp;
      const waitAction = new WaitAction(player);

      // (a) executeWithHooks returns success: false and cost: 0 rather than throwing out of the test
      let result: ActionResult | undefined;
      expect(() => {
        result = engine.handlePlayerAction(waitAction);
      }).not.toThrow();

      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.cost).toBe(0);
      expect(result!.pipelineError).toBe(true);
      expect(result!.message).toContain('unexpected error');
      expect(player.hp).toBe(initialPlayerHp);

      // (b) Error was recorded to flight recorder telemetry with debug context
      const recentErrors = flightRecorder
        .getEvents()
        .filter((e) => e.type === 'error' && (e.details as any)?.source === 'ActionPipeline.executeWithHooks');
      expect(recentErrors.length).toBeGreaterThan(0);
      const lastErr = recentErrors[recentErrors.length - 1];
      expect(lastErr.summary).toContain('CONTENT_HANDLER_CRASH_SIMULATION');
      expect((lastErr.details as any)?.actionType).toBe('WaitAction');
      expect((lastErr.details as any)?.hookId).toBe('exploding-content-hook');

      // (c) An equivalent scenario run through the chaos runner's Step 4 counter actually fails the run
      expect(engine.actionPipeline.caughtExceptionCount).toBe(initialCounter + 1);

      // Emulate chaos runner's Step 4 assertion to prove it fails loud rather than passing silently
      const assertChaosRunnerZeroExceptions = (eng: GameEngine) => {
        const count = eng.actionPipeline.caughtExceptionCount;
        if (count > 0) {
          throw new Error(
            `Chaos runner failure: ${count} action pipeline exception(s) caught and suppressed during simulation!`
          );
        }
      };

      expect(() => assertChaosRunnerZeroExceptions(engine)).toThrow(
        'Chaos runner failure: 1 action pipeline exception(s) caught and suppressed during simulation!'
      );
    });

    it('isolates action.perform() engine exception: returns success: false, cost: 0, and increments counter', () => {
      const { engine } = createTestEngine();
      const faultyAction: Action = {
        perform: () => {
          throw new Error('ENGINE_ACTION_INTERNAL_FAULT');
        },
      };

      let result: ActionResult | undefined;
      expect(() => {
        result = engine.actionPipeline.executeWithHooks(faultyAction, engine);
      }).not.toThrow();

      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.cost).toBe(0);
      expect(result!.pipelineError).toBe(true);

      const recentErrors = flightRecorder
        .getEvents()
        .filter((e) => e.type === 'error' && (e.details as any)?.source === 'ActionPipeline.executeWithHooks');
      const lastErr = recentErrors[recentErrors.length - 1];
      expect(lastErr.summary).toContain('ENGINE_ACTION_INTERNAL_FAULT');
    });

    it('isolates post-hook exception: returns success: false, cost: 0, and logs error', () => {
      const faultyPostHook: ActionHook = {
        id: 'faulty-post-hook',
        phase: 'post',
        actionType: '*',
        execute: () => {
          throw new Error('POST_HOOK_METRICS_CRASH');
        },
      };

      const { engine, player } = createTestEngine({
        id: 'faulty-post-pack',
        name: 'Faulty Post Pack',
        actionHooks: [faultyPostHook],
      });

      const waitAction = new WaitAction(player);
      let result: ActionResult | undefined;
      expect(() => {
        result = engine.handlePlayerAction(waitAction);
      }).not.toThrow();

      expect(result!.success).toBe(false);
      expect(result!.cost).toBe(0);
      expect(result!.pipelineError).toBe(true);

      const recentErrors = flightRecorder
        .getEvents()
        .filter((e) => e.type === 'error' && (e.details as any)?.hookId === 'faulty-post-hook');
      expect(recentErrors.length).toBeGreaterThan(0);
    });
  });
});
