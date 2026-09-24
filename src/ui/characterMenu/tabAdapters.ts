import type { GameState } from '../flanks/types';
import type { MenuTab } from './menuTab';
import type { CompendiumModal } from '../help/compendiumModal';
import type { PactModal } from '../pactModal';
import type { SpellbookModal } from '../spellbookModal';

/**
 * Wraps CompendiumModal as a MenuTab.
 */
export class CompendiumTabAdapter implements MenuTab {
  public readonly id = 'bestiary';
  public readonly label = 'Bestiary';
  public readonly hotkeyActionId = 'compendium';
  private modal: CompendiumModal;
  private container: HTMLElement | null = null;

  constructor(modal: CompendiumModal, _onTabClosed?: () => void) {
    this.modal = modal;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    const overlayEl = this.modal.rootElement;
    if (overlayEl) {
      overlayEl.style.position = 'relative';
      overlayEl.style.inset = 'auto';
      overlayEl.style.width = '100%';
      overlayEl.style.height = '100%';
      overlayEl.style.backgroundColor = 'transparent';
      overlayEl.style.backdropFilter = 'none';
      overlayEl.style.zIndex = 'auto';
      overlayEl.style.display = 'flex';
      overlayEl.style.flexDirection = 'column';
      overlayEl.style.alignItems = 'stretch';
      overlayEl.style.justifyContent = 'stretch';
      overlayEl.style.boxSizing = 'border-box';
      if (overlayEl.parentElement !== container) {
        container.appendChild(overlayEl);
      }
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine, () => {
      // No-op while embedded as a tab; CharacterMenuModal owns shell lifecycle
    });
    this.scaleToFit();
  }

  private scaleToFit(): void {
    const overlayEl = this.modal.rootElement;
    if (!overlayEl) return;
    const win = overlayEl.querySelector<HTMLElement>('.retro-window');
    if (win) {
      win.style.width = '100%';
      win.style.height = '100%';
      win.style.maxWidth = '100%';
      win.style.maxHeight = '100%';
      win.style.boxShadow = 'none';
      win.style.borderRadius = '0';
      win.style.border = 'none';
      win.style.flex = '1';
    }
    const body = overlayEl.querySelector<HTMLElement>('.retro-window-body');
    if (body) {
      body.style.flex = '1';
      body.style.minHeight = '0';
      body.style.overflowY = 'auto';
    }
  }

  public unmount(): void {
    const overlayEl = this.modal.rootElement;
    this.modal.close();
    if (overlayEl && this.container && overlayEl.parentElement === this.container) {
      this.container.removeChild(overlayEl);
      overlayEl.style.position = '';
      overlayEl.style.inset = '';
      overlayEl.style.width = '';
      overlayEl.style.height = '';
      overlayEl.style.backgroundColor = '';
      overlayEl.style.backdropFilter = '';
      overlayEl.style.zIndex = '';
      overlayEl.style.display = '';
      overlayEl.style.flexDirection = '';
      overlayEl.style.alignItems = '';
      overlayEl.style.justifyContent = '';
      overlayEl.style.boxSizing = '';
      document.getElementById('app')?.appendChild(overlayEl);
    }
    this.container = null;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    // Suppress wrapped modal's internal close-on-hotkey/Escape so CharacterMenuModal owns shell lifecycle
    if (e.key === 'Escape' || e.code === 'KeyB') {
      return false;
    }
    return this.modal.handleKeyDown(e);
  }
}

/**
 * Wraps PactModal as a MenuTab.
 */
export class PactTabAdapter implements MenuTab {
  public readonly id = 'pacts';
  public readonly label = 'Pacts';
  public readonly hotkeyActionId = 'pact';
  private modal: PactModal;
  private container: HTMLElement | null = null;

  constructor(modal: PactModal, _onTabClosed?: () => void) {
    this.modal = modal;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    const overlayEl = this.modal.rootElement;
    if (overlayEl) {
      overlayEl.style.position = 'relative';
      overlayEl.style.inset = 'auto';
      overlayEl.style.width = '100%';
      overlayEl.style.height = '100%';
      overlayEl.style.backgroundColor = 'transparent';
      overlayEl.style.backdropFilter = 'none';
      overlayEl.style.zIndex = 'auto';
      overlayEl.style.display = 'flex';
      overlayEl.style.flexDirection = 'column';
      overlayEl.style.alignItems = 'stretch';
      overlayEl.style.justifyContent = 'stretch';
      overlayEl.style.boxSizing = 'border-box';
      if (overlayEl.parentElement !== container) {
        container.appendChild(overlayEl);
      }
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine, () => {
      // No-op while embedded as a tab; CharacterMenuModal owns shell lifecycle
    });
    this.scaleToFit();
  }

