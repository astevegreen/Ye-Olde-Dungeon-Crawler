import {
  CENTER_SLOT_INDEX,
  GRIMOIRE_SIZE,
  GrimoireMatrixManager,
  getGrimoireConfig,
  getGrimoirePageName,
  getOverflowConfig,
  getOverflowTier,
  getSpell,
  resolveManaTerms,
  type GameEngine,
  type Player,
  type SpellDefinition,
} from '../../engine';
import type { GameState } from './gameState';
import type { MenuFooter, MenuTab } from './menuTab';
import { escapeHtml, keyChip } from '../html';

export interface SpellbookTabOptions {
  onCastSpell: (spell: SpellDefinition) => void;
  onQuickSpellsChanged: () => void;
  /** Switch grimoire page; runs as a player action, since it can cost a turn in combat. */
  onSwitchGrimoirePage: (pageIndex: number) => void;
  /** Put a spell in a grimoire slot, or clear it with null; a player action, since it can cost a turn in combat. */
  onArrangeGrimoireSlot: (slotIndex: number, spellId: string | null) => void;
}

const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** A spell's headline power: its first numeric damage or heal amount, else basePower. */
function spellPower(spell: SpellDefinition): number {
  for (const e of spell.effects ?? []) {
    if ((e.type === 'damage' || e.type === 'heal') && typeof e.amount === 'number') return e.amount;
  }
  return spell.basePower ?? 0;
}

/**
 * The Spellbook tab (ADR-0011): the spells you know, the selected one's details and
 * quickbar slot, and the grimoire grid for packs that have one. Enter casts.
 */
export class SpellbookTab implements MenuTab {
  public readonly id = 'spellbook';
  public readonly label = 'Spellbook';
  public readonly hotkeyActionId = 'cast_spell';

  private readonly options: SpellbookTabOptions;
  private container: HTMLElement | null = null;
  private engine?: GameEngine;
  private spells: SpellDefinition[] = [];
  private selectedIndex = 0;

