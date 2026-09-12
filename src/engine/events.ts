import type { LevelUpBonus } from './types/config';
import type { Player } from './entities/player';
import type { Entity } from './entities/entity';
import type { Item } from './items/item';

export interface PlayerLeveledUpEvent {
  type: 'player_leveled_up';
  player: Player;
  level: number;
  newLevel: number;
  statPointsAwarded: number;
  unspentStatPoints: number;
  statGains?: LevelUpBonus;
}

export interface AlignmentRenownEvent {
  type: 'alignment_renown';
  actor: Entity;
  renownCategory: string; // e.g. 'dark_renown', 'holy_renown'
  amount: number;
  totalRenown: number;
  sourceModifierId?: string;
  target?: Entity;
}

export interface ChaoticProcEvent {
  type: 'chaotic_proc';
  actor: Entity;
  target?: Entity;
  procType: string;
  description: string;
  damageDealt?: number;
  teleportDestination?: { x: number; y: number };
}

export interface UncurseEvent {
  type: 'uncurse';
  actor: Entity;
  item: Item;
  removedModifiers: string[];
}

export type GameEvent =
  | PlayerLeveledUpEvent
  | AlignmentRenownEvent
  | ChaoticProcEvent
  | UncurseEvent;
