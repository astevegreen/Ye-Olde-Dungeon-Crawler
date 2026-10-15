import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { SpellDefinition } from './types';
import { wornModifiers, sumWorn, productWorn } from '../items/wornModifiers';
import { spellPowerMultiplier, attributeScalingOf } from '../combat/attributeScaling';
import { Player } from '../entities/player';
import { resolveSlotStats, slotOfSpell, slotStatSteps, type GrimoireSlotStats, type GrimoireState } from './grimoires';
import { pickMaterial, resolveAllCasts, type ResolvedCast } from './neighbourLending';
import { getSpell } from './spellRegistry';
import type { CastShaping } from './spellPipeline';

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

/**
 * The spell with the elements forged onto it (`ResolvedCast.elements` past its own): each
 * of its damage effects hits as whichever of them the target resists least.
 */
export function withForgedElements(spell: SpellDefinition, added: readonly string[]): SpellDefinition {
  if (added.length === 0) return spell;
  return {
    ...spell,
    effects: spell.effects.map((e) => {
      if (e.type !== 'damage') return e;
      const elements = [...(e.elements ?? [])];
      for (const el of added) if (el !== e.element && !elements.includes(el)) elements.push(el);
      return { ...e, elements };
    }),
  };
}

/** The spell turned wholly to `element`, each of its effects that carries one too (Wildfire). */
export function withElement(spell: SpellDefinition, element: string): SpellDefinition {
  if (element === spell.element) return spell;
  return { ...spell, element, effects: spell.effects.map((e) => ('element' in e && e.element ? { ...e, element } : e)) };
}

/**
 * `spellId` as `caster` casts it: from its slot for a hero (P-29, P-30), the slot's stats
 * shaping it and its neighbours lending, then the reach the caster wears. A free cast, a
 * monster's and a hero's without the grimoire model take the spell as written. `unslotted`
 * when a hero with the model has it in no slot, so cannot cast it.
 */
export function resolveCastSpell(
  engine: GameEngine,
  caster: Entity,
  spellId: string,
  freeCast: boolean
): { spell?: SpellDefinition; resolved?: ResolvedCast; unslotted?: boolean } {
  let spell = engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
  if (!spell) return {};
  const player = caster instanceof Player ? caster : undefined;
  const resolved = player && !freeCast ? heroResolvedCast(engine, spellId) : undefined;
  if (player && !freeCast && player.grimoireSystem && !resolved) return { spell, unslotted: true };
  if (resolved) spell = withForgedElements(withSlotStats(spell, resolved.stats), resolved.elements.slice(1));
  return { spell: withSpellRangeBonus(caster, spell), resolved };
}

/**
 * A resolved cast as the pipeline takes it: its own power, and what it borrowed. A terrain
 * spell takes one borrowed material per cast, at random.
 */
export function castShaping(engine: GameEngine, cast: ResolvedCast): CastShaping {
  const powerMultiplier = cast.stats.powerMultiplier * cast.lentPowerMultiplier;
  if (!cast.delivery || cast.lends.length === 0) return { powerMultiplier };
  const lent = cast.delivery === 'material' ? [pickMaterial(cast, engine.prng.next())!] : cast.lends;
  return { powerMultiplier, lends: { delivery: cast.delivery, effects: lent.flatMap((l) => l.effects) } };
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
 * it wears, and its bonus for this element (Elementalist).
 */
export function scaleSpellDamage(engine: GameEngine, caster: Entity, element: string, rolled: number): number {
  let damage = rolled;
  let multiplier = spellPowerMultiplier(caster, attributeScalingOf(engine.manifest));
  for (const mod of wornModifiers(caster)) {
    if (mod.spellDamageMultiplier) multiplier *= mod.spellDamageMultiplier;
    if (mod.elementSpellMultiplier && mod.elementSpellMultiplier.element === element) multiplier *= mod.elementSpellMultiplier.multiplier;
  }
  if (multiplier !== 1.0) damage = Math.max(1, Math.round(damage * multiplier));
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
