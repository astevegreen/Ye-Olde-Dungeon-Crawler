import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, Item, Merchant, NPC, Player } from '../../engine';
import { ShopDialog } from '../shop/shopDialog';
import { focusMark, restoreFocus } from '../keepFocus';

/**
 * The shop redraws itself with `innerHTML` after every trade, list switch and row click,
 * which removed the focused control and dropped focus on the page body, outside the dialog.
 * Vitest runs without a DOM here, so this stand-in turns the dialog's markup into flat
 * elements with their attributes, enough for the shop's selectors and focus.
 */
class FakeEl {
  public parent: FakeEl | null = null;
  public children: FakeEl[] = [];
  public style: Record<string, string> = {};
  public tabIndex = 0;
  public scrollTop = 0;
  private readonly attrs = new Map<string, string>();

  constructor(
    public readonly tagName: string,
    private readonly doc: FakeDoc
  ) {}

  get id(): string {
    return this.attrs.get('id') ?? '';
  }
  set id(v: string) {
    this.attrs.set('id', v);
  }
  get className(): string {
    return this.attrs.get('class') ?? '';
  }
  set className(v: string) {
    this.attrs.set('class', v);
  }
  get dataset(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.attrs) if (k.startsWith('data-')) out[k.slice(5).replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] = v;
    return out;
  }
  get isConnected(): boolean {
    return this === this.doc.body || (this.parent?.isConnected ?? false);
  }

  set innerHTML(html: string) {
    for (const kid of this.children) {
      kid.parent = null;
      if (this.doc.activeElement === kid) this.doc.activeElement = this.doc.body; // as a browser does
    }
    this.children = [];
    for (const [, tag, attrText] of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
      const el = new FakeEl(tag.toLowerCase(), this.doc);
      for (const [, name, value] of attrText.matchAll(/([^\s=/]+)(?:="([^"]*)")?/g)) el.setAttribute(name, value ?? '');
      this.appendChild(el);
    }
  }

  public appendChild(el: FakeEl): void {
    el.parent = this;
    this.children.push(el);
  }
  public getAttributeNames(): string[] {
    return [...this.attrs.keys()];
  }
  public getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  public hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  public contains(other: FakeEl | null): boolean {
    for (let el = other; el; el = el.parent) if (el === this) return true;
    return false;
  }
  public addEventListener(): void {}
  public clicks = 0;
  public click(): void {
    this.clicks++;
  }
  public focus(): void {
    if (this.isConnected && !this.hasAttribute('disabled')) this.doc.activeElement = this;
  }

  /** Tag, `#id`, `.class`, `[attr]` and `[attr="value"]` compounds, comma-separated, or `*`. */
  private matches(selector: string): boolean {
    return selector.split(',').some((part) => {
      const sel = part.trim();
      if (sel === '*') return true;
      const tag = /^[a-z]+/i.exec(sel)?.[0];
      if (tag && tag.toLowerCase() !== this.tagName) return false;
      const classes = this.className.split(/\s+/);
      const plain = sel.replace(/\[[^\]]*\]/g, '');
      for (const [, kind, name] of plain.matchAll(/([#.])([\w-]+)/g)) {
        if (kind === '#' && this.id !== name) return false;
        if (kind === '.' && !classes.includes(name)) return false;
      }
      for (const [, name, value] of sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (!this.hasAttribute(name) || (value !== undefined && this.getAttribute(name) !== value)) return false;
      }
      return true;
    });
  }
  public querySelectorAll(selector: string): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl) => {
      for (const kid of el.children) {
        if (kid.matches(selector)) out.push(kid);
        walk(kid);
      }
    };
    walk(this);
    return out;
  }
  public querySelector(selector: string): FakeEl | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDoc {
  public readonly body: FakeEl = new FakeEl('body', this);
  public activeElement: FakeEl | null = this.body;
  public getElementById(id: string): FakeEl | null {
    return this.body.querySelector(`#${id}`);
  }
  public createElement(tag: string): FakeEl {
    return new FakeEl(tag, this);
  }
}

const key = (k: string) => ({ key: k, code: k, repeat: false, preventDefault: () => {} }) as unknown as KeyboardEvent;

function ware(id: string, name: string): Item {
  return new Item({ id, name, category: 'misc', weight: 800, bulk: 600, quality: 'normal', identified: true, value: 5 });
}

describe('Shop focus across redraws', () => {
  let doc: FakeDoc;
  let engine: GameEngine;
  let shop: ShopDialog;

  beforeEach(() => {
    doc = new FakeDoc();
    vi.stubGlobal('document', doc);
    // Each read of the clock moves it on a second, past the trading keys' arming delay (R-ui-7).
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    engine = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
    });
    vi.spyOn(engine.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
    shop = new ShopDialog();
    const npc = new NPC({ id: 'npc_merchant', name: 'Trader', position: { x: 6, y: 5 }, role: 'merchant', dialogText: 'Welcome!' });
    const stock = [ware('torch', 'Wooden Torch'), ware('bread', 'Travel Bread'), ware('rope', 'Rope')];
    shop.open(npc, new Merchant('shop', 'Trader', 'General Store', 'general', 'Welcome!', stock), engine);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const scrim = () => shop.root as unknown as FakeEl;
  const el = (selector: string) => {
    const found = scrim().querySelector(selector);
    expect(found, selector).not.toBeNull();
    return found!;
  };

  it('gives focus back to the same row after a redraw rebuilt it', () => {
    const row = el('[data-row="0"]');
    row.focus();
    shop.handleKeyDown(key('ArrowDown'), engine);
    expect(row.isConnected).toBe(false); // the redraw replaced it
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement?.getAttribute('data-row')).toBe('0');
    expect(scrim().contains(doc.activeElement)).toBe(true);
  });

  it('gives focus back to the same list tab and trade button after a list switch', () => {
    engine.player.inventory.primaryPack.addItem(ware('boot', 'Old Boot'));
    el('[data-act="tab-buy"]').focus();
    shop.handleKeyDown(key('s'), engine);
    expect(shop.activeTab).toBe('sell');
    expect(doc.activeElement?.getAttribute('data-act')).toBe('tab-buy');
    expect(scrim().contains(doc.activeElement)).toBe(true);

    el('#shop-trade').focus();
    shop.handleKeyDown(key('b'), engine);
    expect(doc.activeElement?.id).toBe('shop-trade');
    expect(scrim().contains(doc.activeElement)).toBe(true);
  });

  it('gives focus to the selected row when the focused row was sold', () => {
    const pack = engine.player.inventory.primaryPack;
    pack.addItem(ware('axe', 'Spare Axe'));
    pack.addItem(ware('lantern', 'Old Lantern'));
    vi.mocked(engine.commandBus.dispatch).mockImplementation(() => {
      pack.removeItem('lantern');
      return { success: true, message: 'Sold.' };
    });
    shop.handleKeyDown(key('s'), engine);
    shop.handleKeyDown(key('ArrowDown'), engine);
    el('[data-row="1"]').focus();
    shop.handleKeyDown(key('Enter'), engine);
    expect(scrim().querySelector('[data-row="1"]')).toBeNull();
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement?.getAttribute('data-row')).toBe('0');
    expect(doc.activeElement?.className).toContain('is-selected');
  });

  it('gives focus to the dialog itself when nothing like the focused control is left', () => {
    el('#shop-trade').focus();
    shop.handleKeyDown(key('s'), engine); // an empty pack: no rows, no trade button
    expect(scrim().querySelector('#shop-trade')).toBeNull();
    expect(doc.activeElement).toBe(scrim());
    expect(scrim().tabIndex).toBe(-1);
  });

  it('keeps focus on the dialog itself when it had it', () => {
    scrim().focus();
    shop.handleKeyDown(key('ArrowDown'), engine);
    expect(doc.activeElement).toBe(scrim());
  });

  it("never takes focus from another dialog's control outside the shop", () => {
    const other = doc.createElement('button');
    doc.body.appendChild(other);
    other.focus();
    shop.handleKeyDown(key('ArrowDown'), engine);
    shop.handleKeyDown(key('Enter'), engine);
    shop.handleKeyDown(key('s'), engine);
    expect(doc.activeElement).toBe(other);
  });

  it('passes focus on when the control it finds again is disabled', () => {
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    root.innerHTML = '<button data-act="heal"></button><button class="shop-choice is-selected" data-choice="0"></button>';
    root.querySelector('[data-act="heal"]')!.focus();
    const mark = focusMark(root as unknown as HTMLElement);
    root.innerHTML = '<button data-act="heal" disabled></button><button class="shop-choice is-selected" data-choice="0"></button>';
    restoreFocus(root as unknown as HTMLElement, mark, '.shop-choice.is-selected');
    expect(doc.activeElement?.getAttribute('data-choice')).toBe('0');
  });
});

