/**
 * Generic store for one engine's content registrations (ARCHITECTURE.md §3, P-22).
 *
 * Encapsulates a key-value collection scoped per GameEngine instance. Supports
 * registering values either with an explicit key or by extracting a key via an
 * optional key function (e.g. `(def) => def.id`).
 */
export class RegistryStore<K, V> {
  protected readonly entries = new Map<K, V>();
  protected readonly keyFn?: (value: V) => K;

  constructor(keyFn?: (value: V) => K) {
    this.keyFn = keyFn;
  }

  public register(value: V): void;
  public register(key: K, value: V): void;
  public register(keyOrVal: K | V, maybeVal?: V): void {
    if (maybeVal !== undefined) {
      this.entries.set(keyOrVal as K, maybeVal);
    } else if (this.keyFn) {
      const val = keyOrVal as V;
      this.entries.set(this.keyFn(val), val);
    } else {
      throw new Error('RegistryStore: keyFn required when registering value without explicit key');
    }
  }

  public registerAll(items: V[] | Record<string, V>): void {
    const list = Array.isArray(items) ? items : Object.values(items);
    for (const item of list) {
      this.register(item);
    }
  }

  public get(key: K): V | undefined {
    return this.entries.get(key);
  }

  public has(key: K): boolean {
    return this.entries.has(key);
  }

  public getAll(): V[] {
    return Array.from(this.entries.values());
  }

  public clear(): void {
    this.entries.clear();
  }

  /** Copies another store's registrations into this one. */
  public seedFrom(other: RegistryStore<K, V>): void {
    for (const [key, value] of other.entries.entries()) {
      this.entries.set(key, value);
    }
  }
}
