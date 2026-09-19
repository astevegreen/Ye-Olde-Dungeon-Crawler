import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { ActionResult } from '../types';
import type { Action } from '../actions/action';
import { WaitAction } from '../actions/wait';
import { MovementAction } from '../actions/movement';
import type { ActionHook, ActionHookContext } from '../actions/actionPipeline';
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
 * Modeled as a status effect on the player (dormant-actor / status-tick semantics —
 * `player-status-tick` ticks it every player turn like poison or slow), but the
 * interrupt/continuation *decision* itself lives in `createRuneOfReturnActionHooks`'s
 * `ActionPipeline` hooks, not in the tick handler: a `pre` hook fires before every
 * action in the game (player or monster) to decide whether that action sustains the
 * channel (Wait, the channel action itself, or movement once Unbound Casting is maxed)
 * or breaks it, and a `post` hook fires after every action to catch HP loss the instant
 * it happens — including a monster's own attack action, so a counter-attack this cycle
 * no longer has to wait for next turn's tick to be noticed (the previous tick-only
 * design had up to one player turn of interrupt lag; this closes that gap). The tick
 * handler's job is now just bookkeeping (the progress log and completion), not
 * deciding whether the channel survives.
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

export const RUNE_TOTAL_POINTS_CAP = 7;

export function getTotalRuneMasteryPoints(mastery: RuneOfReturnMastery): number {
  return (mastery?.celerityPoints ?? 0) + (mastery?.weavePoints ?? 0) + (mastery?.mobilityPoints ?? 0);
}

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
  protected _charges: number;
  protected _maxCharges: number;

  constructor(config: RuneOfReturnConfig) {
    super({
      ...config,
      category: 'misc',
      weight: config.weight ?? 40,
      bulk: config.bulk ?? 20,
    });
    this._maxCharges = RUNE_MAX_CHARGES;
    this._charges = Math.max(0, Math.min(config.charges ?? RUNE_MAX_CHARGES, this._maxCharges));
  }

  public get charges(): number {
    return this._charges;
  }

  public set charges(val: number) {
    this._charges = Math.max(0, Math.min(val, this.maxCharges));
  }

  public get maxCharges(): number {
    return this._maxCharges;
  }

  public override get displayName(): string {
    const base = this.identified ? this.name : this.unidentifiedName;
    return `${base} (${this.charges}/${this.maxCharges} charges)`;
  }
}

/**
 * Innate virtual Rune of Return bound directly to the player's spirit.
 * Delegates charges and maxCharges directly to `Player.runeCharges` and `Player.runeMaxCharges`.
 */
export class InnateRuneOfReturnItem extends RuneOfReturnItem {
  private playerRef: Player;

  constructor(player: Player) {
    super({
      id: 'innate_rune_of_return',
      name: 'Rune of Return',
      unidentifiedName: 'Rune of Return',
      description: 'Bound to your spirit. Channels a dimensional recall back to town or your departure anchor.',
      charges: player.runeCharges,
    });
    this.playerRef = player;
  }

  public override get charges(): number {
    return this.playerRef.runeCharges;
  }

  public override set charges(val: number) {
    this.playerRef.runeCharges = Math.max(0, Math.min(val, this.maxCharges));
  }

  public override get maxCharges(): number {
    return this.playerRef.runeMaxCharges ?? RUNE_MAX_CHARGES;
  }
}

