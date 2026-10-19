import type { ChoiceDefinition, StoryChoiceTrigger, TileDefinition, VaultBlueprint } from '../../engine';
import type { DarkFloor } from './darkness';

/**
 * Floor 21 (tracker 5.4, Q37 "A"): the Siphon Pylon drinks the floor's light, and shattering its
 * core relights the whole floor at once (Q35: no room-by-room relighting). It foreshadows breaking
 * the Siphon itself on floor 22 (`hostageRitual.ts`).
 */
export const FLOOR21 = 21;
export const SIPHON_CORE_TILE = 'siphon_core';
export const FLOOR21_RELIT_FLAG = 'cotw:floor21_relit';
export const FLOOR21_PYLON_VAULT_ID = 'floor21_drinking_pylon';
/** The pylon's keeper, the Sól-Brand Zealots' leader (monsters/minibosses.ts). */
const ZEALOT_LEADER_ID = 'miniboss_zealot_leader';
/** Set once the hero has heard her dying claim; floor 22's altar and Mimir recall it. */
export const ZEALOT_CLAIM_HEARD_FLAG = 'zealot_claim_heard';

export const FLOOR21_DARK: DarkFloor = {
  floor: FLOOR21,
  relitFlag: FLOOR21_RELIT_FLAG,
  enterMessage:
    "The Siphon Pylon has drunk this floor's light. Past arm's reach the dark is total, and things are moving in it. Break the pylon's core and the light will come back.",
  beacon: { tileId: SIPHON_CORE_TILE, message: 'Its core throbs somewhere to the {direction}.' },
};

export const SIPHON_CORE_TILE_DEFINITION: TileDefinition = {
  type: SIPHON_CORE_TILE,
  name: 'Siphon Core',
  passable: true,
  walkable: true,
  transparent: true,
  glyph: 'ᛟ',
  description: 'A heart of black glass set in the pylon, webbed with blood-runes, drinking the light out of the air around it.',
  interactionHandlerId: SIPHON_CORE_TILE,
  landmarkLabel: 'Siphon Core',
};

/** The floor's own pylon, the zone landmark's twin with the core at its heart. */
export const FLOOR21_PYLON_VAULT: VaultBlueprint = {
  id: FLOOR21_PYLON_VAULT_ID,
  name: 'The Drinking Pylon',
  description: 'The siphon pump-house, its obsidian walls cold and its braziers dead: at its heart a black glass core drinks the light.',
  minFloor: FLOOR21,
  maxFloor: FLOOR21,
  scriptedOnly: true,
  legend: { O: SIPHON_CORE_TILE },
  layout: [
    '#########',
    '#B.....B#',
    '#...P...#',
    '@..MOM..@',
    '#...K...#',
    '#B.....B#',
    '#########',
  ],
  minibossId: ZEALOT_LEADER_ID,
  preferredMonsters: ['sol_brand_zealot', 'fire_giant'],
};

export const SIPHON_CORE_CHOICE: ChoiceDefinition = {
  id: SIPHON_CORE_TILE,
  title: 'The Siphon Core',
  description:
    'A heart of black glass the size of a shield, set in the pylon and webbed with blood-runes. The air around it is colder than the rift should allow, and the dark leans toward it. One hard blow would crack it.',
  options: [
    {
      id: 'shatter',
      label: 'Shatter the core',
      description: 'The light it has drunk goes back to the floor.',
      consequences: [
        { type: 'setFlag', flag: FLOOR21_RELIT_FLAG, value: true },
        {
          type: 'logMessage',
          message:
            'The core cracks with a sound like ice giving way on a lake, and the light it drank pours back out of it. The dark draws off.',
        },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Leave it',
  resolvedStates: [{ flag: FLOOR21_RELIT_FLAG, message: 'The core lies shattered and cold. The light holds.' }],
};

/** Her death opens her last words: the coven's claim, which floor 22's altar turns on. */
export const ZEALOT_LEADER_TRIGGER: StoryChoiceTrigger = {
  id: 'zealot_leader_last_words',
  choiceId: 'zealot_leader_last_words',
  monsterDefinitionId: ZEALOT_LEADER_ID,
  killsRequired: 1,
};

export const ZEALOT_LEADER_LAST_WORDS: ChoiceDefinition = {
  id: 'zealot_leader_last_words',
  title: 'The Keeper of the Pylon',
  description:
    'Vigdís of the Sól-Brand goes down on one knee among the dead braziers, then onto her side. She was a farmer’s wife in Midgard once; the brand on her palm is newer than the calluses.\n\n“You think we took the sun to watch your village freeze,” she says. “Something gnaws the root of the Tree. We hear it under the forge at night. We took Sól’s fire to burn it out, and fire will not touch it. Only blood will.”\n\nShe holds your eye until she can’t.',
  options: [
    {
      id: 'close_her_eyes',
      label: 'Close her eyes',
      consequences: [
        { type: 'setFlag', flag: ZEALOT_CLAIM_HEARD_FLAG, value: true },
        { type: 'logMessage', message: 'You close Vigdís’s eyes. Only blood will, she said.' },
      ],
    },
  ],
  cancelable: false,
};
