import type { Position } from '../engine/types';

export class Camera {
  public viewWidthTiles: number;
  public viewHeightTiles: number;
  public startX: number;
  public startY: number;

  constructor(viewWidthTiles = 25, viewHeightTiles = 18) {
    this.viewWidthTiles = viewWidthTiles;
    this.viewHeightTiles = viewHeightTiles;
    this.startX = 0;
    this.startY = 0;
  }

  public update(target: Position | null | undefined, mapWidth: number, mapHeight: number): void {
    if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
      return;
    }
    // If the map is smaller than view, center it
    if (mapWidth <= this.viewWidthTiles) {
      this.startX = Math.floor((mapWidth - this.viewWidthTiles) / 2);
    } else {
      // Center on target and clamp within [0, mapWidth - viewWidthTiles]
      const desiredX = target.x - Math.floor(this.viewWidthTiles / 2);
      this.startX = Math.max(0, Math.min(mapWidth - this.viewWidthTiles, desiredX));
    }

    if (mapHeight <= this.viewHeightTiles) {
      this.startY = Math.floor((mapHeight - this.viewHeightTiles) / 2);
    } else {
      const desiredY = target.y - Math.floor(this.viewHeightTiles / 2);
      this.startY = Math.max(0, Math.min(mapHeight - this.viewHeightTiles, desiredY));
    }
  }

  public worldToScreen(
    worldX: number,
    worldY: number,
    cellSize: number,
    offsetX = 0,
    offsetY = 0,
    out?: { x: number; y: number }
  ): { x: number; y: number } | null {
    if (typeof worldX !== 'number' || typeof worldY !== 'number' || Number.isNaN(worldX) || Number.isNaN(worldY)) {
      return null;
    }
    const relX = worldX - this.startX;
    const relY = worldY - this.startY;

    if (relX < 0 || relX >= this.viewWidthTiles || relY < 0 || relY >= this.viewHeightTiles) {
      return null;
    }

    if (out) {
      out.x = offsetX + relX * cellSize;
      out.y = offsetY + relY * cellSize;
      return out;
    }

    return {
      x: offsetX + relX * cellSize,
      y: offsetY + relY * cellSize,
    };
  }

  public screenToWorld(
    screenX: number,
    screenY: number,
    cellSize: number,
    offsetX = 0,
    offsetY = 0
  ): Position | null {
    if (typeof screenX !== 'number' || typeof screenY !== 'number' || Number.isNaN(screenX) || Number.isNaN(screenY) || !cellSize) {
      return null;
    }
    const relX = Math.floor((screenX - offsetX) / cellSize);
    const relY = Math.floor((screenY - offsetY) / cellSize);

    if (relX < 0 || relX >= this.viewWidthTiles || relY < 0 || relY >= this.viewHeightTiles) {
      return null;
    }

    return {
      x: this.startX + relX,
      y: this.startY + relY,
    };
  }
}
