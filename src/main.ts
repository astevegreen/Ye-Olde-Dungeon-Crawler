import {
  AttuneGrimoirePageAction,
  ArrangeGrimoireSlotAction,
  GrimoireMatrixManager,
  AutosaveManager,
  type AutosaveSlot,
  canOvercast,
  getAltarDefinition,
  RUNE_OF_RETURN_STATUS,
  PerformAltarRiteAction,
  CastSpellAction,
  ClimbStairsAction,
  CURRENT_SCHEMA_VERSION,
  flightRecorder,
  GameEngine,
  getActiveTitle,
  getRenownTotal,
  resolveManaTerms,
  getSpell,
  Leaderboard,
  ProfileManager,
  QuickLootAction,
  RestAction,
  SageService,
  SearchAction,
  serializeGame,
  WaitAction,
  shouldNotifyPlayer,
  BulkArchive,
  InMemoryAsyncStore,
  hydrateArchivedFloors,
  isTacticalEffect,
  ChannelRuneOfReturnAction,
  loadReplayState,
  replayActionTrail,
  isGameEvent,
  Monster,
  parseCoinItem,
  PotionItem,
  DrinkPotionAction,
  MovementAction,
  PickUpAction,
  CloseDoorAction,
  SAVE_FILE_EXTENSION,
} from './engine';
import type {
  ActionResult,
  CharacterProfile,
  GameEvent,
  SpellDefinition,
  HallOfFameEntry,
  SaveData,
  VersionedSaveEnvelope,
} from './engine';
import { CanvasRenderer } from './rendering/canvas-renderer';
import { InputHandler } from './rendering/input-handler';
import { TitleScreen } from './ui/title-screen';
import { DiagnosticModal } from './ui/diagnostic-modal';
import { FeedbackModal } from './ui/feedbackModal';
import { SagaShareModal } from './ui/sagaShareModal';
import { GameOverDialog } from './ui/gameOverDialog';
import { EndingDialog } from './ui/endingDialog';
import { epitaphHtml } from './ui/epitaph';
import { ContextHelp } from './ui/help/contextHelp';
import { CommandPalette } from './ui/help/commandPalette';
import type { SpellbookEntry } from './rendering/targeting-overlay';
import { applyThemeTokens } from './rendering/theme';
import { installUiIcons } from './rendering/uiIcons';
import { ChoiceModal } from './ui/choiceModal';
import { AltarModal } from './ui/altarModal';
import { MasteryChoiceModal } from './ui/masteryChoiceModal';
import { RuneOfReturnDiscoveryModal } from './ui/runeOfReturnDiscoveryModal';
import { AutoRestRunner } from './ui/autoRestRunner';
import { NavigationController } from './ui/navigation';
import { cotwManifest } from './content/cotw';
import { warcraftManifest } from './content/warcraft';
import { initStoragePersistence } from './ui/persistenceInit';
import { SaveCodeModal } from './ui/saveCodeModal';
import { SaveQuitModal } from './ui/saveQuitModal';
import { SaveSlotModal } from './ui/saveSlotModal';
import { showToast } from './ui/toast';
import { keyLabel } from './ui/keyLabel';
import { expandCompressedReplay } from './ui/replayCodec';
import { SessionGuard } from './ui/sessionGuard';
import { getBrowserAsyncStore } from './ui/indexedDbStore';
import { setupSaveDragAndDrop, importSaveWithValidation } from './ui/saveImporter';
import { defaultPlatformAdapter, getBrowserStorage } from './ui/platform';
import { applyDocumentBranding, resolveBranding } from './ui/branding';
import {
  CharacterMenuModal,
  CharacterTab,
  StoryTab,
  BestiaryTab,
  PactsTab,
  SpellbookTab,
} from './ui/characterMenu';
import { InventoryTab } from './ui/inventory/inventoryTab';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/menu.css';
import './ui/styles/dialog.css';
import './ui/styles/shop.css';
import './ui/styles/inventory.css';
import './ui/styles/icons.css';
import './ui/styles/mapcards.css';
import './ui/styles/title.css';
import './ui/styles/diagnostics.css';
import { QuickSpellsBar } from './ui/quickSpellsBar';
import { PotionRow } from './ui/potionRow';
import { classifyLogLine, CriticalLineTracker } from './ui/logClassifier';
import { CombatSidebar } from './ui/sidebar/combatSidebar';
import { ConsoleExtras } from './ui/console/consoleExtras';
import { FirstTimeHints } from './ui/hints/firstTimeHints';
import { hintsMetByEvent, hintsMetByState } from './ui/hints/hintModel';
import { findActionCues } from './ui/hints/actionCues';
import { ControlsPrimer } from './ui/controlsPrimer';
import { MessageLogModal } from './ui/messageLogModal';
import { OverflowWarning } from './ui/overflowWarning';
import type { ContextAction } from './ui/console/consoleModel';
import { SettingsManager } from './ui/settings/settingsManager';
import type { RadialMenuSlotConfig } from './ui/settings/settingsManager';
import { KeybindModal } from './ui/settings/keybindModal';
import { MainMenu } from './ui/menus/mainMenu';
import { isBenignResizeObserverError, isOpaqueScriptError } from './ui/opaqueScriptError';
import { COMMAND_CATALOG, type CommandId } from './main/commandCatalog';

declare global {
  interface ImportMetaEnv {
    /** Content pack selected at build time (vite.config.ts). */
    readonly VITE_THEME?: string;
    /** package.json version, injected by vite.config.ts. */
    readonly VITE_APP_VERSION?: string;
    /** Short commit hash of the build (with `-dirty` for uncommitted changes), injected by vite.config.ts. */
    readonly VITE_BUILD_ID?: string;
    /** Bug-report relay base URL (relay/), from the REPORT_RELAY_URL build variable; empty when unset. */
    readonly VITE_REPORT_RELAY_URL?: string;
  }
  /** Debug/e2e introspection handles (e2e/campaign-flow.spec.ts reads the engine and input handler). */
  interface Window {
    __cotwEngine?: GameEngine;
    __cotwSaveAndReturn?: () => void;
    __cotwRenderer?: CanvasRenderer | null;
    __cotwInputHandler?: InputHandler | null;
    __cotwInput?: InputHandler | null;
    __teardownGlobalErrorHandlers?: () => void;
  }
}

const targetTheme = import.meta.env.VITE_THEME || 'cotw';
const activeManifest = targetTheme === 'warcraft' ? warcraftManifest : cotwManifest;
const brand = resolveBranding(activeManifest);
// Tokens go on the root before the first paint (module scripts run before DOMContentLoaded).
void applyThemeTokens(activeManifest.theme);
installUiIcons(activeManifest.spriteRecipes);

