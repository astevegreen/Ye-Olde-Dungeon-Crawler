import type { QuestArcDefinition } from '../../engine';

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
  bossFloor: 50,
  allowsDifficultyScaling: false,
  bossMonsterId: 'nidhogg',
  relicItemId: 'hearth_tear_fragment',
  victoryNpcId: 'npc-olaf',
  victoryFloor: 0,
  victoryDialogue:
    '✦✦✦ The saga is told and retold in Bjarnarhaven’s halls: the Hearth-Tear reclaimed, and Níðhögg’s root answered at last. ✦✦✦',
  victoryScoreBonus: 8000,
  relicDropMessage: 'A shard of the Hearth-Tear glows amidst the dust! It hums with the memory of a stolen sun.',
  victoryEpitaph: 'Hero of Járnviðr - Ended the Root-Gnawer',
  championProclamation: 'Elder Olaf proclaims you Champion of Bjarnarhaven, blood of Thrym and slayer of legend!',
  bossLairTitle: '*** FLOOR 50: THE ROTTING ROOT OF YGGDRASIL ***',
  bossEntryMessage: 'World-bark shudders. Níðhögg, the Root-Gnawer, uncoils from the wound it has chewed into the World Tree.',
  bossFloorLayout: {
    width: 50,
    height: 38,
    playerSpawn: { x: 25, y: 32 },
    stairsUp: { x: 25, y: 34 },
    bossSpawn: { x: 25, y: 6 },
    pillars: [
      { x: 15, y: 14 },
      { x: 15, y: 20 },
      { x: 15, y: 26 },
      { x: 35, y: 14 },
      { x: 35, y: 20 },
      { x: 35, y: 26 },
    ],
    guards: [
      { definitionId: 'root_wraith', position: { x: 19, y: 9 } },
      { definitionId: 'root_wraith', position: { x: 31, y: 9 } },
      { definitionId: 'bark_husk_miner', position: { x: 17, y: 16 } },
      { definitionId: 'bark_husk_miner', position: { x: 33, y: 16 } },
    ],
  },
  floorEncounters: {
    1: { monsterIds: ['giant_rat', 'kobold'], minMonsters: 4, maxMonsters: 7 },
    5: { monsterIds: ['kobold', 'skeleton', 'wolf'], minMonsters: 5, maxMonsters: 9 },
    10: { monsterIds: ['skeleton', 'orc', 'kobold_shaman'], minMonsters: 6, maxMonsters: 10 },
    15: { monsterIds: ['orc', 'draugr', 'troll_wife_warlock'], minMonsters: 6, maxMonsters: 10 },
    20: { monsterIds: ['troll_wife_warlock', 'cave_troll', 'draugr_warrior'], minMonsters: 7, maxMonsters: 11 },
    26: { monsterIds: ['root_wraith', 'bark_husk_miner', 'fire_giant'], minMonsters: 7, maxMonsters: 12 },
    35: { monsterIds: ['root_wraith', 'bark_husk_miner', 'ancient_wyrm'], minMonsters: 8, maxMonsters: 13 },
    45: { monsterIds: ['jotun_champion', 'shadow_fiend', 'bark_husk_miner'], minMonsters: 8, maxMonsters: 13 },
  },
  /**
   * Two named endings sharing the same Níðhögg encounter (ARCHITECTURE.md §3).
   * Both require returning to town and speaking with the victory NPC, exactly like
   * the legacy single-ending flow — only the underlying condition and text differ.
   */
  endings: {
    ragnarok: {
      id: 'ragnarok',
      requiredMonsterKillId: 'nidhogg',
      victoryDialogue:
        '✦✦✦ RAGNARÖK STIRS! Níðhögg falls, and the World Root splits. Fate is no longer patient — you have set it in motion. ✦✦✦',
      victoryEpitaph: 'Ended Níðhögg, and with it, an age of Midgard.',
      championProclamation: 'Elder Olaf falls silent at your saga’s weight, then proclaims you Champion — and harbinger.',
      victoryScoreBonus: 9000,
    },
    sealed: {
      id: 'sealed',
      requiredFlag: 'nidhogg_root_sealed',
      victoryDialogue:
        '✦✦✦ The root is sealed, not severed. Níðhögg withdraws, wounded but alive — the World Tree holds, and Ragnarök waits a little longer. ✦✦✦',
      victoryEpitaph: 'Drove Níðhögg from the root of Yggdrasil.',
      championProclamation: 'Elder Olaf proclaims you Champion of Bjarnarhaven — and the world’s quiet reprieve.',
      victoryScoreBonus: 7000,
    },
  },
};
