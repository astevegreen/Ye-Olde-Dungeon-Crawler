import type { GameEngine } from '../engine';
import type { UIModal } from './modalStack';

export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence';

interface AttributeMeta {
  key: AttributeKey;
  label: string;
  hotkeyNum: string;
  hotkeyLetter: string;
  description: string;
  derivedPreview: (val: number) => string;
}

const ATTRIBUTES: AttributeMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    hotkeyNum: '1',
    hotkeyLetter: 'S',
    description: 'Increases melee physical damage and inventory carry capacity.',
    derivedPreview: (val) => `Carry: ${val * 10} lbs | Melee Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    hotkeyNum: '2',
    hotkeyLetter: 'D',
    description: 'Enhances evasion, ranged strike precision, and physical reflex speed.',
    derivedPreview: (val) => `Evasion: +${Math.floor(val / 2)}% | Ranged Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'constitution',
    label: 'Constitution',
    hotkeyNum: '3',
    hotkeyLetter: 'C',
    description: 'Fortifies physical resilience, increasing maximum Hit Points (+2 HP/pt).',
    derivedPreview: (val) => `HP Bonus: +${val * 2}`,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    hotkeyNum: '4',
    hotkeyLetter: 'I',
    description: 'Expands mystical reservoir (+2 MP/pt) and amplifies spell potency.',
    derivedPreview: (val) => `Mana Bonus: +${val * 2} MP | Spell Amp: +${Math.floor(val / 2)}%`,
  },
];

export class LevelUpModal implements UIModal {
  public readonly id = 'level-up-modal';
  private overlayEl: HTMLElement | null = null;
  private isOpenState = false;
  private engine?: GameEngine;
  private onCloseCallback?: () => void;
  private onAllocateCallback?: (attr: AttributeKey) => void;

  constructor(onClose?: () => void) {
    this.onCloseCallback = onClose;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('level-up-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'level-up-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '190';
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

  public setOnClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public setOnAllocate(cb: (attr: AttributeKey) => void): void {
    this.onAllocateCallback = cb;
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
    if (this.onCloseCallback) {
      const cb = this.onCloseCallback;
      this.onCloseCallback = undefined;
      cb();
    }
  }

  public toggle(engine: GameEngine, onClose?: () => void): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, onClose);
    }
  }

  public allocate(attr: AttributeKey): boolean {
    if (!this.engine || !this.engine.player) return false;
    const player = this.engine.player;
    if (player.unspentStatPoints <= 0) return false;

    const success = player.allocateAttribute(attr, 1);
    if (success) {
      this.engine.log(`Allocated 1 point into ${attr.toUpperCase()} (Total: ${player[attr]}). ${player.unspentStatPoints} point(s) remain.`);
      if (this.onAllocateCallback) {
        this.onAllocateCallback(attr);
      }
      this.render();
      return true;
    }
    return false;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === 'ESCAPE' || key === 'ENTER' || code === 'KeyU') {
      e.preventDefault();
      this.close();
      return true;
    }

    if (key === '1' || code === 'Digit1' || code === 'Numpad1' || code === 'KeyS') {
      e.preventDefault();
      this.allocate('strength');
      return true;
    }
    if (key === '2' || code === 'Digit2' || code === 'Numpad2' || code === 'KeyD') {
      e.preventDefault();
      this.allocate('dexterity');
      return true;
    }
    if (key === '3' || code === 'Digit3' || code === 'Numpad3' || code === 'KeyC') {
      e.preventDefault();
      this.allocate('constitution');
      return true;
    }
    if (key === '4' || code === 'Digit4' || code === 'Numpad4' || code === 'KeyI') {
      e.preventDefault();
      this.allocate('intelligence');
      return true;
    }

    // Absorb any other keys while modal is open
    return true;
  }

  public render(): void {
    if (!this.overlayEl || !this.engine || !this.engine.player) return;

    const player = this.engine.player;
    const unspent = player.unspentStatPoints;

    const rowsHtml = ATTRIBUTES.map((meta) => {
      const currentVal = player[meta.key];
      const preview = meta.derivedPreview(currentVal);
      const canAllocate = unspent > 0;

      return `
        <div class="stat-alloc-row" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid #475569;
          border-radius: 4px;
        ">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-weight: bold; color: #fde047; font-size: 14px;">[${meta.hotkeyNum}] ${meta.label}</span>
              <span style="font-weight: bold; color: #38bdf8; font-size: 15px;">${currentVal}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              ${meta.description}
            </div>
            <div style="font-size: 11px; color: #a3e635; margin-top: 2px;">
              ${preview}
            </div>
          </div>
          <div>
            <button
              class="btn-allocate-stat"
              data-attr="${meta.key}"
              ${canAllocate ? '' : 'disabled'}
              style="
                padding: 6px 14px;
                background: ${canAllocate ? '#16a34a' : '#334155'};
                color: ${canAllocate ? '#ffffff' : '#64748b'};
                border: 1px solid ${canAllocate ? '#22c55e' : '#475569'};
                border-radius: 4px;
                cursor: ${canAllocate ? 'pointer' : 'not-allowed'};
                font-weight: bold;
                font-size: 13px;
                font-family: inherit;
              "
            >
              +1 [${meta.hotkeyLetter}]
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="
        width: 480px;
        max-width: 95vw;
        background: #0f172a;
        border: 2px solid #eab308;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(234, 179, 8, 0.3);
        border-radius: 6px;
        padding: 16px;
        color: #e2e8f0;
        font-family: 'Courier New', Courier, monospace;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ca8a04; padding-bottom: 8px; margin-bottom: 12px;">
          <h2 style="margin: 0; font-size: 16px; color: #facc15; text-transform: uppercase; letter-spacing: 1px;">
            ⚔️ Level Up! Attribute Allocation
          </h2>
          <button id="btn-close-levelup-top" style="
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
          ">✕</button>
        </div>

        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e293b;
          border: 1px solid #ca8a04;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 12px;
        ">
          <div>
            <span style="font-weight: bold; color: #ffffff;">${player.name}</span>
            <span style="color: #94a3b8; margin-left: 6px;">Level ${player.level}</span>
          </div>
          <div style="
            background: #ca8a04;
            color: #000000;
            font-weight: bold;
            font-size: 13px;
            padding: 3px 8px;
            border-radius: 3px;
          ">
            ⭐ Unspent Points: ${unspent}
          </div>
        </div>

        <div class="stat-list" style="margin-bottom: 16px;">
          ${rowsHtml}
        </div>

        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #334155;
          padding-top: 10px;
        ">
          <span>Hotkeys: [1-4] or [S/D/C/I] to allocate | [U] or [Esc] to exit</span>
          <button id="btn-close-levelup-bottom" style="
            padding: 6px 16px;
            background: #475569;
            color: #ffffff;
            border: 1px solid #64748b;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
          ">
            Done [Esc]
          </button>
        </div>
      </div>
    `;

    // Bind click handlers
    this.overlayEl.querySelector('#btn-close-levelup-top')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btn-close-levelup-bottom')?.addEventListener('click', () => this.close());

    const allocBtns = this.overlayEl.querySelectorAll('.btn-allocate-stat');
    allocBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const attr = (e.currentTarget as HTMLElement).getAttribute('data-attr') as AttributeKey;
        if (attr) {
          this.allocate(attr);
        }
      });
    });
  }
}
