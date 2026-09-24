import { resolveContinueTarget } from '../../engine';
import type { AutosaveManager, ContinueTarget, ProfileManager } from '../../engine';
import { formatStorageStatus, getStoragePersistenceInfo } from '../persistenceInit';
import { APP_VERSION, resolveBranding } from '../branding';

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
}

export class MainMenu {
  private options: MainMenuOptions;
  private container: HTMLElement | null = null;
  private continueBtn: HTMLButtonElement | null = null;
  private loadBtn: HTMLButtonElement | null = null;
  private saveSummaryEl: HTMLElement | null = null;
  private storageStatusEl: HTMLElement | null = null;
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
      this.isOpen = true;
      this.refreshSaveStatus();
      this.updateStorageIndicator();
    }
  }

  public hide(): void {
    this.isOpen = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public refreshSaveStatus(): void {
    if (!this.continueBtn) return;

    const target = resolveContinueTarget(this.options.profileManager, this.options.autosaveManager);
    this.continueBtn.disabled = !target;
    this.continueBtn.textContent = target ? `⚡ Continue (${target.profileName} - F${target.floor})` : '⚡ Continue';
    if (!this.saveSummaryEl) return;
    if (target) {
      this.saveSummaryEl.textContent = `${target.kind === 'autosave' ? 'Active autosave' : 'Saved hero'}: ${target.profileName} at Depth ${target.floor}.`;
    } else if (this.options.profileManager.listProfiles().length > 0) {
      this.saveSummaryEl.textContent = 'Your last hero has fallen. Load a saved game or roll a new hero.';
    } else {
      this.saveSummaryEl.textContent = 'No saved adventurers found. Roll a new hero to begin!';
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
    overlay.className = 'retro-window-overlay';
    overlay.style.display = 'none';
    overlay.style.zIndex = '180';

    const brand = resolveBranding(this.options.profileManager.manifest);
    overlay.innerHTML = `
      <div class="retro-window" style="width: 520px; max-width: 95vw; box-shadow: 0 0 40px rgba(0, 0, 0, 0.9);">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>🛡️</span>
            <span>${brand.title} - Main Menu</span>
          </div>
          <div style="font-size: 10px; opacity: 0.9;">DOS / Win 3.1</div>
        </div>

        <div class="retro-window-body" style="padding: 16px; gap: 14px;">
          <!-- Banner -->
          <div class="retro-banner" style="padding: 14px 12px;">
            <div class="retro-banner-title" style="font-size: 22px; letter-spacing: 3px;">${brand.title.toUpperCase()}</div>
            <div class="retro-banner-sub" style="font-size: 12px; margin-top: 4px;">${brand.tagline}</div>
          </div>

          <!-- Main Options List -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <button type="button" id="btn-menu-continue" class="win-btn primary-btn" style="padding: 10px; font-size: 14px; font-weight: bold;">
              ⚡ Continue
            </button>
            <button type="button" id="btn-menu-load" class="win-btn" style="padding: 10px; font-size: 14px; font-weight: bold;">
              📂 Load Saved Game
            </button>
            <button type="button" id="btn-menu-new-game" class="win-btn" style="padding: 10px; font-size: 14px; font-weight: bold;">
              ⚔️ New Game
            </button>
            <button type="button" id="btn-menu-settings" class="win-btn" style="padding: 9px; font-size: 13px;">
              ⚙️ Settings &amp; Keybindings
            </button>
            <button type="button" id="btn-menu-help" class="win-btn" style="padding: 9px; font-size: 13px;">
              📖 Help &amp; Controls Manual
            </button>
            <button type="button" id="btn-menu-feedback" class="win-btn" style="padding: 9px; font-size: 13px;">
              💬 Send Feedback &amp; Bug Report
            </button>
            <button type="button" id="btn-menu-valhalla" class="win-btn" style="padding: 9px; font-size: 13px;">
              🏆 ${brand.hallOfFameName} Leaderboard
            </button>
          </div>

          <!-- Save File Summary Inset -->
          <div id="main-menu-save-summary" style="background: #ffffff; border: 2px inset #ffffff; padding: 6px 10px; font-size: 11px; color: #334155; min-height: 24px;">
            Checking save files...
          </div>

          <!-- Statusbar -->
          <div class="retro-statusbar" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span id="main-menu-storage-status" class="storage-badge-pill">Storage: Checking...</span>
            <span class="version-tag">${APP_VERSION}</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

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
