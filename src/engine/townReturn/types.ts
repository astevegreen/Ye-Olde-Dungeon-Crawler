import type { Position } from '../types';
import type { SerializedItemNode } from '../storage/types';

export type TownReturnType = 'runic_conduit' | 'valkyrie_sprint' | 'dwarven_winch';

export interface RunicConduitState {
  conduitPos: Position;
  ritualActive: boolean;
  turnsRemaining: number;
  charges: number;
  activeNode: Position | null;
  cooldownRemaining: number;
}

export interface ValkyrieSprintState {
  active: boolean;
  stage: 1 | 2 | 3;
  stageTurnsRemaining: number;
  originFloor: number;
  originPosition: Position;
  telegraphedDangerTiles: Position[];
  doorHp?: number;
}

export interface DwarvenWinchBalanceResult {
  playerWeight: number;
  targetWeight: number;
  tolerance: number;
  hopperWeight: number;
  status: 'underweight' | 'balanced' | 'overweight';
  delta: number;
}

export interface TownPortalState {
  active: boolean;
  destinationFloor: number;
  destinationPosition: Position;
  townPosition: Position;
}

export interface SerializedTownReturnData {
  conduitStates?: Record<number, {
    conduitPos: Position;
    cooldownRemaining: number;
  }>;
  winchHoppers?: Record<number, SerializedItemNode[]>;
  valkyrieState?: {
    active: boolean;
    stage: 1 | 2 | 3;
    stageTurnsRemaining: number;
    originFloor: number;
    originPosition: Position;
    doorHp?: number;
  };
  townPortal?: TownPortalState;
}
