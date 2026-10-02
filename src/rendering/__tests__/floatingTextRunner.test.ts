import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FloatingTextRunner } from '../floatingTextRunner';
import { Camera } from '../camera';
import { setCanvasTextScale } from '../theme';

describe('FloatingTextRunner', () => {
  let runner: FloatingTextRunner;

  beforeEach(() => {
    runner = new FloatingTextRunner();
  });

  afterEach(() => {
    runner.destroy();
    vi.restoreAllMocks();
  });

  it('spawns damage numbers and tracks active count', () => {
    expect(runner.getActiveCount()).toBe(0);
    runner.spawnDamage(5, 5, 18, { isPlayer: false });
    expect(runner.getActiveCount()).toBe(1);
    expect(runner.isPlaying).toBe(true);
  });

  it('formats critical hits and fatal hits', () => {
    runner.spawnDamage(5, 5, 30, { isCrit: true });
    expect(runner.getActiveCount()).toBe(1);

    runner.spawnDamage(6, 6, 12, { killed: true, isPlayer: false });
    expect(runner.getActiveCount()).toBe(2);
  });

  it('spawns healing numbers with positive prefix', () => {
    runner.spawnHeal(3, 4, 15);
    expect(runner.getActiveCount()).toBe(1);
  });

  it('clears active numbers on clear() and destroy()', () => {
    runner.spawnDamage(1, 1, 10);
    runner.spawnDamage(2, 2, 20);
    expect(runner.getActiveCount()).toBe(2);

    runner.clear();
    expect(runner.getActiveCount()).toBe(0);
    expect(runner.isPlaying).toBe(false);
  });

  it('renders without error to a mock canvas context', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    const camera = new Camera(20, 15);
    camera.update({ x: 5, y: 5 }, 40, 40);

    runner.spawnDamage(5, 5, 14);
    expect(() => {
      runner.render(mockCtx, camera, 32, 0, 0);
    }).not.toThrow();
  });

  it('sizes its text in CSS pixels, never under the 11px floor however small the canvas is drawn', () => {
    const fonts: string[] = [];
    const mockCtx = {
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(),
      set font(f: string) { fonts.push(f); },
    } as unknown as CanvasRenderingContext2D;
    const camera = new Camera(20, 15);
    camera.update({ x: 5, y: 5 }, 40, 40);

    // 1366x768: the 960-wide virtual canvas is drawn 814px wide.
    setCanvasTextScale(814 / 960);
    try {
      runner.spawnDamage(5, 5, 14);
      runner.spawnHeal(5, 5, 3);
      runner.render(mockCtx, camera, 32, 0, 0);
    } finally {
      setCanvasTextScale(1);
    }
    expect(fonts).toHaveLength(2);
    for (const font of fonts) {
      const virtualPx = parseFloat(font.replace(/^bold /, ''));
      expect(virtualPx * (814 / 960)).toBeGreaterThanOrEqual(11);
    }
  });
});
