import {
  GameEngine,
  MovementAction,
  WaitAction,
  OpenDoorAction,
  CloseDoorAction,
  getAdjacentOpenDoors,
  PickUpAction,
  QuickLootAction,
  RestAction,
  SearchAction,
  DisarmTrapAction,
  ClimbStairsAction,
  DrinkPotionAction,
  ReadScrollAction,
  PotionItem,
  ScrollItem,
  ChannelRuneOfReturnAction,
  type Action,
  flightRecorder,
} from '../engine';
import { KeybindingManager } from '../ui/settings/keybindingManager';
import type { AutoRestRunner } from '../ui/autoRestRunner';
import type { NavigationController } from '../ui/navigation';
import type { InventoryOverlay } from './inventory-overlay';
import type { TargetingOverlay } from './targeting-overlay';
import type { ShopOverlay } from './shop-overlay';
import type { InspectOverlay } from './inspect-overlay';
import type { MapOverlay } from './map-overlay';
import type { ContextHelp } from '../ui/help/contextHelp';
import type { CompendiumModal } from '../ui/help/compendiumModal';
import type { CommandPalette } from '../ui/help/commandPalette';
import type { PactModal } from '../ui/pactModal';
import type { LevelUpModal } from '../ui/levelUpModal';
import type { RuneOfReturnTreeModal } from '../ui/runeOfReturnTreeModal';
import type { RuneOfReturnDiscoveryModal } from '../ui/runeOfReturnDiscoveryModal';
import type { CharacterMenuModal } from '../ui/characterMenu/characterMenuModal';
import { ModalStackManager } from '../ui/modalStack';
import { SettingsManager } from '../ui/settings/settingsManager';
import type { RadialMenuSlotConfig } from '../ui/settings/settingsManager';
import { ChordBuffer } from '../ui/input/chordBuffer';
import type { RadialMenuOverlay, RadialDirection } from './radialMenu';

function resolveCompassDirection(code: string): RadialDirection | null {
  switch (code) {
    case 'ArrowUp': case 'KeyW': case 'KeyK': case 'Numpad8': return 'N';
    case 'ArrowDown': case 'KeyS': case 'KeyJ': case 'Numpad2': return 'S';
    case 'ArrowLeft': case 'KeyA': case 'KeyH': case 'Numpad4': return 'W';
    case 'ArrowRight': case 'KeyD': case 'KeyL': case 'Numpad6': return 'E';
    case 'Numpad7': case 'KeyY': return 'NW';
    case 'Numpad9': case 'KeyU': return 'NE';
    case 'Numpad1': case 'KeyB': return 'SW';
    case 'Numpad3': case 'KeyN': return 'SE';
    default: return null;
  }
}

export class InputHandler {
  private engine: GameEngine;
  private onActionProcessed: () => void;
  public readonly modalStack: ModalStackManager;
  public readonly keybindings: KeybindingManager;
  public readonly settingsManager: SettingsManager;
  public readonly chordBuffer: ChordBuffer;
  public inventoryOverlay?: InventoryOverlay;
  public targetingOverlay?: TargetingOverlay;
  private _shopOverlay?: ShopOverlay;
  public get shopOverlay(): ShopOverlay | undefined {
    return this._shopOverlay;
  }
  public set shopOverlay(overlay: ShopOverlay | undefined) {
    this._shopOverlay = overlay;
    if (overlay) {
      this.bindShopOverlay(overlay);
    }
  }
  public inspectOverlay?: InspectOverlay;
  public mapOverlay?: MapOverlay;
  public contextHelp?: ContextHelp;
  public compendiumModal?: CompendiumModal;
  public commandPalette?: CommandPalette;
  public pactModal?: PactModal;
  public levelUpModal?: LevelUpModal;
  public runeOfReturnTreeModal?: RuneOfReturnTreeModal;
  public runeOfReturnDiscoveryModal?: RuneOfReturnDiscoveryModal;
  public characterMenuModal?: CharacterMenuModal;
  public radialMenuOverlay?: RadialMenuOverlay;
  public onSaveAndExit?: () => void;
  public onToggleDiagnostics?: () => void;
  public onTriggerQuickSpell?: (slotIndex: number) => void;
  public onOpenSpellbook?: () => void;
  /** Casts a spell by ID (as opposed to a QuickSpellsBar slot index) — wired from main.ts's castOrTargetSpell. */
  public onCastSpellById?: (spellId: string) => void;
  public enabled = true;
  public isInputLocked = false;
  public pendingCloseDoorDirection = false;
  public autoRestRunner?: AutoRestRunner;
  public navigationController?: NavigationController;

