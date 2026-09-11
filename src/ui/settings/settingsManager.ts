import type { StorageAdapter } from '../../engine/storage/types';
import { MemoryStorage } from '../../engine/storage/profile-manager';
import { getBrowserStorage } from '../platform';

export interface ActionMetadata {
  id: string;
  name: string;
  category: 'Locomotion' | 'Combat & Magic' | 'Interaction & Inventory';
  defaultCodes: string[];
}

export const ACTION_METADATA: ActionMetadata[] = [
  // Locomotion
  { id: 'move_n', name: 'Move North', category: 'Locomotion', defaultCodes: ['ArrowUp', 'KeyW', 'KeyK', 'Numpad8'] },
  { id: 'move_s', name: 'Move South', category: 'Locomotion', defaultCodes: ['ArrowDown', 'KeyS', 'KeyJ', 'Numpad2'] },
  { id: 'move_w', name: 'Move West', category: 'Locomotion', defaultCodes: ['ArrowLeft', 'KeyA', 'KeyH', 'Numpad4'] },
  { id: 'move_e', name: 'Move East', category: 'Locomotion', defaultCodes: ['ArrowRight', 'KeyD', 'KeyL', 'Numpad6'] },
  { id: 'move_nw', name: 'Move Northwest', category: 'Locomotion', defaultCodes: ['Numpad7', 'KeyY'] },
  { id: 'move_ne', name: 'Move Northeast', category: 'Locomotion', defaultCodes: ['Numpad9', 'KeyU'] },
  { id: 'move_sw', name: 'Move Southwest', category: 'Locomotion', defaultCodes: ['Numpad1', 'KeyB'] },
  { id: 'move_se', name: 'Move Southeast', category: 'Locomotion', defaultCodes: ['Numpad3', 'KeyN'] },
  { id: 'wait', name: 'Wait / Pass Turn', category: 'Locomotion', defaultCodes: ['Space', 'Numpad5', 'Period'] },

  // Combat & Magic
  { id: 'cast_spell', name: 'Cast Spell / Grimoire', category: 'Combat & Magic', defaultCodes: ['KeyZ'] },
  { id: 'quick_spell_1', name: 'Quick Spell Slot 1', category: 'Combat & Magic', defaultCodes: ['Digit1'] },
  { id: 'quick_spell_2', name: 'Quick Spell Slot 2', category: 'Combat & Magic', defaultCodes: ['Digit2'] },
  { id: 'quick_spell_3', name: 'Quick Spell Slot 3', category: 'Combat & Magic', defaultCodes: ['Digit3'] },
  { id: 'quick_spell_4', name: 'Quick Spell Slot 4', category: 'Combat & Magic', defaultCodes: ['Digit4'] },
  { id: 'quick_spell_5', name: 'Quick Spell Slot 5', category: 'Combat & Magic', defaultCodes: ['Digit5'] },
  { id: 'quick_spell_6', name: 'Quick Spell Slot 6', category: 'Combat & Magic', defaultCodes: ['Digit6'] },
  { id: 'quick_spell_7', name: 'Quick Spell Slot 7', category: 'Combat & Magic', defaultCodes: ['Digit7'] },
  { id: 'quick_spell_8', name: 'Quick Spell Slot 8', category: 'Combat & Magic', defaultCodes: ['Digit8'] },
  { id: 'quick_spell_9', name: 'Quick Spell Slot 9', category: 'Combat & Magic', defaultCodes: ['Digit9'] },
  { id: 'quick_spell_0', name: 'Quick Spell Slot 10', category: 'Combat & Magic', defaultCodes: ['Digit0'] },

  // Interaction & Inventory
  { id: 'inventory', name: 'Open Inventory', category: 'Interaction & Inventory', defaultCodes: ['KeyI'] },
  { id: 'pickup', name: 'Pick Up Item', category: 'Interaction & Inventory', defaultCodes: ['KeyG', 'Comma'] },
  { id: 'quick_loot', name: 'Quick-Loot All Items', category: 'Interaction & Inventory', defaultCodes: ['Shift+KeyG', 'Shift+Comma'] },
  { id: 'close_door', name: 'Smart Close Door', category: 'Interaction & Inventory', defaultCodes: ['KeyC'] },
  { id: 'search', name: 'Search Secret Doors / Traps', category: 'Interaction & Inventory', defaultCodes: ['KeyS'] },
  { id: 'rest', name: 'Rest Until Healed', category: 'Interaction & Inventory', defaultCodes: ['KeyR'] },
  { id: 'stairs', name: 'Climb Stairs Up / Down', category: 'Interaction & Inventory', defaultCodes: ['Enter'] },
  { id: 'map', name: 'Explored Dungeon Map', category: 'Interaction & Inventory', defaultCodes: ['KeyM'] },
  { id: 'inspect', name: 'Inspect / Look Mode', category: 'Interaction & Inventory', defaultCodes: ['KeyX', 'KeyL'] },
  { id: 'compendium', name: 'Slayer Bestiary', category: 'Interaction & Inventory', defaultCodes: ['KeyB'] },
  { id: 'pact', name: 'Run Pacts & Bounties', category: 'Interaction & Inventory', defaultCodes: ['KeyP'] },
];

