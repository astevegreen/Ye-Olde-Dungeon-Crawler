import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasFXRunner } from '../fxRunner';
import { isTacticalEffect } from '../../engine';
import type { VisualEffectDescriptor } from '../../engine';

/**
 * Tactical effects gate input; ambient ones do not (ARCHITECTURE.md §4).
 * The split matters for feel: a screen flash should never make the next keypress wait.
 */
const projectile = (): VisualEffectDescriptor => ({
  type: 'projectile',
  path: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
  color: '#fff',
  stepDelayMs: 10,
});
const flash = (): VisualEffectDescriptor => ({ type: 'screen_flash', color: '#fff', durationMs: 50 });

describe('Effect classification', () => {
  it('treats positional effects as tactical and screen pulses as ambient', () => {
    expect(isTacticalEffect(projectile())).toBe(true);
    expect(isTacticalEffect({ type: 'burst', epicenter: { x: 1, y: 1 }, radius: 2, color: '#f00', durationMs: 30 })).toBe(true);
    expect(isTacticalEffect({ type: 'chain_link', from: { x: 1, y: 1 }, to: { x: 3, y: 3 }, color: '#0ff', durationMs: 30 })).toBe(true);
    expect(isTacticalEffect(flash())).toBe(false);
  });

  it('honours an explicit priority over the default', () => {
    expect(isTacticalEffect({ ...flash(), priority: 'tactical' })).toBe(true);
    expect(isTacticalEffect({ ...projectile(), priority: 'ambient' })).toBe(false);
  });
});

describe('CanvasFXRunner queue split', () => {
  let runner: CanvasFXRunner;

  beforeEach(() => {
    runner = new CanvasFXRunner({ mode: 'smooth' });
  });
  afterEach(() => vi.restoreAllMocks());

  // Note: these assert routing, not timing. Under Node there is no window, so playEffects
  // resolves immediately and a duration-based test would pass even with the split removed.
  it('sends ambient effects down the non-blocking path and tactical ones down the awaited path', async () => {
    const ambientSpy = vi.spyOn(runner, 'playAmbient');
    const blockingSpy = vi.spyOn(runner, 'playEffects');
    const proj = projectile();
    const fl = flash();

    await runner.playQueue([proj, fl]);

    expect(ambientSpy).toHaveBeenCalledWith([fl]);
    expect(blockingSpy).toHaveBeenCalledWith([proj]);
  });

  it('never opens a blocking playback for an ambient-only batch', async () => {
    const blockingSpy = vi.spyOn(runner, 'playEffects');

    await runner.playQueue([flash(), flash()]);

    expect(blockingSpy).not.toHaveBeenCalled();
  });

  it('returns immediately for an empty batch', async () => {
    await expect(runner.playQueue([])).resolves.toBeUndefined();
  });
});

// The routing tests above can't see timing: under Node playEffects resolves at once. With a
// frame clock they can (R-rend-20).
describe('CanvasFXRunner playback with a frame clock', () => {
  let frames: Array<(t: number) => void>;
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a tactical batch holds its caller until its frames have played; an ambient one never does', async () => {
    const runner = new CanvasFXRunner({ mode: 'smooth' });
    let done = false;
    const tactical = runner.playQueue([projectile(), flash()]).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);

    let t = performance.now();
    for (let i = 0; i < 200 && !done && frames.length > 0; i++) {
      t += 16;
      frames.shift()!(t);
      await Promise.resolve();
    }
    await tactical;
    expect(done).toBe(true);

    // Nothing pumps a frame here: an ambient-only batch must resolve on its own.
    await expect(runner.playQueue([flash()])).resolves.toBeUndefined();
    runner.destroy();
  });
});
