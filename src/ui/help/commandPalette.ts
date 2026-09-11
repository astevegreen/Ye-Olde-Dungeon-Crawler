import type { GameEngine } from '../../engine/engine';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Action' | 'Mode' | 'Help' | 'System';
  shortcut: string;
  description: string;
  execute: (engine: GameEngine) => void;
}

export class CommandPalette {
  private overlayEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private isOpenState = false;
  private commands: CommandItem[] = [];
  private filteredCommands: CommandItem[] = [];
  private selectedIndex = 0;
  private engine?: GameEngine;
  private onCloseCallback?: () => void;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('command-palette-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'command-palette-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.cssText = `
        display: none;
        align-items: flex-start;
        padding-top: 10vh;
        z-index: 140;
      `;
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  public registerCommands(commands: CommandItem[]): void {
    this.commands = commands;
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    this.onCloseCallback = onClose;
    this.isOpenState = true;
    this.filteredCommands = [...this.commands];
    this.selectedIndex = 0;
    this.render();

    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
      setTimeout(() => {
        this.inputEl = document.getElementById('cmd-palette-input') as HTMLInputElement | null;
        this.inputEl?.focus();
      }, 20);
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

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    if (e.key === 'Escape') {
      this.close();
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.selectedIndex > 0) {
        this.selectedIndex -= 1;
        this.updateList();
      }
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.selectedIndex < this.filteredCommands.length - 1) {
        this.selectedIndex += 1;
        this.updateList();
      }
      return true;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      this.executeSelected();
      return true;
    }

    return false;
  }

  private filter(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter((c) => {
        return (
          c.title.toLowerCase().includes(q) ||
          c.shortcut.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
        );
      });
    }
    this.selectedIndex = 0;
    this.updateList();
  }

  private executeSelected(): void {
    if (this.filteredCommands[this.selectedIndex] && this.engine) {
      const cmd = this.filteredCommands[this.selectedIndex];
      this.close();
      cmd.execute(this.engine);
    }
  }

  private render(): void {
    if (!this.overlayEl) return;

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 580px; box-shadow: 6px 6px 16px rgba(0,0,0,0.9); font-family: 'MS Sans Serif', monospace;">
        <div class="retro-titlebar" style="background: linear-gradient(90deg, #1e3a8a, #2563eb); padding: 4px 8px;">
          <div class="retro-titlebar-title" style="font-size: 12px;">
            <span>⌨️</span>
            <span>Castle of the Winds - Quick Command Palette</span>
          </div>
          <button id="btn-cmd-palette-close" class="win-btn win-btn-sm" style="padding: 0 4px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 8px; background: #c0c0c0; gap: 6px;">
          <!-- Search input -->
          <div style="position: relative;">
            <input
              id="cmd-palette-input"
              type="text"
              class="retro-input"
              placeholder="Type a command, hotkey, or mechanic (e.g. 'Bestiary', 'Sort', 'Rest', 'Stairs')..."
              style="font-size: 13px; font-family: monospace; padding: 6px 8px; margin: 0; background: #ffffff; width: 100%;"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <!-- Command Result List -->
          <div id="cmd-palette-list" class="retro-inset-list" style="height: 260px; overflow-y: auto; background: #0f172a; padding: 4px;">
            <!-- Rendered by updateList -->
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #4b5563; padding-top: 2px;">
            <span>Press <b>Enter</b> to execute, <b>↑/↓</b> to navigate, <b>Esc</b> to dismiss.</span>
            <span style="font-weight: bold; color: #1e3a8a;">Shift+? / Ctrl+K</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-cmd-palette-close')?.addEventListener('click', () => this.close());

    this.inputEl = document.getElementById('cmd-palette-input') as HTMLInputElement | null;
    this.listEl = document.getElementById('cmd-palette-list');

    this.inputEl?.addEventListener('input', (e) => {
      this.filter((e.target as HTMLInputElement).value);
    });

    this.inputEl?.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.stopPropagation();
        this.handleKeyDown(e);
      }
    });

    this.updateList();
  }

  private updateList(): void {
    if (!this.listEl) return;

    if (this.filteredCommands.length === 0) {
      this.listEl.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 11px;">
          No matching commands or mechanics found.
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = this.filteredCommands
      .map((cmd, idx) => {
        const isSel = idx === this.selectedIndex;
        const catColor =
          cmd.category === 'Action'
            ? '#38bdf8'
            : cmd.category === 'Mode'
            ? '#facc15'
            : cmd.category === 'Help'
            ? '#4ade80'
            : '#c084fc';

        return `
          <div
            class="cmd-item ${isSel ? 'selected' : ''}"
            data-index="${idx}"
            style="
              padding: 4px 8px;
              cursor: pointer;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: ${isSel ? '#1e3a8a' : 'transparent'};
              color: ${isSel ? '#ffffff' : '#e2e8f0'};
              border-bottom: 1px solid #1e293b;
              font-size: 11px;
            "
          >
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 9px; padding: 1px 4px; background: #020617; border: 1px solid ${catColor}; color: ${catColor}; font-weight: bold; width: 48px; text-align: center;">
                ${cmd.category}
              </span>
              <div>
                <div style="font-weight: bold;">${cmd.title}</div>
                <div style="font-size: 9px; color: ${isSel ? '#bfdbfe' : '#94a3b8'};">${cmd.description}</div>
              </div>
            </div>
            <span style="font-family: monospace; font-size: 10px; padding: 2px 5px; background: ${isSel ? '#0284c7' : '#1e293b'}; color: #ffffff; border-radius: 2px; white-space: nowrap;">
              ${cmd.shortcut}
            </span>
          </div>
        `;
      })
      .join('');

    const items = this.listEl.querySelectorAll('.cmd-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') ?? '0', 10);
        this.selectedIndex = idx;
        this.executeSelected();
      });
    });

    // Auto-scroll into view if needed
    const selectedItem = this.listEl.querySelector('.cmd-item.selected') as HTMLElement | null;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
}
