import type { CombatConfig } from '../../engine';

/**
 * Attributes drive combat (tracker 3.2; Q5 "C, and partial heal scaling off Constitution",
 * Q28 "approved"). Per point above 10: Strength +1 melee damage; Dexterity +2% melee hit and
 * +1% evasion; Intelligence +3% spell power. Constitution's +2 HP a point is
 * `HP_PER_CONSTITUTION`, and its level-up heal is in `progression.ts`.
 *
 * A melee blow lands 80% of the time before Dexterity (the ranged roll's 75% is the model), so
 * a Dexterity of 20 never misses and one of 8 lands 76%; monsters carry no Dexterity and stay
 * at 80. Measured by `.prompts/phase3/attr-duels.ts`.
 */
export const COTW_COMBAT: CombatConfig = {
  attributeScaling: {
    baseline: 10,
    meleeDamagePerStrength: 1,
    meleeBaseHitPercent: 80,
    meleeHitPercentPerDexterity: 2,
    evasionPerDexterity: 0.01,
    spellPowerPerIntelligence: 0.03,
  },
};
