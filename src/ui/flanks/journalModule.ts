import type { FlankModule, GameState, DiscoveryEvent } from './types';

export class JournalModule implements FlankModule {
  public readonly id = 'auto_journal';
  public readonly title = "Cartographer's Journal";
  private container: HTMLElement | null = null;
  private lastRenderedEventCount = 0;

  public mount(container: HTMLElement): void {
    this.container = container;
    this.container.innerHTML = `
      <div class="journal-container">
        <header class="journal-header">
          <svg class="feather-quill-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="currentColor" d="M21.71 3.29a1 1 0 0 0-1.42 0l-9.88 9.88-2.12-.71a1 1 0 0 0-1.07.24l-4 4a1 1 0 0 0 0 1.41l3.59 3.59a1 1 0 0 0 1.41 0l4-4a1 1 0 0 0 .24-1.07l-.71-2.12 9.88-9.88a1 1 0 0 0 .08-1.34zM7.5 17.5l-2-2 2.5-2.5 1.5 1.5-2 3zm4.5-4.5l-1.5-1.5 8-8 1.5 1.5-8 8zM2.71 21.29a1 1 0 0 0 1.41 0l1.59-1.59-1.41-1.41-1.59 1.59a1 1 0 0 0 0 1.41z"/>
          </svg>
          <h3 class="journal-title">Auto-Inking Journal</h3>
        </header>

        <section class="journal-section cartographer-section">
          <h4 class="journal-section-title">
            <span>Cartographer's Survey</span>
            <span class="floor-pill" id="cartographer-floor-pill">Floor 1</span>
          </h4>
          <div class="cartographer-card">
            <div class="cartographer-stats">
              <span class="stat-label">Exploration:</span>
              <span class="stat-value" id="cartographer-exploration-pct">0%</span>
            </div>
            <div class="exploration-progress-track">
              <div class="exploration-progress-fill" id="cartographer-exploration-fill" style="width: 0%;"></div>
            </div>
            <div class="cartographer-landmarks" id="cartographer-landmarks">
              <span class="landmark-tag">No landmarks surveyed</span>
            </div>
          </div>
        </section>

        <section class="journal-section chronicle-section">
          <div class="chronicle-header-row">
            <h4 class="journal-section-title">
              <span>Chronicle of Discoveries</span>
            </h4>
            <span class="chronicle-badge" id="chronicle-count-badge">0 entries</span>
          </div>
          <div class="chronicle-feed" id="journal-chronicle-feed">
            <div class="chronicle-empty-prompt">
              The ink is dry. As you venture through the dungeon, secrets, traps, and triumphs will be inscribed here.
            </div>
          </div>
        </section>
      </div>
    `;
  }

