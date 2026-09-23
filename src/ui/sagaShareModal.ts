import { Leaderboard, type HallOfFameEntry } from '../engine';
import { copyTextToClipboard } from './platform';
import type { UIModal } from './modalStack';
import { resolveBranding, type ResolvedBranding } from './branding';

export interface SagaShareModalOptions {
  leaderboard: Leaderboard;
  /** The active pack's wording; neutral text when omitted. */
  branding?: ResolvedBranding;
  onSagaInscribed?: (entry: HallOfFameEntry) => void;
  onClose?: () => void;
}

export class SagaShareModal implements UIModal {
  public readonly id = 'saga-share-modal';
  public isOpen = false;

  private modalEl: HTMLElement | null = null;
  private shareTabBtn: HTMLButtonElement | null = null;
  private importTabBtn: HTMLButtonElement | null = null;
  private shareSectionEl: HTMLElement | null = null;
  private importSectionEl: HTMLElement | null = null;

  // Share controls
  private shareCodeInput: HTMLInputElement | null = null;
  private shareUrlInput: HTMLInputElement | null = null;
  private shareCopyCodeBtn: HTMLButtonElement | null = null;
  private shareCopyUrlBtn: HTMLButtonElement | null = null;
  private shareCopyEpitaphBtn: HTMLButtonElement | null = null;
  private sharePreviewEl: HTMLElement | null = null;

  // Import controls
  private importTextarea: HTMLTextAreaElement | null = null;
  private importInspectBtn: HTMLButtonElement | null = null;
  private importInscribeBtn: HTMLButtonElement | null = null;
  private importPreviewEl: HTMLElement | null = null;

  private statusEl: HTMLElement | null = null;

  private activeEntry: HallOfFameEntry | null = null;
  private inspectedEntry: HallOfFameEntry | null = null;
  private options: SagaShareModalOptions;

