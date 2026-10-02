import { escapeHtml } from './html';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';

/** What the end-of-run dialog shows; src/main.ts fills it from the run and the pack's branding. */
export interface GameOverView {
  status: 'victorious' | 'fallen';
  /** The dialog's title, e.g. the pack's victory title. */
  title: string;
  /** Who the run was, e.g. "Sven · Level 7". */
  kicker?: string;
  /** The pack's closing line under the title. */
  banner: string;
  epitaph: string;
  /** The final score line, when the run was inscribed. */
  score?: string;
  /** The autosave button's label, when an autosave exists. */
  autosaveLabel?: string;
  exportLabel: string;
}

export interface GameOverDialogOptions {
  onLoadAutosave: () => void;
  onShare: () => void;
  onExport: () => void;
  onReturn: () => void;
}

/**
 * The end of a run, won or lost, in the one dialog frame (ADR-0011). A screen, not a modal:
 * the game's input is already off when it shows, and every way out leaves the run
 * (docs/architecture/simulation-and-input.md).
 */
export class GameOverDialog {
  private scrim: HTMLElement | null = null;

  constructor(private readonly options: GameOverDialogOptions) {}

  public get isOpen(): boolean {
    return this.scrim?.style.display === 'flex';
  }

  public show(view: GameOverView): void {
    this.scrim ??= createDialogScrim('game-over-modal');
    const scrim = this.scrim;
    if (!scrim) return;
    const won = view.status === 'victorious';
    scrim.innerHTML = dialogHtml({
      title: view.title,
      titleId: 'game-over-title',
      icon: won ? 'trophy' : 'fallen',
      kicker: view.kicker,
      size: 'wide',
      body: `
        <div class="go-banner ${won ? 'is-won' : 'is-lost'}">${escapeHtml(view.banner)}</div>
        <pre id="game-over-summary" class="ui-epitaph ui-inset">${escapeHtml(view.epitaph)}</pre>
        <div id="game-over-status" class="ui-note" aria-live="polite"></div>`,
      footNote: view.score ? `<span id="game-over-score" class="go-score">${escapeHtml(view.score)}</span>` : '',
      actions: [
        // A death may be undone from the autosave; a victory is final.
        view.autosaveLabel && view.status !== 'victorious' ? dialogButton('btn-game-over-autosave', view.autosaveLabel, { icon: 'autosave' }) : '',
        dialogButton('btn-game-over-share', 'Share saga', { icon: 'share' }),
        dialogButton('btn-game-over-export', view.exportLabel, { icon: 'save' }),
        dialogButton('btn-game-over-return', 'Return to title', { primary: true }),
      ].join(''),
    });
    const on = (id: string, fn: () => void) => scrim.querySelector(`#${id}`)?.addEventListener('click', fn);
    on('btn-game-over-autosave', this.options.onLoadAutosave);
    on('btn-game-over-share', this.options.onShare);
    on('btn-game-over-export', this.options.onExport);
    on('btn-game-over-return', this.options.onReturn);
    scrim.style.display = 'flex';
  }

  public hide(): void {
    if (this.scrim) this.scrim.style.display = 'none';
  }

  public setStatus(message: string, tone: 'good' | 'bad'): void {
    const el = this.scrim?.querySelector('#game-over-status');
    if (!el) return;
    el.textContent = message;
    el.className = `ui-note ${tone === 'good' ? 'ui-up' : 'ui-down'}`;
  }
}
