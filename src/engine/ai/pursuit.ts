import type { Action } from '../actions/action';
import { MovementAction } from '../actions/movement';
import { OpenDoorAction } from '../actions/door';
import { WaitAction } from '../actions/wait';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import type { Position } from '../types';
import { findPath, isOpenableDoor, isRevealedTrap } from './pathfinding';
import { stepAlongDistanceField } from './distanceField';
import { perceives } from './perception';

/** How many turns a hunter searches around the tile where it lost its target before giving up. */
export const SEARCH_TURNS = 10;
/** How far from that tile a search wanders (Chebyshev tiles). */
const SEARCH_RADIUS = 3;

/** How far a monster plans a path of its own toward a goal. */
const PURSUIT_RADIUS = 10;
/** The tiles a monster's own path search may visit: the square around it, PURSUIT_RADIUS out. */
const PURSUIT_SEARCH_BUDGET = (2 * PURSUIT_RADIUS + 1) ** 2;

/**
 * A monster's step toward a goal: a bounded path search of its own within PURSUIT_RADIUS (it
 * routes around other monsters), else the floor's shared distance field to that goal (one search
 * per goal per turn, shared by every monster headed there, §6). A closed door on the way is
 * opened; a locked one is a wall. Null when there is no way.
 */
export function stepTowardAction(engine: GameEngine, monster: Monster, goal: Position): Action | null {
  const dist = Math.hypot(monster.x - goal.x, monster.y - goal.y);
  const ownPath = dist <= PURSUIT_RADIUS ? findPath(engine.map, monster.position, goal, true, PURSUIT_SEARCH_BUDGET)[0] : undefined;
  const next = ownPath ?? stepAlongDistanceField(engine.map, monster.position, goal, engine.turnCount);
  if (!next) return null;
  const tile = engine.map.getTile(next.x, next.y);
  if (tile && isOpenableDoor(tile)) {
    return new OpenDoorAction(monster, next.x, next.y);
  }
  return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
}

/**
 * Keeps a hostile monster's memory of its target (Q14, "hunters search where they last saw you").
 * Perceiving it (`perceives`) refreshes `Monster.pursuit`; a monster with no memory yet (just woken,
 * struck or alerted: `Monster.alert`) learns where the target is now, once. Returns whether the
 * monster perceives its target this turn.
 */
export function rememberTarget(engine: GameEngine, monster: Monster, target: Entity): boolean {
  const sensed = perceives(engine, monster, target);
  if (sensed || !monster.pursuit) {
    monster.pursuit = { x: target.x, y: target.y, searchTurns: SEARCH_TURNS };
  }
  return sensed;
}

/**
 * The turn of a hunter that doesn't perceive its target: it goes to where it last did, searches
 * around that tile for SEARCH_TURNS turns, then gives up and stands until it sees, is struck or is
 * alerted again. No wind-up: there is nothing to telegraph.
 */
export function huntUnseenAction(engine: GameEngine, monster: Monster): Action {
  const memory = monster.pursuit!;
  if (memory.lost) {
    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(monster);
  }
  monster.intent = { type: 'searching', targetTile: { x: memory.x, y: memory.y }, turnsRemaining: 0 };

  if (!memory.searching) {
    const arrived = Math.max(Math.abs(monster.x - memory.x), Math.abs(monster.y - memory.y)) <= 1;
    const step = arrived ? null : stepTowardAction(engine, monster, memory);
    if (step) return step;
    memory.searching = true; // there, or no way there: search from where it stands
  }

  if (memory.searchTurns <= 0) {
    memory.lost = true;
    monster.intent = { type: 'idle', turnsRemaining: 0 };
    return new WaitAction(monster);
  }
  memory.searchTurns--;
  const step = searchStep(engine, monster, memory);
  return step ? new MovementAction(monster, step.x - monster.x, step.y - monster.y) : new WaitAction(monster);
}

/** A random free neighbouring tile within SEARCH_RADIUS of the search's centre. */
function searchStep(engine: GameEngine, monster: Monster, centre: Position): Position | null {
  const options: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = monster.x + dx;
      const y = monster.y + dy;
      if (Math.max(Math.abs(x - centre.x), Math.abs(y - centre.y)) > SEARCH_RADIUS) continue;
      if (!engine.map.isPassable(x, y) || engine.map.getEntityAt(x, y) || isRevealedTrap(engine.map, x, y)) continue;
      if (dx !== 0 && dy !== 0 && !engine.map.isPassable(monster.x + dx, monster.y) && !engine.map.isPassable(monster.x, monster.y + dy)) continue;
      options.push({ x, y });
    }
  }
  return options.length > 0 ? options[Math.floor(engine.rng() * options.length)] : null;
}
