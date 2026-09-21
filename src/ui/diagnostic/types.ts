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
}

export type DiagnosticTabRenderer = (ctx: DiagnosticTabContext, engine: GameEngine) => void;
