import type { ProfileManager, AutosaveManager } from '../engine';
import type { UIModal } from './modalStack';
import { showToast } from './toast';

export interface SaveSlotModalOptions {
  profileManager: ProfileManager;
  autosaveManager?: AutosaveManager;
  onLoadProfile: (profileId: string) => Promise<boolean> | boolean;
  onLoadAutosave: () => Promise<boolean> | boolean;
  onClose?: () => void;
}

export class SaveSlotModal implements UIModal {
  public readonly id = 'save-slot-modal';
  private options: SaveSlotModalOptions;
  private overlayEl: HTMLElement | null = null;
  public isOpen = false;

  constructor(options: SaveSlotModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('save-slot-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'save-slot-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '200';
      document.body.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public open(): void {
    this.isOpen = true;
    if (!this.overlayEl) {
      this.createDom();
    }
    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  /** Cancels out of the modal: hides it and hands control back via `onClose` (the main menu). */
  public close(): void {
    if (!this.hide()) return;
    this.options.onClose?.();
  }

  /** Hides without `onClose` — after a successful load the game owns the screen, and
   * `onClose` reopening the main menu would cover it. */
  private hide(): boolean {
    if (!this.isOpen) return false;
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return true;
    }

    return true;
  }

  private async handleLoadAutosave(): Promise<void> {
    try {
      const success = await this.options.onLoadAutosave();
      if (success) {
        this.hide();
      } else {
        showToast('Unable to load autosave payload: save data is invalid or empty.', 'error');
      }
    } catch (err) {
      showToast(`Autosave file is corrupt or unreadable: ${(err as Error).message}`, 'error');
    }
  }

  private async handleLoadProfile(profileId: string): Promise<void> {
    try {
      const success = await this.options.onLoadProfile(profileId);
      if (success) {
        this.hide();
      } else {
        showToast(`Unable to load character save: save payload not found.`, 'error');
      }
    } catch (err) {
      showToast(`Save file is corrupt or unreadable: ${(err as Error).message}`, 'error');
    }
  }

  private handleDeleteProfile(profileId: string, profileName: string): void {
    if (typeof window !== 'undefined' && window.confirm(`Permanently delete save data for ${profileName}?`)) {
      try {
        this.options.profileManager.deleteCharacter(profileId);
        showToast(`Deleted save for ${profileName}.`, 'info');
        this.render();
      } catch (err) {
        showToast(`Failed to delete profile: ${(err as Error).message}`, 'error');
      }
    }
  }

  public render(): void {
    if (!this.overlayEl) return;

    const autosaveMeta = this.options.autosaveManager?.getAutosaveMetadata();
    const profiles = this.options.profileManager.listProfiles();

    let autosaveCardHtml = '';
    if (autosaveMeta) {
      const dateStr = new Date(autosaveMeta.timestamp).toLocaleString();
      autosaveCardHtml = `
        <div class="save-slot-card autosave-card" style="
          background: #1e293b;
          border: 2px solid #38bdf8;
          border-radius: 6px;
          padding: 12px 14px;
          margin-bottom: 12px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #0284c7; color: #ffffff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px;">
                  AUTOSAVE
                </span>
                <span style="font-weight: bold; font-size: 15px; color: #f8fafc;">${autosaveMeta.profileName}</span>
                <span style="font-size: 12px; color: #94a3b8;">Floor ${autosaveMeta.floor}</span>
              </div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">
                🕒 Last Saved: ${dateStr}
              </div>
            </div>
            <div>
              <button
                type="button"
                id="btn-load-autosave"
                class="win-btn primary-btn"
                style="padding: 6px 14px; font-size: 12px; font-weight: bold; cursor: pointer;"
              >
                ⚡ Resume Autosave
              </button>
            </div>
          </div>
        </div>
      `;
    }

    let profileListHtml = '';
    if (profiles.length === 0 && !autosaveMeta) {
      profileListHtml = `
        <div style="text-align: center; padding: 30px 10px; color: #94a3b8; font-style: italic;">
          No save files found on this machine.<br>
          Select 'New Game' from the title screen to embark on an adventure!
        </div>
      `;
    } else if (profiles.length > 0) {
      const sortedProfiles = [...profiles].sort((a, b) => b.lastSaved - a.lastSaved);
      profileListHtml = sortedProfiles.map((prof) => {
        const dateStr = new Date(prof.lastSaved).toLocaleString();
        const statusBadge = prof.questStatus === 'victorious'
          ? '<span style="background: #15803d; color: #ffffff; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: bold;">🏆 VICTOR</span>'
          : prof.questStatus === 'fallen'
          ? '<span style="background: #991b1b; color: #ffffff; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✝ FALLEN</span>'
          : '<span style="background: #334155; color: #cbd5e1; font-size: 10px; padding: 2px 6px; border-radius: 3px;">ACTIVE</span>';

        return `
          <div class="save-slot-card profile-card" data-profile-id="${prof.id}" style="
            background: #1e293b;
            border: 1px solid #475569;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1; min-width: 0; padding-right: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                <span style="font-weight: bold; font-size: 14px; color: #f8fafc;">${prof.name}</span>
                <span style="color: #ca8a04; font-size: 12px; font-weight: bold;">Level ${prof.level}</span>
                <span style="color: #94a3b8; font-size: 12px;">(Floor ${prof.floor})</span>
                ${statusBadge}
              </div>
              <div style="font-size: 11px; color: #94a3b8;">
                Difficulty: <span style="color: #e2e8f0; text-transform: capitalize;">${prof.difficulty ? prof.difficulty.charAt(0).toUpperCase() + prof.difficulty.slice(1) : 'Normal'}</span> |
                HP: <span style="color: #ef4444;">${prof.hp}/${prof.maxHp}</span> |
                Strength: <span style="color: #e2e8f0;">${prof.strength}</span>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                Saved: ${dateStr}
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button
                type="button"
                class="win-btn btn-load-profile"
                data-profile-id="${prof.id}"
                style="padding: 6px 12px; font-size: 12px; font-weight: bold; cursor: pointer;"
              >
                📂 Load
              </button>
              <button
                type="button"
                class="win-btn btn-delete-profile"
                data-profile-id="${prof.id}"
                data-profile-name="${prof.name}"
                style="padding: 6px 8px; font-size: 12px; color: #f87171; cursor: pointer;"
                title="Delete Save"
              >
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="
        width: 580px;
        max-width: 95vw;
        max-height: 85vh;
        background: #0f172a;
        border: 2px solid #3b82f6;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.85);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        color: #e2e8f0;
        font-family: 'Courier New', Courier, monospace;
      ">
        <!-- Title bar -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #1e3a8a;
          border-bottom: 2px solid #2563eb;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">💾</span>
            <span style="font-weight: bold; font-size: 15px; color: #ffffff; letter-spacing: 1px;">
              Load Saved Adventure
            </span>
          </div>
          <button id="btn-close-saveslot-top" style="
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
          ">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 14px; overflow-y: auto; flex: 1;">
          ${autosaveCardHtml}
          <div style="margin-bottom: 8px; font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase;">
            Character Saves (${profiles.length})
          </div>
          <div class="profiles-list">
            ${profileListHtml}
          </div>
        </div>

        <!-- Footer -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-top: 1px solid #334155;
          background: #0f172a;
        ">
          <span style="font-size: 11px; color: #64748b;">
            Corrupted saves are handled safely without crashing.
          </span>
          <button id="btn-close-saveslot-bottom" class="win-btn" style="
            padding: 6px 16px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
          ">
            Back [Esc]
          </button>
        </div>
      </div>
    `;

    // Bind event listeners
    this.overlayEl.querySelector('#btn-close-saveslot-top')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btn-close-saveslot-bottom')?.addEventListener('click', () => this.close());

    this.overlayEl.querySelector('#btn-load-autosave')?.addEventListener('click', () => {
      void this.handleLoadAutosave();
    });

    const loadBtns = this.overlayEl.querySelectorAll('.btn-load-profile');
    loadBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const profId = (e.currentTarget as HTMLElement).getAttribute('data-profile-id');
        if (profId) {
          void this.handleLoadProfile(profId);
        }
      });
    });

    const delBtns = this.overlayEl.querySelectorAll('.btn-delete-profile');
    delBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const profId = (e.currentTarget as HTMLElement).getAttribute('data-profile-id');
        const profName = (e.currentTarget as HTMLElement).getAttribute('data-profile-name') ?? 'Hero';
        if (profId) {
          this.handleDeleteProfile(profId, profName);
        }
      });
    });
  }
}
