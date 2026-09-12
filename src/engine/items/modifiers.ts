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

export interface TagCombatBonus {
  tag: string;
  multiplier: number;
  flatBonus: number;
  renownCategory?: string;
  renownAmount?: number;
  message?: string;
}

export interface ConsecratedGroundPenalty {
  damagePenalty: number; // 0.0 to 1.0 (e.g. 0.5 = 50% damage reduction)
  selfDamagePerAttack: number;
}

export interface ItemModifier {
  id: string;
  name: string;
  alignment: ModifierAlignment;
  category: ModifierCategory;
  prefix?: string;
  suffix?: string;
  cursed?: boolean;
  statDeltas?: ItemStatModifiers;
  meleeDamageMultiplier?: number;
  meleeDamageFlatBonus?: number;
  spellDamageMultiplier?: number;
  manaCostDiscount?: number;
  damageTakenMultiplier?: number;
  damageTakenFlatBonus?: number;
  tagBonuses?: TagCombatBonus[];
  consecratedGroundPenalty?: ConsecratedGroundPenalty;
  chaoticProc?: ChaoticProcConfig;
  description?: string;
}

export function isModifierCursed(mod: ItemModifier): boolean {
  return mod.cursed === true || mod.category === 'cursed';
}
