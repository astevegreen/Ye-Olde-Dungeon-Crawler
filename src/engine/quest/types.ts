/** @deprecated Use manifest.quest.relicItemId instead. Kept for backward compat. */
export const QUEST_RELIC_ID = 'quest-relic';
/** @deprecated Use manifest.quest.bossMonsterId instead. Kept for backward compat. */
export const BOSS_MONSTER_ID = 'boss-monster';
/** Legacy alias */
export const BOSS_HRUNGNIR_ID = BOSS_MONSTER_ID;
export const MAX_DUNGEON_FLOOR = 5;

export type QuestStatus = 'active' | 'fallen' | 'victorious';

export interface QuestProgress {
  bossDefeated: boolean;
  hasSunStone: boolean;
  deepestFloor: number;
  questCompleted: boolean;
}
