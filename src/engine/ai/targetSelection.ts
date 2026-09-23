import type { GameEngine } from '../engine';
import type { Actor } from '../entities/actor';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';

/**
 * Monster AI Targeting Generalization (docs/architecture/content-companions.md Phase 2).
 *
 * Resolves the entity a monster's AI should engage this turn. Defaults to
 * `engine.player` — behaviorally identical to the engine's original hardcoded
 * behavior — unless the monster opts into `targetingMode: 'nearest_hostile'`
 * (`MonsterDefinition`/`Monster`). This is what makes a companion capable of
 * drawing aggro: only monster definitions that explicitly opt in will ever
 * consider engaging anything other than the player, so no shipped monster's
 * difficulty or pacing changes unless its content author chooses this.
 */
const DEFAULT_TARGET_SEARCH_RADIUS = 12;

export function selectAttackTarget(
  engine: GameEngine,
  actor: Actor,
  maxRange: number = DEFAULT_TARGET_SEARCH_RADIUS
): Entity {
  const mode = actor instanceof Monster ? actor.targetingMode : 'player';
  if (mode === 'nearest_hostile') {
    const nearest = findNearestHostileActor(engine, actor, maxRange);
    if (nearest) return nearest;
  }
  return engine.player;
}

/** Bounded (§6-style) nearest-hostile query — no unbounded map-wide scan. */
function findNearestHostileActor(engine: GameEngine, actor: Actor, maxRange: number): Entity | null {
  const minX = Math.max(0, Math.floor(actor.x - maxRange));
  const maxX = Math.min(engine.map.width - 1, Math.ceil(actor.x + maxRange));
  const minY = Math.max(0, Math.floor(actor.y - maxRange));
  const maxY = Math.min(engine.map.height - 1, Math.ceil(actor.y + maxRange));
  const maxRangeSq = maxRange * maxRange;

  let best: Entity | null = null;
  let bestDistSq = Infinity;
  const seenIds = new Set<string>();

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      for (const entity of engine.map.getEntitiesAt(x, y)) {
        if (seenIds.has(entity.id) || entity === actor || !entity.isAlive()) continue;
        seenIds.add(entity.id);
        if (!actor.isHostileTo(entity)) continue;
        const dx = entity.x - actor.x;
        const dy = entity.y - actor.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= maxRangeSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          best = entity;
        }
      }
    }
  }

  return best;
}
