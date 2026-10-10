import { describe, it, expect, vi } from 'vitest';
import { ViewportManager } from '../viewport';

function createMockCanvas(rectWidth = 960, rectHeight = 600) {
  const dummyCtx: any = {
    resetTransform: vi.fn(),
    setTransform: vi.fn(),
    scale: vi.fn(),
    imageSmoothingEnabled: true,
  };

  const canvas: any = {
    getContext: () => dummyCtx,
    getBoundingClientRect: () => ({ left: 20, top: 10, width: rectWidth, height: rectHeight }),
    width: 0,
    height: 0,
    style: { width: '', height: '', imageRendering: '' },
  };

  return { canvas, dummyCtx };
}

describe('Responsive High-DPI ViewportManager', () => {
  it('initializes with default 960x600 virtual resolution and pixelated rendering', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx);

    expect(vp.virtualWidth).toBe(960);
    expect(vp.virtualHeight).toBe(600);
    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(dummyCtx.imageSmoothingEnabled).toBe(false);
  });

  it('computes aspect-fit letterboxed scale on widescreen displays (1920x1080)', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });

    // 1920 / 960 = 2.0; 1080 / 600 = 1.8. Best fit is 1.8
    vp.recalculate(1920, 1080);

    expect(vp.scale).toBeCloseTo(1.8, 2);
    expect(vp.displayWidth).toBe(Math.floor(960 * 1.8)); // 1728
    expect(vp.displayHeight).toBe(Math.floor(600 * 1.8)); // 1080
    expect(canvas.style.width).toBe('1728px');
    expect(canvas.style.height).toBe('1080px');
  });

  it('supports integer scaling mode when enabled', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, {
      virtualWidth: 960,
      virtualHeight: 600,
      integerScale: true,
    });

    // 1920x1080: scale = 1.8, integerScale floors to 1
    vp.recalculate(1920, 1080);
    expect(vp.scale).toBe(1);
    expect(vp.displayWidth).toBe(960);
    expect(vp.displayHeight).toBe(600);

    // 2880x1800 (scale = 3.0) -> integer scale 3
    vp.recalculate(2880, 1800);
    expect(vp.scale).toBe(3);
    expect(vp.displayWidth).toBe(2880);
    expect(vp.displayHeight).toBe(1800);
  });

  it('correctly maps client screen coordinates to virtual engine coordinates', () => {
    const { canvas, dummyCtx } = createMockCanvas(480, 300); // 0.5x scale display
    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });

    // Client rect is left: 20, top: 10, width: 480, height: 300
    // Click at screen center: (20 + 240 = 260, 10 + 150 = 160)
    const virtual = vp.clientToVirtual(260, 160);
    expect(virtual.x).toBeCloseTo(480, 0);
    expect(virtual.y).toBeCloseTo(300, 0);

    // Click at top-left: (20, 10)
    const topLeft = vp.clientToVirtual(20, 10);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);

    // Click at bottom-right: (20 + 480 = 500, 10 + 300 = 310)
    const bottomRight = vp.clientToVirtual(500, 310);
    expect(bottomRight.x).toBe(960);
    expect(bottomRight.y).toBe(600);
  });

  it('correctly maps virtual coordinates back to client screen coordinates', () => {
    const { canvas, dummyCtx } = createMockCanvas(480, 300);
    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });

    const clientCenter = vp.virtualToClient(480, 300);
    expect(clientCenter.x).toBe(260);
    expect(clientCenter.y).toBe(160);
  });

  it('constrains #game-container style width to displayWidth when present in DOM', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const mockContainer = { style: { width: '' } };

    (globalThis as any).document = {
      getElementById: (id: string) => {
        if (id === 'game-container') return mockContainer;
        return null;
      },
    };

    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });
    vp.recalculate(1920, 1080);

    expect(mockContainer.style.width).toBe(`${vp.displayWidth}px`);

    delete (globalThis as any).document;
  });

  it('keeps #game-container at least 1024px wide when a short window letterboxes the canvas narrower', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const mockContainer = { style: { width: '' } };
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'game-container' ? mockContainer : null),
    };

    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });
    // 1366x768 less the sidebar and the HUD bars: the canvas fits the height, 814px wide.
    vp.recalculate(1102, 509);
    expect(vp.displayWidth).toBe(814);
    expect(canvas.style.width).toBe('814px');
    expect(mockContainer.style.width).toBe('1024px');

    // A window narrower than that gives the column all it has, and no more.
    vp.recalculate(900, 509);
    expect(mockContainer.style.width).toBe('900px');

    delete (globalThis as any).document;
  });

  it('subtracts every surrounding bar\'s real measured height, not just header+footer', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const barHeight = (h: number) => ({ getBoundingClientRect: () => ({ height: h }) });
    // Bars actually mounted around the canvas in a real game session; a prior
    // version only knew about two of these (hardcoded 34+36), which is exactly the
    // bug this test guards against regressing.
    const bars: Record<string, unknown> = {
      'game-header-bar': barHeight(40),
      'quick-spells-bar': barHeight(30),
      'game-bottom-bar': barHeight(45),
    };
    // Width is deliberately generous so height (the dimension the bars eat into) is
    // the binding constraint on scale — otherwise a wrong overhead sum wouldn't
    // change the result and this test would pass even with the old two-bar guess.
    const centerViewport = { clientWidth: 2000, clientHeight: 800 };

    (globalThis as any).document = {
      getElementById: (id: string) => {
        if (id === 'center-viewport') return centerViewport;
        return bars[id] ?? null;
      },
    };
    (globalThis as any).window = { devicePixelRatio: 1, innerWidth: 2000, innerHeight: 800 };

    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });
    vp.recalculate(); // no explicit args -> exercises the real DOM-measurement branch

    // availH = 800 - (40+30+45) = 685; scale = min(2000/960, 685/600) = 685/600
    const expectedScale = 685 / 600;
    expect(vp.scale).toBeCloseTo(expectedScale, 4);
    expect(vp.displayHeight).toBe(Math.floor(600 * expectedScale));

    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it('counts a bar nested inside another listed bar once, even when the list names the child first', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    // The real layout: the spell belt (listed before the console) lives inside it.
    const belt = { getBoundingClientRect: () => ({ height: 34 }), contains: () => false };
    const console_ = { getBoundingClientRect: () => ({ height: 107 }), contains: (el: unknown) => el === belt };
    const header = { getBoundingClientRect: () => ({ height: 36 }), contains: () => false };
    const bars: Record<string, unknown> = {
      'game-header-bar': header,
      'quick-spells-bar': belt,
      'gothic-action-console': console_,
    };
    const centerViewport = { clientWidth: 2000, clientHeight: 900 };
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'center-viewport' ? centerViewport : bars[id] ?? null),
    };
    (globalThis as any).window = { devicePixelRatio: 1, innerWidth: 2000, innerHeight: 900 };

    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });
    vp.recalculate();

    // availH = 900 - (36 + 107) = 757, not 900 - (36 + 34 + 107) = 723.
    expect(vp.displayHeight).toBe(Math.floor(600 * (757 / 600)));

    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it('keeps a fixed virtual size, letterboxed, when no maximum is given', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, { virtualWidth: 960, virtualHeight: 600 });
    vp.recalculate(2400, 750);
    expect(vp.virtualWidth).toBe(960);
    expect(vp.virtualHeight).toBe(600);
    expect(vp.displayWidth).toBe(1200);
  });

  it('clamps to maxScale on very large displays instead of growing unbounded', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, {
      virtualWidth: 960,
      virtualHeight: 600,
      maxScale: 2,
    });

    // Naive aspect-fit would compute scale 5 here; maxScale caps it at 2.
    vp.recalculate(4800, 3000);

    expect(vp.scale).toBe(2);
    expect(vp.displayWidth).toBe(1920);
    expect(vp.displayHeight).toBe(1200);
  });
});

