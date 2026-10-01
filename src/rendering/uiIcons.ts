import type { SpriteRecipe } from '../engine';
import { SpriteAtlas } from './atlas/sprite-atlas';
import { UI_ICON_NAMES, UI_ICON_PREFIX } from '../ui/icons';

const SHEET_ID = 'ui-icon-sheet';

/**
 * Bakes the pack's `ui~<name>` sprite recipes once and installs them as a stylesheet:
 * one rule per icon the pack draws, so `<i class="ui-icon" data-icon="name">` shows it
 * anywhere in the DOM (src/ui/icons.ts). Icons the pack doesn't draw stay hidden.
 * Returns how many icons were installed.
 */
export function installUiIcons(recipes?: Record<string, SpriteRecipe>): number {
  if (typeof document === 'undefined') return 0;
  const own = Object.fromEntries(Object.entries(recipes ?? {}).filter(([key]) => key.startsWith(UI_ICON_PREFIX)));
  const atlas = new SpriteAtlas(own);
  const rules = UI_ICON_NAMES.filter((name) => atlas.hasRecipe(UI_ICON_PREFIX + name)).map((name) => {
    const url = atlas.getSpriteCanvas(UI_ICON_PREFIX + name).toDataURL('image/png');
    return `.ui-icon[data-icon="${name}"] { display: inline-block; background-image: url("${url}"); }`;
  });
  let sheet = document.getElementById(SHEET_ID);
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.id = SHEET_ID;
    document.head.appendChild(sheet);
  }
  sheet.textContent = rules.join('\n');
  return rules.length;
}
