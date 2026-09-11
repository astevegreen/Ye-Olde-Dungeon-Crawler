export interface Position {
  x: number;
  y: number;
}

export type DirectionName =
  | 'North'
  | 'NorthEast'
  | 'East'
  | 'SouthEast'
  | 'South'
  | 'SouthWest'
  | 'West'
  | 'NorthWest';

export interface Direction {
  name: DirectionName;
  dx: number;
  dy: number;
}

export const DIRECTIONS: Record<DirectionName, Direction> = {
  North: { name: 'North', dx: 0, dy: -1 },
  NorthEast: { name: 'NorthEast', dx: 1, dy: -1 },
  East: { name: 'East', dx: 1, dy: 0 },
  SouthEast: { name: 'SouthEast', dx: 1, dy: 1 },
  South: { name: 'South', dx: 0, dy: 1 },
  SouthWest: { name: 'SouthWest', dx: -1, dy: 1 },
  West: { name: 'West', dx: -1, dy: 0 },
  NorthWest: { name: 'NorthWest', dx: -1, dy: -1 },
};

export type CanonicalTileType =
  | 'floor'
  | 'wall'
  | 'door_closed'
  | 'door_open'
  | 'stairs_up'
  | 'stairs_down'
  | 'trap'
  | 'secret_door'
  | 'runic_conduit'
  | 'conduit_node'
  | 'valkyrie_sprint'
  | 'dwarven_winch'
  | 'gateway_valhalla'
  | 'town_portal'
  | 'shallow_water'
  | 'chasm'
  | 'iron_bars'
  | 'pillar'
  | 'altar_tyr';

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

export interface ActionResult {
  success: boolean;
  cost: number;
  message?: string;
  effects?: VisualEffectDescriptor[];
}

export const BASE_ACTION_COST = 100;

export type GameDifficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_MAX_FLOORS: Record<GameDifficulty, number> = {
  easy: 25,
  medium: 37,
  hard: 50,
};

export const DEFAULT_DIFFICULTY: GameDifficulty = 'medium';
