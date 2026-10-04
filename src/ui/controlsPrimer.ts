import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { keyChip } from './html';

export interface ControlsPrimerOptions {
  /** The label of the first key bound to an action, or undefined when none is. */
  keyFor: (action: string) => string | undefined;
  /** Opens Settings, on the keys (the player chose to look before setting out). */
  onOpenControls: () => void;
  /** The player ticked "Don't show this again". */
  onHideForGood: () => void;
  /** Closed, by either button or Escape; the caller pops it off the modal stack. */
  onClose: () => void;
}

/**
 * The one dialog before a new hero's first step (owner's ask, 2026-10-02): how to move,
 * diagonals above all, since a player who never learns them fights at a disadvantage, and
 * where to change any key. One compact block adds the mouse, the log and F3 (N1). Shown while the player's "Controls reminder" setting is on;
 * the dialog's own tick turns it off.
 */
export class ControlsPrimer implements UIModal {
  public readonly id = 'controls-primer';
  public isOpen = false;
  private readonly scrim: HTMLElement | null;

  constructor(private readonly options: ControlsPrimerOptions) {
    this.scrim = createDialogScrim(this.id);
  }

  public open(): void {
    if (!this.scrim) return;
    this.isOpen = true;
    this.render();
    this.scrim.style.display = 'flex';
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    const hide = this.scrim?.querySelector<HTMLInputElement>('#controls-primer-hide');
    if (hide?.checked) this.options.onHideForGood();
    if (this.scrim) this.scrim.style.display = 'none';
    this.options.onClose();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.code === 'KeyK') {
      e.preventDefault();
      this.openControls();
    }
    return true;
  }

  private openControls(): void {
    this.close();
    this.options.onOpenControls();
  }

  private render(): void {
    if (!this.scrim) return;
    const key = (action: string, fallback: string) => keyChip(this.options.keyFor(action) ?? fallback);
    const fact = (title: string, text: string) => `<div class="ui-fact"><b>${title}</b> ${text}</div>`;
    this.scrim.innerHTML = dialogHtml({
      title: 'Before you set out',
      kicker: 'Controls',
      closeId: 'controls-primer-x',
      body: `
        <div class="ui-dialog-lede">A word on moving, since it matters from your first step.</div>
        ${fact('Move.', 'The arrow keys, or the number pad.')}
        ${fact('Diagonals.', `The number pad's corner keys (7, 9, 1, 3) step diagonally. With no number pad, press two arrow keys together: Up and Right steps north-east. Cutting corners keeps you out of a monster's reach.`)}
        ${fact('Fight.', 'Walk into an enemy to strike it.')}
        ${fact('Wait.', `${key('wait', 'Space')} passes a turn.`)}
        ${fact('Spells and potions.', `The number keys cast the spells on your belt. ${key('drink_potion_1', 'Shift+1')} to ${key('drink_potion_4', 'Shift+4')} drink the potions beside your health.`)}
        <div class="ui-fact controls-primer-more">
          <div><b>Mouse.</b> Click a distant tile to walk there; point at anything to see what it is.</div>
          <div><b>The log</b> under the map tells what just happened; ${key('message_log', 'Shift+M')} reads back further.</div>
          <div><b>${keyChip('F3')}</b> reports a bug or suggests an idea, at any moment.</div>
        </div>
        <div class="ui-note">Esc opens the menu, where Settings changes any key.</div>
        <label class="ui-note"><input type="checkbox" id="controls-primer-hide"> Don't show this before new heroes</label>`,
      hints: [
        { keys: ['K'], label: 'see every key' },
        { keys: ['Enter'], label: 'begin' },
      ],
      actions:
        dialogButton('controls-primer-keys', 'See every key', { key: 'K' }) +
        dialogButton('controls-primer-begin', 'Begin', { primary: true, key: 'Enter' }),
    });
    this.scrim.querySelector('#controls-primer-x')?.addEventListener('click', () => this.close());
    this.scrim.querySelector('#controls-primer-begin')?.addEventListener('click', () => this.close());
    this.scrim.querySelector('#controls-primer-keys')?.addEventListener('click', () => this.openControls());
  }
}
