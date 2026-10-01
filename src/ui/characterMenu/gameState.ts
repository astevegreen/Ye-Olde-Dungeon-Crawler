import type { GameContentManifest, GameEngine, GameMap, PactManager, Player, WorldState } from '../../engine';

/** What the character menu hands each tab when it becomes active. */
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
