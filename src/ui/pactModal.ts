import type { GameEngine } from '../engine';
import type { UIModal } from './modalStack';

export class PactModal implements UIModal {
  public readonly id = 'pact-modal';
  private overlayEl: HTMLElement | null = null;
  private isOpenState = false;
  private selectedPactId: string = '';
  private engine?: GameEngine;
  private onCloseCallback?: () => void;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('pact-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pact-modal';
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '180';
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  public set isOpen(val: boolean) {
    this.isOpenState = val;
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    this.onCloseCallback = onClose;
    this.isOpenState = true;

    const pacts = this.engine.pacts?.getAllPacts() ?? [];
    if (!this.selectedPactId && pacts.length > 0) {
      this.selectedPactId = pacts[0].id;
    }

    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  public close(): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    if (this.onCloseCallback) {
      const cb = this.onCloseCallback;
      this.onCloseCallback = undefined;
      cb();
    }
  }

  public toggle(engine: GameEngine, onClose?: () => void): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, onClose);
    }
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    if (e.key === 'Escape' || e.code === 'KeyP') {
      this.close();
      return true;
    }

    const pacts = this.engine?.pacts?.getAllPacts() ?? [];
    if (pacts.length === 0) return true;

    const currentIndex = pacts.findIndex((p) => p.id === this.selectedPactId);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = currentIndex > 0 ? currentIndex - 1 : pacts.length - 1;
      this.selectedPactId = pacts[prevIdx].id;
      this.render();
      return true;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = currentIndex < pacts.length - 1 ? currentIndex + 1 : 0;
      this.selectedPactId = pacts[nextIdx].id;
      this.render();
      return true;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedPactId && this.engine) {
        this.engine.pacts.togglePact(this.selectedPactId);
        this.render();
      }
      return true;
    }

    return true;
  }

  public render(): void {
    if (!this.overlayEl || !this.engine) return;

    const pacts = this.engine.pacts?.getAllPacts() ?? [];
    const activePacts = this.engine.pacts?.getActivePacts() ?? [];
    const aggregatedMutators = this.engine.pacts?.getAggregatedMutators();
    const aggregatedRewards = this.engine.pacts?.getAggregatedRewards();

    if (!pacts.some((p) => p.id === this.selectedPactId) && pacts.length > 0) {
      this.selectedPactId = pacts[0].id;
    }

    const pactRows = pacts
      .map((pact) => {
        const isSelected = pact.id === this.selectedPactId;
        const isActive = this.engine!.pacts.isPactActive(pact.id);

        const statusBadge = isActive
          ? '<span style="background: #991b1b; color: #fef08a; font-size: 10px; font-weight: bold; padding: 2px 6px; border: 1px solid #450a0a;">[SEALED]</span>'
          : '<span style="background: #475569; color: #cbd5e1; font-size: 10px; padding: 2px 6px; border: 1px solid #334155;">[UNPLEDGED]</span>';

        const rowBg = isSelected ? '#dbeafe' : '#ffffff';
        const rowBorder = isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1';

        return `
          <div
            id="pact-item-${pact.id}"
            class="pact-row"
            data-pact-id="${pact.id}"
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 10px;
              background: ${rowBg};
              border: ${rowBorder};
              cursor: pointer;
              margin-bottom: 4px;
            "
          >
            <div style="flex: 1; min-width: 0; padding-right: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="font-weight: bold; font-size: 12px; color: #0f172a;">${pact.name}</span>
                ${statusBadge}
              </div>
              <div style="font-size: 11px; color: #dc2626;">
                💀 ${pact.curseDescription}
              </div>
              <div style="font-size: 11px; color: #16a34a;">
                🌟 ${pact.rewardDescription}
              </div>
            </div>
            <div>
              <button
                class="win-btn win-btn-toggle"
                data-toggle-id="${pact.id}"
                style="padding: 4px 8px; font-size: 11px; font-weight: bold; min-width: 80px;"
              >
                ${isActive ? 'Renounce' : 'Seal Pact'}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    // Summary calculations
    const goldMult = aggregatedRewards ? aggregatedRewards.goldMultiplier.toFixed(1) : '1.0';
    const xpMult = aggregatedRewards ? aggregatedRewards.xpMultiplier.toFixed(2) : '1.00';
    const mfBonus = aggregatedRewards ? Math.round(aggregatedRewards.magicFindBonus * 100) : 0;

    let penalties = [];
    if (aggregatedMutators) {
      if (aggregatedMutators.playerMaxHpPercent) {
        penalties.push(`${Math.round(aggregatedMutators.playerMaxHpPercent * 100)}% Max HP`);
      }
      if (aggregatedMutators.playerDefenseBonus) {
        penalties.push(`${aggregatedMutators.playerDefenseBonus} DEF`);
      }
      if (aggregatedMutators.playerAttackBonus) {
        penalties.push(`+${aggregatedMutators.playerAttackBonus} ATK`);
      }
      if (aggregatedMutators.fovRadiusModifier) {
        penalties.push(`${aggregatedMutators.fovRadiusModifier} FOV`);
      }
      if (aggregatedMutators.monsterDensityMultiplier && aggregatedMutators.monsterDensityMultiplier !== 1) {
        penalties.push(`${aggregatedMutators.monsterDensityMultiplier.toFixed(1)}x Density`);
      }
    }
    const penaltyText = penalties.length > 0 ? penalties.join(', ') : 'None';

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 640px; max-width: 95vw; box-shadow: 6px 6px 18px rgba(0,0,0,0.85);">
        <div class="retro-titlebar">
          <div class="retro-titlebar-title">
            <span>📜</span>
            <span>Ancient Run Pacts &amp; Bounties</span>
          </div>
          <button id="btn-pact-close-x" class="win-btn win-btn-sm" style="padding: 0 5px; font-weight: bold;">✕</button>
        </div>

        <div class="retro-window-body" style="padding: 10px; gap: 8px;">
          <div style="font-size: 11px; color: #334155; line-height: 1.4; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 8px;">
            Seal ancient pacts to mutate dungeon difficulty and receive magnified rewards.
            Pacts may be sealed or renounced freely while preparing in town.
          </div>

          <!-- Scrollable Pact List -->
          <div
            id="pact-list-container"
            style="
              max-height: 280px;
              overflow-y: auto;
              border: 2px inset #ffffff;
              background: #f1f5f9;
              padding: 4px;
            "
          >
            ${pactRows}
          </div>

          <!-- Aggregated Summary Panel -->
          <div style="background: #fefce8; border: 1px solid #facc15; padding: 8px 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; color: #854d0e; margin-bottom: 4px;">
              <span>ACTIVE PACTS: ${activePacts.length}</span>
              <span>GOLD: ${goldMult}x | XP: ${xpMult}x | MAGIC FIND: +${mfBonus}%</span>
            </div>
            <div style="font-size: 11px; color: #713f12;">
              <strong>Active Mutators:</strong> ${penaltyText}
            </div>
          </div>

          <!-- Controls & Dismiss Button -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: #64748b;">
              Keys: [↑ / ↓] Select | [Space/Enter] Toggle | [Esc / P] Close
            </span>
            <button id="btn-pact-done" class="win-btn" style="padding: 4px 16px; font-weight: bold;">
              Done / Close
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    this.overlayEl.querySelector('#btn-pact-close-x')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btn-pact-done')?.addEventListener('click', () => this.close());

    // Row selection and toggle buttons
    const rows = this.overlayEl.querySelectorAll('.pact-row');
    rows.forEach((row) => {
      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const pactId = row.getAttribute('data-pact-id');
        if (!pactId) return;

        if (target.classList.contains('win-btn-toggle') || target.getAttribute('data-toggle-id')) {
          this.engine!.pacts.togglePact(pactId);
          this.selectedPactId = pactId;
          this.render();
        } else {
          this.selectedPactId = pactId;
          this.render();
        }
      });
    });
  }
}
