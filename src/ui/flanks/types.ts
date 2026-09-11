import type { GameEngine } from '../../engine/engine';
import type { WorldState } from '../../engine/state/worldState';
import type { Player } from '../../engine/entities/player';
import type { GameMap } from '../../engine/grid/map';
import type { GameContentManifest } from '../../engine/types/manifest';
import type { PactManager } from '../../engine/pacts/pactManager';

export interface GameState {
  engine: GameEngine;
  worldState: WorldState;
  player: Player;
  map: GameMap;
  currentFloor: number;
  turnCount: number;
  manifest?: GameContentManifest;
  pacts?: PactManager;
}

export interface FlankModule {
  id: string;
  title: string;
  mount(container: HTMLElement): void;
  render(state: GameState): void;
  destroy?(): void;
}

export type DiscoveryEventType =
  | 'floor_transition'
  | 'secret_door'
  | 'trap_disarmed'
  | 'boss_slain'
  | 'close_call'
  | 'pact_sealed'
  | 'quest_milestone'
  | 'general';

export interface DiscoveryEvent {
  id?: string;
  type: DiscoveryEventType;
  text: string;
  floor: number;
  turn: number;
  timestamp: number;
  icon?: string;
}
