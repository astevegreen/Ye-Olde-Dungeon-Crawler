import type { ActionHook } from '../../engine';

/** Set the first time the hero reads a learning stone: ends "Learn your first spell" (objectives.ts). */
export const FIRST_STONE_READ_FLAG = 'cotw_first_stone_read';

/**
 * Marks the first stone read, whichever face the hero took, or the rune: some floor's stone
 * record is then spent. Checked after every player action, not only the read, so a save made
 * before this flag existed catches up on its first action instead of losing the later lines.
 */
export const COTW_FIRST_STONE_READ_HOOK: ActionHook = {
  id: 'cotw-first-stone-read',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.getWorldFlag(FIRST_STONE_READ_FLAG)) return;
    if (engine.player.learningStones.stones.some((record) => record.spent)) {
      engine.setWorldFlag(FIRST_STONE_READ_FLAG, true);
    }
  },
};
