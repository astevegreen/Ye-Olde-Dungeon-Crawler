import type { GameState } from './gameState';

/** One footer hint: the keys, then what they do ("S D C I" — "plan a point"). */
export interface MenuKeyHint {
  keys: string[];
  label: string;
}

/** A footer button. The primary one is the tab's main action and takes Enter's chip. */
export interface MenuAction {
  id: string;
  label: string;
  /** Key chip drawn inside the button, e.g. "Enter". */
  key?: string;
  primary?: boolean;
  disabled?: boolean;
  run(): void;
}

/**
 * What a tab puts in the shell's footer. The shell adds its own Tab and Esc hints after
 * `keys`; a tab only says what Esc means there when it is more than "close".
 */
export interface MenuFooter {
  keys?: MenuKeyHint[];
  escLabel?: string;
  /** A line at the right, for tabs without actions. */
  note?: string;
  actions?: MenuAction[];
}

/** What the shell offers a tab: redraw its badge and footer, or close the whole menu. */
export interface MenuHost {
  refreshChrome(): void;
  close(): void;
}

export interface MenuTab {
  id: string;
  label: string;
  /** The page's material (Q16, Q62): 'codex' for the books of lore (Grimoire, Carved Verses,
   *  Bestiary, Pacts), drawn as the pack's `borderStyle` says; absent, the menus' own. */
  material?: 'codex';
  /** ACTION_METADATA id whose keybind opens the shell focused on this tab. */
  hotkeyActionId?: string;
  mount(container: HTMLElement): void;
  /** Called every time this tab becomes the active one. Pull fresh state here. `entry` is
   *  'backward' when Shift+Tab arrived from the next tab, so a tab with panels starts on its last. */
  onActivate(state: GameState, entry?: 'forward' | 'backward'): void;
  unmount(): void;
  /** The tab uses Tab itself (the inventory steps between its panels). The shell offers
   *  it Tab first and cycles tabs only when the tab declines, e.g. past its last panel. */
  claimsTabKey?: boolean;
  /** Return true if the key was consumed; the shell handles only what you decline. */
  handleKeyDown(e: KeyboardEvent): boolean;
  /** Footer keys and actions while this tab is active. */
  footer?(): MenuFooter;
  /** Short badge beside the tab's label, e.g. "+9" for unspent points; null hides it. */
  badge?(state: GameState): string | null;
  /** Called once when the shell registers the tab. */
  bindHost?(host: MenuHost): void;
}
