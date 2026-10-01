import {
  type GameEngine,
  type MasteryPerkId,
  type MasteryScope,
  MASTERY_PERKS,
  resolveManaTerms,
  selectMasteryPerk,
} from '../engine';
import { fillManaTerms } from './characterMenu/characterTab';
import type { UIModal } from './modalStack';

/** One earned mastery waiting on a perk choice. */
export interface MasteryChoiceRequest {
  scope: MasteryScope;
  masteryId: string;
  name: string;
  kills: number;
}

const PERK_IDS = Object.keys(MASTERY_PERKS) as MasteryPerkId[];

/**
 * Offers a mastery perk when a species or category mastery is earned. Requests queue
 * up (one kill can complete both a species and a category mastery) and are shown one
 * at a time. Like the level-up and choice modals, number keys do nothing; clicking or
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
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('mastery-choice-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mastery-choice-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      // Above story choices (170) and pacts (180), below level-up (190): main.ts waits
      // for an open level-up to close before showing this, so the stack order matches.
      overlay.style.zIndex = '185';
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
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

  public highlight(index: number): void {
    if (index < 0 || index >= PERK_IDS.length) return;
    this.activeIndex = index;
    this.render();
  }

  /** Locks in the highlighted perk, then shows the next queued request or closes. */
  public confirm(): boolean {
    const request = this.queue[0];
    const perkId = PERK_IDS[this.activeIndex];
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
      this.engine.log(`Mastery perk for ${request.name} deferred — choose it any time in the Bestiary [B].`);
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
      this.highlight((start + step + PERK_IDS.length) % PERK_IDS.length);
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
    const heading =
      request.scope === 'category'
        ? `Category Mastery: ${request.name}`
        : `Mastery: ${request.name}`;
    const blurb =
      request.scope === 'category'
        ? `You have slain ${request.kills} of ${request.name}. Choose a perk that applies against every creature of this family.`
        : `You have slain ${request.kills} ${request.name}. Choose a perk that applies against this creature.`;

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 560px; max-width: 95vw;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title"><span>★</span><span>${heading}</span></div>
        </div>
        <div class="retro-window-body" style="gap: 8px; background: #090d16; color: #e2e8f0;">
          <div style="font-size: 12px; color: #fef08a;">${blurb}</div>
          <div style="font-size: 10px; color: #94a3b8;">You can change it later, but only while resting in Town.${this.queue.length > 1 ? ` (${this.queue.length - 1} more mastery choice${this.queue.length > 2 ? 's' : ''} waiting)` : ''}</div>
          <div style="display: flex; flex-direction: column; gap: 5px;">
            ${PERK_IDS.map((id, index) => {
              const perk = MASTERY_PERKS[id];
              const focused = index === this.activeIndex;
              return `
                <div class="mastery-perk-row" data-index="${index}" style="cursor: pointer; display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-radius: 2px; background: ${focused ? '#14532d' : '#0f172a'}; border: 1px solid ${focused ? '#22c55e' : '#334155'};">
                  <span style="font-size: 12px; color: ${focused ? '#86efac' : '#64748b'};">${focused ? '●' : '○'}</span>
                  <span style="font-size: 14px;">${perk.icon}</span>
                  <div style="flex: 1;">
                    <b style="color: ${focused ? '#86efac' : '#38bdf8'}; font-size: 12px;">${perk.name}</b>
                    <span style="font-size: 10px; color: #94a3b8; font-style: italic;"> — ${perk.tagline}</span>
                    <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">${fillManaTerms(perk.description, resolveManaTerms(this.engine?.manifest))}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="retro-statusbar" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 4px;">
            <span style="font-size: 11px; color: #a3aec2;">Click or [↑/↓] to choose · [Enter] to lock in · [Esc] decide later</span>
            <div style="display: flex; gap: 6px;">
              <button id="btn-mastery-later" class="win-btn" style="padding: 3px 10px;">Decide Later</button>
              <button id="btn-mastery-confirm" class="win-btn primary-btn" ${hasSelection ? '' : 'disabled'} style="padding: 3px 12px; font-weight: bold;">Confirm [Enter]</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.overlayEl.querySelectorAll('.mastery-perk-row').forEach((row) => {
      row.addEventListener('click', () => {
        this.highlight(Number((row as HTMLElement).getAttribute('data-index')));
      });
    });
    this.overlayEl.querySelector('#btn-mastery-confirm')?.addEventListener('click', () => this.confirm());
    this.overlayEl.querySelector('#btn-mastery-later')?.addEventListener('click', () => this.defer());
  }
}
