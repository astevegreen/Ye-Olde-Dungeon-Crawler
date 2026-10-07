import type { QuestArcDefinition } from '../../engine';
import { TOWN_RETURN_POSITION } from './townLayout';
import { HEARTWOOD_LAIR, LAIR_WIDTH, LAIR_HEIGHT, LAIR_PLAYER_SPAWN, LAIR_STAIRS_UP, LAIR_BOSS_SPAWN } from './lair';

/**
 * Blood of Thrym (ARCHITECTURE.md §3 — see index.ts for the wiring: `oath.ts`'s
 * StoryChoiceTrigger/TimedEventDefinition, `giantBlood.ts`'s heritage buff, and
 * `BossFleeResolution` for Níðhögg's alternate ending). Set centuries after the
 * original Castle of the Winds sagas, in the same Midgard — Thrym, Útgarðaloki,
 * Rungnir, and Þjazi are half-remembered legend here, not characters in this story.
 *
 * Act 1 — The Hearth-Tear of Járnviðr (floors 1-25): a stolen fragment of Sól's
 * sun-chariot, siphoned by troll-wife warlocks into an abandoned dwarven forge, has
 * frozen the protagonist's village. The dungeon warms from permafrost toward the
 * stolen sun-chariot as the player descends, felt as the protagonist's frost-giant
 * heritage fading from a strong early edge to nothing by floor 25 (`giantBlood.ts`),
 * mirrored by monster power itself climbing in zone-tiered steps rather than the
 * old smooth per-floor curve (`monsterScaling.ts`); a troll-wife matriarch's
 * blood-oath (`choices.ts`'s `oath_hearth`, unlocked in `oath.ts`) offers to sever
 * the siphon, at a permanent cost.
 *
 * Act 2 — The Rotting Root of Níðhögg (floors 26-50): Níðhögg has gnawed a
 * secondary root of Yggdrasil, leaking rot into old silver mines; the architecture
 * warps from stone into world-bark with depth. No plot device and no heritage buff
 * carries over from Act 1 — monster power keeps climbing from wherever Act 1 left
 * off (`monsterScaling.ts`, no reset at the Act boundary), pure escalating
 * difficulty with no thematic tie-in of its own.
 *
 * The player gets the full Níðhögg fight regardless of ending — the branch is in
 * how it resolves (`endings` below), not whether it happens.
 *
 * `allowsDifficultyScaling: false` — floor count is fixed at 50 for every
 * difficulty (Easy/Medium/Hard now control only monster power via
 * `monsterScaling.ts`, not how much of the campaign is reachable).
 */
