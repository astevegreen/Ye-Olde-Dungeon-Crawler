import type { GameMap } from '../grid/map';
import type { Position } from '../types';

/**
 * Walking distances to one goal over a whole floor, for awake monsters beyond the pursuit
 * radius. One breadth-first pass serves every such monster that turn, so a far monster's step
 * is a neighbour lookup rather than a path search of its own: per-actor work stays bounded
 * (ARCHITECTURE.md §6) even when an alarm wakes the whole floor. Terrain only: closed doors
 * count as open (monsters open them) and entities are ignored, so a crowd doesn't hide the way.
 */
interface CachedField {
  goalX: number;
  goalY: number;
  turn: number;
  distances: Int32Array;
}

const UNREACHED = -1;
const fields = new WeakMap<GameMap, CachedField>();

const DIRECTIONS = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

function walkable(map: GameMap, x: number, y: number): boolean {
  const tile = map.getTile(x, y);
  if (!tile) return false;
  return Boolean((tile.walkable ?? tile.passable) || tile.isClosedDoor || tile.type === 'door_closed');
}

/** Diagonal moves may not squeeze between two blocked orthogonals (as `findPath`). */
function diagonalOpen(map: GameMap, x: number, y: number, dx: number, dy: number): boolean {
  if (dx === 0 || dy === 0) return true;
  const horiz = map.getTile(x + dx, y);
  const vert = map.getTile(x, y + dy);
  return Boolean((horiz && (horiz.walkable ?? horiz.passable)) || (vert && (vert.walkable ?? vert.passable)));
}

function fieldFor(map: GameMap, goal: Position, turn: number): Int32Array {
  const cached = fields.get(map);
  if (cached && cached.turn === turn && cached.goalX === goal.x && cached.goalY === goal.y) {
    return cached.distances;
  }
  const { width, height } = map;
  const distances = new Int32Array(width * height).fill(UNREACHED);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  distances[goal.y * width + goal.x] = 0;
  queue[tail++] = goal.y * width + goal.x;
  while (head < tail) {
    const cell = queue[head++];
    const x = cell % width;
    const y = (cell - x) / width;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const next = ny * width + nx;
      if (distances[next] !== UNREACHED || !walkable(map, nx, ny) || !diagonalOpen(map, x, y, dx, dy)) continue;
      distances[next] = distances[cell] + 1;
      queue[tail++] = next;
    }
  }
  fields.set(map, { goalX: goal.x, goalY: goal.y, turn, distances });
  return distances;
}

/**
 * The free neighbouring tile that brings `from` closest to `goal` by walking distance, or null
 * when no free neighbour is closer (blocked in, or no way there).
 */
export function stepAlongDistanceField(map: GameMap, from: Position, goal: Position, turn: number): Position | null {
  const distances = fieldFor(map, goal, turn);
  const here = distances[from.y * map.width + from.x];
  let best: Position | null = null;
  let bestDistance = here === UNREACHED ? Number.MAX_SAFE_INTEGER : here;
  for (const [dx, dy] of DIRECTIONS) {
    const nx = from.x + dx;
    const ny = from.y + dy;
    if (!map.inBounds(nx, ny)) continue;
    const d = distances[ny * map.width + nx];
    if (d === UNREACHED || d >= bestDistance) continue;
    if (!diagonalOpen(map, from.x, from.y, dx, dy)) continue;
    if (map.getEntityAt(nx, ny) && !(nx === goal.x && ny === goal.y)) continue;
    best = { x: nx, y: ny };
    bestDistance = d;
  }
  return best;
}
