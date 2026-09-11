import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Action } from './action';

export interface ActionHookContext {
  action: Action;
  engine: GameEngine;
  actionType: string;  // Constructor name or registered type
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
   * Execute an action through the hook pipeline.
   * Pre-hooks can short-circuit. Post-hooks observe results.
   */
  public executeWithHooks(action: Action, engine: GameEngine): ActionResult {
    const actionType = (action as any).actionType ?? action.constructor.name;

    // Pre-hooks
    for (const hook of this.preHooks) {
      if (!matchesActionType(hook.actionType, actionType, action)) continue;
      const hookResult = hook.execute({ action, engine, actionType });
      if (hookResult && !hookResult.proceed) {
        return hookResult.result;
      }
    }

    // Core action execution
    let result = action.perform(engine);

    // Post-hooks
    for (const hook of this.postHooks) {
      if (!matchesActionType(hook.actionType, actionType, action)) continue;
      const hookResult = hook.execute({ action, engine, actionType, result });
      if (hookResult && !hookResult.proceed) {
        result = hookResult.result;
      }
    }

    return result;
  }

  /**
   * Alias for executeWithHooks for backward compatibility.
   */
  public execute(action: Action, engine: GameEngine): ActionResult {
    return this.executeWithHooks(action, engine);
  }
}
