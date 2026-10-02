import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import type { UiIconName } from './icons';

export interface ConfirmDialogOptions {
  title: string;
  /** Plain text. */
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: UiIconName;
  onConfirm: () => void;
  onCancel?: () => void;
}

const CONFIRM_ID = 'confirm-dialog';

/**
 * Asks before something that can't be undone, in the one dialog frame, in place of the
 * browser's `confirm()`. It sits on the system layer above the dialog that asked, holds
 * focus, so it takes its own keys on the menus where InputHandler is off (Escape cancels),
 * and hands focus back to whatever had it.
 */
export function showConfirmDialog(options: ConfirmDialogOptions): void {
  const scrim = createDialogScrim(CONFIRM_ID, 'system');
  if (!scrim) return;
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  scrim.innerHTML = dialogHtml({
    title: options.title,
    icon: options.icon,
    size: 'narrow',
    body: `<div class="ui-dialog-lede">${escapeHtml(options.message)}</div>`,
    actions:
      dialogButton('btn-confirm-cancel', options.cancelLabel ?? 'Cancel', { key: 'Esc' }) +
      dialogButton('btn-confirm-ok', options.confirmLabel, { danger: true }),
  });
  scrim.tabIndex = -1;
  scrim.style.outline = 'none';

  let settled = false;
  const settle = (confirmed: boolean): void => {
    if (settled) return;
    settled = true;
    scrim.style.display = 'none';
    scrim.innerHTML = '';
    scrim.removeEventListener('keydown', onKey);
    returnFocus?.focus();
    if (confirmed) options.onConfirm();
    else options.onCancel?.();
  };
  const onKey = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      settle(false);
    }
  };
  scrim.addEventListener('keydown', onKey);
  scrim.querySelector('#btn-confirm-cancel')?.addEventListener('click', () => settle(false));
  scrim.querySelector('#btn-confirm-ok')?.addEventListener('click', () => settle(true));
  scrim.style.display = 'flex';
  scrim.focus();
}
