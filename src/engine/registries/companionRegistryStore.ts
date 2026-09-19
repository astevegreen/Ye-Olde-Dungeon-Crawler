import type { CompanionDefinition } from '../entities/companion';
import { RegistryStore } from './registryStore';

/**
 * One engine's companion definitions (ARCHITECTURE.md §3, P-22).
 */
export class CompanionRegistryStore extends RegistryStore<string, CompanionDefinition> {
  constructor() {
    super((def) => def.id);
  }
}

const processDefaultStore = new CompanionRegistryStore();
let activeStore: CompanionRegistryStore = processDefaultStore;

export function activeCompanionStore(): CompanionRegistryStore {
  return activeStore;
}

export function processDefaultCompanionStore(): CompanionRegistryStore {
  return processDefaultStore;
}

export function setActiveCompanionStore(store: CompanionRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
