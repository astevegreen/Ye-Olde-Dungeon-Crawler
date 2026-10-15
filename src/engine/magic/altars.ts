import type { GameEngine } from '../engine';
import type { Action } from '../actions/action';
import type { ActionResult } from '../types';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import { getSpell } from './spellRegistry';
import { formatMagicMessage, type AltarDefinition, type GrimoireAxis } from './magicConfig';
import { anySpellsTouch, copyGrimoireState, forgeSpellElement, forgedElements, forgedTitle, isSlotDoubled, restatGrimoire, slotAdditions, type GrimoireSlotRef, type StatPickOutcome } from './grimoires';
import { getKillRiteConfig } from './killRites';

/**
 * Spell altars (`manifest.magic.altars`): tiles that grant one irreversible rite each,
 * paid for by burning an offering, either a known spell or an essence item.
 * Stepping onto one emits `altar_reached`; the presentation layer opens its rite and
 * performs it through `PerformAltarRiteAction`.
 */

export type AltarOfferingKind = 'spell' | 'essence';

export interface AltarOffering {
  kind: AltarOfferingKind;
  /** Spell id, or essence item definition id. */
  id: string;
  name: string;
  element: string;
  /** Spells only. */
  school?: string;
  /** Essences only: how many the player carries. */
  count?: number;
}

export interface AltarRiteRequest {
  /** Absent at an altar whose rite is free. */
  offeringKind?: AltarOfferingKind;
  offeringId?: string;
  /** double: the grimoire slot whose lend is doubled; addSlot: the slot added. */
  slot?: GrimoireSlotRef;
  /** forge: the known spell that gains the offering's element. */
  targetSpellId?: string;
  /** restat: the grimoire, and the stat each of its axes takes. */
  restat?: AltarRestat;
}

export interface AltarRestat {
  grimoireId: string;
  stats: Partial<Record<GrimoireAxis, string>>;
}

export interface AltarRiteOutcome {
  success: boolean;
  message: string;
}

/** An altar as it stands on the current floor: a deeper rite, once its floor is reached, replaces its own. */
export function getAltarDefinition(engine: GameEngine, altarId: string): AltarDefinition | undefined {
  const altar = engine.manifest?.magic?.altars?.find((a) => a.id === altarId);
  const deeper = altar?.deeperRites?.filter((d) => engine.currentFloor >= d.fromFloor).at(-1);
  return altar && deeper ? { ...altar, rite: deeper.rite, description: deeper.description, performedMessage: deeper.performedMessage } : altar;
}

/**
 * Why an altar can't grant its rite yet, said instead of opening it; it stays unspent.
 * Doubling a lend waits until two spells touch, so there is a lend to double.
 */
export function altarWaitReason(altar: AltarDefinition, player: Player): string | undefined {
  if (altar.rite === 'double' && player.grimoireState && !anySpellsTouch(player.grimoireState)) {
    return `${altar.name} waits: no two of your spells sit side by side in a grimoire, so nothing is lent to double.`;
  }
  return undefined;
}

/** Restat refusals, as an altar or a sage says them. */
export const RESTAT_REFUSALS: Record<Exclude<StatPickOutcome, 'ok' | 'already-picked'>, string> = {
  'unknown-grimoire': 'Choose a grimoire.',
  closed: 'That grimoire has not opened yet.',
  'unknown-stat': 'There is no such stat.',
  'no-axis': 'No slot of that grimoire reaches along that axis.',
  'stat-in-use': 'Each stat sits on one axis only.',
  'axis-unpicked': 'Choose a stat for every axis of that grimoire.',
};

/**
 * Re-picks one grimoire's stats on a copy, so a refused pick changes nothing: the refusal,
 * or undefined when `player.restatGrimoire` will take it.
 */
