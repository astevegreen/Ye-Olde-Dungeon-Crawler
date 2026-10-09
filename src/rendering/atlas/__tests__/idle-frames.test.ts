import { describe, it, expect, vi } from 'vitest';
import { IDLE_FRAME_MS, IdleIcons, IdleTicker, idleFrame, idlePhase } from '../idle-frames';

const at = (step: number) => step * IDLE_FRAME_MS + 1;
const run = (frames: number, phase = 0) => Array.from({ length: 6 }, (_, s) => idleFrame(at(s), frames, phase));

describe('idle frames', () => {
  it('runs four frames round, three back and forth, two alternating, one still', () => {
    expect(run(4)).toEqual([0, 1, 2, 3, 0, 1]);
    expect(run(3)).toEqual([0, 1, 2, 1, 0, 1]);
    expect(run(2)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(run(1)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('runs a longer loop (an item’s aura) straight through, and round', () => {
    expect(run(16)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(run(16, -1)).toEqual([15, 0, 1, 2, 3, 4]);
    expect(idleFrame(at(21), 16)).toBe(5);
  });

  it('offsets a sprite by whole steps, so a room of one creature does not breathe in step', () => {
    expect(run(4, 1)).toEqual([1, 2, 3, 0, 1, 2]);
    expect(run(4, -1)).toEqual([3, 0, 1, 2, 3, 0]);
  });

  it('phases by id: the same id always, within one loop', () => {
    expect(idlePhase('wolf-12')).toBe(idlePhase('wolf-12'));
    const phases = new Set(['a', 'wolf-1', 'wolf-2', 'wolf-3', 'player', 'npc-ivalda'].map(idlePhase));
    for (const p of phases) expect(p).toBeGreaterThanOrEqual(0);
    for (const p of phases) expect(p).toBeLessThan(4);
    expect(phases.size).toBeGreaterThan(1);
  });
});

function timers() {
  const queue: Array<() => void> = [];
  const setTimeout = vi.fn((fn: () => void, _ms: number) => queue.push(fn));
  const requestAnimationFrame = vi.fn((fn: () => void) => queue.push(fn));
  const flush = () => {
    while (queue.length) (queue.shift() as () => void)();
  };
  return { setTimeout, requestAnimationFrame, flush };
}

describe('IdleTicker', () => {
  it('redraws once when the next frame turns over, on an animation frame', () => {
    const t = timers();
    const redraw = vi.fn();
    const ticker = new IdleTicker(redraw, t);
    ticker.request(IDLE_FRAME_MS * 7 + 60);
    ticker.request(IDLE_FRAME_MS * 7 + 90);
    expect(t.setTimeout).toHaveBeenCalledTimes(1);
    expect(t.setTimeout.mock.calls[0][1]).toBe(IDLE_FRAME_MS - 60);
    t.flush();
    expect(t.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(redraw).toHaveBeenCalledTimes(1);

    ticker.request(IDLE_FRAME_MS * 8);
    t.flush();
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it('draws nothing after it stops, nor without timers', () => {
    const t = timers();
    const redraw = vi.fn();
    const ticker = new IdleTicker(redraw, t);
    ticker.request(0);
    ticker.stop();
    t.flush();
    ticker.request(0);
    t.flush();
    expect(redraw).not.toHaveBeenCalled();

    expect(() => new IdleTicker(redraw, null).request(0)).not.toThrow();
    expect(redraw).not.toHaveBeenCalled();
  });
});

describe('IdleIcons', () => {
  const icon = (isConnected = true) => ({ isConnected }) as HTMLCanvasElement;

  it('repaints each icon still on the page at the next frame, once, and forgets the rest', () => {
    const t = timers();
    const paint = vi.fn();
    const icons = new IdleIcons<string>(paint, t);
    const shown = icon();
    const gone = icon(false);
    icons.watch(shown, 'ring', 10);
    icons.watch(shown, 'ring', 20);
    icons.watch(gone, 'sword', 30);
    expect(t.setTimeout).toHaveBeenCalledTimes(1);
    t.flush();
    expect(paint.mock.calls).toEqual([[shown, 'ring']]);
    t.flush();
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('paints nothing after it stops', () => {
    const t = timers();
    const paint = vi.fn();
    const icons = new IdleIcons<string>(paint, t);
    icons.watch(icon(), 'ring', 0);
    icons.stop();
    t.flush();
    expect(paint).not.toHaveBeenCalled();
  });
});
