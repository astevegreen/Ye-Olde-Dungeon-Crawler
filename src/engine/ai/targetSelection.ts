import type { GameEngine } from '../engine';
import type { Actor } from '../entities/actor';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { perceives } from './perception';

/**
 * Monster AI Targeting Generalization (docs/architecture/content-companions.md Phase 2).
 *
 * Resolves the entity a monster's AI should engage this turn: the nearest of the hero's side it
 * perceives (the companion, a friendly summon, a raised foe), the hero on a tie or when it
 * perceives none of them, so with no allies on the floor this is the hero as it always was. A
 * `decoy` it perceives comes before all of them. A monster with `targetingMode:
 * 'nearest_hostile'` (`MonsterDefinition`/`Monster`) needs no sight: it takes the nearest foe
 * within `maxRange` by distance alone.
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
  if (actor.faction !== 'hostile') return engine.player;
  return nearestSeenOfHeroSide(engine, actor);
}

/** The decoy, else the nearest of the hero's side, that `actor` perceives; else the hero. */
function nearestSeenOfHeroSide(engine: GameEngine, actor: Actor): Entity {
  const hero = engine.player;
  let best: Entity = hero;
  let bestDist = chebyshev(actor, hero);
  let bestIsDecoy = false;
  for (const entity of engine.map.getAllEntities()) {
    if (entity === hero || entity.faction !== 'player' || !entity.isAlive()) continue;
    const isDecoy = entity.statusManager.hasStatus('decoy');
    if (bestIsDecoy && !isDecoy) continue;
    const dist = chebyshev(actor, entity);
    if (isDecoy === bestIsDecoy && dist >= bestDist) continue;
    if (!perceives(engine, actor, entity)) continue;
    best = entity;
    bestDist = dist;
    bestIsDecoy = isDecoy;
  }
  return best;
}

function chebyshev(a: Entity, b: Entity): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Bounded (§6-style) nearest-hostile query — no unbounded map-wide scan. */
export function findNearestHostileActor(engine: GameEngine, actor: Actor, maxRange: number): Entity | null {
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
        // A pacified foe is left be: a blow would wake it (statusHandlers.ts).
        if (!actor.isHostileTo(entity) || entity.statusManager.hasStatus('pacified')) continue;
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
