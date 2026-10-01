import {
  type Entity,
  type GameEngine,
  type Item,
  type Merchant,
  type NPC,
  formatCurrency,
  getItemBuyPrice,
  getItemSellPrice,
  getPlayerTotalCp,
} from '../../engine';
import { createDialogScrim, dialogButton, dialogHtml } from '../dialog';
import { escapeHtml, keyChip } from '../html';
import { formatLoad, formatWeight } from '../units';
import {
  type ServicePanel,
  type ShopAction,
  serviceTitle,
  servicePanelFor,
  servicePanelHtml,
} from './shopPanels';

/** Paints sprites and colors that live in src/rendering, which src/ui may not import. */
export interface ShopDialogOptions {
  drawItemIcon?: (canvas: HTMLCanvasElement, item: Item) => void;
  drawEntityIcon?: (canvas: HTMLCanvasElement, entity: Entity) => void;
  /** The item's quality/curse color, as the inventory shows it. */
  itemColor?: (item: Item) => string;
  /** Called after anything the shop changes, so the map and HUD redraw. */
  onStateChanged?: () => void;
}

type Tone = 'good' | 'bad' | 'warn' | 'info';

/**
 * A town service as a dialog in the one frame (ADR-0011): walking into a merchant or
 * townsperson opens it over the town, which is what dialogs are for (they interrupt
 * play; the character menu holds what doesn't). Merchants show Buy and Sell lists with
 * the selected item beside them; other townspeople show their services as offers, each
 * with a key. Every trade or service goes through `engine.commandBus`, as before, and
 * stays outside the replay trail (ARCHITECTURE.md §2).
 *
 * InputHandler registers it on the modal stack as 'shop' through `onOpen`/`onClose`.
 */
export class ShopDialog {
  public isOpen = false;
  public activeNpc: NPC | null = null;
  public merchant: Merchant | null = null;
  public activeTab: 'buy' | 'sell' = 'buy';
  public selectedBuyIndex = 0;
  public selectedSellIndex = 0;
  public statusMessage = '';
  public statusTone: Tone = 'info';

  public onOpenCompendium?: () => void;
  public onOpenRuneTree?: () => void;
  public onOpen?: (npc: NPC) => void;
  public onClose?: () => void;

  private engine?: GameEngine;
  private readonly options: ShopDialogOptions;
  private scrim: HTMLElement | null = null;

  constructor(options: ShopDialogOptions = {}) {
    this.options = options;
  }

  public open(npc: NPC, merchant: Merchant | null | undefined, engine: GameEngine): void {
    this.engine = engine;
    this.isOpen = true;
    this.activeNpc = npc;
    this.merchant = merchant ?? null;
    this.activeTab = 'buy';
    this.selectedBuyIndex = 0;
    this.selectedSellIndex = 0;
    this.statusMessage = '';
    this.statusTone = 'info';
    this.onOpen?.(npc);
    this.scrim ??= createDialogScrim('shop-dialog');
    this.render();
    if (this.scrim) this.scrim.style.display = 'flex';
    this.options.onStateChanged?.();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.activeNpc = null;
    this.merchant = null;
    this.statusMessage = '';
    if (this.scrim) {
      this.scrim.style.display = 'none';
      this.scrim.innerHTML = '';
    }
    this.onClose?.();
    this.options.onStateChanged?.();
  }

  // ---- Keys ------------------------------------------------------------------

