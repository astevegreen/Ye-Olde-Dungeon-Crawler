import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';

/**
 * Tag-Filtered Radial Auras (ARCHITECTURE.md §9, P-25).
 *
 * The generic, reusable piece the engine owns: a bounded-radius query for living
 * entities matching any of `tags`, evaluated via the existing `Entity.hasTag()`
 * (which already also matches faction and entity type — see entity.ts). Content
 * decides what to do with the matches: `HookDispatcher`'s `radialAuraFilter`
 * primitive applies an arbitrary `ActionPrimitive` to each; `DrinkPotionAction`'s
 * `radial_status` consumable effect applies a status effect to each.
 *
 * Iteration is bounded to the query's own bounding box via `GameMap.getEntitiesAt`
 * (the same per-tile bucket lookup `entityBuckets` backs), consistent with §6's
 * scoping principle — no unbounded map-wide scans.
 */
export function findTaggedEntitiesInRadius(
  engine: GameEngine,
  center: Position,
  radius: number,
  tags: readonly string[]
): Entity[] {
  if (radius <= 0 || tags.length === 0) return [];

  const minX = Math.max(0, Math.floor(center.x - radius));
  const maxX = Math.min(engine.map.width - 1, Math.ceil(center.x + radius));
  const minY = Math.max(0, Math.floor(center.y - radius));
  const maxY = Math.min(engine.map.height - 1, Math.ceil(center.y + radius));
  const radiusSq = radius * radius;

  const matches: Entity[] = [];
  const seenIds = new Set<string>();

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > radiusSq) continue;

      for (const entity of engine.map.getEntitiesAt(x, y)) {
        if (seenIds.has(entity.id) || !entity.isAlive()) continue;
        if (tags.some((tag) => entity.hasTag(tag))) {
          matches.push(entity);
          seenIds.add(entity.id);
        }
      }
    }
  }

  return matches;
}
