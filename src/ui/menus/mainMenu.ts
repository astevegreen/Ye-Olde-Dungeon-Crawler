import type { ProfileManager } from '../../engine';
import type { AutosaveManager } from '../../engine';
import { formatStorageStatus, getStoragePersistenceInfo } from '../persistenceInit';

export interface MainMenuOptions {
  profileManager: ProfileManager;
  autosaveManager?: AutosaveManager;
  onNewGame: () => void;
  onContinue: (profileId?: string) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenValhalla: () => void;
}

export class MainMenu {
  private options: MainMenuOptions;
  private container: HTMLElement | null = null;
  private continueBtn: HTMLButtonElement | null = null;
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

    const autosaveMeta = this.options.autosaveManager?.getAutosaveMetadata();
    const profiles = this.options.profileManager.listProfiles();

    if (autosaveMeta) {
      this.continueBtn.disabled = false;
      this.continueBtn.textContent = `⚡ Continue (${autosaveMeta.profileName} - F${autosaveMeta.floor})`;
      if (this.saveSummaryEl) {
        this.saveSummaryEl.textContent = `Active autosave: ${autosaveMeta.profileName} at Depth ${autosaveMeta.floor}.`;
      }
    } else if (profiles.length > 0) {
      // Pick most recently saved profile
      const latestProfile = [...profiles].sort((a, b) => b.lastSaved - a.lastSaved)[0];
      this.continueBtn.disabled = false;
      this.continueBtn.textContent = `⚡ Continue (${latestProfile.name} - F${latestProfile.floor})`;
      if (this.saveSummaryEl) {
        this.saveSummaryEl.textContent = `Saved hero: ${latestProfile.name} (Level ${latestProfile.level}, Floor ${latestProfile.floor}).`;
      }
    } else {
      this.continueBtn.disabled = true;
      this.continueBtn.textContent = '⚡ Continue / Load Game';
      if (this.saveSummaryEl) {
        this.saveSummaryEl.textContent = 'No saved adventurers found. Roll a new hero to begin!';
      }
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

    overlay.innerHTML = `
      <div class="retro-window" style="width: 520px; max-width: 95vw; box-shadow: 0 0 40px rgba(0, 0, 0, 0.9);">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>🛡️</span>
            <span>Castle of the Winds - Main Menu</span>
          </div>
          <div style="font-size: 10px; opacity: 0.9;">DOS / Win 3.1</div>
        </div>

        <div class="retro-window-body" style="padding: 16px; gap: 14px;">
          <!-- Banner -->
          <div class="retro-banner" style="padding: 14px 12px;">
            <div class="retro-banner-title" style="font-size: 22px; letter-spacing: 3px;">CASTLE OF THE WINDS</div>
            <div class="retro-banner-sub" style="font-size: 12px; margin-top: 4px;">A Classic Role-Playing Adventure (1989-1993)</div>
          </div>

          <!-- Main Options List -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
            <button type="button" id="btn-menu-continue" class="win-btn primary-btn" style="padding: 10px; font-size: 14px; font-weight: bold;">
              ⚡ Continue / Load Game
            </button>
            <button type="button" id="btn-menu-new-game" class="win-btn" style="padding: 10px; font-size: 14px; font-weight: bold;">
              ⚔️ New Game / Character Roster
            </button>
            <button type="button" id="btn-menu-settings" class="win-btn" style="padding: 9px; font-size: 13px;">
              ⚙️ Settings &amp; Keybindings
            </button>
            <button type="button" id="btn-menu-help" class="win-btn" style="padding: 9px; font-size: 13px;">
              📖 Help &amp; Controls Manual
            </button>
            <button type="button" id="btn-menu-valhalla" class="win-btn" style="padding: 9px; font-size: 13px;">
              🏆 Hall of Valhalla Leaderboard
            </button>
          </div>

          <!-- Save File Summary Inset -->
          <div id="main-menu-save-summary" style="background: #ffffff; border: 2px inset #ffffff; padding: 6px 10px; font-size: 11px; color: #334155; min-height: 24px;">
            Checking save files...
          </div>

          <!-- Statusbar -->
          <div class="retro-statusbar" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span id="main-menu-storage-status" class="storage-badge-pill">Storage: Checking...</span>
            <span class="version-tag">v1.0.0-final</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

    this.continueBtn = overlay.querySelector('#btn-menu-continue') as HTMLButtonElement | null;
    this.saveSummaryEl = overlay.querySelector('#main-menu-save-summary');
    this.storageStatusEl = overlay.querySelector('#main-menu-storage-status');

    // Button event listeners
    this.continueBtn?.addEventListener('click', () => {
      this.hide();
      this.options.onContinue();
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

    overlay.querySelector('#btn-menu-valhalla')?.addEventListener('click', () => {
      this.options.onOpenValhalla();
    });
  }
}
