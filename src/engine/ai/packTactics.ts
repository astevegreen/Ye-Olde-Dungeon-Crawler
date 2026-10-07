import type { Action } from '../actions/action';
import { MovementAction } from '../actions/movement';
import { OpenDoorAction } from '../actions/door';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import type { Position } from '../types';
import { isOpenableDoor, isRevealedTrap } from './pathfinding';

/** How far off a pack monster plans its way to a side of its prey (Chebyshev tiles). */
export const FLANK_RADIUS = 10;
/** What a packmate already beside a side costs, in steps: a pack spreads around its prey. */
const CROWD_PENALTY = 4;

const DIRECTIONS = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

/**
 * A pack monster's step toward a free side of its prey (Q14, "packs surround"): of the free tiles
 * beside the target it can reach without passing beside the target first, the one that costs
 * least in steps plus CROWD_PENALTY for each packmate beside it. One breadth-first search over
 * the square FLANK_RADIUS around the monster (§6), other actors blocking. Null when no side is
 * reachable (it then approaches as any monster).
 */
export function flankAction(engine: GameEngine, monster: Monster, target: Entity): Action | null {
  const { map } = engine;
  const size = 2 * FLANK_RADIUS + 1;
  const ox = monster.x - FLANK_RADIUS;
  const oy = monster.y - FLANK_RADIUS;
  const index = (x: number, y: number) => (y - oy) * size + (x - ox);
  const inBox = (x: number, y: number) => x >= ox && x < ox + size && y >= oy && y < oy + size;
  const open = (x: number, y: number) => {
    const tile = map.getTile(x, y);
    return Boolean(tile && ((tile.walkable ?? tile.passable) || isOpenableDoor(tile)) && !isRevealedTrap(map, x, y));
  };

  const steps = new Int16Array(size * size).fill(-1);
  const parent = new Int32Array(size * size).fill(-1);
  const queue = [index(monster.x, monster.y)];
  steps[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = ox + (cell % size);
    const y = oy + Math.floor(cell / size);
    // A side of the prey is somewhere to stand, not a way through: there it would just attack.
    if (head > 0 && Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= 1) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBox(nx, ny) || !map.inBounds(nx, ny)) continue;
      const next = index(nx, ny);
      if (steps[next] !== -1 || !open(nx, ny) || map.getEntityAt(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && !map.isPassable(x + dx, y) && !map.isPassable(x, y + dy)) continue;
      steps[next] = steps[cell] + 1;
      parent[next] = cell;
      queue.push(next);
    }
  }

  let best: Position | null = null;
  let bestScore = Infinity;
  for (const [dx, dy] of DIRECTIONS) {
    const side = { x: target.x + dx, y: target.y + dy };
    if (!inBox(side.x, side.y)) continue;
    const reach = steps[index(side.x, side.y)];
    if (reach <= 0) continue;
    const score = reach + CROWD_PENALTY * packmatesBeside(engine, monster, side);
    if (score < bestScore) {
      bestScore = score;
      best = side;
    }
  }
  if (!best) return null;

  let cell = index(best.x, best.y);
  while (parent[cell] !== index(monster.x, monster.y)) cell = parent[cell];
  const step = { x: ox + (cell % size), y: oy + Math.floor(cell / size) };
  const tile = map.getTile(step.x, step.y);
  if (tile && isOpenableDoor(tile)) return new OpenDoorAction(monster, step.x, step.y);
  return new MovementAction(monster, step.x - monster.x, step.y - monster.y);
}

/** The monster's allies (its faction) standing beside a tile. */
function packmatesBeside(engine: GameEngine, monster: Monster, tile: Position): number {
  let count = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const other = engine.map.getEntityAt(tile.x + dx, tile.y + dy);
    if (other && other !== monster && other.type === 'monster' && other.faction === monster.faction) count++;
  }
  return count;
}
