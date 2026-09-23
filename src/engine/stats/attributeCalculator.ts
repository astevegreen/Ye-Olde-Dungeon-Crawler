import type { Entity } from '../entities/entity';
import type { TileType } from '../types';
import type { ElementType } from '../magic/elements';

export interface BaseAttributeProvider {
  /**
   * Return a base value for the given key, or undefined to defer to the built-in switch.
   * Called during Phase 1 of attribute calculation.
   */
  getBase(actor: Entity, key: string, context?: AttributeContext): number | undefined;
}

const baseAttributeProviders: BaseAttributeProvider[] = [];

/** Register a custom base attribute provider. */
export function registerBaseAttributeProvider(provider: BaseAttributeProvider): void {
  baseAttributeProviders.push(provider);
}

/** Unregister all custom providers (useful in tests). */
export function clearBaseAttributeProviders(): void {
  baseAttributeProviders.length = 0;
}

const DEFAULT_FALLBACK_ATTRIBUTE = 10;
const DEFAULT_SPEED = 100;
const DEFAULT_BASE_ACTION_COST = 100;
const STATUS_SLOW_ACTION_COST_MULTIPLIER = 1.5;
const STATUS_HASTE_ACTION_COST_MULTIPLIER = 0.75;
const MIN_ACTION_COST = 10;
const MIN_ELEMENTAL_RESISTANCE = -1.0;
const MAX_ELEMENTAL_RESISTANCE = 1.0;

export type AttributeKey =
  | 'maxHp'
  | 'attack'
  | 'defense'
  | 'speed'
  | 'strength'
  | 'intelligence'
  | 'constitution'
  | 'dexterity'
  | 'actionCost'
  | 'elementalResistance';

export interface AttributeContext {
  baseCost?: number;
  element?: ElementType;
  terrainType?: TileType;
  engine?: any;
  target?: Entity;
  [key: string]: any;
}

export type AttributePhase = 'base' | 'flat' | 'multiplier' | 'cap';

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
  let baseValue: number | undefined;
  for (const provider of baseAttributeProviders) {
    baseValue = provider.getBase(actor, attributeKey, context);
    if (baseValue !== undefined) break;
  }

  let value: number = 0;
  if (baseValue !== undefined) {
    value = baseValue;
  } else {
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
    if (actor.pactMutatorsSupplier) {
      const pct = actor.pactMutatorsSupplier().playerMaxHpPercent ?? 0;
      value = value * (1 + pct);
    }
  } else if (attributeKey === 'actionCost') {
    // Encumbrance cost adjustment first if available on inventory
    if (actor.inventory) {
      value = actor.inventory.calculateActionCost(value, actor.strength);
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
