import type { UIModal, ModalStackManager } from '../modalStack';
import { SettingsManager, ACTION_METADATA, hardWiredConflict, type ActionMetadata } from './settingsManager';
import { createDialogScrim, dialogButton, dialogHtml } from '../dialog';
import { escapeHtml } from '../html';
import { keyLabel } from '../keyLabel';
import { formatStorageStatus, getStoragePersistenceInfo } from '../persistenceInit';
import { AUTO_PICKUP_GROUPS, type AutoPickupGroup } from '../autoPickup';
import { UI_SCALE_STEPS, type UiScaleSetting } from '../uiScale';

export interface KeybindModalOptions {
  settingsManager: SettingsManager;
  onClose?: () => void;
}

export class KeybindModal implements UIModal {
  public readonly id = 'settings';
  public isOpen = false;
  /** Whether the window is showing. Kept apart from `isOpen`, which the modal stack clears
   *  before it calls `close()`, so a stack-driven close still hides the window. */
  private shown = false;

  private settingsManager: SettingsManager;
  private onCloseCallback?: () => void;
  private modalStack?: ModalStackManager;
  private modalEl: HTMLElement | null = null;
  private listeningActionId: string | null = null;
  private statusMessage = '';
  private statusTimer: any = null;

  constructor(options: KeybindModalOptions) {
    this.settingsManager = options.settingsManager;
    this.onCloseCallback = options.onClose;
    this.createDom();
  }

  /** The stack this modal pushes and removes its own single entry on, once one exists. */
  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public open(): void {
    if (typeof document !== 'undefined' && !this.modalEl) {
      this.createDom();
    }
    this.isOpen = true;
    this.shown = true;
    this.listeningActionId = null;
    if (this.modalStack && !this.modalStack.has(this.id)) {
      this.modalStack.push(this);
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.renderContent();
    }
  }

