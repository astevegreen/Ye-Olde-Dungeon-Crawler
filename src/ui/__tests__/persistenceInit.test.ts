import { describe, it, expect } from 'vitest';
import { initStoragePersistence, formatStorageStatus } from '../persistenceInit';

describe('Storage Persistence Negotiation (Headless)', () => {
  it('executes safely in headless environment with unsupported mode', async () => {
    const info = await initStoragePersistence();
    expect(info.persisted).toBe(false);
    expect(info.mode).toBe('unsupported');

    const formatted = formatStorageStatus(info);
    expect(formatted.isPersistent).toBe(false);
    expect(formatted.badge).toContain('Standard');
  });

  it('formats persistent storage badges correctly', () => {
    const formatted = formatStorageStatus({
      persisted: true,
      mode: 'persistent',
      quotaMB: 500,
      usageMB: 12.5,
      timestamp: Date.now(),
    });
    expect(formatted.isPersistent).toBe(true);
    expect(formatted.badge).toContain('Persistent 🛡️');
    expect(formatted.badge).toContain('12.5MB / 500MB');
  });
});
