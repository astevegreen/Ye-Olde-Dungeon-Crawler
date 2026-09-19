import type { TrapDefinition, TrapType } from '../types/manifest';
import { TrapInstance, type TrapOptions } from '../dungeon/traps';

import { activeTrapStore } from '../registries/trapRegistryStore';

/**
 * Process-wide facade over whichever trap store is active (ARCHITECTURE.md §3, P-22).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class TrapRegistry {
  public static register(def: TrapDefinition): void {
    activeTrapStore().register(def);
  }

  public static registerAll(defs: TrapDefinition[] | Record<string, TrapDefinition>): void {
    activeTrapStore().registerAll(defs);
  }

  public static get(type: string): TrapDefinition | undefined {
    return activeTrapStore().get(type);
  }

  public static has(type: string): boolean {
    return activeTrapStore().has(type);
  }

  public static getAll(): TrapDefinition[] {
    return activeTrapStore().getAll();
  }

  public static clear(): void {
    activeTrapStore().clear();
  }

  /**
   * Instantiates a TrapInstance using the registered TrapDefinition as a template,
   * overlaying any specific custom options.
   */
  public static createInstance(
    id: string,
    type: TrapType,
    x: number,
    y: number,
    customOptions?: Partial<TrapOptions>
  ): TrapInstance {
    const def = this.get(type);
    return new TrapInstance({
      id,
      type,
      x,
      y,
      damage: customOptions?.damage ?? def?.damage,
      disarmDifficulty: customOptions?.disarmDifficulty ?? def?.disarmDifficulty,
      customMessage: customOptions?.customMessage ?? def?.message,
      concealment: customOptions?.concealment ?? 14,
      revealed: customOptions?.revealed ?? false,
      disarmed: customOptions?.disarmed ?? false,
      triggered: customOptions?.triggered ?? false,
      ...customOptions,
    });
  }
}
