import type { QuestArcDefinition } from '../../engine/types/manifest';

export const COTW_QUEST: QuestArcDefinition = {
  id: 'cotw_sun_stone',
  name: 'The Sun-Stone of Freyr',
  maxFloor: 5,
  bossFloor: 5,
  bossMonsterId: 'boss_hrungnir',
  relicItemId: 'sun_stone_freyr',
  victoryNpcId: 'npc-olaf',
  victoryFloor: 0,
  victoryDialogue:
    '✦✦✦ VICTORY OF THE NORTH! You have returned with the Sun-Stone of Freyr! Elder Olaf proclaims you Champion of Bjarnarhaven! ✦✦✦',
  victoryScoreBonus: 5000,
  relicDropMessage: 'The Sun-Stone of Freyr glows brightly amidst the dust! Retrieve it and return to Bjarnarhaven!',
  victoryEpitaph: 'Hero of Bjarnarhaven - Recovered The Sun-Stone of Freyr',
  championProclamation: 'Elder Olaf proclaims you Champion of Bjarnarhaven!',
  bossLairTitle: "*** FLOOR 5: THE CHIEFTAIN'S LAIR ***",
  bossEntryMessage: 'The earth tremors under the heavy footsteps of Hrungnir the Hill Giant Chieftain!',
  bossFloorLayout: {
    width: 45,
    height: 35,
    playerSpawn: { x: 22, y: 28 },
    stairsUp: { x: 22, y: 30 },
    bossSpawn: { x: 22, y: 7 },
    pillars: [
      { x: 14, y: 12 },
      { x: 14, y: 18 },
      { x: 14, y: 24 },
      { x: 30, y: 12 },
      { x: 30, y: 18 },
      { x: 30, y: 24 },
    ],
    guards: [
      { definitionId: 'ogre', position: { x: 18, y: 8 } },
      { definitionId: 'ogre', position: { x: 26, y: 8 } },
      { definitionId: 'kobold_shaman', position: { x: 16, y: 14 } },
      { definitionId: 'kobold_shaman', position: { x: 28, y: 14 } },
    ],
  },
  floorEncounters: {
    1: {
      monsterIds: ['kobold', 'giant_rat'],
      minMonsters: 4,
      maxMonsters: 7,
    },
    2: {
      monsterIds: ['kobold', 'giant_rat', 'skeleton'],
      minMonsters: 5,
      maxMonsters: 9,
    },
    3: {
      monsterIds: ['skeleton', 'orc', 'kobold_shaman'],
      minMonsters: 6,
      maxMonsters: 10,
    },
    4: {
      monsterIds: ['orc', 'draugr', 'ogre', 'kobold_shaman'],
      minMonsters: 7,
      maxMonsters: 12,
    },
  },
};
