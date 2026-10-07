import { ASYNC_STORE_KEYS, type AsyncKeyValueStore } from './asyncStore';

/**
 * Bulk records held in the asynchronous tier (ARCHITECTURE.md §5).
 *
 * The synchronous save keeps the whole run, every visited floor included; records kept
 * outside it — bestiary records, flight-recorder logs — belong here, where they do not
 * count against the synchronous quota.
 *
 * Backend-agnostic by construction: it speaks `AsyncKeyValueStore`, so it is IndexedDB in
 * the browser and an in-memory store headlessly.
 */
export class BulkArchive {
  constructor(private readonly store: AsyncKeyValueStore) {}

  public get backendName(): string {
    return this.store.backendName;
  }

  // ── Bestiary ──────────────────────────────────────────────────────────────
  public async putBestiary<T>(profileId: string, records: T): Promise<void> {
    await this.store.set(ASYNC_STORE_KEYS.bestiary(profileId), records);
  }

  public async getBestiary<T>(profileId: string): Promise<T | null> {
    return this.store.get<T>(ASYNC_STORE_KEYS.bestiary(profileId));
  }

  // ── Flight-recorder logs ──────────────────────────────────────────────────
  /** Archives a log dump under a caller-supplied label (e.g. a crash id). */
  public async archiveFlightLog<T>(label: string, events: T): Promise<void> {
    await this.store.set(ASYNC_STORE_KEYS.flightLog(label), events);
  }

  public async listFlightLogs(): Promise<string[]> {
    const keys = await this.store.keys('flightlog:');
    return keys.map((k) => k.slice('flightlog:'.length));
  }

  public async getFlightLog<T>(label: string): Promise<T | null> {
    return this.store.get<T>(ASYNC_STORE_KEYS.flightLog(label));
  }
}
