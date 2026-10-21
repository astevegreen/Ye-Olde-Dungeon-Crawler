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

/** Set the first time the hero casts short and the Void takes the rest as debt (Hrefna's reaction, hrefna.ts). */
export const FIRST_VOID_DEBT_FLAG = 'cotw_first_void_debt';

/** Set the first time the hero completes an altar rite (Hrefna's reaction, hrefna.ts). */
export const FIRST_ALTAR_RITE_FLAG = 'cotw_first_altar_rite';

/**
 * The hero's Void Debt as each of the hero's actions began. A post hook's `result` does not yet
 * carry the action's events (actionPipeline.ts attaches them on return), so the debt hook tells a
 * `void_debt_accrued` cast by the debt it left behind instead. Keyed by the action object, so
 * nothing outlives the action and nothing is shared between runs.
 */
const debtBefore = new WeakMap<object, number>();

/** Notes the hero's debt before each of the hero's actions, for {@link COTW_FIRST_VOID_DEBT_HOOK}. */
export const COTW_VOID_DEBT_BEFORE_HOOK: ActionHook = {
  id: 'cotw-void-debt-before',
  phase: 'pre',
  actionType: '*',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)) return;
    debtBefore.set(action, engine.player.voidDebt);
  },
};

/** Marks the first time one of the hero's actions draws Seiðr past empty into Void Debt. */
export const COTW_FIRST_VOID_DEBT_HOOK: ActionHook = {
  id: 'cotw-first-void-debt',
  phase: 'post',
  actionType: '*',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || engine.getWorldFlag(FIRST_VOID_DEBT_FLAG)) return;
    const before = debtBefore.get(action);
    debtBefore.delete(action);
    if (before !== undefined && engine.player.voidDebt > before) engine.setWorldFlag(FIRST_VOID_DEBT_FLAG, true);
  },
};

/** Marks the first altar rite the hero completes; a silent altar (a failed rite) does not count. */
export const COTW_FIRST_ALTAR_RITE_HOOK: ActionHook = {
  id: 'cotw-first-altar-rite',
  phase: 'post',
  actionType: 'PerformAltarRiteAction',
  execute: ({ actor, engine, result }) => {
    if (actor !== engine.player || !result?.success || engine.getWorldFlag(FIRST_ALTAR_RITE_FLAG)) return;
    engine.setWorldFlag(FIRST_ALTAR_RITE_FLAG, true);
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
