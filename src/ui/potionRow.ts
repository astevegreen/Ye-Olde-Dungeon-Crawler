import { PotionItem, type GameEngine, type Item } from '../engine';

/** How many potion kinds the row shows; each slot has its own key (Shift+1..4 by default). */
export const POTION_ROW_SLOT_COUNT = 4;

export interface PotionRowEntry {
  /** The instance a click or key drinks; any potion of the kind will do. */
  itemId: string;
  name: string;
  count: number;
  identified: boolean;
}

const STACK_SUFFIX = /\s\(\d+x\)$/;

/**
 * The potion kinds the hero carries anywhere (pack, belt, sub-containers), one
 * entry per displayed name, identified kinds first, each group alphabetical — so
 * a slot's position only changes when a kind runs out, is found, or is identified.
 */
export function getPotionRowEntries(engine: GameEngine): PotionRowEntry[] {
  const groups = new Map<string, PotionRowEntry>();
  for (const item of engine.player.inventory.getAllCarriedItems()) {
    if (!(item instanceof PotionItem)) continue;
    const name = item.displayName.replace(STACK_SUFFIX, '');
    const existing = groups.get(name);
    if (existing) {
      existing.count += item.quantity;
    } else {
      groups.set(name, { itemId: item.id, name, count: item.quantity, identified: item.identified });
    }
  }
  return [...groups.values()]
    .sort((a, b) => Number(b.identified) - Number(a.identified) || a.name.localeCompare(b.name))
    .slice(0, POTION_ROW_SLOT_COUNT);
}

export interface PotionRowOptions {
  /** Drinks the potion shown in a slot (0-based). */
  onDrinkSlot: (slotIndex: number) => void;
  /** Paints an item's sprite into a slot's icon canvas; wired from the renderer's atlas. */
  drawIcon?: (canvas: HTMLCanvasElement, item: Item) => void;
  /** The key label for a slot, from the player's current keybindings (e.g. "⇧1"). */
  keyLabel: (slotIndex: number) => string;
}

/**
 * A short column of potions beside the health orb: every kind carried, one
 * click or key to drink, instead of opening the inventory to find and
 * double-click one mid-fight.
 */
export class PotionRow {
  private container: HTMLElement;
  private slots: HTMLButtonElement[] = [];
  private entries: PotionRowEntry[] = [];
  private options: PotionRowOptions;

  constructor(options: PotionRowOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.container.id = 'potion-row';
    this.container.setAttribute('aria-label', 'Potions');
    for (let i = 0; i < POTION_ROW_SLOT_COUNT; i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'potion-slot';
      slot.hidden = true;
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.options.onDrinkSlot(i);
      });
      this.slots.push(slot);
      this.container.appendChild(slot);
    }
  }

  public mount(parent: HTMLElement, before?: Element | null): void {
    if (parent.contains(this.container)) return;
    if (before) parent.insertBefore(this.container, before);
    else parent.appendChild(this.container);
  }

  /** The potion currently shown in a slot, for the caller that drinks it. */
  public entryAt(slotIndex: number): PotionRowEntry | undefined {
    return this.entries[slotIndex];
  }

  public update(engine: GameEngine): void {
    if (!engine?.player) return;
    this.entries = getPotionRowEntries(engine);
    this.container.classList.toggle('potion-row-empty', this.entries.length === 0);
    this.container.title = this.entries.length === 0 ? 'Potions you carry appear here' : '';

    this.slots.forEach((slot, i) => {
      const entry = this.entries[i];
      if (!entry) {
        slot.hidden = true;
        return;
      }
      slot.hidden = false;
      const key = this.options.keyLabel(i);
      slot.classList.toggle('potion-slot-unknown', !entry.identified);
      slot.title = `${entry.name}${entry.count > 1 ? ` (${entry.count})` : ''}${
        entry.identified ? '' : ' — unidentified'
      }. Click${key ? ` or press ${key}` : ''} to drink.`;
      slot.innerHTML = '';

      const icon = document.createElement('canvas');
      icon.className = 'potion-slot-icon';
      icon.width = 32;
      icon.height = 32;
      const item = engine.player.inventory.findItemById(entry.itemId);
      if (item && this.options.drawIcon) this.options.drawIcon(icon, item);
      slot.appendChild(icon);

      if (key) {
        const keyEl = document.createElement('span');
        keyEl.className = 'potion-slot-key';
        keyEl.textContent = key;
        slot.appendChild(keyEl);
      }
      if (entry.count > 1) {
        const countEl = document.createElement('span');
        countEl.className = 'potion-slot-count';
        countEl.textContent = `${entry.count}`;
        slot.appendChild(countEl);
      }
    });
  }
}
