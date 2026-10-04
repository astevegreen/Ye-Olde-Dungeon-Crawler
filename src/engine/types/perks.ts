import type { ItemModifier } from '../items/modifiers';

/**
 * Perks (tracker 3.6; Q27 "Separate sources."): lasting rules a hero earns from a Saga level,
 * an attribute milestone or a monster family's mastery, declared by the pack as
 * `manifest.perks` and granted by a choice's `grantPerk` consequence. A perk's `effects` are
 * the same fields an item's family modifier carries (`ItemModifier`), so every place that
 * reads what the hero wears (`wornModifiers`: melee and spell scaling, evasion, damage taken,
 * kill healing, extra strikes, reflection, mana discount, ...) reads the hero's perks too.
 * Effects a perk needs beyond those fields are added to `ItemModifier` one at a time, read
 * in one place each, so items and perks share one vocabulary.
 */
export type PerkEffects = Omit<ItemModifier, 'id' | 'name' | 'alignment' | 'category' | 'prefix' | 'suffix' | 'binds' | 'description'>;

export interface PerkDefinition {
  id: string;
  name: string;
  /** One line for the choice and the Character tab. */
  tagline?: string;
  /** What it does, in the player's words. */
  description: string;
  /** Where it comes from, for the Character tab's grouping. */
  source: 'saga' | 'milestone' | 'family';
  effects?: PerkEffects;
}

/**
 * A choice offered once the hero reaches `level` (cotw: the Saga perks at 10, 20, 30, 40 and
 * 50). Sibling of `AttributeMilestoneTrigger`: the same one-time `<id>_offered` world-flag
 * idiom, checked every player move, held while a prologue runs.
 */
export interface LevelMilestoneTrigger {
  id: string;
  level: number;
  choiceId: string;
}
