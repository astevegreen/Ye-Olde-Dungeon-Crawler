import type { GameEngine } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';
import {
  RUNE_TRACK_MAX,
  RUNE_TOTAL_POINTS_CAP,
  allocateRuneMastery,
  computeChannelTime,
  computeDepthBonus,
  getBankingRetentionPct,
  getTotalRuneMasteryPoints,
  findRuneOfReturn,
  type RuneOfReturnTrack,
} from '../engine';

export interface RuneOfReturnTreeModalConfig {
  onClose?: () => void;
}

export class RuneOfReturnTreeModal implements UIModal {
  public readonly id = 'rune-of-return-tree-modal';
  private overlayEl: HTMLElement | null = null;
  private isOpenState = false;
  private engine?: GameEngine;
  private modalStack?: ModalStackManager;
  private onCloseCallback?: () => void;

  constructor(config?: RuneOfReturnTreeModalConfig | (() => void)) {
    this.onCloseCallback = typeof config === 'function' ? config : config?.onClose;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById(this.id);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = this.id;
      overlay.className = 'retro-window-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = '195';
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

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  public setOnClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public open(engine: GameEngine, onClose?: () => void): void {
    this.engine = engine;
    if (onClose) this.onCloseCallback = onClose;
    this.isOpenState = true;

    if (!this.overlayEl) {
      this.createDom();
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
    if (this.modalStack) {
      this.modalStack.remove(this.id);
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public toggle(engine: GameEngine, onClose?: () => void): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, onClose);
    }
  }

  public allocate(track: RuneOfReturnTrack): boolean {
    if (!this.engine || !this.engine.player) return false;
    const player = this.engine.player;

    const success = allocateRuneMastery(player, track, 1);
    if (success) {
      const trackName =
        track === 'celerity'
          ? 'Channel Celerity'
          : track === 'weave'
          ? 'Steadfast Weave'
          : 'Unbound Casting';
      this.engine.log(
        `Upgraded ${trackName}! (${player.unspentStatPoints} point(s) remaining)`
      );
      this.render();
      return true;
    }
    return false;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    const key = e.key.toUpperCase();
    const code = e.code;

    if (key === 'ESCAPE' || key === 'ENTER' || code === 'KeyU') {
      e.preventDefault();
      this.close();
      return true;
    }

    if (key === '1' || code === 'Digit1' || code === 'Numpad1') {
      e.preventDefault();
      this.allocate('celerity');
      return true;
    }

    if (key === '2' || code === 'Digit2' || code === 'Numpad2') {
      e.preventDefault();
      this.allocate('weave');
      return true;
    }

    if (key === '3' || code === 'Digit3' || code === 'Numpad3') {
      e.preventDefault();
      this.allocate('mobility');
      return true;
    }

    // Absorb other keys while open
    return true;
  }

  private renderPips(current: number, max: number): string {
    let pips = '';
    for (let i = 0; i < max; i++) {
      if (i < current) {
        pips += '<span style="color: #38bdf8; margin-right: 3px;">●</span>';
      } else {
        pips += '<span style="color: #475569; margin-right: 3px;">○</span>';
      }
    }
    return pips;
  }

  public render(): void {
    if (!this.overlayEl || !this.engine || !this.engine.player) return;

    const player = this.engine.player;
    const rune = findRuneOfReturn(player);
    const unspent = player.unspentStatPoints;
    const mastery = player.runeMastery;
    const totalInvested = getTotalRuneMasteryPoints(mastery);
    const atTreeCap = totalInvested >= RUNE_TOTAL_POINTS_CAP;

    const currentFloor = this.engine.currentFloor;
    const baseChannel = Math.max(3, 6 - mastery.celerityPoints);
    const depthPenalty = computeDepthBonus(currentFloor);
    const effectiveChannel = computeChannelTime(mastery.celerityPoints, currentFloor);

    const celerityMaxed = mastery.celerityPoints >= RUNE_TRACK_MAX.celerity;
    const weaveMaxed = mastery.weavePoints >= RUNE_TRACK_MAX.weave;
    const mobilityMaxed = mastery.mobilityPoints >= RUNE_TRACK_MAX.mobility;

    const canAllocateCelerity = !celerityMaxed && !atTreeCap && unspent > 0;
    const canAllocateWeave = !weaveMaxed && !atTreeCap && unspent > 0;
    const canAllocateMobility = !mobilityMaxed && !atTreeCap && unspent > 0;

    const currentRetentionPct = Math.round(getBankingRetentionPct(mastery.weavePoints) * 100);
    const nextRetentionPct = !weaveMaxed
      ? Math.round(getBankingRetentionPct(mastery.weavePoints + 1) * 100)
      : currentRetentionPct;

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="
        max-width: 580px;
        width: 92%;
        background: #0b1329;
        border: 2px solid #38bdf8;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9), 0 0 25px rgba(56, 189, 248, 0.2);
        color: #f8fafc;
        font-family: monospace, system-ui;
        padding: 22px;
        box-sizing: border-box;
      ">
        <!-- Header -->
        <div style="border-bottom: 1px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 18px; font-weight: bold; color: #38bdf8;">✦ ARCANE MASTERY: RUNE OF RETURN ✦</span>
            <span style="font-size: 13px; color: #94a3b8;">Charges: <strong style="color: #38bdf8;">${rune ? `${rune.charges}/${rune.maxCharges}` : '0/3'}</strong></span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #cbd5e1;">
            <div>Unspent Stat Points: <strong style="color: #fde047; font-size: 14px;">${unspent}</strong></div>
            <div>Tree Investment: <strong style="color: #38bdf8;">${totalInvested}/${RUNE_TOTAL_POINTS_CAP}</strong></div>
          </div>

          <div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">
            Return Anchor: <strong style="color: ${player.deepestRecallFloor ? '#38bdf8' : '#64748b'};">${player.deepestRecallFloor ? `Floor ${player.deepestRecallFloor}` : 'None (Recalls to Town)'}</strong>
          </div>

          <!-- Floor Timing Breakdown -->
          <div style="margin-top: 10px; padding: 6px 10px; background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 4px; font-size: 12px; color: #94a3b8;">
            Channel Time (Floor ${currentFloor}): Base <strong style="color: #f8fafc;">${baseChannel}t</strong> + Depth Penalty <strong style="color: #f8fafc;">+${depthPenalty}t</strong> = <strong style="color: #38bdf8; font-size: 13px;">${effectiveChannel} turns</strong>
          </div>
        </div>

        <!-- 3 Tracks -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px;">
          <!-- Track 1: Channel Celerity -->
          <div style="
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid ${celerityMaxed ? '#0284c7' : '#334155'};
            border-radius: 6px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1; padding-right: 12px;">
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="font-weight: bold; color: #fde047; font-size: 14px;">[1] Channel Celerity</span>
                <span style="font-size: 12px;">${this.renderPips(mastery.celerityPoints, RUNE_TRACK_MAX.celerity)} (${mastery.celerityPoints}/${RUNE_TRACK_MAX.celerity})</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 3px;">
                Reduces base channel time from 6 down to 3 turns (3 turns is a hard floor).
              </div>
              <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">
                Current Base: ${baseChannel} turns ${!celerityMaxed ? `➔ Next Rank: ${Math.max(3, baseChannel - 1)} turns` : '(MAXED)'}
              </div>
            </div>
            <button id="alloc-celerity-btn" ${!canAllocateCelerity ? 'disabled' : ''} style="
              background: ${canAllocateCelerity ? '#0284c7' : '#1e293b'};
              color: ${canAllocateCelerity ? '#ffffff' : '#64748b'};
              border: 1px solid ${canAllocateCelerity ? '#38bdf8' : '#334155'};
              border-radius: 4px;
              padding: 6px 12px;
              font-weight: bold;
              font-size: 12px;
              cursor: ${canAllocateCelerity ? 'pointer' : 'default'};
              font-family: inherit;
              white-space: nowrap;
            ">
              ${celerityMaxed ? 'Maxed' : '+ Upgrade [1]'}
            </button>
          </div>

          <!-- Track 2: Steadfast Weave -->
          <div style="
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid ${weaveMaxed ? '#0284c7' : '#334155'};
            border-radius: 6px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1; padding-right: 12px;">
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="font-weight: bold; color: #fde047; font-size: 14px;">[2] Steadfast Weave</span>
                <span style="font-size: 12px;">${this.renderPips(mastery.weavePoints, RUNE_TRACK_MAX.weave)} (${mastery.weavePoints}/${RUNE_TRACK_MAX.weave})</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 3px;">
                Retains interrupted channel progress on the current charge (0% ➔ 35% ➔ 65% ➔ 100%).
              </div>
              <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">
                Retention: ${currentRetentionPct}% ${!weaveMaxed ? `➔ Next: ${nextRetentionPct}%` : '(MAXED)'} | Banked Turns: ${player.runeChannelBankedTurns}t
              </div>
            </div>
            <button id="alloc-weave-btn" ${!canAllocateWeave ? 'disabled' : ''} style="
              background: ${canAllocateWeave ? '#0284c7' : '#1e293b'};
              color: ${canAllocateWeave ? '#ffffff' : '#64748b'};
              border: 1px solid ${canAllocateWeave ? '#38bdf8' : '#334155'};
              border-radius: 4px;
              padding: 6px 12px;
              font-weight: bold;
              font-size: 12px;
              cursor: ${canAllocateWeave ? 'pointer' : 'default'};
              font-family: inherit;
              white-space: nowrap;
            ">
              ${weaveMaxed ? 'Maxed' : '+ Upgrade [2]'}
            </button>
          </div>

          <!-- Track 3: Unbound Casting -->
          <div style="
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid ${mobilityMaxed ? '#10b981' : '#334155'};
            border-radius: 6px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="flex: 1; padding-right: 12px;">
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="font-weight: bold; color: #fde047; font-size: 14px;">[3] Unbound Casting</span>
                <span style="font-size: 11px; font-weight: bold; color: ${mobilityMaxed ? '#10b981' : '#64748b'};">
                  [${mobilityMaxed ? 'UNLOCKED' : 'LOCKED'}]
                </span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 3px;">
                Movement and repositioning no longer break your concentration. Only damage or attacking interrupts!
              </div>
              <div style="font-size: 11px; color: ${mobilityMaxed ? '#a3e635' : '#94a3b8'}; margin-top: 2px;">
                ${mobilityMaxed ? '✦ Free movement while channeling active' : '1 point unlock (Binary)'}
              </div>
            </div>
            <button id="alloc-mobility-btn" ${!canAllocateMobility ? 'disabled' : ''} style="
              background: ${canAllocateMobility ? '#0284c7' : '#1e293b'};
              color: ${canAllocateMobility ? '#ffffff' : '#64748b'};
              border: 1px solid ${canAllocateMobility ? '#38bdf8' : '#334155'};
              border-radius: 4px;
              padding: 6px 12px;
              font-weight: bold;
              font-size: 12px;
              cursor: ${canAllocateMobility ? 'pointer' : 'default'};
              font-family: inherit;
              white-space: nowrap;
            ">
              ${mobilityMaxed ? 'Unlocked' : '+ Unlock [3]'}
            </button>
          </div>
        </div>

        <!-- Footer / Rules Note -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1e293b; padding-top: 14px;">
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
            Press <strong>[1]</strong>, <strong>[2]</strong>, or <strong>[3]</strong> to allocate point.<br />
            Charges refill freely at <strong>Thrain the Rune-Smith</strong> in town.
          </div>
          <button id="rune-tree-close-btn" style="
            background: #334155;
            color: #f8fafc;
            border: 1px solid #64748b;
            border-radius: 4px;
            padding: 8px 18px;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
            font-family: inherit;
          ">
            Close (Esc)
          </button>
        </div>
      </div>
    `;

    this.overlayEl.querySelector('#alloc-celerity-btn')?.addEventListener('click', () => {
      this.allocate('celerity');
    });
    this.overlayEl.querySelector('#alloc-weave-btn')?.addEventListener('click', () => {
      this.allocate('weave');
    });
    this.overlayEl.querySelector('#alloc-mobility-btn')?.addEventListener('click', () => {
      this.allocate('mobility');
    });
    this.overlayEl.querySelector('#rune-tree-close-btn')?.addEventListener('click', () => {
      this.close();
    });
  }
}
