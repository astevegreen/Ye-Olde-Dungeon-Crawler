import { PotionItem, type GameEngine, type Item } from '../engine';
import type { ModalStackManager, UIModal } from './modalStack';
import { markCue } from './hints/cueMark';

/** How many potion slots the row has; each has its own key (Shift+1..4 by default). */
export const POTION_ROW_SLOT_COUNT = 4;

/**
 * What a pin remembers: the potion's kind, not one bottle. Its definition ID when it
 * has one, else its true name — never the unidentified appearance, which differs per
 * run, and never shown to the player (it could name an unidentified potion).
 * Identification is per bottle (owner decision Q7): known and unknown bottles of one kind
 * are two kinds here, so the row never names an unknown bottle by a known one's name, nor
 * hides a known one under an appearance.
 */
export function potionKindKey(item: Item): string {
  const kind = item.definitionId ?? item.name;
  return item.identified ? kind : `unidentified:${kind}`;
}

export interface PotionKind {
  key: string;
  /** The instance a click or key drinks; any potion of the kind will do. */
  itemId: string;
  /** The name the player sees (the appearance, while unidentified). */
  name: string;
  count: number;
  identified: boolean;
}

/**
 * Every potion kind the hero carries anywhere (pack, belt, sub-containers):
 * identified kinds first, each group alphabetical.
 */
export function getCarriedPotionKinds(engine: GameEngine): PotionKind[] {
  const kinds = new Map<string, PotionKind>();
  for (const item of engine.player.inventory.getAllCarriedItems()) {
    if (!(item instanceof PotionItem)) continue;
    const key = potionKindKey(item);
    const existing = kinds.get(key);
    if (existing) existing.count += item.quantity;
    else kinds.set(key, { key, itemId: item.id, name: item.unitDisplayName, count: item.quantity, identified: item.identified });
  }
  return [...kinds.values()].sort((a, b) => Number(b.identified) - Number(a.identified) || a.name.localeCompare(b.name));
}

export interface PotionSlotState {
  /** The pinned kind, or null for an empty slot. */
  key: string | null;
  /** The carried potions of that kind; null when none are left. */
  carried: PotionKind | null;
}

/**
 * The row's four slots from the hero's pins. The first time a hero has no pins at
 * all (a new run, or a save from before pinning), the kinds they carry are pinned in
 * order so the row isn't empty; after that only the player changes pins.
 */
export function resolvePotionSlots(engine: GameEngine): PotionSlotState[] {
  const player = engine.player;
  const carried = getCarriedPotionKinds(engine);
  if (player.quickPotions === undefined && carried.length > 0) {
    carried.slice(0, POTION_ROW_SLOT_COUNT).forEach((kind, i) => player.setQuickPotion(i, kind.key, POTION_ROW_SLOT_COUNT));
  }
  const pins = player.quickPotions ?? [];
  const byKey = new Map(carried.map((k) => [k.key, k]));
  return Array.from({ length: POTION_ROW_SLOT_COUNT }, (_, i) => {
    const key = pins[i] ?? null;
    return { key, carried: key ? byKey.get(key) ?? null : null };
  });
}

export interface PotionRowOptions {
  /** Drinks the potion shown in a slot (0-based). */
  onDrinkSlot: (slotIndex: number) => void;
  /** Called after the player changes a pin, so the caller can redraw. */
  onPinsChanged: () => void;
  /** Paints an item's sprite into an icon canvas; wired from the renderer's atlas. */
  drawIcon?: (canvas: HTMLCanvasElement, item: Item) => void;
  /** The key label for a slot, from the player's current keybindings (e.g. "⇧1"). */
  keyLabel: (slotIndex: number) => string;
}

/**
 * Four pinned potion slots beside the health orb. Click (or Shift+1..4) drinks; a
 * slot pinned to a kind the hero has run out of stays, dimmed, until re-pinned.
 * Right-click a slot, or click an empty one, to choose what it holds.
 */
export class PotionRow {
  private container: HTMLElement;
  private slots: HTMLButtonElement[] = [];
  private tooltip: HTMLElement;
  private states: PotionSlotState[] = [];
  private engine?: GameEngine;
  private readonly picker: PotionPicker;
  /** The last bottle seen of each pinned kind, so an out-of-stock slot keeps its icon and name. */
  private readonly lastSeen = new Map<string, { item: Item; name: string }>();
  /** The slot an action cue points at (`hints/actionCues.ts`), or null. */
  private cueSlot: number | null = null;

