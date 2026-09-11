import { encodeSaveCode, decodeSaveCode } from '../engine/storage/saveTransfer';
import { copyTextToClipboard } from './platform';
import type { VersionedSaveEnvelope } from '../engine/storage/migrator';
import type { SaveData, CharacterProfile } from '../engine/storage/types';
import type { ProfileManager } from '../engine/storage/profile-manager';
import { showManifestMismatchDialog } from './saveImporter';

export interface SaveCodeModalOptions {
  profileManager: ProfileManager;
  activeManifestId: string;
  getActiveEnvelope?: () => VersionedSaveEnvelope<SaveData> | null;
  onRestored?: (profile: CharacterProfile) => void;
  onClose?: () => void;
}

export class SaveCodeModal {
  private modalEl: HTMLElement | null = null;
  private copyTabBtn: HTMLButtonElement | null = null;
  private pasteTabBtn: HTMLButtonElement | null = null;
  private copySectionEl: HTMLElement | null = null;
  private pasteSectionEl: HTMLElement | null = null;
  private copyTextarea: HTMLTextAreaElement | null = null;
  private pasteTextarea: HTMLTextAreaElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private restoreBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLElement | null = null;

  private options: SaveCodeModalOptions;
  private currentEnvelope: VersionedSaveEnvelope<SaveData> | null = null;

