import { Container, type GameEngine, type Item, formatCurrency } from '../../engine';
import type { GameState } from '../characterMenu/gameState';
import type { MenuFooter, MenuHost, MenuTab } from '../characterMenu/menuTab';
import { escapeHtml, keyChip } from '../html';
import { formatLoad, formatWeight } from '../units';
import { FRAME_LEGEND, itemFrameClass, itemToneClass } from './itemTone';
import { itemDetailHtml } from './itemDetail';
import {
  BACKPACK_FILTERS,
  type BackpackFilter,
  type DisplayItemGroup,
  InventoryController,
  type ItemPanel,
  cellLabel,
} from './inventoryController';

/** Things the inventory draws that live in src/rendering, which src/ui may not import. */
export interface InventoryTabOptions {
  /** Paints an item's sprite into a small canvas. */
  drawItemIcon?: (canvas: HTMLCanvasElement, item: Item) => void;
  /** Settings' "rich hover cards": the full card on hover, else just the name and weight. */
  richHoverCards?: () => boolean;
}

const FILTER_LABELS: Record<BackpackFilter, string> = {
  all: 'All',
  gear: 'Gear',
  consumable: 'Supplies',
  magic: 'Magic',
  valuable: 'Valuables',
};

const SORT_LABELS: Record<string, string> = {
  category: 'kind',
  value: 'value',
  tier: 'tier',
  weight: 'weight',
  bulk: 'size',
  name: 'name',
};

/** The paperdoll's slots by grid area (inventory.css); a pack's own slots flow in after. */
const KNOWN_AREAS = new Set([
  'head', 'neck', 'overgarment', 'torso', 'mainHand', 'offHand', 'hands', 'wrists',
  'fingerLeft', 'fingerRight', 'waist', 'feet', 'pack', 'purse',
]);

