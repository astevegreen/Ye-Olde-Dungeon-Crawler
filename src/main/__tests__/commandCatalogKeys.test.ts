import { describe, it, expect } from 'vitest';
import { MemoryStorage } from '../../engine';
import { COMMAND_CATALOG, type CommandMetadata } from '../commandCatalog';
import { ACTION_METADATA, HARD_WIRED_KEYS, SettingsManager } from '../../ui/settings/settingsManager';
import { codesLabel } from '../../ui/keyLabel';

/**
 * Whole-codebase review, 2026-10-06, area 7 (composition root). R-main-4: the palette's key
 * chips were hard-coded and two had drifted from the bindings (`<` is Quick-Loot since
 * 954c508; `?` opens the palette, not help). The chips now come from each command's
 * binding as `src/main.ts` reads it at render.
 */

const catalog = COMMAND_CATALOG as readonly CommandMetadata[];
const chipWith = (settings: SettingsManager, id: string): string => {
  const meta = catalog.find((c) => c.id === id)!;
  return [meta.binding ? codesLabel(settings.getCodesForAction(meta.binding)) : '', meta.fixedKeys ?? ''].filter(Boolean).join(' / ');
};

describe('R-main-4 · command palette chips advertise the keys that do the thing', () => {
  const settings = new SettingsManager(new MemoryStorage());

  it('the stairs chip does not advertise "<", which Quick-Loot owns', () => {
    expect(chipWith(settings, 'stairs')).not.toContain('<');
    expect(chipWith(settings, 'stairs')).toBe('Enter / >'); // > is hard-wired to the stairs
  });

  it('the help chip does not advertise "?", which opens the palette', () => {
    expect(chipWith(settings, 'help')).not.toContain('?');
  });

  it('every binding a command names is a real action', () => {
    const actions = new Set(ACTION_METADATA.map((a) => a.id));
    for (const meta of catalog) {
      if (meta.binding) expect(actions, meta.id).toContain(meta.binding);
    }
    expect(Object.keys(HARD_WIRED_KEYS)).toEqual(expect.arrayContaining(['F1', 'Slash', 'F2', 'Backquote', 'F3', 'Escape', 'KeyQ', 'KeyU']));
  });

  it('a chip follows a rebind', () => {
    const rebound = new SettingsManager(new MemoryStorage());
    rebound.bindKey('rest', 'KeyK');

    expect(chipWith(rebound, 'rest')).toContain('K');
  });
});
