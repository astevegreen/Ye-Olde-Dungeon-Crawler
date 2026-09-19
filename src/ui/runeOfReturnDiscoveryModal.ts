import type { GameEngine } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';

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
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById(this.id);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = this.id;
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '200';
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
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

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="
        max-width: 540px;
        width: 90%;
        background: #0f172a;
        border: 2px solid #38bdf8;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.25);
        color: #f8fafc;
        font-family: monospace, system-ui;
        padding: 24px;
        box-sizing: border-box;
      ">
        <div style="text-align: center; margin-bottom: 18px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
          <div style="font-size: 20px; font-weight: bold; color: #38bdf8; letter-spacing: 1px;">
            ✦ ANCIENT RELIC DISCOVERED ✦
          </div>
          <div style="font-size: 15px; font-weight: bold; color: #fde047; margin-top: 4px;">
            THE RUNE OF RETURN
          </div>
        </div>

        <div style="font-size: 13px; line-height: 1.5; color: #cbd5e1; margin-bottom: 16px;">
          You have recovered a legendary carved rune-stone humming with primordial translocational energy.
        </div>

        <!-- Mechanics list -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          <div style="background: rgba(30, 41, 59, 0.6); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #38bdf8;">
            <span style="font-weight: bold; color: #38bdf8;">Charges (3 Max):</span>
            <span style="color: #cbd5e1;"> Teleports you back to town upon channel completion. Only spends a charge on a <em>successful</em> teleport. Free, unlimited refills at <strong>Thrain the Rune-Smith</strong> in town.</span>
          </div>

          <div style="background: rgba(30, 41, 59, 0.6); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #fde047;">
            <span style="font-weight: bold; color: #fde047;">Channeling (T):</span>
            <span style="color: #cbd5e1;"> Press <strong>[T]</strong> to begin channeling. Press <strong>[.]</strong> (Wait) or <strong>[T]</strong> on subsequent turns to sustain concentration and advance the channel countdown.</span>
          </div>

          <div style="background: rgba(30, 41, 59, 0.6); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #ef4444;">
            <span style="font-weight: bold; color: #ef4444;">Vulnerability & Concentration:</span>
            <span style="color: #cbd5e1;"> Taking <strong>any damage (&gt;0 HP)</strong> breaks your concentration and fizzles the channel! Attacking, spells, items, or moving (unless upgraded) also cancel the channel.</span>
          </div>

          <div style="background: rgba(30, 41, 59, 0.6); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #a855f7;">
            <span style="font-weight: bold; color: #a855f7;">Depth Scaling:</span>
            <span style="color: #cbd5e1;"> The planar barrier thickens with depth: +1 turn of channel time per 5 dungeon levels descended.</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
          <button id="rune-discovery-tree-btn" style="
            background: #0284c7;
            color: #ffffff;
            border: 1px solid #38bdf8;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
          ">
            Open Upgrade Tree (U)
          </button>
          <button id="rune-discovery-continue-btn" style="
            background: #334155;
            color: #f8fafc;
            border: 1px solid #64748b;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
          ">
            Continue (Enter)
          </button>
        </div>
      </div>
    `;

    const treeBtn = this.overlayEl.querySelector('#rune-discovery-tree-btn') as HTMLButtonElement | null;
    treeBtn?.addEventListener('click', () => {
      this.close();
      if (this.onOpenTreeCallback) {
        this.onOpenTreeCallback();
      }
    });

    const continueBtn = this.overlayEl.querySelector('#rune-discovery-continue-btn') as HTMLButtonElement | null;
    continueBtn?.addEventListener('click', () => {
      this.close();
    });
  }
}
