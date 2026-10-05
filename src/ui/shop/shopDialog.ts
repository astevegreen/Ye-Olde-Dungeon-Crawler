import {
  Container,
  type Entity,
  type GameEngine,
  type Item,
  type Merchant,
  type NPC,
  formatCurrency,
  getItemBuyPrice,
  getItemSellPrice,
  getPlayerTotalCp,
  SmithService,
} from '../../engine';
import { createDialogScrim, dialogButton, dialogHtml } from '../dialog';
import { escapeHtml, keyChip } from '../html';
import { formatLoad, formatWeight } from '../units';
import { itemFrameClass, itemToneClass } from '../inventory/itemTone';
import { itemDetailHtml } from '../inventory/itemDetail';
import { ItemInspector } from '../inventory/itemInspector';
import {
  type ServicePanel,
  type ShopAction,
  identifiableItems,
  sageCreatures,
  sageViews,
  type SageView,
  nextBlessing,
  serviceTitle,
  templeChoices,
  servicePanelFor,
  servicePanelHtml,
} from './shopPanels';

/** Paints sprites and colors that live in src/rendering, which src/ui may not import. */
export interface ShopDialogOptions {
  drawItemIcon?: (canvas: HTMLCanvasElement, item: Item) => void;
  drawEntityIcon?: (canvas: HTMLCanvasElement, entity: Entity) => void;
  /** Called after anything the shop changes, so the map and HUD redraw. */
  onStateChanged?: () => void;
}