  private boundKeyDownHandler?: (e: KeyboardEvent) => void;
  private boundKeyUpHandler?: (e: KeyboardEvent) => void;
  private boundBlurHandler?: () => void;

  constructor(
    engine: GameEngine,
    onActionProcessed: () => void,
    inventoryOverlay?: InventoryOverlay,
    onSaveAndExit?: () => void,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopOverlay,
    onToggleDiagnostics?: () => void,
    inspectOverlay?: InspectOverlay,
    contextHelp?: ContextHelp,
    compendiumModal?: CompendiumModal,
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
    this.keybindings = new KeybindingManager();
    this.settingsManager = settingsManager ?? new SettingsManager();
    this.chordBuffer = new ChordBuffer({
      onMove: (dx, dy) => {
        if (!this.enabled || this.isInputLocked) return;
        if (this.inventoryOverlay?.isOpen) {
          this.inventoryOverlay.close();
        }
        this.engine.handlePlayerAction(new MovementAction(this.engine.player, dx, dy));
        this.onActionProcessed();
      },
      isEnabled: () => this.settingsManager.getSettings().arrowChordingEnabled,
      getBufferMs: () => this.settingsManager.getSettings().arrowChordBufferMs,
    });
    this.inventoryOverlay = inventoryOverlay;
    if (this.inventoryOverlay) {
      this.inventoryOverlay.onClose = () => {
        this.modalStack.remove('inventory');
      };
    }
    this.onSaveAndExit = onSaveAndExit;
    this.targetingOverlay = targetingOverlay;
    this.shopOverlay = shopOverlay;
    this.onToggleDiagnostics = onToggleDiagnostics;
    this.inspectOverlay = inspectOverlay;
    this.contextHelp = contextHelp;
    this.compendiumModal = compendiumModal;
    this.commandPalette = commandPalette;
    this.mapOverlay = mapOverlay;
    this.init();
  }

  public setEngine(engine: GameEngine): void {
    this.engine = engine;
  }

