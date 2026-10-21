/**
 * Keeps keyboard focus inside a dialog that redraws itself with `innerHTML`. The rebuild
 * removes the focused control, and focus falls to the page body, outside the dialog: Tab
 * then starts over and a screen reader loses the dialog.
 *
 * Take a `focusMark` before the rebuild and hand it to `restoreFocus` after. A control is
 * found again by its `id` and `data-*` attributes; one that is gone gives focus to
 * `fallback` (the selected row, say), else to the root. Focus outside the root before the
 * redraw is left where it is: a dialog never takes focus from another one.
 */

/** Where focus sat inside a root: the focused control's naming attributes. */
export type FocusMark = readonly string[];

function activeElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
}

/** `name="value"` for the control's id and each data attribute, in order. */
function naming(el: Element): string[] {
  if (typeof el.getAttributeNames !== 'function') return [];
  return el
    .getAttributeNames()
    .filter((name) => name === 'id' || name.startsWith('data-'))
    .sort()
    .map((name) => `${name}="${el.getAttribute(name) ?? ''}"`);
}

/** The focused control inside `root`, or null when focus is elsewhere. */
export function focusMark(root: HTMLElement): FocusMark | null {
  const active = activeElement();
  if (!active || typeof root.contains !== 'function' || !root.contains(active)) return null;
  return naming(active);
}

/** Puts focus back on the control `mark` names, after `root` was rebuilt. */
export function restoreFocus(root: HTMLElement, mark: FocusMark | null, fallback?: string): void {
  if (!mark || typeof root.querySelectorAll !== 'function') return;
  const active = activeElement();
  // Still inside (the root itself had focus, or the control survived): nothing was lost.
  if (active && active.isConnected && root.contains(active)) return;
  const key = mark.join(' ');
  const same = key ? Array.from(root.querySelectorAll<HTMLElement>('*')).find((el) => naming(el).join(' ') === key) : undefined;
  // A control that is there but can't take focus (a spent offer is disabled) passes it on.
  for (const target of [same, fallback ? root.querySelector<HTMLElement>(fallback) : null, root]) {
    if (!target) continue;
    if (target === root && !root.hasAttribute('tabindex')) {
      root.tabIndex = -1;
      root.style.outline = 'none';
    }
    target.focus({ preventScroll: true });
    if (activeElement() === target) return;
  }
}
