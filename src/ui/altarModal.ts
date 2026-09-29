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
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.id = 'altar-modal-overlay';
    overlay.style.cssText =
      'position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 170;';
    document.body.appendChild(overlay);
    this.overlayEl = overlay;
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
        return { text: 'Loki decides: a spell, a doubled glyph, or a price.', ok: true };
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
        ? `<span style="color:#f87171;">You will forget ${offering.name} for good.</span>`
        : `One ${offering.name} will be consumed.`
      : '';

    const offeringRows = this.offerings.length
      ? this.offerings
          .map(
            (o, i) =>
              `<div data-offering="${i}" style="padding:4px 8px; cursor:pointer; border-radius:3px; ${
                i === this.offeringIndex ? 'background:#1e3a8a; color:#fff;' : 'color:#cbd5e1;'
              }">${o.kind === 'spell' ? '📜' : '✦'} ${o.name} <span style="color:#64748b;">(${o.element}${o.count ? ` ×${o.count}` : ''})</span></div>`
          )
          .join('')
      : '<div style="color:#64748b; font-style:italic;">You carry nothing the altar will take.</div>';

    let picker = '';
    if (altar.rite === 'inscribe' || altar.rite === 'ground') {
      const wantSealed = altar.rite === 'ground';
      const cells = Array.from({ length: GRIMOIRE_SIZE }, (_, i) => {
        const open = player.isGrimoireSlotOpen(i);
        const pickable = wantSealed ? !open : open;
        const label = !open ? '🔒' : spellName(engine, player.grimoire[i]?.spellId ?? '') || '—';
        return `<div data-slot="${pickable ? i : ''}" style="padding:6px 4px; min-height:28px; text-align:center; font-size:10px; border-radius:3px; cursor:${pickable ? 'pointer' : 'default'};
          border:1px solid ${i === this.slotIndex ? '#facc15' : pickable ? '#38bdf8' : '#1e293b'}; color:${pickable ? '#e2e8f0' : '#475569'};">${i + 1}. ${label}</div>`;
      }).join('');
      picker = `<div style="font-size:11px; color:#94a3b8; margin:8px 0 4px;">${wantSealed ? 'Sealed slot to open:' : 'Slot to inscribe (active page):'}</div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:4px;">${cells}</div>`;
    } else if (altar.rite === 'forge') {
      const rows = player.spellsKnown
        .map(
          (id) =>
            `<div data-spell="${id}" style="padding:4px 8px; cursor:pointer; border-radius:3px; ${
              id === this.targetSpellId ? 'background:#1e3a8a; color:#fff;' : 'color:#cbd5e1;'
            }">${spellName(engine, id)} <span style="color:#64748b;">(${spellOf(engine, id)?.element ?? ''})</span></div>`
        )
        .join('');
      picker = `<div style="font-size:11px; color:#94a3b8; margin:8px 0 4px;">Spell to transmute:</div>
        <div style="max-height:120px; overflow-y:auto;">${rows}</div>`;
    }

    const ready = Boolean(this.request());
    this.overlayEl.innerHTML = `
      <div style="width:560px; max-width:94vw; max-height:90vh; overflow-y:auto; background:#0b1120; border:1px solid #eab308; border-radius:6px; padding:16px 18px; font-family:inherit; color:#e2e8f0;">
        <div style="font-size:16px; font-weight:bold; color:#facc15; margin-bottom:4px;">${altar.name}</div>
        <div style="font-size:12px; color:#cbd5e1; margin-bottom:12px; line-height:1.5;">${altar.description}</div>
        <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">Offering to burn:</div>
        <div style="max-height:140px; overflow-y:auto; border:1px solid #1e293b; border-radius:3px; padding:2px;">${offeringRows}</div>
        ${picker}
        ${preview ? `<div style="margin-top:10px; font-size:12px; color:${preview.ok ? '#a7f3d0' : '#fca5a5'};">${preview.text}</div>` : ''}
        ${burnNote ? `<div style="margin-top:4px; font-size:11px;">${burnNote} This cannot be undone.</div>` : ''}
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
          <button type="button" data-action="leave" style="padding:6px 12px; background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:3px; cursor:pointer;">Leave [Esc]</button>
          <button type="button" data-action="confirm" ${ready ? '' : 'disabled'} style="padding:6px 12px; background:${ready ? '#b45309' : '#292524'}; color:${ready ? '#fff' : '#78716c'}; border:1px solid #eab308; border-radius:3px; cursor:${ready ? 'pointer' : 'not-allowed'};">Perform the rite [Enter]</button>
        </div>
      </div>`;

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
    this.overlayEl.querySelector('[data-action="confirm"]')?.addEventListener('click', () => this.confirm());
  }
}

function spellOf(engine: GameEngine, id: string) {
  return engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
}

function spellName(engine: GameEngine, id: string): string {
  return id ? (spellOf(engine, id)?.name ?? id) : '';
}

