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
