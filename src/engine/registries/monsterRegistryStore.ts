import type { MonsterDefinition } from '../bestiary/monsterDefinitions';

/**
 * One engine's monster definitions (ARCHITECTURE.md §3, P-22).
 *
 * Registries were static classes over module-level maps, so two engines built from
 * different manifests in one process shared a single set of lookups and the second
 * registration leaked into the first. This is the storage for one engine.
 *
 * Deliberately *not* a second copy: the module-level `MonsterRegistry` facade forwards
 * into whichever store is active rather than keeping its own map. Two structures holding
 * the same data is the failure mode §6 records for the scheduler partition.
 */
export class MonsterRegistryStore {
  private readonly definitions = new Map<string, MonsterDefinition>();

  public register(def: MonsterDefinition): void {
    this.definitions.set(def.id, def);
  }

  public registerAll(defs: MonsterDefinition[] | Record<string, MonsterDefinition>): void {
    for (const def of Array.isArray(defs) ? defs : Object.values(defs)) {
      this.definitions.set(def.id, def);
    }
  }

  public get(id: string): MonsterDefinition | undefined {
    return this.definitions.get(id);
  }

  public has(id: string): boolean {
    return this.definitions.has(id);
  }

  public getAll(): MonsterDefinition[] {
    return [...this.definitions.values()];
  }

  public clear(): void {
    this.definitions.clear();
  }

  /** Copies another store's registrations into this one. */
  public seedFrom(other: MonsterRegistryStore): void {
    for (const def of other.getAll()) {
      this.definitions.set(def.id, def);
    }
  }
}

/**
 * Store used when no engine owns the lookup: fixtures registered before an engine exists,
 * and static entry points with no engine in scope (`Monster.createFromDefinition`).
 * Stage 2 of P-22 migrates those; until then this is the process default.
 */
const processDefaultStore = new MonsterRegistryStore();
let activeStore: MonsterRegistryStore = processDefaultStore;

/** The store the facade currently resolves against. */
export function activeMonsterStore(): MonsterRegistryStore {
  return activeStore;
}

export function processDefaultMonsterStore(): MonsterRegistryStore {
  return processDefaultStore;
}

/**
 * Points the facade at an engine's own store. Called when a `GameEngine` is constructed,
 * so the most recently built engine owns the static lookup path — today's behaviour for a
 * single-engine process, and correct per-engine behaviour for code reaching its
 * registries through `engine.registries`.
 */
export function setActiveMonsterStore(store: MonsterRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
