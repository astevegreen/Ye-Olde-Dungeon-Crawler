import {
  type GameEngine,
  type CharacterProfile,
  flightRecorder,
  WaitAction,
  ItemFactory,
  Item,
  createScaledMonster,
  MonsterRegistry,
  type MonsterDefinition,
  safeJsonStringify,
} from '../engine';
import type { UIModal, ModalStackManager } from './modalStack';
import { copyTextToClipboard } from './platform';

export type DiagnosticTabId = 'simulation' | 'actor' | 'pipeline' | 'triage';

export interface DiagnosticInputContext {
  getInputLocked: () => boolean;
  clearInputLock: () => void;
  getChordStatus?: () => {
    enabled: boolean;
    bufferMs: number;
    pressedKeys: string[];
    isChording: boolean;
    hasPendingTimer: boolean;
  };
}

export class DiagnosticModal implements UIModal {
  public readonly id = 'diagnostic-modal';
  public isOpen: boolean = false;

  private modal: HTMLElement | null = null;
  private tabContent: HTMLElement | null = null;
  private tabStrip: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private closeTitleBtn: HTMLButtonElement | null = null;
  private toast: HTMLElement | null = null;

  // Crash modal elements
  private crashModal: HTMLElement | null = null;
  private crashText: HTMLElement | null = null;
  private crashCopyBtn: HTMLButtonElement | null = null;
  private crashReloadBtn: HTMLButtonElement | null = null;

  private getEngine: () => GameEngine | null;
  private getProfile: () => CharacterProfile | null;
  private inputContext?: DiagnosticInputContext;
  private modalStack?: ModalStackManager;
  private onClosedCallback?: () => void;

  private activeTab: DiagnosticTabId = 'simulation';
  private pollIntervalId: any = null;
  private toastTimeout: any = null;
  public enableAutoPolling: boolean = true;

  constructor(
    getEngine: () => GameEngine | null,
    getProfile: () => CharacterProfile | null,
    onClosedCallback?: () => void,
    inputContext?: DiagnosticInputContext,
    modalStack?: ModalStackManager
  ) {
    this.getEngine = getEngine;
    this.getProfile = getProfile;
    this.onClosedCallback = onClosedCallback;
    this.inputContext = inputContext;
    this.modalStack = modalStack;

    this.initDom();
    this.bindEvents();
  }

  public setInputContext(ctx: DiagnosticInputContext): void {
    this.inputContext = ctx;
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  private initDom(): void {
    if (typeof document === 'undefined') return;

    this.modal = document.getElementById('diagnostic-modal');
    this.tabContent = document.getElementById('diagnostic-tab-content');
    this.tabStrip = document.getElementById('diagnostic-tab-strip');
    this.closeBtn = document.getElementById('btn-diag-close') as HTMLButtonElement | null;
    this.closeTitleBtn = document.getElementById('btn-diag-close-title') as HTMLButtonElement | null;
    this.toast = document.getElementById('diagnostic-toast');

    this.crashModal = document.getElementById('crash-modal');
    this.crashText = document.getElementById('crash-error-text');
    this.crashCopyBtn = document.getElementById('btn-crash-copy') as HTMLButtonElement | null;
    this.crashReloadBtn = document.getElementById('btn-crash-reload') as HTMLButtonElement | null;

    // If modal container does not exist in DOM (e.g. test environment), dynamically create it
    if (!this.modal) {
      this.modal = document.createElement('div');
      this.modal.id = 'diagnostic-modal';
      this.modal.style.display = 'none';
      document.body.appendChild(this.modal);

      const body = document.createElement('div');
      body.className = 'retro-window-body';
      this.modal.appendChild(body);

      this.tabStrip = document.createElement('div');
      this.tabStrip.id = 'diagnostic-tab-strip';
      body.appendChild(this.tabStrip);

      this.tabContent = document.createElement('div');
      this.tabContent.id = 'diagnostic-tab-content';
      body.appendChild(this.tabContent);

      this.toast = document.createElement('span');
      this.toast.id = 'diagnostic-toast';
      this.toast.style.display = 'none';
      body.appendChild(this.toast);

      this.closeBtn = document.createElement('button');
      this.closeBtn.id = 'btn-diag-close';
      body.appendChild(this.closeBtn);
    }
  }

  private bindEvents(): void {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.closeTitleBtn?.addEventListener('click', () => this.close());

    // Tab buttons in tab strip
    this.tabStrip?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
      if (target) {
        const tab = target.getAttribute('data-tab') as DiagnosticTabId;
        if (tab) {
          this.setActiveTab(tab);
        }
      }
    });

