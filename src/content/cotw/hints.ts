import type { GameContentManifest } from '../../engine';

/**
 * The first-time hints (`manifest.firstTimeHints`): one short note the first time a hero
 * meets each system, at the foot of the sidebar. `{key:<action>}` names the bound key.
 */
export const COTW_FIRST_TIME_HINTS: NonNullable<GameContentManifest['firstTimeHints']> = {
  altar: {
    title: 'Altars',
    showOn: [{ type: 'altar_reached' }],
    text: 'Each god\'s altar works one rite on your grimoires. Tyr doubles one slot\'s lend, Hel is free: she re-picks a grimoire\'s stats or adds a slot, and clears your debt. Odin forges a second element onto a spell, and Loki gambles with fate. The rest ask an offering burnt on them. Step away and the altar waits for you.',
  },
  killRite: {
    title: 'Kill rites',
    showOn: [{ type: 'kill_rite_performed' }],
    text: 'Spells come from broken learning stones: set a stone\'s shard in it, and it offers you a spell to learn. A creature of the floor carries the shard; slay it the way its kind\'s rite asks, and the stone\'s offer opens on the spot. The Bestiary ({key:compendium}) keeps a verse that hints at each one\'s rite.',
  },
  pactKeeper: {
    title: 'Pacts',
    text: 'Sage Mimir seals pacts: a curse you carry for a reward. A pact holds until you come back to him to renounce it; the Pacts tab ({key:pact}) lists those you carry.',
  },
  companion: {
    title: 'Your companion',
    text: 'Your companion follows you and fights at your side. {key:companion_call} calls it or sends it away, and {key:companion_skill} has it use a skill it has learned.',
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
  grimoire: {
    title: 'Your grimoires',
    text: 'A spell is cast only from a grimoire slot, and where it sits shapes it. Each axis starts unpicked: you pick its stat, which grows away from the centre, and each spell lends something to the spells touching it. Open the Spellbook ({key:cast_spell}) and point at a slot to see what it does; Hel\'s altar, or Sage Mimir for a fee, re-picks a grimoire\'s stats.',
  },
  unidentified: {
    title: 'Unknown things',
    text: 'Much of what the deep gives up hides its true name: Sage Mimir in town names such things for a fee, and a Scroll of Identify names one at once. At Intelligence 20 you may take the Lore-Keeper gift: each time you take the stairs, it names what you have carried since the last stairs.',
  },
};