/** Finds the player's carried Rune of Return, or returns the innate spiritual rune if discovered. */
export function findRuneOfReturn(player: Player): RuneOfReturnItem | undefined {
  const carried = player.inventory
    ?.getAllCarriedItems?.()
    .find((item): item is RuneOfReturnItem => item instanceof RuneOfReturnItem);
  if (carried) return carried;
  if (player.hasDiscoveredRune) {
    return new InnateRuneOfReturnItem(player);
  }
  return undefined;
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
    // The pre-hook already recognized this as a sustaining action before `perform()`
    // ran; nothing left to record here.
    return { success: true, message: 'You continue channeling the Rune of Return...' };
  }

  if (item.charges <= 0) {
    return { success: false, message: 'The Rune of Return has no charges remaining.' };
  }

  // If channeling in town (Floor 0), verify an active dungeon return anchor exists
  if (engine.currentFloor === 0) {
    if (!player.deepestRecallFloor || player.deepestRecallFloor <= 0) {
      return { success: false, message: 'You have no active dungeon return anchor.' };
    }
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
      data: { startedThisTick: true, lastHp: player.hp, channelTime },
    },
    [],
    player,
    engine
  );

  const destinationDesc = engine.currentFloor === 0
    ? `returning to Floor ${player.deepestRecallFloor}`
    : 'recalling to town';

  engine.log(
    banked > 0
      ? `You resume channeling the Rune of Return (${destinationDesc}), drawing on banked power (${duration} turns remaining)...`
      : `You begin channeling the Rune of Return (${destinationDesc}) (${duration} turns)...`
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
export function interruptChannel(engine: GameEngine, player: Player, message: string): void {
  const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS);
  if (effect) {
    const channelTime = (effect.data?.channelTime as number | undefined) ?? effect.potency ?? 0;
    player.runeChannelBankedTurns = computeBankedTurns(channelTime, effect.duration, player.runeMastery.weavePoints);
    player.statusManager.removeStatus(RUNE_OF_RETURN_STATUS);
  }
  engine.log(message);
}

/** Refill hook: full, free, instant, regardless of pack (only the trigger and its
 * flavor text are pack-provided — see `GameContentManifest.runeOfReturn`). Accepts
 * either a physical RuneOfReturnItem or the Player directly. */
