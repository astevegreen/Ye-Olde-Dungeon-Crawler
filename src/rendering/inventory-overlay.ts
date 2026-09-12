import { GameEngine } from '../engine';
import { Item, type EquipmentSlot } from '../engine';
import { Container } from '../engine';
import { EncumbranceLevel } from '../engine';
import { SpriteAtlas } from './atlas/sprite-atlas';
import { getItemSpriteKey } from './atlas/sprite-mapper';
import { PotionItem, ScrollItem, WandItem } from '../engine';
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
  private clickZones: ClickZone[] = [];
  private rightClickZones: ClickZone[] = [];
  private doubleClickZones: ClickZone[] = [];
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
    this.isOpen = false;
    this.inspector.clearSelection();
    this.hoveredSlot = null;
    this.hoveredBackpackIndex = null;
    this.hoveredGroundIndex = null;
    this.selectedGroundContainer = null;
    this.selectedPackContainer = null;
    if (this.onClose) {
      this.onClose();
    }
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public handleMouseMove(_mouseX: number, _mouseY: number): boolean {
    if (!this.isOpen) {
      this.hoveredSlot = null;
      this.hoveredBackpackIndex = null;
      this.hoveredGroundIndex = null;
      return false;
    }
    // Hover zones are updated during render and checked here
    return true;
  }

  public handleClick(mouseX: number, mouseY: number, isMultiModifier: boolean = false): boolean {
    if (!this.isOpen) return false;

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

    // 1. Close overlay
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
      }
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
      inv.primaryPack.sort(selected);
      engine.log(`Sorted backpack items by ${selected.toUpperCase()}.`);
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

  /**
   * Main render method: draws 4-column layout with Paperdoll, Backpack, Ground, and Stationary Inspector.
   * Floating tooltips are completely eliminated.
   */
  public render(ctx: CanvasRenderingContext2D, engine: GameEngine, canvasW: number, canvasH: number): void {
    if (!this.isOpen) return;

    this.clickZones = [];
    this.rightClickZones = [];
    this.doubleClickZones = [];
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
    const slotRowH = 20;

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
                const res = inv.unequipToPack(slotId as EquipmentSlot);
                if (!res.success) {
                  engine.log(res.reason ?? 'Cannot unequip item.');
                } else {
                  engine.log(`Unequipped ${item.displayName} to pack.`);
                }
                this.inspector.clearSelection();
              },
            });
            this.rightClickZones.push({
              x: zx,
              y: zy,
              width: zw,
              height: zh,
              action: () => {
                const res = inv.unequipToPack(slotId as EquipmentSlot);
                if (!res.success) {
                  engine.log(res.reason ?? 'Cannot unequip item.');
                } else {
                  engine.log(`Unequipped ${item.displayName} to pack.`);
                }
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
        inv.primaryPack.sort(selected);
        engine.log(`Sorted backpack items by ${selected.toUpperCase()}.`);
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

    // Backpack item list
    const packItems = inv.primaryPack.getItems();
    let packY = contentY + 30;
    const maxItems = Math.floor((contentH - 36) / slotRowH);

    if (packItems.length === 0) {
      ctx.font = `italic 11px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText('(Backpack is empty)', col2X + 10, packY + 14);
    } else {
      for (let i = 0; i < Math.min(packItems.length, maxItems); i++) {
        const it = packItems[i];
        const isCursed = it.isCursed() && it.identified;
        const isSelected = this.inspector.selectedSource === 'backpack' && this.inspector.selectedItem?.id === it.id;
        const isFocused = this.inspector.focusedPanel === 'backpack' && this.inspector.focusedIndex === i;

        ctx.fillStyle = isSelected
          ? 'rgba(56, 189, 248, 0.25)'
          : isFocused
          ? 'rgba(56, 189, 248, 0.15)'
          : theme.modalBg;
        ctx.fillRect(col2X + 4, packY, col2W - 8, slotRowH - 2);

        ctx.strokeStyle = isSelected || isFocused ? theme.hudAccent : theme.cardBorder;
        ctx.lineWidth = isSelected || isFocused ? 1.5 : 1;
        ctx.strokeRect(col2X + 4.5, packY + 0.5, col2W - 9, slotRowH - 3);

        // Index shortcut tag (1-9)
        ctx.font = `bold 9px ${font}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (i < 9) {
          ctx.fillText(`${i + 1}.`, col2X + 8, packY + slotRowH / 2 - 1);
        }

        // Sprite
        if (this.atlas) {
          const spriteKey = getItemSpriteKey(it);
          this.atlas.drawSprite(ctx, spriteKey, col2X + 22, packY + 1, 16);
        }

        // Name
        ctx.fillStyle = isCursed ? '#ef4444' : it.identified && it.quality === 'enchanted' ? '#c084fc' : theme.hudText;
        const nameStr = it.displayName.length > 12 ? it.displayName.slice(0, 11) + '…' : it.displayName;
        ctx.fillText(nameStr, col2X + (this.atlas ? 42 : 24), packY + slotRowH / 2 - 1);

        // Weight
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(`${it.weight}g`, col2X + col2W - 10, packY + slotRowH / 2 - 1);

        const isMulti = this.inspector.isMultiSelected(it.id);
        if (isMulti) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.strokeRect(col2X + 4.5, packY + 0.5, col2W - 9, slotRowH - 3);
        }

        // Click zone to select row into inspector or toggle multi-select
        const capturedItem = it;
        const capturedIdx = i;
        this.clickZones.push({
          x: col2X + 4,
          y: packY,
          width: col2W - 8,
          height: slotRowH - 2,
          action: (isMultiMod) => {
            if (isMultiMod) {
              this.inspector.toggleMultiSelect(capturedItem);
            } else {
              this.inspector.clearMultiSelect();
              this.inspector.setFocus('backpack', capturedIdx);
              this.inspector.select(capturedItem, 'backpack');
            }
          },
        });

        // Double-click zone: equip or consume
        this.doubleClickZones.push({
          x: col2X + 4,
          y: packY,
          width: col2W - 8,
          height: slotRowH - 2,
          action: () => {
            if (capturedItem instanceof PotionItem) {
              this.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: capturedItem.id } });
            } else if (capturedItem instanceof ScrollItem) {
              this.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: capturedItem.id } });
            } else if (capturedItem instanceof WandItem) {
              this.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: capturedItem.id } });
            } else {
              this.commandBus.dispatch({ type: 'equip_item', payload: { itemId: capturedItem.id } });
            }
            this.inspector.clearSelection();
          },
        });

        // Open badge for nested container in pack
        if (it instanceof Container) {
          const openBtnW = 28;
          const openBtnX = col2X + col2W - openBtnW - 46;
          ctx.fillStyle = theme.cardBorder;
          ctx.fillRect(openBtnX, packY + 2, openBtnW, slotRowH - 6);
          ctx.fillStyle = theme.hudAccent;
          ctx.font = `bold 8px ${font}`;
          ctx.textAlign = 'center';
          ctx.fillText('Open', openBtnX + openBtnW / 2, packY + slotRowH / 2 - 1);

          const capturedContainer = it;
          this.clickZones.push({
            x: openBtnX,
            y: packY + 2,
            width: openBtnW,
            height: slotRowH - 6,
            action: () => {
              this.selectedPackContainer = capturedContainer;
              this.selectedGroundContainer = null;
              this.inspector.select(null, 'none', undefined, capturedContainer);
              this.inspector.setFocus('ground', 0);
            },
          });
        }

        // Right-click quick action: equip or consume
        this.rightClickZones.push({
          x: col2X + 4,
          y: packY,
          width: col2W - 8,
          height: slotRowH - 2,
          action: () => {
            if (capturedItem instanceof PotionItem) {
              this.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: capturedItem.id } });
            } else if (capturedItem instanceof ScrollItem) {
              this.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: capturedItem.id } });
            } else {
              this.commandBus.dispatch({ type: 'equip_item', payload: { itemId: capturedItem.id } });
            }
            this.inspector.clearSelection();
          },
        });

        packY += slotRowH;
      }
    }

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
      let cY = contentY + 30;

      if (cItems.length === 0) {
        ctx.font = `italic 11px ${font}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('(Container is empty)', col3X + 10, cY + 14);
      } else {
        for (let i = 0; i < Math.min(cItems.length, maxItems); i++) {
          const it = cItems[i];
          const isCursed = it.isCursed() && it.identified;
          const isSelected = this.inspector.selectedSource === 'container' && this.inspector.selectedItem?.id === it.id;
          const isFocused = this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i;

          ctx.fillStyle = isSelected
            ? 'rgba(56, 189, 248, 0.25)'
            : isFocused
            ? 'rgba(56, 189, 248, 0.15)'
            : theme.modalBg;
          ctx.fillRect(col3X + 4, cY, col3W - 8, slotRowH - 2);

          ctx.strokeStyle = isSelected || isFocused ? theme.hudAccent : theme.cardBorder;
          ctx.lineWidth = isSelected || isFocused ? 1.5 : 1;
          ctx.strokeRect(col3X + 4.5, cY + 0.5, col3W - 9, slotRowH - 3);

          if (this.atlas) {
            const spriteKey = getItemSpriteKey(it);
            this.atlas.drawSprite(ctx, spriteKey, col3X + 8, cY + 1, 16);
          }

          ctx.fillStyle = isCursed ? '#ef4444' : it.identified && it.quality === 'enchanted' ? '#c084fc' : theme.hudText;
          const nameStr = it.displayName.length > 11 ? it.displayName.slice(0, 10) + '…' : it.displayName;
          ctx.font = `bold 10px ${font}`;
          ctx.textAlign = 'left';
          ctx.fillText(nameStr, col3X + (this.atlas ? 28 : 10), cY + slotRowH / 2 - 1);

          // [Take] button
          const takeBtnW = 28;
          const takeBtnX = col3X + col3W - takeBtnW - 8;
          ctx.fillStyle = theme.cardBorder;
          ctx.fillRect(takeBtnX, cY + 2, takeBtnW, slotRowH - 6);
          ctx.fillStyle = theme.hudAccent;
          ctx.font = `bold 8px ${font}`;
          ctx.textAlign = 'center';
          ctx.fillText('Take', takeBtnX + takeBtnW / 2, cY + slotRowH / 2 - 1);

          const capturedItem = it;
          const capturedIdx = i;
          this.clickZones.push({
            x: col3X + 4,
            y: cY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              this.inspector.setFocus('ground', capturedIdx);
              this.inspector.select(capturedItem, 'container', undefined, activeContainer);
            },
          });

          this.doubleClickZones.push({
            x: col3X + 4,
            y: cY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              this.commandBus.dispatch({
                type: 'loot_container',
                payload: { container: activeContainer, item: capturedItem },
              });
              this.inspector.clearSelection();
            },
          });

          // Click zone specifically on the [Take] button
          this.clickZones.push({
            x: takeBtnX,
            y: cY + 2,
            width: takeBtnW,
            height: slotRowH - 6,
            action: () => {
              this.commandBus.dispatch({
                type: 'loot_container',
                payload: { container: activeContainer, item: capturedItem },
              });
              this.inspector.clearSelection();
            },
          });

          this.rightClickZones.push({
            x: col3X + 4,
            y: cY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              this.commandBus.dispatch({
                type: 'loot_container',
                payload: { container: activeContainer, item: capturedItem },
              });
              this.inspector.clearSelection();
            },
          });

          cY += slotRowH;
        }
      }
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

      let gY = contentY + 30;

      if (groundItems.length === 0) {
        ctx.font = `italic 11px ${font}`;
        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('(Ground is empty)', col3X + 10, gY + 14);
      } else {
        for (let i = 0; i < Math.min(groundItems.length, maxItems); i++) {
          const it = groundItems[i];
          const isContainer = it instanceof Container;
          const isCursed = it.isCursed() && it.identified;
          const isSelected = this.inspector.selectedSource === 'ground' && this.inspector.selectedItem?.id === it.id;
          const isFocused = this.inspector.focusedPanel === 'ground' && this.inspector.focusedIndex === i;

          ctx.fillStyle = isSelected
            ? 'rgba(56, 189, 248, 0.25)'
            : isFocused
            ? 'rgba(56, 189, 248, 0.15)'
            : theme.modalBg;
          ctx.fillRect(col3X + 4, gY, col3W - 8, slotRowH - 2);

          ctx.strokeStyle = isSelected || isFocused ? theme.hudAccent : theme.cardBorder;
          ctx.lineWidth = isSelected || isFocused ? 1.5 : 1;
          ctx.strokeRect(col3X + 4.5, gY + 0.5, col3W - 9, slotRowH - 3);

          if (this.atlas) {
            const spriteKey = getItemSpriteKey(it);
            this.atlas.drawSprite(ctx, spriteKey, col3X + 8, gY + 1, 16);
          }

          ctx.fillStyle = isContainer ? theme.accent : isCursed ? '#ef4444' : it.identified && it.quality === 'enchanted' ? '#c084fc' : theme.hudText;
          const nameStr = it.displayName.length > 11 ? it.displayName.slice(0, 10) + '…' : it.displayName;
          ctx.font = `bold 10px ${font}`;
          ctx.textAlign = 'left';
          ctx.fillText(nameStr, col3X + (this.atlas ? 28 : 10), gY + slotRowH / 2 - 1);

          // Action badge: [Open] for container, [Take] for regular item
          const actBtnW = 28;
          const actBtnX = col3X + col3W - actBtnW - 8;
          ctx.fillStyle = theme.cardBorder;
          ctx.fillRect(actBtnX, gY + 2, actBtnW, slotRowH - 6);
          ctx.fillStyle = isContainer ? theme.accent : theme.hudAccent;
          ctx.font = `bold 8px ${font}`;
          ctx.textAlign = 'center';
          ctx.fillText(isContainer ? 'Open' : 'Take', actBtnX + actBtnW / 2, gY + slotRowH / 2 - 1);

          const capturedItem = it;
          const capturedIdx = i;
          this.clickZones.push({
            x: col3X + 4,
            y: gY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              this.inspector.setFocus('ground', capturedIdx);
              if (capturedItem instanceof Container) {
                this.selectedGroundContainer = capturedItem;
                this.inspector.clearSelection();
              } else {
                this.inspector.select(capturedItem, 'ground');
              }
            },
          });

          this.doubleClickZones.push({
            x: col3X + 4,
            y: gY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              if (capturedItem instanceof Container) {
                this.selectedGroundContainer = capturedItem;
                this.inspector.clearSelection();
              } else {
                this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: capturedItem.id } });
                this.inspector.clearSelection();
              }
            },
          });

          // Explicit click zone for action badge [Open] or [Take]
          this.clickZones.push({
            x: actBtnX,
            y: gY + 2,
            width: actBtnW,
            height: slotRowH - 6,
            action: () => {
              if (capturedItem instanceof Container) {
                this.selectedGroundContainer = capturedItem;
                this.inspector.clearSelection();
              } else {
                this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: capturedItem.id } });
                this.inspector.clearSelection();
              }
            },
          });

          this.rightClickZones.push({
            x: col3X + 4,
            y: gY,
            width: col3W - 8,
            height: slotRowH - 2,
            action: () => {
              if (capturedItem instanceof Container) {
                this.selectedGroundContainer = capturedItem;
                this.inspector.clearSelection();
              } else {
                this.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: capturedItem.id } });
                this.inspector.clearSelection();
              }
            },
          });

          gY += slotRowH;
        }
      }
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

    // NOTE: Floating tooltip popup (renderTooltip) is completely removed!
  }
}
