import type { DarkFloor } from './darkness';

/**
 * Floor 30 (tracker 5.5, Q35, Q36 "A"): Gloom-Tarr, the Bile-Drinker, moves up from floor 44 into
 * the Silver Veins' flooded sump. After runestone #4's "Níðhögg has awakened", the Wyrm's bile has
 * seeped up the roots into the mine; Gloom-Tarr wallows in it, and its breath has snuffed every
 * lamp on the floor. Killing it relights the floor at once (Q35: no room-by-room relighting).
 */
export const FLOOR30 = 30;
export const GLOOM_TARR_ID = 'miniboss_tar_abomination';
export const FLOOR30_RELIT_FLAG = 'cotw:floor30_relit';

export const FLOOR30_DARK: DarkFloor = {
  floor: FLOOR30,
  relitFlag: FLOOR30_RELIT_FLAG,
  enterMessage:
    "Every lamp in these drowned workings has gone out at once: Gloom-Tarr's breath has snuffed them. Past arm's reach there is only black, and it is not empty. Kill the Bile-Drinker and the lamps will catch again.",
  beacon: { monsterDefinitionId: GLOOM_TARR_ID, message: 'The reek of its bile comes from the {direction}.' },
  relitWhenSlain: GLOOM_TARR_ID,
  relitMessage: 'Gloom-Tarr sinks into its own bile, and all through the workings the miners\' lamps sputter and catch again.',
};
