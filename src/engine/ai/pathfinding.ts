import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { TileDefinition } from '../types';

interface PathNode {
  x: number;
  y: number;
  parent: PathNode | null;
}

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

/** A closed door a monster can open: any but a locked one. */
export function isOpenableDoor(tile: TileDefinition): boolean {
  return Boolean((tile.isClosedDoor || tile.type === 'door_closed') && !tile.locked);
}

/** Breadth-first path; gives up (returns []) after `maxVisited` tiles, so a blocked search stays bounded. */
export function findPath(
  map: GameMap,
  start: Position,
  target: Position,
  canOpenDoors = true,
  maxVisited = Number.POSITIVE_INFINITY
): Position[] {
  if (start.x === target.x && start.y === target.y) {
    return [];
  }

  const queue: PathNode[] = [{ x: start.x, y: start.y, parent: null }];
  const visited = new Set<number>();
  visited.add(start.y * map.width + start.x);

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];

    if (current.x === target.x && current.y === target.y) {
      // Reconstruct path (excluding start)
      const path: Position[] = [];
      let curr: PathNode | null = current;
      while (curr && curr.parent) {
        path.unshift({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path;
    }

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (!map.inBounds(nx, ny)) continue;
      const key = ny * map.width + nx;
      if (visited.has(key)) continue;

      // Allow reaching the target even if target tile has an entity (the target itself)
      const isTarget = nx === target.x && ny === target.y;

      const tile = map.getTile(nx, ny);
      if (!tile) continue;

      const isPassable = (tile.walkable ?? tile.passable) || (canOpenDoors && isOpenableDoor(tile));
      if (!isPassable) continue;

      // Diagonal wall clipping prevention
      if (dir.dx !== 0 && dir.dy !== 0) {
        const horiz = map.getTile(current.x + dir.dx, current.y);
        const vert = map.getTile(current.x, current.y + dir.dy);
        const horizPassable = horiz ? (horiz.walkable ?? horiz.passable) : false;
        const vertPassable = vert ? (vert.walkable ?? vert.passable) : false;
        if (!horizPassable && !vertPassable) {
          continue;
        }
      }

      // If another non-target entity is on this tile, cannot step through
      if (!isTarget && map.getEntityAt(nx, ny)) {
        continue;
      }

      visited.add(key);
      if (visited.size > maxVisited) return [];
      queue.push({ x: nx, y: ny, parent: current });
    }
  }

  return [];
}

/**
 * The neighbouring tile that takes `monsterPos` farthest from `threatPos` (straight-line), if any
 * is farther than where it stands. With `opensDoors`, a closed door it can open counts as a step.
 */
export function findFleeStep(
  map: GameMap,
  monsterPos: Position,
  threatPos: Position,
  opensDoors = false
): Position | null {
  const currentDist = Math.hypot(monsterPos.x - threatPos.x, monsterPos.y - threatPos.y);
  let bestStep: Position | null = null;
  let bestDist = currentDist;

  for (const dir of DIRECTIONS) {
    const nx = monsterPos.x + dir.dx;
    const ny = monsterPos.y + dir.dy;

    if (!map.inBounds(nx, ny)) continue;

    const tile = map.getTile(nx, ny);
    if (!tile || !((tile.walkable ?? tile.passable) || (opensDoors && isOpenableDoor(tile)))) continue;
    if (map.getEntityAt(nx, ny)) continue;

    // Prevent corner clipping
    if (dir.dx !== 0 && dir.dy !== 0) {
      const horiz = map.getTile(monsterPos.x + dir.dx, monsterPos.y);
      const vert = map.getTile(monsterPos.x, monsterPos.y + dir.dy);
      const horizPassable = horiz ? (horiz.walkable ?? horiz.passable) : false;
      const vertPassable = vert ? (vert.walkable ?? vert.passable) : false;
      if (!horizPassable && !vertPassable) {
        continue;
      }
    }

    const dist = Math.hypot(nx - threatPos.x, ny - threatPos.y);
    if (dist > bestDist) {
      bestDist = dist;
      bestStep = { x: nx, y: ny };
    }
  }

  return bestStep;
}
