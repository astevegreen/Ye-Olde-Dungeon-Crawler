import type { ProfileManager, AutosaveManager, AutosaveSlot, CharacterProfile } from '../engine';
import { showConfirmDialog } from './confirmDialog';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import { iconHtml } from './icons';
import type { UIModal } from './modalStack';
import { showToast } from './toast';

export interface SaveSlotModalOptions {
  profileManager: ProfileManager;
  autosaveManager?: AutosaveManager;
  onLoadProfile: (profileId: string) => Promise<boolean> | boolean;
  onLoadAutosave: (slot: AutosaveSlot) => Promise<boolean> | boolean;
  onClose?: () => void;
}

export class SaveSlotModal implements UIModal {
  public readonly id = 'save-slot-modal';
  private options: SaveSlotModalOptions;
  private overlayEl: HTMLElement | null = null;
  public isOpen = false;

  constructor(options: SaveSlotModalOptions) {
    this.options = options;
    this.createDom();
  }

  private createDom(): void {
    this.overlayEl = createDialogScrim('save-slot-modal');
    if (!this.overlayEl) return;
    // It opens from the main menu, where InputHandler is off and the modal stack routes
    // nothing: the overlay holds focus and takes its own keys.
    this.overlayEl.tabIndex = -1;
    this.overlayEl.style.outline = 'none';
    this.overlayEl.addEventListener('keydown', (e) => {
      if (this.handleKeyDown(e)) e.stopPropagation();
    });
  }

