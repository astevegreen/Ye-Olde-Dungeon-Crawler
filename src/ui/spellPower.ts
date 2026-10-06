import { effectiveSpellPower, type GameEngine, type Player, type SpellDefinition } from '../engine';

/**
 * A spell's headline power: its first numeric damage or heal amount, else basePower. With a
 * caster, scaled as the cast scales it (`effectiveSpellPower`: Intelligence, worn and perk
 * multipliers, the element bonus), so the number shown is the number dealt.
 */
export function spellPower(spell: SpellDefinition, caster?: { engine: GameEngine; player: Player }): number {
  if (caster) return effectiveSpellPower(caster.engine, caster.player, spell);
  for (const e of spell.effects ?? []) {
    if ((e.type === 'damage' || e.type === 'heal') && typeof e.amount === 'number') return e.amount;
  }
  return spell.basePower ?? 0;
}
