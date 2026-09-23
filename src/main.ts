import {
  AutosaveManager,
  CastSpellAction,
  ClimbStairsAction,
  CURRENT_SCHEMA_VERSION,
  flightRecorder,
  GameEngine,
  getActiveTitle,
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
} from './engine';
import type {
  ActionResult,
  CharacterProfile,
  GameEvent,
  SpellDefinition,
  HallOfFameEntry,
} from './engine';
import { CanvasRenderer } from './rendering/canvas-renderer';
import { InputHandler } from './rendering/input-handler';
import { TitleScreen } from './ui/title-screen';
import { DiagnosticModal } from './ui/diagnostic-modal';
import { SagaShareModal } from './ui/sagaShareModal';
import { ContextHelp } from './ui/help/contextHelp';
import { CompendiumModal } from './ui/help/compendiumModal';
import { CommandPalette } from './ui/help/commandPalette';
import type { SpellbookEntry } from './rendering/targeting-overlay';
import { applyThemeTokens, COTW_THEME_TOKENS } from './rendering/theme';
import { ChoiceModal } from './ui/choiceModal';
import { PactModal } from './ui/pactModal';
import { LevelUpModal } from './ui/levelUpModal';
import { RuneOfReturnDiscoveryModal } from './ui/runeOfReturnDiscoveryModal';
import { RuneOfReturnTreeModal } from './ui/runeOfReturnTreeModal';
import { AutoRestRunner } from './ui/autoRestRunner';
import { NavigationController } from './ui/navigation';
import { cotwManifest } from './content/cotw';
import { warcraftManifest } from './content/warcraft';
import { WARCRAFT_THEME_TOKENS } from './content/warcraft/theme';
import { initStoragePersistence } from './ui/persistenceInit';
import { SaveCodeModal } from './ui/saveCodeModal';
import { SaveQuitModal } from './ui/saveQuitModal';
import { SaveSlotModal } from './ui/saveSlotModal';
import { showToast } from './ui/toast';
import { getBrowserAsyncStore } from './ui/indexedDbStore';
import { setupSaveDragAndDrop, importSaveWithValidation } from './ui/saveImporter';
import { defaultPlatformAdapter, getBrowserStorage } from './ui/platform';
import { applyDocumentBranding, resolveBranding } from './ui/branding';
import {
  CharacterMenuModal,
  CharacterTab,
  FlankModuleTab,
  CompendiumTabAdapter,
  PactTabAdapter,
  SpellbookTabAdapter,
} from './ui/characterMenu';
import { InventoryTabAdapter } from './rendering/inventoryTabAdapter';
import './ui/styles/base.css';
import './ui/styles/flanks.css';
import './ui/styles/layout.css';
import { FlankManager } from './ui/flanks/flankManager';
import { WorldLedgerModule } from './ui/flanks/worldLedgerModule';
import { JournalModule } from './ui/flanks/journalModule';
import { QuickSpellsBar } from './ui/quickSpellsBar';
import { SpellbookModal } from './ui/spellbookModal';
import { BottomStatusBar } from './ui/bottomStatusBar';
import { SettingsManager } from './ui/settings/settingsManager';
import type { RadialMenuSlotConfig } from './ui/settings/settingsManager';
import { KeybindModal } from './ui/settings/keybindModal';
import { MainMenu } from './ui/menus/mainMenu';
import { COMMAND_CATALOG, type CommandId } from './main/commandCatalog';

