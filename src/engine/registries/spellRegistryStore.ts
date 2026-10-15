import type { SpellDefinition } from '../magic/types';
import { RegistryStore } from './registryStore';

/**
 * One engine's spell definitions (ARCHITECTURE.md §3).
 */
export class SpellRegistryStore extends RegistryStore<string, SpellDefinition> {
  constructor() {
    super((spell) => spell.id);
  }
}

const processDefaultStore = new SpellRegistryStore();
let activeStore: SpellRegistryStore = processDefaultStore;

export function activeSpellStore(): SpellRegistryStore {
  return activeStore;
}

export function processDefaultSpellStore(): SpellRegistryStore {
  return processDefaultStore;
}

export function setActiveSpellStore(store: SpellRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
