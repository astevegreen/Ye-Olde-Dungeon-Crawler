import type { GameEngine } from '../engine';
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
import { applyImpulse } from '../combat/impulse';
import { DeathResolver } from '../combat/deathResolver';
import { CastSpellAction } from '../actions/spell-actions';
import { findTaggedEntitiesInRadius } from '../combat/radialAuraFilter';

export type HookEvent =
  | 'onHit'
  | 'onKill'
  | 'onBlock'
  | 'onDamageTaken'
  | 'onTurnStart'
  | 'onMove'
  | 'onPlayerDefeated';

export type ActionPrimitive =
  | {
      type: 'applyStatus';
      status: string;
      duration: number;
      potency?: number;
      target?: 'self' | 'target';
    }
  | {
      type: 'castSpell';
      spellId: string;
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
      type: 'pushImpulse';
      distance: number;
      target?: 'self' | 'target';
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
    }
  | {
      /**
       * Tag-Filtered Radial Aura (docs/architecture/content-progression-scaling.md): finds living entities within
       * `radius` of the hook's position matching any of `tags` (via `Entity.hasTag()`,
       * bounded via `findTaggedEntitiesInRadius` per §6's scoping principle), and
       * applies `apply` to each match as its own target. The generic, reusable
       * primitive; which tags a holy torch or ward cares about is content data.
       */
      type: 'radialAuraFilter';
      radius: number;
      tags: string[];
      apply: ActionPrimitive;
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
 * deaths, impulses and spells, which need the full engine. Content handlers only ever see
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
  dx?: number;
  dy?: number;
  deathEnvelope?: any;
}

export interface HookExecutionSummary {
  executedHooks: number;
  bonusDamage: number;
  messages: string[];
}

/** Executor function for a registered primitive action type. */
export type PrimitiveExecutor = (
  action: ActionPrimitive,
  ctx: HookContext,
  owner: Entity,
  target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
) => void;

const primitiveExecutors = new Map<string, PrimitiveExecutor>();

export class HookDispatcher {
  private static recursionDepth = 0;
  private static readonly MAX_RECURSION_DEPTH = 3;
  private static globalHooks: HookDescriptor[] = [];

  public static registerGlobalHook(hook: HookDescriptor): void {
    this.globalHooks.push(hook);
  }

  public static clearGlobalHooks(): void {
    this.globalHooks = [];
  }

  /** Register a custom primitive executor. Allows content/themes to add new primitive action types. */
  public static registerPrimitive(type: string, executor: PrimitiveExecutor): void {
    primitiveExecutors.set(type, executor);
  }

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

      // 0. Global hooks matching this event
      for (const gh of this.globalHooks) {
        if (gh.event === event) {
          const owner = context.attacker ?? context.defender ?? context.engine.player;
          hooksToExecute.push({ hook: gh, sourceName: 'Global Rule', owner });
        }
      }

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

  // Public (not private) so the standalone `executeRadialAuraFilter` primitive
  // executor below can recurse into it for each tag-matched entity.
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
  if (dest && dest.isAlive()) {
    const applied = dest.statusManager.applyStatus(
      { type: action.status, duration: action.duration, potency: action.potency },
      dest.statusImmunities,
      dest,
      engine
    );
    if (applied) {
      const msg = description ?? `✦ [PROC: ${sourceName}] ${dest.name} is afflicted with ${action.status}!`;
      engine.log(msg);
      summary.messages.push(msg);
    }
  }
}

function executePushImpulse(
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
    // Push vector away from owner or along context vector
    const dx = dest.x - owner.x !== 0 ? Math.sign(dest.x - owner.x) : (context.dx ?? 0);
    const dy = dest.y - owner.y !== 0 ? Math.sign(dest.y - owner.y) : (context.dy ?? 0);
    const res = applyImpulse(engine, owner, dest, dx, dy, action.distance);
    if (res.pushed || res.wallSplat) {
      const msg = description ?? `✦ [PROC: ${sourceName}] Kinetic shockwave hurls ${dest.name} backward!`;
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
  const msg = description ?? `✦ [PROC: ${sourceName}] A pool of ${action.surfaceType} spreads across the floor!`;
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
  const msg = description ?? `✦ [PROC: ${sourceName}] A billowing cloud of ${action.gasType} erupts!`;
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
    const msg = description ?? `✦ [PROC: ${sourceName}] ${dest.name} is revitalized for +${healed} HP!`;
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
  summary.bonusDamage += action.amount;
  const dest = target;
  if (dest && dest.isAlive() && action.amount > 0) {
    const { damageDealt, killed } = dest.takeDamage(action.amount);
    const elem = action.element ? ` ${action.element}` : '';
    const msg = description ?? `✦ [PROC: ${sourceName}] Striking with extra fury for ${damageDealt}${elem} bonus damage!`;
    engine.log(msg);
    summary.messages.push(msg);
    if (killed) {
      DeathResolver.resolveDeath(engine, owner, dest);
    }
  }
}

function executeCastSpell(
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
  if (dest) {
    const castAction = new CastSpellAction(owner, action.spellId, dest.x, dest.y, undefined, true);
    castAction.perform(engine);
    const msg = description ?? `✦ [PROC: ${sourceName}] Automatically triggered spell ${action.spellId}!`;
    summary.messages.push(msg);
  }
}

function executeRadialAuraFilter(
  action: any,
  context: HookContext,
  owner: Entity,
  _target: Entity | undefined,
  summary: HookExecutionSummary,
  sourceName: string,
  description?: string
): void {
  const engine = asGameEngine(context.engine);
  const center = context.position ?? { x: owner.x, y: owner.y };
  const matches = findTaggedEntitiesInRadius(engine, center, action.radius, action.tags);

  if (matches.length === 0) return;

  for (const matched of matches) {
    // Each match is its own primitive target; owner stays the aura's source for
    // messaging/attribution, mirroring how the other primitives attribute PROCs.
    HookDispatcher.executePrimitive(action.apply, context, owner, matched, summary, sourceName);
  }

  const msg = description ?? `✦ [PROC: ${sourceName}] A radial aura washes over ${matches.length} ${action.tags.join('/')} creature(s)!`;
  engine.log(msg);
  summary.messages.push(msg);
}

primitiveExecutors.set('applyStatus', executeApplyStatus);
primitiveExecutors.set('pushImpulse', executePushImpulse);
primitiveExecutors.set('spawnSurface', executeSpawnSurface);
primitiveExecutors.set('spawnGas', executeSpawnGas);
primitiveExecutors.set('heal', executeHeal);
primitiveExecutors.set('bonusDamage', executeBonusDamage);
primitiveExecutors.set('castSpell', executeCastSpell);
primitiveExecutors.set('radialAuraFilter', executeRadialAuraFilter);