export function restatRefusal(player: Player, restat: AltarRestat | undefined): string | undefined {
  const system = player.grimoireSystem;
  const state = player.grimoireState;
  if (!system || !state || !restat) return RESTAT_REFUSALS['unknown-grimoire'];
  const outcome = restatGrimoire(system, { ...state, statPicks: state.statPicks.map((p) => ({ ...p })) }, restat.grimoireId, restat.stats);
  return outcome === 'ok' || outcome === 'already-picked' ? undefined : RESTAT_REFUSALS[outcome];
}

function spentFlag(engine: GameEngine, x: number, y: number): string {
  return `altar_spent:${engine.currentFloor}:${x}:${y}`;
}

/** An altar grants one rite; after that it is spent for good. */
export function isAltarSpent(engine: GameEngine, x: number, y: number): boolean {
  return engine.getWorldFlag(spentFlag(engine, x, y));
}

function spellDef(engine: GameEngine, spellId: string) {
  return engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
}

/** What the player can burn: every known spell, and each kind of essence carried. */
export function listAltarOfferings(engine: GameEngine, player: Player): AltarOffering[] {
  const offerings: AltarOffering[] = [];
  for (const id of player.spellsKnown) {
    const spell = spellDef(engine, id);
    if (spell) offerings.push({ kind: 'spell', id, name: spell.name, element: spell.element, school: spell.school });
  }
  const essenceItems = getKillRiteConfig(engine)?.essenceItems ?? {};
  for (const [element, itemId] of Object.entries(essenceItems)) {
    const count = player.inventory
      .getAllCarriedItems()
      .filter((i) => i.definitionId === itemId)
      .reduce((n, i) => n + (i.quantity ?? 1), 0);
    if (count > 0) {
      const name = engine.manifest?.items?.find((d) => d.id === itemId)?.name ?? itemId;
      offerings.push({ kind: 'essence', id: itemId, name, element, count });
    }
  }
  return offerings;
}

/** Destroys the offering: forgets the spell, or consumes one essence. */
function burnOffering(player: Player, offering: AltarOffering): void {
  if (offering.kind === 'spell') {
    player.forgetSpell(offering.id);
    return;
  }
  const item = player.inventory.getAllCarriedItems().find((i) => i.definitionId === offering.id);
  if (item) player.inventory.consumeOne(item.id);
}

/**
 * Why the forge refuses to give `spellId` this element, or undefined when it will: the
 * element must be new to the spell (its own, or one fate gave it; a forged one is swapped).
 */
export function forgeRefusal(engine: GameEngine, player: Player, spellId: string | undefined, element: string): string | undefined {
  const spell = spellId ? spellDef(engine, spellId) : undefined;
  if (!spell || !player.spellsKnown.includes(spell.id)) return 'Choose a known spell to forge.';
  const state = player.grimoireState;
  if (!state) return 'The forge needs a grimoire to work in.';
  const kept = state.forged.filter((f) => f.spellId === spell.id && f.fated !== undefined).map((f) => f.element);
  if (spell.element === element || kept.includes(element)) return `${spell.name} already carries ${element}.`;
  if (forgedElements(state, spell.id).includes(element)) return `${spell.name} is already forged with ${element}.`;
  return undefined;
}

/** What forging `element` onto a known spell makes of it: its title, its elements, and the forged element it swaps out. */
export interface ForgePreview {
  title: string;
  elements: string[];
  swapped?: string;
}

export function previewForge(engine: GameEngine, player: Player, spellId: string, element: string, fated?: string): ForgePreview | undefined {
  const spell = spellDef(engine, spellId);
  const system = player.grimoireSystem;
  const state = player.grimoireState;
  if (!spell || !system || !state) return undefined;
  const after = copyGrimoireState(state);
  forgeSpellElement(after, spell.id, element, fated);
  const swapped = fated === undefined ? state.forged.find((f) => f.spellId === spell.id && f.fated === undefined)?.element : undefined;
  return { title: forgedTitle(system, after, spell), elements: [spell.element as string, ...forgedElements(after, spell.id)], swapped };
}

