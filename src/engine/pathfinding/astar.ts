import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { FovManager } from '../fov/fov-manager';

export interface AStarOptions {
  canOpenDoors?: boolean;
  avoidTraps?: boolean;
  requireExplored?: boolean;
  maxSteps?: number;
}

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

const D2 = Math.SQRT2;

const CARDINALS = [
  { dx: 0, dy: -1, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: -1, cost: D2 },
  { dx: 1, dy: -1, cost: D2 },
  { dx: -1, dy: 1, cost: D2 },
  { dx: 1, dy: 1, cost: D2 },
];

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return (dx + dy) + (D2 - 2) * Math.min(dx, dy);
}

/**
 * Computes an optimal 8-directional path using A* pathfinding.
 * Strictly respects player exploration knowledge (no routing through unexplored fog)
 * and avoids known, revealed active hazards.
 */
export function findAStarPath(
  map: GameMap,
  fov: FovManager,
  start: Position,
  target: Position,
  options?: AStarOptions
): Position[] {
  if (start.x === target.x && start.y === target.y) {
    return [];
  }

  const canOpenDoors = options?.canOpenDoors ?? true;
  const avoidTraps = options?.avoidTraps ?? true;
  const requireExplored = options?.requireExplored ?? true;
  const maxSteps = options?.maxSteps ?? 1500;

  // If target tile is unexplored and requireExplored is true, cannot route to it
  if (requireExplored && !fov.isExplored(target.x, target.y)) {
    return [];
  }

  // Target tile itself must be in bounds
  if (!map.inBounds(target.x, target.y)) {
    return [];
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  const openSetKeys = new Map<string, Node>();

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start.x, start.y, target.x, target.y),
    f: heuristic(start.x, start.y, target.x, target.y),
    parent: null,
  };

  openSet.push(startNode);
  openSetKeys.set(`${start.x},${start.y}`, startNode);

  let steps = 0;

  while (openSet.length > 0 && steps < maxSteps) {
    steps++;

    // Find node with lowest f cost
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) {
        lowestIdx = i;
      }
    }

    const current = openSet.splice(lowestIdx, 1)[0];
    const currentKey = `${current.x},${current.y}`;
    openSetKeys.delete(currentKey);
    closedSet.add(currentKey);

    // Goal reached
    if (current.x === target.x && current.y === target.y) {
      const path: Position[] = [];
      let curr: Node | null = current;
      while (curr && curr.parent) {
        path.unshift({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path;
    }

    // Evaluate neighbors
    for (const dir of CARDINALS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const neighborKey = `${nx},${ny}`;

      if (closedSet.has(neighborKey)) continue;
      if (!map.inBounds(nx, ny)) continue;

      // Fog of War: cannot step through unexplored tiles
      if (requireExplored && !fov.isExplored(nx, ny)) {
        continue;
      }

      const isTarget = nx === target.x && ny === target.y;
      const tile = map.getTile(nx, ny);
      if (!tile) continue;

      // Passability check: passable or openable closed door
      const isOpenableDoor = canOpenDoors && (tile.isClosedDoor || tile.type === 'door_closed') && !tile.locked;
      if (!tile.passable && !isOpenableDoor) {
        continue;
      }

      // Diagonal wall clipping / corner-cutting prevention
      if (dir.dx !== 0 && dir.dy !== 0) {
        const horizTile = map.getTile(current.x + dir.dx, current.y);
        const vertTile = map.getTile(current.x, current.y + dir.dy);
        const horizPassable =
          (horizTile?.walkable ?? horizTile?.passable) ||
          (canOpenDoors && (horizTile?.isClosedDoor || horizTile?.type === 'door_closed') && !horizTile.locked);
        const vertPassable =
          (vertTile?.walkable ?? vertTile?.passable) ||
          (canOpenDoors && (vertTile?.isClosedDoor || vertTile?.type === 'door_closed') && !vertTile.locked);
        if (!horizPassable && !vertPassable) {
          continue;
        }
      }

      // Hazard avoidance: Avoid revealed active traps unless it is the target
      let trapCost = 0;
      if (avoidTraps) {
        const trap = map.getTrapAt(nx, ny);
        if (trap && trap.revealed && !trap.disarmed) {
          if (!isTarget) {
            continue; // Treat revealed traps as impassable barriers
          } else {
            trapCost = 50;
          }
        }
      }

      // Blocked by non-target entity
      if (!isTarget && map.getEntityAt(nx, ny)) {
        continue;
      }

      let stepCost = dir.cost;
      if (isOpenableDoor) {
        stepCost += 1.5; // Additional cost to open a door
      }
      stepCost += trapCost;

      const tentativeG = current.g + stepCost;
      const existingNode = openSetKeys.get(neighborKey);

      if (!existingNode) {
        const h = heuristic(nx, ny, target.x, target.y);
        const neighborNode: Node = {
          x: nx,
          y: ny,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        };
        openSet.push(neighborNode);
        openSetKeys.set(neighborKey, neighborNode);
      } else if (tentativeG < existingNode.g) {
        existingNode.g = tentativeG;
        existingNode.f = tentativeG + existingNode.h;
        existingNode.parent = current;
      }
    }
  }

  return [];
}
