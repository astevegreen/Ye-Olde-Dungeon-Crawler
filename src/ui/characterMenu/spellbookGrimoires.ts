import {
  effectiveManaCost,
  getSpell,
  grimoireAxes,
  grimoireCells,
  heroCastPreview,
  isSlotDoubled,
  pendingStatPicks,
  resolveManaTerms,
  slotStatSteps,
  spellAt,
  statPickFor,
  type GameEngine,
  type GrimoireAxis,
  type GrimoireSlotRef,
  type Player,
  type ResolvedCast,
  type SpellDefinition,
} from '../../engine';
import { escapeHtml } from '../html';
import { grimoireGridHtml } from '../grimoireGrid';
import { spellPower } from '../spellPower';

/**
 * The Spellbook's view of the three-grimoire model: one grimoire at a time (a switcher
 * across the ones that have opened), its slots as a 3×3 grid around the centre, the stat of
 * each axis, and what touching slots lend each other. Pure markup; the tab binds it.
 */

export const GRIMOIRE_INFO_DEFAULT = 'Point at a slot to see what it does. Click one to put the chosen spell there.';

/** The cell is `data-gslot="x,y"`, with x and y in -1..1 from the centre. */
export const slotKey = (x: number, y: number): string => `${x},${y}`;

const AXIS_WORD: Record<GrimoireAxis, string> = { x: 'across', y: 'down' };

/** A slot's place in its grimoire in words: "Centre", "Upper left". */
export function slotPositionName(x: number, y: number): string {
  if (x === 0 && y === 0) return 'Centre';
  if (y === 0) return x < 0 ? 'Left' : 'Right';
  if (x === 0) return y < 0 ? 'Top' : 'Bottom';
  return `${y < 0 ? 'Upper' : 'Lower'} ${x < 0 ? 'left' : 'right'}`;
}

export interface GrimoireView {
  html: string;
  /** Each slot's description by `slotKey`, shown under the grid on hover or focus. */
  slotInfo: Record<string, string>;
  /** The grimoire drawn, or undefined when none has opened. */
  grimoireId?: string;
}

function spellOf(engine: GameEngine, spellId: string | undefined): SpellDefinition | undefined {
  if (!spellId) return undefined;
  return engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
}

/** The picker for an axis with no stat yet: every stat no axis uses, the suggested one first. */
function pickerHtml(player: Player, grimoireId: string, axis: GrimoireAxis): string {
  const system = player.grimoireSystem!;
  const state = player.grimoireState!;
  const layout = system.layouts.find((l) => l.id === grimoireId);
  const suggested = layout?.suggestedStats?.[axis];
  const taken = new Set(state.statPicks.map((p) => p.statId));
  const stats = system.stats
    .filter((s) => !taken.has(s.id))
    .sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested));
  const buttons = stats
    .map(
      (s) =>
        `<button type="button" class="sb-pick-btn" data-pick-grimoire="${escapeHtml(grimoireId)}" data-pick-axis="${axis}" data-pick-stat="${escapeHtml(s.id)}" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}${s.id === suggested ? ' ★' : ''}</button>`
    )
    .join('');
  return `<div class="ui-note sb-pick">Choose the stat that grows ${AXIS_WORD[axis]} the slots: ${buttons || 'every stat is in use.'}</div>`;
}

/**
 * A known spell as it is cast from its slot: cost, range and area with the slot's stats,
 * and the notes the card prints under them (stat steps, what is borrowed). A spell in no
 * slot is as written.
 */
export function castFromSlot(
  engine: GameEngine,
  player: Player,
  spell: SpellDefinition
): { cast: SpellDefinition; notes: string[]; slotted: boolean } {
  const resolved = engine.diagnostics.resolvedCasts().find((c) => c.spellId === spell.id);
  if (!resolved) return { cast: spell, notes: [], slotted: false };
  const system = player.grimoireSystem!;
  const state = player.grimoireState!;
  const notes = slotStatSteps(system, state, resolved.slot).map((s) => `${s.stat.name} ×${s.steps}`);
  for (const lend of resolved.lends) notes.push(`borrows ${lend.name}${lend.doubled ? ' (doubled)' : ''}`);
  if (resolved.gives.length) notes.push(`lends ${resolved.gives.map((g) => system.lending?.flavours.find((f) => f.id === g)?.name ?? g).join(', ')}`);
  return { cast: heroCastPreview(engine, spell), notes, slotted: true };
}

