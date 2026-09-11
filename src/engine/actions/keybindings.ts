export interface ActionBinding {
  actionId: string;
  args?: any;
  description?: string;
}

const DEFAULT_KEYBINDINGS: Record<string, ActionBinding> = {
  // Movement - Arrow keys
  ArrowUp: { actionId: 'move', args: { dx: 0, dy: -1 }, description: 'Move North' },
  ArrowDown: { actionId: 'move', args: { dx: 0, dy: 1 }, description: 'Move South' },
  ArrowLeft: { actionId: 'move', args: { dx: -1, dy: 0 }, description: 'Move West' },
  ArrowRight: { actionId: 'move', args: { dx: 1, dy: 0 }, description: 'Move East' },

  // Movement - Numpad
  Numpad8: { actionId: 'move', args: { dx: 0, dy: -1 }, description: 'Move North' },
  Numpad2: { actionId: 'move', args: { dx: 0, dy: 1 }, description: 'Move South' },
  Numpad4: { actionId: 'move', args: { dx: -1, dy: 0 }, description: 'Move West' },
  Numpad6: { actionId: 'move', args: { dx: 1, dy: 0 }, description: 'Move East' },
  Numpad7: { actionId: 'move', args: { dx: -1, dy: -1 }, description: 'Move Northwest' },
  Numpad9: { actionId: 'move', args: { dx: 1, dy: -1 }, description: 'Move Northeast' },
  Numpad1: { actionId: 'move', args: { dx: -1, dy: 1 }, description: 'Move Southwest' },
  Numpad3: { actionId: 'move', args: { dx: 1, dy: 1 }, description: 'Move Southeast' },

  // Movement - Vi keys
  KeyK: { actionId: 'move', args: { dx: 0, dy: -1 }, description: 'Move North' },
  KeyJ: { actionId: 'move', args: { dx: 0, dy: 1 }, description: 'Move South' },
  KeyH: { actionId: 'move', args: { dx: -1, dy: 0 }, description: 'Move West' },
  KeyL: { actionId: 'move', args: { dx: 1, dy: 0 }, description: 'Move East' },
  KeyY: { actionId: 'move', args: { dx: -1, dy: -1 }, description: 'Move Northwest' },
  KeyU: { actionId: 'move', args: { dx: 1, dy: -1 }, description: 'Move Northeast' },
  KeyB: { actionId: 'move', args: { dx: -1, dy: 1 }, description: 'Move Southwest' },
  KeyN: { actionId: 'move', args: { dx: 1, dy: 1 }, description: 'Move Southeast' },

  // Wait / Rest
  Space: { actionId: 'wait', description: 'Wait / Pass Turn' },
  Numpad5: { actionId: 'wait', description: 'Wait / Pass Turn' },
  Period: { actionId: 'wait', description: 'Wait / Pass Turn' },

  // Actions
  KeyZ: { actionId: 'cast_spell', description: 'Cast Spell' },
  KeyC: { actionId: 'close_door', description: 'Close Door' },
  KeyI: { actionId: 'use_item', description: 'Inventory / Use Item' },
  KeyS: { actionId: 'interact', args: { interactionType: 'search' }, description: 'Search' },
};

export class KeybindingManager {
  private bindings: Map<string, ActionBinding>;

  constructor(customBindings?: Record<string, ActionBinding | string>) {
    this.bindings = new Map();
    this.resetToDefaults();
    if (customBindings) {
      this.loadBindings(customBindings);
    }
  }

  public get(code: string): ActionBinding | undefined {
    return this.bindings.get(code);
  }

  public bind(code: string, binding: ActionBinding): void {
    this.bindings.set(code, binding);
  }

  public unbind(code: string): boolean {
    return this.bindings.delete(code);
  }

  public has(code: string): boolean {
    return this.bindings.has(code);
  }

  public getAll(): ReadonlyMap<string, ActionBinding> {
    return this.bindings;
  }

  public resetToDefaults(): void {
    this.bindings.clear();
    for (const [code, binding] of Object.entries(DEFAULT_KEYBINDINGS)) {
      this.bindings.set(code, { ...binding });
    }
  }

  public loadBindings(customBindings: Record<string, ActionBinding | string>): void {
    for (const [code, value] of Object.entries(customBindings)) {
      if (typeof value === 'string') {
        this.bindings.set(code, { actionId: value });
      } else {
        this.bindings.set(code, { ...value });
      }
    }
  }
}

export const defaultKeybindingManager = new KeybindingManager();
