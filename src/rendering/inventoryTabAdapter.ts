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

  constructor(overlay: InventoryOverlay, renderer?: CanvasRenderer) {
    this.overlay = overlay;
    this.renderer = renderer;
  }

  public mount(container: HTMLElement): void {
    container.innerHTML = '';
  }

  public onActivate(state: GameState): void {
    this.overlay.open(state.engine);
    this.renderer?.render();
  }

  public unmount(): void {
    this.overlay.close();
    this.renderer?.render();
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    return this.overlay.handleKeyDown(e);
  }
}
