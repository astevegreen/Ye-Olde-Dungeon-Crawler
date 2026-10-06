import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasFXRunner } from '../fxRunner';
import { GameEngine, GameMap, Player, MemoryStorage } from '../../engine';
import { InputHandler } from '../input-handler';
import { SettingsManager } from '../../ui/settings/settingsManager';

// R-rend-8: a frame that throws must not end the effect loop with its promise unsettled
// (input stayed locked for the session). R-rend-9: overlapping batches each hold input.

describe('the effect loop survives a throwing frame', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('playEffects still settles when onFrame throws', async () => {
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