export interface GameSettings {
  arrowChordingEnabled: boolean;
  arrowChordBufferMs: number;
  mouseVectoringEnabled: boolean;
  keybinds: Record<string, string[]>;
}

export const SETTINGS_STORAGE_KEY = 'cotw_settings';

export function getDefaultKeybinds(): Record<string, string[]> {
  const binds: Record<string, string[]> = {};
  for (const meta of ACTION_METADATA) {
    binds[meta.id] = [...meta.defaultCodes];
  }
  return binds;
}

export function getDefaultSettings(): GameSettings {
  return {
    arrowChordingEnabled: true,
    arrowChordBufferMs: 40,
    mouseVectoringEnabled: true,
    keybinds: getDefaultKeybinds(),
  };
}

export class SettingsManager {
  private storage: StorageAdapter;
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();

  constructor(customStorage?: StorageAdapter) {
    this.storage = customStorage ?? getBrowserStorage() ?? new MemoryStorage();
    this.settings = this.loadSettings();
  }

  public getSettings(): Readonly<GameSettings> {
    return {
      ...this.settings,
      keybinds: { ...this.settings.keybinds },
    };
  }

  public updateSettings(partial: Partial<GameSettings>): void {
    if (partial.arrowChordBufferMs !== undefined) {
      // Clamp between 25ms and 75ms
      partial.arrowChordBufferMs = Math.max(25, Math.min(75, Math.round(partial.arrowChordBufferMs)));
    }
    this.settings = {
      ...this.settings,
      ...partial,
      keybinds: partial.keybinds ? { ...partial.keybinds } : this.settings.keybinds,
    };
    this.saveSettings();
    this.notify();
  }

  public getKeybinds(): Record<string, string[]> {
    return { ...this.settings.keybinds };
  }

  public getCodesForAction(actionId: string): string[] {
    return this.settings.keybinds[actionId] ? [...this.settings.keybinds[actionId]] : [];
  }

  public getActionForCode(code: string): string | undefined {
    for (const [actionId, codes] of Object.entries(this.settings.keybinds)) {
      if (codes.includes(code)) {
        return actionId;
      }
    }
    return undefined;
  }

  public bindKey(actionId: string, code: string): { conflictWith?: string } {
    let conflictWith: string | undefined;

    // Check conflict
    for (const [existingActionId, codes] of Object.entries(this.settings.keybinds)) {
      const idx = codes.indexOf(code);
      if (idx !== -1) {
        if (existingActionId === actionId) {
          return {}; // Already bound to this action
        }
        conflictWith = existingActionId;
        // Remove code from conflicting action
        this.settings.keybinds[existingActionId] = codes.filter((c) => c !== code);
      }
    }

    if (!this.settings.keybinds[actionId]) {
      this.settings.keybinds[actionId] = [];
    }
    this.settings.keybinds[actionId].push(code);

    this.saveSettings();
    this.notify();
    return { conflictWith };
  }

  public unbindKey(code: string): boolean {
    let removed = false;
    for (const [actionId, codes] of Object.entries(this.settings.keybinds)) {
      const idx = codes.indexOf(code);
      if (idx !== -1) {
        this.settings.keybinds[actionId] = codes.filter((c) => c !== code);
        removed = true;
      }
    }
    if (removed) {
      this.saveSettings();
      this.notify();
    }
    return removed;
  }

  public resetToDefaults(): void {
    this.settings = getDefaultSettings();
    this.saveSettings();
    this.notify();
  }

  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('[SettingsManager] Listener error:', err);
      }
    }
  }

  private loadSettings(): GameSettings {
    const defaults = getDefaultSettings();
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return defaults;

      return {
        arrowChordingEnabled: typeof parsed.arrowChordingEnabled === 'boolean' ? parsed.arrowChordingEnabled : defaults.arrowChordingEnabled,
        arrowChordBufferMs: typeof parsed.arrowChordBufferMs === 'number' ? Math.max(25, Math.min(75, parsed.arrowChordBufferMs)) : defaults.arrowChordBufferMs,
        mouseVectoringEnabled: typeof parsed.mouseVectoringEnabled === 'boolean' ? parsed.mouseVectoringEnabled : defaults.mouseVectoringEnabled,
        keybinds: typeof parsed.keybinds === 'object' && parsed.keybinds !== null ? { ...defaults.keybinds, ...parsed.keybinds } : defaults.keybinds,
      };
    } catch {
      return defaults;
    }
  }

  private saveSettings(): void {
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[SettingsManager] Failed to persist settings to storage:', err);
      }
    }
  }
}