/** Performs an altar's rite. Validates everything before burning anything. */
export function performAltarRite(
  engine: GameEngine,
  player: Player,
  altar: AltarDefinition,
  x: number,
  y: number,
  request: AltarRiteRequest
): AltarRiteOutcome {
  if (isAltarSpent(engine, x, y)) return { success: false, message: formatMagicMessage(altar.spentMessage, { altar: altar.name }) };
  const wait = altarWaitReason(altar, player);
  if (wait) return { success: false, message: wait };
  const offering = altar.free ? undefined : listAltarOfferings(engine, player).find((o) => o.kind === request.offeringKind && o.id === request.offeringId);
  if (!altar.free && !offering) return { success: false, message: 'You have nothing like that to offer.' };

  const values: Record<string, string | number> = { altar: altar.name, offering: offering?.name ?? '' };
  const bookName = (grimoireId: string): string => player.grimoireSystem?.layouts.find((l) => l.id === grimoireId)?.name ?? grimoireId;
  let apply: () => string | undefined;

  switch (altar.rite) {
    case 'double': {
      const slot = request.slot;
      const spellId = slot && player.grimoireState ? player.grimoireState.placements.find((p) => p.grimoireId === slot.grimoireId && p.x === slot.x && p.y === slot.y)?.spellId : undefined;
      if (!slot || !spellId) return { success: false, message: 'Choose a grimoire slot that holds a spell.' };
      if (offering?.kind === 'spell' && offering.id === spellId) return { success: false, message: 'A spell cannot be burned to strengthen its own slot.' };
      if (player.grimoireState && isSlotDoubled(player.grimoireState, slot)) return { success: false, message: 'What that slot lends is already doubled.' };
      values.spell = spellDef(engine, spellId)?.name ?? spellId;
      apply = () => {
        player.doubleGrimoireSlotLend(slot);
        return undefined;
      };
      break;
    }
    case 'forge': {
      const target = request.targetSpellId ? spellDef(engine, request.targetSpellId) : undefined;
      if (!offering) return { success: false, message: 'The forge takes an offering.' };
      if (offering.kind === 'spell' && offering.id === target?.id) return { success: false, message: 'A spell cannot be forged with itself.' };
      const refusal = forgeRefusal(engine, player, target?.id, offering.element);
      if (refusal || !target) return { success: false, message: refusal ?? 'Choose a known spell to forge.' };
      values.spell = target.name;
      apply = () => {
        player.forgeSpell(target.id, offering.element);
        values.title = forgedTitle(player.grimoireSystem!, player.grimoireState!, target);
        return undefined;
      };
      break;
    }
    case 'restat': {
      const restat = request.restat;
      const refusal = restatRefusal(player, restat);
      if (refusal || !restat) return { success: false, message: refusal ?? RESTAT_REFUSALS['unknown-grimoire'] };
      values.grimoire = bookName(restat.grimoireId);
      apply = () => {
        player.restatGrimoire(restat.grimoireId, restat.stats);
        return undefined;
      };
      break;
    }
    case 'addSlot': {
      const slot = request.slot;
      const state = player.grimoireState;
      const system = player.grimoireSystem;
      if (!slot || !state || !system || !slotAdditions(system, state).some((s) => s.grimoireId === slot.grimoireId && s.x === slot.x && s.y === slot.y)) {
        return { success: false, message: 'Choose a place beside a slot of an open grimoire.' };
      }
      values.grimoire = bookName(slot.grimoireId);
      apply = () => {
        player.addGrimoireSlot(slot);
        return undefined;
      };
      break;
    }
    case 'gamble': {
      const gamble = altar.gamble;
      if (!gamble) return { success: false, message: 'This altar is silent.' };
      apply = () => rollGamble(engine, player, altar, values);
      break;
    }
  }

  // Burn first, so a forged-away or gambled spell can't be the one returned
  if (offering) burnOffering(player, offering);
  const override = apply();
  if (altar.clearsVoidDebt) player.clearVoidDebt();
  engine.setWorldFlag(spentFlag(engine, x, y), true);
  const message = override ?? formatMagicMessage(altar.performedMessage, values);
  engine.log(message);
  engine.emitGameEvent({
    type: 'altar_rite_performed',
    turn: engine.turnCount,
    actorId: player.id,
    data: { altarId: altar.id, rite: altar.rite, offeringId: offering?.id ?? '' },
  });
  return { success: true, message };
}