  public open(): void {
    this.isOpen = true;
    if (!this.overlayEl) {
      this.createDom();
    }
    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
      this.overlayEl.focus();
    }
  }

  /** Cancels out of the modal: hides it and hands control back via `onClose` (the main menu). */
  public close(): void {
    if (!this.hide()) return;
    this.options.onClose?.();
  }

  /** Hides without `onClose` — after a successful load the game owns the screen, and
   * `onClose` reopening the main menu would cover it. */
  private hide(): boolean {
    if (!this.isOpen) return false;
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return true;
    }

    return true;
  }

  private async handleLoadAutosave(slot: AutosaveSlot): Promise<void> {
    try {
      const success = await this.options.onLoadAutosave(slot);
      if (success) {
        this.hide();
      } else {
        showToast('Unable to load autosave payload: save data is invalid or empty.', 'error');
      }
    } catch (err) {
      showToast(`Autosave file is corrupt or unreadable: ${(err as Error).message}`, 'error');
    }
  }

  private async handleLoadProfile(profileId: string): Promise<void> {
    try {
      const success = await this.options.onLoadProfile(profileId);
      if (success) {
        this.hide();
      } else {
        showToast(`Unable to load character save: save payload not found.`, 'error');
      }
    } catch (err) {
      showToast(`Save file is corrupt or unreadable: ${(err as Error).message}`, 'error');
    }
  }

  private handleDeleteProfile(profileId: string, profileName: string): void {
    showConfirmDialog({
      title: `Delete ${profileName}?`,
      icon: 'delete',
      message: `${profileName}'s save will be gone for good. This cannot be undone.`,
      confirmLabel: 'Delete save',
      cancelLabel: 'Keep',
      onConfirm: () => {
        try {
          this.options.profileManager.deleteCharacter(profileId);
          showToast(`Deleted save for ${profileName}.`, 'info');
          this.render();
        } catch (err) {
          showToast(`Failed to delete profile: ${(err as Error).message}`, 'error');
        }
      },
    });
  }

  private autosaveCardHtml(
    slot: AutosaveSlot,
    meta: { timestamp: number; profileName: string; floor: number }
  ): string {
    const preserved = slot === 'preserved';
    const dateStr = new Date(meta.timestamp).toLocaleString();
    return `
      <div class="ui-card slot-card is-autosave${preserved ? ' is-preserved' : ''}">
        <div class="slot-main">
          <div class="slot-head">
            <span class="slot-tag is-auto">${preserved ? 'Earlier autosave' : 'Autosave'}</span>
            <span class="slot-name">${escapeHtml(meta.profileName)}</span>
            <span class="ui-muted">Floor ${meta.floor}</span>
          </div>
          <div class="ui-note">${iconHtml('clock')} Saved ${escapeHtml(dateStr)}</div>
          ${preserved ? '<div class="ui-note">Kept aside when a newer autosave would have overwritten it.</div>' : ''}
        </div>
        ${dialogButton(`btn-load-autosave-${slot}`, preserved ? 'Resume earlier autosave' : 'Resume autosave', { icon: 'autosave', primary: !preserved })}
      </div>`;
  }

  private profileCardHtml(prof: CharacterProfile): string {
    const dateStr = new Date(prof.lastSaved).toLocaleString();
    const badge =
      prof.questStatus === 'victorious'
        ? `<span class="slot-tag is-won">${iconHtml('trophy')} Victor</span>`
        : prof.questStatus === 'fallen'
          ? `<span class="slot-tag is-lost">${iconHtml('fallen')} Fallen</span>`
          : '<span class="slot-tag">Active</span>';
    const difficulty = prof.difficulty ? prof.difficulty.charAt(0).toUpperCase() + prof.difficulty.slice(1) : 'Normal';
    const id = escapeHtml(prof.id);
    const name = escapeHtml(prof.name);
    return `
      <div class="ui-card slot-card" data-profile-id="${id}">
        <div class="slot-main">
          <div class="slot-head">
            <span class="slot-name">${name}</span>
            <span class="slot-level">Level ${prof.level}</span>
            <span class="ui-muted">Floor ${prof.floor}</span>
            ${badge}
          </div>
          <div class="ui-note">Difficulty ${escapeHtml(difficulty)} · Health ${prof.hp}/${prof.maxHp} · Strength ${prof.strength}</div>
          <div class="ui-note ui-faint">Saved ${escapeHtml(dateStr)}</div>
        </div>
        <div class="slot-actions">
          <button type="button" class="ui-btn ui-btn--sm btn-load-profile" data-profile-id="${id}">${iconHtml('load')} Load</button>
          <button type="button" class="ui-btn ui-btn--sm ui-btn--danger btn-delete-profile" data-profile-id="${id}" data-profile-name="${name}" title="Delete this save" aria-label="Delete ${name}'s save">${iconHtml('delete')}</button>
        </div>
      </div>`;
  }

  public render(): void {
    if (!this.overlayEl) return;

    const autosaveMeta = this.options.autosaveManager?.getAutosaveMetadata('latest');
    const preservedMeta = this.options.autosaveManager?.getAutosaveMetadata('preserved');
    const profiles = this.options.profileManager.listProfiles();

    const autosaveCards =
      (autosaveMeta ? this.autosaveCardHtml('latest', autosaveMeta) : '') +
      (preservedMeta ? this.autosaveCardHtml('preserved', preservedMeta) : '');

    let profileList = '';
    if (profiles.length === 0 && !autosaveMeta && !preservedMeta) {
      profileList = `<div class="ui-note slot-empty">No saves on this machine yet. Choose New game on the title screen to begin an adventure.</div>`;
    } else if (profiles.length > 0) {
      profileList = [...profiles]
        .sort((a, b) => b.lastSaved - a.lastSaved)
        .map((prof) => this.profileCardHtml(prof))
        .join('');
    }

    this.overlayEl.innerHTML = dialogHtml({
      title: 'Load a saved game',
      icon: 'save',
      closeId: 'btn-close-saveslot-top',
      closeTitle: 'Back (Esc)',
      body: `
        ${autosaveCards ? `<div class="slot-list">${autosaveCards}</div>` : ''}
        <div class="ui-dialog-label">Character saves (${profiles.length})</div>
        <div class="slot-list profiles-list">${profileList}</div>`,
      footNote: '<span>A damaged save is refused safely; it never stops the game.</span>',
      actions: dialogButton('btn-close-saveslot-bottom', 'Back', { key: 'Esc' }),
    });

    // Bind event listeners
    this.overlayEl.querySelector('#btn-close-saveslot-top')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btn-close-saveslot-bottom')?.addEventListener('click', () => this.close());

    for (const slot of ['latest', 'preserved'] as const) {
      this.overlayEl.querySelector(`#btn-load-autosave-${slot}`)?.addEventListener('click', () => {
        void this.handleLoadAutosave(slot);
      });
    }

    const loadBtns = this.overlayEl.querySelectorAll('.btn-load-profile');
    loadBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const profId = (e.currentTarget as HTMLElement).getAttribute('data-profile-id');
        if (profId) {
          void this.handleLoadProfile(profId);
        }
      });
    });

    const delBtns = this.overlayEl.querySelectorAll('.btn-delete-profile');
    delBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const profId = (e.currentTarget as HTMLElement).getAttribute('data-profile-id');
        const profName = (e.currentTarget as HTMLElement).getAttribute('data-profile-name') ?? 'Hero';
        if (profId) {
          this.handleDeleteProfile(profId, profName);
        }
      });
    });

    // A redraw drops whichever button had focus; the overlay takes it back so Escape still lands.
    if (this.isOpen) this.overlayEl.focus();
  }
}
