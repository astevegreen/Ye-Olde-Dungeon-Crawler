import type { GameState } from '../flanks/types';

export interface MenuTab {
  id: string;
  label: string;
  /** ACTION_METADATA id whose keybind opens the shell focused on this tab. */
  hotkeyActionId?: string;
  mount(container: HTMLElement): void;
  /** Called every time this tab becomes the active one. Pull fresh state here. */
  onActivate(state: GameState): void;
  unmount(): void;
  /** The tab uses Tab itself (the inventory steps between its panels). The shell offers
   *  it Tab first and cycles tabs only when the tab declines, e.g. past its last panel. */
  claimsTabKey?: boolean;
  /** Return true if the key was consumed; the shell handles only what you decline. */
  handleKeyDown(e: KeyboardEvent): boolean;
}
