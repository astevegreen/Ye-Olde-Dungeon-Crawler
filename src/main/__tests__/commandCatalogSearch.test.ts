import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../../content/cotw';
import { catalogForPack } from '../commandCatalog';
import { filterCommands, type CommandItem } from '../../ui/help/commandPalette';

/**
 * Sprint U4: a player who types "cast", "aim", "rest" or the pack's word for mana into the
 * command palette finds a command that does it. The rest entry names the mana by the pack's
 * word, filled once from the manifest, so the catalog itself names no pack.
 */

const paletteFor = (manifest?: Parameters<typeof catalogForPack>[0]): CommandItem[] =>
  catalogForPack(manifest).map((meta) => ({ ...meta, shortcut: '', execute: () => {} }));
const ids = (items: CommandItem[]): string[] => items.map((c) => c.id);

describe('catalogForPack fills the mana name into the catalog text', () => {
  it("names the cotw pack's mana (Seiðr) in the rest entry", () => {
    const rest = catalogForPack(cotwManifest).find((c) => c.id === 'rest')!;
    expect(rest.title).toBe('Rest to Regain HP and Seiðr');
    expect(rest.description).toContain('Seiðr');
    expect(rest.title + rest.description).not.toContain('{mana}');
  });

  it('falls back to "Mana" for a pack without branding', () => {
    const rest = catalogForPack({}).find((c) => c.id === 'rest')!;
    expect(rest.title).toBe('Rest to Regain HP and Mana');
    expect(rest.description).toContain('Mana');
  });

  it('leaves no placeholder in any entry', () => {
    for (const meta of catalogForPack(cotwManifest)) {
      expect(meta.title + meta.description, meta.id).not.toMatch(/\{\w+\}/);
    }
  });

  it('adds Cast Quick Spell 1 on the quick-spell-1 key', () => {
    const cast = catalogForPack(cotwManifest).find((c) => c.id === 'cast-quick-spell-1')!;
    expect(cast).toMatchObject({ title: 'Cast Quick Spell 1', category: 'Action', binding: 'quick_spell_1' });
    expect(cast.description).toMatch(/Enter, Space or F/);
    expect(cast.description).toMatch(/Esc/);
  });
});

describe('the palette search finds casting, aiming and resting', () => {
  const palette = paletteFor(cotwManifest);

  it('"aim" finds the spellbook and the quick-spell cast', () => {
    expect(ids(filterCommands(palette, 'aim'))).toEqual(expect.arrayContaining(['spellbook', 'cast-quick-spell-1']));
  });

  it('"cast" finds the spellbook and the quick-spell cast', () => {
    expect(ids(filterCommands(palette, 'cast'))).toEqual(expect.arrayContaining(['spellbook', 'cast-quick-spell-1']));
  });

  it("the pack's mana name finds the rest entry, whatever its case", () => {
    expect(ids(filterCommands(palette, 'Seiðr'))).toContain('rest');
    expect(ids(filterCommands(palette, 'seiðr'))).toContain('rest');
  });

  it('"cast quick" picks the quick-spell cast first', () => {
    expect(ids(filterCommands(palette, 'cast quick'))[0]).toBe('cast-quick-spell-1');
  });

  it('an empty query lists every command', () => {
    expect(filterCommands(palette, '  ')).toHaveLength(palette.length);
  });
});
