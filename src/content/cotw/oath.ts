import type { StoryChoiceTrigger, TimedEventDefinition } from '../../engine';

/**
 * The Oath's climax (ARCHITECTURE.md §3): a time-pressured story choice, not a calm
 * dialogue menu. It is unlocked by *progress* — clearing enough of the troll-wife
 * warlock coven (`StoryChoiceTrigger`, checked against `GameEngine.compendium`'s
 * cross-floor-safe kill count in `movement.ts`) — rather than by a placed room, because
 * the coven spans several floors; a fixed encounter would use `scriptedVaultPlacements`
 * instead (see the Siphon Altar in hostageRitual.ts).
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
  progressStartMessage:
    "*** The warlock's death-cry carries through the stone, and the coven answers: their siphon ritual has begun. Break the troll-wife coven before it completes! ***",
};

export const OATH_TIMED_EVENT: TimedEventDefinition = {
  id: 'oath_climax',
  label: 'Coven Ritual',
  startFlag: 'oath_climax_started',
  // The coven spans several floors; 40 turns expired before most players had even
  // noticed the ritual. The HUD now shows the countdown (TimedEventDefinition.label).
  turnLimit: 250,
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
