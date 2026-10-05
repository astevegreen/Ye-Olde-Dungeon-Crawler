import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';
import { spellRuneKey } from '../../../ui/spellRunes';

/** Tracker 4.6: every cotw spell shows a rune on the belt. */
describe('cotw spell runes', () => {
  it('draws a rune for every element a cotw spell carries', () => {
    const spells = cotwManifest.spells ?? [];
    expect(spells.length).toBeGreaterThan(30);
    const missing = spells.filter((s) => !spellRuneKey(cotwManifest, s)).map((s) => `${s.id} (${s.element})`);
    expect(missing).toEqual([]);
  });
});
