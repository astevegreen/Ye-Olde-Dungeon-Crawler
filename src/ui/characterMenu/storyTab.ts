import type { GameState } from './gameState';
import type { MenuFooter, MenuTab } from './menuTab';
import { buildDescent, buildSaga, buildStanding, buildVerses, type Descent } from './storyModel';
import { resolveBranding } from '../branding';
import { escapeHtml } from '../html';

type StoryPanel = 'lore' | 'standing';

/** The Chronicle shows this many of the latest discoveries. */
const CHRONICLE_SHOWN = 30;

/**
 * The Story tab (ADR-0011, mockup m2): the Descent line down the run's floors, the Saga
 * (objective, deeds done, locked deeds as riddles, the Chronicle), and a side panel of
 * lore and standing with the factions met. Sealed pacts are the Pacts tab's alone. All
 * names and flavor come from the pack's manifest and branding.
 */
export class StoryTab implements MenuTab {
  public readonly id = 'story';
  public readonly label = 'Story';
  public readonly hotkeyActionId = 'story';

  private container: HTMLElement | null = null;
  private state: GameState | null = null;
  private panel: StoryPanel = 'lore';
  /** Milestones already shown as achieved, so a newly achieved one glows once. Per engine. */
  private seen: { engine: unknown; flags: Set<string> } | null = null;

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

  /** The side panels: lore only when the pack has any. */
  private panels(): StoryPanel[] {
    return this.manifest()?.loreEntries?.length ? ['lore', 'standing'] : ['standing'];
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return false;
    const panels = this.panels();
    if (panels.length < 2) return false;
    const step = e.code === 'ArrowRight' ? 1 : panels.length - 1;
    this.panel = panels[(Math.max(0, panels.indexOf(this.panel)) + step) % panels.length];
    e.preventDefault();
    this.render();
    return true;
  }

  public footer(): MenuFooter {
    const hasLore = this.panels().includes('lore');
    const loreTitle = resolveBranding(this.manifest()).loreTitle;
    return {
      keys: hasLore ? [{ keys: ['←', '→'], label: `${loreTitle} · Standing` }] : [],
      note: hasLore ? `What you learn is kept under ${loreTitle}.` : undefined,
    };
  }

  private manifest(): GameState['manifest'] {
    return this.state ? (this.state.manifest ?? this.state.engine.manifest) : undefined;
  }

