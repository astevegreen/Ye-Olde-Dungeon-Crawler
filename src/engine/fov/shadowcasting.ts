/**
 * Recursive Shadowcasting Field of View Algorithm
 *
 * Scans 8 octants around an origin point up to a given radius.
 * Handles blocking obstacles (walls, closed doors) so that the face of the obstacle
 * is illuminated while geometry directly behind it is shadowed.
 */

export interface FovGrid {
  inBounds(x: number, y: number): boolean;
  isTransparent(x: number, y: number): boolean;
}

export function computeFov(
  originX: number,
  originY: number,
  radius: number,
  grid: FovGrid,
  markVisible: (x: number, y: number) => void
): void {
  // Origin tile is always in line of sight
  markVisible(originX, originY);

  const radiusSquared = radius * radius;

  // Scan all 8 octants
  for (let octant = 0; octant < 8; octant++) {
    scanOctant(octant, 1, 1.0, 0.0);
  }

  function transform(octant: number, row: number, col: number): [number, number] {
    switch (octant) {
      case 0: return [originX + col, originY - row];
      case 1: return [originX + row, originY - col];
      case 2: return [originX + row, originY + col];
      case 3: return [originX + col, originY + row];
      case 4: return [originX - col, originY + row];
      case 5: return [originX - row, originY + col];
      case 6: return [originX - row, originY - col];
      case 7: return [originX - col, originY - row];
      default: return [originX, originY];
    }
  }

  function scanOctant(
    octant: number,
    row: number,
    startSlope: number,
    endSlope: number
  ): void {
    if (row > radius || startSlope < endSlope) {
      return;
    }

    let nextStartSlope = startSlope;
    let wasOpaque = -1; // -1: not started, 0: transparent, 1: opaque

    const minCol = Math.round(row * endSlope);
    const maxCol = Math.round(row * startSlope);

    for (let col = maxCol; col >= minCol; col--) {
      const [x, y] = transform(octant, row, col);

      if (!grid.inBounds(x, y)) {
        continue;
      }

      // Check circular radius
      const distSq = (x - originX) * (x - originX) + (y - originY) * (y - originY);
      if (distSq <= radiusSquared) {
        markVisible(x, y);
      }

      const isBlocking = !grid.isTransparent(x, y);

      if (isBlocking) {
        if (wasOpaque === 0) {
          // Transitioned from transparent to opaque: branch recursive call
          const nextEndSlope = (col + 0.5) / (row - 0.5);
          scanOctant(octant, row + 1, nextStartSlope, nextEndSlope);
        }
        wasOpaque = 1;
      } else {
        if (wasOpaque === 1) {
          // Transitioned from opaque to transparent
          nextStartSlope = (col + 0.5) / (row + 0.5);
        }
        wasOpaque = 0;
      }
    }

    // Continue scanning if the last tile in the row was transparent
    if (wasOpaque === 0) {
      scanOctant(octant, row + 1, nextStartSlope, endSlope);
    }
  }
}
