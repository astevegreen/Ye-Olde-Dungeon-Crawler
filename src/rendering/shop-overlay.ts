import type { GameEngine } from '../engine';
import type { NPC } from '../engine';
import type { Merchant } from '../engine';
import type { Item } from '../engine';
import { getItemBuyPrice, getItemSellPrice } from '../engine';
import {
  formatCurrency,
  getPlayerCurrencyBreakdown,
  getPlayerTotalCp,
  getPlayerCoinItems,
} from '../engine';
import type { SpriteAtlas } from './atlas/sprite-atlas';
import { getItemSpriteKey, getEntitySpriteKey } from './atlas/sprite-mapper';
import { resolveThemeTokens, type ThemeTokens } from './theme';
import type { ClickZone, ShopPanelBounds, ShopPanelContext } from './shop/types';
import {
  renderTempleServices,
  renderSageServices,
  renderBankerServices,
  renderTrainerServices,
  renderTownspersonDialog,
  renderFooter,
} from './shop';

export type { ClickZone } from './shop/types';

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
  public onOpenRuneTree?: () => void;
  public onOpen?: (npc: NPC) => void;
  public onClose?: () => void;
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
    if (this.onOpen) {
      this.onOpen(npc);
    }
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public close(): void {
    this.isOpen = false;
    this.activeNpc = null;
    this.merchant = null;
    this.statusMessage = '';
    if (this.onClose) {
      this.onClose();
    }
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
    const items = this.activeTab === 'buy' ? this.getBuyableItems(engine) : this.getSellableItems(engine);
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
        this.selectedBuyIndex = Math.min(this.getBuyableItems(engine).length - 1, this.selectedBuyIndex + 1);
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

    if (this.activeNpc?.role === 'trainer') {
      if (key.toLowerCase() === 't') {
        this.executeBondCompanion(engine);
        return true;
      }
      if (key.toLowerCase() === 'r') {
        this.executeReviveCompanion(engine);
        return true;
      }
      if (key.toLowerCase() === 'g') {
        this.executeSwitchArchetype(engine, 'bodyguard');
        return true;
      }
      if (key.toLowerCase() === 'k') {
        this.executeSwitchArchetype(engine, 'skirmisher');
        return true;
      }
      if (key.toLowerCase() === 'w') {
        this.executeTeachRallyHowl(engine);
        return true;
      }
    }

    const attunementNpcId = engine.manifest?.runeOfReturn?.attunementNpcId;
    if (attunementNpcId && this.activeNpc?.id === attunementNpcId) {
      if (key.toLowerCase() === 'u') {
        if (engine.player?.hasDiscoveredRune && this.onOpenRuneTree) {
          this.close();
          this.onOpenRuneTree();
        }
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

  /**
   * Stock filtered by each item's `predicate` against live world state (e.g. a
   * renown-gated vendor unlock via `minCounter`) — see `Merchant.getAvailableStock`.
   */
  public getBuyableItems(engine: GameEngine): Item[] {
    return this.merchant ? this.merchant.getAvailableStock(engine.worldState) : [];
  }

  public executeBuy(engine: GameEngine, displayIndex: number): void {
    if (!this.merchant) return;
    const buyable = this.getBuyableItems(engine);
    const item = buyable[displayIndex];
    if (!item) {
      this.statusMessage = 'That item is no longer available.';
      this.statusColor = '#f87171';
      if (this.onStateChanged) this.onStateChanged();
      return;
    }
    // Resolve by item ID rather than a raw stock-array index, since the displayed
    // (predicate-filtered) list can be a strict subset of the merchant's full stock.
    const result = engine.commandBus.dispatch({
      type: 'buy_item',
      payload: { merchant: this.merchant, itemIndex: item.id },
    });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    const updatedBuyable = this.getBuyableItems(engine);
    if (this.selectedBuyIndex >= updatedBuyable.length) {
      this.selectedBuyIndex = Math.max(0, updatedBuyable.length - 1);
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

  // Companions & Pet Progression, Phase 2 (docs/architecture/content-companions.md) trainer services.
  public executeBondCompanion(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'trainer_bond_companion' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeReviveCompanion(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({ type: 'trainer_revive_companion' });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeSwitchArchetype(engine: GameEngine, archetype: 'bodyguard' | 'skirmisher'): void {
    const result = engine.commandBus.dispatch({ type: 'trainer_switch_archetype', payload: { archetype } });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
    if (this.onStateChanged) this.onStateChanged();
  }

  public executeTeachRallyHowl(engine: GameEngine): void {
    const result = engine.commandBus.dispatch({
      type: 'trainer_teach_skill',
      payload: { skillId: 'rally_howl', skillName: 'Rally Howl' },
    });
    this.statusMessage = result.message ?? '';
    this.statusColor = result.success ? '#4ade80' : '#f87171';
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
      const npcSprite = getEntitySpriteKey(npc, (k) => this.atlas?.hasSprite(k) ?? false);
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
    const panelBounds: ShopPanelBounds = {
      modalX,
      modalY,
      modalW,
      modalH,
      startY: bannerY + bannerH + 12,
    };
    const panel: ShopPanelContext = {
      theme,
      addClickZone: (zone) => this.clickZones.push(zone),
    };

    if (this.merchant) {
      this.renderMerchantTrading(ctx, engine, modalX, modalY, modalW, modalH, bannerY + bannerH + 8);
    } else if (npc.role === 'priest') {
      renderTempleServices(ctx, engine, panelBounds, panel, {
        cleanseCurses: () => this.executeCleanseCurses(engine),
        healRestore: () => this.executeHealRestore(engine),
      });
    } else if (npc.role === 'sage') {
      renderSageServices(ctx, engine, panelBounds, panel, {
        identify: () => this.executeIdentify(engine),
        runAdvisory: () => this.executeRunAdvisory(engine),
        close: () => this.close(),
        openCompendium: this.onOpenCompendium,
      });
    } else if (npc.role === 'banker') {
      renderBankerServices(ctx, engine, panelBounds, { coinItems, coinWeightGrams }, panel, {
        compactCoins: () => this.executeCompactCoins(engine),
      });
    } else if (npc.role === 'trainer') {
      renderTrainerServices(ctx, engine, panelBounds, panel, {
        bondCompanion: () => this.executeBondCompanion(engine),
        reviveCompanion: () => this.executeReviveCompanion(engine),
        switchArchetype: (archetype) => this.executeSwitchArchetype(engine, archetype),
        teachRallyHowl: () => this.executeTeachRallyHowl(engine),
      });
    } else {
      renderTownspersonDialog(ctx, engine, panelBounds, { activeNpc: this.activeNpc }, panel, {
        close: () => this.close(),
        openRuneTree: this.onOpenRuneTree,
      });
    }

    // 5. Common Wealth & Status Footer
    renderFooter(
      ctx,
      engine,
      panelBounds,
      {
        coins,
        totalCp,
        coinWeightGrams,
        statusMessage: this.statusMessage,
        statusColor: this.statusColor,
      },
      panel,
      { close: () => this.close() }
    );
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
    const buyable = this.getBuyableItems(engine);

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
    ctx.fillText(`[B] BUY GOODS (${buyable.length})`, buyTabX + tabW / 2, startY + tabH / 2 + 1);

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

    const items = this.activeTab === 'buy' ? buyable : sellable;
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
      const priceCp = this.activeTab === 'buy' ? getItemBuyPrice(item, engine.worldState, engine.manifest.merchantPricing) : getItemSellPrice(item);

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
        const spriteKey = getItemSpriteKey(item, (k) => this.atlas?.hasSprite(k) ?? false);
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
      const activePrice = this.activeTab === 'buy' ? getItemBuyPrice(activeItem, engine.worldState, engine.manifest.merchantPricing) : getItemSellPrice(activeItem);
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
}
