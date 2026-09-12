import type { LevelUpBonus } from './types/config';
import type { Player } from './entities/player';

export interface PlayerLeveledUpEvent {
  type: 'player_leveled_up';
  player: Player;
  level: number;
  newLevel: number;
  statPointsAwarded: number;
  unspentStatPoints: number;
  statGains?: LevelUpBonus;
}

export type GameEvent = PlayerLeveledUpEvent;