/** "Equip (E)" -> "Equip": the key is drawn as a chip beside the label. */
function bareLabel(label: string, shortcut?: string): string {
  if (!shortcut) return label;
  const escaped = shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return label.replace(new RegExp(`\\s*[[(]${escaped}[\\])]`), '').trim();
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** What the icon frames' colors mean (N29), under the paperdoll where there is room. */
function legendHtml(): string {
  const entries = FRAME_LEGEND.map(
    ({ tone, label }) => `<li class="inv-legend-entry"><span class="inv-legend-swatch it-frame it-frame-${tone}" aria-hidden="true"></span>${escapeHtml(label)}</li>`
  ).join('');
  return `<div class="inv-legend"><div class="ui-note">Frames, once an item is known:</div><ul class="inv-legend-list">${entries}</ul></div>`;
}

/**
 * The Inventory tab (ADR-0011): the paperdoll with every slot named, the backpack, the
 * ground (or an open container, or the companion's pack), and the selected item beside
 * them. The hero's stats live on the Character tab; this tab shows only what the gear
 * weighs. State and rules are in InventoryController; this class draws them as DOM and
 * turns clicks, drags and right-clicks into controller calls.
 *
 * Keys (the controller's): arrows move inside a panel, Tab steps through the four panels
 * (and on to the next tab past the last), Enter uses, E/U/D/T/C/O as before, Esc backs
 * out of a menu, a selection or a container before the menu closes.
 */
export class InventoryTab implements MenuTab {
  public readonly id = 'inventory';
  public readonly label = 'Inventory';
  public readonly hotkeyActionId = 'inventory';
  public readonly claimsTabKey = true;
  public readonly controller = new InventoryController();

  private readonly options: InventoryTabOptions;
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private host?: MenuHost;

  constructor(options: InventoryTabOptions = {}) {
    this.options = options;
    this.controller.onChange = () => this.render();
    this.controller.onDismiss = () => this.host?.close();
  }

  public bindHost(host: MenuHost): void {
    this.host = host;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
  }

  public onActivate(state: GameState, entry?: 'forward' | 'backward'): void {
    this.controller.open(state.engine);
    // Arriving by Shift+Tab starts on the last panel, so the next Shift+Tab steps back through them.
    if (entry === 'backward') this.controller.focusLastPanel();
    this.render();
  }

  public unmount(): void {
    this.controller.reset();
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.root = null;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    return this.controller.handleKeyDown(e);
  }

  /** Opens the inventory's third column at a container (a double-click on one on the map). */
  public showContainer(container: Container): void {
    this.controller.pushContainer(container, 'ground');
    this.render();
  }

  public footer(): MenuFooter {
    const c = this.controller;
    const canBack =
      Boolean(c.contextMenu || c.splitDialog || c.inspector.selectedItem || c.inspector.selectedItemIds.size > 0) ||
      c.column3View === 'companion' ||
      Boolean(c.activeContainer);
    return {
      keys: [
        { keys: ['↑', '↓', '←', '→'], label: 'move' },
        { keys: ['Enter'], label: 'use' },
        { keys: ['E'], label: 'equip' },
        { keys: ['D'], label: 'drop' },
        { keys: ['J'], label: 'junk' },
        { keys: ['T'], label: 'take' },
      ],
      escLabel: canBack ? 'back' : 'close',
    };
  }

  // ---- Drawing ------------------------------------------------------------------------

  private render(): void {
    const container = this.container;
    const engine = this.controller.engine;
    if (!container || !engine) return;
    const c = this.controller;
    c.pruneContainers();

    const scroll = (name: string) => this.root?.querySelector?.(`[data-cells="${name}"]`)?.scrollTop ?? 0;
    const keep = { backpack: scroll('backpack'), ground: scroll('ground'), inspector: this.root?.querySelector?.('.inv-inspect-body')?.scrollTop ?? 0 };

    container.innerHTML = `
      <div class="inv-root">
        <div class="ui-tabgrid inv-grid">
          ${this.dollHtml(engine)}
          ${this.packHtml()}
          ${this.column3Html(engine)}
          ${this.inspectorHtml(engine)}
        </div>
        ${this.menuHtml()}
        ${this.splitHtml()}
        <div class="inv-hover" hidden></div>
      </div>`;
    this.root = container.querySelector?.('.inv-root') ?? null;
    this.host?.refreshChrome();
    const root = this.root;
    if (!root || typeof root.querySelectorAll !== 'function') return;

    this.paintIcons(root, engine);
    const restore = (sel: string, top: number) => {
      const el = root.querySelector<HTMLElement>(sel);
      if (el) el.scrollTop = top;
    };
    restore('[data-cells="backpack"]', keep.backpack);
    restore('[data-cells="ground"]', keep.ground);
    restore('.inv-inspect-body', keep.inspector);
    this.measureColumns(root);
    root.querySelector('.inv-cell.is-focused, .inv-slot.is-focused')?.scrollIntoView?.({ block: 'nearest' });
    this.placeMenu(root);
    this.bind(root, engine);
  }

  private dollHtml(engine: GameEngine): string {
    const c = this.controller;
    const ins = c.inspector;
    const doll = engine.player.inventory.paperdoll;
    const focused = ins.focusedPanel === 'paperdoll';
    const candidate = ins.selectedSource !== 'paperdoll' ? ins.selectedItem : null;
    const targets = new Set(c.slotsFor(candidate));
    const slots = doll
      .getSlotDefinitions()
      .map((def, i) => {
        const item = doll.getItem(def.id);
        const area = KNOWN_AREAS.has(def.id) ? ` data-area="${def.id}"` : '';
        const cls = [
          'inv-slot',
          item ? '' : 'is-empty',
          ins.selectedSource === 'paperdoll' && ins.selectedSlot === def.id ? 'is-selected' : '',
          focused && ins.focusedIndex === i ? 'is-focused' : '',
          targets.has(def.id) ? 'is-target' : '',
          itemFrameClass(item).trim(),
          doll.isSlotBlocked(def.id) ? 'is-blocked' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const title = item ? `${def.name}: ${item.displayName}` : `${def.name}: empty`;
        return `
          <button type="button" class="${cls}" data-slot="${i}" data-slot-id="${escapeHtml(def.id)}"${area}${item ? ' draggable="true"' : ''} title="${escapeHtml(title)}">
            <span class="inv-slot-well">${item ? `<canvas class="inv-icon" width="40" height="40" data-icon="slot:${i}" aria-hidden="true"></canvas>` : ''}${
              item && item.identified && item.enchantmentLevel > 0 ? `<span class="inv-plus ui-num">+${item.enchantmentLevel}</span>` : ''
            }</span>
            <span class="inv-slot-name">${escapeHtml(def.name)}</span>
          </button>`;
      })
      .join('');
    return `
      <section class="inv-panel${focused ? ' is-focused' : ''}" data-panel="paperdoll" data-drop="paperdoll" aria-label="Equipment">
        <h3 class="ui-h">Equipment</h3>
        <div class="inv-doll">${slots}</div>
        ${legendHtml()}
      </section>`;
  }

  private cellsHtml(panel: 'backpack' | 'ground', groups: DisplayItemGroup[], empty: string): string {
    const c = this.controller;
    const ins = c.inspector;
    const focused = ins.focusedPanel === panel;
    const selectedHere =
      panel === 'backpack' ? ins.selectedSource === 'backpack' : ['ground', 'container', 'companion'].includes(ins.selectedSource);
    if (groups.length === 0) return `<div class="ui-note inv-empty">${escapeHtml(empty)}</div>`;
    return groups
      .map((g, i) => {
        const item = g.leadItem;
        const short = cellLabel(g.displayName);
        const cls = [
          'inv-cell',
          selectedHere && g.items.some((x) => x.id === ins.selectedItem?.id) ? 'is-selected' : '',
          focused && ins.focusedIndex === i ? 'is-focused' : '',
          g.items.some((x) => ins.isMultiSelected(x.id)) ? 'is-multi' : '',
          itemFrameClass(item).trim(),
          item.junk ? 'is-junk' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const numbered = panel === 'backpack' && c.backpackFilter === 'all' && i < 9;
        return `
          <button type="button" class="${cls}" data-cell="${panel}:${i}" draggable="true" aria-label="${escapeHtml(g.displayName)}">
            ${numbered ? `<span class="inv-cell-key ui-num">${i + 1}</span>` : ''}
            ${item instanceof Container ? '<span class="inv-cell-box" title="Container: opens with Enter">▣</span>' : ''}
            ${short.quantity > 1 ? `<span class="inv-cell-qty ui-num">×${short.quantity}</span>` : ''}
            ${item.junk ? '<span class="inv-cell-junk" title="Junk: any shop sells all of it at once (J)">junk</span>' : ''}
            <canvas class="inv-icon" width="40" height="40" data-icon="${panel}:${i}" aria-hidden="true"></canvas>
            <span class="inv-cell-name${itemToneClass(item)}">${escapeHtml(short.name)}</span>
          </button>`;
      })
      .join('');
  }

  private packHtml(): string {
    const c = this.controller;
    const focused = c.inspector.focusedPanel === 'backpack';
    const all = c.engine?.player.inventory.primaryPack.getItems().length ?? 0;
    const filters = BACKPACK_FILTERS.map(
      (f) => `<button type="button" role="tab" class="st-subtab" data-filter="${f}" aria-selected="${c.backpackFilter === f}">${FILTER_LABELS[f]}</button>`
    ).join('');
    const load = c.load();
    const weightPct = load.maxGrams > 0 ? Math.min(100, Math.round((load.grams / load.maxGrams) * 100)) : 0;
    const bulkPct = load.maxBulk > 0 ? Math.min(100, Math.round((load.bulk / load.maxBulk) * 100)) : 0;
    const tone = load.level === 'Unencumbered' ? 'good' : load.level === 'Burdened' ? 'warn' : 'bad';
    return `
      <section class="inv-panel${focused ? ' is-focused' : ''}" data-panel="backpack" data-drop="backpack" aria-label="Backpack">
        <div class="inv-head">
          <h3 class="ui-h">Backpack</h3>
          <div class="inv-tools">
            <button type="button" class="ui-btn ui-btn--sm ui-btn--ghost" data-act="sort" title="Sort the pack by the next order">Sort: ${SORT_LABELS[c.sortMode] ?? c.sortMode} ${keyChip('S')}</button>
            <button type="button" class="ui-btn ui-btn--sm ui-btn--ghost" data-act="coins" title="Move loose coins into the purse">Coins ${keyChip('C')}</button>
          </div>
        </div>
        <div class="st-subtabs inv-filters" role="tablist">${filters}</div>
        <div class="ui-inset ui-scroll inv-cells" data-cells="backpack" role="listbox" aria-label="Backpack">
          ${this.cellsHtml('backpack', c.groups('backpack'), all > 0 ? 'Nothing here matches this filter.' : 'Your backpack is empty.')}
        </div>
        <dl class="ui-kv inv-load">
          <dt>Weight</dt><dd class="ui-num">${escapeHtml(formatLoad(load.grams, load.maxGrams))}</dd>
          <dd class="inv-load-bar"><span class="ui-bar is-${tone}"><i style="width: ${weightPct}%"></i></span></dd>
          <dt>Space</dt><dd class="ui-num">${load.bulk} / ${load.maxBulk} cm³</dd>
          <dd class="inv-load-bar"><span class="ui-bar is-info"><i style="width: ${bulkPct}%"></i></span></dd>
          <dt>Load</dt><dd class="inv-load-level is-${tone}">${escapeHtml(load.level)}${load.costPct !== 100 ? ` <span class="ui-faint">· moves cost ${load.costPct}%</span>` : ''}</dd>
        </dl>
      </section>`;
  }

  private column3Html(engine: GameEngine): string {
    const c = this.controller;
    const focused = c.inspector.focusedPanel === 'ground';
    const source = c.column3Source();
    const companion = engine.companion;
    const head = companion
      ? `<div class="st-subtabs" role="tablist">
           <button type="button" role="tab" class="st-subtab" data-act="view-ground" aria-selected="${source !== 'companion'}">${c.activeContainer ? 'Container' : 'Ground'}</button>
           <button type="button" role="tab" class="st-subtab" data-act="view-companion" aria-selected="${source === 'companion'}">${escapeHtml(companion.name)} ${keyChip('K')}</button>
         </div>`
      : `<h3 class="ui-h">${source === 'container' ? 'Container' : 'On the ground'}</h3>`;
    const takeLabel = source === 'companion' ? 'Take all back' : source === 'container' ? 'Take all' : 'Pick up all';
    const items = c.column3Items();
    const tools = `
      ${source === 'container' ? `<button type="button" class="ui-btn ui-btn--sm ui-btn--ghost" data-act="back" title="Close this container (Backspace)">Back</button>` : ''}
      <button type="button" class="ui-btn ui-btn--sm" data-act="take-all"${items.length === 0 ? ' disabled' : ''}>${takeLabel}</button>`;

    let crumbs = '';
    if (source === 'container' && c.containerNavStack.length > 0) {
      const first = c.containerNavStack[0].source;
      const rootLabel = first === 'backpack' ? 'Backpack' : first === 'paperdoll' ? 'Worn' : 'Ground';
      const last = c.containerNavStack.length - 1;
      crumbs = `<nav class="inv-crumbs" aria-label="Open containers">
        <button type="button" class="inv-crumb" data-crumb="-1">${rootLabel}</button>
        ${c.containerNavStack
          .map((e, i) =>
            i === last
              ? `<span class="inv-crumb-sep">›</span><span class="inv-crumb is-here">${escapeHtml(e.title)}</span>`
              : `<span class="inv-crumb-sep">›</span><button type="button" class="inv-crumb" data-crumb="${i}">${escapeHtml(e.title)}</button>`
          )
          .join('')}
      </nav>`;
    }
    const empty =
      source === 'companion' ? `${companion?.name ?? 'Your companion'} carries nothing.` : source === 'container' ? 'This container is empty.' : 'Nothing on the ground here.';
    return `
      <section class="inv-panel${focused ? ' is-focused' : ''}" data-panel="ground" data-drop="ground" aria-label="${source === 'companion' ? 'Companion' : source === 'container' ? 'Container' : 'Ground'}">
        <div class="inv-head">${head}<div class="inv-tools">${tools}</div></div>
        ${crumbs}
        <div class="ui-inset ui-scroll inv-cells" data-cells="ground" role="listbox">
          ${this.cellsHtml('ground', c.groups('ground'), empty)}
        </div>
      </section>`;
  }

  private inspectorHtml(engine: GameEngine): string {
    const ins = this.controller.inspector;
    const focused = ins.focusedPanel === 'inspector';
    const actions = ins.getAvailableActions(engine);
    const actionsHtml = actions
      .map(
        (a, i) => `
        <button type="button" class="ui-btn ui-btn--sm${i === actions.findIndex((x) => x.enabled) ? ' ui-btn--primary' : ''}" data-action="${i}"${a.enabled ? '' : ' disabled'}${a.reason ? ` title="${escapeHtml(a.reason)}"` : ''}>
          ${escapeHtml(bareLabel(a.label, a.shortcut))}${a.shortcut ? ` ${keyChip(a.shortcut)}` : ''}
        </button>`
      )
      .join('');
    const reasons = actions
      .filter((a) => !a.enabled && a.reason)
      .map((a) => `<div class="ui-note inv-reason">${escapeHtml(a.reason!)}</div>`)
      .join('');

    let body: string;
    if (ins.selectedItemIds.size > 1) {
      body = `<div class="ui-note">${ins.selectedItemIds.size} items selected. Shift-click toggles one.</div>`;
    } else if (ins.selectedItem) {
      body = this.itemDetailHtml(engine, ins.selectedItem);
    } else {
      body = `<div class="ui-note inv-hint">Choose an item to see it here: click it, or move to it with Tab and the arrows. Drag items between the panels; right-click for more.</div>`;
    }
    return `
      <section class="inv-panel inv-inspect${focused ? ' is-focused' : ''}" data-panel="inspector" aria-label="Selected item">
        <h3 class="ui-h">Item</h3>
        <div class="ui-scroll inv-inspect-body">${body}</div>
        ${actionsHtml ? `<div class="inv-actions">${actionsHtml}</div>${reasons}` : ''}
      </section>`;
  }

  private itemDetailHtml(engine: GameEngine, item: Item): string {
    const ins = this.controller.inspector;
    return itemDetailHtml(engine, item, ins, {
      source: ins.selectedSource,
      slotId: ins.selectedSlot,
      iconHtml: `<canvas class="inv-icon inv-detail-icon${itemFrameClass(item)}" width="48" height="48" data-icon="detail" aria-hidden="true"></canvas>`,
      compare: ins.selectedSource !== 'paperdoll',
      showValue: true,
    });
  }

  private menuHtml(): string {
    const menu = this.controller.contextMenu;
    if (!menu) return '';
    const options = menu.options
      .map((o, i) => `<button type="button" role="menuitem" class="inv-menu-item" data-menu="${i}">${escapeHtml(o.label)}</button>`)
      .join('');
    return `<div class="inv-menu" role="menu" aria-label="${escapeHtml(menu.item.displayName)}" data-x="${menu.x}" data-y="${menu.y}">
      <div class="inv-menu-title${itemToneClass(menu.item)}">${escapeHtml(menu.item.displayName)}</div>${options}</div>`;
  }

  private splitHtml(): string {
    const sd = this.controller.splitDialog;
    if (!sd) return '';
    return `
      <div class="inv-split-scrim">
        <div class="ui-card inv-split" role="dialog" aria-label="Split stack">
          <h3 class="ui-h">Split stack</h3>
          <div class="ui-note">${escapeHtml(sd.item.displayName)}: take how many off the stack of ${sd.maxQuantity}?</div>
          <div class="inv-split-row">
            <button type="button" class="ui-btn ui-btn--sm" data-split="-1"${sd.amount <= 1 ? ' disabled' : ''} aria-label="One fewer">−</button>
            <b class="ui-num inv-split-amount">${sd.amount}</b>
            <button type="button" class="ui-btn ui-btn--sm" data-split="1"${sd.amount >= sd.maxQuantity - 1 ? ' disabled' : ''} aria-label="One more">+</button>
          </div>
          <div class="inv-split-actions">
            <span class="ui-note">${keyChip('←')}${keyChip('→')} amount</span>
            <button type="button" class="ui-btn ui-btn--sm ui-btn--ghost" data-split="cancel">Cancel ${keyChip('Esc')}</button>
            <button type="button" class="ui-btn ui-btn--sm ui-btn--primary" data-split="ok">Split ${keyChip('Enter')}</button>
          </div>
        </div>
      </div>`;
  }

  // ---- After drawing ----------------------------------------------------------------------

  private itemAt(engine: GameEngine, key: string): Item | null {
    if (key === 'detail') return this.controller.inspector.selectedItem;
    const [where, n] = key.split(':');
    const index = Number(n);
    if (where === 'slot') {
      const def = engine.player.inventory.paperdoll.getSlotDefinitions()[index];
      return def ? engine.player.inventory.paperdoll.getItem(def.id) : null;
    }
    return this.controller.groups(where as 'backpack' | 'ground')[index]?.leadItem ?? null;
  }

  private paintIcons(root: HTMLElement, engine: GameEngine): void {
    const draw = this.options.drawItemIcon;
    if (!draw) return;
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-icon]').forEach((canvas) => {
      const item = this.itemAt(engine, canvas.dataset.icon ?? '');
      if (item) draw(canvas, item);
    });
  }

  /** How many cells each grid fits in a row, so Up/Down step by a row. */
  private measureColumns(root: HTMLElement): void {
    for (const panel of ['backpack', 'ground'] as const) {
      const cells = Array.from(root.querySelectorAll<HTMLElement>(`[data-cells="${panel}"] .inv-cell`));
      if (cells.length === 0) continue;
      const top = cells[0].offsetTop;
      const perRow = cells.filter((cell) => cell.offsetTop === top).length;
      this.controller.gridColumns[panel] = Math.max(1, perRow);
    }
  }

  /** Puts the context menu at the click, kept inside the tab. */
  private placeMenu(root: HTMLElement): void {
    const menu = root.querySelector<HTMLElement>('.inv-menu');
    if (!menu || typeof root.getBoundingClientRect !== 'function') return;
    const box = root.getBoundingClientRect();
    const x = Number(menu.dataset.x) - box.left;
    const y = Number(menu.dataset.y) - box.top;
    menu.style.left = `${Math.max(4, Math.min(x, box.width - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, box.height - menu.offsetHeight - 4))}px`;
  }

  private bind(root: HTMLElement, engine: GameEngine): void {
    const c = this.controller;
    const parseCell = (el: HTMLElement) => {
      const [panel, n] = (el.dataset.cell ?? '').split(':');
      return { panel: panel as 'backpack' | 'ground', index: Number(n) };
    };

    root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) =>
      el.addEventListener('click', () => {
        switch (el.dataset.act) {
          case 'sort': return c.sortNext();
          case 'coins': return c.consolidateCoins();
          case 'take-all': return c.takeAll();
          case 'back': c.popContainer(); return this.render();
          case 'view-ground': return c.setColumn3View('ground');
          case 'view-companion': return c.setColumn3View('companion');
        }
      })
    );
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((el) =>
      el.addEventListener('click', () => c.setFilter(el.dataset.filter as BackpackFilter))
    );
    root.querySelectorAll<HTMLElement>('[data-crumb]').forEach((el) =>
      el.addEventListener('click', () => c.popContainerTo(Number(el.dataset.crumb)))
    );
    root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) =>
      el.addEventListener('click', () => c.runInspectorAction(Number(el.dataset.action)))
    );
    root.querySelectorAll<HTMLElement>('[data-menu]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        c.runContextOption(Number(el.dataset.menu));
      })
    );
    root.querySelectorAll<HTMLElement>('[data-split]').forEach((el) =>
      el.addEventListener('click', () => {
        const v = el.dataset.split;
        if (v === 'ok') c.confirmSplit();
        else if (v === 'cancel') c.closeSplitDialog();
        else c.adjustSplit(Number(v));
      })
    );

    // A click anywhere closes an open context menu; a click on a grid's empty space
    // clicks off the selection.
    root.addEventListener('mousedown', (e) => {
      if (c.contextMenu && !(e.target as HTMLElement).closest?.('.inv-menu')) c.closeContextMenu();
    });
    root.querySelectorAll<HTMLElement>('[data-cells]').forEach((el) =>
      el.addEventListener('click', (e) => {
        if (e.target === el) c.clearSelection();
      })
    );

    // Cells: click selects (Shift/Ctrl/Cmd adds to a selection in the pack), a second
    // click is a double-click (the item's main action), right-click opens the menu.
    // A click re-renders, replacing this cell, so the double-click is read from the
    // second click's count rather than a dblclick on a node now gone.
    root.querySelectorAll<HTMLElement>('[data-cell]').forEach((el) => {
      const { panel, index } = parseCell(el);
      el.addEventListener('click', (e) => {
        if (e.detail >= 2) c.activateCell(panel, index);
        else c.selectCell(panel, index, e.shiftKey || e.ctrlKey || e.metaKey);
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        c.openContextMenu({ panel, index }, e.clientX, e.clientY);
      });
      el.addEventListener('dragstart', (e) => this.beginDrag(root, e, { panel, index }));
      el.addEventListener('dragend', () => this.finishDrag());
      el.addEventListener('mouseenter', (e) => this.showHover(root, engine, panel, index, e));
      el.addEventListener('mousemove', (e) => this.moveHover(root, e));
      el.addEventListener('mouseleave', () => this.hideHover(root));
    });
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      const slotIndex = Number(el.dataset.slot);
      el.addEventListener('click', (e) => {
        if (e.detail >= 2) c.activateSlot(slotIndex);
        else c.selectSlot(slotIndex);
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        c.openContextMenu({ slotIndex }, e.clientX, e.clientY);
      });
      el.addEventListener('dragstart', (e) => this.beginDrag(root, e, { slotIndex }));
      el.addEventListener('dragend', () => this.finishDrag());
    });

    root.querySelectorAll<HTMLElement>('[data-drop]').forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        if (!c.drag) return;
        e.preventDefault();
        zone.classList.add('is-drop');
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget as Node | null)) zone.classList.remove('is-drop');
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        c.dropOn(zone.dataset.drop as ItemPanel);
      });
    });
  }

  private beginDrag(root: HTMLElement, e: DragEvent, target: { panel: 'backpack' | 'ground'; index: number } | { slotIndex: number }): void {
    const drag = this.controller.startDrag(target);
    if (!drag) {
      e.preventDefault();
      return;
    }
    e.dataTransfer?.setData('text/plain', drag.item.displayName);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.hideHover(root);
    // Mark the slots it fits, without a re-render (which would cancel the drag).
    root.classList.add('is-dragging');
    const fits = new Set(this.controller.slotsFor(drag.item));
    root.querySelectorAll<HTMLElement>('[data-slot-id]').forEach((slot) => {
      slot.classList.toggle('is-target', fits.has(slot.dataset.slotId ?? ''));
    });
  }

  /** A drag that ended outside any panel: clear its marks. (A drop already redrew.) */
  private finishDrag(): void {
    if (!this.controller.drag) return;
    this.controller.endDrag();
    this.render();
  }

  // ---- Hover card -----------------------------------------------------------------------

  private showHover(root: HTMLElement, engine: GameEngine, panel: 'backpack' | 'ground', index: number, e: MouseEvent): void {
    const card = root.querySelector<HTMLElement>('.inv-hover');
    const c = this.controller;
    if (!card || c.drag || c.contextMenu || c.splitDialog) return;
    const group = c.groups(panel)[index];
    if (!group) return;
    const item = group.leadItem;
    const rich = this.options.richHoverCards?.() ?? true;
    const name = `<div class="inv-hover-name${itemToneClass(item)}">${escapeHtml(group.displayName)}</div>`;
    const weight = formatWeight(group.totalWeight);
    if (!rich) {
      card.innerHTML = `${name}<div class="ui-note">${escapeHtml(weight)}</div>`;
    } else {
      const lines: string[] = [];
      if (!item.identified) {
        lines.push('<div class="ui-note">Unidentified</div>');
      } else {
        lines.push(`<div class="ui-note">${escapeHtml([item.quality !== 'normal' ? item.quality : '', item.category].filter(Boolean).join(' '))}</div>`);
        const parts = (
          [
            ['Attack', item.stats.attackBonus],
            ['Defense', item.stats.defenseBonus],
            ['Speed', item.stats.speedBonus],
            ['Strength', item.stats.strengthBonus],
          ] as Array<[string, number | undefined]>
        )
          .filter(([, v]) => v)
          .map(([k, v]) => `${k} ${signed(v!)}`);
        if (parts.length > 0) lines.push(`<div class="ui-num">${escapeHtml(parts.join('  '))}</div>`);
        const cmp = c.inspector.getEquipmentComparison(item, engine.player);
        if (cmp) {
          const deltas = (
            [
              ['Attack', cmp.attackDelta],
              ['Defense', cmp.defenseDelta],
              ['Strength', cmp.strengthDelta],
              ['Speed', cmp.speedDelta],
            ] as Array<[string, number]>
          )
            .filter(([, d]) => d !== 0)
            .map(([k, d]) => `<span class="${d > 0 ? 'ui-up' : 'ui-down'}">${k} ${signed(d)}</span>`)
            .join(' ');
          lines.push(`<div class="ui-note">Against your ${escapeHtml(cmp.equippedItem.displayName)}: ${deltas || 'no difference'}</div>`);
        }
      }
      const value = item.identified && item.value > 0 ? ` · ${formatCurrency(item.value * item.quantity)}` : '';
      lines.push(`<div class="ui-note">${escapeHtml(weight + value)}</div>`);
      card.innerHTML = name + lines.join('');
    }
    card.hidden = false;
    this.moveHover(root, e);
  }

  private moveHover(root: HTMLElement, e: MouseEvent): void {
    const card = root.querySelector<HTMLElement>('.inv-hover');
    if (!card || card.hidden || typeof root.getBoundingClientRect !== 'function') return;
    const box = root.getBoundingClientRect();
    let x = e.clientX - box.left + 14;
    let y = e.clientY - box.top + 14;
    if (x + card.offsetWidth > box.width - 4) x = e.clientX - box.left - card.offsetWidth - 14;
    if (y + card.offsetHeight > box.height - 4) y = e.clientY - box.top - card.offsetHeight - 14;
    card.style.left = `${Math.max(4, x)}px`;
    card.style.top = `${Math.max(4, y)}px`;
  }

  private hideHover(root: HTMLElement): void {
    const card = root.querySelector<HTMLElement>('.inv-hover');
    if (card) card.hidden = true;
  }
}
