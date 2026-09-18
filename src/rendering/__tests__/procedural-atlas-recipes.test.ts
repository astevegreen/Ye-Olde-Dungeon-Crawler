import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpriteAtlas, ATLAS_MAP, SPRITE_SIZE, ATLAS_TILE_SIZE } from '../atlas/sprite-atlas';
import type { SpriteRecipe } from '../../engine';

function createMockCanvas(): HTMLCanvasElement {
  const dummyCtx: any = new Proxy(
    {
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(16 * ATLAS_TILE_SIZE * (4 * ATLAS_TILE_SIZE) * 4),
      })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
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

describe('Procedural Sprite Recipe Registry & Atlas Baking', () => {
  beforeEach(() => {
    if (typeof document === 'undefined') {
      (globalThis as any).document = {
        createElement: (tag: string) => {
          if (tag === 'canvas') return createMockCanvas();
          return {};
        },
      };
    }
  });

  it('bakes sprite atlas with default CotW recipes when no custom recipes are supplied', () => {
    const atlas = new SpriteAtlas();
    expect(atlas.atlasCanvas).toBeDefined();
    expect(atlas.dimmedAtlasCanvas).toBeDefined();
    expect(atlas.atlasCanvas.width).toBe(16 * ATLAS_TILE_SIZE);
    expect(atlas.atlasCanvas.height).toBe(4 * ATLAS_TILE_SIZE);

    // Verify individual sprite canvases can be retrieved from the baked atlas
    const playerCanvas = atlas.getSpriteCanvas('player');
    expect(playerCanvas).toBeDefined();
  });

  it('invokes custom procedural recipe functions when provided in constructor', () => {
    const customWallRecipe = vi.fn((ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) => {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(ox, oy, size, size);
    });

    const customOrcRecipe = vi.fn((ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number) => {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(ox, oy, size, size);
    });

    const customRecipes: Record<string, SpriteRecipe> = {
      wall: customWallRecipe,
      orc: customOrcRecipe,
    };

    const atlas = new SpriteAtlas(customRecipes);
    expect(atlas.atlasCanvas).toBeDefined();
    expect(customWallRecipe).toHaveBeenCalledTimes(1);
    expect(customOrcRecipe).toHaveBeenCalledTimes(1);

    const wallCoords = ATLAS_MAP.wall;
    expect(customWallRecipe).toHaveBeenCalledWith(
      expect.anything(),
      wallCoords.col * SPRITE_SIZE,
      wallCoords.row * SPRITE_SIZE,
      SPRITE_SIZE
    );
  });

  it('renders fallback graphic when a sprite key is missing in custom recipes and defaults', () => {
    const atlas = new SpriteAtlas();
    const fallbackCanvas = atlas.getSpriteCanvas('broadsword');
    expect(fallbackCanvas).toBeDefined();
  });
});
