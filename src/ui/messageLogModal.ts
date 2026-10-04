import type { UIModal } from './modalStack';
import { createDialogScrim, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import { classifyLogLine } from './logClassifier';

export interface MessageLogModalOptions {
  /** The label of the key that opens the history, for its footer hint. */
  openKey: () => string | undefined;
  /** Whether a key press is the one bound to opening it: pressed again, it closes. */
  isOpenKey: (e: KeyboardEvent) => boolean;
  /** Closed, by its key, Enter, Escape or the ✕; the caller pops it off the modal stack. */
  onClose: () => void;
}

/** The history's rows: each line toned as the log strip tones it. */
export function messageLogRows(messages: readonly string[], playerName: string, critical?: ReadonlySet<string>): string {
  if (messages.length === 0) return '<div class="log-line log-line-muted">Nothing has happened yet.</div>';
  return messages
    .map((msg) => {
      const line = classifyLogLine(msg, playerName, critical);
      const tone = line.tone !== 'plain' ? ` log-line-${line.tone}` : '';
      return `<div class="log-line${tone}">${escapeHtml(line.text)}</div>`;
    })
    .join('');
}

/**
 * The log's history (Q31): the strip under the map shows the last few lines, and much of
 * what the game explains lands only there, so a key opens every line the game still holds,
 * newest at the bottom. Reading it takes no turn.
 */
export class MessageLogModal implements UIModal {
  public readonly id = 'message-log';
  public isOpen = false;
  private readonly scrim: HTMLElement | null;

  constructor(private readonly options: MessageLogModalOptions) {
    this.scrim = createDialogScrim(this.id);
  }

  public open(messages: readonly string[], playerName: string, critical?: ReadonlySet<string>): void {
    if (!this.scrim) return;
    this.isOpen = true;
    const key = this.options.openKey();
    this.scrim.innerHTML = dialogHtml({
      title: 'Message log',
      kicker: `The last ${messages.length} lines`,
      closeId: 'message-log-x',
      size: 'wide',
      body: `<div class="message-log-history" id="message-log-history" tabindex="0">${messageLogRows(messages, playerName, critical)}</div>`,
      hints: [
        { keys: ['↑', '↓'], label: 'scroll' },
        { keys: ['PgUp', 'PgDn'], label: 'page' },
        { keys: key ? [key, 'Esc'] : ['Esc'], label: 'close' },
      ],
    });
    this.scrim.querySelector('#message-log-x')?.addEventListener('click', () => this.close());
    this.scrim.style.display = 'flex';
    const history = this.history();
    if (history) {
      history.scrollTop = history.scrollHeight;
      history.focus({ preventScroll: true });
    }
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.scrim) this.scrim.style.display = 'none';
    this.options.onClose();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    e.preventDefault();
    const history = this.history();
    const line = 14;
    const page = Math.max(line, (history?.clientHeight ?? 0) - line * 2);
    switch (e.key) {
      case 'Escape':
      case 'Enter':
        this.close();
        return true;
      case 'ArrowUp':
        if (history) history.scrollTop -= line * 3;
        return true;
      case 'ArrowDown':
        if (history) history.scrollTop += line * 3;
        return true;
      case 'PageUp':
        if (history) history.scrollTop -= page;
        return true;
      case 'PageDown':
        if (history) history.scrollTop += page;
        return true;
      case 'Home':
        if (history) history.scrollTop = 0;
        return true;
      case 'End':
        if (history) history.scrollTop = history.scrollHeight;
        return true;
    }
    if (this.options.isOpenKey(e)) this.close();
    return true;
  }

  private history(): HTMLElement | null {
    return this.scrim?.querySelector<HTMLElement>('#message-log-history') ?? null;
  }
}
