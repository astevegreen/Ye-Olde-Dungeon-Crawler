import type { ItemStatModifiers } from './item';

export type ModifierAlignment = 'positive' | 'negative' | 'chaotic';

export type ModifierCategory =
  | 'blessed'
  | 'enchanted'
  | 'holy'
  | 'cursed'
  | 'hexed'
  | 'unholy'
  | 'chaotic';

export type ChaoticProcType = 'backlash' | 'teleport' | 'confuse' | 'wild_magic';

export interface ChaoticProcConfig {
  procChance: number; // 0.0 to 1.0
  type: ChaoticProcType;
  param: number; // e.g. damage amount for backlash, range for teleport
  description: string;
}

/** Extra melee damage against a defender that answers to `tag` (`Entity.hasTag`). */
export interface TagCombatBonus {
  tag: string;
  multiplier: number;
  flatBonus: number;
  /** The attacker heals this share of the damage dealt (Hel-touched: a fifth). */
  healPercentOfDamage?: number;
  message?: string;
}

export interface ItemModifier {
  id: string;
  name: string;
  alignment: ModifierAlignment;
  category: ModifierCategory;
  prefix?: string;
  suffix?: string;
  /** While worn, the item stays on until a cleansing takes this modifier off it. */
  binds?: boolean;
  statDeltas?: ItemStatModifiers;
  meleeDamageMultiplier?: number;
  meleeDamageFlatBonus?: number;
  spellDamageMultiplier?: number;
  manaCostDiscount?: number;
  damageTakenMultiplier?: number;
  damageTakenFlatBonus?: number;
  tagBonuses?: TagCombatBonus[];
  /** Damage the bearer takes on stepping onto, or striking from, sacred ground (`isSacredGround`). */
  sacredGroundBurn?: number;
  /** While worn, the temple serves the bearer only to cleanse, at double the price. */
  templeShunned?: boolean;
  chaoticProc?: ChaoticProcConfig;
  description?: string;
}

export function isModifierCursed(mod: ItemModifier): boolean {
  return mod.category === 'cursed';
}

/** A worn item with a binding modifier cannot be taken off until it is cleansed. */
export function isModifierBinding(mod: ItemModifier): boolean {
  return mod.binds === true;
}

export function isModifierBlessed(mod: ItemModifier): boolean {
  return mod.category === 'blessed';
}

export function isModifierChaotic(mod: ItemModifier): boolean {
  return mod.category === 'chaotic';
}

export function isModifierHexed(mod: ItemModifier): boolean {
  return mod.category === 'hexed';
}

export function isModifierUnholy(mod: ItemModifier): boolean {
  return mod.category === 'unholy';
}

export function isModifierHoly(mod: ItemModifier): boolean {
  return mod.category === 'holy';
}

/** The Enchanted family only: `Item.isEnchanted()` also counts +N and elemental affixes. */
export function isModifierEnchantedCategory(mod: ItemModifier): boolean {
  return mod.category === 'enchanted';
}
