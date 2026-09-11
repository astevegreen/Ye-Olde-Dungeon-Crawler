import type { EffectPrimitive, SpellDefinition } from './types';
import type { VisualEffectDescriptor } from '../types';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';

/**
 * Execution context supplied to effect primitive handlers.
 */
export interface EffectContext {
  engine: GameEngine;
  spell: SpellDefinition;
  caster: Entity;
  targets: Entity[];
  effects: VisualEffectDescriptor[];
  color: string;
  lastDamageEffect?: EffectPrimitive;
}

/**
 * Handler function signature for effect primitives.
 */
export type EffectHandler<T extends EffectPrimitive = EffectPrimitive> = (
  effect: T,
  ctx: EffectContext
) => void;

/**
 * Registry for pluggable spell effect primitive handlers.
 * Allows content manifests and plugins to introduce custom spell primitives
 * without altering the core engine pipeline.
 */
export class EffectPrimitiveRegistry {
  private static handlers = new Map<string, EffectHandler<any>>();

  /**
   * Registers an effect handler for a given primitive type.
   */
  public static register<T extends EffectPrimitive = EffectPrimitive>(
    type: string,
    handler: EffectHandler<T>
  ): void {
    EffectPrimitiveRegistry.handlers.set(type, handler);
  }

  /**
   * Retrieves the handler for a given primitive type.
   */
  public static get(type: string): EffectHandler<any> | undefined {
    return EffectPrimitiveRegistry.handlers.get(type);
  }

  /**
   * Checks whether a handler is registered for a given primitive type.
   */
  public static has(type: string): boolean {
    return EffectPrimitiveRegistry.handlers.has(type);
  }

  /**
   * Dispatches an effect primitive to its registered handler.
   * Returns true if a handler was found and executed, false otherwise.
   */
  public static dispatch(effect: EffectPrimitive, ctx: EffectContext): boolean {
    const handler = EffectPrimitiveRegistry.handlers.get(effect.type);
    if (!handler) {
      return false;
    }
    handler(effect, ctx);
    return true;
  }

  /**
   * Unregisters a handler by primitive type.
   */
  public static unregister(type: string): boolean {
    return EffectPrimitiveRegistry.handlers.delete(type);
  }

  /**
   * Returns a readonly view of all registered handlers.
   */
  public static getAll(): ReadonlyMap<string, EffectHandler<any>> {
    return EffectPrimitiveRegistry.handlers;
  }

  /**
   * Clears all registered handlers (used in test teardown).
   */
  public static clear(): void {
    EffectPrimitiveRegistry.handlers.clear();
  }
}
