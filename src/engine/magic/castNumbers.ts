import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import type { SpellDefinition } from './types';
import { wornModifiers, sumWorn, productWorn } from '../items/wornModifiers';
import { spellPowerMultiplier, attributeScalingOf } from '../combat/attributeScaling';
import { EnergyModel } from '../actors/energyModel';

/**
 * A spell's numbers as a cast of it resolves for this caster. The cast, the HUD, the
 * affordability gates and the overflow warning all read these, so what the hero is shown
 * is what the hero pays and deals.
 */

/** What `spell` costs this caster in mana: through what it wears and its perks, a share off first, then flat. */
export function effectiveManaCost(caster: Entity, spell: Pick<SpellDefinition, 'manaCost'>): number {
  const multiplier = productWorn(caster, 'manaCostMultiplier');
  const discount = sumWorn(caster, 'manaCostDiscount');
  return Math.max(0, Math.round((spell.manaCost ?? 0) * multiplier) - discount);
}

/**
 * A spell's rolled damage scaled by its caster, for the first hit and every chain hop alike:
 * Intelligence (the pack's attribute scaling), the Enchanted `spellDamageMultiplier` of what
 * it wears, its bonus for this element (Elementalist), and for shadow or entropic damage the
 * caster's corruption.
 */
export function scaleSpellDamage(engine: GameEngine, caster: Entity, element: string, rolled: number): number {
  let damage = rolled;
  let multiplier = spellPowerMultiplier(caster, attributeScalingOf(engine.manifest));
  for (const mod of wornModifiers(caster)) {
    if (mod.spellDamageMultiplier) multiplier *= mod.spellDamageMultiplier;
    if (mod.elementSpellMultiplier && mod.elementSpellMultiplier.element === element) multiplier *= mod.elementSpellMultiplier.multiplier;
  }
  if (multiplier !== 1.0) damage = Math.max(1, Math.round(damage * multiplier));
  if (caster instanceof Actor && caster.corruptionScore > 0 && (element === 'shadow' || element === 'entropic')) {
    const entropicMult = EnergyModel.calculateEntropicDamageMultiplier(caster.corruptionScore);
    if (entropicMult !== 1.0) damage = Math.max(1, Math.round(damage * entropicMult));
  }
  return damage;
}

/** A spell's rolled healing scaled by its caster's Intelligence (the pack's attribute scaling). */
export function scaleSpellHeal(engine: GameEngine, caster: Entity, rolled: number): number {
  const intelligence = spellPowerMultiplier(caster, attributeScalingOf(engine.manifest));
  return intelligence !== 1.0 ? Math.max(1, Math.round(rolled * intelligence)) : rolled;
}

/**
 * A spell's headline power for this caster: its first numeric damage or heal amount (else
 * `basePower`, as damage), scaled as the cast scales it. Before the target's affinities.
 */
export function effectiveSpellPower(engine: GameEngine, caster: Entity, spell: SpellDefinition): number {
  for (const e of spell.effects ?? []) {
    if (e.type === 'damage' && typeof e.amount === 'number') {
      return e.amount > 0 ? scaleSpellDamage(engine, caster, e.element ?? spell.element, e.amount) : 0;
    }
    if (e.type === 'heal' && typeof e.amount === 'number') {
      return e.amount > 0 ? scaleSpellHeal(engine, caster, e.amount) : 0;
    }
  }
  const base = spell.basePower ?? 0;
  return base > 0 ? scaleSpellDamage(engine, caster, spell.element, base) : 0;
}