  public render(): void {
    if (!this.container || !this.state) return;
    const engine = this.state.engine;
    const descent = buildDescent(engine);

    this.container.innerHTML = `
      <div class="ui-tabgrid st-grid">
        <div class="ui-col">${this.renderDescent(descent)}</div>
        <div class="ui-col ui-scroll">${this.renderSaga()}${this.renderChronicle()}</div>
        <div class="ui-col ui-scroll">${this.renderSide()}</div>
      </div>
    `;

    if (typeof this.container.querySelectorAll === 'function') {
      this.container.querySelectorAll<HTMLButtonElement>('button[data-panel]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.panel = (btn.getAttribute('data-panel') as StoryPanel) ?? this.panel;
          this.render();
        });
      });
    }
  }

  private renderDescent(d: Descent): string {
    const branding = resolveBranding(this.manifest());
    const span = Math.max(1, d.lastFloor - 1);
    const y = (floor: number): number => 2 + (96 * (Math.min(d.lastFloor, Math.max(1, floor)) - 1)) / span;
    const bands = d.bands
      .map(
        (b) =>
          `<div class="st-band ${b.label ? 'is-known' : ''}" style="top: ${y(b.floor).toFixed(2)}%"><span class="st-band-floor ui-num">${b.floor}</span><i></i><span>${b.label ? escapeHtml(b.label) : '? ? ?'}</span></div>`
      )
      .join('');
    const inTown = d.currentFloor === 0;
    const youTop = inTown ? 0 : y(d.currentFloor);
    const you = `
      <div class="st-you" style="top: ${youTop.toFixed(2)}%"></div>
      <div class="st-you-label" style="top: ${youTop.toFixed(2)}%">You · ${inTown ? escapeHtml(branding.townName) : `floor <span class="ui-num">${d.currentFloor}</span>`}</div>`;
    const deepestMark =
      d.deepest > d.currentFloor && d.deepest > 0
        ? `<div class="st-deepest" style="top: ${y(d.deepest).toFixed(2)}%" title="Deepest reached"></div>`
        : '';
    const fill = d.deepest > 0 ? `<div class="st-fill" style="height: calc(${y(d.deepest).toFixed(2)}% - 8px)"></div>` : '';

    return `
      <div class="ui-h">The Descent ${d.currentZone ? `<small>${escapeHtml(d.currentZone)}</small>` : ''}</div>
      <div class="ui-card st-descent">
        <div class="st-track"></div>${fill}${bands}${deepestMark}${you}
      </div>
      <div class="ui-note">${d.deepest > 0 ? `Deepest reached: floor <span class="ui-num">${d.deepest}</span> of ${d.lastFloor}. ` : ''}Names appear as you reach each depth.</div>`;
  }

  private renderSaga(): string {
    const saga = buildSaga(this.state!.engine);
    const engine = this.state!.engine;
    if (!this.seen || this.seen.engine !== engine) {
      // First look at this run: nothing glows.
      this.seen = { engine, flags: new Set(saga.achieved.map((m) => m.flag)) };
    }
    const fresh = saga.achieved.filter((m) => !this.seen!.flags.has(m.flag));
    for (const m of fresh) this.seen.flags.add(m.flag);

    const done = saga.achieved
      .map(
        (m) => `
        <div class="st-deed is-done${fresh.includes(m) ? ' ui-glow' : ''}">
          <span class="st-seal">✓</span>
          <div><div class="st-deed-title">${escapeHtml(m.label)}</div>${m.description ? `<div class="ui-note ui-faint">${escapeHtml(m.description)}</div>` : ''}</div>
        </div>`
      )
      .join('');
    const locked = saga.riddles
      .map(
        (r) => `
        <div class="st-deed is-locked">
          <span class="st-seal">?</span>
          <div class="st-deed-title">${r ? escapeHtml(r) : '? ? ?'}</div>
        </div>`
      )
      .join('');
    const untold = saga.untold
      ? `<div class="st-deed is-untold"><span class="st-seal">…</span><div class="ui-note">${saga.untold} more deed${saga.untold === 1 ? '' : 's'} untold</div></div>`
      : '';
    const deeds = done + locked + untold;

    return `
      <div class="ui-h">Saga</div>
      ${saga.objective ? `<div class="st-now"><div class="st-now-label">Now</div>${escapeHtml(saga.objective)}</div>` : ''}
      ${deeds ? `<div class="ui-card st-deeds">${deeds}</div>` : ''}`;
  }

  private renderChronicle(): string {
    const events = [...(this.state!.engine.discoveryEvents ?? [])].reverse().slice(0, CHRONICLE_SHOWN);
    const rows = events
      .map(
        (e) =>
          `<div class="st-entry"><span class="ui-num ui-faint">${e.floor === 0 ? 'Town' : `F${e.floor}`} · T${e.turn}</span> ${escapeHtml(e.text)}</div>`
      )
      .join('');
    return `
      <div class="ui-card st-chronicle">
        <div class="ui-h">Chronicle <small>latest first</small></div>
        ${rows || '<div class="ui-note">Nothing written yet. Discoveries, traps and triumphs are recorded here as they happen.</div>'}
      </div>`;
  }

  private renderSide(): string {
    const manifest = this.manifest()!;
    const branding = resolveBranding(manifest);
    const worldState = this.state!.worldState;
    const verses = buildVerses(worldState, manifest);
    const panels = this.panels();
    if (!panels.includes(this.panel)) this.panel = panels[0];
    const labels: Record<StoryPanel, string> = {
      lore: `${escapeHtml(branding.loreTitle)} <span class="ui-num">${verses.read.length}/${verses.total}</span>`,
      standing: 'Standing',
    };
    const tabs = panels.map((id) => [id, labels[id]] as const);
    const subtabs = `<div class="st-subtabs" role="tablist">${tabs
      .map(([id, label]) => `<button type="button" role="tab" data-panel="${id}" aria-selected="${this.panel === id}" class="st-subtab">${label}</button>`)
      .join('')}</div>`;

    let body = '';
    if (this.panel === 'lore') {
      body =
        verses.read
          .map(
            (v) => `
          <div class="ui-card st-verse">
            <div class="st-verse-title">${escapeHtml(v.title)}</div>
            <div class="st-verse-text">“${escapeHtml(v.verse)}”</div>
            <div class="st-lore">${escapeHtml(v.lore)}</div>
          </div>`
          )
          .join('') +
        (verses.read.length < verses.total
          ? `<div class="ui-card st-blank">${verses.total - verses.read.length} more wait${verses.total - verses.read.length === 1 ? 's' : ''} somewhere below, unread.</div>`
          : '');
    } else {
      const standing = buildStanding(worldState, manifest);
      body = `<div class="ui-card">${
        standing.met
          .map(
            (f) => `
          <div class="st-faction">
            <span>${escapeHtml(f.name)}</span>
            <span class="ui-num st-tier is-${f.tier}">${f.label} ${f.value > 0 ? '+' : ''}${f.value}</span>
          </div>
          <div class="ui-bar st-faction-bar"><i class="is-${f.tier}" style="width: ${Math.round(((f.value + 100) / 200) * 100)}%"></i></div>`
          )
          .join('') || ''
      }${
        standing.unmet > 0
          ? `<div class="ui-note">Other banners fly in the deep. You have not met them yet.</div>`
          : standing.met.length === 0
          ? '<div class="ui-note">No one has taken your measure yet.</div>'
          : ''
      }</div>`;
    }
    return subtabs + body;
  }
}
