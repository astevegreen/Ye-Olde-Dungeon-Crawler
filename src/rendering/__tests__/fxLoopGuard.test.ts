import { describe, it, expect, vi, afterEach } from 'vitest';
import { allowIsolatedFailures } from '../../../tests/setup/isolatedFailures';
import { CanvasFXRunner } from '../fxRunner';
import { GameEngine, GameMap, Player, MemoryStorage } from '../../engine';
import type { VisualEffectDescriptor } from '../../engine';
import { InputHandler } from '../input-handler';
import { SettingsManager } from '../../ui/settings/settingsManager';

// R-rend-8: a frame that throws must not end the effect loop with its promise unsettled
// (input stayed locked for the session). R-rend-9: overlapping batches each hold input.

describe('the effect loop survives a throwing frame', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('playEffects still settles when onFrame throws', async () => {
    allowIsolatedFailures();
    let next: ((t: number) => void) | null = null;
    vi.stubGlobal('window', {});
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      next = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const runner = new CanvasFXRunner({ onFrame: () => { throw new Error('bad frame'); } });
    const done = runner.playEffects([{ type: 'projectile', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: '#fff' } as never]);
    for (let i = 0; i < 5 && next; i++) {
      const cb: (t: number) => void = next;
      next = null;
      cb(16 * (i + 1));
    }

    await expect(Promise.race([done.then(() => 'settled'), new Promise((r) => setTimeout(() => r('hung'), 50))])).resolves.toBe('settled');
  });
});

describe('a batch frees input by its own length when frames stop (#47)', () => {
  // Soak seed 8, floor 20 (sha ae5a2d27): the hero at (40,27) casts Mire at (40,23), as the
  // spell pipeline builds it. Both browsers on the machine then drew no frame for 6 s (a
  // stalled GPU), so the flight never advanced and input stayed locked past the 5 s ceiling.
  const MIRE: VisualEffectDescriptor[] = [
    { type: 'projectile', origin: { x: 40, y: 27 }, path: [{ x: 40, y: 26 }, { x: 40, y: 25 }, { x: 40, y: 24 }, { x: 40, y: 23 }], color: '#65a30d', fx: 'poison', stepDelayMs: 24, travelMode: 'smooth' },
    { type: 'burst', epicenter: { x: 40, y: 23 }, radius: 3, color: '#65a30d', fx: 'poison', durationMs: 250, style: 'shockwave' },
  ];

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds input while the cast would play, then frees it though no frame came', async () => {
    const engine = new GameEngine({ map: new GameMap(60, 40), player: new Player({ position: { x: 40, y: 27 } }) });
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('window', {});
    vi.stubGlobal('requestAnimationFrame', () => 1); // the compositor never calls back
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const runner = new CanvasFXRunner();

    // As main.ts does for a tactical batch: hold, play, release.
    const release = ih.holdInput();
    void runner.playQueue(MIRE).finally(release);
    // The flight (4 steps of 24 ms) and the burst (250 ms), both slowed 1.75x: about 600 ms.
    await vi.advanceTimersByTimeAsync(600);
    expect(ih.isInputLocked).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    expect(ih.isInputLocked).toBe(false);
    runner.destroy();
    vi.unstubAllGlobals();
    ih.destroy();
  });
});

describe('input holds are counted', () => {
  it('the first batch to end does not unlock input while a second still plays', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }) });
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    const a = ih.holdInput();
    const b = ih.holdInput();
    a();
    a();
    expect(ih.isInputLocked).toBe(true);
    b();
    expect(ih.isInputLocked).toBe(false);
    ih.isInputLocked = true;
    ih.clearInputLock();
    expect(ih.isInputLocked).toBe(false);
    ih.destroy();
  });
});
