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
});
