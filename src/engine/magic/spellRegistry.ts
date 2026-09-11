import type { SpellDefinition } from './types';
export type { SpellDefinition } from './types';

export const SPELL_REGISTRY: Record<string, SpellDefinition> = {};

export function registerSpell(spell: SpellDefinition): void {
  SPELL_REGISTRY[spell.id] = spell;
}

export function registerSpells(spells: SpellDefinition[]): void {
  for (const s of spells) {
    SPELL_REGISTRY[s.id] = s;
  }
}

/**
 * Static alias map for backward compatibility with legacy save files and alternate names.
 */
export const SPELL_ID_ALIASES: Record<string, string> = {
  sense_living: 'detect_monsters',
  detect_treasure: 'detect_objects',
};

export function getSpell(spellId: string): SpellDefinition | undefined {
  const canonicalId = SPELL_ID_ALIASES[spellId] ?? spellId;
  return SPELL_REGISTRY[canonicalId] ?? SPELL_REGISTRY[spellId];
}

export function getAllSpells(): SpellDefinition[] {
  return Object.values(SPELL_REGISTRY);
}

