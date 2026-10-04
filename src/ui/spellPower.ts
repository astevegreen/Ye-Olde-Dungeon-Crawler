import type { SpellDefinition } from '../engine';

/** A spell's headline power: its first numeric damage or heal amount, else basePower. */
export function spellPower(spell: SpellDefinition): number {
  for (const e of spell.effects ?? []) {
    if ((e.type === 'damage' || e.type === 'heal') && typeof e.amount === 'number') return e.amount;
  }
  return spell.basePower ?? 0;
}
