import type { SpellDefinition } from './types';
import type {
  GrimoireAxis,
  GrimoireCell,
  GrimoireLayout,
  GrimoireStatDefinition,
  GrimoireSystemConfig,
} from './magicConfig';
import type { SerializedGrimoireState } from '../storage/types';

/*
 * The three-grimoire model (P-29): pack-declared layouts around a centre, axis stats by a
 * slot's distance from it, grimoires that open as the hero learns, and every known spell
 * in a slot. Used only when a pack declares `magic.grimoires`. State is plain data, saved as optional fields (`SerializedPlayer.grimoires`).
 */

export interface GrimoireSlotRef {
  grimoireId: string;
  x: number;
  y: number;
}

export interface GrimoirePlacement extends GrimoireSlotRef {
  spellId: string;
}

export interface GrimoireStatPick {
  grimoireId: string;
  axis: GrimoireAxis;
  statId: string;
}

/** An element a spell carries beside its own (the forge; a retired hybrid carried over). */
export interface GrimoireForge {
  spellId: string;
  element: string;
}

export interface GrimoireState {
  /** Grimoire ids in the order they opened; an open grimoire never closes. */
  opened: string[];
  /** One per known spell, one spell per slot. */
  placements: GrimoirePlacement[];
  statPicks: GrimoireStatPick[];
  /** Slots added beyond a layout's base cells (Hel's altars). */
  extraSlots: GrimoireSlotRef[];
  /** Slots whose lend is doubled (Týr's Oath-Stone, Loki's Cairn), once each. */
  doubledSlots: GrimoireSlotRef[];
  /** Spells forgotten this run, which are never learned again. */
  forgotten: string[];
  /** Elements added to known spells, in the order added. */
  forged: GrimoireForge[];
  /** Spells offered to the hero that found no free slot: they wait here until one is made. */
  offers: string[];
}

export type StatPickOutcome = 'ok' | 'unknown-grimoire' | 'closed' | 'unknown-stat' | 'no-axis' | 'stat-in-use' | 'already-picked' | 'axis-unpicked';

/** Each stat's steps on a slot, from its axis picks. */
export interface SlotStatSteps {
  stat: GrimoireStatDefinition;
  steps: number;
}

/** What a slot's axis stats do to a spell cast from it; all neutral (1 or 0) without stats. */
export interface GrimoireSlotStats {
  powerMultiplier: number;
  costMultiplier: number;
  rangeBonus: number;
  areaBonus: number;
  durationMultiplier: number;
  /** The share of a turn the cast takes. */
  castTimeFraction: number;
}

const sameCell = (a: GrimoireCell, b: GrimoireCell): boolean => a.x === b.x && a.y === b.y;
const sameSlot = (a: GrimoireSlotRef, b: GrimoireSlotRef): boolean => a.grimoireId === b.grimoireId && sameCell(a, b);
const touches = (a: GrimoireCell, b: GrimoireCell): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

export function createGrimoireState(): GrimoireState {
  return { opened: [], placements: [], statPicks: [], extraSlots: [], doubledSlots: [], forgotten: [], forged: [], offers: [] };
}

export function copyGrimoireState(state: GrimoireState): GrimoireState {
  return {
    opened: [...state.opened],
    placements: state.placements.map((p) => ({ ...p })),
    statPicks: state.statPicks.map((p) => ({ ...p })),
    extraSlots: state.extraSlots.map((s) => ({ ...s })),
    doubledSlots: state.doubledSlots.map((s) => ({ ...s })),
    forgotten: [...state.forgotten],
    forged: state.forged.map((f) => ({ ...f })),
    offers: [...state.offers],
  };
}

function layoutOf(config: GrimoireSystemConfig, grimoireId: string): GrimoireLayout | undefined {
  return config.layouts.find((l) => l.id === grimoireId);
}

/** A grimoire's slots: its base cells, then the ones added to it, in the order added. */
export function grimoireCells(config: GrimoireSystemConfig, state: GrimoireState, grimoireId: string): GrimoireCell[] {
  const base = layoutOf(config, grimoireId)?.cells ?? [];
  const extra = state.extraSlots.filter((s) => s.grimoireId === grimoireId).map(({ x, y }) => ({ x, y }));
  return [...base.map(({ x, y }) => ({ x, y })), ...extra];
}

