import { resolveContinueTarget } from '../../engine';
import type { AutosaveManager, ContinueTarget, ProfileManager } from '../../engine';
import { formatStorageStatus, getStoragePersistenceInfo } from '../persistenceInit';
import { APP_VERSION, resolveBranding } from '../branding';
import { escapeHtml } from '../html';
import { ScreenBackdrop } from '../screenArt';

export interface MainMenuOptions {
  profileManager: ProfileManager;
  autosaveManager?: AutosaveManager;
  onNewGame: () => void;
  onContinue: (target: ContinueTarget) => void;
  onLoadGame: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenValhalla: () => void;
  onOpenFeedback?: () => void;
  /** False holds the pack's painted title screen still (Reduce motion). */
  motion?: () => boolean;
}

export class MainMenu {
  private options: MainMenuOptions;
  private container: HTMLElement | null = null;
  private continueBtn: HTMLButtonElement | null = null;
  private loadBtn: HTMLButtonElement | null = null;
  private saveSummaryEl: HTMLElement | null = null;
  private storageStatusEl: HTMLElement | null = null;
  private backdrop: ScreenBackdrop | null = null;
  public isOpen = false;

  constructor(options: MainMenuOptions) {
    this.options = options;
    this.createDom();
  }

  public show(): void {
    if (!this.container) {
      this.createDom();
    }
    if (this.container) {
      this.container.style.display = 'flex';
      this.backdrop?.show(this.options.profileManager.manifest?.screenArt?.title);
      this.isOpen = true;
      this.refreshSaveStatus();
      this.updateStorageIndicator();
    }
  }

  public hide(): void {
    this.isOpen = false;
    this.backdrop?.hide();
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public refreshSaveStatus(): void {
    if (!this.continueBtn) return;

    const target = resolveContinueTarget(this.options.profileManager, this.options.autosaveManager);
    // Continue shows only when there is something to continue.
    this.continueBtn.disabled = !target;
    this.continueBtn.hidden = !target;
    this.continueBtn.textContent = target ? `Continue (${target.profileName}, F${target.floor})` : 'Continue';
    if (!this.saveSummaryEl) return;
    if (target) {
      this.saveSummaryEl.textContent = `${target.kind === 'autosave' ? 'Autosave' : 'Saved hero'}: ${target.profileName}, floor ${target.floor}.`;
    } else if (this.options.profileManager.listProfiles().length > 0) {
      this.saveSummaryEl.textContent = 'Your last hero has fallen. Load a saved game or roll a new hero.';
    } else {
      this.saveSummaryEl.textContent = 'No saved heroes yet. Start a new game to begin.';
    }
  }

  public updateStorageIndicator(): void {
    if (!this.storageStatusEl) return;
    try {
      const info = getStoragePersistenceInfo();
      const formatted = formatStorageStatus(info);
      this.storageStatusEl.textContent = formatted.badge;
      this.storageStatusEl.title = formatted.tooltip;
      if (formatted.isPersistent) {
        this.storageStatusEl.className = 'storage-badge-pill active';
      } else {
        this.storageStatusEl.className = 'storage-badge-pill';
      }
    } catch {
      this.storageStatusEl.textContent = 'Storage: Standard';
    }
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;
    let existing = document.getElementById('main-menu-screen');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'main-menu-screen';
    overlay.className = 'ts-screen';
    overlay.style.display = 'none';

    // A full-height title screen (ADR-0011): the pack's name and tagline, one column of
    // choices, and the save and storage status at the foot; over the pack's painting, when it
    // has one, the column moves into the painting's calm box and the painted lettering stands
    // for the name (kept in the page for screen readers).
    const brand = resolveBranding(this.options.profileManager.manifest);
    const btn = (id: string, label: string, primary = false) =>
      `<button type="button" id="${id}" class="ui-btn ts-btn${primary ? ' ui-btn--primary' : ''}">${escapeHtml(label)}</button>`;
    overlay.innerHTML = `
      <div class="ts-inner">
        <header class="ts-brand">
          <h1 class="ts-title">${escapeHtml(brand.title)}</h1>
          <div class="ts-tagline">${escapeHtml(brand.tagline)}</div>
          ${brand.ornament ? `<div class="ts-ornament" aria-hidden="true">${escapeHtml(brand.ornament)}</div>` : ''}
        </header>
        <nav class="ts-menu" aria-label="Main menu">
          ${btn('btn-menu-continue', 'Continue', true)}
          ${btn('btn-menu-new-game', 'New game')}
          ${btn('btn-menu-load', 'Load a saved game')}
          ${btn('btn-menu-settings', 'Settings and keys')}
          ${btn('btn-menu-help', 'Help')}
          ${btn('btn-menu-valhalla', brand.hallOfFameName)}
          ${btn('btn-menu-feedback', 'Send feedback')}
        </nav>
        <div id="main-menu-save-summary" class="ui-note ts-summary">Checking saves...</div>
        <footer class="ts-foot">
          <span id="main-menu-storage-status" class="storage-badge-pill">Storage: checking...</span>
          <span class="version-tag">${APP_VERSION}</span>
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;
    this.backdrop?.hide();
    this.backdrop = new ScreenBackdrop(overlay, { motion: this.options.motion ?? (() => true), minPanel: 300 });

    this.continueBtn = overlay.querySelector('#btn-menu-continue') as HTMLButtonElement | null;
    this.loadBtn = overlay.querySelector('#btn-menu-load') as HTMLButtonElement | null;
    this.saveSummaryEl = overlay.querySelector('#main-menu-save-summary');
    this.storageStatusEl = overlay.querySelector('#main-menu-storage-status');

    // Button event listeners
    this.continueBtn?.addEventListener('click', () => {
      const target = resolveContinueTarget(this.options.profileManager, this.options.autosaveManager);
      if (!target) return;
      this.hide();
      this.options.onContinue(target);
    });

    this.loadBtn?.addEventListener('click', () => {
      this.options.onLoadGame();
    });

    overlay.querySelector('#btn-menu-new-game')?.addEventListener('click', () => {
      this.hide();
      this.options.onNewGame();
    });

    overlay.querySelector('#btn-menu-settings')?.addEventListener('click', () => {
      this.options.onOpenSettings();
    });

    overlay.querySelector('#btn-menu-help')?.addEventListener('click', () => {
      this.options.onOpenHelp();
    });

    overlay.querySelector('#btn-menu-feedback')?.addEventListener('click', () => {
      this.options.onOpenFeedback?.();
    });

    overlay.querySelector('#btn-menu-valhalla')?.addEventListener('click', () => {
      this.options.onOpenValhalla();
    });
  }
}