  public handleKeyDown(event: KeyboardEvent, engine: GameEngine): boolean {
    if (!this.isOpen) return false;
    this.engine = engine;
    const key = event.key;
    const letter = key.length === 1 ? key.toUpperCase() : '';

    if (key === 'Escape') {
      this.close();
      return true;
    }

    if (this.merchant) {
      if (key === 'Tab') {
        event.preventDefault();
        this.setTab(this.activeTab === 'buy' ? 'sell' : 'buy');
        return true;
      }
      if (letter === 'B' || letter === 'S') {
        this.setTab(letter === 'B' ? 'buy' : 'sell');
        return true;
      }
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault();
        this.moveSelection(key === 'ArrowDown' ? 1 : -1, engine);
        return true;
      }
      if (/^[1-9]$/.test(key)) {
        this.trade(engine, parseInt(key, 10) - 1);
        return true;
      }
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.trade(engine, this.selectedIndex);
        return true;
      }
      return true;
    }

    const offer = this.panel(engine)?.offers.find((o) => o.key === letter);
    if (offer && !offer.disabled) this.run(offer.act, engine);
    // Every other key is swallowed while the dialog is open.
    return true;
  }

  // ---- Merchant state ----------------------------------------------------------

  public getSellableItems(engine: GameEngine): Item[] {
    // Coins aren't merchandise; the banker exchanges them.
    return engine.player.inventory.primaryPack.getItems().filter((i) => i.category !== 'currency');
  }

  /**
   * Stock filtered by each item's `predicate` against live world state (e.g. a
   * renown-gated vendor unlock via `minCounter`) — see `Merchant.getAvailableStock`.
   */
  public getBuyableItems(engine: GameEngine): Item[] {
    return this.merchant ? this.merchant.getAvailableStock(engine.worldState) : [];
  }

  private get selectedIndex(): number {
    return this.activeTab === 'buy' ? this.selectedBuyIndex : this.selectedSellIndex;
  }

  private listFor(engine: GameEngine): Item[] {
    return this.activeTab === 'buy' ? this.getBuyableItems(engine) : this.getSellableItems(engine);
  }

  private priceOf(item: Item, engine: GameEngine): number {
    return this.activeTab === 'buy'
      ? getItemBuyPrice(item, engine.worldState, engine.manifest.merchantPricing)
      : getItemSellPrice(item);
  }

  private setTab(tab: 'buy' | 'sell'): void {
    this.activeTab = tab;
    this.changed();
  }

  private select(index: number): void {
    if (index === this.selectedIndex) return;
    if (this.activeTab === 'buy') this.selectedBuyIndex = index;
    else this.selectedSellIndex = index;
    this.changed();
    this.scrim?.querySelector?.('.shop-row.is-selected')?.scrollIntoView?.({ block: 'nearest' });
  }

  private moveSelection(step: number, engine: GameEngine): void {
    const count = this.listFor(engine).length;
    if (count === 0) return;
    this.select(Math.max(0, Math.min(count - 1, this.selectedIndex + step)));
  }

  /** Buys or sells the item at `index` of the open list. */
  public trade(engine: GameEngine, index: number): void {
    if (this.activeTab === 'buy') this.executeBuy(engine, index);
    else this.executeSell(engine, index);
  }

  public executeBuy(engine: GameEngine, displayIndex: number): void {
    if (!this.merchant) return;
    const item = this.getBuyableItems(engine)[displayIndex];
    if (!item) {
      this.report({ success: false, message: 'That item is no longer available.' });
      return;
    }
    // Resolve by item ID rather than a raw stock-array index, since the displayed
    // (predicate-filtered) list can be a strict subset of the merchant's full stock.
    const result = engine.commandBus.dispatch({
      type: 'buy_item',
      payload: { merchant: this.merchant, itemIndex: item.id },
    });
    this.selectedBuyIndex = Math.max(0, Math.min(this.selectedBuyIndex, this.getBuyableItems(engine).length - 1));
    this.report(result);
  }

  public executeSell(engine: GameEngine, itemIndex: number): void {
    if (!this.merchant) return;
    const sellable = this.getSellableItems(engine);
    const item = sellable[itemIndex];
    if (!item) return;
    const result = engine.commandBus.dispatch({
      type: 'sell_item',
      payload: { merchant: this.merchant, itemIndex, item },
    });
    this.selectedSellIndex = Math.max(0, Math.min(this.selectedSellIndex, this.getSellableItems(engine).length - 1));
    this.report(result);
  }

  // ---- Town services -------------------------------------------------------------

  private panel(engine: GameEngine): ServicePanel | null {
    return this.activeNpc && !this.merchant ? servicePanelFor(engine, this.activeNpc) : null;
  }

  /** Runs a button's or key's action. */
  public run(act: ShopAction, engine: GameEngine): void {
    const bus = engine.commandBus;
    switch (act) {
      case 'trade':
        this.trade(engine, this.selectedIndex);
        return;
      case 'tab-buy':
        this.setTab('buy');
        return;
      case 'tab-sell':
        this.setTab('sell');
        return;
      case 'leave':
        this.close();
        return;
      case 'cleanse':
        this.report(bus.dispatch({ type: 'temple_cleanse' }));
        return;
      case 'heal':
        this.report(bus.dispatch({ type: 'temple_heal' }));
        return;
      case 'identify':
        this.report(bus.dispatch({ type: 'sage_identify' }), 'warn');
        return;
      case 'advise':
        this.report({ success: true, message: bus.dispatch({ type: 'sage_advisory' }).message }, 'warn', 'info');
        return;
      case 'compact':
        this.report(bus.dispatch({ type: 'bank_compact' }), 'warn');
        return;
      case 'bond':
        this.report(bus.dispatch({ type: 'trainer_bond_companion' }));
        return;
      case 'revive':
        this.report(bus.dispatch({ type: 'trainer_revive_companion' }));
        return;
      case 'bodyguard':
      case 'skirmisher':
        this.report(bus.dispatch({ type: 'trainer_switch_archetype', payload: { archetype: act } }));
        return;
      case 'teach':
        this.report(
          bus.dispatch({ type: 'trainer_teach_skill', payload: { skillId: 'rally_howl', skillName: 'Rally Howl' } })
        );
        return;
      case 'bestiary':
        if (this.onOpenCompendium) {
          this.close();
          this.onOpenCompendium();
        }
        return;
      case 'rune-ranks':
        if (engine.player?.hasDiscoveredRune && this.onOpenRuneTree) {
          this.close();
          this.onOpenRuneTree();
        }
        return;
    }
  }

  /** Shows a command's message, toned by whether it worked. */
  private report(result: { success: boolean; message?: string }, failTone: Tone = 'bad', okTone: Tone = 'good'): void {
    this.statusMessage = result.message ?? '';
    this.statusTone = result.success ? okTone : failTone;
    this.changed();
  }

  private changed(): void {
    this.render();
    this.options.onStateChanged?.();
  }

  // ---- DOM -------------------------------------------------------------------------

  private render(): void {
    const scrim = this.scrim;
    const engine = this.engine;
    const npc = this.activeNpc;
    if (!scrim || !engine || !npc || !this.isOpen) return;

    const listScroll = scrim.querySelector?.('.shop-list')?.scrollTop ?? 0;
    const panel = this.panel(engine);
    const title = serviceTitle(engine, npc, this.merchant?.shopName);
    const body = `${this.greetingHtml(engine, npc, title !== npc.name)}${this.merchant ? this.tradeHtml(engine) : servicePanelHtml(panel!)}
      <div class="shop-status is-${this.statusTone}" role="status" aria-live="polite">${escapeHtml(this.statusMessage)}</div>`;

    const hints = this.merchant
      ? [
          { keys: ['↑', '↓'], label: 'choose' },
          { keys: ['Enter'], label: this.activeTab === 'buy' ? 'buy' : 'sell' },
          { keys: ['1–9'], label: 'at once' },
          { keys: ['B', 'S'], label: 'buy or sell list' },
        ]
      : [];
    scrim.innerHTML = dialogHtml({
      title,
      titleId: 'shop-dialog-title',
      kicker: engine.manifest?.town?.name,
      closeId: 'shop-close',
      closeTitle: 'Leave (Esc)',
      size: 'wide',
      body,
      hints,
      actions: dialogButton('shop-leave', 'Leave', { key: 'Esc' }),
    });

    this.paintIcons(scrim, engine, npc);
    const list = scrim.querySelector?.('.shop-list');
    if (list) list.scrollTop = listScroll;
    this.bind(scrim, engine);
  }

  /** `showName` is false when the dialog's title already is the NPC's name. */
  private greetingHtml(engine: GameEngine, npc: NPC, showName: boolean): string {
    const pack = engine.player.inventory.primaryPack;
    return `
      <div class="shop-greet">
        <canvas class="shop-portrait" width="40" height="40" aria-hidden="true"></canvas>
        <div class="shop-greet-text">
          ${showName ? `<div class="shop-npc">${escapeHtml(npc.name)}</div>` : ''}
          <div class="shop-quote">“${escapeHtml(npc.dialogText)}”</div>
        </div>
        <dl class="ui-kv shop-purse">
          <dt>Purse</dt><dd class="ui-num shop-purse-total">${escapeHtml(formatCurrency(getPlayerTotalCp(engine.player)))}</dd>
          <dt>Pack</dt><dd class="ui-num">${escapeHtml(formatLoad(pack.totalWeight(), pack.maxWeightCapacity))}</dd>
        </dl>
      </div>`;
  }

  private tradeHtml(engine: GameEngine): string {
    const buyCount = this.getBuyableItems(engine).length;
    const sellCount = this.getSellableItems(engine).length;
    const items = this.listFor(engine);
    const selected = this.selectedIndex;
    const tab = (id: 'buy' | 'sell', label: string, k: string, count: number) =>
      `<button type="button" class="st-subtab" role="tab" aria-selected="${this.activeTab === id}" data-act="tab-${id}">${label} <span class="ui-faint">${count}</span> ${keyChip(k)}</button>`;

    const rows = items
      .map((item, i) => {
        const color = this.options.itemColor?.(item);
        return `
        <button type="button" class="bs-row shop-row${i === selected ? ' is-selected' : ''}" role="option" aria-selected="${i === selected}" data-row="${i}">
          <span class="shop-row-key">${i < 9 ? keyChip(String(i + 1)) : ''}</span>
          <canvas class="shop-icon" width="24" height="24" data-item="${i}" aria-hidden="true"></canvas>
          <span class="bs-name"${color ? ` style="color: ${escapeHtml(color)}"` : ''}>${escapeHtml(item.displayName)}</span>
          <span class="ui-num ui-faint">${escapeHtml(formatWeight(item.weight))}</span>
          <span class="ui-num shop-price">${escapeHtml(formatCurrency(this.priceOf(item, engine)))}</span>
        </button>`;
      })
      .join('');
    const empty = this.activeTab === 'buy' ? 'Sold out for now.' : 'Nothing in your pack to sell.';

    return `
      <div class="shop-trade">
        <div class="ui-col">
          <div class="st-subtabs" role="tablist">${tab('buy', 'Buy', 'B', buyCount)}${tab('sell', 'Sell', 'S', sellCount)}</div>
          <div class="ui-inset ui-scroll shop-list" role="listbox" aria-label="${this.activeTab === 'buy' ? 'For sale' : 'Your pack'}">
            ${rows || `<div class="ui-note bs-empty">${empty}</div>`}
          </div>
        </div>
        ${this.detailHtml(engine, items[selected])}
      </div>`;
  }

  private detailHtml(engine: GameEngine, item: Item | undefined): string {
    if (!item) return '<div class="ui-card shop-detail"><div class="ui-note">Choose an item to see it here.</div></div>';
    const price = formatCurrency(this.priceOf(item, engine));
    const verb = this.activeTab === 'buy' ? 'Buy' : 'Sell';
    const color = this.options.itemColor?.(item);
    return `
      <div class="ui-card shop-detail">
        <div class="shop-detail-head">
          <canvas class="shop-detail-icon" width="48" height="48" data-detail aria-hidden="true"></canvas>
          <div>
            <div class="shop-detail-name"${color ? ` style="color: ${escapeHtml(color)}"` : ''}>${escapeHtml(item.displayName)}</div>
            <div class="ui-note">${escapeHtml(item.category)}</div>
          </div>
        </div>
        ${item.description ? `<div class="shop-detail-desc">${escapeHtml(item.description)}</div>` : ''}
        <dl class="ui-kv">
          <dt>Weight</dt><dd class="ui-num">${escapeHtml(formatWeight(item.weight))}</dd>
          <dt>Bulk</dt><dd class="ui-num">${item.bulk} cm³</dd>
          <dt>${this.activeTab === 'buy' ? 'Price' : 'They pay'}</dt><dd class="ui-num shop-price">${escapeHtml(price)}</dd>
        </dl>
        ${dialogButton('shop-trade', `${verb} for ${price}`, { primary: true, key: 'Enter', attrs: 'data-act="trade"' })}
      </div>`;
  }

  private paintIcons(scrim: HTMLElement, engine: GameEngine, npc: NPC): void {
    if (typeof scrim.querySelector !== 'function') return;
    const portrait = scrim.querySelector<HTMLCanvasElement>('.shop-portrait');
    if (portrait) this.options.drawEntityIcon?.(portrait, npc);
    if (!this.merchant || !this.options.drawItemIcon) return;
    const items = this.listFor(engine);
    scrim.querySelectorAll<HTMLCanvasElement>('canvas[data-item]').forEach((canvas) => {
      const item = items[Number(canvas.dataset.item)];
      if (item) this.options.drawItemIcon!(canvas, item);
    });
    const detail = scrim.querySelector<HTMLCanvasElement>('canvas[data-detail]');
    const selected = items[this.selectedIndex];
    if (detail && selected) this.options.drawItemIcon(detail, selected);
  }

  private bind(scrim: HTMLElement, engine: GameEngine): void {
    if (typeof scrim.querySelectorAll !== 'function') return;
    scrim.querySelector('#shop-close')?.addEventListener('click', () => this.close());
    scrim.querySelector('#shop-leave')?.addEventListener('click', () => this.close());
    scrim.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', () => this.run(el.dataset.act as ShopAction, engine));
    });
    scrim.querySelectorAll<HTMLElement>('[data-row]').forEach((el) => {
      const index = Number(el.dataset.row);
      // A click selects and re-renders, replacing this row, so a double-click is read
      // from the second click's count rather than a dblclick on a node now gone.
      el.addEventListener('click', (e) => {
        if (e.detail >= 2) this.trade(engine, index);
        else this.select(index);
      });
    });
  }
}
