import { describe, it, expect } from 'vitest';
import { KeybindingManager } from '../settings/keybindingManager';

describe('KeybindingManager', () => {
  it('decouples keyboard input mappings via KeybindingManager', () => {
    const keybindings = new KeybindingManager();
    expect(keybindings.get('ArrowUp')).toEqual({ actionId: 'move', args: { dx: 0, dy: -1 }, description: 'Move North' });

    // Custom remapping: Remap 'KeyF' to 'custom_whirlwind'
    keybindings.bind('KeyF', { actionId: 'custom_whirlwind', args: { radius: 3 } });
    const binding = keybindings.get('KeyF');
    expect(binding).toBeDefined();
    expect(binding?.actionId).toBe('custom_whirlwind');
    expect(binding?.args).toEqual({ radius: 3 });
  });

  it('resets to defaults correctly', () => {
    const keybindings = new KeybindingManager();
    keybindings.bind('KeyX', { actionId: 'custom_action' });
    expect(keybindings.has('KeyX')).toBe(true);

    keybindings.resetToDefaults();
    expect(keybindings.has('KeyX')).toBe(false);
    expect(keybindings.get('Space')).toEqual({ actionId: 'wait', description: 'Wait / Pass Turn' });
  });
});
