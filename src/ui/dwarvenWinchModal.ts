import type { GameEngine, DwarvenWinch } from '../engine';

export class DwarvenWinchModal {
  private overlayEl: HTMLElement | null = null;
  public isOpen = false;
  private activeWinch: DwarvenWinch | null = null;
  private engine: GameEngine | null = null;
  private onClosedCallback?: () => void;

  constructor(onClosedCallback?: () => void) {
    this.onClosedCallback = onClosedCallback;
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('winch-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'winch-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 150;
        pointer-events: auto;
      `;
      document.body.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public open(winch: DwarvenWinch, engine: GameEngine): void {
    this.activeWinch = winch;
    this.engine = engine;
    this.isOpen = true;
    this.render();
    if (this.overlayEl) {
      this.overlayEl.style.display = 'flex';
    }
  }

  public close(): void {
    this.isOpen = false;
    this.activeWinch = null;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
      this.overlayEl.innerHTML = '';
    }
    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  public render(): void {
    if (!this.overlayEl || !this.activeWinch || !this.engine) return;

    const winch = this.activeWinch;
    const engine = this.engine;
    const player = engine.player;
    const evalRes = winch.evaluateBalance(player);

    const statusColor =
      evalRes.status === 'balanced'
        ? '#16a34a'
        : evalRes.status === 'underweight'
        ? '#ea580c'
        : '#dc2626';

    const statusText =
      evalRes.status === 'balanced'
        ? '✓ BALANCED — READY TO ASCEND'
        : evalRes.status === 'underweight'
        ? '⚠️ UNDERWEIGHT (Too Light)'
        : '⚠️ OVERWEIGHT (Too Heavy)';

    const minTarget = evalRes.targetWeight - evalRes.tolerance;
    const maxTarget = evalRes.targetWeight + evalRes.tolerance;

    let deltaMessage = '';
    if (evalRes.status === 'underweight') {
      const needed = minTarget - evalRes.hopperWeight;
      deltaMessage = `⚖️ Needs ${needed.toLocaleString()}g more ballast to reach safe ascent range.`;
    } else if (evalRes.status === 'overweight') {
      const excess = evalRes.hopperWeight - maxTarget;
      deltaMessage = `⚖️ Overweight by ${excess.toLocaleString()}g. Remove excess items from hopper.`;
    } else {
      deltaMessage = `⚖️ Perfectly Balanced! Within safe tolerance (±${evalRes.tolerance.toLocaleString()}g).`;
    }

    const heroBody = 70000;
    const carriedWeight = player.inventory.totalWeight();
    const packItems = player.inventory.primaryPack.getItems();
    const hopperItems = winch.hopper.getItems();

    this.overlayEl.innerHTML = `
      <div style="
        width: 720px;
        max-width: 95vw;
        max-height: 90vh;
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
          background: linear-gradient(90deg, var(--ui-titlebar-start, #000080), var(--ui-titlebar-end, #1084d0));
          color: var(--ui-titlebar-text, #ffffff);
          padding: 6px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 14px;
        ">
          <span>⚙️ Dwarven Counterweight Winch — Floor ${winch.floor}</span>
          <button id="btn-winch-close-x" style="
            background: var(--ui-panel, #c0c0c0);
            border: 1px solid #fff;
            border-right-color: #000;
            border-bottom-color: #000;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            width: 20px;
            height: 20px;
            line-height: 14px;
          ">✕</button>
        </div>

        <!-- Telemetry Header -->
        <div style="padding: 12px; background: rgba(0,0,0,0.05); border-bottom: 2px solid #808080;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <div style="font-size: 12px; color: #444;">Target Counterweight Range:</div>
              <div style="font-size: 16px; font-weight: bold;">${minTarget.toLocaleString()}g — ${maxTarget.toLocaleString()}g <span style="font-size: 12px; font-weight: normal; color: #666;">(Center: ${evalRes.targetWeight.toLocaleString()}g)</span></div>
              <div style="font-size: 11px; color: #666; margin-top: 2px;">Hero Body: ${heroBody.toLocaleString()}g | Carried Pack: ${carriedWeight.toLocaleString()}g | Ratio: 1.5x</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: #444;">Current Hopper Ballast:</div>
              <div style="font-size: 18px; font-weight: bold; color: ${statusColor};">${evalRes.hopperWeight.toLocaleString()}g</div>
              <div style="font-size: 11px; font-weight: bold; color: ${statusColor}; margin-top: 2px;">${deltaMessage}</div>
            </div>
          </div>
          <div style="
            background: ${statusColor};
            color: #ffffff;
            padding: 4px 8px;
            font-weight: bold;
            font-size: 12px;
            text-align: center;
            letter-spacing: 1px;
          ">${statusText} — ${deltaMessage}</div>
        </div>

        <!-- Two Column Inventory Transfer -->
        <div style="display: flex; flex: 1; min-height: 280px; max-height: 380px; overflow: hidden; padding: 8px; gap: 8px;">
          <!-- Left: Player Backpack -->
          <div style="flex: 1; display: flex; flex-direction: column; background: #fff; border: 2px inset #808080; padding: 6px;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">
              🎒 Player Backpack (${packItems.length} items)
            </div>
            <div style="flex: 1; overflow-y: auto;">
              ${
                packItems.length === 0
                  ? '<div style="color: #888; font-size: 11px; padding: 8px;">Pack is empty.</div>'
                  : packItems
                      .map(
                        (it) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dotted #eee; font-size: 12px;">
                      <span title="${it.description || ''}">${it.displayName} <small style="color: #666;">(${it.weight}g)</small></span>
                      <button class="btn-winch-deposit" data-id="${it.id}" style="
                        background: #e2e8f0; border: 1px solid #888; padding: 2px 6px; font-size: 11px; cursor: pointer;
                      ">Load ➔</button>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>

          <!-- Right: Hopper Contents -->
          <div style="flex: 1; display: flex; flex-direction: column; background: #fff; border: 2px inset #808080; padding: 6px;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">
              ⚙️ Winch Hopper Cargo (${hopperItems.length} items)
            </div>
            <div style="flex: 1; overflow-y: auto;">
              ${
                hopperItems.length === 0
                  ? '<div style="color: #888; font-size: 11px; padding: 8px;">Hopper is empty. Load ballast or heavy items from pack.</div>'
                  : hopperItems
                      .map(
                        (it) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dotted #eee; font-size: 12px;">
                      <span title="${it.description || ''}">${it.displayName} <small style="color: #666;">(${it.weight}g)</small></span>
                      <button class="btn-winch-retrieve" data-id="${it.id}" style="
                        background: #e2e8f0; border: 1px solid #888; padding: 2px 6px; font-size: 11px; cursor: pointer;
                      ">⬅ Take</button>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>

        <!-- Footer / Action Bar -->
        <div style="padding: 10px; display: flex; justify-content: space-between; align-items: center; background: var(--ui-panel, #c0c0c0); border-top: 2px solid #fff;">
          <button id="btn-winch-cancel" style="
            padding: 6px 14px;
            background: var(--ui-btn-bg, #e2e8f0);
            border: 2px solid var(--ui-border-light, #fff);
            border-right-color: var(--ui-border-dark, #000);
            border-bottom-color: var(--ui-border-dark, #000);
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
          ">Close</button>

          <button id="btn-winch-pull" style="
            padding: 8px 20px;
            background: ${evalRes.status === 'balanced' ? '#16a34a' : '#d97706'};
            color: #ffffff;
            border: 2px solid #ffffff;
            border-right-color: #000000;
            border-bottom-color: #000000;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
          ">⚙️ Pull Lever ${evalRes.status === 'balanced' ? '(Ascend to Town)' : '(Risky Ascent)'}</button>
        </div>
      </div>
    `;

    // Hook events
    document.getElementById('btn-winch-close-x')?.addEventListener('click', () => this.close());
    document.getElementById('btn-winch-cancel')?.addEventListener('click', () => this.close());

    document.getElementById('btn-winch-pull')?.addEventListener('click', () => {
      winch.pullLever(engine);
      this.close();
    });

    const depositBtns = this.overlayEl.querySelectorAll('.btn-winch-deposit');
    depositBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          winch.depositItem(player, id);
          this.render();
        }
      });
    });

    const retrieveBtns = this.overlayEl.querySelectorAll('.btn-winch-retrieve');
    retrieveBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          winch.retrieveItem(player, id);
          this.render();
        }
      });
    });
  }
}