export function attuneRuneOfReturn(target: Player | RuneOfReturnItem): string {
  if ('runeCharges' in target) {
    target.runeCharges = target.runeMaxCharges ?? RUNE_MAX_CHARGES;
    return `The Rune of Return hums with restored power! (${target.runeCharges}/${target.runeMaxCharges} charges)`;
  }
  target.charges = target.maxCharges;
  return `The Rune of Return hums with restored power! (${target.charges}/${target.maxCharges} charges)`;
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
  const totalPoints = getTotalRuneMasteryPoints(player.runeMastery);
  if (totalPoints + amount > RUNE_TOTAL_POINTS_CAP) {
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
  player.runeCharges = item.charges;

  if (engine.currentFloor === 0) {
    const targetFloor = player.deepestRecallFloor;
    const targetPos = player.recallPosition;
    player.deepestRecallFloor = undefined;
    player.recallPosition = undefined;

    if (!targetFloor || targetFloor <= 0) {
      return 'The rune flares, but your anchor has dissolved into nothingness.';
    }

    engine.log(`*** The Rune of Return blazes with portal energy, opening a path back to Floor ${targetFloor}! ***`);
    engine.changeFloor(targetFloor, targetPos);
  } else {
    player.deepestRecallFloor = engine.currentFloor;
    player.recallPosition = { x: player.x, y: player.y };

    engine.log(`*** The Rune of Return flares white-hot and unravels the air around you! (Return anchor set to Floor ${engine.currentFloor}) ***`);
    engine.changeFloor(0);
  }
  return undefined;
}

/**
 * The status handler driving per-turn bookkeeping (dormant-actor/status-tick
 * semantics — this runs every player turn via `player-status-tick`, exactly like
 * poison or slow). Interrupt/continuation is decided earlier, by the ActionPipeline
 * hooks below — a still-active effect by the time this fires means the current turn's
 * action already sustained it, so there is nothing left to decide here.
 */
const runeOfReturnStatusHandler: StatusHandler = {
  onTick(_entity: Entity, effect: StatusEffect, engine: GameEngine): StatusTickOutput {
    // Log progress on continuations after the first turn.
    if (!effect.data?.startedThisTick && effect.duration > 1) {
      engine.log(`You continue channeling... (${effect.duration - 1} turns remaining)`);
    }
    effect.data = { ...effect.data, startedThisTick: false };
    return { damageTaken: 0, killed: false };
  },

  onExpire(entity: Entity, engine: GameEngine): string | undefined {
    return completeChannel(entity as Player, engine);
  },
};

/**
 * ActionPipeline hooks that own the channel's interrupt/continuation decision (see
 * module doc). Registered unconditionally in `GameEngine`'s constructor alongside the
 * built-in status handlers — `runeOfReturn.ts` is already an engine-owned mechanic
 * (ARCHITECTURE.md §9, P-03), not campaign content, so this follows that precedent
 * rather than routing through `manifest.actionHooks`. Touches the protected
 * `engine.ts` under §8.1 exception 1 (confirmed bug fix): the previous tick-only
 * implementation could take up to one player turn to notice a monster's counter-attack
 * (see the module doc), which this hook pair fixes by observing every action, player's
 * or monster's, as it happens.
 */
export function createRuneOfReturnActionHooks(): ActionHook[] {
  return [
    {
      id: 'rune_of_return_action_guard',
      phase: 'pre',
      priority: 50,
      execute(ctx: ActionHookContext) {
        const player = ctx.engine.player as Player | undefined;
        if (!player || ctx.actor !== player) return;
        if (!player.statusManager?.hasStatus(RUNE_OF_RETURN_STATUS)) return;

        const action = ctx.action;
        const actionType = ctx.actionType;

        // 1. WaitAction or ChannelRuneOfReturnAction: sustains the channel.
        if (
          action instanceof WaitAction ||
          actionType === 'WaitAction' ||
          action instanceof ChannelRuneOfReturnAction ||
          actionType === 'ChannelRuneOfReturnAction'
        ) {
          return;
        }

        // 2. MovementAction
        if (action instanceof MovementAction || actionType === 'MovementAction') {
          const move = action as MovementAction;
          const targetX = player.x + (move.dx ?? 0);
          const targetY = player.y + (move.dy ?? 0);
          const targetEntity = (ctx.engine as any).map?.getEntityAt?.(targetX, targetY, player.planeId);

          if (targetEntity && player.isHostileTo(targetEntity)) {
            // Bump attack breaks concentration
            interruptChannel(ctx.engine as GameEngine, player, 'You break concentration to attack — the channel fizzles.');
            return;
          }

          if (player.runeMastery.mobilityPoints >= RUNE_TRACK_MAX.mobility) {
            // Unbound Casting: movement sustains the channel.
            return;
          }
          interruptChannel(ctx.engine as GameEngine, player, 'You move, breaking your concentration — the channel fizzles.');
          return;
        }

        // 3. Any other player action breaks concentration voluntarily
        interruptChannel(ctx.engine as GameEngine, player, 'Your concentration breaks and the channel fizzles.');
      },
    },
    {
      id: 'rune_of_return_damage_interrupter',
      phase: 'post',
      priority: 50,
      execute(ctx: ActionHookContext) {
        const player = ctx.engine.player as Player | undefined;
        if (!player) return;
        if (!player.statusManager?.hasStatus(RUNE_OF_RETURN_STATUS)) return;

        const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS);
        if (!effect) return;

        const lastHp = typeof effect.data?.lastHp === 'number' ? effect.data.lastHp : player.hp;
        if (player.hp < lastHp) {
          interruptChannel(
            ctx.engine as GameEngine,
            player,
            'Pain sears through you and your grip on the rune slips — the channel fizzles!'
          );
        } else {
          effect.data = { ...effect.data, lastHp: player.hp };
        }
      },
    },
  ];
}

export function registerRuneOfReturnStatusHandler(): void {
  StatusHandlerRegistry.register(RUNE_OF_RETURN_STATUS, runeOfReturnStatusHandler);
}

/** The explicit "keep channeling" action a player takes each turn to sustain the
 * channel (or start one). `WaitAction` also sustains it — standing still to
 * concentrate reads naturally as compatible with channeling — and movement sustains
 * it too once Unbound Casting (mobility mastery) is maxed. Every other action
 * interrupts it. See `createRuneOfReturnActionHooks` for the actual decision logic. */
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
StatusHandlerRegistry.setDefaultRegistrar(registerRuneOfReturnStatusHandler);
