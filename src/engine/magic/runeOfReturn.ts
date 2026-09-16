import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { ActionResult } from '../types';
import type { Action } from '../actions/action';
import { BASE_ACTION_COST } from '../types';
import { Item, type ItemConfig } from '../items/item';
import type { StatusHandler, StatusTickOutput } from '../status/statusHandlers';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import type { StatusEffect } from '../status/types';

/**
 * Rune of Return (ARCHITECTURE.md P-03 stage 3, §9).
 *
 * A limited-charge item that channels a multi-turn teleport-to-town spell. The
 * mechanic is engine-owned and pack-neutral (§9): channel timing, banking, mobility,
 * and interrupt rules are fixed; only the item's name/art, the town refill trigger,
 * and each track's display name are content-provided (`GameContentManifest.runeOfReturn`).
 *
 * Modeled as a status effect on the player, consistent with the existing dormant-actor
 * / status-tick scheduling semantics (P-06's `player-status-tick` environmental update
 * already ticks every status every player turn, awake or not). One known tradeoff from
 * that choice, documented rather than silently accepted: `player-status-tick` runs
 * *before* monster turns within a single `executePlayerTurn` cycle (see engine.ts), so
 * damage from a monster's counter-attack this cycle is only observed on the *next*
 * tick — i.e. interruption can lag by up to one player turn rather than firing the
 * instant the blow lands. Zero-net (fully mitigated) hits never interrupt regardless,
 * since they never move `entity.hp`.
 */

export const RUNE_OF_RETURN_STATUS = 'rune_of_return_channel';

export const RUNE_MAX_CHARGES = 3;

export type RuneOfReturnTrack = 'celerity' | 'weave' | 'mobility';

export interface RuneOfReturnMastery {
  /** Track 1 — Channel Celerity (speed). 0-3. */
  celerityPoints: number;
  /** Track 2 — Steadfast Weave (banking). 0-3. */
  weavePoints: number;
  /** Track 3 — Unbound Casting (mobility). 0-1. */
  mobilityPoints: number;
}

export const RUNE_TRACK_MAX: Readonly<Record<RuneOfReturnTrack, number>> = {
  celerity: 3,
  weave: 3,
  mobility: 1,
};

export function defaultRuneMastery(): RuneOfReturnMastery {
  return { celerityPoints: 0, weavePoints: 0, mobilityPoints: 0 };
}

/** depthBonus = floor((currentFloor - 1) / 5). Floor 1-5 => 0, 6-10 => 1, etc. */
export function computeDepthBonus(currentFloor: number): number {
  return Math.floor(Math.max(0, currentFloor - 1) / 5);
}

/** channelTime = max(3, 6 - celerityPoints) + depthBonus. Never scales below the 3-turn floor. */
export function computeChannelTime(celerityPoints: number, currentFloor: number): number {
  const base = Math.max(3, 6 - celerityPoints);
  return base + computeDepthBonus(currentFloor);
}

const BANKING_RETENTION_PCT: Readonly<Record<number, number>> = { 0: 0, 1: 0.35, 2: 0.65, 3: 1 };

/** Fraction of turns-completed-so-far retained on interrupt, by Steadfast Weave points. */
export function getBankingRetentionPct(weavePoints: number): number {
  return BANKING_RETENTION_PCT[weavePoints] ?? 0;
}

/**
 * Turns banked when a channel with `channelTime` total turns and `turnsRemaining`
 * left is interrupted. `turnsCompleted = channelTime - turnsRemaining`.
 */
export function computeBankedTurns(channelTime: number, turnsRemaining: number, weavePoints: number): number {
  const turnsCompleted = Math.max(0, channelTime - turnsRemaining);
  return Math.floor(turnsCompleted * getBankingRetentionPct(weavePoints));
}

export interface RuneOfReturnConfig extends Omit<ItemConfig, 'category' | 'weight' | 'bulk'> {
  charges?: number;
  weight?: number;
  bulk?: number;
}

/** The physical rune item. Charges are the item's own state (like `WandItem`); track
 * mastery is the player's (like an attribute), so a lost/replaced rune doesn't reset
 * invested points. */
