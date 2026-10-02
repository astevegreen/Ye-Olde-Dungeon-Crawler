import { ProfileManager, SAVE_FILE_EXTENSION } from '../engine';
import { iconHtml } from './icons';
import type { CharacterProfile } from '../engine';
import { CharacterRoller } from '../engine';
import { PRNG } from '../engine';
import type { CharacterAttributes, Gender } from '../engine';
import type { GameDifficulty } from '../engine';
import { Leaderboard } from '../engine';
import { HallOfLegendsDialog } from './hallOfLegendsDialog';
import { getStoragePersistenceInfo, formatStorageStatus } from './persistenceInit';
import { setupSaveDragAndDrop, importSaveWithValidation } from './saveImporter';
import { showConfirmDialog } from './confirmDialog';
import type { SaveCodeModal } from './saveCodeModal';
import type { SagaShareModal } from './sagaShareModal';
import { defaultPlatformAdapter, getBrowserStorage } from './platform';
import { resolveBranding } from './branding';
import type { AutosaveManager } from '../engine';
import type { GameEngine } from '../engine';

export interface TitleScreenOptions {
  profileManager: ProfileManager;
  autosaveManager?: AutosaveManager;
  onLoadAutosave?: (engine: GameEngine, profile: CharacterProfile) => void;
  onResume: (profileId: string) => void;
  onNewCharacter: (
    name: string,
    options?: {
      attributes?: CharacterAttributes;
      gender?: Gender;
      difficulty?: GameDifficulty;
      maxFloor?: number;
    }
  ) => void;
  onImport: (fileContent: string) => void;
  saveCodeModal?: SaveCodeModal;
  sagaShareModal?: SagaShareModal;
  onBackToMenu?: () => void;
}

export class TitleScreen {
  private profileManager: ProfileManager;
  private onResumeCallback: (profileId: string) => void;
  private onNewCharacterCallback: (
    name: string,
    options?: {
      attributes?: CharacterAttributes;
      gender?: Gender;
      difficulty?: GameDifficulty;
      maxFloor?: number;
    }
  ) => void;
  private onImportCallback: (fileContent: string) => void;
  public saveCodeModal?: SaveCodeModal;
  public sagaShareModal?: SagaShareModal;
  public autosaveManager?: AutosaveManager;
  private onLoadAutosaveCallback?: (engine: GameEngine, profile: CharacterProfile) => void;
  private onBackToMenuCallback?: () => void;

  private container: HTMLElement | null = null;
  private rosterListEl: HTMLElement | null = null;
  private resumeBtn: HTMLButtonElement | null = null;
  private loadAutosaveBtn: HTMLButtonElement | null = null;
  private exportBtn: HTMLButtonElement | null = null;
  private saveCodeBtn: HTMLButtonElement | null = null;
  private pasteCodeBtn: HTMLButtonElement | null = null;
  private titleImportSagaBtn: HTMLButtonElement | null = null;
  private deleteBtn: HTMLButtonElement | null = null;
  private createBtn: HTMLButtonElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private statusEl: HTMLElement | null = null;
  private storageStatusEl: HTMLElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private cleanupDragDrop?: () => void;

  // Stat Roller state
  private selectedGender: Gender = 'male';
  private selectedDifficulty: GameDifficulty = 'medium';
  /**
   * Character creation happens before any GameEngine exists, so the screen owns its own
   * seeded stream rather than reaching for Math.random. This is the entropy boundary:
   * the seed is drawn from the clock once, here, and every roll after that is seeded
   * (ARCHITECTURE.md §7.2).
   */
  private readonly rollPrng = new PRNG((Date.now() ^ 0x5f3759df) >>> 0);
  private attributes: CharacterAttributes = { strength: 12, intelligence: 12, constitution: 12, dexterity: 12 };
  private poolPoints = 5;

  // Hall of Fame leaderboard
  public readonly leaderboard: Leaderboard = new Leaderboard(getBrowserStorage() ?? undefined);
  private readonly hall: HallOfLegendsDialog;

  private selectedProfileId: string | null = null;

  constructor(options: TitleScreenOptions) {
    this.profileManager = options.profileManager;
    this.onResumeCallback = options.onResume;
    this.onNewCharacterCallback = options.onNewCharacter;
    this.onImportCallback = options.onImport;
    this.saveCodeModal = options.saveCodeModal;
    this.sagaShareModal = options.sagaShareModal;
    this.autosaveManager = options.autosaveManager;
    this.onLoadAutosaveCallback = options.onLoadAutosave;
    this.onBackToMenuCallback = options.onBackToMenu;
    this.hall = new HallOfLegendsDialog({
      leaderboard: this.leaderboard,
      branding: resolveBranding(this.profileManager.manifest),
      onShare: (entry) => this.sagaShareModal?.openShare(entry),
      onImport: () => this.sagaShareModal?.openImport(),
    });

    this.bindDomElements();
    this.rerollStats();
  }

