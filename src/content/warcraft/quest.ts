import type { QuestArcDefinition } from '../../engine';

export const WARCRAFT_QUEST: QuestArcDefinition = {
  id: 'warcraft_blackrock_spire',
  name: 'Assault on Blackrock Spire',
  maxFloor: 5,
  bossFloor: 5,
  bossMonsterId: 'warchief_blackhand',
  relicItemId: 'horde_war_banner',
  victoryNpcId: 'npc-lothar',
  victoryFloor: 0,
  victoryDialogue:
    '✦✦✦ FOR THE ALLIANCE! You have shattered the Horde chieftain and returned with the War Banner! Azeroth is saved! ✦✦✦',
  victoryScoreBonus: 6000,
  relicDropMessage: 'The Horde War Banner drops onto the smoking iron floor! Claim it and return to Stormwind Outpost!',
  victoryEpitaph: 'Champion of the Alliance - Slayer of Warchief Blackhand',
  championProclamation: 'Commander Lothar knights you Champion of Stormwind!',
  bossLairTitle: '*** FLOOR 5: THE BLACKROCK THRONE ROOM ***',
  bossEntryMessage: 'Warchief Blackhand rises from his iron throne, brandishing his fiery war hammer!',
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
      { definitionId: 'raider', position: { x: 18, y: 8 } },
      { definitionId: 'raider', position: { x: 26, y: 8 } },
      { definitionId: 'ogre_mage', position: { x: 16, y: 14 } },
      { definitionId: 'ogre_mage', position: { x: 28, y: 14 } },
    ],
  },
  floorEncounters: {
    1: {
      monsterIds: ['peon'],
      minMonsters: 4,
      maxMonsters: 7,
    },
    2: {
      monsterIds: ['peon', 'grunt'],
      minMonsters: 5,
      maxMonsters: 8,
    },
    3: {
      monsterIds: ['grunt', 'raider'],
      minMonsters: 5,
      maxMonsters: 9,
    },
    4: {
      monsterIds: ['grunt', 'raider', 'ogre_mage'],
      minMonsters: 6,
      maxMonsters: 11,
    },
  },
};
