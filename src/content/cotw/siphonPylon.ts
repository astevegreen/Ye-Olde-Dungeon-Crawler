import type { ChoiceDefinition, TileDefinition, VaultBlueprint } from '../../engine';
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
    '#...P...#',
    '#B.....B#',
    '#########',
  ],
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
            'The core cracks with a sound like ice giving way on a lake, and the light it drank pours back out of it. The dark draws off. Below, the Siphon itself still drinks.',
        },
      ],
    },
  ],
  cancelable: true,
  cancelLabel: 'Leave it',
  resolvedStates: [{ flag: FLOOR21_RELIT_FLAG, message: 'The core lies shattered and cold. The light holds.' }],
};
