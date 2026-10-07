import {
  GameEngine,
  MovementAction,
  WaitAction,
  OpenDoorAction,
  CloseDoorAction,
  getAdjacentOpenDoors,
  PickUpAction,
  QuickLootAction,
  SearchAction,
  DisarmTrapAction,
  ClimbStairsAction,
  DrinkPotionAction,
  ReadScrollAction,
  PotionItem,
  ScrollItem,
  ChannelRuneOfReturnAction,
  AutoRestManager,
  type Action,
  flightRecorder,
} from '../engine';
import { runAndExplain } from '../ui/actionFeedback';
import type { AutoRestRunner } from '../ui/autoRestRunner';
import type { NavigationController } from '../ui/navigation';
import type { TargetingOverlay } from './targeting-overlay';
import type { ShopDialog } from '../ui/shop/shopDialog';
import type { InspectOverlay } from './inspect-overlay';
import type { MapOverlay } from './map-overlay';
import type { ContextHelp, OpenFlag } from '../ui/help/contextHelp';
import type { CommandPalette } from '../ui/help/commandPalette';
import type { RuneOfReturnDiscoveryModal } from '../ui/runeOfReturnDiscoveryModal';
import type { CharacterMenuModal } from '../ui/characterMenu/characterMenuModal';
import { ModalStackManager } from '../ui/modalStack';
import { SettingsManager } from '../ui/settings/settingsManager';
import type { RadialMenuSlotConfig } from '../ui/settings/settingsManager';
import { ChordBuffer } from '../ui/input/chordBuffer';
import type { RadialMenuOverlay, RadialDirection } from './radialMenu';

function isUpKey(code: string): boolean {
  return code === 'ArrowUp' || code === 'KeyW' || code === 'KeyK' || code === 'Numpad8';
}

function isDownKey(code: string): boolean {
  return code === 'ArrowDown' || code === 'KeyS' || code === 'KeyJ' || code === 'Numpad2';
}

function isLeftKey(code: string): boolean {
  return code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyH' || code === 'Numpad4';
}

function isRightKey(code: string): boolean {
  return code === 'ArrowRight' || code === 'KeyD' || code === 'KeyL' || code === 'Numpad6';
}

function getDirectDiagonal(code: string): RadialDirection | null {
  switch (code) {
    case 'Numpad7': case 'KeyY': return 'NW';
    case 'Numpad9': case 'KeyU': return 'NE';
    case 'Numpad1': case 'KeyB': return 'SW';
    case 'Numpad3': case 'KeyN': return 'SE';
    default: return null;
  }
}

export function resolveRadialDirection(heldKeys: Set<string>, latestCode?: string): RadialDirection | null {
  if (latestCode) {
    const direct = getDirectDiagonal(latestCode);
    if (direct) return direct;
  }
  for (const k of heldKeys) {
    const direct = getDirectDiagonal(k);
    if (direct) return direct;
  }

  let hasUp = false;
  let hasDown = false;
  let hasLeft = false;
  let hasRight = false;

  for (const k of heldKeys) {
    if (isUpKey(k)) hasUp = true;
    if (isDownKey(k)) hasDown = true;
    if (isLeftKey(k)) hasLeft = true;
    if (isRightKey(k)) hasRight = true;
  }

  let vertical: 'up' | 'down' | null = null;
  if (hasUp && hasDown) {
    if (latestCode && isUpKey(latestCode)) vertical = 'up';
    else if (latestCode && isDownKey(latestCode)) vertical = 'down';
    else vertical = null;
  } else if (hasUp) {
    vertical = 'up';
  } else if (hasDown) {
    vertical = 'down';
  }

  let horizontal: 'left' | 'right' | null = null;
  if (hasLeft && hasRight) {
    if (latestCode && isLeftKey(latestCode)) horizontal = 'left';
    else if (latestCode && isRightKey(latestCode)) horizontal = 'right';
    else horizontal = null;
  } else if (hasLeft) {
    horizontal = 'left';
  } else if (hasRight) {
    horizontal = 'right';
  }

  if (vertical === 'up' && horizontal === 'right') return 'NE';
  if (vertical === 'up' && horizontal === 'left') return 'NW';
  if (vertical === 'down' && horizontal === 'right') return 'SE';
  if (vertical === 'down' && horizontal === 'left') return 'SW';
  if (vertical === 'up') return 'N';
  if (vertical === 'down') return 'S';
  if (horizontal === 'right') return 'E';
  if (horizontal === 'left') return 'W';

  return null;
}

/** The move each arrow chords for in `ChordBuffer`, which reads the arrows' own directions. */
const ARROW_MOVES: Readonly<Record<string, string>> = {
  ArrowUp: 'move_n',
  ArrowDown: 'move_s',
  ArrowLeft: 'move_w',
  ArrowRight: 'move_e',
};

function isTextEntryTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

