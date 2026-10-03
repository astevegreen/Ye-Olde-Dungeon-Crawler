import type { GameEngine } from '../engine';
import { getSpell, resolveManaTerms } from '../engine';
import { markCue } from './hints/cueMark';

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
    this.container.style.display = visible ? 'flex' : 'none';
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

      const manaCost = spell.manaCost ?? 0;
      const hasMana = player.mana >= manaCost;
      slotEl.hidden = false;
      slotEl.className = `quick-spell-slot quick-spell-slot-${i} ${
        hasMana ? 'quick-spell-slot-assigned' : 'quick-spell-slot-nomana'
      }`;
      slotEl.title = hasMana
        ? `[${slotKey}] ${spell.name} — ${manaCost} ${mana.unit}. Click or press ${slotKey} to cast.`
        : `[${slotKey}] ${spell.name} — ${manaCost} ${mana.unit} (you have ${player.mana}).`;
      slotEl.innerHTML = `
        <span class="slot-badge-digit">${slotKey}</span>
        <span class="slot-badge-name"></span>
        <span class="${hasMana ? 'slot-badge-cost' : 'slot-badge-cost-nomana'}">${manaCost} ${mana.unit}</span>
      `;
      (slotEl.querySelector('.slot-badge-name') as HTMLElement).textContent = spell.name;
    }
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
