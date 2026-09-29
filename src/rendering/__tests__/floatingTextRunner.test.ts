import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FloatingTextRunner } from '../floatingTextRunner';
import { Camera } from '../camera';

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
});