window.addEventListener('DOMContentLoaded', () => {
  applyDocumentBranding(document, brand);
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Fatal: Canvas element #game-canvas not found.');
    return;
  }

  const profileManager = new ProfileManager(getBrowserStorage() ?? undefined, activeManifest);
  const settingsManager = new SettingsManager();
  let activeEngine: GameEngine | null = null;
  let activeProfile: CharacterProfile | null = null;
  let renderer: CanvasRenderer | null = null;
  let inputHandler: InputHandler | null = null;
  let titleScreen: TitleScreen;
  let mainMenu: MainMenu;

  const widescreenLayout = document.getElementById('widescreen-layout');

  const gameContainer = document.getElementById('game-container');
  const saveTitleBtn = document.getElementById('btn-save-title');
  const feedbackBtn = document.getElementById('btn-feedback');
  const devDiagBtn = document.getElementById('btn-dev-diagnostics');
  const helpBtn = document.getElementById('btn-help-card');
  const compendiumBtn = document.getElementById('btn-compendium');
  const cmdPaletteBtn = document.getElementById('btn-cmd-palette');
  const mapBtn = document.getElementById('btn-map');

  // Bottom HUD bar controls
  const hudInvBtn = document.getElementById('btn-hud-inv');
  const hudCastBtn = document.getElementById('btn-hud-cast');
  const hudLookBtn = document.getElementById('btn-hud-look');
  const hudPactsBtn = document.getElementById('btn-hud-pacts');
  const hudRestBtn = document.getElementById('btn-hud-rest');
  const hudSearchBtn = document.getElementById('btn-hud-search');
  const hudWaitBtn = document.getElementById('btn-hud-wait');
  const hudStairsBtn = document.getElementById('btn-hud-stairs');

  const contextHelp = new ContextHelp();
  const commandPalette = new CommandPalette();
  const choiceModal = new ChoiceModal(() => {
    popModal('choice');
    renderer?.render();
  });
  const altarModal = new AltarModal();
  const runeDiscoveryModal = new RuneOfReturnDiscoveryModal({
    onClose: () => {
      popModal(runeDiscoveryModal.id);
      renderer?.render();
      showPendingMastery();
    },
    onOpenTree: () => {
      openRuneTree();
    },
  });
  const masteryModal = new MasteryChoiceModal(() => {
    popModal(masteryModal.id);
    renderer?.render();
  });
  /** Shows queued mastery-perk choices once no dialog drawn above them (rune discovery) is
   *  open, so the visible window is always the one taking keys. The mastery dialog draws
   *  over the character menu, so a level-up opening it doesn't hold the choice back. */
  const showPendingMastery = (): void => {
    if (!activeEngine || masteryModal.isOpen || !masteryModal.hasPending) return;
    if (runeDiscoveryModal.isOpen) return;
    if (masteryModal.open(activeEngine)) {
      inputHandler?.modalStack.push(masteryModal);
      renderer?.render();
    }
  };
  const autosaveManager = new AutosaveManager(getBrowserStorage() ?? undefined, activeManifest);
  // Detects a session that stopped responding (see src/ui/sessionGuard.ts).
  const sessionGuard = new SessionGuard(getBrowserStorage(), {
    appVersion: import.meta.env.VITE_APP_VERSION,
    buildId: import.meta.env.VITE_BUILD_ID,
  });
  const unfinishedSession = sessionGuard.takeUnfinished();

  let characterMenuModal: CharacterMenuModal;

  // F1 on screens ContextHelp can't see: an altar's rite (or an altar beside the hero), the
  // Story, Spellbook, Bestiary, Character and Pacts tabs, the Rune of Return (its discovery, or a channel under way).
  contextHelp.setScreenContext(() => {
    if (altarModal.isOpen) return 'altar';
    if (runeDiscoveryModal.isOpen) return 'rune';
    if (characterMenuModal?.isOpen && characterMenuModal.activeTabId === 'story') return 'story';
    if (characterMenuModal?.isOpen) {
      const tab = characterMenuModal.activeTabId;
      if (tab === 'spellbook' || tab === 'bestiary' || tab === 'character' || tab === 'pacts') return tab;
    }
    const eng = activeEngine;
    if (!eng?.player) return null;
    if (eng.player.statusManager.getStatus(RUNE_OF_RETURN_STATUS)) return 'rune';
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const handler = eng.map.getTile(eng.player.x + dx, eng.player.y + dy)?.interactionHandlerId;
        if (handler && getAltarDefinition(eng, handler)) return 'altar';
      }
    }
    return null;
  });
  const characterTab = new CharacterTab();
  characterTab.onAllocateCallback = () => {
    updateHeaderInfo();
    if (activeEngine) combatSidebar.update(activeEngine);
    renderer?.render();
  };
  const storyTab = new StoryTab();
  const bestiaryTab = new BestiaryTab();
  const pactsTab = new PactsTab();
  let inventoryTab: InventoryTab;

  // Asynchronous bulk tier (ARCHITECTURE.md §5): IndexedDB in the browser, in-memory when
  // the browser has none, so callers never branch on availability.
  const bulkArchive = new BulkArchive(getBrowserAsyncStore() ?? new InMemoryAsyncStore());
  profileManager.setBulkArchive(bulkArchive);

  /**
   * Loads report why they failed (ARCHITECTURE.md §5). A missing save is routine and stays
   * silent; a corrupt, too-new, or unmigratable save is shown to the player rather than
   * silently falling through to another profile.
   */
  /**
   * Registers a modal on the LIFO stack (ARCHITECTURE.md §6) instead of switching the
   * whole InputHandler off. The stack gives Escape handling, key trapping, and engine
   * pause for free, and keeps nested modals ordered — disabling the handler did none of
   * that and left no record of what was open.
   *
   * Modal classes here predate UIModal and differ in shape (one exposes isOpen as a
   * method), so each is adapted rather than reshaped.
   */
  const pushModal = (
    id: string,
    target: {
      isOpen: boolean | (() => boolean);
      handleKeyDown?: (e: KeyboardEvent) => boolean;
      close: () => void;
    }
  ): void => {
    if (!inputHandler) return;
    const openNow = () => (typeof target.isOpen === 'function' ? target.isOpen() : target.isOpen);
    inputHandler.modalStack.push({
      id,
      get isOpen() {
        return openNow();
      },
      set isOpen(value: boolean) {
        if (!value) target.close();
      },
      handleKeyDown: (e: KeyboardEvent) => (openNow() ? (target.handleKeyDown?.(e) ?? false) : false),
      close: () => target.close(),
    });
  };

  const popModal = (id: string): void => {
    inputHandler?.modalStack.remove(id);
  };

  const loadProfileOrNotify = (profileId: string) => {
    const outcome = profileManager.loadCharacterResult(profileId);
    if (outcome.ok) {
      // Floors live in the async tier (ARCHITECTURE.md §5). Hydrate them after the
      // synchronous load; any that cannot be fetched simply regenerate on revisit.
      void hydrateArchivedFloors(outcome.value.engine, profileId, bulkArchive).catch(() => undefined);
      return outcome.value;
    }
    if (shouldNotifyPlayer(outcome)) showToast(outcome.message, 'error', 6000);
    return null;
  };

  const loadAutosaveOrNotify = (slot: AutosaveSlot = 'latest') => {
    const outcome = autosaveManager.loadAutosaveResult(activeManifest, slot);
    if (outcome.ok) return outcome.value;
    if (shouldNotifyPlayer(outcome)) showToast(outcome.message, 'error', 6000);
    return null;
  };

  let quickSpellsBar: QuickSpellsBar;
  let potionRow: PotionRow;
  let combatSidebar: CombatSidebar;
  let consoleExtras: ConsoleExtras;

  /** Opens the character menu on one tab. The menu is the only home for Spellbook, Bestiary,
   *  Pacts, Story and the allocation UI; none of them opens on its own. */
  function openMenuTab(tabId: string): void {
    if (!activeEngine || !characterMenuModal) return;
    inputHandler?.modalStack.push(characterMenuModal);
    characterMenuModal.open(tabId);
  }

  /** The level-up toast this turn, replaced (not stacked) if more levels arrive in it. */
  let levelUpToast: { turn: number; el: HTMLElement | null } | null = null;

  function showLevelUpToast(engine: GameEngine): void {
    if (levelUpToast?.turn === engine.turnCount) levelUpToast.el?.remove();
    const code = settingsManager.getCodesForAction('character_menu')[0];
    const points = engine.player.unspentStatPoints ?? 0;
    const spend = points > 0 ? ` ${points} point${points === 1 ? '' : 's'} to spend${code ? `: ${keyLabel(code)} opens the Character tab` : ''}.` : '';
    levelUpToast = { turn: engine.turnCount, el: showToast(`Level ${engine.player.level}!${spend}`, 'success', 6000) };
  }

  /** Whether the character menu is open on the inventory, for the context help. */
  function inventoryFlag(): { isOpen: boolean } {
    return { isOpen: Boolean(characterMenuModal?.isOpen && characterMenuModal.activeTabId === 'inventory') };
  }

  function openSpellbook(): void {
    openMenuTab('spellbook');
  }

  /** The Rune of Return ranks live on the Character tab, beside the attributes that spend
   *  the same points: every way into "the rune tree" opens that tab at them. */
  function openRuneTree(): void {
    characterTab.focusRuneSection();
    openMenuTab('character');
  }

  window.addEventListener('open_rune_of_return_tree', () => {
    openRuneTree();
  });

  const overflowWarnings = new OverflowWarning();
  function castOrTargetSpell(spell: SpellDefinition): void {
    if (!activeEngine || !renderer) return;
    // As the cast resolves: its grimoire slot's synergies change the cost, range and area.
    const resolved = GrimoireMatrixManager.resolveCast(activeEngine, activeEngine.player, spell.id);
    const cast = resolved?.spell ?? spell;
    // Packs with mana overflow let a short cast go off into debt (ManaOverflowManager).
    if (!canOvercast(activeEngine) && activeEngine.player.mana < (cast.manaCost ?? 0)) {
      const mana = resolveManaTerms(activeEngine.manifest);
      activeEngine.log(`Not enough ${mana.name} to cast ${spell.name} (${activeEngine.player.mana}/${cast.manaCost} ${mana.unit}).`);
      renderer.render();
      return;
    }
    // The first cast into overflow on a floor waits for a second press (N38).
    const overflowWarning = overflowWarnings.check(activeEngine, cast.manaCost ?? 0);
    if (overflowWarning) {
      activeEngine.log(overflowWarning);
      void processVisualEffectsAndRender();
      return;
    }
    if (spell.targetingMode === 'self' || spell.targetType === 'self') {
      activeEngine.handlePlayerAction(
        new CastSpellAction(activeEngine.player, spell.id, activeEngine.player.x, activeEngine.player.y)
      );
      quickSpellsBar.update(activeEngine);
      combatSidebar.update(activeEngine);
      void processVisualEffectsAndRender();
    } else {
      const entry: SpellbookEntry = {
        key: '',
        type: 'spell',
        id: spell.id,
        name: spell.name,
        manaCost: cast.manaCost,
        spellDef: cast,
        gridNotes: resolved?.notes,
      };
      renderer.inspectOverlay.close();
      renderer.mapOverlay.close();
      renderer.targetingOverlay.startTargeting(entry, activeEngine);

      if (inputHandler) {
        inputHandler.modalStack.push({
          id: 'targeting',
          get isOpen() { return renderer?.targetingOverlay.isOpen ?? false; },
          set isOpen(val: boolean) { if (!val) renderer?.targetingOverlay.close(); },
          handleKeyDown: (e: KeyboardEvent) => {
            if (!renderer || !activeEngine) return false;
            const handled = renderer.targetingOverlay.handleKeyDown(e, activeEngine);
            if (!renderer.targetingOverlay.isOpen && inputHandler) {
              inputHandler.modalStack.remove('targeting');
              inputHandler.isInputLocked = false;
            }
            renderer.render();
            return handled;
          },
          close: () => {
            renderer?.targetingOverlay.close();
            if (inputHandler) {
              inputHandler.modalStack.remove('targeting');
              inputHandler.isInputLocked = false;
            }
          },
        });
      }

      renderer.render();
      if (typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur();
        document.getElementById('game-canvas')?.focus();
      }
    }
  }

  function triggerQuickSpell(slotIndex: number): void {
    if (!activeEngine || !renderer) return;
    const spellId = activeEngine.player.quickSpells[slotIndex];
    if (!spellId) {
      openSpellbook();
      return;
    }
    const spell = activeEngine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
    if (!spell) {
      openSpellbook();
      return;
    }
    castOrTargetSpell(spell);
  }

  // Configurable Radial Action Menu (docs/architecture/simulation-and-input.md): casts an arbitrary spell
  // by ID, as opposed to triggerQuickSpell's fixed quickSpells-bar slot index.
  function castSpellById(spellId: string): void {
    if (!activeEngine || !renderer) return;
    const spell = activeEngine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
    if (spell) castOrTargetSpell(spell);
  }

  function resolveRadialMenuLabel(slot: RadialMenuSlotConfig): string {
    if (!activeEngine) return '';
    switch (slot.type) {
      case 'spell': {
        const spell = activeEngine.manifest?.spells?.find((s) => s.id === slot.spellId) ?? getSpell(slot.spellId);
        return spell?.name ?? slot.spellId;
      }
      case 'command':
        return commandPalette.getCommand(slot.commandId)?.title ?? slot.commandId;
      case 'item': {
        const item = activeEngine.player.inventory.findItemById(slot.itemId);
        return item?.displayName ?? slot.itemId;
      }
    }
  }

  /** "Shift+Digit1" -> "⇧1": the first key bound to a potion slot, as the row shows it. */
  function formatPotionKey(slotIndex: number): string {
    const code = settingsManager.getCodesForAction(`drink_potion_${slotIndex + 1}`)[0];
    if (!code) return '';
    return code.replace(/^Shift\+/, '⇧').replace(/Digit|Key/, '');
  }

  /** Drinks whatever potion the row shows in a slot. The caller renders afterwards. */
  function drinkPotionSlot(slotIndex: number): void {
    if (!activeEngine) return;
    const entry = potionRow.entryAt(slotIndex);
    const item = entry ? activeEngine.player.inventory.findItemById(entry.itemId) : undefined;
    if (!(item instanceof PotionItem)) {
      // Nothing to drink: an empty or run-out slot opens its picker instead.
      potionRow.openPicker(slotIndex);
      return;
    }
    activeEngine.handlePlayerAction(new DrinkPotionAction(activeEngine.player, item));
  }

  potionRow = new PotionRow({
    onDrinkSlot: (slotIdx) => {
      drinkPotionSlot(slotIdx);
      void processVisualEffectsAndRender();
    },
    onPinsChanged: () => {
      if (activeEngine) potionRow.update(activeEngine);
    },
    drawIcon: (canvas, item) => renderer?.drawItemIcon(canvas, item),
    keyLabel: formatPotionKey,
  });

  quickSpellsBar = new QuickSpellsBar({
    onTriggerSlot: (slotIdx) => triggerQuickSpell(slotIdx),
    onOpenSpellbook: () => openSpellbook(),
  });

  const spellbookTab = new SpellbookTab({
    onCastSpell: (spell) => {
      characterMenuModal?.close();
      castOrTargetSpell(spell);
    },
    onQuickSpellsChanged: () => {
      if (activeEngine) quickSpellsBar.update(activeEngine);
    },
    onSwitchGrimoirePage: (pageIndex) => {
      if (!activeEngine) return;
      activeEngine.handlePlayerAction(new AttuneGrimoirePageAction(activeEngine.player, pageIndex));
      quickSpellsBar.update(activeEngine);
      combatSidebar.update(activeEngine);
      void processVisualEffectsAndRender();
    },
    onArrangeGrimoireSlot: (slotIndex, spellId) => {
      if (!activeEngine) return;
      activeEngine.handlePlayerAction(new ArrangeGrimoireSlotAction(activeEngine.player, slotIndex, spellId));
      quickSpellsBar.update(activeEngine);
      void processVisualEffectsAndRender();
    },
  });

  /** Runs the console's context action through the same engine actions its keys use. */
  function runContextAction(action: ContextAction): void {
    const engine = activeEngine;
    if (!engine) return;
    const p = engine.player;
    switch (action.kind) {
      case 'attack':
      case 'talk':
      case 'open_door':
        engine.handlePlayerAction(new MovementAction(p, action.dx ?? 0, action.dy ?? 0));
        break;
      case 'take_all':
        engine.handlePlayerAction(new QuickLootAction(p));
        break;
      case 'pickup':
        engine.handlePlayerAction(new PickUpAction(p));
        break;
      case 'descend':
      case 'ascend':
        engine.handlePlayerAction(new ClimbStairsAction(p));
        break;
      case 'close_door':
        engine.handlePlayerAction(new CloseDoorAction(p, action.x ?? p.x, action.y ?? p.y));
        break;
      case 'rest':
        // The rest button runs the same auto-rest as R, stopping when a monster appears.
        document.getElementById('btn-hud-rest')?.click();
        return;
      case 'none':
        return;
    }
  }

  consoleExtras = new ConsoleExtras({
    onContextAction: (action) => {
      runContextAction(action);
      void processVisualEffectsAndRender();
    },
    onChip: (action) => {
      // Chips do what their keys do: T channels the rune, P opens the pacts tab.
      const code = action === 'channel_rune' ? 'KeyT' : 'KeyP';
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.slice(3).toLowerCase() }));
    },
    onPointAt: (x, y) => renderer?.pointAtTile(x, y),
    drawEntityIcon: (canvas, entity) => renderer?.drawEntityIcon(canvas, entity),
    contextKey: () => (settingsManager.getCodesForAction('context_action')[0] ?? '').replace(/^Shift\+/, '⇧').replace(/Digit|Key/, ''),
    smithName: () => resolveBranding(activeEngine?.manifest ?? activeManifest).runeSmithName,
  });

  combatSidebar = new CombatSidebar({
    drawMinimap: (canvas) => renderer?.drawMinimap(canvas),
    drawEntityIcon: (canvas, entity) => renderer?.drawEntityIcon(canvas, entity),
    drawItemIcon: (canvas, item) => renderer?.drawItemIcon(canvas, item),
    onPointAt: (x, y) => renderer?.pointAtTile(x, y),
    onOpenMap: () => document.getElementById('btn-map')?.click(),
  });

  // The pack's first-time hints, a card at the foot of the sidebar (never modal).
  const firstTimeHints = new FirstTimeHints({
    keyFor: (action) => {
      const code = settingsManager.getCodesForAction(action)[0];
      return code ? keyLabel(code) : undefined;
    },
    enabled: () => settingsManager.getSettings().hintsEnabled,
  });
  combatSidebar.element.appendChild(firstTimeHints.element);
  settingsManager.subscribe((settings) => {
    if (!settings.hintsEnabled) firstTimeHints.clear();
  });

  /**
   * The hero's square above the map: name, depth, level with experience, renown,
   * and a badge when attribute points wait to be spent. Stats and conditions live
   * in the sidebar; there is no turn counter.
   */
  function updateHeaderInfo(): void {
    if (!activeEngine) return;
    const p = activeEngine.player;
    const heroName = activeProfile?.name || p.name || 'Hero';
    const title = getActiveTitle(activeEngine);
    const renown = getRenownTotal(activeEngine);
    const xpText = `${p.xp}/${p.xpToNextLevel} ${brand.xpName}`;
    const where = activeEngine.currentFloor === 0 ? brand.townName : `Floor ${activeEngine.currentFloor}`;

    const setText = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText('header-name', heroName);
    setText('header-floor', where);
    setText('header-level', `Lvl ${p.level}`);
    setText('header-renown', title ? title : `Renown ${renown}`);
    const fill = document.getElementById('header-xp-fill');
    if (fill) fill.style.width = `${Math.round((p.xp / Math.max(1, p.xpToNextLevel)) * 100)}%`;

    const portrait = document.getElementById('hud-portrait');
    if (portrait) {
      portrait.title = [
        title ? `${heroName}, ${title}` : heroName,
        activeEngine.currentFloor === 0 ? `Town: ${brand.townName}` : `Floor ${activeEngine.currentFloor}`,
        `Level ${p.level} — ${xpText} to level ${p.level + 1}`,
        `Renown ${renown}`,
      ].join('\n');
    }

    const alloc = document.getElementById('btn-alloc-points');
    const unspent = p.unspentStatPoints ?? 0;
    if (alloc) {
      alloc.hidden = unspent <= 0;
      alloc.textContent = `+${unspent}`;
    }
  }

  // The engine's result is read-only here (§7.2), so remember which failed result was already shown.
  let lastReportedPipelineError: ActionResult | null = null;
  let lastObservedPlayerHp: number | null = null;
  // Last seen HP and tile of each monster, so a killing blow (the monster is already off
  // the map by render time) can still show its number where the monster fell.
  const knownMonsters = new Map<string, { hp: number; x: number; y: number }>();
  /** Entities that took a critical blow since the last floating-text pass (`damage_dealt`). */
  const criticalTargets = new Set<string>();
  const criticalLines = new CriticalLineTracker();
  // Coins are auto-picked up only on entering a tile, so coins the hero drops stay dropped.
  let lastCoinPickupTile: string | null = null;

  function checkCoinAutoPickup(engine: GameEngine): void {
    if (!engine.player.isAlive()) return;
    const tileKey = `${engine.currentFloor}:${engine.player.x},${engine.player.y}`;
    if (tileKey === lastCoinPickupTile) return;
    lastCoinPickupTile = tileKey;
    const items = engine.map.getItemsAt(engine.player.x, engine.player.y);
    if (!items || items.length === 0) return;

    for (const item of [...items]) {
      const coinInfo = parseCoinItem(item);
      if (coinInfo) {
        engine.commandBus.dispatch({
          type: 'pickup_item',
          payload: { itemId: item.id, freeAction: true },
        });
      }
    }
  }

  function updateCombatFloatingText(engine: GameEngine): void {
    if (!renderer) return;

    // 1. Player damage & heal
    if (lastObservedPlayerHp !== null) {
      if (engine.player.hp > lastObservedPlayerHp) {
        renderer.floatingTextRunner.spawnHeal(
          engine.player.x,
          engine.player.y,
          engine.player.hp - lastObservedPlayerHp
        );
      } else if (engine.player.hp < lastObservedPlayerHp) {
        renderer.floatingTextRunner.spawnDamage(
          engine.player.x,
          engine.player.y,
          lastObservedPlayerHp - engine.player.hp,
          { isPlayer: true, isCrit: criticalTargets.has(engine.player.id) }
        );
      }
    }
    lastObservedPlayerHp = engine.player.hp;

    // 2. Monster damage and crits (killing blows are shown from `entity_killed`)
    const livingMonsterIds = new Set<string>();
    for (const entity of engine.map.getAllEntities()) {
      if (entity instanceof Monster) {
        livingMonsterIds.add(entity.id);
        const prev = knownMonsters.get(entity.id);
        if (prev && entity.hp < prev.hp) {
          renderer.floatingTextRunner.spawnDamage(entity.x, entity.y, prev.hp - entity.hp, {
            isPlayer: false,
            isCrit: criticalTargets.has(entity.id),
          });
        }
        knownMonsters.set(entity.id, { hp: entity.hp, x: entity.x, y: entity.y });
      }
    }

    for (const id of knownMonsters.keys()) {
      if (!livingMonsterIds.has(id)) {
        knownMonsters.delete(id);
      }
    }
    criticalTargets.clear();
  }

  function recordKnownMonsters(engine: GameEngine): void {
    knownMonsters.clear();
    for (const entity of engine.map.getAllEntities()) {
      if (entity instanceof Monster) knownMonsters.set(entity.id, { hp: entity.hp, x: entity.x, y: entity.y });
    }
  }

  function updateGothicConsole(engine: GameEngine): void {
    const healthTextEl = document.getElementById('health-orb-text');
    const healthFillEl = document.getElementById('health-orb-fill');
    const manaTextEl = document.getElementById('mana-orb-text');
    const manaFillEl = document.getElementById('mana-orb-fill');

    const p = engine.player;
    if (healthTextEl) {
      healthTextEl.textContent = `${p.hp}/${p.maxHp}`;
    }
    if (healthFillEl) {
      const pct = p.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100))) : 0;
      healthFillEl.style.height = `${pct}%`;
    }

    if (manaTextEl) {
      manaTextEl.textContent = `${p.mana}/${p.maxMana}`;
    }
    if (manaFillEl) {
      const pct = p.maxMana > 0 ? Math.max(0, Math.min(100, Math.round((p.mana / p.maxMana) * 100))) : 0;
      manaFillEl.style.height = `${pct}%`;
    }
  }

  function updateMessageLog(engine: GameEngine): void {
    const streamEl = document.getElementById('log-messages-stream');
    if (!streamEl) return;

    const historyKey = document.getElementById('log-history-key');
    const label = messageLogKey() ?? '';
    if (historyKey && historyKey.textContent !== label) {
      historyKey.textContent = label;
      historyKey.style.display = label ? '' : 'none';
    }

    const msgs = engine.messages.slice(-6);
    if (msgs.length === 0) {
      streamEl.innerHTML = '<div class="log-line log-line-muted">Explore the dungeon.</div>';
      return;
    }

    streamEl.innerHTML = '';
    const total = msgs.length;
    for (let i = 0; i < total; i++) {
      const msg = msgs[i];
      const lineEl = document.createElement('div');
      lineEl.className = 'log-line';

      if (i === total - 1) {
        lineEl.classList.add('log-line-newest');
      } else if (i === total - 2) {
        lineEl.classList.add('log-line-recent');
      } else {
        lineEl.classList.add('log-line-muted');
      }

      const line = classifyLogLine(msg, engine.player.name, criticalLines.set);
      if (line.tone !== 'plain') lineEl.classList.add(`log-line-${line.tone}`, 'log-line-toned');
      lineEl.textContent = line.text;
      streamEl.appendChild(lineEl);
    }
    streamEl.scrollTop = streamEl.scrollHeight;
  }

  async function processVisualEffectsAndRender(): Promise<void> {
    try {
      const lastResult = activeEngine?.lastActionResult;
      if (lastResult?.pipelineError && lastResult !== lastReportedPipelineError) {
        lastReportedPipelineError = lastResult;
        diagnosticModal.showError(lastResult.message ?? 'An unexpected error occurred; the action could not be completed.');
      }
      updateHeaderInfo();
      if (activeEngine) {
        checkCoinAutoPickup(activeEngine);
        updateCombatFloatingText(activeEngine);
        updateGothicConsole(activeEngine);
        updateMessageLog(activeEngine);
        quickSpellsBar.update(activeEngine);
        potionRow.update(activeEngine);
        // The prologue's action cues: the slot for the move the moment calls for glows.
        const cues = settingsManager.getSettings().hintsEnabled ? findActionCues(activeEngine) : null;
        potionRow.setCue(cues?.drinkSlot ?? null);
        quickSpellsBar.setCue(cues?.castSlot ?? null);
        combatSidebar.update(activeEngine);
        consoleExtras.update(activeEngine);
        if (firstTimeHints.hasUnseen(activeEngine)) firstTimeHints.offer(activeEngine, hintsMetByState(activeEngine));
        // Periodic background autosave every 50 turns
        if (activeProfile && autosaveManager.shouldAutosave(activeEngine.turnCount)) {
          autosaveManager.autosave(activeEngine, activeProfile);
        }
      }
      if (activeEngine && renderer && renderer.fxRunner.mode !== 'instant') {
        const pending = activeEngine.consumePendingVisualEffects();
        if (pending.length > 0) {
          // Only tactical effects gate input (ARCHITECTURE.md §4); ambient ones play on
          // through the non-blocking queue while the player acts.
          const hasTactical = pending.some(isTacticalEffect);
          if (hasTactical && inputHandler) inputHandler.isInputLocked = true;
          try {
            await renderer.fxRunner.playQueue(pending);
          } finally {
            if (hasTactical && inputHandler) inputHandler.isInputLocked = false;
          }
        }
      }
      renderer?.render();
    } catch (err) {
      console.error('[Render Loop Guard] Error during visual effects or rendering:', err);
      flightRecorder.recordError(err instanceof Error ? err : new Error(String(err)), {
        source: 'processVisualEffectsAndRender',
      });
    }
  }

  const diagnosticModal = new DiagnosticModal(
    () => activeEngine,
    () => activeProfile,
    () => {
      popModal(diagnosticModal.id);
    },
    {
      getInputLocked: () => inputHandler?.isInputLocked ?? false,
      clearInputLock: () => inputHandler?.clearInputLock(),
      getChordStatus: () =>
        inputHandler?.chordBuffer.getStatus() ?? {
          enabled: false,
          bufferMs: 40,
          pressedKeys: [],
          isChording: false,
          hasPendingTimer: false,
        },
    }
  );

  const feedbackModal = new FeedbackModal({
    getEngine: () => activeEngine,
    getProfile: () => activeProfile,
    bulkArchive,
    relayUrl: import.meta.env.VITE_REPORT_RELAY_URL || undefined,
    captureScreenshot: () => {
      if (!activeEngine || !canvas || gameContainer?.style.display === 'none') return null;
      try {
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
    onClosed: () => {
      renderer?.render();
    },
  });

  // FeedbackModal registers and removes its own modal-stack entry (setModalStack below),
  // so it is not adapted through pushModal/popModal like the older modals.
  diagnosticModal.setBulkArchive(bulkArchive);
  diagnosticModal.setOpenFeedbackHandler((opts) => {
    feedbackModal.open(opts);
  });
  // F2 > Load State From Report: swap in the reported game, replaying its action trail.
  diagnosticModal.setLoadReportStateHandler(async (text, replay) => {
    let expanded: string;
    try {
      expanded = await expandCompressedReplay(text);
    } catch (err) {
      return `Could not decode the compressed replay data: ${(err as Error).message}`;
    }
    const outcome = loadReplayState(expanded, activeManifest);
    if (!outcome.ok) return `Could not load: ${outcome.message}`;
    const { engine, profile, source, trail } = outcome.value;
    let note = '';
    if (source !== 'replay-checkpoint') {
      note = source === 'state-snapshot' ? ' (report-time snapshot; no replay data in it)' : ' (save file)';
    } else if (!replay) {
      note = ` at the checkpoint; ${trail.length} action(s) not replayed`;
    } else {
      const result = replayActionTrail(engine, trail);
      note = result.stoppedAt
        ? `; replayed ${result.replayed}/${result.total}, stopped at #${result.stoppedAt.seq} ${result.stoppedAt.action}: ${result.stoppedAt.reason}`
        : `; replayed all ${result.replayed} action(s)`;
    }
    diagnosticModal.close();
    popModal(diagnosticModal.id);
    launchGame(engine, profile);
    showToast(`Loaded ${profile.name}${note}.`, 'info', 6000);
    return `Loaded ${profile.name}${note}.`;
  });

  function toggleFeedback(opts?: any): void {
    if (feedbackModal.isOpen) {
      feedbackModal.close();
    } else {
      feedbackModal.open(opts);
    }
  }

  const saveCodeModal = new SaveCodeModal({
    profileManager,
    activeManifestId: activeManifest.id,
    getActiveEnvelope: () => {
      if (activeEngine && activeProfile) {
        const saveData = serializeGame(activeEngine, activeProfile);
        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          contentManifestId: activeManifest.id,
          timestamp: Date.now(),
          data: saveData,
        };
      }
      return null;
    },
    onRestored: (profile) => {
      titleScreen.refresh();
      const loaded = loadProfileOrNotify(profile.id);
      if (loaded) {
        launchGame(loaded.engine, loaded.profile);
      }
    },
    onClose: () => {
      popModal('save-code');
    },
    getModalStack: () => (inputHandler?.modalStack.has('save-code') ? inputHandler.modalStack : undefined),
  });

  /** Opens the save-code window over the game, with its one modal-stack entry. */
  const openSaveCode = (envelope?: VersionedSaveEnvelope<SaveData>): void => {
    saveCodeModal.open('copy', envelope);
    pushModal('save-code', { isOpen: () => saveCodeModal.isOpen(), close: () => saveCodeModal.close() });
  };

  // The hall of fame in browser storage. The engine records a finished run only into its
  // own in-memory board, so the run is inscribed here too (see launchGame).
  const hallOfFame = new Leaderboard(getBrowserStorage() ?? undefined);

  const sagaShareModal = new SagaShareModal({
    leaderboard: hallOfFame,
    branding: brand,
    onSagaInscribed: (entry) => {
      titleScreen?.refreshValhalla();
      titleScreen?.setStatus(`Inscribed ${entry.heroName}'s saga into the ${brand.hallOfFameName}!`);
    },
    onClose: () => {
      // Over the game-over screen the run is over: its input stays off.
      if (inputHandler && activeEngine && gameContainer && gameContainer.style.display !== 'none' && !gameOverDialog.isOpen) {
        inputHandler.enabled = true;
      }
    },
  });

  // Like FeedbackModal, KeybindModal registers and removes its own modal-stack entry
  // (setModalStack below): it also opens from the main menu, before any stack exists.
  const keybindModal = new KeybindModal({ settingsManager });

  // The one dialog before a new hero's first step: moving, diagonals, where the keys are.
  const controlsPrimer = new ControlsPrimer({
    keyFor: (action) => {
      const code = settingsManager.getCodesForAction(action)[0];
      return code ? keyLabel(code) : undefined;
    },
    onOpenControls: () => keybindModal.open(),
    onHideForGood: () => settingsManager.updateSettings({ controlsPrimerEnabled: false }),
    onClose: () => {
      popModal(controlsPrimer.id);
      renderer?.render();
    },
  });

  // The log's history (Shift+M, or a click on the log strip's label). Reading takes no turn.
  const messageLogKey = (): string | undefined => {
    const code = settingsManager.getCodesForAction('message_log')[0];
    return code ? keyLabel(code) : undefined;
  };
  const messageLogModal = new MessageLogModal({
    openKey: messageLogKey,
    isOpenKey: (e) => settingsManager.getActionForCode(e.shiftKey ? `Shift+${e.code}` : e.code) === 'message_log',
    onClose: () => {
      popModal(messageLogModal.id);
      renderer?.render();
    },
  });
  function openMessageLog(): void {
    if (!activeEngine || !inputHandler || messageLogModal.isOpen) return;
    if (inputHandler.modalStack.size > 0) return;
    messageLogModal.open(activeEngine.messages, activeEngine.player.name, criticalLines.set);
    pushModal(messageLogModal.id, messageLogModal);
  }
  document.getElementById('btn-log-history')?.addEventListener('click', () => openMessageLog());

  const saveQuitModal = new SaveQuitModal({
    profileManager,
    onSaveAndExit: () => {
      saveAndReturnToTitle();
    },
    onResume: () => {
      popModal('save-quit');
      renderer?.render();
    },
    onOpenSettings: () => {
      keybindModal.open();
    },
    onOpenHelp: () => {
      inputHandler?.openContextHelp();
    },
    onOpenSaveCode: openSaveCode,
  });

  function promptSaveAndQuit(): void {
    if (activeEngine && activeProfile) {
      saveQuitModal.open(activeEngine, activeProfile);
      if (inputHandler) inputHandler.modalStack.push(saveQuitModal);
    } else {
      saveAndReturnToTitle();
    }
  }

  feedbackBtn?.addEventListener('click', () => {
    toggleFeedback();
  });

  devDiagBtn?.addEventListener('click', () => {
    diagnosticModal.open();
  });

  mapBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      renderer.inspectOverlay.close();
      renderer.targetingOverlay.close();
      renderer.mapOverlay.toggle(activeEngine);
      renderer.render();
    }
  });

  helpBtn?.addEventListener('click', () => {
    if (activeEngine) {
      contextHelp.toggle(
        activeEngine,
        inventoryFlag(),
        renderer?.targetingOverlay,
        renderer?.shopOverlay,
        renderer?.inspectOverlay,
        renderer?.mapOverlay
      );
    }
  });

  compendiumBtn?.addEventListener('click', () => {
    openMenuTab('bestiary');
  });

  function toggleCommandPalette(): void {
    if (activeEngine) commandPalette.toggle(activeEngine, () => renderer?.render());
  }

  cmdPaletteBtn?.addEventListener('click', () => toggleCommandPalette());

  document.getElementById('btn-alloc-points')?.addEventListener('click', () => {
    inputHandler?.toggleCharacterMenu('character');
  });

  hudInvBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      inputHandler?.toggleInventory();
      updateHeaderInfo();
      renderer.render();
    }
  });

  hudCastBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      openSpellbook();
    }
  });

  hudLookBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      renderer.targetingOverlay.close();
      renderer.mapOverlay.close();
      renderer.inspectOverlay.open(activeEngine);
      renderer.render();
    }
  });

  hudPactsBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && inputHandler) {
      inputHandler.toggleCharacterMenu('pacts');
      renderer.render();
    }
  });

  hudRestBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && inputHandler?.autoRestRunner) {
      inputHandler.autoRestRunner.start({
        onStep: () => {
          renderer?.render();
          updateHeaderInfo();
        },
        onComplete: () => {
          renderer?.render();
          updateHeaderInfo();
        },
      });
    } else if (activeEngine && renderer) {
      activeEngine.handlePlayerAction(new RestAction(activeEngine.player));
      void processVisualEffectsAndRender();
    }
  });

  hudSearchBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      activeEngine.handlePlayerAction(new SearchAction(activeEngine.player, activeEngine.rng, 2));
      void processVisualEffectsAndRender();
    }
  });

  hudWaitBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      activeEngine.handlePlayerAction(new WaitAction(activeEngine.player));
      void processVisualEffectsAndRender();
    }
  });

  hudStairsBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      activeEngine.handlePlayerAction(new ClimbStairsAction(activeEngine.player));
      void processVisualEffectsAndRender();
    }
  });

  const healthOrbEl = document.getElementById('hud-health-orb');
  const manaOrbEl = document.getElementById('hud-mana-orb');

  healthOrbEl?.addEventListener('click', () => {
    hudRestBtn?.click();
  });

  manaOrbEl?.addEventListener('click', () => {
    openSpellbook();
  });

  // Global uncaught error & rejection crash safety (HR-6)
  const onGlobalError = (event: ErrorEvent) => {
    if (isOpaqueScriptError(event)) {
      flightRecorder.recordWarning('Opaque "Script error." from a script outside the game', {
        type: 'opaque-script-error',
        source: event.filename,
      });
      return;
    }
    if (isBenignResizeObserverError(event)) {
      flightRecorder.recordWarning('ResizeObserver deferred a notification to the next frame', {
        type: 'resize-observer-loop',
      });
      return;
    }
    const err = event.error || new Error(String(event.message));
    flightRecorder.recordError(err, { source: event.filename, lineno: event.lineno, colno: event.colno });
    // Archive the log off the synchronous quota; failure here must never mask the crash.
    void bulkArchive
      .archiveFlightLog(`crash-${flightRecorder.getEvents().length}-${err.name}`, flightRecorder.getEvents())
      .catch(() => undefined);
    sessionGuard.end(); // reported through the crash dialog, not as a freeze
    diagnosticModal.showCrash(err);
  };

  const onGlobalUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    flightRecorder.recordError(reason, { type: 'unhandledrejection' });
    sessionGuard.end();
    diagnosticModal.showCrash(reason);
  };

  window.addEventListener('error', onGlobalError);
  window.addEventListener('unhandledrejection', onGlobalUnhandledRejection);

  window.__teardownGlobalErrorHandlers = () => {
    window.removeEventListener('error', onGlobalError);
    window.removeEventListener('unhandledrejection', onGlobalUnhandledRejection);
  };

  function saveAndReturnToTitle(): void {
    sessionGuard.end();
    if (activeEngine && activeProfile) {
      profileManager.saveCharacter(activeEngine, activeProfile);
      autosaveManager.autosave(activeEngine, activeProfile);
    }
    if (widescreenLayout) {
      widescreenLayout.style.display = 'none';
    }
    if (gameContainer) {
      gameContainer.style.display = 'none';
    }
    quickSpellsBar.unmount();
    if (inputHandler) {
      inputHandler.enabled = false;
    }
    mainMenu.show();
  }

  let currentGameOverEntry: HallOfFameEntry | null = null;

  const gameOverDialog = new GameOverDialog({
    onLoadAutosave: () => {
      const loaded = loadAutosaveOrNotify();
      if (loaded) {
        gameOverDialog.hide();
        launchGame(loaded.engine, loaded.profile);
      }
    },
    onShare: () => {
      if (currentGameOverEntry) sagaShareModal.openShare(currentGameOverEntry);
    },
    onExport: () => {
      if (!activeProfile) return;
      try {
        const fileName = profileManager.triggerCotwDownload(activeProfile.id, defaultPlatformAdapter);
        gameOverDialog.setStatus(`Saved ${fileName}.`, 'good');
      } catch (err) {
        gameOverDialog.setStatus(`Export failed: ${(err as Error).message}`, 'bad');
      }
    },
    onReturn: () => {
      gameOverDialog.hide();
      saveAndReturnToTitle();
    },
  });

  const endingDialog = new EndingDialog();

  function showGameOverModal(status: 'victorious' | 'fallen' | 'active', summary: any): void {
    if (inputHandler) {
      inputHandler.enabled = false;
    }

    const entry: HallOfFameEntry | null = summary.entry ?? null;
    currentGameOverEntry = entry;
    const won = status === 'victorious';
    // A named ending is told first, on its own screen; the score screen follows.
    const ending = won && summary.endingId ? activeEngine?.manifest?.quest?.endings?.[summary.endingId] : undefined;
    const kicker = entry ? `${entry.heroName} · Level ${entry.level}` : undefined;
    const showScore = () => showRunSummary(won, entry, ending?.banner, kicker);
    if (ending?.narrative?.length) {
      endingDialog.show({ title: ending.title ?? brand.victoryTitle, kicker, paragraphs: ending.narrative }, showScore);
    } else {
      showScore();
    }
  }

  function showRunSummary(won: boolean, entry: HallOfFameEntry | null, endingBanner: string | undefined, kicker: string | undefined): void {
    const autosave = autosaveManager.hasAutosave() ? autosaveManager.getAutosaveMetadata() : null;
    gameOverDialog.show({
      status: won ? 'victorious' : 'fallen',
      title: won ? brand.victoryTitle : 'Fallen in Battle',
      kicker,
      banner: won ? endingBanner ?? brand.victoryBanner : brand.fallenBanner,
      // The score stands on its own in the footer, so the record leaves it out.
      factsHtml: entry ? epitaphHtml(entry, brand.xpName, { withScore: false }) : '',
      score: entry ? `${brand.hallOfFameShortName} score: ${entry.score.toLocaleString()}` : undefined,
      autosaveLabel: autosave ? `Load the autosave (${autosave.profileName ?? 'Hero'}, F${autosave.floor ?? 1})` : undefined,
      exportLabel: `Export save (${SAVE_FILE_EXTENSION})`,
    });
  }

  function launchGame(engine: GameEngine, profile: CharacterProfile): void {
    overflowWarnings.reset();
    if (characterMenuModal?.isOpen) {
      characterMenuModal.close();
    }
    if (inputHandler) {
      inputHandler.modalStack.closeAll();
      inputHandler.isInputLocked = false;
    }
    masteryModal.clearQueue();
    activeEngine = engine;
    activeProfile = profile;
    window.__cotwEngine = engine;
    window.__cotwSaveAndReturn = saveAndReturnToTitle;

    // Wire GameState victory/defeat listener
    engine.gameState.onStateChanged = (status, summary) => {
      if (summary.entry) hallOfFame.recordRun(summary.entry);
      if (activeProfile) {
        activeProfile.questStatus = status;
        if (summary.entry?.epitaph) {
          activeProfile.epitaph = summary.entry.epitaph;
        }
        profileManager.saveCharacter(engine, activeProfile);
      }
      showGameOverModal(status, summary);
    };


    firstTimeHints.clear();
    lastObservedPlayerHp = engine.player.hp;
    lastCoinPickupTile = `${engine.currentFloor}:${engine.player.x},${engine.player.y}`;
    recordKnownMonsters(engine);
    updateGothicConsole(engine);
    updateMessageLog(engine);

    engine.onGameEvent = (event: GameEvent) => {
      firstTimeHints.offer(engine, hintsMetByEvent(event));
      if (isGameEvent(event, 'damage_dealt')) {
        if (event.critical) {
          if (event.targetId) criticalTargets.add(event.targetId);
          criticalLines.markNewest(engine.messages);
        }
      } else if (isGameEvent(event, 'entity_killed')) {
        const fallen = event.targetId ? knownMonsters.get(event.targetId) : undefined;
        if (fallen && event.targetId) {
          renderer?.floatingTextRunner.spawnDamage(fallen.x, fallen.y, fallen.hp, {
            killed: true,
            isCrit: criticalTargets.has(event.targetId),
          });
          knownMonsters.delete(event.targetId);
        }
      } else if (event.type === 'player_leveled_up') {
        renderer?.floatingTextRunner.spawnText(engine.player.x, engine.player.y, 'LEVEL UP! ★', {
          role: 'gold',
          isCrit: true,
          textRole: 'lg',
        });
        // A level-up never takes the screen mid-fight: the header's points badge pulses,
        // and one toast per turn (a big kill can bring many levels at once) says how many
        // points wait and which key opens the Character tab to spend them.
        showLevelUpToast(engine);
        renderer?.render();
      } else if (event.type === 'rune_of_return_discovered') {
        if (inputHandler) {
          runeDiscoveryModal.setModalStack(inputHandler.modalStack);
          runeDiscoveryModal.open(engine, () => {
            popModal(runeDiscoveryModal.id);
            renderer?.render();
            showPendingMastery();
          });
          pushModal(runeDiscoveryModal.id, runeDiscoveryModal);
        } else {
          runeDiscoveryModal.open(engine);
        }
        renderer?.render();
      } else if (event.type === 'altar_reached') {
        // Spell altar underfoot: open its rite; performing it is a replayable player action.
        const altar = getAltarDefinition(engine, String(event.data?.altarId ?? ''));
        const x = Number(event.data?.x);
        const y = Number(event.data?.y);
        if (altar) {
          altarModal.open(
            engine,
            altar,
            (request) => {
              popModal(altarModal.id);
              engine.handlePlayerAction(new PerformAltarRiteAction(engine.player, altar.id, x, y, request));
              quickSpellsBar.update(engine);
              combatSidebar.update(engine);
              updateHeaderInfo();
              void processVisualEffectsAndRender();
            },
            () => {
              popModal(altarModal.id);
              renderer?.render();
            }
          );
          inputHandler?.modalStack.push(altarModal);
          renderer?.render();
        }
      } else if (isGameEvent(event, 'mastery_unlocked')) {
        masteryModal.enqueue({
          scope: event.scope,
          masteryId: event.masteryId,
          name: event.name,
          kills: event.kills,
        });
        showPendingMastery();
      }
    };

    // Wire interactive Choice modal
    engine.onChoiceInteract = (choice, onOptionSelected, onCancel) => {
      choiceModal.open(
        choice,
        engine,
        (optionId) => {
          popModal('choice');
          onOptionSelected(optionId);
          updateHeaderInfo();
          renderer?.render();
        },
        () => {
          popModal('choice');
          if (onCancel) onCancel();
          updateHeaderInfo();
          renderer?.render();
        }
      );
      if (inputHandler) inputHandler.modalStack.push(choiceModal);
      renderer?.render();
    };

    const toggleDiagnostics = () => {
      if (diagnosticModal.isOpen) {
        diagnosticModal.close();
        if (inputHandler) {
          inputHandler.modalStack.remove(diagnosticModal.id);
        }
      } else {
        if (inputHandler) {
          inputHandler.modalStack.push(diagnosticModal);
        }
        diagnosticModal.open();
      }
    };

    const commandExecutors: Record<CommandId, (eng: GameEngine) => void> = {
      inspect: (eng) => {
        if (renderer) {
          renderer.targetingOverlay.close();
          renderer.inspectOverlay.open(eng);
          renderer.render();
        }
      },
      spellbook: () => openMenuTab('spellbook'),
      inventory: () => {
        openMenuTab('inventory');
        renderer?.render();
      },
      compendium: () => openMenuTab('bestiary'),
      'allocate-stats': () => openMenuTab('character'),
      character_menu: () => openMenuTab('character'),
      pacts: () => openMenuTab('pacts'),
      story: () => openMenuTab('story'),
      'run-advisory': (eng) => {
        const rep = SageService.getRunAdvisory(eng);
        eng.log(`*** SAGE ADVISORY (Floor ${rep.targetFloor}): ${rep.summary} ***`);
        for (const w of rep.warnings) {
          eng.log(`[${w.severity.toUpperCase()}] ${w.title}: ${w.recommendation}`);
        }
        contextHelp.open(eng, inventoryFlag(), renderer?.targetingOverlay, renderer?.shopOverlay, renderer?.inspectOverlay);
        renderer?.render();
      },
      help: () => {
        inputHandler?.openContextHelp();
      },
      'quick-loot': (eng) => {
        const act = new QuickLootAction(eng.player);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      'sort-pack': (eng) => {
        eng.commandBus.dispatch({ type: 'sort_pack', payload: { mode: 'category' } });
        renderer?.render();
      },
      'consolidate-coins': (eng) => {
        const res = eng.player.inventory.consolidateCoins();
        if (res.count > 0) {
          eng.log(`Consolidated ${res.count} coin stack(s) into purse.`);
        } else {
          eng.log('No loose coins in backpack to consolidate.');
        }
        renderer?.render();
      },
      wait: (eng) => {
        const act = new WaitAction(eng.player);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      rest: (eng) => {
        const act = new RestAction(eng.player);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      search: (eng) => {
        const act = new SearchAction(eng.player, eng.rng);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      stairs: (eng) => {
        const act = new ClimbStairsAction(eng.player);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      map: (eng) => {
        if (renderer) {
          renderer.inspectOverlay.close();
          renderer.targetingOverlay.close();
          renderer.mapOverlay.open(eng);
          renderer.render();
        }
      },
      diagnostics: () => {
        toggleDiagnostics();
      },
      'message-log': () => {
        openMessageLog();
      },
      feedback: () => {
        toggleFeedback();
      },
      'save-quit': () => {
        promptSaveAndQuit();
      },
      'export-save': (eng) => {
        if (activeProfile) {
          try {
            const fileName = profileManager.triggerCotwDownload(activeProfile.id, defaultPlatformAdapter);
            eng.log(`Exported character save to ${fileName}.`);
            renderer?.render();
          } catch (err) {
            eng.log(`Export failed: ${(err as Error).message}`);
          }
        }
      },
      'save-code': () => {
        if (activeEngine && activeProfile) {
          const saveData = serializeGame(activeEngine, activeProfile);
          openSaveCode({
            schemaVersion: CURRENT_SCHEMA_VERSION,
            contentManifestId: activeManifest.id,
            timestamp: Date.now(),
            data: saveData,
          });
        }
      },
      settings: () => {
        keybindModal.open();
      },
      summon_companion: (eng) => {
        // The hero's own companion: the one dismissed or fallen (the engine refuses a
        // fallen one), else the pack's first for a hero bonded at a trainer.
        const defId =
          eng.dismissedCompanion?.companionDefinitionId ??
          eng.deadCompanionRecord?.companionDefinitionId ??
          eng.manifest?.companions?.[0]?.id;
        if (eng.companion) {
          eng.log(`${eng.companion.name} is already at your side.`);
        } else if (defId) {
          eng.summonCompanion(defId);
        } else {
          eng.log('No companion is available in this campaign.');
        }
        renderer?.render();
      },
      dismiss_companion: (eng) => {
        eng.dismissCompanion();
        renderer?.render();
      },
      use_companion_skill_rally_howl: (eng) => {
        const res = eng.commandBus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } });
        if (!res.success && res.message) eng.log(res.message);
        void processVisualEffectsAndRender();
      },
      rune_of_return_tree: () => {
        openRuneTree();
      },
      channel_rune_of_return: (eng) => {
        eng.handlePlayerAction(new ChannelRuneOfReturnAction(eng.player));
        void processVisualEffectsAndRender();
      },
    };

    commandPalette.registerCommands(COMMAND_CATALOG.map((meta) => ({ ...meta, execute: commandExecutors[meta.id] })));

    /** The companion keys (Shift+C, Shift+R by default): call or send away; its skill. */
    const runCompanionKey = (command: 'call' | 'skill'): void => {
      const eng = activeEngine;
      if (!eng) return;
      const companion = eng.companion?.isAlive() ? eng.companion : undefined;
      if (command === 'call') {
        commandExecutors[companion ? 'dismiss_companion' : 'summon_companion'](eng);
        return;
      }
      // Its first learned skill (a companion learns one at the trainer).
      const skillId = companion?.unlockedSkills[0];
      if (!skillId) {
        eng.log(companion ? `${companion.name} has learned no skill yet.` : 'No companion is at your side.');
        return;
      }
      const res = eng.commandBus.dispatch({ type: 'use_companion_skill', payload: { skillId } });
      if (!res.success && res.message) eng.log(res.message);
    };

    // A pack font that finishes loading after the first frame redraws the canvas in it.
    void applyThemeTokens(engine.manifest?.theme).then(() => renderer?.render());

    if (!renderer) {
      renderer = new CanvasRenderer(canvas!, engine);
      inventoryTab = new InventoryTab({
        drawItemIcon: (iconCanvas, item) => renderer?.drawItemIcon(iconCanvas, item),
        richHoverCards: () => settingsManager.getSettings().inventoryRichHoverCards,
      });
      characterMenuModal = new CharacterMenuModal(
        [inventoryTab, characterTab, spellbookTab, bestiaryTab, pactsTab, storyTab],
        () => ({
          engine: activeEngine!,
          worldState: activeEngine!.worldState,
          player: activeEngine!.player,
          map: activeEngine!.map,
          currentFloor: activeEngine!.currentFloor,
          turnCount: activeEngine!.turnCount,
          manifest: activeEngine!.manifest ?? activeManifest,
          pacts: activeEngine!.pacts,
        }),
        () => {
          renderer?.render();
        }
      );
      characterMenuModal.setKeyResolver((actionId) => settingsManager.getCodesForAction(actionId));
      renderer.mouseVectoringEnabled = settingsManager.getSettings().mouseVectoringEnabled;
      renderer.torchlightEnabled = settingsManager.getSettings().torchlightEnabled;
      renderer.radialMenuOverlay.slots = settingsManager.getSettings().radialMenuSlots;
      renderer.onResolveRadialLabel = resolveRadialMenuLabel;
      renderer.onFocusEntityChanged = (id) => combatSidebar.setFocusedEntity(id);
      settingsManager.subscribe((settings) => {
        if (renderer) {
          renderer.mouseVectoringEnabled = settings.mouseVectoringEnabled;
          renderer.torchlightEnabled = settings.torchlightEnabled;
          renderer.radialMenuOverlay.slots = settings.radialMenuSlots;
          renderer.render();
        }
      });
      renderer.shopOverlay.onOpenCompendium = () => openMenuTab('bestiary');
      renderer.shopOverlay.onOpenRuneTree = () => {
        openRuneTree();
      };
      renderer.shopOverlay.onGreet = (npc, eng) => {
        if (npc.id === eng.manifest.pactKeeperNpcId) firstTimeHints.offer(eng, ['pactKeeper']);
      };
      renderer.onPactModalRequested = () => openMenuTab('pacts');
      renderer.onOpenContainer = (container) => {
        openMenuTab('inventory');
        inventoryTab.showContainer(container);
      };
      inputHandler = new InputHandler(
        engine,
        () => {
          void processVisualEffectsAndRender();
        },
        promptSaveAndQuit,
        renderer.targetingOverlay,
        renderer.shopOverlay,
        toggleDiagnostics,
        renderer.inspectOverlay,
        contextHelp,
        commandPalette,
        renderer.mapOverlay,
        settingsManager,
        renderer.radialMenuOverlay
      );
      inputHandler.characterMenuModal = characterMenuModal;
      inputHandler.onBeforeInput = (code) => {
        if (activeEngine) sessionGuard.noteInput(activeEngine, code);
      };
      characterMenuModal.setModalStack(inputHandler.modalStack);
      inputHandler.onOpenRuneTree = openRuneTree;
      inputHandler.runeOfReturnDiscoveryModal = runeDiscoveryModal;
      runeDiscoveryModal.setModalStack(inputHandler.modalStack);
      inputHandler.onCastSpellById = castSpellById;
      inputHandler.onDrinkPotionSlot = drinkPotionSlot;
      inputHandler.onToggleCommandPalette = toggleCommandPalette;
      inputHandler.onContextAction = () => runContextAction(consoleExtras.currentAction);
      inputHandler.onCompanionCommand = runCompanionKey;
      inputHandler.onOpenMessageLog = openMessageLog;
      commandPalette.setModalStack(inputHandler.modalStack);
      potionRow.setModalStack(inputHandler.modalStack);
      diagnosticModal.setModalStack(inputHandler.modalStack);
      feedbackModal.setModalStack(inputHandler.modalStack);
      keybindModal.setModalStack(inputHandler.modalStack);
      inputHandler.onToggleFeedback = () => toggleFeedback();
    } else {
      renderer.setEngine(engine);
      renderer.onResolveRadialLabel = resolveRadialMenuLabel;
      renderer.shopOverlay.onOpenCompendium = () => openMenuTab('bestiary');
      renderer.shopOverlay.onOpenRuneTree = () => {
        openRuneTree();
      };
      renderer.onPactModalRequested = () => openMenuTab('pacts');
      renderer.onOpenContainer = (container) => {
        openMenuTab('inventory');
        inventoryTab.showContainer(container);
      };
      inputHandler?.setEngine(engine);
      if (inputHandler) {
        inputHandler.characterMenuModal = characterMenuModal;
        characterMenuModal.setModalStack(inputHandler.modalStack);
        inputHandler.shopOverlay = renderer.shopOverlay;
        inputHandler.inspectOverlay = renderer.inspectOverlay;
        inputHandler.mapOverlay = renderer.mapOverlay;
        inputHandler.radialMenuOverlay = renderer.radialMenuOverlay;
        inputHandler.onToggleDiagnostics = toggleDiagnostics;
        inputHandler.onToggleFeedback = () => toggleFeedback();
        feedbackModal.setModalStack(inputHandler.modalStack);
        keybindModal.setModalStack(inputHandler.modalStack);
        inputHandler.contextHelp = contextHelp;
        inputHandler.commandPalette = commandPalette;
        inputHandler.onOpenRuneTree = openRuneTree;
        inputHandler.runeOfReturnDiscoveryModal = runeDiscoveryModal;
        runeDiscoveryModal.setModalStack(inputHandler.modalStack);
        inputHandler.onSaveAndExit = promptSaveAndQuit;
        inputHandler.onCastSpellById = castSpellById;
        inputHandler.onDrinkPotionSlot = drinkPotionSlot;
        inputHandler.onToggleCommandPalette = toggleCommandPalette;
      inputHandler.onContextAction = () => runContextAction(consoleExtras.currentAction);
      inputHandler.onCompanionCommand = runCompanionKey;
      inputHandler.onOpenMessageLog = openMessageLog;
        commandPalette.setModalStack(inputHandler.modalStack);
      potionRow.setModalStack(inputHandler.modalStack);
        diagnosticModal.setModalStack(inputHandler.modalStack);
      }
    }

    const navCtrl = new NavigationController(engine);
    renderer.navigationController = navCtrl;
    const restRunner = new AutoRestRunner(engine);
    if (inputHandler) {
      inputHandler.navigationController = navCtrl;
      inputHandler.autoRestRunner = restRunner;
    }

    window.__cotwRenderer = renderer;
    window.__cotwInputHandler = inputHandler;

    if (inputHandler) {
      inputHandler.enabled = true;
      inputHandler.onTriggerQuickSpell = (slot) => triggerQuickSpell(slot);
    }

    const origOnFloorChanged = engine.onFloorChanged;
    engine.onFloorChanged = (floor: number) => {
      if (origOnFloorChanged) origOnFloorChanged(floor);
      if (activeEngine && activeProfile) {
        autosaveManager.autosave(activeEngine, activeProfile);
      }
      renderer?.render();
    };

    window.__cotwInput = inputHandler;
    window.__cotwRenderer = renderer;

    if (widescreenLayout) {
      widescreenLayout.style.display = 'flex';
    }

    if (gameContainer) {
      gameContainer.style.display = 'flex';
      quickSpellsBar.mount(gameContainer);
      const frame = document.getElementById('game-frame');
      if (frame && !frame.contains(combatSidebar.element)) frame.appendChild(combatSidebar.element);
      const healthOrb = document.getElementById('hud-health-orb');
      if (healthOrb?.parentElement) potionRow.mount(healthOrb.parentElement, healthOrb.nextElementSibling);
    }
    quickSpellsBar.update(engine);
    potionRow.update(engine);
    combatSidebar.update(engine);
    const consoleEl = document.getElementById('gothic-action-console');
    if (consoleEl) consoleExtras.mount(consoleEl);
    consoleExtras.update(engine);

    updateHeaderInfo();
    mainMenu.hide();
    titleScreen.hide();
    renderer.resize();
    renderer.render();
  }

  // Hook up Save & Return button in HUD overlay
  saveTitleBtn?.addEventListener('click', () => {
    promptSaveAndQuit();
  });

  // Initialize Title Screen
  titleScreen = new TitleScreen({
    profileManager,
    autosaveManager,
    onLoadAutosave: (loadedEngine, loadedProfile) => {
      launchGame(loadedEngine, loadedProfile);
    },
    saveCodeModal,
    sagaShareModal,
    onResume: (profileId: string) => {
      const loaded = loadProfileOrNotify(profileId);
      if (loaded) {
        launchGame(loaded.engine, loaded.profile);
      } else {
        titleScreen.setStatus(`Error loading profile ${profileId}`);
      }
    },
    onNewCharacter: (name: string, options) => {
      // A new hero begins with the pack's prologue, when it has one.
      const created = profileManager.createCharacter(name, { ...options, manifest: activeManifest, prologue: true });
      launchGame(created.engine, created.profile);
      if (settingsManager.getSettings().controlsPrimerEnabled) {
        controlsPrimer.open();
        pushModal(controlsPrimer.id, controlsPrimer);
      }
    },
    onImport: (fileContent: string) => {
      importSaveWithValidation({
        content: fileContent,
        profileManager,
        activeManifestId: activeManifest.id,
        onSuccess: (p) => {
          titleScreen.refresh();
          titleScreen.setStatus(`Successfully imported hero: ${p.name}.`);
        },
        onError: (err) => {
          titleScreen.setStatus(`Import error: ${err}`);
        },
      });
    },
    onBackToMenu: () => {
      titleScreen.hide();
      mainMenu.show();
    },
  });

  const saveSlotModal = new SaveSlotModal({
    profileManager,
    autosaveManager,
    onLoadProfile: (profileId: string) => {
      try {
        const loaded = loadProfileOrNotify(profileId);
        if (loaded) {
          launchGame(loaded.engine, loaded.profile);
          return true;
        }
        return false;
      } catch (err) {
        diagnosticModal.showError(`Corrupted save file: ${(err as Error).message}`);
        return false;
      }
    },
    onLoadAutosave: (slot) => {
      try {
        const autosave = loadAutosaveOrNotify(slot);
        if (autosave) {
          launchGame(autosave.engine, autosave.profile);
          return true;
        }
        return false;
      } catch (err) {
        diagnosticModal.showError(`Corrupted autosave file: ${(err as Error).message}`);
        return false;
      }
    },
    onClose: () => {
      mainMenu.show();
    },
  });

  // Initialize Main Menu
  mainMenu = new MainMenu({
    profileManager,
    autosaveManager,
    onNewGame: () => {
      mainMenu.hide();
      titleScreen.show();
    },
    onLoadGame: () => {
      mainMenu.hide();
      saveSlotModal.open();
    },
    onContinue: (target) => {
      try {
        const loaded = target.kind === 'autosave' ? loadAutosaveOrNotify() : loadProfileOrNotify(target.profileId);
        if (loaded) {
          launchGame(loaded.engine, loaded.profile);
          return;
        }
      } catch (err) {
        showToast(`Error resuming save: ${(err as Error).message}`, 'error');
      }
      mainMenu.show();
    },
    onOpenSettings: () => {
      keybindModal.open();
    },
    onOpenHelp: () => {
      contextHelp.openGuide(activeManifest);
    },
    onOpenFeedback: () => {
      toggleFeedback();
    },
    onOpenValhalla: () => {
      mainMenu.hide();
      titleScreen.show();
      titleScreen.openValhalla();
    },
  });

  // Global viewport drag-and-drop for .cotw files on game container
  if (gameContainer) {
    setupSaveDragAndDrop({
      container: gameContainer,
      onSaveFile: (content, filename) => {
        importSaveWithValidation({
          content,
          filename,
          profileManager,
          activeManifestId: activeManifest.id,
          onSuccess: (p) => {
            const loaded = loadProfileOrNotify(p.id);
            if (loaded) {
              launchGame(loaded.engine, loaded.profile);
            }
          },
          onError: (err) => {
            showToast(`Save import error: ${err}`, 'error', 6000);
          },
          // Turned down in the warning: nothing to report.
          onCancel: () => undefined,
          modalStack: inputHandler?.modalStack,
        });
      },
    });
  }

  window.addEventListener('resize', () => {
    renderer?.resize();
  });

  // Negotiate storage persistence on boot and update UI indicator
  initStoragePersistence().then(() => {
    titleScreen.updateStorageIndicator();
    mainMenu.updateStorageIndicator();
  });

  // Taps and clicks drive the game on phones; persist before the game acts on them too.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (activeEngine && gameContainer?.style.display !== 'none') {
        const target = e.target as HTMLElement | null;
        const label = target?.id ? `#${target.id}` : (target?.tagName ?? 'screen').toLowerCase();
        sessionGuard.noteInput(activeEngine, `tap on ${label}`);
      }
    },
    { capture: true }
  );
  document.addEventListener('visibilitychange', () => sessionGuard.setVisible(document.visibilityState === 'visible'));
  window.addEventListener('pagehide', () => sessionGuard.end());

  // Show Main Menu on start
  mainMenu.show();

  // The last session stopped responding: offer a pre-filled report for it.
  if (unfinishedSession) {
    const s = unfinishedSession;
    flightRecorder.restoreRecovered(s.replay, s.events);
    feedbackModal.open({
      type: 'bug',
      category: 'Crash / Freeze',
      subject: 'Game stopped responding',
      error: `The game stopped responding after input '${s.lastInput}' (${s.heroName}, floor ${s.floor}, turn ${s.turn}).`,
      buildId: s.buildId,
      appVersion: s.appVersion,
    });
  }

  if (import.meta.env?.DEV) {
    console.log(`${brand.title} initialized with Main Menu & Settings.`);
  }
});
