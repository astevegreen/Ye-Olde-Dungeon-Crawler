import type { Entity } from '../entities/entity';
import type { AttributeScalingConfig } from '../types/config';
import type { GameContentManifest } from '../types/manifest';

/**
 * Attributes in combat (tracker 3.2; Q5, Q28). A pack sets `combatConfig.attributeScaling`
 * and each rule below is read in one place: Strength in `MeleeAttackAction`'s damage,
 * Dexterity in its hit roll and the defender's evasion, Intelligence in `SpellPipeline`'s
 * damage and healing. An actor without the attribute counts as the baseline, so monsters,
 * which carry only Strength (10), are untouched except by the hit roll's base.
 */

const DEFAULT_ATTRIBUTE_BASELINE = 10;

/** The pack's attribute rules, or none. */
export function attributeScalingOf(manifest: GameContentManifest | undefined): AttributeScalingConfig {
  return manifest?.combatConfig?.attributeScaling ?? {};
}

function above(value: number | undefined, config: AttributeScalingConfig): number {
  if (value === undefined) return 0;
  return value - (config.baseline ?? DEFAULT_ATTRIBUTE_BASELINE);
}

/** Flat melee damage the attacker's Strength adds, or takes away below the baseline. */
export function strengthMeleeBonus(attacker: Entity, config: AttributeScalingConfig): number {
  return Math.round(above(attacker.strength, config) * (config.meleeDamagePerStrength ?? 0));
}

/** A melee blow's chance to land, in percent, before the defender's evasion. 100 means no roll. */
export function meleeHitPercent(attacker: Entity, config: AttributeScalingConfig): number {
  const base = config.meleeBaseHitPercent ?? 100;
  const bonus = above(attacker.dexterity, config) * (config.meleeHitPercentPerDexterity ?? 0);
  return Math.max(5, Math.min(100, Math.round(base + bonus)));
}

/** The evasion the defender's Dexterity gives, as a fraction; never below 0. */
export function dexterityEvasion(defender: Entity, config: AttributeScalingConfig): number {
  return Math.max(0, above(defender.dexterity, config) * (config.evasionPerDexterity ?? 0));
}

/** What the caster's Intelligence multiplies a spell's damage and healing by. */
export function spellPowerMultiplier(caster: Entity, config: AttributeScalingConfig): number {
  return Math.max(0.1, 1 + above(caster.intelligence, config) * (config.spellPowerPerIntelligence ?? 0));
}