  constructor(options: SagaShareModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let existing = document.getElementById('saga-share-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'saga-share-modal';
    modal.className = 'retro-window-overlay';
    modal.style.display = 'none';
    modal.style.zIndex = '270';

    const brand = this.options.branding ?? resolveBranding();
    modal.innerHTML = `
      <div class="retro-window" style="width: 640px; max-width: 95vw;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>📜</span>
            <span>Saga Exchange - ${brand.hallOfFameName} Run Sharing</span>
          </div>
          <button id="btn-saga-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 10px;">
          <!-- Tab selector -->
          <div style="display: flex; gap: 4px; margin-bottom: 10px; border-bottom: 2px groove #808080; padding-bottom: 6px;">
            <button id="tab-saga-share" class="win-btn win-btn-sm active" style="flex: 1; font-weight: bold;">🔗 Share Saga</button>
            <button id="tab-saga-import" class="win-btn win-btn-sm" style="flex: 1; font-weight: bold;">📥 Import Saga</button>
          </div>

          <!-- Share Section -->
          <div id="saga-share-section">
            <p class="retro-note" style="margin-bottom: 6px;">
              Share your champion's heroic saga across ${brand.worldName} via compact code or direct URL.
            </p>

            <div id="saga-share-preview" class="retro-inset-list" style="height: 120px; padding: 6px; font-family: monospace; font-size: 11px; white-space: pre-wrap; background: #0f172a; color: #f8fafc; overflow-y: auto; margin-bottom: 8px;">
              No champion selected to share.
            </div>

            <div style="margin-bottom: 6px;">
              <label class="retro-label" style="display: block; margin-bottom: 2px;">Saga Code (Base64 URL-Safe):</label>
              <div style="display: flex; gap: 4px;">
                <input type="text" id="saga-code-input" class="retro-input" readonly style="flex: 1; font-family: monospace; font-size: 11px;" />
                <button id="btn-saga-copy-code" class="win-btn" style="white-space: nowrap;">📋 Copy Code</button>
              </div>
            </div>

            <div style="margin-bottom: 8px;">
              <label class="retro-label" style="display: block; margin-bottom: 2px;">Web Share Link:</label>
              <div style="display: flex; gap: 4px;">
                <input type="text" id="saga-url-input" class="retro-input" readonly style="flex: 1; font-family: monospace; font-size: 11px;" />
                <button id="btn-saga-copy-url" class="win-btn" style="white-space: nowrap;">🔗 Copy Link</button>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              <button id="btn-saga-copy-epitaph" class="win-btn">📜 Copy ASCII Epitaph</button>
              <button id="btn-saga-share-close" class="win-btn primary-btn">Done</button>
            </div>
          </div>

          <!-- Import Section -->
          <div id="saga-import-section" style="display: none;">
            <p class="retro-note" style="margin-bottom: 6px;">
              Paste a saga run code (e.g. <code>SAGA1_...</code>) or full share link to inspect and inscribe into the ${brand.hallOfFameName}.
            </p>

            <textarea
              id="saga-import-textarea"
              class="retro-input"
              rows="3"
              placeholder="Paste SAGA1_... code or https://.../?saga=... link here"
              style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 11px; resize: vertical; margin-bottom: 6px;"
            ></textarea>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <button id="btn-saga-inspect" class="win-btn" style="font-weight: bold;">🔍 Inspect Saga</button>
              <button id="btn-saga-inscribe" class="win-btn primary-btn" disabled style="font-weight: bold;">🏆 Inscribe into ${brand.hallOfFameShortName}</button>
            </div>

            <label class="retro-label" style="display: block; margin-bottom: 2px;">Inspected Hero Saga:</label>
            <div id="saga-import-preview" class="retro-inset-list" style="height: 120px; padding: 6px; font-family: monospace; font-size: 11px; white-space: pre-wrap; background: #0f172a; color: #f8fafc; overflow-y: auto; margin-bottom: 8px;">
              Paste a saga code above and click 'Inspect Saga' to verify.
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button id="btn-saga-import-close" class="win-btn">Close</button>
            </div>
          </div>

          <!-- Status Bar -->
          <div class="retro-statusbar" style="margin-top: 8px; font-size: 11px;">
            <span id="saga-status-text" style="color: #1e3a8a; font-weight: bold;">Saga Exchange Ready.</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    // Element references
    this.shareTabBtn = document.getElementById('tab-saga-share') as HTMLButtonElement;
    this.importTabBtn = document.getElementById('tab-saga-import') as HTMLButtonElement;
    this.shareSectionEl = document.getElementById('saga-share-section');
    this.importSectionEl = document.getElementById('saga-import-section');

    this.shareCodeInput = document.getElementById('saga-code-input') as HTMLInputElement;
    this.shareUrlInput = document.getElementById('saga-url-input') as HTMLInputElement;
    this.shareCopyCodeBtn = document.getElementById('btn-saga-copy-code') as HTMLButtonElement;
    this.shareCopyUrlBtn = document.getElementById('btn-saga-copy-url') as HTMLButtonElement;
    this.shareCopyEpitaphBtn = document.getElementById('btn-saga-copy-epitaph') as HTMLButtonElement;
    this.sharePreviewEl = document.getElementById('saga-share-preview');

    this.importTextarea = document.getElementById('saga-import-textarea') as HTMLTextAreaElement;
    this.importInspectBtn = document.getElementById('btn-saga-inspect') as HTMLButtonElement;
    this.importInscribeBtn = document.getElementById('btn-saga-inscribe') as HTMLButtonElement;
    this.importPreviewEl = document.getElementById('saga-import-preview');

    this.statusEl = document.getElementById('saga-status-text');

    // Tab click handlers
    this.shareTabBtn?.addEventListener('click', () => this.switchTab('share'));
    this.importTabBtn?.addEventListener('click', () => this.switchTab('import'));

    // Share actions
    this.shareCopyCodeBtn?.addEventListener('click', async () => {
      if (this.shareCodeInput?.value) {
        await copyTextToClipboard(this.shareCodeInput.value);
        this.setStatus('Copied Saga Code to clipboard! 📋');
      }
    });

    this.shareCopyUrlBtn?.addEventListener('click', async () => {
      if (this.shareUrlInput?.value) {
        await copyTextToClipboard(this.shareUrlInput.value);
        this.setStatus('Copied Web Share Link to clipboard! 🔗');
      }
    });

    this.shareCopyEpitaphBtn?.addEventListener('click', async () => {
      if (this.activeEntry) {
        const epitaph = Leaderboard.formatEpitaph(this.activeEntry);
        await copyTextToClipboard(epitaph);
        this.setStatus('Copied ASCII Epitaph to clipboard! 📜');
      }
    });

    // Import actions
    this.importInspectBtn?.addEventListener('click', () => this.inspectInputCode());
    this.importInscribeBtn?.addEventListener('click', () => this.inscribeInspectedSaga());

    // Close buttons
    document.getElementById('btn-saga-close-x')?.addEventListener('click', () => this.close());
    document.getElementById('btn-saga-share-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-saga-import-close')?.addEventListener('click', () => this.close());
  }

  public switchTab(tab: 'share' | 'import'): void {
    if (tab === 'share') {
      this.shareTabBtn?.classList.add('active');
      this.importTabBtn?.classList.remove('active');
      if (this.shareSectionEl) this.shareSectionEl.style.display = 'block';
      if (this.importSectionEl) this.importSectionEl.style.display = 'none';
      this.setStatus('Ready to share hero saga.');
    } else {
      this.importTabBtn?.classList.add('active');
      this.shareTabBtn?.classList.remove('active');
      if (this.shareSectionEl) this.shareSectionEl.style.display = 'none';
      if (this.importSectionEl) this.importSectionEl.style.display = 'block';
      this.setStatus('Paste a saga code or share link above.');
    }
  }

  public openShare(entry: HallOfFameEntry): void {
    this.activeEntry = entry;
    const baseUrl = typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;
    const code = Leaderboard.encodeRunShare(entry);
    const url = Leaderboard.generateShareUrl(entry, baseUrl);
    if (this.shareCodeInput) this.shareCodeInput.value = code;
    if (this.shareUrlInput) this.shareUrlInput.value = url;
    if (this.sharePreviewEl) this.sharePreviewEl.textContent = Leaderboard.formatEpitaph(entry);

    this.switchTab('share');
    this.setStatus(`Sharing ${entry.heroName}'s saga (${entry.score.toLocaleString()} pts).`);
    this.show();
  }

  public openImport(prefilledCodeOrUrl?: string): void {
    this.switchTab('import');
    if (prefilledCodeOrUrl && this.importTextarea) {
      this.importTextarea.value = prefilledCodeOrUrl.trim();
      this.inspectInputCode();
    }
    this.show();
  }

  private extractCode(raw: string): string {
    let clean = raw.trim();
    if (clean.includes('saga=')) {
      try {
        const url = new URL(clean);
        const queryCode = url.searchParams.get('saga');
        if (queryCode) return queryCode.trim();
      } catch {
        const match = clean.match(/[?&]saga=([^&#]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1]).trim();
        }
      }
    }
    return clean;
  }

  public inspectInputCode(): HallOfFameEntry | null {
    const raw = this.importTextarea?.value ?? '';
    const code = this.extractCode(raw);
    if (!code) {
      this.setStatus('Please paste a saga code or share link.');
      if (this.importInscribeBtn) this.importInscribeBtn.disabled = true;
      return null;
    }

    const entry = Leaderboard.decodeRunShare(code);
    if (!entry) {
      if (this.importPreviewEl) {
        this.importPreviewEl.textContent = '❌ ERROR: Invalid, corrupted, or incompatible saga code.';
        this.importPreviewEl.style.color = '#f87171';
      }
      if (this.importInscribeBtn) this.importInscribeBtn.disabled = true;
      this.setStatus('Verification failed. Check the code and try again.');
      return null;
    }

    this.inspectedEntry = entry;
    if (this.importPreviewEl) {
      this.importPreviewEl.textContent = Leaderboard.formatEpitaph(entry);
      this.importPreviewEl.style.color = '#f8fafc';
    }
    if (this.importInscribeBtn) {
      this.importInscribeBtn.disabled = false;
    }
    this.setStatus(`Verified valid saga for ${entry.heroName} (${entry.score.toLocaleString()} pts)!`);
    return entry;
  }

  public inscribeInspectedSaga(): void {
    if (!this.inspectedEntry) return;
    const result = this.options.leaderboard.importSharedRun(this.inspectedEntry);
    this.setStatus(result.message);

    if (result.success) {
      if (this.importInscribeBtn) this.importInscribeBtn.disabled = true;
      if (this.options.onSagaInscribed) {
        this.options.onSagaInscribed(this.inspectedEntry);
      }
    }
  }

  public setStatus(msg: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
    }
  }

  public show(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.isOpen = true;
    }
  }

  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      this.isOpen = false;
    }
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.key === 'Escape') {
      this.close();
      return true;
    }
    return true; // capture keys while modal is active
  }
}
