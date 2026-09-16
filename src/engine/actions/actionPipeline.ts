import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import type { Entity } from '../entities/entity';
import { flightRecorder } from '../debug/flightRecorder';

export interface ActionHookContext {
  action: Action;
  engine: GameEngine;
  actionType: string;  // Constructor name or registered type
  /**
   * The entity performing the action. Hooks fire for every actor (§4), so content that
   * should only react to the player must compare this against `engine.player`.
   */
  actor: Entity;
  result?: ActionResult;  // Only available in 'post' phase
}

export type ActionHookResult = 
  | { proceed: true }  // Continue normal execution
  | { proceed: false; result: ActionResult };  // Short-circuit with custom result

export type ActionHookPhase = 'pre' | 'post';

export interface ActionHook {
  readonly id?: string;
  readonly phase: ActionHookPhase;
  /** Match specific action types (e.g. 'melee', 'MovementAction'), or '*' / undefined for all actions. */
  readonly actionType?: string;
  /** Lower priority runs first. Default 100. */
  readonly priority?: number;
  execute(context: ActionHookContext): ActionHookResult | void;
}

function matchesActionType(filter: string | undefined, actionType: string, action: Action): boolean {
  if (!filter || filter === '*' || filter === '') return true;
  const filterLower = filter.toLowerCase();
  const typeLower = actionType.toLowerCase();

  if (filterLower === typeLower) return true;

  // Prefix matching e.g. 'melee' matches 'MeleeAttackAction', 'movement' matches 'MovementAction'
  if (typeLower.startsWith(filterLower)) return true;

  // Custom actionType or type property on the action instance
  const customType = (action as any).actionType ?? (action as any).type;
  if (typeof customType === 'string' && customType.toLowerCase() === filterLower) return true;

  return false;
}

export class ActionPipeline {
  private preHooks: ActionHook[] = [];
  private postHooks: ActionHook[] = [];
  private hookCounter = 0;

  /** Total exceptions caught and isolated within this ActionPipeline instance */
  public caughtExceptionCount = 0;
  /** Global counter of isolated action pipeline exceptions for telemetry & CI asserting */
  public static totalCaughtExceptions = 0;

  public resetCaughtExceptionCount(): void {
    this.caughtExceptionCount = 0;
  }

  public static resetTotalCaughtExceptions(): void {
    ActionPipeline.totalCaughtExceptions = 0;
  }

