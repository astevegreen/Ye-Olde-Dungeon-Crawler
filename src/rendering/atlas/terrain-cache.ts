import type { TerrainArtConfig } from '../../engine';
import { terrainLayers, type SuffixAt, type TerrainView } from './terrain-layers';

/**
 * Remembers `terrainLayers` per cell for the floor on screen (R-rend-16). Every frame of an
 * effect or a floating number redraws the whole map, and a cell's layers change only when
 * a tile near it does.
 *
 * A cell's layers read the tile types up to two columns and one row away (a wall's mask
 * looks at its neighbours, and a neighbouring door is face-on by the cells either side of
 * it). So each frame `begin` compares every type in and around the view with the one it
 * last saw there and forgets the layers of every cell within that reach of a change: a door
 * opened or closed, a secret door found, a wall dug out. Comparing the types themselves,
 * rather than trusting a change notice, catches any way a tile is rewritten. A change of
 * scope (another map, floor, art config or manifest) starts afresh.
 */
export class TerrainLayerCache {
  private scope: readonly unknown[] = [];
  private width = 0;
  private height = 0;
  /** The tile type last seen at each cell (`y * width + x`). */
  private types: Array<string | undefined> = [];
  /** Each cell's layers; undefined means not yet worked out. */
  private layers: Array<readonly string[] | null | undefined> = [];
  /** The view `begin` last checked; cells outside it are worked out afresh, never stored. */
  private x0 = 0;
  private y0 = 0;
  private x1 = -1;
  private y1 = -1;

  /**
   * Starts a frame over the view (`cols` x `rows` cells from `x0`, `y0`). `scope` lists what
   * the layers were worked out against besides the tile types; any change to it clears the
   * cache.
   */
  public begin(scope: readonly unknown[], view: TerrainView, x0: number, y0: number, cols: number, rows: number): void {
    if (!this.sameScope(scope) || view.width !== this.width || view.height !== this.height) {
      this.scope = [...scope];
      this.width = view.width;
      this.height = view.height;
      this.types = new Array(view.width * view.height);
      this.layers = new Array(view.width * view.height);
    }
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x0 + cols - 1;
    this.y1 = y0 + rows - 1;
    const fromX = Math.max(0, x0 - 2);
    const toX = Math.min(this.width - 1, this.x1 + 2);
    const fromY = Math.max(0, y0 - 1);
    const toY = Math.min(this.height - 1, this.y1 + 1);
    for (let y = fromY; y <= toY; y++) {
      for (let x = fromX; x <= toX; x++) {
        const i = y * this.width + x;
        const type = view.typeAt(x, y);
        if (type === this.types[i]) continue;
        this.types[i] = type;
        this.forgetAround(x, y);
      }
    }
  }

  /** `terrainLayers` for a cell, from the cache unless something near it changed since. */
  public get(
    view: TerrainView,
    x: number,
    y: number,
    suffixAt: SuffixAt,
    art: TerrainArtConfig,
    has: (key: string) => boolean
  ): readonly string[] | null {
    if (x < this.x0 || x > this.x1 || y < this.y0 || y > this.y1 || x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return terrainLayers(view, x, y, suffixAt, art, has);
    }
    const i = y * this.width + x;
    let layers = this.layers[i];
    if (layers === undefined) {
      layers = terrainLayers(view, x, y, suffixAt, art, has);
      this.layers[i] = layers;
    }
    return layers;
  }

  /** Drops the layers of every cell whose own layers read the cell at (x, y). */
  private forgetAround(x: number, y: number): void {
    for (let yy = Math.max(0, y - 1); yy <= Math.min(this.height - 1, y + 1); yy++) {
      for (let xx = Math.max(0, x - 2); xx <= Math.min(this.width - 1, x + 2); xx++) {
        this.layers[yy * this.width + xx] = undefined;
      }
    }
  }

  private sameScope(scope: readonly unknown[]): boolean {
    return scope.length === this.scope.length && scope.every((s, i) => s === this.scope[i]);
  }
}
