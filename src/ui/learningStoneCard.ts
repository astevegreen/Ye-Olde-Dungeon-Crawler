import type { LearningStoneCard as StoneCardData } from '../engine';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

export interface LearningStoneCardOptions {
  /** Read one face (a spell id), or take the shard's rune (`null`); a player action. */
  onRead: (spellId: string | null) => void;
  /** Closed by any answer or Escape; the caller pops it off the modal stack. */
  onClose: () => void;
}

/**
 * The card a stone shows when its shard is set: read one of its faces, take the rune
 * instead, or not now (the stone keeps them while the hero stays on the floor). A spell that
 * finds no free slot goes on to the offer card, which asks what to forget.
 */
export class LearningStoneCard implements UIModal {
  public readonly id = 'learning-stone-card';
  public isOpen = false;
  private readonly scrim: HTMLElement | null;
  private card: StoneCardData | null = null;

  constructor(private readonly options: LearningStoneCardOptions) {
    this.scrim = createDialogScrim(this.id);
  }

  public open(card: StoneCardData): void {
    if (!this.scrim) return;
    this.card = card;
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
    this.card = null;
    this.options.onClose();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    const face = this.card?.faces[Number(e.key) - 1];
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (face) {
      e.preventDefault();
      this.read(face.id);
    }
    return true;
  }

  private read(spellId: string | null): void {
    this.options.onRead(spellId);
    this.close();
  }

  private render(): void {
    const card = this.card;
    if (!this.scrim || !card) return;
    const off = Math.round((1 - card.costShare) * 100);
    const faces = card.faces
      .map((f) => `<div class="ui-fact"><b>${escapeHtml(f.name)}</b> ${escapeHtml(f.description || 'No one has written down what this does.')}</div>`)
      .join('');
    const lede =
      card.faces.length === 0
        ? 'The stone has no spell left that you could learn.'
        : card.faces.length === 1
          ? 'The stone shows one spell. Read it, or leave it.'
          : 'The stone shows two spells. Read one; the other stays unread.';
    const rune = card.runeName ? `Take ${card.runeName}` : 'Take neither';
    const body = `
      <div class="ui-dialog-lede">${lede}</div>
      ${faces}
      ${card.shortcut && off > 0 && card.faces.length > 0 ? `<div class="ui-note">Read through the shortcut, it costs ${off}% less for the rest of this run.</div>` : ''}
      <div class="ui-note">${card.shortcut ? 'The shard stays in your hand while you stay on this floor.' : 'The stone keeps its spells while you stay on this floor.'} Leaving turns the shard into a rune.</div>`;
    const actions =
      card.faces.map((f, i) => dialogButton(`stone-face-${i}`, `Read ${f.name}`, { primary: i === 0, key: String(i + 1) })).join('') +
      dialogButton('stone-rune', card.faces.length === 0 ? (card.runeName ? `Take ${card.runeName}` : 'Take the rune') : rune) +
      dialogButton('stone-later', 'Not now', { key: 'Esc' });
    this.scrim.innerHTML = dialogHtml({ title: card.stoneName, kicker: card.shortcut ? 'The shard sings' : 'A stone', body, actions });
    card.faces.forEach((f, i) => this.scrim?.querySelector(`#stone-face-${i}`)?.addEventListener('click', () => this.read(f.id)));
    this.scrim.querySelector('#stone-rune')?.addEventListener('click', () => this.read(null));
    this.scrim.querySelector('#stone-later')?.addEventListener('click', () => this.close());
  }
}
