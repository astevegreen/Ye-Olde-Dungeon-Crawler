import {
  ChannelRuneOfReturnAction,
  Container,
  type ContainerSortMode,
  type EquipmentSlot,
  type GameEngine,
  type Item,
  PotionItem,
  RuneOfReturnItem,
  ScrollItem,
  WandItem,
} from '../../engine';
import { ItemInspector, type InspectorSource } from './itemInspector';

/**
 * The inventory's state and rules, without any drawing: what is selected and focused,
 * which container is open, what a click, a drop, a key or a context-menu choice does.
 * InventoryTab (inventoryTab.ts) draws it as DOM and forwards events here. Every change
 * to the game goes through `engine.commandBus` (or `handlePlayerAction` for channeling
 * the Rune of Return), exactly as the canvas inventory did.
 */

/** A keyboard panel. The inspector is the fourth stop of Tab but holds no items. */
export type ItemPanel = 'paperdoll' | 'backpack' | 'ground';
/** Where an item shown in the inventory lives. */
export type ItemSource = 'paperdoll' | 'backpack' | 'ground' | 'container' | 'companion';
export type BackpackFilter = 'all' | 'gear' | 'consumable' | 'magic' | 'valuable';
export const BACKPACK_FILTERS: BackpackFilter[] = ['all', 'gear', 'consumable', 'magic', 'valuable'];
export const SORT_MODES: ContainerSortMode[] = ['category', 'value', 'tier', 'weight', 'bulk', 'name'];

export interface ContainerNavEntry {
  container: Container;
  source: 'backpack' | 'ground' | 'paperdoll';
  title: string;
}

/** Items that stack in one cell: same kind, same identification and quality. */
export interface DisplayItemGroup {
  leadItem: Item;
  items: Item[];
  totalQuantity: number;
  totalWeight: number;
  displayName: string;
}

export interface MenuOption {
  label: string;
  run(): void;
}

export interface ContextMenuState {
  item: Item;
  source: ItemSource;
  options: MenuOption[];
  /** Viewport position the menu opens at. */
  x: number;
  y: number;
}

export interface SplitState {
  item: Item;
  maxQuantity: number;
  amount: number;
}

export interface DragState {
  item: Item;
  source: ItemSource;
  slotId?: string;
}

/**
 * The short label a cell has room for: the part of the name that tells items apart
 * ("Potion of Healing (3x)" -> "Healing", quantity 3). The icon already shows it is a
 * potion; the inspector and the hover card carry the full name.
 */
export function cellLabel(displayName: string): { name: string; quantity: number } {
  const stack = /^(.*)\s\((\d+)x\)$/.exec(displayName);
  const base = stack ? stack[1] : displayName;
  const quantity = stack ? Number(stack[2]) : 1;
  const ofIndex = base.indexOf(' of ');
  const name = ofIndex > 0 ? base.slice(ofIndex + 4).replace(/^the\s+/i, '') : base;
  return { name: name || base, quantity };
}

export function groupItemsForDisplay(items: readonly Item[]): DisplayItemGroup[] {
  const groups: DisplayItemGroup[] = [];
  const keyToGroup = new Map<string, DisplayItemGroup>();

  for (const item of items) {
    if (item instanceof Container) {
      groups.push({ leadItem: item, items: [item], totalQuantity: item.quantity, totalWeight: item.weight, displayName: item.displayName });
      continue;
    }

    let key: string;
    if (!item.identified) {
      const baseName = item.canBeIdentified() ? (item.unidentifiedName || item.name) : item.displayName;
      key = `unidentified_${item.category}_${baseName}`;
    } else {
      const cleanName = item.displayName.replace(/\s\(\d+x\)$/, '');
      key = `identified_${item.category}_${cleanName}_${item.quality}_${item.enchantmentLevel}`;
    }

    const existing = keyToGroup.get(key);
    if (existing) {
      existing.items.push(item);
      existing.totalQuantity += item.quantity;
      existing.totalWeight += item.weight;
      const baseClean = existing.leadItem.displayName.replace(/\s\(\d+x\)$/, '');
      existing.displayName = existing.totalQuantity > 1 ? `${baseClean} (${existing.totalQuantity}x)` : baseClean;
    } else {
      const baseClean = item.displayName.replace(/\s\(\d+x\)$/, '');
      const group: DisplayItemGroup = {
        leadItem: item,
        items: [item],
        totalQuantity: item.quantity,
        totalWeight: item.weight,
        displayName: item.quantity > 1 ? `${baseClean} (${item.quantity}x)` : baseClean,
      };
      keyToGroup.set(key, group);
      groups.push(group);
    }
  }
  return groups;
}

