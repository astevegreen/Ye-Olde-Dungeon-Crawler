import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  SpriteAtlas,
  ATLAS_MAP,
  SPRITE_SIZE,
  ATLAS_TILE_SIZE,
  applyOutlineAndHighlight,
  OUTLINE_ALPHA_THRESHOLD,
  OUTLINE_COLOR,
  HIGHLIGHT_MIX,
} from '../sprite-atlas';
import type { SpriteRecipe } from '../../../engine';

function createMockCanvas(): HTMLCanvasElement {
  const dummyCtx: any = new Proxy(
    {
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(16 * ATLAS_TILE_SIZE * (10 * ATLAS_TILE_SIZE) * 4),
      })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return vi.fn();
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  );

  return {
    getContext: () => dummyCtx,
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement;
}

describe('Atlas bake pipeline — supersampling, downsample, shading, outline/highlight', () => {
  let createElementSpy: Mock<(tag: string) => unknown>;

  beforeEach(() => {
    createElementSpy = vi.fn((tag: string) => (tag === 'canvas' ? createMockCanvas() : {}));
    (globalThis as any).document = { createElement: createElementSpy };
  });

  describe('bake + downsample', () => {
    it('creates an extra supersampled scratch canvas beyond the atlas + dimmed-atlas pair', () => {
      new SpriteAtlas();
      const canvasCreations = createElementSpy.mock.calls.filter((call) => call[0] === 'canvas').length;
      // atlasCanvas + dimmedAtlasCanvas (constructor) + one scratch canvas (buildAtlas)
      expect(canvasCreations).toBeGreaterThanOrEqual(3);
    });

    it('stores the atlas at ATLAS_TILE_SIZE resolution, independent of the fixed recipe coordinate space', () => {
      const atlas = new SpriteAtlas();
      expect(ATLAS_TILE_SIZE).toBeGreaterThan(SPRITE_SIZE);
      expect(atlas.atlasCanvas.width).toBe(16 * ATLAS_TILE_SIZE);
      expect(atlas.atlasCanvas.height).toBe(10 * ATLAS_TILE_SIZE);
    });

    it('never letters over a shared cell a recipe painted (wall/secret_door)', () => {
      const fallback = vi.spyOn(SpriteAtlas.prototype as unknown as { renderFallback: () => void }, 'renderFallback');
      const wall = vi.fn();
      new SpriteAtlas({ wall });
      const letteredKeys = fallback.mock.calls.map((call) => (call as unknown[])[3]);
      fallback.mockRestore();

      expect(wall).toHaveBeenCalledTimes(1);
      expect(letteredKeys).not.toContain('secret_door'); // shares wall's cell
      expect(letteredKeys).toContain('floor'); // a cell with no recipe still gets its letter
    });

    it('gives a pack recipe the built-in map lacks its own cell in an extra row', () => {
      const relic = vi.fn();
      const atlas = new SpriteAtlas({ some_pack_relic: relic });

      expect(atlas.hasSprite('some_pack_relic')).toBe(true);
      expect(atlas.hasSprite('never_declared')).toBe(false);
      expect(relic).toHaveBeenCalledTimes(1);
      expect(relic).toHaveBeenCalledWith(expect.anything(), 0, 10 * SPRITE_SIZE, SPRITE_SIZE);
      expect(atlas.atlasCanvas.height).toBe(11 * ATLAS_TILE_SIZE);
    });


    it('still invokes recipes with the original SPRITE_SIZE-spaced coordinates, unaffected by the higher stored resolution', () => {
      const customWallRecipe = vi.fn((ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) => {
        ctx.fillRect(ox, oy, size, size);
      });
      const customRecipes: Record<string, SpriteRecipe> = { wall: customWallRecipe };

      new SpriteAtlas(customRecipes);

      const wallCoords = ATLAS_MAP.wall;
      expect(customWallRecipe).toHaveBeenCalledWith(
        expect.anything(),
        wallCoords.col * SPRITE_SIZE,
        wallCoords.row * SPRITE_SIZE,
        SPRITE_SIZE
      );
    });
  });

  describe('shading overlay', () => {
    it('applies one directional-light gradient per unique atlas cell, composited with source-atop', () => {
      const atlas = new SpriteAtlas();
      const ctx = atlas.atlasCanvas.getContext('2d') as any;

      const uniqueCells = new Set(Object.values(ATLAS_MAP).map((c) => `${c.col},${c.row}`)).size;

      expect(ctx.createLinearGradient).toHaveBeenCalledTimes(uniqueCells);
      // Every shading fillRect happens on the real atlas ctx (recipes fill onto the
      // separate scratch ctx instead), so this count isolates the shading pass.
      expect(ctx.fillRect).toHaveBeenCalledTimes(uniqueCells);
      expect(ctx.globalCompositeOperation).toBe('source-atop');
    });
  });

  describe('applyOutlineAndHighlight (pure pixel-math, no canvas/DOM needed)', () => {
    const WIDTH = 8;
    const HEIGHT = 8;
    const CELL = [{ ox: 0, oy: 0, size: 8 }];

    function makeFixture(): Uint8ClampedArray {
      const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
      // A 2x2 solid gray block at (3,3)-(4,4), alpha 255, on an otherwise transparent field.
      for (const [x, y] of [
        [3, 3],
        [4, 3],
        [3, 4],
        [4, 4],
      ]) {
        const i = (y * WIDTH + x) * 4;
        data[i] = 100;
        data[i + 1] = 100;
        data[i + 2] = 100;
        data[i + 3] = 255;
      }
      return data;
    }

    it('dilates a dark outline onto transparent pixels adjacent to the solid block', () => {
      const data = makeFixture();
      applyOutlineAndHighlight(data, WIDTH, HEIGHT, CELL);

      // (2,2) is diagonally adjacent to solid pixel (3,3) -> gains the outline.
      const i = (2 * WIDTH + 2) * 4;
      expect(data[i]).toBe(OUTLINE_COLOR[0]);
      expect(data[i + 1]).toBe(OUTLINE_COLOR[1]);
      expect(data[i + 2]).toBe(OUTLINE_COLOR[2]);
      expect(data[i + 3]).toBe(255);
    });

    it('lightens the top/left-facing rim of the solid block but not its bottom/right corner', () => {
      const data = makeFixture();
      applyOutlineAndHighlight(data, WIDTH, HEIGHT, CELL);

      // (3,3): top-left corner of the block — North (3,2) and West (2,3) are both
      // transparent, so it qualifies for the highlight blend.
      const topLeft = (3 * WIDTH + 3) * 4;
      const expected = Math.round(100 + (255 - 100) * HIGHLIGHT_MIX);
      expect(data[topLeft]).toBe(expected);

      // (4,4): bottom-right corner — North (4,3) and West (3,4) are both solid
      // (part of the same block), so it must NOT be highlighted.
      const bottomRight = (4 * WIDTH + 4) * 4;
      expect(data[bottomRight]).toBe(100);
    });

    it('leaves pixels with no solid neighbor entirely untouched', () => {
      const data = makeFixture();
      applyOutlineAndHighlight(data, WIDTH, HEIGHT, CELL);

      const far = (7 * WIDTH + 7) * 4;
      expect(data[far]).toBe(0);
      expect(data[far + 1]).toBe(0);
      expect(data[far + 2]).toBe(0);
      expect(data[far + 3]).toBe(0);
    });

    it('is a no-op on a cell that is fully opaque edge-to-edge (terrain-tile shape)', () => {
      const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255);
      const before = data.slice();

      applyOutlineAndHighlight(data, WIDTH, HEIGHT, CELL);

      expect(data).toEqual(before);
    });

    it('does not grow a hard ring around a soft translucent glow below the alpha threshold', () => {
      const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
      // A soft halo well below OUTLINE_ALPHA_THRESHOLD, filling the whole cell.
      const softAlpha = Math.round(OUTLINE_ALPHA_THRESHOLD * 0.6);
      for (let p = 0; p < WIDTH * HEIGHT; p++) {
        data[p * 4] = 56;
        data[p * 4 + 1] = 189;
        data[p * 4 + 2] = 248;
        data[p * 4 + 3] = softAlpha;
      }
      const before = data.slice();

      applyOutlineAndHighlight(data, WIDTH, HEIGHT, CELL);

      // No pixel anywhere in the cell crosses the "solid" threshold, so the dilate
      // branch never fires anywhere — the halo is left exactly as drawn.
      expect(data).toEqual(before);
    });
  });
});
