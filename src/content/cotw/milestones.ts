import type { AttributeMilestoneTrigger, ChoiceDefinition } from '../../engine';
import { COTW_CHOICES } from './choices';

/**
 * Attribute milestones (tracker 3.3; Q6 "A with perk style, starting at 20", Q26 "1 point,
 * tiers 20, 25 and 30, cap 16"): each attribute offers a perk choice at 20, 25 and 30. A
 * starting roll is capped at 16 (`MAX_ATTRIBUTE`) and a level gives one point, so the first
 * tier is a hero's own choice, never a lucky roll's. A tier's choice is `milestone_<attr>_<tier>`
 * in `choices.ts`; a tier whose choice is not written yet (25 and 30 await the owner's perk
 * lists, tracker 3.4 and 3.6) is left out, so adding the choice is all it takes to open it.
 */
export const COTW_MILESTONE_TIERS = [20, 25, 30] as const;

const ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'intelligence'] as const;
const SHORT: Record<(typeof ATTRIBUTES)[number], string> = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int' };

export function milestoneChoiceId(attribute: (typeof ATTRIBUTES)[number], tier: number): string {
  return `milestone_${SHORT[attribute]}_${tier}`;
}

export function attributeMilestones(choices: Record<string, ChoiceDefinition>): AttributeMilestoneTrigger[] {
  const triggers: AttributeMilestoneTrigger[] = [];
  for (const tier of COTW_MILESTONE_TIERS) {
    for (const attribute of ATTRIBUTES) {
      const choiceId = milestoneChoiceId(attribute, tier);
      if (choices[choiceId]) triggers.push({ id: choiceId, attribute, threshold: tier, choiceId });
    }
  }
  return triggers;
}

export const COTW_ATTRIBUTE_MILESTONES: AttributeMilestoneTrigger[] = attributeMilestones(COTW_CHOICES);
