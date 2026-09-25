import type { GameEngine } from '../../engine';

export type DiagnosticTabId = 'simulation' | 'actor' | 'pipeline' | 'triage';

export interface DiagnosticInputContext {
  getInputLocked: () => boolean;
  clearInputLock: () => void;
  getChordStatus?: () => {
    enabled: boolean;
    bufferMs: number;
    pressedKeys: string[];
    isChording: boolean;
    hasPendingTimer: boolean;
  };
}

export interface DiagnosticTabContext {
  readonly container: HTMLElement;
  readonly inputContext: DiagnosticInputContext | undefined;
  showToast(message: string): void;
  refresh(): void;
  copyReport?: () => Promise<void> | void;
  downloadReport?: () => void;
  openFeedback?: (opts?: Record<string, unknown>) => void;
  /** Loads the game a pasted bug report describes; returns a status line to show. */
  loadReportState?: (text: string, replay: boolean) => Promise<string>;
  bulkArchive?: import('../../engine').BulkArchive | null;
}

export type DiagnosticTabRenderer = (ctx: DiagnosticTabContext, engine: GameEngine) => void;
