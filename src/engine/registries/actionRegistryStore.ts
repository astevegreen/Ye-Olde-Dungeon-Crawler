import type { GameAction } from '../actions/actionRegistry';
import { RegistryStore } from './registryStore';

/**
 * One engine's action command definitions (ARCHITECTURE.md §3).
 */
export class ActionRegistryStore extends RegistryStore<string, GameAction<any>> {
  constructor() {
    super((action) => action.id);
  }

  public unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  public getMap(): ReadonlyMap<string, GameAction<any>> {
    return this.entries;
  }
}

const processDefaultStore = new ActionRegistryStore();
let activeStore: ActionRegistryStore = processDefaultStore;

export function activeActionStore(): ActionRegistryStore {
  return activeStore;
}

export function processDefaultActionStore(): ActionRegistryStore {
  return processDefaultStore;
}

export function setActiveActionStore(store: ActionRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