  private bindShopOverlay(overlay: ShopOverlay): void {
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
      });
    };
    const origClose = overlay.onClose;
    overlay.onClose = () => {
      if (origClose) origClose();
      self.modalStack.remove('shop');
    };
  }

  private init(): void {
    this.boundKeyDownHandler = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      this.handleKeyDown(e);
    };
    this.boundKeyUpHandler = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      this.chordBuffer.handleKeyUp(e.code);
      // Radial menu confirms on release of the same key that opened it (hold-to-open).
      if (this.radialMenuOverlay?.isOpen && this.settingsManager.getActionForCode(e.code) === 'radial_menu') {
        this.confirmRadialMenu();
      }
    };
    this.boundBlurHandler = () => {
      this.chordBuffer.clearAllKeys();
      if (this.radialMenuOverlay?.isOpen) {
        this.radialMenuOverlay.close();
        this.modalStack.remove('radial-menu');
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

  public toggleInventory(): void {
    if (this.characterMenuModal) {
      this.toggleCharacterMenu('inventory');
      return;
    }
    if (!this.inventoryOverlay) return;
    this.inventoryOverlay.toggle(this.engine);
    if (this.inventoryOverlay.isOpen) {
      this.modalStack.push(this.inventoryOverlay);
    } else {
      this.modalStack.remove('inventory');
    }
    this.onActionProcessed();
  }

  public clearInputLock(): void {
    this.isInputLocked = false;
    this.chordBuffer.clearAllKeys();
  }

  /** Opens/closes Ancient Run Pacts & Bounties, registering it on the modal stack the
   * same way `toggleInventory()` does — shared by the `[P]` keybind and the bottom-bar
   * button so both stay in sync with the modal stack. */
  public togglePactModal(): void {
    if (this.characterMenuModal) {
      this.toggleCharacterMenu('pacts');
      return;
    }
    if (!this.pactModal) return;
    this.pactModal.toggle(this.engine);
    if (this.pactModal.isOpen) {
      const self = this;
      this.modalStack.push({
        id: 'pact-modal',
        get isOpen() { return self.pactModal?.isOpen ?? false; },
        set isOpen(val: boolean) { if (!val) self.pactModal?.close(); },
        handleKeyDown: (ke: KeyboardEvent) => {
          const h = self.pactModal?.handleKeyDown(ke) ?? false;
          if (!self.pactModal?.isOpen) {
            self.modalStack.remove('pact-modal');
          }
          return h;
        },
        close: () => { self.pactModal?.close(); },
      });
    } else {
      this.modalStack.remove('pact-modal');
    }
  }

  /** Opens/closes Rune of Return Mastery Tree modal, registering it on the modal stack. */
  public toggleRuneOfReturnTreeModal(): void {
    if (!this.runeOfReturnTreeModal) return;
    this.runeOfReturnTreeModal.setModalStack(this.modalStack);
    this.runeOfReturnTreeModal.toggle(this.engine);
    if (this.runeOfReturnTreeModal.isOpen) {
      this.modalStack.push(this.runeOfReturnTreeModal);
    } else {
      this.modalStack.remove(this.runeOfReturnTreeModal.id);
    }
  }

  /** Resolves the currently-hovered radial-menu slot, executes it, and closes the menu. */
  public confirmRadialMenu(): void {
    const overlay = this.radialMenuOverlay;
    if (!overlay) return;
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

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    const code = e.code;

    // Global Developer Diagnostic overlay toggle: 'F2' or Backquote (`) / Tilde (~)
    // Checked before isInputLocked so testers can always summon diagnostics during animation freezes
    if (code === 'F2' || code === 'Backquote' || e.key === '`' || e.key === '~') {
      flightRecorder.recordInput(code, 'ToggleDiagnostics');
      if (this.onToggleDiagnostics) {
        this.onToggleDiagnostics();
        return true;
      }
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
        this.radialMenuOverlay.close();
        this.modalStack.remove('radial-menu');
        this.onActionProcessed();
        return true;
      }
      const direction = resolveCompassDirection(code);
      if (direction) {
        this.radialMenuOverlay.setHoveredDirection(direction);
        this.onActionProcessed();
      }
      return true;
    }

    // Prevent default scrolling on navigation keys
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

    // Hotkey: Smart F1 Context Help (F1 or Slash) - can be opened globally over any active modal
    if (code === 'F1' || (code === 'Slash' && !e.shiftKey)) {
      if (this.contextHelp) {
        this.contextHelp.toggle(
          this.engine,
          this.inventoryOverlay,
          this.targetingOverlay,
          this.shopOverlay,
          this.inspectOverlay,
          this.mapOverlay
        );
        if (this.contextHelp.isOpen) {
          const self = this;
          this.modalStack.push({
            id: 'context_help',
            get isOpen() { return self.contextHelp?.isOpen ?? false; },
            set isOpen(val: boolean) { if (!val) self.contextHelp?.close(); },
            handleKeyDown: (ke: KeyboardEvent) => {
              if (ke.code === 'F1' || ke.code === 'Escape' || (ke.code === 'Slash' && !ke.shiftKey)) {
                self.contextHelp?.close();
                self.modalStack.remove('context_help');
                return true;
              }
              return false;
            },
            close: () => { self.contextHelp?.close(); },
          });
        } else {
          this.modalStack.remove('context_help');
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
    if (code === 'KeyB' && !this.inspectOverlay?.isOpen) {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('bestiary');
        return true;
      }
      if (this.compendiumModal) {
        this.compendiumModal.toggle(this.engine);
        if (this.compendiumModal.isOpen) {
          this.modalStack.push(this.compendiumModal);
        } else {
          this.modalStack.remove('compendium');
        }
        return true;
      }
    }

    // Hotkey: Ancient Run Pacts & Bounties (KeyP when not inspecting)
    if ((code === 'KeyP' || e.key === 'p' || e.key === 'P') && !this.inspectOverlay?.isOpen) {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('pacts');
        return true;
      }
      if (this.pactModal) {
        this.togglePactModal();
        this.onActionProcessed();
        return true;
      }
    }

    // Hotkey: Level-Up Attribute Allocation (KeyU when not inspecting)
    if ((code === 'KeyU' || e.key === 'u' || e.key === 'U') && !this.inspectOverlay?.isOpen) {
      if (this.levelUpModal) {
        this.levelUpModal.setModalStack(this.modalStack);
        this.levelUpModal.toggle(this.engine);
        if (this.levelUpModal.isOpen) {
          this.modalStack.push(this.levelUpModal);
        } else {
          this.modalStack.remove(this.levelUpModal.id);
        }
        this.onActionProcessed();
        return true;
      }
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
      if (
        code === 'Escape' ||
        code === 'KeyX' ||
        code === 'KeyL' ||
        e.key === 'Escape' ||
        e.key === 'x' ||
        e.key === 'X' ||
        e.key === 'l' ||
        e.key === 'L'
      ) {
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
    if (
      code === 'KeyX' ||
      code === 'KeyL' ||
      e.key === 'x' ||
      e.key === 'X' ||
      e.key === 'l' ||
      e.key === 'L'
    ) {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      if (this.targetingOverlay?.isOpen) {
        this.targetingOverlay.close();
      }
      this.inspectOverlay?.open(this.engine);
      this.onActionProcessed();
      return true;
    }

    // Toggle Spellbook / Cast Spell Mode: 'KeyZ'
    if (code === 'KeyZ') {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('spellbook');
        return true;
      }
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      if (this.onOpenSpellbook) {
        this.onOpenSpellbook();
        this.onActionProcessed();
        return true;
      }
      this.targetingOverlay?.openSpellbook(this.engine);
      this.onActionProcessed();
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
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      const openDoors = getAdjacentOpenDoors(this.engine.map, p.x, p.y);
      if (openDoors.length === 0) {
        this.engine.log('No open door nearby.');
        this.onActionProcessed();
        return true;
      }
      if (openDoors.length === 1) {
        this.engine.handlePlayerAction(new CloseDoorAction(p, openDoors[0].x, openDoors[0].y));
        this.onActionProcessed();
        return true;
      }
      this.pendingCloseDoorDirection = true;
      this.engine.log('Close which door? [Direction]');
      this.onActionProcessed();
      return true;
    }

    // Rest Action: 'KeyR'
    if (code === 'KeyR') {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      const restAction = new RestAction(p);
      this.engine.handlePlayerAction(restAction);
      this.onActionProcessed();
      return true;
    }

    // Search Action (detect traps and secret doors): 'KeyS'
    if (code === 'KeyS') {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      const searchAction = new SearchAction(p, this.engine.rng);
      this.engine.handlePlayerAction(searchAction);
      this.onActionProcessed();
      return true;
    }

    // Toggle Explored Map Overlay: 'KeyM'
    if (code === 'KeyM') {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
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

    // Close inventory with Escape or trigger Save & Exit
    if (code === 'Escape') {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
        this.onActionProcessed();
        return true;
      } else if (this.onSaveAndExit) {
        this.onSaveAndExit();
        return true;
      }
    }

    // Save & Return to Title hotkey: 'KeyQ'
    if (code === 'KeyQ') {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      if (this.onSaveAndExit) {
        this.onSaveAndExit();
        return true;
      }
    }

    // Climb Stairs: '>' or '<' (or Shift+Period / Shift+Comma) or Enter while standing on stairs
    const standingTile = this.engine.map.getTile(p.x, p.y);
    const onStairs = standingTile?.isStairsDown || standingTile?.isStairsUp || standingTile?.type === 'stairs_down' || standingTile?.type === 'stairs_up';
    if (
      e.key === '>' ||
      e.key === '<' ||
      (e.shiftKey && (code === 'Period' || code === 'Comma')) ||
      (code === 'Enter' && onStairs)
    ) {
      const stairAction = new ClimbStairsAction(p);
      this.engine.handlePlayerAction(stairAction);
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

    // When inventory overlay is open, handle keyboard navigation and actions
    if (this.inventoryOverlay?.isOpen) {
      if (this.inventoryOverlay.handleKeyDown(code, this.engine)) {
        this.onActionProcessed();
        return true;
      }
    }

    // Rest Hotkey (KeyR): Launch AutoRestRunner if available, else static RestAction
    if (code === 'KeyR') {
      if (this.autoRestRunner) {
        this.autoRestRunner.start({
          onStep: () => this.onActionProcessed(),
          onComplete: () => this.onActionProcessed(),
        });
        return true;
      }
      const rest = new RestAction(p);
      this.engine.handlePlayerAction(rest);
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
    if (userAction === 'inventory') {
      this.toggleInventory();
      return true;
    }
    if (userAction === 'cast_spell') {
      if (this.characterMenuModal) {
        this.toggleCharacterMenu('spellbook');
        return true;
      }
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      if (this.onOpenSpellbook) {
        this.onOpenSpellbook();
        this.onActionProcessed();
        return true;
      }
      this.targetingOverlay?.openSpellbook(this.engine);
      this.onActionProcessed();
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
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      if (this.targetingOverlay?.isOpen) this.targetingOverlay.close();
      if (this.inspectOverlay?.isOpen) this.inspectOverlay.close();
      if (this.mapOverlay) {
        this.mapOverlay.toggle(this.engine);
        this.onActionProcessed();
        return true;
      }
    }
    if (userAction === 'inspect') {
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      if (this.targetingOverlay?.isOpen) this.targetingOverlay.close();
      this.inspectOverlay?.open(this.engine);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'stairs') {
      const stairAction = new ClimbStairsAction(p);
      this.engine.handlePlayerAction(stairAction);
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
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      const searchAction = new SearchAction(p, this.engine.rng);
      this.engine.handlePlayerAction(searchAction);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'radial_menu' && !e.repeat && this.radialMenuOverlay) {
      const self = this;
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
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
    if (userAction === 'rest') {
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      if (this.autoRestRunner) {
        this.autoRestRunner.start({
          onStep: () => this.onActionProcessed(),
          onComplete: () => this.onActionProcessed(),
        });
        return true;
      }
      const restAction = new RestAction(p);
      this.engine.handlePlayerAction(restAction);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'channel_rune_of_return') {
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      const channelAction = new ChannelRuneOfReturnAction(p);
      this.engine.handlePlayerAction(channelAction);
      this.onActionProcessed();
      return true;
    }
    if (userAction === 'rune_of_return_tree') {
      if (this.inventoryOverlay?.isOpen) this.inventoryOverlay.close();
      this.toggleRuneOfReturnTreeModal();
      this.onActionProcessed();
      return true;
    }

    // Arrow keys: routed through ChordBuffer (micro-debounce chording or immediate standard mode)
    if (ChordBuffer.isArrowKey(code)) {
      if (this.inventoryOverlay?.isOpen) {
        this.inventoryOverlay.close();
      }
      this.chordBuffer.handleKeyDown(code, e.repeat);
      return true;
    }

    const action = this.createActionFromKey(code);
    if (!action) {
      return false;
    }

    // If movement action while inventory is open, close inventory
    if (this.inventoryOverlay?.isOpen) {
      this.inventoryOverlay.close();
    }

    this.engine.handlePlayerAction(action);
    this.onActionProcessed();
    return true;
  }

  private createActionFromKey(code: string): Action | null {
    const p = this.engine.player;

    let dx = 0;
    let dy = 0;
    let isMovement = false;

    // 1. Check custom user settings remapper
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
        case 'rest': return new RestAction(p);
        case 'pickup': return new PickUpAction(p);
        case 'quick_loot': return new QuickLootAction(p);
        case 'stairs': return new ClimbStairsAction(p);
      }
    }

    const binding = this.keybindings.get(code);
    if (binding) {
      if (binding.actionId === 'move' && binding.args) {
        dx = binding.args.dx;
        dy = binding.args.dy;
        isMovement = true;
      } else if (binding.actionId === 'wait') {
        return new WaitAction(p);
      } else if (binding.actionId === 'interact' && binding.args?.interactionType === 'search') {
        return new SearchAction(p, this.engine.rng, 2);
      }
    }

    if (!isMovement) {
      switch (code) {
      // Cardinal Directions
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyK':
      case 'Numpad8':
        dx = 0;
        dy = -1;
        isMovement = true;
        break;

      case 'ArrowDown':
      case 'KeyJ':
      case 'Numpad2':
        dx = 0;
        dy = 1;
        isMovement = true;
        break;

      case 'ArrowLeft':
      case 'KeyA':
      case 'KeyH':
      case 'Numpad4':
        dx = -1;
        dy = 0;
        isMovement = true;
        break;

      case 'ArrowRight':
      case 'KeyD':
      case 'KeyL':
      case 'Numpad6':
        dx = 1;
        dy = 0;
        isMovement = true;
        break;

      // Diagonals (Numpad + Vi Keys)
      case 'Numpad7':
      case 'KeyY':
        dx = -1;
        dy = -1;
        isMovement = true;
        break;

      case 'Numpad9':
      case 'KeyU':
        dx = 1;
        dy = -1;
        isMovement = true;
        break;

      case 'Numpad1':
      case 'KeyB':
        dx = -1;
        dy = 1;
        isMovement = true;
        break;

      case 'Numpad3':
      case 'KeyN':
        dx = 1;
        dy = 1;
        isMovement = true;
        break;

      // Wait a Turn
      case 'Numpad5':
      case 'Period':
      case 'Space':
        return new WaitAction(p);

      // Active Search (KeyS)
      case 'KeyS':
        return new SearchAction(p, this.engine.rng, 2);

      // Disarm Trap (KeyT)
      case 'KeyT':
        return new DisarmTrapAction(p);

      default:
        return null;
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
