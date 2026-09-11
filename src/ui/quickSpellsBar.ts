import type { GameEngine } from '../engine/engine';
import { getSpell } from '../engine/magic/spellRegistry';

export interface QuickSpellsBarOptions {
  onTriggerSlot: (slotIndex: number) => void;
  onOpenSpellbook: () => void;
}

export class QuickSpellsBar {
  private container: HTMLElement;
  private options: QuickSpellsBarOptions;
  private slotElements: HTMLElement[] = [];

  constructor(options: QuickSpellsBarOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.container.id = 'quick-spells-bar';
    this.container.setAttribute('aria-label', 'Quick-Access Spells Bar');
    this.createSlots();
  }

  public mount(parent: HTMLElement): void {
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

    for (let i = 0; i < 10; i++) {
      const slotEl = document.createElement('button');
      slotEl.type = 'button';
      slotEl.className = `quick-spell-slot quick-spell-slot-${i} quick-spell-slot-unassigned`;
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

  /** Formats a compact display label for a spell name (e.g. "Magic Arrow" -> "MagArr") */
  private formatSpellAbbr(name: string): string {
    if (!name) return 'Spell';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      const w1 = words[0].slice(0, 3);
      const w2 = words[1].slice(0, 3);
      return `${w1}${w2}`;
    }
    return name.length > 7 ? name.slice(0, 6) + '.' : name;
  }

  public update(engine: GameEngine): void {
    if (!engine || !engine.player) return;

    const player = engine.player;
    const quickSpells = player.quickSpells ?? [];
    const slotLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    for (let i = 0; i < 10; i++) {
      const slotEl = this.slotElements[i];
      const spellId = quickSpells[i];
      const slotKey = slotLabels[i];

      if (!spellId) {
        // Empty unassigned slot: [ 1 | --- ]
        slotEl.className = `quick-spell-slot quick-spell-slot-${i} quick-spell-slot-unassigned`;
        slotEl.title = `Slot [${slotKey}] - Unassigned (Click to open Spellbook)`;
        slotEl.innerHTML = `
          <span class="slot-badge-digit">[${slotKey}]</span>
          <span class="slot-badge-name" style="color: #64748b;">---</span>
          <span class="slot-badge-cost" style="color: #475569;">-</span>
        `;
      } else {
        const spell = engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
        if (!spell) {
          slotEl.className = `quick-spell-slot quick-spell-slot-${i} quick-spell-slot-unassigned`;
          slotEl.title = `Slot [${slotKey}] - Unknown (${spellId})`;
          slotEl.innerHTML = `
            <span class="slot-badge-digit">[${slotKey}]</span>
            <span class="slot-badge-name">Unknown</span>
            <span class="slot-badge-cost">-</span>
          `;
        } else {
          const hasMana = player.mana >= (spell.manaCost ?? 0);
          const manaCost = spell.manaCost ?? 0;
          const abbr = this.formatSpellAbbr(spell.name);

          slotEl.className = `quick-spell-slot quick-spell-slot-${i} ${
            hasMana ? 'quick-spell-slot-assigned' : 'quick-spell-slot-nomana'
          }`;
          slotEl.title = `[${slotKey}] ${spell.name} (${manaCost} MP) — Click to Cast`;
          slotEl.innerHTML = `
            <span class="slot-badge-digit">[${slotKey}]</span>
            <span class="slot-badge-name" title="${spell.name}">${abbr}</span>
            <span class="${hasMana ? 'slot-badge-cost' : 'slot-badge-cost-nomana'}">${manaCost}m</span>
          `;
        }
      }
    }
  }
}
