import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SettingsManager,
  SETTINGS_STORAGE_KEY,
  getDefaultKeybinds,
} from '../settings/settingsManager';
import { MemoryStorage } from '../../engine';

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
    expect(settings.mouseVectoringEnabled).toBe(false);
    expect(settings.keybinds.move_n).toContain('ArrowUp');
    expect(settings.keybinds.cast_spell).toContain('KeyZ');
    expect(settings.keybinds.radial_menu).toContain('KeyV');
  });

  it('ignores the radial slots older settings saved: the wheel is the companion\'s now', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ radialMenuSlots: [{ type: 'spell', spellId: 'firebolt' }] }));
    const loaded = new SettingsManager(storage).getSettings();
    expect('radialMenuSlots' in loaded).toBe(false);
    expect(loaded.keybinds.radial_menu).toContain('KeyV');
  });

  it('persists changes to storage under dedicated yodc_settings key', () => {
    manager.updateSettings({
      arrowChordingEnabled: false,
      arrowChordBufferMs: 60,
      mouseVectoringEnabled: true,
    });

    const storedJson = storage.getItem(SETTINGS_STORAGE_KEY);
    expect(storedJson).not.toBeNull();
    const parsed = JSON.parse(storedJson!);
    expect(parsed.arrowChordingEnabled).toBe(false);
    expect(parsed.arrowChordBufferMs).toBe(60);
    expect(parsed.mouseVectoringEnabled).toBe(true);

    // Re-instantiating manager loads persisted values
    const newManager = new SettingsManager(storage);
    const loaded = newManager.getSettings();
    expect(loaded.arrowChordingEnabled).toBe(false);
    expect(loaded.arrowChordBufferMs).toBe(60);
    expect(loaded.mouseVectoringEnabled).toBe(true);
  });

  it('aims with the mouse by default, and remembers a player who turns it off (tracker 4.4)', () => {
    expect(manager.getSettings().mouseAimEnabled).toBe(true);
    manager.updateSettings({ mouseAimEnabled: false });
    expect(new SettingsManager(storage).getSettings().mouseAimEnabled).toBe(false);
    // Settings saved before the option existed load with it on.
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ arrowChordingEnabled: true }));
    expect(new SettingsManager(storage).getSettings().mouseAimEnabled).toBe(true);
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

  it('saves and announces taking a key from another action that the action already holds (R-ui-10)', () => {
    // A blob saved before 23 Sep: S was Move South's as well as Search's.
    const legacy = getDefaultKeybinds();
    legacy.move_s = ['ArrowDown', 'KeyS', 'KeyJ', 'Numpad2'];
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ keybinds: legacy }));
    const stale = new SettingsManager(storage);
    const heard = vi.fn();
    stale.subscribe(heard);

    expect(stale.bindKey('search', 'KeyS').conflictWith).toBe('move_s');

    expect(heard).toHaveBeenCalledTimes(1);
    expect(new SettingsManager(storage).getCodesForAction('move_s')).toEqual(['ArrowDown', 'KeyJ', 'Numpad2']);
    expect(new SettingsManager(storage).getCodesForAction('search')).toEqual(['KeyS']);
    // A key the action alone holds changes nothing, so nothing is announced.
    expect(stale.bindKey('search', 'KeyS')).toEqual({});
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('saves only the actions whose keys differ from the defaults, so later defaults reach the rest (R-ui-10)', () => {
    manager.bindKey('move_n', 'KeyV');
    manager.updateSettings({ torchlightEnabled: false });

    const saved = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(Object.keys(saved.keybinds).sort()).toEqual(['move_n', 'radial_menu']);
    expect(saved.keybinds.radial_menu).toEqual([]);

    // A blob from before, holding every action: the ones equal to today's defaults drop out.
    const legacy = getDefaultKeybinds();
    legacy.rest = ['KeyN'];
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ keybinds: legacy }));
    const loaded = new SettingsManager(storage);
    expect(loaded.getCodesForAction('rest')).toEqual(['KeyN']);
    loaded.updateSettings({ torchlightEnabled: true });
    expect(Object.keys(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)!).keybinds)).toEqual(['rest']);
  });

  it('reads each saved action as a list of key codes, and drops what is not (R-ui-10)', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ keybinds: { move_n: null, move_s: ['ArrowDown', 5, null, 'KeyJ'], wait: 'Space', no_such_action: ['KeyQ'] } })
    );
    const loaded = new SettingsManager(storage);

    expect(loaded.getCodesForAction('move_n')).toEqual(getDefaultKeybinds().move_n);
    expect(loaded.getCodesForAction('move_s')).toEqual(['ArrowDown', 'KeyJ']);
    expect(loaded.getCodesForAction('wait')).toEqual(getDefaultKeybinds().wait);
    expect(loaded.getKeybinds()).not.toHaveProperty('no_such_action');
    expect(() => loaded.getActionForCode('KeyX')).not.toThrow();
  });

  it('allows unbinding specific keys', () => {
    manager.unbindKey('ArrowUp');
    expect(manager.getCodesForAction('move_n')).not.toContain('ArrowUp');
  });

  it('resets all settings and keybinds to defaults', () => {
    manager.updateSettings({
      arrowChordingEnabled: false,
      arrowChordBufferMs: 65,
      mouseVectoringEnabled: true,
    });
    manager.unbindKey('ArrowUp');
    manager.unbindKey('KeyZ');

    manager.resetToDefaults();
    const settings = manager.getSettings();
    expect(settings.arrowChordingEnabled).toBe(true);
    expect(settings.arrowChordBufferMs).toBe(40);
    expect(settings.mouseVectoringEnabled).toBe(false);
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
