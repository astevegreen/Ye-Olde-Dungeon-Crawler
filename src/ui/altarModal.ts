import type { GameEngine, AltarDefinition, AltarOffering, AltarRiteRequest, ForgePreview, GrimoireSlotRef } from '../engine';
import { listAltarOfferings, forgeRefusal, forgedTitle, previewForge, getSpell, isSlotDoubled, slotAdditions, grimoireAxes, spellAt } from '../engine';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import { AXIS_WORD, slotPositionName } from './characterMenu/spellbookGrimoires';
import { bindRestatPicker, restatPickerHtml, restatVerdict, type RestatChoice } from './restatPicker';

/** What burning costs, said before an offering is picked. Pack-neutral: the pack's own
 *  altar text names its offerings; this is the rule they all share. */
const BURN_RULE =
  'Offer a spell you know and you forget it for good. Offer an essence and that one is used up. Nothing is spent until you perform the rite.';

/** The parts of the dialog that scroll: a redraw keeps each where it was. */
const LIST_SELECTOR = '.altar-list';
const BODY_SELECTOR = '.ui-dialog-body';

/**
 * A spell altar's rite (engine `magic/altars.ts`): pick an offering to burn (none at a free
 * altar) and, depending on the rite, a grimoire slot, a spell, a place for a new slot or a
 * grimoire's new stats, read the preview, then confirm. Irreversible, so
 * nothing happens until Confirm; Esc or Leave backs away and the altar stays unspent.
 */
export class AltarModal implements UIModal {
  public readonly id = 'altar';
  public isOpen = false;
  private overlayEl: HTMLElement | null = null;
  private engine?: GameEngine;
  private altar?: AltarDefinition;
  private offerings: AltarOffering[] = [];
  private offeringIndex = -1;
  private slot?: GrimoireSlotRef;
  private targetSpellId?: string;
  private restat: RestatChoice = { stats: {} };
  private onConfirm?: (request: AltarRiteRequest) => void;
  private onLeave?: () => void;

  constructor() {
    this.overlayEl = createDialogScrim('altar-modal-overlay');
  }

  public open(
    engine: GameEngine,
    altar: AltarDefinition,
    onConfirm: (request: AltarRiteRequest) => void,
    onLeave: () => void
  ): void {
    if (!this.overlayEl) return;
    this.engine = engine;
    this.altar = altar;
    this.offerings = listAltarOfferings(engine, engine.player);
    this.offeringIndex = -1;
    this.slot = undefined;
    this.targetSpellId = undefined;
    this.restat = { stats: {} };
    this.onConfirm = onConfirm;
    this.onLeave = onLeave;
    this.isOpen = true;
    // The last rite's frame is gone: this one starts at the top, not where that was scrolled.
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';
    this.render();
  }

  /** The dialog, for the modal stack's focus handling (§6): Tab moves within it. */
  public focusRoot(): HTMLElement | null {
    return this.overlayEl;
  }

