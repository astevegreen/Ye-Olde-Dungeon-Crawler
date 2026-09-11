import { flightRecorder } from '../engine/debug/flightRecorder';

export interface StoragePersistenceInfo {
  persisted: boolean;
  quotaBytes?: number;
  usageBytes?: number;
  quotaMB?: number;
  usageMB?: number;
  mode: 'persistent' | 'standard' | 'unsupported';
  timestamp: number;
}

let cachedPersistenceInfo: StoragePersistenceInfo | null = null;

/**
 * Negotiates storage persistence with the browser StorageManager API.
 * Requests persistent storage and measures current quota and usage.
 * Pure and safe in Node / headless test environments.
 */
export async function initStoragePersistence(): Promise<StoragePersistenceInfo> {
  const timestamp = Date.now();

  if (typeof navigator === 'undefined' || !navigator.storage) {
    const info: StoragePersistenceInfo = {
      persisted: false,
      mode: 'unsupported',
      timestamp,
    };
    cachedPersistenceInfo = info;
    return info;
  }

  let persisted = false;
  try {
    if (typeof navigator.storage.persisted === 'function') {
      persisted = await navigator.storage.persisted();
    }
    if (!persisted && typeof navigator.storage.persist === 'function') {
      persisted = await navigator.storage.persist();
    }
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('Storage persistence negotiation warning:', err);
    }
  }

  let quotaBytes: number | undefined;
  let usageBytes: number | undefined;
  let quotaMB: number | undefined;
  let usageMB: number | undefined;

  try {
    if (typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota;
      usageBytes = estimate.usage;
      if (typeof quotaBytes === 'number') {
        quotaMB = Math.round((quotaBytes / (1024 * 1024)) * 100) / 100;
      }
      if (typeof usageBytes === 'number') {
        usageMB = Math.round((usageBytes / (1024 * 1024)) * 100) / 100;
      }
    }
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('Storage estimate measurement warning:', err);
    }
  }

  const mode = persisted ? 'persistent' : 'standard';
  const info: StoragePersistenceInfo = {
    persisted,
    quotaBytes,
    usageBytes,
    quotaMB,
    usageMB,
    mode,
    timestamp,
  };

  cachedPersistenceInfo = info;

  // Record into engine telemetry flight recorder
  flightRecorder.record({
    type: 'state',
    summary: `Storage mode: ${mode} (Persisted: ${persisted}, Used: ${usageMB ?? 0} MB / ${quotaMB ?? 0} MB)`,
    details: {
      persisted,
      quotaBytes,
      usageBytes,
      quotaMB,
      usageMB,
      mode,
    },
  });

  return info;
}

/**
 * Returns the cached storage persistence information, or null if not yet negotiated.
 */
export function getStoragePersistenceInfo(): StoragePersistenceInfo | null {
  return cachedPersistenceInfo;
}

/**
 * Helper to format storage status for UI badges and tooltips.
 */
export function formatStorageStatus(info: StoragePersistenceInfo | null): {
  badge: string;
  badgeClass: string;
  tooltip: string;
  isPersistent: boolean;
} {
  if (!info || info.mode === 'unsupported') {
    return {
      badge: 'Storage: Standard',
      badgeClass: 'storage-standard',
      tooltip: 'Standard browser storage. Export save file recommended to prevent cache eviction.',
      isPersistent: false,
    };
  }

  if (info.persisted || info.mode === 'persistent') {
    const quotaText = info.quotaMB ? ` (${info.usageMB ?? 0}MB / ${info.quotaMB}MB)` : '';
    return {
      badge: `Storage: Persistent 🛡️${quotaText}`,
      badgeClass: 'storage-persistent',
      tooltip: `Storage is protected against browser cache clearing.${quotaText}`,
      isPersistent: true,
    };
  }

  const quotaText = info.quotaMB ? ` (${info.usageMB ?? 0}MB / ${info.quotaMB}MB)` : '';
  return {
    badge: `Storage: Standard ⚠️${quotaText}`,
    badgeClass: 'storage-standard',
    tooltip: 'Storage may be evicted if browser runs low on disk space. Export save file recommended.',
    isPersistent: false,
  };
}