  public close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.isOpen = false;
    this.listeningActionId = null;
    if (this.modalEl) {
      // Release focus, so keys go back to the page (and InputHandler), not a hidden overlay.
      const focused = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
      if (focused && typeof this.modalEl.contains === 'function' && this.modalEl.contains(focused)) {
        focused.blur();
      }
      this.modalEl.style.display = 'none';
    }
    if (this.modalStack?.has(this.id)) {
      this.modalStack.remove(this.id);
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    // Every key the open modal receives stops here, so InputHandler's window listener never
    // sees it as well. Only keys the modal acts on are preventDefault-ed, so the checkboxes
    // and the buffer slider keep their native keys.
    e.stopPropagation();

    try {
      // If currently listening for a key to bind
      if (this.listeningActionId) {
        e.preventDefault();

        if (e.code === 'Escape') {
          this.listeningActionId = null;
          this.setStatus('Keybinding cancelled.');
          this.renderContent();
          return true;
        }

        const actionId = this.listeningActionId;
        const actionMeta = ACTION_METADATA.find((m) => m.id === actionId);
        const actionName = actionMeta?.name ?? actionId;
        const key = keyLabel(e.code);

        // A key the game answers before it reads bindings would never reach this action.
        const taken = hardWiredConflict(actionId, e.code);
        if (taken) {
          this.setStatus(`${key} ${taken}, so it can't be "${actionName}". Press another key (Esc to cancel).`);
          this.renderContent();
          return true;
        }
        this.listeningActionId = null;

        const result = this.settingsManager.bindKey(actionId, e.code);
        if (result.conflictWith) {
          const conflictMeta = ACTION_METADATA.find((m) => m.id === result.conflictWith);
          const conflictName = conflictMeta?.name ?? result.conflictWith;
          this.setStatus(`Moved ${key} from "${conflictName}" to "${actionName}".`);
        } else {
          this.setStatus(`Bound ${key} to "${actionName}".`);
        }

        this.renderContent();
        return true;
      }

      // Default modal key navigation
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
        return true;
      }

      return true; // absorb other keys while modal is open
    } catch (err) {
      this.close();
      throw err;
    }
  }

  private setStatus(msg: string): void {
    this.statusMessage = msg;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
    this.statusTimer = setTimeout(() => {
      this.statusMessage = '';
      this.updateStatusBar();
    }, 4000);
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const statusEl = this.modalEl?.querySelector('#settings-status');
    if (statusEl) {
      statusEl.textContent = this.statusMessage || 'Click + to add a key; click a key to remove it.';
    }
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;
    let existing = document.getElementById('settings-keybind-modal');
    if (existing) {
      existing.remove();
    }

    const modal = createDialogScrim('settings-keybind-modal', 'system');
    if (!modal) return;

    const option = (id: string | null, title: string, text: string, extra = ''): string => `
      <div class="set-option">
        <div class="set-option-head">
          ${id ? `<label class="set-check"><input type="checkbox" id="${id}" /> ${escapeHtml(title)}</label>` : `<span class="set-check">${escapeHtml(title)}</span>`}
          ${extra}
        </div>
        <div class="ui-note">${text}</div>
      </div>`;
    const scaleSelect = `<select id="sel-ui-scale" class="set-select" aria-label="Interface size"><option value="auto">Auto</option>${UI_SCALE_STEPS.map((s) => `<option value="${s}">${Math.round(s * 100)}%</option>`).join('')}</select>`;
    const chordRange =
      '<span class="set-range"><label for="rng-chord-buffer">Window</label><input type="range" id="rng-chord-buffer" min="25" max="75" step="5" value="40" /><span id="lbl-chord-buffer-ms" class="ui-num">40ms</span></span>';

    // Done and Reset sit in the frame's footer, so they stay in view however far the body scrolls.
    modal.innerHTML = dialogHtml({
      title: 'Settings',
      kicker: 'Game',
      closeId: 'btn-settings-close-x',
      size: 'wide',
      body: `
        <div class="ui-h">Movement and display</div>
        ${option(null, 'Standard (Arrows, NumPad, WASD, H J K Y N)', 'Arrow keys and the number pad move at once, diagonals on the pad. W A D and H J K Y N also move; S, L, U and B stay Search, Look, the Character tab and the Bestiary. You can also click a distant tile to walk there; the Hover Ring below adds clicking next to you to step or attack.', '<span id="badge-standard-mode" class="storage-badge-pill">Standard input</span>')}
        ${option('chk-arrow-chording', 'Micro-Debounce Buffer (Arrow-Key Chording)', 'Press two arrow keys together to step diagonally (Up and Right goes northeast). Handy on keyboards without a number pad.', chordRange)}
        ${option('chk-mouse-vectoring', "The 'Hover Ring' (Mouse Vectoring)", 'Shows a ring of eight directions around your hero under the mouse. Click a neighboring tile to step or attack, or a distant one to walk there.')}
        ${option('chk-mouse-aim', 'Mouse aiming', 'While you aim a spell, wand or scroll, the target follows the mouse and a click on the map fires. The keys still aim and fire either way.')}
        ${option(null, 'Interface size', 'How large the bars, sidebar, menus and dialogs are drawn. Auto grows them with a large window (125% at 1920 × 1080); the map takes the room they leave.', scaleSelect)}
        ${option('chk-torchlight', 'Torchlight', 'What you can see darkens toward the edge of your sight, with warm light around your hero. Off gives flat, even lighting.')}
        ${option('chk-inventory-hover-cards', 'Rich inventory hover cards', 'Shows full stat cards when you hover items in your inventory. Off shows the name only.')}
        ${option('chk-hints', 'First-time hints', 'The first time you meet an altar, a pact keeper, a companion and the like, a short note about it appears under the sidebar. Each shows once per hero. In the opening scene, the slot for the move the moment calls for also glows.')}
        ${option('chk-controls-primer', 'Controls reminder', 'Before a new hero takes their first step, a short note on moving, fighting and where to change the keys.')}

        <div class="ui-h">Picking up</div>
        <div class="set-option">
          <div class="set-option-head"><span class="set-check">Pick up when you step on them</span></div>
          <div class="set-pickups">${AUTO_PICKUP_GROUPS.map((g) => `<label class="set-check"><input type="checkbox" data-pickup="${g.id}" /> ${escapeHtml(g.label)}</label>`).join('')}</div>
          <div class="ui-note">Coins are always picked up. What you marked as junk, or what will not fit, stays on the ground.</div>
        </div>

        <div class="ui-h">Keys</div>
        <div class="st-subtabs" role="tablist">
          <button type="button" class="st-subtab tab-btn active" role="tab" aria-selected="true" data-cat="Locomotion">Movement</button>
          <button type="button" class="st-subtab tab-btn" role="tab" aria-selected="false" data-cat="Combat & Magic">Combat and magic</button>
          <button type="button" class="st-subtab tab-btn" role="tab" aria-selected="false" data-cat="Interaction & Inventory">Interaction and inventory</button>
        </div>
        <div id="settings-keybind-list" class="ui-inset set-keys"></div>

        <div class="ui-h">Storage</div>
        <div class="set-option">
          <div class="set-option-head"><span class="set-check">Saved games in this browser</span><span id="settings-storage-badge" class="storage-badge-pill">Storage: checking...</span></div>
          <div id="settings-storage-details" class="ui-note"></div>
        </div>`,
      footNote: '<span id="settings-status"></span>',
      actions: dialogButton('btn-settings-reset', 'Reset to defaults') + dialogButton('btn-settings-done', 'Done', { primary: true, key: 'Esc' }),
    });

    this.modalEl = modal;
    // Focusable, so a click anywhere in the overlay (or on a button, which WebKit does not
    // focus) keeps keyboard focus — and keydown — inside the modal.
    modal.tabIndex = -1;
    modal.style.outline = 'none';

    // The modal's one input path. The overlay holds focus while open (holdFocus), so every
    // keystroke passes this listener before InputHandler's window listener, and
    // handleKeyDown stops it there. That is what rebinding needs: raw keys, before
    // InputHandler claims F1/F2/F3 and the backquote. It also works on the main menu, where
    // InputHandler is disabled and the modal stack routes nothing.
    modal.addEventListener('keydown', (e) => this.handleKeyDown(e as KeyboardEvent));

    // Attach base controls
    modal.querySelector('#btn-settings-close-x')?.addEventListener('click', () => this.close());
    modal.querySelector('#btn-settings-done')?.addEventListener('click', () => this.close());

    modal.querySelector('#btn-settings-reset')?.addEventListener('click', () => {
      this.settingsManager.resetToDefaults();
      this.setStatus('Reset all settings and keybindings to defaults.');
      this.renderContent();
    });

    // Arrow Chording Checkbox
    const chordChk = modal.querySelector('#chk-arrow-chording') as HTMLInputElement | null;
    chordChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ arrowChordingEnabled: chordChk.checked });
      this.renderMovementToggles();
    });

    // Arrow Chord Buffer Slider
    const chordRng = modal.querySelector('#rng-chord-buffer') as HTMLInputElement | null;
    chordRng?.addEventListener('input', () => {
      const val = parseInt(chordRng.value, 10);
      const lbl = modal.querySelector('#lbl-chord-buffer-ms');
      if (lbl) lbl.textContent = `${val}ms`;
      this.settingsManager.updateSettings({ arrowChordBufferMs: val });
    });

    const torchChk = modal.querySelector('#chk-torchlight') as HTMLInputElement | null;
    torchChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ torchlightEnabled: torchChk.checked });
    });

    const hoverCardsChk = modal.querySelector('#chk-inventory-hover-cards') as HTMLInputElement | null;
    hoverCardsChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ inventoryRichHoverCards: hoverCardsChk.checked });
    });

    const hintsChk = modal.querySelector('#chk-hints') as HTMLInputElement | null;
    hintsChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ hintsEnabled: hintsChk.checked });
    });

    const primerChk = modal.querySelector('#chk-controls-primer') as HTMLInputElement | null;
    primerChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ controlsPrimerEnabled: primerChk.checked });
    });

    modal.querySelectorAll<HTMLInputElement>('[data-pickup]').forEach((box) => {
      box.addEventListener('change', () => {
        const group = box.dataset.pickup as AutoPickupGroup;
        this.settingsManager.updateSettings({ autoPickup: { ...this.settingsManager.getSettings().autoPickup, [group]: box.checked } });
      });
    });

    const scaleSel = modal.querySelector('#sel-ui-scale') as HTMLSelectElement | null;
    scaleSel?.addEventListener('change', () => {
      const uiScale: UiScaleSetting = scaleSel.value === 'auto' ? 'auto' : Number(scaleSel.value);
      this.settingsManager.updateSettings({ uiScale });
    });

    const aimChk = modal.querySelector('#chk-mouse-aim') as HTMLInputElement | null;
    aimChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ mouseAimEnabled: aimChk.checked });
    });

    // Mouse Vectoring Checkbox
    const mouseChk = modal.querySelector('#chk-mouse-vectoring') as HTMLInputElement | null;
    mouseChk?.addEventListener('change', () => {
      this.settingsManager.updateSettings({ mouseVectoringEnabled: mouseChk.checked });
      this.renderMovementToggles();
    });

    // Category Tabs
    const tabs = modal.querySelectorAll('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const cat = tab.getAttribute('data-cat') as ActionMetadata['category'];
        this.renderKeybindList(cat);
      });
    });
  }

  private renderContent(): void {
    this.renderMovementToggles();
    this.renderStorage();
    const activeTab = this.modalEl?.querySelector('.tab-btn.active') as HTMLElement | null;
    const cat = (activeTab?.getAttribute('data-cat') as ActionMetadata['category']) || 'Locomotion';
    this.renderKeybindList(cat);
    this.updateStatusBar();
    this.holdFocus();
  }

  /**
   * Keeps keyboard focus inside the open modal, so every keystroke passes its overlay's
   * listener. Re-rendering the keybind list removes the button just clicked, which drops
   * focus to the page body, where the next key (the one to bind) would miss the overlay.
   */
  private holdFocus(): void {
    if (!this.isOpen || !this.modalEl || typeof document === 'undefined') return;
    const focused = document.activeElement;
    if (focused && typeof this.modalEl.contains === 'function' && this.modalEl.contains(focused)) return;
    if (typeof this.modalEl.focus === 'function') this.modalEl.focus();
  }

  private renderMovementToggles(): void {
    if (!this.modalEl) return;
    const settings = this.settingsManager.getSettings();

    const chordChk = this.modalEl.querySelector('#chk-arrow-chording') as HTMLInputElement | null;
    if (chordChk) chordChk.checked = settings.arrowChordingEnabled;

    const chordRng = this.modalEl.querySelector('#rng-chord-buffer') as HTMLInputElement | null;
    if (chordRng) chordRng.value = String(settings.arrowChordBufferMs);

    const lbl = this.modalEl.querySelector('#lbl-chord-buffer-ms');
    if (lbl) lbl.textContent = `${settings.arrowChordBufferMs}ms`;

    const mouseChk = this.modalEl.querySelector('#chk-mouse-vectoring') as HTMLInputElement | null;
    if (mouseChk) mouseChk.checked = settings.mouseVectoringEnabled;
    const aimChk = this.modalEl.querySelector('#chk-mouse-aim') as HTMLInputElement | null;
    if (aimChk) aimChk.checked = settings.mouseAimEnabled;
    const scaleSel = this.modalEl.querySelector('#sel-ui-scale') as HTMLSelectElement | null;
    if (scaleSel) scaleSel.value = String(settings.uiScale);
    const torchChk = this.modalEl.querySelector('#chk-torchlight') as HTMLInputElement | null;
    if (torchChk) torchChk.checked = settings.torchlightEnabled;
    const hoverCardsChk = this.modalEl.querySelector('#chk-inventory-hover-cards') as HTMLInputElement | null;
    if (hoverCardsChk) hoverCardsChk.checked = settings.inventoryRichHoverCards;
    const hintsChk = this.modalEl.querySelector('#chk-hints') as HTMLInputElement | null;
    if (hintsChk) hintsChk.checked = settings.hintsEnabled;
    const primerChk = this.modalEl.querySelector('#chk-controls-primer') as HTMLInputElement | null;
    if (primerChk) primerChk.checked = settings.controlsPrimerEnabled;
    this.modalEl.querySelectorAll<HTMLInputElement>('[data-pickup]').forEach((box) => {
      box.checked = settings.autoPickup[box.dataset.pickup as AutoPickupGroup] ?? false;
    });

    const standardBadge = this.modalEl.querySelector('#badge-standard-mode');
    if (standardBadge) {
      if (!settings.arrowChordingEnabled) {
        standardBadge.textContent = 'In use';
        standardBadge.classList.add('active');
      } else {
        standardBadge.textContent = 'Standard input';
        standardBadge.classList.remove('active');
      }
    }
  }

  /** Whether the browser may clear saved games under storage pressure (moved here from the pause menu). */
  private renderStorage(): void {
    const badge = this.modalEl?.querySelector('#settings-storage-badge');
    const details = this.modalEl?.querySelector('#settings-storage-details');
    if (!badge || !details) return;
    try {
      const formatted = formatStorageStatus(getStoragePersistenceInfo());
      badge.textContent = formatted.badge;
      badge.className = formatted.isPersistent ? 'storage-badge-pill active' : 'storage-badge-pill';
      details.textContent = formatted.tooltip;
    } catch {
      badge.textContent = 'Storage: standard';
    }
  }

  private renderKeybindList(category: ActionMetadata['category']): void {
    const listEl = this.modalEl?.querySelector('#settings-keybind-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const actions = ACTION_METADATA.filter((m) => m.category === category);

    for (const meta of actions) {
      const row = document.createElement('div');
      row.className = 'set-key-row';

      const label = document.createElement('div');
      label.className = 'set-key-name';
      label.textContent = meta.name;
      row.appendChild(label);

      const badgesCol = document.createElement('div');
      badgesCol.className = 'set-key-chips';

      const boundCodes = this.settingsManager.getCodesForAction(meta.id);

      for (const code of boundCodes) {
        const badge = document.createElement('span');
        badge.className = 'keybind-badge';
        badge.title = `Remove ${keyLabel(code)}`;
        badge.innerHTML = `<span>${escapeHtml(keyLabel(code))}</span><span class="set-key-x" aria-hidden="true">✕</span>`;

        // Click to unbind
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          this.settingsManager.unbindKey(code);
          this.setStatus(`Removed ${keyLabel(code)} from "${meta.name}".`);
          this.renderContent();
        });

        badgesCol.appendChild(badge);
      }

      // "+" adds a key; while listening it says so
      const addBtn = document.createElement('button');
      addBtn.type = 'button';

      if (this.listeningActionId === meta.id) {
        addBtn.textContent = 'Press a key...';
        addBtn.className = 'ui-btn ui-btn--sm ui-btn--primary';
      } else {
        addBtn.className = 'ui-btn ui-btn--sm';
        addBtn.textContent = boundCodes.length === 0 ? '+ Add a key' : '+';
        addBtn.title = `Add alternative keybinding for ${meta.name}`;
      }

      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.listeningActionId === meta.id) {
          this.listeningActionId = null;
          this.setStatus('Keybinding cancelled.');
        } else {
          this.listeningActionId = meta.id;
          this.setStatus(`Press a key for "${meta.name}" (Esc to cancel).`);
        }
        this.renderContent();
      });

      badgesCol.appendChild(addBtn);
      row.appendChild(badgesCol);
      listEl.appendChild(row);
    }
  }
}
