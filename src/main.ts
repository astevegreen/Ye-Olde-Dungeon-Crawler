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
  AutoRestManager,
  SageService,
  SearchAction,
  serializeGame,
  WaitAction,
  shouldNotifyPlayer,
  BulkArchive,
  InMemoryAsyncStore,
  isTacticalEffect,
  ChannelRuneOfReturnAction,
  loadReplayState,
  replayActionTrail,
  isGameEvent,
  Monster,
  PotionItem,
  DrinkPotionAction,
  MovementAction,
  PickUpAction,
  CloseDoorAction,
  DisarmTrapAction,
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
import { runAndExplain } from './ui/actionFeedback';
import { FeedbackModal } from './ui/feedbackModal';
import { SagaShareModal } from './ui/sagaShareModal';
import { GameOverDialog } from './ui/gameOverDialog';
import { autoPickupTargets } from './ui/autoPickup';
import { EndingDialog } from './ui/endingDialog';
import { epitaphHtml } from './ui/epitaph';
import { ContextHelp } from './ui/help/contextHelp';
import { CommandPalette } from './ui/help/commandPalette';
import type { SpellbookEntry } from './rendering/targeting-overlay';
import { applyThemeTokens, setUiTextScale } from './rendering/theme';
import { applyUiScale, currentUiScale, resolveUiScale } from './ui/uiScale';
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
import { safely } from './ui/safeStep';
import { codesLabel, keyLabel } from './ui/keyLabel';
import { expandCompressedReplay } from './ui/replayCodec';
import { isReplayProfile, replayProfile } from './ui/replayProfile';
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
import { classifyLogLine, CriticalLineTracker, collapseRepeats, runText } from './ui/logClassifier';
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
import { COMMAND_CATALOG, type CommandId, type CommandMetadata } from './main/commandCatalog';

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
  const autosaveRun = (engine: GameEngine, profile: CharacterProfile): void => {
    if (!isReplayProfile(profile)) autosaveManager.autosave(engine, profile);
  };
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
  const bestiaryTab = new BestiaryTab({
    drawMonsterPicture: (canvas, def) => renderer?.drawMonsterPicture(canvas, def),
  });
  const pactsTab = new PactsTab();
  let inventoryTab: InventoryTab;

  // Asynchronous bulk tier (ARCHITECTURE.md §5): IndexedDB in the browser, in-memory when
  // the browser has none, so callers never branch on availability.
  const bulkArchive = new BulkArchive(getBrowserAsyncStore() ?? new InMemoryAsyncStore());

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
      focusRoot?: () => HTMLElement | null;
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
      // Forwarded, or Tab is trapped in a dialog it can't move through (R-ui-4).
      focusRoot: target.focusRoot ? () => target.focusRoot!() : undefined,
    });
  };

  const popModal = (id: string): void => {
    inputHandler?.modalStack.remove(id);
  };

  const loadProfileOrNotify = (profileId: string) => {
    const outcome = profileManager.loadCharacterResult(profileId);
    if (outcome.ok) return outcome.value;
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

      // A spell needing no aim (Identify on an item) fired and closed already: nothing to
      // put on the stack, which would only pause the world behind a dead entry (R-main-16).
      if (!renderer.targetingOverlay.isOpen) {
        void processVisualEffectsAndRender();
      } else if (inputHandler) {
        inputHandler.modalStack.push({
          id: 'targeting',
          get isOpen() { return renderer?.targetingOverlay.isOpen ?? false; },
          set isOpen(val: boolean) { if (!val) renderer?.targetingOverlay.close(); },
          handleKeyDown: (e: KeyboardEvent) => {
            if (!renderer || !activeEngine) return false;
            const handled = renderer.targetingOverlay.handleKeyDown(e, activeEngine);
            renderer.render();
            return handled;
          },
          // The overlay's `onClose` takes the entry off the stack, however it closed.
          close: () => renderer?.targetingOverlay.close(),
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
        runAndExplain(engine, new ClimbStairsAction(p));
        break;
      case 'close_door':
        engine.handlePlayerAction(new CloseDoorAction(p, action.x ?? p.x, action.y ?? p.y));
        break;
      case 'disarm':
        engine.handlePlayerAction(new DisarmTrapAction(p, action.x, action.y));
        break;
      case 'rest':
        // The same rest as R and the Rest button.
        startRest();
        return;
      case 'none':
        // F or the button with nothing worth doing here: say so rather than nothing.
        engine.log('Nothing to do here.');
        return;
    }
  }

  consoleExtras = new ConsoleExtras({
    onContextAction: (action) => {
      runContextAction(action);
      void processVisualEffectsAndRender();
    },
    onChip: (action) => {
      // Chips do what their commands do, not what a fixed key happens to: after a rebind,
      // a synthetic T disarmed a trap instead of channelling the rune (R-main-13).
      if (action === 'channel_rune') {
        if (activeEngine && playerCanAct()) {
          runAndExplain(activeEngine, new ChannelRuneOfReturnAction(activeEngine.player));
          void processVisualEffectsAndRender();
        }
      } else {
        openMenuTab('pacts');
      }
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

  // The UI scale (N8, tracker 4.5): the DOM's zoom and the canvas text, from the setting and
  // the window. A change re-fits the map to what the larger bars leave it.
  function syncUiScale(force = false): void {
    const scale = resolveUiScale(settingsManager.getSettings().uiScale, window.innerWidth, window.innerHeight);
    if (!force && scale === currentUiScale()) return;
    applyUiScale(scale);
    setUiTextScale(scale);
    renderer?.resize();
    renderer?.render();
  }
  syncUiScale(true);
  settingsManager.subscribe(() => syncUiScale());

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
    const xpText = p.isAtLevelCap ? `${brand.xpName} at its height` : `${p.xp}/${p.xpToNextLevel} ${brand.xpName}`;
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
    if (fill) fill.style.width = p.isAtLevelCap ? '100%' : `${Math.min(100, Math.round((p.xp / Math.max(1, p.xpToNextLevel)) * 100))}%`;

    const portrait = document.getElementById('hud-portrait');
    if (portrait) {
      portrait.title = [
        title ? `${heroName}, ${title}` : heroName,
        activeEngine.currentFloor === 0 ? `Town: ${brand.townName}` : `Floor ${activeEngine.currentFloor}`,
        p.isAtLevelCap ? `Level ${p.level} — ${xpText}` : `Level ${p.level} — ${xpText} to level ${p.level + 1}`,
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
  // Auto-pickup happens only on entering a tile, so what the hero drops stays dropped: coins
  // always, other items by the kinds ticked in the settings (`autoPickup.ts`, tracker 2.5).
  let lastAutoPickupTile: string | null = null;

  function checkAutoPickup(engine: GameEngine): void {
    if (!engine.player.isAlive()) return;
    const tileKey = `${engine.currentFloor}:${engine.player.x},${engine.player.y}`;
    if (tileKey === lastAutoPickupTile) return;
    lastAutoPickupTile = tileKey;
    for (const item of autoPickupTargets(engine, settingsManager.getSettings().autoPickup)) {
      engine.commandBus.dispatch({
        type: 'pickup_item',
        payload: { itemId: item.id, freeAction: true },
      });
      // Each pickup is an action of its own and replaces lastActionResult: its isolated
      // failure is shown here, or the next action would overwrite it unseen (R-main-8).
      reportPipelineError(engine.lastActionResult);
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

    // The last six lines as shown: a line repeated in a row is one line with its count.
    const runs = collapseRepeats(engine.messages).slice(-6);
    if (runs.length === 0) {
      streamEl.innerHTML = '<div class="log-line log-line-muted">Explore the dungeon.</div>';
      return;
    }

    streamEl.innerHTML = '';
    const total = runs.length;
    for (let i = 0; i < total; i++) {
      const { message: msg, count } = runs[i];
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
      lineEl.textContent = runText(line.text, count);
      streamEl.appendChild(lineEl);
    }
    streamEl.scrollTop = streamEl.scrollHeight;
  }

  /** Shows an action's isolated pipeline failure, once (ARCHITECTURE.md §4). */
  function reportPipelineError(result: ActionResult | null | undefined): void {
    if (result?.pipelineError && result !== lastReportedPipelineError) {
      lastReportedPipelineError = result;
      diagnosticModal.showError(result.message ?? 'An unexpected error occurred; the action could not be completed.');
    }
  }

  function reportRefreshError(err: Error, label: string): void {
    console.error(`[Render Loop Guard] ${label} failed:`, err);
    flightRecorder.recordError(err, { source: `processVisualEffectsAndRender: ${label}` });
  }

  async function processVisualEffectsAndRender(): Promise<void> {
    // Each step is guarded on its own: one throwing HUD widget must not skip the rest,
    // the effect playback or the map redraw (R-main-8).
    const step = (label: string, fn: () => void): void => {
      safely(label, fn, reportRefreshError);
    };
    step('pipeline error', () => reportPipelineError(activeEngine?.lastActionResult));
    step('header', () => updateHeaderInfo());
    const engine = activeEngine;
    if (engine) {
      step('auto-pickup', () => checkAutoPickup(engine));
      step('floating text', () => updateCombatFloatingText(engine));
      step('console', () => updateGothicConsole(engine));
      step('message log', () => updateMessageLog(engine));
      step('quick spells', () => quickSpellsBar.update(engine));
      step('potion row', () => potionRow.update(engine));
      // The prologue's action cues: the slot for the move the moment calls for glows.
      step('action cues', () => {
        const cues = settingsManager.getSettings().hintsEnabled ? findActionCues(engine) : null;
        potionRow.setCue(cues?.drinkSlot ?? null);
        quickSpellsBar.setCue(cues?.castSlot ?? null);
      });
      step('combat sidebar', () => combatSidebar.update(engine));
      step('console extras', () => consoleExtras.update(engine));
      step('hints', () => {
        if (firstTimeHints.hasUnseen(engine)) firstTimeHints.offer(engine, hintsMetByState(engine));
      });
      // Periodic background autosave every 50 turns
      step('autosave', () => {
        if (activeProfile && autosaveManager.shouldAutosave(engine.turnCount)) {
          autosaveRun(engine, activeProfile);
        }
      });
    }
    try {
      if (activeEngine && renderer && renderer.fxRunner.mode !== 'instant') {
        const pending = activeEngine.consumePendingVisualEffects();
        if (pending.length > 0) {
          // Only tactical effects gate input (ARCHITECTURE.md §4); ambient ones play on
          // through the non-blocking queue while the player acts.
          const hasTactical = pending.some(isTacticalEffect);
          // This batch's own hold: a later batch keeps input locked until it ends too.
          const release = hasTactical ? inputHandler?.holdInput() : undefined;
          try {
            await renderer.fxRunner.playQueue(pending);
          } finally {
            release?.();
          }
        }
      }
    } catch (err) {
      reportRefreshError(err instanceof Error ? err : new Error(String(err)), 'visual effects');
    }
    step('render', () => renderer?.render());
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
    // The live run is saved before the report's engine is built (R-main-11).
    saveRunOnScreen('save before report load');
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
    // Under its own id: the report's is its hero's, whose real save a later save would overwrite.
    launchGame(engine, replayProfile(profile));
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
      // The restored hero replaces the live run: save that run first, as Save & Quit does (R-main-11).
      saveRunOnScreen('save before restore');
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
    pushModal('save-code', { isOpen: () => saveCodeModal.isOpen(), close: () => saveCodeModal.close(), focusRoot: () => saveCodeModal.focusRoot() });
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
    diagnosticModal.toggle();
  });

  mapBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      renderer.inspectOverlay.close();
      renderer.targetingOverlay.close();
      renderer.mapOverlay.toggle(activeEngine);
      renderer.render();
    }
  });

  // Through the input handler, as F1 is, so the card is on the modal stack (§6).
  helpBtn?.addEventListener('click', () => {
    if (contextHelp.isOpen) contextHelp.close();
    else if (activeEngine) inputHandler?.openContextHelp();
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

  /**
   * The one rest (AutoRestManager), as the R key runs it: paced by the runner, the whole HUD
   * redrawn each step, and once at the start so a refusal ("Cannot rest now!") shows.
   */
  function startRest(): void {
    if (!activeEngine || !renderer) return;
    const refresh = (): void => void processVisualEffectsAndRender();
    if (inputHandler?.autoRestRunner) inputHandler.autoRestRunner.start({ onStep: refresh, onComplete: refresh });
    else AutoRestManager.executeFullRest(activeEngine);
    refresh();
  }

  /**
   * Whether a HUD button or the mouse may act now: the keys' own gate. No dialog up (the
   * F1 card and the aiming reticle leave the HUD clickable while the world is paused), no
   * effect playback holding input, input enabled.
   */
  function playerCanAct(): boolean {
    return (
      !!activeEngine &&
      !!inputHandler &&
      inputHandler.enabled &&
      !inputHandler.isInputLocked &&
      inputHandler.modalStack.size === 0 &&
      !activeEngine.isPaused
    );
  }

  hudRestBtn?.addEventListener('click', () => {
    if (playerCanAct()) startRest();
  });

  hudSearchBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && playerCanAct()) {
      activeEngine.handlePlayerAction(new SearchAction(activeEngine.player, activeEngine.rng, 2));
      void processVisualEffectsAndRender();
    }
  });

  hudWaitBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && playerCanAct()) {
      activeEngine.handlePlayerAction(new WaitAction(activeEngine.player));
      void processVisualEffectsAndRender();
    }
  });

  hudStairsBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && playerCanAct()) {
      runAndExplain(activeEngine, new ClimbStairsAction(activeEngine.player));
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

  /** A save the storage refused (a full quota): recorded and told, never fatal (R-stor-9). */
  function reportSaveFailure(err: Error, label: string): void {
    console.error(`[Save] ${label} failed:`, err);
    flightRecorder.recordError(err, { source: label });
    showToast(`Could not save: ${err.message}`, 'error', 8000);
  }

  /** Saves the live run as Save & Quit does; a write that fails cannot stop the caller. */
  function saveLiveRun(label: string): void {
    if (!activeEngine || !activeProfile) return;
    const engine = activeEngine;
    const profile = activeProfile;
    safely(label, () => profileManager.saveCharacter(engine, profile), reportSaveFailure);
    autosaveRun(engine, profile);
  }

  /**
   * A restore that starts another run (a dropped save file, a pasted save code, an F2
   * report) saves the run on screen first (R-main-11). From the title screen the run was
   * saved on the way out, and its hero may since have been deleted, so nothing is written.
   */
  function saveRunOnScreen(label: string): void {
    if (gameContainer?.style.display !== 'none') saveLiveRun(label);
  }

  function saveAndReturnToTitle(): void {
    sessionGuard.end();
    saveLiveRun('save and quit');
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
      inputHandler.reset();
    }
    // The run being replaced no longer speaks for the hero: its death would mark the new
    // hero fallen and open the game-over screen over the new run (R-main-6).
    if (activeEngine && activeEngine !== engine) activeEngine.gameState.onStateChanged = undefined;
    masteryModal.clearQueue();
    autosaveManager.startRun(engine.turnCount);
    activeEngine = engine;
    activeProfile = profile;
    window.__cotwEngine = engine;
    window.__cotwSaveAndReturn = saveAndReturnToTitle;

    // Wire GameState victory/defeat listener
    // The writes come first but cannot stop the screen: this is the only way to the death
    // and victory screens, and a full storage quota throws (R-stor-9).
    engine.gameState.onStateChanged = (status, summary) => {
      if (summary.entry && !hallOfFame.recordRun(summary.entry)) {
        showToast(`This run could not be added to the ${brand.hallOfFameName}: the browser's storage refused it.`, 'error', 8000);
      }
      if (activeProfile) {
        const profile = activeProfile;
        profile.questStatus = status;
        if (summary.entry?.epitaph) {
          profile.epitaph = summary.entry.epitaph;
        }
        safely('game-over save', () => profileManager.saveCharacter(engine, profile), reportSaveFailure);
      }
      showGameOverModal(status, summary);
    };


    firstTimeHints.clear();
    lastObservedPlayerHp = engine.player.hp;
    lastAutoPickupTile = `${engine.currentFloor}:${engine.player.x},${engine.player.y}`;
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

    // The modal puts itself on the stack and takes itself off (§6).
    const toggleDiagnostics = () => diagnosticModal.toggle();

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
        inputHandler?.openContextHelp();
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
        const res = (eng.commandBus.dispatch({ type: 'consolidate_coins' }).data as { count: number } | undefined) ?? { count: 0 };
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
      rest: () => startRest(),
      search: (eng) => {
        const act = new SearchAction(eng.player, eng.rng);
        eng.handlePlayerAction(act);
        void processVisualEffectsAndRender();
      },
      stairs: (eng) => {
        // Says why when it can't (not on stairs), as the keys and HUD button do.
        runAndExplain(eng, new ClimbStairsAction(eng.player));
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
          eng.commandBus.dispatch({ type: 'summon_companion', payload: { companionId: defId } });
        } else {
          eng.log('No companion is available in this campaign.');
        }
        renderer?.render();
      },
      dismiss_companion: (eng) => {
        eng.commandBus.dispatch({ type: 'dismiss_companion' });
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
        runAndExplain(eng, new ChannelRuneOfReturnAction(eng.player));
        void processVisualEffectsAndRender();
      },
    };

    // Each chip reads its action's keys as bound now, so it follows a rebind (R-main-4).
    commandPalette.registerCommands(
      COMMAND_CATALOG.map((meta: CommandMetadata & { id: CommandId }) => ({
        ...meta,
        shortcut: () => [meta.binding ? codesLabel(settingsManager.getCodesForAction(meta.binding)) : '', meta.fixedKeys ?? ''].filter(Boolean).join(' / '),
        execute: commandExecutors[meta.id],
      }))
    );

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
      renderer.mouseAimEnabled = settingsManager.getSettings().mouseAimEnabled;
      renderer.torchlightEnabled = settingsManager.getSettings().torchlightEnabled;
      renderer.radialMenuOverlay.slots = settingsManager.getSettings().radialMenuSlots;
      renderer.onResolveRadialLabel = resolveRadialMenuLabel;
      renderer.onFocusEntityChanged = (id) => combatSidebar.setFocusedEntity(id);
      // A click while aiming fires as Enter does (tracker 4.4): the spell, the targeting
      // entry off the stack (the overlay's `onClose`), and the action's effects played.
      renderer.onAimFire = () => {
        if (!renderer || !activeEngine || !renderer.targetingOverlay.isOpen) return;
        renderer.targetingOverlay.confirmFire(activeEngine);
        void processVisualEffectsAndRender();
      };
      // Every way the aim closes (fire, Escape, the HUD Look or Map button, the palette)
      // takes its stack entry with it; the effect lock is the effects' own (R-rend-7).
      renderer.targetingOverlay.onClose = () => inputHandler?.modalStack.remove('targeting');
      settingsManager.subscribe((settings) => {
        if (renderer) {
          renderer.mouseVectoringEnabled = settings.mouseVectoringEnabled;
          renderer.mouseAimEnabled = settings.mouseAimEnabled;
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
      // The mouse acts through the keys' gate and their post-action refresh (R-main-1).
      renderer.canAct = playerCanAct;
      renderer.onActionProcessed = () => void processVisualEffectsAndRender();
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
        autosaveRun(activeEngine, activeProfile);
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
    onLoadAutosave: () => {
      const loaded = loadAutosaveOrNotify();
      if (loaded) launchGame(loaded.engine, loaded.profile);
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
            // The dropped hero replaces the live run: save that run first, as Save & Quit does (R-main-11).
            saveRunOnScreen('save before restore');
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
    syncUiScale();
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
