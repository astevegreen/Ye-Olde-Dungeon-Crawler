import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import type { ItemModifier } from '../items/modifiers';
import { getMonsterCategory } from './compendiumManager';

type NumericField = NonNullable<{ [K in keyof ItemModifier]-?: ItemModifier[K] extends number | undefined ? K : never }[keyof ItemModifier]>;

/**
 * The effects of the family perk the hero chose for this foe's monster family (tracker 3.6, Q53
 * "A"), as modifiers; empty when the holder is not the hero, the foe has no family, or the
 * family's mastery chose one of the shared five. A family perk is pack data
 * (`PerkDefinition.category`) chosen in the compendium, and counts only against that family,
 * so it never joins `wornModifiers`: each read site that knows the foe asks for it.
 */
export function familyModifiers(engine: GameEngine, holder: Entity, foe: Entity): ItemModifier[] {
  if (holder !== engine.player || !(foe instanceof Monster) || !engine.compendium) return [];
  const category = getMonsterCategory(engine, foe.definitionId);
  if (!category) return [];
  const perkId = engine.compendium.getCategoryPerk(category.id);
  const perk = perkId ? engine.manifest?.perks?.find((p) => p.id === perkId && p.category === category.id) : undefined;
  if (!perk?.effects) return [];
  return [{ id: `perk:${perk.id}`, name: perk.name, alignment: 'positive', category: 'blessed', ...perk.effects }];
}

/** The sum of one numeric field over the holder's family perk against this foe (0 when none). */
export function sumAgainst(engine: GameEngine, holder: Entity, foe: Entity, field: NumericField): number {
  let total = 0;
  for (const mod of familyModifiers(engine, holder, foe)) total += (mod[field] as number | undefined) ?? 0;
  return total;
}

/**
 * Whether the hero shrugs off an affliction this foe is laying on it, by its family perk against
 * the foe's family (`afflictionShrugChance`: Spirit-Ward half the time, Grave-Warden and Iron
 * Will always); logs the shrug. Asked on every path a monster afflicts by: a melee bite, a spell's
 * status, a spell's own affliction, and a hook.
 */
export function shrugsAffliction(engine: GameEngine, target: Entity, source: Entity, status: string): boolean {
  const chance = sumAgainst(engine, target, source, 'afflictionShrugChance');
  if (chance <= 0 || (chance < 1 && engine.rng() >= chance)) return false;
  engine.log(`${target.name} shrugs off ${source.name}'s ${status}!`);
  return true;
}

/** The product of one numeric field over the holder's family perk against this foe (1 when none). */
export function productAgainst(engine: GameEngine, holder: Entity, foe: Entity, field: NumericField): number {
  let product = 1;
  for (const mod of familyModifiers(engine, holder, foe)) {
    const value = mod[field] as number | undefined;
    if (value !== undefined) product *= value;
  }
  return product;
}
