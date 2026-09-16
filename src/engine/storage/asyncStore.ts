/**
 * Asynchronous storage tier (ARCHITECTURE.md §5).
 *
 * The synchronous browser store is quota-bound, which is fine for a character save but
 * not for the bulk data the game accumulates: every visited floor, bestiary records, and
 * flight-recorder logs. This is the interface that tier speaks.
 *
 * It lives in the engine as a *contract only*. `indexedDB` is a browser global, and engine
 * code may not touch those (§2), so the browser implementation lives in `src/ui/` and is
 * injected — the same arrangement as the synchronous `Storage` adapter.
 */
export interface AsyncKeyValueStore {
  /** Human-readable name, for diagnostics. */
  readonly backendName: string;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * In-memory tier. Used headlessly (tests, `npm run sim`, Node tooling) where no IndexedDB
 * exists, so engine code can depend on the tier without depending on a browser.
 */
export class InMemoryAsyncStore implements AsyncKeyValueStore {
  public readonly backendName = 'memory';
  private readonly data = new Map<string, string>();

  public async get<T = unknown>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  public async set<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }

  public async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  public async keys(prefix?: string): Promise<string[]> {
    const all = [...this.data.keys()];
    return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
  }

  public async clear(): Promise<void> {
    this.data.clear();
  }
}

/** Key prefixes, so one store can hold every kind of bulk record without collisions. */
export const ASYNC_STORE_KEYS = {
  /** A single stored floor: `floor:<profileId>:<floorNumber>`. */
  floor: (profileId: string, floorNumber: number) => `floor:${profileId}:${floorNumber}`,
  /** Bestiary records for a profile. */
  bestiary: (profileId: string) => `bestiary:${profileId}`,
  /** A flight-recorder log dump, keyed by when it was archived. */
  flightLog: (label: string) => `flightlog:${label}`,
} as const;
