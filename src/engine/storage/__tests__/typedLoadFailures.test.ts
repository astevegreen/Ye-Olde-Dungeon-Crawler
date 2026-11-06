import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileManager } from '../profile-manager';
import { AutosaveManager } from '../autosaveManager';
import { CURRENT_SCHEMA_VERSION, SchemaMigrator } from '../migrator';
import { classifyLoadError, migrateForLoad, SaveLoadError, shouldNotifyPlayer } from '../loadResult';

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
    storage.setItem(`${pm.saveKeyPrefix}hero-1`, '{ this is not json');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const outcome = pm.loadCharacterResult('hero-1');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('(corrupt)'), expect.anything());
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
      `${pm.saveKeyPrefix}hero-2`,
      JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 5, contentManifestId: 'cotw', timestamp: 1, data: {} })
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const outcome = pm.loadCharacterResult('hero-2');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('(newer-than-engine)'), expect.anything());
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

    storage.setItem(am.autosaveKey, '{ broken');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const corrupt = am.loadAutosaveResult();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('(corrupt)'), expect.anything());
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

  // The version floor (§5): a save below it is refused as migration-failed, from either slot.
  const belowFloor = () =>
    JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION - 1, contentManifestId: 'cotw', timestamp: 1, data: { player: {}, map: {} } });

  it('reports a character save below the version floor as migration-failed', () => {
    const pm = new ProfileManager(storage as any);
    storage.setItem(`${pm.saveKeyPrefix}hero-old`, belowFloor());
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(pm.loadCharacterResult('hero-old')).toMatchObject({ ok: false, reason: 'migration-failed' });
  });

  it('reports an autosave below the version floor as migration-failed, and a newer one as newer-than-engine', () => {
    const am = new AutosaveManager(storage as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const withProfile = (raw: string) => JSON.stringify({ ...JSON.parse(raw), profile: { id: 'x', name: 'X' } });

    storage.setItem(am.autosaveKey, withProfile(belowFloor()));
    expect(am.loadAutosaveResult()).toMatchObject({ ok: false, reason: 'migration-failed' });

    storage.setItem(am.autosaveKey, withProfile(JSON.stringify({ ...JSON.parse(belowFloor()), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })));
    expect(am.loadAutosaveResult()).toMatchObject({ ok: false, reason: 'newer-than-engine' });
  });

  it('reports a forward step that throws as migration-failed', () => {
    const migrator = new SchemaMigrator();
    migrator.registerMigration(CURRENT_SCHEMA_VERSION - 1, CURRENT_SCHEMA_VERSION, () => {
      throw new Error('bad step');
    });

    expect(classifyLoadError(captured(() => migrateForLoad(belowFloor(), migrator)))).toMatchObject({ reason: 'migration-failed' });
  });

  // The reason comes from the save, not from how an error happens to be worded.
  it('classifies by the error type, never by its wording', () => {
    expect(classifyLoadError(new Error('Schema migration of the vault layout failed'))).toMatchObject({ reason: 'corrupt' });
    expect(classifyLoadError(new Error('floor 9 is newer than engine version 3'))).toMatchObject({ reason: 'corrupt' });
    expect(classifyLoadError(new SaveLoadError('newer-than-engine', 'any words'))).toMatchObject({
      reason: 'newer-than-engine',
      message: expect.stringMatching(/newer version/i),
      detail: 'any words',
    });
  });
});

function captured(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected a throw');
}
