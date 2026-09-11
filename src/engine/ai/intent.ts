import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { Monster } from '../entities/monster';
import type { GameEngine } from '../engine';
import type { ElementType } from '../magic/elements';
import type { StatusType } from '../status/types';
import type { SurfaceType } from '../surfaces/surfaceGrid';
import { getBresenhamLine } from '../magic/targeting';

export type TelegraphPattern = 'single' | 'line' | 'cone' | 'blast' | 'cross';

export interface TelegraphedAttackDefinition {
  id: string;
  name: string;
  pattern: TelegraphPattern;
  range?: number;
  radius?: number;
  multiplier?: number;
  warningMessage: string;
  element?: ElementType;
  statusOnHit?: { type: StatusType; duration: number; potency?: number };
  spawnSurface?: SurfaceType;
  pushImpulse?: number;
}

/**
 * Calculates the collection of threatened dungeon tiles for an enemy's telegraphed wind-up attack.
 */
export function computeDangerTiles(
  origin: Position,
  target: Position,
  pattern: TelegraphPattern,
  map: GameMap,
  range = 6,
  radius = 1
): Position[] {
  if (!origin || typeof origin.x !== 'number' || typeof origin.y !== 'number' || Number.isNaN(origin.x) || Number.isNaN(origin.y)) return [];
  if (!target || typeof target.x !== 'number' || typeof target.y !== 'number' || Number.isNaN(target.x) || Number.isNaN(target.y)) return [];

  const tiles: Position[] = [];
  const visited = new Set<string>();

  function addTile(x: number, y: number): boolean {
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) return false;
    const k = `${x},${y}`;
    if (visited.has(k)) return false;
    visited.add(k);
    if (!map.inBounds(x, y)) return false;
    tiles.push({ x, y });
    return map.isPassable(x, y);
  }

  switch (pattern) {
    case 'single': {
      addTile(target.x, target.y);
      break;
    }

    case 'blast': {
      // Circle / square radius around target tile (e.g. 3x3 for radius 1)
      const rad = Math.max(1, radius);
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.hypot(dx, dy) <= rad + 0.5) {
            addTile(target.x + dx, target.y + dy);
          }
        }
      }
      break;
    }

    case 'cross': {
      // 4-cardinal cardinal arms from target
      addTile(target.x, target.y);
      const rad = Math.max(1, radius);
      for (let d = 1; d <= rad; d++) {
        addTile(target.x + d, target.y);
        addTile(target.x - d, target.y);
        addTile(target.x, target.y + d);
        addTile(target.x, target.y - d);
      }
      break;
    }

    case 'line': {
      // Directional beam projected from origin through target up to range
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const mag = Math.hypot(dx, dy) || 1;
      const dirX = dx / mag;
      const dirY = dy / mag;

      const endX = Math.round(origin.x + dirX * range);
      const endY = Math.round(origin.y + dirY * range);
      const line = getBresenhamLine(origin.x, origin.y, endX, endY);

      // Skip origin itself
      for (let i = 1; i < line.length; i++) {
        const pt = line[i];
        if (!addTile(pt.x, pt.y)) {
          // Ray stopped by obstacle / wall
          break;
        }
      }
      break;
    }

    case 'cone': {
      // Expanding directional cone towards target
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const baseAngle = Math.atan2(dy, dx);
      const coneHalfAngle = Math.PI / 6; // 30-degree half-width (60-degree total cone)
      const maxDist = Math.max(2, range);

      for (let y = origin.y - maxDist; y <= origin.y + maxDist; y++) {
        for (let x = origin.x - maxDist; x <= origin.x + maxDist; x++) {
          if (x === origin.x && y === origin.y) continue;
          const dist = Math.hypot(x - origin.x, y - origin.y);
          if (dist > maxDist) continue;

          const angle = Math.atan2(y - origin.y, x - origin.x);
          let diff = Math.abs(angle - baseAngle);
          while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);

          if (diff <= coneHalfAngle) {
            addTile(x, y);
          }
        }
      }
      break;
    }
  }

  return tiles;
}

/**
 * Cancels an active enemy wind-up attack (e.g. from stun, paralysis, or positional shove).
 */
export function interruptWindUp(monster: Monster, engine: GameEngine, reason?: string): boolean {
  if (monster.intent?.type === 'windup') {
    const ability = monster.intent.abilityName ?? 'Heavy Attack';
    monster.intent = { type: 'idle', turnsRemaining: 0 };
    const reasonText = reason ? ` (${reason})` : '';
    engine.log(`*** ${monster.name}'s ${ability} is INTERRUPTED${reasonText}! ***`);
    return true;
  }
  return false;
}
