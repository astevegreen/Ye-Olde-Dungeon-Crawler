import type { AsyncKeyValueStore } from '../engine';

/**
 * IndexedDB implementation of the engine's asynchronous storage tier (ARCHITECTURE.md §5).
 *
 * This lives in `src/ui/` because `indexedDB` is a browser global and engine code may not
 * touch those (§2). The composition root injects it; headless callers get
 * `InMemoryAsyncStore` instead.
 */
const DB_NAME = 'cotw';
const DB_VERSION = 1;
const STORE_NAME = 'bulk';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDbStore implements AsyncKeyValueStore {
  public readonly backendName = 'indexeddb';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= openDatabase();
    return this.dbPromise;
  }

  private async withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    const tx = db.transaction(STORE_NAME, mode);
    const result = await runRequest(fn(tx.objectStore(STORE_NAME)));
    return result;
  }

  public async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.withStore<unknown>('readonly', (store) => store.get(key));
    return (value as T) ?? null;
  }

  public async set<T = unknown>(key: string, value: T): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(value as unknown as never, key));
  }

  public async delete(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  public async keys(prefix?: string): Promise<string[]> {
    const keys = await this.withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    const asStrings = keys.map(String);
    return prefix ? asStrings.filter((k) => k.startsWith(prefix)) : asStrings;
  }

  public async clear(): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear());
  }
}

/** The IndexedDB tier when the browser provides one, otherwise null (caller falls back). */
export function getBrowserAsyncStore(): AsyncKeyValueStore | null {
  if (typeof indexedDB === 'undefined') return null;
  return new IndexedDbStore();
}
