import {
  type GameEngine,
  MonsterRegistry,
  type MonsterDefinition,
  type MonsterMasteryTier,
  masteryPerkOptions,
  type MasteryScope,
  SPECIES_MASTERY_KILLS,
  getMonsterCategory,
  type KillRiteDefinition,
  selectMasteryPerk,
  resolveManaTerms,
  getSpell,
  scaleMonsterStats,
} from '../../engine';
import type { GameState } from './gameState';
import type { MenuFooter, MenuTab } from './menuTab';
import { fillManaTerms } from './characterTab';
import { resolveBranding } from '../branding';
import { escapeHtml } from '../html';

type BestiaryFilter = 'all' | 'discovered' | 'mastered';

/** How each of the engine's own AI behaviors reads to a player; a pack's own behavior is left unsaid. */
const BEHAVIOR_WORDS: Record<string, string> = {
  melee: 'fights up close',
  brute: 'charges in',
  caster: 'casts from afar',
  coward: 'flees when hurt',
  immobile_turret: 'holds its ground',
};
const FILTERS: BestiaryFilter[] = ['all', 'discovered', 'mastered'];

/** What the tab is handed by the composition root: `src/ui` cannot draw atlas sprites itself. */
export interface BestiaryTabOptions {
  /** Paints a creature's picture from its definition (the map's art for it, tracker 4.2). */
  drawMonsterPicture?: (canvas: HTMLCanvasElement, def: MonsterDefinition) => void;
  /** Whether the pack paints portraits: the picture then shows at 192 px, one pixel per pixel. */
  largePicture?: () => boolean;
}

/** What each knowledge rank is called on its tag. */
const TIER_TAG: Record<MonsterMasteryTier, string> = { 0: '?', 1: 'Seen', 2: 'Slain', 3: 'Studied' };

/**
 * The Bestiary tab (ADR-0011): every creature, known ones first, with a legend for the
 * rank tags, and the selected creature's mastery, traits and kill rite beside the list.
 */
export class BestiaryTab implements MenuTab {
  public readonly id = 'bestiary';
  public readonly label = 'Bestiary';
  public readonly material = 'codex' as const;
  public readonly hotkeyActionId = 'compendium';

  private container: HTMLElement | null = null;
  private engine?: GameEngine;
  private filter: BestiaryFilter = 'all';
  private selectedId = '';

  constructor(private readonly options: BestiaryTabOptions = {}) {}

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.engine = state.engine;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private allMonsters(): MonsterDefinition[] {
    const engine = this.engine;
    const fromManifest = engine?.manifest?.monsters;
    return (
      engine?.registries?.monsters?.getAll() ??
      (fromManifest ? (Array.isArray(fromManifest) ? fromManifest : Object.values(fromManifest)) : MonsterRegistry.getAll())
    );
  }

