/**
 * Seeded PRNG (mulberry32) for harness action decisions.
 * Guarantees strict determinism for soak runs given a SOAK_SEED.
 */
export class SoakPrng {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }

  /** Uniform float in [0, 1) */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Picks an element uniformly from array */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  /** Picks an element with weighted probability */
  public weightedPick<T>(items: Array<{ item: T; weight: number }>): T {
    const total = items.reduce((sum, it) => sum + Math.max(0, it.weight), 0);
    if (total <= 0) return items[0].item;
    let r = this.next() * total;
    for (const it of items) {
      if (it.weight <= 0) continue;
      if (r < it.weight) return it.item;
      r -= it.weight;
    }
    return items[items.length - 1].item;
  }
}
