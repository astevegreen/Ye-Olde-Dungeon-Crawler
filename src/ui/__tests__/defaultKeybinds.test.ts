import { describe, it, expect } from 'vitest';
import { ACTION_METADATA } from '../settings/settingsManager';

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

  it('leave hard-wired command keys to their commands', () => {
    const claimed = ACTION_METADATA.filter((a) => a.id !== 'character_menu').flatMap((a) =>
      a.defaultCodes.filter((code) => HARD_WIRED.includes(code)).map((code) => `${a.id}:${code}`)
    );
    expect(claimed).toEqual([]);
  });
});
