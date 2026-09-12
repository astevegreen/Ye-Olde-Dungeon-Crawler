import type { FlankModule, GameState } from './types';
import type { TrackedMilestoneDefinition } from '../../engine';

export interface ReputationTier {
  label: string;
  tierClass: string;
  color: string;
}

export function getReputationTier(val: number): ReputationTier {
  if (val <= -50) {
    return { label: 'Hostile', tierClass: 'rep-hostile', color: '#ff4d4d' };
  } else if (val <= -10) {
    return { label: 'Unfriendly', tierClass: 'rep-unfriendly', color: '#ff9933' };
  } else if (val <= 9) {
    return { label: 'Neutral', tierClass: 'rep-neutral', color: '#9e9e9e' };
  } else if (val <= 49) {
    return { label: 'Friendly', tierClass: 'rep-friendly', color: '#4caf50' };
  } else {
    return { label: 'Honored', tierClass: 'rep-honored', color: '#ffc107' };
  }
}

function formatFactionName(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const DEFAULT_MILESTONES: TrackedMilestoneDefinition[] = [
  { flag: 'relic_recovered', label: 'Sun-Stone Claimed', description: 'Recovered the radiant Sun-Stone from the depths.', icon: '☀️' },
  { flag: 'winch_repaired', label: 'Mine Lift Restored', description: 'Restored the haulage winch for deep shaft descent.', icon: '⚙️' },
  { flag: 'boss_slain', label: 'Hrungnir Vanquished', description: 'Defeated the ancient giant guarding the abyss.', icon: '👑' },
  { flag: 'altar_cleansed', label: 'Altar Purified', description: 'Offered sacred dedication at the Altar of Tyr.', icon: '⚖️' },
];

export class WorldLedgerModule implements FlankModule {
  public readonly id = 'world_ledger';
  public readonly title = 'World Ledger';
  private container: HTMLElement | null = null;

  public mount(container: HTMLElement): void {
    this.container = container;
    this.container.innerHTML = `
      <div class="ledger-container">
        <header class="ledger-header">
          <svg class="ledger-header-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.1-2.6 7.9-6 8.95-3.4-1.05-6-4.85-6-8.95V6.43l6-2.25zM11 7h2v6h-2V7zm0 8h2v2h-2v-2z"/>
          </svg>
          <h3 class="ledger-title">World Ledger & Standing</h3>
        </header>

        <section class="ledger-section ledger-reputation-section">
          <h4 class="ledger-section-title">
            <span>Faction Reputation</span>
          </h4>
          <div class="ledger-reputation-list" id="ledger-reputation-list">
            <div class="ledger-empty-note">No faction records</div>
          </div>
        </section>

        <section class="ledger-section ledger-pacts-section">
          <h4 class="ledger-section-title">
            <span>Sealed Pacts & Boons</span>
          </h4>
          <div class="ledger-pacts-list" id="ledger-pacts-list">
            <div class="ledger-empty-note">No active pacts sealed</div>
          </div>
        </section>

        <section class="ledger-section ledger-milestones-section">
          <h4 class="ledger-section-title">
            <span>Chronicle Milestones</span>
          </h4>
          <div class="ledger-milestones-grid" id="ledger-milestones-grid"></div>
        </section>
      </div>
    `;
  }

  public render(state: GameState): void {
    if (!this.container) return;

    // 1. Faction Reputation
    const repContainer = this.container.querySelector('#ledger-reputation-list');
    if (repContainer) {
      const factions = state.worldState?.factions ?? {};
      const entries = Object.entries(factions);

      if (entries.length === 0) {
        repContainer.innerHTML = '<div class="ledger-empty-note">No faction standings</div>';
      } else {
        repContainer.innerHTML = entries
          .map(([fKey, score]) => {
            const clamped = Math.max(-100, Math.min(100, Number(score) || 0));
            const tier = getReputationTier(clamped);
            // Percentage for bar width (-100 => 0%, 0 => 50%, 100 => 100%)
            const pct = Math.round(((clamped + 100) / 200) * 100);
            const sign = clamped > 0 ? `+${clamped}` : `${clamped}`;

            return `
              <div class="reputation-entry" data-faction="${fKey}">
                <div class="rep-header">
                  <span class="rep-name">${formatFactionName(fKey)}</span>
                  <span class="rep-score-tag ${tier.tierClass}" style="color: ${tier.color};">
                    ${tier.label} (${sign})
                  </span>
                </div>
                <div class="rep-bar-track" title="Standing: ${sign} / 100 (${tier.label})">
                  <div class="rep-bar-center-mark"></div>
                  <div class="rep-bar-fill ${tier.tierClass}" style="width: ${pct}%; background-color: ${tier.color};"></div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // 2. Active Pacts
    const pactsContainer = this.container.querySelector('#ledger-pacts-list');
    if (pactsContainer) {
      const pactManager = state.pacts ?? state.engine?.pacts;
      const activePacts = pactManager ? pactManager.getActivePacts() : [];

      if (activePacts.length === 0) {
        pactsContainer.innerHTML = '<div class="ledger-empty-note">No active pacts sealed</div>';
      } else {
        const rewards = pactManager?.getAggregatedRewards();
        const rewardSummary = rewards
          ? `
          <div class="pact-rewards-summary">
            ${rewards.xpMultiplier !== 1.0 ? `<span class="reward-pill xp">XP: +${Math.round((rewards.xpMultiplier - 1) * 100)}%</span>` : ''}
            ${rewards.goldMultiplier !== 1.0 ? `<span class="reward-pill gold">Gold: +${Math.round((rewards.goldMultiplier - 1) * 100)}%</span>` : ''}
            ${rewards.magicFindBonus > 0 ? `<span class="reward-pill mf">Find: +${Math.round(rewards.magicFindBonus * 100)}%</span>` : ''}
          </div>
        `
          : '';

        pactsContainer.innerHTML = `
          ${rewardSummary}
          <div class="pact-chips-wrapper">
            ${activePacts
              .map((p) => {
                return `
                <div class="pact-badge-chip" title="${p.curseDescription} | ${p.rewardDescription}">
                  <span class="pact-badge-icon">📜</span>
                  <span class="pact-badge-name">${p.name}</span>
                </div>
              `;
              })
              .join('')}
          </div>
        `;
      }
    }

    // 3. Milestones / World Flags
    const milestonesContainer = this.container.querySelector('#ledger-milestones-grid');
    if (milestonesContainer) {
      const milestones = state.manifest?.trackedMilestones ?? DEFAULT_MILESTONES;
      const flags = state.worldState?.flags ?? {};

      milestonesContainer.innerHTML = milestones
        .map((ms) => {
          const isComplete = Boolean(flags[ms.flag]);
          const icon = ms.icon ?? '⚜️';
          return `
            <div class="milestone-badge ${isComplete ? 'completed' : 'uncompleted'}"
                 title="${ms.label}: ${ms.description ?? (isComplete ? 'Accomplished' : 'Yet to be achieved')}">
              <div class="milestone-seal">
                <svg class="wax-seal-svg" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="14" class="seal-outer-rim" />
                  <circle cx="16" cy="16" r="11" class="seal-inner-circle" />
                </svg>
                <span class="seal-glyph">${icon}</span>
                ${isComplete ? '<span class="seal-check">✓</span>' : ''}
              </div>
              <div class="milestone-meta">
                <span class="milestone-name">${ms.label}</span>
                <span class="milestone-status">${isComplete ? 'Achieved' : 'Locked'}</span>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }
}
