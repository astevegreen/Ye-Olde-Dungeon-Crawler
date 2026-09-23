import type { AiBehaviorStrategy } from '../ai/aiBehaviorRegistry';
import { RegistryStore } from './registryStore';

let defaultRegistrar: (() => void) | undefined;

export function setDefaultAiBehaviorRegistrar(registrar: () => void): void {
  defaultRegistrar = registrar;
}

export function getDefaultAiBehaviorRegistrar(): (() => void) | undefined {
  return defaultRegistrar;
}

/**
 * One engine's AI behavior definitions (ARCHITECTURE.md §3).
 */
export class AIBehaviorRegistryStore extends RegistryStore<string, AiBehaviorStrategy> {
  private defaultStrategy?: AiBehaviorStrategy;

  constructor() {
    super((strategy) => strategy.id);
  }

  public override register(value: AiBehaviorStrategy): void;
  public override register(key: string, value: AiBehaviorStrategy): void;
  public override register(keyOrVal: string | AiBehaviorStrategy, maybeVal?: AiBehaviorStrategy): void {
    if (maybeVal !== undefined) {
      super.register(keyOrVal as string, maybeVal);
      if (!this.defaultStrategy || (keyOrVal as string) === 'melee' || maybeVal.id === 'melee') {
        this.defaultStrategy = maybeVal;
      }
    } else {
      const strategy = keyOrVal as AiBehaviorStrategy;
      super.register(strategy);
      if (!this.defaultStrategy || strategy.id === 'melee') {
        this.defaultStrategy = strategy;
      }
    }
  }

  public override registerAll(
    items: readonly AiBehaviorStrategy[] | Record<string, AiBehaviorStrategy> | Map<string, AiBehaviorStrategy>
  ): void {
    if (Array.isArray(items)) {
      for (const item of items) {
        this.register(item);
      }
    } else if (items instanceof Map) {
      for (const [, strategy] of items.entries()) {
        this.register(strategy);
      }
    } else {
      for (const strategy of Object.values(items)) {
        this.register(strategy);
      }
    }
  }

  public getDefault(): AiBehaviorStrategy {
    if (!this.defaultStrategy) {
      const first = this.entries.values().next().value;
      if (first) {
        this.defaultStrategy = first;
        return this.defaultStrategy;
      }
      throw new Error('No AI behavior strategies registered.');
    }
    return this.defaultStrategy;
  }

  public setDefault(strategy: AiBehaviorStrategy): void {
    this.defaultStrategy = strategy;
  }

  public getMap(): ReadonlyMap<string, AiBehaviorStrategy> {
    return this.entries;
  }

  public override clear(): void {
    super.clear();
    this.defaultStrategy = undefined;
  }

  public override seedFrom(other: RegistryStore<string, AiBehaviorStrategy>): void {
    super.seedFrom(other);
    if (other instanceof AIBehaviorRegistryStore) {
      if (other.defaultStrategy) {
        this.defaultStrategy = other.defaultStrategy;
      }
    }
  }
}

const processDefaultStore = new AIBehaviorRegistryStore();
let activeStore: AIBehaviorRegistryStore = processDefaultStore;

export function activeAIBehaviorStore(): AIBehaviorRegistryStore {
  return activeStore;
}

export function processDefaultAIBehaviorStore(): AIBehaviorRegistryStore {
  return processDefaultStore;
}

export function setActiveAIBehaviorStore(store: AIBehaviorRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