function matchesFilter(item: Item, filter: BackpackFilter): boolean {
  switch (filter) {
    case 'gear':
      return ['weapon', 'shield', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(item.category);
    case 'consumable':
      return (
        ['consumable', 'potion', 'scroll', 'wand'].includes(item.category) ||
        item instanceof PotionItem ||
        item instanceof ScrollItem ||
        item instanceof WandItem
      );
    case 'magic':
      return (
        item instanceof ScrollItem ||
        item instanceof WandItem ||
        item instanceof RuneOfReturnItem ||
        item.modifiers.length > 0 ||
        item.quality === 'artifact' ||
        (item.enchantmentLevel ?? 0) > 0
      );
    case 'valuable':
      return item.value >= 50 || item.quality === 'artifact' || item.id.includes('coin') || item.id.includes('gem') || item.id.includes('gold');
    default:
      return true;
  }
}

export class InventoryController {
  public engine?: GameEngine;
  public readonly inspector = new ItemInspector();

  public containerNavStack: ContainerNavEntry[] = [];
  public selectedGroundContainer: Container | null = null;
  public selectedPackContainer: Container | null = null;
  public backpackFilter: BackpackFilter = 'all';
  public column3View: 'ground' | 'companion' = 'ground';
  public sortModeIndex = 0;
  public splitDialog: SplitState | null = null;
  public contextMenu: ContextMenuState | null = null;
  public drag: DragState | null = null;
  /** Columns each item grid laid out with last render, so Up/Down step a row. */
  public gridColumns: Record<'backpack' | 'ground', number> = { backpack: 1, ground: 1 };

  /** After any change worth redrawing. */
  public onChange?: () => void;
  /** Closes the whole menu (channeling the Rune of Return leaves the inventory). */
  public onDismiss?: () => void;

  constructor() {
    // The inspector's "Open" actions open the container here, in the third column.
    this.inspector.onPeek = (container) => this.pushContainer(container, this.sourceOf(container));
  }

  // ---- Opening and closing -----------------------------------------------------------

  public open(engine: GameEngine): void {
    this.engine = engine;
    this.reset();
    this.inspector.setFocus('paperdoll', 0);
    const res = engine.player.inventory.consolidateCoins();
    if (res.count > 0) {
      engine.log(`Auto-consolidated ${res.count} coin stack${res.count > 1 ? 's' : ''} into purse.`);
    }
  }

  /** Forgets selection, open containers, menus and drags. */
  public reset(): void {
    this.inspector.clearSelection();
    this.containerNavStack = [];
    this.selectedGroundContainer = null;
    this.selectedPackContainer = null;
    this.splitDialog = null;
    this.contextMenu = null;
    this.drag = null;
  }

  /** Puts keyboard focus on the last panel (the item inspector), for Shift+Tab entry. */
  public focusLastPanel(): void {
    this.inspector.setFocus('inspector', 0);
  }

  private changed(): void {
    this.onChange?.();
  }

  // ---- Containers ----------------------------------------------------------------------

  public get activeContainer(): Container | null {
    if (this.containerNavStack.length > 0) return this.containerNavStack[this.containerNavStack.length - 1].container;
    return this.selectedPackContainer || this.selectedGroundContainer;
  }

  /** Where a container the hero can reach sits: carried, worn, or on the ground. */
  private sourceOf(container: Container): ContainerNavEntry['source'] {
    const inv = this.engine?.player.inventory;
    if (inv?.primaryPack.getItems().some((i) => i.id === container.id)) return 'backpack';
    if (inv?.paperdoll.getAllEquipped().some((e) => e.item.id === container.id)) return 'paperdoll';
    return 'ground';
  }

  public pushContainer(container: Container, source: ContainerNavEntry['source'], title?: string): void {
    this.containerNavStack.push({ container, source, title: title ?? container.displayName });
    this.selectedGroundContainer = source === 'ground' ? container : null;
    this.selectedPackContainer = source === 'backpack' ? container : null;
    if (!container.wasOpened) {
      this.engine?.commandBus.dispatch({ type: 'open_container', payload: { container } });
    }
    this.column3View = 'ground';
    this.inspector.clearSelection();
    this.inspector.setFocus('ground', 0);
  }

  private settleOnTop(): void {
    const top = this.containerNavStack[this.containerNavStack.length - 1];
    this.selectedGroundContainer = top?.source === 'ground' ? top.container : null;
    this.selectedPackContainer = top?.source === 'backpack' ? top.container : null;
    this.inspector.clearSelection();
  }

  /** Steps back out of the open container. False when none is open. */
  public popContainer(): boolean {
    if (this.containerNavStack.length === 0) {
      if (!this.selectedGroundContainer && !this.selectedPackContainer) return false;
      this.selectedGroundContainer = null;
      this.selectedPackContainer = null;
      this.inspector.clearSelection();
      return true;
    }
    this.containerNavStack.pop();
    this.settleOnTop();
    return true;
  }

  /** A breadcrumb: back to the container at `targetIndex`, or out of all of them (-1). */
  public popContainerTo(targetIndex: number): void {
    this.containerNavStack = targetIndex < 0 ? [] : this.containerNavStack.slice(0, targetIndex + 1);
    this.settleOnTop();
    this.changed();
  }

  /**
   * Drops open containers that are no longer within reach (picked up, dropped, emptied
   * into the pack). A container on the ground counts while it is on the hero's tile or
   * next to it, which is where a double-click on the map can open one.
   */
  public pruneContainers(): void {
    const engine = this.engine;
    if (!engine) return;
    const p = engine.player;
    const near: Item[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.push(...engine.map.getItemsAt(p.x + dx, p.y + dy));
    for (let i = this.containerNavStack.length - 1; i >= 0; i--) {
      const entry = this.containerNavStack[i];
      const id = entry.container.id;
      const exists =
        entry.source === 'paperdoll'
          ? p.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === id)
          : entry.source === 'backpack'
            ? p.inventory.primaryPack.getItems().some((it) => it.id === id)
            : near.some((it) => it.id === id) || (i > 0 && this.containerNavStack[i - 1].container.getItems().some((it) => it.id === id));
      if (!exists) this.containerNavStack.splice(i, 1);
    }
    if (this.containerNavStack.length === 0) {
      this.selectedGroundContainer = null;
      this.selectedPackContainer = null;
    }
  }

  // ---- What each panel shows -------------------------------------------------------------

  /** The backpack's items under the current filter. */
  public packItems(): Item[] {
    const items = this.engine?.player.inventory.primaryPack.getItems() ?? [];
    return items.filter((i) => matchesFilter(i, this.backpackFilter));
  }

  /** What the third column lists: the companion's pack, the open container, or the ground. */
  public column3Source(): 'companion' | 'container' | 'ground' {
    if (this.column3View === 'companion' && this.engine?.companion) return 'companion';
    return this.activeContainer ? 'container' : 'ground';
  }

  public column3Items(): readonly Item[] {
    const engine = this.engine;
    if (!engine) return [];
    switch (this.column3Source()) {
      case 'companion':
        return engine.companion?.inventory.primaryPack.getItems() ?? [];
      case 'container':
        return this.activeContainer?.getItems() ?? [];
      default:
        return engine.map.getItemsAt(engine.player.x, engine.player.y);
    }
  }

  public groups(panel: 'backpack' | 'ground'): DisplayItemGroup[] {
    return groupItemsForDisplay(panel === 'backpack' ? this.packItems() : this.column3Items());
  }

  /** The paperdoll slots an item would go in; highlighted while it is selected or dragged. */
  public slotsFor(item: Item | null | undefined): string[] {
    if (!item || !this.engine) return [];
    return this.engine.player.inventory.paperdoll
      .getSlotDefinitions()
      .filter((def) => def.acceptedCategories.includes(item.category) || (item.slot && def.id === item.slot))
      .map((def) => def.id);
  }

  private inspectorSourceFor(panel: 'backpack' | 'ground'): InspectorSource {
    if (panel === 'backpack') return 'backpack';
    const source = this.column3Source();
    return source === 'companion' ? 'companion' : source;
  }

  // ---- Selecting -------------------------------------------------------------------------

  public selectSlot(index: number): void {
    const engine = this.engine;
    if (!engine) return;
    const slots = engine.player.inventory.paperdoll.getSlotDefinitions();
    const slot = slots[index];
    if (!slot) return;
    this.inspector.clearMultiSelect();
    this.inspector.setFocus('paperdoll', index);
    const item = engine.player.inventory.paperdoll.getItem(slot.id);
    if (item) this.inspector.select(item, 'paperdoll', slot.id);
    else this.inspector.clearSelection();
    this.changed();
  }

  /** A click on a cell; with Shift/Ctrl/Cmd in the backpack it toggles a multi-selection. */
  public selectCell(panel: 'backpack' | 'ground', index: number, multi = false): void {
    const group = this.groups(panel)[index];
    if (!group) return;
    if (multi && panel === 'backpack') {
      this.inspector.toggleMultiSelect(group.leadItem);
    } else {
      this.inspector.clearMultiSelect();
      this.inspector.setFocus(panel, index);
      this.inspector.select(group.leadItem, this.inspectorSourceFor(panel), undefined, this.activeContainer);
    }
    this.changed();
  }

  public clearSelection(): void {
    if (!this.inspector.selectedItem && this.inspector.selectedItemIds.size === 0) return;
    this.inspector.clearSelection();
    this.changed();
  }

  // ---- Acting on items ------------------------------------------------------------------

  private dispatch(cmd: Parameters<GameEngine['commandBus']['dispatch']>[0]): { success: boolean; message?: string } {
    return this.engine ? this.engine.commandBus.dispatch(cmd) : { success: false };
  }

  /** Uses or equips a carried item: drink, read, zap, open, else equip. */
  private useOrEquip(item: Item): void {
    if (item instanceof Container) {
      this.pushContainer(item, 'backpack');
      return;
    }
    if (item instanceof PotionItem) this.dispatch({ type: 'drink_potion', payload: { itemId: item.id } });
    else if (item instanceof ScrollItem) this.dispatch({ type: 'read_scroll', payload: { itemId: item.id } });
    else if (item instanceof WandItem) this.dispatch({ type: 'zap_wand', payload: { itemId: item.id } });
    else this.dispatch({ type: 'equip_item', payload: { itemId: item.id } });
    this.inspector.clearSelection();
  }

  /** Takes an item from wherever the third column shows, or opens it if it's a container. */
  private takeFromColumn3(item: Item): void {
    const source = this.column3Source();
    if (source === 'companion') {
      this.dispatch({ type: 'transfer_from_companion', payload: { itemId: item.id } });
    } else if (item instanceof Container) {
      this.pushContainer(item, 'ground');
      return;
    } else if (source === 'container' && this.activeContainer) {
      this.dispatch({ type: 'loot_container', payload: { container: this.activeContainer, item } });
    } else {
      this.dispatch({ type: 'pickup_item', payload: { itemId: item.id } });
    }
    this.inspector.clearSelection();
  }

  /** A double-click: the item's one primary action. */
  public activateCell(panel: 'backpack' | 'ground', index: number): void {
    const group = this.groups(panel)[index];
    if (!group) return;
    if (panel === 'backpack') this.useOrEquip(group.leadItem);
    else this.takeFromColumn3(group.leadItem);
    this.changed();
  }

  /** A double-click on a worn item takes it off. */
  public activateSlot(index: number): void {
    const slot = this.engine?.player.inventory.paperdoll.getSlotDefinitions()[index];
    if (!slot || !this.engine?.player.inventory.paperdoll.getItem(slot.id)) return;
    this.dispatch({ type: 'unequip_item', payload: { slot: slot.id } });
    this.inspector.clearSelection();
    this.changed();
  }

  public runInspectorAction(index: number): void {
    const engine = this.engine;
    if (!engine) return;
    const action = this.inspector.getAvailableActions(engine)[index];
    if (action?.enabled) {
      action.execute(engine);
      this.changed();
    }
  }

  // ---- Context menu ------------------------------------------------------------------------

  private slotOptions(item: Item, slotId: string): MenuOption[] {
    return [
      { label: 'Unequip', run: () => { this.dispatch({ type: 'unequip_item', payload: { slot: slotId as EquipmentSlot } }); this.inspector.clearSelection(); } },
      { label: 'Inspect', run: () => { this.inspector.setFocus('paperdoll'); this.inspector.select(item, 'paperdoll', slotId); } },
      { label: 'Drop', run: () => { this.dispatch({ type: 'drop_item', payload: { item, source: 'paperdoll', slot: slotId as EquipmentSlot } }); this.inspector.clearSelection(); } },
    ];
  }

  private packOptions(item: Item): MenuOption[] {
    const engine = this.engine;
    const options: MenuOption[] = [];
    const done = () => this.inspector.clearSelection();
    if (item instanceof Container) {
      options.push({ label: 'Open', run: () => this.pushContainer(item, 'backpack') });
    } else if (item instanceof PotionItem) {
      options.push({ label: 'Drink', run: () => { this.dispatch({ type: 'drink_potion', payload: { itemId: item.id } }); done(); } });
    } else if (item instanceof ScrollItem) {
      options.push({ label: 'Read', run: () => { this.dispatch({ type: 'read_scroll', payload: { itemId: item.id } }); done(); } });
    } else if (item instanceof WandItem) {
      options.push({ label: 'Zap', run: () => { this.dispatch({ type: 'zap_wand', payload: { itemId: item.id } }); done(); } });
    } else if (this.slotsFor(item).length > 0) {
      options.push({ label: 'Equip', run: () => { this.dispatch({ type: 'equip_item', payload: { itemId: item.id } }); done(); } });
    }
    if (item.quantity > 1) options.push({ label: 'Split stack…', run: () => this.openSplitDialog(item) });
    if (engine?.companion) {
      options.push({ label: 'Give to companion', run: () => { this.dispatch({ type: 'transfer_to_companion', payload: { itemId: item.id } }); done(); } });
    }
    const container = this.activeContainer;
    if (container) {
      options.push({ label: 'Put in container', run: () => { this.dispatch({ type: 'store_container', payload: { container, item } }); done(); } });
    }
    options.push({ label: 'Drop', run: () => { this.dispatch({ type: 'drop_item', payload: { item, source: 'pack' } }); done(); } });
    options.push({ label: 'Inspect', run: () => { this.inspector.setFocus('backpack'); this.inspector.select(item, 'backpack', undefined, container); } });
    return options;
  }

  private column3Options(item: Item): MenuOption[] {
    const source = this.column3Source();
    const options: MenuOption[] = [];
    if (source === 'companion') {
      options.push({ label: 'Take back', run: () => this.takeFromColumn3(item) });
    } else {
      if (item instanceof Container) options.push({ label: 'Open', run: () => this.pushContainer(item, 'ground') });
      const label = source === 'container' ? 'Take' : 'Pick up';
      options.push({
        label,
        run: () => {
          if (source === 'container' && this.activeContainer) this.dispatch({ type: 'loot_container', payload: { container: this.activeContainer, item } });
          else this.dispatch({ type: 'pickup_item', payload: { itemId: item.id } });
          this.inspector.clearSelection();
        },
      });
    }
    options.push({
      label: 'Inspect',
      run: () => {
        this.inspector.setFocus('ground');
        this.inspector.select(item, source === 'companion' ? 'companion' : source, undefined, this.activeContainer);
      },
    });
    return options;
  }

  /** Right-click on a cell or a worn slot. */
  public openContextMenu(target: { panel: 'backpack' | 'ground'; index: number } | { slotIndex: number }, x: number, y: number): void {
    const engine = this.engine;
    if (!engine) return;
    if ('slotIndex' in target) {
      const slot = engine.player.inventory.paperdoll.getSlotDefinitions()[target.slotIndex];
      const item = slot ? engine.player.inventory.paperdoll.getItem(slot.id) : null;
      if (!slot || !item) return;
      this.contextMenu = { item, source: 'paperdoll', options: this.slotOptions(item, slot.id), x, y };
    } else {
      const group = this.groups(target.panel)[target.index];
      if (!group) return;
      const item = group.leadItem;
      this.contextMenu =
        target.panel === 'backpack'
          ? { item, source: 'backpack', options: this.packOptions(item), x, y }
          : { item, source: this.column3Source(), options: this.column3Options(item), x, y };
    }
    this.changed();
  }

  public runContextOption(index: number): void {
    const option = this.contextMenu?.options[index];
    this.contextMenu = null;
    option?.run();
    this.changed();
  }

  public closeContextMenu(): void {
    if (!this.contextMenu) return;
    this.contextMenu = null;
    this.changed();
  }

  // ---- Drag and drop -----------------------------------------------------------------------

  public startDrag(target: { panel: 'backpack' | 'ground'; index: number } | { slotIndex: number }): DragState | null {
    const engine = this.engine;
    if (!engine) return null;
    if ('slotIndex' in target) {
      const slot = engine.player.inventory.paperdoll.getSlotDefinitions()[target.slotIndex];
      const item = slot ? engine.player.inventory.paperdoll.getItem(slot.id) : null;
      this.drag = slot && item ? { item, source: 'paperdoll', slotId: slot.id } : null;
    } else {
      const group = this.groups(target.panel)[target.index];
      const source: ItemSource = target.panel === 'backpack' ? 'backpack' : this.column3Source();
      this.drag = group ? { item: group.leadItem, source } : null;
    }
    return this.drag;
  }

  /**
   * A drop on a panel: on the paperdoll equips; on the backpack takes off, picks up,
   * loots or takes back; on the third column drops, stores or gives.
   */
  public dropOn(target: ItemPanel): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const { item, source, slotId } = drag;
    if (target === 'paperdoll') {
      if (source !== 'paperdoll') this.dispatch({ type: 'equip_item', payload: { itemId: item.id } });
    } else if (target === 'backpack') {
      if (source === 'paperdoll' && slotId) this.dispatch({ type: 'unequip_item', payload: { slot: slotId as EquipmentSlot } });
      else if (source === 'ground') this.dispatch({ type: 'pickup_item', payload: { itemId: item.id } });
      else if (source === 'container' && this.activeContainer) this.dispatch({ type: 'loot_container', payload: { container: this.activeContainer, item } });
      else if (source === 'companion') this.dispatch({ type: 'transfer_from_companion', payload: { itemId: item.id } });
    } else {
      const column = this.column3Source();
      if (column === 'companion') {
        if (source === 'backpack') this.dispatch({ type: 'transfer_to_companion', payload: { itemId: item.id } });
      } else if (column === 'container' && this.activeContainer) {
        if (source === 'backpack') this.dispatch({ type: 'store_container', payload: { container: this.activeContainer, item } });
      } else if (source === 'backpack') {
        this.dispatch({ type: 'drop_item', payload: { item, source: 'pack' } });
      } else if (source === 'paperdoll' && slotId) {
        this.dispatch({ type: 'drop_item', payload: { item, source: 'paperdoll', slot: slotId as EquipmentSlot } });
      }
    }
    this.inspector.clearSelection();
    this.changed();
  }

  public endDrag(): void {
    this.drag = null;
  }

  // ---- Split stack -------------------------------------------------------------------------

  public openSplitDialog(item: Item): void {
    if (item.quantity <= 1) return;
    this.splitDialog = { item, maxQuantity: item.quantity, amount: Math.floor(item.quantity / 2) || 1 };
    this.changed();
  }

  public adjustSplit(delta: number): void {
    const sd = this.splitDialog;
    if (!sd) return;
    sd.amount = Math.max(1, Math.min(sd.maxQuantity - 1, sd.amount + delta));
    this.changed();
  }

  public confirmSplit(): void {
    const sd = this.splitDialog;
    if (!sd) return;
    this.dispatch({ type: 'split_stack', payload: { item: sd.item, amount: sd.amount } });
    this.closeSplitDialog();
  }

  public closeSplitDialog(): void {
    this.splitDialog = null;
    this.changed();
  }

  // ---- Panel tools -------------------------------------------------------------------------

  public setFilter(filter: BackpackFilter): void {
    this.backpackFilter = filter;
    if (this.inspector.focusedPanel === 'backpack') this.inspector.focusedIndex = 0;
    this.changed();
  }

  /** O: sorts the pack by the next mode (category, value, tier, weight, bulk, name). */
  public sortNext(): void {
    this.sortModeIndex = (this.sortModeIndex + 1) % SORT_MODES.length;
    this.dispatch({ type: 'sort_pack', payload: { mode: SORT_MODES[this.sortModeIndex] } });
    this.changed();
  }

  public get sortMode(): ContainerSortMode {
    return SORT_MODES[this.sortModeIndex % SORT_MODES.length];
  }

  /** C: moves loose coins from the pack into the purse. */
  public consolidateCoins(): void {
    const engine = this.engine;
    if (!engine) return;
    const res = engine.player.inventory.consolidateCoins();
    engine.log(res.count > 0 ? `Consolidated ${res.count} coin stack${res.count > 1 ? 's' : ''} into purse.` : 'No loose coins in backpack to consolidate.');
    this.changed();
  }

  /** Takes everything the third column shows. */
  public takeAll(): void {
    const source = this.column3Source();
    if (source === 'companion') {
      for (const item of this.column3Items()) this.dispatch({ type: 'transfer_from_companion', payload: { itemId: item.id } });
    } else if (source === 'container' && this.activeContainer) {
      this.dispatch({ type: 'loot_all_container', payload: { container: this.activeContainer } });
    } else {
      this.dispatch({ type: 'quick_loot' });
    }
    this.inspector.clearSelection();
    this.changed();
  }

  public setColumn3View(view: 'ground' | 'companion'): void {
    if (view === 'companion' && !this.engine?.companion) return;
    this.column3View = view;
    this.inspector.clearSelection();
    this.inspector.setFocus('ground', 0);
    this.changed();
  }

  // ---- Keys --------------------------------------------------------------------------------

  /** Selects what the focused panel's cursor is on (or clears the selection). */
  private selectFocused(): void {
    const engine = this.engine;
    if (!engine) return;
    const panel = this.inspector.focusedPanel;
    const index = this.inspector.focusedIndex;
    if (panel === 'paperdoll') {
      const slot = engine.player.inventory.paperdoll.getSlotDefinitions()[index];
      const item = slot ? engine.player.inventory.paperdoll.getItem(slot.id) : null;
      if (slot && item) this.inspector.select(item, 'paperdoll', slot.id);
      else this.inspector.clearSelection();
    } else if (panel === 'backpack' || panel === 'ground') {
      const group = this.groups(panel)[index];
      if (group) this.inspector.select(group.leadItem, this.inspectorSourceFor(panel), undefined, this.activeContainer);
      else this.inspector.clearSelection();
    }
  }

  /** How many cursor positions the focused panel has. */
  /**
   * After a key acts on the selected item (E, D), select whatever the focus ring now sits
   * on, stepping back onto the last cell if the item left the end: the ring and the
   * selection stay one thing, and the key works again on the next item.
   */
  private reselectFocused(): void {
    const count = this.focusCount();
    if (count > 0) this.inspector.focusedIndex = Math.min(this.inspector.focusedIndex, count - 1);
    this.selectFocused();
  }

  private focusCount(): number {
    const panel = this.inspector.focusedPanel;
    if (panel === 'paperdoll') return this.engine?.player.inventory.paperdoll.getSlotDefinitions().length ?? 0;
    if (panel === 'backpack' || panel === 'ground') return this.groups(panel).length;
    return 0;
  }

  /**
   * The inventory's keys. Returns false for keys it leaves to the menu: Escape when there
   * is nothing to back out of (the menu closes), Tab past the last panel or before the
   * first (the menu moves to the next tab), the inventory's own key, and anything unused.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    const engine = this.engine;
    if (!engine) return false;
    const code = e.code;
    const done = (): boolean => {
      e.preventDefault?.();
      this.changed();
      return true;
    };

    // The split dialog and the context menu are on top: they take their keys first.
    if (this.splitDialog) {
      if (code === 'Escape') this.splitDialog = null;
      else if (code === 'ArrowLeft' || code === 'ArrowDown') this.splitDialog.amount = Math.max(1, this.splitDialog.amount - 1);
      else if (code === 'ArrowRight' || code === 'ArrowUp') this.splitDialog.amount = Math.min(this.splitDialog.maxQuantity - 1, this.splitDialog.amount + 1);
      else if (code === 'Enter') {
        this.confirmSplit();
        return true;
      }
      return done();
    }
    if (this.contextMenu && code === 'Escape') {
      this.contextMenu = null;
      return done();
    }

    // Escape backs out, one step at a time: the companion view, a selection, an open
    // container. With nothing left, the menu closes.
    if (code === 'Escape' || code === 'Backspace') {
      if (code === 'Escape' && this.column3View === 'companion') {
        this.column3View = 'ground';
        this.inspector.clearSelection();
        return done();
      }
      if (code === 'Escape' && (this.inspector.selectedItem || this.inspector.selectedItemIds.size > 0)) {
        this.inspector.clearSelection();
        return done();
      }
      if (this.popContainer()) return done();
      return false;
    }

    // Tab steps through the four panels; past the last (or before the first) the menu
    // moves on to the next tab.
    if (code === 'Tab') {
      const forward = !e.shiftKey;
      if (this.inspector.atPanelEdge(forward)) return false;
      this.inspector.cyclePanel(forward);
      this.selectFocused();
      return done();
    }

    // Arrows move inside the focused panel: one slot in the paperdoll list, one cell or
    // one row in the grids. A row step off the grid's edge stays put.
    const arrow = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 } as Record<string, number>)[code];
    if (arrow !== undefined) {
      const panel = this.inspector.focusedPanel;
      const count = this.focusCount();
      if (panel === 'inspector' || count === 0) return done();
      const isRow = Math.abs(arrow) === 2;
      const rowStep = panel === 'backpack' || panel === 'ground' ? this.gridColumns[panel] : 1;
      const current = this.inspector.focusedIndex;
      let next = current + (isRow ? Math.sign(arrow) * rowStep : arrow);
      if (isRow && (next < 0 || next >= count)) {
        next = arrow > 0 && Math.floor(current / rowStep) < Math.floor((count - 1) / rowStep) ? count - 1 : current;
      }
      this.inspector.focusedIndex = Math.max(0, Math.min(count - 1, next));
      this.selectFocused();
      return done();
    }

    // Enter / Space: open a container, else the selected item's first available action.
    if (code === 'Enter' || code === 'Space') {
      const panel = this.inspector.focusedPanel;
      const index = this.inspector.focusedIndex;
      const selected = this.inspector.selectedItem;
      if (panel === 'paperdoll' && selected instanceof Container) {
        this.pushContainer(selected, 'paperdoll');
        return done();
      }
      if (panel === 'backpack' || panel === 'ground') {
        const lead = this.groups(panel)[index]?.leadItem;
        if (lead instanceof Container) {
          this.pushContainer(lead, panel === 'backpack' ? 'backpack' : 'ground');
          return done();
        }
        if (panel === 'ground' && this.column3Source() === 'companion' && lead) {
          this.takeFromColumn3(lead);
          return done();
        }
      }
      this.inspector.executePrimaryAction(engine);
      return done();
    }

    const selected = this.inspector.selectedItem;
    const source = this.inspector.selectedSource;

    // Each letter claims its key only when it acts, so with nothing to act on E and P
    // (also the Character and Pacts keys) fall through to the menu and switch tabs.
    switch (code) {
      case 'KeyE': {
        // Equip from the pack, take off from the paperdoll.
        if (source === 'paperdoll' && this.inspector.selectedSlot) {
          this.dispatch({ type: 'unequip_item', payload: { slot: this.inspector.selectedSlot } });
          this.reselectFocused();
        } else if (source === 'backpack' && selected) {
          this.dispatch({ type: 'equip_item', payload: { itemId: selected.id } });
          this.reselectFocused();
        } else {
          return false;
        }
        return done();
      }
      case 'KeyU': {
        if (selected instanceof RuneOfReturnItem) {
          this.channelRune();
          return true;
        }
        if (!(selected instanceof PotionItem || selected instanceof ScrollItem || selected instanceof WandItem)) return false;
        this.useOrEquip(selected);
        return done();
      }
      case 'KeyY': {
        const identify = this.inspector.getAvailableActions(engine).find((a) => a.id === 'identify');
        if (identify?.enabled) identify.execute(engine);
        else if (identify) engine.log(identify.reason ?? 'You cannot identify that right now.');
        else engine.log('Select an unidentified item you are carrying to identify it.');
        return done();
      }
      case 'KeyM': {
        if (!(selected instanceof RuneOfReturnItem)) return false;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
        return true;
      }
      case 'KeyD': {
        if (!selected) return false;
        const worn = source === 'paperdoll';
        this.dispatch({
          type: 'drop_item',
          payload: { item: selected, source: worn ? 'paperdoll' : 'pack', slot: worn ? this.inspector.selectedSlot : undefined },
        });
        this.reselectFocused();
        return done();
      }
      case 'KeyT': {
        if (selected && (source === 'ground' || source === 'container' || source === 'companion')) {
          this.takeFromColumn3(selected);
        } else if (selected instanceof RuneOfReturnItem && source === 'backpack') {
          this.channelRune();
          return true;
        } else {
          return false;
        }
        return done();
      }
      case 'KeyP': {
        const container = this.activeContainer;
        if (!container || !selected || source !== 'backpack') return false;
        this.dispatch({ type: 'store_container', payload: { container, item: selected } });
        this.inspector.clearSelection();
        return done();
      }
      case 'KeyG': {
        if (!selected || source !== 'backpack') return false;
        if (!engine.companion) {
          engine.log('You have no companion here to give items to.');
        } else {
          this.dispatch({ type: 'transfer_to_companion', payload: { itemId: selected.id } });
          this.inspector.clearSelection();
        }
        return done();
      }
      case 'KeyK': {
        if (!engine.companion) engine.log('You have no companion here.');
        else this.setColumn3View(this.column3View === 'companion' ? 'ground' : 'companion');
        return done();
      }
      case 'KeyC':
        this.consolidateCoins();
        return true;
      case 'KeyS':
        this.sortNext();
        return true;
    }

    // 1-9 equip the backpack cell with that number (shown on the cell while unfiltered).
    if (/^Digit[1-9]$/.test(code) && this.backpackFilter === 'all') {
      const group = this.groups('backpack')[Number(code.slice(5)) - 1];
      if (group) {
        this.dispatch({ type: 'equip_item', payload: { itemId: group.leadItem.id } });
        return done();
      }
    }

    return false;
  }

  private channelRune(): void {
    const engine = this.engine;
    if (!engine) return;
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(engine.player));
    this.reset();
    this.onDismiss?.();
  }

  /** What the inventory weighs against what the hero can carry, for the load line. */
  public load(): { grams: number; maxGrams: number; bulk: number; maxBulk: number; level: string; costPct: number } {
    const player = this.engine?.player;
    if (!player) return { grams: 0, maxGrams: 0, bulk: 0, maxBulk: 0, level: '', costPct: 100 };
    const inv = player.inventory;
    return {
      grams: inv.totalWeight(),
      maxGrams: player.strength * 2500,
      bulk: inv.primaryPack.containedBulk(),
      maxBulk: inv.primaryPack.maxBulkCapacity,
      level: inv.getEncumbrance(player.strength),
      costPct: Math.round(inv.getEncumbranceMultiplier(player.strength) * 100),
    };
  }
}
