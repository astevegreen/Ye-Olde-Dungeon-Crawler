/** The first step toward the nearest tile a telegraph misses, and how many steps the way takes. */
export interface ExitStep {
  dx: number;
  dy: number;
  steps: number;
}

/**
 * The first step on the shortest way out of a telegraphed blast no single step clears (Gálmr's
 * Rime Shockwave covers a radius-2 disc round the hero). Breadth-first over the eight
 * neighbours, in a fixed order, so equal ways always give the same step. The way may cross
 * danger tiles: the hero only needs to be further out when the blast lands. It never crosses a
 * tile `isOpen` refuses (impassable, a closed door, a creature) or one `avoid` covers (a hazard
 * or a found trap). The goal is the nearest tile that is open, not in danger and not avoided.
 * `maxNodes` bounds the search; null when no such tile is found within it.
 *
 * The bot rebuilds this in the page from its source text (playerBot.ts), so it imports
 * nothing and calls nothing outside itself. `isOpen` answers false off the map.
 */
export function telegraphExit(
  isOpen: (x: number, y: number) => boolean,
  inDanger: (x: number, y: number) => boolean,
  avoid: (x: number, y: number) => boolean,
  from: { x: number; y: number },
  maxNodes: number
): ExitStep | null {
  // Each node: its tile, its first step from `from`, and its depth.
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue: Array<{ x: number; y: number; dx: number; dy: number; steps: number }> = [];
  for (let head = -1; head < queue.length && head < maxNodes; head++) {
    const cur = head < 0 ? { x: from.x, y: from.y, dx: 0, dy: 0, steps: 0 } : queue[head];
    if (head >= 0 && !inDanger(cur.x, cur.y)) return { dx: cur.dx, dy: cur.dy, steps: cur.steps };
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!isOpen(nx, ny) || avoid(nx, ny)) continue;
        queue.push(head < 0 ? { x: nx, y: ny, dx, dy, steps: 1 } : { x: nx, y: ny, dx: cur.dx, dy: cur.dy, steps: cur.steps + 1 });
      }
    }
  }
  return null;
}

/** What the bot knows when it stands where a telegraphed attack will land. */
export interface TelegraphCheck {
  /** A neighbouring tile the attack misses (`safeSteps` in playerBot.ts). */
  safeStep: boolean;
  /** HP below max. */
  hurt: boolean;
  /** A Heal the bot can cast now (`healCast`, so the heal rule's Seiðr limits hold). */
  healCastable: boolean;
  /** A way out found by `telegraphExit`. */
  exit: boolean;
  /** A foe beside the hero. */
  adjacentFoe: boolean;
}

/** What the bot does under a telegraph, and the telemetry tag it counts it under. */
export type TelegraphChoice = 'dodge' | 'heal' | 'exit' | 'melee' | 'wait';

/**
 * The bot's move under a telegraph: one step clear (`dodge`); else, hurt, a Heal; else the first
 * step of the way out; else hit a foe beside it, or wait. Rebuilt in the page from its source
 * text like `telegraphExit`: no imports, no outside calls.
 */
export function telegraphChoice(c: TelegraphCheck): TelegraphChoice {
  if (c.safeStep) return 'dodge';
  if (c.hurt && c.healCastable) return 'heal';
  if (c.exit) return 'exit';
  return c.adjacentFoe ? 'melee' : 'wait';
}
