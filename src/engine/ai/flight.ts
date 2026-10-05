import type { Action } from '../actions/action';
import { MovementAction } from '../actions/movement';
import { CloseDoorAction, OpenDoorAction } from '../actions/door';
import type { GameEngine } from '../engine';
import type { Monster } from '../entities/monster';
import type { Position } from '../types';
import { findFleeStep, isOpenableDoor } from './pathfinding';

const chebyshev = (a: Position, b: Position) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * A fleeing monster's move away from `threat` (Q14, "monsters use doors"): it shuts an open door
 * it has just put between itself and the threat, opens a closed one in its way, or steps to the
 * neighbouring tile farthest off. Null when it is cornered.
 */
export function fleeAction(engine: GameEngine, monster: Monster, threat: Position): Action | null {
  const door = doorToShut(engine, monster, threat);
  if (door) return new CloseDoorAction(monster, door.x, door.y);

  const step = findFleeStep(engine.map, monster.position, threat, true);
  if (!step) return null;
  const tile = engine.map.getTile(step.x, step.y);
  if (tile && isOpenableDoor(tile)) return new OpenDoorAction(monster, step.x, step.y);
  return new MovementAction(monster, step.x - monster.x, step.y - monster.y);
}

/**
 * An open, empty door beside the monster that stands between it and the threat. Not when the
 * threat is beside the door: it would only open it again, and the monster had better run.
 */
function doorToShut(engine: GameEngine, monster: Monster, threat: Position): Position | null {
  const away = Math.hypot(monster.x - threat.x, monster.y - threat.y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const door = { x: monster.x + dx, y: monster.y + dy };
      const tile = engine.map.getTile(door.x, door.y);
      if (!tile || !(tile.isOpenDoor || tile.type === 'door_open')) continue;
      if (engine.map.getEntityAt(door.x, door.y) || chebyshev(door, threat) <= 1) continue;
      if (Math.hypot(door.x - threat.x, door.y - threat.y) < away) return door;
    }
  }
  return null;
}
