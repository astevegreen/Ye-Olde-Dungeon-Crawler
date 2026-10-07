import { describe, it, expect, beforeEach } from 'vitest';
import { BulkArchive } from '../bulkArchive';
import { InMemoryAsyncStore, type AsyncKeyValueStore } from '../asyncStore';

/**
 * The asynchronous tier (ARCHITECTURE.md §5). These run against InMemoryAsyncStore: the
 * point is that BulkArchive speaks the interface, so the same code path works over
 * IndexedDB in the browser and in-memory headlessly.
 */
let store: AsyncKeyValueStore;
let archive: BulkArchive;
beforeEach(() => {
  store = new InMemoryAsyncStore();
  archive = new BulkArchive(store);
});

describe('BulkArchive over the async tier', () => {
  it('round-trips bestiary records and flight logs', async () => {
    await archive.putBestiary('hero-1', { kobold: { kills: 4 } });
    await archive.archiveFlightLog('crash-1', [{ type: 'error', summary: 'boom' }]);

    expect(await archive.getBestiary('hero-1')).toEqual({ kobold: { kills: 4 } });
    expect(await archive.listFlightLogs()).toEqual(['crash-1']);
    expect(await archive.getFlightLog('crash-1')).toEqual([{ type: 'error', summary: 'boom' }]);
  });

  it('returns null for absent records rather than throwing', async () => {
    expect(await archive.getBestiary('nobody')).toBeNull();
    expect(await archive.getFlightLog('nothing')).toBeNull();
  });

  it('reports which backend is in use', () => {
    expect(archive.backendName).toBe('memory');
  });
});