  public close(): void {
    this.isOpen = false;
    if (this.overlayEl) this.overlayEl.style.display = 'none';
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.leave();
      return true;
    }
    if (e.key === 'Enter' && this.request()) {
      this.confirm();
      return true;
    }
    return true; // modal: swallow other keys
  }

  private leave(): void {
    this.close();
    this.onLeave?.();
  }

  private confirm(): void {
    const request = this.request();
    if (!request) return;
    this.close();
    this.onConfirm?.(request);
  }

  private get offering(): AltarOffering | undefined {
    return this.offerings[this.offeringIndex];
  }

  /** The complete request, or undefined while a choice is missing or invalid. */
  private request(): AltarRiteRequest | undefined {
    const offering = this.offering;
    if (!this.altar || (!offering && !this.altar.free)) return undefined;
    const base: AltarRiteRequest = offering && !this.altar.free ? { offeringKind: offering.kind, offeringId: offering.id } : {};
    switch (this.altar.rite) {
      case 'double':
      case 'addSlot':
        return this.slot && this.preview()?.ok ? { ...base, slot: this.slot } : undefined;
      case 'restat':
        return this.restat.grimoireId && this.preview()?.ok
          ? { ...base, restat: { grimoireId: this.restat.grimoireId, stats: { ...this.restat.stats } } }
          : undefined;
      case 'forge':
        return this.targetSpellId && this.preview()?.ok ? { ...base, targetSpellId: this.targetSpellId } : undefined;
      case 'gamble':
        return base;
    }
  }

  /** What the rite will do with the current choices. */
  private preview(): { text: string; ok: boolean } | undefined {
    const engine = this.engine!;
    const offering = this.offering;
    if (!this.altar) return undefined;
    const debt = this.altar.clearsVoidDebt && (engine.player.voidDebt ?? 0) > 0 ? ' Your Void Debt is cleared.' : '';
    // Re-picking stats and adding a slot need no offering's element, so they preview without one.
    if (this.altar.rite === 'restat') {
      const verdict = restatVerdict(engine.player, this.restat);
      return { text: verdict.text + (verdict.ok ? debt : ''), ok: verdict.ok };
    }
    if (this.altar.rite === 'addSlot') {
      return this.slot ? { text: this.addSlotText(this.slot) + debt, ok: true } : { text: 'Choose where the new slot goes.', ok: false };
    }
    if (!offering) return undefined;
    switch (this.altar.rite) {
      case 'double': {
        const spellId = this.slot ? slotSpellId(engine, this.slot) : undefined;
        if (!this.slot || !spellId) return { text: 'Choose a slot that holds a spell.', ok: false };
        if (offering.kind === 'spell' && offering.id === spellId) return { text: `${offering.name} cannot be burned to strengthen its own slot.`, ok: false };
        return { text: `Doubles what <b>${escapeHtml(spellName(engine, spellId))}</b> lends the spells beside it.${debt}`, ok: true };
      }
      case 'forge': {
        if (!this.targetSpellId) return { text: 'Choose a spell to forge.', ok: false };
        if (offering.kind === 'spell' && offering.id === this.targetSpellId) return { text: `${escapeHtml(offering.name)} cannot be forged with itself.`, ok: false };
        const refusal = forgeRefusal(engine, engine.player, this.targetSpellId, offering.element);
        const forged = refusal ? undefined : previewForge(engine, engine.player, this.targetSpellId, offering.element);
        if (!forged) return { text: escapeHtml(refusal ?? 'The forge cannot work that spell.'), ok: false };
        return { text: forgeText(engine, this.targetSpellId, offering.element, forged), ok: true };
      }
      case 'gamble':
        return { text: (this.altar.gamble?.previewText ?? 'Fate decides: a spell, a doubled lend, or a price.') + debt, ok: true };
    }
  }

  /** What adding this slot does: where it sits, and the axis it opens when it is the first to reach that way. */
  private addSlotText(slot: GrimoireSlotRef): string {
    const player = this.engine!.player;
    const system = player.grimoireSystem!;
    const book = bookName(system, slot.grimoireId);
    const axesNow = grimoireAxes(system, player.grimoireState!, slot.grimoireId);
    const newAxis = (['x', 'y'] as const).find((axis) => slot[axis] !== 0 && !axesNow.includes(axis));
    const reach = newAxis ? ` It is the first to reach ${AXIS_WORD[newAxis]}, so ${escapeHtml(book)} gains a second stat, chosen in the Spellbook.` : '';
    return `Adds a slot to <b>${escapeHtml(book)}</b>: ${escapeHtml(slotPositionName(slot.x, slot.y).toLowerCase())}.${reach}`;
  }

  private render(): void {
    if (!this.overlayEl || !this.engine || !this.altar) return;
    const engine = this.engine;
    const player = engine.player;
    const altar = this.altar;
    const offering = this.offering;
    const preview = this.preview();
    const burnNote = offering
      ? offering.kind === 'spell'
        ? `<span class="ui-down">You will forget ${escapeHtml(offering.name)} for good.</span>`
        : `One ${escapeHtml(offering.name)} will be consumed.`
      : '';

    const offeringRows = altar.free
      ? ''
      : this.offerings.length
      ? this.offerings
          .map(
            (o, i) =>
              `<button type="button" class="bs-row${i === this.offeringIndex ? ' is-selected' : ''}" data-offering="${i}"><span class="bs-name">${escapeHtml(o.name)}</span><span class="ui-faint">${escapeHtml(o.kind)} · ${escapeHtml(o.element)}${o.count ? ` ×${o.count}` : ''}</span></button>`
          )
          .join('')
      : '<div class="ui-note bs-empty">You carry nothing the altar will take.</div>';

    let picker = '';
    if (altar.rite === 'double') {
      // Every placed spell, by grimoire; a slot already doubled can't be picked again.
      const system = player.grimoireSystem;
      const state = player.grimoireState;
      const rows = (state?.placements ?? [])
        .map((p) => {
          const doubled = state ? isSlotDoubled(state, p) : false;
          const picked = this.slot && this.slot.grimoireId === p.grimoireId && this.slot.x === p.x && this.slot.y === p.y;
          const book = system?.layouts.find((l) => l.id === p.grimoireId)?.name ?? p.grimoireId;
          return `<button type="button" class="bs-row${picked ? ' is-selected' : ''}" data-slot="${escapeHtml(`${p.grimoireId}|${p.x}|${p.y}`)}"${doubled ? ' disabled' : ''}><span class="bs-name">${escapeHtml(spellName(engine, p.spellId))}</span><span class="ui-faint">${escapeHtml(book)} · ${slotPositionName(p.x, p.y)}${doubled ? ' · doubled' : ''}</span></button>`;
        })
        .join('');
      picker = `<div class="ui-dialog-label">Slot whose lend is doubled</div><div class="ui-inset bs-list altar-list">${rows || '<div class="ui-note bs-empty">No grimoire slot holds a spell.</div>'}</div>`;
    } else if (altar.rite === 'forge') {
      const rows = player.spellsKnown
        .map((id) => {
          const spell = spellOf(engine, id);
          const label = spell && player.grimoireSystem && player.grimoireState ? forgedTitle(player.grimoireSystem, player.grimoireState, spell) : spellName(engine, id);
          return `<button type="button" class="bs-row${id === this.targetSpellId ? ' is-selected' : ''}" data-spell="${escapeHtml(id)}"><span class="bs-name">${escapeHtml(label)}</span><span class="ui-faint">${escapeHtml(spellElements(engine, id).join(' + '))}</span></button>`;
        })
        .join('');
      picker = `<div class="ui-dialog-label">Spell to forge</div><div class="ui-inset bs-list altar-list">${rows}</div>`;
    } else if (altar.rite === 'restat') {
      picker = restatPickerHtml(player, this.restat);
    } else if (altar.rite === 'addSlot') {
      const system = player.grimoireSystem;
      const state = player.grimoireState;
      const rows =
        system && state
          ? slotAdditions(system, state)
              .map((s) => {
                const picked = this.slot && this.slot.grimoireId === s.grimoireId && this.slot.x === s.x && this.slot.y === s.y;
                const beside = [{ x: s.x, y: s.y - 1 }, { x: s.x - 1, y: s.y }, { x: s.x + 1, y: s.y }, { x: s.x, y: s.y + 1 }]
                  .map((c) => spellAt(state, { grimoireId: s.grimoireId, ...c }))
                  .filter((id): id is string => Boolean(id))
                  .map((id) => spellName(engine, id));
                return `<button type="button" class="bs-row${picked ? ' is-selected' : ''}" data-slot="${escapeHtml(`${s.grimoireId}|${s.x}|${s.y}`)}"><span class="bs-name">${escapeHtml(bookName(system, s.grimoireId))} · ${escapeHtml(slotPositionName(s.x, s.y))}</span><span class="ui-faint">${beside.length ? `beside ${escapeHtml(beside.join(', '))}` : 'beside an empty slot'}</span></button>`;
              })
              .join('')
          : '';
      picker = `<div class="ui-dialog-label">Where the new slot goes</div><div class="ui-inset bs-list altar-list">${rows || '<div class="ui-note bs-empty">No grimoire has opened.</div>'}</div>`;
    }

    const ready = Boolean(this.request());
    // Each click redraws the frame; the lists and the window keep their scroll.
    const overlay = this.overlayEl;
    const bodyTop = overlay.querySelector<HTMLElement>(BODY_SELECTOR)?.scrollTop ?? 0;
    const listTops = Array.from(overlay.querySelectorAll<HTMLElement>(LIST_SELECTOR), (el) => el.scrollTop);
    this.overlayEl.innerHTML = dialogHtml({
      title: altar.name,
      kicker: 'Altar',
      closeId: 'btn-altar-x',
      closeTitle: 'Leave (Esc)',
      body: `
        <div class="ui-dialog-lede">${escapeHtml(altar.description)}</div>
        ${altar.free ? '' : `<div class="ui-note">${escapeHtml(BURN_RULE)}</div>
        <div class="ui-dialog-label">Offering to burn</div>
        <div class="ui-inset bs-list altar-list">${offeringRows}</div>`}
        ${picker}
        ${preview ? `<div class="ui-fact${preview.ok ? '' : ' is-warn'}">${preview.text}</div>` : ''}
        ${altar.free ? '<div class="ui-note">The altar grants this once, and it cannot be undone.</div>' : burnNote ? `<div class="ui-note">${burnNote} This cannot be undone.</div>` : ''}`,
      hints: [
        { keys: ['Enter'], label: 'perform' },
        { keys: ['Esc'], label: 'leave, the altar keeps' },
      ],
      actions:
        dialogButton('btn-altar-leave', 'Leave', { attrs: 'data-action="leave"' }) +
        dialogButton('btn-altar-confirm', 'Perform the rite', { primary: true, disabled: !ready, key: 'Enter', attrs: 'data-action="confirm"' }),
    });

    const body = overlay.querySelector<HTMLElement>(BODY_SELECTOR);
    if (body) body.scrollTop = bodyTop;
    overlay.querySelectorAll<HTMLElement>(LIST_SELECTOR).forEach((el, i) => {
      el.scrollTop = listTops[i] ?? 0;
    });

    this.overlayEl.querySelectorAll<HTMLElement>('[data-offering]').forEach((el) =>
      el.addEventListener('click', () => {
        this.offeringIndex = Number(el.dataset.offering);
        this.render();
      })
    );
    this.overlayEl.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) =>
      el.addEventListener('click', () => {
        const [grimoireId, x, y] = (el.dataset.slot ?? '').split('|');
        if (!grimoireId) return;
        this.slot = { grimoireId, x: Number(x), y: Number(y) };
        this.render();
      })
    );
    bindRestatPicker(overlay, player, this.restat, (next) => {
      this.restat = next;
      this.render();
    });
    this.overlayEl.querySelectorAll<HTMLElement>('[data-spell]').forEach((el) =>
      el.addEventListener('click', () => {
        this.targetSpellId = el.dataset.spell;
        this.render();
      })
    );
    this.overlayEl.querySelector('[data-action="leave"]')?.addEventListener('click', () => this.leave());
    this.overlayEl.querySelector('#btn-altar-x')?.addEventListener('click', () => this.leave());
    this.overlayEl.querySelector('[data-action="confirm"]')?.addEventListener('click', () => this.confirm());
  }
}