/**
 * A service panel (temple, sage) keeps focus on the Choose button its click rebuilt, and
 * the dialog let Enter and Space through: the browser clicked that button again on every
 * press and every auto-repeat, past the arming and repeat guard (R6-4).
 */
describe('Service panel: Enter or Space on a focused button', () => {
  let doc: FakeDoc;
  let engine: GameEngine;
  let shop: ShopDialog;
  let now: number;

  beforeEach(() => {
    doc = new FakeDoc();
    vi.stubGlobal('document', doc);
    now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    engine = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
    });
    vi.spyOn(engine.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
    shop = new ShopDialog();
    const priest = new NPC({ id: 'npc_priest', name: 'Priest', position: { x: 6, y: 5 }, role: 'priest', dialogText: 'Peace.' });
    shop.open(priest, null, engine);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const scrim = () => shop.root as unknown as FakeEl;
  const press = (k: string, repeat = false) => {
    const event = { key: k, code: k === ' ' ? 'Space' : k, repeat, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    shop.handleKeyDown(event as unknown as KeyboardEvent, engine);
    return event;
  };

  it('keeps focus on the rebuilt offer button, and swallows Enter and Space so the browser does not click it', () => {
    const btn = scrim().querySelector('[data-act]');
    expect(btn).not.toBeNull();
    btn!.focus();
    // A redraw (as after a click on Choose) puts focus back on the rebuilt button...
    (shop as unknown as { render(): void }).render();
    expect(doc.activeElement?.hasAttribute('data-act')).toBe(true);
    // ...so the browser would turn Enter into a click on it unless the dialog swallows the key.
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(press(' ').defaultPrevented).toBe(true);
  });

  it('presses the focused button once per key press, never on an auto-repeat', () => {
    const btn = scrim().querySelector('[data-act]')!;
    btn.focus();
    press('Enter');
    expect(btn.clicks).toBe(1);
    expect(press('Enter', true).defaultPrevented).toBe(true);
    expect(press(' ', true).defaultPrevented).toBe(true);
    expect(btn.clicks).toBe(1);
  });

  it('holds Enter back in the first moment after the dialog opened', () => {
    vi.mocked(Date.now).mockImplementation(() => now); // the clock stands still
    const btn = scrim().querySelector('[data-act]')!;
    btn.focus();
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(btn.clicks).toBe(0);
  });

  it('presses nothing when focus is on the dialog itself or outside it', () => {
    const btn = scrim().querySelector('[data-act]')!;
    scrim().focus();
    press('Enter');
    const other = doc.createElement('button');
    doc.body.appendChild(other);
    other.focus();
    press('Enter');
    expect(btn.clicks).toBe(0);
    expect(scrim().clicks).toBe(0);
    expect(other.clicks).toBe(0);
  });
});
