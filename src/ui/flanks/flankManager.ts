import type { FlankModule, GameState } from './types';
import type { GameContentManifest } from '../../engine/types/manifest';

/**
 * FlankManager coordinates the lifecycle of side flank modules mounted into
 * the widescreen flanks layout.
 */
export class FlankManager {
  private registry = new Map<string, FlankModule>();
  private mountedModules: FlankModule[] = [];
  private leftContainer: HTMLElement | null = null;
  private rightContainer: HTMLElement | null = null;
  private currentManifest?: GameContentManifest;

  public registerModule(module: FlankModule): void {
    this.registry.set(module.id, module);
  }

  public getModule(id: string): FlankModule | undefined {
    return this.registry.get(id);
  }

  public getMountedModules(): readonly FlankModule[] {
    return this.mountedModules;
  }

  public get manifest(): GameContentManifest | undefined {
    return this.currentManifest;
  }

  /**
   * Mounts flank modules into the provided left and right DOM containers based on
   * manifest.flankLayout configuration (or sensible defaults).
   */
  public mount(
    leftContainer: HTMLElement | null,
    rightContainer: HTMLElement | null,
    manifest?: GameContentManifest
  ): void {
    this.destroy();

    this.leftContainer = leftContainer;
    this.rightContainer = rightContainer;
    this.currentManifest = manifest;

    const layout = manifest?.flankLayout;
    const leftModuleIds = layout?.left ?? ['world_ledger'];
    const rightModuleIds = layout?.right ?? ['auto_journal'];
    const theme = layout?.theme ?? 'parchment';

    if (this.leftContainer) {
      this.leftContainer.innerHTML = '';
      this.leftContainer.className = `flank-column flank-left flank-theme-${theme}`;
      for (const id of leftModuleIds) {
        const mod = this.registry.get(id);
        if (mod) {
          const slot = document.createElement('section');
          slot.className = `flank-module flank-module-${id}`;
          this.leftContainer.appendChild(slot);
          mod.mount(slot);
          this.mountedModules.push(mod);
        }
      }
    }

    if (this.rightContainer) {
      this.rightContainer.innerHTML = '';
      this.rightContainer.className = `flank-column flank-right flank-theme-${theme}`;
      for (const id of rightModuleIds) {
        const mod = this.registry.get(id);
        if (mod) {
          const slot = document.createElement('section');
          slot.className = `flank-module flank-module-${id}`;
          this.rightContainer.appendChild(slot);
          mod.mount(slot);
          this.mountedModules.push(mod);
        }
      }
    }
  }

  /**
   * Reactive state update tick. Dispatches state to all mounted modules.
   * Catches errors locally so UI flank issues cannot disrupt engine ticks.
   */
  public render(state: GameState): void {
    for (const mod of this.mountedModules) {
      try {
        mod.render(state);
      } catch (err) {
        console.error(`[FlankManager] Error rendering module '${mod.id}':`, err);
      }
    }
  }

  /**
   * Teardown all mounted modules and clear DOM containers.
   */
  public destroy(): void {
    for (const mod of this.mountedModules) {
      try {
        mod.destroy?.();
      } catch (err) {
        console.error(`[FlankManager] Error destroying module '${mod.id}':`, err);
      }
    }
    this.mountedModules = [];
    if (this.leftContainer) {
      this.leftContainer.innerHTML = '';
    }
    if (this.rightContainer) {
      this.rightContainer.innerHTML = '';
    }
  }
}
