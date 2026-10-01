import { encodeSaveCode, decodeSaveCode } from '../engine';
import { copyTextToClipboard } from './platform';
import type { VersionedSaveEnvelope } from '../engine';
import type { SaveData, CharacterProfile } from '../engine';
import type { ProfileManager } from '../engine';
import { showManifestMismatchDialog } from './saveImporter';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';

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
    const modal = createDialogScrim('save-code-modal', 'system');
    if (!modal) return;
    modal.innerHTML = dialogHtml({
      title: 'Save code',
      kicker: 'Backup',
      closeId: 'btn-savecode-close-x',
      body: `
        <div class="st-subtabs" role="tablist">
          <button type="button" id="tab-savecode-copy" class="st-subtab" role="tab" aria-selected="true">Copy a code</button>
          <button type="button" id="tab-savecode-paste" class="st-subtab" role="tab" aria-selected="false">Restore from a code</button>
        </div>
        <div id="section-savecode-copy" class="ui-field">
          <div class="ui-note">This text holds your whole character. Keep it in a note, or send it to another device.</div>
          <textarea id="savecode-copy-text" readonly class="ui-textarea savecode-text"></textarea>
          <div>${dialogButton('btn-savecode-copy-action', 'Copy to clipboard', { primary: true })}</div>
        </div>
        <div id="section-savecode-paste" class="ui-field" style="display: none;">
          <div class="ui-note">Paste a save code to restore that character.</div>
          <textarea id="savecode-paste-text" placeholder="Paste a save code here" class="ui-textarea savecode-text"></textarea>
          <div>${dialogButton('btn-savecode-restore-action', 'Restore character', { primary: true })}</div>
        </div>
        <div id="savecode-status" class="ui-note"></div>`,
      actions: dialogButton('btn-savecode-close', 'Close', { key: 'Esc' }),
    });
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
          this.setStatus('Copied.', 'good');
        } else {
          this.setStatus('Could not copy. Select the text and copy it yourself.', 'bad');
        }
      }
    });

    this.restoreBtn?.addEventListener('click', () => {
      this.handleRestore();
    });
  }

  public setMode(mode: 'copy' | 'paste'): void {
    if (mode === 'copy') {
      this.copyTabBtn?.setAttribute('aria-selected', 'true');
      this.pasteTabBtn?.setAttribute('aria-selected', 'false');
      if (this.copySectionEl) this.copySectionEl.style.display = 'block';
      if (this.pasteSectionEl) this.pasteSectionEl.style.display = 'none';
      this.refreshCopyCode();
    } else {
      this.copyTabBtn?.setAttribute('aria-selected', 'false');
      this.pasteTabBtn?.setAttribute('aria-selected', 'true');
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
        this.setStatus(`Failed to encode save: ${(err as Error).message}`, 'bad');
      }
    } else if (this.copyTextarea) {
      this.copyTextarea.value = 'No active character selected to export.';
      this.setStatus('Select a character to generate save code.', 'note');
    }
  }

  private handleRestore(): void {
    const raw = this.pasteTextarea?.value?.trim();
    if (!raw) {
      this.setStatus('Please paste a save code first.', 'bad');
      return;
    }

    try {
      const envelope = decodeSaveCode(raw, { expectedManifestId: this.options.activeManifestId });
      const jsonStr = JSON.stringify(envelope);

      const proceedWithImport = () => {
        try {
          const profile = this.options.profileManager.importHero(jsonStr);
          this.setStatus(`Restored character ${profile.name} successfully!`, 'good');
          if (this.options.onRestored) {
            this.options.onRestored(profile);
          }
          setTimeout(() => this.close(), 750);
        } catch (err) {
          this.setStatus(`Import failed: ${(err as Error).message}`, 'bad');
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
            this.setStatus('Restore cancelled due to manifest mismatch.', 'bad');
          },
        });
      } else {
        proceedWithImport();
      }
    } catch (err) {
      this.setStatus(`Invalid save code: ${(err as Error).message}`, 'bad');
    }
  }

  public setStatus(msg: string, tone: 'note' | 'good' | 'bad' = 'note'): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.className = tone === 'note' ? 'ui-note' : `ui-note ${tone === 'good' ? 'ui-up' : 'ui-down'}`;
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
