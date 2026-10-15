import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

export interface SpellOffer {
  id: string;
  name: string;
  description: string;
  /** Whether a free slot exists now, so the spell can be learned without forgetting. */
  canPlace: boolean;
  /** The spells that can be forgotten to make room. */
  known: Array<{ id: string; name: string }>;
}

export interface SpellOfferCardOptions {
  /** Learn the offered spell into the free slot; a player action. */
  onLearn: (spellId: string) => void;
  /** Forget a known spell for the rest of the run, then learn the offered one; player actions. */
  onForgetAndLearn: (forgetId: string, spellId: string) => void;
  /** Closed by any answer or Escape; the caller pops it off the modal stack. */
  onClose: () => void;
}

/**
 * The one card for every way of learning a spell the grimoires have no room for: learn it
 * where it fits, forget one to make room, or not now (the offer waits in the Spellbook).
 * Forgetting lasts the rest of the run, so it asks twice.
 */
export class SpellOfferCard implements UIModal {
  public readonly id = 'spell-offer-card';
  public isOpen = false;
  private readonly scrim: HTMLElement | null;
  private offer: SpellOffer | null = null;
  /** The known spell chosen to forget, awaiting its confirmation. */
  private chosen: string | null = null;

  constructor(private readonly options: SpellOfferCardOptions) {
    this.scrim = createDialogScrim(this.id);
  }

  public open(offer: SpellOffer): void {
    if (!this.scrim) return;
    this.offer = offer;
    this.chosen = null;
    this.isOpen = true;
    this.render();
    this.scrim.style.display = 'flex';
  }

  public focusRoot(): HTMLElement | null {
    return this.scrim;
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.scrim) this.scrim.style.display = 'none';
    this.offer = null;
    this.options.onClose();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
    return true;
  }

  private render(): void {
    const offer = this.offer;
    if (!this.scrim || !offer) return;
    const chosen = offer.known.find((k) => k.id === this.chosen);
    const forgetList = offer.known
      .map(
        (k) =>
          `<button type="button" class="ui-btn${k.id === this.chosen ? ' ui-btn--primary' : ''}" data-forget-pick="${escapeHtml(k.id)}">${escapeHtml(k.name)}</button>`
      )
      .join('');
    const body = `
      <div class="ui-fact"><b>${escapeHtml(offer.name)}</b> ${escapeHtml(offer.description || 'No one has written down what this does.')}</div>
      <div class="ui-dialog-lede">${
        offer.canPlace
          ? 'There is a free slot for it.'
          : 'Every slot in your grimoires is full. Forget one spell to make room, or leave this for now; it waits in your Spellbook.'
      }</div>
      ${
        offer.canPlace
          ? ''
          : `<div class="ui-note">Forget which spell? Forgetting lasts the rest of this run.</div><div class="sb-slots">${forgetList}</div>`
      }
      ${chosen ? `<div class="ui-fact is-warn">Forget ${escapeHtml(chosen.name)} for good and learn ${escapeHtml(offer.name)}?</div>` : ''}`;
    const actions =
      (offer.canPlace ? dialogButton('spell-offer-learn', 'Learn it', { primary: true }) : '') +
      (chosen ? dialogButton('spell-offer-forget', `Forget ${chosen.name}`, { danger: true }) : '') +
      dialogButton('spell-offer-later', 'Not now', { key: 'Esc' });
    this.scrim.innerHTML = dialogHtml({ title: `Learn ${offer.name}?`, kicker: 'A new spell', body, actions });
    this.scrim.querySelector('#spell-offer-learn')?.addEventListener('click', () => {
      this.options.onLearn(offer.id);
      this.close();
    });
    this.scrim.querySelector('#spell-offer-forget')?.addEventListener('click', () => {
      if (!chosen) return;
      this.options.onForgetAndLearn(chosen.id, offer.id);
      this.close();
    });
    this.scrim.querySelector('#spell-offer-later')?.addEventListener('click', () => this.close());
    this.scrim.querySelectorAll<HTMLElement>('[data-forget-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.chosen = btn.getAttribute('data-forget-pick');
        this.render();
      });
    });
  }
}
