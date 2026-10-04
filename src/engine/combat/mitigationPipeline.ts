import type { Item, EquipmentSlot } from '../items/item';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';

export interface AspectMitigationModifier {
  multiplier: number;
  flatBonus: number;
  message?: string;
}

export interface MitigationResult {
  rawDamage: number;
  finalDamage: number;
  aspectModifier: AspectMitigationModifier;
}

const RADIANT_VS_CORRUPT_MULTIPLIER = 1.5;
const RADIANT_VS_CORRUPT_FLAT_BONUS = 3;
const CORRUPT_VS_RADIANT_MULTIPLIER = 1.5;
const CORRUPT_VS_RADIANT_FLAT_BONUS = 2;

/**
 * Evaluates tagged aspect matchups between an attacker's weapon and defender's aspect/faction.
 * Generalized system replacing binary curse checks:
 * - aspect_radiant vs aspect_corrupt or undead/demon: +50% multiplier + 3 flat damage
 * - aspect_corrupt vs aspect_radiant: +50% multiplier + 2 flat damage
 * - neutral or unaligned: 1.0x multiplier
 */
export function calculateAspectModifier(
  attackerAspect?: string,
  defenderAspect?: string,
  defenderFactions?: string[]
): AspectMitigationModifier {
  const defenderTags = defenderFactions ?? [];

  if (attackerAspect === 'aspect_radiant') {
    if (
      defenderAspect === 'aspect_corrupt' ||
      defenderTags.includes('undead') ||
      defenderTags.includes('demon')
    ) {
      return {
        multiplier: RADIANT_VS_CORRUPT_MULTIPLIER,
        flatBonus: RADIANT_VS_CORRUPT_FLAT_BONUS,
        message: 'Radiant energy blazes against unholy corruption! (+50% / +3 Holy)',
      };
    }
  }

  if (attackerAspect === 'aspect_corrupt') {
    if (defenderAspect === 'aspect_radiant' || defenderTags.includes('radiant')) {
      return {
        multiplier: CORRUPT_VS_RADIANT_MULTIPLIER,
        flatBonus: CORRUPT_VS_RADIANT_FLAT_BONUS,
        message: 'Corrupt malice eats away at radiant warding! (+50% / +2 Corrupt)',
      };
    }
  }

  return {
    multiplier: 1.0,
    flatBonus: 0,
  };
}

/**
 * Executes the combat mitigation pipeline: checks the attacker weapon's aspect against the
 * defender's aspect or faction, then calculates the final damage.
 */
export function resolveCombatMitigation(
  attacker: Entity,
  defender: Entity,
  rawDamage: number,
  engine: GameEngine
): MitigationResult {
  // Helper to extract equipped item from actor if paperdoll exists
  const getEquipped = (ent: Entity, slot: EquipmentSlot): Item | null =>
    ent.inventory?.paperdoll.getItem(slot) ?? null;

  const weapon = getEquipped(attacker, 'mainHand');
  const armor = getEquipped(defender, 'torso');

  const attackerAspect = weapon?.aspectState;
  const defenderAspect = armor?.aspectState ?? defender.aspectState;
  const defenderFactions = [defender.faction, defender.definitionId].filter(
    (f): f is string => typeof f === 'string' && f.length > 0
  );

  const aspectModifier = calculateAspectModifier(attackerAspect, defenderAspect, defenderFactions);
  if (aspectModifier.message && engine) {
    engine.log(aspectModifier.message);
  }

  const finalDamage = Math.max(
    1,
    Math.round(rawDamage * aspectModifier.multiplier) + aspectModifier.flatBonus
  );

  return {
    rawDamage,
    finalDamage,
    aspectModifier,
  };
}
