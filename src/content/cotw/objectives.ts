import type { ObjectiveDefinition } from '../../engine';
import { COTW_DEEPEST_FLOOR_COUNTER } from './spellTablets';
import { HEARTH_TEAR_RETURNED_FLAG, RELIC_RECOVERED_FLAG } from './relic';

/**
 * The running objective the HUD shows under the spell belt (`manifest.objectives`),
 * one line per stage of Blood of Thrym (see quest.ts). Worded so no line gives away
 * a beat before the game reveals it: the Níðhögg choice appears only after Víðnir
 * has spoken.
 */
export const COTW_OBJECTIVES: ObjectiveDefinition[] = [
  // The run's last step comes first, so it wins over any line still open behind it.
  {
    id: 'cotw_objective_portal_ragnarok',
    text: 'Níðhögg is dead. Step into the split root where it fell.',
    availableWhenFlag: 'nidhogg_slain',
  },
  {
    id: 'cotw_objective_portal_home',
    text: 'Níðhögg is driven off. Step onto the path of light where it fled.',
    availableWhenFlag: 'nidhogg_root_sealed',
  },
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
    // Ahead of Act 2's line, so the errand shows as soon as the shard is in hand.
    id: 'cotw_objective_return',
    text: 'Carry the Hearth-Tear home to Bjarnarhaven.',
    availableWhenFlag: RELIC_RECOVERED_FLAG,
    doneWhenAnyFlag: [HEARTH_TEAR_RETURNED_FLAG],
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
    doneWhenAnyFlag: ['nidhogg_slain', 'nidhogg_root_sealed'],
  },
];
