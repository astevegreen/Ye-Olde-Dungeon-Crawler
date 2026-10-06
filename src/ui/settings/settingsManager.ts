import type { StorageAdapter } from '../../engine';
import { MemoryStorage } from '../../engine';
import { getBrowserStorage } from '../platform';
import { AUTO_PICKUP_GROUPS, DEFAULT_AUTO_PICKUP, type AutoPickupGroup } from '../autoPickup';
import { UI_SCALE_STEPS, type UiScaleSetting } from '../uiScale';

export interface ActionMetadata {
  id: string;
  name: string;
  category: 'Locomotion' | 'Combat & Magic' | 'Interaction & Inventory';
  defaultCodes: string[];
}

// Every default code maps to exactly one action. Letters shared by the vi and WASD
// schemes and a command (S Search, L Look, U Allocate, B Bestiary) belong to the command;
// players who want full vi or WASD movement rebind in Settings.
export const ACTION_METADATA: ActionMetadata[] = [
  // Locomotion
  { id: 'move_n', name: 'Move North', category: 'Locomotion', defaultCodes: ['ArrowUp', 'KeyW', 'KeyK', 'Numpad8'] },
  { id: 'move_s', name: 'Move South', category: 'Locomotion', defaultCodes: ['ArrowDown', 'KeyJ', 'Numpad2'] },
  { id: 'move_w', name: 'Move West', category: 'Locomotion', defaultCodes: ['ArrowLeft', 'KeyA', 'KeyH', 'Numpad4'] },
  { id: 'move_e', name: 'Move East', category: 'Locomotion', defaultCodes: ['ArrowRight', 'KeyD', 'Numpad6'] },
  { id: 'move_nw', name: 'Move Northwest', category: 'Locomotion', defaultCodes: ['Numpad7', 'KeyY'] },
  { id: 'move_ne', name: 'Move Northeast', category: 'Locomotion', defaultCodes: ['Numpad9'] },
  { id: 'move_sw', name: 'Move Southwest', category: 'Locomotion', defaultCodes: ['Numpad1'] },
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
  { id: 'drink_potion_1', name: 'Drink Potion Slot 1', category: 'Combat & Magic', defaultCodes: ['Shift+Digit1'] },
  { id: 'drink_potion_2', name: 'Drink Potion Slot 2', category: 'Combat & Magic', defaultCodes: ['Shift+Digit2'] },
  { id: 'drink_potion_3', name: 'Drink Potion Slot 3', category: 'Combat & Magic', defaultCodes: ['Shift+Digit3'] },
  { id: 'drink_potion_4', name: 'Drink Potion Slot 4', category: 'Combat & Magic', defaultCodes: ['Shift+Digit4'] },
  { id: 'channel_rune_of_return', name: 'Channel Rune of Return', category: 'Combat & Magic', defaultCodes: ['KeyT'] },
  { id: 'rune_of_return_tree', name: 'Rune of Return Mastery', category: 'Combat & Magic', defaultCodes: ['Shift+KeyT'] },
  { id: 'companion_skill', name: "Companion's Skill", category: 'Combat & Magic', defaultCodes: ['Shift+KeyR'] },

  // Interaction & Inventory
  { id: 'character_menu', name: 'Character Menu', category: 'Interaction & Inventory', defaultCodes: ['KeyE'] },
  { id: 'inventory', name: 'Open Inventory', category: 'Interaction & Inventory', defaultCodes: ['KeyI'] },
  { id: 'context_action', name: 'Context Action (stairs, loot, doors, talk)', category: 'Interaction & Inventory', defaultCodes: ['KeyF'] },
  { id: 'pickup', name: 'Pick Up Item', category: 'Interaction & Inventory', defaultCodes: ['KeyG', 'Comma'] },
  { id: 'quick_loot', name: 'Quick-Loot All Items', category: 'Interaction & Inventory', defaultCodes: ['Shift+KeyG', 'Shift+Comma'] },
  { id: 'close_door', name: 'Smart Close Door', category: 'Interaction & Inventory', defaultCodes: ['KeyC'] },
  { id: 'search', name: 'Search Secret Doors / Traps', category: 'Interaction & Inventory', defaultCodes: ['KeyS'] },
  { id: 'disarm_trap', name: 'Disarm Trap', category: 'Interaction & Inventory', defaultCodes: ['Shift+KeyD'] },
  { id: 'rest', name: 'Rest Until Healed', category: 'Interaction & Inventory', defaultCodes: ['KeyR'] },
  { id: 'stairs', name: 'Climb Stairs Up / Down', category: 'Interaction & Inventory', defaultCodes: ['Enter'] },
  { id: 'map', name: 'Explored Dungeon Map', category: 'Interaction & Inventory', defaultCodes: ['KeyM'] },
  { id: 'message_log', name: 'Message Log History', category: 'Interaction & Inventory', defaultCodes: ['Shift+KeyM'] },
  { id: 'inspect', name: 'Inspect / Look Mode', category: 'Interaction & Inventory', defaultCodes: ['KeyX', 'KeyL'] },
  { id: 'compendium', name: 'Bestiary', category: 'Interaction & Inventory', defaultCodes: ['KeyB'] },
  { id: 'pact', name: 'Pacts', category: 'Interaction & Inventory', defaultCodes: ['KeyP'] },
  { id: 'story', name: 'Story', category: 'Interaction & Inventory', defaultCodes: ['KeyO'] },
  { id: 'radial_menu', name: 'Open Radial Action Menu', category: 'Interaction & Inventory', defaultCodes: ['KeyV'] },
  { id: 'companion_call', name: 'Call / Send Away Companion', category: 'Interaction & Inventory', defaultCodes: ['Shift+KeyC'] },
];

