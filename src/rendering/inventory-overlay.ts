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

export interface ClickZone {
  x: number;
  y: number;
  width: number;
  height: number;
  action: (isMultiModifier?: boolean) => void;
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
export class InventoryOverlay {
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
  private hoverZones: Array<{ x: number; y: number; width: number; height: number; item: Item }> = [];
  private hoveredGridItem: Item | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
  public selectedGroundContainer: Container | null = null;
  public selectedPackContainer: Container | null = null;
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

  public toggle(engine?: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public onClose?: () => void;

  public open(engine?: GameEngine): void {
    if (engine) this.engine = engine;
    this.isOpen = true;
    this.inspector.clearSelection();
    this.inspector.setFocus('paperdoll', 0);
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
    this.hoveredGridItem = null;
    this.selectedGroundContainer = null;
    this.selectedPackContainer = null;
    if (this.onClose) {
      this.onClose();
    }
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  /** Shared by handleMouseMove and the three click handlers below — a click
   * changes the mouse position too (a `dblclick`/`contextmenu` event fires
   * with no preceding `mousemove` on some input paths), and without this the
   * hover tooltip could keep showing whatever was hovered before the click. */
  private updateHoverAt(mouseX: number, mouseY: number): void {
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    // Grid cells register into hoverZones during the render() that just ran, so
    // this reflects last frame's layout — one frame of lag on a resize, never
    // visible in practice since layout is otherwise static while the mouse moves.
    const zone = this.hoverZones.find(
      (z) => mouseX >= z.x && mouseX <= z.x + z.width && mouseY >= z.y && mouseY <= z.y + z.height
    );
    this.hoveredGridItem = zone?.item ?? null;
  }

  public handleMouseMove(mouseX: number, mouseY: number): boolean {
    if (!this.isOpen) {
      this.hoveredSlot = null;
      this.hoveredBackpackIndex = null;
      this.hoveredGroundIndex = null;
      this.hoveredGridItem = null;
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
  public handleKeyDown(code: string, engine: GameEngine): boolean {
    if (!this.isOpen) return false;
    this.engine = engine;
    const player = engine.player;
    const inv = player.inventory;
    const doll = inv.paperdoll;

    // 1. Close overlay. The companion browser is a sub-view, so Escape backs out of it
    //    first rather than dismissing the whole overlay.
    if (code === 'Escape' && this.companionViewOpen) {
      this.companionViewOpen = false;
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
        if (packItems.length > 0) {
          this.inspector.select(packItems[0], 'backpack');
        } else {
          this.inspector.clearSelection();
        }
      } else if (panel === 'ground') {
        const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;
        const items = activeContainer
          ? activeContainer.getItems()
          : engine.map.getItemsAt(player.x, player.y);
        if (items.length > 0) {
          const src = activeContainer ? 'container' : 'ground';
          this.inspector.select(items[0], src, undefined, activeContainer);
        } else {
          this.inspector.clearSelection();
        }
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 3. Arrow keys: navigate inside focused panel
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      const delta = code === 'ArrowDown' ? 1 : -1;
      const panel = this.inspector.focusedPanel;

      if (panel === 'paperdoll') {
        const slotCount = doll.getSlotDefinitions().length;
        this.inspector.focusedIndex = Math.max(0, Math.min(slotCount - 1, this.inspector.focusedIndex + delta));
        const slot = doll.getSlotDefinitions()[this.inspector.focusedIndex];
        if (slot) {
          const item = doll.getItem(slot.id);
          this.inspector.select(item, 'paperdoll', slot.id);
        }
      } else if (panel === 'backpack') {
        const packItems = inv.primaryPack.getItems();
        if (packItems.length > 0) {
          this.inspector.focusedIndex = Math.max(0, Math.min(packItems.length - 1, this.inspector.focusedIndex + delta));
          this.inspector.select(packItems[this.inspector.focusedIndex], 'backpack');
        }
      } else if (panel === 'ground') {
        const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;
        const items = activeContainer
          ? activeContainer.getItems()
          : engine.map.getItemsAt(player.x, player.y);
        if (items.length > 0) {
          this.inspector.focusedIndex = Math.max(0, Math.min(items.length - 1, this.inspector.focusedIndex + delta));
          const src = activeContainer ? 'container' : 'ground';
          this.inspector.select(items[this.inspector.focusedIndex], src, undefined, activeContainer);
        }
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // 4. Enter / Space: Primary contextual action or selection
    if (code === 'Enter' || code === 'Space') {
      const panel = this.inspector.focusedPanel;
      if (panel === 'backpack') {
        const packItems = inv.primaryPack.getItems();
        const focusedItem = packItems[this.inspector.focusedIndex];
        if (focusedItem instanceof Container && !this.selectedPackContainer) {
          this.selectedPackContainer = focusedItem;
          this.selectedGroundContainer = null;
          this.inspector.select(null, 'none', undefined, focusedItem);
          this.inspector.setFocus('ground', 0);
          if (this.onStateChanged) this.onStateChanged();
          return true;
        }
      }
      if (panel === 'ground') {
        const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;
        if (!activeContainer) {
          const groundItems = engine.map.getItemsAt(player.x, player.y);
          const focusedItem = groundItems[this.inspector.focusedIndex];
          if (focusedItem instanceof Container) {
            this.selectedGroundContainer = focusedItem;
            this.selectedPackContainer = null;
            this.inspector.clearSelection();
            if (this.onStateChanged) this.onStateChanged();
            return true;
          }
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
        const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;
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
    const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;
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
    // (Companions & Pet Progression, Phase 2 — ARCHITECTURE.md P-14). One-
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
    if (items.length === 0) {
      ctx.font = `italic 11px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opts.emptyLabel, x + 10, y + 14);
      return;
    }

    const gap = 4;
    const cols = Math.max(2, Math.floor((width - gap) / (50 + gap)));
    const cellSize = Math.max(40, Math.min(64, Math.floor((width - gap * (cols + 1)) / cols)));
    const rows = Math.max(1, Math.floor((height - gap) / (cellSize + gap)));
    const maxVisible = cols * rows;

    const truncate = (text: string, maxWidth: number): string => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let end = text.length;
      while (end > 1 && ctx.measureText(text.slice(0, end) + '…').width > maxWidth) end--;
      return text.slice(0, end) + '…';
    };

    for (let i = 0; i < Math.min(items.length, maxVisible); i++) {
      const it = items[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = x + gap + col * (cellSize + gap);
      const cellY = y + gap + row * (cellSize + gap);

      const isCursed = it.isCursed() && it.identified;
      const isEnchanted = it.identified && it.quality === 'enchanted';
      const isContainer = it instanceof Container;
      const selected = opts.isSelected(it, i);
      const focused = opts.isFocused(it, i);
      const multiSelected = opts.isMultiSelected?.(it) ?? false;

      ctx.fillStyle = selected ? 'rgba(56, 189, 248, 0.25)' : focused ? 'rgba(56, 189, 248, 0.15)' : theme.modalBg;
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      const borderColor = multiSelected
        ? '#38bdf8'
        : isCursed
        ? '#ef4444'
        : selected || focused
        ? theme.hudAccent
        : theme.cardBorder;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = selected || focused || multiSelected ? 1.5 : 1;
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

      // Sprite, sized to fill most of the cell (paperdoll-view.ts's square-slot
      // precedent) — this is the actual fix for "icons are small": 16px rows
      // become cells this large, icon included.
      const nameplateH = 13;
      const spriteArea = cellSize - nameplateH - 6;
      if (this.atlas) {
        const spriteKey = getItemSpriteKey(it);
        const spriteSize = Math.max(16, Math.min(spriteArea, cellSize - 8));
        const spriteX = cellX + Math.floor((cellSize - spriteSize) / 2);
        const spriteY = cellY + 4;
        this.atlas.drawSprite(ctx, spriteKey, spriteX, spriteY, spriteSize);
      }

      // Name, truncated to the cell's width rather than a fixed character count
      // — still short, but the tooltip (see render()) carries the full name.
      ctx.font = `9px ${font}`;
      ctx.fillStyle = isCursed ? '#ef4444' : isEnchanted ? '#c084fc' : theme.hudText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const label = truncate(it.displayName, cellSize - 4);
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

      const capturedItem = it;
      const capturedIdx = i;
      const zoneRect = { x: cellX, y: cellY, width: cellSize, height: cellSize };
      this.hoverZones.push({ ...zoneRect, item: capturedItem });
      this.clickZones.push({
        ...zoneRect,
        action: (isMultiMod) => opts.onSelect(capturedItem, capturedIdx, isMultiMod),
      });
      this.doubleClickZones.push({ ...zoneRect, action: () => opts.onActivate(capturedItem, capturedIdx) });
      this.rightClickZones.push({ ...zoneRect, action: () => opts.onActivate(capturedItem, capturedIdx) });
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
    const modalH = Math.min(canvasH - 24, 540);
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

    // Backpack item grid
    const packItems = inv.primaryPack.getItems();
    const activateBackpackItem = (capturedItem: Item) => {
      if (capturedItem instanceof Container) {
        this.selectedPackContainer = capturedItem;
        this.selectedGroundContainer = null;
        this.inspector.select(null, 'none', undefined, capturedItem);
        this.inspector.setFocus('ground', 0);
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
      if (player.inventory.primaryPack.getItems().some((i) => i.id === this.inspector.selectedContainer?.id)) {
        this.selectedPackContainer = this.inspector.selectedContainer;
        this.selectedGroundContainer = null;
      } else if (groundItems.some((i) => i.id === this.inspector.selectedContainer?.id)) {
        this.selectedGroundContainer = this.inspector.selectedContainer;
        this.selectedPackContainer = null;
      }
    }

    if (this.selectedGroundContainer && !groundItems.some((i) => i.id === this.selectedGroundContainer?.id)) {
      this.selectedGroundContainer = null;
    }
    if (this.selectedPackContainer && !player.inventory.primaryPack.getItems().some((i) => i.id === this.selectedPackContainer?.id)) {
      this.selectedPackContainer = null;
    }

    const activeContainer = this.selectedPackContainer || this.selectedGroundContainer;

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
      const cTitle = `📦 ${activeContainer.displayName.length > 10 ? activeContainer.displayName.slice(0, 9) + '…' : activeContainer.displayName}`;
      ctx.fillText(cTitle, col3X + 6, contentY + 12);

      // Back button [◀ Ground] or [◀ Pack]
      const backBtnW = 44;
      const backBtnX = col3X + col3W - backBtnW * 2 - 8;
      ctx.fillStyle = theme.cardBorder;
      ctx.fillRect(backBtnX, sortBtnY, backBtnW, sortBtnH);
      ctx.font = `bold 8px ${font}`;
      ctx.fillStyle = theme.hudAccent;
      ctx.textAlign = 'center';
      const backLabel = this.selectedPackContainer ? '◀ Pack' : '◀ Grnd';
      ctx.fillText(backLabel, backBtnX + backBtnW / 2, sortBtnY + 8);
      this.clickZones.push({
        x: backBtnX,
        y: sortBtnY,
        width: backBtnW,
        height: sortBtnH,
        action: () => {
          this.selectedGroundContainer = null;
          this.selectedPackContainer = null;
          this.inspector.clearSelection();
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
        this.commandBus.dispatch({
          type: 'loot_container',
          payload: { container: activeContainer, item: capturedItem },
        });
        this.inspector.clearSelection();
      };
      this.renderItemGrid(ctx, cItems, col3X, contentY + 28, col3W, contentH - 34, theme, font, {
        emptyLabel: '(Container is empty)',
        isSelected: (it) => this.inspector.selectedSource === 'container' && this.inspector.selectedItem?.id === it.id,
        isFocused: (_it, i) => this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i,
        onSelect: (it, i) => {
          this.inspector.setFocus('ground', i);
          this.inspector.select(it, 'container', undefined, activeContainer);
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
          this.selectedGroundContainer = capturedItem;
          this.inspector.clearSelection();
        } else {
          this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: capturedItem.id } });
          this.inspector.clearSelection();
        }
      };
      this.renderItemGrid(ctx, groundItems, col3X, contentY + 28, col3W, contentH - 34, theme, font, {
        emptyLabel: '(Ground is empty)',
        isSelected: (it) => this.inspector.selectedSource === 'ground' && this.inspector.selectedItem?.id === it.id,
        isFocused: (_it, i) => this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i,
        onSelect: (it, i) => {
          // Ground containers open immediately on a single click (existing
          // behavior, unlike the backpack column's click-then-double-click) —
          // there's no separate "peek" step for something already on the floor.
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
    if (!this.hoveredGridItem || !this.theme) return;
    const theme = this.theme;
    const item = this.hoveredGridItem;

    ctx.font = `bold 11px ${font}`;
    const text = `${item.displayName} (${item.weight}g)`;
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + 16;
    const boxH = 22;

    let boxX = this.lastMouseX + 14;
    let boxY = this.lastMouseY + 14;
    if (boxX + boxW > canvasW) boxX = this.lastMouseX - boxW - 14;
    if (boxY + boxH > canvasH) boxY = this.lastMouseY - boxH - 14;

    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = theme.hudAccent;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    const isCursed = item.isCursed() && item.identified;
    const isEnchanted = item.identified && item.quality === 'enchanted';
    ctx.fillStyle = isCursed ? '#ef4444' : isEnchanted ? '#c084fc' : theme.hudText;
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