declare global {
  interface ImportMetaEnv {
    /** Content pack selected at build time (vite.config.ts). */
    readonly VITE_THEME?: string;
    /** package.json version, injected by vite.config.ts. */
    readonly VITE_APP_VERSION?: string;
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
const activeThemeTokens = targetTheme === 'warcraft' ? WARCRAFT_THEME_TOKENS : COTW_THEME_TOKENS;
const brand = resolveBranding(activeManifest);

window.addEventListener('DOMContentLoaded', () => {
  applyThemeTokens(activeThemeTokens);
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
  const leftFlank = document.getElementById('left-flank');
  const rightFlank = document.getElementById('right-flank');

  const flankManager = new FlankManager();
  flankManager.registerModule(new WorldLedgerModule());
  flankManager.registerModule(new JournalModule());

  const gameContainer = document.getElementById('game-container');
  const saveTitleBtn = document.getElementById('btn-save-title');
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
  const compendiumModal = new CompendiumModal();
  const commandPalette = new CommandPalette();
  const choiceModal = new ChoiceModal(() => {
    popModal('choice');
    renderer?.render();
  });
  const pactModal = new PactModal();
  const levelUpModal = new LevelUpModal(() => {
    popModal(levelUpModal.id);
    renderer?.render();
  });
  const runeTreeModal = new RuneOfReturnTreeModal(() => {
    popModal(runeTreeModal.id);
    renderer?.render();
  });
  const runeDiscoveryModal = new RuneOfReturnDiscoveryModal({
    onClose: () => {
      popModal(runeDiscoveryModal.id);
      renderer?.render();
    },
    onOpenTree: () => {
      openRuneTree();
    },
  });
  const autosaveManager = new AutosaveManager(getBrowserStorage() ?? undefined, activeManifest);

  let characterMenuModal: CharacterMenuModal;
  const characterTab = new CharacterTab();
  characterTab.onAllocateCallback = () => {
    updateHeaderInfo();
    renderer?.render();
  };
  const storyTab = new FlankModuleTab([new JournalModule(), new WorldLedgerModule()]);
  const bestiaryTab = new CompendiumTabAdapter(compendiumModal);
  const pactsTab = new PactTabAdapter(pactModal);
  let spellbookTab: SpellbookTabAdapter;
  let inventoryTab: InventoryTabAdapter;

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

  const loadAutosaveOrNotify = () => {
    const outcome = autosaveManager.loadAutosaveResult(activeManifest);
    if (outcome.ok) return outcome.value;
    if (shouldNotifyPlayer(outcome)) showToast(outcome.message, 'error', 6000);
    return null;
  };

  let spellbookModal: SpellbookModal;
  let quickSpellsBar: QuickSpellsBar;
  let bottomStatusBar: BottomStatusBar;

  function openSpellbook(): void {
    if (!activeEngine) return;
    if (characterMenuModal) {
      if (inputHandler) {
        inputHandler.modalStack.push(characterMenuModal);
      }
      characterMenuModal.open('spellbook');
      return;
    }
    if (renderer) {
      renderer.inventoryOverlay.close();
      renderer.inspectOverlay.close();
      renderer.targetingOverlay.close();
      if (inputHandler) {
        inputHandler.modalStack.remove('targeting');
      }
    }
    spellbookModal.open(activeEngine);
    if (inputHandler) {
      inputHandler.modalStack.push(spellbookModal);
    }
  }

  function openRuneTree(): void {
    if (!activeEngine) return;
    if (renderer) {
      renderer.inventoryOverlay.close();
      renderer.inspectOverlay.close();
      renderer.targetingOverlay.close();
    }
    if (inputHandler) {
      runeTreeModal.setModalStack(inputHandler.modalStack);
      runeTreeModal.open(activeEngine, () => {
        popModal(runeTreeModal.id);
        renderer?.render();
      });
      pushModal(runeTreeModal.id, runeTreeModal);
    } else {
      runeTreeModal.open(activeEngine);
    }
    renderer?.render();
  }

  window.addEventListener('open_rune_of_return_tree', () => {
    openRuneTree();
  });

  function castOrTargetSpell(spell: SpellDefinition): void {
    if (!activeEngine || !renderer) return;
    if (activeEngine.player.mana < (spell.manaCost ?? 0)) {
      activeEngine.log(`Insufficient mana to cast ${spell.name} (${activeEngine.player.mana}/${spell.manaCost} MP).`);
      renderer.render();
      return;
    }

    if (spell.targetingMode === 'self' || spell.targetType === 'self') {
      activeEngine.handlePlayerAction(
        new CastSpellAction(activeEngine.player, spell.id, activeEngine.player.x, activeEngine.player.y)
      );
      quickSpellsBar.update(activeEngine);
      bottomStatusBar.update(activeEngine);
      void processVisualEffectsAndRender();
    } else {
      const entry: SpellbookEntry = {
        key: '',
        type: 'spell',
        id: spell.id,
        name: spell.name,
        manaCost: spell.manaCost,
        spellDef: spell,
      };
      renderer.inventoryOverlay.close();
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

  quickSpellsBar = new QuickSpellsBar({
    onTriggerSlot: (slotIdx) => triggerQuickSpell(slotIdx),
    onOpenSpellbook: () => openSpellbook(),
  });

  spellbookModal = new SpellbookModal({
    onCastSpell: (spell) => {
      if (characterMenuModal?.isOpen) {
        characterMenuModal.close();
      }
      if (inputHandler) {
        inputHandler.modalStack.remove('spellbook');
        inputHandler.isInputLocked = false;
      }
      castOrTargetSpell(spell);
    },
    onQuickSpellsChanged: () => {
      if (activeEngine) quickSpellsBar.update(activeEngine);
    },
    onClose: () => {
      if (inputHandler) {
        inputHandler.modalStack.remove('spellbook');
        inputHandler.isInputLocked = false;
      }
      if (typeof document !== 'undefined') {
        document.getElementById('game-canvas')?.focus();
      }
      renderer?.render();
    },
  });
  spellbookTab = new SpellbookTabAdapter(spellbookModal);
  spellbookModal.mount(document.body);

  bottomStatusBar = new BottomStatusBar();

  function updateHeaderInfo(): void {
    if (!activeEngine) return;
    const nameEl = document.getElementById('header-name');
    const floorEl = document.getElementById('header-floor');
    if (nameEl) {
      const heroName = activeProfile?.name || activeEngine.player.name || 'Hero';
      const title = getActiveTitle(activeEngine);
      nameEl.textContent = title ? `🛡️ ${heroName}, ${title}` : `🛡️ ${heroName}`;
    }
    if (floorEl) {
      floorEl.textContent = activeEngine.currentFloor === 0 ? `Town (${brand.townName})` : `Floor ${activeEngine.currentFloor}`;
    }
    // Position/turn were previously also shown here, duplicating both the canvas's own
    // HUD and each other (HUD overhaul). The one remaining turn readout lives in
    // BottomStatusBar's ground-status-bar (`.ground-status-turn`, updated per player turn).
  }

  function renderFlanks(): void {
    if (!activeEngine) return;
    flankManager.render({
      engine: activeEngine,
      worldState: activeEngine.worldState,
      player: activeEngine.player,
      map: activeEngine.map,
      currentFloor: activeEngine.currentFloor,
      turnCount: activeEngine.turnCount,
      manifest: activeEngine.manifest ?? activeManifest,
      pacts: activeEngine.pacts,
    });
  }

  // The engine's result is read-only here (§7.2), so remember which failed result was already shown.
  let lastReportedPipelineError: ActionResult | null = null;

  async function processVisualEffectsAndRender(): Promise<void> {
    try {
      const lastResult = activeEngine?.lastActionResult;
      if (lastResult?.pipelineError && lastResult !== lastReportedPipelineError) {
        lastReportedPipelineError = lastResult;
        diagnosticModal.showError(lastResult.message ?? 'An unexpected error occurred; the action could not be completed.');
      }
      updateHeaderInfo();
      renderFlanks();
      if (activeEngine) {
        quickSpellsBar.update(activeEngine);
        bottomStatusBar.update(activeEngine);
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
  });

  const sagaShareModal = new SagaShareModal({
    leaderboard: new Leaderboard(getBrowserStorage() ?? undefined),
    branding: brand,
    onSagaInscribed: (entry) => {
      titleScreen?.refreshValhalla();
      titleScreen?.setStatus(`Inscribed ${entry.heroName}'s saga into the ${brand.hallOfFameName}! 🏆`);
    },
    onClose: () => {
      if (inputHandler && activeEngine && gameContainer && gameContainer.style.display !== 'none') {
        inputHandler.enabled = true;
      }
    },
  });

  const keybindModal = new KeybindModal({
    settingsManager,
    onClose: () => {
      popModal('keybinds');
    },
  });

  const saveQuitModal = new SaveQuitModal({
    profileManager,
    saveCodeModal,
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
      if (activeEngine) {
        compendiumModal.open(activeEngine);
      }
    },
  });

  function promptSaveAndQuit(): void {
    if (activeEngine && activeProfile) {
      saveQuitModal.open(activeEngine, activeProfile);
      pushModal('save-quit', saveQuitModal);
    } else {
      saveAndReturnToTitle();
    }
  }

  devDiagBtn?.addEventListener('click', () => {
    diagnosticModal.open();
  });

  mapBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      renderer.inventoryOverlay.close();
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
        renderer?.inventoryOverlay,
        renderer?.targetingOverlay,
        renderer?.shopOverlay,
        renderer?.inspectOverlay,
        renderer?.mapOverlay
      );
    }
  });

  compendiumBtn?.addEventListener('click', () => {
    if (activeEngine) {
      if (characterMenuModal) {
        if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
        characterMenuModal.open('bestiary');
      } else {
        compendiumModal.toggle(activeEngine);
      }
    }
  });

  cmdPaletteBtn?.addEventListener('click', () => {
    if (activeEngine) {
      commandPalette.toggle(activeEngine);
    }
  });

  hudInvBtn?.addEventListener('click', () => {
    if (activeEngine && renderer) {
      if (inputHandler) {
        inputHandler.toggleInventory();
      } else {
        renderer.inventoryOverlay.toggle(activeEngine);
      }
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
      renderer.inventoryOverlay.close();
      renderer.targetingOverlay.close();
      renderer.mapOverlay.close();
      renderer.inspectOverlay.open(activeEngine);
      renderer.render();
    }
  });

  hudPactsBtn?.addEventListener('click', () => {
    if (activeEngine && renderer && inputHandler) {
      inputHandler.togglePactModal();
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

  // Global uncaught error & rejection crash safety (HR-6)
  const onGlobalError = (event: ErrorEvent) => {
    const err = event.error || new Error(String(event.message));
    flightRecorder.recordError(err, { source: event.filename, lineno: event.lineno, colno: event.colno });
    // Archive the log off the synchronous quota; failure here must never mask the crash.
    void bulkArchive
      .archiveFlightLog(`crash-${flightRecorder.getEvents().length}-${err.name}`, flightRecorder.getEvents())
      .catch(() => undefined);
    diagnosticModal.showCrash(err);
  };

  const onGlobalUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    flightRecorder.recordError(reason, { type: 'unhandledrejection' });
    diagnosticModal.showCrash(reason);
  };

  window.addEventListener('error', onGlobalError);
  window.addEventListener('unhandledrejection', onGlobalUnhandledRejection);

  window.__teardownGlobalErrorHandlers = () => {
    window.removeEventListener('error', onGlobalError);
    window.removeEventListener('unhandledrejection', onGlobalUnhandledRejection);
  };

  function saveAndReturnToTitle(): void {
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
    flankManager.destroy();
    if (inputHandler) {
      inputHandler.enabled = false;
    }
    mainMenu.show();
  }

  let currentGameOverEntry: HallOfFameEntry | null = null;

  function showGameOverModal(status: 'victorious' | 'fallen' | 'active', summary: any): void {
    const modal = document.getElementById('game-over-modal');
    const icon = document.getElementById('game-over-icon');
    const title = document.getElementById('game-over-title');
    const banner = document.getElementById('game-over-banner');
    const bannerTitle = document.getElementById('game-over-banner-title');
    const bannerSub = document.getElementById('game-over-banner-sub');
    const pre = document.getElementById('game-over-summary');
    const scoreBadge = document.getElementById('game-over-score-badge');
    const autosaveBtn = document.getElementById('btn-game-over-autosave') as HTMLButtonElement | null;

    if (!modal) return;

    if (inputHandler) {
      inputHandler.enabled = false;
    }

    currentGameOverEntry = summary.entry ?? null;

    if (status === 'victorious') {
      if (icon) icon.textContent = '🏆';
      if (title) title.textContent = brand.victoryTitle;
      if (banner) banner.style.background = '#15803d';
      if (bannerTitle) bannerTitle.textContent = 'VICTORIOUS';
      if (bannerSub) bannerSub.textContent = brand.victoryBanner;
    } else {
      if (icon) icon.textContent = '✝';
      if (title) title.textContent = 'Fallen in Battle';
      if (banner) banner.style.background = '#7f1d1d';
      if (bannerTitle) bannerTitle.textContent = 'FALLEN IN BATTLE';
      if (bannerSub) bannerSub.textContent = brand.fallenBanner;
    }

    if (summary.entry) {
      if (pre) pre.textContent = Leaderboard.formatEpitaph(summary.entry);
      if (scoreBadge) scoreBadge.textContent = `${brand.hallOfFameShortName} Score: ${summary.entry.score.toLocaleString()} PTS`;
    }

    if (autosaveBtn) {
      if (autosaveManager.hasAutosave()) {
        const meta = autosaveManager.getAutosaveMetadata();
        autosaveBtn.style.display = 'inline-block';
        autosaveBtn.textContent = `⚡ Load Autosave (${meta?.profileName ?? 'Hero'} - F${meta?.floor ?? 1})`;
      } else {
        autosaveBtn.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
  }

  const gameOverAutosaveBtn = document.getElementById('btn-game-over-autosave');
  gameOverAutosaveBtn?.addEventListener('click', () => {
    const loaded = loadAutosaveOrNotify();
    if (loaded) {
      const modal = document.getElementById('game-over-modal');
      if (modal) modal.style.display = 'none';
      launchGame(loaded.engine, loaded.profile);
    }
  });

  const gameOverReturnBtn = document.getElementById('btn-game-over-return');
  gameOverReturnBtn?.addEventListener('click', () => {
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';
    saveAndReturnToTitle();
  });

  const gameOverShareBtn = document.getElementById('btn-game-over-share');
  gameOverShareBtn?.addEventListener('click', () => {
    if (currentGameOverEntry) {
      sagaShareModal.openShare(currentGameOverEntry);
    }
  });

  const gameOverExportBtn = document.getElementById('btn-game-over-export');
  gameOverExportBtn?.addEventListener('click', () => {
    if (activeProfile) {
      try {
        const fileName = profileManager.triggerCotwDownload(activeProfile.id, defaultPlatformAdapter);
        const pre = document.getElementById('game-over-summary');
        if (pre) {
          pre.textContent += `\n\n[ARCHIVED] Character save exported to ${fileName} 💾`;
        }
      } catch (err) {
        alert(`Export failed: ${(err as Error).message}`);
      }
    }
  });

  function launchGame(engine: GameEngine, profile: CharacterProfile): void {
    activeEngine = engine;
    activeProfile = profile;
    window.__cotwEngine = engine;
    window.__cotwSaveAndReturn = saveAndReturnToTitle;

    // Wire GameState victory/defeat listener
    engine.gameState.onStateChanged = (status, summary) => {
      if (activeProfile) {
        activeProfile.questStatus = status;
        if (summary.entry?.epitaph) {
          activeProfile.epitaph = summary.entry.epitaph;
        }
        profileManager.saveCharacter(engine, activeProfile);
      }
      showGameOverModal(status, summary);
    };

    // Wire Player Level Up and Game Events
    levelUpModal.setOnAllocate(() => {
      if (activeEngine) bottomStatusBar.update(activeEngine);
      renderer?.render();
    });

    engine.onGameEvent = (event: GameEvent) => {
      if (event.type === 'player_leveled_up') {
        if (inputHandler) {
          levelUpModal.setModalStack(inputHandler.modalStack);
          levelUpModal.open(engine);
          inputHandler.modalStack.push(levelUpModal);
        } else {
          levelUpModal.open(engine);
        }
        renderer?.render();
      } else if (event.type === 'rune_of_return_discovered') {
        if (inputHandler) {
          runeDiscoveryModal.setModalStack(inputHandler.modalStack);
          runeDiscoveryModal.open(engine, () => {
            popModal(runeDiscoveryModal.id);
            renderer?.render();
          });
          pushModal(runeDiscoveryModal.id, runeDiscoveryModal);
        } else {
          runeDiscoveryModal.open(engine);
        }
        renderer?.render();
      }
    };

    // Wire interactive Choice modal
    engine.onChoiceInteract = (choice, onOptionSelected, onCancel) => {
      pushModal('choice', choiceModal);
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
          renderer.inventoryOverlay.close();
          renderer.targetingOverlay.close();
          renderer.inspectOverlay.open(eng);
          renderer.render();
        }
      },
      spellbook: (eng) => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('spellbook');
        } else if (renderer) {
          renderer.inventoryOverlay.close();
          renderer.inspectOverlay.close();
          renderer.targetingOverlay.openSpellbook(eng);
          renderer.render();
        }
      },
      inventory: (eng) => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('inventory');
          renderer?.render();
        } else if (renderer) {
          renderer.inventoryOverlay.toggle(eng);
          renderer.render();
        }
      },
      compendium: (eng) => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('bestiary');
        } else {
          compendiumModal.open(eng);
        }
      },
      'allocate-stats': (eng) => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('character');
        } else if (inputHandler) {
          levelUpModal.setModalStack(inputHandler.modalStack);
          levelUpModal.open(eng);
          inputHandler.modalStack.push(levelUpModal);
        } else {
          levelUpModal.open(eng);
        }
      },
      character_menu: () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('character');
        }
      },
      pacts: () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('pacts');
        }
      },
      story: () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('story');
        }
      },
      'run-advisory': (eng) => {
        const rep = SageService.getRunAdvisory(eng);
        eng.log(`*** SAGE ADVISORY (Floor ${rep.targetFloor}): ${rep.summary} ***`);
        for (const w of rep.warnings) {
          eng.log(`[${w.severity.toUpperCase()}] ${w.title}: ${w.recommendation}`);
        }
        contextHelp.open(eng, renderer?.inventoryOverlay, renderer?.targetingOverlay, renderer?.shopOverlay, renderer?.inspectOverlay);
        renderer?.render();
      },
      help: (eng) => {
        contextHelp.open(eng, renderer?.inventoryOverlay, renderer?.targetingOverlay, renderer?.shopOverlay, renderer?.inspectOverlay);
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
          renderer.inventoryOverlay.close();
          renderer.inspectOverlay.close();
          renderer.targetingOverlay.close();
          renderer.mapOverlay.open(eng);
          renderer.render();
        }
      },
      diagnostics: () => {
        toggleDiagnostics();
      },
      'save-quit': () => {
        promptSaveAndQuit();
      },
      'export-save': (eng) => {
        if (activeProfile) {
          try {
            const fileName = profileManager.triggerCotwDownload(activeProfile.id, defaultPlatformAdapter);
            eng.log(`Exported character save to ${fileName} 💾`);
            renderer?.render();
          } catch (err) {
            eng.log(`Export failed: ${(err as Error).message}`);
          }
        }
      },
      'save-code': () => {
        if (activeEngine && activeProfile) {
          const saveData = serializeGame(activeEngine, activeProfile);
          const env = {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            contentManifestId: activeManifest.id,
            timestamp: Date.now(),
            data: saveData,
          };
          saveCodeModal.open('copy', env);
          pushModal('save-code', { isOpen: () => saveCodeModal.isOpen(), close: () => saveCodeModal.close() });
        }
      },
      settings: () => {
        keybindModal.open();
        pushModal('keybinds', keybindModal);
      },
      summon_companion: (eng) => {
        const defId = eng.manifest?.companions?.[0]?.id;
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

    applyThemeTokens(engine.manifest?.theme ?? COTW_THEME_TOKENS);

    if (!renderer) {
      renderer = new CanvasRenderer(canvas!, engine);
      inventoryTab = new InventoryTabAdapter(renderer.inventoryOverlay, renderer);
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
        },
        renderer.viewport,
        canvas ?? undefined
      );
      renderer.mouseVectoringEnabled = settingsManager.getSettings().mouseVectoringEnabled;
      renderer.radialMenuOverlay.slots = settingsManager.getSettings().radialMenuSlots;
      renderer.onResolveRadialLabel = resolveRadialMenuLabel;
      settingsManager.subscribe((settings) => {
        if (renderer) {
          renderer.mouseVectoringEnabled = settings.mouseVectoringEnabled;
          renderer.radialMenuOverlay.slots = settings.radialMenuSlots;
          renderer.render();
        }
      });
      renderer.shopOverlay.onOpenCompendium = () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('bestiary');
        } else {
          compendiumModal.open(engine);
        }
      };
      renderer.shopOverlay.onOpenRuneTree = () => {
        openRuneTree();
      };
      renderer.onPactModalRequested = () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('pacts');
        } else {
          pactModal.open(engine, () => {
            popModal(pactModal.id);
            renderer?.render();
          });
          pushModal(pactModal.id, pactModal);
        }
      };
      inputHandler = new InputHandler(
        engine,
        () => {
          void processVisualEffectsAndRender();
        },
        renderer.inventoryOverlay,
        promptSaveAndQuit,
        renderer.targetingOverlay,
        renderer.shopOverlay,
        toggleDiagnostics,
        renderer.inspectOverlay,
        contextHelp,
        compendiumModal,
        commandPalette,
        renderer.mapOverlay,
        settingsManager,
        renderer.radialMenuOverlay
      );
      inputHandler.characterMenuModal = characterMenuModal;
      characterMenuModal.setModalStack(inputHandler.modalStack);
      inputHandler.pactModal = pactModal;
      inputHandler.levelUpModal = levelUpModal;
      inputHandler.runeOfReturnTreeModal = runeTreeModal;
      inputHandler.runeOfReturnDiscoveryModal = runeDiscoveryModal;
      levelUpModal.setModalStack(inputHandler.modalStack);
      runeTreeModal.setModalStack(inputHandler.modalStack);
      runeDiscoveryModal.setModalStack(inputHandler.modalStack);
      inputHandler.onCastSpellById = castSpellById;
      diagnosticModal.setModalStack(inputHandler.modalStack);
    } else {
      renderer.setEngine(engine);
      renderer.onResolveRadialLabel = resolveRadialMenuLabel;
      renderer.shopOverlay.onOpenCompendium = () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('bestiary');
        } else {
          compendiumModal.open(engine);
        }
      };
      renderer.shopOverlay.onOpenRuneTree = () => {
        openRuneTree();
      };
      renderer.onPactModalRequested = () => {
        if (characterMenuModal) {
          if (inputHandler) inputHandler.modalStack.push(characterMenuModal);
          characterMenuModal.open('pacts');
        } else {
          pactModal.open(engine, () => {
            popModal(pactModal.id);
            renderer?.render();
          });
          pushModal(pactModal.id, pactModal);
        }
      };
      inputHandler?.setEngine(engine);
      if (inputHandler) {
        inputHandler.characterMenuModal = characterMenuModal;
        characterMenuModal.setModalStack(inputHandler.modalStack);
        characterMenuModal.setViewport(renderer.viewport);
        if (canvas) characterMenuModal.setCanvas(canvas);
        inputHandler.shopOverlay = renderer.shopOverlay;
        inputHandler.inspectOverlay = renderer.inspectOverlay;
        inputHandler.mapOverlay = renderer.mapOverlay;
        inputHandler.radialMenuOverlay = renderer.radialMenuOverlay;
        inputHandler.onToggleDiagnostics = toggleDiagnostics;
        inputHandler.contextHelp = contextHelp;
        inputHandler.compendiumModal = compendiumModal;
        inputHandler.commandPalette = commandPalette;
        inputHandler.pactModal = pactModal;
        inputHandler.levelUpModal = levelUpModal;
        inputHandler.runeOfReturnTreeModal = runeTreeModal;
        inputHandler.runeOfReturnDiscoveryModal = runeDiscoveryModal;
        levelUpModal.setModalStack(inputHandler.modalStack);
        runeTreeModal.setModalStack(inputHandler.modalStack);
        runeDiscoveryModal.setModalStack(inputHandler.modalStack);
        inputHandler.onSaveAndExit = promptSaveAndQuit;
        inputHandler.onCastSpellById = castSpellById;
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
      inputHandler.onOpenSpellbook = () => openSpellbook();
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
      bottomStatusBar.mount(gameContainer);
    }
    quickSpellsBar.update(engine);
    bottomStatusBar.update(engine);

    flankManager.mount(leftFlank, rightFlank, engine.manifest ?? activeManifest);
    updateHeaderInfo();
    renderFlanks();
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
      const created = profileManager.createCharacter(name, { ...options, manifest: activeManifest });
      launchGame(created.engine, created.profile);
    },
    onImport: (fileContent: string) => {
      importSaveWithValidation({
        content: fileContent,
        profileManager,
        activeManifestId: activeManifest.id,
        onSuccess: (p) => {
          titleScreen.refresh();
          titleScreen.setStatus(`Successfully imported hero: ${p.name} 📥`);
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
    onLoadAutosave: () => {
      try {
        const autosave = loadAutosaveOrNotify();
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
      if (activeEngine) {
        compendiumModal.open(activeEngine);
      } else {
        keybindModal.open();
      }
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
            alert(`Save import error: ${err}`);
          },
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

  // Show Main Menu on start
  mainMenu.show();

  if (import.meta.env?.DEV) {
    console.log(`${brand.title} initialized with Main Menu & Settings.`);
  }
});
