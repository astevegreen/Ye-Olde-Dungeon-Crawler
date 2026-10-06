import type { GameEngine } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';
import { resolveBranding } from './branding';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

export interface RuneOfReturnDiscoveryModalConfig {
  onClose?: () => void;
  onOpenTree?: () => void;
}

export class RuneOfReturnDiscoveryModal implements UIModal {
  public readonly id = 'rune-of-return-discovery-modal';
  private overlayEl: HTMLElement | null = null;
  private isOpenState = false;
  private engine?: GameEngine;
  private modalStack?: ModalStackManager;
  private onCloseCallback?: () => void;
  private onOpenTreeCallback?: () => void;

  constructor(config?: RuneOfReturnDiscoveryModalConfig) {
    this.onCloseCallback = config?.onClose;
    this.onOpenTreeCallback = config?.onOpenTree;
    this.createDom();
  }

  private createDom(): void {
    this.overlayEl = createDialogScrim(this.id);
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  public set isOpen(val: boolean) {
    this.isOpenState = val;
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public setOnClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public setOnOpenTree(cb: () => void): void {
    this.onOpenTreeCallback = cb;
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    if (onClose) this.onCloseCallback = onClose;
    this.isOpenState = true;

    if (!this.overlayEl) {
      this.createDom();
    }

    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  /** The dialog, for the modal stack's focus handling (§6): Tab moves within it. */
  public focusRoot(): HTMLElement | null {
    return this.overlayEl;
  }

  public close(): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    if (this.modalStack) {
      this.modalStack.remove(this.id);
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === 'ESCAPE' || key === 'ENTER' || key === ' ' || code === 'Space') {
      e.preventDefault();
      this.close();
      return true;
    }

    if (key === 'U' || code === 'KeyU') {
      e.preventDefault();
      this.close();
      if (this.onOpenTreeCallback) {
        this.onOpenTreeCallback();
      }
      return true;
    }

    // Absorb any other keys while open
    return true;
  }

  public render(): void {
    if (!this.overlayEl || !this.engine) return;

    const smith = escapeHtml(resolveBranding(this.engine.manifest).runeSmithName);
    const fact = (title: string, text: string, warn = false) => `<div class="ui-fact${warn ? ' is-warn' : ''}"><b>${title}</b> ${text}</div>`;
    this.overlayEl.innerHTML = dialogHtml({
      title: 'The Rune of Return',
      kicker: 'Relic discovered',
      closeId: 'rune-discovery-x',
      body: `
        <div class="ui-dialog-lede">You recover a carved rune-stone. At your touch it dissolves into light and binds its power to you, so there is nothing to carry.</div>
        ${fact('Two-way recall.', 'In the dungeon, channeling takes you to town and anchors a rift where you stood. In town, channeling takes you back through it.')}
        ${fact('Three charges.', `A charge is spent only on a successful return. ${smith} refills them free in town.`)}
        ${fact('Channeling (T).', 'Press T to begin, then T or Wait (.) each turn to keep it going.')}
        ${fact('Concentration.', 'Any damage breaks the channel. So do attacking, casting, using items, and moving, until you learn Unbound Casting.', true)}
        ${fact('Depth.', 'The channel takes one turn longer for every five floors down.')}
        <div class="ui-note">Its ranks spend your level points, on the Character tab.</div>`,
      hints: [
        { keys: ['U'], label: 'see the ranks' },
        { keys: ['Enter'], label: 'continue' },
      ],
      actions:
        dialogButton('rune-discovery-tree-btn', 'See the ranks', { key: 'U' }) +
        dialogButton('rune-discovery-continue-btn', 'Continue', { primary: true, key: 'Enter' }),
    });

    const treeBtn = this.overlayEl.querySelector('#rune-discovery-tree-btn') as HTMLButtonElement | null;
    treeBtn?.addEventListener('click', () => {
      this.close();
      if (this.onOpenTreeCallback) {
        this.onOpenTreeCallback();
      }
    });

    this.overlayEl.querySelector('#rune-discovery-x')?.addEventListener('click', () => this.close());
    const continueBtn = this.overlayEl.querySelector('#rune-discovery-continue-btn') as HTMLButtonElement | null;
    continueBtn?.addEventListener('click', () => {
      this.close();
    });
  }
}
