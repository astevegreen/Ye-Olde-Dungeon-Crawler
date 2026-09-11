import { type GameEngine, type CharacterProfile, flightRecorder } from '../engine';
import { copyTextToClipboard } from './platform';

export class DiagnosticModal {
  private modal: HTMLElement | null;
  private reportPre: HTMLElement | null;
  private copyBtn: HTMLButtonElement | null;
  private downloadBtn: HTMLButtonElement | null;
  private clearBtn: HTMLButtonElement | null;
  private closeBtn: HTMLButtonElement | null;
  private closeTitleBtn: HTMLButtonElement | null;
  private toast: HTMLElement | null;

  // Crash modal elements
  private crashModal: HTMLElement | null;
  private crashText: HTMLElement | null;
  private crashCopyBtn: HTMLButtonElement | null;
  private crashReloadBtn: HTMLButtonElement | null;

  private getEngine: () => GameEngine | null;
  private getProfile: () => CharacterProfile | null;
  private onClosedCallback?: () => void;
  private toastTimeout: number | null = null;

  constructor(
    getEngine: () => GameEngine | null,
    getProfile: () => CharacterProfile | null,
    onClosedCallback?: () => void
  ) {
    this.getEngine = getEngine;
    this.getProfile = getProfile;
    this.onClosedCallback = onClosedCallback;

    this.modal = document.getElementById('diagnostic-modal');
    this.reportPre = document.getElementById('diagnostic-report-text');
    this.copyBtn = document.getElementById('btn-diag-copy') as HTMLButtonElement | null;
    this.downloadBtn = document.getElementById('btn-diag-download') as HTMLButtonElement | null;
    this.clearBtn = document.getElementById('btn-diag-clear') as HTMLButtonElement | null;
    this.closeBtn = document.getElementById('btn-diag-close') as HTMLButtonElement | null;
    this.closeTitleBtn = document.getElementById('btn-diag-close-title') as HTMLButtonElement | null;
    this.toast = document.getElementById('diagnostic-toast');

    this.crashModal = document.getElementById('crash-modal');
    this.crashText = document.getElementById('crash-error-text');
    this.crashCopyBtn = document.getElementById('btn-crash-copy') as HTMLButtonElement | null;
    this.crashReloadBtn = document.getElementById('btn-crash-reload') as HTMLButtonElement | null;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.closeTitleBtn?.addEventListener('click', () => this.close());

    this.copyBtn?.addEventListener('click', () => {
      this.copyReportToClipboard();
    });

    this.downloadBtn?.addEventListener('click', () => {
      this.downloadReport();
    });

    this.clearBtn?.addEventListener('click', () => {
      flightRecorder.clear();
      this.refresh();
      this.showToast('Flight log buffer cleared.');
    });

    this.crashCopyBtn?.addEventListener('click', () => {
      this.copyReportToClipboard();
    });

    this.crashReloadBtn?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  public isOpen(): boolean {
    return this.modal?.style.display === 'flex';
  }

  public open(): void {
    if (!this.modal) return;
    this.refresh();
    this.modal.style.display = 'flex';
  }

  public close(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public refresh(): void {
    if (!this.reportPre) return;
    const engine = this.getEngine();
    const profile = this.getProfile();
    const markdown = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined);
    this.reportPre.textContent = markdown;
  }

  public async copyReportToClipboard(): Promise<void> {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined);

    await copyTextToClipboard(report);
    this.showToast('Diagnostic report copied to clipboard for Antigravity debugging');
  }

  public downloadReport(): void {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotw-diagnostics-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Diagnostic markdown file downloaded.');
  }

  public showToast(message: string): void {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.style.display = 'inline';

    if (this.toastTimeout !== null) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      if (this.toast) {
        this.toast.style.display = 'none';
      }
      this.toastTimeout = null;
    }, 4000);
  }

  public showCrash(error: Error | string): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';

    flightRecorder.recordError(error, { unhandled: true });

    if (this.crashModal && this.crashText) {
      this.crashText.textContent = `${message}\n\n${stack ?? ''}`;
      this.crashModal.style.display = 'flex';
    }
  }
}
