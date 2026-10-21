import type { ActionHook, ChoiceDefinition, EngineContext } from '../../engine';
import { NPC, getFlag } from '../../engine';
import { PROLOGUE_ENDED_FLAG } from './prologue';

/**
 * Hrefna the völva, the voice of Seiðr in Bjarnarhaven (sprint M3, owner's design "Seeress +
 * just-in-time"). She comes to the plaza fountain once the night raid is over and stays: a hook
 * seats her, so a town saved after the raid, before she came, gains her on its next turn.
 * Talking to her gives her three lines on what Seiðr is.
 */

export const HREFNA_ID = 'npc-hrefna';
export const HREFNA_CHOICE_ID = 'cotw_hrefna_seidr';
/** Beside the plaza fountain, on its west side (owner, 21 Oct: "beside the plaza fountain"). */
export const HREFNA_POSITION = { x: 27, y: 18 };
const HREFNA_NAME = 'Hrefna the Völva';

export const HREFNA_CHOICE: ChoiceDefinition = {
  id: HREFNA_CHOICE_ID,
  title: HREFNA_NAME,
  description:
    'An old woman in a blue cloak sits on the fountain’s rim, a staff across her knees. A pale flame burns in its brass knob.\n\n' +
    '“The cold the coven worked tonight was Seiðr, and so is your Magic Arrow. Both draw on one well.\n\n' +
    'Seiðr is borrowed. Take more than you hold and the Void keeps the tally.\n\n' +
    'Rest, and it seeps back. The old stones below remember other spells: read one, then come and tell me what it taught you.”',
  options: [
    {
      id: 'nod',
      label: 'Nod',
      consequences: [{ type: 'logMessage', message: 'Hrefna turns back to the water, and her staff’s flame burns low.' }],
    },
  ],
  cancelable: true,
  cancelLabel: 'Step back',
};

/** Seats Hrefna by the fountain once the raid is over; true when she has just come. */
export function seatHrefna(engine: EngineContext): boolean {
  if (engine.currentFloor !== 0 || !getFlag(engine.worldState, PROLOGUE_ENDED_FLAG)) return false;
  if (engine.map.getEntityById(HREFNA_ID)) return false;
  // Someone standing in her place: she comes on a later turn.
  if (engine.map.getEntityAt(HREFNA_POSITION.x, HREFNA_POSITION.y)) return false;
  engine.map.addEntity(
    new NPC({
      id: HREFNA_ID,
      name: HREFNA_NAME,
      role: 'villager',
      position: HREFNA_POSITION,
      spriteKey: HREFNA_ID,
      choiceId: HREFNA_CHOICE_ID,
      isStationary: true,
    })
  );
  engine.log('Hrefna the völva sits by the plaza fountain, as if she has been waiting for you.');
  return true;
}

export const COTW_HREFNA_HOOK: ActionHook = {
  id: 'cotw-hrefna',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    seatHrefna(engine);
  },
};