  constructor(private readonly options: PotionRowOptions) {
    this.container = document.createElement('div');
    this.container.id = 'potion-row';
    this.container.setAttribute('aria-label', 'Potions');
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'potion-tooltip';
    this.tooltip.hidden = true;
    this.picker = new PotionPicker((slot, key) => {
      this.engine?.player.setQuickPotion(slot, key, POTION_ROW_SLOT_COUNT);
      this.options.onPinsChanged();
    });

    for (let i = 0; i < POTION_ROW_SLOT_COUNT; i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'potion-slot';
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.states[i]?.carried) this.options.onDrinkSlot(i);
        else this.openPicker(i);
      });
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openPicker(i);
      });
      slot.addEventListener('mouseenter', () => this.showTooltip(i));
      slot.addEventListener('mouseleave', () => (this.tooltip.hidden = true));
      this.slots.push(slot);
      this.container.appendChild(slot);
    }
    this.container.appendChild(this.tooltip);
  }

  public setModalStack(stack: ModalStackManager): void {
    this.picker.setModalStack(stack);
  }

  public mount(parent: HTMLElement, before?: Element | null): void {
    if (parent.contains(this.container)) return;
    if (before) parent.insertBefore(this.container, before);
    else parent.appendChild(this.container);
  }

  /** The potion kind a slot would drink now, if the hero carries any. */
  public entryAt(slotIndex: number): PotionKind | undefined {
    return this.states[slotIndex]?.carried ?? undefined;
  }

  /** Opens the pin picker for a slot (a key pressed on an empty slot lands here too). */
  public openPicker(slotIndex: number): void {
    if (!this.engine) return;
    this.tooltip.hidden = true;
    this.picker.open(this.engine, slotIndex, this.slots[slotIndex], this.options.drawIcon);
  }

  public update(engine: GameEngine): void {
    if (!engine?.player) return;
    this.engine = engine;
    this.states = resolvePotionSlots(engine);

    this.states.forEach((state, i) => {
      const slot = this.slots[i];
      slot.innerHTML = '';
      slot.className = 'potion-slot';
      const key = this.options.keyLabel(i);

      if (!state.key) {
        slot.classList.add('potion-slot-empty');
        slot.textContent = '+';
      } else {
        const item = state.carried ? engine.player.inventory.findItemById(state.carried.itemId) : undefined;
        if (item && state.carried) this.lastSeen.set(state.key, { item, name: state.carried.name });
        const seen = this.lastSeen.get(state.key);
        slot.classList.toggle('potion-slot-out', !state.carried);
        slot.classList.toggle('potion-slot-unknown', !!state.carried && !state.carried.identified);

        const icon = document.createElement('canvas');
        icon.className = 'potion-slot-icon';
        icon.width = 32;
        icon.height = 32;
        const iconItem = item ?? seen?.item;
        if (iconItem && this.options.drawIcon) this.options.drawIcon(icon, iconItem);
        slot.appendChild(icon);

        const countEl = document.createElement('span');
        countEl.className = 'potion-slot-count';
        countEl.textContent = `${state.carried?.count ?? 0}`;
        slot.appendChild(countEl);
      }
      if (key) {
        const keyEl = document.createElement('span');
        keyEl.className = 'potion-slot-key';
        keyEl.textContent = key;
        slot.appendChild(keyEl);
      }
      slot.setAttribute('aria-label', this.describe(i));
    });
    this.renderCue();
  }

  /** Points the drink cue at a slot (null clears it). */
  public setCue(slotIndex: number | null): void {
    this.cueSlot = slotIndex;
    this.renderCue();
  }

  private renderCue(): void {
    this.slots.forEach((slot, i) => {
      const key = this.options.keyLabel(i);
      markCue(slot, i === this.cueSlot ? `${key ? `${key} ` : ''}Drink` : null);
    });
  }

  private describe(i: number): string {
    const state = this.states[i];
    const key = this.options.keyLabel(i);
    if (!state?.key) return `Empty potion slot${key ? ` ${key}` : ''}: click to choose a potion`;
    const name = state.carried?.name ?? this.lastSeen.get(state.key)?.name ?? 'Pinned potion';
    return state.carried ? `${name} ×${state.carried.count}` : `${name} — none left`;
  }

  private showTooltip(i: number): void {
    const state = this.states[i];
    const key = this.options.keyLabel(i);
    this.tooltip.replaceChildren();
    const title = document.createElement('div');
    title.className = 'potion-tooltip-name';
    const hint = document.createElement('div');
    hint.className = 'potion-tooltip-hint';

    if (!state?.key) {
      title.textContent = 'Empty slot';
      hint.textContent = 'Click to pin a potion here';
    } else {
      const name = state.carried?.name ?? this.lastSeen.get(state.key)?.name ?? 'Pinned potion';
      title.textContent = name;
      const facts: string[] = [];
      if (state.carried) facts.push(`${state.carried.count} carried`);
      else facts.push('none left');
      if (state.carried && !state.carried.identified) facts.push('unidentified');
      const meta = document.createElement('div');
      meta.className = 'potion-tooltip-meta';
      meta.textContent = facts.join(' · ');
      this.tooltip.append(title, meta);
      hint.textContent = `${state.carried ? `Click${key ? ` or ${key}` : ''} to drink · ` : ''}right-click to change`;
      this.tooltip.appendChild(hint);
      this.placeTooltip(i);
      return;
    }
    this.tooltip.append(title, hint);
    this.placeTooltip(i);
  }

  private placeTooltip(i: number): void {
    const slot = this.slots[i];
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${slot.offsetLeft + slot.offsetWidth / 2}px`;
    this.tooltip.style.top = `${slot.offsetTop}px`;
  }
}

/**
 * The small list that opens above a potion slot: every kind the hero carries, and
 * an "Empty this slot" line. Registers on the modal stack (ARCHITECTURE.md §6), so
 * Escape closes it and no key reaches the map while it is open.
 */
export class PotionPicker implements UIModal {
  public readonly id = 'potion-picker';
  private el: HTMLElement | null = null;
  private slotIndex = 0;
  private openState = false;
  private modalStack?: ModalStackManager;
  /** The tick that arms `outsideClick` after opening; a close before it fires cancels it. */
  private armTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly outsideClick = (e: MouseEvent) => {
    if (this.el && !this.el.contains(e.target as Node)) this.close();
  };

  constructor(private readonly onPick: (slotIndex: number, kindKey: string | null) => void) {}

  public get isOpen(): boolean {
    return this.openState;
  }

  public set isOpen(value: boolean) {
    if (!value) this.close();
  }

  public setModalStack(stack: ModalStackManager): void {
    this.modalStack = stack;
  }

  /** The list itself, not the potion row it sits in: Tab moves between its rows. */
  public focusRoot(): HTMLElement | null {
    return this.el;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }

  public open(
    engine: GameEngine,
    slotIndex: number,
    anchor: HTMLElement,
    drawIcon?: (canvas: HTMLCanvasElement, item: Item) => void
  ): void {
    this.close();
    this.slotIndex = slotIndex;
    const el = document.createElement('div');
    el.className = 'potion-picker';
    const head = document.createElement('div');
    head.className = 'potion-picker-title';
    head.textContent = `Potion slot ${slotIndex + 1}`;
    el.appendChild(head);

    const kinds = getCarriedPotionKinds(engine);
    const pinned = engine.player.quickPotions?.[slotIndex] ?? null;
    if (kinds.length === 0) {
      const none = document.createElement('div');
      none.className = 'potion-picker-empty';
      none.textContent = 'You carry no potions.';
      el.appendChild(none);
    }
    for (const kind of kinds) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'potion-picker-row';
      row.classList.toggle('potion-picker-current', kind.key === pinned);
      const icon = document.createElement('canvas');
      icon.width = 32;
      icon.height = 32;
      icon.className = 'potion-slot-icon';
      const item = engine.player.inventory.findItemById(kind.itemId);
      if (item && drawIcon) drawIcon(icon, item);
      const name = document.createElement('span');
      name.textContent = kind.name;
      const count = document.createElement('span');
      count.className = 'potion-picker-count';
      count.textContent = `×${kind.count}`;
      row.append(icon, name, count);
      row.addEventListener('click', () => this.pick(kind.key));
      el.appendChild(row);
    }
    if (pinned) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'potion-picker-row potion-picker-clear';
      clear.textContent = 'Empty this slot';
      clear.addEventListener('click', () => this.pick(null));
      el.appendChild(clear);
    }

    anchor.parentElement?.appendChild(el);
    el.style.left = `${anchor.offsetLeft}px`;
    el.style.top = `${anchor.offsetTop}px`;
    this.el = el;
    this.openState = true;
    this.modalStack?.push(this);
    this.armTimer = setTimeout(() => {
      this.armTimer = null;
      document.addEventListener('mousedown', this.outsideClick);
    }, 0);
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    if (this.armTimer !== null) clearTimeout(this.armTimer);
    this.armTimer = null;
    document.removeEventListener('mousedown', this.outsideClick);
    this.el?.remove();
    this.el = null;
    this.modalStack?.remove(this.id);
  }

  private pick(key: string | null): void {
    const slot = this.slotIndex;
    this.close();
    this.onPick(slot, key);
  }
}