// The map view's sizing: 30x18¾ tiles at the least, up to 48 columns or 30 rows.
describe('ViewportManager adaptive virtual size', () => {
  const adaptive = { virtualWidth: 960, virtualHeight: 600, maxVirtualWidth: 48 * 32, maxVirtualHeight: 30 * 32 };

  it('draws wider on a wide room instead of leaving side strips', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, adaptive);

    // 1366x768 less the sidebar and the HUD bars: ~40 columns, the room's full width.
    vp.recalculate(1102, 509);
    expect(vp.virtualHeight).toBe(600);
    expect(vp.virtualWidth).toBe(1299); // floor(600 * 1102 / 509)
    expect(vp.displayWidth).toBeGreaterThanOrEqual(1101);
    expect(vp.displayWidth).toBeLessThanOrEqual(1102);
    expect(vp.displayHeight).toBeGreaterThanOrEqual(508);
    expect(vp.displayHeight).toBeLessThanOrEqual(509);

    // 1920x1080: the floored virtual width leaves under one virtual pixel (1.8px) unfilled.
    vp.recalculate(1920, 1080);
    expect(vp.virtualWidth).toBe(1066);
    expect(vp.scale).toBeCloseTo(1.8, 6);
    expect(vp.displayWidth).toBe(1918);
    expect(vp.displayHeight).toBe(1080);
  });

  it('stops widening at 48 columns, letterboxing past it', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, adaptive);

    vp.recalculate(2400, 750);
    expect(vp.virtualWidth).toBe(1536);
    expect(vp.virtualHeight).toBe(600);
    expect(vp.scale).toBe(1.25);
    expect(vp.displayWidth).toBe(1920);
    expect(vp.displayHeight).toBe(750);
  });

  it('draws taller on a tall room, up to 30 rows', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, adaptive);

    vp.recalculate(1100, 800);
    expect(vp.virtualWidth).toBe(960);
    expect(vp.virtualHeight).toBe(698); // floor(960 * 800 / 1100)
    expect(vp.displayWidth).toBeGreaterThanOrEqual(1099);
    expect(vp.displayWidth).toBeLessThanOrEqual(1100);
    expect(vp.displayHeight).toBeGreaterThanOrEqual(798);
    expect(vp.displayHeight).toBeLessThanOrEqual(800);

    // A portrait room passes the cap: the canvas fills the width and is letterboxed top and bottom.
    vp.recalculate(900, 1400);
    expect(vp.virtualHeight).toBe(960);
    expect(vp.scale).toBe(0.9375);
    expect(vp.displayWidth).toBe(900);
    expect(vp.displayHeight).toBe(900);
  });

  it('keeps the minimum size on a room of exactly its shape', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const vp = new ViewportManager(canvas, dummyCtx, adaptive);
    vp.recalculate(1920, 1200);
    expect(vp.virtualWidth).toBe(960);
    expect(vp.virtualHeight).toBe(600);
    expect(vp.scale).toBe(2);
  });

  it('keeps #game-container 1024px wide only while the capped canvas is narrower', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    const mockContainer = { style: { width: '' } };
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'game-container' ? mockContainer : null),
    };

    const vp = new ViewportManager(canvas, dummyCtx, adaptive);
    // A short, very wide room: the canvas stops at 48 columns, 768px wide.
    vp.recalculate(2400, 300);
    expect(vp.displayWidth).toBe(768);
    expect(mockContainer.style.width).toBe('1024px');

    // Below the cap the canvas fills the room, and the column is the canvas.
    vp.recalculate(1102, 509);
    expect(mockContainer.style.width).toBe(`${vp.displayWidth}px`);

    delete (globalThis as any).document;
  });

  it('tells resize listeners when the device pixel ratio changes', () => {
    const { canvas, dummyCtx } = createMockCanvas();
    let dprChange: (() => void) | undefined;
    (globalThis as any).window = {
      devicePixelRatio: 1,
      innerWidth: 1600,
      innerHeight: 1000,
      matchMedia: () => ({ addEventListener: (_type: string, handler: () => void) => (dprChange = handler) }),
    };

    const vp = new ViewportManager(canvas, dummyCtx, adaptive);
    const listener = vi.fn();
    vp.addResizeListener(listener);

    // Moving the window to a 2x monitor halves its CSS size: the virtual size changes, so
    // the renderer must re-lay its grid, not only re-fit the canvas.
    (globalThis as any).window.devicePixelRatio = 2;
    (globalThis as any).window.innerWidth = 1600;
    (globalThis as any).window.innerHeight = 700;
    dprChange?.();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(vp.dpr).toBe(2);
    expect(vp.virtualWidth).toBe(1371); // floor(600 * 1600 / 700)

    delete (globalThis as any).window;
  });
});
