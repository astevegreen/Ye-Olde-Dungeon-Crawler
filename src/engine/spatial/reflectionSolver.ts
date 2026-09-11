import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import { isTileSolidToProjectile } from '../magic/targeting';

type Coord = Position;

/**
 * Calculates the specular ray trajectory for a projectile with bouncing reflections.
 *
 * Upon striking an impassable or solid tile, calculates the surface normal vector n
 * and reflects the velocity vector: v' = v - 2(v · n)n.
 * Bouncing continues until `maxBounces` is exhausted, an in-bounds living actor is struck,
 * or the ray leaves the map boundaries.
 *
 * @param origin Starting grid position.
 * @param velocity Initial velocity vector indicating direction.
 * @param maxBounces Maximum number of surface reflections before stopping.
 * @param map Game map for collision, bounds, and actor detection.
 * @returns Array of unique, sequential grid coordinates traversed by the ray.
 */
export function getReflectedRayTrajectory(
  origin: Coord,
  velocity: Coord,
  maxBounces: number,
  map: GameMap
): Coord[] {
  const trajectory: Coord[] = [{ x: origin.x, y: origin.y }];

  const vLen = Math.hypot(velocity.x, velocity.y);
  if (vLen === 0) {
    return trajectory;
  }

  let vx = velocity.x / vLen;
  let vy = velocity.y / vLen;

  let posX = origin.x + 0.5;
  let posY = origin.y + 0.5;

  let currentTileX = origin.x;
  let currentTileY = origin.y;

  let bounces = 0;
  const stepSize = 0.05; // Fine-grained ray steps to detect exact face impacts
  const maxDistance = 150; // Safety guard against infinite propagation
  let totalDistance = 0;

  const isSolid = (x: number, y: number): boolean => {
    if (!map.inBounds(x, y)) return true;
    return isTileSolidToProjectile(map, x, y);
  };

  while (totalDistance < maxDistance) {
    totalDistance += stepSize;
    const nextPosX = posX + vx * stepSize;
    const nextPosY = posY + vy * stepSize;

    const nextTileX = Math.floor(nextPosX);
    const nextTileY = Math.floor(nextPosY);

    // If step entered a new grid tile
    if (nextTileX !== currentTileX || nextTileY !== currentTileY) {
      // Check collision with walls or out of bounds
      if (isSolid(nextTileX, nextTileY)) {
        if (bounces >= maxBounces) {
          // Reached bounce limit: impact wall and stop
          break;
        }

        const crossX = nextTileX !== currentTileX;
        const crossY = nextTileY !== currentTileY;

        let nx = 0;
        let ny = 0;

        if (crossX && crossY) {
          // Corner impact: evaluate neighboring tiles to determine normal
          const solidX = isSolid(nextTileX, currentTileY);
          const solidY = isSolid(currentTileX, nextTileY);

          if (solidX && !solidY) {
            nx = -Math.sign(vx);
            ny = 0;
          } else if (!solidX && solidY) {
            nx = 0;
            ny = -Math.sign(vy);
          } else {
            // Corner retroreflection
            nx = -Math.sign(vx) / Math.SQRT2;
            ny = -Math.sign(vy) / Math.SQRT2;
          }
        } else if (crossX) {
          // Hit vertical face (facing X)
          nx = -Math.sign(vx);
          ny = 0;
        } else {
          // Hit horizontal face (facing Y)
          nx = 0;
          ny = -Math.sign(vy);
        }

        // Apply specular reflection formula: v' = v - 2(v · n)n
        const dot = vx * nx + vy * ny;
        vx = vx - 2 * dot * nx;
        vy = vy - 2 * dot * ny;

        // Re-normalize velocity
        const newLen = Math.hypot(vx, vy);
        if (newLen > 0) {
          vx /= newLen;
          vy /= newLen;
        }

        bounces++;

        // Reset step position back inside the last passable tile
        posX = currentTileX + 0.5;
        posY = currentTileY + 0.5;
        continue;
      }

      // Tile is passable: record step
      currentTileX = nextTileX;
      currentTileY = nextTileY;

      const last = trajectory[trajectory.length - 1];
      if (!last || last.x !== currentTileX || last.y !== currentTileY) {
        trajectory.push({ x: currentTileX, y: currentTileY });
      }

      // Check if an actor (entity) is at this tile (excluding origin)
      if (currentTileX !== origin.x || currentTileY !== origin.y) {
        const entity = map.getEntityAt(currentTileX, currentTileY);
        if (entity && entity.isAlive()) {
          // Impact living entity: ray terminates
          break;
        }
      }
    }

    posX = nextPosX;
    posY = nextPosY;
  }

  return trajectory;
}
