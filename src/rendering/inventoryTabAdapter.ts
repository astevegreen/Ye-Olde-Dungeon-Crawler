import type { GameState } from '../ui/flanks/types';
import type { MenuTab } from '../ui/characterMenu/menuTab';
import type { InventoryOverlay } from './inventory-overlay';
import type { CanvasRenderer } from './canvas-renderer';

/**
 * Adapter wrapping the canvas-rendered InventoryOverlay as a MenuTab.
 * Located in src/rendering/ to uphold the engine purity rule (src/ui/ may only import types from src/rendering/).
 */
export class InventoryTabAdapter implements MenuTab {
  public readonly id = 'inventory';
  public readonly label = 'Inventory';
  public readonly hotkeyActionId = 'inventory';
  private overlay: InventoryOverlay;
  private renderer?: CanvasRenderer;
  private unmounting = false;

  /** `onDismiss` closes the hosting menu shell whenever the overlay closes itself — `[I]`,
   * its canvas close button, channeling the Rune — since the shell would otherwise stay
   * up, invisible, trapping every key. Closes the shell causes (unmount) don't count. */
  constructor(overlay: InventoryOverlay, renderer?: CanvasRenderer, onDismiss?: () => void) {
    this.overlay = overlay;
    this.renderer = renderer;
    overlay.addCloseListener(() => {
      if (!this.unmounting) onDismiss?.();
    });
  }

  public mount(container: HTMLElement): void {
    container.innerHTML = '';
  }

  public onActivate(state: GameState): void {
    this.overlay.open(state.engine);
    this.renderer?.render();
  }

  public unmount(): void {
    this.unmounting = true;
    try {
      this.overlay.close();
    } finally {
      this.unmounting = false;
    }
    this.renderer?.render();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    return this.overlay.handleKeyDown(e);
  }
}
