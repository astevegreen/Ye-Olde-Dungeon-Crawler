import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';
import { getBresenhamLine } from '../magic/targeting';

/** How far a monster sees: its wake-up check and its hunt both use it. */
export const MONSTER_SIGHT_RADIUS = 8;

/** Whether nothing opaque stands between two tiles (the ends themselves don't count). */
export function hasLineOfSight(engine: GameEngine, from: Position, to: Position): boolean {
  const line = getBresenhamLine(from.x, from.y, to.x, to.y);
  for (let i = 1; i < line.length - 1; i++) {
    if (!engine.map.isTransparent(line[i].x, line[i].y)) return false;
  }
  return true;
}

/**
 * Whether a monster knows where `target` is this turn: it stands beside it, or sees it within its
 * sight radius (`sightRadius`) with nothing opaque between them, the target not hidden in an
 * opaque cloud of its own (dense smoke or steam, Q13 "A"). A hunter that doesn't goes to where it
 * last did (`Monster.pursuit`).
 */
export function perceives(engine: GameEngine, watcher: Entity, target: Entity): boolean {
  const sight = sightRadius(engine, watcher);
  const dx = target.x - watcher.x;
  const dy = target.y - watcher.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) return sight >= 1;
  if (!engine.surfaces.isTransparent(target.x, target.y)) return false;
  return Math.hypot(dx, dy) <= sight && hasLineOfSight(engine, watcher.position, target.position);
}

/**
 * How far it sees: MONSTER_SIGHT_RADIUS, cut to the `perceptionRadius` of any status it suffers
 * (the most restrictive wins), the rule the hero's own sight follows: blinded, only beside it.
 */
function sightRadius(engine: GameEngine, watcher: Entity): number {
  let radius = MONSTER_SIGHT_RADIUS;
  for (const effect of watcher.statusManager.getAllActive()) {
    const limit = engine.registries.statusHandlers.get(effect.type)?.perceptionRadius;
    if (limit !== undefined) radius = Math.min(radius, limit);
  }
  return radius;
}
