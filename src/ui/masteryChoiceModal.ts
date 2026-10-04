import {
  type GameEngine,
  type MasteryPerkOption,
  type MasteryScope,
  masteryPerkOptions,
  resolveManaTerms,
  selectMasteryPerk,
} from '../engine';
import { fillManaTerms } from './characterMenu/characterTab';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

/** One earned mastery waiting on a perk choice. */
export interface MasteryChoiceRequest {
  scope: MasteryScope;
  masteryId: string;
  name: string;
  kills: number;
}

/**
 * Offers a mastery perk when a monster family's mastery is earned (Q7 "A": species kills
 * only fill the bestiary page). Requests queue up and are shown one at a time. Like the level-up and choice modals, number keys do nothing; clicking or
 * the arrows only highlight a perk, and Enter or Confirm locks it in. Escape defers the
 * choice to the Slayer's Compendium, where the mastery stays waiting.
 */
export class MasteryChoiceModal implements UIModal {
  public readonly id = 'mastery-choice';
  public isOpen = false;
  private overlayEl: HTMLElement | null = null;
  private engine?: GameEngine;
  private queue: MasteryChoiceRequest[] = [];
  private activeIndex = -1;
  private openedAt = 0;
  private onClosedCallback?: () => void;

  constructor(onClosed?: () => void) {
    this.onClosedCallback = onClosed;
    this.createDom();
  }

  private createDom(): void {
    this.overlayEl = createDialogScrim('mastery-choice-modal');
  }

  /** Queues a request; ignores one already queued for the same mastery. */
  public enqueue(request: MasteryChoiceRequest): void {
    if (this.queue.some((r) => r.scope === request.scope && r.masteryId === request.masteryId)) return;
    this.queue.push(request);
  }

  /** Drops queued requests, e.g. when a different game is loaded. */
  public clearQueue(): void {
    this.queue = [];
    this.close();
  }

  public get hasPending(): boolean {
    return this.queue.length > 0;
  }

  /** Shows the first queued request. Returns false when there is nothing to show. */
  public open(engine: GameEngine): boolean {
    if (this.queue.length === 0) return false;
    this.engine = engine;
    this.isOpen = true;
    this.activeIndex = -1;
    this.openedAt = Date.now();
    this.render();
    if (this.overlayEl) this.overlayEl.style.display = 'flex';
    return true;
  }

  public close(): void {
    if (!this.overlayEl || this.overlayEl.style.display === 'none') {
      this.isOpen = false;
      return;
    }
    this.isOpen = false;
    this.overlayEl.style.display = 'none';
    this.overlayEl.innerHTML = '';
    this.onClosedCallback?.();
  }

  /** The perks the request's family offers: the shared five and the pack's own (tracker 3.6). */
  private options(): MasteryPerkOption[] {
    const request = this.queue[0];
    return request ? masteryPerkOptions(this.engine?.manifest, request.masteryId) : [];
  }

  public highlight(index: number): void {
    if (index < 0 || index >= this.options().length) return;
    this.activeIndex = index;
    this.render();
  }

  /** Locks in the highlighted perk, then shows the next queued request or closes. */
  public confirm(): boolean {
    const request = this.queue[0];
    const perkId = this.options()[this.activeIndex]?.id;
    if (!this.engine || !request || !perkId) return false;
    const result = selectMasteryPerk(this.engine, request.scope, request.masteryId, perkId);
    if (!result.success) return false;
    this.advance();
    return true;
  }

  /** Leaves this mastery waiting in the Compendium and moves on. */
  public defer(): void {
    const request = this.queue[0];
    if (request && this.engine) {
      this.engine.log(`Mastery perk for ${request.name} deferred: choose it any time in the Bestiary (B).`);
    }
    this.advance();
  }

  private advance(): void {
    this.queue.shift();
    if (this.queue.length > 0) {
      this.activeIndex = -1;
      this.openedAt = Date.now();
      this.render();
    } else {
      this.close();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    // Safety debounce: swallow movement keys still in flight when the kill landed.
    if (Date.now() - this.openedAt < 200) {
      e.preventDefault();
      return true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.defer();
      return true;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const start = this.activeIndex < 0 ? (step > 0 ? -1 : 0) : this.activeIndex;
      const count = this.options().length;
      this.highlight((start + step + count) % count);
      return true;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirm();
      return true;
    }
    // Everything else (number keys included) is swallowed.
    return true;
  }

  private render(): void {
    const request = this.queue[0];
    if (!this.overlayEl || !request) return;
    const hasSelection = this.activeIndex >= 0;
    const blurb =
      request.scope === 'category'
        ? `You have slain ${request.kills} of ${request.name}. Choose a perk that applies against every creature of this family.`
        : `You have slain ${request.kills} ${request.name}. Choose a perk that applies against this creature.`;

    const mana = resolveManaTerms(this.engine?.manifest);
    const waiting = this.queue.length - 1;
    const perks = this.options().map((perk, index) => {
      const focused = index === this.activeIndex;
      return `
        <div class="ui-option mastery-perk-row${focused ? ' is-focused' : ''}" data-index="${index}">
          <div class="ui-option-mark">${focused ? '▶' : '◇'}</div>
          <div class="ui-option-body">
            <div class="ui-option-label">${escapeHtml(perk.name)}${perk.tagline ? ` <span class="ui-faint">— ${escapeHtml(perk.tagline)}</span>` : ''}</div>
            <div class="ui-option-desc">${escapeHtml(fillManaTerms(perk.description, mana))}</div>
          </div>
        </div>`;
    }).join('');

    this.overlayEl.innerHTML = dialogHtml({
      title: request.name,
      kicker: request.scope === 'category' ? 'Category mastery' : 'Mastery',
      body: `
        <div class="ui-dialog-lede">${escapeHtml(blurb)}</div>
        <div class="ui-note">You can change it later, but only in town.${waiting > 0 ? ` ${waiting} more mastery choice${waiting > 1 ? 's' : ''} waiting.` : ''}</div>
        <div class="ui-options">${perks}</div>`,
      hints: [
        { keys: ['↑', '↓'], label: 'choose' },
        { keys: ['Enter'], label: 'confirm' },
        { keys: ['Esc'], label: 'decide later' },
      ],
      actions:
        dialogButton('btn-mastery-later', 'Decide later') +
        dialogButton('btn-mastery-confirm', 'Confirm', { primary: true, disabled: !hasSelection, key: 'Enter' }),
    });

    this.overlayEl.querySelectorAll('.mastery-perk-row').forEach((row) => {
      row.addEventListener('click', () => {
        this.highlight(Number((row as HTMLElement).getAttribute('data-index')));
      });
    });
    this.overlayEl.querySelector('#btn-mastery-confirm')?.addEventListener('click', () => this.confirm());
    this.overlayEl.querySelector('#btn-mastery-later')?.addEventListener('click', () => this.defer());
  }
}
