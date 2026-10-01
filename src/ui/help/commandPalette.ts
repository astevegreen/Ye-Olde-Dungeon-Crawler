import type { GameEngine } from '../../engine';
import { createDialogScrim, dialogHtml } from '../dialog';
import { escapeHtml, keyChip } from '../html';
import type { ModalStackManager, UIModal } from '../modalStack';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Action' | 'Mode' | 'Help' | 'System';
  shortcut: string;
  description: string;
  execute: (engine: GameEngine) => void;
}

/**
 * Registers on the modal stack while open (ARCHITECTURE.md §6), so the game pauses and
 * every key reaches the palette even when its text box loses focus.
 */
export class CommandPalette implements UIModal {
  public readonly id = 'command-palette';
  private modalStack?: ModalStackManager;
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
    // Near the top of the window, so the list grows downward as the filter narrows it.
    this.overlayEl = createDialogScrim('command-palette-modal');
    this.overlayEl?.classList.add('cp-scrim');
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  /** The stack sets this on push/pop; only a close needs acting on. */
  public set isOpen(value: boolean) {
    if (!value) this.close();
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public registerCommands(commands: CommandItem[]): void {
    this.commands = commands;
  }

  public getCommand(id: string): CommandItem | undefined {
    return this.commands.find((c) => c.id === id);
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    this.onCloseCallback = onClose;
    this.isOpenState = true;
    this.filteredCommands = [...this.commands];
    this.selectedIndex = 0;
    this.render();
    this.modalStack?.push(this);

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
    this.modalStack?.remove(this.id);
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

    this.overlayEl.innerHTML = dialogHtml({
      title: 'Commands',
      icon: 'commands',
      closeId: 'btn-cmd-palette-close',
      body: `
        <input
          id="cmd-palette-input"
          type="text"
          class="ui-input"
          placeholder="Type a command, key, or mechanic: Bestiary, Rest, Stairs…"
          autocomplete="off"
          spellcheck="false"
        />
        <div id="cmd-palette-list" class="cp-list ui-inset" role="listbox"></div>`,
      hints: [
        { keys: ['↑', '↓'], label: 'choose' },
        { keys: ['Enter'], label: 'run' },
        { keys: ['Esc'], label: 'close' },
      ],
      footNote: `<span class="cp-open-keys">Open with ${keyChip('Shift+?')} or ${keyChip('Ctrl+K')}</span>`,
    });

    this.overlayEl.querySelector('#btn-cmd-palette-close')?.addEventListener('click', () => this.close());

    this.inputEl = this.overlayEl.querySelector<HTMLInputElement>('#cmd-palette-input');
    this.listEl = this.overlayEl.querySelector<HTMLElement>('#cmd-palette-list');

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
      this.listEl.innerHTML = '<div class="ui-note cp-empty">No command or mechanic matches.</div>';
      return;
    }

    this.listEl.innerHTML = this.filteredCommands
      .map((cmd, idx) => {
        const isSel = idx === this.selectedIndex;
        return `
          <div class="cp-item${isSel ? ' is-focused' : ''}" data-index="${idx}" role="option" aria-selected="${isSel}">
            <span class="cp-cat is-${cmd.category.toLowerCase()}">${escapeHtml(cmd.category)}</span>
            <span class="cp-text">
              <span class="cp-title">${escapeHtml(cmd.title)}</span>
              <span class="cp-desc">${escapeHtml(cmd.description)}</span>
            </span>
            ${cmd.shortcut ? keyChip(cmd.shortcut) : ''}
          </div>`;
      })
      .join('');

    const items = this.listEl.querySelectorAll('.cp-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') ?? '0', 10);
        this.selectedIndex = idx;
        this.executeSelected();
      });
    });

    // Auto-scroll into view if needed
    const selectedItem = this.listEl.querySelector('.cp-item.is-focused') as HTMLElement | null;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
}
