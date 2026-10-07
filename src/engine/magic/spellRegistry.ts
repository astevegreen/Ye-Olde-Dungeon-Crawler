import type { SpellDefinition } from './types';
import { activeSpellStore } from '../registries/spellRegistryStore';

export type { SpellDefinition } from './types';

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

export function registerSpells(spells: SpellDefinition[]): void {
  SpellRegistry.registerAll(spells);
}

export function getSpell(spellId: string): SpellDefinition | undefined {
  return SpellRegistry.get(spellId);
}