  constructor(options: SaveCodeModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    let existing = document.getElementById('save-code-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'save-code-modal';
    modal.className = 'retro-window-overlay';
    modal.style.display = 'none';
    modal.style.zIndex = '260';

    modal.innerHTML = `
      <div class="retro-window" style="width: 580px; max-width: 95vw;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>📋</span>
            <span>Save Code Transfer - Base64 Backup</span>
          </div>
          <button id="btn-savecode-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 10px;">
          <!-- Tab selector -->
          <div style="display: flex; gap: 4px; margin-bottom: 10px; border-bottom: 2px groove #808080; padding-bottom: 6px;">
            <button id="tab-savecode-copy" class="win-btn win-btn-sm active" style="font-weight: bold;">📋 Copy Save Code</button>
            <button id="tab-savecode-paste" class="win-btn win-btn-sm" style="font-weight: bold;">📥 Paste &amp; Restore</button>
          </div>

          <!-- Section: Copy -->
          <div id="section-savecode-copy">
            <p style="font-size: 11px; margin-bottom: 6px; color: #374151;">
              This Base64 text code encodes your complete character state. Save it in a text note or share it:
            </p>
            <textarea id="savecode-copy-text" readonly class="retro-input" style="width: 100%; height: 140px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; user-select: text; resize: vertical; word-break: break-all; margin-bottom: 8px;"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button id="btn-savecode-copy-action" class="win-btn primary-btn" style="font-weight: bold; padding: 4px 12px;">📋 Copy Code to Clipboard</button>
            </div>
          </div>

          <!-- Section: Paste -->
          <div id="section-savecode-paste" style="display: none;">
            <p style="font-size: 11px; margin-bottom: 6px; color: #374151;">
              Paste a previously exported Base64 save code below to restore your character:
            </p>
            <textarea id="savecode-paste-text" placeholder="Paste Base64 save code here..." class="retro-input" style="width: 100%; height: 140px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; resize: vertical; word-break: break-all; margin-bottom: 8px;"></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button id="btn-savecode-restore-action" class="win-btn primary-btn" style="font-weight: bold; padding: 4px 14px;">Restore Character</button>
            </div>
          </div>

          <div class="retro-statusbar" style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span id="savecode-status" style="font-size: 11px; color: #1e3a8a;">Ready.</span>
            <button id="btn-savecode-close" class="win-btn" style="padding: 2px 10px;">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    this.copyTabBtn = modal.querySelector('#tab-savecode-copy');
    this.pasteTabBtn = modal.querySelector('#tab-savecode-paste');
    this.copySectionEl = modal.querySelector('#section-savecode-copy');
    this.pasteSectionEl = modal.querySelector('#section-savecode-paste');
    this.copyTextarea = modal.querySelector('#savecode-copy-text');
    this.pasteTextarea = modal.querySelector('#savecode-paste-text');
    this.copyBtn = modal.querySelector('#btn-savecode-copy-action');
    this.restoreBtn = modal.querySelector('#btn-savecode-restore-action');
    this.statusEl = modal.querySelector('#savecode-status');

    this.copyTabBtn?.addEventListener('click', () => this.setMode('copy'));
    this.pasteTabBtn?.addEventListener('click', () => this.setMode('paste'));

    modal.querySelector('#btn-savecode-close')?.addEventListener('click', () => this.close());
    modal.querySelector('#btn-savecode-close-x')?.addEventListener('click', () => this.close());

    this.copyBtn?.addEventListener('click', async () => {
      if (this.copyTextarea?.value) {
        const ok = await copyTextToClipboard(this.copyTextarea.value);
        if (ok) {
          this.setStatus('Save code copied to clipboard! 📋', '#15803d');
        } else {
          this.setStatus('Failed to copy. Please manually select all and copy.', '#b91c1c');
        }
      }
    });

    this.restoreBtn?.addEventListener('click', () => {
      this.handleRestore();
    });
  }

  public setMode(mode: 'copy' | 'paste'): void {
    if (mode === 'copy') {
      this.copyTabBtn?.classList.add('active');
      this.pasteTabBtn?.classList.remove('active');
      if (this.copySectionEl) this.copySectionEl.style.display = 'block';
      if (this.pasteSectionEl) this.pasteSectionEl.style.display = 'none';
      this.refreshCopyCode();
    } else {
      this.copyTabBtn?.classList.remove('active');
      this.pasteTabBtn?.classList.add('active');
      if (this.copySectionEl) this.copySectionEl.style.display = 'none';
      if (this.pasteSectionEl) this.pasteSectionEl.style.display = 'block';
      this.pasteTextarea?.focus();
    }
  }

  public setEnvelope(envelope: VersionedSaveEnvelope<SaveData> | null): void {
    this.currentEnvelope = envelope;
    this.refreshCopyCode();
  }

  private refreshCopyCode(): void {
    const envelope = this.currentEnvelope || this.options.getActiveEnvelope?.() || null;
    if (envelope && this.copyTextarea) {
      try {
        const code = encodeSaveCode(envelope);
        this.copyTextarea.value = code;
        this.setStatus(`Save code ready (${envelope.data.profile.name}, Floor ${envelope.data.currentFloor ?? 0}).`);
      } catch (err) {
        this.copyTextarea.value = '';
        this.setStatus(`Failed to encode save: ${(err as Error).message}`, '#b91c1c');
      }
    } else if (this.copyTextarea) {
      this.copyTextarea.value = 'No active character selected to export.';
      this.setStatus('Select a character to generate save code.', '#6b7280');
    }
  }

  private handleRestore(): void {
    const raw = this.pasteTextarea?.value?.trim();
    if (!raw) {
      this.setStatus('Please paste a save code first.', '#b91c1c');
      return;
    }

    try {
      const envelope = decodeSaveCode(raw, { expectedManifestId: this.options.activeManifestId });
      const jsonStr = JSON.stringify(envelope);

      const proceedWithImport = () => {
        try {
          const profile = this.options.profileManager.importHero(jsonStr);
          this.setStatus(`Restored character ${profile.name} successfully!`, '#15803d');
          if (this.options.onRestored) {
            this.options.onRestored(profile);
          }
          setTimeout(() => this.close(), 750);
        } catch (err) {
          this.setStatus(`Import failed: ${(err as Error).message}`, '#b91c1c');
        }
      };

      const detected = envelope.contentManifestId || envelope.data.contentManifestId || 'cotw';
      if (detected !== this.options.activeManifestId && !(this.options.activeManifestId === 'cotw' && detected === 'headless_default')) {
        showManifestMismatchDialog({
          detectedManifestId: detected,
          activeManifestId: this.options.activeManifestId,
          heroName: envelope.data.profile.name,
          onConfirm: proceedWithImport,
          onCancel: () => {
            this.setStatus('Restore cancelled due to manifest mismatch.', '#b91c1c');
          },
        });
      } else {
        proceedWithImport();
      }
    } catch (err) {
      this.setStatus(`Invalid save code: ${(err as Error).message}`, '#b91c1c');
    }
  }

  public setStatus(msg: string, color = '#1e3a8a'): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = color;
    }
  }

  public open(mode: 'copy' | 'paste' = 'copy', envelope?: VersionedSaveEnvelope<SaveData>): void {
    if (envelope) {
      this.currentEnvelope = envelope;
    }
    this.setMode(mode);
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
    }
  }

  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public isOpen(): boolean {
    return this.modalEl?.style.display === 'flex';
  }
}