/**
 * Keys InputHandler answers before it reads the bindings (src/rendering/input-handler.ts),
 * each with what it does and, when it has one, the action that owns it. Bound to anything
 * else, such a key would never reach that action, so Settings refuses it (ADR-0011: the
 * hotkeys keep their keys, and movement isn't offered them).
 */
export const HARD_WIRED_KEYS: Readonly<Record<string, { does: string; actionId?: string }>> = {
  Escape: { does: 'opens the menu' },
  F1: { does: 'opens Help' },
  Slash: { does: 'opens Help' },
  F2: { does: 'opens Diagnostics' },
  Backquote: { does: 'opens Diagnostics' },
  F3: { does: 'opens Feedback' },
  KeyB: { does: 'opens the Bestiary', actionId: 'compendium' },
  KeyP: { does: 'opens Pacts', actionId: 'pact' },
  KeyU: { does: 'opens the Character tab' },
  KeyE: { does: 'opens the Character tab', actionId: 'character_menu' },
  KeyI: { does: 'opens the Inventory', actionId: 'inventory' },
  KeyZ: { does: 'opens the Spellbook', actionId: 'cast_spell' },
  KeyX: { does: 'starts Look', actionId: 'inspect' },
  KeyL: { does: 'starts Look', actionId: 'inspect' },
  KeyC: { does: 'closes a door', actionId: 'close_door' },
  KeyR: { does: 'rests', actionId: 'rest' },
  KeyS: { does: 'searches', actionId: 'search' },
  KeyM: { does: 'opens the map', actionId: 'map' },
  KeyQ: { does: 'saves and quits' },
  KeyG: { does: 'picks up', actionId: 'pickup' },
  Comma: { does: 'picks up', actionId: 'pickup' },
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => [`Digit${n}`, { does: `casts quick spell ${n}`, actionId: `quick_spell_${n}` }])
  ),
};

/** What a hard-wired key does, when binding it to `actionId` would never work; else null. */
export function hardWiredConflict(actionId: string, code: string): string | null {
  const wired = HARD_WIRED_KEYS[code];
  return wired && wired.actionId !== actionId ? wired.does : null;
}

/**
 * Configurable Radial Action Menu (docs/architecture/simulation-and-input.md). A slot bound to a spell,
 * a registered CommandPalette command, or a directly-usable consumable item (potion
 * or self-targeted scroll). Indexed by compass direction — see radialMenu.ts's
 * `RADIAL_DIRECTIONS` for the fixed 8-direction order this array is keyed by.
 */
export type RadialMenuSlotConfig =
  | { type: 'spell'; spellId: string }
  | { type: 'command'; commandId: string }
  | { type: 'item'; itemId: string };

export const RADIAL_MENU_SLOT_COUNT = 8;

