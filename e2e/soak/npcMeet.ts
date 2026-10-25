/** An NPC on the floor, as the bot reads it from the map. */
export interface FloorNpc {
  id: string;
  x: number;
  y: number;
  choiceId?: string;
}

/** A meeting, for summary.json: the floor, and the option taken, `left` (Escape), or
 *  `unanswered` when the bump opened no choice. */
export interface NpcMet {
  floor: number;
  option: string;
}

/**
 * The dungeon NPC the bot walks to and bumps (Act II's hub NPCs; today Ivalda on floor 13):
 * the first, in the order given, that has a choice (`choiceId`), stands on an explored tile
 * and has not been met this run. Nothing on the town floor (0), whose NPCs keep their own
 * handling, and nothing for an NPC with no choice (the floor-22 hostages): those stay pathed
 * around. An NPC's choice never resolves by itself, so `met` is what stops a second bump.
 *
 * The bot rebuilds this in the page from its source text (playerBot.ts), so it imports
 * nothing and calls nothing outside itself.
 */
export function npcToMeet(
  floor: number,
  npcs: FloorNpc[],
  isExplored: (x: number, y: number) => boolean,
  met: string[]
): FloorNpc | null {
  if (floor <= 0) return null;
  for (const npc of npcs) {
    if (npc.choiceId && isExplored(npc.x, npc.y) && !met.includes(npc.id)) return npc;
  }
  return null;
}

/**
 * Whether a step toward the NPC is the bump that opens its choice. A bump never moves the
 * hero (movement.ts), so only the step whose target is the NPC's own tile meets it; every
 * step of the walk toward it is a plain move. Rebuilt in the page from its source text.
 */
export function isNpcBump(step: { x: number; y: number }, npc: { x: number; y: number }): boolean {
  return step.x === npc.x && step.y === npc.y;
}

/** The key the bot presses on a met NPC's open choice, and the answer it records. */
export interface NpcChoiceKey {
  key: 'Enter' | 'Escape' | 'ArrowDown';
  /** The option id taken (Enter), or `left` (Escape); none while it only highlights. */
  option?: string;
}

/**
 * How the bot answers a dungeon NPC's choice: Enter on the highlighted option, recording its
 * id; Escape when no option is open to the hero (Ivalda's both need Iron Clans standing),
 * recording `left`, since the choice never resolves by itself; else ArrowDown, which
 * highlights the first open option (the modal skips the closed ones). `focusedOption` is the
 * highlighted option's id, or null. Rebuilt in the page from its source text.
 */
export function npcChoiceKey(focusedOption: string | null, anyOpen: boolean): NpcChoiceKey {
  if (focusedOption) return { key: 'Enter', option: focusedOption };
  if (!anyOpen) return { key: 'Escape', option: 'left' };
  return { key: 'ArrowDown' };
}

/** One decision's part in an NPC meeting: the bump, or a key pressed on its choice. */
export interface NpcDecision {
  npcBump?: { id: string };
  npcKey?: { id: string; option?: string };
}

/** The bot's NPC bookkeeping for a run. */
export interface NpcMeetState {
  npcsMet: Record<string, NpcMet>;
  /** The NPC whose choice the last bump opened, until that choice closes. */
  npcChoice: { id: string } | null;
}

/**
 * Records one decision. The bump marks the NPC met (`unanswered` until its choice is
 * answered), so `npcToMeet` never picks it again; a key pressed on its choice keeps the
 * choice tracked and records the answer, the last one pressed being the one that took; any
 * other decision means the choice has closed.
 */
export function recordNpcDecision(state: NpcMeetState, floor: number, d: NpcDecision): void {
  if (d.npcBump) {
    state.npcsMet[d.npcBump.id] = { floor, option: 'unanswered' };
    state.npcChoice = { id: d.npcBump.id };
  } else if (d.npcKey) {
    const met = state.npcsMet[d.npcKey.id];
    if (met && d.npcKey.option) met.option = d.npcKey.option;
  } else {
    state.npcChoice = null;
  }
}