export class InputHandler {
  private engine: GameEngine;
  private onActionProcessed: () => void;
  public readonly modalStack: ModalStackManager;
  public readonly settingsManager: SettingsManager;
  public readonly chordBuffer: ChordBuffer;
  public targetingOverlay?: TargetingOverlay;
  private _shopOverlay?: ShopDialog;
  public get shopOverlay(): ShopDialog | undefined {
    return this._shopOverlay;
  }
  public set shopOverlay(overlay: ShopDialog | undefined) {
    this._shopOverlay = overlay;
    if (overlay) {
      this.bindShopOverlay(overlay);
    }
  }
  public inspectOverlay?: InspectOverlay;
  public mapOverlay?: MapOverlay;
  public contextHelp?: ContextHelp;
  public commandPalette?: CommandPalette;
  /** Opens the Rune of Return ranks (on the Character tab); wired from main.ts. */
  public onOpenRuneTree?: () => void;
  public runeOfReturnDiscoveryModal?: RuneOfReturnDiscoveryModal;
  public characterMenuModal?: CharacterMenuModal;
  public radialMenuOverlay?: RadialMenuOverlay;
  public onSaveAndExit?: () => void;
  public onToggleDiagnostics?: () => void;
  public onToggleFeedback?: () => void;
  public onTriggerQuickSpell?: (slotIndex: number) => void;
  /** Opens or closes the command palette; wired from main.ts. */
  public onToggleCommandPalette?: () => void;
  /** Runs the console's context action; wired from main.ts. */
  public onContextAction?: () => void;
  /** Drinks the potion in a potion-row slot (0-based); wired from main.ts. */
  public onDrinkPotionSlot?: (slotIndex: number) => void;
  /** The companion keys: call it (or send it away), or have it use its skill. */
  public onCompanionCommand?: (command: 'call' | 'skill') => void;
  /** Opens the log's history (Shift+M by default). */
  public onOpenMessageLog?: () => void;
  /** Casts a spell by ID (as opposed to a QuickSpellsBar slot index) — wired from main.ts's castOrTargetSpell. */
  public onCastSpellById?: (spellId: string) => void;
  public enabled = true;
  /** Effect batches holding input (`holdInput`); gameplay keys wait while any does. */
  private inputHolds = 0;
  public pendingCloseDoorDirection = false;

  /** While effects play, gameplay keys are ignored (§4). True while any batch holds input. */
  public get isInputLocked(): boolean {
    return this.inputHolds > 0;
  }

  /** `false` releases every hold (a new run, the diagnostics' "clear lock"); `true` takes one. */
  public set isInputLocked(locked: boolean) {
    this.inputHolds = locked ? Math.max(1, this.inputHolds) : 0;
  }

