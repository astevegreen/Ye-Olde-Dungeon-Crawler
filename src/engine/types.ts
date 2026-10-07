export interface Position {
  x: number;
  y: number;
}

export type CanonicalTileType =
  | 'floor'
  | 'wall'
  | 'door_closed'
  | 'door_open'
  | 'stairs_up'
  | 'stairs_down'
  | 'trap'
  | 'secret_door'
  | 'shallow_water'
  | 'chasm'
  | 'iron_bars'
  | 'pillar';

export type TileType = CanonicalTileType | (string & {});

export interface TileDefinition {
  type: TileType;
  name: string;
  passable: boolean;
  walkable?: boolean;
  transparent: boolean;
  blocksProjectiles?: boolean;
  glyph: string;
  description?: string;
  interactionHandlerId?: string;
  isDoor?: boolean;
  isOpenDoor?: boolean;
  isClosedDoor?: boolean;
  isSecret?: boolean;
  isStairs?: boolean;
  isStairsUp?: boolean;
  isStairsDown?: boolean;
  hidden?: boolean;
  locked?: boolean;
  lockDifficulty?: number;
  trapId?: string;
  visual?: string;
  landmarkLabel?: string;
  /** Holy ground: burns the bearer of a modifier with `sacredGroundBurn` (an altar of a god). */
  sacred?: boolean;
}

export type EntityType = 'player' | 'monster' | 'npc';
export type Faction = 'player' | 'hostile' | 'neutral';

export interface CombatStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
}

export * from './types/effects';
import type { VisualEffectDescriptor } from './types/effects';
import type { GameEvent } from './events';

export interface ActionResult {
  success: boolean;
  cost: number;
  message?: string;
  effects?: VisualEffectDescriptor[];
  /** Domain events emitted while this action ran, in order (§4). */
  events?: GameEvent[];
  pipelineError?: boolean;
}

export const BASE_ACTION_COST = 100;

export type GameDifficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_MAX_FLOORS: Record<GameDifficulty, number> = {
  easy: 25,
  medium: 37,
  hard: 50,
};

export const DEFAULT_DIFFICULTY: GameDifficulty = 'medium';