    this.crashCopyBtn?.addEventListener('click', () => {
      void this.copyReportToClipboard();
    });

    this.crashReloadBtn?.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    });
  }

  // --- UIModal Implementation & Keydown Swallowing ---

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    // F2, Escape, Backquote, Tilde close the modal
    if (e.code === 'F2' || e.code === 'Escape' || e.key === '`' || e.key === '~') {
      e.preventDefault();
      this.close();
      return true;
    }

    // Number keys 1-4 switch tabs directly
    if (e.key === '1') {
      e.preventDefault();
      this.setActiveTab('simulation');
      return true;
    }
    if (e.key === '2') {
      e.preventDefault();
      this.setActiveTab('actor');
      return true;
    }
    if (e.key === '3') {
      e.preventDefault();
      this.setActiveTab('pipeline');
      return true;
    }
    if (e.key === '4') {
      e.preventDefault();
      this.setActiveTab('triage');
      return true;
    }

    // Tab key cycles through tabs
    if (e.code === 'Tab') {
      e.preventDefault();
      this.cycleTab(e.shiftKey ? -1 : 1);
      return true;
    }

    // Always swallow all other keystrokes to prevent game actions or movement bleeding
    e.preventDefault();
    return true;
  }

  public open(): void {
    if (!this.modal) return;
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.setActiveTab(this.activeTab);

    // Auto-refresh polling while open (500ms heartbeat)
    this.startPolling();
  }

  public close(): void {
    if (!this.isOpen && (!this.modal || this.modal.style.display === 'none')) return;
    this.isOpen = false;
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.stopPolling();

    if (this.modalStack?.has(this.id)) {
      this.modalStack.remove(this.id);
    }

    if (this.onClosedCallback) {
      this.onClosedCallback();
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    if (!this.enableAutoPolling) return;
    if (typeof window !== 'undefined') {
      this.pollIntervalId = window.setInterval(() => {
        if (this.isOpen) {
          this.renderCurrentTab();
        }
      }, 500);
    }
  }

  private stopPolling(): void {
    if (this.pollIntervalId !== null) {
      if (typeof window !== 'undefined') {
        window.clearInterval(this.pollIntervalId);
      }
      this.pollIntervalId = null;
    }
  }

  // --- Tab Navigation & Switching ---

  public getActiveTab(): DiagnosticTabId {
    return this.activeTab;
  }

  public setActiveTab(tab: DiagnosticTabId): void {
    this.activeTab = tab;
    this.updateTabStripHighlight();
    this.renderCurrentTab();
  }

  public cycleTab(direction: 1 | -1 = 1): void {
    const tabs: DiagnosticTabId[] = ['simulation', 'actor', 'pipeline', 'triage'];
    const currentIndex = tabs.indexOf(this.activeTab);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    this.setActiveTab(tabs[nextIndex]);
  }

  private updateTabStripHighlight(): void {
    if (!this.tabStrip) return;
    const buttons = this.tabStrip.querySelectorAll<HTMLButtonElement>('[data-tab]');
    buttons.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      if (tab === this.activeTab) {
        btn.classList.add('active-tab');
        btn.style.background = '#e2e8f0';
        btn.style.color = '#0f172a';
        btn.style.border = '2px solid #0284c7';
      } else {
        btn.classList.remove('active-tab');
        btn.style.background = '#cbd5e1';
        btn.style.color = '#334155';
        btn.style.border = '2px solid #94a3b8';
      }
    });
  }

  // --- Scannable Telemetry Rendering ---

  public renderCurrentTab(): void {
    if (!this.tabContent) return;
    const engine = this.getEngine();

    if (!engine) {
      this.tabContent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #94a3b8; font-family: monospace;">
          <p>⚠️ No active simulation engine loaded.</p>
        </div>
      `;
      return;
    }

    switch (this.activeTab) {
      case 'simulation':
        this.renderSimulationTab(engine);
        break;
      case 'actor':
        this.renderActorTab(engine);
        break;
      case 'pipeline':
        this.renderPipelineTab(engine);
        break;
      case 'triage':
        this.renderTriageTab(engine);
        break;
    }
  }

  private renderSimulationTab(engine: GameEngine): void {
    if (!this.tabContent) return;
    const map = engine.map;
    const p = engine.player;
    const allEntities = map.getAllEntities();
    const living = allEntities.filter((e) => e.isAlive());
    const monsters = living.filter((e) => e.type === 'monster');
    const npcs = living.filter((e) => e.type === 'npc');

    let sleepingCount = 0;
    let huntingCount = 0;
    let combatCount = 0;
    let fleeingCount = 0;

    for (const m of monsters as any[]) {
      if (m.aiState === 'sleeping') sleepingCount++;
      else if (m.aiState === 'hunting') huntingCount++;
      else if (m.aiState === 'combat') combatCount++;
      else if (m.aiState === 'fleeing') fleeingCount++;
    }

    let visibleTiles = 0;
    let exploredTiles = 0;
    const totalTiles = map.width * map.height;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (engine.fov.isVisible(x, y)) visibleTiles++;
        if (engine.fov.isExplored(x, y)) exploredTiles++;
      }
    }

    const exploredPct = ((exploredTiles / totalTiles) * 100).toFixed(1);
    const visiblePct = ((visibleTiles / totalTiles) * 100).toFixed(1);

    const spatialIndexCount = (map as any).spatialIndex?.size ?? 0;
    const bucketCount = (map as any).entityBuckets?.size ?? 0;
    const groundItemCount = map.getAllGroundItems?.().length ?? (map as any).groundItems?.size ?? 0;

    this.tabContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Floor Header Card -->
        <div style="background: #1e293b; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #38bdf8;">
          <div>
            <span style="font-size: 14px; font-weight: bold; color: #38bdf8;">FLOOR ${engine.currentFloor}</span>
            <span style="color: #94a3b8; margin-left: 8px;">(${engine.currentFloor === 0 ? 'Town' : 'Dungeon Floor'})</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="background: ${map.isCleared ? '#15803d' : '#475569'}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
              ${map.isCleared ? 'CLEARED' : 'UNCLEARED'}
            </span>
            <span style="color: #cbd5e1;">Plane: <strong>${p?.planeId ?? 'physical'}</strong></span>
          </div>
        </div>

        <!-- Metric Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
          
          <!-- World & Turns Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ⏱️ World &amp; Turn Telemetry
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Floor Dimensions:</td><td><strong>${map.width} × ${map.height}</strong> tiles</td></tr>
              <tr><td style="color: #94a3b8;">Floor Turn Count:</td><td><strong>${map.floorTurnCount ?? 0}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Engine Turn Count:</td><td><strong>${engine.turnCount}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Last Respawn Turn:</td><td><strong>${map.lastRespawnTurn ?? 'None'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Ground Items:</td><td><strong>${groundItemCount}</strong></td></tr>
            </table>
          </div>

          <!-- Entities Breakdown Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👾 Entities &amp; AI States
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Total Living:</td><td><strong style="color: #4ade80;">${living.length}</strong> / ${allEntities.length}</td></tr>
              <tr><td style="color: #94a3b8;">Monsters:</td><td><strong>${monsters.length}</strong> (NPCs: ${npcs.length})</td></tr>
              <tr><td style="color: #94a3b8;">Sleeping:</td><td><span style="color: #93c5fd;">💤 ${sleepingCount}</span></td></tr>
              <tr><td style="color: #94a3b8;">Hunting / Combat:</td><td><span style="color: #f87171;">🎯 ${huntingCount}</span> | <span style="color: #fb923c;">⚔️ ${combatCount}</span></td></tr>
              <tr><td style="color: #94a3b8;">Fleeing:</td><td><span style="color: #facc15;">🏃 ${fleeingCount}</span></td></tr>
            </table>
          </div>

          <!-- Field of View Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👁️ Field of View (FOV)
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Player Position:</td><td><strong>(${p ? `${p.x}, ${p.y}` : 'N/A'})</strong></td></tr>
              <tr><td style="color: #94a3b8;">FOV Radius:</td><td><strong>${engine.fovRadius}</strong> tiles</td></tr>
              <tr><td style="color: #94a3b8;">Currently Visible:</td><td><strong>${visibleTiles}</strong> (${visiblePct}%)</td></tr>
              <tr><td style="color: #94a3b8;">Explored Tiles:</td><td><strong>${exploredTiles}</strong> / ${totalTiles} (${exploredPct}%)</td></tr>
            </table>
          </div>

          <!-- Spatial Partitioning Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              📐 Spatial Partition &amp; Grids
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Spatial Index Size:</td><td><strong>${spatialIndexCount}</strong> entries</td></tr>
              <tr><td style="color: #94a3b8;">Entity Buckets:</td><td><strong>${bucketCount}</strong> coordinates</td></tr>
              <tr><td style="color: #94a3b8;">Active Surfaces:</td><td><strong>${(engine.surfaces as any)?.activeSurfaces?.size ?? 'Ready'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Reactive Substances:</td><td><strong>${(engine.substances as any)?.grid ? 'Online' : 'Active'}</strong></td></tr>
            </table>
          </div>

        </div>
      </div>
    `;
  }

  private renderActorTab(engine: GameEngine): void {
    if (!this.tabContent) return;
    const p = engine.player;
    if (!p) {
      this.tabContent.innerHTML = `<div style="padding: 10px; color: #f87171;">No player entity active.</div>`;
      return;
    }

    const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
    const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#facc15' : '#f87171';

    const manaPct = Math.max(0, Math.min(100, Math.round((p.mana / Math.max(1, p.maxMana)) * 100)));

    const statusEffects = p.statusManager.getAll();
    const equippedItems = p.inventory?.paperdoll.getAllEquipped() ?? [];
    const encumbrance = p.inventory?.getEncumbrance(p.strength);
    const weightLbs = p.inventory ? (p.inventory.totalWeight() / 453.592).toFixed(1) : '0';

    // Find nearby entities within distance <= 4
    const map = engine.map;
    const nearby = map.getAllEntities().filter((e) => {
      if (e.id === p.id || !e.isAlive()) return false;
      const dx = Math.abs(e.x - p.x);
      const dy = Math.abs(e.y - p.y);
      return Math.max(dx, dy) <= 4;
    });

    this.tabContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Player Header Banner -->
        <div style="background: #1e293b; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #4ade80;">
          <div>
            <span style="font-size: 13px; font-weight: bold; color: #f8fafc;">${p.name}</span>
            <span style="color: #94a3b8; margin-left: 6px;">Level ${p.level} (${p.gender ?? 'Hero'})</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${p.isInvulnerable ? `<span style="background: #7c3aed; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">🛡️ GOD MODE ACTIVE</span>` : ''}
            ${p.unspentStatPoints > 0 ? `<span style="background: #d97706; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">⭐ ${p.unspentStatPoints} UNSPENT</span>` : ''}
            <span style="color: #cbd5e1;">XP: <strong>${p.xp} / ${p.xpToNextLevel}</strong></span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Core Combat Stats -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ❤️ Health, Mana &amp; Energy
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #94a3b8; width: 110px;">Health (HP):</td>
                <td>
                  <strong style="color: ${hpColor};">${p.hp} / ${p.maxHp}</strong> (${hpPct}%)
                </td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Mana (MP):</td>
                <td><strong style="color: #60a5fa;">${p.mana} / ${p.maxMana}</strong> (${manaPct}%)</td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Attack:</td>
                <td>Base: <strong>${p.baseAttackValue}</strong> | Effective: <strong style="color: #f87171;">${p.attack}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Defense:</td>
                <td>Base: <strong>${(p as any).baseDefense}</strong> | Effective: <strong style="color: #60a5fa;">${p.defense}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Speed / Energy:</td>
                <td>Speed: <strong>${p.speed}</strong> | Energy: <strong>${p.energy}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Encumbrance:</td>
                <td><strong>${weightLbs} lbs</strong> (Tier: <strong>${String(encumbrance ?? 'Unencumbered')}</strong>)</td>
              </tr>
            </table>
          </div>

          <!-- Base Attributes -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              📊 Base Attributes &amp; Afflictions
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
              <tr>
                <td style="color: #94a3b8;">Strength (STR): <strong>${p.strength}</strong></td>
                <td style="color: #94a3b8;">Dexterity (DEX): <strong>${p.dexterity}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Constitution (CON): <strong>${p.constitution}</strong></td>
                <td style="color: #94a3b8;">Intelligence (INT): <strong>${p.intelligence}</strong></td>
              </tr>
            </table>

            <div style="font-weight: bold; color: #cbd5e1; margin-top: 6px; margin-bottom: 4px;">Active Status Effects:</div>
            ${
              statusEffects.length === 0
                ? `<div style="color: #64748b; font-style: italic;">No active status afflictions.</div>`
                : `<div style="display: flex; flex-direction: column; gap: 3px;">
                    ${statusEffects
                      .map(
                        (se) => `
                      <div style="background: #1e293b; padding: 2px 6px; border-radius: 2px; display: flex; justify-content: space-between;">
                        <span style="color: #fb923c; font-weight: bold;">${se.type}</span>
                        <span style="color: #94a3b8;">${se.duration} ticks left</span>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </div>

        </div>

        <!-- Equipped Gear & Modifiers -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            ⚔️ Equipped Gear &amp; Item Modifiers (${equippedItems.length} slots)
          </div>
          ${
            equippedItems.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No items currently equipped.</div>`
              : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 6px;">
                  ${equippedItems
                    .map(({ slot, item }) => {
                      const mods = item.modifiers ?? [];
                      const isCursed = item.isCursed?.() ?? false;
                      return `
                      <div style="background: #1e293b; padding: 6px; border-radius: 3px; border-left: 3px solid ${isCursed ? '#ef4444' : mods.length > 0 ? '#38bdf8' : '#94a3b8'};">
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: #94a3b8; font-size: 10px;">[${slot}]</span>
                          <strong style="color: ${isCursed ? '#f87171' : '#f1f5f9'};">${item.displayName}</strong>
                        </div>
                        ${
                          mods.length > 0
                            ? `<div style="margin-top: 3px; font-size: 10px; color: #a5b4fc;">
                                Modifiers: ${mods.map((m: any) => `${m.name} (${m.category})`).join(', ')}
                              </div>`
                            : ''
                        }
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

        <!-- Nearby Entities Inspector -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            🎯 Nearby Visible Entities (≤ 4 tiles)
          </div>
          ${
            nearby.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No hostile or neutral entities adjacent to player.</div>`
              : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px;">
                  ${nearby
                    .map((ent: any) => {
                      const dist = Math.max(Math.abs(ent.x - p.x), Math.abs(ent.y - p.y));
                      return `
                      <div style="background: #1e293b; padding: 6px; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between;">
                          <strong style="color: #f87171;">${ent.name}</strong>
                          <span style="color: #94a3b8;">dist: ${dist}</span>
                        </div>
                        <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">
                          HP: <strong>${ent.hp}/${ent.maxHp}</strong> | AI: <span style="color: #facc15;">${ent.aiState ?? 'idle'}</span>
                        </div>
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

      </div>
    `;
  }

  private renderPipelineTab(engine: GameEngine): void {
    if (!this.tabContent) return;
    const isLocked = this.inputContext?.getInputLocked() ?? false;
    const chordStatus = this.inputContext?.getChordStatus?.() ?? {
      enabled: false,
      bufferMs: 40,
      pressedKeys: [],
      isChording: false,
      hasPendingTimer: false,
    };

    const lastActionName = engine.lastActionName ?? 'None';
    const lastResult = engine.lastActionResult;
    const recentEvents = engine.recentGameEvents ?? [];

    this.tabContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Pipeline Lock Alert Header -->
        <div style="background: ${isLocked ? '#7f1d1d' : '#064e3b'}; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${isLocked ? '#ef4444' : '#10b981'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${isLocked ? '⚠️' : '✅'}</span>
            <div>
              <strong style="color: white; font-size: 12px;">INPUT PIPELINE STATUS:</strong>
              <span style="color: ${isLocked ? '#fca5a5' : '#6ee7b7'}; margin-left: 6px; font-weight: bold;">
                ${isLocked ? 'LOCKED (ACTIVE ANIMATION / RESOLUTION IN PROGRESS)' : 'READY (ACCEPTING INPUTS)'}
              </span>
            </div>
          </div>
          ${
            isLocked
              ? `<button id="btn-pipeline-quick-unlock" class="win-btn primary-btn" style="font-weight: bold; font-size: 10px; padding: 3px 8px;">Force Clear Lock</button>`
              : ''
          }
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Last Action Dispatch Result -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ⚡ Last Dispatched ActionResult
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 120px;">Action Type:</td><td><strong>${lastActionName}</strong></td></tr>
              <tr>
                <td style="color: #94a3b8;">Result Status:</td>
                <td>
                  ${
                    lastResult
                      ? `<span style="background: ${lastResult.success ? '#15803d' : '#dc2626'}; color: white; padding: 1px 6px; border-radius: 2px; font-weight: bold;">
                          ${lastResult.success ? 'SUCCESS' : 'FAILED'}
                        </span>`
                      : 'N/A'
                  }
                </td>
              </tr>
              <tr><td style="color: #94a3b8;">Energy Cost:</td><td><strong>${lastResult?.cost ?? 0} ticks</strong></td></tr>
              <tr><td style="color: #94a3b8;">Message:</td><td style="color: #f1f5f9;">${lastResult?.message ?? 'No action dispatched yet.'}</td></tr>
              <tr><td style="color: #94a3b8;">Visual Effects:</td><td><strong>${lastResult?.effects?.length ?? 0} descriptors</strong></td></tr>
            </table>
          </div>

          <!-- Chord Buffer Micro-Debounce -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              🎹 Chord Buffer Micro-Debounce Status
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 130px;">Arrow Chording:</td><td><strong>${chordStatus.enabled ? 'Enabled (8-Way)' : 'Disabled (4-Way)'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Buffer Window:</td><td><strong>${chordStatus.bufferMs}ms</strong></td></tr>
              <tr><td style="color: #94a3b8;">Pressed Keys:</td><td><code>${chordStatus.pressedKeys.length > 0 ? chordStatus.pressedKeys.join(', ') : 'None'}</code></td></tr>
              <tr><td style="color: #94a3b8;">Chording Active:</td><td><strong>${chordStatus.isChording ? 'YES' : 'NO'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Timer Pending:</td><td><strong>${chordStatus.hasPendingTimer ? 'YES' : 'NO'}</strong></td></tr>
            </table>
          </div>

        </div>

        <!-- Recent Domain Events Stream -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px; flex: 1;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            📜 Domain Event Stream (${recentEvents.length} recent events)
          </div>
          ${
            recentEvents.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No domain events captured in buffer yet.</div>`
              : `<div style="display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto;">
                  ${[...recentEvents]
                    .reverse()
                    .map((ev) => {
                      return `
                      <div style="background: #1e293b; padding: 4px 8px; border-radius: 3px; display: flex; gap: 8px; align-items: center;">
                        <span style="background: #0284c7; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px; font-weight: bold;">${ev.type}</span>
                        <span style="color: #f8fafc; font-size: 11px;">${this.formatEventSummary(ev)}</span>
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

      </div>
    `;

    // Hook up quick unlock button if present
    const quickUnlockBtn = this.tabContent.querySelector('#btn-pipeline-quick-unlock');
    quickUnlockBtn?.addEventListener('click', () => {
      this.inputContext?.clearInputLock();
      this.showToast('Forced input lock clear. Pipeline responsive.');
      this.renderCurrentTab();
    });
  }

  private formatEventSummary(ev: any): string {
    if (ev.type === 'PlayerLeveledUp') {
      return `Hero reached level ${ev.newLevel}! (+${ev.statPointsGained} stat points)`;
    }
    if (ev.type === 'AlignmentRenown') {
      return `Alignment renown updated: ${ev.alignment} -> ${ev.newTotal} (${ev.delta > 0 ? `+${ev.delta}` : ev.delta})`;
    }
    if (ev.type === 'ChaoticProc') {
      return `Chaotic proc '${ev.procType}' triggered by ${ev.actor.name} (${ev.item.displayName})`;
    }
    if (ev.type === 'Uncurse') {
      return `Purification cleansed ${ev.cleansedCount} negative modifiers from ${ev.targetSlot ?? 'inventory'}`;
    }
    return safeJsonStringify(ev);
  }

  private renderTriageTab(engine: GameEngine): void {
    if (!this.tabContent) return;
    const p = engine.player;
    const isLocked = this.inputContext?.getInputLocked() ?? false;
    const isGodMode = p?.isInvulnerable ?? false;

    this.tabContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Emergency Correction Triggers -->
        <div style="background: #1e293b; padding: 10px; border-radius: 4px; border-left: 4px solid #f59e0b;">
          <div style="color: #fbbf24; font-weight: bold; font-size: 12px; margin-bottom: 8px;">
            🛠️ Emergency State-Correction &amp; Simulation Triggers
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-triage-clear-lock" class="win-btn ${isLocked ? 'danger-btn' : ''}" style="font-weight: bold; padding: 4px 10px;">
              🔓 Force Clear Lock ${isLocked ? '(ACTIVE)' : ''}
            </button>
            <button id="btn-triage-step-tick" class="win-btn" style="font-weight: bold; padding: 4px 10px;">
              ⏭️ Step 1 Tick (Deterministic Pass)
            </button>
            <button id="btn-triage-toggle-god" class="win-btn ${isGodMode ? 'primary-btn' : ''}" style="font-weight: bold; padding: 4px 10px;">
              🛡️ ${isGodMode ? 'Disable God Mode' : 'Enable God Mode (Invulnerable)'}
            </button>
            <button id="btn-triage-reveal-map" class="win-btn" style="font-weight: bold; padding: 4px 10px;">
              👁️ Reveal Current Floor Map
            </button>
          </div>
        </div>

        <!-- Test Entity & Item Spawner -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Item Spawns -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              🧪 Spawn Test Equipment &amp; Potions
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="win-btn btn-spawn-item" data-item="potion" style="padding: 3px 8px;">+ Healing Potion</button>
                <button class="win-btn btn-spawn-item" data-item="blessed" style="padding: 3px 8px;">+ Blessed Sword</button>
                <button class="win-btn btn-spawn-item" data-item="cursed" style="padding: 3px 8px;">+ Cursed Mace</button>
                <button class="win-btn btn-spawn-item" data-item="chaotic" style="padding: 3px 8px;">+ Chaotic Warpblade</button>
              </div>
            </div>
          </div>

          <!-- Monster Spawns -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👾 Spawn Test Monster (Adjacent)
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="win-btn btn-spawn-monster" data-mob="goblin" style="padding: 3px 8px;">+ Goblin (Melee)</button>
                <button class="win-btn btn-spawn-monster" data-mob="skeleton" style="padding: 3px 8px;">+ Skeleton (Undead)</button>
                <button class="win-btn btn-spawn-monster" data-mob="ogre" style="padding: 3px 8px;">+ Ogre (Brute)</button>
              </div>
            </div>
          </div>

        </div>

        <!-- Telemetry Export Tools -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            📋 Telemetry Report &amp; Flight Recorder Tools
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button id="btn-diag-copy" class="win-btn primary-btn" style="font-weight: bold; padding: 4px 10px;">📋 Copy Diagnostics</button>
            <button id="btn-diag-download" class="win-btn" style="padding: 4px 10px;">💾 Download .md</button>
            <button id="btn-diag-clear" class="win-btn danger-btn" style="padding: 4px 10px;">Clear Log Buffer</button>
            <button id="btn-diag-refresh" class="win-btn" style="padding: 4px 10px;">🔄 Refresh Telemetry</button>
          </div>
        </div>

      </div>
    `;

    // Hook up triage buttons
    const clearLockBtn = this.tabContent.querySelector('#btn-triage-clear-lock');
    clearLockBtn?.addEventListener('click', () => {
      this.inputContext?.clearInputLock();
      this.showToast('Input lock cleared. Keyboard responsiveness restored.');
      this.renderCurrentTab();
    });

    const stepTickBtn = this.tabContent.querySelector('#btn-triage-step-tick');
    stepTickBtn?.addEventListener('click', () => {
      if (engine.player) {
        engine.dispatchAction(new WaitAction(engine.player));
        this.showToast('Executed 1 deterministic simulation tick.');
        this.renderCurrentTab();
      }
    });

    const toggleGodBtn = this.tabContent.querySelector('#btn-triage-toggle-god');
    toggleGodBtn?.addEventListener('click', () => {
      if (engine.player) {
        engine.player.isInvulnerable = !engine.player.isInvulnerable;
        this.showToast(`Invulnerability ${engine.player.isInvulnerable ? 'ENABLED (God Mode)' : 'DISABLED'}.`);
        this.renderCurrentTab();
      }
    });

    const revealMapBtn = this.tabContent.querySelector('#btn-triage-reveal-map');
    revealMapBtn?.addEventListener('click', () => {
      engine.fov.revealAllTiles();
      engine.log('A mystical vision reveals the entire floor layout.');
      this.showToast('Floor map revealed (Clairvoyance).');
      this.renderCurrentTab();
    });

    // Spawn item buttons
    const spawnItemBtns = this.tabContent.querySelectorAll<HTMLButtonElement>('.btn-spawn-item');
    spawnItemBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemType = btn.getAttribute('data-item');
        this.spawnTestItem(engine, itemType);
      });
    });

    // Spawn monster buttons
    const spawnMobBtns = this.tabContent.querySelectorAll<HTMLButtonElement>('.btn-spawn-monster');
    spawnMobBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mobId = btn.getAttribute('data-mob');
        this.spawnTestMonster(engine, mobId ?? 'goblin');
      });
    });

    // Telemetry buttons
    const copyBtn = this.tabContent.querySelector('#btn-diag-copy');
    copyBtn?.addEventListener('click', () => {
      void this.copyReportToClipboard();
    });

    const downloadBtn = this.tabContent.querySelector('#btn-diag-download');
    downloadBtn?.addEventListener('click', () => {
      this.downloadReport();
    });

    const clearBtn = this.tabContent.querySelector('#btn-diag-clear');
    clearBtn?.addEventListener('click', () => {
      flightRecorder.clear();
      this.showToast('Flight log buffer cleared.');
      this.renderCurrentTab();
    });

    const refreshBtn = this.tabContent.querySelector('#btn-diag-refresh');
    refreshBtn?.addEventListener('click', () => {
      this.renderCurrentTab();
      this.showToast('Telemetry refreshed.');
    });
  }

  // --- Spawner Helpers ---

  private spawnTestItem(engine: GameEngine, type: string | null): void {
    const p = engine.player;
    if (!p) return;

    let item: Item | null = null;
    if (type === 'potion') {
      item = ItemFactory.createHealthPotion(`potion-${Date.now()}`);
    } else if (type === 'blessed') {
      item = new Item({
        id: `blessed-sword-${Date.now()}`,
        name: 'Blessed Longsword',
        unidentifiedName: 'Broadsword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1600,
        bulk: 1200,
        stats: { attackBonus: 8 },
        identified: true,
        description: 'A holy consecrated steel blade.',
        modifiers: [
          {
            id: `blessed-${Date.now()}`,
            name: 'Blessed',
            category: 'blessed',
            alignment: 'positive',
            meleeDamageMultiplier: 1.25,
            statDeltas: { attackBonus: 4 },
            prefix: 'Blessed',
          },
        ],
      });
    } else if (type === 'cursed') {
      item = ItemFactory.createCursedMace(`cursed-mace-${Date.now()}`);
    } else if (type === 'chaotic') {
      item = new Item({
        id: `chaotic-blade-${Date.now()}`,
        name: 'Chaotic Warpblade',
        unidentifiedName: 'Glowing Sword',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 1200,
        stats: { attackBonus: 12 },
        identified: true,
        description: 'A blade vibrating with chaotic spatial energy.',
        modifiers: [
          {
            id: `chaotic-${Date.now()}`,
            name: 'Chaotic Warp',
            category: 'chaotic',
            alignment: 'chaotic',
            meleeDamageMultiplier: 1.5,
            chaoticProc: {
              type: 'teleport',
              procChance: 0.25,
              param: 3,
              description: 'Randomly teleports wielder on hit',
            },
            prefix: 'Chaotic',
          },
        ],
      });
    }

    if (item) {
      const added = p.addItem(item);
      if (!added) {
        engine.map.addItemAt(p.x, p.y, item);
        this.showToast(`Backpack full: Placed ${item.displayName} on ground.`);
      } else {
        this.showToast(`Spawned ${item.displayName} in backpack.`);
      }
      this.renderCurrentTab();
    }
  }

  private spawnTestMonster(engine: GameEngine, mobId: string): void {
    const p = engine.player;
    if (!p) return;

    const def: MonsterDefinition = MonsterRegistry.get(mobId) ?? MonsterRegistry.getAll()[0] ?? {
      id: mobId,
      name: mobId.toUpperCase(),
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 15,
      lootTable: [],
    };

    const neighbors = [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
      { x: p.x + 1, y: p.y + 1 },
      { x: p.x - 1, y: p.y - 1 },
    ];
    const spawnTile = neighbors.find(
      (n) => engine.map.isPassable(n.x, n.y) && !engine.map.getEntityAt(n.x, n.y)
    );

    if (spawnTile) {
      const monster = createScaledMonster(
        def,
        `test-mob-${Date.now()}`,
        spawnTile,
        engine.currentFloor
      );
      monster.aiState = 'hunting';
      engine.map.addEntity(monster);
      engine.scheduler.addEntity(monster);
      this.showToast(`Spawned ${monster.name} at (${spawnTile.x}, ${spawnTile.y})!`);
      this.renderCurrentTab();
    } else {
      this.showToast('No passable adjacent tile to spawn monster.');
    }
  }

  // --- Flight Recorder & Markdown Export ---

  public async copyReportToClipboard(): Promise<void> {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined);

    await copyTextToClipboard(report);
    this.showToast('Diagnostic report copied to clipboard.');
  }

  public downloadReport(): void {
    const engine = this.getEngine();
    const profile = this.getProfile();
    const report = flightRecorder.generateReport(engine ?? undefined, profile ?? undefined);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cotw-diagnostics-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Diagnostic report downloaded.');
  }

  public showToast(message: string): void {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.style.display = 'inline';

    if (this.toastTimeout !== null) {
      if (typeof window !== 'undefined') window.clearTimeout(this.toastTimeout);
    }
    if (typeof window !== 'undefined') {
      this.toastTimeout = window.setTimeout(() => {
        if (this.toast) {
          this.toast.style.display = 'none';
        }
        this.toastTimeout = null;
      }, 3500);
    }
  }

  public showCrash(error: Error | string): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';

    flightRecorder.recordError(error, { unhandled: true });

    if (this.crashModal && this.crashText) {
      this.crashText.textContent = `${message}\n\n${stack ?? ''}`;
      this.crashModal.style.display = 'flex';
    }
  }
}