export const COTW_QUEST: QuestArcDefinition = {
  id: 'cotw_blood_of_thrym',
  name: 'Blood of Thrym',
  maxFloor: 50,
  allowsDifficultyScaling: false,
  bossMonsterId: 'nidhogg',
  bossSlainFlag: 'nidhogg_slain',
  relicItemId: 'hearth_tear_fragment',
  victoryPortalTileId: 'gateway_valhalla',
  victoryPortalMessage: 'Where Níðhögg fell, the World Root splits open onto fire and storm. Step into the split root to end the age.',
  townReturnPosition: TOWN_RETURN_POSITION,
  bossLairTitle: '*** FLOOR 50: THE ROTTING ROOT OF YGGDRASIL ***',
  bossEntryMessage: 'World-bark shudders. Níðhögg, the Root-Gnawer, uncoils from the wound it has chewed into the World Tree.',
  bossFloorLayout: {
    // The Heartwood (lair.ts): the boss floor on every difficulty.
    width: LAIR_WIDTH,
    height: LAIR_HEIGHT,
    layout: HEARTWOOD_LAIR,
    playerSpawn: LAIR_PLAYER_SPAWN,
    stairsUp: LAIR_STAIRS_UP,
    bossSpawn: LAIR_BOSS_SPAWN,
    pillars: [
      { x: 15, y: 14 },
      { x: 15, y: 20 },
      { x: 15, y: 26 },
      { x: 35, y: 14 },
      { x: 35, y: 20 },
      { x: 35, y: 26 },
    ],
    // Root-Wraiths flank Níðhögg on the dais; the Bark-Husk Miners keep the hollow, clear
    // of the pit their Battering Charge could throw a hero into.
    guards: [
      { definitionId: 'root_wraith', position: { x: 24, y: 4 } },
      { definitionId: 'root_wraith', position: { x: 32, y: 4 } },
      { definitionId: 'bark_husk_miner', position: { x: 20, y: 19 } },
      { definitionId: 'bark_husk_miner', position: { x: 36, y: 19 } },
    ],
  },
  floorEncounters: {
    1: { monsterIds: ['giant_rat', 'kobold'], maxMonsters: 7 },
    5: { monsterIds: ['kobold', 'skeleton', 'wolf'], maxMonsters: 9 },
    10: { monsterIds: ['skeleton', 'orc', 'kobold_shaman'], maxMonsters: 10 },
    15: { monsterIds: ['orc', 'draugr', 'troll_wife_warlock'], maxMonsters: 10 },
    20: { monsterIds: ['troll_wife_warlock', 'cave_troll', 'draugr_warrior'], maxMonsters: 11 },
    26: { monsterIds: ['root_wraith', 'bark_husk_miner', 'fire_giant'], maxMonsters: 12 },
    35: { monsterIds: ['root_wraith', 'bark_husk_miner', 'ancient_wyrm'], maxMonsters: 13 },
    45: { monsterIds: ['jotun_champion', 'shadow_fiend', 'bark_husk_miner'], maxMonsters: 13 },
  },
  /**
   * Two named endings sharing the same Níðhögg encounter (ARCHITECTURE.md §3). The fight
   * decides the ending: slain, a portal to Ragnarök opens where it fell; driven off, a
   * path home opens where it fled (index.ts `bossFleeResolutions`). Stepping into either
   * on floor 50 ends the run with its narrative screen, then the score screen.
   */
  endings: {
    ragnarok: {
      id: 'ragnarok',
      requiredMonsterKillId: 'nidhogg',
      victoryFloor: 50,
      title: 'Ragnarök',
      narrative: [
        'You step through the split root, and the world beyond it is already burning. Níðhögg is dead, and the tree it gnawed for an age gives way all at once: Yggdrasil groans, and the nine worlds feel it.',
        'In Midgard the winter that was promised comes early. Heimdall’s horn sounds over the mountains, the wolf slips its chain, and the gods ride out to a battle the skalds always said would come. Fate was patient. You were not.',
        'Bjarnarhaven remembers you as the hero who ended the Root-Gnawer, and the one who ended the age with it. Whether that is praise, no one living can yet say.',
      ],
      banner: 'The wyrm is dead, and the age of the gods is ending.',
      victoryDialogue: 'Níðhögg falls, and the World Root splits. Fate is no longer patient: you have set Ragnarök in motion.',
      victoryEpitaph: 'Ended Níðhögg, and with it, an age of Midgard.',
      championProclamation: 'Far above, Elder Olaf feels the ground shudder and names you Champion, and harbinger.',
      victoryScoreBonus: 9000,
    },
    sealed: {
      id: 'sealed',
      requiredFlag: 'nidhogg_root_sealed',
      victoryFloor: 50,
      title: 'The Root Sealed',
      narrative: [
        'You follow the path of light up out of the Heartwood. Behind you the gnawed root knits closed, and somewhere below Níðhögg licks its wounds in the dark, alive and beaten.',
        'Bjarnarhaven’s hearths burn warm again. The snow comes in its season and goes in its season, and the children who were born this year will grow old under a tree that still stands.',
        'Ragnarök waits, as it always has. But it waits a little longer because of you, and in the long hall the skalds begin a saga that ends with a hero coming home.',
      ],
      banner: 'The root holds, and Bjarnarhaven sleeps warm.',
      victoryDialogue: 'The root is sealed, not severed. Níðhögg withdraws, wounded but alive: the World Tree holds, and Ragnarök waits a little longer.',
      victoryEpitaph: 'Drove Níðhögg from the root of Yggdrasil.',
      championProclamation: 'Elder Olaf proclaims you Champion of Bjarnarhaven, and the world’s quiet reprieve.',
      victoryScoreBonus: 7000,
    },
  },
};
