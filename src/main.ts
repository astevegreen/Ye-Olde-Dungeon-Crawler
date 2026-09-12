import { ProfileManager } from './engine/storage/profile-manager';
import type { CharacterProfile } from './engine/storage/types';
import { GameEngine } from './engine/engine';
import { CanvasRenderer } from './rendering/canvas-renderer';
import { InputHandler } from './rendering/input-handler';
import { TitleScreen } from './ui/title-screen';
import { Leaderboard, type ValhallaEntry } from './engine/hallOfFame/leaderboard';
import { DiagnosticModal } from './ui/diagnostic-modal';
import { SagaShareModal } from './ui/sagaShareModal';
import { flightRecorder } from './engine/debug/flightRecorder';
import { ContextHelp } from './ui/help/contextHelp';
import { CompendiumModal } from './ui/help/compendiumModal';
import { CommandPalette } from './ui/help/commandPalette';
import { SageService } from './engine/economy/services';
import { QuickLootAction } from './engine/actions/inventory-actions';
import { WaitAction } from './engine/actions/wait';
import { RestAction } from './engine/actions/rest';
import { SearchAction } from './engine/actions/search';
import { ClimbStairsAction } from './engine/actions/stairs';
import { CastSpellAction } from './engine/actions/spell-actions';
import type { SpellbookEntry } from './rendering/targeting-overlay';
import type { SpellDefinition } from './engine/magic/types';
import { applyThemeTokens, COTW_THEME_TOKENS } from './rendering/theme';
import { DwarvenWinchModal } from './ui/dwarvenWinchModal';
import { TownReturnModal } from './ui/townReturnModal';
import { ChoiceModal } from './ui/choiceModal';
import { PactModal } from './ui/pactModal';
import { LevelUpModal } from './ui/levelUpModal';
import type { GameEvent } from './engine';
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
import { setupSaveDragAndDrop, importSaveWithValidation } from './ui/saveImporter';
import { defaultPlatformAdapter, getBrowserStorage } from './ui/platform';
import { serializeGame } from './engine/storage/serializer';
import { CURRENT_SCHEMA_VERSION } from './engine/storage/migrator';
import './ui/styles/flanks.css';
import './ui/styles/layout.css';
import { FlankManager } from './ui/flanks/flankManager';
import { WorldLedgerModule } from './ui/flanks/worldLedgerModule';
import { JournalModule } from './ui/flanks/journalModule';
import { QuickSpellsBar } from './ui/quickSpellsBar';
import { SpellbookModal } from './ui/spellbookModal';
import { BottomStatusBar } from './ui/bottomStatusBar';
import { AutosaveManager } from './engine/storage/autosaveManager';
import { getSpell } from './engine/magic/spellRegistry';
import { SettingsManager } from './ui/settings/settingsManager';
import { KeybindModal } from './ui/settings/keybindModal';
import { MainMenu } from './ui/menus/mainMenu';

const targetTheme = ((import.meta as any).env?.VITE_THEME as string) || 'cotw';
const activeManifest = targetTheme === 'warcraft' ? warcraftManifest : cotwManifest;
const activeThemeTokens = targetTheme === 'warcraft' ? WARCRAFT_THEME_TOKENS : COTW_THEME_TOKENS;

