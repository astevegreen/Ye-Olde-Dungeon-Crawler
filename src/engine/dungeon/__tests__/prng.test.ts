import { describe, expect, it } from 'vitest';
import { PRNG } from '../prng';

describe('PRNG state', () => {
  it('keeps its state within int32 so getState() round-trips through setState()', () => {
    const a = new PRNG(12345);
    for (let i = 0; i < 10; i++) a.next();
    expect(a.getState()).toBe(a.getState() | 0);

    const b = new PRNG();
    b.setState(a.getState());
    expect(b.getState()).toBe(a.getState());
    expect(Array.from({ length: 50 }, () => b.next())).toEqual(Array.from({ length: 50 }, () => a.next()));
  });

  it('produces the same stream as the unwrapped implementation did', () => {
    // First values of seed 42 under the original `this.s += 0x6d2b79f5` code, which read
    // `s` only mod 2^32: wrapping the state must not change any outcome.
    let s = 42;
    const legacy = (): number => {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = new PRNG(42);
    for (let i = 0; i < 1000; i++) expect(rng.next()).toBe(legacy());
  });
});
