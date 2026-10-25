import { describe, it, expect, vi, afterEach } from 'vitest';
import { allowIsolatedFailures } from '../../../tests/setup/isolatedFailures';
import { CanvasFXRunner } from '../fxRunner';
import { GameEngine, GameMap, Player, MemoryStorage, flightRecorder } from '../../engine';
import type { SpellFxCatalog, VisualEffectDescriptor } from '../../engine';
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

describe('a slow but steady frame rate plays every batch to its end (#77)', () => {
  // A flight that does not land on the burst's epicentre, so its drawn impact holds the track
  // between the two waves: three wave boundaries, each seen only on a frame.
  const ART: SpellFxCatalog = { elements: { fire: { impact: () => {}, msBolt: 100, msImpact: 400 } } };
  const batch = (steps: number): VisualEffectDescriptor[] => [
    { type: 'projectile', origin: { x: 10, y: 10 }, path: Array.from({ length: steps }, (_, i) => ({ x: 11 + i, y: 10 })), color: '#f00', fx: 'fire', stepDelayMs: 22, travelMode: 'smooth' },
    { type: 'burst', epicenter: { x: 20, y: 20 }, radius: 2, color: '#f00', fx: 'fire', durationMs: 250, style: 'shockwave' },
  ];
  // Slowed 1.75x: 38.5 ms a step; the hold is min(250, msImpact); the burst 437.5 ms.
  const STEP_MS = 38.5;
  const HOLD_MS = 250;
  const BURST_MS = 437.5;

  /**
   * Frames every `frameMs` on a fixed clock, as a slow compositor delivers them. Returns a
   * stall switch: a frame asked for at its time or later never comes (the GPU stalls).
   */
  const slowFrames = (frameMs: number): ((at: number) => void) => {
    let stopAt = Infinity;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('window', {});
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      if (performance.now() < stopAt) setTimeout(() => cb(performance.now()), frameMs - (performance.now() % frameMs));
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    return (at) => { stopAt = at; };
  };
  const frameAfter = (t: number, frameMs: number) => Math.ceil(t / frameMs) * frameMs;
  /** The frames a batch's waves start on: each starts on the first frame after the last one ended. */
  const waveStarts = (queuedAt: number, steps: number, frameMs: number): { hold: number; burst: number } => {
    const hold = frameAfter(queuedAt + STEP_MS * steps, frameMs);
    return { hold, burst: frameAfter(hold + HOLD_MS, frameMs) };
  };
  /** When the burst should end. */
  const burstEnd = (queuedAt: number, steps: number, frameMs: number): number => waveStarts(queuedAt, steps, frameMs).burst + BURST_MS;
  const newInputHandler = (): InputHandler => {
    const engine = new GameEngine({ map: new GameMap(30, 30), player: new Player({ position: { x: 10, y: 10 } }) });
    return new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('at 150 ms a frame, holds input until the burst has played its whole length', async () => {
    const ih = newInputHandler();
    slowFrames(150);
    const warn = vi.spyOn(flightRecorder, 'warn');
    await vi.advanceTimersByTimeAsync(1000);
    const runner = new CanvasFXRunner({ art: () => ART });
    const end = burstEnd(performance.now(), 4, 150);

    const release = ih.holdInput();
    void runner.playQueue(batch(4)).finally(release);
    await vi.advanceTimersByTimeAsync(end - 1 - performance.now());
    expect(runner.isPlaying).toBe(true);
    expect(ih.isInputLocked).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(ih.isInputLocked).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    runner.destroy();
    vi.unstubAllGlobals();
    ih.destroy();
  });

  it('at any slow frame rate, no batch ends before its burst has played its whole length', async () => {
    const cut: string[] = [];
    for (let frameMs = 120; frameMs <= 500; frameMs += 20) {
      for (let steps = 1; steps <= 4; steps++) {
        for (let phase = 0; phase < frameMs; phase += 15) {
          slowFrames(frameMs);
          await vi.advanceTimersByTimeAsync(1000 + phase);
          const runner = new CanvasFXRunner({ art: () => ART });
          const end = burstEnd(performance.now(), steps, frameMs);
          let endedAt = Number.NaN;
          void runner.playEffects(batch(steps)).then(() => { endedAt = performance.now(); });
          await vi.advanceTimersByTimeAsync(3000);
          if (!(endedAt >= end)) cut.push(`${frameMs} ms frames, ${steps} steps, phase ${phase}: ended ${end - endedAt} ms early`);
          runner.destroy();
          vi.useRealTimers();
          vi.unstubAllGlobals();
        }
      }
    }
    expect(cut).toEqual([]);
  });

  it('at frames under 250 ms apart, the stall guard never fires', async () => {
    const fired: string[] = [];
    for (let frameMs = 120; frameMs < 250; frameMs += 10) {
      for (let steps = 1; steps <= 4; steps++) {
        for (let phase = 0; phase < frameMs; phase += 15) {
          slowFrames(frameMs);
          const warn = vi.spyOn(flightRecorder, 'warn');
          await vi.advanceTimersByTimeAsync(1000 + phase);
          const runner = new CanvasFXRunner({ art: () => ART });
          void runner.playEffects(batch(steps));
          await vi.advanceTimersByTimeAsync(3000);
          if (warn.mock.calls.length > 0) fired.push(`${frameMs} ms frames, ${steps} steps, phase ${phase}`);
          runner.destroy();
          warn.mockRestore();
          vi.useRealTimers();
          vi.unstubAllGlobals();
        }
      }
    }
    expect(fired).toEqual([]);
  });

  it('frames that stop mid-batch still free input: the stalled wave, the waves after it, then 250 ms', async () => {
    const STALL_SLACK_MS = 250;
    const late: string[] = [];
    for (const frameMs of [100, 150, 200]) {
      for (const stalls of ['hold', 'burst'] as const) {
        for (let phase = 0; phase < frameMs; phase += 25) {
          const ih = newInputHandler();
          const stallAt = slowFrames(frameMs);
          const warn = vi.spyOn(flightRecorder, 'warn');
          await vi.advanceTimersByTimeAsync(1000 + phase);
          const starts = waveStarts(performance.now(), 4, frameMs);
          // The last frame to come is the one that starts the stalled wave.
          stallAt(starts[stalls]);
          const runner = new CanvasFXRunner({ art: () => ART });
          const release = ih.holdInput();
          void runner.playEffects(batch(4)).finally(release);
          const freeAt = starts[stalls] + (stalls === 'hold' ? HOLD_MS + BURST_MS : BURST_MS) + STALL_SLACK_MS;
          await vi.advanceTimersByTimeAsync(freeAt - 1 - performance.now());
          const lockedBefore = ih.isInputLocked;
          await vi.advanceTimersByTimeAsync(2);
          if (!lockedBefore || ih.isInputLocked || warn.mock.calls.length !== 1) {
            late.push(`${frameMs} ms frames stalled in the ${stalls}, phase ${phase}: locked before ${lockedBefore}, after ${ih.isInputLocked}, warnings ${warn.mock.calls.length}`);
          }
          runner.destroy();
          warn.mockRestore();
          vi.useRealTimers();
          vi.unstubAllGlobals();
          ih.destroy();
        }
      }
    }
    expect(late).toEqual([]);
  });

  it('a second cast queued while the first plays: both play out, then input frees, with no stall warning', async () => {
    const wrong: string[] = [];
    for (let frameMs = 120; frameMs <= 300; frameMs += 30) {
      for (let phase = 0; phase < frameMs; phase += 25) {
        const ih = newInputHandler();
        slowFrames(frameMs);
        const warn = vi.spyOn(flightRecorder, 'warn');
        await vi.advanceTimersByTimeAsync(1000 + phase);
        const runner = new CanvasFXRunner({ art: () => ART });
        const first = waveStarts(performance.now(), 4, frameMs);
        // The first burst is seen to end on a frame, and the second batch starts on that frame.
        const secondEnd = burstEnd(frameAfter(first.burst + BURST_MS, frameMs), 2, frameMs);
        // As main.ts does: each batch holds input until it ends.
        const releaseFirst = ih.holdInput();
        void runner.playQueue(batch(4)).finally(releaseFirst);
        await vi.advanceTimersByTimeAsync(100);
        const releaseSecond = ih.holdInput();
        void runner.playQueue(batch(2)).finally(releaseSecond);
        await vi.advanceTimersByTimeAsync(secondEnd - 1 - performance.now());
        const lockedBefore = ih.isInputLocked;
        await vi.advanceTimersByTimeAsync(2000);
        if (!lockedBefore || ih.isInputLocked || warn.mock.calls.length > 0) {
          wrong.push(`${frameMs} ms frames, phase ${phase}: locked before ${lockedBefore}, after ${ih.isInputLocked}, warnings ${warn.mock.calls.length}`);
        }
        runner.destroy();
        warn.mockRestore();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        ih.destroy();
      }
    }
    expect(wrong).toEqual([]);
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