  /** The list as shown: the filter applied, creatures you know first, unknown ones last. */
  private listed(): MonsterDefinition[] {
    const compendium = this.engine?.compendium;
    if (!compendium) return this.allMonsters();
    const tier = (m: MonsterDefinition) => compendium.getTier(m.id);
    const shown = this.allMonsters().filter((m) =>
      this.filter === 'discovered' ? tier(m) >= 1 : this.filter === 'mastered' ? tier(m) === 3 : true
    );
    return [...shown.filter((m) => tier(m) > 0), ...shown.filter((m) => tier(m) === 0)];
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const list = this.listed();
      const i = list.findIndex((m) => m.id === this.selectedId);
      const next = e.code === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1);
      if (list[next]) this.selectedId = list[next].id;
      e.preventDefault();
      this.render();
      return true;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const step = e.code === 'ArrowRight' ? 1 : FILTERS.length - 1;
      this.filter = FILTERS[(FILTERS.indexOf(this.filter) + step) % FILTERS.length];
      e.preventDefault();
      this.render();
      return true;
    }
    return false;
  }

  public footer(): MenuFooter {
    return {
      keys: [
        { keys: ['↑', '↓'], label: 'choose' },
        { keys: ['←', '→'], label: 'filter' },
      ],
    };
  }

  public render(): void {
    if (!this.container || !this.engine) return;
    const compendium = this.engine.compendium;
    const all = this.allMonsters();
    const list = this.listed();
    if (!list.some((m) => m.id === this.selectedId) && list.length > 0) this.selectedId = list[0].id;
    const selected = list.find((m) => m.id === this.selectedId);

    const discovered = all.filter((m) => compendium.getTier(m.id) >= 1).length;
    const mastered = all.filter((m) => compendium.getTier(m.id) === 3).length;
    const counts: Record<BestiaryFilter, number> = { all: all.length, discovered, mastered };
    const labels: Record<BestiaryFilter, string> = { all: 'All', discovered: 'Known', mastered: 'Studied' };

    const rows = list
      .map((m) => {
        const entry = compendium.getEntry(m.id);
        const known = entry.tier > 0;
        return `
          <button type="button" class="bs-row${m.id === this.selectedId ? ' is-selected' : ''}${known ? '' : ' is-unknown'}" data-id="${escapeHtml(m.id)}">
            <span class="bs-name">${known ? escapeHtml(m.name) : 'Unknown creature'}</span>
            ${known ? this.tierTag(entry.tier, entry.kills) : ''}
          </button>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="ui-tabgrid bs-grid">
        <div class="ui-col">
          <div class="ui-h">Bestiary <small>${escapeHtml(resolveBranding(this.engine.manifest).worldName)}</small></div>
          <div class="bs-counts ui-note">Known <b class="ui-num">${discovered}/${all.length}</b> · Studied <b class="ui-num">${mastered}/${all.length}</b></div>
          <div class="st-subtabs" role="tablist">${FILTERS.map(
            (f) => `<button type="button" role="tab" class="st-subtab" data-filter="${f}" aria-selected="${this.filter === f}">${labels[f]} <span class="ui-num">${counts[f]}</span></button>`
          ).join('')}</div>
          <div class="ui-inset bs-list ui-scroll" role="listbox">${rows || '<div class="ui-note bs-empty">Nothing here yet.</div>'}</div>
          <div class="bs-legend ui-note">
            ${this.tierTag(1, 0)} you have seen it · ${this.tierTag(2, 3)} kills so far · ${this.tierTag(3, SPECIES_MASTERY_KILLS)} ${SPECIES_MASTERY_KILLS} kills: its page is complete. Perks come from mastering a whole family.
          </div>
        </div>
        <div class="ui-col ui-scroll bs-detail">${selected ? this.renderDetail(selected) : ''}</div>
      </div>`;

    this.bind();
    if (selected) this.paintPicture(selected);
  }

  /** The picture's canvas: the 64 px sprite doubled by CSS, or a 192 px portrait drawn 1:1. */
  private pictureHtml(): string {
    if (!this.options.drawMonsterPicture) return '';
    return this.options.largePicture?.()
      ? '<canvas class="bs-portrait is-large" width="192" height="192" aria-hidden="true"></canvas>'
      : '<canvas class="bs-portrait" width="64" height="64" aria-hidden="true"></canvas>';
  }

  /** The selected creature's picture, once it has been seen: the unknown keep their "?". */
  private paintPicture(def: MonsterDefinition): void {
    const canvas = this.container?.querySelector?.<HTMLCanvasElement>('canvas.bs-portrait');
    if (canvas) this.options.drawMonsterPicture?.(canvas, def);
  }

  /** A spell's name, never its id. */
  private spellName(id: string): string {
    return (this.engine!.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id))?.name ?? id.replace(/_/g, ' ');
  }

  private tierTag(tier: MonsterMasteryTier, kills: number): string {
    const text = tier === 2 ? `${TIER_TAG[2]} ${kills}` : tier === 3 ? `${TIER_TAG[3]} ★` : TIER_TAG[tier];
    return `<span class="bs-tag is-t${tier}">${text}</span>`;
  }

  private bind(): void {
    const root = this.container;
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll<HTMLElement>('[data-id]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selectedId = row.getAttribute('data-id') ?? this.selectedId;
        this.render();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filter = (btn.getAttribute('data-filter') as BestiaryFilter) ?? this.filter;
        this.render();
      });
    });
    root.querySelectorAll<HTMLElement>('.btn-select-perk').forEach((btn) => {
      btn.addEventListener('click', () => {
        const perkId = btn.getAttribute('data-perk');
        const scope = btn.getAttribute('data-scope') as MasteryScope | null;
        const masteryId = btn.getAttribute('data-mastery');
        if (perkId && scope && masteryId && this.engine) {
          selectMasteryPerk(this.engine, scope, masteryId, perkId);
          this.render();
        }
      });
    });
  }

  /** What is known of one creature: kills toward the complete page (knowledge rank 3), which
   *  Study at the sage can also buy (tracker 4.1). */
  private renderKnowledgePanel(def: MonsterDefinition, kills: number, tier: MonsterMasteryTier): string {
    const needed = SPECIES_MASTERY_KILLS;
    const complete = tier === 3;
    const pct = Math.round((Math.min(kills, needed) / needed) * 100);
    return `
      <div class="ui-card bs-mastery${complete ? ' is-unlocked' : ''}">
        <div class="bs-mastery-head"><b>${complete ? '★ ' : ''}${escapeHtml(def.name)}: knowledge</b><span class="ui-num">${kills}/${needed} Kills (${pct}%)</span></div>
        <div class="ui-bar bs-bar"><i style="width: ${complete ? 100 : pct}%"></i></div>
        <div class="ui-note">${complete ? 'Studied: its page shows everything.' : `Slay ${needed - kills} more to complete its page: exact health, attack and defense, spells, drops and worth.`}</div>
      </div>`;
  }

  /** Progress bar plus the perk picker for a family's mastery. */
  private renderMasteryPanel(opts: {
    scope: MasteryScope;
    masteryId: string;
    title: string;
    subject: string;
    kills: number;
    needed: number;
    perk?: string;
    note?: string;
  }): string {
    // The shared five and the family's own (tracker 3.6).
    const options = masteryPerkOptions(this.engine?.manifest, opts.masteryId);
    const unlocked = opts.kills >= opts.needed;
    const pct = Math.round((Math.min(opts.kills, opts.needed) / opts.needed) * 100);
    const inTown = (this.engine?.currentFloor ?? 1) === 0;
    const mana = resolveManaTerms(this.engine?.manifest);

    const picker = unlocked
      ? `
        <div class="ui-note bs-perk-rule">${
          inTown
            ? 'In town: you may freely choose or switch perks.'
            : opts.perk
            ? 'In the dungeon your perk is locked. Return to Town to change it.'
            : 'Mastery earned: pick your perk below.'
        }</div>
        ${options
          .map((perk) => {
            const active = opts.perk === perk.id;
            const canSelect = inTown || !opts.perk;
            return `
              <div class="bs-perk${active ? ' is-active' : ''}">
                <div>
                  <div><b>${escapeHtml(perk.name)}</b>${perk.tagline ? ` <span class="ui-faint">— ${escapeHtml(perk.tagline)}</span>` : ''}</div>
                  <div class="ui-note">${escapeHtml(fillManaTerms(perk.description, mana))}</div>
                </div>
                ${
                  active
                    ? '<span class="bs-tag is-t3">Active</span>'
                    : canSelect
                    ? `<button type="button" class="ui-btn ui-btn--sm btn-select-perk" data-scope="${opts.scope}" data-mastery="${escapeHtml(opts.masteryId)}" data-perk="${perk.id}">Select</button>`
                    : '<span class="ui-note ui-faint">Locked in the dungeon</span>'
                }
              </div>`;
          })
          .join('')}`
      : `<div class="ui-note">Slay ${opts.needed - opts.kills} more to master ${escapeHtml(opts.subject)} and choose a perk: ${options
          .map((p) => `<b>${escapeHtml(p.name)}</b>`)
          .join(', ')}.</div>`;

    return `
      <div class="ui-card bs-mastery${unlocked ? ' is-unlocked' : ''}">
        <div class="bs-mastery-head"><b>${unlocked ? '★ ' : ''}${escapeHtml(opts.title)}</b><span class="ui-num">${opts.kills}/${opts.needed} Kills (${pct}%)</span></div>
        ${opts.note ? `<div class="ui-note ui-faint">${escapeHtml(opts.note)}</div>` : ''}
        <div class="ui-bar bs-bar"><i style="width: ${pct}%"></i></div>
        ${picker}
      </div>`;
  }

  private renderDetail(def: MonsterDefinition): string {
    const compendium = this.engine!.compendium;
    const entry = compendium.getEntry(def.id);
    const tier = entry.tier;
    if (tier === 0) {
      return `
        <div class="ui-card bs-unknown">
          <div class="bs-unknown-mark">?</div>
          <div class="bs-title">Unknown creature</div>
          <div class="ui-note">You have not seen this creature yet. Its page fills in once you meet it in the dungeon.</div>
        </div>`;
    }
    const category = getMonsterCategory(this.engine!, def.id);
    const speedWord = def.speed > 100 ? 'Fast' : def.speed < 100 ? 'Sluggish' : 'Normal';
    const xpName = resolveBranding(this.engine!.manifest).xpName;
    // Numbers as the creature is met on its home floor, at this run's difficulty (Q11 "A").
    const home = def.minFloor ?? 1;
    const scaled = scaleMonsterStats(def, Math.max(1, home), undefined, undefined, this.engine!.manifest?.monsterScaling, this.engine!.player.difficulty);

    const vitality =
      tier >= 3
        ? `<dt>Max health</dt><dd class="ui-num">${scaled.maxHp}</dd><dt>Speed</dt><dd class="ui-num">${def.speed}</dd><dt>Attack / Defense</dt><dd class="ui-num">${scaled.attack} / ${scaled.defense}</dd>`
        : tier >= 2
        ? `<dt>Health</dt><dd class="ui-num">about ${Math.round(scaled.maxHp * 0.8)}–${Math.round(scaled.maxHp * 1.2)}</dd><dt>Speed</dt><dd>${speedWord} <span class="ui-num ui-faint">(${def.speed})</span></dd><dt>Threat</dt><dd>Tier ${Math.ceil((def.minFloor ?? 1) / 10) || 1}</dd>`
        : `<dt>Speed</dt><dd>${speedWord}</dd><dt>Threat</dt><dd class="ui-faint">Slay one to learn more</dd>`;

    const resistances = Object.entries(def.resistances ?? {}).filter(([, aff]) => Boolean(aff));
    const statsNote = tier >= 2 ? `<div class="ui-note ui-faint">As met on floor <span class="ui-num">${home}</span>; deeper, it is stronger.</div>` : '';
    const affinities =
      tier >= 2
        ? resistances.length > 0
          ? resistances.map(([el, aff]) => `<dt>${escapeHtml(el)}</dt><dd class="bs-aff is-${escapeHtml(String(aff))}">${escapeHtml(String(aff))}</dd>`).join('')
          : '<dt>None</dt><dd class="ui-faint">no special weakness</dd>'
        : '<dt class="ui-faint">Slay one to learn its weaknesses</dt><dd></dd>';

    const abilities =
      tier >= 3
        ? `<dt>Spells</dt><dd>${def.spells && def.spells.length > 0 ? escapeHtml(def.spells.map((id) => this.spellName(id)).join(', ')) : 'melee only'}</dd>
           <dt>On hit</dt><dd>${def.onHitAffliction ? `${escapeHtml(def.onHitAffliction.type)} (${Math.round(def.onHitAffliction.chance * 100)}%)` : 'nothing'}</dd>
           <dt>Drops</dt><dd class="ui-num">${def.lootTable.length} possible items</dd>
           <dt>${escapeHtml(xpName)}</dt><dd class="ui-num">${scaled.xpValue}</dd>`
        : tier >= 2
        ? `<dt>On hit</dt><dd>${def.onHitAffliction ? escapeHtml(def.onHitAffliction.type) : 'nothing known'}</dd><dt>Carries</dt><dd>gold and gear</dd>`
        : '<dt class="ui-faint">Defeat it to learn its techniques and drops</dt><dd></dd>';

    return `
      <div class="ui-card">
        <div class="bs-hero">
          ${this.pictureHtml()}
          <div class="bs-hero-text">
            <div class="bs-head"><span class="bs-title">${escapeHtml(def.name)}</span>${this.tierTag(tier, entry.kills)}</div>
            <div class="ui-note">From floor <span class="ui-num">${def.minFloor ?? 1}</span>${BEHAVIOR_WORDS[def.aiType] ? ` · ${BEHAVIOR_WORDS[def.aiType]}` : ''}</div>
          </div>
        </div>
      </div>
      ${this.renderKnowledgePanel(def, entry.kills, tier)}
      ${
        category
          ? this.renderMasteryPanel({
              scope: 'category',
              masteryId: category.id,
              title: `${category.name} (Family)`,
              subject: `every creature of ${category.name}`,
              kills: compendium.getCategoryKills(category),
              needed: category.masteryKills,
              perk: compendium.getCategoryPerk(category.id),
              note: category.description,
            })
          : ''
      }
      <div class="bs-traits">
        <div class="ui-card"><div class="ui-h">Vitality</div><dl class="ui-kv">${vitality}</dl>${statsNote}</div>
        <div class="ui-card"><div class="ui-h">Affinities</div><dl class="ui-kv">${affinities}</dl></div>
      </div>
      <div class="ui-card"><div class="ui-h">Abilities and drops</div><dl class="ui-kv">${abilities}</dl></div>
      ${this.renderKillRite(def)}`;
  }

  /** Plain-language conditions of a kill rite, in the order they are revealed. */
  private riteConditions(rite: KillRiteDefinition): string[] {
    const conditions: string[] = [];
    if (rite.requiredDamageElement) conditions.push(`Killing blow: <b>${escapeHtml(rite.requiredDamageElement)}</b> damage`);
    if (rite.requiredVictimStatus) conditions.push(`It must be: <b>${escapeHtml(rite.requiredVictimStatus)}</b>`);
    if (rite.requiresOverkillPercent) {
      conditions.push(`The blow exceeds its remaining health by <b>${rite.requiresOverkillPercent}% of its maximum</b>`);
    }
    if (rite.requiresCasterDebt) conditions.push(`You carry <b>${escapeHtml(this.engine?.manifest?.magic?.overflow?.debtName ?? 'debt')}</b>`);
    if (rite.maxCasterHpPercent !== undefined) conditions.push(`Your health is at most <b>${rite.maxCasterHpPercent}%</b>`);
    return conditions;
  }

  private renderKillRite(def: MonsterDefinition): string {
    const config = this.engine?.manifest?.magic?.killRites;
    const rite = def.killRite;
    if (!config || !rite) return '';

    const compendium = this.engine!.compendium;
    const performed = Boolean(compendium.isKillRitePerformed(def.id));
    const conditions = this.riteConditions(rite);
    const known = this.engine!.player.spellsKnown ?? [];
    const spellName = rite.teachesSpellId ? this.spellName(rite.teachesSpellId) : undefined;
    const essenceId = config.essenceItems[rite.essenceElement];
    const essenceName = this.engine!.manifest?.items?.find((i) => i.id === essenceId)?.name ?? `${rite.essenceElement} essence`;
    const yields =
      spellName && !known.includes(rite.teachesSpellId!)
        ? `Teaches <b>${escapeHtml(spellName)}</b>`
        : `Yields <b>${escapeHtml(essenceName)}</b>${spellName ? ` (you know ${escapeHtml(spellName)})` : ''}`;
    const list = (items: string[]) => items.map((c) => `<div class="bs-cond">• ${c}</div>`).join('');

    if (performed) {
      return `
        <div class="ui-card bs-rite is-done">
          <div class="bs-mastery-head"><b>${escapeHtml(config.title)}</b><span class="bs-tag is-t3">${escapeHtml(config.reapedLabel)}</span></div>
          <div class="ui-note">${yields}</div>
          <div class="ui-note"><b>The rite:</b>${list(conditions)}</div>
        </div>`;
    }

    // Before the rite is performed, each few kills reveal one condition in plain words.
    const perCondition = Math.max(1, config.killsPerRevealedCondition ?? Number.POSITIVE_INFINITY);
    const revealed = conditions.slice(0, Math.floor(compendium.getEntry(def.id).kills / perCondition));
    const hidden = conditions.length - revealed.length;
    return `
      <div class="ui-card bs-rite">
        <div class="bs-mastery-head"><b>${escapeHtml(config.title)}: ${escapeHtml(config.prophecyLabel)}</b></div>
        <div class="bs-verse">“${escapeHtml(rite.hintVerse)}”</div>
        <div class="ui-note">${yields}</div>
        ${revealed.length > 0 ? `<div class="ui-note"><b>Learned from your kills:</b>${list(revealed)}</div>` : ''}
        ${hidden > 0 && Number.isFinite(perCondition) ? `<div class="ui-note ui-faint">${hidden} more condition${hidden > 1 ? 's' : ''} hidden; each ${perCondition} kills reveal one.</div>` : ''}
      </div>`;
  }
}
