import type { StoryChoiceTrigger, TimedEventDefinition } from '../../engine';

/**
 * The Oath's climax (ARCHITECTURE.md §3): a time-pressured story choice, not a calm
 * dialogue menu. There is no guaranteed-placement mechanism in this engine for a
 * hand-authored mid-game special room on a procedurally generated floor (only the
 * final boss floor gets that treatment, via `DungeonArc.generateChieftainLair` at
 * `floorNumber >= maxFloor`), so this is unlocked by *progress* — clearing enough of
 * the troll-wife warlock coven (`StoryChoiceTrigger`, checked against
 * `GameEngine.compendium`'s cross-floor-safe kill count in `movement.ts`) — rather
 * than by finding a specific tile.
 *
 * That progress is itself the time pressure: `OATH_TIMED_EVENT` starts counting
 * down the moment the first warlock falls (`progressStartFlag`), and if the coven
 * isn't broken in time, the ritual completes and the choice is taken out of the
 * player's hands entirely — a worse outcome than either deliberate branch (see
 * `expireConsequences`).
 */

export const OATH_WARLOCKS_REQUIRED = 3;

export const OATH_TRIGGER: StoryChoiceTrigger = {
  id: 'oath_hearth',
  choiceId: 'oath_hearth',
  monsterDefinitionId: 'troll_wife_warlock',
  killsRequired: OATH_WARLOCKS_REQUIRED,
  progressStartFlag: 'oath_climax_started',
};

export const OATH_TIMED_EVENT: TimedEventDefinition = {
  id: 'oath_climax',
  startFlag: 'oath_climax_started',
  turnLimit: 40,
  resolvedFlag: 'oath_resolved',
  expireConsequences: [
    { type: 'setFlag', flag: 'oath_defaulted', value: true },
    { type: 'modifyPermanentStat', stat: 'attack', delta: -1 },
    { type: 'modifyPermanentStat', stat: 'defense', delta: -1 },
    { type: 'damagePlayer', amount: 12 },
    {
      type: 'logMessage',
      message:
        "*** Hesitation costs you: the warlocks complete their ritual before the matriarch can intervene. The siphon's backlash sears you, and neither path was chosen. ***",
    },
  ],
};
