import type { GameEngine } from '../engine';
import type { TutorialFlags } from '../engine';

export type TownReturnFixtureType = 'runic_conduit' | 'valkyrie_sprint' | 'dwarven_winch' | 'town_portal';

interface FixtureModalConfig {
  title: string;
  flag: keyof TutorialFlags;
  icon: string;
  objective: string;
  winCondition: string;
  failCondition: string;
  confirmLabel: string;
  cancelLabel: string;
}

export class TownReturnModal {
  private overlayEl: HTMLElement | null = null;
  public isOpen: boolean = false;
  private onClosedCallback?: () => void;

  constructor(onClosedCallback?: () => void) {
    this.onClosedCallback = onClosedCallback;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('town-return-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'town-return-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 160;
        pointer-events: auto;
      `;
      document.body.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  private getFixtureConfig(type: TownReturnFixtureType, engine: GameEngine): FixtureModalConfig {
    const townName = engine.manifest?.town?.name ?? 'Town';
    const destFloor = engine.townReturnManager?.townPortal?.destinationFloor ?? engine.player.deepestRecallFloor ?? 1;

    switch (type) {
      case 'runic_conduit':
        return {
          title: 'Runic Leyline Conduit — Extraction Ritual',
          flag: 'conduitSeen',
          icon: '⚡',
          objective: 'Channel ancient terrestrial currents by standing upon 3 active pulsing cardinal nodes within 6 turns.',
          winCondition: '3 charges accumulated -> Conduit detonates in a radiant flash, dealing 50 radiant damage to adjacent monsters and dematerializing you to the Temple of Thor in town.',
          failCondition: 'Stepping outside the 5x5 ritual boundary or timer expiring -> Destabilizes with violent magical backlash (-20 HP) and 20-turn cooldown. Normal dungeon stairs remain completely intact.',
          confirmLabel: '⚡ Engage Extraction Ritual',
          cancelLabel: 'Step Away / Not Now',
        };
      case 'valkyrie_sprint':
        return {
          title: "Valkyrie's Sprint — Gjallarhorn Shrine",
          flag: 'sprintSeen',
          icon: '📯',
          objective: 'Sound the mythical ivory horn to open a 3-stage high-speed escape gauntlet through collapsing fissures.',
          winCondition: 'Traverse Stage 1 (Collapsing Chasm), clear Stage 2 (Portcullis via Bash, Pick, Spell, or Weapon Attacks), and bypass Stage 3 (Jotun Gatekeeper) to emerge at the town gate.',
          failCondition: `Failing or collapsing ejects you back to Floor ${engine.currentFloor} entrance with minor bruises. Normal down-stairs remain open, unlocked, and completely unaffected.`,
          confirmLabel: '📯 Sound Horn & Enter Gauntlet',
          cancelLabel: 'Leave Untouched',
        };
      case 'dwarven_winch':
        return {
          title: 'Dwarven Counterweight Winch — Mine Lift',
          flag: 'winchSeen',
          icon: '⚙️',
          objective: 'Balance the cargo hopper with ballast stones and gear to equal 1.5x your body mass (70kg) and equipment weight (±1500g).',
          winCondition: 'Balanced counterweight engages the massive gears for a smooth vertical ascent directly to town square.',
          failCondition: 'Imbalanced counterweight causes cable slip, minor fall damage (-10% HP), and stopping halfway down the shaft. Normal down-stairs remain intact.',
          confirmLabel: '⚙️ Open Winch Hopper',
          cancelLabel: 'Step Away / Not Now',
        };
      case 'town_portal':
        return {
          title: 'Runic Descent Portal — Return to the Depths',
          flag: 'townPortalSeen',
          icon: '🌀',
          objective: `Step through the planar rift to return directly to Dungeon Floor ${destFloor} at your last shortcut departure point.`,
          winCondition: `Instant zero-cost passage directly back to Floor ${destFloor} without re-clearing solved floors or puzzles.`,
          failCondition: 'Consumes and resets the return portal until your next shortcut escape.',
          confirmLabel: `🌀 Descend to Floor ${destFloor}`,
          cancelLabel: `Stay in ${townName}`,
        };
    }
  }

  public open(
    type: TownReturnFixtureType,
    engine: GameEngine,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    const config = this.getFixtureConfig(type, engine);
    const hasSeen = Boolean(engine.player.tutorialFlags[config.flag]);

    this.isOpen = true;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
      if (!hasSeen) {
        this.renderTutorialModal(config, engine, onConfirm, onCancel);
      } else {
        this.renderConfirmationModal(config, engine, onConfirm, onCancel);
      }
    }
  }

  public close(): void {
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
      this.overlayEl.innerHTML = '';
    }
    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  private renderTutorialModal(
    config: FixtureModalConfig,
    engine: GameEngine,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    if (!this.overlayEl) return;

    this.overlayEl.innerHTML = `
      <div style="
        width: 600px;
        max-width: 95vw;
        background: var(--ui-panel, #c0c0c0);
        border: 2px solid var(--ui-border-light, #ffffff);
        border-right-color: var(--ui-border-dark, #000000);
        border-bottom-color: var(--ui-border-dark, #000000);
        box-shadow: 4px 4px 16px rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Tahoma, monospace, sans-serif;
        color: var(--ui-text, #000000);
      ">
        <!-- Title Bar -->
        <div style="
          background: linear-gradient(90deg, #000080, #1084d0);
          color: #ffffff;
          padding: 6px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 14px;
        ">
          <span>${config.icon} ${config.title}</span>
          <button id="btn-trmodal-x" style="
            background: #c0c0c0; border: 1px solid #fff; border-right-color: #000; border-bottom-color: #000;
            font-size: 12px; font-weight: bold; cursor: pointer; width: 20px; height: 20px; line-height: 14px;
          ">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 16px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: flex-start; gap: 12px; background: rgba(0,0,0,0.04); padding: 10px; border: 1px inset #808080;">
            <div style="font-size: 32px; line-height: 1;">${config.icon}</div>
            <div>
              <div style="font-weight: bold; margin-bottom: 4px; color: #000080;">Shortcut Discovery & Advisory</div>
              <div>${config.objective}</div>
            </div>
          </div>

          <div style="border-left: 3px solid #16a34a; padding-left: 10px; margin-left: 4px;">
            <strong style="color: #15803d;">🏆 Success / Reward:</strong>
            <div style="font-size: 12px; color: #333; margin-top: 2px;">${config.winCondition}</div>
          </div>

          <div style="border-left: 3px solid #ea580c; padding-left: 10px; margin-left: 4px;">
            <strong style="color: #c2410c;">⚠️ Failure Consequence / Soft-Lock Prevention:</strong>
            <div style="font-size: 12px; color: #333; margin-top: 2px;">${config.failCondition}</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          padding: 12px;
          background: #c0c0c0;
          border-top: 2px solid #ffffff;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        ">
          <button id="btn-trmodal-cancel" style="
            padding: 6px 16px;
            background: #e2e8f0;
            border: 2px solid #fff;
            border-right-color: #000;
            border-bottom-color: #000;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          ">${config.cancelLabel}</button>
          <button id="btn-trmodal-confirm" style="
            padding: 6px 20px;
            background: #16a34a;
            color: #ffffff;
            border: 2px solid #fff;
            border-right-color: #000;
            border-bottom-color: #000;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          ">${config.confirmLabel}</button>
        </div>
      </div>
    `;

    document.getElementById('btn-trmodal-x')?.addEventListener('click', () => {
      engine.player.tutorialFlags[config.flag] = true;
      this.close();
      if (onCancel) onCancel();
    });

    document.getElementById('btn-trmodal-cancel')?.addEventListener('click', () => {
      engine.player.tutorialFlags[config.flag] = true;
      this.close();
      if (onCancel) onCancel();
    });

    document.getElementById('btn-trmodal-confirm')?.addEventListener('click', () => {
      engine.player.tutorialFlags[config.flag] = true;
      this.close();
      onConfirm();
    });
  }

  private renderConfirmationModal(
    config: FixtureModalConfig,
    _engine: GameEngine,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    if (!this.overlayEl) return;

    this.overlayEl.innerHTML = `
      <div style="
        width: 480px;
        max-width: 95vw;
        background: var(--ui-panel, #c0c0c0);
        border: 2px solid var(--ui-border-light, #ffffff);
        border-right-color: var(--ui-border-dark, #000000);
        border-bottom-color: var(--ui-border-dark, #000000);
        box-shadow: 4px 4px 16px rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        font-family: 'Segoe UI', Tahoma, monospace, sans-serif;
        color: var(--ui-text, #000000);
      ">
        <!-- Title Bar -->
        <div style="
          background: linear-gradient(90deg, #000080, #1084d0);
          color: #ffffff;
          padding: 5px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 13px;
        ">
          <span>${config.icon} Confirmation</span>
          <button id="btn-trmodal-x" style="
            background: #c0c0c0; border: 1px solid #fff; border-right-color: #000; border-bottom-color: #000;
            font-size: 11px; font-weight: bold; cursor: pointer; width: 18px; height: 18px; line-height: 12px;
          ">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 16px; font-size: 13px; line-height: 1.5; display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 28px;">${config.icon}</div>
          <div>
            <div style="font-weight: bold; margin-bottom: 2px;">Activate ${config.title}?</div>
            <div style="font-size: 12px; color: #444;">Proceed with activation or step away with zero ticks spent.</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          padding: 10px;
          background: #c0c0c0;
          border-top: 2px solid #ffffff;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        ">
          <button id="btn-trmodal-cancel" style="
            padding: 5px 14px;
            background: #e2e8f0;
            border: 2px solid #fff;
            border-right-color: #000;
            border-bottom-color: #000;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          ">No, Step Away</button>
          <button id="btn-trmodal-confirm" style="
            padding: 5px 18px;
            background: #16a34a;
            color: #ffffff;
            border: 2px solid #fff;
            border-right-color: #000;
            border-bottom-color: #000;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          ">Yes, Activate</button>
        </div>
      </div>
    `;

    document.getElementById('btn-trmodal-x')?.addEventListener('click', () => {
      this.close();
      if (onCancel) onCancel();
    });

    document.getElementById('btn-trmodal-cancel')?.addEventListener('click', () => {
      this.close();
      if (onCancel) onCancel();
    });

    document.getElementById('btn-trmodal-confirm')?.addEventListener('click', () => {
      this.close();
      onConfirm();
    });
  }
}