  private bindDomElements(): void {
    this.container = document.getElementById('title-screen');
    if (!this.container) return;

    document.getElementById('btn-title-back-menu')?.addEventListener('click', () => {
      this.hide();
      this.onBackToMenuCallback?.();
    });

    const manaLabel = document.getElementById('preview-mana-label');
    if (manaLabel) manaLabel.textContent = resolveBranding(this.profileManager.manifest).manaName;

    this.rosterListEl = document.getElementById('roster-list');
    this.resumeBtn = document.getElementById('btn-resume') as HTMLButtonElement | null;
    this.loadAutosaveBtn = document.getElementById('btn-title-load-autosave') as HTMLButtonElement | null;
    this.exportBtn = document.getElementById('btn-export') as HTMLButtonElement | null;
    this.saveCodeBtn = document.getElementById('btn-title-savecode') as HTMLButtonElement | null;
    this.pasteCodeBtn = document.getElementById('btn-title-paste-code') as HTMLButtonElement | null;
    this.deleteBtn = document.getElementById('btn-delete') as HTMLButtonElement | null;
    this.createBtn = document.getElementById('btn-create-embark') as HTMLButtonElement | null;
    this.nameInput = document.getElementById('new-hero-name') as HTMLInputElement | null;
    this.statusEl = document.getElementById('title-status');
    this.storageStatusEl = document.getElementById('title-storage-status');
    this.fileInput = document.getElementById('import-file-input') as HTMLInputElement | null;
    if (this.fileInput) this.fileInput.accept = `${SAVE_FILE_EXTENSION},.sav,.json`;

    // Load Autosave button
    this.loadAutosaveBtn?.addEventListener('click', () => {
      if (this.autosaveManager && this.onLoadAutosaveCallback) {
        const loaded = this.autosaveManager.loadAutosave();
        if (loaded) {
          this.onLoadAutosaveCallback(loaded.engine, loaded.profile);
        } else {
          this.setStatus('Error loading autosave payload.');
        }
      }
    });

    // Resume button
    this.resumeBtn?.addEventListener('click', () => {
      if (this.selectedProfileId) {
        this.onResumeCallback(this.selectedProfileId);
      }
    });

    // Export the selected hero's save file
    this.exportBtn?.addEventListener('click', () => {
      if (this.selectedProfileId) {
        try {
          const fileName = this.profileManager.triggerCotwDownload(this.selectedProfileId, defaultPlatformAdapter);
          this.setStatus(`Exported ${fileName} successfully.`);
        } catch (err) {
          this.setStatus(`Export error: ${(err as Error).message}`);
        }
      }
    });

    // Save code transfer buttons
    this.saveCodeBtn?.addEventListener('click', () => {
      if (this.selectedProfileId && this.saveCodeModal) {
        try {
          const envelope = this.profileManager.exportHeroEnvelope(this.selectedProfileId);
          this.saveCodeModal.open('copy', envelope);
        } catch (err) {
          this.setStatus(`Save code error: ${(err as Error).message}`);
        }
      }
    });

    this.pasteCodeBtn?.addEventListener('click', () => {
      this.saveCodeModal?.open('paste');
    });

    this.titleImportSagaBtn = document.getElementById('btn-title-import-saga') as HTMLButtonElement | null;
    this.titleImportSagaBtn?.addEventListener('click', () => {
      this.sagaShareModal?.openImport();
    });

    // Delete button
    this.deleteBtn?.addEventListener('click', () => {
      if (!this.selectedProfileId) return;
      const profile = this.getSelectedProfile();
      const heroName = profile?.name ?? 'this character';
      const profileId = this.selectedProfileId;
      showConfirmDialog({
        title: `Delete ${heroName}?`,
        icon: 'delete',
        message: `${heroName}'s save will be gone for good. This cannot be undone.`,
        confirmLabel: 'Delete save',
        cancelLabel: 'Keep',
        onConfirm: () => {
          this.profileManager.deleteCharacter(profileId);
          this.selectedProfileId = null;
          this.refresh();
          this.setStatus(`Deleted character ${heroName}.`);
        },
      });
    });

    // Gender selection
    const maleBtn = document.getElementById('btn-gender-male') as HTMLButtonElement | null;
    const femaleBtn = document.getElementById('btn-gender-female') as HTMLButtonElement | null;
    maleBtn?.addEventListener('click', () => this.setGender('male'));
    femaleBtn?.addEventListener('click', () => this.setGender('female'));

    // Difficulty selection
    const easyBtn = document.getElementById('btn-diff-easy') as HTMLButtonElement | null;
    const medBtn = document.getElementById('btn-diff-medium') as HTMLButtonElement | null;
    const hardBtn = document.getElementById('btn-diff-hard') as HTMLButtonElement | null;
    easyBtn?.addEventListener('click', () => this.setDifficulty('easy'));
    medBtn?.addEventListener('click', () => this.setDifficulty('medium'));
    hardBtn?.addEventListener('click', () => this.setDifficulty('hard'));

    // Stat roll 3d6 button
    const rollBtn = document.getElementById('btn-roll-dice');
    rollBtn?.addEventListener('click', () => this.rerollStats());

    // Stat adjustment buttons
    document.getElementById('btn-dec-str')?.addEventListener('click', () => this.adjustStat('strength', -1));
    document.getElementById('btn-inc-str')?.addEventListener('click', () => this.adjustStat('strength', 1));
    document.getElementById('btn-dec-int')?.addEventListener('click', () => this.adjustStat('intelligence', -1));
    document.getElementById('btn-inc-int')?.addEventListener('click', () => this.adjustStat('intelligence', 1));
    document.getElementById('btn-dec-con')?.addEventListener('click', () => this.adjustStat('constitution', -1));
    document.getElementById('btn-inc-con')?.addEventListener('click', () => this.adjustStat('constitution', 1));
    document.getElementById('btn-dec-dex')?.addEventListener('click', () => this.adjustStat('dexterity', -1));
    document.getElementById('btn-inc-dex')?.addEventListener('click', () => this.adjustStat('dexterity', 1));

    document.getElementById('btn-valhalla')?.addEventListener('click', () => this.openValhalla());

    // Create & Embark
    this.createBtn?.addEventListener('click', () => {
      this.embarkNewHero();
    });

    // Name input Enter key
    this.nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.embarkNewHero();
      }
    });

    // Manifest-driven titlebar, banner, and presets
    const manifest = this.profileManager.manifest;
    if (manifest) {
      const titlebarSpan = this.container.querySelector('.retro-titlebar-title span:last-child');
      if (titlebarSpan && manifest.name) {
        titlebarSpan.textContent = `${manifest.name}: heroes`;
      }
      const bannerTitle = this.container.querySelector('.retro-banner-title');
      if (bannerTitle && manifest.name) {
        bannerTitle.textContent = manifest.name.toUpperCase();
      }
      const bannerSub = this.container.querySelector('.retro-banner-sub');
      if (bannerSub && manifest.description) {
        bannerSub.textContent = manifest.description;
      }
      if (manifest.presetNames && manifest.presetNames.length > 0) {
        const presetContainer = this.container.querySelector('.retro-hero-preset');
        if (presetContainer) {
          presetContainer.innerHTML =
            `<span class="preset-label">Preset:</span> ` +
            manifest.presetNames
              .map((n: string) => `<button type="button" class="preset-tag" data-name="${n}">${n}</button>`)
              .join(' ');
        }
        if (this.nameInput) {
          this.nameInput.value = manifest.presetNames[0];
        }
      } else {
        const presetContainer = this.container.querySelector<HTMLElement>('.retro-hero-preset');
        if (presetContainer) presetContainer.style.display = 'none';
      }
    }

    // Preset tags
    const presetButtons = this.container.querySelectorAll('.preset-tag');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (name && this.nameInput) {
          this.nameInput.value = name;
          this.nameInput.focus();
        }
      });
    });

    // Import file button & input
    const importBrowseBtn = document.getElementById('btn-import-browse');
    importBrowseBtn?.addEventListener('click', () => {
      this.fileInput?.click();
    });

    this.fileInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          importSaveWithValidation({
            content,
            filename: file.name,
            profileManager: this.profileManager,
            activeManifestId: this.profileManager.manifestId,
            onSuccess: (p) => {
              this.refresh();
              this.onImportCallback(content);
              this.setStatus(`Restored character ${p.name} successfully!`);
            },
            onError: (err) => {
              this.setStatus(`Import error: ${err}`);
            },
          });
          target.value = ''; // Reset input
        } catch (err) {
          this.setStatus(`Import failed: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    });

    // Viewport drag-and-drop on Title Screen
    if (this.container) {
      this.cleanupDragDrop = setupSaveDragAndDrop({
        container: this.container,
        onSaveFile: (content, filename) => {
          importSaveWithValidation({
            content,
            filename,
            profileManager: this.profileManager,
            activeManifestId: this.profileManager.manifestId,
            onSuccess: (p) => {
              this.refresh();
              this.onImportCallback(content);
              this.setStatus(`Restored character ${p.name} from ${filename}!`);
            },
            onError: (err) => {
              this.setStatus(`Import failed: ${err}`);
            },
          });
        },
      });
    }
  }

  public destroy(): void {
    if (this.cleanupDragDrop) {
      this.cleanupDragDrop();
      this.cleanupDragDrop = undefined;
    }
  }

  private embarkNewHero(): void {
    const name = this.nameInput?.value.trim() || resolveBranding(this.profileManager.manifest).defaultHeroName;
    this.onNewCharacterCallback(name, {
      attributes: { ...this.attributes },
      gender: this.selectedGender,
      difficulty: this.selectedDifficulty,
    });
  }

  public setGender(gender: Gender): void {
    this.selectedGender = gender;
    document.getElementById('btn-gender-male')?.classList.toggle('active', gender === 'male');
    document.getElementById('btn-gender-female')?.classList.toggle('active', gender === 'female');
  }

  public setDifficulty(diff: GameDifficulty): void {
    this.selectedDifficulty = diff;
    document.getElementById('btn-diff-easy')?.classList.toggle('active', diff === 'easy');
    document.getElementById('btn-diff-medium')?.classList.toggle('active', diff === 'medium');
    document.getElementById('btn-diff-hard')?.classList.toggle('active', diff === 'hard');
  }

  public rerollStats(): void {
    const roll = CharacterRoller.generateRoll(this.rollPrng.next.bind(this.rollPrng));
    this.attributes = roll.attributes;
    this.poolPoints = roll.availablePoints;
    this.updateStatRollUi();
  }

  public adjustStat(attr: keyof CharacterAttributes, delta: number): void {
    const res = CharacterRoller.adjustAttribute(this.attributes, attr, delta, this.poolPoints);
    if (res.success) {
      this.attributes = res.attributes;
      this.poolPoints = res.availablePoints;
      this.updateStatRollUi();
    } else if (res.message) {
      this.setStatus(res.message);
    }
  }

  private updateStatRollUi(): void {
    const strEl = document.getElementById('val-str');
    const intEl = document.getElementById('val-int');
    const conEl = document.getElementById('val-con');
    const dexEl = document.getElementById('val-dex');
    const poolEl = document.getElementById('roller-pool-points');

    if (strEl) strEl.textContent = this.attributes.strength.toString();
    if (intEl) intEl.textContent = this.attributes.intelligence.toString();
    if (conEl) conEl.textContent = this.attributes.constitution.toString();
    if (dexEl) dexEl.textContent = this.attributes.dexterity.toString();
    if (poolEl) poolEl.textContent = this.poolPoints.toString();

    const derived = CharacterRoller.calculateDerivedStats(this.attributes);
    const hpEl = document.getElementById('preview-hp');
    const manaEl = document.getElementById('preview-mana');
    const weightEl = document.getElementById('preview-weight');

    if (hpEl) hpEl.textContent = derived.maxHp.toString();
    if (manaEl) manaEl.textContent = derived.maxMana.toString();
    if (weightEl) weightEl.textContent = `${(derived.maxCarryWeight / 1000).toFixed(0)} kg`;
  }

  public openValhalla(): void {
    this.hall.open();
  }

  /** Redraws the hall if it is open, e.g. after a shared saga is inscribed. */
  public refreshValhalla(): void {
    this.hall.refresh();
  }

  public checkForSharedSagaInUrl(): void {
    if (typeof window === 'undefined' || !window.location) return;
    try {
      const url = new URL(window.location.href);
      const saga = url.searchParams.get('saga');
      if (saga && this.sagaShareModal) {
        this.sagaShareModal.openImport(saga);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
      this.refresh();
      this.checkForSharedSagaInUrl();
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public isVisible(): boolean {
    return this.container !== null && this.container.style.display !== 'none';
  }

  public setStatus(msg: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
    }
  }

  private getSelectedProfile(): CharacterProfile | null {
    if (!this.selectedProfileId) return null;
    return this.profileManager.getProfile(this.selectedProfileId);
  }

  public refresh(): void {
    const profiles = this.profileManager.listProfiles();
    const manifest = this.profileManager.getManifest();

    if (!this.selectedProfileId && manifest.activeProfileId) {
      this.selectedProfileId = manifest.activeProfileId;
    }

    // If still no selection or selected was deleted, pick first available
    if (!profiles.some((p) => p.id === this.selectedProfileId)) {
      this.selectedProfileId = profiles[0]?.id ?? null;
    }

    if (!this.rosterListEl) return;
    this.rosterListEl.innerHTML = '';

    if (profiles.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'roster-empty-notice';
      emptyMsg.textContent = 'No saved adventurers found. Roll a new hero to begin!';
      this.rosterListEl.appendChild(emptyMsg);
    } else {
      for (const profile of profiles) {
        const item = document.createElement('div');
        item.className = 'roster-item' + (profile.id === this.selectedProfileId ? ' selected' : '');
        item.dataset.id = profile.id;

        const dateStr = new Date(profile.lastSaved).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        // A fallen hero's roster record holds the death stats, but its slot holds the last
        // save made while alive (ARCHITECTURE.md §5) — say so rather than silently rewinding.
        const fallen = profile.questStatus === 'fallen';
        item.innerHTML = `
          <div class="roster-item-header">
            <span class="roster-name">${iconHtml(fallen ? 'fallen' : profile.gender === 'female' ? 'heroine' : 'hero')} ${this.escapeHtml(profile.name)}${fallen ? ' <span style="color: #f87171;">(Fallen)</span>' : ''}</span>
            <span class="roster-date">${dateStr}</span>
          </div>
          <div class="roster-item-details">
            <span>Level ${profile.level}</span>
            <span>•</span>
            <span>Floor ${profile.floor}</span>
            <span>•</span>
            <span style="font-weight: bold; color: var(--ui-accent, #f59e0b);">[${(profile.difficulty ?? 'medium').toUpperCase()}]</span>
            <span>•</span>
            <span>HP: ${profile.hp}/${profile.maxHp}</span>
          </div>
        `;

        item.addEventListener('click', () => {
          this.selectedProfileId = profile.id;
          this.updateSelection();
        });

        item.addEventListener('dblclick', () => {
          this.selectedProfileId = profile.id;
          this.onResumeCallback(profile.id);
        });

        this.rosterListEl.appendChild(item);
      }
    }

    this.updateSelection();
  }

  private updateSelection(): void {
    const hasSelection = this.selectedProfileId !== null;

    if (this.resumeBtn) this.resumeBtn.disabled = !hasSelection;
    if (this.exportBtn) this.exportBtn.disabled = !hasSelection;
    if (this.saveCodeBtn) this.saveCodeBtn.disabled = !hasSelection;
    if (this.deleteBtn) this.deleteBtn.disabled = !hasSelection;

    const items = this.rosterListEl?.querySelectorAll('.roster-item');
    items?.forEach((el) => {
      const isSelected = (el as HTMLElement).dataset.id === this.selectedProfileId;
      el.classList.toggle('selected', isSelected);
    });

    const selected = this.getSelectedProfile();
    const selectedFallen = selected?.questStatus === 'fallen';
    if (this.resumeBtn) this.resumeBtn.textContent = selectedFallen ? 'Load last save' : 'Resume';
    if (selected && selectedFallen) {
      this.setStatus(`${selected.name} fell on Floor ${selected.floor}. Loading restores the last save made while alive, not the moment of death.`);
    } else if (selected) {
      this.setStatus(`Ready to resume journey as ${selected.name} (${(selected.difficulty ?? 'medium').toUpperCase()}, Level ${selected.level}, Floor ${selected.floor}).`);
    } else {
      this.setStatus('Select an adventurer or roll a new hero to embark.');
    }

    if (this.autosaveManager && this.autosaveManager.hasAutosave()) {
      const meta = this.autosaveManager.getAutosaveMetadata();
      if (this.loadAutosaveBtn) {
        this.loadAutosaveBtn.style.display = 'block';
        this.loadAutosaveBtn.disabled = false;
        this.loadAutosaveBtn.textContent = `Load the autosave (${meta?.profileName ?? 'Hero'}, F${meta?.floor ?? 1})`;
      }
    } else if (this.loadAutosaveBtn) {
      this.loadAutosaveBtn.style.display = 'none';
    }

    this.updateStorageIndicator();
  }

  public updateStorageIndicator(): void {
    const info = getStoragePersistenceInfo();
    const formatted = formatStorageStatus(info);
    if (this.storageStatusEl) {
      this.storageStatusEl.textContent = formatted.badge;
      this.storageStatusEl.title = formatted.tooltip;
      if (formatted.isPersistent) {
        this.storageStatusEl.className = 'storage-badge-pill active';
      } else {
        this.storageStatusEl.className = 'storage-badge-pill';
      }
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
