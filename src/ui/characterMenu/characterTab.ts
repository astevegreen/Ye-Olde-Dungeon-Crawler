import type { GameState } from './gameState';
import type { MenuFooter, MenuHost, MenuTab } from './menuTab';
import type { AttributeMilestoneTrigger, ChoiceDefinition, Player } from '../../engine';
import {
  HP_PER_CONSTITUTION,
  MANA_PER_INTELLIGENCE,
  RUNE_TOTAL_POINTS_CAP,
  RUNE_TRACK_MAX,
  computeChannelTime,
  computeDepthBonus,
  findRuneOfReturn,
  formatCurrency,
  getBankingRetentionPct,
  getMaxCarryWeight,
  getPlayerTotalCp,
  getTotalRuneMasteryPoints,
  rangedDexterityBonus,
  resolveManaTerms,
  statusDisplayName,
  type ManaTerms,
  type RuneOfReturnTrack,
} from '../../engine';
import {
  ATTRIBUTE_KEYS,
  AttributeAllocationDraft,
  runeRank,
  type AttributeKey,
  type PlanKey,
} from '../attributeAllocationDraft';
import { resolveBranding } from '../branding';
import { isAmbientDuration } from '../sidebar/sidebarModel';
import { escapeHtml, keyChip } from '../html';
import { formatKg } from '../units';

interface AttributeMeta {
  key: AttributeKey;
  label: string;
  letter: string;
  code: string;
  /** {mana} is filled from the pack's terms where the text is shown. */
  description: string;
  /** What the attribute does at `value`, against `value - planned` when points are planned. */
  preview: (player: Player, value: number, planned: number, mana: ManaTerms) => string;
}

const up = (text: string | number): string => `<span class="ui-up">${text}</span>`;
const fromTo = (from: string | number, to: string | number, unit = ''): string =>
  from === to ? `${to}${unit}` : `${from} → ${up(`${to}${unit}`)}`;
const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

/** Every number here comes from the engine's own formulas, so the preview is what you get. */
const ATTRIBUTES: AttributeMeta[] = [
  {
    key: 'strength',
    label: 'Strength',
    letter: 'S',
    code: 'KeyS',
    description: 'How much you can carry, and how hard a knock-back slams foes into walls.',
    preview: (_p, v, n) => `Carry ${fromTo(formatKg(getMaxCarryWeight(v - n)), formatKg(getMaxCarryWeight(v)), ' kg')}`,
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    letter: 'D',
    code: 'KeyD',
    description: 'Ranged hit chance and damage, picking locks, and spotting traps.',
    preview: (_p, v, n) => {
      const before = rangedDexterityBonus(v - n);
      const after = rangedDexterityBonus(v);
      return `Ranged hit ${fromTo(signed(before.hitPct), signed(after.hitPct), '%')} · damage ${fromTo(signed(before.damage), signed(after.damage))}`;
    },
  },
  {
    key: 'constitution',
    label: 'Constitution',
    letter: 'C',
    code: 'KeyC',
    description: `Maximum health, ${HP_PER_CONSTITUTION} per point.`,
    preview: (p, _v, n) => `Health ${fromTo(p.maxHp, p.maxHp + n * HP_PER_CONSTITUTION)}`,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    letter: 'I',
    code: 'KeyI',
    description: `Maximum {mana}, ${MANA_PER_INTELLIGENCE} per point, and spotting traps and secret doors.`,
    preview: (p, _v, n, mana) => `${mana.name} ${fromTo(p.maxMana, p.maxMana + n * MANA_PER_INTELLIGENCE)}`,
  },
];

interface RuneTrackMeta {
  track: RuneOfReturnTrack;
  name: string;
  key: string;
  code: string;
  /** The track's effect now, and after the planned ranks: "Recall in 6 → 5 turns here". */
  effect: (now: number, after: number, floor: number) => string;
}