/** Every slot of every open grimoire, in opening order. */
export function openSlots(config: GrimoireSystemConfig, state: GrimoireState): GrimoireSlotRef[] {
  return state.opened.flatMap((grimoireId) => grimoireCells(config, state, grimoireId).map((c) => ({ grimoireId, ...c })));
}

export function slotExists(config: GrimoireSystemConfig, state: GrimoireState, ref: GrimoireSlotRef): boolean {
  return state.opened.includes(ref.grimoireId) && grimoireCells(config, state, ref.grimoireId).some((c) => sameCell(c, ref));
}

/** The slots touching this one by a straight side, in its own grimoire. */
export function slotNeighbours(config: GrimoireSystemConfig, state: GrimoireState, ref: GrimoireSlotRef): GrimoireSlotRef[] {
  return grimoireCells(config, state, ref.grimoireId)
    .filter((c) => touches(c, ref))
    .map((c) => ({ grimoireId: ref.grimoireId, ...c }));
}

export function spellAt(state: GrimoireState, ref: GrimoireSlotRef): string | undefined {
  return state.placements.find((p) => sameSlot(p, ref))?.spellId;
}

export function slotOfSpell(state: GrimoireState, spellId: string): GrimoireSlotRef | undefined {
  const p = state.placements.find((q) => q.spellId === spellId);
  return p ? { grimoireId: p.grimoireId, x: p.x, y: p.y } : undefined;
}

export function isSlotDoubled(state: GrimoireState, ref: GrimoireSlotRef): boolean {
  return state.doubledSlots.some((s) => sameSlot(s, ref));
}

/** The axes a grimoire's slots reach along: a row of 3 has only `x` until a slot is added above or below. */
export function grimoireAxes(config: GrimoireSystemConfig, state: GrimoireState, grimoireId: string): GrimoireAxis[] {
  const cells = grimoireCells(config, state, grimoireId);
  return (['x', 'y'] as const).filter((axis) => cells.some((c) => c[axis] !== 0));
}

export function statPickFor(state: GrimoireState, grimoireId: string, axis: GrimoireAxis): string | undefined {
  return state.statPicks.find((p) => p.grimoireId === grimoireId && p.axis === axis)?.statId;
}

/** Axes of open grimoires that reach out but have no stat yet, for the picker to ask about. */
export function pendingStatPicks(config: GrimoireSystemConfig, state: GrimoireState): Array<{ grimoireId: string; axis: GrimoireAxis }> {
  return state.opened.flatMap((grimoireId) =>
    grimoireAxes(config, state, grimoireId)
      .filter((axis) => statPickFor(state, grimoireId, axis) === undefined)
      .map((axis) => ({ grimoireId, axis }))
  );
}

/**
 * Puts a stat on one axis of an open grimoire. A stat sits on one axis of one grimoire
 * only, so a grimoire's two axes always differ. An axis already holding a stat changes
 * only with `replace` (a re-pick at an altar or in town).
 */
export function assignStat(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  pick: GrimoireStatPick,
  replace = false
): StatPickOutcome {
  if (!layoutOf(config, pick.grimoireId)) return 'unknown-grimoire';
  if (!state.opened.includes(pick.grimoireId)) return 'closed';
  if (!config.stats.some((s) => s.id === pick.statId)) return 'unknown-stat';
  if (!grimoireAxes(config, state, pick.grimoireId).includes(pick.axis)) return 'no-axis';
  const current = state.statPicks.find((p) => p.grimoireId === pick.grimoireId && p.axis === pick.axis);
  if (current && !replace) return 'already-picked';
  if (state.statPicks.some((p) => p !== current && p.statId === pick.statId)) return 'stat-in-use';
  if (current) current.statId = pick.statId;
  else state.statPicks.push({ ...pick });
  return 'ok';
}

/**
 * Re-picks every axis of one open grimoire at once (an altar's or a sage's service): each
 * axis it reaches along takes a stat, the two differ, and neither sits on another grimoire.
 * Changes nothing unless the whole pick is valid.
 */