  /**
   * Holds input for one batch of effects and returns its release, which frees only that
   * hold: overlapping batches (a rest step's volley while the last one still flies) no
   * longer unlock each other early (R-rend-9). Calling the release twice does nothing.
   */
  public holdInput(): () => void {
    this.inputHolds++;
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      this.inputHolds = Math.max(0, this.inputHolds - 1);
    };
  }
  public autoRestRunner?: AutoRestRunner;
  public navigationController?: NavigationController;
  private radialHeldKeys = new Set<string>();

  private boundKeyDownHandler?: (e: KeyboardEvent) => void;
  private boundKeyUpHandler?: (e: KeyboardEvent) => void;
  private boundBlurHandler?: () => void;

  constructor(
    engine: GameEngine,
    onActionProcessed: () => void,
    onSaveAndExit?: () => void,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopDialog,
    onToggleDiagnostics?: () => void,
    inspectOverlay?: InspectOverlay,
    contextHelp?: ContextHelp,
    commandPalette?: CommandPalette,
    mapOverlay?: MapOverlay,
    settingsManager?: SettingsManager,
    radialMenuOverlay?: RadialMenuOverlay
  ) {
    this.engine = engine;
    this.onActionProcessed = onActionProcessed;
    this.radialMenuOverlay = radialMenuOverlay;
    this.modalStack = new ModalStackManager((paused) => {
      this.engine.setPaused(paused);
    });
    this.settingsManager = settingsManager ?? new SettingsManager();
    this.chordBuffer = new ChordBuffer({
      onMove: (dx, dy) => {
        if (!this.enabled || this.isInputLocked) return;
        this.engine.handlePlayerAction(new MovementAction(this.engine.player, dx, dy));
        this.onActionProcessed();
      },
      isEnabled: () => this.settingsManager.getSettings().arrowChordingEnabled,
      getBufferMs: () => this.settingsManager.getSettings().arrowChordBufferMs,
    });
    this.onSaveAndExit = onSaveAndExit;
    this.targetingOverlay = targetingOverlay;
    this.shopOverlay = shopOverlay;
    this.onToggleDiagnostics = onToggleDiagnostics;
    this.inspectOverlay = inspectOverlay;
    this.contextHelp = contextHelp;
    this.commandPalette = commandPalette;
    this.mapOverlay = mapOverlay;
    this.init();
  }

  public setEngine(engine: GameEngine): void {
    this.engine = engine;
  }

  /**
   * Forgets everything the last run left in the handler, for a new run on the same one:
   * the effect lock, keys held when it ended (a keyup lost to a game over), a held radial
   * key, a "Close which door?" prompt, and a rest or travel still under way (R-main-6, R-rend-3).
   */
  public reset(): void {
    this.clearInputLock();
    this.radialHeldKeys.clear();
    this.pendingCloseDoorDirection = false;
    this.autoRestRunner?.cancel();
    this.navigationController?.cancel();
  }

  private bindShopOverlay(overlay: ShopDialog): void {
    const self = this;
    const origOpen = overlay.onOpen;
    overlay.onOpen = (npc) => {
      if (origOpen) origOpen(npc);
      self.modalStack.push({
        id: 'shop',
        get isOpen() { return self.shopOverlay?.isOpen ?? false; },
        set isOpen(val: boolean) { if (!val) self.shopOverlay?.close(); },
        handleKeyDown: (ke: KeyboardEvent) => {
          if (!self.shopOverlay?.isOpen) return false;
          return self.shopOverlay.handleKeyDown(ke, self.engine);
        },
        close: () => { self.shopOverlay?.close(); },
        focusRoot: () => self.shopOverlay?.root ?? null,
      });
    };
    const origClose = overlay.onClose;
    overlay.onClose = () => {
      if (origClose) origClose();
      self.modalStack.remove('shop');
    };
  }

  public handleKeyUp(e: KeyboardEvent): void {
    // A released key is released even while input is off (the game-over screen came up
    // with the finger still down), or it stays "held" into the next run's chords.
    this.chordBuffer.handleKeyUp(e.code);
    this.radialHeldKeys.delete(e.code);
    if (!this.enabled) return;
    // Radial menu confirms on release of the same key that opened it (hold-to-open).
    if (this.radialMenuOverlay?.isOpen && this.settingsManager.getActionForCode(e.code) === 'radial_menu') {
      this.radialHeldKeys.clear();
      this.confirmRadialMenu();
    }
  }

  private init(): void {
    this.boundKeyDownHandler = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      this.handleKeyDown(e);
    };
    this.boundKeyUpHandler = (e: KeyboardEvent) => {
      this.handleKeyUp(e);
    };
    this.boundBlurHandler = () => {
      this.chordBuffer.clearAllKeys();
      this.radialHeldKeys.clear();
      if (this.radialMenuOverlay?.isOpen) {
        this.radialMenuOverlay.close();
        this.modalStack.remove('radial-menu');
        // Repaint, or the closed wheel stays drawn until the next render (R-rend-15).
        this.onActionProcessed();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDownHandler);
      window.addEventListener('keyup', this.boundKeyUpHandler);
      window.addEventListener('blur', this.boundBlurHandler);
    }
  }

  public destroy(): void {
    this.enabled = false;
    this.radialHeldKeys.clear();
    this.chordBuffer.destroy();
    if (typeof window !== 'undefined') {
      if (this.boundKeyDownHandler) {
        window.removeEventListener('keydown', this.boundKeyDownHandler);
      }
      if (this.boundKeyUpHandler) {
        window.removeEventListener('keyup', this.boundKeyUpHandler);
      }
      if (this.boundBlurHandler) {
        window.removeEventListener('blur', this.boundBlurHandler);
      }
    }
  }

  public cleanup(): void {
    this.destroy();
  }

  /** Opens the F1 help card for the current context, on the modal stack (§6). */
  public openContextHelp(): void {
    const help = this.contextHelp;
    if (!help || help.isOpen) return;
    // Every way the card closes (its X button too) takes its entry off the stack, or the
    // engine stays paused and HUD clicks take free turns (R-ui-1).
    help.open(this.engine, this.inventoryFlag, this.targetingOverlay, this.shopOverlay, this.inspectOverlay, this.mapOverlay, () =>
      this.modalStack.remove('context_help')
    );
    this.modalStack.push({
      id: 'context_help',
      get isOpen() { return help.isOpen; },
      set isOpen(val: boolean) { if (!val) help.close(); },
      handleKeyDown: (ke: KeyboardEvent) => {
        if (ke.code === 'F1' || ke.code === 'Escape' || (ke.code === 'Slash' && !ke.shiftKey)) {
          help.close();
          this.modalStack.remove('context_help');
          return true;
        }
        return false;
      },
      close: () => { help.close(); },
    });
  }

  public toggleCharacterMenu(tabId: string = 'character'): void {
    if (!this.characterMenuModal) return;
    if (this.characterMenuModal.isOpen && this.characterMenuModal.activeTabId === tabId) {
      this.characterMenuModal.close();
      this.modalStack.remove(this.characterMenuModal.id);
    } else {
      this.characterMenuModal.open(tabId);
      this.modalStack.push(this.characterMenuModal);
    }
    this.onActionProcessed();
  }

  /** Whether the character menu is open on the inventory, for the context help. */
  private get inventoryFlag(): OpenFlag {
    return { isOpen: Boolean(this.characterMenuModal?.isOpen && this.characterMenuModal.activeTabId === 'inventory') };
  }

  /** The inventory is the character menu's first tab. */
  public toggleInventory(): void {
    this.toggleCharacterMenu('inventory');
  }

  public clearInputLock(): void {
    this.isInputLocked = false;
    this.chordBuffer.clearAllKeys();
  }

  /** Resolves the currently-hovered radial-menu slot, executes it, and closes the menu. */
  public confirmRadialMenu(): void {
    const overlay = this.radialMenuOverlay;
    if (!overlay) return;
    this.radialHeldKeys.clear();
    const slot = overlay.getSelectedSlot();
    overlay.close();
    this.modalStack.remove('radial-menu');
    if (slot) {
      this.executeRadialSlot(slot);
    }
    this.onActionProcessed();
  }

  private executeRadialSlot(slot: RadialMenuSlotConfig): void {
    switch (slot.type) {
      case 'spell': {
        this.onCastSpellById?.(slot.spellId);
        return;
      }
      case 'command': {
        const command = this.commandPalette?.getCommand(slot.commandId);
        command?.execute(this.engine);
        return;
      }
      case 'item': {
        const player = this.engine.player;
        const item = player.inventory.findItemById(slot.itemId);
        if (!item) return;
        if (item instanceof PotionItem) {
          this.engine.handlePlayerAction(new DrinkPotionAction(player, item));
        } else if (item instanceof ScrollItem) {
          // Self-targeted use only — aimed scrolls (e.g. targeted teleport) need a
          // reticle and aren't a fit for direct radial-menu activation in this pass.
          this.engine.handlePlayerAction(new ReadScrollAction(player, item, player.x, player.y));
        }
        return;
      }
    }
  }

  /** Called with each game key before it is handled (the freeze guard persists state here). */
  public onBeforeInput?: (code: string) => void;

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    const code = e.code;
    // Repeats too: a held key acts on each one (a step down the corridor), and the record a
    // hang leaves must reach the step that hung. A persist costs well under a millisecond.
    if (!isTextEntryTarget(e.target)) this.onBeforeInput?.(code || e.key);

    // Typing in a text field (bug-report form, save-code box, ...) belongs to that field:
    // no hotkeys, no movement, and no preventDefault — which had swallowed Space and the
    // caret arrows. Escape still reaches the top modal so the form can be dismissed.
    if (isTextEntryTarget(e.target)) {
      return code === 'Escape' && !this.modalStack.isEmpty() ? this.modalStack.handleKeyDown(e) : false;
    }

    // The game's own function keys are never the browser's: F1 opened the browser's Help
    // tab, F3 its find bar, and / Firefox's quick find, over the game (R-rend-5). Even while
    // effects lock input, the key must not fall through to the browser.
    if (code === 'F1' || code === 'F2' || code === 'F3' || code === 'Slash' || code === 'Backquote') {
      e.preventDefault();
    }

    // Global Developer Diagnostic overlay toggle: 'F2' or Backquote (`) / Tilde (~)
    // Checked before isInputLocked so testers can always summon diagnostics during animation freezes
    if (code === 'F2' || code === 'Backquote' || e.key === '`' || e.key === '~') {
      flightRecorder.recordInput(code, 'ToggleDiagnostics');
      if (this.onToggleDiagnostics) {
        this.onToggleDiagnostics();
        return true;
      }
    }

    // Global Feedback & Bug Report overlay toggle: 'F3'
    if (code === 'F3') {
      flightRecorder.recordInput(code, 'ToggleFeedback');
      if (this.onToggleFeedback) {
        this.onToggleFeedback();
        return true;
      }
    }

    // Ctrl, Alt and Meta chords belong to the browser and the system: Ctrl+F found text and
    // ran the context action, Ctrl+R reloaded after a rest, Alt+Left stepped west before
    // going back (R-rend-12). The command palette's Ctrl/Cmd+K is the one chord the game owns.
    const paletteChord = code === 'KeyK' && (e.ctrlKey || e.metaKey);
    if ((e.ctrlKey || e.altKey || e.metaKey) && !paletteChord) {
      return false;
    }

    // Navigation keys never scroll the page or press the HUD button that has focus. This
    // runs before the lock: a Space dropped during effect playback still clicked that
    // button on keyup (R-rend-10).
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'Enter',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        'Numpad8',
        'Numpad2',
        'Numpad4',
        'Numpad6',
        'Numpad7',
        'Numpad9',
        'Numpad1',
        'Numpad3',
        'Numpad5',
      ].includes(code)
    ) {
      e.preventDefault();
    }

    // During active visual effect playback, lock player turn actions while preserving modal responsiveness
    if (this.isInputLocked) {
      if (!this.modalStack.isEmpty()) {
        return this.modalStack.handleKeyDown(e);
      }
      return false;
    }

    // Configurable Radial Action Menu (docs/architecture/simulation-and-input.md): while open, directional
    // keys (arrows/WASD/vi/numpad) select a wedge instead of moving, Escape cancels,
    // and every other key is consumed so gameplay input can't leak through mid-selection.
    if (this.radialMenuOverlay?.isOpen) {
      if (code === 'Escape') {
        this.radialHeldKeys.clear();
        this.radialMenuOverlay.close();
        this.modalStack.remove('radial-menu');
        this.onActionProcessed();
        return true;
      }
      this.radialHeldKeys.add(code);
      const direction = resolveRadialDirection(this.radialHeldKeys, code);
      if (direction) {
        this.radialMenuOverlay.setHoveredDirection(direction);
        this.onActionProcessed();
      }
      return true;
    }

    // Interruption check for active Auto-Rest or Click-to-Move navigation
    if (this.autoRestRunner?.active) {
      this.autoRestRunner.cancel('Rest interrupted by keypress.');
      this.onActionProcessed();
      return true;
    }

    if (this.navigationController?.isNavigating) {
      this.navigationController.cancel('Navigation halted by keypress.');
      this.onActionProcessed();
    }

    // Command palette: Ctrl+K / Cmd+K or Shift+/ ("?"), as the Help card and the header
    // button advertise. It opens only over the map (or closes itself when on top).
    if (paletteChord || (code === 'Slash' && e.shiftKey)) {
      const top = this.modalStack.top();
      if (this.onToggleCommandPalette && (!top || top.id === 'command-palette')) {
        e.preventDefault();
        this.onToggleCommandPalette();
        return true;
      }
    }

    // Hotkey: Smart F1 Context Help (F1 or Slash) - can be opened globally over any active modal
    if (code === 'F1' || (code === 'Slash' && !e.shiftKey)) {
      if (this.contextHelp) {
        if (this.contextHelp.isOpen) {
          this.contextHelp.close();
          this.modalStack.remove('context_help');
        } else {
          this.openContextHelp();
        }
        return true;
      }
    }

    // 0. Centralized LIFO Modal Stack routing: if any modal is open on the stack, route exclusively to top
    if (!this.modalStack.isEmpty()) {
      const handled = this.modalStack.handleKeyDown(e);
      if (handled) {
        this.onActionProcessed();
        return true;
      }
    }

    // 0.05. An open map owns the keyboard (§6): it closes on M/Esc/Space, pages floors,
    // and absorbs everything else, so no key reaches the simulation underneath it.
    if (this.mapOverlay?.isOpen) {
      this.mapOverlay.handleKeyDown(e, this.engine);
      this.onActionProcessed();
      return true;
    }

    // 0.1. Direction Prompt for Smart-Close Door
    if (this.pendingCloseDoorDirection) {
      if (code === 'Escape') {
        this.pendingCloseDoorDirection = false;
        this.engine.log('Cancelled door close.');
        this.onActionProcessed();
        return true;
      }
      let dx = 0;
      let dy = 0;
      let isDirection = false;
      switch (code) {
        case 'ArrowUp': case 'KeyW': case 'KeyK': case 'Numpad8': dx = 0; dy = -1; isDirection = true; break;
        case 'ArrowDown': case 'KeyS': case 'KeyJ': case 'Numpad2': dx = 0; dy = 1; isDirection = true; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyH': case 'Numpad4': dx = -1; dy = 0; isDirection = true; break;
        case 'ArrowRight': case 'KeyD': case 'KeyL': case 'Numpad6': dx = 1; dy = 0; isDirection = true; break;
        case 'Numpad7': case 'KeyY': dx = -1; dy = -1; isDirection = true; break;
        case 'Numpad9': case 'KeyU': dx = 1; dy = -1; isDirection = true; break;
        case 'Numpad1': case 'KeyB': dx = -1; dy = 1; isDirection = true; break;
        case 'Numpad3': case 'KeyN': dx = 1; dy = 1; isDirection = true; break;
      }
      if (isDirection) {
        this.pendingCloseDoorDirection = false;
        const p = this.engine.player;
        const targetX = p.x + dx;
        const targetY = p.y + dy;
        this.engine.handlePlayerAction(new CloseDoorAction(p, targetX, targetY));
        this.onActionProcessed();
        return true;
      }
      return true; // absorb other keys while waiting for direction
    }

    // Hotkey: Slayer's Compendium / Bestiary (KeyB when not inspecting)
    if (code === 'KeyB' && !this.inspectOverlay?.isOpen && this.characterMenuModal) {
      this.toggleCharacterMenu('bestiary');
      return true;
    }

    // Hotkey: Ancient Run Pacts & Bounties (KeyP when not inspecting). Hard-wired keys are
    // positional (`code`), like every binding: matching the typed letter too made the key
    // that types 'p' on Colemak (QWERTY R) open Pacts instead of resting (R-rend-11).
    if (code === 'KeyP' && !this.inspectOverlay?.isOpen && this.characterMenuModal) {
      this.toggleCharacterMenu('pacts');
      return true;
    }

    // Hotkey: U spends level points, which happens on the Character tab (ADR-0011).
    if (code === 'KeyU' && !this.inspectOverlay?.isOpen && this.characterMenuModal) {
      this.toggleCharacterMenu('character');
      return true;
    }

    // 0.3. Handle Shop / Town Service modal if open
    if (this.shopOverlay?.isOpen) {
      const handled = this.shopOverlay.handleKeyDown(e, this.engine);
      if (handled) {
        this.onActionProcessed();
        return true;
      }
    }

    // 0.5. Handle Look / Inspect Mode if open
    if (this.inspectOverlay?.isOpen) {
      if (code === 'Escape' || code === 'KeyX' || code === 'KeyL') {
        this.inspectOverlay.close();
        this.onActionProcessed();
        return true;
      }

      let rdx = 0;
      let rdy = 0;
      let isMove = false;

      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyK':
        case 'Numpad8':
          rdy = -1;
          isMove = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
        case 'KeyJ':
        case 'Numpad2':
          rdy = 1;
          isMove = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyH':
        case 'Numpad4':
          rdx = -1;
          isMove = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
        case 'Numpad6':
          rdx = 1;
          isMove = true;
          break;
        case 'Numpad7':
        case 'KeyY':
          rdx = -1;
          rdy = -1;
          isMove = true;
          break;
        case 'Numpad9':
        case 'KeyU':
          rdx = 1;
          rdy = -1;
          isMove = true;
          break;
        case 'Numpad1':
        case 'KeyB':
          rdx = -1;
          rdy = 1;
          isMove = true;
          break;
        case 'Numpad3':
        case 'KeyN':
          rdx = 1;
          rdy = 1;
          isMove = true;
          break;
      }

      if (isMove) {
        this.inspectOverlay.moveCursor(rdx, rdy, this.engine);
        this.onActionProcessed();
        return true;
      }

      // Absorb all other keys during Inspect Mode without advancing ticks
      return true;
    }

    // 1. Handle Targeting / Spellbook Mode if open
    if (this.targetingOverlay?.isOpen) {
      const handled = this.targetingOverlay.handleKeyDown(e, this.engine);
      if (handled) {
        this.onActionProcessed();
        return true;
      }
      return true; // absorb other keys during targeting to prevent leakage
    }

    const p = this.engine.player;

    // Toggle Look / Inspect Mode: 'KeyX' or 'KeyL'
    if (code === 'KeyX' || code === 'KeyL') {
      if (this.targetingOverlay?.isOpen) {
        this.targetingOverlay.close();
      }
      this.inspectOverlay?.open(this.engine);
      this.onActionProcessed();
      return true;
    }

    // Toggle Spellbook / Cast Spell Mode: 'KeyZ'
    if (code === 'KeyZ' && this.characterMenuModal) {
      this.toggleCharacterMenu('spellbook');
      return true;
    }

    // Context action (F by default): whatever the console's context button offers here.
    if (this.settingsManager.getActionForCode(e.shiftKey ? `Shift+${code}` : code) === 'context_action' && this.onContextAction) {
      this.onContextAction();
      this.onActionProcessed();
      return true;
    }

    // Potion row (Shift+1..4 by default). Checked before the bare-digit spell keys
    // below, which would otherwise take Shift+1 as spell slot 1.
    const boundAction = this.settingsManager.getActionForCode(e.shiftKey ? `Shift+${code}` : code);
    if (boundAction?.startsWith('drink_potion_') && this.onDrinkPotionSlot) {
      const slotIdx = parseInt(boundAction.replace('drink_potion_', ''), 10) - 1;
      this.onDrinkPotionSlot(slotIdx);
      this.onActionProcessed();
      return true;
    }

    // Companion (Shift+C calls or sends it away, Shift+R its skill, by default). Checked
    // before the hard-wired C and R below, which would otherwise take the shifted keys.
    if ((boundAction === 'companion_call' || boundAction === 'companion_skill') && this.onCompanionCommand) {
      this.onCompanionCommand(boundAction === 'companion_call' ? 'call' : 'skill');
      this.onActionProcessed();
      return true;
    }

    // The log's history (Shift+M by default), checked before the hard-wired M below.
    if (boundAction === 'message_log' && this.onOpenMessageLog) {
      this.onOpenMessageLog();
      return true;
    }

    // Quick-Access Spells Bar: Digit1 - Digit0 (0-9 on top number row)
    // CRITICAL: Must not intercept Numpad1 - Numpad9 which are directional movement keys
    if (code.startsWith('Digit') && !code.startsWith('Numpad')) {
      const digit = parseInt(code.replace('Digit', ''), 10);
      if (!isNaN(digit)) {
        const slotIdx = digit === 0 ? 9 : digit - 1;
        if (this.onTriggerQuickSpell) {
          this.onTriggerQuickSpell(slotIdx);
          this.onActionProcessed();
          return true;
        }
      }
    }

    // Close Door Action: 'KeyC' (Smart-Close targeting)
    if (code === 'KeyC') {
      this.smartCloseDoor();
      return true;
    }

    // Search Action (detect traps and secret doors): 'KeyS'
    if (code === 'KeyS') {
      const searchAction = new SearchAction(p, this.engine.rng);
      this.engine.handlePlayerAction(searchAction);
      this.onActionProcessed();
      return true;
    }

    // Toggle Explored Map Overlay: 'KeyM'
    if (code === 'KeyM') {
      if (this.targetingOverlay?.isOpen) {
        this.targetingOverlay.close();
      }
      if (this.inspectOverlay?.isOpen) {
        this.inspectOverlay.close();
      }
      if (this.mapOverlay) {
        this.mapOverlay.toggle(this.engine);
        this.onActionProcessed();
        return true;
      }
    }

    // Toggle inventory overlay
    if (code === 'KeyI') {
      this.toggleInventory();
      return true;
    }

    // Escape in play opens Save & Exit.
    if (code === 'Escape' && this.onSaveAndExit) {
      this.onSaveAndExit();
      return true;
    }

    // Save & Return to Title hotkey: 'KeyQ'
    if (code === 'KeyQ') {
      if (this.onSaveAndExit) {
        this.onSaveAndExit();
        return true;
      }
    }

    // Climb Stairs: '>' (Shift+Period) or Enter while standing on stairs. Not '<': Settings
    // gives Shift+Comma to Quick-Loot, which this branch used to take first.
    const standingTile = this.engine.map.getTile(p.x, p.y);
    const onStairs = standingTile?.isStairsDown || standingTile?.isStairsUp || standingTile?.type === 'stairs_down' || standingTile?.type === 'stairs_up';
    if (e.key === '>' || (e.shiftKey && code === 'Period') || (code === 'Enter' && onStairs)) {
      runAndExplain(this.engine, new ClimbStairsAction(p));
      this.onActionProcessed();
      return true;
    }

    // Ground Loot Pick Up Action: Shift+KeyG / Shift+Comma for Quick-Loot All, or KeyG/Comma for single top item
    if (e.shiftKey && (code === 'KeyG' || code === 'Comma')) {
      const quickLoot = new QuickLootAction(p);
      this.engine.handlePlayerAction(quickLoot);
      this.onActionProcessed();
      return true;
    }

    if (code === 'KeyG' || code === 'Comma') {
      const pickAction = new PickUpAction(p);
      this.engine.handlePlayerAction(pickAction);
      this.onActionProcessed();
      return true;
    }

    // Check SettingsManager dynamic action mapping (including Shift chords)
    const effectiveCode = e.shiftKey ? `Shift+${code}` : code;
    const userAction = this.settingsManager.getActionForCode(effectiveCode) ?? this.settingsManager.getActionForCode(code);
    if (userAction === 'character_menu' || code === 'KeyE') {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('character');
        return true;
      }
    }
    if (userAction === 'compendium') {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('bestiary');
        return true;
      }
    }
    if (userAction === 'pact') {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('pacts');
        return true;
      }
    }
    if (userAction === 'story' && this.characterMenuModal) {
      this.toggleCharacterMenu('story');
      return true;
    }
    if (userAction === 'inventory') {
      this.toggleInventory();
      return true;
    }
    if (userAction === 'cast_spell' && this.characterMenuModal) {
      this.toggleCharacterMenu('spellbook');
      return true;
    }
    if (userAction?.startsWith('quick_spell_')) {
      const slotNum = parseInt(userAction.replace('quick_spell_', ''), 10);
      const slotIdx = slotNum === 0 ? 9 : slotNum - 1;
      if (this.onTriggerQuickSpell) {
        this.onTriggerQuickSpell(slotIdx);
        this.onActionProcessed();
        return true;
      }
    }
    if (userAction === 'map') {
      if (this.targetingOverlay?.isOpen) this.targetingOverlay.close();
      if (this.inspectOverlay?.isOpen) this.inspectOverlay.close();
      if (this.mapOverlay) {
        this.mapOverlay.toggle(this.engine);
        this.onActionProcessed();
        return true;
      }
    }
    if (userAction === 'inspect') {
      if (this.targetingOverlay?.isOpen) this.targetingOverlay.close();
      this.inspectOverlay?.open(this.engine);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'stairs') {
      runAndExplain(this.engine, new ClimbStairsAction(p));
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'pickup') {
      const pickAction = new PickUpAction(p);
      this.engine.handlePlayerAction(pickAction);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'quick_loot') {
      const quickLoot = new QuickLootAction(p);
      this.engine.handlePlayerAction(quickLoot);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'search') {
      const searchAction = new SearchAction(p, this.engine.rng);
      this.engine.handlePlayerAction(searchAction);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'radial_menu' && !e.repeat && this.radialMenuOverlay) {
      // Nothing in the game fills a slot yet: a wheel of eight empty wedges is no menu (R-rend-15).
      if (!this.radialMenuOverlay.slots.some((slot) => slot !== null)) {
        this.engine.log('The radial menu is empty.');
        this.onActionProcessed();
        return true;
      }
      const self = this;
      this.radialHeldKeys.clear();
      this.radialMenuOverlay.open();
      this.modalStack.push({
        id: 'radial-menu',
        get isOpen() { return self.radialMenuOverlay?.isOpen ?? false; },
        set isOpen(val: boolean) { if (!val) self.radialMenuOverlay?.close(); },
        // Directional selection and Escape are handled directly at the top of
        // InputHandler.handleKeyDown (before this modal-stack dispatch is ever
        // reached), so this modal only needs to exist for pause/LIFO bookkeeping.
        handleKeyDown: () => true,
        close: () => { self.radialMenuOverlay?.close(); },
      });
      this.onActionProcessed();
      return true;
    }
    // R (or wherever `rest` is bound): the one rest, a turn at a time (AutoRestManager).
    if (userAction === 'rest') {
      if (this.autoRestRunner) {
        this.autoRestRunner.start({
          onStep: () => this.onActionProcessed(),
          onComplete: () => this.onActionProcessed(),
        });
      } else {
        AutoRestManager.executeFullRest(this.engine);
      }
      this.onActionProcessed();
      return true;
    }
    // Any other key the player gives Smart Close Door (R-rend-14: only C had a handler).
    if (userAction === 'close_door') {
      this.smartCloseDoor();
      return true;
    }
    if (userAction === 'disarm_trap') {
      this.engine.handlePlayerAction(new DisarmTrapAction(p));
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'channel_rune_of_return') {
      runAndExplain(this.engine, new ChannelRuneOfReturnAction(p));
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'rune_of_return_tree') {
      this.onOpenRuneTree?.();
      this.onActionProcessed();
      return true;
    }

    // Arrow keys: routed through ChordBuffer (micro-debounce chording or immediate standard
    // mode) while bound to their own direction; unbound or rebound, Settings decide below.
    if (ChordBuffer.isArrowKey(code) && this.settingsManager.getActionForCode(code) === ARROW_MOVES[code]) {
      this.chordBuffer.handleKeyDown(code, e.repeat);
      return true;
    }

    const action = this.createActionFromKey(code);
    if (!action) {
      return false;
    }

    // If movement action while inventory is open, close inventory

    this.engine.handlePlayerAction(action);
    this.onActionProcessed();
    return true;
  }

  /** Smart Close Door: the one open door beside the hero, else asks which, else says none. */
  private smartCloseDoor(): void {
    const p = this.engine.player;
    const openDoors = getAdjacentOpenDoors(this.engine.map, p.x, p.y);
    if (openDoors.length === 0) {
      this.engine.log('No open door nearby.');
    } else if (openDoors.length === 1) {
      this.engine.handlePlayerAction(new CloseDoorAction(p, openDoors[0].x, openDoors[0].y));
    } else {
      this.pendingCloseDoorDirection = true;
      this.engine.log('Close which door? [Direction]');
    }
    this.onActionProcessed();
  }

  private createActionFromKey(code: string): Action | null {
    const p = this.engine.player;

    let dx = 0;
    let dy = 0;
    let isMovement = false;

    // The player's bindings alone decide: a key unbound in Settings does nothing. A legacy
    // table and a switch of the default keys used to answer it anyway (R-rend-13).
    const boundActionId = this.settingsManager.getActionForCode(code);
    if (boundActionId) {
      switch (boundActionId) {
        case 'move_n': dx = 0; dy = -1; isMovement = true; break;
        case 'move_s': dx = 0; dy = 1; isMovement = true; break;
        case 'move_w': dx = -1; dy = 0; isMovement = true; break;
        case 'move_e': dx = 1; dy = 0; isMovement = true; break;
        case 'move_nw': dx = -1; dy = -1; isMovement = true; break;
        case 'move_ne': dx = 1; dy = -1; isMovement = true; break;
        case 'move_sw': dx = -1; dy = 1; isMovement = true; break;
        case 'move_se': dx = 1; dy = 1; isMovement = true; break;
        case 'wait': return new WaitAction(p);
        case 'search': return new SearchAction(p, this.engine.rng, 2);
        case 'pickup': return new PickUpAction(p);
        case 'quick_loot': return new QuickLootAction(p);
        case 'stairs': return new ClimbStairsAction(p);
      }
    }

    if (isMovement) {
      const targetX = p.x + dx;
      const targetY = p.y + dy;

      // If moving directly into a closed door, automatically dispatch OpenDoorAction
      const targetTile = this.engine.map.getTile(targetX, targetY);
      if (targetTile && (targetTile.isClosedDoor || targetTile.type === 'door_closed')) {
        return new OpenDoorAction(p, targetX, targetY);
      }

      return new MovementAction(p, dx, dy);
    }

    return null;
  }
}
