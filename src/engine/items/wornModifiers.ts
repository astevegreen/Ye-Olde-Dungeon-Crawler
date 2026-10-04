import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import type { ItemModifier } from './modifiers';

/**
 * Every modifier on what the entity wears, and the perks a hero holds (`Player.perkModifiers`,
 * tracker 3.6: a perk's effects use the item-modifier vocabulary); a plain entity (a prop)
 * wears nothing.
 */
export function wornModifiers(entity: Entity): ItemModifier[] {
  if (!(entity instanceof Actor)) return [];
  const mods: ItemModifier[] = [];
  for (const item of entity.inventory.paperdoll.getEquippedItems()) mods.push(...item.modifiers);
  const perks = (entity as { perkModifiers?: ItemModifier[] }).perkModifiers;
  if (perks) mods.push(...perks);
  return mods;
}

type NumericField = NonNullable<{ [K in keyof ItemModifier]-?: ItemModifier[K] extends number | undefined ? K : never }[keyof ItemModifier]>;

/** The sum of one numeric modifier field over everything worn (0 when nothing carries it). */
export function sumWorn(entity: Entity, field: NumericField): number {
  let total = 0;
  for (const mod of wornModifiers(entity)) total += (mod[field] as number | undefined) ?? 0;
  return total;
}

/** The product of one numeric modifier field over everything worn (1 when nothing carries it). */
export function productWorn(entity: Entity, field: NumericField): number {
  let product = 1;
  for (const mod of wornModifiers(entity)) {
    const value = mod[field] as number | undefined;
    if (value !== undefined) product *= value;
  }
  return product;
}

/** The lowest value of one numeric modifier field over everything worn; undefined when nothing carries it. */
export function lowestWorn(entity: Entity, field: NumericField): number | undefined {
  let lowest: number | undefined;
  for (const mod of wornModifiers(entity)) {
    const value = mod[field] as number | undefined;
    if (value !== undefined && (lowest === undefined || value < lowest)) lowest = value;
  }
  return lowest;
}

/** How long an affliction lasts the entity, after what it wears shortens it (`shortenedAfflictions`); never below a turn. */
export function afflictionDuration(entity: Entity, statusType: string, duration: number): number {
  let factor = 1;
  for (const mod of wornModifiers(entity)) {
    if (mod.shortenedAfflictions?.types.includes(statusType)) factor *= mod.shortenedAfflictions.multiplier;
  }
  return factor === 1 ? duration : Math.max(1, Math.round(duration * factor));
}

/** True when anything worn carries the flag. */
export function wearsFlag(entity: Entity, field: keyof ItemModifier): boolean {
  return wornModifiers(entity).some((mod) => Boolean(mod[field]));
}
