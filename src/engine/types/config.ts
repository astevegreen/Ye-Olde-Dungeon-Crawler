import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';

export interface CombatConfig {
  /** Minimum damage an attack can deal. Default: 1 */
  minDamage?: number;
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
  /** Max attainable level */
  maxLevel?: number;
}