export class RuneOfReturnItem extends Item {
  public charges: number;
  public readonly maxCharges: number;

  constructor(config: RuneOfReturnConfig) {
    super({
      ...config,
      category: 'misc',
      weight: config.weight ?? 40,
      bulk: config.bulk ?? 20,
    });
    this.maxCharges = RUNE_MAX_CHARGES;
    this.charges = Math.max(0, Math.min(config.charges ?? RUNE_MAX_CHARGES, this.maxCharges));
  }

  public override get displayName(): string {
    const base = this.identified ? this.name : this.unidentifiedName;
    return `${base} (${this.charges}/${this.maxCharges} charges)`;
  }
}

/** Finds the player's carried Rune of Return, if any. Treated as a singleton item
 * per the design spec; a player carrying more than one uses the first found. */
export function findRuneOfReturn(player: Player): RuneOfReturnItem | undefined {
  return player.inventory
    .getAllCarriedItems()
    .find((item): item is RuneOfReturnItem => item instanceof RuneOfReturnItem);
}

function isChanneling(player: Player): boolean {
  return player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS);
}

/**
 * Starts a new channel, or marks the current turn as a continuation of an
 * already-active one. This is what `ChannelRuneOfReturnAction` calls each turn the
 * player chooses to keep channeling — the explicit, repeated "this turn continues the
 * channel" signal the status handler's `onTick` checks for (see module doc).
 */
export function startOrContinueChannel(
  engine: GameEngine,
  player: Player,
  item: RuneOfReturnItem
): { success: boolean; message: string } {
  if (isChanneling(player)) {
    const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS)!;
    effect.data = { ...effect.data, continuedThisTick: true };
    return { success: true, message: 'You continue channeling the Rune of Return...' };
  }

  if (item.charges <= 0) {
    return { success: false, message: 'The Rune of Return has no charges remaining.' };
  }

  const channelTime = computeChannelTime(player.runeMastery.celerityPoints, engine.currentFloor);
  const banked = Math.min(player.runeChannelBankedTurns, channelTime - 1);
  const duration = Math.max(1, channelTime - banked);

  player.statusManager.applyStatus(
    {
      type: RUNE_OF_RETURN_STATUS,
      duration,
      potency: channelTime,
      sourceEntityId: player.id,
      data: { continuedThisTick: true, lastHp: player.hp, channelTime },
    },
    [],
    player,
    engine
  );

  engine.log(
    banked > 0
      ? `You resume channeling the Rune of Return, drawing on banked power (${duration} turns remaining)...`
      : `You begin channeling the Rune of Return (${duration} turns)...`
  );

  return { success: true, message: 'Channel started.' };
}

/** Voluntary cancellation — identical to an interrupt for banking/reset purposes. */
export function cancelChannel(engine: GameEngine, player: Player): { success: boolean; message: string } {
  if (!isChanneling(player)) {
    return { success: false, message: 'No channel is active.' };
  }
  interruptChannel(engine, player, 'You release the rune\'s power early. The channel fizzles.');
  return { success: true, message: 'Channel cancelled.' };
}

/** Shared fizzle path for both damage/other-action interrupts and voluntary cancellation. */
function interruptChannel(engine: GameEngine, player: Player, message: string): void {
  const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS);
  if (effect) {
    const channelTime = (effect.data?.channelTime as number | undefined) ?? effect.potency ?? 0;
    player.runeChannelBankedTurns = computeBankedTurns(channelTime, effect.duration, player.runeMastery.weavePoints);
    player.statusManager.removeStatus(RUNE_OF_RETURN_STATUS);
  }
  engine.log(message);
}

/** Refill hook: full, free, instant, regardless of pack (only the trigger and its
 * flavor text are pack-provided — see `GameContentManifest.runeOfReturn`). */
export function attuneRuneOfReturn(item: RuneOfReturnItem): string {
  item.charges = item.maxCharges;
  return `The Rune of Return hums with restored power! (${item.charges}/${item.maxCharges} charges)`;
}

/** Spends one of the player's unspent mastery points on a Rune of Return track,
 * mirroring `Player.allocateAttribute`'s pool and validation. */
