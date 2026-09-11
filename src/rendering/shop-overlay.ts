import type { GameEngine } from '../engine/engine';
import type { NPC } from '../engine/entities/npc';
import type { Merchant } from '../engine/economy/merchant';
import type { Item } from '../engine/items/item';
import { getItemBuyPrice, getItemSellPrice } from '../engine/economy/merchant';
import {
  formatCurrency,
  getPlayerCurrencyBreakdown,
  getPlayerTotalCp,
  getPlayerCoinItems,
} from '../engine/economy/currency';
import type { SpriteAtlas } from './atlas/sprite-atlas';
import { getItemSpriteKey, getEntitySpriteKey } from './atlas/sprite-mapper';
import { resolveThemeTokens, type ThemeTokens } from './theme';

export interface ClickZone {
  x: number;
  y: number;
  width: number;
  height: number;
  action: () => void;
}

export class ShopOverlay {
  public isOpen = false;
  public activeNpc: NPC | null = null;
  public merchant: Merchant | null = null;
  public activeTab: 'buy' | 'sell' = 'buy';
  public selectedBuyIndex = 0;
  public selectedSellIndex = 0;
  public statusMessage = '';
  public statusColor = '#38bdf8';

  private theme?: Required<ThemeTokens>;
  private clickZones: ClickZone[] = [];
  private onStateChanged?: () => void;
  public onOpenCompendium?: () => void;
  public atlas?: SpriteAtlas;

  constructor(onStateChanged?: () => void, atlas?: SpriteAtlas) {
    this.onStateChanged = onStateChanged;
    this.atlas = atlas;
  }

