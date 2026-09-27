import type { GameEngine } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';
import { AttributeAllocationDraft, type AttributeKey } from './attributeAllocationDraft';

export type { AttributeKey };

interface AttributeMeta {
  key: AttributeKey;
  label: string;
  hotkeyLetter: string;
  description: string;
  derivedPreview: (val: number) => string;
}

const ATTRIBUTES: AttributeMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    hotkeyLetter: 'S',
    description: 'Increases melee physical damage and inventory carry capacity.',
    derivedPreview: (val) => `Carry: ${val * 10} lbs | Melee Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    hotkeyLetter: 'D',
    description: 'Enhances evasion, ranged strike precision, and physical reflex speed.',
    derivedPreview: (val) => `Evasion: +${Math.floor(val / 2)}% | Ranged Atk: +${Math.floor(val / 2)}`,
  },
  {
    key: 'constitution',
    label: 'Constitution',
    hotkeyLetter: 'C',
    description: 'Fortifies physical resilience, increasing maximum Hit Points (+2 HP/pt).',
    derivedPreview: (val) => `HP Bonus: +${val * 2}`,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
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
  private modalStack?: ModalStackManager;
  private onCloseCallback?: () => void;
  private onAllocateCallback?: (attr: AttributeKey) => void;
  private openedAt = 0;
  /** This session's planned points; nothing reaches the player until `accept()`. */
  private readonly draft = new AttributeAllocationDraft();

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

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
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
    this.openedAt = Date.now();
    this.draft.clear();

    if (!this.overlayEl) {
      this.createDom();
    }

    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  /** Closes without spending anything still planned; the points stay unspent. */
  public close(): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.draft.clear();
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

  public toggle(engine: GameEngine, onClose?: () => void): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, onClose);
    }
  }

  /** Plans one point into `attr`. */
  public allocate(attr: AttributeKey): boolean {
    const player = this.engine?.player;
    if (!player || !this.draft.add(attr, player)) return false;
    this.render();
    return true;
  }

  /** Takes back one point planned this session; locked-in points can't be removed. */
  public deallocate(attr: AttributeKey): boolean {
    if (!this.draft.remove(attr)) return false;
    this.render();
    return true;
  }

  public undo(): boolean {
    if (!this.draft.undo()) return false;
    this.render();
    return true;
  }

  public redo(): boolean {
    const player = this.engine?.player;
    if (!player || !this.draft.redo(player)) return false;
    this.render();
    return true;
  }

  public reset(): boolean {
    if (!this.draft.reset()) return false;
    this.render();
    return true;
  }

  /** Locks the planned points in and closes. With nothing planned it just closes. */
  public accept(): void {
    const engine = this.engine;
    const player = engine?.player;
    if (engine && player && this.draft.total > 0) {
      const summary = this.draft.describe();
      const spent = this.draft.commit(player);
      if (spent > 0) {
        engine.log(`Attributes locked in: ${summary}. ${player.unspentStatPoints} point(s) remain.`);
        this.onAllocateCallback?.('strength');
      }
    }
    this.close();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === 'ESCAPE' || code === 'KeyU') {
      e.preventDefault();
      this.close();
      return true;
    }

    // Safety debounce: drop rapid keystrokes within 200ms of opening to avoid accidental
    // allocations (or an accidental accept) from queued movement keys.
    if (Date.now() - this.openedAt < 200) {
      e.preventDefault();
      return true;
    }

    if (key === 'ENTER' || code === 'NumpadEnter') {
      e.preventDefault();
      this.accept();
      return true;
    }

    if ((key === 'Z' || code === 'KeyZ') && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return true;
    }

    if (key === 'Y' || code === 'KeyY' || (e.shiftKey && (key === 'Z' || code === 'KeyZ'))) {
      e.preventDefault();
      this.redo();
      return true;
    }

    if (key === 'R' || code === 'KeyR') {
      e.preventDefault();
      this.reset();
      return true;
    }

    if (key === 'S' || code === 'KeyS') {
      e.preventDefault();
      this.allocate('strength');
      return true;
    }
    if (key === 'D' || code === 'KeyD') {
      e.preventDefault();
      this.allocate('dexterity');
      return true;
    }
    if (key === 'C' || code === 'KeyC') {
      e.preventDefault();
      this.allocate('constitution');
      return true;
    }
    if (key === 'I' || code === 'KeyI') {
      e.preventDefault();
      this.allocate('intelligence');
      return true;
    }

    // The rune tree spends from the same pool, so it waits until planned points are settled.
    if ((key === 'T' || code === 'KeyT' || key === 'M' || code === 'KeyM') && this.engine?.player?.hasDiscoveredRune) {
      e.preventDefault();
      if (this.draft.total === 0) {
        this.close();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
        }
      }
      return true;
    }

    // Absorb any other keys while modal is open
    return true;
  }

  public render(): void {
    if (!this.overlayEl || !this.engine || !this.engine.player) return;

    const player = this.engine.player;
    const remaining = this.draft.remaining(player);
    const planned = this.draft.total;
    const canUndo = this.draft.canUndo;
    const canRedo = this.draft.canRedo;
    const runeTreeReady = planned === 0;

    const rowsHtml = ATTRIBUTES.map((meta) => {
      const sessionDelta = this.draft.get(meta.key);
      const currentVal = player[meta.key] + sessionDelta;
      const preview = meta.derivedPreview(currentVal);
      const canAllocate = remaining > 0;
      const canDeallocate = sessionDelta > 0;

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
              <span style="font-weight: bold; color: #fde047; font-size: 14px;">[${meta.hotkeyLetter}] ${meta.label}</span>
              <span style="font-weight: bold; color: #38bdf8; font-size: 15px;">${currentVal}</span>
              ${sessionDelta > 0 ? `<span style="color: #4ade80; font-weight: bold; font-size: 12px;">(+${sessionDelta})</span>` : ''}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              ${meta.description}
            </div>
            <div style="font-size: 11px; color: #a3e635; margin-top: 2px;">
              ${preview}
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button
              class="btn-deallocate-stat"
              data-attr="${meta.key}"
              ${canDeallocate ? '' : 'disabled'}
              style="
                padding: 6px 10px;
                background: ${canDeallocate ? '#7f1d1d' : '#334155'};
                color: ${canDeallocate ? '#fca5a5' : '#64748b'};
                border: 1px solid ${canDeallocate ? '#ef4444' : '#475569'};
                border-radius: 4px;
                cursor: ${canDeallocate ? 'pointer' : 'not-allowed'};
                font-weight: bold;
                font-size: 13px;
                font-family: inherit;
              "
              title="Take back 1 point planned this level-up"
            >
              -1
            </button>
            <button
              class="btn-allocate-stat"
              data-attr="${meta.key}"
              ${canAllocate ? '' : 'disabled'}
              style="
                padding: 6px 12px;
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
            ⭐ Points to Spend: ${remaining}
          </div>
        </div>

        ${player.hasDiscoveredRune ? `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(14, 116, 144, 0.25);
            border: 1px solid #0284c7;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 12px;
          ">
            <span style="color: #38bdf8; font-size: 12px;">
              🌀 <strong>Rune of Return Mastery:</strong> Spend unspent stat points on escape channel upgrades.
            </span>
            <button id="btn-open-rune-tree-from-levelup" ${runeTreeReady ? '' : 'disabled title="Accept or reset your planned points first"'} style="
              padding: 4px 10px;
              background: ${runeTreeReady ? '#0369a1' : '#334155'};
              color: ${runeTreeReady ? '#ffffff' : '#64748b'};
              border: 1px solid ${runeTreeReady ? '#38bdf8' : '#475569'};
              border-radius: 3px;
              cursor: ${runeTreeReady ? 'pointer' : 'not-allowed'};
              font-weight: bold;
              font-size: 11px;
              font-family: inherit;
            ">Mastery [T]</button>
          </div>
        ` : ''}

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
          gap: 8px;
        ">
          <div style="display: flex; gap: 6px; align-items: center;">
            <button
              id="btn-undo-levelup"
              ${canUndo ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${canUndo ? '#2563eb' : '#334155'};
                color: ${canUndo ? '#ffffff' : '#64748b'};
                border: 1px solid ${canUndo ? '#3b82f6' : '#475569'};
                border-radius: 4px;
                cursor: ${canUndo ? 'pointer' : 'not-allowed'};
                font-family: inherit;
                font-size: 11px;
                font-weight: bold;
              "
              title="Undo last allocation (Z)"
            >
              ↶ Undo [Z]
            </button>
            <button
              id="btn-redo-levelup"
              ${canRedo ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${canRedo ? '#2563eb' : '#334155'};
                color: ${canRedo ? '#ffffff' : '#64748b'};
                border: 1px solid ${canRedo ? '#3b82f6' : '#475569'};
                border-radius: 4px;
                cursor: ${canRedo ? 'pointer' : 'not-allowed'};
                font-family: inherit;
                font-size: 11px;
                font-weight: bold;
              "
              title="Redo allocation (Y)"
            >
              ↷ Redo [Y]
            </button>
            <button
              id="btn-reset-levelup"
              ${canUndo ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${canUndo ? '#475569' : '#334155'};
                color: ${canUndo ? '#f1f5f9' : '#64748b'};
                border: 1px solid ${canUndo ? '#64748b' : '#475569'};
                border-radius: 4px;
                cursor: ${canUndo ? 'pointer' : 'not-allowed'};
                font-family: inherit;
                font-size: 11px;
              "
              title="Clear every point planned this level-up (R)"
            >
              ↺ Reset [R]
            </button>
          </div>
          <button id="btn-accept-levelup" style="
            padding: 6px 16px;
            background: ${planned > 0 ? '#16a34a' : '#475569'};
            color: #ffffff;
            border: 1px solid ${planned > 0 ? '#22c55e' : '#64748b'};
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
          " title="${planned > 0 ? 'Lock in the planned points and return to the game' : 'Return to the game'}">
            ${planned > 0 ? 'Accept [Enter]' : 'Done [Enter]'}
          </button>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #94a3b8; text-align: center;">
          [S/D/C/I] plan a point · [Z] Undo · [Y] Redo · [Enter] lock in · [Esc] close without spending
        </div>
      </div>
    `;

    // Bind click handlers
    this.overlayEl.querySelector('#btn-close-levelup-top')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btn-accept-levelup')?.addEventListener('click', () => this.accept());
    this.overlayEl.querySelector('#btn-undo-levelup')?.addEventListener('click', () => this.undo());
    this.overlayEl.querySelector('#btn-redo-levelup')?.addEventListener('click', () => this.redo());
    this.overlayEl.querySelector('#btn-reset-levelup')?.addEventListener('click', () => this.reset());
    this.overlayEl.querySelector('#btn-open-rune-tree-from-levelup')?.addEventListener('click', () => {
      if (this.draft.total > 0) return;
      this.close();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
      }
    });

    const allocBtns = this.overlayEl.querySelectorAll('.btn-allocate-stat');
    allocBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const attr = (e.currentTarget as HTMLElement).getAttribute('data-attr') as AttributeKey;
        if (attr) {
          this.allocate(attr);
        }
      });
    });

    const deallocBtns = this.overlayEl.querySelectorAll('.btn-deallocate-stat');
    deallocBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const attr = (e.currentTarget as HTMLElement).getAttribute('data-attr') as AttributeKey;
        if (attr) {
          this.deallocate(attr);
        }
      });
    });
  }
}