type Tone = 'good' | 'bad' | 'warn' | 'info';
type ShopTab = 'buy' | 'sell' | 'forge';

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
  public activeTab: ShopTab = 'buy';
  public selectedBuyIndex = 0;
  public selectedSellIndex = 0;
  /** The picked row of a smith's Forge list (tracker 2.7). */
  public selectedForgeIndex = 0;
  /** The picked row of a service's choices (the sage's unidentified items). */
  public selectedChoiceIndex = 0;
  /** The sage's open list (tracker 4.1). */
  public sageView: SageView = 'items';
  public statusMessage = '';
  public statusTone: Tone = 'info';

  public onOpenCompendium?: () => void;
  public onOpenRuneTree?: () => void;
  public onOpen?: (npc: NPC) => void;
  /** The hero greets an NPC (every time the dialog opens), e.g. for first-time hints. */
  public onGreet?: (npc: NPC, engine: GameEngine) => void;
  public onClose?: () => void;

  private engine?: GameEngine;
  private readonly options: ShopDialogOptions;
  private scrim: HTMLElement | null = null;
  /** Reads items the way the inventory does, for the detail panel. */
  private readonly inspector = new ItemInspector();

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
    this.selectedForgeIndex = 0;
    this.selectedChoiceIndex = 0;
    this.sageView = 'items';
    this.statusMessage = '';
    this.statusTone = 'info';
    this.onOpen?.(npc);
    this.onGreet?.(npc, engine);
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
        const tabs = this.tabs(engine);
        this.setTab(tabs[(tabs.indexOf(this.activeTab) + 1) % tabs.length]);
        return true;
      }
      if (letter === 'B' || letter === 'S') {
        this.setTab(letter === 'B' ? 'buy' : 'sell');
        return true;
      }
      if (letter === 'F' && this.smithId(engine)) {
        this.setTab('forge');
        return true;
      }
      if (letter === 'M' && this.smithId(engine)) {
        this.executeMasterwork(engine);
        return true;
      }
      if (letter === 'J') {
        this.sellJunk(engine);
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

    const panel = this.panel(engine);
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && panel?.views?.length) {
      event.preventDefault();
      const ids = panel.views.map((v) => v.id);
      const at = ids.indexOf(panel.view ?? ids[0]);
      this.setSageView(ids[(at + (key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length] as SageView);
      return true;
    }
    if ((key === 'ArrowUp' || key === 'ArrowDown') && panel?.choices?.length) {
      event.preventDefault();
      this.selectChoice((panel.selected ?? 0) + (key === 'ArrowDown' ? 1 : -1), panel.choices.length);
      return true;
    }
    const offer = panel?.offers.find((o) => o.key === letter);
    if (offer && !offer.disabled) this.run(offer.act, engine, offer.arg);
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
    if (this.activeTab === 'forge') return this.selectedForgeIndex;
    return this.activeTab === 'buy' ? this.selectedBuyIndex : this.selectedSellIndex;
  }

  /** The merchant's NPC id when they keep a forge (`TownServicesDefinition.smiths`). */
  private smithId(engine: GameEngine): string | undefined {
    const id = this.activeNpc?.id;
    return id && SmithService.smithFor(engine, id) ? id : undefined;
  }

  private tabs(engine: GameEngine): ShopTab[] {
    return this.smithId(engine) ? ['buy', 'sell', 'forge'] : ['buy', 'sell'];
  }

  /** What the forge lists: gear a step can raise, and, while it is on offer, gear the
   *  masterwork can (past the smith's own last step, say). */
  public getForgeItems(engine: GameEngine): Item[] {
    const id = this.smithId(engine);
    if (!id) return [];
    const items = SmithService.workableItems(engine, id);
    if (SmithService.masterworkAvailable(engine, id)) {
      for (const item of SmithService.masterworkItems(engine, id)) if (!items.includes(item)) items.push(item);
    }
    return items;
  }

  /** The open list as rows: identical goods (same kind, name, state and price) share one
   *  row, so five torches are one line, "×5". A trade takes the row's first item. The
   *  forge lists each piece on its own. */
  private rowsFor(engine: GameEngine, tab = this.activeTab): Item[][] {
    if (tab === 'forge') return this.getForgeItems(engine).map((item) => [item]);
    const items = tab === 'buy' ? this.getBuyableItems(engine) : this.getSellableItems(engine);
    const rows = new Map<string, Item[]>();
    for (const item of items) {
      const price = tab === 'buy' ? getItemBuyPrice(item, engine.worldState, engine.manifest.merchantPricing) : getItemSellPrice(item);
      // A container holds its own things: it never stacks.
      const key = item instanceof Container ? `#${item.id}` : [item.definitionId ?? item.name, item.displayName, item.quality, item.identified, item.junk, price].join('|');
      const row = rows.get(key);
      if (row) row.push(item);
      else rows.set(key, [item]);
    }
    return [...rows.values()];
  }

  private priceOf(item: Item, engine: GameEngine): number {
    if (this.activeTab === 'forge') return SmithService.nextStepPrice(engine, this.smithId(engine) ?? '', item) ?? 0;
    return this.activeTab === 'buy'
      ? getItemBuyPrice(item, engine.worldState, engine.manifest.merchantPricing)
      : getItemSellPrice(item);
  }

  private setTab(tab: ShopTab): void {
    this.activeTab = tab;
    this.changed();
  }

  private select(index: number): void {
    if (index === this.selectedIndex) return;
    if (this.activeTab === 'forge') this.selectedForgeIndex = index;
    else if (this.activeTab === 'buy') this.selectedBuyIndex = index;
    else this.selectedSellIndex = index;
    this.changed();
    this.scrim?.querySelector?.('.shop-row.is-selected')?.scrollIntoView?.({ block: 'nearest' });
  }

  private moveSelection(step: number, engine: GameEngine): void {
    const count = this.rowsFor(engine).length;
    if (count === 0) return;
    this.select(Math.max(0, Math.min(count - 1, this.selectedIndex + step)));
  }

  /** Buys, sells or raises the item at `index` of the open list. */
  public trade(engine: GameEngine, index: number): void {
    if (this.activeTab === 'forge') this.executeUpgrade(engine, index);
    else if (this.activeTab === 'buy') this.executeBuy(engine, index);
    else this.executeSell(engine, index);
  }

  /** The forge's step on the item at `index` (tracker 2.7). */
  public executeUpgrade(engine: GameEngine, index: number): void {
    const npcId = this.smithId(engine);
    const item = this.getForgeItems(engine)[index];
    if (!npcId || !item) return;
    const result = engine.commandBus.dispatch({ type: 'smith_upgrade', payload: { npcId, item } });
    this.selectedForgeIndex = Math.max(0, Math.min(this.selectedForgeIndex, this.getForgeItems(engine).length - 1));
    this.report(result);
  }

  /** The smith's one-time masterwork on the chosen forge item. */
  public executeMasterwork(engine: GameEngine): void {
    const npcId = this.smithId(engine);
    if (!npcId) return;
    this.activeTab = 'forge';
    const item = this.getForgeItems(engine)[this.selectedForgeIndex];
    if (!item || !SmithService.masterworkAvailable(engine, npcId)) {
      this.report({ success: false, message: 'That work is not on offer.' }, 'info');
      return;
    }
    const result = engine.commandBus.dispatch({ type: 'smith_masterwork', payload: { npcId, item } });
    this.selectedForgeIndex = Math.max(0, Math.min(this.selectedForgeIndex, this.getForgeItems(engine).length - 1));
    this.report(result);
  }

  public executeBuy(engine: GameEngine, displayIndex: number): void {
    if (!this.merchant) return;
    const item = this.rowsFor(engine, 'buy')[displayIndex]?.[0];
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
    this.selectedBuyIndex = Math.max(0, Math.min(this.selectedBuyIndex, this.rowsFor(engine, 'buy').length - 1));
    this.report(result);
  }

  public executeSell(engine: GameEngine, itemIndex: number): void {
    if (!this.merchant) return;
    const item = this.rowsFor(engine, 'sell')[itemIndex]?.[0];
    if (!item) return;
    const result = engine.commandBus.dispatch({
      type: 'sell_item',
      payload: { merchant: this.merchant, itemIndex: this.getSellableItems(engine).indexOf(item), item },
    });
    this.selectedSellIndex = Math.max(0, Math.min(this.selectedSellIndex, this.rowsFor(engine, 'sell').length - 1));
    this.report(result);
  }

  /** Items in the pack the hero marked as junk (J in the inventory). */
  private junkItems(engine: GameEngine): Item[] {
    return this.getSellableItems(engine).filter((item) => item.junk);
  }

  /** Sells everything marked as junk in one go (tracker 2.5, Q2 "C"). */
  public sellJunk(engine: GameEngine): void {
    if (!this.merchant) return;
    this.activeTab = 'sell';
    if (this.junkItems(engine).length === 0) {
      this.report({ success: false, message: 'Nothing in your pack is marked as junk. Mark it with J in your inventory.' }, 'info');
      return;
    }
    const result = engine.commandBus.dispatch({ type: 'sell_junk', payload: { merchant: this.merchant } });
    this.selectedSellIndex = Math.max(0, Math.min(this.selectedSellIndex, this.rowsFor(engine, 'sell').length - 1));
    this.report(result);
  }

  // ---- Town services -------------------------------------------------------------

  private panel(engine: GameEngine): ServicePanel | null {
    return this.activeNpc && !this.merchant ? servicePanelFor(engine, this.activeNpc, this.selectedChoiceIndex, this.sageView) : null;
  }

  private setSageView(view: SageView): void {
    if (view === this.sageView) return;
    this.sageView = view;
    this.selectedChoiceIndex = 0;
    this.changed();
  }

  private selectChoice(index: number, count: number): void {
    const next = Math.max(0, Math.min(count - 1, index));
    if (next === this.selectedChoiceIndex) return;
    this.selectedChoiceIndex = next;
    this.changed();
    this.scrim?.querySelector?.('.shop-choice.is-selected')?.scrollIntoView?.({ block: 'nearest' });
  }

  /** Runs a button's or key's action. */
  public run(act: ShopAction, engine: GameEngine, arg?: string): void {
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
      case 'tab-forge':
        this.setTab('forge');
        return;
      case 'masterwork':
        this.executeMasterwork(engine);
        return;
      case 'leave':
        this.close();
        return;
      case 'sell-junk':
        this.sellJunk(engine);
        return;
      case 'cleanse':
        this.report(bus.dispatch({ type: 'temple_cleanse' }));
        return;
      case 'heal':
        this.report(bus.dispatch({ type: 'temple_heal' }));
        return;
      case 'offer': {
        const item = templeChoices(engine)[this.selectedChoiceIndex];
        if (!item) return;
        const result = bus.dispatch({ type: 'temple_offer', payload: { item } });
        this.selectedChoiceIndex = Math.max(0, Math.min(this.selectedChoiceIndex, templeChoices(engine).length - 1));
        this.report(result);
        return;
      }
      case 'bless': {
        const blessing = nextBlessing(engine);
        if (!blessing) return;
        const item = blessing.effect.type === 'hallowItem' ? templeChoices(engine)[this.selectedChoiceIndex] : undefined;
        const result = bus.dispatch({ type: 'temple_bless', payload: { blessingId: blessing.id, item } });
        this.selectedChoiceIndex = 0;
        this.report(result);
        return;
      }
      case 'identify': {
        const item = identifiableItems(engine)[this.selectedChoiceIndex];
        if (item) this.report(bus.dispatch({ type: 'sage_identify', payload: { item } }), 'warn');
        return;
      }
      case 'view':
        if (arg && sageViews(engine).includes(arg as SageView)) this.setSageView(arg as SageView);
        return;
      case 'study':
      case 'rumor': {
        const creature = sageCreatures(engine, this.sageView)[this.selectedChoiceIndex];
        if (!creature) return;
        const result = bus.dispatch({ type: act === 'study' ? 'sage_study' : 'sage_rumor', payload: { definitionId: creature.id } });
        this.selectedChoiceIndex = Math.max(0, Math.min(this.selectedChoiceIndex, sageCreatures(engine, this.sageView).length - 1));
        this.report(result);
        return;
      }
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
      case 'pact':
        if (arg) this.report(bus.dispatch({ type: 'pact_toggle', payload: { pactId: arg } }));
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
    const body = `${this.greetingHtml(engine, npc, title !== npc.name)}${this.merchant ? this.tradeHtml(engine) : panel ? servicePanelHtml(panel) : ''}
      <div class="shop-status is-${this.statusTone}" role="status" aria-live="polite">${escapeHtml(this.statusMessage)}</div>`;

    const smith = this.smithId(engine);
    const hints = this.merchant
      ? [
          { keys: ['↑', '↓'], label: 'choose' },
          { keys: ['Enter'], label: this.activeTab === 'forge' ? 'raise a step' : this.activeTab === 'buy' ? 'buy' : 'sell' },
          { keys: ['1–9'], label: 'at once' },
          smith ? { keys: ['B', 'S', 'F'], label: 'buy, sell or forge' } : { keys: ['B', 'S'], label: 'buy or sell list' },
          ...(this.activeTab === 'forge' && smith && SmithService.masterworkAvailable(engine, smith)
            ? [{ keys: ['M'], label: SmithService.smithFor(engine, smith)!.masterwork!.name }]
            : [{ keys: ['J'], label: 'sell all junk' }]),
        ]
      : [
          ...(panel?.choices?.length ? [{ keys: ['↑', '↓'], label: 'choose' }] : []),
          ...(panel?.views?.length ? [{ keys: ['←', '→'], label: 'switch list' }] : []),
        ];
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
    const smith = this.smithId(engine);
    const forge = this.activeTab === 'forge';
    const rowItems = this.rowsFor(engine);
    const selected = this.selectedIndex;
    const tab = (id: ShopTab, label: string, k: string, count: number) =>
      `<button type="button" class="st-subtab" role="tab" aria-selected="${this.activeTab === id}" data-act="tab-${id}">${label} <span class="ui-faint">${count}</span> ${keyChip(k)}</button>`;
    // The forge shows the step each piece would take, and its price; past the smith's last
    // step only the masterwork is left for it.
    const stepCell = (item: Item) =>
      forge ? `+${item.enchantmentLevel} → +${item.enchantmentLevel + 1}` : formatWeight(item.weight);
    const priceCell = (item: Item) => {
      if (!forge) return formatCurrency(this.priceOf(item, engine));
      const price = SmithService.nextStepPrice(engine, smith ?? '', item);
      return price === undefined ? '—' : formatCurrency(price);
    };

    const rows = rowItems
      .map(
        ([item, ...more], i) => `
        <button type="button" class="bs-row shop-row${i === selected ? ' is-selected' : ''}" role="option" aria-selected="${i === selected}" data-row="${i}">
          <span class="shop-row-key">${i < 9 ? keyChip(String(i + 1)) : ''}</span>
          <canvas class="shop-icon${itemFrameClass(item)}" width="24" height="24" data-item="${i}" aria-hidden="true"></canvas>
          <span class="bs-name${itemToneClass(item)}">${escapeHtml(item.displayName)}${more.length ? ` <span class="ui-faint shop-count">×${more.length + 1}</span>` : ''}${item.junk ? ' <span class="ui-faint shop-junk">junk</span>' : ''}</span>
          <span class="ui-num ui-faint">${escapeHtml(stepCell(item))}</span>
          <span class="ui-num shop-price">${escapeHtml(priceCell(item))}</span>
        </button>`
      )
      .join('');
    const empty =
      this.activeTab === 'buy'
        ? 'Sold out for now.'
        : forge
          ? 'Nothing you carry or wear for the forge: it works known, uncursed weapons and armor.'
          : 'Nothing in your pack to sell.';
    const junk = this.activeTab === 'sell' ? this.junkItems(engine) : [];
    const junkWorth = junk.reduce((sum, item) => sum + getItemSellPrice(item), 0);
    const sellJunk = junk.length
      ? `<div class="shop-junk-bar">${dialogButton('shop-sell-junk', `Sell all junk (${junk.length}) for ${formatCurrency(junkWorth)}`, { key: 'J', attrs: 'data-act="sell-junk"' })}</div>`
      : '';

    return `
      <div class="shop-trade">
        <div class="ui-col">
          <div class="st-subtabs" role="tablist">${tab('buy', 'Buy', 'B', buyCount)}${tab('sell', 'Sell', 'S', sellCount)}${smith ? tab('forge', 'Forge', 'F', this.getForgeItems(engine).length) : ''}</div>
          ${sellJunk}
          <div class="ui-inset ui-scroll shop-list" role="listbox" aria-label="${this.activeTab === 'buy' ? 'For sale' : forge ? 'Your gear' : 'Your pack'}">
            ${rows || `<div class="ui-note bs-empty">${empty}</div>`}
          </div>
        </div>
        ${this.detailHtml(engine, rowItems[selected]?.[0])}
      </div>`;
  }

  private detailHtml(engine: GameEngine, item: Item | undefined): string {
    if (!item) return '<div class="ui-card shop-detail"><div class="ui-note">Choose an item to see it here.</div></div>';
    if (this.activeTab === 'forge') return this.forgeDetailHtml(engine, item);
    const price = formatCurrency(this.priceOf(item, engine));
    const verb = this.activeTab === 'buy' ? 'Buy' : 'Sell';
    // The inventory's own item panel (N20): stats, slot, comparison, and an unidentified
    // item's description kept hidden.
    return `
      <div class="ui-card shop-detail">
        ${itemDetailHtml(engine, item, this.inspector, {
          source: this.activeTab === 'buy' ? 'ground' : 'backpack',
          iconHtml: `<canvas class="shop-detail-icon${itemFrameClass(item)}" width="48" height="48" data-detail aria-hidden="true"></canvas>`,
          compare: true,
          showValue: false,
        })}
        <dl class="ui-kv">
          <dt>${this.activeTab === 'buy' ? 'Price' : 'They pay'}</dt><dd class="ui-num shop-price">${escapeHtml(price)}</dd>
        </dl>
        ${dialogButton('shop-trade', `${verb} for ${price}`, { primary: true, key: 'Enter', attrs: 'data-act="trade"' })}
      </div>`;
  }

  /** The forge's detail: the item, its next step and price, and the masterwork when on offer. */
  private forgeDetailHtml(engine: GameEngine, item: Item): string {
    const smithId = this.smithId(engine) ?? '';
    const smith = SmithService.smithFor(engine, smithId);
    const price = SmithService.nextStepPrice(engine, smithId, item);
    const work = smith?.masterwork;
    const workOpen = !!work && SmithService.masterworkAvailable(engine, smithId) && SmithService.masterworkItems(engine, smithId).includes(item);
    const step =
      price === undefined
        ? `<div class="ui-note">The forge's own steps end at +${smith?.stepPricesCp.length ?? 0}.</div>`
        : `<dl class="ui-kv"><dt>Next step</dt><dd class="ui-num">+${item.enchantmentLevel + 1}</dd><dt>Price</dt><dd class="ui-num shop-price">${escapeHtml(formatCurrency(price))}</dd></dl>
           ${dialogButton('shop-trade', `Raise to +${item.enchantmentLevel + 1}`, { primary: true, key: 'Enter', attrs: 'data-act="trade"' })}`;
    const masterwork = workOpen
      ? `<div class="ui-note shop-masterwork">${escapeHtml(work!.description)}</div>
         ${dialogButton('shop-masterwork', `${work!.name} (+${work!.toLevel})`, { key: 'M', attrs: 'data-act="masterwork"' })}`
      : '';
    return `
      <div class="ui-card shop-detail">
        ${itemDetailHtml(engine, item, this.inspector, {
          source: 'backpack',
          iconHtml: `<canvas class="shop-detail-icon${itemFrameClass(item)}" width="48" height="48" data-detail aria-hidden="true"></canvas>`,
          compare: false,
          showValue: false,
        })}
        ${step}
        ${masterwork}
      </div>`;
  }

  private paintIcons(scrim: HTMLElement, engine: GameEngine, npc: NPC): void {
    if (typeof scrim.querySelector !== 'function') return;
    const portrait = scrim.querySelector<HTMLCanvasElement>('.shop-portrait');
    if (portrait) this.options.drawEntityIcon?.(portrait, npc);
    if (!this.merchant || !this.options.drawItemIcon) return;
    const rows = this.rowsFor(engine);
    scrim.querySelectorAll<HTMLCanvasElement>('canvas[data-item]').forEach((canvas) => {
      const item = rows[Number(canvas.dataset.item)]?.[0];
      if (item) this.options.drawItemIcon!(canvas, item);
    });
    const detail = scrim.querySelector<HTMLCanvasElement>('canvas[data-detail]');
    const selected = rows[this.selectedIndex]?.[0];
    if (detail && selected) this.options.drawItemIcon(detail, selected);
  }

  private bind(scrim: HTMLElement, engine: GameEngine): void {
    if (typeof scrim.querySelectorAll !== 'function') return;
    scrim.querySelector('#shop-close')?.addEventListener('click', () => this.close());
    scrim.querySelector('#shop-leave')?.addEventListener('click', () => this.close());
    scrim.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', () => this.run(el.dataset.act as ShopAction, engine, el.dataset.arg));
    });
    scrim.querySelectorAll<HTMLElement>('[data-choice]').forEach((el) => {
      el.addEventListener('click', () => {
        const count = this.panel(engine)?.choices?.length ?? 0;
        this.selectChoice(Number(el.dataset.choice), count);
      });
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
