import { escapeHtml } from './html';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';

/** One ending told as prose; src/main.ts fills it from the quest ending the run reached. */
export interface EndingView {
  /** The ending's name, e.g. "Ragnarök". */
  title: string;
  /** Who the run was, e.g. "Sven · Level 31". */
  kicker?: string;
  /** The ending's narrative, one paragraph each. */
  paragraphs: string[];
}

/**
 * The narrative screen a won run passes through before the score screen (GameOverDialog).
 * Like that screen it is not a modal: the game's input is already off when it shows, so
 * it takes Enter, Space or a click on its one button, then hands over to `onContinue`.
 */
export class EndingDialog {
  private scrim: HTMLElement | null = null;
  private onContinue: (() => void) | null = null;

  public get isOpen(): boolean {
    return this.scrim?.style.display === 'flex';
  }

  public show(view: EndingView, onContinue: () => void): void {
    this.scrim ??= createDialogScrim('ending-modal');
    const scrim = this.scrim;
    if (!scrim) return;
    this.onContinue = onContinue;
    scrim.innerHTML = dialogHtml({
      title: view.title,
      titleId: 'ending-title',
      kicker: view.kicker,
      size: 'wide',
      body: `<div class="ending-story">${view.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>`,
      actions: dialogButton('btn-ending-continue', 'Continue', { primary: true, key: 'Enter' }),
    });
    const button = scrim.querySelector<HTMLButtonElement>('#btn-ending-continue');
    button?.addEventListener('click', () => this.finish());
    scrim.addEventListener('keydown', this.onKey);
    scrim.style.display = 'flex';
    button?.focus();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.finish();
  };

  private finish(): void {
    if (!this.isOpen) return;
    this.hide();
    const next = this.onContinue;
    this.onContinue = null;
    next?.();
  }

  public hide(): void {
    if (!this.scrim) return;
    this.scrim.style.display = 'none';
    this.scrim.removeEventListener('keydown', this.onKey);
  }
}