const RUNE_TRACK_META: RuneTrackMeta[] = [
  {
    track: 'celerity',
    name: 'Channel Celerity',
    key: '1',
    code: 'Digit1',
    effect: (now, after, floor) => `Recall in ${fromTo(computeChannelTime(now, floor), computeChannelTime(after, floor))} turns here`,
  },
  {
    track: 'weave',
    name: 'Steadfast Weave',
    key: '2',
    code: 'Digit2',
    effect: (now, after) => {
      const pct = (rank: number) => Math.round(getBankingRetentionPct(rank) * 100);
      return `A broken channel keeps ${fromTo(pct(now), pct(after), '%')}`;
    },
  },
  {
    track: 'mobility',
    name: 'Unbound Casting',
    key: '3',
    code: 'Digit3',
    effect: (now, after) =>
      now > 0 ? 'You can move while channelling' : after > 0 ? up('Move while channelling') : 'Lets you move while channelling',
  },
];

/** Fills an attribute text's {mana}/{unit} placeholders with the pack's terms. */
export function fillManaTerms(text: string, mana: ManaTerms): string {
  return text.replace(/\{mana\}/g, mana.name).replace(/\{unit\}/g, mana.unit);
}

/**
 * The Character tab (ADR-0011): who you are, and the only place a level's points are
 * spent — on attributes and on Rune of Return ranks alike. Leveling up opens it.
 * Points are planned until Accept; Esc leaves the menu and keeps them unspent.
 */
export class CharacterTab implements MenuTab {
  public readonly id = 'character';
  public readonly label = 'Character';
  public readonly hotkeyActionId = 'character_menu';

  private container: HTMLElement | null = null;
  private state: GameState | null = null;
  private host?: MenuHost;
  public onAllocateCallback?: () => void;
  /** This session's planned points; nothing reaches the player until `accept()`. */
  private readonly draft = new AttributeAllocationDraft();
  /** Keys typed just before the tab opened (leveling mid-move) are dropped until then. */
  private focusRuneOnActivate = false;

  public bindHost(host: MenuHost): void {
    this.host = host;
  }

  /** The next activation scrolls the Rune of Return ranks into view and marks them. */
  public focusRuneSection(): void {
    this.focusRuneOnActivate = true;
  }

