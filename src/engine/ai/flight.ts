import type { Action } from '../actions/action';
import { MovementAction } from '../actions/movement';
import { CloseDoorAction, OpenDoorAction } from '../actions/door';
import { WaitAction } from '../actions/wait';
import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import type { Position } from '../types';
import { findFleeStep, findPath, isOpenableDoor } from './pathfinding';

/** How far a monster's cry for help carries (Euclidean tiles). */
const CALL_RADIUS = 8;
/** How far off an ally a fleeing monster runs to may stand. */
const RALLY_RADIUS = 10;
/** The tiles its path search to that ally may visit. */
const RALLY_SEARCH_BUDGET = (2 * RALLY_RADIUS + 1) ** 2;

const chebyshev = (a: Position, b: Position) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A fleeing monster's move away from `threat` (Q14: cowards flee to allies; monsters use doors).
 * It shuts an open door it has just put between itself and the threat; runs to the nearest ally
 * on its own side of the threat, and stands with it once there; else opens a closed door in its
 * way or steps to the neighbouring tile farthest off. Null when it is cornered, or stands with an
 * ally with the threat beside it: it fights.
 */
export function fleeAction(engine: GameEngine, monster: Monster, threat: Position): Action | null {
  const door = doorToShut(engine, monster, threat);
  if (door) return new CloseDoorAction(monster, door.x, door.y);

  const rally = rallyAction(engine, monster, threat);
  if (rally !== undefined) return rally;

  const step = findFleeStep(engine.map, monster.position, threat, true);
  return step ? stepAction(engine, monster, step) : null;
}

/**
 * A monster's cry as it breaks and runs (Q14: cowards call for help). Every ally within
 * CALL_RADIUS that isn't running itself is alerted (`Monster.alert`): it wakes, or stops
 * searching, knowing where the hero is. Logged when the hero sees the caller, or hears an
 * answer. A shout, not a wind-up: there is nothing to dodge.
 */
export function callForHelp(engine: GameEngine, monster: Monster): void {
  let answered = 0;
  for (const ally of alliesWithin(engine, monster, CALL_RADIUS)) {
    if (ally.aiState === 'fleeing') continue;
    if (ally.aiState === 'sleeping' || ally.pursuit?.lost) answered++;
    ally.alert();
  }
  if (engine.fov?.isVisible(monster.x, monster.y)) {
    engine.log(`${monster.name} breaks and cries out for help!`);
  } else if (answered > 0) {
    engine.log('Somewhere near, a cry for help goes up.');
  }
}

/**
 * Its move toward the nearest ally that stands nearer it than the threat (never across the
 * threat): a step, a door to open, or, beside the ally, a wait (null when the threat is beside it
 * too). Undefined when no ally is there to run to, or the way to it passes beside the threat.
 */
function rallyAction(engine: GameEngine, monster: Monster, threat: Position): Action | null | undefined {
  const ally = alliesWithin(engine, monster, RALLY_RADIUS)
    .filter((a) => a.aiState !== 'fleeing' && distance(a, monster) < distance(a, threat))
    .sort((a, b) => distance(a, monster) - distance(b, monster))[0];
  if (!ally) return undefined;
  if (chebyshev(monster, ally) <= 1) {
    return chebyshev(monster, threat) <= 1 ? null : new WaitAction(monster);
  }
  const step = findPath(engine.map, monster.position, ally.position, true, RALLY_SEARCH_BUDGET)[0];
  if (!step || chebyshev(step, threat) <= 1) return undefined;
  return stepAction(engine, monster, step);
}

function stepAction(engine: GameEngine, monster: Monster, step: Position): Action {
  const tile = engine.map.getTile(step.x, step.y);
  if (tile && isOpenableDoor(tile)) return new OpenDoorAction(monster, step.x, step.y);
  return new MovementAction(monster, step.x - monster.x, step.y - monster.y);
}

/** The living monsters of its own faction within `radius` (a bounded box scan, §6). */
function alliesWithin(engine: GameEngine, monster: Monster, radius: number): Monster[] {
  const allies: Monster[] = [];
  const { map } = engine;
  for (let y = Math.max(0, monster.y - radius); y <= Math.min(map.height - 1, monster.y + radius); y++) {
    for (let x = Math.max(0, monster.x - radius); x <= Math.min(map.width - 1, monster.x + radius); x++) {
      for (const entity of map.getEntitiesAt(x, y)) {
        if (!(entity instanceof Monster) || entity === monster || !entity.isAlive()) continue;
        if (entity.faction !== monster.faction || distance(entity, monster) > radius) continue;
        allies.push(entity);
      }
    }
  }
  return allies;
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
