import { ASYNC_STORE_KEYS, type AsyncKeyValueStore } from './asyncStore';
import type { SerializedMap } from './types';

/**
 * Bulk records held in the asynchronous tier (ARCHITECTURE.md §5).
 *
 * The synchronous save keeps what a session needs to resume; anything that grows without
 * bound — every visited floor, bestiary records, flight-recorder logs — belongs here,
 * where it does not count against the synchronous quota.
 *
 * Backend-agnostic by construction: it speaks `AsyncKeyValueStore`, so it is IndexedDB in
 * the browser and an in-memory store headlessly.
 */
export class BulkArchive {
  constructor(private readonly store: AsyncKeyValueStore) {}

  public get backendName(): string {
    return this.store.backendName;
  }

  // ── Floors ────────────────────────────────────────────────────────────────
  public async putFloor(profileId: string, floorNumber: number, map: SerializedMap): Promise<void> {
    await this.store.set(ASYNC_STORE_KEYS.floor(profileId, floorNumber), map);
  }

  public async getFloor(profileId: string, floorNumber: number): Promise<SerializedMap | null> {
    return this.store.get<SerializedMap>(ASYNC_STORE_KEYS.floor(profileId, floorNumber));
  }

  /** Floor numbers archived for a profile, ascending. */
  public async listFloors(profileId: string): Promise<number[]> {
    const keys = await this.store.keys(`floor:${profileId}:`);
    return keys
      .map((k) => Number(k.slice(k.lastIndexOf(':') + 1)))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  public async deleteFloors(profileId: string): Promise<void> {
    for (const key of await this.store.keys(`floor:${profileId}:`)) {
      await this.store.delete(key);
    }
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