export function restatGrimoire(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  grimoireId: string,
  stats: Partial<Record<GrimoireAxis, string>>
): StatPickOutcome {
  if (!layoutOf(config, grimoireId)) return 'unknown-grimoire';
  if (!state.opened.includes(grimoireId)) return 'closed';
  const axes = grimoireAxes(config, state, grimoireId);
  if ((Object.keys(stats) as GrimoireAxis[]).some((axis) => stats[axis] !== undefined && !axes.includes(axis))) return 'no-axis';
  const picked = axes.map((axis) => stats[axis]);
  if (picked.some((id) => id === undefined)) return 'axis-unpicked';
  if (picked.some((id) => !config.stats.some((s) => s.id === id))) return 'unknown-stat';
  const elsewhere = state.statPicks.filter((p) => p.grimoireId !== grimoireId).map((p) => p.statId);
  if (new Set(picked).size < picked.length || picked.some((id) => elsewhere.includes(id!))) return 'stat-in-use';
  state.statPicks = [
    ...state.statPicks.filter((p) => p.grimoireId !== grimoireId),
    ...axes.map((axis) => ({ grimoireId, axis, statId: stats[axis]! })),
  ];
  return 'ok';
}

/** Each picked stat's steps on a slot: `|x|` of the `x` axis's stat, `|y|` of the `y` axis's. */
export function slotStatSteps(config: GrimoireSystemConfig, state: GrimoireState, ref: GrimoireSlotRef): SlotStatSteps[] {
  const out: SlotStatSteps[] = [];
  for (const axis of ['x', 'y'] as const) {
    const steps = Math.abs(ref[axis]);
    const stat = config.stats.find((s) => s.id === statPickFor(state, ref.grimoireId, axis));
    if (steps > 0 && stat) out.push({ stat, steps });
  }
  return out;
}

/** Whether a spell deals damage, for the area cap. */
function dealsDamage(spell: SpellDefinition): boolean {
  return spell.effects?.some((e) => e.type === 'damage') ?? false;
}

/**
 * The step math: what a slot's stat steps do to a cast. With a spell, the area cap on
 * damage spells applies; without one, the numbers are the uncapped ones.
 */
export function resolveSlotStats(steps: SlotStatSteps[], spell?: SpellDefinition): GrimoireSlotStats {
  const out: GrimoireSlotStats = {
    powerMultiplier: 1,
    costMultiplier: 1,
    rangeBonus: 0,
    areaBonus: 0,
    durationMultiplier: 1,
    castTimeFraction: 1,
  };
  for (const { stat, steps: n } of steps) {
    const per = stat.perStep ?? 0;
    switch (stat.kind) {
      case 'power':
        out.powerMultiplier *= 1 + per * n;
        break;
      case 'thrift':
        out.costMultiplier *= Math.pow(1 - per, n);
        break;
      case 'range':
        out.rangeBonus += per * n;
        break;
      case 'area': {
        const cap = spell && stat.maxStepsOnDamage !== undefined && dealsDamage(spell) ? stat.maxStepsOnDamage : n;
        out.areaBonus += per * Math.min(n, cap);
        break;
      }
      case 'duration':
        out.durationMultiplier *= 1 + per * n;
        break;
      case 'swift': {
        const table = stat.castTimeByStep ?? [];
        if (table.length > 0) out.castTimeFraction = Math.min(out.castTimeFraction, table[Math.min(n, table.length) - 1]);
        break;
      }
    }
  }
  return out;
}

/** Grimoires that open once the hero knows `spellsKnown` spells and aren't open yet, in declared order. */
function dueToOpen(config: GrimoireSystemConfig, state: GrimoireState, spellsKnown: number): string[] {
  return config.layouts
    .filter((l) => !state.opened.includes(l.id) && spellsKnown >= (l.opensAtSpellsKnown ?? 0))
    .map((l) => l.id);
}