function rollGamble(
  engine: GameEngine,
  player: Player,
  altar: AltarDefinition,
  values: Record<string, string | number>
): string {
  const gamble = altar.gamble!;
  const roll = engine.prng.nextInt(1, 100);
  const unknown = gamble.spellPool.filter((id) => !player.spellsKnown.includes(id) && spellDef(engine, id));
  const state = player.grimoireState;
  const slots = state ? state.placements.filter((p) => !isSlotDoubled(state, p)) : [];

  if (roll <= 40 && unknown.length > 0) {
    const spellId = engine.prng.choice(unknown);
    const learned = player.learnSpellResult(spellId);
    values.spell = spellDef(engine, spellId)?.name ?? spellId;
    const waiting = learned.outcome === 'full' ? ' Every slot in your grimoires is full: it waits in your spellbook until you make room.' : '';
    return formatMagicMessage(gamble.spellMessage, values) + waiting;
  }
  if (roll <= 80 && slots.length > 0) {
    const slot = engine.prng.choice(slots);
    player.doubleGrimoireSlotLend(slot);
    values.spell = spellDef(engine, slot.spellId)?.name ?? slot.spellId;
    return formatMagicMessage(gamble.doubleMessage, values);
  }
  player.accrueVoidDebt(gamble.debtPenalty);
  values.debt = player.voidDebt;
  return formatMagicMessage(gamble.debtMessage, values);
}

/** Performs an altar rite as a player action (so it is recorded and replayable). Costs a turn. */
export class PerformAltarRiteAction implements Action {
  public readonly player: Player;
  public readonly altarId: string;
  public readonly x: number;
  public readonly y: number;
  public readonly offeringKind?: AltarOfferingKind;
  public readonly offeringId?: string;
  public readonly slot?: GrimoireSlotRef;
  public readonly targetSpellId?: string;
  /** Flat, so the action trail records it: the grimoire and each axis's stat. */
  public readonly restat?: { grimoireId: string; x?: string; y?: string };

  get actor(): Entity {
    return this.player;
  }

  constructor(player: Player, altarId: string, x: number, y: number, request: AltarRiteRequest) {
    this.player = player;
    this.altarId = altarId;
    this.x = x;
    this.y = y;
    this.offeringKind = request.offeringKind;
    this.offeringId = request.offeringId;
    this.slot = request.slot ? { ...request.slot } : undefined;
    this.targetSpellId = request.targetSpellId;
    this.restat = request.restat ? { grimoireId: request.restat.grimoireId, ...request.restat.stats } : undefined;
  }

  public perform(engine: GameEngine): ActionResult {
    const altar = getAltarDefinition(engine, this.altarId);
    if (!altar) return { success: false, cost: 0, message: 'There is no altar here.' };
    const outcome = performAltarRite(engine, this.player, altar, this.x, this.y, {
      offeringKind: this.offeringKind,
      offeringId: this.offeringId,
      slot: this.slot,
      targetSpellId: this.targetSpellId,
      restat: this.restat ? { grimoireId: this.restat.grimoireId, stats: { x: this.restat.x, y: this.restat.y } } : undefined,
    });
    if (!outcome.success) return { success: false, cost: 0, message: outcome.message };
    const cost = this.player.getActionCost(100);
    this.player.consumeEnergy(cost);
    return { success: true, cost, message: outcome.message };
  }
}
