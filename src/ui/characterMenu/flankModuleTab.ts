import type { FlankModule, GameState } from '../flanks/types';
import type { MenuTab } from './menuTab';

/**
 * Adapter that maps between MenuTab and one or more FlankModule instances (ARCHITECTURE.md §3).
 * Read-only tabs like Story wrap flank modules; onActivate maps to module.render(state).
 */
export class FlankModuleTab implements MenuTab {
  public readonly id: string;
  public readonly label: string;
  public readonly hotkeyActionId?: string;
  public readonly modules: FlankModule[];
  private container: HTMLElement | null = null;

  constructor(
    modules: FlankModule[],
    id: string = 'story',
    label: string = 'Story',
    hotkeyActionId?: string
  ) {
    this.modules = modules;
    this.id = id;
    this.label = label;
    this.hotkeyActionId = hotkeyActionId;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';

    const layout = document.createElement('div');
    layout.className = 'story-tab-layout';
    layout.style.display = 'flex';
    layout.style.gap = '16px';
    layout.style.height = '100%';
    layout.style.minHeight = '480px';
    layout.style.overflowY = 'auto';
    layout.style.padding = '8px';

    for (const mod of this.modules) {
      const col = document.createElement('div');
      col.className = 'story-tab-col';
      col.setAttribute('data-module-id', mod.id);
      col.style.flex = '1';
      col.style.minWidth = '0';
      layout.appendChild(col);
      mod.mount(col);
    }

    container.appendChild(layout);
  }

  public onActivate(state: GameState): void {
    for (const mod of this.modules) {
      mod.render(state);
    }
  }

  public unmount(): void {
    for (const mod of this.modules) {
      mod.destroy?.();
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public handleKeyDown(_e: KeyboardEvent): boolean {
    // Flank modules are read-only; shell handles Tab/Shift+Tab and Escape
    return false;
  }
}