  constructor(options: Partial<SpellbookTabOptions> = {}) {
    this.options = {
      onCastSpell: () => {},
      onQuickSpellsChanged: () => {},
      onSwitchGrimoirePage: () => {},
      onArrangeGrimoireSlot: () => {},
      ...options,
    };
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState): void {
    this.engine = state.engine;
    this.spells = state.player.spellsKnown
      .map((id) => this.engine!.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id))
      .filter((s): s is SpellDefinition => Boolean(s));
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.spells.length - 1));
    this.render();
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
    const grimoire = getGrimoireConfig(this.engine);
    this.container.innerHTML = `
      <div class="ui-tabgrid sb-grid${grimoire ? ' has-grimoire' : ''}">
        <div class="ui-col">${this.renderList(player)}</div>
        <div class="ui-col ui-scroll">${this.renderDetail(player)}</div>
        ${grimoire ? `<div class="ui-col ui-scroll">${this.renderGrimoire(player)}</div>` : ''}
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
    root.querySelectorAll<HTMLElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.options.onSwitchGrimoirePage(Number(btn.getAttribute('data-page')));
        this.render();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-grimoire-slot]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const player = this.engine?.player;
        const spell = this.selectedSpell;
        const slotIndex = Number(cell.getAttribute('data-grimoire-slot'));
        if (!player || !spell || !player.isGrimoireSlotOpen(slotIndex)) return;
        this.options.onArrangeGrimoireSlot(slotIndex, player.grimoire[slotIndex]?.spellId === spell.id ? null : spell.id);
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
        return `
          <button type="button" class="bs-row sb-row${i === this.selectedIndex ? ' is-selected' : ''}" data-spell-index="${i}">
            <span class="bs-name">${slot >= 0 ? `${keyChip(SLOT_KEYS[slot])} ` : ''}${escapeHtml(spell.name)}</span>
            <span class="ui-num ui-faint">${spell.manaCost ?? 0}</span>
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
    // As cast from its grimoire slot on the active page, if it has one
    const slotIndex = getGrimoireConfig(engine) ? GrimoireMatrixManager.findSlotForSpell(player, spell.id) : undefined;
    const effective = slotIndex !== undefined ? GrimoireMatrixManager.resolveEffectiveSpellDetailed(engine, player, slotIndex) : undefined;
    const cast = effective?.spell ?? spell;
    const changed = (base: number, now: number): string => (base === now ? `${now}` : `${base} → <span class="ui-up">${now}</span>`);
    const slots = SLOT_KEYS.map((key, s) => {
      const mine = player.quickSpells[s] === spell.id;
      const other = !mine && Boolean(player.quickSpells[s]);
      return `<button type="button" class="sb-slot${mine ? ' is-mine' : other ? ' is-taken' : ''}" data-quick-slot="${s}" title="${mine ? 'On this slot (press again to take it off)' : 'Put it on this slot'}">${key}</button>`;
    }).join('');

    return `
      <div class="ui-card">
        <div class="bs-head"><span class="bs-title">${escapeHtml(spell.name)}</span><span class="ui-note">${escapeHtml(spell.school ?? '')}</span></div>
        <dl class="ui-kv sb-stats">
          <dt>Cost</dt><dd class="ui-num">${changed(spell.manaCost ?? 0, cast.manaCost ?? 0)} ${escapeHtml(unit)}</dd>
          <dt>Element</dt><dd>${escapeHtml(spell.element ?? 'arcane')}</dd>
          <dt>Range</dt><dd class="ui-num">${cast.range ? `${changed(spell.range, cast.range)} tiles` : 'self or touch'}</dd>
          <dt>Power</dt><dd class="ui-num">${changed(spellPower(spell), spellPower(cast))}</dd>
          <dt>Area</dt><dd class="ui-num">${cast.areaOfEffect ? `${changed(spell.areaOfEffect, cast.areaOfEffect)} radius` : 'one target'}</dd>
          <dt>Bounces off walls</dt><dd>${spell.reflects ? 'yes' : 'no'}</dd>
        </dl>
        ${effective && effective.notes.length > 0 ? `<div class="ui-note sb-notes"><b>From the grid:</b> ${effective.notes.map(escapeHtml).join(' · ')}</div>` : ''}
        <div class="sb-desc">${escapeHtml(spell.description || 'No one has written down what this does.')}</div>
      </div>
      <div class="ui-card">
        <div class="ui-h">Quickbar</div>
        <div class="sb-slots">${slots}</div>
        <div class="ui-note">Press 1–0 to put it on a slot; press again to take it off.</div>
      </div>`;
  }

  private renderGrimoire(player: Player): string {
    const engine = this.engine!;
    const config = getGrimoireConfig(engine)!;
    const spell = this.selectedSpell;
    const sealedLabel = config.lockedSlotLabel ?? 'Sealed';
    const pages = player.grimoirePages
      .map(
        (_p, i) =>
          `<button type="button" class="st-subtab" data-page="${i}" aria-selected="${i === player.activeGrimoireIndex}">${escapeHtml(getGrimoirePageName(engine, player, i))}</button>`
      )
      .join('');
    const attuning = player.statusManager.getStatus('grimoire_attunement');
    const cells = Array.from({ length: GRIMOIRE_SIZE }, (_, i) => {
      const slot = player.grimoire[i];
      const open = player.isGrimoireSlotOpen(i);
      const center = i === CENTER_SLOT_INDEX;
      const ground = player.grimoireGrounds[i];
      const slotted = slot?.spellId ? (engine.manifest?.spells?.find((s) => s.id === slot.spellId) ?? getSpell(slot.spellId)) : null;
      const tag = center && config.centerSlotLabel ? config.centerSlotLabel : ground ? ground : '';
      const glyphs = open && slot?.infusedGlyphs?.length
        ? `<div class="sb-glyphs">${slot.infusedGlyphs
            .map((g) => `✦${escapeHtml(config.glyphs?.find((d) => d.id === g.glyphId)?.name ?? g.glyphId)}${g.potency > 1 ? `×${g.potency}` : ''}`)
            .join(' ')}</div>`
        : '';
      const castCost = slotted ? GrimoireMatrixManager.resolveEffectiveSpell(engine, player, i)?.manaCost : undefined;
      const body = !open
        ? `<div class="sb-sealed">${escapeHtml(sealedLabel)}</div>`
        : slotted
        ? `<div class="sb-cell-spell">${escapeHtml(slotted.name)}</div><div class="ui-faint sb-cell-meta">${escapeHtml(slotted.element ?? 'arcane')} · <span class="ui-num">${castCost ?? slotted.manaCost ?? 0}</span></div>`
        : '<div class="ui-faint sb-cell-empty">empty</div>';
      const cls = ['sb-cell', open ? '' : 'is-sealed', center ? 'is-center' : '', slotted ? 'is-filled' : '', spell && slot?.spellId === spell.id ? 'is-mine' : '']
        .filter(Boolean)
        .join(' ');
      return `<button type="button" class="${cls}" data-grimoire-slot="${i}"${open ? '' : ' disabled'}>
          <div class="sb-cell-head"><span class="ui-num">${i + 1}</span>${tag ? `<span>${escapeHtml(tag)}</span>` : ''}</div>${body}${glyphs}</button>`;
    }).join('');

    // How a sealed slot opens: at an altar whose rite grounds a slot (pack data).
    const groundAltars = (engine.manifest?.magic?.altars ?? []).filter((a) => a.rite === 'ground').map((a) => a.name);
    const sealedCount = Array.from({ length: GRIMOIRE_SIZE }, (_, i) => i).filter((i) => !player.isGrimoireSlotOpen(i)).length;
    const unseal =
      sealedCount > 0 && groundAltars.length > 0
        ? `<div class="ui-note sb-unseal">${escapeHtml(sealedLabel)} slots open at ${escapeHtml(groundAltars.join(' or '))}: burn an offering there to unseal one.</div>`
        : '';

    return `
      <div class="ui-h">${escapeHtml(config.title)}</div>
      <div class="st-subtabs">${pages}</div>
      ${attuning ? `<div class="ui-note sb-attune">Attuning to this page: <span class="ui-num">${attuning.duration ?? 1}</span> turn left.</div>` : ''}
      <div class="ui-inset sb-matrix">${cells}</div>
      <div class="ui-note">Click a slot to put the chosen spell there, or take it out.</div>
      ${unseal}`;
  }
}
