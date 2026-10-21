import type { ActionHook } from '../../engine';

/** Set the first time the hero reads a learning stone: ends "Learn your first spell" (objectives.ts). */
export const FIRST_STONE_READ_FLAG = 'cotw_first_stone_read';

/** Marks the first stone read, whichever face the hero took, or the rune. */
export const COTW_FIRST_STONE_READ_HOOK: ActionHook = {
  id: 'cotw-first-stone-read',
  phase: 'post',
  actionType: 'ReadLearningStoneAction',
  execute: ({ actor, engine, result }) => {
    if (actor !== engine.player || !result?.success || engine.getWorldFlag(FIRST_STONE_READ_FLAG)) return;
    engine.setWorldFlag(FIRST_STONE_READ_FLAG, true);
  },
};
