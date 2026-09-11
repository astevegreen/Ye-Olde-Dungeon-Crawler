import type { GameMap } from '../grid/map';
import { Visibility } from './types';
import { computeFov } from './shadowcasting';

export class FovManager {
  public readonly width: number;
  public readonly height: number;
  private visibility: Visibility[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.visibility = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => Visibility.Unexplored)
    );
  }

  public getVisibility(x: number, y: number): Visibility {
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) {
      return Visibility.Unexplored;
    }
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return Visibility.Unexplored;
    }
    return this.visibility[y]?.[x] ?? Visibility.Unexplored;
  }

  public setVisibility(x: number, y: number, visibility: Visibility): void {
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.visibility[y]) {
        this.visibility[y][x] = visibility;
      }
    }
  }

  public isVisible(x: number, y: number): boolean {
    return this.getVisibility(x, y) === Visibility.Visible;
  }

  public isExplored(x: number, y: number): boolean {
    const v = this.getVisibility(x, y);
    return v === Visibility.Explored || v === Visibility.Visible;
  }

  public update(map: GameMap, originX: number, originY: number, radius = 8): void {
    // 1. Demote currently visible tiles to explored (Fog of War)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.visibility[y][x] === Visibility.Visible) {
          this.visibility[y][x] = Visibility.Explored;
        }
      }
    }

    // 2. Compute newly visible tiles using recursive shadowcasting
    computeFov(originX, originY, radius, map, (x, y) => {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        this.visibility[y][x] = Visibility.Visible;
      }
    });
  }

  public revealTile(x: number, y: number): void {
    if (this.getVisibility(x, y) === Visibility.Unexplored) {
      this.setVisibility(x, y, Visibility.Explored);
    }
  }

  public revealAll(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visibility[y][x] = Visibility.Visible;
      }
    }
  }

  /**
   * Explores all tiles on the map (Clairvoyance / Magic Mapping).
   * Unexplored tiles become Explored (Fog of War) without revealing entities.
   */
  public revealAllTiles(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.visibility[y][x] === Visibility.Unexplored) {
          this.visibility[y][x] = Visibility.Explored;
        }
      }
    }
  }
}
