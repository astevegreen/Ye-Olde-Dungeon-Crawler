import { Leaderboard, type HallOfFameEntry } from '../engine';
import { iconHtml } from './icons';
import { copyTextToClipboard } from './platform';
import type { UIModal } from './modalStack';
import { resolveBranding, type ResolvedBranding } from './branding';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

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
  private shareDoneBtn: HTMLButtonElement | null = null;
  private importCloseBtn: HTMLButtonElement | null = null;
  private sharePreviewEl: HTMLElement | null = null;

  // Import controls
  private importTextarea: HTMLTextAreaElement | null = null;
  private importInspectBtn: HTMLButtonElement | null = null;
  private importInscribeBtn: HTMLButtonElement | null = null;
  private importPreviewEl: HTMLElement | null = null;

  private statusEl: HTMLElement | null = null;
  /** What had focus when it opened (the hall, say), so its Escape works again after. */
  private returnFocus: HTMLElement | null = null;

  private activeEntry: HallOfFameEntry | null = null;
  private inspectedEntry: HallOfFameEntry | null = null;
  private options: SagaShareModalOptions;

  private get xpName(): string {
    return (this.options.branding ?? resolveBranding()).xpName;
  }

  constructor(options: SagaShareModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    const modal = createDialogScrim('saga-share-modal', 'system');
    if (!modal) return;
    // The overlay holds focus and takes its own keys: on the title screen no game runs and
    // the modal stack routes nothing, and at the end of a run the game must not see them.
    modal.tabIndex = -1;
    modal.style.outline = 'none';
    modal.addEventListener('keydown', (e) => {
      e.stopPropagation();
      this.handleKeyDown(e as KeyboardEvent);
    });

    const brand = this.options.branding ?? resolveBranding();
    const hall = escapeHtml(brand.hallOfFameName);
    modal.innerHTML = dialogHtml({
      title: 'Saga exchange',
      kicker: brand.hallOfFameName,
      icon: 'epitaph',
      closeId: 'btn-saga-close-x',
      body: `
        <div class="st-subtabs" role="tablist">
          <button type="button" role="tab" id="tab-saga-share" class="st-subtab" aria-selected="true">${iconHtml('share')} Share a saga</button>
          <button type="button" role="tab" id="tab-saga-import" class="st-subtab" aria-selected="false">${iconHtml('import')} Import a saga</button>
        </div>

        <div id="saga-share-section" class="ui-col">
          <div class="ui-note">Share your champion's saga across ${escapeHtml(brand.worldName)} as a code or a link.</div>
          <pre id="saga-share-preview" class="ui-epitaph ui-inset saga-preview">No champion selected to share.</pre>
          <label class="ui-field">
            <span class="ui-dialog-label">Saga code</span>
            <span class="saga-row">
              <input type="text" id="saga-code-input" class="ui-input saga-code" readonly />
              ${dialogButton('btn-saga-copy-code', 'Copy code', { icon: 'copy' })}
            </span>
          </label>
          <label class="ui-field">
            <span class="ui-dialog-label">Share link</span>
            <span class="saga-row">
              <input type="text" id="saga-url-input" class="ui-input saga-code" readonly />
              ${dialogButton('btn-saga-copy-url', 'Copy link', { icon: 'share' })}
            </span>
          </label>
        </div>

        <div id="saga-import-section" class="ui-col" style="display: none;">
          <div class="ui-note">Paste a saga code (SAGA1_…) or a share link to check it, then inscribe it into the ${hall}.</div>
          <textarea id="saga-import-textarea" class="ui-textarea saga-code" rows="3" placeholder="SAGA1_… or https://…/?saga=…"></textarea>
          <div>${dialogButton('btn-saga-inspect', 'Check saga', { icon: 'search' })}</div>
          <span class="ui-dialog-label">Saga found</span>
          <pre id="saga-import-preview" class="ui-epitaph ui-inset saga-preview">Paste a saga code above and choose Check saga.</pre>
        </div>`,
      footNote: '<span id="saga-status-text">Saga exchange ready.</span>',
      actions: [
        dialogButton('btn-saga-copy-epitaph', 'Copy epitaph', { icon: 'epitaph' }),
        dialogButton('btn-saga-share-close', 'Done', { primary: true }),
        dialogButton('btn-saga-inscribe', `Inscribe into ${brand.hallOfFameShortName}`, { icon: 'trophy', primary: true, disabled: true }),
        dialogButton('btn-saga-import-close', 'Close'),
      ].join(''),
    });
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
    this.shareDoneBtn = document.getElementById('btn-saga-share-close') as HTMLButtonElement;
    this.importCloseBtn = document.getElementById('btn-saga-import-close') as HTMLButtonElement;
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
        this.setStatus('Copied the saga code.');
      }
    });

    this.shareCopyUrlBtn?.addEventListener('click', async () => {
      if (this.shareUrlInput?.value) {
        await copyTextToClipboard(this.shareUrlInput.value);
        this.setStatus('Copied the share link.');
      }
    });

    this.shareCopyEpitaphBtn?.addEventListener('click', async () => {
      if (this.activeEntry) {
        const epitaph = Leaderboard.formatEpitaph(this.activeEntry, this.xpName);
        await copyTextToClipboard(epitaph);
        this.setStatus('Copied the epitaph.');
      }
    });

    // Import actions
    this.importInspectBtn?.addEventListener('click', () => this.inspectInputCode());
    this.importInscribeBtn?.addEventListener('click', () => this.inscribeInspectedSaga());

    // Close buttons
    document.getElementById('btn-saga-close-x')?.addEventListener('click', () => this.close());
    this.shareDoneBtn?.addEventListener('click', () => this.close());
    this.importCloseBtn?.addEventListener('click', () => this.close());
  }

  public switchTab(tab: 'share' | 'import'): void {
    const share = tab === 'share';
    this.shareTabBtn?.setAttribute('aria-selected', String(share));
    this.importTabBtn?.setAttribute('aria-selected', String(!share));
    if (this.shareSectionEl) this.shareSectionEl.style.display = share ? 'flex' : 'none';
    if (this.importSectionEl) this.importSectionEl.style.display = share ? 'none' : 'flex';
    // Each tab keeps its own footer buttons.
    for (const btn of [this.shareCopyEpitaphBtn, this.shareDoneBtn]) if (btn) btn.hidden = !share;
    for (const btn of [this.importInscribeBtn, this.importCloseBtn]) if (btn) btn.hidden = share;
    this.setStatus(share ? 'Ready to share the saga.' : 'Paste a saga code or share link above.');
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
    if (this.sharePreviewEl) this.sharePreviewEl.textContent = Leaderboard.formatEpitaph(entry, this.xpName);

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
        this.importPreviewEl.textContent = 'This is not a saga code this game can read: it is damaged, incomplete, or from another version.';
        this.importPreviewEl.classList.add('is-bad');
      }
      if (this.importInscribeBtn) this.importInscribeBtn.disabled = true;
      this.setStatus('Verification failed. Check the code and try again.');
      return null;
    }

    this.inspectedEntry = entry;
    if (this.importPreviewEl) {
      this.importPreviewEl.textContent = Leaderboard.formatEpitaph(entry, this.xpName);
      this.importPreviewEl.classList.remove('is-bad');
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
      if (!this.isOpen && typeof document !== 'undefined') this.returnFocus = document.activeElement as HTMLElement | null;
      this.modalEl.style.display = 'flex';
      this.isOpen = true;
      this.modalEl.focus();
    }
  }

  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      this.isOpen = false;
    }
    this.returnFocus?.focus();
    this.returnFocus = null;
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return true;
    }
    return true; // capture keys while modal is active
  }
}
