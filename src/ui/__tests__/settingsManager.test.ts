import { describe, it, expect, beforeEach } from 'vitest';
import {
  SettingsManager,
  SETTINGS_STORAGE_KEY,
} from '../settings/settingsManager';
import { MemoryStorage } from '../../engine/storage/profile-manager';

describe('SettingsManager', () => {
  let storage: MemoryStorage;
  let manager: SettingsManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new SettingsManager(storage);
  });

  it('initializes with default settings when storage is empty', () => {
    const settings = manager.getSettings();
    expect(settings.arrowChordingEnabled).toBe(true);
    expect(settings.arrowChordBufferMs).toBe(40);
    expect(settings.mouseVectoringEnabled).toBe(true);
    expect(settings.keybinds.move_n).toContain('ArrowUp');
    expect(settings.keybinds.cast_spell).toContain('KeyZ');
  });

  it('persists changes to storage under dedicated cotw_settings key', () => {
    manager.updateSettings({
      arrowChordingEnabled: false,
      arrowChordBufferMs: 60,
      mouseVectoringEnabled: false,
    });

    const storedJson = storage.getItem(SETTINGS_STORAGE_KEY);
    expect(storedJson).not.toBeNull();
    const parsed = JSON.parse(storedJson!);
    expect(parsed.arrowChordingEnabled).toBe(false);
    expect(parsed.arrowChordBufferMs).toBe(60);
    expect(parsed.mouseVectoringEnabled).toBe(false);

    // Re-instantiating manager loads persisted values
    const newManager = new SettingsManager(storage);
    const loaded = newManager.getSettings();
    expect(loaded.arrowChordingEnabled).toBe(false);
    expect(loaded.arrowChordBufferMs).toBe(60);
    expect(loaded.mouseVectoringEnabled).toBe(false);
  });

  it('clamps arrowChordBufferMs between 25ms and 75ms', () => {
    manager.updateSettings({ arrowChordBufferMs: 10 });
    expect(manager.getSettings().arrowChordBufferMs).toBe(25);

    manager.updateSettings({ arrowChordBufferMs: 120 });
    expect(manager.getSettings().arrowChordBufferMs).toBe(75);
  });

  it('detects and resolves conflicts when rebinding keys', () => {
    // KeyZ is originally bound to cast_spell
    expect(manager.getCodesForAction('cast_spell')).toContain('KeyZ');

    const result = manager.bindKey('move_n', 'KeyZ');
    expect(result.conflictWith).toBe('cast_spell');

    // KeyZ is now bound to move_n and removed from cast_spell
    expect(manager.getCodesForAction('move_n')).toContain('KeyZ');
    expect(manager.getCodesForAction('cast_spell')).not.toContain('KeyZ');
    expect(manager.getActionForCode('KeyZ')).toBe('move_n');
  });

  it('allows unbinding specific keys', () => {
    manager.unbindKey('ArrowUp');
    expect(manager.getCodesForAction('move_n')).not.toContain('ArrowUp');
  });

  it('resets all settings and keybinds to defaults', () => {
    manager.updateSettings({
      arrowChordingEnabled: false,
      arrowChordBufferMs: 65,
      mouseVectoringEnabled: false,
    });
    manager.unbindKey('ArrowUp');
    manager.unbindKey('KeyZ');

    manager.resetToDefaults();
    const settings = manager.getSettings();
    expect(settings.arrowChordingEnabled).toBe(true);
    expect(settings.arrowChordBufferMs).toBe(40);
    expect(settings.mouseVectoringEnabled).toBe(true);
    expect(settings.keybinds.move_n).toContain('ArrowUp');
    expect(settings.keybinds.cast_spell).toContain('KeyZ');
  });

  it('notifies listeners when settings change', () => {
    let notified = false;
    const unsub = manager.subscribe((newSettings) => {
      if (!newSettings.arrowChordingEnabled) {
        notified = true;
      }
    });

    manager.updateSettings({ arrowChordingEnabled: false });
    expect(notified).toBe(true);

    unsub();
    notified = false;
    manager.updateSettings({ arrowChordingEnabled: true });
    expect(notified).toBe(false);
  });
});
