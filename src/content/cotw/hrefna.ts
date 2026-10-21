import type { ActionHook, ChoiceDefinition, EngineContext, WorldState } from '../../engine';
import { NPC, getFlag } from '../../engine';
import { FIRST_ALTAR_RITE_FLAG, FIRST_STONE_READ_FLAG, FIRST_VOID_DEBT_FLAG } from './firstSpell';
import { PROLOGUE_ENDED_FLAG } from './prologue';

/**
 * Hrefna the völva, the voice of Seiðr in Bjarnarhaven (sprint M3, owner's design "Seeress +
 * just-in-time"). She comes to the plaza fountain once the night raid is over and stays: a hook
 * seats her, so a town saved after the raid, before she came, gains her on its next turn.
 * Talking to her gives her three lines on what Seiðr is; once the hero has read a stone, gone
 * into Void Debt or knelt at an altar, she speaks to the newest of those instead (sprint M7).
 */

export const HREFNA_ID = 'npc-hrefna';
export const HREFNA_CHOICE_ID = 'cotw_hrefna_seidr';
export const HREFNA_FIRST_SPELL_CHOICE_ID = 'cotw_hrefna_first_spell';
export const HREFNA_VOID_DEBT_CHOICE_ID = 'cotw_hrefna_void_debt';
export const HREFNA_ALTAR_CHOICE_ID = 'cotw_hrefna_altar';
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

/** One of her reactions: a few lines and a nod, nothing asked of the hero. */
function reaction(id: string, description: string, nodMessage: string): ChoiceDefinition {
  return {
    id,
    title: HREFNA_NAME,
    description,
    options: [{ id: 'nod', label: 'Nod', consequences: [{ type: 'logMessage', message: nodMessage }] }],
    cancelable: true,
    cancelLabel: 'Step back',
  };
}

/** Her reactions to what the hero has learned, newest teaching last. */
export const HREFNA_REACTION_CHOICES: readonly ChoiceDefinition[] = [
  reaction(
    HREFNA_FIRST_SPELL_CHOICE_ID,
    'Hrefna’s staff-flame leans toward you as you come near.\n\n' +
      '“A stone gave you its spell, and you took it. Now it is yours to carry.\n\n' +
      'Cast it from your grimoire, and when the well runs low, rest.”',
    'Hrefna smiles, and turns back to the water.'
  ),
  reaction(
    HREFNA_VOID_DEBT_CHOICE_ID,
    'Hrefna’s flame gutters as you come near.\n\n' +
      '“You took more than you held, and the Void wrote it down. I feel the tally on you.\n\n' +
      'Rest, and it shrinks. Borrow deeper, and the Void bites harder.”',
    'Hrefna taps her staff once, and its flame steadies.'
  ),
  reaction(
    HREFNA_ALTAR_CHOICE_ID,
    'Hrefna looks at the altar-soot on your hands.\n\n' +
      '“You knelt where the old gods listen, and one of them answered.\n\n' +
      'They give, and they weigh what they give. Kneel with your eyes open.”',
    'Hrefna murmurs a god’s name to the water.'
  ),
];

/** What Hrefna says now: the newest teaching wins (altar, then debt, then first spell), else her opening lines. */
export function hrefnaChoiceId(worldState: WorldState): string {
  if (getFlag(worldState, FIRST_ALTAR_RITE_FLAG)) return HREFNA_ALTAR_CHOICE_ID;
  if (getFlag(worldState, FIRST_VOID_DEBT_FLAG)) return HREFNA_VOID_DEBT_CHOICE_ID;
  if (getFlag(worldState, FIRST_STONE_READ_FLAG)) return HREFNA_FIRST_SPELL_CHOICE_ID;
  return HREFNA_CHOICE_ID;
}

function hrefnaNpc(choiceId: string): NPC {
  return new NPC({
    id: HREFNA_ID,
    name: HREFNA_NAME,
    role: 'villager',
    position: HREFNA_POSITION,
    spriteKey: HREFNA_ID,
    choiceId,
    isStationary: true,
  });
}

/** Seats Hrefna by the fountain once the raid is over; true when she has just come. */
export function seatHrefna(engine: EngineContext): boolean {
  if (engine.currentFloor !== 0 || !getFlag(engine.worldState, PROLOGUE_ENDED_FLAG)) return false;
  if (engine.map.getEntityById(HREFNA_ID)) return false;
  // Someone standing in her place: she comes on a later turn.
  if (engine.map.getEntityAt(HREFNA_POSITION.x, HREFNA_POSITION.y)) return false;
  engine.map.addEntity(hrefnaNpc(hrefnaChoiceId(engine.worldState)));
  engine.log('Hrefna the völva sits by the plaza fountain, as if she has been waiting for you.');
  return true;
}

/**
 * Re-seats a seated Hrefna whose words are behind what the hero has learned: an NPC's choice is
 * fixed when it is made, so she is replaced in her place with the new one. True when she was.
 */
export function reseatHrefna(engine: EngineContext): boolean {
  if (engine.currentFloor !== 0) return false;
  const seated = engine.map.getEntityById(HREFNA_ID);
  if (!(seated instanceof NPC)) return false;
  const choiceId = hrefnaChoiceId(engine.worldState);
  if (seated.choiceId === choiceId) return false;
  const occupant = engine.map.getEntityAt(HREFNA_POSITION.x, HREFNA_POSITION.y);
  if (occupant && occupant !== seated) return false;
  engine.removeEntity(seated);
  engine.map.addEntity(hrefnaNpc(choiceId));
  return true;
}

export const COTW_HREFNA_HOOK: ActionHook = {
  id: 'cotw-hrefna',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    if (!seatHrefna(engine)) reseatHrefna(engine);
  },
};
