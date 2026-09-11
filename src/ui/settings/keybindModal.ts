import type { UIModal } from '../modalStack';
import { SettingsManager, ACTION_METADATA, type ActionMetadata } from './settingsManager';

export interface KeybindModalOptions {
  settingsManager: SettingsManager;
  onClose?: () => void;
}

export class KeybindModal implements UIModal {
  public readonly id = 'settings';
  public isOpen = false;

  private settingsManager: SettingsManager;
  private onCloseCallback?: () => void;
  private modalEl: HTMLElement | null = null;
  private listeningActionId: string | null = null;
  private statusMessage = '';
  private statusTimer: any = null;

  private boundKeyDownHandler = (e: KeyboardEvent) => {
    if (this.isOpen) {
      this.handleKeyDown(e);
    }
  };

  constructor(options: KeybindModalOptions) {
    this.settingsManager = options.settingsManager;
    this.onCloseCallback = options.onClose;
    this.createDom();
  }

  public open(): void {
    if (typeof document !== 'undefined' && !this.modalEl) {
      this.createDom();
    }
    this.isOpen = true;
    this.listeningActionId = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDownHandler, true);
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.renderContent();
    }
  }

  public close(): void {
    this.isOpen = false;
    this.listeningActionId = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler, true);
    }
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    try {
      // If currently listening for a key to bind
      if (this.listeningActionId) {
        e.preventDefault();
        e.stopPropagation();

        if (e.code === 'Escape') {
          this.listeningActionId = null;
          this.setStatus('Keybinding cancelled.');
          this.renderContent();
          return true;
        }

        const actionId = this.listeningActionId;
        this.listeningActionId = null;

        const result = this.settingsManager.bindKey(actionId, e.code);
        const actionMeta = ACTION_METADATA.find((m) => m.id === actionId);
        const actionName = actionMeta?.name ?? actionId;

        if (result.conflictWith) {
          const conflictMeta = ACTION_METADATA.find((m) => m.id === result.conflictWith);
          const conflictName = conflictMeta?.name ?? result.conflictWith;
          this.setStatus(`Reassigned [${e.code}] from "${conflictName}" to "${actionName}".`);
        } else {
          this.setStatus(`Bound [${e.code}] to "${actionName}".`);
        }

        this.renderContent();
        return true;
      }

      // Default modal key navigation
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
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
      statusEl.textContent = this.statusMessage || 'Click any key badge to rebind, or click [✕] to remove.';
    }
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;
    let existing = document.getElementById('settings-keybind-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'settings-keybind-modal';
    modal.className = 'retro-window-overlay';
    modal.style.display = 'none';
    modal.style.zIndex = '250';

    modal.innerHTML = `
      <div class="retro-window" style="width: 740px; max-width: 96vw; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>⚙️</span>
            <span>Game Settings &amp; Input Configuration</span>
          </div>
          <button id="btn-settings-close-x" class="win-btn win-btn-sm" style="padding: 0 6px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto;">
          <!-- 1. Movement Systems & Guide Panel -->
          <fieldset class="retro-group" style="padding: 10px 12px;">
            <legend style="font-weight: bold; color: #1e3a8a;">🧭 Movement Modes &amp; Ergonomics</legend>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Standard Movement -->
              <div class="movement-mode-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 13px; font-weight: bold; color: #0f172a;">1. Standard (NumPad &amp; Vi-Keys)</span>
                  <span id="badge-standard-mode" class="storage-badge-pill" style="font-size: 10px; padding: 2px 6px;">0ms Latency</span>
                </div>
                <p style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
                  Instant cardinal arrow keys &amp; 8-directional Numpad (0ms input latency). Best for desktop keyboards with a full number pad.
                </p>
              </div>

              <!-- Micro-Debounce Buffer (Arrow-Key Chording) -->
              <div class="movement-mode-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: bold; color: #0f172a;">
                    <input type="checkbox" id="chk-arrow-chording" style="width: 15px; height: 15px; cursor: pointer;" />
                    <span>2. Micro-Debounce Buffer (Arrow-Key Chording)</span>
                  </label>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <label for="rng-chord-buffer" style="font-size: 11px; color: #334155; font-weight: bold;">Buffer:</label>
                    <input type="range" id="rng-chord-buffer" min="25" max="75" step="5" value="40" style="width: 80px; cursor: pointer;" />
                    <span id="lbl-chord-buffer-ms" style="font-size: 11px; font-weight: bold; color: #1e40af; width: 34px;">40ms</span>
                  </div>
                </div>
                <p style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
                  Press two adjacent arrow keys together within 40ms to step diagonally (e.g., Up + Right = Northeast). Ideal for laptops and compact keyboards without a numpad.
                </p>
              </div>

              <!-- The Hover Ring (Mouse Vectoring) -->
              <div class="movement-mode-card" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: bold; color: #0f172a;">
                    <input type="checkbox" id="chk-mouse-vectoring" style="width: 15px; height: 15px; cursor: pointer;" />
                    <span>3. The 'Hover Ring' (Mouse Vectoring)</span>
                  </label>
                  <span class="storage-badge-pill" style="font-size: 10px; padding: 2px 6px;">Tactical Overlay</span>
                </div>
                <p style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
                  Displays a subtle 8-directional ring around your character when hovering the mouse. Click any adjacent tile to step or attack, or click a distant tile to auto-pathfind.
                </p>
              </div>
            </div>
          </fieldset>

          <!-- 2. Keybinding Remapper Panel -->
          <fieldset class="retro-group" style="padding: 10px 12px; flex: 1;">
            <legend style="font-weight: bold; color: #1e3a8a;">⌨️ Keybinding Remapper</legend>

            <!-- Category Filter Tabs -->
            <div style="display: flex; gap: 4px; margin-bottom: 8px;">
              <button type="button" class="win-btn win-btn-sm tab-btn active" data-cat="Locomotion">🏃 Locomotion</button>
              <button type="button" class="win-btn win-btn-sm tab-btn" data-cat="Combat & Magic">⚔️ Combat &amp; Magic</button>
              <button type="button" class="win-btn win-btn-sm tab-btn" data-cat="Interaction & Inventory">🎒 Interaction &amp; Inventory</button>
            </div>

            <!-- Keybind list container -->
            <div id="settings-keybind-list" style="background: #ffffff; border: 2px inset #ffffff; max-height: 220px; overflow-y: auto; padding: 6px;">
              <!-- Dynamic rows rendered here -->
            </div>
          </fieldset>

          <!-- Footer button row -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <button type="button" id="btn-settings-reset" class="win-btn" style="padding: 5px 12px; font-size: 12px;">
              🔄 Reset to Defaults
            </button>
            <button type="button" id="btn-settings-done" class="win-btn primary-btn" style="padding: 6px 18px; font-size: 13px; font-weight: bold;">
              ✓ Done / Close
            </button>
          </div>

          <div class="retro-statusbar" style="margin-top: 4px;">
            <span id="settings-status">Click any key badge to rebind, or click [✕] to remove.</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

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
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.getAttribute('data-cat') as ActionMetadata['category'];
        this.renderKeybindList(cat);
      });
    });
  }

  private renderContent(): void {
    this.renderMovementToggles();
    const activeTab = this.modalEl?.querySelector('.tab-btn.active') as HTMLElement | null;
    const cat = (activeTab?.getAttribute('data-cat') as ActionMetadata['category']) || 'Locomotion';
    this.renderKeybindList(cat);
    this.updateStatusBar();
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

    const standardBadge = this.modalEl.querySelector('#badge-standard-mode');
    if (standardBadge) {
      if (!settings.arrowChordingEnabled) {
        standardBadge.textContent = 'ACTIVE (0ms Latency)';
        standardBadge.classList.add('active');
      } else {
        standardBadge.textContent = 'Standard Input';
        standardBadge.classList.remove('active');
      }
    }
  }

  private renderKeybindList(category: ActionMetadata['category']): void {
    const listEl = this.modalEl?.querySelector('#settings-keybind-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const actions = ACTION_METADATA.filter((m) => m.category === category);

    for (const meta of actions) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '5px 8px';
      row.style.borderBottom = '1px solid #e2e8f0';
      row.style.fontSize = '12px';

      const label = document.createElement('div');
      label.style.fontWeight = 'bold';
      label.style.color = '#1e293b';
      label.textContent = meta.name;
      row.appendChild(label);

      const badgesCol = document.createElement('div');
      badgesCol.style.display = 'flex';
      badgesCol.style.alignItems = 'center';
      badgesCol.style.gap = '4px';

      const boundCodes = this.settingsManager.getCodesForAction(meta.id);

      for (const code of boundCodes) {
        const badge = document.createElement('span');
        badge.className = 'keybind-badge';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '4px';
        badge.style.background = '#e2e8f0';
        badge.style.border = '1px solid #94a3b8';
        badge.style.padding = '2px 6px';
        badge.style.fontSize = '11px';
        badge.style.fontFamily = '"Courier New", monospace';
        badge.style.fontWeight = 'bold';
        badge.style.color = '#0f172a';
        badge.style.cursor = 'pointer';

        badge.innerHTML = `<span>${code}</span><span style="color: #ef4444; font-weight: bold; margin-left: 2px;" title="Unbind key">✕</span>`;

        // Click X to unbind
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          this.settingsManager.unbindKey(code);
          this.setStatus(`Unbound [${code}] from "${meta.name}".`);
          this.renderContent();
        });

        badgesCol.appendChild(badge);
      }

      // "Add Binding" / "Press any key..." badge button
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'win-btn win-btn-sm';
      addBtn.style.padding = '2px 8px';
      addBtn.style.fontSize = '11px';

      if (this.listeningActionId === meta.id) {
        addBtn.textContent = '⌨ Press any key...';
        addBtn.style.background = '#fef08a';
        addBtn.style.color = '#854d0e';
        addBtn.style.borderColor = '#ca8a04';
      } else {
        addBtn.textContent = boundCodes.length === 0 ? '+ Bind Key' : '+';
        addBtn.title = `Add alternative keybinding for ${meta.name}`;
      }

      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.listeningActionId === meta.id) {
          this.listeningActionId = null;
          this.setStatus('Keybinding cancelled.');
        } else {
          this.listeningActionId = meta.id;
          this.setStatus(`Press any key to bind to "${meta.name}" (Esc to cancel)...`);
        }
        this.renderContent();
      });

      badgesCol.appendChild(addBtn);
      row.appendChild(badgesCol);
      listEl.appendChild(row);
    }
  }
}
