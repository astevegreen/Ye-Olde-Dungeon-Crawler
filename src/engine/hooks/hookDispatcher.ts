import type { GameEngine } from '../engine';
import { afflictionDuration } from '../items/wornModifiers';
import type { EngineContext } from '../types/engineContext';
import type { Entity } from '../entities/entity';
import type { Item } from '../items/item';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import type { Predicate } from '../predicates/types';
import { evaluatePredicate } from '../predicates/predicateEvaluator';
import type { SurfaceType, GasType } from '../surfaces/surfaceGrid';
import type { ElementType } from '../magic/elements';
import type { Position } from '../types';
import { DeathResolver } from '../combat/deathResolver';
import { shrugsAffliction } from '../compendium/familyPerks';

export type HookEvent =
  | 'onHit'
  | 'onKill'
  | 'onBlock'
  | 'onDamageTaken'
  | 'onTurnStart'
  | 'onMove';

export type ActionPrimitive =
  | {
      type: 'applyStatus';
      status: string;
      duration: number;
      potency?: number;
      target?: 'self' | 'target';
    }
  | {
      type: 'spawnSurface';
      surfaceType: SurfaceType;
      radius?: number;
      duration?: number;
    }
  | {
      type: 'spawnGas';
      gasType: GasType;
      radius?: number;
      duration?: number;
    }
  | {
      type: 'heal';
      amount: number;
      target?: 'self' | 'target';
    }
  | {
      type: 'bonusDamage';
      amount: number;
      element?: ElementType;
    };

export interface HookDescriptor {
  event: HookEvent;
  chance?: number; // 0.0 - 1.0 (default 1.0)
  predicate?: Predicate;
  action: ActionPrimitive;
  description?: string;
}

/**
 * Built-in hook primitives are engine code, not content handlers: they resolve damage,
 * deaths, statuses and surfaces, which need the full engine. Content handlers only ever see
 * the scoped EngineContext (ARCHITECTURE.md §3); GameEngine is its only implementation, so
 * this one narrowing-cast keeps the content-facing contract tight without wrapping.
 */
function asGameEngine(context: EngineContext): GameEngine {
  return context as GameEngine;
}

export interface HookContext {
  /** Scoped engine surface (§3); not the whole GameEngine. */
  engine: EngineContext;
  attacker?: Entity;
  defender?: Entity;
  damage?: number;
  blockedDamage?: number;
  sourceItem?: Item;
  position?: Position;
}

export interface HookExecutionSummary {
  executedHooks: number;
  bonusDamage: number;
  messages: string[];
}

/** Executor function for one built-in primitive action type. */
type PrimitiveExecutor = (
  action: ActionPrimitive,
  ctx: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
) => void;

/**
 * The engine's built-in primitives, filled at the bottom of this module. There is no API to
 * add one: a new primitive is a generic engine capability (ARCHITECTURE.md §3).
 */
const primitiveExecutors = new Map<string, PrimitiveExecutor>();

export class HookDispatcher {
  private static recursionDepth = 0;
  private static readonly MAX_RECURSION_DEPTH = 3;

  /**
   * Dispatches combat and lifecycle events across equipped items, monster traits, and active pacts.
   */
  public static dispatch(event: HookEvent, context: HookContext): HookExecutionSummary {
    const summary: HookExecutionSummary = {
      executedHooks: 0,
      bonusDamage: 0,
      messages: [],
    };

    if (this.recursionDepth >= this.MAX_RECURSION_DEPTH) {
      return summary;
    }

    this.recursionDepth += 1;
    try {
      const hooksToExecute: { hook: HookDescriptor; sourceName: string; owner: Entity }[] = [];

      // 1. Gather hooks from relevant entities based on event
      if (event === 'onHit' || event === 'onKill') {
        if (context.attacker) {
          this.collectHooksFromEntity(context.attacker, event, hooksToExecute);
        }
      } else if (event === 'onBlock' || event === 'onDamageTaken') {
        if (context.defender) {
          this.collectHooksFromEntity(context.defender, event, hooksToExecute);
        }
      } else if (event === 'onMove' || event === 'onTurnStart') {
        const primary = context.attacker ?? context.defender;
        if (primary) {
          this.collectHooksFromEntity(primary, event, hooksToExecute);
        }
      }

      // 2. Evaluate and execute gathered hooks
      for (const item of hooksToExecute) {
        const { hook, sourceName, owner } = item;

        // Chance roll
        const chance = hook.chance ?? 1.0;
        const roll = context.engine.rng();
        if (chance < 1.0 && roll > chance) {
          continue;
        }

        // Predicate check against WorldState
        if (hook.predicate && !evaluatePredicate(hook.predicate, context.engine.worldState)) {
          continue;
        }

        // Execute action primitive
        const targetEntity = 'target' in hook.action && hook.action.target === 'self'
          ? owner
          : (owner === context.attacker ? context.defender : context.attacker);
        // Aimed at "the target" with no one there: nothing to aim at, so it doesn't land on the owner.
        if (!targetEntity && 'target' in hook.action && hook.action.target === 'target') {
          continue;
        }

        this.executePrimitive(hook.action, context, owner, targetEntity, summary, sourceName, hook.description);
        summary.executedHooks += 1;
      }
    } finally {
      this.recursionDepth -= 1;
    }

    return summary;
  }