/** A known spell's elements: its own, then any forged onto it. */
function spellElements(engine: GameEngine, id: string): string[] {
  const own = spellOf(engine, id)?.element ?? '';
  return [own, ...(engine.player.grimoireState?.forged.filter((f) => f.spellId === id).map((f) => f.element) ?? [])];
}

/** What a forge makes of a spell: its new title, how it strikes, and an opposite's bonus. */
function forgeText(engine: GameEngine, spellId: string, element: string, forged: ForgePreview): string {
  const name = escapeHtml(spellName(engine, spellId));
  const swap = forged.swapped ? ` Its ${escapeHtml(forged.swapped)} is swapped for ${escapeHtml(element)}.` : '';
  const own = spellOf(engine, spellId)?.element ?? '';
  const bonus = engine.player.grimoireSystem?.lending?.oppositeBonus ?? 0;
  const opposed = bonus > 0 && engine.affinityMatrix.getOpposite(own) === element ? ` Forged with its opposite, it gains ${Math.round(bonus * 100)}% power.` : '';
  return `${name} becomes <b>${escapeHtml(forged.title)}</b>: it strikes as ${escapeHtml(forged.elements.join(' or '))}, whichever hurts the foe more, and lends each.${swap}${opposed}`;
}

function spellOf(engine: GameEngine, id: string) {
  return engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
}

function slotSpellId(engine: GameEngine, slot: GrimoireSlotRef): string | undefined {
  return engine.player.grimoireState?.placements.find((p) => p.grimoireId === slot.grimoireId && p.x === slot.x && p.y === slot.y)?.spellId;
}

function bookName(system: { layouts: Array<{ id: string; name: string }> }, grimoireId: string): string {
  return system.layouts.find((l) => l.id === grimoireId)?.name ?? grimoireId;
}

function spellName(engine: GameEngine, id: string): string {
  return id ? (spellOf(engine, id)?.name ?? id) : '';
}

