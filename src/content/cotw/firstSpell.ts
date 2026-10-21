import type { ActionHook } from '../../engine';

/** Set the first time the hero reads a learning stone: ends "Learn your first spell" (objectives.ts). */
export const FIRST_STONE_READ_FLAG = 'cotw_first_stone_read';

/**
 * Set in every new run's starting world state (`cotwManifest.initialWorldState`): the run tracks the
 * first read with {@link COTW_FIRST_STONE_READ_HOOK} alone. A save without it predates the flag.
 */
export const FIRST_STONE_READ_TRACKED_FLAG = 'cotw_first_stone_read_tracked';

/** Marks the first stone read, whichever face the hero took, or the rune (taking the rune counts as read). */
export const COTW_FIRST_STONE_READ_HOOK: ActionHook = {
  id: 'cotw-first-stone-read',
  phase: 'post',
  actionType: 'ReadLearningStoneAction',
  execute: ({ actor, engine, result }) => {
    if (actor !== engine.player || !result?.success || engine.getWorldFlag(FIRST_STONE_READ_FLAG)) return;
    engine.setWorldFlag(FIRST_STONE_READ_FLAG, true);
  },
};

/**
 * Catches up a save made before {@link FIRST_STONE_READ_FLAG} existed, once, on the hero's first action
 * after loading it. Such a save cannot tell a read stone from a shard that faded unread, so the owner
 * accepted any spent stone record as "first spell learned" for these saves only (issue #33): "Approved:
 * accept `spent` for old saves only." New runs carry {@link FIRST_STONE_READ_TRACKED_FLAG} from the start
 * and never reach the check, so a faded shard there leaves the objective standing.
 */
export const COTW_FIRST_STONE_READ_CATCH_UP_HOOK: ActionHook = {
  id: 'cotw-first-stone-read-catch-up',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.getWorldFlag(FIRST_STONE_READ_TRACKED_FLAG)) return;
    engine.setWorldFlag(FIRST_STONE_READ_TRACKED_FLAG, true);
    if (engine.player.learningStones.stones.some((record) => record.spent)) {
      engine.setWorldFlag(FIRST_STONE_READ_FLAG, true);
    }
  },
};
