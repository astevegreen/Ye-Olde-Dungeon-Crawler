import type { GameState } from '../flanks/types';
import type { MenuTab } from './menuTab';
import type { CompendiumModal } from '../help/compendiumModal';
import type { PactModal } from '../pactModal';
import type { SpellbookModal } from '../spellbookModal';

/**
 * Hands an embedded modal's root back to `#app`, hidden. The modal's own `close()` cannot be
 * trusted to re-hide it: a modal closed from its own Done button is already closed when the
 * shell unmounts the tab, so its `close()` returns early — and the inline styles cleared
 * here include the `display: none` it set, leaving a full-screen window stranded over the game.
 */
function releaseEmbeddedRoot(root: HTMLElement | null, container: HTMLElement | null): void {
  if (!root) return;
  if (container && root.parentElement === container) {
    container.removeChild(root);
  }
  root.style.position = '';
  root.style.inset = '';
  root.style.width = '';
  root.style.height = '';
  root.style.backgroundColor = '';
  root.style.backdropFilter = '';
  root.style.zIndex = '';
  root.style.flexDirection = '';
  root.style.alignItems = '';
  root.style.justifyContent = '';
  root.style.boxSizing = '';
  document.getElementById('app')?.appendChild(root);
  root.style.display = 'none';
}

/**
 * Wraps CompendiumModal as a MenuTab.
 */
export class CompendiumTabAdapter implements MenuTab {
  public readonly id = 'bestiary';
  public readonly label = 'Bestiary';
  public readonly hotkeyActionId = 'compendium';
  private modal: CompendiumModal;
  private container: HTMLElement | null = null;
  private onDismiss?: () => void;
  private unmounting = false;

  constructor(modal: CompendiumModal, onDismiss?: () => void) {
    this.modal = modal;
    this.onDismiss = onDismiss;
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
      if (!this.unmounting) {
        this.onDismiss?.();
      }
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
    this.unmounting = true;
    try {
      releaseEmbeddedRoot(this.modal.rootElement, this.container);
      this.modal.close();
    } finally {
      this.unmounting = false;
      this.container = null;
    }
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
  private onDismiss?: () => void;
  private unmounting = false;

  constructor(modal: PactModal, onDismiss?: () => void) {
    this.modal = modal;
    this.onDismiss = onDismiss;
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
      if (!this.unmounting) {
        this.onDismiss?.();
      }
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
    this.unmounting = true;
    try {
      releaseEmbeddedRoot(this.modal.rootElement, this.container);
      this.modal.close();
    } finally {
      this.unmounting = false;
      this.container = null;
    }
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
  private onDismiss?: () => void;
  private unmounting = false;

  constructor(modal: SpellbookModal, onDismiss?: () => void) {
    this.modal = modal;
    this.onDismiss = onDismiss;
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
    this.modal.open(state.engine, () => {
      if (!this.unmounting) {
        this.onDismiss?.();
      }
    });
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
    this.unmounting = true;
    try {
      releaseEmbeddedRoot(this.modal.rootElement, this.container);
      this.modal.close();
    } finally {
      this.unmounting = false;
      this.container = null;
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    // Suppress wrapped modal's internal close-on-hotkey/Escape so CharacterMenuModal owns shell lifecycle
    if (e.key === 'Escape' || e.code === 'KeyZ') {
      return false;
    }
    return this.modal.handleKeyDown(e);
  }
}
