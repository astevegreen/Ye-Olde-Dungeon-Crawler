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
  /** Return true if the key was consumed; the shell handles only what you decline. */
  handleKeyDown(e: KeyboardEvent): boolean;
}
