import {
  forgedElements,
  forgedTitle,
  getOverflowConfig,
  getOverflowTier,
  getSpell,
  heroCastPreview,
  resolveManaTerms,
  type GameEngine,
  type Player,
  type SpellDefinition,
} from '../../engine';
import type { GameState } from './gameState';
import type { MenuFooter, MenuTab } from './menuTab';
import { escapeHtml, keyChip } from '../html';
import { spellPower } from '../spellPower';
import { resolveBranding } from '../branding';
import { GRIMOIRE_INFO_DEFAULT, castFromSlot, renderGrimoires } from './spellbookGrimoires';

export interface SpellbookTabOptions {
  onCastSpell: (spell: SpellDefinition) => void;
  onQuickSpellsChanged: () => void;
  /** Three-grimoire model: put a spell in a slot (or move it there); a player action. */
  onPlaceGrimoireSpell: (spellId: string, grimoireId: string, x: number, y: number) => void;
  /** Three-grimoire model: forget a spell for the rest of the run; a player action. */
  onForgetSpell: (spellId: string) => void;
  /** Three-grimoire model: choose the stat of a grimoire axis that has none. */
  onPickGrimoireStat: (grimoireId: string, axis: 'x' | 'y', statId: string) => void;
  /** Reopen the card for a spell offered while every slot was full; `onClosed` runs when it closes. */
  onOpenSpellOffer: (spellId: string, onClosed: () => void) => void;
}

const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * The Spellbook tab (ADR-0011): the spells you know, the selected one's details and
 * quickbar slot, and the three grimoires for packs that have them. Enter casts.
 */
export class SpellbookTab implements MenuTab {
  public readonly id = 'spellbook';
  public readonly label = 'Spellbook';
  public readonly material = 'codex' as const;
  public readonly hotkeyActionId = 'cast_spell';

  private readonly options: SpellbookTabOptions;
  private container: HTMLElement | null = null;
  private engine?: GameEngine;
  private spells: SpellDefinition[] = [];
  private selectedIndex = 0;
  /** The three-grimoire model's slot descriptions, by "x,y", and the grimoire on show. */
  private grimoireSlotInfo: Record<string, string> = {};
  private activeGrimoireId: string | undefined;
  /** The spell whose Forget button has been pressed once, awaiting its confirmation. */
  private confirmForget: string | null = null;

