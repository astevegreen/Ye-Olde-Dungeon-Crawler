import {
  generateSaveFilename,
  createSavePackage,
  SAVE_FILE_EXTENSION,
} from '../engine';
import { triggerSaveDownload } from './saveImporter';
import { serializeGame } from '../engine';
import { CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../engine';
import type { GameEngine } from '../engine';
import type { CharacterProfile, SaveData } from '../engine';
import type { ProfileManager } from '../engine';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';

export interface SaveQuitModalOptions {
  profileManager: ProfileManager;
  onSaveAndExit: () => void;
  onResume: () => void;
  /** The openers below run after this modal has closed and left the modal stack; each
   *  registers the window it opens there, or the game would take its keys. */
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onOpenSaveCode?: (envelope?: VersionedSaveEnvelope<SaveData>) => void;
}

export class SaveQuitModal implements UIModal {
  public readonly id = 'save-quit';
  public isOpen = false;
  /** Whether the window is showing. Kept apart from `isOpen`, which the modal stack clears
   *  before it calls `close()`, so a stack-driven close still hides the window, and
   *  `onResume` runs once however the modal closes. */
  private shown = false;
  private modalEl: HTMLElement | null = null;
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
    const modal = createDialogScrim('save-quit-modal', 'system');
    if (!modal) return;
    // Resume first; the rest in the order players reach for them. Storage details live in
    // Settings now. Save & Exit is an ordinary choice, not a warning: it saves.
    modal.innerHTML = dialogHtml({
      title: 'Paused',
      titleId: 'savequit-hero-summary',
      kicker: 'Menu',
      closeId: 'btn-savequit-close-x',
      closeTitle: 'Resume (Esc)',
      size: 'narrow',
      body: `
        <div class="pause-actions">
          ${dialogButton('btn-savequit-resume', 'Resume', { primary: true, key: 'Esc' })}
          ${dialogButton('btn-savequit-settings', 'Settings and keys')}
          ${dialogButton('btn-savequit-help', 'Help')}
          <div class="pause-row">
            ${dialogButton('btn-savequit-export-cotw', `Export save (${SAVE_FILE_EXTENSION})`)}
            ${dialogButton('btn-savequit-copy-code', 'Save code')}
          </div>
          ${dialogButton('btn-savequit-save-exit', 'Save and exit to title')}
        </div>
        <div id="savequit-status" class="ui-note"></div>`,
    });
    this.modalEl = modal;

    this.heroSummaryEl = modal.querySelector('#savequit-hero-summary');
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
    const manifestId = this.activeEngine.manifest.id;
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
      this.setStatus('There is no game to export.', 'bad');
      return;
    }

    try {
      const jsonContent = createSavePackage(envelope);
      const floor = this.activeEngine?.currentFloor ?? 0;
      const heroName = this.activeProfile?.name ?? this.activeEngine?.player.name ?? 'Hero';
      const manifestId = envelope.contentManifestId;
      const filename = generateSaveFilename(heroName, floor, manifestId, envelope.timestamp);

      triggerSaveDownload(filename, jsonContent);
      this.setStatus(`Saved ${filename}.`, 'good');
    } catch (err) {
      this.setStatus(`Export failed: ${(err as Error).message}`, 'bad');
    }
  }

  private handleOpenSaveCode(): void {
    const envelope = this.getCurrentEnvelope();
    if (this.options.onOpenSaveCode) {
      this.close();
      this.options.onOpenSaveCode(envelope || undefined);
    }
  }

  public setStatus(msg: string, tone: 'note' | 'good' | 'bad' = 'note'): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.className = tone === 'note' ? 'ui-note' : `ui-note ${tone === 'good' ? 'ui-up' : 'ui-down'}`;
    }
  }

  public open(engine: GameEngine, profile: CharacterProfile): void {
    this.activeEngine = engine;
    this.activeProfile = profile;
    this.isOpen = true;
    this.shown = true;

    if (this.heroSummaryEl) {
      const heroName = profile.name || engine.player.name || 'Hero';
      const floorText = engine.currentFloor === 0 ? 'Town' : `Floor ${engine.currentFloor}`;
      const level = engine.player.level;
      const hp = `${engine.player.hp}/${engine.player.maxHp}`;
      this.heroSummaryEl.textContent = `${heroName} · Level ${level} · ${floorText} · Health ${hp}`;
    }

    this.setStatus('');

    // Keys arrive only through the modal stack: main.ts pushes this modal, and InputHandler's
    // window listener routes each key to the stack top. It opens only in game, where
    // InputHandler is enabled, so it adds no window listener of its own — that second path
    // delivered every key to handleKeyDown twice.
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
    }
  }

  /** The dialog, for the modal stack's focus handling (§6): Tab moves within it. */
  public focusRoot(): HTMLElement | null {
    return this.modalEl;
  }

  public close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.isOpen = false;
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
