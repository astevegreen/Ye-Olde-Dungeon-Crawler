/** The tile fields a projectile's flight reads (`isTileSolidToProjectile`, src/engine/magic/targeting.ts). */
export interface FireTile {
  blocksProjectiles?: boolean;
  walkable?: boolean;
  passable?: boolean;
}

/**
 * Whether a bolt fired from `from` at `to`, with a range of `range` grid steps, reaches `to`
 * before a tile solid to projectiles: the flight of `traceProjectile` for a projectile that
 * neither reflects nor stops at creatures, over the length `castGeometry` gives a ray. A
 * Bresenham sight line can step past a corner this flight clips (P-36: "1,358 shots traded
 * into one wall"), so the soak bot fires only where this says the bolt arrives.
 *
 * The bot rebuilds this in the page from its source text (playerBot.ts), so it imports
 * nothing and calls nothing outside itself. `getTile` returns nothing off the map.
 */
export function lineOfFire(
  getTile: (x: number, y: number) => FireTile | null | undefined,
  from: { x: number; y: number },
  to: { x: number; y: number },
  range: number
): boolean {
  const rawDx = to.x - from.x;
  const rawDy = to.y - from.y;
  if (rawDx === 0 && rawDy === 0) return true;
  const len = Math.hypot(rawDx, rawDy);
  // A spell's range counts grid steps; the flight measures along the ray (`flightLength`).
  const maxRange = (range * len) / Math.max(Math.abs(rawDx), Math.abs(rawDy));
  const dirX = rawDx / len;
  const dirY = rawDy / len;
  let currPosX = from.x + 0.5;
  let currPosY = from.y + 0.5;
  let lastTileX = from.x;
  let lastTileY = from.y;
  const stepDistance = 0.2;
  let totalDistance = 0;
  while (totalDistance < maxRange) {
    totalDistance += stepDistance;
    const nextPosX = currPosX + dirX * stepDistance;
    const nextPosY = currPosY + dirY * stepDistance;
    const nextTileX = Math.floor(nextPosX);
    const nextTileY = Math.floor(nextPosY);
    if (nextTileX !== lastTileX || nextTileY !== lastTileY) {
      const tile = getTile(nextTileX, nextTileY);
      const solid = !tile || (tile.blocksProjectiles !== undefined ? tile.blocksProjectiles : !(tile.walkable ?? tile.passable));
      if (solid) return false;
      if (nextTileX === to.x && nextTileY === to.y) return true;
      lastTileX = nextTileX;
      lastTileY = nextTileY;
    }
    currPosX = nextPosX;
    currPosY = nextPosY;
  }
  return false;
}
