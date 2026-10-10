import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, Player, TILES } from '../../engine';

// The tile grid follows the virtual canvas, whose size follows the window (viewport.ts).

function createMockContext(): CanvasRenderingContext2D {
  return new Proxy(
    {
      measureText: vi.fn(() => ({ width: 50 })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      canvas: { width: 960, height: 600 },
    } as any,
    {
      get(target: any, prop: string) {
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          return vi.fn(() => ({ addColorStop: vi.fn() }));
        }
        if (prop in target) return target[prop];
        return vi.fn();
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  );
}

function createMockCanvas(): HTMLCanvasElement {
  const ctx = createMockContext();
  return {
    getContext: vi.fn(() => ctx),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 960, height: 600 })),
    width: 960,
    height: 600,
    style: {},
  } as unknown as HTMLCanvasElement;
}

let originalDocument: any;
beforeEach(() => {
  originalDocument = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => (tag === 'canvas' ? createMockCanvas() : {}),
    getElementById: () => null,
  };
});
afterEach(() => {
  (globalThis as any).document = originalDocument;
});

function engineOn(width: number, height: number, hero = { x: Math.floor(width / 2), y: Math.floor(height / 2) }) {
  const map = new GameMap(width, height, TILES.FLOOR);
  const player = new Player({ id: 'player', name: 'Hero', position: hero });
  return new GameEngine({ map, player });
}

/** Lays the grid for a room of this many CSS pixels, as a window resize would. */
function layFor(renderer: CanvasRenderer, roomW: number, roomH: number) {
  const r = renderer as any;
  r.viewport.recalculate(roomW, roomH);
  renderer.render();
  return {
    cols: r.camera.viewWidthTiles as number,
    rows: r.camera.viewHeightTiles as number,
    offsetX: r.offsetX as number,
    offsetY: r.offsetY as number,
    camera: r.camera,
    virtualWidth: r.viewport.virtualWidth as number,
  };
}

describe('Map tile grid', () => {
  it('covers the minimum canvas with an odd grid, cut tiles at the edges, the hero centred', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), engineOn(60, 40, { x: 30, y: 20 }));
    const g = layFor(renderer, 960, 600);

    // 30 columns and 18¾ rows of room: 31x19 tiles, half a tile cut at each side.
    expect(g.cols).toBe(31);
    expect(g.rows).toBe(19);
    expect(g.offsetX).toBe(-16);
    expect(g.offsetY).toBe(-4);

    const hero = g.camera.worldToScreen(30, 20, 32, g.offsetX, g.offsetY)!;
    expect(hero.x + 16).toBe(480);
    expect(hero.y + 16).toBe(300);

    // The cut edge tiles still answer clicks.
    expect(g.camera.screenToWorld(0, 300, 32, g.offsetX, g.offsetY)).toEqual({ x: 15, y: 20 });
    expect(g.camera.screenToWorld(959, 300, 32, g.offsetX, g.offsetY)).toEqual({ x: 45, y: 20 });
    renderer.destroy();
  });

  it('shows ~40 columns at 1366x768 and stops at 48 on a very wide window', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), engineOn(80, 40));

    const laptop = layFor(renderer, 1102, 509);
    expect(laptop.virtualWidth).toBe(1299);
    expect(laptop.cols).toBe(41);
    expect(laptop.offsetX).toBe(-7);

    const wide = layFor(renderer, 2400, 750);
    expect(wide.virtualWidth).toBe(1536);
    expect(wide.cols).toBe(49); // 48 columns of room, half a tile cut at each side
    expect(wide.offsetX).toBe(-16);
    renderer.destroy();
  });

  it('shows up to 30 rows on a tall window', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), engineOn(60, 40));
    const g = layFor(renderer, 900, 1400);
    expect(g.rows).toBe(31);
    expect(g.offsetY).toBe(-16);
    renderer.destroy();
  });

  it('centres a floor smaller than the view whole', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), engineOn(20, 12));
    const g = layFor(renderer, 960, 600);
    expect(g.cols).toBe(20);
    expect(g.rows).toBe(12);
    expect(g.offsetX).toBe(160);
    expect(g.offsetY).toBe(108);
    renderer.destroy();
  });

  it('re-lays the grid for a new floor without a resize', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), engineOn(80, 40));
    expect(layFor(renderer, 1102, 509).cols).toBe(41);

    // A floor narrower than the view: no stray column of the old floor's width.
    renderer.setEngine(engineOn(36, 40));
    const r = renderer as any;
    expect(r.camera.viewWidthTiles).toBe(36);
    expect(r.offsetX).toBe(Math.floor((1299 - 36 * 32) / 2));
    renderer.destroy();
  });
});