export interface GameSettings {
  arrowChordingEnabled: boolean;
  arrowChordBufferMs: number;
  mouseVectoringEnabled: boolean;
  /** While aiming a spell, the reticle follows the mouse and a click fires (N23, tracker 4.4). */
  mouseAimEnabled: boolean;
  /** The interface's size (N8, tracker 4.5): Auto follows the window, or a fixed factor (`uiScale.ts`). */
  uiScale: UiScaleSetting;
  /** The content pack's torchlight: sight darkens toward its edge, warm light near the hero. */
  torchlightEnabled: boolean;
  /** Whether to render rich breakdown hover cards in inventory overlay rather than simple single-line names. */
  inventoryRichHoverCards: boolean;
  /** The pack's first-time hints: a short note in the sidebar the first time each system is met,
   *  and the prologue's action cues (a glowing HUD slot). */
  hintsEnabled: boolean;
  /** The note on moving and the keys shown before a new hero's first step (`ControlsPrimer`). */
  controlsPrimerEnabled: boolean;
  /** Which kinds of item the hero picks up on stepping onto them (`autoPickup.ts`); coins always. */
  autoPickup: Record<AutoPickupGroup, boolean>;
  keybinds: Record<string, string[]>;
  radialMenuSlots: (RadialMenuSlotConfig | null)[];
}

function sanitizeRadialMenuSlots(raw: unknown): (RadialMenuSlotConfig | null)[] {
  const defaults: (RadialMenuSlotConfig | null)[] = new Array(RADIAL_MENU_SLOT_COUNT).fill(null);
  if (!Array.isArray(raw)) return defaults;

  return defaults.map((_, i) => {
    const slot = raw[i];
    if (!slot || typeof slot !== 'object') return null;
    if (slot.type === 'spell' && typeof slot.spellId === 'string') return { type: 'spell', spellId: slot.spellId };
    if (slot.type === 'command' && typeof slot.commandId === 'string') return { type: 'command', commandId: slot.commandId };
    if (slot.type === 'item' && typeof slot.itemId === 'string') return { type: 'item', itemId: slot.itemId };
    return null;
  });
}

/** A saved auto-pickup choice, each group a boolean; a group missing or malformed takes its default. */
function sanitizeAutoPickup(raw: unknown): Record<AutoPickupGroup, boolean> {
  const result = { ...DEFAULT_AUTO_PICKUP };
  if (!raw || typeof raw !== 'object') return result;
  for (const { id } of AUTO_PICKUP_GROUPS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === 'boolean') result[id] = value;
  }
  return result;
}

export const SETTINGS_STORAGE_KEY = 'yodc_settings';

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
    // Off until the player turns it on: a new player learns the keyboard first.
    mouseVectoringEnabled: false,
    // On: aiming with the mouse is what a new player reaches for (Q18, N23).
    mouseAimEnabled: true,
    uiScale: 'auto',
    torchlightEnabled: true,
    inventoryRichHoverCards: true,
    hintsEnabled: true,
    controlsPrimerEnabled: true,
    autoPickup: { ...DEFAULT_AUTO_PICKUP },
    keybinds: getDefaultKeybinds(),
    radialMenuSlots: new Array(RADIAL_MENU_SLOT_COUNT).fill(null),
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
        mouseAimEnabled: typeof parsed.mouseAimEnabled === 'boolean' ? parsed.mouseAimEnabled : defaults.mouseAimEnabled,
        uiScale: (UI_SCALE_STEPS as readonly unknown[]).includes(parsed.uiScale) ? parsed.uiScale : defaults.uiScale,
        torchlightEnabled: typeof parsed.torchlightEnabled === 'boolean' ? parsed.torchlightEnabled : defaults.torchlightEnabled,
        inventoryRichHoverCards: typeof parsed.inventoryRichHoverCards === 'boolean' ? parsed.inventoryRichHoverCards : defaults.inventoryRichHoverCards,
        hintsEnabled: typeof parsed.hintsEnabled === 'boolean' ? parsed.hintsEnabled : defaults.hintsEnabled,
        controlsPrimerEnabled: typeof parsed.controlsPrimerEnabled === 'boolean' ? parsed.controlsPrimerEnabled : defaults.controlsPrimerEnabled,
        autoPickup: sanitizeAutoPickup(parsed.autoPickup),
        keybinds: typeof parsed.keybinds === 'object' && parsed.keybinds !== null ? { ...defaults.keybinds, ...parsed.keybinds } : defaults.keybinds,
        radialMenuSlots: sanitizeRadialMenuSlots(parsed.radialMenuSlots),
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