window.addEventListener('DOMContentLoaded', () => {
  applyThemeTokens(activeThemeTokens);
  document.title = activeManifest.name;
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
  const hudRestBtn = document.getElementById('btn-hud-rest');
  const hudSearchBtn = document.getElementById('btn-hud-search');
  const hudWaitBtn = document.getElementById('btn-hud-wait');
  const hudStairsBtn = document.getElementById('btn-hud-stairs');

  const contextHelp = new ContextHelp();
  const compendiumModal = new CompendiumModal();
  const commandPalette = new CommandPalette();
  const winchModal = new DwarvenWinchModal(() => {
    if (inputHandler) inputHandler.enabled = true;
    renderer?.render();
  });
  const townReturnModal = new TownReturnModal(() => {
    if (inputHandler) inputHandler.enabled = true;
    renderer?.render();
  });
  const choiceModal = new ChoiceModal(() => {
    if (inputHandler) inputHandler.enabled = true;
    renderer?.render();
  });
  const pactModal = new PactModal();
  const levelUpModal = new LevelUpModal(() => {
    if (inputHandler) inputHandler.enabled = true;
    renderer?.render();
  });
  const autosaveManager = new AutosaveManager(undefined, activeManifest);

  let spellbookModal: SpellbookModal;
  let quickSpellsBar: QuickSpellsBar;
  let bottomStatusBar: BottomStatusBar;

  function openSpellbook(): void {
    if (!activeEngine) return;
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

  quickSpellsBar = new QuickSpellsBar({
    onTriggerSlot: (slotIdx) => triggerQuickSpell(slotIdx),
    onOpenSpellbook: () => openSpellbook(),
  });

  spellbookModal = new SpellbookModal({
    onCastSpell: (spell) => {
      if (inputHandler) {
        inputHandler.modalStack.remove('spellbook');
        inputHandler.enabled = true;
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
        inputHandler.enabled = true;
        inputHandler.isInputLocked = false;
      }
      if (typeof document !== 'undefined') {
        document.getElementById('game-canvas')?.focus();
      }
      renderer?.render();
    },
  });
  spellbookModal.mount(document.body);

  bottomStatusBar = new BottomStatusBar();

  function updateHeaderInfo(): void {
    if (!activeEngine) return;
    const nameEl = document.getElementById('header-name');
    const floorEl = document.getElementById('header-floor');
    const posEl = document.getElementById('header-pos');
    const turnsEl = document.getElementById('header-turns');
    if (nameEl) {
      const heroName = activeProfile?.name || activeEngine.player.name || 'Hero';
      nameEl.textContent = `🛡️ ${heroName}`;
    }
    if (floorEl) {
      floorEl.textContent = activeEngine.currentFloor === 0 ? 'Town (Bjarnarhaven)' : `Floor ${activeEngine.currentFloor}`;
    }
    if (posEl) {
      posEl.textContent = `POS: (${activeEngine.player.x}, ${activeEngine.player.y})`;
    }
    if (turnsEl) {
      turnsEl.textContent = `Turn: ${activeEngine.turnCount}`;
    }
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

  async function processVisualEffectsAndRender(): Promise<void> {
    try {
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
          if (inputHandler) inputHandler.isInputLocked = true;
          try {
            await renderer.fxRunner.playEffects(pending);
          } finally {
            if (inputHandler) inputHandler.isInputLocked = false;
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
      if (inputHandler) {
        inputHandler.enabled = true;
      }
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
      const loaded = profileManager.loadCharacter(profile.id);
      if (loaded) {
        launchGame(loaded.engine, loaded.profile);
      }
    },
    onClose: () => {
      if (inputHandler && activeEngine && gameContainer && gameContainer.style.display !== 'none') {
        inputHandler.enabled = true;
      }
    },
  });

  const sagaShareModal = new SagaShareModal({
    leaderboard: new Leaderboard(getBrowserStorage() ?? undefined),
    onSagaInscribed: (entry) => {
      titleScreen?.refreshValhalla();
      titleScreen?.setStatus(`Inscribed ${entry.heroName}'s saga into the Hall of Valhalla! 🏆`);
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
      if (activeEngine && inputHandler && !saveQuitModal.isOpen) {
        inputHandler.enabled = true;
      }
    },
  });

  const saveQuitModal = new SaveQuitModal({
    profileManager,
    saveCodeModal,
    onSaveAndExit: () => {
      saveAndReturnToTitle();
    },
    onResume: () => {
      if (inputHandler) {
        inputHandler.enabled = true;
      }
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
      if (inputHandler) inputHandler.enabled = false;
      saveQuitModal.open(activeEngine, activeProfile);
    } else {
      saveAndReturnToTitle();
    }
  }

  devDiagBtn?.addEventListener('click', () => {
    if (inputHandler) {
      inputHandler.enabled = false;
    }
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
      compendiumModal.toggle(activeEngine);
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
      activeEngine.handlePlayerAction(new SearchAction(activeEngine.player, Math.random, 2));
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
    diagnosticModal.showCrash(err);
  };

  const onGlobalUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    flightRecorder.recordError(reason, { type: 'unhandledrejection' });
    diagnosticModal.showCrash(reason);
  };

  window.addEventListener('error', onGlobalError);
  window.addEventListener('unhandledrejection', onGlobalUnhandledRejection);

  (window as any).__teardownGlobalErrorHandlers = () => {
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

  let currentGameOverEntry: ValhallaEntry | null = null;

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
      if (title) title.textContent = 'Victory in Midgard!';
      if (banner) banner.style.background = '#15803d';
      if (bannerTitle) bannerTitle.textContent = 'VICTOR OF THE NORTH';
      if (bannerSub) bannerSub.textContent = 'The Sun-Stone of Freyr is restored to Bjarnarhaven!';
    } else {
      if (icon) icon.textContent = '✝';
      if (title) title.textContent = 'Fallen in Battle';
      if (banner) banner.style.background = '#7f1d1d';
      if (bannerTitle) bannerTitle.textContent = 'FALLEN IN BATTLE';
      if (bannerSub) bannerSub.textContent = 'Your soul departs Midgard for the eternal halls of Valhalla.';
    }

    if (summary.entry) {
      if (pre) pre.textContent = Leaderboard.formatEpitaph(summary.entry);
      if (scoreBadge) scoreBadge.textContent = `Valhalla Score: ${summary.entry.score.toLocaleString()} PTS`;
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
    const loaded = autosaveManager.loadAutosave(activeManifest);
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
    (window as any).__cotwEngine = engine;
    (window as any).__cotwSaveAndReturn = saveAndReturnToTitle;

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
        levelUpModal.open(engine);
        if (inputHandler) {
          inputHandler.modalStack.push(levelUpModal);
        }
        renderer?.render();
      }
    };

    // Wire Dwarven Winch interaction
    engine.onWinchInteract = (winch) => {
      if (inputHandler) inputHandler.enabled = false;
      winchModal.open(winch, engine);
      renderer?.render();
    };

    // Wire Town-Return fixtures and Two-Way portal interactions
    engine.onTownReturnInteract = (fixture, onConfirm, onCancel) => {
      if (inputHandler) inputHandler.enabled = false;
      townReturnModal.open(
        fixture.type,
        engine,
        () => {
          if (inputHandler) inputHandler.enabled = true;
          onConfirm();
          updateHeaderInfo();
          renderer?.render();
        },
        () => {
          if (inputHandler) inputHandler.enabled = true;
          if (onCancel) onCancel();
          updateHeaderInfo();
          renderer?.render();
        }
      );
      renderer?.render();
    };

    // Wire interactive Choice modal
    engine.onChoiceInteract = (choice, onOptionSelected, onCancel) => {
      if (inputHandler) inputHandler.enabled = false;
      choiceModal.open(
        choice,
        engine,
        (optionId) => {
          if (inputHandler) inputHandler.enabled = true;
          onOptionSelected(optionId);
          updateHeaderInfo();
          renderer?.render();
        },
        () => {
          if (inputHandler) inputHandler.enabled = true;
          if (onCancel) onCancel();
          updateHeaderInfo();
          renderer?.render();
        }
      );
      renderer?.render();
    };

    const toggleDiagnostics = () => {
      if (diagnosticModal.isOpen()) {
        diagnosticModal.close();
        if (inputHandler) inputHandler.enabled = true;
      } else {
        if (inputHandler) inputHandler.enabled = false;
        diagnosticModal.open();
      }
    };

    commandPalette.registerCommands([
      {
        id: 'inspect',
        title: 'Look / Inspect Tile',
        category: 'Mode',
        shortcut: 'X or L',
        description: 'Pan targeting reticle to inspect monsters, terrain, and loot',
        execute: (eng) => {
          if (renderer) {
            renderer.inventoryOverlay.close();
            renderer.targetingOverlay.close();
            renderer.inspectOverlay.open(eng);
            renderer.render();
          }
        },
      },
      {
        id: 'spellbook',
        title: 'Cast Spell / Spellbook',
        category: 'Mode',
        shortcut: 'Z or C',
        description: 'Open spellbook to select and aim magical attacks',
        execute: (eng) => {
          if (renderer) {
            renderer.inventoryOverlay.close();
            renderer.inspectOverlay.close();
            renderer.targetingOverlay.openSpellbook(eng);
            renderer.render();
          }
        },
      },
      {
        id: 'inventory',
        title: 'Open Inventory & Equipment',
        category: 'Mode',
        shortcut: 'I',
        description: 'Manage backpack, equip weapons/armor, and view paperdoll',
        execute: (eng) => {
          if (renderer) {
            renderer.inventoryOverlay.toggle(eng);
            renderer.render();
          }
        },
      },
      {
        id: 'compendium',
        title: "Slayer's Compendium & Codex",
        category: 'Help',
        shortcut: 'B',
        description: 'Review monster vulnerabilities, stats, and mastery combat perks',
        execute: (eng) => {
          compendiumModal.open(eng);
        },
      },
      {
        id: 'allocate-stats',
        title: 'Allocate Stat Points',
        category: 'Action',
        shortcut: 'U',
        description: 'Spend unspent attribute points on Strength, Dexterity, Constitution, or Intelligence',
        execute: (eng) => {
          levelUpModal.open(eng);
          if (inputHandler) {
            inputHandler.modalStack.push(levelUpModal);
          }
        },
      },
      {
        id: 'run-advisory',
        title: 'Town Sage Run Advisory',
        category: 'Help',
        shortcut: 'Sage / Cmds',
        description: 'Seek strategic analysis on inventory bulk, cursed gear, and threats',
        execute: (eng) => {
          const rep = SageService.getRunAdvisory(eng);
          eng.log(`*** SAGE ADVISORY (Floor ${rep.targetFloor}): ${rep.summary} ***`);
          for (const w of rep.warnings) {
            eng.log(`[${w.severity.toUpperCase()}] ${w.title}: ${w.recommendation}`);
          }
          contextHelp.open(eng, renderer?.inventoryOverlay, renderer?.targetingOverlay, renderer?.shopOverlay, renderer?.inspectOverlay);
          renderer?.render();
        },
      },
      {
        id: 'help',
        title: 'Context-Sensitive Help Card',
        category: 'Help',
        shortcut: 'F1 or /',
        description: 'View active keybindings and rules for the current game context',
        execute: (eng) => {
          contextHelp.open(eng, renderer?.inventoryOverlay, renderer?.targetingOverlay, renderer?.shopOverlay, renderer?.inspectOverlay);
        },
      },
      {
        id: 'quick-loot',
        title: 'Quick-Loot Ground Tile',
        category: 'Action',
        shortcut: 'Shift+G',
        description: 'Instantly pick up all items lying on the current ground tile',
        execute: (eng) => {
          const act = new QuickLootAction(eng.player);
          eng.handlePlayerAction(act);
          void processVisualEffectsAndRender();
        },
      },
      {
        id: 'sort-pack',
        title: 'Sort Backpack Items',
        category: 'Action',
        shortcut: 'O',
        description: 'Cycle inventory sorting by Category, Weight, or Bulk',
        execute: (eng) => {
          eng.player.inventory.primaryPack.sort('category');
          eng.log('Sorted backpack items by CATEGORY.');
          renderer?.render();
        },
      },
      {
        id: 'consolidate-coins',
        title: 'Consolidate Loose Coins',
        category: 'Action',
        shortcut: 'C',
        description: 'Pack all loose coins in backpack into your coin purse',
        execute: (eng) => {
          const res = eng.player.inventory.consolidateCoins();
          if (res.count > 0) {
            eng.log(`Consolidated ${res.count} coin stack(s) into purse.`);
          } else {
            eng.log('No loose coins in backpack to consolidate.');
          }
          renderer?.render();
        },
      },
      {
        id: 'wait',
        title: 'Wait / Pass Turn',
        category: 'Action',
        shortcut: 'Space or .',
        description: 'Pass turn to recover energy or wait for monsters to advance',
        execute: (eng) => {
          const act = new WaitAction(eng.player);
          eng.handlePlayerAction(act);
          void processVisualEffectsAndRender();
        },
      },
      {
        id: 'rest',
        title: 'Rest Until Healed',
        category: 'Action',
        shortcut: 'R',
        description: 'Rest safely until Hit Points and Mana are fully replenished',
        execute: (eng) => {
          const act = new RestAction(eng.player);
          eng.handlePlayerAction(act);
          void processVisualEffectsAndRender();
        },
      },
      {
        id: 'search',
        title: 'Search for Hidden Traps',
        category: 'Action',
        shortcut: 'S',
        description: 'Thoroughly search surrounding tiles for hidden traps and secret doors',
        execute: (eng) => {
          const act = new SearchAction(eng.player);
          eng.handlePlayerAction(act);
          void processVisualEffectsAndRender();
        },
      },
      {
        id: 'stairs',
        title: 'Climb Stairs Up / Down',
        category: 'Action',
        shortcut: '> or <',
        description: 'Ascend or descend staircase to change dungeon floor',
        execute: (eng) => {
          const act = new ClimbStairsAction(eng.player);
          eng.handlePlayerAction(act);
          void processVisualEffectsAndRender();
        },
      },
      {
        id: 'map',
        title: 'Explored Dungeon Map Viewer',
        category: 'Mode',
        shortcut: 'M',
        description: 'View fully explored rooms and navigate visited floor maps (0 energy cost)',
        execute: (eng) => {
          if (renderer) {
            renderer.inventoryOverlay.close();
            renderer.inspectOverlay.close();
            renderer.targetingOverlay.close();
            renderer.mapOverlay.open(eng);
            renderer.render();
          }
        },
      },
      {
        id: 'diagnostics',
        title: 'Developer Diagnostics Flight Recorder',
        category: 'System',
        shortcut: 'F2 or `',
        description: 'Inspect live engine telemetry and copy diagnostic debug reports',
        execute: () => {
          toggleDiagnostics();
        },
      },
      {
        id: 'save-quit',
        title: 'Save Character & System Menu',
        category: 'System',
        shortcut: 'Q',
        description: 'Open save and quit menu to export backups or return to title',
        execute: () => {
          promptSaveAndQuit();
        },
      },
      {
        id: 'export-save',
        title: 'Export Save File (.cotw)',
        category: 'System',
        shortcut: 'Ctrl+S',
        description: 'Download current game state as a standalone .cotw file',
        execute: (eng) => {
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
      },
      {
        id: 'save-code',
        title: 'Transfer Save Code (Base64)',
        category: 'System',
        shortcut: 'Code',
        description: 'View or copy character Base64 backup save code to clipboard',
        execute: () => {
          if (activeEngine && activeProfile) {
            const saveData = serializeGame(activeEngine, activeProfile);
            const env = {
              schemaVersion: CURRENT_SCHEMA_VERSION,
              contentManifestId: activeManifest.id,
              timestamp: Date.now(),
              data: saveData,
            };
            if (inputHandler) inputHandler.enabled = false;
            saveCodeModal.open('copy', env);
          }
        },
      },
      {
        id: 'settings',
        title: 'Settings & Keybinding Remapping',
        category: 'System',
        shortcut: 'Esc -> Settings',
        description: 'Configure 8-directional movement modes and customize keyboard bindings',
        execute: () => {
          if (inputHandler) inputHandler.enabled = false;
          keybindModal.open();
        },
      },
    ]);

    applyThemeTokens(engine.manifest?.theme ?? COTW_THEME_TOKENS);

    if (!renderer) {
      renderer = new CanvasRenderer(canvas!, engine);
      renderer.mouseVectoringEnabled = settingsManager.getSettings().mouseVectoringEnabled;
      settingsManager.subscribe((settings) => {
        if (renderer) {
          renderer.mouseVectoringEnabled = settings.mouseVectoringEnabled;
          renderer.render();
        }
      });
      renderer.shopOverlay.onOpenCompendium = () => {
        compendiumModal.open(engine);
      };
      renderer.onPactModalRequested = () => {
        pactModal.open(engine, () => {
          renderer?.render();
        });
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
        settingsManager
      );
      inputHandler.pactModal = pactModal;
      inputHandler.levelUpModal = levelUpModal;
    } else {
      renderer.setEngine(engine);
      renderer.shopOverlay.onOpenCompendium = () => {
        compendiumModal.open(engine);
      };
      renderer.onPactModalRequested = () => {
        pactModal.open(engine, () => {
          renderer?.render();
        });
      };
      inputHandler?.setEngine(engine);
      if (inputHandler) {
        inputHandler.shopOverlay = renderer.shopOverlay;
        inputHandler.inspectOverlay = renderer.inspectOverlay;
        inputHandler.mapOverlay = renderer.mapOverlay;
        inputHandler.onToggleDiagnostics = toggleDiagnostics;
        inputHandler.contextHelp = contextHelp;
        inputHandler.compendiumModal = compendiumModal;
        inputHandler.commandPalette = commandPalette;
        inputHandler.pactModal = pactModal;
        inputHandler.levelUpModal = levelUpModal;
        inputHandler.onSaveAndExit = promptSaveAndQuit;
      }
    }

    const navCtrl = new NavigationController(engine);
    renderer.navigationController = navCtrl;
    const restRunner = new AutoRestRunner(engine);
    if (inputHandler) {
      inputHandler.navigationController = navCtrl;
      inputHandler.autoRestRunner = restRunner;
    }

    (window as any).__cotwRenderer = renderer;
    (window as any).__cotwInputHandler = inputHandler;

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

    (window as any).__cotwInput = inputHandler;
    (window as any).__cotwRenderer = renderer;

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
      const loaded = profileManager.loadCharacter(profileId);
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
        const loaded = profileManager.loadCharacter(profileId);
        if (loaded) {
          launchGame(loaded.engine, loaded.profile);
          return true;
        }
        return false;
      } catch (err) {
        showToast(`Corrupted save file: ${(err as Error).message}`, 'error');
        return false;
      }
    },
    onLoadAutosave: () => {
      try {
        const autosave = autosaveManager.loadAutosave(activeManifest);
        if (autosave) {
          launchGame(autosave.engine, autosave.profile);
          return true;
        }
        return false;
      } catch (err) {
        showToast(`Corrupted autosave file: ${(err as Error).message}`, 'error');
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
    onContinue: (profileId?: string) => {
      try {
        if (profileId) {
          const loaded = profileManager.loadCharacter(profileId);
          if (loaded) {
            launchGame(loaded.engine, loaded.profile);
            return;
          }
        }
        const autosave = autosaveManager.loadAutosave(activeManifest);
        if (autosave) {
          launchGame(autosave.engine, autosave.profile);
          return;
        }
        const profiles = profileManager.listProfiles();
        if (profiles.length > 0) {
          const latestProfile = [...profiles].sort((a, b) => b.lastSaved - a.lastSaved)[0];
          const loaded = profileManager.loadCharacter(latestProfile.id);
          if (loaded) {
            launchGame(loaded.engine, loaded.profile);
            return;
          }
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
            const loaded = profileManager.loadCharacter(p.id);
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
    console.log('Castle of the Winds initialized with Main Menu & Settings.');
  }
});
