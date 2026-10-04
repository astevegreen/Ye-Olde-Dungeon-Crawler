import type { ProgressionConfig } from '../../engine';

/** The last level a hero of Midgard reaches (Q4 "B", Q25 "approved", 2026-10-03). */
export const COTW_LEVEL_CAP = 50;

/**
 * Levels for Castle of the Winds (tracker 3.1).
 *
 * The XP a level asks for rises as `90 · level^1.5`: 90 for the second level, about 2,800 at
 * level 10, 11,000 at 25 and 29,000 at 47. A full clear of floors 1–50 offers about 554k XP
 * on every difficulty (XP follows the zone tier alone, `scaleMonsterStats`), which carries a
 * hero to level 47, roughly a level a floor; levels 48–50 come from revisiting cleared floors
 * (respawns pay a quarter, `respawnXpShare`) or the Mead of Suttungr. Measured by
 * `npm run balance` and pinned by `__tests__/progression.test.ts`.
 */
export const COTW_PROGRESSION: ProgressionConfig = {
  maxLevel: COTW_LEVEL_CAP,
  getXpForNextLevel: (level) => Math.round(90 * Math.pow(level, 1.5)),
};
