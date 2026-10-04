import { attributeScalingOf, spellPowerMultiplier, type GameEngine, type Player, type SpellDefinition } from '../engine';

/**
 * A spell's headline power: its first numeric damage or heal amount, else basePower, times
 * what the caster's Intelligence makes of it (the pack's attribute scaling) when a caster is given.
 */
export function spellPower(spell: SpellDefinition, caster?: { engine: GameEngine; player: Player }): number {
  let base = spell.basePower ?? 0;
  for (const e of spell.effects ?? []) {
    if ((e.type === 'damage' || e.type === 'heal') && typeof e.amount === 'number') {
      base = e.amount;
      break;
    }
  }
  if (!caster || base === 0) return base;
  return Math.max(1, Math.round(base * spellPowerMultiplier(caster.player, attributeScalingOf(caster.engine.manifest))));
}
