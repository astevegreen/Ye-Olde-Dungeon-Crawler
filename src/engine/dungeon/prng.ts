export class PRNG {
  private s: number;

  constructor(seed: number = Date.now()) {
    this.s = seed | 0;
  }

  /**
   * Returns a pseudo-random floating point number between 0 (inclusive) and 1 (exclusive).
   * Mulberry32 algorithm.
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer between min (inclusive) and max (inclusive).
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Selects a random element from an array.
   */
  public choice<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from an empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Returns current internal state for serialization.
   */
  public getState(): number {
    return this.s;
  }

  /**
   * Restores internal state from a serialized state number.
   */
  public setState(state: number): void {
    this.s = state | 0;
  }
}
