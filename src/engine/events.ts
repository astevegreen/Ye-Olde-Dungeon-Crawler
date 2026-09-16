import type { LevelUpBonus } from './types/config';

/**
 * Domain events (ARCHITECTURE.md §4).
 *
 * Events are state transitions, not UI instructions. Two rules keep them usable by
 * presentation, audio, analytics, and save/replay tooling alike:
 *
 * 1. **Scalar payloads.** Events carry IDs and numbers, never live `Player`, `Entity`, or
 *    `Item` references. A live reference pins a mutable object, so a consumer reading an
 *    event later sees whatever that object became — and it cannot be serialized.
 * 2. **Open envelope.** `type` is a plain string. Content packs emit their own event types
 *    without editing this file; `BuiltInGameEventType` lists only the engine's own.
 */
export type EventScalar = string | number | boolean | null;

/** Every event carries these; specific types add their own scalar fields. */
export interface GameEventBase {
  /** Event name. Built-ins are listed in `BuiltInGameEventType`; content may use its own. */
  type: string;
  /** Turn the event was emitted on, for ordering and replay. */
  turn: number;
  /** Entity that caused the transition, by ID. */
  actorId?: string;
  /** Entity the transition happened to, by ID. */
  targetId?: string;
  /** Item involved, by ID. */
  itemId?: string;
  /** Additional scalar detail. Keep it flat and JSON-safe. */
  data?: Record<string, EventScalar | undefined>;
}

export type BuiltInGameEventType =
  | 'player_leveled_up'
  | 'alignment_renown'
  | 'chaotic_proc'
  | 'uncurse'
  | 'damage_dealt'
  | 'entity_killed'
  | 'level_transition';

export interface PlayerLeveledUpEvent extends GameEventBase {
  type: 'player_leveled_up';
  level: number;
  newLevel: number;
  statPointsAwarded: number;
  unspentStatPoints: number;
  statGains?: LevelUpBonus;
}

export interface AlignmentRenownEvent extends GameEventBase {
  type: 'alignment_renown';
  renownCategory: string; // e.g. 'dark_renown', 'holy_renown'
  amount: number;
  totalRenown: number;
  sourceModifierId?: string;
}

export interface ChaoticProcEvent extends GameEventBase {
  type: 'chaotic_proc';
  procType: string;
  description: string;
  damageDealt?: number;
  teleportDestination?: { x: number; y: number };
}

export interface UncurseEvent extends GameEventBase {
  type: 'uncurse';
  removedModifiers: string[];
}

export interface DamageDealtEvent extends GameEventBase {
  type: 'damage_dealt';
  amount: number;
  element?: string;
  killed: boolean;
}

export interface EntityKilledEvent extends GameEventBase {
  type: 'entity_killed';
  xpAwarded?: number;
}

export interface LevelTransitionEvent extends GameEventBase {
  type: 'level_transition';
  fromFloor: number;
  toFloor: number;
}

/**
 * Any event. The union names the built-ins for authoring convenience, and
 * `GameEventBase` keeps it open so content packs can emit their own types.
 */
export type GameEvent =
  | PlayerLeveledUpEvent
  | AlignmentRenownEvent
  | ChaoticProcEvent
  | UncurseEvent
  | DamageDealtEvent
  | EntityKilledEvent
  | LevelTransitionEvent
  | GameEventBase;

/**
 * Narrows an event to a built-in type.
 *
 * The envelope is open (`type` is a plain string so content can add its own), which stops
 * TypeScript from discriminating the union on a literal. This restores that:
 *
 * ```ts
 * if (isGameEvent(event, 'player_leveled_up')) { event.newLevel; }
 * ```
 */
export function isGameEvent<T extends BuiltInGameEventType>(
  event: GameEvent,
  type: T
): event is Extract<GameEvent, { type: T }> {
  return event.type === type;
}