  constructor(options: Partial<SpellbookTabOptions> = {}) {
    this.options = {
      onCastSpell: () => {},
      onQuickSpellsChanged: () => {},
      onPlaceGrimoireSpell: () => {},
      onForgetSpell: () => {},
      onPickGrimoireStat: () => {},
      onOpenSpellOffer: () => {},
      ...options,
    };
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.engine = state.engine;
    this.reloadSpells();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  /** The spell under the cursor. */
  public get selectedSpell(): SpellDefinition | undefined {
    return this.spells[this.selectedIndex];
  }

  public castSelected(): boolean {
    const spell = this.selectedSpell;
    if (!spell) return false;
    this.options.onCastSpell(spell);
    return true;
  }

  /** Rebuilds the list from what the hero knows now (after a card taught or dropped a spell). */
  private reloadSpells(): void {
    if (!this.engine) return;
    this.spells = this.engine.player.spellsKnown
      .map((id) => this.engine!.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id))
      .filter((s): s is SpellDefinition => Boolean(s));
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.spells.length - 1));
    this.render();
  }

  /** Puts the selected spell on a quickbar slot, or takes it off if it is already there. */
  public assignToSlot(slotIndex: number): boolean {
    const spell = this.selectedSpell;
    const player = this.engine?.player;
    if (!spell || !player) return false;
    player.setQuickSpell(slotIndex, player.quickSpells[slotIndex] === spell.id ? null : spell.id);
    this.options.onQuickSpellsChanged();
    this.render();
    return true;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const code = e.code;
    const move = (step: number): boolean => {
      if (this.spells.length > 0) {
        this.selectedIndex = (this.selectedIndex + step + this.spells.length) % this.spells.length;
        this.render();
      }
      e.preventDefault();
      return true;
    };
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyK' || code === 'Numpad8') return move(-1);
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'KeyJ' || code === 'Numpad2') return move(1);
    // Top-row digits assign a quickbar slot (never the numpad, which moves)
    if (/^Digit\d$/.test(code)) {
      const digit = Number(code.slice(5));
      e.preventDefault();
      this.assignToSlot(digit === 0 ? 9 : digit - 1);
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      e.preventDefault();
      return this.castSelected();
    }
    return false;
  }

  public footer(): MenuFooter {
    const spell = this.selectedSpell;
    return {
      keys: [
        { keys: ['↑', '↓'], label: 'choose' },
        { keys: ['1', '–', '0'], label: 'quickbar slot' },
      ],
      actions: [{ id: 'cast', label: spell ? `Cast ${spell.name}` : 'Cast', key: 'Enter', primary: true, disabled: !spell, run: () => this.castSelected() }],
    };
  }

  public render(): void {
    if (!this.container || !this.engine) return;
    const player = this.engine.player;
    let side = '';
    if (player.grimoireSystem) {
      const view = renderGrimoires(this.engine, player, this.selectedSpell, this.activeGrimoireId);
      this.activeGrimoireId = view.grimoireId;
      this.grimoireSlotInfo = view.slotInfo;
      side = `<div class="ui-col ui-scroll">${view.html}</div>`;
    }
    this.container.innerHTML = `
      <div class="ui-tabgrid sb-grid${side ? ' has-grimoire' : ''}">
        <div class="ui-col">${this.renderList(player)}</div>
        <div class="ui-col ui-scroll">${this.renderDetail(player)}${this.renderFusions(player)}</div>
        ${side}
      </div>`;
    this.bind();
  }

  private bind(): void {
    const root = this.container;
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll<HTMLElement>('[data-spell-index]').forEach((row) => {
      row.addEventListener('click', () => {
        this.selectedIndex = Number(row.getAttribute('data-spell-index'));
        this.render();
      });
      row.addEventListener('dblclick', () => this.castSelected());
    });
    root.querySelectorAll<HTMLElement>('[data-quick-slot]').forEach((btn) => {
      btn.addEventListener('click', () => this.assignToSlot(Number(btn.getAttribute('data-quick-slot'))));
    });
    this.bindGrimoires(root);
  }

  /** The three-grimoire model's controls: switcher, slots, stat pickers, forget. */
  private bindGrimoires(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-grimoire]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeGrimoireId = btn.getAttribute('data-grimoire') ?? undefined;
        this.render();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-pick-stat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.options.onPickGrimoireStat(
          btn.getAttribute('data-pick-grimoire')!,
          btn.getAttribute('data-pick-axis') as 'x' | 'y',
          btn.getAttribute('data-pick-stat')!
        );
        this.render();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-offer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.options.onOpenSpellOffer(btn.getAttribute('data-offer')!, () => this.reloadSpells());
      });
    });
    root.querySelectorAll<HTMLElement>('[data-forget]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spell = this.selectedSpell;
        if (!spell) return;
        const answer = btn.getAttribute('data-forget');
        if (answer === 'ask') this.confirmForget = spell.id;
        else if (answer === 'yes') {
          this.confirmForget = null;
          this.options.onForgetSpell(spell.id);
          this.spells = this.spells.filter((s) => s.id !== spell.id);
          this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.spells.length - 1));
        } else this.confirmForget = null;
        this.render();
      });
    });
    const info = root.querySelector<HTMLElement>('#sb-slot-info');
    root.querySelectorAll<HTMLElement>('[data-gslot]').forEach((cell) => {
      const key = cell.getAttribute('data-gslot') ?? '';
      const show = () => {
        if (info) info.innerHTML = this.grimoireSlotInfo[key] ?? GRIMOIRE_INFO_DEFAULT;
      };
      const hide = () => {
        if (info) info.innerHTML = GRIMOIRE_INFO_DEFAULT;
      };
      cell.addEventListener('mouseenter', show);
      cell.addEventListener('focus', show);
      cell.addEventListener('mouseleave', hide);
      cell.addEventListener('blur', hide);
      cell.addEventListener('click', () => {
        const spell = this.selectedSpell;
        const grimoireId = this.activeGrimoireId;
        if (!spell || !grimoireId) return;
        const [x, y] = key.split(',').map(Number);
        this.options.onPlaceGrimoireSpell(spell.id, grimoireId, x, y);
        this.render();
      });
    });
  }

  private renderList(player: Player): string {
    const mana = resolveManaTerms(this.engine!.manifest);
    const overflow = getOverflowConfig(this.engine!);
    const tier = getOverflowTier(overflow, player.voidDebt);
    const rows = this.spells
      .map((spell, i) => {
        const slot = player.quickSpells.indexOf(spell.id);
        const cost = heroCastPreview(this.engine!, spell).manaCost ?? 0;
        return `
          <button type="button" class="bs-row sb-row${i === this.selectedIndex ? ' is-selected' : ''}" data-spell-index="${i}">
            <span class="bs-name">${slot >= 0 ? `${keyChip(SLOT_KEYS[slot])} ` : ''}${escapeHtml(spell.name)}</span>
            <span class="ui-num ui-faint">${cost}</span>
          </button>`;
      })
      .join('');
    return `
      <div class="ui-h">Spells <small>${this.spells.length} known</small></div>
      <div class="ui-note">${escapeHtml(mana.name)} <b class="ui-num sb-mana">${player.mana}</b> / <span class="ui-num">${player.maxMana}</span>${
        overflow && player.voidDebt > 0
          ? `<br><span class="sb-debt">${escapeHtml(overflow.debtName)} <span class="ui-num">${player.voidDebt}</span>${tier ? ` · ${escapeHtml(tier.tier.label)}` : ''}</span>`
          : ''
      }</div>
      <div class="ui-inset bs-list ui-scroll" role="listbox">${rows || '<div class="ui-note bs-empty">You know no spells yet.</div>'}</div>`;
  }

  private renderDetail(player: Player): string {
    const spell = this.selectedSpell;
    if (!spell) return '<div class="ui-card ui-note">Choose a spell to see what it does.</div>';
    const engine = this.engine!;
    const unit = resolveManaTerms(engine.manifest).unit;
    // As cast from its grimoire slot, if it has one
    const grimoires = player.grimoireSystem !== undefined;
    const slotted = grimoires ? castFromSlot(engine, player, spell) : undefined;
    const cast = slotted?.cast ?? heroCastPreview(engine, spell);
    const notes = slotted?.notes ?? [];
    // A forged spell is titled by its forging, and strikes as any of its elements.
    const state = player.grimoireState;
    const title = state && player.grimoireSystem ? forgedTitle(player.grimoireSystem, state, spell) : spell.name;
    const elements = [spell.element ?? 'arcane', ...(state ? forgedElements(state, spell.id) : [])];
    const changed = (base: number, now: number): string => (base === now ? `${now}` : `${base} → <span class="ui-up">${now}</span>`);
    const slots = SLOT_KEYS.map((key, s) => {
      const mine = player.quickSpells[s] === spell.id;
      const other = !mine && Boolean(player.quickSpells[s]);
      return `<button type="button" class="sb-slot${mine ? ' is-mine' : other ? ' is-taken' : ''}" data-quick-slot="${s}" title="${mine ? 'On this slot (press again to take it off)' : 'Put it on this slot'}">${key}</button>`;
    }).join('');

    return `
      <div class="ui-card">
        <div class="bs-head"><span class="bs-title">${escapeHtml(title)}</span><span class="ui-note">${escapeHtml(spell.school ?? '')}</span></div>
        <dl class="ui-kv sb-stats">
          <dt>Cost</dt><dd class="ui-num">${changed(spell.manaCost ?? 0, cast.manaCost ?? 0)} ${escapeHtml(unit)}</dd>
          <dt>Element</dt><dd>${escapeHtml(elements.join(' + '))}</dd>
          <dt>Range</dt><dd class="ui-num">${cast.range ? `${changed(spell.range, cast.range)} tiles` : 'self or touch'}</dd>
          <dt>Power</dt><dd class="ui-num">${changed(spellPower(spell), spellPower(cast, { engine, player }))}</dd>
          <dt>Area</dt><dd class="ui-num">${cast.areaOfEffect ? `${changed(spell.areaOfEffect, cast.areaOfEffect)} radius` : 'one target'}</dd>
          <dt>Bounces off walls</dt><dd>${spell.reflects ? 'yes' : 'no'}</dd>
        </dl>
        ${notes.length > 0 ? `<div class="ui-note sb-notes"><b>From its slot:</b> ${notes.map(escapeHtml).join(' · ')}</div>` : ''}
        <div class="sb-desc">${escapeHtml(spell.description || 'No one has written down what this does.')}</div>
      </div>
      <div class="ui-card">
        <div class="ui-h">Quickbar</div>
        <div class="sb-slots">${slots}</div>
        <div class="ui-note">Press 1–0 to put it on a slot; press again to take it off.</div>
      </div>${grimoires ? this.renderForget(spell) : ''}${grimoires ? this.renderOffers(player) : ''}`;
  }

  /** Spells offered while every slot was full, each with a button that reopens its card. */
  private renderOffers(player: Player): string {
    const rows = player.pendingSpellOffers.map((id) => {
      const spell = this.engine!.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
      return `<button type="button" class="sb-slot" data-offer="${escapeHtml(id)}">${escapeHtml(spell?.name ?? id)}</button>`;
    });
    if (rows.length === 0) return '';
    return `<div class="ui-card"><div class="ui-h">Waiting for room</div><div class="ui-note">These spells were offered while every slot was full.</div><div class="sb-slots">${rows.join('')}</div></div>`;
  }

  /** Forgetting is for the rest of the run, so it asks twice. */
  private renderForget(spell: SpellDefinition): string {
    if (this.confirmForget === spell.id) {
      return `<div class="ui-card"><div class="ui-note">Forget ${escapeHtml(spell.name)} for the rest of this run? You will not learn it again.</div>
        <div class="sb-slots"><button type="button" class="sb-slot" data-forget="yes">Forget it</button><button type="button" class="sb-slot" data-forget="no">Keep it</button></div></div>`;
    }
    return `<div class="ui-card"><button type="button" class="sb-slot" data-forget="ask">Forget ${escapeHtml(spell.name)}</button></div>`;
  }

  /**
   * The fusions the hero knows (Q19, Q32): the pack's `magic.hybrids` whose spell is known
   * (forged, or won), or told by a lore entry already read (`fusionSpellId`). Unknown ones
   * stay off the list; the count says how many remain.
   */
  private renderFusions(player: Player): string {
    const engine = this.engine!;
    const hybrids = engine.manifest?.magic?.hybrids ?? [];
    if (hybrids.length === 0) return '';
    const flags = engine.worldState.flags ?? {};
    const told = new Set((engine.manifest?.loreEntries ?? []).filter((l) => l.fusionSpellId && flags[l.flag]).map((l) => l.fusionSpellId!));
    const rows = hybrids
      .map((h) => {
        const forged = player.spellsKnown.includes(h.spellId);
        if (!forged && !told.has(h.spellId)) return '';
        const name = (engine.manifest?.spells?.find((s) => s.id === h.spellId) ?? getSpell(h.spellId))?.name ?? h.spellId;
        return `<div class="sb-fusion"><span class="sb-fusion-name">${escapeHtml(name)}</span> <span class="ui-faint">${escapeHtml(h.elements.join(' + '))}</span><span class="ui-note sb-fusion-src">${forged ? 'known' : 'told'}</span></div>`;
      })
      .filter(Boolean);
    const forges = (engine.manifest?.magic?.altars ?? []).filter((a) => a.rite === 'forge').map((a) => a.name);
    const where = forges.length ? `Forged at ${forges.join(' or ')}: a spell of one element, and an offering of the other.` : '';
    const lore = resolveBranding(engine.manifest).loreTitle;
    return `
      <div class="ui-card">
        <div class="ui-h">Fusions <small>${rows.length} of ${hybrids.length} known</small></div>
        ${rows.join('') || `<div class="ui-note">None known yet. ${escapeHtml(lore)} tell of some; others wait to be found.</div>`}
        ${where ? `<div class="ui-note">${escapeHtml(where)}</div>` : ''}
      </div>`;
  }
}