  public registerHook(hook: ActionHook): void {
    const hookWithId: ActionHook = hook.id ? hook : { ...hook, id: `hook_${++this.hookCounter}` };
    const list = hookWithId.phase === 'pre' ? this.preHooks : this.postHooks;
    list.push(hookWithId);
    list.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  public registerHooks(hooks: readonly ActionHook[]): void {
    for (const hook of hooks) {
      this.registerHook(hook);
    }
  }

  public unregisterHook(hookId: string): boolean {
    const preIdx = this.preHooks.findIndex(h => h.id === hookId);
    if (preIdx >= 0) { this.preHooks.splice(preIdx, 1); return true; }
    const postIdx = this.postHooks.findIndex(h => h.id === hookId);
    if (postIdx >= 0) { this.postHooks.splice(postIdx, 1); return true; }
    return false;
  }

  public clearHooks(): void {
    this.preHooks = [];
    this.postHooks = [];
  }

  public getHooks(phase?: ActionHookPhase): readonly ActionHook[] {
    if (phase === 'pre') return this.preHooks;
    if (phase === 'post') return this.postHooks;
    return [...this.preHooks, ...this.postHooks];
  }

  /**
   * Execute an action through the hook pipeline with full failure isolation.
   * Pre-hooks can short-circuit. Post-hooks observe results.
   * If any pre-hook, action logic, or post-hook throws, the exception is caught,
   * recorded to telemetry/logging, and rejected cleanly with { success: false, cost: 0 }.
   */
  /** Resolves the acting entity, mirroring how handlePipelineError attributes failures. */
  private static resolveActor(action: Action, engine: GameEngine): Entity {
    return (
      (action as any)?.entity ??
      (action as any)?.attacker ??
      (action as any)?.actor ??
      (action as any)?.player ??
      engine?.player
    );
  }

  public executeWithHooks(action: Action, engine: GameEngine): ActionResult {
    try {
      const actionType = (action as any)?.actionType ?? action?.constructor?.name ?? 'Action';
      const actor = ActionPipeline.resolveActor(action, engine);

      // 1. Pre-hooks execution boundary
      for (const hook of this.preHooks) {
        if (!matchesActionType(hook.actionType, actionType, action)) continue;
        try {
          const hookResult = hook.execute({ action, engine, actionType, actor });
          if (hookResult && !hookResult.proceed) {
            // Untyped content can short-circuit without a result; returning it would crash the caller.
            if (!ActionPipeline.isActionResult(hookResult.result)) {
              throw new Error('Pre-hook short-circuited without a valid ActionResult');
            }
            return hookResult.result;
          }
        } catch (err) {
          return this.handlePipelineError(err, action, engine, actionType, 'pre-hook', hook.id);
        }
      }

      // 2. Core action execution boundary
      let result: ActionResult;
      try {
        result = action.perform(engine);
        if (!ActionPipeline.isActionResult(result)) {
          throw new Error(`${actionType}.perform() did not return a valid ActionResult`);
        }
      } catch (err) {
        return this.handlePipelineError(err, action, engine, actionType, 'action-perform');
      }

      // 3. Post-hooks execution boundary
      for (const hook of this.postHooks) {
        if (!matchesActionType(hook.actionType, actionType, action)) continue;
        try {
          const hookResult = hook.execute({ action, engine, actionType, actor, result });
          if (hookResult && !hookResult.proceed) {
            if (!ActionPipeline.isActionResult(hookResult.result)) {
              throw new Error('Post-hook replaced the result without a valid ActionResult');
            }
            result = hookResult.result;
          }
        } catch (err) {
          return this.handlePipelineError(err, action, engine, actionType, 'post-hook', hook.id);
        }
      }

      return result;
    } catch (topLevelErr) {
      return this.handlePipelineError(topLevelErr, action, engine, 'UnknownAction', 'pipeline-top-level');
    }
  }

  private static isActionResult(value: unknown): value is ActionResult {
    return typeof value === 'object' && value !== null && typeof (value as ActionResult).success === 'boolean';
  }

  /**
   * Records an exception isolated at a failure boundary: counters, flight recorder, and
   * narrative log. Shared by `executeWithHooks` and the engine's monster-turn boundary so
   * every isolated failure trips the same CI counters (`caughtExceptionCount`).
   */
  public recordIsolatedFailure(
    err: unknown,
    engine: GameEngine,
    context: { entityId: string; actionType: string; phase: string; source: string; hookId?: string },
    logMessage: string
  ): void {
    this.caughtExceptionCount += 1;
    ActionPipeline.totalCaughtExceptions += 1;

    const error = err instanceof Error ? err : new Error(String(err));
    flightRecorder.recordError(error, { ...context });

    if (typeof engine?.log === 'function') {
      engine.log(logMessage);
    }
  }

  private handlePipelineError(
    err: unknown,
    action: Action,
    engine: GameEngine,
    actionType: string,
    phase: string,
    hookId?: string
  ): ActionResult {
    const entityId =
      (action as any)?.entity?.id ??
      (action as any)?.attacker?.id ??
      (action as any)?.actor?.id ??
      (action as any)?.player?.id ??
      engine?.player?.id ??
      'unknown';
    const message = 'An unexpected error occurred; the action could not be completed.';

    this.recordIsolatedFailure(
      err,
      engine,
      { entityId, actionType, phase, hookId, source: 'ActionPipeline.executeWithHooks' },
      message
    );

    return {
      success: false,
      cost: 0,
      message,
      pipelineError: true,
    };
  }

  /**
   * Alias for executeWithHooks for backward compatibility.
   */
  public execute(action: Action, engine: GameEngine): ActionResult {
    return this.executeWithHooks(action, engine);
  }
}