export function allocateRuneMastery(player: Player, track: RuneOfReturnTrack, amount = 1): boolean {
  if (amount <= 0 || player.unspentStatPoints < amount) {
    return false;
  }
  const key: keyof RuneOfReturnMastery =
    track === 'celerity' ? 'celerityPoints' : track === 'weave' ? 'weavePoints' : 'mobilityPoints';
  const current = player.runeMastery[key];
  const max = RUNE_TRACK_MAX[track];
  if (current + amount > max) {
    return false;
  }
  player.unspentStatPoints -= amount;
  player.runeMastery = { ...player.runeMastery, [key]: current + amount };
  return true;
}

function completeChannel(player: Player, engine: GameEngine): string | undefined {
  const item = findRuneOfReturn(player);
  player.runeChannelBankedTurns = 0;
  if (!item || item.charges <= 0) {
    // Item was lost/emptied mid-channel (e.g. dropped) — treat as a fizzle, not a
    // teleport, since there's no charge to spend on the completion.
    return 'The channel completes, but you have no charge left to spend on it. It fizzles harmlessly.';
  }
  item.charges -= 1;
  engine.log('*** The Rune of Return flares white-hot and unravels the air around you! ***');
  engine.changeFloor(0);
  return undefined;
}

/**
 * The status handler driving per-turn advancement (dormant-actor/status-tick
 * semantics — this runs every player turn via `player-status-tick`, exactly like
 * poison or slow). See the module doc for the one documented timing tradeoff.
 */
const runeOfReturnStatusHandler: StatusHandler = {
  onTick(entity: Entity, effect: StatusEffect, engine: GameEngine): StatusTickOutput {
    const player = entity as Player;
    const data = effect.data ?? {};
    const lastHp = typeof data.lastHp === 'number' ? data.lastHp : player.hp;
    const tookDamage = player.hp < lastHp;

    if (tookDamage) {
      interruptChannel(engine, player, 'Pain sears through you and your grip on the rune slips — the channel fizzles!');
      return { damageTaken: 0, killed: false };
    }

    const continuedThisTick = data.continuedThisTick === true;
    const mobilityMaxed = player.runeMastery.mobilityPoints >= RUNE_TRACK_MAX.mobility;
    if (!continuedThisTick && !mobilityMaxed) {
      interruptChannel(engine, player, 'Your concentration breaks and the channel fizzles.');
      return { damageTaken: 0, killed: false };
    }

    // Continuing: reset the per-turn continuation flag (next turn must prove itself
    // again unless mobility is maxed) and refresh the HP watermark.
    effect.data = { ...effect.data, continuedThisTick: false, lastHp: player.hp };
    return { damageTaken: 0, killed: false };
  },

  onExpire(entity: Entity, engine: GameEngine): string | undefined {
    return completeChannel(entity as Player, engine);
  },
};

export function registerRuneOfReturnStatusHandler(): void {
  StatusHandlerRegistry.register(RUNE_OF_RETURN_STATUS, runeOfReturnStatusHandler);
}

/** The explicit "keep channeling" action a player takes each turn to sustain the
 * channel (or start one). Any *other* turn-consuming action interrupts it instead,
 * per the core channel rules — never special-cased per action type; whatever action
 * the player takes next simply won't be this one, which the status handler sees. */
export class ChannelRuneOfReturnAction implements Action {
  public readonly entity: Player;

  constructor(entity: Player) {
    this.entity = entity;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.entity.isAlive()) {
      return { success: false, cost: 0, message: 'You cannot channel while defeated.' };
    }
    const item = findRuneOfReturn(this.entity);
    if (!item) {
      return { success: false, cost: 0, message: 'You have no Rune of Return.' };
    }
    const outcome = startOrContinueChannel(engine, this.entity, item);
    if (!outcome.success) {
      return { success: false, cost: 0, message: outcome.message };
    }
    const cost = this.entity.getActionCost(BASE_ACTION_COST);
    this.entity.consumeEnergy(cost);
    return { success: true, cost, message: outcome.message };
  }
}

// Self-register on load, matching StatusHandlerRegistry.registerBuiltins()'s own
// module-scope registration in status/statusHandlers.ts.
registerRuneOfReturnStatusHandler();
