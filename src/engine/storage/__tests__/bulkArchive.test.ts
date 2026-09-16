import { describe, it, expect, beforeEach } from 'vitest';
import { BulkArchive } from '../bulkArchive';
import { InMemoryAsyncStore, type AsyncKeyValueStore } from '../asyncStore';
import type { SerializedMap } from '../types';

/**
 * The asynchronous tier (ARCHITECTURE.md §5). These run against InMemoryAsyncStore: the
 * point is that BulkArchive speaks the interface, so the same code path works over
 * IndexedDB in the browser and in-memory headlessly.
 */
const fakeMap = (w: number): SerializedMap => ({ width: w, height: w, tiles: [] }) as unknown as SerializedMap;

let store: AsyncKeyValueStore;
let archive: BulkArchive;
beforeEach(() => {
  store = new InMemoryAsyncStore();
  archive = new BulkArchive(store);
});

describe('BulkArchive over the async tier', () => {
  it('round-trips a stored floor', async () => {
    await archive.putFloor('hero-1', 3, fakeMap(20));

    const loaded = await archive.getFloor('hero-1', 3);

    expect(loaded).toEqual(fakeMap(20));
  });

  it('lists a profile floors in order and keeps profiles separate', async () => {
    await archive.putFloor('hero-1', 5, fakeMap(10));
    await archive.putFloor('hero-1', 2, fakeMap(10));
    await archive.putFloor('hero-2', 9, fakeMap(10));

    expect(await archive.listFloors('hero-1')).toEqual([2, 5]);
    expect(await archive.listFloors('hero-2')).toEqual([9]);
  });

  it('deletes only the named profile floors', async () => {
    await archive.putFloor('hero-1', 1, fakeMap(10));
    await archive.putFloor('hero-2', 1, fakeMap(10));

    await archive.deleteFloors('hero-1');

    expect(await archive.listFloors('hero-1')).toEqual([]);
    expect(await archive.listFloors('hero-2')).toEqual([1]);
  });

  it('round-trips bestiary records and flight logs', async () => {
    await archive.putBestiary('hero-1', { kobold: { kills: 4 } });
    await archive.archiveFlightLog('crash-1', [{ type: 'error', summary: 'boom' }]);

    expect(await archive.getBestiary('hero-1')).toEqual({ kobold: { kills: 4 } });
    expect(await archive.listFlightLogs()).toEqual(['crash-1']);
    expect(await archive.getFlightLog('crash-1')).toEqual([{ type: 'error', summary: 'boom' }]);
  });

  it('returns null for absent records rather than throwing', async () => {
    expect(await archive.getFloor('nobody', 1)).toBeNull();
    expect(await archive.getBestiary('nobody')).toBeNull();
  });

  it('reports which backend is in use', () => {
    expect(archive.backendName).toBe('memory');
  });
});
