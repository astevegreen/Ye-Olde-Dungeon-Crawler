import type { EffectPrimitive, SpellDefinition } from './types';
import type { GrimoireSystemConfig, LendFlavour, NeighbourLendingConfig, SpellType } from './magicConfig';
import {
  isSlotDoubled,
  openSlots,
  resolveSlotStats,
  slotNeighbours,
  slotOfSpell,
  slotStatSteps,
  spellAt,
  type GrimoireSlotRef,
  type GrimoireSlotStats,
  type GrimoireState,
} from './grimoires';

/*
 * Neighbour lending (P-30): each slot's resolved cast is its spell's own effect, scaled
 * by the slot's axis stats, plus the flavours its touching slots lend. What a flavour is
 * comes from the pack (`NeighbourLendingConfig`); the engine knows only where each of the
 * six spell types delivers it. Axis stats never reach a borrowed effect.
 */

/** Where a spell of each type delivers what it borrows (`SpellType`). */
export type LendDelivery = 'hit' | 'target' | 'adjacentFoes' | 'summonHits' | 'departure' | 'material';

const DELIVERY: Record<SpellType, LendDelivery> = {
  damage: 'hit',
  control: 'target',
  heal: 'adjacentFoes',
  summon: 'summonHits',
  movement: 'departure',
  terrain: 'material',
};

/** One borrowed flavour as the spell receives it, the same flavour from several neighbours merged. */
export interface ResolvedLend {
  flavourId: string;
  name: string;
  doubled: boolean;
  effects: EffectPrimitive[];
  color?: string;
  /** The neighbouring slots it comes from. */
  from: GrimoireSlotRef[];
}

export interface ResolvedCast {
  spellId: string;
  slot: GrimoireSlotRef;
  spellType?: SpellType;
  /** Its own element first, then any forged ones. */
  elements: string[];
  /** What the slot's axis stats do to the spell's own effect. */
  stats: GrimoireSlotStats;
  /** What borrowing does to the spell's own effect: opposites and Blood-price, summed. */
  lentPowerMultiplier: number;
  /** Current HP borrowing adds to each cast. */
  lentHpCost: number;
  /** Where `lends` land; absent for a spell with no type, which borrows nothing. */
  delivery?: LendDelivery;
  /** For `material`, each cast takes one of these at random (`pickMaterial`). */
  lends: ResolvedLend[];
  /** The flavour ids this slot lends its neighbours. */
  gives: string[];
}

export type SpellLookup = (spellId: string) => SpellDefinition | undefined;
export type OppositeLookup = (element: string) => string | undefined;

/** A placed spell's elements: its own, then those forged onto it, each once. */
function elementsOf(state: GrimoireState, spell: SpellDefinition): string[] {
  const out = [spell.element as string];
  for (const f of state.forged) if (f.spellId === spell.id && !out.includes(f.element)) out.push(f.element);
  return out;
}

/** What a spell lends: its pack-set flavours, or one per element (by school for `lendBySchool` elements). */
function lentFlavours(lending: NeighbourLendingConfig, state: GrimoireState, spell: SpellDefinition): Array<{ id: string; element?: string }> {
  if (spell.lends) return spell.lends.map((id) => ({ id }));
  const bySchool = lending.lendBySchool ?? [];
  return elementsOf(state, spell).map((element, i) => ({
    id: i === 0 && bySchool.includes(element) ? `${element}:${spell.school}` : element,
    element,
  }));
}

function flavourById(lending: NeighbourLendingConfig, id: string): LendFlavour | undefined {
  return lending.flavours.find((f) => f.id === id);
}

/**
 * The slot's cast as it resolves: its own stats, and what each neighbour lends.
 * - The same flavour from several neighbours counts once; doubled if any of them doubles it.
 * - A flavour from an element the spell has itself comes doubled, as does all a doubled slot
 *   lends (Týr, Loki); doubling happens once, never twice.
 * - A neighbour holding an opposite of one of the spell's elements, or a spell forged with
 *   its own opposite, adds `oppositeBonus` once.
 */