  private scaleToFit(): void {
    const overlayEl = this.modal.rootElement;
    if (!overlayEl) return;
    const win = overlayEl.querySelector<HTMLElement>('.retro-window');
    if (win) {
      win.style.width = '100%';
      win.style.height = '100%';
      win.style.maxWidth = '100%';
      win.style.maxHeight = '100%';
      win.style.boxShadow = 'none';
      win.style.borderRadius = '0';
      win.style.border = 'none';
      win.style.flex = '1';
    }
    const body = overlayEl.querySelector<HTMLElement>('.retro-window-body');
    if (body) {
      body.style.flex = '1';
      body.style.minHeight = '0';
      body.style.overflowY = 'auto';
    }
  }

  public unmount(): void {
    const overlayEl = this.modal.rootElement;
    this.modal.close();
    if (overlayEl && this.container && overlayEl.parentElement === this.container) {
      this.container.removeChild(overlayEl);
      overlayEl.style.position = '';
      overlayEl.style.inset = '';
      overlayEl.style.width = '';
      overlayEl.style.height = '';
      overlayEl.style.backgroundColor = '';
      overlayEl.style.backdropFilter = '';
      overlayEl.style.zIndex = '';
      overlayEl.style.display = '';
      overlayEl.style.flexDirection = '';
      overlayEl.style.alignItems = '';
      overlayEl.style.justifyContent = '';
      overlayEl.style.boxSizing = '';
      document.getElementById('app')?.appendChild(overlayEl);
    }
    this.container = null;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    // Suppress wrapped modal's internal close-on-hotkey/Escape so CharacterMenuModal owns shell lifecycle
    if (e.key === 'Escape' || e.code === 'KeyP') {
      return false;
    }
    return this.modal.handleKeyDown(e);
  }
}

/**
 * Wraps SpellbookModal as a MenuTab.
 */
export class SpellbookTabAdapter implements MenuTab {
  public readonly id = 'spellbook';
  public readonly label = 'Spellbook';
  public readonly hotkeyActionId = 'cast_spell';
  private modal: SpellbookModal;
  private container: HTMLElement | null = null;

  constructor(modal: SpellbookModal) {
    this.modal = modal;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.modal.mount(container);
    const modalContainer = this.modal.rootElement;
    if (modalContainer) {
      modalContainer.style.position = 'relative';
      modalContainer.style.inset = 'auto';
      modalContainer.style.width = '100%';
      modalContainer.style.height = '100%';
      modalContainer.style.backgroundColor = 'transparent';
      modalContainer.style.backdropFilter = 'none';
      modalContainer.style.zIndex = 'auto';
      modalContainer.style.display = 'flex';
      modalContainer.style.flexDirection = 'column';
      modalContainer.style.alignItems = 'stretch';
      modalContainer.style.justifyContent = 'stretch';
      modalContainer.style.boxSizing = 'border-box';
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine);
    this.scaleToFit();
  }

  private scaleToFit(): void {
    const modalContainer = this.modal.rootElement;
    if (!modalContainer) return;
    const dialog = modalContainer.firstElementChild as HTMLElement | null;
    if (dialog) {
      dialog.style.width = '100%';
      dialog.style.height = '100%';
      dialog.style.maxWidth = '100%';
      dialog.style.maxHeight = '100%';
      dialog.style.boxShadow = 'none';
      dialog.style.borderRadius = '0';
      dialog.style.border = 'none';
      dialog.style.flex = '1';
    }
  }

  public unmount(): void {
    const modalContainer = this.modal.rootElement;
    this.modal.close();
    if (modalContainer && this.container && modalContainer.parentElement === this.container) {
      this.container.removeChild(modalContainer);
      modalContainer.style.position = '';
      modalContainer.style.inset = '';
      modalContainer.style.width = '';
      modalContainer.style.height = '';
      modalContainer.style.backgroundColor = '';
      modalContainer.style.backdropFilter = '';
      modalContainer.style.zIndex = '';
      modalContainer.style.display = '';
      modalContainer.style.flexDirection = '';
      modalContainer.style.alignItems = '';
      modalContainer.style.justifyContent = '';
      modalContainer.style.boxSizing = '';
      document.getElementById('app')?.appendChild(modalContainer);
    }
    this.container = null;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    // Suppress wrapped modal's internal close-on-hotkey/Escape so CharacterMenuModal owns shell lifecycle
    if (e.key === 'Escape' || e.code === 'KeyZ') {
      return false;
    }
    return this.modal.handleKeyDown(e);
  }
}
