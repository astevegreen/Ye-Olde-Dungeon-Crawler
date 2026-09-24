import { GameEngine } from '../engine';
import { Item, type EquipmentSlot } from '../engine';
import { Container } from '../engine';
import { EncumbranceLevel } from '../engine';
import { SpriteAtlas } from './atlas/sprite-atlas';
import { getItemSpriteKey } from './atlas/sprite-mapper';
import { PotionItem, ScrollItem, WandItem } from '../engine';
import { RuneOfReturnItem, ChannelRuneOfReturnAction } from '../engine';
import { resolveThemeTokens } from './theme';
import type { ThemeTokens } from '../engine';
import { PaperdollView } from './paperdoll-view';
import { ItemInspector } from '../ui/inventory/itemInspector';
import { type GameCommand, type GameCommandBus } from '../engine';
import { COIN_COLORS, parseCoinItem } from '../engine';
import type { UIModal } from '../ui/modalStack';
import type { ClickZone } from './types';

export interface ContainerNavEntry {
  container: Container;
  source: 'backpack' | 'ground' | 'paperdoll';
  title: string;
}

export interface DisplayItemGroup {
  leadItem: Item;
  items: Item[];
  totalQuantity: number;
  totalWeight: number;
  displayName: string;
}

export function groupItemsForDisplay(items: readonly Item[]): DisplayItemGroup[] {
  const groups: DisplayItemGroup[] = [];
  const keyToGroup = new Map<string, DisplayItemGroup>();

  for (const item of items) {
    if (item instanceof Container) {
      groups.push({
        leadItem: item,
        items: [item],
        totalQuantity: item.quantity,
        totalWeight: item.weight,
        displayName: item.displayName,
      });
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

/**
 * ARCHITECTURAL NOTE: GameCommandBus Pattern
 *
 * This overlay dispatches inventory actions through a GameCommandBus rather than
 * directly instantiating engine Action classes. This decouples rendering from
 * the engine's action implementation details.
 *
 * To extend: add a case to the commandBus.dispatch() switch and dispatch a
 * GameCommand from any UI event handler.
 *
 * Other overlays (ShopOverlay, etc.) should migrate to this pattern.
 * See: src/engine/commands/commandBus.ts
 */
export class InventoryOverlay implements UIModal {
  public readonly id = 'inventory';
  public isOpen = false;
  /**
   * Companion pack browser (ARCHITECTURE.md §3). Giving items was one-directional because
   * nothing listed what the companion was carrying; this view is the missing half.
   */
  private companionViewOpen = false;
  private companionIndex = 0;

  private clickZones: ClickZone[] = [];
  private rightClickZones: ClickZone[] = [];
  private doubleClickZones: ClickZone[] = [];
  /** Grid-cell hover tracking (inventory note: icons were tiny and names got cut
   * off in the old row layout; square cells fix the layout, this fills in the
   * "how do I see the full name without clicking" gap with a tooltip). Rebuilt
   * every render(), hit-tested in handleMouseMove against the last known cursor
   * position — mirrors the clickZones pattern above. */
  private hoverZones: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    item: Item;
    displayName: string;
    totalWeight: number;
    coinColor?: string;
  }> = [];
  private hoveredGroup: { item: Item; displayName: string; totalWeight: number; coinColor?: string } | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;

  public containerNavStack: ContainerNavEntry[] = [];
  public selectedGroundContainer: Container | null = null;
  public selectedPackContainer: Container | null = null;

  public scrollOffsets: Record<'backpack' | 'ground', number> = { backpack: 0, ground: 0 };
  private visibleRows: Record<'backpack' | 'ground', number> = { backpack: 1, ground: 1 };
  private maxScrollOffsets: Record<'backpack' | 'ground', number> = { backpack: 0, ground: 0 };
  private panelBounds: Partial<Record<'backpack' | 'ground', { x: number; y: number; width: number; height: number }>> = {};

  private onStateChanged?: () => void;
  public atlas?: SpriteAtlas;
  private theme?: Required<ThemeTokens>;
  
  public engine?: GameEngine;

  public readonly paperdollView: PaperdollView;
  public readonly inspector: ItemInspector;

  public hoveredSlot: string | null = null;
  public hoveredBackpackIndex: number | null = null;
  public hoveredGroundIndex: number | null = null;
  public sortModeIndex: number = 0;
  
  public commandBus: GameCommandBus = {
    dispatch: (cmd: GameCommand) => {
      if (!this.engine) return { success: false, message: 'No engine attached' };
      return this.engine.commandBus.dispatch(cmd);
    },
  };

  constructor(onStateChanged?: () => void, atlas?: SpriteAtlas) {
    this.onStateChanged = onStateChanged;
    this.atlas = atlas;
    this.paperdollView = new PaperdollView(atlas);
    this.inspector = new ItemInspector();
  }

  /**
   * For backwards compatibility with any inspect tests.
   */
  public get hoveredItem(): Item | null {
    return this.inspector.selectedItem;
  }

  public get activeContainer(): Container | null {
    if (this.containerNavStack.length > 0) {
      return this.containerNavStack[this.containerNavStack.length - 1].container;
    }
    return this.selectedPackContainer || this.selectedGroundContainer;
  }

  public pushContainer(container: Container, source: 'backpack' | 'ground' | 'paperdoll', title?: string): void {
    this.containerNavStack.push({
      container,
      source,
      title: title ?? container.displayName,
    });
    if (source === 'ground') {
      this.selectedGroundContainer = container;
      this.selectedPackContainer = null;
    } else if (source === 'backpack') {
      this.selectedPackContainer = container;
      this.selectedGroundContainer = null;
    } else {
      this.selectedGroundContainer = null;
      this.selectedPackContainer = null;
    }
    if (!container.wasOpened) {
      this.commandBus.dispatch({ type: 'open_container', payload: { container } });
    }
    this.scrollOffsets['ground'] = 0;
    this.inspector.clearSelection();
    this.inspector.setFocus('ground', 0);
  }

  public popContainer(): boolean {
    if (this.containerNavStack.length === 0) {
      if (this.selectedGroundContainer || this.selectedPackContainer) {
        this.selectedGroundContainer = null;
        this.selectedPackContainer = null;
        this.scrollOffsets['ground'] = 0;
        this.inspector.clearSelection();
        return true;
      }
      return false;
    }
    this.containerNavStack.pop();
    const top = this.containerNavStack[this.containerNavStack.length - 1];
    if (top) {
      if (top.source === 'ground') {
        this.selectedGroundContainer = top.container;
        this.selectedPackContainer = null;
      } else if (top.source === 'backpack') {
        this.selectedPackContainer = top.container;
        this.selectedGroundContainer = null;
      } else {
        this.selectedGroundContainer = null;
        this.selectedPackContainer = null;
      }
    } else {
      this.selectedGroundContainer = null;
      this.selectedPackContainer = null;
    }
    this.scrollOffsets['ground'] = 0;
    this.inspector.clearSelection();
    return true;
  }

  public handleWheel(mouseX: number, mouseY: number, deltaY: number): boolean {
    if (!this.isOpen) return false;
    for (const p of ['backpack', 'ground'] as const) {
      const b = this.panelBounds[p];
      if (b && mouseX >= b.x && mouseX <= b.x + b.width && mouseY >= b.y && mouseY <= b.y + b.height) {
        if (deltaY > 0) {
          this.scrollOffsets[p] = Math.min(this.maxScrollOffsets[p], this.scrollOffsets[p] + 1);
        } else if (deltaY < 0) {
          this.scrollOffsets[p] = Math.max(0, this.scrollOffsets[p] - 1);
        }
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
    }
    return false;
  }

  public ensureVisible(panel: 'backpack' | 'ground', index: number, cols: number): void {
    if (cols <= 0) return;
    const targetRow = Math.floor(index / cols);
    const currentScroll = this.scrollOffsets[panel];
    const visRows = this.visibleRows[panel] || 1;
    if (targetRow < currentScroll) {
      this.scrollOffsets[panel] = targetRow;
    } else if (targetRow >= currentScroll + visRows) {
      this.scrollOffsets[panel] = targetRow - visRows + 1;
    }
  }

  public toggle(engine?: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public onClose?: () => void;
  private closeListeners: Array<() => void> = [];
  /** Columns each item grid drew with last render, so arrow keys move by cell/row. */
  private gridColumns: Record<'backpack' | 'ground', number> = { backpack: 1, ground: 1 };

  /** Notified after every close, alongside the single `onClose` slot InputHandler owns. */
  public addCloseListener(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  public open(engine?: GameEngine): void {
    if (engine) this.engine = engine;
    this.isOpen = true;
    this.inspector.clearSelection();
    this.inspector.setFocus('paperdoll', 0);
    this.containerNavStack = [];
    this.selectedGroundContainer = null;
    this.selectedPackContainer = null;
    this.scrollOffsets = { backpack: 0, ground: 0 };
    if (engine) {
      const res = engine.player.inventory.consolidateCoins();
      if (res.count > 0) {
        engine.log(`Auto-consolidated ${res.count} coin stack${res.count > 1 ? 's' : ''} into purse.`);
      }
    }
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public close(): void {
    this.companionViewOpen = false;
    this.isOpen = false;
    this.inspector.clearSelection();
    this.hoveredSlot = null;
    this.hoveredBackpackIndex = null;
    this.hoveredGroundIndex = null;
    this.selectedGroundContainer = null;
    this.selectedPackContainer = null;
    this.containerNavStack = [];
    this.scrollOffsets = { backpack: 0, ground: 0 };
    if (this.onClose) {
      this.onClose();
    }
    for (const listener of this.closeListeners) listener();
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public onPop(): void {
    this.close();
  }

  /** Shared by handleMouseMove and the three click handlers below — a click
   * changes the mouse position too (a `dblclick`/`contextmenu` event fires
   * with no preceding `mousemove` on some input paths), and without this the
   * hover tooltip could keep showing whatever was hovered before the click. */
  private updateHoverAt(mouseX: number, mouseY: number): void {
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    const zone = this.hoverZones.find(
      (z) => mouseX >= z.x && mouseX <= z.x + z.width && mouseY >= z.y && mouseY <= z.y + z.height
    );
    this.hoveredGroup = zone
      ? { item: zone.item, displayName: zone.displayName, totalWeight: zone.totalWeight, coinColor: zone.coinColor }
      : null;
  }

  public handleMouseMove(mouseX: number, mouseY: number): boolean {
    if (!this.isOpen) {
      this.hoveredSlot = null;
      this.hoveredBackpackIndex = null;
      this.hoveredGroundIndex = null;
      this.hoveredGroup = null;
      return false;
    }
    this.updateHoverAt(mouseX, mouseY);
    return true;
  }

  public handleClick(mouseX: number, mouseY: number, isMultiModifier: boolean = false): boolean {
    if (!this.isOpen) return false;
    this.updateHoverAt(mouseX, mouseY);

    for (let i = this.clickZones.length - 1; i >= 0; i--) {
      const zone = this.clickZones[i];
      if (
        mouseX >= zone.x &&
        mouseX <= zone.x + zone.width &&
        mouseY >= zone.y &&
        mouseY <= zone.y + zone.height
      ) {
        zone.action(isMultiModifier);
        if (this.onStateChanged) {
          this.onStateChanged();
        }
        return true;
      }
    }

    // Clicking empty space "clicks off" the current selection.
    if (this.inspector.selectedItem || this.inspector.selectedItemIds.size > 0) {
      this.inspector.clearSelection();
      if (this.onStateChanged) this.onStateChanged();
    }
    return true; // Consume clicks when overlay is open
  }

  public handleDoubleClick(mouseX: number, mouseY: number, _engine?: GameEngine): boolean {
    if (!this.isOpen) return false;
    this.updateHoverAt(mouseX, mouseY);

    for (let i = this.doubleClickZones.length - 1; i >= 0; i--) {
      const zone = this.doubleClickZones[i];
      if (
        mouseX >= zone.x &&
        mouseX <= zone.x + zone.width &&
        mouseY >= zone.y &&
        mouseY <= zone.y + zone.height
      ) {
        zone.action();
        if (this.onStateChanged) {
          this.onStateChanged();
        }
        return true;
      }
    }

    return true;
  }

  public handleRightClick(mouseX: number, mouseY: number, _engine: GameEngine): boolean {
    if (!this.isOpen) return false;
    this.updateHoverAt(mouseX, mouseY);

    for (let i = this.rightClickZones.length - 1; i >= 0; i--) {
      const zone = this.rightClickZones[i];
      if (
        mouseX >= zone.x &&
        mouseX <= zone.x + zone.width &&
        mouseY >= zone.y &&
        mouseY <= zone.y + zone.height
      ) {
        zone.action();
        if (this.onStateChanged) {
          this.onStateChanged();
        }
        return true;
      }
    }

    return true;
  }

  /**
   * Keyboard handler for all inventory navigation and actions.
   */
  public handleKeyDown(eOrCode: KeyboardEvent | string, engineParam?: GameEngine): boolean {
    if (!this.isOpen) return false;
    const code = typeof eOrCode === 'string' ? eOrCode : eOrCode.code;
    const engine = engineParam ?? this.engine;
    if (!engine) return false;
    this.engine = engine;
    const player = engine.player;
    const inv = player.inventory;
    const doll = inv.paperdoll;

    // 1. Close overlay or sub-views. The companion browser is a sub-view, so Escape backs out of it first.
    if (code === 'Escape' && this.companionViewOpen) {
      this.companionViewOpen = false;
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }
    // Escape backs out of a selection before it closes the overlay or pops container.
    if (code === 'Escape' && (this.inspector.selectedItem || this.inspector.selectedItemIds.size > 0)) {
      this.inspector.clearSelection();
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }
    // Escape or Backspace backs out of opened containers!
    if ((code === 'Escape' || code === 'Backspace') && (this.containerNavStack.length > 0 || this.selectedGroundContainer || this.selectedPackContainer)) {
      this.popContainer();
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }
    if (code === 'KeyI' || code === 'Escape') {
      this.close();
      return true;
    }

    // 2. Tab: cycle panels
    if (code === 'Tab') {
      this.inspector.cyclePanel(true);
      const panel = this.inspector.focusedPanel;
      if (panel === 'paperdoll') {
        const slots = doll.getSlotDefinitions();
        if (slots.length > 0) {
          const slot = slots[0];
          const item = doll.getItem(slot.id);
          this.inspector.select(item, 'paperdoll', slot.id);
        }
      } else if (panel === 'backpack') {
        const packItems = inv.primaryPack.getItems();
        const groups = groupItemsForDisplay(packItems);
        if (groups.length > 0) {
          this.inspector.select(groups[0].leadItem, 'backpack');
        } else {
          this.inspector.clearSelection();
        }
      } else if (panel === 'ground') {
        const activeContainer = this.activeContainer;
        const items = activeContainer
          ? activeContainer.getItems()
          : engine.map.getItemsAt(player.x, player.y);
        const groups = groupItemsForDisplay(items);
        if (groups.length > 0) {
          const src = activeContainer ? 'container' : 'ground';
          this.inspector.select(groups[0].leadItem, src, undefined, activeContainer);
        } else {
          this.inspector.clearSelection();
        }
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 3. Arrow keys: navigate inside focused panel. The backpack and ground/container
    //    panels are drawn as grids, so Left/Right step one cell and Up/Down one row;
    //    the paperdoll is a slot list, so every arrow steps one slot.
    const ARROW_STEPS: Record<string, 'prev' | 'next' | 'up' | 'down'> = {
      ArrowLeft: 'prev',
      ArrowRight: 'next',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    const arrow = ARROW_STEPS[code];
    if (arrow && !this.companionViewOpen) {
      const panel = this.inspector.focusedPanel;
      const rowStep = panel === 'backpack' || panel === 'ground' ? this.gridColumns[panel] : 1;
      const delta = arrow === 'next' ? 1 : arrow === 'prev' ? -1 : arrow === 'down' ? rowStep : -rowStep;
      const step = (count: number): number | null => {
        if (count === 0) return null;
        const target = this.inspector.focusedIndex + delta;
        // A row step off the grid's edge stays put rather than wrapping sideways.
        if ((arrow === 'up' || arrow === 'down') && (target < 0 || target >= count)) {
          return arrow === 'down' && Math.floor(this.inspector.focusedIndex / rowStep) < Math.floor((count - 1) / rowStep)
            ? count - 1
            : this.inspector.focusedIndex;
        }
        return Math.max(0, Math.min(count - 1, target));
      };

      if (panel === 'paperdoll') {
        const slots = doll.getSlotDefinitions();
        const next = step(slots.length);
        if (next !== null) {
          this.inspector.focusedIndex = next;
          const slot = slots[next];
          this.inspector.select(doll.getItem(slot.id), 'paperdoll', slot.id);
        }
      } else if (panel === 'backpack') {
        const packItems = inv.primaryPack.getItems();
        const groups = groupItemsForDisplay(packItems);
        const next = step(groups.length);
        if (next !== null) {
          this.inspector.focusedIndex = next;
          this.inspector.select(groups[next].leadItem, 'backpack');
          this.ensureVisible('backpack', next, this.gridColumns['backpack']);
        }
      } else if (panel === 'ground') {
        const activeContainer = this.activeContainer;
        const items = activeContainer ? activeContainer.getItems() : engine.map.getItemsAt(player.x, player.y);
        const groups = groupItemsForDisplay(items);
        const next = step(groups.length);
        if (next !== null) {
          this.inspector.focusedIndex = next;
          this.inspector.select(groups[next].leadItem, activeContainer ? 'container' : 'ground', undefined, activeContainer);
          this.ensureVisible('ground', next, this.gridColumns['ground']);
        }
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 4. Enter / Space: Primary contextual action or selection
    if (code === 'Enter' || code === 'Space') {
      const panel = this.inspector.focusedPanel;
      if (panel === 'paperdoll') {
        const item = this.inspector.selectedItem;
        if (item instanceof Container) {
          this.pushContainer(item, 'paperdoll', item.displayName);
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
      if (panel === 'backpack') {
        const packItems = inv.primaryPack.getItems();
        const groups = groupItemsForDisplay(packItems);
        const focusedGroup = groups[this.inspector.focusedIndex];
        if (focusedGroup?.leadItem instanceof Container) {
          this.pushContainer(focusedGroup.leadItem, 'backpack', focusedGroup.leadItem.displayName);
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
      if (panel === 'ground') {
        const activeContainer = this.activeContainer;
        const groundItems = activeContainer ? activeContainer.getItems() : engine.map.getItemsAt(player.x, player.y);
        const groups = groupItemsForDisplay(groundItems);
        const focusedGroup = groups[this.inspector.focusedIndex];
        if (focusedGroup?.leadItem instanceof Container) {
          this.pushContainer(focusedGroup.leadItem, activeContainer ? 'ground' : 'ground', focusedGroup.leadItem.displayName);
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
      const executed = this.inspector.executePrimaryAction(engine);
      if (executed && this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 5. KeyE: Contextual Equip / Unequip
    if (code === 'KeyE') {
      if (this.inspector.selectedSource === 'paperdoll' && this.inspector.selectedSlot) {
        this.commandBus.dispatch({ type: 'unequip_item', payload: { slot: this.inspector.selectedSlot } });
        this.inspector.clearSelection();
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      if (this.inspector.selectedSource === 'backpack' && this.inspector.selectedItem) {
        this.commandBus.dispatch({ type: 'equip_item', payload: { itemId: this.inspector.selectedItem.id } });
        this.inspector.clearSelection();
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      // If nothing selected, unequip first equipped item
      const equipped = doll.getAllEquipped().filter((e) => e.slot !== 'pack' && e.slot !== 'purse');
      if (equipped.length > 0) {
        this.commandBus.dispatch({ type: 'unequip_item', payload: { slot: equipped[0].slot } });
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
    }

    // 6. KeyU: Contextual Use / Drink / Read consumable
    if (code === 'KeyU') {
      const item = this.inspector.selectedItem;
      if (item) {
        if (item instanceof PotionItem) {
          this.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: item.id } });
          this.inspector.clearSelection();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
        if (item instanceof ScrollItem) {
          this.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: item.id } });
          this.inspector.clearSelection();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
        if (item instanceof WandItem) {
          this.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: item.id } });
          this.inspector.clearSelection();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
        if (item instanceof RuneOfReturnItem) {
          engine.handlePlayerAction(new ChannelRuneOfReturnAction(engine.player));
          this.close();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
    }

    // KeyY: Identify the selected unidentified item (scroll or spell, via the inspector)
    if (code === 'KeyY') {
      const identify = this.inspector.getAvailableActions(engine).find((a) => a.id === 'identify');
      if (identify?.enabled) {
        identify.execute(engine);
      } else if (identify) {
        engine.log(identify.reason ?? 'You cannot identify that right now.');
      } else {
        engine.log('Select an unidentified item you are carrying to identify it.');
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // KeyM: Open Rune Mastery Tree if Rune of Return is inspected
    if (code === 'KeyM' && this.inspector.selectedItem instanceof RuneOfReturnItem) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
      }
      return true;
    }

    // 7. KeyD: Contextual Drop
    if (code === 'KeyD') {
      if (this.inspector.selectedItem) {
        const isPaperdoll = this.inspector.selectedSource === 'paperdoll';
        this.commandBus.dispatch({
          type: 'drop_item',
          payload: {
            item: this.inspector.selectedItem,
            source: isPaperdoll ? 'paperdoll' : 'pack',
            slot: isPaperdoll ? this.inspector.selectedSlot : undefined,
          },
        });
        this.inspector.clearSelection();
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      // Fallback: drop first item in backpack
      const packItems = inv.primaryPack.getItems();
      if (packItems.length > 0) {
        this.commandBus.dispatch({ type: 'drop_item', payload: { item: packItems[0], source: 'pack' } });
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
    }

    // 8. KeyT: Take / Pick up item from ground or container
    if (code === 'KeyT') {
      if (this.inspector.selectedItem) {
        if (this.inspector.selectedSource === 'ground') {
          this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: this.inspector.selectedItem.id } });
          this.inspector.clearSelection();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
        const activeContainer = this.activeContainer;
        if (this.inspector.selectedSource === 'container' && activeContainer) {
          this.commandBus.dispatch({
            type: 'loot_container',
            payload: { container: activeContainer, item: this.inspector.selectedItem },
          });
          this.inspector.clearSelection();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
        if (this.inspector.selectedItem instanceof RuneOfReturnItem && this.inspector.selectedSource === 'backpack') {
          engine.handlePlayerAction(new ChannelRuneOfReturnAction(engine.player));
          this.close();
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
    }

    // 9. KeyP: Put / Store into open ground or carried container
    const activeContainer = this.activeContainer;
    if (code === 'KeyP' && activeContainer && this.inspector.selectedItem && this.inspector.selectedSource === 'backpack') {
      this.commandBus.dispatch({
        type: 'store_container',
        payload: { container: activeContainer, item: this.inspector.selectedItem },
      });
      this.inspector.clearSelection();
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 9a-bis. Companion pack browser: KeyK opens it, arrows move, Enter takes an item.
    // (KeyT is already "take from ground/container" above, and KeyG gives to the companion.)
    if (this.companionViewOpen) {
      const packItems = engine.companion?.inventory.primaryPack.getItems() ?? [];
      if (code === 'Escape' || code === 'KeyK') {
        this.companionViewOpen = false;
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      if (code === 'ArrowDown' || code === 'ArrowUp') {
        if (packItems.length > 0) {
          const delta = code === 'ArrowDown' ? 1 : -1;
          this.companionIndex = (this.companionIndex + delta + packItems.length) % packItems.length;
        }
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      if (code === 'Enter' || code === 'KeyG') {
        const item = packItems[this.companionIndex];
        if (!item) {
          engine.log('Your companion is carrying nothing.');
        } else {
          const res = this.commandBus.dispatch({
            type: 'transfer_from_companion',
            payload: { itemId: item.id },
          });
          if (!res.success && res.message) engine.log(res.message);
          const remaining = engine.companion?.inventory.primaryPack.getItems().length ?? 0;
          if (this.companionIndex >= remaining) this.companionIndex = Math.max(0, remaining - 1);
        }
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
      // Any other key is swallowed so the browser behaves like a focused panel.
      return true;
    }

    if (code === 'KeyK') {
      if (!engine.companion) {
        engine.log('You have no companion here.');
      } else {
        this.companionViewOpen = true;
        this.companionIndex = 0;
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 9b. KeyG: Give selected backpack item to the active companion's pack
    // (Companions & Pet Progression, Phase 2 — docs/architecture/content-companions.md). One-
    // directional from this overlay; taking an item back is dispatched the same
    // way ('transfer_from_companion') but has no browsing UI for the companion's
    // pack yet — a further UI enhancement, not built in this pass.
    if (code === 'KeyG' && this.inspector.selectedItem && this.inspector.selectedSource === 'backpack') {
      if (!engine.companion) {
        engine.log('You have no companion here to give items to.');
      } else {
        this.commandBus.dispatch({
          type: 'transfer_to_companion',
          payload: { itemId: this.inspector.selectedItem.id },
        });
        this.inspector.clearSelection();
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 10. KeyC: Consolidate loose coins into purse
    if (code === 'KeyC') {
      const res = inv.consolidateCoins();
      if (res.count > 0) {
        engine.log(`Consolidated ${res.count} coin stack${res.count > 1 ? 's' : ''} into purse.`);
      } else {
        engine.log('No loose coins in backpack to consolidate.');
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 11. KeyO: Cycle sort pack items (category -> weight -> bulk)
    if (code === 'KeyO') {
      this.sortModeIndex = (this.sortModeIndex + 1) % 3;
      const modes: Array<'category' | 'weight' | 'bulk'> = ['category', 'weight', 'bulk'];
      const selected = modes[this.sortModeIndex];
      this.commandBus.dispatch({ type: 'sort_pack', payload: { mode: selected } });
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 12. Digit1-Digit9: Quick equip item from pack at index
    if (code.startsWith('Digit')) {
      const digit = parseInt(code.replace('Digit', ''), 10);
      const index = digit - 1;
      const packItems = inv.primaryPack.getItems();
      if (packItems[index]) {
        this.commandBus.dispatch({ type: 'equip_item', payload: { itemId: packItems[index].id } });
        if (this.onStateChanged) this.onStateChanged();
        return true;
      }
    }

    return false;
  }

/** One row's worth of behavior for `renderItemGrid` below — the three item lists
   * (backpack, ground, an opened container) each supply their own selection state
   * and click semantics, but share the same square-cell layout, sprite, and
   * hover/click-zone wiring. */
  private renderItemGrid(
    ctx: CanvasRenderingContext2D,
    items: readonly Item[],
    x: number,
    y: number,
    width: number,
    height: number,
    theme: Required<ThemeTokens>,
    font: string,
    opts: {
      /** Which keyboard panel this grid is; its column count drives Up/Down steps. */
      panel: 'backpack' | 'ground';
      emptyLabel: string;
      showIndexTag?: boolean;
      isSelected: (item: Item, index: number) => boolean;
      isFocused: (item: Item, index: number) => boolean;
      isMultiSelected?: (item: Item) => boolean;
      onSelect: (item: Item, index: number, isMultiMod?: boolean) => void;
      /** Double-click and right-click both trigger this — the item's one
       * "primary action" (equip/consume, open, or take/pickup depending on
       * which list this is), matching the single-gesture convention the old
       * per-row row buttons used to need a dedicated hit-zone for. */
      onActivate: (item: Item, index: number) => void;
    }
  ): void {
    const groups = groupItemsForDisplay(items);

    if (groups.length === 0) {
      ctx.font = `italic 11px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opts.emptyLabel, x + 10, y + 14);
      return;
    }

    const gap = 4;
    let rawCols = Math.max(2, Math.floor((width - gap) / (50 + gap)));
    let rawCellSize = Math.max(40, Math.min(64, Math.floor((width - gap * (rawCols + 1)) / rawCols)));
    let rawRows = Math.max(1, Math.floor((height - gap) / (rawCellSize + gap)));
    let totalRows = Math.ceil(groups.length / rawCols);

    const hasScrollbar = totalRows > rawRows;
    const scrollTrackW = hasScrollbar ? 14 : 0;
    const gridW = width - scrollTrackW - (hasScrollbar ? 2 : 0);

    const cols = Math.max(2, Math.floor((gridW - gap) / (50 + gap)));
    const cellSize = Math.max(40, Math.min(64, Math.floor((gridW - gap * (cols + 1)) / cols)));
    const rows = Math.max(1, Math.floor((height - gap) / (cellSize + gap)));
    totalRows = Math.ceil(groups.length / cols);

    this.gridColumns[opts.panel] = cols;
    this.visibleRows[opts.panel] = rows;
    const maxScroll = Math.max(0, totalRows - rows);
    this.maxScrollOffsets[opts.panel] = maxScroll;
    this.scrollOffsets[opts.panel] = Math.max(0, Math.min(maxScroll, this.scrollOffsets[opts.panel]));
    const scrollRow = this.scrollOffsets[opts.panel];

    const startIndex = scrollRow * cols;
    const maxVisible = cols * rows;
    const endIndex = Math.min(groups.length, startIndex + maxVisible);

    const truncate = (text: string, maxWidth: number): string => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let end = text.length;
      while (end > 1 && ctx.measureText(text.slice(0, end) + '…').width > maxWidth) end--;
      return text.slice(0, end) + '…';
    };

    for (let i = startIndex; i < endIndex; i++) {
      const group = groups[i];
      const it = group.leadItem;
      const localIdx = i - startIndex;
      const col = localIdx % cols;
      const row = Math.floor(localIdx / cols);
      const cellX = x + gap + col * (cellSize + gap);
      const cellY = y + gap + row * (cellSize + gap);

      const isCursed = it.isCursed() && it.identified;
      const isEnchanted = it.identified && it.quality === 'enchanted';
      const isContainer = it instanceof Container;
      const selected = group.items.some((item) => opts.isSelected(item, i));
      const focused = opts.isFocused(it, i);
      const multiSelected = group.items.some((item) => opts.isMultiSelected?.(item));

      const coinInfo = parseCoinItem(it);
      const coinColor = coinInfo ? COIN_COLORS[coinInfo.denomination] : undefined;

      ctx.fillStyle = selected
        ? 'rgba(56, 189, 248, 0.25)'
        : focused
        ? 'rgba(56, 189, 248, 0.15)'
        : coinColor
        ? 'rgba(15, 23, 42, 0.9)'
        : theme.modalBg;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      const borderColor = multiSelected
        ? '#38bdf8'
        : isCursed
        ? '#ef4444'
        : selected || focused
        ? theme.hudAccent
        : coinColor ?? theme.cardBorder;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = selected || focused || multiSelected ? 1.5 : coinColor ? 1.5 : 1;
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

      // Sprite, sized to fill most of the cell (paperdoll-view.ts's square-slot
      // precedent) — this is the actual fix for "icons are small": 16px rows
      // become cells this large, icon included.
      const nameplateH = 13;
      const spriteArea = cellSize - nameplateH - 6;
      if (this.atlas) {
        const spriteKey = getItemSpriteKey(it, (k) => this.atlas?.hasSprite(k) ?? false);
        const spriteSize = Math.max(16, Math.min(spriteArea, cellSize - 8));
        const spriteX = cellX + Math.floor((cellSize - spriteSize) / 2);
        const spriteY = cellY + 4;
        this.atlas.drawSprite(ctx, spriteKey, spriteX, spriteY, spriteSize);
      }

      // Name, truncated to the cell's width rather than a fixed character count
      // — still short, but the tooltip (see render()) carries the full name.
      ctx.font = `9px ${font}`;
      ctx.fillStyle = coinColor ? coinColor : isCursed ? '#ef4444' : isEnchanted ? '#c084fc' : theme.hudText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const label = truncate(group.displayName, cellSize - 4);
      ctx.fillText(label, cellX + cellSize / 2, cellY + cellSize - 3);

      // Index shortcut tag (1-9), backpack only.
      if (opts.showIndexTag && i < 9) {
        ctx.font = `bold 8px ${font}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}`, cellX + 2, cellY + 9);
      }

      // Container corner glyph — replaces the old dedicated [Open] row-button;
      // opening is now the cell's onActivate (double-click / right-click).
      if (isContainer) {
        ctx.font = `bold 9px ${font}`;
        ctx.fillStyle = theme.accent;
        ctx.textAlign = 'right';
        ctx.fillText('▣', cellX + cellSize - 3, cellY + 10);
      }

      const capturedGroup = group;
      const capturedIdx = i;
      const zoneRect = { x: cellX, y: cellY, width: cellSize, height: cellSize };
      this.hoverZones.push({
        ...zoneRect,
        item: capturedGroup.leadItem,
        displayName: capturedGroup.displayName,
        totalWeight: capturedGroup.totalWeight,
        coinColor,
      });
      this.clickZones.push({
        ...zoneRect,
        action: (isMultiMod) => opts.onSelect(capturedGroup.leadItem, capturedIdx, isMultiMod),
      });
      this.doubleClickZones.push({ ...zoneRect, action: () => opts.onActivate(capturedGroup.leadItem, capturedIdx) });
      this.rightClickZones.push({ ...zoneRect, action: () => opts.onActivate(capturedGroup.leadItem, capturedIdx) });
    }

    // Render scrollbar if content exceeds visible area
    if (hasScrollbar) {
      const trackX = x + width - scrollTrackW;
      const trackY = y + gap;
      const trackH = height - gap * 2;
      const btnH = 14;

      // Track background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(trackX, trackY, scrollTrackW, trackH);
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(trackX + 0.5, trackY + 0.5, scrollTrackW - 1, trackH - 1);

      // Up button [▲]
      ctx.fillStyle = scrollRow > 0 ? theme.cardBorder : 'rgba(50, 50, 50, 0.5)';
      ctx.fillRect(trackX, trackY, scrollTrackW, btnH);
      ctx.font = `bold 8px ${font}`;
      ctx.fillStyle = scrollRow > 0 ? theme.hudAccent : theme.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', trackX + scrollTrackW / 2, trackY + btnH / 2);
      this.clickZones.push({
        x: trackX,
        y: trackY,
        width: scrollTrackW,
        height: btnH,
        action: () => {
          this.scrollOffsets[opts.panel] = Math.max(0, this.scrollOffsets[opts.panel] - 1);
        },
      });

      // Down button [▼]
      const downBtnY = trackY + trackH - btnH;
      ctx.fillStyle = scrollRow < maxScroll ? theme.cardBorder : 'rgba(50, 50, 50, 0.5)';
      ctx.fillRect(trackX, downBtnY, scrollTrackW, btnH);
      ctx.fillStyle = scrollRow < maxScroll ? theme.hudAccent : theme.textMuted;
      ctx.fillText('▼', trackX + scrollTrackW / 2, downBtnY + btnH / 2);
      this.clickZones.push({
        x: trackX,
        y: downBtnY,
        width: scrollTrackW,
        height: btnH,
        action: () => {
          this.scrollOffsets[opts.panel] = Math.min(maxScroll, this.scrollOffsets[opts.panel] + 1);
        },
      });

      // Thumb
      const scrollableH = trackH - btnH * 2;
      if (scrollableH > 10 && maxScroll > 0) {
        const thumbH = Math.max(12, Math.floor(scrollableH * (rows / totalRows)));
        const thumbTravel = scrollableH - thumbH;
        const thumbY = trackY + btnH + Math.floor(thumbTravel * (scrollRow / maxScroll));
        ctx.fillStyle = theme.hudAccent;
        ctx.fillRect(trackX + 1, thumbY, scrollTrackW - 2, thumbH);

        if (thumbY > trackY + btnH) {
          this.clickZones.push({
            x: trackX,
            y: trackY + btnH,
            width: scrollTrackW,
            height: thumbY - (trackY + btnH),
            action: () => {
              this.scrollOffsets[opts.panel] = Math.max(0, this.scrollOffsets[opts.panel] - rows);
            },
          });
        }
        if (downBtnY > thumbY + thumbH) {
          this.clickZones.push({
            x: trackX,
            y: thumbY + thumbH,
            width: scrollTrackW,
            height: downBtnY - (thumbY + thumbH),
            action: () => {
              this.scrollOffsets[opts.panel] = Math.min(maxScroll, this.scrollOffsets[opts.panel] + rows);
            },
          });
        }
      }
    }
  }

  /**
   * Main render method: draws 4-column layout with Paperdoll, Backpack, Ground, and Stationary Inspector.
   * Items render as a square icon grid (renderItemGrid) rather than text rows; a
   * hover tooltip (drawn last, see bottom of this method) shows the full name,
   * since the grid cells themselves only have room for a short truncated label.
   */
  public render(ctx: CanvasRenderingContext2D, engine: GameEngine, canvasW: number, canvasH: number): void {
    if (!this.isOpen) return;

    this.clickZones = [];
    this.rightClickZones = [];
    this.doubleClickZones = [];
    this.hoverZones = [];
    this.engine = engine;
    const player = engine.player;
    const inv = player.inventory;
    const doll = inv.paperdoll;

    this.theme = resolveThemeTokens(engine.manifest?.theme);
    const theme = this.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // 1. Semi-transparent backdrop
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Window Dimensions (920px wide for 4 columns)
    const modalW = Math.min(canvasW - 20, 920);
    const modalH = Math.min(canvasH - 24, 576);
    const modalX = Math.floor((canvasW - modalW) / 2);
    const modalY = Math.floor((canvasH - modalH) / 2);

    // Window Body
    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(modalX, modalY, modalW, modalH);

    // Outer Border
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1);

    // Title Bar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(modalX, modalY, modalW, 30);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(modalX, modalY + 30.5);
    ctx.lineTo(modalX + modalW, modalY + 30.5);
    ctx.stroke();

    ctx.font = `bold 12px ${font}`;
    ctx.fillStyle = theme.modalTitlebarText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const gameName = engine.manifest?.name?.toUpperCase() ?? 'ADVENTURE';
    ctx.fillText(`EQUIPMENT, INVENTORY & GROUND LOOT (${gameName})`, modalX + 12, modalY + 15);

    // Close button [X]
    const closeBtnX = modalX + modalW - 26;
    const closeBtnY = modalY + 5;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(closeBtnX, closeBtnY, 20, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('X', closeBtnX + 10, closeBtnY + 10);

    this.clickZones.push({
      x: closeBtnX,
      y: closeBtnY,
      width: 20,
      height: 20,
      action: () => this.close(),
    });

    // 3. Content 4-Column Split:
    // Col 1: Paperdoll Equipment (220px)
    // Col 2: Backpack Contents (216px)
    // Col 3: Ground / Container (200px)
    // Col 4: Stationary Item Inspector (236px)
    const colGap = 8;
    const innerW = modalW - 24;
    const col1W = 220;
    const remW = innerW - col1W - colGap * 3;
    const col2W = Math.floor(remW * 0.33);
    const col3W = Math.floor(remW * 0.31);
    const col4W = remW - col2W - col3W;

    const col1X = modalX + 12;
    const col2X = col1X + col1W + colGap;
    const col3X = col2X + col2W + colGap;
    const col4X = col3X + col3W + colGap;

    const contentY = modalY + 36;
    const statsY = modalY + modalH - 110;
    const contentH = statsY - contentY - 8;

    // ─── COLUMN 1: ANATOMICAL CHARACTER PAPERDOLL ───
    this.paperdollView.render(
      ctx,
      doll,
      col1X,
      contentY,
      col1W,
      contentH,
      theme,
      {
        selectedSlot: this.inspector.selectedSource === 'paperdoll' ? this.inspector.selectedSlot : null,
        hoveredSlot: this.hoveredSlot,
        focused: this.inspector.focusedPanel === 'paperdoll',
        focusedSlotIndex: this.inspector.focusedIndex,
        onSlotClick: (slotId, item) => {
          this.inspector.setFocus('paperdoll');
          if (item) {
            this.inspector.select(item, 'paperdoll', slotId);
          } else {
            this.inspector.clearSelection();
          }
        },
        registerClickZone: (zx, zy, zw, zh, action, slotId, item) => {
          this.clickZones.push({ x: zx, y: zy, width: zw, height: zh, action });
          // Right-click or double-click immediately unequips
          if (item) {
            this.doubleClickZones.push({
              x: zx,
              y: zy,
              width: zw,
              height: zh,
              action: () => {
                this.commandBus.dispatch({ type: 'unequip_item', payload: { slot: slotId as EquipmentSlot } });
                this.inspector.clearSelection();
              },
            });
            this.rightClickZones.push({
              x: zx,
              y: zy,
              width: zw,
              height: zh,
              action: () => {
                this.commandBus.dispatch({ type: 'unequip_item', payload: { slot: slotId as EquipmentSlot } });
                this.inspector.clearSelection();
              },
            });
          }
        },
      }
    );

    // ─── COLUMN 2: BACKPACK CONTENTS ───
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(col2X, contentY, col2W, contentH);
    ctx.strokeStyle = this.inspector.focusedPanel === 'backpack' ? theme.hudAccent : theme.cardBorder;
    ctx.lineWidth = this.inspector.focusedPanel === 'backpack' ? 2 : 1;
    ctx.strokeRect(col2X + 0.5, contentY + 0.5, col2W - 1, contentH - 1);

    // Backpack Header
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(col2X, contentY, col2W, 24);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(col2X, contentY + 24.5);
    ctx.lineTo(col2X + col2W, contentY + 24.5);
    ctx.stroke();

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('BACKPACK', col2X + 8, contentY + 12);

    // Sort buttons inside header: [Sort] [Coins]
    const sortBtnW = 34;
    const sortBtnX = col2X + col2W - sortBtnW * 2 - 8;
    const sortBtnY = contentY + 4;
    const sortBtnH = 16;

    ctx.fillStyle = theme.cardBorder;
    ctx.fillRect(sortBtnX, sortBtnY, sortBtnW, sortBtnH);
    ctx.font = `bold 9px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText('Sort', sortBtnX + sortBtnW / 2, sortBtnY + 8);
    this.clickZones.push({
      x: sortBtnX,
      y: sortBtnY,
      width: sortBtnW,
      height: sortBtnH,
      action: () => {
        this.sortModeIndex = (this.sortModeIndex + 1) % 3;
        const modes: Array<'category' | 'weight' | 'bulk'> = ['category', 'weight', 'bulk'];
        const selected = modes[this.sortModeIndex];
        this.commandBus.dispatch({ type: 'sort_pack', payload: { mode: selected } });
      },
    });

    const coinBtnX = sortBtnX + sortBtnW + 4;
    ctx.fillStyle = theme.cardBorder;
    ctx.fillRect(coinBtnX, sortBtnY, sortBtnW, sortBtnH);
    ctx.fillText('Coins', coinBtnX + sortBtnW / 2, sortBtnY + 8);
    this.clickZones.push({
      x: coinBtnX,
      y: sortBtnY,
      width: sortBtnW,
      height: sortBtnH,
      action: () => {
        const res = inv.consolidateCoins();
        if (res.count > 0) {
          engine.log(`Consolidated ${res.count} coin stack${res.count > 1 ? 's' : ''} into purse.`);
        } else {
          engine.log('No loose coins in backpack to consolidate.');
        }
      },
    });

    this.panelBounds['backpack'] = { x: col2X, y: contentY, width: col2W, height: contentH };
    this.panelBounds['ground'] = { x: col3X, y: contentY, width: col3W, height: contentH };

    // Backpack item grid
    const packItems = inv.primaryPack.getItems();
    const activateBackpackItem = (capturedItem: Item) => {
      if (capturedItem instanceof Container) {
        this.pushContainer(capturedItem, 'backpack', capturedItem.displayName);
      } else if (capturedItem instanceof PotionItem) {
        this.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: capturedItem.id } });
        this.inspector.clearSelection();
      } else if (capturedItem instanceof ScrollItem) {
        this.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: capturedItem.id } });
        this.inspector.clearSelection();
      } else if (capturedItem instanceof WandItem) {
        this.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: capturedItem.id } });
        this.inspector.clearSelection();
      } else {
        this.commandBus.dispatch({ type: 'equip_item', payload: { itemId: capturedItem.id } });
        this.inspector.clearSelection();
      }
    };
    this.renderItemGrid(ctx, packItems, col2X, contentY + 28, col2W, contentH - 34, theme, font, {
      panel: 'backpack',
      emptyLabel: '(Backpack is empty)',
      showIndexTag: true,
      isSelected: (it) => this.inspector.selectedSource === 'backpack' && this.inspector.selectedItem?.id === it.id,
      isFocused: (_it, i) => this.inspector.focusedPanel === 'backpack' && this.inspector.focusedIndex === i,
      isMultiSelected: (it) => this.inspector.isMultiSelected(it.id),
      onSelect: (it, i, isMultiMod) => {
        if (isMultiMod) {
          this.inspector.toggleMultiSelect(it);
        } else {
          this.inspector.clearMultiSelect();
          this.inspector.setFocus('backpack', i);
          this.inspector.select(it, 'backpack');
        }
      },
      onActivate: (it) => activateBackpackItem(it),
    });

    // ─── COLUMN 3: ON THE GROUND & CONTAINER PEEKING ───
    const groundItems = engine.map.getItemsAt(player.x, player.y);

    if (this.inspector.selectedContainer) {
      const c = this.inspector.selectedContainer;
      this.inspector.selectedContainer = null;
      let source: 'backpack' | 'ground' | 'paperdoll' = 'ground';
      if (player.inventory.primaryPack.getItems().some((i) => i.id === c.id)) {
        source = 'backpack';
      } else if (player.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === c.id)) {
        source = 'paperdoll';
      }
      this.pushContainer(c, source);
    }

    for (let i = this.containerNavStack.length - 1; i >= 0; i--) {
      const entry = this.containerNavStack[i];
      let stillExists = false;
      if (entry.source === 'paperdoll') {
        stillExists = player.inventory.paperdoll.getAllEquipped().some((e) => e.item.id === entry.container.id);
      } else if (entry.source === 'backpack') {
        stillExists = player.inventory.primaryPack.getItems().some((it) => it.id === entry.container.id);
      } else if (entry.source === 'ground') {
        stillExists = groundItems.some((it) => it.id === entry.container.id) || (i > 0 && this.containerNavStack[i - 1].container.getItems().some((it) => it.id === entry.container.id));
      }
      if (!stillExists) {
        this.containerNavStack.splice(i, 1);
      }
    }

    const activeContainer = this.activeContainer;

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(col3X, contentY, col3W, contentH);
    ctx.strokeStyle = this.inspector.focusedPanel === 'ground' ? theme.hudAccent : theme.cardBorder;
    ctx.lineWidth = this.inspector.focusedPanel === 'ground' ? 2 : 1;
    ctx.strokeRect(col3X + 0.5, contentY + 0.5, col3W - 1, contentH - 1);

    // Ground Header
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(col3X, contentY, col3W, 24);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(col3X, contentY + 24.5);
    ctx.lineTo(col3X + col3W, contentY + 24.5);
    ctx.stroke();

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (activeContainer) {
      let cTitle: string;
      if (this.containerNavStack.length > 1) {
        const prev = this.containerNavStack[this.containerNavStack.length - 2];
        const pTitle = prev.title.length > 7 ? prev.title.slice(0, 6) + '…' : prev.title;
        const curTitle = activeContainer.displayName.length > 9 ? activeContainer.displayName.slice(0, 8) + '…' : activeContainer.displayName;
        cTitle = `📦 ${pTitle} > ${curTitle}`;
      } else {
        const curTitle = activeContainer.displayName.length > 12 ? activeContainer.displayName.slice(0, 11) + '…' : activeContainer.displayName;
        cTitle = `📦 ${curTitle}`;
      }
      ctx.fillText(cTitle, col3X + 6, contentY + 12);

      // Back button
      const backBtnW = 44;
      const backBtnX = col3X + col3W - backBtnW * 2 - 8;
      ctx.fillStyle = theme.cardBorder;
      ctx.fillRect(backBtnX, sortBtnY, backBtnW, sortBtnH);
      ctx.font = `bold 8px ${font}`;
      ctx.fillStyle = theme.hudAccent;
      ctx.textAlign = 'center';
      let backLabel = '◀ Back';
      if (this.containerNavStack.length === 1) {
        const src = this.containerNavStack[0].source;
        backLabel = src === 'paperdoll' ? '◀ Doll' : src === 'backpack' ? '◀ Pack' : '◀ Grnd';
      } else if (this.selectedPackContainer) {
        backLabel = '◀ Pack';
      } else if (this.selectedGroundContainer) {
        backLabel = '◀ Grnd';
      }
      ctx.fillText(backLabel, backBtnX + backBtnW / 2, sortBtnY + 8);
      this.clickZones.push({
        x: backBtnX,
        y: sortBtnY,
        width: backBtnW,
        height: sortBtnH,
        action: () => {
          this.popContainer();
        },
      });

      // Loot All button
      const lootAllBtnX = backBtnX + backBtnW + 4;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(lootAllBtnX, sortBtnY, backBtnW, sortBtnH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Loot All', lootAllBtnX + backBtnW / 2, sortBtnY + 8);
      this.clickZones.push({
        x: lootAllBtnX,
        y: sortBtnY,
        width: backBtnW,
        height: sortBtnH,
        action: () => {
          this.commandBus.dispatch({
            type: 'loot_all_container',
            payload: { container: activeContainer },
          });
          this.inspector.clearSelection();
        },
      });

      // Container items
      const cItems = activeContainer.getItems();
      const takeFromContainer = (capturedItem: Item) => {
        if (capturedItem instanceof Container) {
          this.pushContainer(capturedItem, 'ground', capturedItem.displayName);
        } else {
          this.commandBus.dispatch({
            type: 'loot_container',
            payload: { container: activeContainer, item: capturedItem },
          });
          this.inspector.clearSelection();
        }
      };
      this.renderItemGrid(ctx, cItems, col3X, contentY + 28, col3W, contentH - 34, theme, font, {
        panel: 'ground',
        emptyLabel: '(Container is empty)',
        isSelected: (it) => this.inspector.selectedSource === 'container' && this.inspector.selectedItem?.id === it.id,
        isFocused: (_it, i) => this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i,
        onSelect: (it, i) => {
          if (it instanceof Container) {
            this.pushContainer(it, 'ground', it.displayName);
          } else {
            this.inspector.setFocus('ground', i);
            this.inspector.select(it, 'container', undefined, activeContainer);
          }
        },
        onActivate: (it) => takeFromContainer(it),
      });
    } else {
      // Default: On the ground
      ctx.fillText('ON GROUND', col3X + 8, contentY + 12);

      // Quick Loot All button
      const lootAllBtnW = 54;
      const lootAllBtnX = col3X + col3W - lootAllBtnW - 8;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(lootAllBtnX, sortBtnY, lootAllBtnW, sortBtnH);
      ctx.font = `bold 9px ${font}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('Loot All', lootAllBtnX + lootAllBtnW / 2, sortBtnY + 8);
      this.clickZones.push({
        x: lootAllBtnX,
        y: sortBtnY,
        width: lootAllBtnW,
        height: sortBtnH,
        action: () => {
          this.commandBus.dispatch({ type: 'quick_loot' });
          this.inspector.clearSelection();
        },
      });

      const openOrPickUp = (capturedItem: Item) => {
        if (capturedItem instanceof Container) {
          this.pushContainer(capturedItem, 'ground', capturedItem.displayName);
        } else {
          this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: capturedItem.id } });
          this.inspector.clearSelection();
        }
      };
      this.renderItemGrid(ctx, groundItems, col3X, contentY + 28, col3W, contentH - 34, theme, font, {
        panel: 'ground',
        emptyLabel: '(Ground is empty)',
        isSelected: (it) => this.inspector.selectedSource === 'ground' && this.inspector.selectedItem?.id === it.id,
        isFocused: (_it, i) => this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i,
        onSelect: (it, i) => {
          this.inspector.setFocus('ground', i);
          openOrPickUp(it);
        },
        onActivate: (it) => openOrPickUp(it),
      });
    }

    // ─── COLUMN 4: STATIONARY ITEM INSPECTOR & ATTRIBUTES ───
    this.inspector.renderPane(
      ctx,
      engine,
      col4X,
      contentY,
      col4W,
      contentH,
      theme,
      (bx, by, bw, bh, act) => {
        this.clickZones.push({ x: bx, y: by, width: bw, height: bh, action: act });
      }
    );

    // ─── BOTTOM SECTION: STATS & ENCUMBRANCE METERS ───
    // Divider
    ctx.strokeStyle = theme.cardBorder;
    ctx.beginPath();
    ctx.moveTo(modalX + 10, statsY);
    ctx.lineTo(modalX + modalW - 10, statsY);
    ctx.stroke();

    const totalWeight = inv.totalWeight();
    const maxWeight = player.strength * 2500;
    const weightRatio = Math.min(1.0, maxWeight > 0 ? totalWeight / maxWeight : 0);
    const encLevel = inv.getEncumbrance(player.strength);

    const packBulk = inv.primaryPack.containedBulk();
    const maxBulk = inv.primaryPack.maxBulkCapacity;

    // Stats line
    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `STR: ${player.strength} | INT: ${player.intelligence} | CON: ${player.constitution} | DEX: ${player.dexterity} | ATK: ${player.attack} | DEF: ${player.defense} | HP: ${player.hp}/${player.maxHp} | MP: ${player.mana}/${player.maxMana}`,
      col1X,
      statsY + 16
    );

    let encColor = '#10b981';
    if (encLevel === EncumbranceLevel.Burdened) encColor = '#f59e0b';
    else if (encLevel === EncumbranceLevel.Overburdened) encColor = '#f97316';
    else if (encLevel === EncumbranceLevel.Immobilized) encColor = '#ef4444';

    // Weight Meter
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(`CARRY WEIGHT: ${totalWeight} / ${maxWeight}g`, col1X, statsY + 36);

    ctx.fillStyle = encColor;
    ctx.fillText(
      `STATUS: ${encLevel.toUpperCase()} (${Math.round(inv.getEncumbranceMultiplier(player.strength) * 100)}% Cost)`,
      col1X + 260,
      statsY + 36
    );

    // Weight bar
    const barW = modalW - 28;
    const barH = 6;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(col1X, statsY + 44, barW, barH);
    ctx.fillStyle = encColor;
    ctx.fillRect(col1X, statsY + 44, Math.floor(barW * weightRatio), barH);

    // Bulk Capacity
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(`PACK VOLUME: ${packBulk} / ${maxBulk} cm³`, col1X, statsY + 64);

    // Controls footer
    ctx.font = `10px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText(
      'KEYBOARD: [Tab] Cycle Panels | [↑↓] Navigate | [Enter] Select/Act | [E] Equip/Unequip | [U] Use | [D] Drop | [T] Take | [C] Coins | [O] Sort | [I/ESC] Close',
      col1X,
      statsY + 84
    );

    if (this.companionViewOpen) {
      this.renderCompanionPack(ctx, engine, modalX, modalY, modalW, modalH, font);
    }

    // Grid cells only have room for a short truncated label (renderItemGrid
    // above) — this is where the full name actually lives for a quick glance
    // without clicking. Drawn last so it always sits on top.
    this.renderHoverTooltip(ctx, canvasW, canvasH, font);
  }

  private renderHoverTooltip(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, font: string): void {
    if (!this.hoveredGroup || !this.theme) return;
    const theme = this.theme;
    const { item, displayName, totalWeight, coinColor } = this.hoveredGroup;

    ctx.font = `bold 11px ${font}`;
    const text = `${displayName} (${totalWeight}g)`;
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 16;
    const boxH = 22;

    let boxX = this.lastMouseX + 14;
    let boxY = this.lastMouseY + 14;
    if (boxX + boxW > canvasW) boxX = this.lastMouseX - boxW - 14;
    if (boxY + boxH > canvasH) boxY = this.lastMouseY - boxH - 14;

    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = coinColor ?? theme.hudAccent;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    const isCursed = item.isCursed() && item.identified;
    const isEnchanted = item.identified && item.quality === 'enchanted';
    ctx.fillStyle = coinColor ? coinColor : isCursed ? '#ef4444' : isEnchanted ? '#c084fc' : theme.hudText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxX + 8, boxY + boxH / 2);
  }

  /**
   * Lists the active companion's pack so items can be taken back
   * (ARCHITECTURE.md §3). Giving was already possible with [G]; this is the other half.
   */
  private renderCompanionPack(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    modalY: number,
    modalW: number,
    modalH: number,
    font: string
  ): void {
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const panelW = Math.min(360, modalW - 40);
    const panelH = Math.min(320, modalH - 60);
    const panelX = modalX + (modalW - panelW) / 2;
    const panelY = modalY + (modalH - panelH) / 2;

    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    const companion = engine.companion;
    ctx.font = `bold 12px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${companion?.name ?? 'Companion'} — PACK`, panelX + 12, panelY + 18);

    const items = companion?.inventory.primaryPack.getItems() ?? [];
    ctx.font = `11px ${font}`;
    if (items.length === 0) {
      ctx.fillStyle = theme.hudText;
      ctx.fillText('(carrying nothing)', panelX + 12, panelY + 44);
    } else {
      items.forEach((item, idx) => {
        const rowY = panelY + 44 + idx * 18;
        if (rowY > panelY + panelH - 34) return;
        const selected = idx === this.companionIndex;
        if (selected) {
          ctx.fillStyle = theme.cardBorder;
          ctx.fillRect(panelX + 8, rowY - 9, panelW - 16, 18);
        }
        ctx.fillStyle = selected ? theme.modalBg : theme.hudText;
        ctx.fillText(`${item.name}`, panelX + 14, rowY);
      });
    }

    ctx.font = `10px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText('[↑↓] Select  [Enter] Take  [Esc] Back', panelX + 12, panelY + panelH - 14);
  }
}
