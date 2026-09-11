import {
  getStoragePersistenceInfo,
  formatStorageStatus,
} from './persistenceInit';
import {
  generateSaveFilename,
  createSavePackage,
} from '../engine/storage/saveTransfer';
import { triggerSaveDownload } from './saveImporter';
import { serializeGame } from '../engine/storage/serializer';
import { CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../engine/storage/migrator';
import type { GameEngine } from '../engine/engine';
import type { CharacterProfile, SaveData } from '../engine/storage/types';
import type { ProfileManager } from '../engine/storage/profile-manager';
import type { SaveCodeModal } from './saveCodeModal';

export interface SaveQuitModalOptions {
  profileManager: ProfileManager;
  saveCodeModal?: SaveCodeModal;
  onSaveAndExit: () => void;
  onResume: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export class SaveQuitModal {
  public readonly id = 'save-quit';
  public isOpen = false;
  private modalEl: HTMLElement | null = null;
  private storageBadgeEl: HTMLElement | null = null;
  private storageDetailsEl: HTMLElement | null = null;
  private heroSummaryEl: HTMLElement | null = null;
  private exportCotwBtn: HTMLButtonElement | null = null;
  private copyCodeBtn: HTMLButtonElement | null = null;
  private saveExitBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private settingsBtn: HTMLButtonElement | null = null;
  private helpBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;

  private options: SaveQuitModalOptions;
  private activeEngine: GameEngine | null = null;
  private activeProfile: CharacterProfile | null = null;

  constructor(options: SaveQuitModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    let existing = document.getElementById('save-quit-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'save-quit-modal';
    modal.className = 'retro-window-overlay';
    modal.style.display = 'none';
    modal.style.zIndex = '240';

    modal.innerHTML = `
      <div class="retro-window" style="width: 520px; max-width: 95vw;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>💾</span>
            <span>Game Paused &amp; System Menu</span>
          </div>
          <button id="btn-savequit-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 12px;">
          <div id="savequit-hero-summary" style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #1e3a8a;">
            🛡️ Adventurer
          </div>

          <!-- Storage Persistence Banner -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: bold; color: #334155;">BROWSER STORAGE PERSISTENCE:</span>
              <span id="savequit-storage-badge" style="font-size: 11px; font-weight: bold; padding: 2px 6px; border: 1px solid #64748b; background: #e2e8f0;">
                Storage: Standard
              </span>
            </div>
            <div id="savequit-storage-details" style="font-size: 11px; color: #64748b;">
              Checking storage quota...
            </div>
          </div>

          <!-- Action buttons list -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="btn-savequit-resume" class="win-btn primary-btn" style="padding: 8px 10px; font-weight: bold; font-size: 13px;">
              ▶️ Resume Quest
            </button>

            <div style="display: flex; gap: 8px;">
              <button id="btn-savequit-settings" class="win-btn" style="flex: 1; padding: 6px 10px; font-weight: bold;">
                ⚙️ Settings &amp; Controls
              </button>
              <button id="btn-savequit-help" class="win-btn" style="flex: 1; padding: 6px 10px;">
                📖 Help &amp; Manual
              </button>
            </div>

            <div style="display: flex; gap: 8px;">
              <button id="btn-savequit-export-cotw" class="win-btn" style="flex: 1; padding: 6px 10px;">
                💾 Export Save (.cotw)
              </button>
              <button id="btn-savequit-copy-code" class="win-btn" style="flex: 1; padding: 6px 10px;">
                📋 Save Code
              </button>
            </div>

            <button id="btn-savequit-save-exit" class="win-btn" style="padding: 8px 10px; font-weight: bold; font-size: 13px; color: #7f1d1d; border-color: #f87171;">
              🚪 Save &amp; Exit to Title
            </button>
          </div>

          <div class="retro-statusbar" style="margin-top: 12px;">
            <span id="savequit-status">Press Esc or Resume Quest to return to dungeon.</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    this.heroSummaryEl = modal.querySelector('#savequit-hero-summary');
    this.storageBadgeEl = modal.querySelector('#savequit-storage-badge');
    this.storageDetailsEl = modal.querySelector('#savequit-storage-details');
    this.exportCotwBtn = modal.querySelector('#btn-savequit-export-cotw');
    this.copyCodeBtn = modal.querySelector('#btn-savequit-copy-code');
    this.saveExitBtn = modal.querySelector('#btn-savequit-save-exit');
    this.cancelBtn = modal.querySelector('#btn-savequit-resume');
    this.settingsBtn = modal.querySelector('#btn-savequit-settings');
    this.helpBtn = modal.querySelector('#btn-savequit-help');
    this.statusEl = modal.querySelector('#savequit-status');

    modal.querySelector('#btn-savequit-close-x')?.addEventListener('click', () => this.close());
    this.cancelBtn?.addEventListener('click', () => this.close());

    this.settingsBtn?.addEventListener('click', () => {
      this.close();
      this.options.onOpenSettings?.();
    });

    this.helpBtn?.addEventListener('click', () => {
      this.close();
      this.options.onOpenHelp?.();
    });

    this.saveExitBtn?.addEventListener('click', () => {
      this.close();
      this.options.onSaveAndExit();
    });

    this.exportCotwBtn?.addEventListener('click', () => {
      this.handleExportCotw();
    });

    this.copyCodeBtn?.addEventListener('click', () => {
      this.handleOpenSaveCode();
    });
  }

  private getCurrentEnvelope(): VersionedSaveEnvelope<SaveData> | null {
    if (!this.activeEngine || !this.activeProfile) return null;
    const saveData = serializeGame(this.activeEngine, this.activeProfile);
    const manifestId = this.activeEngine.manifest?.id ?? this.activeProfile.manifestId ?? 'cotw';
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      contentManifestId: manifestId,
      timestamp: Date.now(),
      data: saveData,
    };
  }

  private handleExportCotw(): void {
    const envelope = this.getCurrentEnvelope();
    if (!envelope) {
      this.setStatus('Error: No active game state to export.', '#b91c1c');
      return;
    }

    try {
      const jsonContent = createSavePackage(envelope);
      const floor = this.activeEngine?.currentFloor ?? 0;
      const heroName = this.activeProfile?.name ?? this.activeEngine?.player.name ?? 'Hero';
      const manifestId = envelope.contentManifestId;
      const filename = generateSaveFilename(heroName, floor, manifestId, envelope.timestamp);

      triggerSaveDownload(filename, jsonContent);
      this.setStatus(`Exported ${filename} successfully! 💾`, '#15803d');
    } catch (err) {
      this.setStatus(`Export failed: ${(err as Error).message}`, '#b91c1c');
    }
  }

  private handleOpenSaveCode(): void {
    const envelope = this.getCurrentEnvelope();
    if (this.options.saveCodeModal) {
      this.close();
      this.options.saveCodeModal.open('copy', envelope || undefined);
    }
  }

  public refreshStorageInfo(): void {
    const info = getStoragePersistenceInfo();
    const formatted = formatStorageStatus(info);

    if (this.storageBadgeEl) {
      this.storageBadgeEl.textContent = formatted.badge;
      if (formatted.isPersistent) {
        this.storageBadgeEl.style.color = '#15803d';
        this.storageBadgeEl.style.borderColor = '#15803d';
        this.storageBadgeEl.style.background = '#dcfce7';
      } else {
        this.storageBadgeEl.style.color = '#b45309';
        this.storageBadgeEl.style.borderColor = '#b45309';
        this.storageBadgeEl.style.background = '#fef3c7';
      }
    }

    if (this.storageDetailsEl) {
      this.storageDetailsEl.textContent = formatted.tooltip;
    }
  }

  public setStatus(msg: string, color = '#334155'): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = color;
    }
  }

  private boundKeyDownHandler = (e: KeyboardEvent) => {
    if (this.isOpen) {
      this.handleKeyDown(e);
    }
  };

  public open(engine: GameEngine, profile: CharacterProfile): void {
    this.activeEngine = engine;
    this.activeProfile = profile;
    this.isOpen = true;

    if (this.heroSummaryEl) {
      const heroName = profile.name || engine.player.name || 'Hero';
      const floorText = engine.currentFloor === 0 ? 'Town' : `Floor ${engine.currentFloor}`;
      const level = engine.player.level;
      const hp = `${engine.player.hp}/${engine.player.maxHp}`;
      this.heroSummaryEl.textContent = `🛡️ ${heroName} — Level ${level} (HP ${hp}) at ${floorText}`;
    }

    this.refreshStorageInfo();
    this.setStatus('Choose an option to save progress or adjust settings.');

    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', this.boundKeyDownHandler);
      }
    }
  }

  public close(): void {
    this.isOpen = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    this.options.onResume();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }
    return true; // Absorb inputs while modal is open
  }
}