/** Whether an open grimoire has a slot with no spell in it. */
export function hasFreeGrimoireSlot(player: Player): boolean {
  const system = player.grimoireSystem;
  const state = player.grimoireState;
  if (!system || !state) return false;
  return state.opened.some((grimoireId) =>
    grimoireCells(system, state, grimoireId).some((c) => spellAt(state, { grimoireId, x: c.x, y: c.y }) === undefined)
  );
}

export function renderGrimoires(engine: GameEngine, player: Player, chosen: SpellDefinition | undefined, activeId: string | undefined): GrimoireView {
  const system = player.grimoireSystem!;
  const state = player.grimoireState!;
  const unit = resolveManaTerms(engine.manifest).unit;
  const opened = state.opened;
  if (opened.length === 0) {
    return { html: '<div class="ui-h">Grimoires</div><div class="ui-note">No grimoire has opened yet.</div>', slotInfo: {} };
  }
  const id = activeId && opened.includes(activeId) ? activeId : opened[0];
  const layout = system.layouts.find((l) => l.id === id);
  const switcher = opened
    .map((gid) => {
      const name = system.layouts.find((l) => l.id === gid)?.name ?? gid;
      return `<button type="button" class="st-subtab" data-grimoire="${escapeHtml(gid)}" aria-selected="${gid === id}">${escapeHtml(name)}</button>`;
    })
    .join('');

  const cells = grimoireCells(system, state, id);
  const has = (x: number, y: number): boolean => cells.some((c) => c.x === x && c.y === y);
  const casts = new Map<string, ResolvedCast>();
  for (const cast of engine.diagnostics.resolvedCasts()) {
    if (cast.slot.grimoireId === id) casts.set(slotKey(cast.slot.x, cast.slot.y), cast);
  }
  const index = (x: number, y: number): number => (y + 1) * 3 + (x + 1);

  // A link lights between two touching slots when one lends the other something.
  const links = new Map<string, string[]>();
  const nameAt = (ref: GrimoireSlotRef): string => spellOf(engine, spellAt(state, ref))?.name ?? 'an empty slot';
  for (const cast of casts.values()) {
    for (const lend of cast.lends) {
      for (const from of lend.from) {
        const a = index(cast.slot.x, cast.slot.y);
        const b = index(from.x, from.y);
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        const reason = `${nameAt(from)} lends ${lend.name}${lend.doubled ? ' (doubled)' : ''} to ${nameAt(cast.slot)}`;
        links.set(key, [...(links.get(key) ?? []), reason]);
      }
    }
  }

  const slotInfo: Record<string, string> = {};
  const cellHtml: string[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (!has(x, y)) {
        cellHtml.push('<span class="sb-cell is-void" aria-hidden="true"></span>');
        continue;
      }
      const key = slotKey(x, y);
      const ref: GrimoireSlotRef = { grimoireId: id, x, y };
      const spell = spellOf(engine, spellAt(state, ref));
      const cast = casts.get(key);
      const doubled = isSlotDoubled(state, ref);
      const cost = spell ? effectiveManaCost(player, spell) : 0;
      const power = spell ? spellPower(spell, { engine, player }) : 0;
      const boosted = Boolean(cast && (cast.stats.powerMultiplier > 1 || cast.lentPowerMultiplier > 1));
      const lends = cast?.lends.map((l) => l.name) ?? [];
      const body = spell
        ? `<div class="sb-cell-spell">${escapeHtml(spell.name)}</div>
           <div class="ui-faint sb-cell-meta">${escapeHtml(cast?.elements.join('/') ?? spell.element ?? 'arcane')} · <span class="ui-num">${cost}</span>${
             power ? ` · <span class="ui-num${boosted ? ' ui-up' : ''}">${power}</span>` : ''
           }</div>${lends.length ? `<div class="sb-cell-lend">+ ${escapeHtml(lends.join(', '))}</div>` : ''}`
        : '<div class="ui-faint sb-cell-empty">empty</div>';
      const cls = ['sb-cell', x === 0 && y === 0 ? 'is-center' : '', spell ? 'is-filled' : '', chosen && spell?.id === chosen.id ? 'is-mine' : '']
        .filter(Boolean)
        .join(' ');
      cellHtml.push(
        `<button type="button" class="${cls}" data-gslot="${key}"><div class="sb-cell-head"><span>${slotPositionName(x, y)}</span>${doubled ? '<span title="This slot\'s lend is doubled">×2</span>' : ''}</div>${body}</button>`
      );

      // The line under the grid
      const lines: string[] = [];
      const steps = slotStatSteps(system, state, ref);
      lines.push(steps.length ? `Stats here: ${steps.map((s) => `${escapeHtml(s.stat.name)} ×${s.steps}`).join(', ')}.` : 'No stat reaches this slot.');
      if (spell && cast) {
        lines.push(`${escapeHtml(spell.name)} cast from here: ${cost} ${escapeHtml(unit)}${power ? `, power ${power}` : ''}.`);
        for (const lend of cast.lends) lines.push(`Borrows ${escapeHtml(lend.name)}${lend.doubled ? ' (doubled)' : ''} from ${lend.from.map((f) => escapeHtml(nameAt(f))).join(' and ')}.`);
        if (cast.gives.length) lines.push(`Lends its neighbours ${cast.gives.map((g) => escapeHtml(system.lending?.flavours.find((f) => f.id === g)?.name ?? g)).join(', ')}.`);
      }
      if (doubled) lines.push('Its lend is doubled.');
      if (chosen) {
        lines.push(spell?.id === chosen.id ? `${escapeHtml(chosen.name)} sits here.` : `Click to ${state.placements.some((p) => p.spellId === chosen.id) ? 'move' : 'put'} ${escapeHtml(chosen.name)} here.`);
      }
      slotInfo[key] = `<b>${slotPositionName(x, y)}.</b> ${lines.join(' ')}`;
    }
  }

  const link = (a: number, b: number, axis: 'h' | 'v'): string => {
    const reasons = links.get(`${Math.min(a, b)}-${Math.max(a, b)}`);
    return reasons
      ? `<i class="sb-link is-${axis} is-on" title="${escapeHtml(reasons.join('; '))}"></i>`
      : `<i class="sb-link is-${axis}"></i>`;
  };

  const statLine = grimoireAxes(system, state, id)
    .map((axis) => {
      const stat = system.stats.find((s) => s.id === statPickFor(state, id, axis));
      return `<span class="sb-axis" title="${escapeHtml(stat?.description ?? '')}">${AXIS_WORD[axis][0].toUpperCase()}${AXIS_WORD[axis].slice(1)}: <b>${escapeHtml(stat?.name ?? 'not chosen')}</b></span>`;
    })
    .join(' ');
  const pickers = pendingStatPicks(system, state)
    .filter((p) => p.grimoireId === id)
    .map((p) => pickerHtml(player, id, p.axis))
    .join('');

  return {
    grimoireId: id,
    slotInfo,
    html: `
      <div class="ui-h">Grimoires <small>${opened.length} open</small></div>
      <div class="st-subtabs">${switcher}</div>
      ${layout?.openedMessage ? `<div class="ui-note">${escapeHtml(layout.openedMessage)}</div>` : ''}
      <div class="sb-axes">${statLine}</div>
      ${pickers}
      <div class="ui-inset sb-matrix">${grimoireGridHtml(cellHtml, link)}</div>
      <div class="ui-note sb-slot-info" id="sb-slot-info" aria-live="polite">${GRIMOIRE_INFO_DEFAULT}</div>`,
  };
}
