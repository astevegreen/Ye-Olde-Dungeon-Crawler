import type { ObjectiveDefinition } from '../../engine';
import { COTW_DEEPEST_FLOOR_COUNTER } from './spellTablets';

/**
 * The running objective the HUD shows under the spell belt (`manifest.objectives`),
 * one line per stage of Blood of Thrym (see quest.ts). Worded so no line gives away
 * a beat before the game reveals it: the Níðhögg choice appears only after Víðnir
 * has spoken.
 */
export const COTW_OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: 'cotw_objective_descend',
    text: "Gear up in Bjarnarhaven's shops, then take the stairs down.",
    doneWhenCounterAtLeast: { counter: COTW_DEEPEST_FLOOR_COUNTER, value: 1 },
  },
  {
    id: 'cotw_objective_act1',
    text: "Something below is stealing the village's warmth. Descend and find it.",
    doneWhenAnyFlag: ['oath_resolved', 'oath_defaulted', 'savior_of_jarnvidr', 'blood_tainted_hero'],
    doneWhenCounterAtLeast: { counter: COTW_DEEPEST_FLOOR_COUNTER, value: 26 },
  },
  {
    id: 'cotw_objective_act2',
    text: "Rot seeps up from a gnawed root of Yggdrasil. Follow it down.",
    doneWhenAnyFlag: ['vidnir_slain'],
  },
  {
    id: 'cotw_objective_nidhogg',
    text: "Níðhögg waits at the root's end. Slay it, or drive it off.",
    availableWhenFlag: 'vidnir_slain',
    doneWhenAnyFlag: ['boss_slain', 'nidhogg_root_sealed'],
  },
  {
    id: 'cotw_objective_return',
    text: 'Carry the Sun-Stone of Freyr home to Bjarnarhaven.',
    availableWhenFlag: 'relic_recovered',
  },
];
