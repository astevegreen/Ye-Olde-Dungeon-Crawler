import { describe, it, expect } from 'vitest';
import { ACTION_METADATA, hardWiredConflict } from '../settings/settingsManager';

// Keys InputHandler handles before consulting bindings: U opens attribute allocation and
// E the character menu, so no default binding may claim them.
const HARD_WIRED = ['KeyU', 'KeyE'];

describe('default keybindings', () => {
  it('bind every key to at most one action', () => {
    const owners = new Map<string, string[]>();
    for (const action of ACTION_METADATA) {
      for (const code of action.defaultCodes) owners.set(code, [...(owners.get(code) ?? []), action.id]);
    }
    const shared = [...owners].filter(([, ids]) => ids.length > 1);
    expect(shared).toEqual([]);
  });

  it('never bind a key the game answers first to some other action', () => {
    const misbound = ACTION_METADATA.flatMap((a) =>
      a.defaultCodes.filter((code) => hardWiredConflict(a.id, code)).map((code) => `${a.id}:${code}`)
    );
    expect(misbound).toEqual([]);
  });

  it('judge a Shift chord by its bare key, except an action taking back its own default chord (R-ui-8)', () => {
    expect(hardWiredConflict('move_n', 'Shift+KeyC')).toBe('closes a door');
    expect(hardWiredConflict('rest', 'Shift+Digit5')).toBe('casts quick spell 5');
    expect(hardWiredConflict('move_n', 'Shift+KeyV')).toBeNull();
    // Read before the hard-wired branches (input-handler.ts), so they can be put back.
    expect(hardWiredConflict('quick_loot', 'Shift+KeyG')).toBeNull();
    expect(hardWiredConflict('companion_call', 'Shift+KeyC')).toBeNull();
    expect(hardWiredConflict('message_log', 'Shift+KeyM')).toBeNull();
  });

  it('leave hard-wired command keys to their commands', () => {
    const claimed = ACTION_METADATA.filter((a) => a.id !== 'character_menu').flatMap((a) =>
      a.defaultCodes.filter((code) => HARD_WIRED.includes(code)).map((code) => `${a.id}:${code}`)
    );
    expect(claimed).toEqual([]);
  });
});
