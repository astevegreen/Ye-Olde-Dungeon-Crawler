import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import { getBresenhamLine } from '../magic/targeting';

export type Coord = Position;

/**
 * Calculates all grid coordinates within a directional cone wedge emanating from `origin`
 * toward `target` across an angle of `arcDegrees` up to `maxRadius`.
 *
 * Respects line-of-sight wall occlusions: obstacles cast shadows, preventing tiles
 * behind solid walls from being included in the cone.
 *
 * @param origin Source position of the cone.
 * @param target Directional anchor position.
 * @param arcDegrees Angle span of the cone in degrees (e.g. 45, 90).
 * @param maxRadius Maximum distance from origin.
 * @param map Game map for bounds and transparency / passability queries.
 * @returns Array of valid coordinates within the cone, sorted by distance from origin.
 */
export function getConeCoordinates(
  origin: Coord,
  target: Coord,
  arcDegrees: number,
  maxRadius: number,
  map: GameMap
): Coord[] {
  if (maxRadius <= 0) {
    return [{ x: origin.x, y: origin.y }];
  }

  // If target is origin, cone defaults to origin tile
  if (origin.x === target.x && origin.y === target.y) {
    return [{ x: origin.x, y: origin.y }];
  }

  const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
  const halfArc = ((arcDegrees / 2) * Math.PI) / 180;
  // Discrete grid tolerance for angular comparisons
  const angularTolerance = 0.08;

  const results: Array<{ coord: Coord; distSq: number }> = [];
  const visited = new Set<string>();

  // Helper to check if a tile blocks line of sight
  const isOpaque = (x: number, y: number): boolean => {
    if (!map.inBounds(x, y)) return true;
    return !map.isTransparent(x, y);
  };

  const intRadius = Math.ceil(maxRadius);

  for (let dy = -intRadius; dy <= intRadius; dy++) {
    for (let dx = -intRadius; dx <= intRadius; dx++) {
      if (dx === 0 && dy === 0) continue;

      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius + 0.35) continue;

      const wx = origin.x + dx;
      const wy = origin.y + dy;

      if (!map.inBounds(wx, wy)) continue;

      // Calculate angular delta between candidate vector and central ray
      const angle = Math.atan2(dy, dx);
      let diff = Math.abs(angle - baseAngle);
      while (diff > Math.PI) {
        diff = Math.abs(diff - 2 * Math.PI);
      }

      if (diff > halfArc + angularTolerance) {
        continue;
      }

      // Check occlusion along line of sight from origin
      const line = getBresenhamLine(origin.x, origin.y, wx, wy);
      let occluded = false;

      // Inspect intermediate points strictly between origin and (wx, wy)
      for (let i = 1; i < line.length - 1; i++) {
        const pt = line[i];
        if (isOpaque(pt.x, pt.y)) {
          occluded = true;
          break;
        }
      }

      if (occluded) continue;

      const key = `${wx},${wy}`;
      if (!visited.has(key)) {
        visited.add(key);
        results.push({ coord: { x: wx, y: wy }, distSq: dx * dx + dy * dy });
      }
    }
  }

  // Sort by ascending Euclidean distance
  results.sort((a, b) => a.distSq - b.distSq);
  return results.map((r) => r.coord);
}