  public render(state: GameState): void {
    if (!this.container) return;

    // 1. Cartographer Survey Stats
    const floorPill = this.container.querySelector('#cartographer-floor-pill');
    if (floorPill) {
      floorPill.textContent = state.currentFloor === 0 ? 'Town' : `Depth ${state.currentFloor}`;
    }

    const map = state.map;
    const fov = state.engine?.fov;
    let explorable = 0;
    let explored = 0;
    const landmarks: string[] = [];

    if (map && fov) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = map.getTile(x, y);
          if (tile && tile.type !== 'wall') {
            explorable++;
            if (fov.isExplored(x, y)) {
              explored++;
              // Check landmarks
              if (tile.type === 'stairs_up' && !landmarks.includes('Stairs Up 🪜')) {
                landmarks.push('Stairs Up 🪜');
              } else if (tile.type === 'stairs_down' && !landmarks.includes('Stairs Down 🪜')) {
                landmarks.push('Stairs Down 🪜');
              } else if ((tile.type === 'altar' || tile.type.includes('altar')) && !landmarks.includes('Altar of Tyr ⚖️')) {
                landmarks.push('Altar of Tyr ⚖️');
              } else if (tile.type === 'gateway_valhalla' && !landmarks.includes('Valhalla Gateway ✨')) {
                landmarks.push('Valhalla Gateway ✨');
              } else if (tile.type === 'dwarven_winch' && !landmarks.includes('Dwarven Winch ⚙️')) {
                landmarks.push('Dwarven Winch ⚙️');
              } else if (tile.type === 'town_portal' && !landmarks.includes('Town Portal 🌀')) {
                landmarks.push('Town Portal 🌀');
              }
            }
          }
        }
      }
    }

    // Include any disarmed traps or secret doors on this floor
    const secretDoorsFound = (state.engine?.discoveryEvents ?? []).filter(
      (e) => e.type === 'secret_door' && e.floor === state.currentFloor
    ).length;
    if (secretDoorsFound > 0) {
      landmarks.push(`${secretDoorsFound} Secret Passage${secretDoorsFound > 1 ? 's' : ''} 🔍`);
    }

    const pct = explorable > 0 ? Math.round((explored / explorable) * 100) : 0;
    const pctLabel = this.container.querySelector('#cartographer-exploration-pct');
    if (pctLabel) {
      pctLabel.textContent = `${pct}%`;
    }
    const pctFill = this.container.querySelector('#cartographer-exploration-fill') as HTMLElement;
    if (pctFill) {
      pctFill.style.width = `${pct}%`;
    }

    const landmarksEl = this.container.querySelector('#cartographer-landmarks');
    if (landmarksEl) {
      if (landmarks.length === 0) {
        landmarksEl.innerHTML = '<span class="landmark-tag muted">None mapped yet</span>';
      } else {
        landmarksEl.innerHTML = landmarks
          .map((lm) => `<span class="landmark-tag surveyed">${lm}</span>`)
          .join('');
      }
    }

    // 2. Rolling Chronicle of Discoveries
    const events: DiscoveryEvent[] = state.engine?.discoveryEvents ?? [];
    const feedEl = this.container.querySelector('#journal-chronicle-feed');
    const countBadge = this.container.querySelector('#chronicle-count-badge');

    if (countBadge) {
      countBadge.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
    }

    if (feedEl) {
      if (events.length === 0) {
        feedEl.innerHTML = `
          <div class="chronicle-empty-prompt">
            The ink is fresh. As you venture through the dungeon, secrets, traps, and triumphs will be inscribed here.
          </div>
        `;
        this.lastRenderedEventCount = 0;
      } else {
        // Keep the latest 25 events
        const displayEvents = events.slice(-25);
        const shouldScroll = events.length > this.lastRenderedEventCount;

        feedEl.innerHTML = displayEvents
          .map((evt, idx) => {
            const isNew = idx >= displayEvents.length - 2;
            const icon = evt.icon ?? this.getDefaultIcon(evt.type);
            return `
              <article class="chronicle-entry chronicle-type-${evt.type} ${isNew ? 'entry-fresh' : ''}">
                <div class="entry-meta">
                  <span class="entry-floor">F${evt.floor}</span>
                  <span class="entry-turn">T${evt.turn}</span>
                  <span class="entry-icon">${icon}</span>
                </div>
                <div class="entry-content">
                  <span class="entry-text">${this.escapeHtml(evt.text)}</span>
                </div>
              </article>
            `;
          })
          .join('');

        this.lastRenderedEventCount = events.length;

        // Auto-scroll to bottom of journal feed if new entries appeared
        if (shouldScroll) {
          requestAnimationFrame(() => {
            feedEl.scrollTop = feedEl.scrollHeight;
          });
        }
      }
    }
  }

  private getDefaultIcon(type: string): string {
    switch (type) {
      case 'floor_transition':
        return '🪜';
      case 'secret_door':
        return '🔍';
      case 'trap_disarmed':
        return '🪤';
      case 'boss_slain':
        return '⚔️';
      case 'close_call':
        return '❤️‍🩹';
      case 'pact_sealed':
        return '📜';
      case 'quest_milestone':
        return '☀️';
      default:
        return '✒️';
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.lastRenderedEventCount = 0;
  }
}
