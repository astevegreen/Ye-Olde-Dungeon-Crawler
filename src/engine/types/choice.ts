import type { Predicate } from '../predicates/types';

export type ChoiceConsequence =
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'modifyCounter'; counter: string; delta: number }
  | { type: 'modifyFaction'; faction: string; delta: number }
  | { type: 'grantItem'; itemId: string; toInventory?: boolean }
  | { type: 'applyBuff' | 'applyStatus'; statusType: string; duration: number; potency?: number }
  | { type: 'damagePlayer'; amount: number }
  | { type: 'logMessage'; message: string }
  | { type: 'alertMonsters'; radius?: number }
  /**
   * Permanently adjusts a base combat stat (ARCHITECTURE.md §3) — a story choice with
   * a lasting mechanical consequence, e.g. a hot/cold oath trading attack for defense.
   * Applies to `Player.attack`/`Player.defense`, which already layer equipment and
   * pact bonuses on top (`calculateAttribute`), so this changes the permanent base
   * only, not the effective total directly.
   */
  | { type: 'modifyPermanentStat'; stat: 'attack' | 'defense'; delta: number }
  /**
   * Grants a companion by manifest-declared ID (ARCHITECTURE.md §3, Companions & Pet
   * Progression). Sets the acquisition-gate flag first if the player hasn't already
   * bonded with one, so a story-granted companion doesn't require a trainer visit.
   */
  | { type: 'grantCompanion'; companionId: string };

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  predicate?: Predicate;
  disabledReason?: string;
  consequences: ChoiceConsequence[];
}

export interface ChoiceDefinition {
  id: string;
  title: string;
  description: string;
  options: ChoiceOption[];
  cancelable?: boolean;
  cancelLabel?: string;
}
