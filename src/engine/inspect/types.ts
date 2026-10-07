import type { MonsterIntent } from '../entities/monster';
import type { ItemStatModifiers, ElementalAffix } from '../items/item';

export interface InspectedTerrain {
  name: string;
  type: string;
  passable: boolean;
  transparent: boolean;
  description?: string;
  /** The pack's landmark name for this tile (`TileDefinition.landmarkLabel`), if it has one. */
  landmark?: string;
}

/** A named landmark the hero has found on a floor. */
export interface FloorLandmark {
  label: string;
  x: number;
  y: number;
}

export interface InspectedTrap {
  id: string;
  name: string;
  type: string;
  revealed: boolean;
}

export interface InspectedEntity {
  name: string;
  type: 'player' | 'monster' | 'npc';
  hp: number;
  maxHp: number;
  speed: number;
  speedTier: 'Slow' | 'Normal' | 'Fast';
  statusEffects: string[];
  intent?: MonsterIntent;
}

export interface InspectedItem {
  id: string;
  name: string;
  category: string;
  weight: number; // in grams
  bulk: number; // in cm³
  count?: number;
  stats?: ItemStatModifiers;
  enchantmentLevel?: number;
  elementalAffix?: ElementalAffix;
  /** Sensed by Detect Objects out of sight: something is there, nothing more is known. */
  sensed?: boolean;
}

export interface TileInspection {
  x: number;
  y: number;
  visibility: 'visible' | 'explored' | 'unexplored';
  terrain: InspectedTerrain | null;
  traps: InspectedTrap[];
  entity: InspectedEntity | null;
  items: InspectedItem[];
}
