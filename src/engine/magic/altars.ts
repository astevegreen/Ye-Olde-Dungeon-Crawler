import type { GameEngine } from '../engine';
import type { Action } from '../actions/action';
import type { ActionResult } from '../types';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import { getSpell } from './spellRegistry';
import { formatMagicMessage, type AltarDefinition } from './magicConfig';
import { isSlotDoubled, slotOfSpell, type GrimoireSlotRef } from './grimoires';
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
  offeringKind: AltarOfferingKind;
  offeringId: string;
  /** double: the grimoire slot whose lend is doubled. */
  slot?: GrimoireSlotRef;
  /** forge: the known spell to transmute. */
  targetSpellId?: string;
}

export interface AltarRiteOutcome {
  success: boolean;
  message: string;
}

export function getAltarDefinition(engine: GameEngine, altarId: string): AltarDefinition | undefined {
  return engine.manifest?.magic?.altars?.find((a) => a.id === altarId);
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

/** The pack's hybrid spell for two elements, in either order. */
export function findHybridSpellId(engine: GameEngine, a: string, b: string): string | undefined {
  return engine.manifest?.magic?.hybrids?.find(
    (h) => (h.elements[0] === a && h.elements[1] === b) || (h.elements[0] === b && h.elements[1] === a)
  )?.spellId;
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
  const offering = listAltarOfferings(engine, player).find((o) => o.kind === request.offeringKind && o.id === request.offeringId);
  if (!offering) return { success: false, message: 'You have nothing like that to offer.' };

  const values: Record<string, string | number> = { altar: altar.name, offering: offering.name };
  let apply: () => string | undefined;

  switch (altar.rite) {
    case 'double': {
      const slot = request.slot;
      const spellId = slot && player.grimoireState ? player.grimoireState.placements.find((p) => p.grimoireId === slot.grimoireId && p.x === slot.x && p.y === slot.y)?.spellId : undefined;
      if (!slot || !spellId) return { success: false, message: 'Choose a grimoire slot that holds a spell.' };
      if (offering.kind === 'spell' && offering.id === spellId) return { success: false, message: 'A spell cannot be burned to strengthen its own slot.' };
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
      if (!target || !player.spellsKnown.includes(target.id)) return { success: false, message: 'Choose a known spell to transmute.' };
      if (offering.kind === 'spell' && offering.id === target.id) return { success: false, message: 'A spell cannot be fused with itself.' };
      const hybridId = findHybridSpellId(engine, target.element, offering.element);
      const hybrid = hybridId ? spellDef(engine, hybridId) : undefined;
      if (!hybrid) return { success: false, message: `${target.name} and ${offering.name} do not fuse.` };
      if (player.spellsKnown.includes(hybrid.id)) return { success: false, message: `You already know ${hybrid.name}.` };
      values.spell = target.name;
      values.hybrid = hybrid.name;
      apply = () => {
        replaceSpell(player, target.id, hybrid.id);
        return undefined;
      };
      break;
    }
    case 'absolve': {
      apply = () => {
        player.clearVoidDebt();
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
  burnOffering(player, offering);
  const override = apply();
  engine.setWorldFlag(spentFlag(engine, x, y), true);
  const message = override ?? formatMagicMessage(altar.performedMessage, values);
  engine.log(message);
  engine.emitGameEvent({
    type: 'altar_rite_performed',
    turn: engine.turnCount,
    actorId: player.id,
    data: { altarId: altar.id, rite: altar.rite, offeringId: offering.id },
  });
  return { success: true, message };
}

/** Puts `newId` wherever `oldId` was (its grimoire slot and quick keys) and forgets `oldId`. */
function replaceSpell(player: Player, oldId: string, newId: string): void {
  const slot = player.grimoireState ? slotOfSpell(player.grimoireState, oldId) : undefined;
  const quick = player.quickSpells.map((id, i) => (id === oldId ? i : -1)).filter((i) => i >= 0);
  player.forgetSpell(oldId);
  player.spellsKnown.push(newId);
  if (slot) player.placeGrimoireSpell(newId, slot);
  for (const i of quick) player.quickSpells[i] = newId;
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
  public readonly offeringKind: AltarOfferingKind;
  public readonly offeringId: string;
  public readonly slot?: GrimoireSlotRef;
  public readonly targetSpellId?: string;

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
  }

  public perform(engine: GameEngine): ActionResult {
    const altar = getAltarDefinition(engine, this.altarId);
    if (!altar) return { success: false, cost: 0, message: 'There is no altar here.' };
    const outcome = performAltarRite(engine, this.player, altar, this.x, this.y, {
      offeringKind: this.offeringKind,
      offeringId: this.offeringId,
      slot: this.slot,
      targetSpellId: this.targetSpellId,
    });
    if (!outcome.success) return { success: false, cost: 0, message: outcome.message };
    const cost = this.player.getActionCost(100);
    this.player.consumeEnergy(cost);
    return { success: true, cost, message: outcome.message };
  }
}
