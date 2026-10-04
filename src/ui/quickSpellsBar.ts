import type { GameEngine } from '../engine';
import { GrimoireMatrixManager, getSpell, resolveManaTerms } from '../engine';
import { markCue } from './hints/cueMark';
import { spellPower } from './spellPower';

/** Each slot's key, 1-9 then 0, matching the ten quick_spell_* bindings. */
const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export interface QuickSpellsBarOptions {
  onTriggerSlot: (slotIndex: number) => void;
  onOpenSpellbook: () => void;
}

export class QuickSpellsBar {
  private container: HTMLElement;
  private options: QuickSpellsBarOptions;
  private slotElements: HTMLElement[] = [];
  /** The slot an action cue points at (`hints/actionCues.ts`), or null. */
  private cueSlot: number | null = null;

  constructor(options: QuickSpellsBarOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.container.id = 'quick-spells-bar';
    this.container.setAttribute('aria-label', 'Quick-Access Spells Bar');
    this.createSlots();
    this.watchWrap();
  }

  /** Re-checks the belt's rows whenever its column changes width. */
  private watchWrap(): void {
    if (typeof ResizeObserver === 'undefined') return;
    new ResizeObserver(() => this.fitRows()).observe(this.container);
  }

  /**
   * When the shown slots don't fit in one row even at their minimum width (7 or more
   * on a 1366px window), the belt becomes two even rows (`is-wrapped`, layout.css)
   * instead of running over its neighbours, and the objective line under it makes
   * room. Decided from the column's width and the slot count, never the bar's height,
   * so setting the class can't feed back into the next check.
   */
  private fitRows(): void {
    if (typeof getComputedStyle !== 'function') return;
    const shown = this.slotElements.filter((s) => !s.hidden);
    const width = this.container.clientWidth;
    let wrapped = false;
    if (shown.length > 1 && width > 0) {
      // The slot minimum from the variable: a wrapped slot's own min-width is 0.
      const style = getComputedStyle(this.container);
      const minSlot = parseFloat(style.getPropertyValue('--belt-slot-min')) || 0;
      const gap = parseFloat(style.columnGap) || 0;
      wrapped = shown.length * minSlot + (shown.length - 1) * gap > width;
    }
    this.container.classList.toggle('is-wrapped', wrapped);
    this.container.style.setProperty('--belt-cols', String(Math.ceil(shown.length / 2)));
  }

  public mount(parent: HTMLElement): void {
    const belt = parent.querySelector('#action-belt-slots') as HTMLElement | null;
    if (belt) {
      if (!belt.contains(this.container)) {
        belt.appendChild(this.container);
      }
      return;
    }
    if (!parent.contains(this.container)) {
      // Place right before canvas or at top of parent
      const canvas = parent.querySelector('#game-canvas');
      if (canvas) {
        parent.insertBefore(this.container, canvas);
      } else {
        parent.appendChild(this.container);
      }
    }
  }

  public unmount(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }

  public setVisible(visible: boolean): void {
    // '' rather than 'flex': an inline display would beat the stylesheet's two-row grid.
    this.container.style.display = visible ? '' : 'none';
  }

  private createSlots(): void {
    this.container.innerHTML = '';
    this.slotElements = [];

    // One slot per top-row key, 1-9 then 0, matching the ten quick_spell_* bindings.
    for (let i = 0; i < 10; i++) {
      const slotEl = document.createElement('button');
      slotEl.type = 'button';
      slotEl.className = `quick-spell-slot quick-spell-slot-${i}`;
      slotEl.dataset.slotIndex = String(i);

      slotEl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.options.onTriggerSlot(i);
      });

      this.slotElements.push(slotEl);
      this.container.appendChild(slotEl);
    }
  }

  /**
   * Shows only the slots that hold a spell, each under its full name, plus one "+"
   * slot (the first free key) that opens the spellbook to assign another. Hidden
   * slots keep their index, so keys 1-9/0 still map to the same slot.
   */
  public update(engine: GameEngine): void {
    if (!engine || !engine.player) return;

    const player = engine.player;
    const mana = resolveManaTerms(engine.manifest);
    const quickSpells = player.quickSpells ?? [];
    let addSlotShown = false;

    for (let i = 0; i < this.slotElements.length; i++) {
      const slotEl = this.slotElements[i];
      const spellId = quickSpells[i];
      const slotKey = SLOT_LABELS[i];
      const spell = spellId ? (engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId)) : undefined;

      if (!spell) {
        if (addSlotShown) {
          slotEl.hidden = true;
          continue;
        }
        addSlotShown = true;
        slotEl.hidden = false;
        slotEl.className = `quick-spell-slot quick-spell-slot-${i} quick-spell-slot-add`;
        slotEl.title = `Add a spell to key [${slotKey}] (opens the spellbook)`;
        slotEl.innerHTML = `
          <span class="slot-badge-digit">${slotKey}</span>
          <span class="slot-badge-name">+ Spell</span>
        `;
        continue;
      }

      // What the cast costs and does from its grimoire slot, not the base spell.
      const cast = GrimoireMatrixManager.resolveCast(engine, player, spell.id);
      const manaCost = cast?.spell.manaCost ?? spell.manaCost ?? 0;
      const power = spellPower(cast?.spell ?? spell, { engine, player });
      const grid = cast && cast.notes.length > 0 ? ` From the grid: ${cast.notes.join('; ')}.` : '';
      const hasMana = player.mana >= manaCost;
      slotEl.hidden = false;
      slotEl.className = `quick-spell-slot quick-spell-slot-${i} ${
        hasMana ? 'quick-spell-slot-assigned' : 'quick-spell-slot-nomana'
      }`;
      slotEl.title = hasMana
        ? `[${slotKey}] ${spell.name} — ${manaCost} ${mana.unit}${power ? `, power ${power}` : ''}.${grid} Click or press ${slotKey} to cast.`
        : `[${slotKey}] ${spell.name} — ${manaCost} ${mana.unit}${power ? `, power ${power}` : ''} (you have ${player.mana}).${grid}`;
      slotEl.innerHTML = `
        <span class="slot-badge-digit">${slotKey}</span>
        <span class="slot-badge-name"></span>
        <span class="${hasMana ? 'slot-badge-cost' : 'slot-badge-cost-nomana'}">${manaCost}<span class="slot-badge-unit"> ${mana.unit}</span></span>
      `;
      (slotEl.querySelector('.slot-badge-name') as HTMLElement).textContent = spell.name;
    }
    this.fitRows();
    this.renderCue();
  }

  /** Points the cast cue at a slot (null clears it). */
  public setCue(slotIndex: number | null): void {
    this.cueSlot = slotIndex;
    this.renderCue();
  }

  private renderCue(): void {
    this.slotElements.forEach((slotEl, i) => markCue(slotEl, i === this.cueSlot ? `${SLOT_LABELS[i]} Cast` : null));
  }
}
