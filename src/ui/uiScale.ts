/**
 * UI scale (N8, tracker 4.5): one factor for every DOM surface of the interface and the
 * canvas text, so the HUD, menus and dialogs grow with a large window the way the map does.
 *
 * The DOM scales through CSS `zoom: var(--ui-scale)` on the interface's roots (base.css):
 * each root lays out and draws at the larger size, crisp, like operating-system scaling, so
 * no fixed size inside it overflows. `getBoundingClientRect` returns the zoomed box, which is
 * what the viewport's height budget measures; code that places an element at a pointer or
 * screen position inside a zoomed root divides by `layoutZoom`.
 */

/** The player's choice: Auto, or a fixed factor. */
export type UiScaleSetting = 'auto' | number;

/** The fixed factors Settings offers. */
export const UI_SCALE_STEPS = [1, 1.25, 1.5, 1.75, 2] as const;

/** The window the interface is drawn for at 1×. */
const REFERENCE_WIDTH = 1366;
const REFERENCE_HEIGHT = 768;
const MAX_SCALE = 2;

/**
 * The factor a setting gives in a window of `width` × `height` CSS pixels. Auto grows a
 * quarter step at a time with the window's smaller ratio to 1366 × 768, from 1 to 2: 1920 ×
 * 1080 is 1.25, 2560 × 1440 is 1.75. A screen the operating system already scales reports
 * fewer CSS pixels, so Auto doesn't scale it twice.
 */
export function resolveUiScale(setting: UiScaleSetting, width: number, height: number): number {
  if (setting !== 'auto') return clampScale(setting);
  const ratio = Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
  return clampScale(Math.floor(ratio * 4) / 4);
}

function clampScale(scale: number): number {
  return Number.isFinite(scale) ? Math.min(MAX_SCALE, Math.max(1, scale)) : 1;
}

let current = 1;

/** The factor in effect. */
export function currentUiScale(): number {
  return current;
}

/** Puts a factor in effect for the DOM (`--ui-scale`). The canvas text takes it from the composition root. */
export function applyUiScale(scale: number): void {
  current = clampScale(scale);
  if (typeof document !== 'undefined') document.documentElement?.style?.setProperty('--ui-scale', String(current));
}

/**
 * How much bigger an element draws than it lays out: its zoom, read from the box it shows
 * against the width it lays out at. Divides pointer offsets into layout pixels.
 */
export function layoutZoom(el: HTMLElement): number {
  const shown = el.getBoundingClientRect().width;
  const laid = el.offsetWidth;
  return shown > 0 && laid > 0 ? shown / laid : 1;
}
