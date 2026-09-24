import {
  type GameEngine,
  type CharacterProfile,
  type BulkArchive,
  flightRecorder,
} from '../engine';
import type { UIModal, ModalStackManager } from './modalStack';
import { copyTextToClipboard, browserReportContext } from './platform';
import { showToast as showGlobalToast } from './toast';
import {
  DIAGNOSTIC_TAB_RENDERERS,
  type DiagnosticTabId,
  type DiagnosticInputContext,
  type DiagnosticTabContext,
} from './diagnostic';

export type { DiagnosticInputContext };

export class DiagnosticModal implements UIModal {
  public readonly id = 'diagnostic-modal';
  public isOpen: boolean = false;

  private modal: HTMLElement | null = null;
  private tabContent: HTMLElement | null = null;
  private tabStrip: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private closeTitleBtn: HTMLButtonElement | null = null;
  private toast: HTMLElement | null = null;

  // Crash modal elements
  private crashModal: HTMLElement | null = null;
  private crashText: HTMLElement | null = null;
  private crashCopyBtn: HTMLButtonElement | null = null;
  private crashReloadBtn: HTMLButtonElement | null = null;
  private crashSubmitBtn: HTMLButtonElement | null = null;
  private lastCrashError: Error | string | null = null;

  private getEngine: () => GameEngine | null;
  private getProfile: () => CharacterProfile | null;
  private inputContext?: DiagnosticInputContext;
  private modalStack?: ModalStackManager;
  private onClosedCallback?: () => void;
  private bulkArchive: BulkArchive | null = null;
  private onOpenFeedback?: (opts?: any) => void;

  private activeTab: DiagnosticTabId = 'simulation';
  private pollIntervalId: number | null = null;
  private toastTimeout: number | null = null;
  public enableAutoPolling: boolean = true;

  constructor(
    getEngine: () => GameEngine | null,
    getProfile: () => CharacterProfile | null,
    onClosedCallback?: () => void,
    inputContext?: DiagnosticInputContext,
    modalStack?: ModalStackManager
  ) {
    this.getEngine = getEngine;
    this.getProfile = getProfile;
    this.onClosedCallback = onClosedCallback;
    this.inputContext = inputContext;
    this.modalStack = modalStack;

    this.initDom();
    this.bindEvents();
  }

