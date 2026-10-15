import type { GrimoirePage } from '../magic/grimoireMatrix';
import { GRIMOIRE_ATTUNE_STATUS } from '../magic/grimoireMatrix';
import type { GrimoireSystemConfig, RetiredSpellTarget } from '../magic/magicConfig';
import { createGrimoireState, openDueGrimoires, openSlots, spellAt, slotExists, type GrimoireSlotRef, type GrimoireState } from '../magic/grimoires';
import type { SerializedStatusEffect } from '../status/types';

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
  pages: readonly GrimoirePage[];
  /** The saved new-model state; absent in a save from before the switch. */
  state?: GrimoireState;
  statusEffects?: readonly SerializedStatusEffect[];
}

export interface LegacyMagicResult {
  spellsKnown: string[];
  quickSpells?: (string | null)[];
  /** The old pages under current spell ids, their glyphs taken off once refunded so they are refunded once. */
  pages: GrimoirePage[];
  state: GrimoireState;
  statusEffects?: SerializedStatusEffect[];
  /** Items to give the hero, one entry per refunded glyph. */
  refunds: string[];
}

/** The page switch's channel, which the three grimoires have no use for. */
const ENGINE_RETIRED_STATUSES = [GRIMOIRE_ATTUNE_STATUS];

function retiredTarget(config: GrimoireSystemConfig, spellId: string): { spellId: string; addedElement?: string } | undefined {
  const target: RetiredSpellTarget | undefined = config.retired?.spells?.[spellId];
  if (target === undefined) return undefined;
  return typeof target === 'string' ? { spellId: target } : target;
}

/** A spell id as it reads after retirement: its replacement, or itself. */
export function currentSpellId(config: GrimoireSystemConfig, spellId: string): string {
  return retiredTarget(config, spellId)?.spellId ?? spellId;
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
function seedFromPages(config: GrimoireSystemConfig, pages: readonly GrimoirePage[], spellsKnown: readonly string[]): GrimoireState {
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
    const spellId = target?.spellId ?? id;
    if (!spellsKnown.includes(spellId)) spellsKnown.push(spellId);
    if (target?.addedElement) forged.push({ spellId, element: target.addedElement });
  }

  const quickSpells = input.quickSpells?.map((id, i, all) => {
    if (!id) return null;
    const spellId = currentSpellId(config, id);
    return all.slice(0, i).some((o) => o && currentSpellId(config, o) === spellId) ? null : spellId;
  });

  const refunds: string[] = [];
  // Old pages name spells too; a replacement already on the page leaves the slot empty.
  let pages = input.pages.map((page) => {
    const ids = page.slots.map((s) => (s.spellId ? currentSpellId(config, s.spellId) : null));
    return { ...page, slots: page.slots.map((s, i) => ({ ...s, spellId: ids[i] && ids.indexOf(ids[i]) < i ? null : ids[i] })) };
  });
  let state: GrimoireState;
  if (input.state) {
    state = input.state;
    for (const p of state.placements) p.spellId = currentSpellId(config, p.spellId);
    // A retired spell's replacement was never forgotten.
    state.forgotten = state.forgotten.filter((id) => retiredTarget(config, id) === undefined);
    for (const f of state.forged) f.spellId = currentSpellId(config, f.spellId);
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
  for (const f of forged) {
    if (!state.forged.some((o) => o.spellId === f.spellId && o.element === f.element)) state.forged.push(f);
  }

  const retiredStatuses = [...ENGINE_RETIRED_STATUSES, ...(config.retired?.statuses ?? [])];
  const statusEffects = input.statusEffects?.filter((s) => !retiredStatuses.includes(s.type));

  return { spellsKnown, quickSpells, pages, state, statusEffects, refunds };
}
