import type { GameEngine } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';

export type AttributeKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence';

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
  private undoStack: Array<{ op: 'allocate' | 'deallocate'; attr: AttributeKey }> = [];
  private redoStack: Array<{ op: 'allocate' | 'deallocate'; attr: AttributeKey }> = [];
  private sessionNetAllocations: Record<AttributeKey, number> = {
    strength: 0,
    dexterity: 0,
    constitution: 0,
    intelligence: 0,
  };

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
    this.undoStack = [];
    this.redoStack = [];
    this.sessionNetAllocations = {
      strength: 0,
      dexterity: 0,
      constitution: 0,
      intelligence: 0,
    };

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
      this.undoStack.push({ op: 'allocate', attr });
      this.redoStack = [];
      this.sessionNetAllocations[attr] = (this.sessionNetAllocations[attr] ?? 0) + 1;
      this.engine.log(`Allocated 1 point into ${attr.toUpperCase()} (Total: ${player[attr]}). ${player.unspentStatPoints} point(s) remain.`);
      if (this.onAllocateCallback) {
        this.onAllocateCallback(attr);
      }
      this.render();
      return true;
    }
    return false;
  }

  public deallocate(attr: AttributeKey): boolean {
    if (!this.engine || !this.engine.player) return false;
    const player = this.engine.player;
    if ((player.allocatedAttributes[attr] ?? 0) <= 0) return false;

    const success = player.deallocateAttribute(attr, 1);
    if (success) {
      this.undoStack.push({ op: 'deallocate', attr });
      this.redoStack = [];
      this.sessionNetAllocations[attr] = (this.sessionNetAllocations[attr] ?? 0) - 1;
      this.engine.log(`Deallocated 1 point from ${attr.toUpperCase()} (Total: ${player[attr]}). ${player.unspentStatPoints} point(s) remain.`);
      if (this.onAllocateCallback) {
        this.onAllocateCallback(attr);
      }
      this.render();
      return true;
    }
    return false;
  }

  public undo(): boolean {
    if (this.undoStack.length === 0 || !this.engine || !this.engine.player) return false;
    const action = this.undoStack.pop()!;
    const player = this.engine.player;
    if (action.op === 'allocate') {
      player.deallocateAttribute(action.attr, 1);
      this.sessionNetAllocations[action.attr] = (this.sessionNetAllocations[action.attr] ?? 0) - 1;
      this.engine.log(`Reverted allocation in ${action.attr.toUpperCase()} (Total: ${player[action.attr]}). ${player.unspentStatPoints} point(s) remain.`);
    } else {
      player.allocateAttribute(action.attr, 1);
      this.sessionNetAllocations[action.attr] = (this.sessionNetAllocations[action.attr] ?? 0) + 1;
      this.engine.log(`Re-applied allocation in ${action.attr.toUpperCase()} (Total: ${player[action.attr]}). ${player.unspentStatPoints} point(s) remain.`);
    }
    this.redoStack.push(action);
    if (this.onAllocateCallback) {
      this.onAllocateCallback(action.attr);
    }
    this.render();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0 || !this.engine || !this.engine.player) return false;
    const action = this.redoStack.pop()!;
    const player = this.engine.player;
    if (action.op === 'allocate') {
      player.allocateAttribute(action.attr, 1);
      this.sessionNetAllocations[action.attr] = (this.sessionNetAllocations[action.attr] ?? 0) + 1;
      this.engine.log(`Redid allocation of 1 point into ${action.attr.toUpperCase()} (Total: ${player[action.attr]}). ${player.unspentStatPoints} point(s) remain.`);
    } else {
      player.deallocateAttribute(action.attr, 1);
      this.sessionNetAllocations[action.attr] = (this.sessionNetAllocations[action.attr] ?? 0) - 1;
      this.engine.log(`Redid deallocation of 1 point from ${action.attr.toUpperCase()} (Total: ${player[action.attr]}). ${player.unspentStatPoints} point(s) remain.`);
    }
    this.undoStack.push(action);
    if (this.onAllocateCallback) {
      this.onAllocateCallback(action.attr);
    }
    this.render();
    return true;
  }

  public reset(): boolean {
    if (this.undoStack.length === 0 || !this.engine || !this.engine.player) return false;
    const player = this.engine.player;
    while (this.undoStack.length > 0) {
      const action = this.undoStack.pop()!;
      if (action.op === 'allocate') {
        player.deallocateAttribute(action.attr, 1);
      } else {
        player.allocateAttribute(action.attr, 1);
      }
    }
    this.redoStack = [];
    this.sessionNetAllocations = { strength: 0, dexterity: 0, constitution: 0, intelligence: 0 };
    this.engine.log(`Reset all level-up attribute changes. ${player.unspentStatPoints} point(s) available.`);
    if (this.onAllocateCallback) {
      this.onAllocateCallback('strength');
    }
    this.render();
    return true;
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

    // Safety debounce: drop rapid keystrokes within 200ms of opening to avoid accidental allocations from queued movement
    if (Date.now() - this.openedAt < 200) {
      e.preventDefault();
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

    if ((key === 'T' || code === 'KeyT' || key === 'M' || code === 'KeyM') && this.engine?.player?.hasDiscoveredRune) {
      e.preventDefault();
      this.close();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
      }
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
      const canDeallocate = (player.allocatedAttributes[meta.key] ?? 0) > 0;
      const sessionDelta = this.sessionNetAllocations[meta.key] ?? 0;

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
              ${sessionDelta !== 0 ? `<span style="color: ${sessionDelta > 0 ? '#4ade80' : '#f87171'}; font-weight: bold; font-size: 12px;">(${sessionDelta > 0 ? '+' : ''}${sessionDelta})</span>` : ''}
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
              title="Refund 1 point"
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
            ⭐ Unspent Points: ${unspent}
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
            <button id="btn-open-rune-tree-from-levelup" style="
              padding: 4px 10px;
              background: #0369a1;
              color: #ffffff;
              border: 1px solid #38bdf8;
              border-radius: 3px;
              cursor: pointer;
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
              ${this.undoStack.length > 0 ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${this.undoStack.length > 0 ? '#2563eb' : '#334155'};
                color: ${this.undoStack.length > 0 ? '#ffffff' : '#64748b'};
                border: 1px solid ${this.undoStack.length > 0 ? '#3b82f6' : '#475569'};
                border-radius: 4px;
                cursor: ${this.undoStack.length > 0 ? 'pointer' : 'not-allowed'};
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
              ${this.redoStack.length > 0 ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${this.redoStack.length > 0 ? '#2563eb' : '#334155'};
                color: ${this.redoStack.length > 0 ? '#ffffff' : '#64748b'};
                border: 1px solid ${this.redoStack.length > 0 ? '#3b82f6' : '#475569'};
                border-radius: 4px;
                cursor: ${this.redoStack.length > 0 ? 'pointer' : 'not-allowed'};
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
              ${this.undoStack.length > 0 ? '' : 'disabled'}
              style="
                padding: 5px 10px;
                background: ${this.undoStack.length > 0 ? '#475569' : '#334155'};
                color: ${this.undoStack.length > 0 ? '#f1f5f9' : '#64748b'};
                border: 1px solid ${this.undoStack.length > 0 ? '#64748b' : '#475569'};
                border-radius: 4px;
                cursor: ${this.undoStack.length > 0 ? 'pointer' : 'not-allowed'};
                font-family: inherit;
                font-size: 11px;
              "
              title="Reset all changes made in this level up (R)"
            >
              ↺ Reset [R]
            </button>
          </div>
          <span style="color: #94a3b8; font-size: 11px;">[S/D/C/I] Allocate | [Z] Undo | [Y] Redo</span>
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
    this.overlayEl.querySelector('#btn-undo-levelup')?.addEventListener('click', () => this.undo());
    this.overlayEl.querySelector('#btn-redo-levelup')?.addEventListener('click', () => this.redo());
    this.overlayEl.querySelector('#btn-reset-levelup')?.addEventListener('click', () => this.reset());
    this.overlayEl.querySelector('#btn-open-rune-tree-from-levelup')?.addEventListener('click', () => {
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
