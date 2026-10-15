import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

export interface ForgeOfferView {
  /** The offer's place among the hero's waiting forge offers. */
  index: number;
  /** Who gives it ("Ivalda's forge"). */
  source: string;
  /** The elements it can add: one when the giver fixes it. */
  elements: string[];
  /** The spells it can work. */
  known: Array<{ id: string; name: string }>;
}

export interface ForgeOfferCardOptions {
  /** What forging `element` onto the spell makes of it, as pre-escaped HTML, and whether the forge will. */
  preview: (spellId: string, element: string) => { html: string; ok: boolean };
  /** Forge the element onto the spell; a player action. */
  onForge: (index: number, spellId: string, element: string) => void;
  /** Closed by any answer or Escape; the caller pops it off the modal stack. */
  onClose: () => void;
}

/**
 * A free forge a choice gave (Ivalda's, Skuld's): pick a known spell, and the element when
 * the giver leaves it open, then forge. Not now leaves it waiting in the Spellbook.
 */
export class ForgeOfferCard implements UIModal {
  public readonly id = 'forge-offer-card';
  public isOpen = false;
  private readonly scrim: HTMLElement | null;
  private offer: ForgeOfferView | null = null;
  private spellId: string | null = null;
  private element: string | null = null;

  constructor(private readonly options: ForgeOfferCardOptions) {
    this.scrim = createDialogScrim(this.id);
  }

  public open(offer: ForgeOfferView): void {
    if (!this.scrim) return;
    this.offer = offer;
    this.spellId = null;
    this.element = offer.elements.length === 1 ? offer.elements[0] : null;
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
    const picks = (attr: string, items: Array<{ id: string; name: string }>, chosen: string | null) =>
      items
        .map(
          (k) =>
            `<button type="button" class="ui-btn${k.id === chosen ? ' ui-btn--primary' : ''}" ${attr}="${escapeHtml(k.id)}">${escapeHtml(k.name)}</button>`
        )
        .join('');
    const fixed = offer.elements.length === 1;
    const preview = this.spellId && this.element ? this.options.preview(this.spellId, this.element) : null;
    const body = `
      <div class="ui-dialog-lede">${
        fixed
          ? `It works ${escapeHtml(offer.elements[0])} into one spell you know, for nothing.`
          : 'It works a second element into one spell you know, for nothing.'
      }</div>
      ${
        offer.known.length > 0
          ? `<div class="ui-note">Which spell?</div><div class="sb-slots">${picks('data-forge-spell', offer.known, this.spellId)}</div>`
          : '<div class="ui-note">You know no spell to forge yet. This waits in your Spellbook.</div>'
      }
      ${
        fixed
          ? ''
          : `<div class="ui-note">Which element?</div><div class="sb-slots">${picks(
              'data-forge-element',
              offer.elements.map((e) => ({ id: e, name: e })),
              this.element
            )}</div>`
      }
      ${preview ? `<div class="ui-fact${preview.ok ? '' : ' is-warn'}">${preview.html}</div>` : ''}`;
    const actions =
      dialogButton('forge-offer-forge', 'Forge it', { primary: true, disabled: !preview?.ok }) + dialogButton('forge-offer-later', 'Not now', { key: 'Esc' });
    this.scrim.innerHTML = dialogHtml({ title: offer.source, kicker: 'A free forge', body, actions });
    this.scrim.querySelector('#forge-offer-forge')?.addEventListener('click', () => {
      if (!this.spellId || !this.element || !preview?.ok) return;
      this.options.onForge(offer.index, this.spellId, this.element);
      this.close();
    });
    this.scrim.querySelector('#forge-offer-later')?.addEventListener('click', () => this.close());
    this.scrim.querySelectorAll<HTMLElement>('[data-forge-spell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.spellId = btn.getAttribute('data-forge-spell');
        this.render();
      });
    });
    this.scrim.querySelectorAll<HTMLElement>('[data-forge-element]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.element = btn.getAttribute('data-forge-element');
        this.render();
      });
    });
  }
}
