import type { Action } from '../actions/action';
import type { GameEngine } from '../engine';
import type { Monster } from '../entities/monster';

export interface AiBehaviorStrategy {
  readonly id: string;
  readonly name: string;
  decideAction(monster: Monster, engine: GameEngine): Action;
}

const registry = new Map<string, AiBehaviorStrategy>();
let defaultStrategy: AiBehaviorStrategy | undefined;

let defaultRegistrar: (() => void) | undefined;

export class AiBehaviorRegistry {
  public static register(strategy: AiBehaviorStrategy): void {
    registry.set(strategy.id, strategy);
    if (!defaultStrategy || strategy.id === 'melee') {
      defaultStrategy = strategy;
    }
  }

  public static registerAll(
    strategies: Record<string, AiBehaviorStrategy> | Map<string, AiBehaviorStrategy> | readonly AiBehaviorStrategy[]
  ): void {
    if (Array.isArray(strategies)) {
      for (const s of strategies) {
        this.register(s);
      }
    } else {
      const entries = strategies instanceof Map ? strategies.entries() : Object.entries(strategies);
      for (const [, strategy] of entries) {
        this.register(strategy);
      }
    }
  }

  public static get(id: string): AiBehaviorStrategy | undefined {
    return registry.get(id);
  }

  public static getDefault(): AiBehaviorStrategy {
    if (!defaultStrategy) {
      const first = registry.values().next().value;
      if (first) {
        defaultStrategy = first;
        return defaultStrategy;
      }
      throw new Error('No AI behavior strategies registered.');
    }
    return defaultStrategy;
  }

  public static setDefault(strategy: AiBehaviorStrategy): void {
    defaultStrategy = strategy;
  }

  public static has(id: string): boolean {
    return registry.has(id);
  }

  public static getAll(): ReadonlyMap<string, AiBehaviorStrategy> {
    return registry;
  }

  public static clear(): void {
    registry.clear();
    defaultStrategy = undefined;
  }

  public static setDefaultRegistrar(registrar: () => void): void {
    defaultRegistrar = registrar;
  }

  public static resetToDefaults(): void {
    registry.clear();
    defaultStrategy = undefined;
    if (defaultRegistrar) {
      defaultRegistrar();
    }
  }
}

