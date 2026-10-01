/**
 * The UI's icon vocabulary (ADR-0011, step 5): pixel icons in place of emoji. A pack draws
 * each as a sprite recipe keyed `ui~<name>` in `manifest.spriteRecipes`; at startup
 * `installUiIcons()` (src/rendering/uiIcons.ts) bakes them into one stylesheet, so any
 * markup, static or built in a string, shows one with `<i class="ui-icon" data-icon="…">`.
 * An icon the pack doesn't draw doesn't show; the text beside it still says what it is.
 */
export const UI_ICON_NAMES = [
  // HUD bars
  'bestiary',
  'commands',
  'help',
  'feedback',
  'tools',
  'inventory',
  'cast',
  'look',
  'map',
  'rest',
  'wait',
  'search',
  'stairs',
  // The context action, tray chips and the ground line
  'attack',
  'loot',
  'chest',
  'talk',
  'door',
  'rune',
  'debt',
  'pact',
  'location',
  'retreat',
  'shield',
  // Status and notices
  'info',
  'success',
  'warning',
  'error',
  // Saves, the title screen and the end of a run
  'save',
  'load',
  'delete',
  'autosave',
  'clock',
  'import',
  'share',
  'copy',
  'epitaph',
  'trophy',
  'fallen',
  'hero',
  'heroine',
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];

/** Sprite-recipe key prefix for UI icons. */
export const UI_ICON_PREFIX = 'ui~';

/** An icon as markup, for strings built into `innerHTML`. */
export function iconHtml(name: UiIconName): string {
  return `<i class="ui-icon" data-icon="${name}" aria-hidden="true"></i>`;
}

/** An icon as an element, for views built with `createElement`. */
export function iconElement(name: UiIconName): HTMLElement {
  const el = document.createElement('i');
  el.className = 'ui-icon';
  el.setAttribute('data-icon', name);
  el.setAttribute('aria-hidden', 'true');
  return el;
}
