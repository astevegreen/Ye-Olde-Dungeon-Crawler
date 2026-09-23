import type { TrapDefinition } from '../types/manifest';
import { RegistryStore } from './registryStore';

/**
 * One engine's trap definitions (ARCHITECTURE.md §3).
 */
export class TrapRegistryStore extends RegistryStore<string, TrapDefinition> {
  constructor() {
    super((def) => def.type);
  }
}

const processDefaultStore = new TrapRegistryStore();
let activeStore: TrapRegistryStore = processDefaultStore;

export function activeTrapStore(): TrapRegistryStore {
  return activeStore;
}

export function processDefaultTrapStore(): TrapRegistryStore {
  return processDefaultStore;
}

export function setActiveTrapStore(store: TrapRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
