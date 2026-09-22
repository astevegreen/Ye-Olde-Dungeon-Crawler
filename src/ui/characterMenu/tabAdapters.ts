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
      if (overlayEl.parentElement !== container) {
        container.appendChild(overlayEl);
      }
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine, () => {
      // No-op while embedded as a tab; CharacterMenuModal owns shell lifecycle
    });
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
      if (overlayEl.parentElement !== container) {
        container.appendChild(overlayEl);
      }
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine, () => {
      // No-op while embedded as a tab; CharacterMenuModal owns shell lifecycle
    });
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
      modalContainer.style.width = '100%';
      modalContainer.style.height = '100%';
      modalContainer.style.backgroundColor = 'transparent';
      modalContainer.style.backdropFilter = 'none';
      modalContainer.style.zIndex = 'auto';
    }
  }

  public onActivate(state: GameState): void {
    this.modal.open(state.engine);
  }

  public unmount(): void {
    const modalContainer = this.modal.rootElement;
    this.modal.close();
    if (modalContainer && this.container && modalContainer.parentElement === this.container) {
      this.container.removeChild(modalContainer);
      modalContainer.style.position = '';
      modalContainer.style.width = '';
      modalContainer.style.height = '';
      modalContainer.style.backgroundColor = '';
      modalContainer.style.backdropFilter = '';
      modalContainer.style.zIndex = '';
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
