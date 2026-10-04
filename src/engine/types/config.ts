import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { ElementalResistanceCurveConfig } from '../stats/levelScaledResistance';

/**
 * What the four attributes do in combat, per point above (or below) `baseline`. Every field
 * defaults to 0, so a pack that declares none keeps attack − defense melee that always lands
 * and spells at their listed power. An actor without the attribute (a monster has no
 * Dexterity or Intelligence) counts as the baseline. Read in one place each:
 * `combat/attributeScaling.ts`.
 */
export interface AttributeScalingConfig {
  /** The attribute value that gives nothing. Default 10. */
  baseline?: number;
  /** Flat melee damage per Strength point above the baseline. */
  meleeDamagePerStrength?: number;
  /** A melee blow's chance to land before Dexterity, in percent. Default 100: no roll. */
  meleeBaseHitPercent?: number;
  /** Percentage points of melee hit chance per Dexterity point above the baseline. */
  meleeHitPercentPerDexterity?: number;
  /** Evasion, as a fraction (0.01 is 1%), per Dexterity point above the baseline; never below 0. */
  evasionPerDexterity?: number;
  /** Spell damage and healing, as a fraction per Intelligence point above the baseline. */
  spellPowerPerIntelligence?: number;
}

export interface CombatConfig {
  /** Minimum damage an attack can deal. Default: 1 */
  minDamage?: number;
  /** Attributes in combat (tracker 3.2). Absent: none of them scales anything. */
  attributeScaling?: AttributeScalingConfig;
  /** Critical hit chance (0.0 to 1.0). Default: 0 */
  critChance?: number;
  /** Critical hit multiplier. Default: 1.5 */
  critMultiplier?: number;
  /** Custom damage formula returning damage and whether it was a critical strike */
  calculateDamage?: (attacker: Entity, defender: Entity, engine: GameEngine) => {
    damage: number;
    isCrit?: boolean;
  };
  /** Damage variance percentage (e.g. 0.1 for +/- 10%). Default: 0 */
  damageVariance?: number;
}

export interface LevelUpBonus {
  maxHp?: number;
  maxMana?: number;
  strength?: number;
  intelligence?: number;
  constitution?: number;
  dexterity?: number;
  baseAttack?: number;
  baseDefense?: number;
}

export interface LevelUpHealConfig {
  percent: number;
  perConstitutionAbove?: number;
  baseline?: number;
  cap?: number;
}

export interface ProgressionConfig {
  /** Base XP needed for level 2. Default: linear 75 */
  baseXp?: number;
  /** XP growth multiplier per level. Default: 1.0 */
  xpExponent?: number;
  /** Custom XP curve function: given current level, returns XP needed for level+1 */
  getXpForNextLevel?: (level: number) => number;
  /** Flat stat bonuses per level up, or dynamic function */
  statGains?: LevelUpBonus | ((newLevel: number) => LevelUpBonus);
  /** Unspent attribute/stat points awarded per level up. Default: 3 */
  statPointsPerLevel?: number;
  /**
   * How much of max HP and max mana a level-up restores: `percent`, plus
   * `perConstitutionAbove` for each Constitution point above `baseline` (default 10), at most
   * `cap` (default 1). Absent: a level-up restores both in full.
   */
  levelUpHeal?: LevelUpHealConfig;
  /** Max attainable level */
  maxLevel?: number;
  /**
   * The share of its XP a monster is worth when it refills a floor the hero has already
   * visited: cleared-floor respawns and catch-up spawns on re-entry (`FloorManager`).
   * Default 1. Wandering spawns and a floor's first population pay in full.
   */
  respawnXpShare?: number;
  /**
   * Level-scaled elemental resistance curves (ARCHITECTURE.md §3, `stats/
   * levelScaledResistance.ts`). Not consulted by combat's categorical
   * `elementalResistances`/`takeElementalDamage` — a content-defined mechanic (e.g.
   * an environmental exposure status effect) reads this explicitly via
   * `resolveLevelScaledResistance`/`applyLevelScaledElementalMitigation`.
   */
  elementalResistanceCurve?: ElementalResistanceCurveConfig;
}
