import type { AIStrategy } from '../ai/aiRegistry';
import { AiBehaviorRegistry } from '../ai/aiBehaviorRegistry';
import { RegistryStore } from './registryStore';

export const LEGACY_AI_ALIASES: Record<string, string> = {
  melee: 'aggressive_melee',
  caster: 'kiting_ranged',
  coward: 'fleeing_coward',
  brute: 'aggressive_melee',
};

/**
 * One engine's AI strategies (ARCHITECTURE.md §3, P-22).
 */
export class AIStrategyRegistryStore extends RegistryStore<string, AIStrategy> {
  private defaultStrategy?: AIStrategy;
  private readonly aliases: Record<string, string> = { ...LEGACY_AI_ALIASES };

  constructor() {
    super((strategy) => strategy.id);
  }

  public override register(value: AIStrategy): void;
  public override register(key: string, value: AIStrategy): void;
  public override register(keyOrVal: string | AIStrategy, maybeVal?: AIStrategy): void {
    if (maybeVal !== undefined) {
      super.register(keyOrVal as string, maybeVal);
      if (!this.defaultStrategy || (keyOrVal as string) === 'aggressive_melee' || maybeVal.id === 'aggressive_melee') {
        this.defaultStrategy = maybeVal;
      }
    } else {
      const strategy = keyOrVal as AIStrategy;
      super.register(strategy);
      if (!this.defaultStrategy || strategy.id === 'aggressive_melee') {
        this.defaultStrategy = strategy;
      }
    }
  }

  public registerAlias(alias: string, canonicalId: string): void {
    this.aliases[alias] = canonicalId;
  }

  public override get(id?: string): AIStrategy | undefined {
    if (!id) return this.defaultStrategy;
    if (this.has(id)) {
      const direct = super.get(id);
      if (direct) return direct;
    }

    const canonicalId = this.aliases[id];
    if (canonicalId) {
      const aliasTarget = super.get(canonicalId);
      if (aliasTarget) return aliasTarget;
    }

    const legacy = AiBehaviorRegistry.get(id);
    if (legacy) return legacy;

    return undefined;
  }

  public override has(id: string): boolean {
    if (super.has(id)) return true;
    if (id in this.aliases && super.has(this.aliases[id])) return true;
    if (id in this.aliases) return true;
    if (AiBehaviorRegistry.has(id)) return true;
    return false;
  }

  public getDefault(): AIStrategy | undefined {
    return this.defaultStrategy;
  }

  public getMap(): ReadonlyMap<string, AIStrategy> {
    return this.entries;
  }

  public unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  public override clear(): void {
    super.clear();
    this.defaultStrategy = undefined;
  }

  public override seedFrom(other: RegistryStore<string, AIStrategy>): void {
    super.seedFrom(other);
    if (other instanceof AIStrategyRegistryStore) {
      if (other.defaultStrategy) {
        this.defaultStrategy = other.defaultStrategy;
      }
      Object.assign(this.aliases, other.aliases);
    }
  }
}

const processDefaultStore = new AIStrategyRegistryStore();
let activeStore: AIStrategyRegistryStore = processDefaultStore;

export function activeAIStrategyStore(): AIStrategyRegistryStore {
  return activeStore;
}

export function processDefaultAIStrategyStore(): AIStrategyRegistryStore {
  return processDefaultStore;
}

export function setActiveAIStrategyStore(store: AIStrategyRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