  public open(npc: NPC, merchant?: Merchant | null): void {
    this.isOpen = true;
    this.activeNpc = npc;
    this.merchant = merchant ?? null;
    this.activeTab = 'buy';
    this.selectedBuyIndex = 0;
    this.selectedSellIndex = 0;
    this.statusMessage = '';
    this.statusColor = '#38bdf8';
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public close(): void {
    this.isOpen = false;
    this.activeNpc = null;
    this.merchant = null;
    this.statusMessage = '';
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public handleClick(mouseX: number, mouseY: number, _engine: GameEngine): boolean {
    if (!this.isOpen) return false;

    for (const zone of this.clickZones) {
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

    return true; // Consume all clicks inside modal
  }

  public handleDoubleClick(_mouseX: number, _mouseY: number, engine: GameEngine): boolean {
    if (!this.isOpen || !this.merchant) return false;
    const items = this.activeTab === 'buy' ? this.merchant.stock : this.getSellableItems(engine);
    const selectedIdx = this.activeTab === 'buy' ? this.selectedBuyIndex : this.selectedSellIndex;
    if (selectedIdx >= 0 && selectedIdx < items.length) {
      if (this.activeTab === 'buy') {
        this.executeBuy(engine, selectedIdx);
      } else {
        this.executeSell(engine, selectedIdx);
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }
    return true;
  }

  public handleKeyDown(event: KeyboardEvent, engine: GameEngine): boolean {
    if (!this.isOpen) return false;

    const key = event.key;

    if (key === 'Escape') {
      this.close();
      return true;
    }

    if (key === 'Tab') {
      event.preventDefault();
      this.activeTab = this.activeTab === 'buy' ? 'sell' : 'buy';
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // Tab shortcuts
    if (key.toLowerCase() === 'b') {
      this.activeTab = 'buy';
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }
    if (key.toLowerCase() === 's') {
      this.activeTab = 'sell';
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // Arrow navigation
    if (key === 'ArrowUp') {
      event.preventDefault();
      if (this.activeTab === 'buy' && this.merchant) {
        this.selectedBuyIndex = Math.max(0, this.selectedBuyIndex - 1);
      } else {
        this.selectedSellIndex = Math.max(0, this.selectedSellIndex - 1);
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      if (this.activeTab === 'buy' && this.merchant) {
        this.selectedBuyIndex = Math.min(this.merchant.stock.length - 1, this.selectedBuyIndex + 1);
      } else {
        const sellable = this.getSellableItems(engine);
        this.selectedSellIndex = Math.min(sellable.length - 1, this.selectedSellIndex + 1);
      }
      if (this.onStateChanged) this.onStateChanged();
      return true;
    }

    // Number keys 1-9 for quick buy/sell
    if (/^[1-9]$/.test(key)) {
      const idx = parseInt(key, 10) - 1;
      if (this.activeTab === 'buy' && this.merchant) {
        this.executeBuy(engine, idx);
      } else {
        this.executeSell(engine, idx);
      }
      return true;
    }

    // Enter / Space to buy or sell selected
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (this.activeTab === 'buy' && this.merchant) {
        this.executeBuy(engine, this.selectedBuyIndex);
      } else {
        this.executeSell(engine, this.selectedSellIndex);
      }
      return true;
    }

    // Town Service Hotkeys
    if (this.activeNpc?.role === 'priest') {
      if (key.toLowerCase() === 'c') {
        this.executeCleanseCurses(engine);
        return true;
      }
      if (key.toLowerCase() === 'h') {
        this.executeHealRestore(engine);
        return true;
      }
    }

    if (this.activeNpc?.role === 'sage') {
      if (key.toLowerCase() === 'i') {
        this.executeIdentify(engine);
        return true;
      }
      if (key.toLowerCase() === 'a') {
        this.executeRunAdvisory(engine);
        return true;
      }
      if (key.toLowerCase() === 'b') {
        if (this.onOpenCompendium) {
          this.close();
          this.onOpenCompendium();
        }
        return true;
      }
    }

    if (this.activeNpc?.role === 'banker') {
      if (key.toLowerCase() === 'e') {
        this.executeCompactCoins(engine);
        return true;
      }
    }

    return true; // Consume other keys when dialog is active
  }

  public getSellableItems(engine: GameEngine): Item[] {
    const items = engine.player.inventory.primaryPack.getItems();
    // Exclude currency items from normal merchandise sell list (handled by Bank)
    return items.filter((i) => i.category !== 'currency');
  }

  public executeBuy(engine: GameEngine, itemIndex: number): void {
    if (!this.merchant) return;
    const result = engine.commandBus.dispatch({
      type: 'buy_item',
      payload: { merchant: this.merchant, itemIndex },
    });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.selectedBuyIndex >= this.merchant.stock.length) {
      this.selectedBuyIndex = Math.max(0, this.merchant.stock.length - 1);
    }
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeSell(engine: GameEngine, itemIndex: number): void {
    const sellable = this.getSellableItems(engine);
    if (itemIndex < 0 || itemIndex >= sellable.length) return;
    const targetItem = sellable[itemIndex];

    if (this.merchant) {
      const result = engine.commandBus.dispatch({
        type: 'sell_item',
        payload: { merchant: this.merchant, itemIndex, item: targetItem },
      });
      this.statusMessage = result.message ?? '';
      this.statusColor = result.success ? '#4ade80' : '#f87171';
    } else {
      this.statusMessage = 'This person is not buying merchandise.';
      this.statusColor = '#f87171';
    }

    const updatedSellable = this.getSellableItems(engine);
    if (this.selectedSellIndex >= updatedSellable.length) {
      this.selectedSellIndex = Math.max(0, updatedSellable.length - 1);
    }
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeCleanseCurses(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'temple_cleanse' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeHealRestore(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'temple_heal' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeIdentify(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'sage_identify' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#facc15';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeRunAdvisory(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'sage_advisory' });
    this.statusMessage = result.message ?? '';
    this.statusColor = '#facc15';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeCompactCoins(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'bank_compact' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#facc15';
    if (this.onStateChanged) this.onStateChanged();
  }

  public render(ctx: CanvasRenderingContext2D, engine: GameEngine, canvasW: number, canvasH: number): void {
    if (!this.isOpen || !this.activeNpc) return;

    this.theme = resolveThemeTokens(engine.manifest?.theme);
    const theme = this.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    this.clickZones = [];
    const npc = this.activeNpc;
    const player = engine.player;
    const coins = getPlayerCurrencyBreakdown(player);
    const totalCp = getPlayerTotalCp(player);
    const coinItems = getPlayerCoinItems(player);
    const coinWeightGrams = coinItems.reduce((sum, c) => sum + c.item.totalWeight(), 0);

    // 1. Dark modal backdrop
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Dialog Window Dimensions
    const modalW = Math.min(canvasW - 32, 680);
    const modalH = Math.min(canvasH - 40, 520);
    const modalX = Math.floor((canvasW - modalW) / 2);
    const modalY = Math.floor((canvasH - modalH) / 2);

    // Window Body
    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(modalX, modalY, modalW, modalH);

    // Beveled Border
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1);

    // Title Bar
    const titleBarH = 32;
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(modalX, modalY, modalW, titleBarH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(modalX, modalY + titleBarH + 0.5);
    ctx.lineTo(modalX + modalW, modalY + titleBarH + 0.5);
    ctx.stroke();

    const townName = engine.manifest?.town?.name?.toUpperCase() ?? 'TOWN';
    const title = this.merchant
      ? `${this.merchant.shopName.toUpperCase()} - ${townName}`
      : `${npc.name.toUpperCase()} - ${townName}`;

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.modalTitlebarText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, modalX + 12, modalY + titleBarH / 2);

    // Close button [X]
    const closeBtnX = modalX + modalW - 28;
    const closeBtnY = modalY + 6;
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

    // 3. NPC Greeting / Banner
    const bannerY = modalY + 38;
    const bannerH = 46;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(modalX + 10, bannerY, modalW - 20, bannerH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(modalX + 10.5, bannerY + 0.5, modalW - 21, bannerH - 1);

    // Draw NPC avatar sprite
    if (this.atlas) {
      const npcSprite = getEntitySpriteKey(npc);
      this.atlas.drawSprite(ctx, npcSprite, modalX + 16, bannerY + 7, 32);
    }

    // NPC Name & Speech
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText(`${npc.name} (${npc.role.toUpperCase()}):`, modalX + 56, bannerY + 14);

    ctx.font = `italic 11px ${font}`;
    ctx.fillStyle = theme.hudText;
    const quote = `"${npc.dialogText}"`;
    ctx.fillText(quote.length > 70 ? quote.slice(0, 68) + '..."' : quote, modalX + 56, bannerY + 32);

    // 4. Branch rendering depending on NPC Role
    if (this.merchant) {
      this.renderMerchantTrading(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 8);
    } else if (npc.role === 'priest') {
      this.renderTempleServices(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 12);
    } else if (npc.role === 'sage') {
      this.renderSageServices(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 12);
    } else if (npc.role === 'banker') {
      this.renderBankerServices(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 12, coinItems, coinWeightGrams);
    } else {
      this.renderTownspersonDialog(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 12);
    }

    // 5. Common Wealth & Status Footer
    this.renderFooter(ctx, engine, modalX, modalY, modalW, modalH, coins, totalCp, coinWeightGrams);
  }

  private renderMerchantTrading(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    _modalY: number,
    modalW: number,
    _modalH: number,
    startY: number
  ): void {
    if (!this.merchant) return;
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Tabs: [Buy Goods] | [Sell Items]
    const tabW = 140;
    const tabH = 26;
    const buyTabX = modalX + 12;
    const sellTabX = buyTabX + tabW + 6;

    // Buy Tab
    ctx.fillStyle = this.activeTab === 'buy' ? theme.accent : theme.cardBg;
    ctx.fillRect(buyTabX, startY, tabW, tabH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(buyTabX + 0.5, startY + 0.5, tabW - 1, tabH - 1);
    ctx.fillStyle = this.activeTab === 'buy' ? theme.text : theme.textMuted;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`[B] BUY GOODS (${this.merchant.stock.length})`, buyTabX + tabW / 2, startY + tabH / 2 + 1);

    this.clickZones.push({
      x: buyTabX,
      y: startY,
      width: tabW,
      height: tabH,
      action: () => {
        this.activeTab = 'buy';
      },
    });

    // Sell Tab
    const sellable = this.getSellableItems(engine);
    ctx.fillStyle = this.activeTab === 'sell' ? theme.accent : theme.cardBg;
    ctx.fillRect(sellTabX, startY, tabW, tabH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(sellTabX + 0.5, startY + 0.5, tabW - 1, tabH - 1);
    ctx.fillStyle = this.activeTab === 'sell' ? theme.text : theme.textMuted;
    ctx.fillText(`[S] SELL ITEMS (${sellable.length})`, sellTabX + tabW / 2, startY + tabH / 2 + 1);

    this.clickZones.push({
      x: sellTabX,
      y: startY,
      width: tabW,
      height: tabH,
      action: () => {
        this.activeTab = 'sell';
      },
    });

    const listY = startY + tabH + 8;
    const listW = modalW - 24;
    const listH = 175;

    // List container
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(modalX + 12, listY, listW, listH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(modalX + 12.5, listY + 0.5, listW - 1, listH - 1);

    const items = this.activeTab === 'buy' ? this.merchant.stock : sellable;
    const selectedIdx = this.activeTab === 'buy' ? this.selectedBuyIndex : this.selectedSellIndex;
    const rowH = 24;

    if (items.length === 0) {
      ctx.fillStyle = theme.textMuted;
      ctx.font = `italic 12px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        this.activeTab === 'buy' ? 'Merchant stock is sold out.' : 'No sellable items in backpack.',
        modalX + 12 + listW / 2,
        listY + listH / 2
      );
      return;
    }

    for (let i = 0; i < Math.min(items.length, 7); i++) {
      const item = items[i];
      const isSelected = i === selectedIdx;
      const rowY = listY + 4 + i * rowH;
      const priceCp = this.activeTab === 'buy' ? getItemBuyPrice(item) : getItemSellPrice(item);

      // Row background
      ctx.fillStyle = isSelected ? theme.titlebarStart : i % 2 === 0 ? theme.modalBg : theme.cardBg;
      ctx.fillRect(modalX + 14, rowY, listW - 4, rowH - 2);

      // Shortcut key [1-9]
      ctx.font = `bold 11px ${font}`;
      ctx.fillStyle = isSelected ? theme.titlebarText : theme.hudAccent;
      ctx.textAlign = 'left';
      ctx.fillText(`[${i + 1}]`, modalX + 18, rowY + 12);

      // Item icon
      if (this.atlas) {
        const spriteKey = getItemSpriteKey(item);
        this.atlas.drawSprite(ctx, spriteKey, modalX + 44, rowY + 1, 20);
      }

      // Name and quality
      ctx.fillStyle = isSelected
        ? theme.titlebarText
        : item.quality === 'cursed'
        ? '#ef4444'
        : item.quality === 'enchanted'
        ? '#c084fc'
        : theme.hudText;
      ctx.fillText(item.displayName, modalX + 70, rowY + 12);

      // Weight & Bulk
      ctx.font = `10px ${font}`;
      ctx.fillStyle = isSelected ? theme.titlebarText : theme.textMuted;
      ctx.fillText(`${item.weight}g / ${item.bulk}cm³`, modalX + 320, rowY + 12);

      // Price
      ctx.font = `bold 11px ${font}`;
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(priceCp), modalX + listW - 14, rowY + 12);

      // Click to select & inspect (Zero-Tick)
      const captureIdx = i;
      this.clickZones.push({
        x: modalX + 14,
        y: rowY,
        width: listW - 4,
        height: rowH - 2,
        action: () => {
          if (this.activeTab === 'buy') {
            this.selectedBuyIndex = captureIdx;
          } else {
            this.selectedSellIndex = captureIdx;
          }
        },
      });
    }

    // Inspector box for selected item (Zero-Tick store inspection)
    const inspectY = listY + listH + 6;
    const inspectH = 50;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(modalX + 12, inspectY, listW, inspectH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(modalX + 12.5, inspectY + 0.5, listW - 1, inspectH - 1);

    const activeItem = items[selectedIdx];
    if (activeItem) {
      const activePrice = this.activeTab === 'buy' ? getItemBuyPrice(activeItem) : getItemSellPrice(activeItem);
      ctx.font = `bold 11px ${font}`;
      ctx.fillStyle = activeItem.quality === 'cursed' ? '#ef4444' : activeItem.identified && activeItem.quality === 'enchanted' ? '#c084fc' : theme.hudAccent;
      ctx.textAlign = 'left';
      ctx.fillText(`${activeItem.displayName} [${activeItem.category}] - ${activeItem.weight}g / ${activeItem.bulk}cm³`, modalX + 18, inspectY + 14);

      ctx.font = `10px ${font}`;
      ctx.fillStyle = theme.textMuted;
      const desc = activeItem.description || 'Standard mercantile ware.';
      ctx.fillText(desc.length > 55 ? desc.slice(0, 52) + '...' : desc, modalX + 18, inspectY + 28);

      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = '#facc15';
      const actionText = `[Enter] or Double-Click to ${this.activeTab === 'buy' ? 'Buy (' + formatCurrency(activePrice) + ')' : 'Sell (' + formatCurrency(activePrice) + ')'}`;
      ctx.fillText(actionText, modalX + 18, inspectY + 42);
    }
  }

  private renderTempleServices(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    _modalY: number,
    modalW: number,
    _modalH: number,
    startY: number
  ): void {
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Service 1: Cleanse Curses
    const s1Y = startY;
    const sH = 75;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s1Y, boxW, sH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s1Y + 0.5, boxW - 1, sH - 1);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    const templeName = engine.manifest?.town?.services?.templeName?.toUpperCase() ?? 'CLEANSING RITUAL';
    ctx.fillText(`${templeName} (Cost: 50 GP)`, boxX + 14, s1Y + 20);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText("Divine energy shatters all curses bound to your equipped gear.", boxX + 14, s1Y + 38);
    ctx.fillText("Items are normalized and safely returned to your pack.", boxX + 14, s1Y + 54);

    const btn1W = 180;
    const btn1H = 30;
    const btn1X = boxX + boxW - btn1W - 14;
    const btn1Y = s1Y + 22;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btn1X, btn1Y, btn1W, btn1H);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[C] CLEANSE CURSES', btn1X + btn1W / 2, btn1Y + 16);

    this.clickZones.push({
      x: btn1X,
      y: btn1Y,
      width: btn1W,
      height: btn1H,
      action: () => this.executeCleanseCurses(engine),
    });

    // Service 2: Heal & Restore
    const s2Y = s1Y + sH + 12;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s2Y, boxW, sH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s2Y + 0.5, boxW - 1, sH - 1);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.healthBar;
    ctx.textAlign = 'left';
    ctx.fillText("DIVINE RESTORATION & VITALITY (Cost: 25 GP)", boxX + 14, s2Y + 20);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText("Purges poison, paralysis, and sluggishness. Restores all Hit Points", boxX + 14, s2Y + 38);
    ctx.fillText("and refills your arcane Mana pool to maximum.", boxX + 14, s2Y + 54);

    const btn2X = boxX + boxW - btn1W - 14;
    const btn2Y = s2Y + 22;
    ctx.fillStyle = theme.healthBar;
    ctx.fillRect(btn2X, btn2Y, btn1W, btn1H);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[H] HEAL & RESTORE', btn2X + btn1W / 2, btn2Y + 16);

    this.clickZones.push({
      x: btn2X,
      y: btn2Y,
      width: btn1W,
      height: btn1H,
      action: () => this.executeHealRestore(engine),
    });
  }

  private renderSageServices(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    _modalY: number,
    modalW: number,
    _modalH: number,
    startY: number
  ): void {
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    const unIdItems = [
      ...engine.player.inventory.primaryPack.getItems().filter((i) => !i.identified),
      ...engine.player.inventory.paperdoll.getAllEquipped().map((e) => e.item).filter((i) => !i.identified),
    ];

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 170);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 169);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#c084fc';
    ctx.textAlign = 'left';
    ctx.fillText("DECIPHER RUNES & RUNIC ENCHANTMENTS (Cost: 20 GP)", boxX + 14, startY + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    const sageName = engine.manifest?.town?.services?.sageName ?? 'The Sage';
    ctx.fillText(`${sageName} consults ancient texts to reveal unknown potions, scrolls,`, boxX + 14, startY + 40);
    ctx.fillText("weapons, and armor found within the depths.", boxX + 14, startY + 56);

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(`Unidentified Items In Possession: ${unIdItems.length}`, boxX + 14, startY + 84);

    let listY = startY + 102;
    for (let i = 0; i < Math.min(unIdItems.length, 3); i++) {
      ctx.font = `italic 11px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`• ${unIdItems[i].displayName} (${unIdItems[i].category})`, boxX + 24, listY);
      listY += 16;
    }

    const btnW = 190;
    const btnH = 30;
    const btnX = boxX + boxW - btnW - 14;
    const btnY = startY + 75;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[I] IDENTIFY AN ITEM', btnX + btnW / 2, btnY + 18);

    this.clickZones.push({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      action: () => this.executeIdentify(engine),
    });

    // Section 2: Strategic Advisory & Bestiary
    const s2Y = startY + 135;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s2Y, boxW, 140);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s2Y + 0.5, boxW - 1, 139);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText("STRATEGIC PREPARATION & SLAYER'S BESTIARY", boxX + 14, s2Y + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.fillText("Consult ancient wisdom to review encumbrance risks, cursed afflictions,", boxX + 14, s2Y + 40);
    ctx.fillText("and elemental threats before entering the dungeon abyss.", boxX + 14, s2Y + 56);

    // Advisory Button
    const btnAdvW = 190;
    const btnAdvX = boxX + 14;
    const btnAdvY = s2Y + 75;
    ctx.fillStyle = theme.manaBar;
    ctx.fillRect(btnAdvX, btnAdvY, btnAdvW, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[A] SEEK RUN ADVISORY', btnAdvX + btnAdvW / 2, btnAdvY + 19);

    this.clickZones.push({
      x: btnAdvX,
      y: btnAdvY,
      width: btnAdvW,
      height: 32,
      action: () => this.executeRunAdvisory(engine),
    });

    // Bestiary Button
    const btnBesW = 190;
    const btnBesX = btnAdvX + btnAdvW + 16;
    const btnBesY = s2Y + 75;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnBesX, btnBesY, btnBesW, 32);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText("[B] SLAYER'S CODEX", btnBesX + btnBesW / 2, btnBesY + 19);

    this.clickZones.push({
      x: btnBesX,
      y: btnBesY,
      width: btnBesW,
      height: 32,
      action: () => {
        if (this.onOpenCompendium) {
          this.close();
          this.onOpenCompendium();
        }
      },
    });
  }

  private renderBankerServices(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    _modalY: number,
    modalW: number,
    _modalH: number,
    startY: number,
    coinItems: Array<{ item: Item }>,
    coinWeightGrams: number
  ): void {
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 160);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 159);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText("DENOMINATION COMPACTION & BULLION EXCHANGE (No Fee)", boxX + 14, startY + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.fillText("Exchange loose Copper and Silver for compact, light Gold and Platinum pieces.", boxX + 14, startY + 40);
    ctx.fillText("Greatly reduces carrying weight and prevents encumbrance fatigue!", boxX + 14, startY + 56);

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText(`Current Coin Item Stacks: ${coinItems.length}   |   Current Total Coin Weight: ${(coinWeightGrams / 1000).toFixed(2)} kg (${coinWeightGrams} g)`, boxX + 14, startY + 84);

    const btnW = 220;
    const btnH = 34;
    const btnX = boxX + boxW - btnW - 14;
    const btnY = startY + 105;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[E] COMPACT COINS', btnX + btnW / 2, btnY + 21);

    this.clickZones.push({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      action: () => this.executeCompactCoins(engine),
    });
  }

  private renderTownspersonDialog(
    ctx: CanvasRenderingContext2D,
    _engine: GameEngine,
    modalX: number,
    _modalY: number,
    modalW: number,
    _modalH: number,
    startY: number
  ): void {
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = this.theme ?? resolveThemeTokens(_engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 140);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 139);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText("TOWN ADVICE & LOCAL LORE", boxX + 14, startY + 24);

    ctx.font = `12px ${font}`;
    ctx.fillStyle = theme.hudText;
    const townName = _engine.manifest?.town?.name ?? 'The town';
    ctx.fillText(`${townName} is peaceful, but the cellar entrance north-east holds`, boxX + 14, startY + 50);
    ctx.fillText("terrors from old myths. Make sure you purchase torches and", boxX + 14, startY + 70);
    ctx.fillText("sturdy armor before you venture down.", boxX + 14, startY + 90);
  }

  private renderFooter(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    modalX: number,
    modalY: number,
    modalW: number,
    modalH: number,
    coins: { platinum: number; gold: number; silver: number; copper: number },
    totalCp: number,
    coinWeightGrams: number
  ): void {
    const footerY = modalY + modalH - 74;
    const footerH = 64;
    const theme = this.theme ?? resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(modalX + 10, footerY, modalW - 20, footerH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(modalX + 10.5, footerY + 0.5, modalW - 21, footerH - 1);

    // Wealth Breakdown
    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(
      `FUNDS: [${coins.platinum} PP, ${coins.gold} GP, ${coins.silver} SP, ${coins.copper} CP] = ${totalCp} CP total`,
      modalX + 16,
      footerY + 16
    );

    // Coin Weight & Encumbrance
    const player = engine.player;
    const pack = player.inventory.primaryPack;
    ctx.font = `10px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(
      `Coin Weight: ${coinWeightGrams}g | Pack: ${pack.totalWeight()}g/${pack.maxWeightCapacity}g`,
      modalX + modalW - 18,
      footerY + 16
    );

    // Feedback Message or Hint
    ctx.textAlign = 'left';
    if (this.statusMessage) {
      ctx.fillStyle = this.statusColor || theme.hudAccent;
      ctx.font = `bold 11px ${font}`;
      ctx.fillText(this.statusMessage, modalX + 16, footerY + 36);
    } else {
      ctx.fillStyle = theme.textMuted;
      ctx.font = `italic 10px ${font}`;
      ctx.fillText(
        '[Tab] Switch Pane | [1-9] Quick Action | [Enter] Confirm | [Esc] Exit',
        modalX + 16,
        footerY + 36
      );
    }

    // Leave Button [Esc]
    const leaveBtnW = 90;
    const leaveBtnH = 22;
    const leaveBtnX = modalX + modalW - leaveBtnW - 16;
    const leaveBtnY = footerY + 34;

    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(leaveBtnX, leaveBtnY, leaveBtnW, leaveBtnH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(leaveBtnX + 0.5, leaveBtnY + 0.5, leaveBtnW - 1, leaveBtnH - 1);
    ctx.fillStyle = theme.hudText;
    ctx.font = `bold 10px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('LEAVE [ESC]', leaveBtnX + leaveBtnW / 2, leaveBtnY + 12);

    this.clickZones.push({
      x: leaveBtnX,
      y: leaveBtnY,
      width: leaveBtnW,
      height: leaveBtnH,
      action: () => this.close(),
    });
  }
}
