import type { SpellDefinition } from '../magic/types';
import { RegistryStore } from './registryStore';

/**
 * Static alias map for backward compatibility with legacy save files and alternate names.
 */
export const SPELL_ID_ALIASES: Record<string, string> = {
  sense_living: 'detect_monsters',
  detect_treasure: 'detect_objects',
};

/**
 * One engine's spell definitions (ARCHITECTURE.md §3).
 */
export class SpellRegistryStore extends RegistryStore<string, SpellDefinition> {
  constructor() {
    super((spell) => spell.id);
  }

  public override get(id: string): SpellDefinition | undefined {
    const canonicalId = SPELL_ID_ALIASES[id] ?? id;
    return super.get(canonicalId) ?? super.get(id);
  }

  public override has(id: string): boolean {
    const canonicalId = SPELL_ID_ALIASES[id] ?? id;
    return super.has(canonicalId) || super.has(id);
  }

  public delete(id: string): boolean {
    return this.entries.delete(id);
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
