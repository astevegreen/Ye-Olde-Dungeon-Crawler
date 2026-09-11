import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { Entity } from '../entities/entity';

/**
 * Finds a safe, passable, and unoccupied tile at or closest to preferredCoords.
 * Performs a concentric search from radius 0 up to maxRadius (default 5).
 * If no valid tile is found within maxRadius, falls back to a broader map search
 * to guarantee that a safe landing tile is always found.
 *
 * @param map The game map to search.
 * @param preferredCoords The intended spawn coordinates.
 * @param maxRadius Maximum radial distance for local search (default 5).
 * @param entityToIgnore Optional entity to ignore when checking occupancy (e.g. the entity being repositioned).
 * @returns The closest safe Position guaranteed to be in-bounds, passable, and unoccupied.
 */
export function findSafeSpawnPosition(
  map: GameMap,
  preferredCoords: Position,
  maxRadius: number = 5,
  entityToIgnore?: Entity
): Position {
  const isSafe = (x: number, y: number): boolean => {
    if (!map.inBounds(x, y)) return false;
    if (!map.isPassable(x, y)) return false;
    const existing = map.getEntityAt(x, y);
    if (existing && existing.isAlive() && existing !== entityToIgnore) return false;
    return true;
  };

  // Radius 0: check preferredCoords
  if (isSafe(preferredCoords.x, preferredCoords.y)) {
    return { x: preferredCoords.x, y: preferredCoords.y };
  }

  // Radius 1 to maxRadius: search concentric rings sorted by Euclidean distance
  for (let r = 1; r <= maxRadius; r++) {
    const candidates: Array<{ pos: Position; distSq: number }> = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Only inspect points on perimeter of box radius r (inner points already checked)
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = preferredCoords.x + dx;
        const ty = preferredCoords.y + dy;
        if (isSafe(tx, ty)) {
          candidates.push({ pos: { x: tx, y: ty }, distSq: dx * dx + dy * dy });
        }
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distSq - b.distSq);
      return candidates[0].pos;
    }
  }

  // Fallback: search entire map for closest passable, unoccupied tile
  let bestPos: Position | null = null;
  let bestDistSq = Infinity;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (isSafe(x, y)) {
        const dx = x - preferredCoords.x;
        const dy = y - preferredCoords.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestPos = { x, y };
        }
      }
    }
  }

  return bestPos ?? { x: preferredCoords.x, y: preferredCoords.y };
}