  private static collectHooksFromEntity(
    entity: Entity,
    event: HookEvent,
    out: { hook: HookDescriptor; sourceName: string; owner: Entity }[]
  ): void {
    // A. Player equipped items
    if (entity instanceof Player) {
      const equippedItems = entity.inventory.paperdoll.getEquippedItems();
      for (const item of equippedItems) {
        for (const h of item.hooks ?? []) {
            if (h.event === event) {
              out.push({ hook: h, sourceName: item.name, owner: entity });
            }
        }
      }
    }

    // B. Monster traits / hooks
    if (entity instanceof Monster) {
      {
        for (const h of entity.hooks) {
          if (h.event === event) {
            out.push({ hook: h, sourceName: entity.name, owner: entity });
          }
        }
      }
    }
  }

  // Public so hookDispatcher.test.ts can stand in a re-dispatching or throwing primitive.
  public static executePrimitive(
    action: ActionPrimitive,
    ctx: HookContext,
    owner: Entity,
    target: Entity | undefined,
    summary: HookExecutionSummary,
    sourceName: string,
    description?: string
  ): void {
    const executor = primitiveExecutors.get(action.type);
    if (executor) {
      executor(action, ctx, owner, target, summary, sourceName, description);
    } else {
      ctx.engine.log(`[HookDispatcher] Unknown primitive action type: '${action.type}'`);
    }
  }
}

function executeApplyStatus(
  action: any,
  context: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const dest = target ?? owner;
  // A family perk may shrug off a status another's hook lays on the hero (Grave-Warden, Spirit-Ward).
  if (dest && dest !== owner && shrugsAffliction(engine, dest, owner, action.status)) return;
  if (dest && dest.isAlive()) {
    const applied = dest.statusManager.applyStatus(
      { type: action.status, duration: afflictionDuration(dest, action.status, action.duration), potency: action.potency },
      dest.statusImmunities,
      dest,
      engine
    );
    if (applied) {
      const msg = description ?? `[PROC: ${sourceName}] ${dest.name} is afflicted with ${action.status}!`;
      engine.log(msg);
      summary.messages.push(msg);
    }
  }
}

function executeSpawnSurface(
  action: any,
  context: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const pos = context.position ?? (target ? { x: target.x, y: target.y } : { x: owner.x, y: owner.y });
  const radius = action.radius ?? 1;
  const dur = action.duration ?? 6;
  for (let ry = -radius + 1; ry <= radius - 1; ry++) {
    for (let rx = -radius + 1; rx <= radius - 1; rx++) {
      const tx = pos.x + rx;
      const ty = pos.y + ry;
      if (engine.map.inBounds(tx, ty) && engine.map.isPassable(tx, ty)) {
        engine.surfaces.setSurface(tx, ty, action.surfaceType, dur);
      }
    }
  }
  const msg = description ?? `[PROC: ${sourceName}] A pool of ${action.surfaceType} spreads across the floor!`;
  engine.log(msg);
  summary.messages.push(msg);
}

function executeSpawnGas(
  action: any,
  context: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const pos = context.position ?? (target ? { x: target.x, y: target.y } : { x: owner.x, y: owner.y });
  const radius = action.radius ?? 1;
  const dur = action.duration ?? 4;
  for (let ry = -radius + 1; ry <= radius - 1; ry++) {
    for (let rx = -radius + 1; rx <= radius - 1; rx++) {
      const tx = pos.x + rx;
      const ty = pos.y + ry;
      if (engine.map.inBounds(tx, ty) && engine.map.isPassable(tx, ty)) {
        engine.surfaces.setGas(tx, ty, action.gasType, dur);
      }
    }
  }
  const msg = description ?? `[PROC: ${sourceName}] A billowing cloud of ${action.gasType} erupts!`;
  engine.log(msg);
  summary.messages.push(msg);
}

function executeHeal(
  action: any,
  context: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const dest = target ?? owner;
  if (dest && dest.isAlive()) {
    const healed = dest.heal(action.amount);
    const msg = description ?? `[PROC: ${sourceName}] ${dest.name} is revitalized for +${healed} HP!`;
    engine.log(msg);
    summary.messages.push(msg);
  }
}

function executeBonusDamage(
  action: any,
  context: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const dest = target;
  if (dest && dest.isAlive() && action.amount > 0) {
    // A declared element goes through the target's affinity, as a spell of it would; the
    // kill reports it, with the blow's size, so an elemental kill rite can count it.
    const element = action.element as ElementType | undefined;
    const hpBefore = dest.hp;
    const hit = element
      ? dest.takeElementalDamage(action.amount, element, engine.affinityMatrix)
      : { ...dest.takeDamage(action.amount), finalDamage: action.amount, isHeal: false, healed: 0 };
    const { damageDealt, killed } = hit;
    // What landed, after the target's affinity (an immune target took none).
    summary.bonusDamage += damageDealt;
    const elem = element ? ` ${element}` : '';
    const msg = hit.isHeal
      ? `[PROC: ${sourceName}] ${dest.name} is healed by the ${element} for ${hit.healed}!`
      : damageDealt === 0 && !killed && element
        ? `[PROC: ${sourceName}] ${dest.name} is unharmed by the ${element}.`
        : description ?? `[PROC: ${sourceName}] Striking with extra fury for ${damageDealt}${elem} bonus damage!`;
    engine.log(msg);
    summary.messages.push(msg);
    if (killed) {
      DeathResolver.resolveDeath(engine, owner, dest, {
        damageElement: element,
        damageDealt: hit.finalDamage,
        remainingHpBeforeBlow: hpBefore,
      });
    }
  }
}

primitiveExecutors.set('applyStatus', executeApplyStatus);
primitiveExecutors.set('spawnSurface', executeSpawnSurface);
primitiveExecutors.set('spawnGas', executeSpawnGas);
primitiveExecutors.set('heal', executeHeal);
primitiveExecutors.set('bonusDamage', executeBonusDamage);