/** Opens what is due at this many known spells; returns the ids it opened. */
export function openDueGrimoires(config: GrimoireSystemConfig, state: GrimoireState, spellsKnown: number): string[] {
  const due = dueToOpen(config, state, spellsKnown);
  state.opened.push(...due);
  return due;
}

function firstFreeSlot(config: GrimoireSystemConfig, state: GrimoireState, opened: string[]): GrimoireSlotRef | undefined {
  return openSlots(config, { ...state, opened }).find((slot) => spellAt(state, slot) === undefined);
}

export type LearnOutcome = 'learned' | 'known' | 'forgotten' | 'full';

export interface LearnResult {
  outcome: LearnOutcome;
  /** Where the spell went, when learned. */
  slot?: GrimoireSlotRef;
  /** Grimoires the spell opened. */
  opened: string[];
}

/**
 * Learns a spell into the first free slot, opening what the new count of known spells
 * opens. With no free slot even then, nothing changes and the outcome is `full`, for the
 * learning card to offer forgetting one. `spellsKnown` is the list before learning.
 */
export function learnIntoGrimoire(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  spellsKnown: readonly string[],
  spellId: string
): LearnResult {
  if (spellsKnown.includes(spellId)) return { outcome: 'known', opened: [] };
  if (state.forgotten.includes(spellId)) return { outcome: 'forgotten', opened: [] };
  const due = dueToOpen(config, state, spellsKnown.length + 1);
  const slot = firstFreeSlot(config, state, [...state.opened, ...due]);
  if (!slot) {
    if (!state.offers.includes(spellId)) state.offers.push(spellId);
    return { outcome: 'full', opened: [] };
  }
  state.offers = state.offers.filter((id) => id !== spellId);
  state.opened.push(...due);
  state.placements.push({ ...slot, spellId });
  return { outcome: 'learned', slot, opened: due };
}

/** Takes a forgotten spell out of its slot and keeps it from returning this run. */
export function forgetFromGrimoire(state: GrimoireState, spellId: string): void {
  state.placements = state.placements.filter((p) => p.spellId !== spellId);
  if (!state.forgotten.includes(spellId)) state.forgotten.push(spellId);
}

/**
 * Places a known spell in a slot of an open grimoire, moving it from where it was; a spell
 * already in the target slot takes the moved spell's old one, so every spell keeps a slot.
 */
export function placeSpell(
  config: GrimoireSystemConfig,
  state: GrimoireState,
  spellsKnown: readonly string[],
  spellId: string,
  target: GrimoireSlotRef
): boolean {
  if (!spellsKnown.includes(spellId) || !slotExists(config, state, target)) return false;
  const moving = state.placements.find((p) => p.spellId === spellId);
  const occupant = state.placements.find((p) => sameSlot(p, target));
  if (occupant === moving && moving) return true;
  if (occupant) {
    if (!moving) return false;
    occupant.grimoireId = moving.grimoireId;
    occupant.x = moving.x;
    occupant.y = moving.y;
  }
  if (moving) {
    moving.grimoireId = target.grimoireId;
    moving.x = target.x;
    moving.y = target.y;
  } else {
    state.placements.push({ ...target, spellId });
  }
  return true;
}

/** Where a slot can be added: beside a slot of an open grimoire, beyond the 3×3 outline too. */
export function slotAdditions(config: GrimoireSystemConfig, state: GrimoireState): GrimoireSlotRef[] {
  return state.opened.flatMap((grimoireId) => {
    const cells = grimoireCells(config, state, grimoireId);
    const seen = new Set<string>();
    return cells
      .flatMap((c) => [{ x: c.x, y: c.y - 1 }, { x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 }])
      .filter((c) => !cells.some((o) => sameCell(o, c)) && !seen.has(`${c.x},${c.y}`) && seen.add(`${c.x},${c.y}`))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((c) => ({ grimoireId, ...c }));
  });
}

/** Adds a slot to an open grimoire, touching one of its slots; it may sit beyond the 3×3 outline. */
export function addExtraSlot(config: GrimoireSystemConfig, state: GrimoireState, ref: GrimoireSlotRef): boolean {
  if (!state.opened.includes(ref.grimoireId)) return false;
  const cells = grimoireCells(config, state, ref.grimoireId);
  if (cells.some((c) => sameCell(c, ref)) || !cells.some((c) => touches(c, ref))) return false;
  state.extraSlots.push({ grimoireId: ref.grimoireId, x: ref.x, y: ref.y });
  return true;
}

