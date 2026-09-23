import type { Item, EquipmentSlot } from '../items/item';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';

export interface ItemWearEvent {
  item: Item;
  actor: Entity;
  broken: boolean;
  remainingDurability: number;
}

export interface AspectMitigationModifier {
  multiplier: number;
  flatBonus: number;
  message?: string;
}

export interface MitigationResult {
  rawDamage: number;
  finalDamage: number;
  wornItems: ItemWearEvent[];
  aspectModifier: AspectMitigationModifier;
}

const RADIANT_VS_CORRUPT_MULTIPLIER = 1.5;
const RADIANT_VS_CORRUPT_FLAT_BONUS = 3;
const CORRUPT_VS_RADIANT_MULTIPLIER = 1.5;
const CORRUPT_VS_RADIANT_FLAT_BONUS = 2;

/**
 * Applies a combat wear check to an item with a durability block.
 * When durability reaches 0, the item transitions to 'broken' quality,
 * which zeroes its effective combat stats.
 *
 * @param item Item to evaluate.
 * @param actor Entity carrying or using the item.
 * @param degradationChance Probability of degradation per combat action (default 0.15 = 15%).
 */
export function applyItemWear(
  item: Item,
  _actor: Entity,
  degradationChance = 0.15,
  rng: () => number
): { degraded: boolean; broken: boolean } {
  if (!item.durability) {
    return { degraded: false, broken: false };
  }

  if (item.isBroken()) {
    return { degraded: false, broken: true };
  }

  const roll = rng();
  if (roll < degradationChance) {
    item.durability.current = Math.max(0, item.durability.current - 1);
    if (item.durability.current === 0) {
      item.quality = 'broken';
      return { degraded: true, broken: true };
    }
    return { degraded: true, broken: false };
  }

  return { degraded: false, broken: false };
}

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
 * Executes the full combat mitigation pipeline:
 * 1. Checks attacker weapon aspect against defender aspect/faction.
 * 2. Evaluates durability wear on attacker weapon.
 * 3. Evaluates durability wear on defender shield and armor.
 * 4. Calculates final damage.
 */
export function resolveCombatMitigation(
  attacker: Entity,
  defender: Entity,
  rawDamage: number,
  engine: GameEngine,
  degradationChance = 0.15
): MitigationResult {
  const wornItems: ItemWearEvent[] = [];

  // Helper to extract equipped item from actor if paperdoll exists
  const getEquipped = (ent: Entity, slot: EquipmentSlot): Item | null =>
    ent.inventory?.paperdoll.getItem(slot) ?? null;

  const weapon = getEquipped(attacker, 'mainHand');
  const shield = getEquipped(defender, 'offHand');
  const armor = getEquipped(defender, 'torso');

  // 1. Weapon wear on attack
  if (weapon && weapon.durability) {
    const wear = applyItemWear(weapon, attacker, degradationChance, engine.rng);
    if (wear.degraded) {
      wornItems.push({
        item: weapon,
        actor: attacker,
        broken: wear.broken,
        remainingDurability: weapon.durability.current,
      });
      if (wear.broken && engine) {
        engine.log(`*** ${attacker.name}'s ${weapon.name} shattered into useless fragments! ***`);
      }
    }
  }

  // 2. Defender armor & shield wear on hit
  if (shield && shield.durability) {
    const wear = applyItemWear(shield, defender, degradationChance, engine.rng);
    if (wear.degraded) {
      wornItems.push({
        item: shield,
        actor: defender,
        broken: wear.broken,
        remainingDurability: shield.durability.current,
      });
      if (wear.broken && engine) {
        engine.log(`*** ${defender.name}'s ${shield.name} has broken! ***`);
      }
    }
  }

  if (armor && armor.durability) {
    const wear = applyItemWear(armor, defender, degradationChance, engine.rng);
    if (wear.degraded) {
      wornItems.push({
        item: armor,
        actor: defender,
        broken: wear.broken,
        remainingDurability: armor.durability.current,
      });
      if (wear.broken && engine) {
        engine.log(`*** ${defender.name}'s ${armor.name} has been ruined by battle wear! ***`);
      }
    }
  }

  // 3. Aspect modifiers
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
    wornItems,
    aspectModifier,
  };
}
