import { describe, it, expect } from 'vitest';
import { PortraitStore } from '../atlas/portraits';
import type { PixelSprite } from '../../engine';

// A portrait whose pixels name the frame and size they were baked for, counting each bake.
function sprite(frames = 4): PixelSprite & { bakes: string[] } {
  const bakes: string[] = [];
  return {
    frames,
    bakes,
    render: (frame, size) => {
      bakes.push(`${frame}@${size}`);
      return new Uint8ClampedArray([frame, size % 256, 0, 255]);
    },
  };
}

// Deferred work queued by hand, so a test runs the warm-up one task at a time.
function queue() {
  const tasks: Array<() => void> = [];
  return {
    defer: (fn: () => void) => tasks.push(fn),
    run: (n = Infinity) => {
      for (let i = 0; i < n && tasks.length; i++) tasks.shift()!();
    },
    get pending() {
      return tasks.length;
    },
  };
}

describe('PortraitStore', () => {
  it('has nothing for a pack without portraits, or a creature without one', () => {
    const none = new PortraitStore();
    expect(none.any).toBe(false);
    expect(none.frameCount('draugr')).toBe(0);
    expect(none.pixels('draugr', 192, 0)).toBeNull();
    const some = new PortraitStore({ draugr: sprite() });
    expect(some.any).toBe(true);
    expect(some.frameCount('draugr')).toBe(4);
    expect(some.frameCount('wolf')).toBe(0);
    expect(some.pixels('wolf', 192, 0)).toBeNull();
  });

  it('bakes frame 0 when a window first asks, and holds it until the asked frame is baked', () => {
    const draugr = sprite();
    const q = queue();
    const store = new PortraitStore({ draugr }, q.defer);
    expect(store.pixels('draugr', 192, 2)?.[0]).toBe(0);
    expect(draugr.bakes).toEqual(['0@192']);
    store.pixels('draugr', 192, 0);
    expect(draugr.bakes).toEqual(['0@192']);
  });

  it('warms the other frames one per task, once, and then shows them', () => {
    const draugr = sprite();
    const q = queue();
    const store = new PortraitStore({ draugr }, q.defer);
    store.pixels('draugr', 96, 0);
    store.warm('draugr', 96);
    store.warm('draugr', 96);
    expect(q.pending).toBe(1);
    q.run(1);
    expect(draugr.bakes).toEqual(['0@96', '1@96']);
    expect(store.pixels('draugr', 96, 1)?.[0]).toBe(1);
    q.run();
    expect(draugr.bakes).toEqual(['0@96', '1@96', '2@96', '3@96']);
    expect(store.pixels('draugr', 96, 3)?.[0]).toBe(3);
    expect(q.pending).toBe(0);
  });

  it('keeps each size apart, and drops the least recently shown past eight', () => {
    const draugr = sprite(1);
    const store = new PortraitStore({ draugr }, () => {});
    for (let size = 1; size <= 9; size++) store.pixels('draugr', size, 0);
    expect(draugr.bakes).toHaveLength(9);
    store.pixels('draugr', 9, 0);
    expect(draugr.bakes).toHaveLength(9);
    store.pixels('draugr', 1, 0);
    expect(draugr.bakes.at(-1)).toBe('0@1');
  });

  it('stops warming a portrait dropped from the cache', () => {
    const draugr = sprite();
    const q = queue();
    const store = new PortraitStore({ draugr }, q.defer);
    store.pixels('draugr', 192, 0);
    store.warm('draugr', 192);
    for (let size = 1; size <= 8; size++) store.pixels('draugr', size, 0);
    q.run();
    expect(draugr.bakes.filter((b) => b.endsWith('@192'))).toEqual(['0@192']);
  });
});
