import { escapeHtml, keyChip } from './html';
import { iconHtml, type UiIconName } from './icons';

/**
 * The one dialog frame (ADR-0011): a scrim and a frame modeled on the story-choice dialog,
 * shared by every dialog that interrupts play. Styled by src/ui/styles/dialog.css.
 */

/** The dialog's scrim element, created once under #app. The dialog shows it by setting
 *  `style.display` to 'flex' and hides it with 'none'. */
export function createDialogScrim(id: string, layer: 'dialog' | 'system' | 'crash' = 'dialog'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let scrim = document.getElementById(id);
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = id;
    (document.getElementById('app') ?? document.body)?.appendChild(scrim);
  }
  scrim.className = layer === 'dialog' ? 'ui-scrim' : `ui-scrim is-${layer}`;
  scrim.style.display = 'none';
  return scrim;
}

export interface DialogFrame {
  /** Plain text. */
  title: string;
  titleId?: string;
  /** A pack icon before the title. */
  icon?: UiIconName;
  /** A small line above the title, e.g. "Mastery". */
  kicker?: string;
  /** Id for a ✕ in the head; omit for dialogs that can't be dismissed. */
  closeId?: string;
  closeTitle?: string;
  body: string;
  /** Footer hint: key chips and what they do. */
  hints?: Array<{ keys: string[]; label: string }>;
  /** Footer buttons, from `dialogButton`. */
  actions?: string;
  /** Raw HTML for the footer's left side, after the hints, e.g. a status line. */
  footNote?: string;
  size?: 'narrow' | 'wide';
}

export function dialogHtml(f: DialogFrame): string {
  const hints = (f.hints ?? [])
    .map((h) => `<span class="cm-hint">${h.keys.map(keyChip).join('')} ${escapeHtml(h.label)}</span>`)
    .join('');
  const foot =
    hints || f.actions || f.footNote
      ? `<div class="ui-dialog-foot"><div class="ui-dialog-hint">${hints}${f.footNote ?? ''}</div>${f.actions ? `<div class="ui-dialog-actions">${f.actions}</div>` : ''}</div>`
      : '';
  return `
    <div class="ui-dialog${f.size ? ` ui-dialog--${f.size}` : ''}" role="dialog" aria-modal="true"${f.titleId ? ` aria-labelledby="${f.titleId}"` : ''}>
      <div class="ui-dialog-head">
        <div>${f.kicker ? `<div class="ui-dialog-kicker">${escapeHtml(f.kicker)}</div>` : ''}<div class="ui-dialog-title"${f.titleId ? ` id="${f.titleId}"` : ''}>${f.icon ? iconHtml(f.icon) : ''}${escapeHtml(f.title)}</div></div>
        ${f.closeId ? `<button type="button" id="${f.closeId}" class="cm-close" aria-label="Close" title="${escapeHtml(f.closeTitle ?? 'Close (Esc)')}">✕</button>` : ''}
      </div>
      <div class="ui-dialog-body">${f.body}</div>
      ${foot}
    </div>`;
}

/** A footer or body button in the shared style. */
export function dialogButton(
  id: string,
  label: string,
  opts: { primary?: boolean; danger?: boolean; disabled?: boolean; key?: string; icon?: UiIconName; attrs?: string } = {}
): string {
  const variant = opts.primary ? ' ui-btn--primary' : opts.danger ? ' ui-btn--danger' : '';
  return `<button type="button" id="${id}" class="ui-btn${variant}"${opts.disabled ? ' disabled' : ''}${opts.attrs ? ` ${opts.attrs}` : ''}>${opts.icon ? iconHtml(opts.icon) : ''}${escapeHtml(label)}${opts.key ? ` ${keyChip(opts.key)}` : ''}</button>`;
}
