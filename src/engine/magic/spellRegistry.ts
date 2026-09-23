import type { SpellDefinition } from './types';
import { activeSpellStore } from '../registries/spellRegistryStore';

export type { SpellDefinition } from './types';
export { SPELL_ID_ALIASES } from '../registries/spellRegistryStore';

/**
 * Process-wide facade over whichever spell store is active (ARCHITECTURE.md §3).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class SpellRegistry {
  public static register(spell: SpellDefinition): void {
    activeSpellStore().register(spell);
  }

  public static registerAll(spells: SpellDefinition[] | Record<string, SpellDefinition>): void {
    activeSpellStore().registerAll(spells);
  }

  public static get(spellId: string): SpellDefinition | undefined {
    return activeSpellStore().get(spellId);
  }

  public static has(spellId: string): boolean {
    return activeSpellStore().has(spellId);
  }

  public static getAll(): SpellDefinition[] {
    return activeSpellStore().getAll();
  }

  public static clear(): void {
    activeSpellStore().clear();
  }
}

export function registerSpell(spell: SpellDefinition): void {
  SpellRegistry.register(spell);
}

export function registerSpells(spells: SpellDefinition[]): void {
  SpellRegistry.registerAll(spells);
}

export function getSpell(spellId: string): SpellDefinition | undefined {
  return SpellRegistry.get(spellId);
}

export function getAllSpells(): SpellDefinition[] {
  return SpellRegistry.getAll();
}

/**
 * Backward compatibility proxy for code accessing SPELL_REGISTRY directly.
 */
export const SPELL_REGISTRY: Record<string, SpellDefinition> = new Proxy(
  {} as Record<string, SpellDefinition>,
  {
    get(_target, prop: string) {
      if (typeof prop === 'string') {
        return getSpell(prop);
      }
      return undefined;
    },
    set(_target, prop: string, value: any) {
      if (typeof prop === 'string') {
        activeSpellStore().register(value);
        return true;
      }
      return false;
    },
    deleteProperty(_target, prop: string) {
      if (typeof prop === 'string') {
        return activeSpellStore().delete(prop);
      }
      return false;
    },
    has(_target, prop: string) {
      return typeof prop === 'string' && activeSpellStore().has(prop);
    },
    ownKeys() {
      return activeSpellStore().getAll().map((s) => s.id);
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const spell = typeof prop === 'string' ? getSpell(prop) : undefined;
      if (spell) {
        return { configurable: true, enumerable: true, value: spell };
      }
      return undefined;
    },
  }
);

