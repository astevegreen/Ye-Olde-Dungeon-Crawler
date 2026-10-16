import type { ActionHook, NPC } from '../../engine';
import { getCounter, getFlag, incrementCounter } from '../../engine';
import { RELIC_RECOVERED_FLAG } from './relic';

/**
 * The cold while the Hearth-Tear is lost, Hallvard's "the cold will not stop": every turn the
 * hero spends below town before winning it back deepens the frost on Bjarnarhaven, told in a
 * line on coming home and in Bjorn's talk at the gate. Talk only, no penalty (owner, 16 Oct:
 * "add town talk that grows colder the longer you're away"); a timer that cost something was
 * removed once already (`oath.ts`).
 */
export const HEARTH_COLD_TURNS_COUNTER = 'cotw_hearth_cold_turns';
/** How many stages the hero has been told of on coming home, so each is told once. */
const HEARTH_COLD_TOLD_COUNTER = 'cotw_hearth_cold_told';
const GUARD_ID = 'npc-guard';

interface ColdStage {
  /** Turns spent below before the stage sets in. */
  turns: number;
  /** Logged once, on the first turn home after it sets in. */
  arrival: string;
  greeting: string;
  dialogText: string;
}

export const HEARTH_COLD_STAGES: ColdStage[] = [
  {
    turns: 3000,
    arrival: 'Bjarnarhaven is colder than you left it. Frost has crept up the longhouse walls, and the well-rope comes up stiff with ice.',
    greeting: 'The well froze to the bottom while you were below. We melt snow for water now.',
    dialogText: 'Hallvard said the cold would not stop without the shard, and it has not. The cellar to the north-east is still the only road to it.',
  },
  {
    turns: 7000,
    arrival: 'The cold has bitten deeper while you were gone. The woodpiles stand half-burned, and smoke rises from only every other roof.',
    greeting: 'We burn the fence-rails now. Olaf hands out firewood by the armful, and not a stick more.',
    dialogText: 'Folk ask me at the gate every morning whether you are coming back with that shard. I tell them yes. Do not make a liar of me.',
  },
  {
    turns: 12000,
    arrival: 'Bjarnarhaven huddles. The old and the small sleep together around the temple fire, and the frost has split the fountain’s stones.',
    greeting: 'You are back. Some of us did not think you would be.',
    dialogText: 'Torvald keeps the temple fire for the children now, and the rest of us take turns at it. Whatever is down there, hero, the cold is winning up here.',
  },
  {
    turns: 20000,
    arrival: 'Snow lies drifted against the doors of Bjarnarhaven, and few are dug out. The village is holding on by its fingernails, waiting for the shard.',
    greeting: 'Every door on the lane is snowed shut but the temple’s and the shops’. We are waiting on you.',
    dialogText: 'We have burned the fences and the boats. Bring the Hearth-Tear home, hero, before there is no hearth left to warm.',
  },
];

const THAW_GREETING = 'The ice let go of the gate-hinges the day you brought the shard home. I can feel my fingers again.';
const THAW_DIALOG = 'The cellar to the north-east still leads into the depths, and whatever shakes the ground now comes from below them. Many go down; few return.';

/** Counts the turns spent below; at home, tells the deepest stage reached and sets Bjorn's talk. */
export const HEARTH_COLD_HOOK: ActionHook = {
  id: 'cotw-hearth-cold',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine, result }) => {
    if (actor !== engine.player) return;
    const ws = engine.worldState;
    const thawed = getFlag(ws, RELIC_RECOVERED_FLAG);
    if (engine.currentFloor !== 0) {
      if (!thawed && (result?.cost ?? 0) > 0) incrementCounter(ws, HEARTH_COLD_TURNS_COUNTER, 1);
      return;
    }

    const bjorn = engine.map.getEntityById(GUARD_ID) as NPC | null;
    const told = getCounter(ws, HEARTH_COLD_TOLD_COUNTER);
    if (thawed) {
      // Only a guard who complained of the cold remarks on its going.
      if (told > 0) bjorn?.setDialogue(THAW_GREETING, THAW_DIALOG);
      return;
    }

    const turns = getCounter(ws, HEARTH_COLD_TURNS_COUNTER);
    const reached = HEARTH_COLD_STAGES.filter((s) => turns >= s.turns).length;
    if (reached === 0) return;
    const stage = HEARTH_COLD_STAGES[reached - 1];
    if (told < reached) {
      incrementCounter(ws, HEARTH_COLD_TOLD_COUNTER, reached - told);
      engine.log(stage.arrival);
    }
    bjorn?.setDialogue(stage.greeting, stage.dialogText);
  },
};
