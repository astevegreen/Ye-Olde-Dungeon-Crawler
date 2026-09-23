import type { Action } from '../actions/action';
import type { GameEngine } from '../engine';
import type { Monster } from '../entities/monster';

export interface AiBehaviorStrategy {
  readonly id: string;
  readonly name: string;
  decideAction(monster: Monster, engine: GameEngine): Action;
}

import {
  activeAIBehaviorStore,
  setDefaultAiBehaviorRegistrar,
  getDefaultAiBehaviorRegistrar,
} from '../registries/aiBehaviorRegistryStore';

/**
 * Process-wide facade over whichever AI behavior store is active (ARCHITECTURE.md §3).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class AiBehaviorRegistry {
  public static register(strategy: AiBehaviorStrategy): void {
    activeAIBehaviorStore().register(strategy);
  }

  public static registerAll(
    strategies: Record<string, AiBehaviorStrategy> | Map<string, AiBehaviorStrategy> | readonly AiBehaviorStrategy[]
  ): void {
    activeAIBehaviorStore().registerAll(strategies);
  }

  public static get(id: string): AiBehaviorStrategy | undefined {
    return activeAIBehaviorStore().get(id);
  }

  public static getDefault(): AiBehaviorStrategy {
    return activeAIBehaviorStore().getDefault();
  }

  public static setDefault(strategy: AiBehaviorStrategy): void {
    activeAIBehaviorStore().setDefault(strategy);
  }

  public static has(id: string): boolean {
    return activeAIBehaviorStore().has(id);
  }

  public static getAll(): ReadonlyMap<string, AiBehaviorStrategy> {
    return activeAIBehaviorStore().getMap();
  }

  public static clear(): void {
    activeAIBehaviorStore().clear();
  }

  public static setDefaultRegistrar(registrar: () => void): void {
    setDefaultAiBehaviorRegistrar(registrar);
  }

  public static resetToDefaults(): void {
    activeAIBehaviorStore().clear();
    const registrar = getDefaultAiBehaviorRegistrar();
    if (registrar) {
      registrar();
    }
  }
}

