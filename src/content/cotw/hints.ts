import type { FirstTimeHintDefinition, FirstTimeHintId } from '../../engine';

/**
 * The first-time hints (`manifest.firstTimeHints`): one short note the first time a hero
 * meets each system, at the foot of the sidebar. `{key:<action>}` names the bound key.
 */
export const COTW_FIRST_TIME_HINTS: Partial<Record<FirstTimeHintId, FirstTimeHintDefinition>> = {
  altar: {
    title: 'Altars',
    text: 'An altar works a rite on your grimoire for an offering burnt on it: it inscribes a spell, opens a sealed slot, or transmutes one. Walking away costs nothing.',
  },
  killRite: {
    title: 'Kill rites',
    text: 'Some creatures give up their magic only when slain a certain way. The Bestiary ({key:compendium}) keeps a verse that hints at each one\'s rite.',
  },
  pactKeeper: {
    title: 'Pacts',
    text: 'Sage Mimir seals pacts: a curse you carry for a reward. A pact holds until you come back to him to renounce it; the Pacts tab ({key:pact}) lists those you carry.',
  },
  companion: {
    title: 'Your companion',
    text: 'Your companion follows you and fights at your side. Summon it, send it away, or call on a skill it has learned from the command list (Ctrl+K).',
  },
  renown: {
    title: 'Renown',
    text: 'Deeds earn renown, shown under your name above the map. Enough of it, in one kind of deed or in all, earns you a title in its place.',
  },
  runeOfReturn: {
    title: 'The Rune of Return',
    text: 'A Rune of Return carries you home to Bjarnarhaven. Thrain the Rune-Smith awakens a dormant one; once it is awake, {key:channel_rune_of_return} channels it, and you must keep still while it works.',
  },
  factionStanding: {
    title: 'Standing',
    text: 'Your standing with a faction has moved. The Story tab ({key:story}) shows where you stand with each one you have met.',
  },
  story: {
    title: 'Your saga',
    text: 'A deed of your saga is done. The Story tab ({key:story}) keeps the saga: the goal ahead, the deeds behind you, and riddles for those still to come.',
  },
};