  public setInputContext(ctx: DiagnosticInputContext): void {
    this.inputContext = ctx;
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public setBulkArchive(archive: BulkArchive | null): void {
    this.bulkArchive = archive;
  }

  public setOpenFeedbackHandler(handler: (opts?: any) => void): void {
    this.onOpenFeedback = handler;
  }

  private initDom(): void {
    if (typeof document === 'undefined') return;

    this.modal = document.getElementById('diagnostic-modal');
    this.tabContent = document.getElementById('diagnostic-tab-content');
    this.tabStrip = document.getElementById('diagnostic-tab-strip');
    this.closeBtn = document.getElementById('btn-diag-close') as HTMLButtonElement | null;
    this.closeTitleBtn = document.getElementById('btn-diag-close-title') as HTMLButtonElement | null;
    this.toast = document.getElementById('diagnostic-toast');

    this.crashModal = document.getElementById('crash-modal');
    this.crashText = document.getElementById('crash-error-text');
    this.crashCopyBtn = document.getElementById('btn-crash-copy') as HTMLButtonElement | null;
    this.crashReloadBtn = document.getElementById('btn-crash-reload') as HTMLButtonElement | null;
    this.crashSubmitBtn = document.getElementById('btn-crash-submit') as HTMLButtonElement | null;

    // If modal container does not exist in DOM (e.g. test environment), dynamically create it
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'diagnostic-modal';
      this.modal.style.display = 'none';
      document.body.appendChild(this.modal);

      const body = document.createElement('div');
      body.className = 'retro-window-body';
      this.modal.appendChild(body);

      this.tabStrip = document.createElement('div');
      this.tabStrip.id = 'diagnostic-tab-strip';
      body.appendChild(this.tabStrip);

      this.tabContent = document.createElement('div');
      this.tabContent.id = 'diagnostic-tab-content';
      body.appendChild(this.tabContent);

      this.toast = document.createElement('span');
      this.toast.id = 'diagnostic-toast';
      this.toast.style.display = 'none';
      body.appendChild(this.toast);

      this.closeBtn = document.createElement('button');
      this.closeBtn.id = 'btn-diag-close';
      body.appendChild(this.closeBtn);
    }
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.closeTitleBtn?.addEventListener('click', () => this.close());

    // Tab buttons in tab strip
    this.tabStrip?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
      if (target) {
        const tab = target.getAttribute('data-tab') as DiagnosticTabId;
        if (tab) {
          this.setActiveTab(tab);
        }
      }
    });

    this.crashCopyBtn?.addEventListener('click', () => {
      void this.copyReportToClipboard();
    });

    this.crashSubmitBtn?.addEventListener('click', () => {
      this.submitCrashReport();
    });

    this.crashReloadBtn?.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    });
  }

  // --- UIModal Implementation & Keydown Swallowing ---

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    // F2, Escape, Backquote, Tilde close the modal
    if (e.code === 'F2' || e.code === 'Escape' || e.key === '`' || e.key === '~') {
      e.preventDefault();
      this.close();
      return true;
    }

    // Number keys 1-4 switch tabs directly
    if (e.key === '1') {
      e.preventDefault();
      this.setActiveTab('simulation');
      return true;
    }
    if (e.key === '2') {
      e.preventDefault();
      this.setActiveTab('actor');
      return true;
    }
    if (e.key === '3') {
      e.preventDefault();
      this.setActiveTab('pipeline');
      return true;
    }
    if (e.key === '4') {
      e.preventDefault();
      this.setActiveTab('triage');
      return true;
    }

    // Tab key cycles through tabs
    if (e.code === 'Tab') {
      e.preventDefault();
      this.cycleTab(e.shiftKey ? -1 : 1);
      return true;
    }

    // Always swallow all other keystrokes to prevent game actions or movement bleeding
    e.preventDefault();
    return true;
  }

  public open(): void {
    if (!this.modal) return;
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.setActiveTab(this.activeTab);

    // Auto-refresh polling while open (500ms heartbeat)
    this.startPolling();
  }

  public close(): void {
    if (!this.isOpen && (!this.modal || this.modal.style.display === 'none')) return;
    this.isOpen = false;
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.stopPolling();

    if (this.modalStack?.has(this.id)) {
      this.modalStack.remove(this.id);
    }

    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    if (!this.enableAutoPolling) return;
    if (typeof window !== 'undefined') {
      this.pollIntervalId = window.setInterval(() => {
        if (this.isOpen) {
          this.renderCurrentTab();
        }
      }, 500);
    }
  }

  private stopPolling(): void {
    if (this.pollIntervalId !== null) {
      if (typeof window !== 'undefined') {
        window.clearInterval(this.pollIntervalId);
      }
      this.pollIntervalId = null;
    }
  }

  // --- Tab Navigation & Switching ---

  public getActiveTab(): DiagnosticTabId {
    return this.activeTab;
  }

  public setActiveTab(tab: DiagnosticTabId): void {
    this.activeTab = tab;
    this.updateTabStripHighlight();
    this.renderCurrentTab();
  }

  public cycleTab(direction: 1 | -1 = 1): void {
    const tabs: DiagnosticTabId[] = ['simulation', 'actor', 'pipeline', 'triage'];
    const currentIndex = tabs.indexOf(this.activeTab);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    this.setActiveTab(tabs[nextIndex]);
  }

  private updateTabStripHighlight(): void {
    if (!this.tabStrip) return;
    const buttons = this.tabStrip.querySelectorAll<HTMLButtonElement>('[data-tab]');
    buttons.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (tab === this.activeTab) {
        btn.classList.add('active-tab');
        btn.style.background = '#e2e8f0';
        btn.style.color = '#0f172a';
        btn.style.border = '2px solid #0284c7';
      } else {
        btn.classList.remove('active-tab');
        btn.style.background = '#cbd5e1';
        btn.style.color = '#334155';
        btn.style.border = '2px solid #94a3b8';
      }
    });
  }

  // --- Scannable Telemetry Rendering ---

  public renderCurrentTab(): void {
    if (!this.tabContent) return;
    const engine = this.getEngine();

    if (!engine) {
      this.tabContent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-family: monospace;">
          <p>⚠️ No active simulation engine loaded.</p>
        </div>
      `;
      return;
    }

    const renderer = DIAGNOSTIC_TAB_RENDERERS[this.activeTab];
    if (renderer && this.tabContent) {
      const ctx: DiagnosticTabContext = {
        container: this.tabContent,
        inputContext: this.inputContext,
        showToast: (msg) => this.showToast(msg),
        refresh: () => this.renderCurrentTab(),
        copyReport: () => this.copyReportToClipboard(),
        downloadReport: () => this.downloadReport(),
        openFeedback: this.onOpenFeedback,
        bulkArchive: this.bulkArchive,
      };
      renderer(ctx, engine);
    }
  }

  // --- Flight Recorder & Markdown Export ---

  public async copyReportToClipboard(): Promise<void> {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined, browserReportContext());

    await copyTextToClipboard(report);
    this.showToast('Diagnostic report copied to clipboard.');
  }

  public downloadReport(): void {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined, browserReportContext());
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotw-diagnostics-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Diagnostic report downloaded.');
  }

  public showToast(message: string): void {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.style.display = 'inline';

    if (this.toastTimeout !== null) {
      if (typeof window !== 'undefined') window.clearTimeout(this.toastTimeout);
    }
    if (typeof window !== 'undefined') {
      this.toastTimeout = window.setTimeout(() => {
        if (this.toast) {
          this.toast.style.display = 'none';
        }
        this.toastTimeout = null;
      }, 3500);
    }
  }

  public showCrash(error: Error | string): void {
    this.lastCrashError = error;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';

    flightRecorder.recordError(error, { unhandled: true });

    if (this.crashModal && this.crashText) {
      this.crashText.textContent = `${message}\n\n${stack ?? ''}`;
      this.crashModal.style.display = 'flex';
    }
  }

  public submitCrashReport(): void {
    if (this.onOpenFeedback) {
      if (this.crashModal) {
        this.crashModal.style.display = 'none';
      }
      this.onOpenFeedback({
        type: 'bug',
        error: this.lastCrashError ?? undefined,
        subject: `Crash: ${this.lastCrashError instanceof Error ? this.lastCrashError.message : String(this.lastCrashError ?? 'Runtime Error')}`,
      });
    } else {
      void this.copyReportToClipboard();
      const title = encodeURIComponent(`[Crash]: ${this.lastCrashError instanceof Error ? this.lastCrashError.message : String(this.lastCrashError ?? 'Runtime Error')}`);
      if (typeof window !== 'undefined') {
        window.open(`https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/issues/new?title=${title}&labels=bug`, '_blank');
      }
    }
  }

  /**
   * Generic error toast notification for player-facing diagnostic/error reporting.
   */
  public showError(message: string): void {
    showGlobalToast(message, 'error');
  }

  /**
   * Generic modal alert for severe or modal error reporting.
   */
  public showErrorModal(message: string): void {
    if (this.crashModal && this.crashText) {
      this.crashText.textContent = message;
      this.crashModal.style.display = 'flex';
    } else {
      showGlobalToast(message, 'error');
    }
  }
}