/** True when some two placed spells sit in touching slots, so one lends to the other. */
export function anySpellsTouch(state: GrimoireState): boolean {
  return state.placements.some((p) => state.placements.some((q) => q.grimoireId === p.grimoireId && touches(p, q)));
}

/** Doubles what a slot lends, once per slot. */
export function doubleSlotLend(config: GrimoireSystemConfig, state: GrimoireState, ref: GrimoireSlotRef): boolean {
  if (!slotExists(config, state, ref) || isSlotDoubled(state, ref)) return false;
  state.doubledSlots.push({ grimoireId: ref.grimoireId, x: ref.x, y: ref.y });
  return true;
}

/**
 * Brings a loaded or freshly made state in line with the pack and the known spells:
 * opens what is due, drops what names a grimoire, slot, stat or spell that no longer
 * exists (and repeats), then slots any known spell without a slot. A spell that finds
 * no free slot stays known and unslotted; the return lists those.
 */
export function reconcileGrimoireState(config: GrimoireSystemConfig, state: GrimoireState, spellsKnown: readonly string[]): string[] {
  const known = new Set(config.layouts.map((l) => l.id));
  state.opened = state.opened.filter((id, i) => known.has(id) && state.opened.indexOf(id) === i);
  openDueGrimoires(config, state, spellsKnown.length);
  state.extraSlots = state.extraSlots.filter(
    (s, i) => state.opened.includes(s.grimoireId) && state.extraSlots.findIndex((o) => sameSlot(o, s)) === i
  );
  const seenSpells = new Set<string>();
  state.placements = state.placements.filter((p, i) => {
    if (!spellsKnown.includes(p.spellId) || seenSpells.has(p.spellId) || !slotExists(config, state, p)) return false;
    if (state.placements.findIndex((o) => sameSlot(o, p)) !== i) return false;
    seenSpells.add(p.spellId);
    return true;
  });
  const usedStats = new Set<string>();
  state.statPicks = state.statPicks.filter((p, i) => {
    const valid =
      state.opened.includes(p.grimoireId) &&
      config.stats.some((s) => s.id === p.statId) &&
      grimoireAxes(config, state, p.grimoireId).includes(p.axis) &&
      !usedStats.has(p.statId) &&
      state.statPicks.findIndex((o) => o.grimoireId === p.grimoireId && o.axis === p.axis) === i;
    if (valid) usedStats.add(p.statId);
    return valid;
  });
  state.doubledSlots = state.doubledSlots.filter(
    (s, i) => slotExists(config, state, s) && state.doubledSlots.findIndex((o) => sameSlot(o, s)) === i
  );
  state.forgotten = state.forgotten.filter((id, i) => !spellsKnown.includes(id) && state.forgotten.indexOf(id) === i);
  state.offers = state.offers.filter((id, i) => !spellsKnown.includes(id) && !state.forgotten.includes(id) && state.offers.indexOf(id) === i);
  state.forged = state.forged.filter(
    (f, i) => spellsKnown.includes(f.spellId) && state.forged.findIndex((o) => o.spellId === f.spellId && o.element === f.element) === i
  );
  const unslotted: string[] = [];
  for (const spellId of spellsKnown) {
    if (seenSpells.has(spellId)) continue;
    const slot = firstFreeSlot(config, state, state.opened);
    if (slot) state.placements.push({ ...slot, spellId });
    else unslotted.push(spellId);
  }
  return unslotted;
}

