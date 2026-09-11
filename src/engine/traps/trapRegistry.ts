import type { TrapDefinition, TrapType } from '../types/manifest';
import { TrapInstance, type TrapOptions } from '../dungeon/traps';

/**
 * Registry for declarative trap definitions loaded from manifests.
 */
export class TrapRegistry {
  private static readonly definitions = new Map<string, TrapDefinition>();

  public static register(def: TrapDefinition): void {
    this.definitions.set(def.type, def);
  }

  public static registerAll(defs: TrapDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  public static get(type: string): TrapDefinition | undefined {
    return this.definitions.get(type);
  }

  public static getAll(): TrapDefinition[] {
    return Array.from(this.definitions.values());
  }

  public static clear(): void {
    this.definitions.clear();
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
