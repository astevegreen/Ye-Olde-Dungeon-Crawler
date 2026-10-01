import type { GameState } from './gameState';
import type { MenuFooter, MenuHost, MenuTab } from './menuTab';
import type { RunPactDefinition } from '../../engine';
import { resolveBranding } from '../branding';
import { escapeHtml } from '../html';

/**
 * The Pacts tab (ADR-0011): each pact as a card with its cost and its reward, and what the
 * sealed ones add up to. Enter seals or renounces the highlighted pact.
 */
export class PactsTab implements MenuTab {
  public readonly id = 'pacts';
  public readonly label = 'Pacts';
  public readonly hotkeyActionId = 'pact';

  private container: HTMLElement | null = null;
  private state: GameState | null = null;
  private host?: MenuHost;
  private selectedId = '';

  public bindHost(host: MenuHost): void {
    this.host = host;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.state = state;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private pacts(): RunPactDefinition[] {
    return this.state?.engine.pacts?.getAllPacts() ?? [];
  }

  private selected(): RunPactDefinition | undefined {
    const pacts = this.pacts();
    return pacts.find((p) => p.id === this.selectedId) ?? pacts[0];
  }

  /** Seals or renounces the highlighted pact. */
  public toggleSelected(): boolean {
    const pact = this.selected();
    if (!pact || !this.state) return false;
    this.state.engine.pacts.togglePact(pact.id);
    this.render();
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    const pacts = this.pacts();
    if (pacts.length === 0) return false;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const i = Math.max(0, pacts.findIndex((p) => p.id === this.selected()?.id));
      const next = e.code === 'ArrowDown' ? (i + 1) % pacts.length : (i - 1 + pacts.length) % pacts.length;
      this.selectedId = pacts[next].id;
      e.preventDefault();
      this.render();
      return true;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      return this.toggleSelected();
    }
    return false;
  }

  public footer(): MenuFooter {
    const pact = this.selected();
    const sealed = pact ? this.state!.engine.pacts.isPactActive(pact.id) : false;
    return {
      keys: [{ keys: ['↑', '↓'], label: 'choose' }],
      actions: pact
        ? [{ id: 'toggle-pact', label: sealed ? 'Renounce' : 'Seal pact', key: 'Enter', primary: true, run: () => this.toggleSelected() }]
        : [],
    };
  }

  public render(): void {
    if (!this.container || !this.state) return;
    const engine = this.state.engine;
    const pacts = this.pacts();
    const selected = this.selected();
    if (selected) this.selectedId = selected.id;

    const cards = pacts
      .map((pact) => {
        const sealed = engine.pacts.isPactActive(pact.id);
        return `
          <div class="ui-card pc-card${pact.id === this.selectedId ? ' is-selected' : ''}${sealed ? ' is-sealed' : ''}" data-pact-id="${escapeHtml(pact.id)}">
            <div class="pc-head"><span class="pc-name">${escapeHtml(pact.name)}</span>${sealed ? '<span class="pc-tag">Sealed</span>' : ''}</div>
            <div class="pc-line pc-cost"><span class="pc-label">Cost</span> ${escapeHtml(pact.curseDescription)}</div>
            <div class="pc-line pc-gain"><span class="pc-label">Reward</span> ${escapeHtml(pact.rewardDescription)}</div>
          </div>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="ui-tabgrid pc-grid">
        <div class="ui-col ui-scroll">
          <div class="ui-note">A pact makes the dungeon harder and pays more for it. Seal or renounce one at any time.</div>
          ${cards || '<div class="ui-card ui-note">There are no pacts to make.</div>'}
        </div>
        <div class="ui-col">${this.renderSummary()}</div>
      </div>`;

    if (typeof this.container.querySelectorAll === 'function') {
      this.container.querySelectorAll<HTMLElement>('[data-pact-id]').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-pact-id');
          if (id === this.selectedId) {
            this.toggleSelected();
          } else if (id) {
            this.selectedId = id;
            this.render();
          }
        });
      });
    }
    this.host?.refreshChrome();
  }

  private renderSummary(): string {
    const engine = this.state!.engine;
    const active = engine.pacts.getActivePacts();
    if (active.length === 0) {
      return '<div class="ui-card"><div class="ui-h">While sealed</div><div class="ui-note">No pacts sealed. The dungeon is as it was made.</div></div>';
    }
    const rewards = engine.pacts.getAggregatedRewards();
    const m = engine.pacts.getAggregatedMutators();
    const xpName = resolveBranding(engine.manifest).xpName;
    const costs = [
      m.playerMaxHpPercent ? `${Math.round(m.playerMaxHpPercent * 100)}% maximum health` : '',
      m.playerDefenseBonus ? `${m.playerDefenseBonus > 0 ? '+' : ''}${m.playerDefenseBonus} defense` : '',
      m.playerAttackBonus ? `${m.playerAttackBonus > 0 ? '+' : ''}${m.playerAttackBonus} attack` : '',
      m.fovRadiusModifier ? `${m.fovRadiusModifier} sight radius` : '',
      m.monsterDensityMultiplier && m.monsterDensityMultiplier !== 1 ? `${m.monsterDensityMultiplier.toFixed(1)}× monsters` : '',
      m.monsterStatMultiplier && m.monsterStatMultiplier !== 1 ? `${m.monsterStatMultiplier.toFixed(1)}× monster strength` : '',
    ].filter(Boolean);
    return `
      <div class="ui-card">
        <div class="ui-h">While sealed <small>${active.length} pact${active.length === 1 ? '' : 's'}</small></div>
        <dl class="ui-kv ui-num">
          <dt>Gold</dt><dd class="pc-gain">${rewards.goldMultiplier.toFixed(1)}×</dd>
          <dt>${escapeHtml(xpName)}</dt><dd class="pc-gain">${rewards.xpMultiplier.toFixed(2)}×</dd>
          <dt>Magic find</dt><dd class="pc-gain">+${Math.round(rewards.magicFindBonus * 100)}%</dd>
        </dl>
        ${costs.length ? `<div class="ui-h pc-subh">You pay</div>${costs.map((c) => `<div class="pc-cost ui-num">${escapeHtml(c)}</div>`).join('')}` : ''}
      </div>`;
  }
}
