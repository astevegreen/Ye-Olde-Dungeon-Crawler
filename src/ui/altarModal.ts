import type { GameEngine, AltarDefinition, AltarOffering, AltarRiteRequest } from '../engine';
import {
  listAltarOfferings,
  getGrimoireConfig,
  glyphForOffering,
  findHybridSpellId,
  getSpell,
  GRIMOIRE_SIZE,
} from '../engine';
import type { UIModal } from './modalStack';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';

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
  private slotIndex?: number;
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
    this.slotIndex = undefined;
    this.targetSpellId = undefined;
    this.onConfirm = onConfirm;
    this.onLeave = onLeave;
    this.isOpen = true;
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
      case 'inscribe':
      case 'ground':
        return this.slotIndex === undefined ? undefined : { ...base, slotIndex: this.slotIndex };
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
      case 'inscribe': {
        const glyph = glyphForOffering(getGrimoireConfig(engine), offering.element, offering.school);
        if (!glyph) return { text: `${offering.name} holds no glyph.`, ok: false };
        const where = this.slotIndex === undefined ? 'a slot you choose' : `slot ${this.slotIndex + 1}`;
        return { text: `Inscribes <b>${glyph.name}</b> on ${where}: ${glyph.description}`, ok: true };
      }
      case 'ground': {
        const where = this.slotIndex === undefined ? 'a sealed slot you choose' : `sealed slot ${this.slotIndex + 1}`;
        return { text: `Opens ${where}, grounded in <b>${offering.element}</b>. Clears your debt.`, ok: true };
      }
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
        return { text: this.altar?.gamble?.previewText ?? 'Fate decides: a spell, a doubled glyph, or a price.', ok: true };
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
              `<button type="button" class="bs-row${i === this.offeringIndex ? ' is-selected' : ''}" data-offering="${i}"><span class="bs-name">${escapeHtml(o.name)}</span><span class="ui-faint">${escapeHtml(o.kind === 'spell' ? 'spell' : 'item')} · ${escapeHtml(o.element)}${o.count ? ` ×${o.count}` : ''}</span></button>`
          )
          .join('')
      : '<div class="ui-note bs-empty">You carry nothing the altar will take.</div>';

    let picker = '';
    if (altar.rite === 'inscribe' || altar.rite === 'ground') {
      const wantSealed = altar.rite === 'ground';
      const cells = Array.from({ length: GRIMOIRE_SIZE }, (_, i) => {
        const open = player.isGrimoireSlotOpen(i);
        const pickable = wantSealed ? !open : open;
        const label = !open ? 'Sealed' : spellName(engine, player.grimoire[i]?.spellId ?? '') || 'empty';
        const cls = ['sb-cell', open ? 'is-filled' : 'is-sealed', i === this.slotIndex ? 'is-mine' : ''].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-slot="${pickable ? i : ''}"${pickable ? '' : ' disabled'}><div class="sb-cell-head"><span class="ui-num">${i + 1}</span></div><div class="${open ? 'sb-cell-spell' : 'sb-sealed'}">${escapeHtml(label)}</div></button>`;
      }).join('');
      picker = `<div class="ui-dialog-label">${wantSealed ? 'Sealed slot to open' : 'Slot to inscribe (active page)'}</div>
        <div class="ui-inset sb-matrix">${cells}</div>`;
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
    this.overlayEl.innerHTML = dialogHtml({
      title: altar.name,
      kicker: 'Altar',
      closeId: 'btn-altar-x',
      closeTitle: 'Leave (Esc)',
      body: `
        <div class="ui-dialog-lede">${escapeHtml(altar.description)}</div>
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

    this.overlayEl.querySelectorAll<HTMLElement>('[data-offering]').forEach((el) =>
      el.addEventListener('click', () => {
        this.offeringIndex = Number(el.dataset.offering);
        this.render();
      })
    );
    this.overlayEl.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) =>
      el.addEventListener('click', () => {
        if (el.dataset.slot === '') return;
        this.slotIndex = Number(el.dataset.slot);
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

function spellName(engine: GameEngine, id: string): string {
  return id ? (spellOf(engine, id)?.name ?? id) : '';
}

