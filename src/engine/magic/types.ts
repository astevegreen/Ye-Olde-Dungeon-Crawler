import type { ElementType } from './elements';

export type SpellSchool =
  | 'Combat'
  | 'Enchantment'
  | 'HealingDivination'
  | 'Movement'
  | 'Divination'
  | string;

export type TargetType =
  | 'self'
  | 'ray'
  | 'tile'
  | 'inventory_item';

export type TargetingMode =
  | 'self'
  | 'ray'
  | 'bounce_ray'
  | 'target_entity'
  | 'cone'
  | 'area_burst'
  | 'tile'
  | 'inventory_item';

export interface DamageEffect {
  type: 'damage';
  amount: string | number;
  element: ElementType | string;
}

export interface StatusEffectPrimitive {
  type: 'applyStatus';
  statusId: StatusType | string;
  duration: number;
  potency?: number;
}

export interface ChainEffect {
  type: 'chain';
  maxHops: number;
  hopRange: number;
  damageDecay: number; // e.g. 0.25 means 25% reduction per hop
}

export interface TeleportEffect {
  type: 'teleport';
  range: number;
  random: boolean;
}

export interface HealEffect {
  type: 'heal';
  amount: string | number;
  target?: 'caster' | 'target';
}

export interface RevealEffect {
  type: 'reveal';
  target: 'actors' | 'items' | 'map' | 'monsters' | 'objects';
  duration?: number;
}

export interface IdentifyEffect {
  type: 'identify';
}

/**
 * Spawn a monster adjacent to the caster.
 * `monsterId` must match a `MonsterDefinition.id` in the manifest.
 * `range`    — max spawn radius from caster (default 2).
 * `duration` — turns until the summoned entity despawns (0 = permanent).
 * `friendly` — if true the summoned entity's faction is set to 'player'.
 */
export interface SummonEffect {
  type: 'summon';
  monsterId: string;
  range?: number;
  duration?: number;
  friendly?: boolean;
}

export type EffectPrimitive =
  | DamageEffect
  | StatusEffectPrimitive
  | ChainEffect
  | TeleportEffect
  | HealEffect
  | RevealEffect
  | IdentifyEffect
  | SummonEffect
  | { type: string; [key: string]: any };

import type { StatusType } from '../status/types';
import type { SpellVisualConfig } from '../types/effects';
export type { SpellVisualConfig };

export interface SpellDefinition {
  id: string;
  name: string;
  school: SpellSchool;
  manaCost: number;
  /** Volatile energy spent per cast (player `EnergyModel`); a shortfall may burn max HP. */
  volatileEnergyCost?: number;
  /** Permanent max HP burned per cast. */
  vitalityCost?: number;
  /** Corruption added per cast. Defaults to the volatile/vitality cost paid. */
  corruptionGain?: number;
  /** Volatile energy restored per cast (or per kill, with `requiresKillForEnergy`). */
  volatileEnergyGain?: number;
  /** Execute gate: the target must be at or below this fraction of max HP. */
  maxTargetHpPercent?: number;
  /** `volatileEnergyGain` is granted only if the cast kills the target. */
  requiresKillForEnergy?: boolean;
  element: ElementType;
  range: number;
  basePower: number;
  areaOfEffect: number; // 0 = single cell, 1 = 3x3 blast
  reflects: boolean; // True for lightning bolt bouncing off walls
  targetType: TargetType;
  description: string;
  targetingMode?: TargetingMode;
  effects?: EffectPrimitive[];
  visual?: SpellVisualConfig;
  statusAffliction?: {
    type: StatusType;
    duration: number;
    potency?: number;
  };
}

export interface ProjectileStep {
  x: number;
  y: number;
  isReflection?: boolean;
}

export interface ProjectilePathResult {
  path: ProjectileStep[];
  impactTile: { x: number; y: number };
  hitWall: boolean;
  hitEntityId?: string;
  reflectionsCount: number;
}
