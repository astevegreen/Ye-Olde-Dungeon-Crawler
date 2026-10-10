import type { Predicate } from '../predicates/types';

export type ChoiceConsequence =
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'modifyCounter'; counter: string; delta: number }
  | { type: 'modifyFaction'; faction: string; delta: number }
  | { type: 'grantItem'; itemId: string; toInventory?: boolean }
  | { type: 'applyBuff' | 'applyStatus'; statusType: string; duration: number; potency?: number }
  /** `cause` names a lethal hit on the death screen ("Slain by a god's wrath"). */
  | { type: 'damagePlayer'; amount: number; cause?: string }
  | { type: 'logMessage'; message: string }
  | { type: 'alertMonsters'; radius?: number }
  /**
   * Permanently adjusts a base combat stat (ARCHITECTURE.md §3) — a story choice with
   * a lasting mechanical consequence, e.g. a hot/cold oath trading attack for defense.
   * Applies to `Player.attack`/`Player.defense`, which already layer equipment and
   * pact bonuses on top (`calculateAttribute`), so this changes the permanent base
   * only, not the effective total directly.
   */
  | { type: 'modifyPermanentStat'; stat: 'attack' | 'defense' | 'speed'; delta: number }
  /**
   * Grants a companion by manifest-declared ID (ARCHITECTURE.md §3, Companions & Pet
   * Progression), the only way a hero gains one. Sets the summon-gate flag
   * (`GameEngine.COMPANION_BONDED_FLAG`), so the hero can call it back once sent away.
   */
  | { type: 'grantCompanion'; companionId: string }
  /** Teaches a spell by manifest id; a spell already known is left as it is. */
  | { type: 'learnSpell'; spellId: string }
  /** Ends these statuses on the hero, if any are in effect. */
  | { type: 'cureStatus'; statusTypes: string[] }
  /** Records a renown milestone by id (`manifest.renownMilestones`), as engine deeds do. */
  | { type: 'recordMilestone'; milestoneId: string }
  /** Grants a perk by id (`manifest.perks`); one already held is left alone. */
  | { type: 'grantPerk'; perkId: string }
  /** Raises (or lowers) an attribute for good, as a level's point would. */
  | { type: 'modifyAttribute'; attribute: 'strength' | 'dexterity' | 'constitution' | 'intelligence'; delta: number };

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  predicate?: Predicate;
  disabledReason?: string;
  consequences: ChoiceConsequence[];
  /**
   * A tile choice closes for good once any option is taken. An option that `keepsOpen`
   * leaves it open to come back to, e.g. reading a hearth's notes before resting there;
   * give it a `predicate` so it can't be taken twice.
   */
  keepsOpen?: boolean;
}

/**
 * Said instead of offering the choice, once `flag` is set or `when` holds (give one).
 * The first that applies wins.
 */
export interface ChoiceResolvedState {
  flag?: string;
  when?: Predicate;
  message: string;
}

export interface ChoiceDefinition {
  id: string;
  title: string;
  description: string;
  options: ChoiceOption[];
  cancelable?: boolean;
  cancelLabel?: string;
  resolvedStates?: ChoiceResolvedState[];
}