/** Problems in a pack's grimoire declaration, one line each; none means it is sound. */
export function validateGrimoireSystem(config: GrimoireSystemConfig): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const layout of config.layouts) {
    if (ids.has(layout.id)) problems.push(`grimoire ${layout.id} is declared twice`);
    ids.add(layout.id);
    const cells = layout.cells;
    if (!cells.some((c) => c.x === 0 && c.y === 0)) problems.push(`grimoire ${layout.id} has no centre (0, 0)`);
    cells.forEach((c, i) => {
      if (Math.abs(c.x) > 1 || Math.abs(c.y) > 1) problems.push(`grimoire ${layout.id} cell (${c.x}, ${c.y}) is outside the 3×3 grid`);
      if (cells.findIndex((o) => sameCell(o, c)) !== i) problems.push(`grimoire ${layout.id} cell (${c.x}, ${c.y}) is declared twice`);
      if (cells.length > 1 && !cells.some((o) => touches(o, c))) problems.push(`grimoire ${layout.id} cell (${c.x}, ${c.y}) touches no other cell`);
    });
    for (const [axis, statId] of Object.entries(layout.suggestedStats ?? {})) {
      if (!config.stats.some((s) => s.id === statId)) problems.push(`grimoire ${layout.id} suggests unknown stat ${statId} for ${axis}`);
    }
  }
  const statIds = new Set<string>();
  for (const stat of config.stats) {
    if (statIds.has(stat.id)) problems.push(`stat ${stat.id} is declared twice`);
    statIds.add(stat.id);
    if (stat.kind === 'swift' && !stat.castTimeByStep?.length) problems.push(`stat ${stat.id} is swift with no castTimeByStep`);
    if (stat.kind !== 'swift' && stat.perStep === undefined) problems.push(`stat ${stat.id} has no perStep`);
  }
  const retired = config.retired?.spells ?? {};
  for (const [oldId, target] of Object.entries(retired)) {
    if (target === null) continue;
    const newId = typeof target === 'string' ? target : target.spellId;
    if (newId === oldId || newId in retired) problems.push(`retired spell ${oldId} maps to ${newId}, which is itself retired`);
    if (typeof target !== 'string' && !target.addedElement) problems.push(`retired spell ${oldId} adds no element`);
  }
  return problems;
}

/** The state as saved, each list left out when empty. */
export function serializeGrimoireState(state: GrimoireState): SerializedGrimoireState {
  const s = copyGrimoireState(state);
  return {
    opened: s.opened,
    placements: s.placements,
    statPicks: s.statPicks.length > 0 ? s.statPicks : undefined,
    extraSlots: s.extraSlots.length > 0 ? s.extraSlots : undefined,
    doubledSlots: s.doubledSlots.length > 0 ? s.doubledSlots : undefined,
    forgotten: s.forgotten.length > 0 ? s.forgotten : undefined,
    forged: s.forged.length > 0 ? s.forged : undefined,
    offers: s.offers.length > 0 ? s.offers : undefined,
  };
}

/** Reads saved state defensively: a malformed entry is dropped, never thrown on. */
export function readGrimoireState(raw: unknown): GrimoireState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object') : [];
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []);
  const slot = (e: Record<string, unknown>): GrimoireSlotRef | undefined =>
    typeof e.grimoireId === 'string' && Number.isInteger(e.x) && Number.isInteger(e.y)
      ? { grimoireId: e.grimoireId, x: e.x as number, y: e.y as number }
      : undefined;
  const slots = (v: unknown): GrimoireSlotRef[] => list(v).map(slot).filter((s): s is GrimoireSlotRef => !!s);
  return {
    opened: strings(r.opened),
    placements: list(r.placements).flatMap((e) => {
      const s = slot(e);
      return s && typeof e.spellId === 'string' ? [{ ...s, spellId: e.spellId }] : [];
    }),
    statPicks: list(r.statPicks).flatMap((e) =>
      typeof e.grimoireId === 'string' && (e.axis === 'x' || e.axis === 'y') && typeof e.statId === 'string'
        ? [{ grimoireId: e.grimoireId, axis: e.axis, statId: e.statId } as GrimoireStatPick]
        : []
    ),
    extraSlots: slots(r.extraSlots),
    doubledSlots: slots(r.doubledSlots),
    forgotten: strings(r.forgotten),
    forged: list(r.forged).flatMap((e) =>
      typeof e.spellId === 'string' && typeof e.element === 'string' ? [{ spellId: e.spellId, element: e.element }] : []
    ),
    offers: strings(r.offers),
  };
}
