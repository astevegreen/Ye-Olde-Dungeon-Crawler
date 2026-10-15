import type { GrimoireSystemConfig, RetiredSpellTarget } from '../magic/magicConfig';
import { createGrimoireState, openDueGrimoires, openSlots, spellAt, slotExists, type GrimoireSlotRef, type GrimoireState } from '../magic/grimoires';
import type { SerializedStatusEffect } from '../status/types';
import type { LegacyGrimoirePage } from './types';

/*
 * Carries a hero saved under the old magic over to the three grimoires (P-29), on load.
 * Retired spells become their pack-declared replacements wherever a spell id is held;
 * a save without the new fields gets placements seeded from its old pages and its
 * glyphs refunded as items; retired statuses are dropped. Pure: the serializer makes
 * the refunded items.
 */

export interface LegacyMagicInput {
  spellsKnown: readonly string[];
  quickSpells?: readonly (string | null)[];
  /** Old pages, page 0 first; empty when the save has none. */
  pages: readonly LegacyGrimoirePage[];
  /** The saved new-model state; absent in a save from before the switch. */
  state?: GrimoireState;
  statusEffects?: readonly SerializedStatusEffect[];
}

export interface LegacyMagicResult {
  spellsKnown: string[];
  quickSpells?: (string | null)[];
  /** The old pages under current spell ids, their glyphs taken off once refunded so they are refunded once. */
  pages: LegacyGrimoirePage[];
  state: GrimoireState;
  statusEffects?: SerializedStatusEffect[];
  /** Items to give the hero, one entry per refunded glyph. */
  refunds: string[];
}

/** The old page switch's channel, which the three grimoires have no use for. */
const ENGINE_RETIRED_STATUSES = ['grimoire_attunement'];

/** What a retired spell became: its replacement, `null` when let go, `undefined` when not retired. */
function retiredTarget(config: GrimoireSystemConfig, spellId: string): { spellId: string; addedElement?: string } | null | undefined {
  const spells = config.retired?.spells ?? {};
  if (!Object.prototype.hasOwnProperty.call(spells, spellId)) return undefined;
  const target: RetiredSpellTarget = spells[spellId];
  if (target === null) return null;
  return typeof target === 'string' ? { spellId: target } : target;
}

/** A spell id as it reads after retirement: its replacement, itself, or nothing when let go. */
function currentSpellId(config: GrimoireSystemConfig, spellId: string): string | undefined {
  const target = retiredTarget(config, spellId);
  return target === undefined ? spellId : target?.spellId;
}

/** The old 3×3 page's slot index as a cell around the centre (slot 4). */
function pageCell(slotIndex: number): { x: number; y: number } {
  return { x: (slotIndex % 3) - 1, y: Math.floor(slotIndex / 3) - 1 };
}

/**
 * Seeds placements from the old pages: a spell keeps its cell in the grimoire declared
 * in its page's position when that grimoire is open and the cell exists and is free;
 * the rest take the first free slots in page order. Known spells on no page are left
 * for `reconcileGrimoireState`.
 */
function seedFromPages(config: GrimoireSystemConfig, pages: readonly LegacyGrimoirePage[], spellsKnown: readonly string[]): GrimoireState {
  const state = createGrimoireState();
  openDueGrimoires(config, state, spellsKnown.length);
  const placed = new Set<string>();
  const leftover: string[] = [];
  const place = (spellId: string, ref: GrimoireSlotRef) => {
    state.placements.push({ ...ref, spellId });
    placed.add(spellId);
  };
  pages.forEach((page, p) => {
    const grimoireId = config.layouts[p]?.id;
    for (const slot of page.slots) {
      const spellId = slot.spellId ? currentSpellId(config, slot.spellId) : undefined;
      if (!spellId || !spellsKnown.includes(spellId) || placed.has(spellId) || leftover.includes(spellId)) continue;
      const ref = grimoireId ? { grimoireId, ...pageCell(slot.slotIndex) } : undefined;
      if (ref && slotExists(config, state, ref) && spellAt(state, ref) === undefined) place(spellId, ref);
      else leftover.push(spellId);
    }
  });
  for (const spellId of leftover) {
    if (placed.has(spellId)) continue;
    const free = openSlots(config, state).find((ref) => spellAt(state, ref) === undefined);
    if (free) place(spellId, free);
  }
  return state;
}

export function convertLegacyMagic(config: GrimoireSystemConfig, input: LegacyMagicInput): LegacyMagicResult {
  const forged: Array<{ spellId: string; element: string }> = [];
  const spellsKnown: string[] = [];
  for (const id of input.spellsKnown) {
    const target = retiredTarget(config, id);
    if (target === null) continue;
    const spellId = target?.spellId ?? id;
    if (!spellsKnown.includes(spellId)) spellsKnown.push(spellId);
    if (target?.addedElement) forged.push({ spellId, element: target.addedElement });
  }

  const quickSpells = input.quickSpells?.map((id, i, all) => {
    const spellId = id ? currentSpellId(config, id) : undefined;
    if (!spellId) return null;
    return all.slice(0, i).some((o) => o && currentSpellId(config, o) === spellId) ? null : spellId;
  });

  const refunds: string[] = [];
  // Old pages name spells too; a replacement already on the page leaves the slot empty.
  let pages = input.pages.map((page) => {
    const ids = page.slots.map((s) => (s.spellId ? (currentSpellId(config, s.spellId) ?? null) : null));
    return { ...page, slots: page.slots.map((s, i) => ({ ...s, spellId: ids[i] && ids.indexOf(ids[i]) < i ? null : ids[i] })) };
  });
  let state: GrimoireState;
  if (input.state) {
    state = input.state;
    state.placements = state.placements.flatMap((p) => {
      const spellId = currentSpellId(config, p.spellId);
      return spellId ? [{ ...p, spellId }] : [];
    });
    // A retired spell's replacement was never forgotten.
    state.forgotten = state.forgotten.filter((id) => retiredTarget(config, id) === undefined);
    state.offers = state.offers.flatMap((id) => currentSpellId(config, id) ?? []);
    state.forged = state.forged.flatMap((f) => {
      const spellId = currentSpellId(config, f.spellId);
      return spellId ? [{ ...f, spellId }] : [];
    });
  } else {
    state = seedFromPages(config, pages, spellsKnown);
    const glyphRunes = config.retired?.glyphRunes ?? {};
    for (const slot of pages.flatMap((page) => page.slots)) {
      for (const glyph of slot.infusedGlyphs ?? []) {
        const itemId = glyphRunes[glyph.glyphId];
        if (itemId) refunds.push(itemId);
      }
    }
    pages = pages.map((page) => ({ ...page, slots: page.slots.map((s) => ({ ...s, infusedGlyphs: undefined })) }));
  }
  // A spell takes one forge, as at the altar: the first carried over, or one already made, wins.
  for (const f of forged) {
    if (!state.forged.some((o) => o.spellId === f.spellId && o.fated === undefined)) state.forged.push(f);
  }

  const retiredStatuses = [...ENGINE_RETIRED_STATUSES, ...(config.retired?.statuses ?? [])];
  const statusEffects = input.statusEffects?.filter((s) => !retiredStatuses.includes(s.type));

  return { spellsKnown, quickSpells, pages, state, statusEffects, refunds };
}
