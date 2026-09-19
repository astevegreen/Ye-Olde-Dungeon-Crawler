import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import { RegistryStore } from './registryStore';

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
export class MonsterRegistryStore extends RegistryStore<string, MonsterDefinition> {
  constructor() {
    super((def) => def.id);
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
 * Points the facade at an engine's own store. Called when a `GameEngine` is activated,
 * so the active engine owns the static lookup path.
 */
export function setActiveMonsterStore(store: MonsterRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
