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

  // ── Rule-benders (the Chaotic family, Q22). Each is read in one place. ──
  /** A damaging spell the bearer casts takes a random element of the pack's (`CastSpellAction`). */
  randomSpellElement?: boolean;
  /** Each kill heals the bearer this share of max HP (`DeathResolver`). */
  killHealPercent?: number;
  /** The bearer cannot rest while this is worn (`AutoRestManager.restRefusal`). */
  forbidsRest?: boolean;
  /** Melee attacks strike this many more times; each strike that misses costs `missSelfDamage` HP. */
  extraMeleeStrikes?: number;
  missSelfDamage?: number;
  /** Chance a melee blow against the bearer misses outright (0–1). */
  evasionBonus?: number;
  /** Every Nth step the bearer takes blinks it `blinkRange` tiles away (`MovementAction`). */
  blinkEverySteps?: number;
  blinkRange?: [number, number];
  /** Each melee blow the bearer lands is scaled by a uniform roll in this range (Fickle Fortune: 0–2.5). */
  meleeDamageRoll?: [number, number];
  /** A cast short of mana accrues no debt, and rolls its surge this many tiers up (`ManaOverflowManager`). */
  overflowNoDebt?: boolean;
  overflowTierShift?: number;
  /** The highest tier `overflowTierShift` lifts a surge to; a surge already above it stays where it is. */
  overflowTierShiftCap?: number;
  /** This share of a melee blow the bearer takes is dealt back to the attacker. */
  reflectMeleePercent?: number;
  /** Healing the bearer receives is scaled by this (`Actor.heal`). */
  healingReceivedMultiplier?: number;
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
