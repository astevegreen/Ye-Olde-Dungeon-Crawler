import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileManager, SAVE_KEY_PREFIX } from '../profile-manager';
import { AutosaveManager } from '../autosaveManager';
import { CURRENT_SCHEMA_VERSION } from '../migrator';
import { shouldNotifyPlayer } from '../loadResult';

/**
 * Loads report why they failed (ARCHITECTURE.md §5). Callers must be able to tell
 * "nothing saved here" from "this save is damaged", and the player must be told about
 * everything except the former.
 */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); });


describe('Typed load failures', () => {
  it('reports a missing save as missing, and does not notify', () => {
    const pm = new ProfileManager(storage as any);

    const outcome = pm.loadCharacterResult('no-such-hero');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('missing');
      expect(shouldNotifyPlayer(outcome)).toBe(false);
    }
  });

  it('reports unparseable JSON as corrupt, and notifies', () => {
    const pm = new ProfileManager(storage as any);
    storage.setItem(`${SAVE_KEY_PREFIX}hero-1`, '{ this is not json');

    const outcome = pm.loadCharacterResult('hero-1');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('corrupt');
      expect(shouldNotifyPlayer(outcome)).toBe(true);
      expect(outcome.message).toMatch(/damaged/i);
      expect(outcome.detail).toBeTruthy();
    }
  });

  it('reports a save from a newer engine distinctly', () => {
    const pm = new ProfileManager(storage as any);
    storage.setItem(
      `${SAVE_KEY_PREFIX}hero-2`,
      JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 5, contentManifestId: 'cotw', timestamp: 1, data: {} })
    );

    const outcome = pm.loadCharacterResult('hero-2');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('newer-than-engine');
      expect(shouldNotifyPlayer(outcome)).toBe(true);
      expect(outcome.message).toMatch(/newer version/i);
    }
  });

  it('distinguishes a missing autosave from a damaged one', () => {
    const am = new AutosaveManager(storage as any);

    const missing = am.loadAutosaveResult();
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe('missing');

    storage.setItem(AutosaveManager.AUTOSAVE_KEY, '{ broken');
    const corrupt = am.loadAutosaveResult();
    expect(corrupt.ok).toBe(false);
    if (!corrupt.ok) {
      expect(corrupt.reason).toBe('corrupt');
      expect(shouldNotifyPlayer(corrupt)).toBe(true);
    }
  });

  it('keeps the null-returning wrappers working for existing callers', () => {
    const pm = new ProfileManager(storage as any);
    expect(pm.loadCharacter('no-such-hero')).toBeNull();
  });
});
