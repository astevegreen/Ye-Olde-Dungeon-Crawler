import type { CombatConfig, ProgressionConfig } from '../../engine/types/manifest';

export const WARCRAFT_FEATURE_FLAGS: Record<string, boolean> = {
  ammoCombat: false,
  stealthSubsystem: false,
  bloodlustMechanic: true,
  criticalStrikes: true,
};

export const WARCRAFT_COMBAT_CONFIG: CombatConfig = {
  minDamage: 1,
  critChance: 0.15,
  critMultiplier: 2.0,
  damageVariance: 0.05,
};

export const WARCRAFT_PROGRESSION_CONFIG: ProgressionConfig = {
  baseXp: 120,
  xpExponent: 1.25,
  statGains: {
    maxHp: 8,
    maxMana: 6,
    strength: 2,
    intelligence: 2,
    constitution: 2,
    dexterity: 1,
    baseAttack: 2,
    baseDefense: 1,
  },
};
