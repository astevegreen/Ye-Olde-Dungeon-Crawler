import type { ActionHook, StoryChoiceTrigger } from '../../engine';
import { Companion } from '../../engine';
import { RELIC_RECOVERED_FLAG } from './relic';

/**
 * The Matriarch's Blood-Oath (`choices.ts`'s `oath_hearth`) closes Act 1. Once the
 * Sun-Chariot Warden is dead and the hero holds the Hearth-Tear, the coven's matriarch
 * steps out of the forge-smoke with her bargain: it opens on the hero's first move after
 * taking the shard, and `OATH_HOLD_HOOK` keeps the hero on that floor until she has
 * spoken, so the encounter always comes before the road home.
 *
 * It was a 250-turn countdown from the first troll-wife warlock's death, lost with its
 * companion when three warlocks weren't found in time. The owner removed it: losing the
 * companion to bad luck felt terrible, and the race pulled players past everything else
 * on their floors.
 */
export const OATH_GUARDIAN_ID = 'sun_chariot_warden';

/** Set when the matriarch's bargain is struck, by either option. */
const OATH_RESOLVED_FLAG = 'oath_resolved';
/** Which way it went: the town and the endings speak of it. */
export const OATH_HONORED_FLAG = 'oath_honored';
export const OATH_BROKEN_FLAG = 'oath_broken';

/** Each branch bonds its own companion (`choices.ts`), so the companion tells the side. */
const OATH_SIDE_BY_COMPANION: Record<string, string> = {
  hearth_frost_hound: OATH_HONORED_FLAG,
  ember_fang_wolf: OATH_BROKEN_FLAG,
};

/**
 * A save that struck the bargain before the side flags existed learns its side from the
 * companion the Oath bonded, on the first turn that companion stands on the hero's floor.
 */
export const OATH_SIDE_HOOK: ActionHook = {
  id: 'cotw-oath-side',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || !engine.getWorldFlag(OATH_RESOLVED_FLAG)) return;
    if (engine.getWorldFlag(OATH_HONORED_FLAG) || engine.getWorldFlag(OATH_BROKEN_FLAG)) return;
    const companion = engine.map.getAllEntities().find((e): e is Companion => e instanceof Companion);
    const side = companion && OATH_SIDE_BY_COMPANION[companion.companionDefinitionId];
    if (side) engine.setWorldFlag(side, true);
  },
};

/** The id stays `oath_hearth`: a save that was already offered the Oath carries `oath_hearth_offered`. */
export const OATH_TRIGGER: StoryChoiceTrigger = {
  id: 'oath_hearth',
  choiceId: 'oath_hearth',
  monsterDefinitionId: OATH_GUARDIAN_ID,
  killsRequired: 1,
  when: {
    type: 'and',
    predicates: [
      { type: 'hasFlag', flag: RELIC_RECOVERED_FLAG },
      // A save whose old countdown ran out has already settled the Oath.
      { type: 'not', predicate: { type: 'hasFlag', flag: OATH_RESOLVED_FLAG } },
    ],
  },
};

const OATH_OFFERED_FLAG = `${OATH_TRIGGER.id}_offered`;

/** The ways off a floor that don't take a step: a step opens the matriarch's choice itself. */
const LEAVING_ACTIONS = new Set(['ClimbStairsAction', 'ChannelRuneOfReturnAction']);

/**
 * Keeps the hero on the Warden's floor until the matriarch has made her offer. It holds
 * only until she is offered, not until she is answered, so a closed dialog can never
 * strand the hero.
 */
export const OATH_HOLD_HOOK: ActionHook = {
  id: 'cotw-oath-hold',
  phase: 'pre',
  actionType: '*',
  execute: ({ actor, engine, actionType }) => {
    const waiting =
      actor === engine.player &&
      LEAVING_ACTIONS.has(actionType) &&
      engine.getWorldFlag(RELIC_RECOVERED_FLAG) &&
      !engine.getWorldFlag(OATH_OFFERED_FLAG) &&
      !engine.getWorldFlag(OATH_RESOLVED_FLAG);
    if (!waiting) return { proceed: true };
    const message = 'Footsteps stir in the forge-smoke behind you. Someone has waited a long time to speak with you.';
    engine.log(message);
    return { proceed: false, result: { success: false, cost: 0, message } };
  },
};