export function resolveCast(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  ref: GrimoireSlotRef,
  spellOf: SpellLookup,
  oppositeOf: OppositeLookup
): ResolvedCast | undefined {
  const spellId = spellAt(state, ref);
  const spell = spellId !== undefined ? spellOf(spellId) : undefined;
  if (!spell) return undefined;
  const lending = config.lending;
  const elements = elementsOf(state, spell);
  const cast: ResolvedCast = {
    spellId: spell.id,
    slot: { ...ref },
    spellType: spell.spellType,
    elements,
    stats: resolveSlotStats(slotStatSteps(config, state, ref), spell),
    lentPowerMultiplier: 1,
    lentHpCost: 0,
    delivery: spell.spellType ? DELIVERY[spell.spellType] : undefined,
    lends: [],
    gives: lending ? lentFlavours(lending, state, spell).map((f) => f.id) : [],
  };
  if (!lending || !spell.spellType) return cast;

  const opposites = new Set(elements.map(oppositeOf).filter((e): e is string => e !== undefined));
  let opposed = elements.some((e) => opposites.has(e));
  const merged = new Map<string, { flavour: LendFlavour; doubled: boolean; from: GrimoireSlotRef[] }>();
  for (const n of slotNeighbours(config, state, ref)) {
    const nId = spellAt(state, n);
    const neighbour = nId !== undefined ? spellOf(nId) : undefined;
    if (!neighbour) continue;
    if (elementsOf(state, neighbour).some((e) => opposites.has(e))) opposed = true;
    const slotDoubled = isSlotDoubled(state, n);
    for (const lent of lentFlavours(lending, state, neighbour)) {
      const flavour = flavourById(lending, lent.id);
      if (!flavour) continue;
      const doubled = slotDoubled || (lent.element !== undefined && elements.includes(lent.element));
      const entry = merged.get(flavour.id);
      if (entry) {
        entry.doubled ||= doubled;
        entry.from.push({ ...n });
      } else {
        merged.set(flavour.id, { flavour, doubled, from: [{ ...n }] });
      }
    }
  }

  let bonus = opposed ? (lending.oppositeBonus ?? 0) : 0;
  for (const { flavour, doubled, from } of merged.values()) {
    const form = doubled && flavour.doubled ? flavour.doubled : flavour;
    bonus += form.powerBonus ?? 0;
    cast.lentHpCost += form.hpCostPerCast ?? 0;
    cast.lends.push({ flavourId: flavour.id, name: form.name, doubled, effects: form.effects, color: form.color, from });
  }
  cast.lentPowerMultiplier = 1 + bonus;
  return cast;
}

/** Every placed spell's resolved cast, in slot order. */
export function resolveAllCasts(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  spellOf: SpellLookup,
  oppositeOf: OppositeLookup
): ResolvedCast[] {
  return openSlots(config, state).flatMap((ref) => resolveCast(config, state, ref, spellOf, oppositeOf) ?? []);
}

/** The resolved cast of a known spell, or nothing when it sits in no slot. */
export function resolveSpellCast(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  spellId: string,
  spellOf: SpellLookup,
  oppositeOf: OppositeLookup
): ResolvedCast | undefined {
  const ref = slotOfSpell(state, spellId);
  return ref ? resolveCast(config, state, ref, spellOf, oppositeOf) : undefined;
}

/** A terrain cast's one borrowed flavour, picked by `roll` (0 ≤ roll < 1) from those it has. */
export function pickMaterial(cast: ResolvedCast, roll: number): ResolvedLend | undefined {
  if (cast.lends.length === 0) return undefined;
  return cast.lends[Math.min(cast.lends.length - 1, Math.floor(roll * cast.lends.length))];
}

/** Problems in a pack's lending tables against its spells, one line each. */
export function validateNeighbourLending(lending: NeighbourLendingConfig, spells: readonly SpellDefinition[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const f of lending.flavours) {
    if (ids.has(f.id)) problems.push(`lend flavour ${f.id} is declared twice`);
    ids.add(f.id);
  }
  for (const spell of spells) {
    for (const id of spell.lends ?? []) if (!ids.has(id)) problems.push(`spell ${spell.id} lends unknown flavour ${id}`);
  }
  return problems;
}
