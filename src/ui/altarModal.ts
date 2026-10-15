import type { GameEngine, AltarDefinition, AltarOffering, AltarRiteRequest, GrimoireSlotRef } from '../engine';
import { listAltarOfferings, findHybridSpellId, getSpell, isSlotDoubled } from '../engine';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import { slotPositionName } from './characterMenu/spellbookGrimoires';

/** What burning costs, said before an offering is picked. Pack-neutral: the pack's own
 *  altar text names its offerings; this is the rule they all share. */
const BURN_RULE =
  'Offer a spell you know and you forget it for good. Offer an essence and that one is used up. Nothing is spent until you perform the rite.';

/** The parts of the dialog that scroll: a redraw keeps each where it was. */
const LIST_SELECTOR = '.altar-list';
const BODY_SELECTOR = '.ui-dialog-body';

/**
 * A spell altar's rite (engine `magic/altars.ts`): pick an offering to burn and, depending on
 * the rite, a grimoire slot or a spell, read the preview, then confirm. Irreversible, so
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
    if (!offering || !this.altar) return undefined;
    const base = { offeringKind: offering.kind, offeringId: offering.id };
    switch (this.altar.rite) {
      case 'double':
        return this.slot && this.preview()?.ok ? { ...base, slot: this.slot } : undefined;
      case 'absolve':
        return base;
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
    if (!offering || !this.altar) return undefined;
    switch (this.altar.rite) {
      case 'double': {
        const spellId = this.slot ? slotSpellId(engine, this.slot) : undefined;
        if (!this.slot || !spellId) return { text: 'Choose a slot that holds a spell.', ok: false };
        if (offering.kind === 'spell' && offering.id === spellId) return { text: `${offering.name} cannot be burned to strengthen its own slot.`, ok: false };
        return { text: `Doubles what <b>${escapeHtml(spellName(engine, spellId))}</b> lends the spells beside it.`, ok: true };
      }
      case 'absolve':
        return { text: 'Clears your debt.', ok: true };
      case 'forge': {
        if (!this.targetSpellId) return { text: 'Choose a spell to transmute.', ok: false };
        const target = spellName(engine, this.targetSpellId);
        const targetElement = spellOf(engine, this.targetSpellId)?.element ?? '';
        const hybridId = findHybridSpellId(engine, targetElement, offering.element);
        if (!hybridId || (offering.kind === 'spell' && offering.id === this.targetSpellId)) {
          return { text: `${target} and ${offering.name} do not fuse.`, ok: false };
        }
        if (engine.player.spellsKnown.includes(hybridId)) return { text: `You already know ${spellName(engine, hybridId)}.`, ok: false };
        const hybrid = spellOf(engine, hybridId);
        return { text: `${target} becomes <b>${hybrid?.name ?? hybridId}</b>: ${hybrid?.description ?? ''}`, ok: true };
      }
      case 'gamble':
        return { text: this.altar?.gamble?.previewText ?? 'Fate decides: a spell, a doubled lend, or a price.', ok: true };
    }
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

    const offeringRows = this.offerings.length
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
        .map(
          (id) =>
            `<button type="button" class="bs-row${id === this.targetSpellId ? ' is-selected' : ''}" data-spell="${escapeHtml(id)}"><span class="bs-name">${escapeHtml(spellName(engine, id))}</span><span class="ui-faint">${escapeHtml(spellOf(engine, id)?.element ?? '')}</span></button>`
        )
        .join('');
      picker = `<div class="ui-dialog-label">Spell to transmute</div><div class="ui-inset bs-list altar-list">${rows}</div>`;
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
        <div class="ui-note">${escapeHtml(BURN_RULE)}</div>
        <div class="ui-dialog-label">Offering to burn</div>
        <div class="ui-inset bs-list altar-list">${offeringRows}</div>
        ${picker}
        ${preview ? `<div class="ui-fact${preview.ok ? '' : ' is-warn'}">${preview.text}</div>` : ''}
        ${burnNote ? `<div class="ui-note">${burnNote} This cannot be undone.</div>` : ''}`,
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

function spellOf(engine: GameEngine, id: string) {
  return engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
}

function slotSpellId(engine: GameEngine, slot: GrimoireSlotRef): string | undefined {
  return engine.player.grimoireState?.placements.find((p) => p.grimoireId === slot.grimoireId && p.x === slot.x && p.y === slot.y)?.spellId;
}

function spellName(engine: GameEngine, id: string): string {
  return id ? (spellOf(engine, id)?.name ?? id) : '';
}

