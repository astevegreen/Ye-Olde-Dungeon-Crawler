import type { GameMap } from '../grid/map';
import type { Position } from '../types';
import type { ProjectilePathResult, ProjectileStep } from './types';

export function getBresenhamLine(startX: number, startY: number, endX: number, endY: number): Position[] {
  const points: Position[] = [];
  let x0 = startX;
  let y0 = startY;
  const x1 = endX;
  const y1 = endY;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return points;
}

export function getAreaOfEffectTiles(
  map: GameMap,
  centerX: number,
  centerY: number,
  radius: number
): Position[] {
  const tiles: Position[] = [];
  if (radius <= 0) {
    return [{ x: centerX, y: centerY }];
  }

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = centerX + dx;
      const ty = centerY + dy;
      if (map.inBounds(tx, ty)) {
        // Chebychev / square radius authentic to tile roguelikes
        tiles.push({ x: tx, y: ty });
      }
    }
  }

  return tiles;
}

/**
 * Traces a projectile ray from (startX, startY) towards (targetX, targetY).
 * For reflective spells (like Lightning Bolt), bounces off solid walls at reflective angles
 * up to maxRange or maxReflections.
 */
export function isTileSolidToProjectile(map: GameMap, x: number, y: number): boolean {
  if (!map.inBounds(x, y)) return true;
  const tile = map.getTile(x, y);
  if (!tile) return true;
  if (tile.blocksProjectiles !== undefined) return tile.blocksProjectiles;
  return !(tile.walkable ?? tile.passable);
}

export function traceProjectile(
  map: GameMap,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maxRange = 12,
  reflects = false,
  casterId?: string
): ProjectilePathResult {
  const path: ProjectileStep[] = [];
  let reflectionsCount = 0;
  let hitWall = false;
  let hitEntityId: string | undefined;

  let rawDx = targetX - startX;
  let rawDy = targetY - startY;

  if (rawDx === 0 && rawDy === 0) {
    return {
      path: [{ x: startX, y: startY }],
      impactTile: { x: startX, y: startY },
      hitWall: false,
      reflectionsCount: 0,
    };
  }

  // Normalize initial vector
  const len = Math.hypot(rawDx, rawDy);
  let dirX = rawDx / len;
  let dirY = rawDy / len;

  let currPosX = startX + 0.5;
  let currPosY = startY + 0.5;
  let lastTileX = startX;
  let lastTileY = startY;

  const stepDistance = 0.2; // Fine step for DDA raycasting
  let totalDistance = 0;

  while (totalDistance < maxRange) {
    totalDistance += stepDistance;
    const nextPosX = currPosX + dirX * stepDistance;
    const nextPosY = currPosY + dirY * stepDistance;

    const nextTileX = Math.floor(nextPosX);
    const nextTileY = Math.floor(nextPosY);

    // If moved into a new grid cell
    if (nextTileX !== lastTileX || nextTileY !== lastTileY) {
      if (!map.inBounds(nextTileX, nextTileY)) {
        hitWall = true;
        break;
      }

      const isSolid = isTileSolidToProjectile(map, nextTileX, nextTileY);

      if (isSolid) {
        if (!reflects || reflectionsCount >= 6) {
          hitWall = true;
          break;
        }

        // Reflection logic: determine which axis was crossed
        const hitXFace = nextTileX !== lastTileX;
        const hitYFace = nextTileY !== lastTileY;

        let reflectedX = false;
        let reflectedY = false;

        if (hitXFace && hitYFace) {
          // Corner hit: check adjacent passability
          const passX = !isTileSolidToProjectile(map, nextTileX, lastTileY);
          const passY = !isTileSolidToProjectile(map, lastTileX, nextTileY);

          if (!passX && passY) {
            dirX = -dirX;
            reflectedX = true;
          } else if (passX && !passY) {
            dirY = -dirY;
            reflectedY = true;
          } else {
            dirX = -dirX;
            dirY = -dirY;
            reflectedX = true;
            reflectedY = true;
          }
        } else if (hitXFace) {
          dirX = -dirX;
          reflectedX = true;
        } else if (hitYFace) {
          dirY = -dirY;
          reflectedY = true;
        }

        if (reflectedX || reflectedY) {
          reflectionsCount += 1;
          path.push({
            x: lastTileX,
            y: lastTileY,
            isReflection: true,
          });
          // Do not advance position into solid tile; continue along reflected ray
          continue;
        } else {
          hitWall = true;
          break;
        }
      }

      // Passable tile reached
      lastTileX = nextTileX;
      lastTileY = nextTileY;
      path.push({ x: nextTileX, y: nextTileY });

      // Entity collision check
      const entity = map.getEntityAt(nextTileX, nextTileY);
      if (entity && entity.id !== casterId && entity.isAlive()) {
        hitEntityId = entity.id;
        break;
      }
    }

    currPosX = nextPosX;
    currPosY = nextPosY;
  }

  const finalTile = path.length > 0
    ? { x: path[path.length - 1].x, y: path[path.length - 1].y }
    : { x: startX, y: startY };

  return {
    path,
    impactTile: finalTile,
    hitWall,
    hitEntityId,
    reflectionsCount,
  };
}
