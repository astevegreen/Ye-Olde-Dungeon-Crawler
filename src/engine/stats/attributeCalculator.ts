import type { Entity } from '../entities/entity';
import type { TileType } from '../types';
import type { ElementType } from '../magic/elements';

const DEFAULT_FALLBACK_ATTRIBUTE = 10;
const DEFAULT_SPEED = 100;
const DEFAULT_BASE_ACTION_COST = 100;
const STATUS_SLOW_ACTION_COST_MULTIPLIER = 1.5;
const STATUS_HASTE_ACTION_COST_MULTIPLIER = 0.75;
const MIN_ACTION_COST = 10;
const MIN_ELEMENTAL_RESISTANCE = -1.0;
const MAX_ELEMENTAL_RESISTANCE = 1.0;

export interface AttributeContext {
  baseCost?: number;
  element?: ElementType;
  terrainType?: TileType;
  engine?: any;
  target?: Entity;
  [key: string]: any;
}

export interface AttributeModifier {
  readonly id: string;
  readonly attributeKey: string;
  readonly phase: 'flat' | 'multiplier' | 'cap';
  readonly priority?: number; // Lower runs first
  apply(currentValue: number, actor: Entity, context?: AttributeContext): number;
}

const customModifiers: AttributeModifier[] = [];

export class AttributeCalculator {
  public static registerModifier(modifier: AttributeModifier): void {
    customModifiers.push(modifier);
    customModifiers.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  public static unregisterModifier(id: string): boolean {
    const idx = customModifiers.findIndex((m) => m.id === id);
    if (idx >= 0) {
      customModifiers.splice(idx, 1);
      return true;
    }
    return false;
  }

  public static clearModifiers(): void {
    customModifiers.length = 0;
  }

  public static getModifiers(): readonly AttributeModifier[] {
    return customModifiers;
  }
}

/**
 * Deterministic 4-phase attribute evaluation pipeline.
 *
 * Phase 1 (Base): Inherent entity base values.
 * Phase 2 (Flat Additions): Equipment bonuses, flat runes, flat pact modifiers, terrain modifiers.
 * Phase 3 (Multipliers): Status effects, encumbrance penalties, pact percentage modifiers.
 * Phase 4 (Caps): Absolute clamping (min energy cost >= 10, min attack >= 1, min defense >= 0).
 */
export function calculateAttribute(
  actor: Entity,
  attributeKey: string,
  context?: AttributeContext
): number {
  // ─────────────────────────────────────────────────────────────
  // PHASE 1: Base Value
  // ─────────────────────────────────────────────────────────────
  let value: number = 0;
  switch (attributeKey) {
    case 'maxHp':
      value = actor.baseMaxHpValue;
      break;
    case 'attack':
      value = actor.baseAttackValue;
      break;
    case 'defense':
      value = actor.baseDefenseValue;
      break;
    case 'speed':
      value = actor.speed ?? DEFAULT_SPEED;
      break;
    case 'strength':
      value = actor.strength ?? DEFAULT_FALLBACK_ATTRIBUTE;
      break;
    case 'intelligence':
      value = actor.intelligence ?? DEFAULT_FALLBACK_ATTRIBUTE;
      break;
    case 'constitution':
      value = actor.constitution ?? DEFAULT_FALLBACK_ATTRIBUTE;
      break;
    case 'dexterity':
      value = actor.dexterity ?? DEFAULT_FALLBACK_ATTRIBUTE;
      break;
    case 'actionCost':
      value = context?.baseCost ?? DEFAULT_BASE_ACTION_COST;
      break;
    case 'elementalResistance':
      value = 0;
      break;
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: Flat Additions
  // ─────────────────────────────────────────────────────────────
  if (attributeKey === 'attack') {
    value += actor.inventory?.getEquipmentStats().attackBonus ?? 0;
    value += actor.pactMutatorsSupplier?.().playerAttackBonus ?? 0;
  } else if (attributeKey === 'defense') {
    value += actor.inventory?.getEquipmentStats().defenseBonus ?? 0;
    value += actor.pactMutatorsSupplier?.().playerDefenseBonus ?? 0;
  }

  // Execute custom flat modifiers
  for (const mod of customModifiers) {
    if (mod.phase === 'flat' && (mod.attributeKey === '*' || mod.attributeKey === attributeKey)) {
      value = mod.apply(value, actor, context);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: Multipliers
  // ─────────────────────────────────────────────────────────────
  if (attributeKey === 'maxHp') {
    const pact = actor.pactMutatorsSupplier?.().playerMaxHpPercent ?? 0;
    // A blessing's lasting share (`Player.maxHpPercentBonus`); other actors have none.
    const blessing = (actor as { maxHpPercentBonus?: number }).maxHpPercentBonus ?? 0;
    // What a hero wears and holds (Juggernaut, `Player.wornMaxHpPercent`).
    const worn = (actor as { wornMaxHpPercent?: number }).wornMaxHpPercent ?? 0;
    value = value * (1 + pact + blessing + worn);
  } else if (attributeKey === 'actionCost') {
    // Encumbrance cost adjustment first if available on inventory
    if (actor.inventory) {
      // A hero's carrying Strength may be scaled by what it wears (`Player.carryStrength`).
      value = actor.inventory.calculateActionCost(value, (actor as { carryStrength?: number }).carryStrength ?? actor.strength);
    }
    // Status effects
    if (actor.statusManager?.hasStatus('slow')) {
      value = Math.floor(value * STATUS_SLOW_ACTION_COST_MULTIPLIER);
    }
    if (actor.statusManager?.hasStatus('haste')) {
      value = Math.floor(value * STATUS_HASTE_ACTION_COST_MULTIPLIER);
    }
  }

  // Execute custom multiplier modifiers
  for (const mod of customModifiers) {
    if (mod.phase === 'multiplier' && (mod.attributeKey === '*' || mod.attributeKey === attributeKey)) {
      value = mod.apply(value, actor, context);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: Caps & Clamping
  // ─────────────────────────────────────────────────────────────
  switch (attributeKey) {
    case 'maxHp':
      value = Math.max(1, Math.round(value));
      break;
    case 'attack':
      value = Math.max(1, Math.round(value));
      break;
    case 'defense':
      value = Math.max(0, Math.round(value));
      break;
    case 'speed':
      value = Math.max(1, Math.round(value));
      break;
    case 'strength':
    case 'intelligence':
    case 'constitution':
    case 'dexterity':
      value = Math.max(1, Math.round(value));
      break;
    case 'actionCost':
      value = Math.max(MIN_ACTION_COST, Math.round(value));
      break;
    case 'elementalResistance':
      value = Math.max(MIN_ELEMENTAL_RESISTANCE, Math.min(MAX_ELEMENTAL_RESISTANCE, value));
      break;
  }

  // Execute custom cap modifiers
  for (const mod of customModifiers) {
    if (mod.phase === 'cap' && (mod.attributeKey === '*' || mod.attributeKey === attributeKey)) {
      value = mod.apply(value, actor, context);
    }
  }

  return value;
}
