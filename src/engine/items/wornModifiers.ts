import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import type { ItemModifier } from './modifiers';

/** Every modifier on what the entity wears; a plain entity (a prop) wears nothing. */
export function wornModifiers(entity: Entity): ItemModifier[] {
  if (!(entity instanceof Actor)) return [];
  const mods: ItemModifier[] = [];
  for (const item of entity.inventory.paperdoll.getEquippedItems()) mods.push(...item.modifiers);
  return mods;
}

type NumericField = NonNullable<{ [K in keyof ItemModifier]-?: ItemModifier[K] extends number | undefined ? K : never }[keyof ItemModifier]>;

/** The sum of one numeric modifier field over everything worn (0 when nothing carries it). */
export function sumWorn(entity: Entity, field: NumericField): number {
  let total = 0;
  for (const mod of wornModifiers(entity)) total += (mod[field] as number | undefined) ?? 0;
  return total;
}

/** True when anything worn carries the flag. */
export function wearsFlag(entity: Entity, field: keyof ItemModifier): boolean {
  return wornModifiers(entity).some((mod) => Boolean(mod[field]));
}
