import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import type { SpellDefinition } from './types';
import { wornModifiers, sumWorn, productWorn } from '../items/wornModifiers';
import { spellPowerMultiplier, attributeScalingOf } from '../combat/attributeScaling';
import { EnergyModel } from '../actors/energyModel';
import { Player } from '../entities/player';
import { resolveSlotStats, slotOfSpell, slotStatSteps, type GrimoireSlotStats, type GrimoireState } from './grimoires';
import { resolveAllCasts, type ResolvedCast } from './neighbourLending';
import { getSpell } from './spellRegistry';

/**
 * A spell's numbers as a cast of it resolves for this caster. The cast, the HUD, the
 * affordability gates and the overflow warning all read these, so what the hero is shown
 * is what the hero pays and deals.
 */

/**
 * What the stats of the slot `spellId` sits in do to a hero's cast of it, in the pack's
 * three-grimoire model; neutral for a caster without the model or a spell in no slot.
 */
export function castSlotStats(caster: Entity, spellId: string | undefined): GrimoireSlotStats {
  const state = caster instanceof Player ? caster.grimoireState : undefined;
  const system = caster instanceof Player ? caster.grimoireSystem : undefined;
  const ref = state && spellId !== undefined ? slotOfSpell(state, spellId) : undefined;
  return resolveSlotStats(system && state && ref ? slotStatSteps(system, state, ref) : []);
}

/** The hero's resolved casts, kept until the grimoires change (placements, picks, forging). */
const castCache = new WeakMap<GrimoireState, { key: string; casts: readonly ResolvedCast[] }>();

/**
 * Every slotted spell's resolved cast for the hero (P-30): own stats and what its
 * neighbours lend; empty without the three-grimoire model. Shared between calls: read only.
 */
export function heroResolvedCasts(engine: GameEngine): readonly ResolvedCast[] {
  const { grimoireSystem: system, grimoireState: state } = engine.player;
  if (!system || !state) return [];
  const key = JSON.stringify(state);
  const cached = castCache.get(state);
  if (cached?.key === key) return cached.casts;
  const spellOf = (id: string) => engine.manifest.spells?.find((s) => s.id === id) ?? getSpell(id);
  const casts = resolveAllCasts(system, state, spellOf, (e) => engine.affinityMatrix.getOpposite(e));
  castCache.set(state, { key, casts });
  return casts;
}

/** The hero's resolved cast of `spellId`, or nothing when it sits in no slot. */
export function heroResolvedCast(engine: GameEngine, spellId: string): ResolvedCast | undefined {
  return heroResolvedCasts(engine).find((c) => c.spellId === spellId);
}

/**
 * The spell as its slot's axis stats shape its own effect: further range and a wider area
 * where it has them, its own statuses, summons and reveals lasting longer. Power travels
 * with the cast (`CastShaping`), since rolled amounts can be dice.
 */
export function withSlotStats(spell: SpellDefinition, stats: GrimoireSlotStats): SpellDefinition {
  const longer = (d: number) => (d > 0 ? Math.max(1, Math.floor(d * stats.durationMultiplier)) : d);
  const out: SpellDefinition = { ...spell };
  if (stats.rangeBonus !== 0 && spell.range > 0) out.range = spell.range + stats.rangeBonus;
  if (stats.areaBonus !== 0 && spell.areaOfEffect > 0) out.areaOfEffect = spell.areaOfEffect + stats.areaBonus;
  if (stats.durationMultiplier !== 1 || stats.rangeBonus !== 0) {
    out.effects = spell.effects.map((e) => {
      if (e.type === 'applyStatus') return { ...e, duration: longer(e.duration) };
      if ((e.type === 'summon' || e.type === 'reveal') && e.duration !== undefined) return { ...e, duration: longer(e.duration) };
      // A hop's reach (a whole-floor jump, range 0, has none to stretch).
      if (e.type === 'teleport' && e.range > 0) return { ...e, range: e.range + stats.rangeBonus };
      return e;
    });
  }
  return out;
}

/** The spell with the range what the caster wears and holds adds (`spellRangeBonus`, Odin's Eye); a spell with no range keeps none. */
export function withSpellRangeBonus(caster: Entity, spell: SpellDefinition): SpellDefinition {
  const bonus = sumWorn(caster, 'spellRangeBonus');
  return bonus !== 0 && spell.range > 0 ? { ...spell, range: spell.range + bonus } : spell;
}

/**
 * The hero's spell as a cast of it from its slot resolves, for what the HUD and the aim
 * show: the slot's stats, the reach it wears, and the Seiðr the cast will charge.
 */
export function heroCastPreview(engine: GameEngine, spell: SpellDefinition): SpellDefinition {
  const resolved = heroResolvedCast(engine, spell.id);
  const shaped = withSpellRangeBonus(engine.player, resolved ? withSlotStats(spell, resolved.stats) : spell);
  return { ...shaped, manaCost: effectiveManaCost(engine.player, shaped) };
}

/**
 * What `spell` costs this caster in mana: through what it wears and its perks, a share off
 * first (its slot's Thrift too), then flat.
 */
export function effectiveManaCost(caster: Entity, spell: Pick<SpellDefinition, 'manaCost'> & Partial<Pick<SpellDefinition, 'id'>>): number {
  const multiplier = productWorn(caster, 'manaCostMultiplier') * castSlotStats(caster, spell.id).costMultiplier;
  const discount = sumWorn(caster, 'manaCostDiscount');
  return Math.max(0, Math.round((spell.manaCost ?? 0) * multiplier) - discount);
}

/**
 * The current HP `spell` costs this caster (blood magic): its slot's Thrift off, never below
 * 1 while it costs any, then what borrowing adds (Blood-price), which Thrift leaves alone.
 */
export function effectiveHpCost(
  caster: Entity,
  spell: Pick<SpellDefinition, 'hpCost'> & Partial<Pick<SpellDefinition, 'id'>>,
  lentHpCost = 0
): number {
  const base = spell.hpCost ?? 0;
  const own = base > 0 ? Math.max(1, Math.round(base * castSlotStats(caster, spell.id).costMultiplier)) : 0;
  return own + lentHpCost;
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