  /** "+N" on the tab while points wait to be spent. */
  public badge(state: GameState): string | null {
    const points = state.player.unspentStatPoints;
    return points > 0 ? `+${points}` : null;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.state = state;
    this.draft.clear();
    this.render();
    if (this.focusRuneOnActivate) {
      this.focusRuneOnActivate = false;
      const rune = this.container?.querySelector<HTMLElement>('.ch-rune');
      if (rune) {
        if (typeof rune.scrollIntoView === 'function') rune.scrollIntoView({ block: 'nearest' });
        rune.className += ' ui-glow';
      }
    }
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  /** Plans one point into an attribute or a rune track. */
  public allocate(key: PlanKey): boolean {
    const player = this.state?.player;
    if (!player || !this.draft.add(key, player)) return false;
    this.render();
    return true;
  }

  /** Takes back one point planned this session; locked-in points can't be removed. */
  public deallocate(key: PlanKey): boolean {
    if (!this.draft.remove(key)) return false;
    this.render();
    return true;
  }

  public undo(): boolean {
    if (!this.draft.undo()) return false;
    this.render();
    return true;
  }

  public redo(): boolean {
    const player = this.state?.player;
    if (!player || !this.draft.redo(player)) return false;
    this.render();
    return true;
  }

  public reset(): boolean {
    if (!this.draft.reset()) return false;
    this.render();
    return true;
  }

  /** Locks the planned points into the player. */
  public accept(): boolean {
    const state = this.state;
    if (!state?.player || this.draft.total === 0) return false;
    const summary = this.draft.describe();
    const spent = this.draft.commit(state.player);
    if (spent > 0) {
      state.engine.log(`Points spent: ${summary}. ${state.player.unspentStatPoints} point(s) remain.`);
      this.onAllocateCallback?.();
    }
    this.render();
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    const player = this.state?.player;
    if (!player) return false;
    const code = e.code;

    const consumed = (done: boolean): boolean => {
      if (done) e.preventDefault();
      return done;
    };

    if (code === 'Enter' || code === 'NumpadEnter') return consumed(this.accept());
    if (code === 'KeyZ' && !e.shiftKey) return consumed(this.undo());
    if (code === 'KeyY' || (code === 'KeyZ' && e.shiftKey)) return consumed(this.redo());
    if (code === 'KeyR') return consumed(this.reset());

    const attr = ATTRIBUTES.find((a) => a.code === code);
    if (attr) return consumed(e.shiftKey ? this.deallocate(attr.key) : this.allocate(attr.key));

    const rune = player.hasDiscoveredRune ? RUNE_TRACK_META.find((t) => t.code === code) : undefined;
    if (rune) return consumed(e.shiftKey ? this.deallocate(rune.track) : this.allocate(rune.track));

    return false;
  }

  public footer(): MenuFooter {
    const player = this.state?.player;
    const planned = this.draft.total;
    const keys = [
      { keys: ['S', 'D', 'C', 'I'], label: 'plan a point' },
      { keys: ['⇧'], label: '+key remove' },
      { keys: ['Z'], label: 'undo' },
    ];
    if (player?.hasDiscoveredRune) keys.splice(1, 0, { keys: ['1', '2', '3'], label: 'rune ranks' });
    return {
      keys,
      escLabel: player && player.unspentStatPoints > 0 ? 'close, keep points' : 'close',
      actions: [
        { id: 'reset', label: 'Reset', disabled: planned === 0, run: () => this.reset() },
        {
          id: 'accept',
          label: planned > 0 ? `Accept ${planned} point${planned === 1 ? '' : 's'}` : 'Accept',
          key: 'Enter',
          primary: true,
          disabled: planned === 0,
          run: () => this.accept(),
        },
      ],
    };
  }

  public render(): void {
    if (!this.container || !this.state) return;
    const player = this.state.player;
    const manifest = this.state.manifest ?? this.state.engine.manifest;
    const mana = resolveManaTerms(manifest);

    // Each plan redraws the tab; its columns keep their scroll (they jumped to the top).
    const columns = (): HTMLElement[] =>
      typeof this.container?.querySelectorAll === 'function' ? [...this.container.querySelectorAll<HTMLElement>('.ch-grid > .ui-col')] : [];
    const scrolled = columns().map((c) => c.scrollTop);

    this.container.innerHTML = `
      <div class="ui-tabgrid ch-grid">
        <div class="ui-col ui-scroll">${this.renderIdentity(player, mana)}</div>
        <div class="ui-col ui-scroll">${this.renderAllocation(player, mana)}${this.renderMilestones(player)}</div>
        <div class="ui-col ui-scroll">${this.renderDiff(player, mana)}${this.renderRune(player)}</div>
      </div>
    `;
    columns().forEach((c, i) => {
      if (scrolled[i]) c.scrollTop = scrolled[i];
    });

    if (typeof this.container.querySelectorAll === 'function') {
      this.container.querySelectorAll<HTMLButtonElement>('button[data-plan]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const key = btn.getAttribute('data-plan') as PlanKey | null;
          if (!key) return;
          if (btn.getAttribute('data-op') === 'remove') this.deallocate(key);
          else this.allocate(key);
        });
      });
    }
    this.host?.refreshChrome();
  }

  private manifest(): GameState['manifest'] {
    return this.state!.manifest ?? this.state!.engine.manifest;
  }

  private renderIdentity(player: Player, mana: ManaTerms): string {
    const branding = resolveBranding(this.manifest());
    const floor = this.state!.currentFloor;
    const difficulty = player.difficulty ?? 'medium';
    const xpPct = Math.min(100, (100 * player.xp) / Math.max(1, player.xpToNextLevel));
    const actionCost = player.getActionCost(100);
    const speed = actionCost === 100 ? 'normal' : actionCost > 100 ? 'slowed' : 'hastened';
    const gear = (total: number, base: number): string =>
      total === base ? `${total}` : `${total} <span class="ui-faint">(${base} ${total > base ? '+' : '−'} gear)</span>`;
    const resistances = Object.entries(player.elementalResistances)
      .filter(([, affinity]) => affinity && affinity !== 'neutral')
      .map(([element, affinity]) => `${escapeHtml(element)} ${escapeHtml(String(affinity))}`);
    const conditions = player.statusManager
      .getAll()
      .map((eff) => {
        const name = statusDisplayName(this.manifest(), eff.type);
        return escapeHtml(isAmbientDuration(eff.duration) ? name : `${name} (${eff.duration} turns)`);
      });

    return `
      <div class="ui-card">
        <div class="ch-name">${escapeHtml(player.name)}</div>
        <div class="ui-muted">Level <span class="ui-num">${player.level}</span> · ${escapeHtml(difficulty.charAt(0).toUpperCase() + difficulty.slice(1))}</div>
        <div class="ch-xp ui-note"><span>${escapeHtml(branding.xpName)}</span><span class="ui-num">${player.xp} / ${player.xpToNextLevel}</span></div>
        <div class="ui-bar"><i style="width: ${xpPct.toFixed(1)}%; background: var(--ui-xp)"></i></div>
      </div>
      <div class="ui-card">
        <div class="ui-h">Vitals</div>
        <dl class="ui-kv">
          <dt>Health</dt><dd class="ui-num">${player.hp} / ${player.maxHp}</dd>
          <dt>${escapeHtml(mana.name)}</dt><dd class="ui-num">${player.mana} / ${player.maxMana}</dd>
          <dt>Attack</dt><dd class="ui-num">${gear(player.attack, player.baseAttackValue)}</dd>
          <dt>Defense</dt><dd class="ui-num">${gear(player.defense, player.baseDefenseValue)}</dd>
          <dt>Load</dt><dd class="ui-num">${formatKg(player.inventory.totalWeight())} / ${formatKg(getMaxCarryWeight(player.strength))} kg</dd>
          <dt>Speed</dt><dd>${speed}</dd>
          <dt>Purse</dt><dd class="ui-num">${escapeHtml(formatCurrency(getPlayerTotalCp(player)))}</dd>
          <dt>Depth</dt><dd>${floor === 0 ? escapeHtml(branding.townName) : `Floor <span class="ui-num">${floor}</span>`}</dd>
        </dl>
      </div>
      <div class="ui-card">
        <div class="ui-h">Resistances</div>
        <div class="ui-muted">${resistances.length > 0 ? resistances.join(', ') : 'None yet. Some armor and potions grant them.'}</div>
        ${conditions.length > 0 ? `<div class="ui-h ch-subh">Conditions</div><div class="ui-muted">${conditions.join(', ')}</div>` : ''}
      </div>
    `;
  }

  private renderAllocation(player: Player, mana: ManaTerms): string {
    const remaining = this.draft.remaining(player);
    const planned = this.draft.total;
    const banner =
      player.unspentStatPoints > 0
        ? `<div class="ch-points"><b class="ui-num">${remaining}</b><div><div class="ch-points-title">point${remaining === 1 ? '' : 's'} left to spend</div>
             <div class="ui-note">${planned > 0 ? `${planned} planned. ` : ''}Nothing is spent until you accept, and you can undo freely.</div></div></div>`
        : `<div class="ch-points is-empty"><b class="ui-num">0</b><div><div class="ch-points-title">points to spend</div>
             <div class="ui-note">You earn more each time you level up.</div></div></div>`;

    const rows = ATTRIBUTES.map((meta) => {
      const n = this.draft.get(meta.key);
      const value = player[meta.key] + n;
      return `
        <div class="ch-attr">
          <span class="ch-attr-key">${meta.letter}</span>
          <div class="ch-attr-main">
            <div><span class="ch-attr-name">${meta.label}</span> <span class="ch-attr-val ui-num">${player[meta.key]}</span>${n > 0 ? ` ${up(`+${n}`)}` : ''}</div>
            <div class="ui-note">${escapeHtml(fillManaTerms(meta.description, mana))}</div>
            <div class="ch-attr-prev ui-num">${meta.preview(player, value, n, mana)}</div>
          </div>
          <div class="ch-ctl">${this.renderStepper(meta.key, n, this.draft.canAdd(meta.key, player), meta.label)}</div>
        </div>`;
    }).join('');

    return `${banner}<div class="ui-card ch-attrs">${rows}</div>`;
  }

  private renderStepper(key: PlanKey, planned: number, canAdd: boolean, label: string): string {
    return `
      <button type="button" class="ch-pm" data-plan="${key}" data-op="remove" ${planned > 0 ? '' : 'disabled'} aria-label="Remove a planned point from ${label}">−</button>
      <span class="ch-planned ui-num">${planned > 0 ? `+${planned}` : ''}</span>
      <button type="button" class="ch-pm is-add" data-plan="${key}" data-op="add" ${canAdd ? '' : 'disabled'} aria-label="Plan a point in ${label}">+</button>`;
  }

  private renderMilestones(player: Player): string {
    const manifest = this.manifest();
    const milestones: AttributeMilestoneTrigger[] = manifest?.attributeMilestones ?? [];
    if (milestones.length === 0) return '';
    const flags = this.state!.worldState?.flags ?? {};
    const items = milestones
      .map((m) => {
        const offered = Boolean(flags[`${m.id}_offered`]);
        const current = player[m.attribute] ?? 0;
        const ready = !offered && current >= m.threshold;
        const [cls, tag] = offered ? ['is-done', 'Unlocked'] : ready ? ['is-ready', 'Ready'] : ['', 'Locked'];
        const choice: ChoiceDefinition | undefined = manifest?.choices?.[m.choiceId];
        const title = choice ? choice.title : m.id.replace(/_/g, ' ');
        const attrLabel = m.attribute.charAt(0).toUpperCase() + m.attribute.slice(1);
        const detail = offered
          ? `Reached ${m.threshold}.`
          : ready
          ? 'Ready: the choice comes on your next step.'
          : `Progress: ${current} / ${m.threshold}`;
        return `
          <div class="ch-milestone ${cls}">
            <div class="ch-milestone-head"><span>${attrLabel} ≥ ${m.threshold}: ${escapeHtml(title)}</span><span class="ch-tag">${tag}</span></div>
            <div class="ui-note">${detail}</div>
            ${choice ? `<div class="ui-note ui-faint">Choices: ${choice.options.map((o) => escapeHtml(o.label)).join(' · ')}</div>` : ''}
          </div>`;
      })
      .join('');
    return `<div class="ui-card"><div class="ui-h">Milestones</div>${items}</div>`;
  }

  /** "If you accept": before → after for everything the plan changes. */
  private renderDiff(player: Player, mana: ManaTerms): string {
    const rows: Array<[string, string | number, string | number, string?]> = [];
    for (const key of ATTRIBUTE_KEYS) {
      const n = this.draft.get(key);
      if (n > 0) rows.push([ATTRIBUTES.find((a) => a.key === key)!.label, player[key], player[key] + n]);
    }
    const con = this.draft.get('constitution');
    if (con > 0) rows.push(['Max health', player.maxHp, player.maxHp + con * HP_PER_CONSTITUTION]);
    const int = this.draft.get('intelligence');
    if (int > 0) rows.push([`Max ${mana.name}`, player.maxMana, player.maxMana + int * MANA_PER_INTELLIGENCE]);
    const str = this.draft.get('strength');
    if (str > 0) {
      rows.push(['Carry limit', formatKg(getMaxCarryWeight(player.strength)), formatKg(getMaxCarryWeight(player.strength + str)), ' kg']);
    }
    const dex = this.draft.get('dexterity');
    if (dex > 0) {
      const hit = (d: number) => signed(rangedDexterityBonus(d).hitPct);
      rows.push(['Ranged hit', hit(player.dexterity), hit(player.dexterity + dex), '%']);
    }
    for (const meta of RUNE_TRACK_META) {
      const n = this.draft.get(meta.track);
      if (n > 0) rows.push([`${meta.name} rank`, runeRank(player, meta.track), runeRank(player, meta.track) + n]);
    }

    const body =
      rows.length > 0
        ? `<dl class="ui-kv ch-diff">${rows
            .map(([label, from, to, unit = '']) => `<dt>${escapeHtml(label)}</dt><dd class="ui-num"><span class="ui-faint">${from} →</span> ${up(`${to}${unit}`)}</dd>`)
            .join('')}</dl>`
        : `<div class="ui-note">Plan a point to see what it changes.</div>`;
    return `<div class="ui-card"><div class="ui-h">If you accept</div>${body}</div>`;
  }

  /** The Rune of Return ranks, which spend the same points. */
  private renderRune(player: Player): string {
    if (!player.hasDiscoveredRune) return '';
    const floor = this.state!.currentFloor;
    const branding = resolveBranding(this.manifest());
    const rune = findRuneOfReturn(player);
    const tracks = RUNE_TRACK_META.map((meta) => {
      const rank = runeRank(player, meta.track);
      const n = this.draft.get(meta.track);
      const max = RUNE_TRACK_MAX[meta.track];
      const after = rank + n;
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : i < after ? 'plan' : ''}"></i>`).join('');
      // With nothing planned, show what the next rank would do.
      const target = n > 0 || rank >= max ? after : rank + 1;
      const note = rank >= max ? `${meta.effect(rank, rank, floor)} · fully learned` : meta.effect(rank, target, floor);
      return `
        <div class="ch-track">
          <div class="ch-track-main">
            <div class="ch-track-name">${keyChip(meta.key)} ${meta.name}</div>
            <div class="ui-note${n === 0 ? ' is-next' : ''}">${note}</div>
          </div>
          <div class="ch-pips" title="Rank ${rank} of ${max}">${pips}</div>
          <div class="ch-ctl">${this.renderStepper(meta.track, n, this.draft.canAdd(meta.track, player), meta.name)}</div>
        </div>`;
    }).join('');
    const depth = computeDepthBonus(floor);
    // From the dungeon a recall goes to town; from town, back to the floor it left (the anchor).
    const destination =
      floor > 0 ? escapeHtml(branding.townName) : player.deepestRecallFloor ? `Floor ${player.deepestRecallFloor}` : 'nowhere yet: no anchor';
    return `
      <div class="ui-card ch-rune">
        <div class="ui-h">Also spends points <small>Rune of Return</small></div>
        ${tracks}
        <dl class="ui-kv ch-rune-facts">
          <dt>Charges</dt><dd class="ui-num">${rune ? `${rune.charges} / ${rune.maxCharges}` : '0'}</dd>
          <dt>Channel here</dt><dd class="ui-num">${computeChannelTime(runeRank(player, 'celerity'), floor)} turns${depth > 0 ? ` <span class="ui-faint">(+${depth} for depth)</span>` : ''}</dd>
          <dt>Recalls to</dt><dd>${destination}</dd>
          <dt>Ranks learned</dt><dd class="ui-num">${getTotalRuneMasteryPoints(player.runeMastery)} / ${RUNE_TOTAL_POINTS_CAP}</dd>
        </dl>
        <div class="ui-note">Charges refill free at ${escapeHtml(branding.runeSmithName)}.</div>
      </div>`;
  }
}
