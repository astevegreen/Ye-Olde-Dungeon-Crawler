import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModalStackManager, type UIModal } from '../modalStack';

/**
 * The stack keeps keyboard focus inside the top dialog (ARCHITECTURE.md §6): the soak's
 * chaos runs found focus left on a HUD button behind the potion picker, the character
 * menu, the shop, the choice and the diagnostics dialogs, and Tab walking out of them.
 * Vitest runs without a DOM here, so this is the least of one the stack touches.
 */
class FakeEl {
  public parent: FakeEl | null = null;
  public children: FakeEl[] = [];
  public shown = true;
  public attached = true;
  public tabIndex = 0;
  public style: Record<string, string> = {};
  private readonly attrs = new Set<string>();

  constructor(
    public readonly name: string,
    private readonly doc: FakeDoc,
    public readonly focusable = false
  ) {}

  public add(...kids: FakeEl[]): this {
    for (const k of kids) {
      k.parent = this;
      this.children.push(k);
    }
    return this;
  }

  public get isConnected(): boolean {
    return this.attached && (this.parent ? this.parent.isConnected : true);
  }

  public getClientRects(): unknown[] {
    let el: FakeEl | null = this;
    while (el) {
      if (!el.shown) return [];
      el = el.parent;
    }
    return this.isConnected ? [{}] : [];
  }

  public contains(other: FakeEl | null): boolean {
    for (let el = other; el; el = el.parent) if (el === this) return true;
    return false;
  }

  public querySelectorAll(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl) => {
      for (const k of el.children) {
        if (k.focusable) out.push(k);
        walk(k);
      }
    };
    walk(this);
    return out;
  }

  public hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }

  public setAttribute(name: string): void {
    this.attrs.add(name);
  }

  public focus(): void {
    this.doc.activeElement = this;
  }

  public blur(): void {
    if (this.doc.activeElement === this) this.doc.activeElement = this.doc.body;
  }
}

class FakeDoc {
  public activeElement: FakeEl | null = null;
  public readonly body: FakeEl = new FakeEl('body', this);
}

function dialog(id: string, root: FakeEl | null): UIModal & { showing: boolean } {
  return {
    id,
    showing: true,
    get isOpen() {
      return this.showing;
    },
    set isOpen(v: boolean) {
      this.showing = v;
    },
    handleKeyDown: () => false,
    close() {
      this.showing = false;
      if (root) root.shown = false;
    },
    focusRoot: () => root as unknown as HTMLElement,
  };
}

function tab(shift = false): KeyboardEvent & { prevented: boolean } {
  const e = {
    key: 'Tab',
    code: 'Tab',
    shiftKey: shift,
    prevented: false,
    get defaultPrevented() {
      return this.prevented;
    },
    preventDefault() {
      this.prevented = true;
    },
  };
  return e as unknown as KeyboardEvent & { prevented: boolean };
}

describe('Modal stack focus', () => {
  let doc: FakeDoc;
  let hudButton: FakeEl;
  let stack: ModalStackManager;

  beforeEach(() => {
    doc = new FakeDoc();
    vi.stubGlobal('document', doc);
    hudButton = new FakeEl('hud-button', doc, true);
    doc.body.add(hudButton);
    hudButton.focus();
    stack = new ModalStackManager();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeRoot(name: string, ...rows: string[]): { root: FakeEl; rows: FakeEl[] } {
    const root = new FakeEl(name, doc);
    const rowEls = rows.map((r) => new FakeEl(r, doc, true));
    root.add(...rowEls);
    doc.body.add(root);
    return { root, rows: rowEls };
  }

  it('moves focus off the HUD button into the dialog when it opens', () => {
    const { root } = makeRoot('picker', 'row-1');
    stack.push(dialog('potion-picker', root));
    expect(doc.activeElement).toBe(root);
    expect(root.tabIndex).toBe(-1);
  });

  it('leaves focus alone when it is already inside the dialog', () => {
    const { root, rows } = makeRoot('menu', 'row-1', 'row-2');
    rows[1].focus();
    stack.push(dialog('character-menu', root));
    expect(doc.activeElement).toBe(rows[1]);
  });

  it('gives focus back to what had it when the last dialog closes', () => {
    const { root } = makeRoot('picker', 'row-1');
    stack.push(dialog('potion-picker', root));
    stack.pop();
    expect(doc.activeElement).toBe(hudButton);
  });

  it('drops focus from the closed dialog when nothing had it before (WebKit clicks)', () => {
    doc.activeElement = doc.body; // WebKit doesn't focus a clicked button
    const { root, rows } = makeRoot('menu', 'row-1');
    stack.push(dialog('character-menu', root));
    rows[0].focus();
    stack.pop();
    expect(doc.activeElement).toBe(doc.body);
  });

  it("doesn't take focus back from something that took it since", () => {
    const { root } = makeRoot('picker', 'row-1');
    const field = new FakeEl('search-field', doc, true);
    doc.body.add(field);
    stack.push(dialog('potion-picker', root));
    field.focus();
    stack.pop();
    expect(doc.activeElement).toBe(field);
  });

  it('hands focus to the dialog underneath when the top one closes', () => {
    const menu = makeRoot('menu', 'row-1');
    const choice = makeRoot('choice', 'option-1');
    stack.push(dialog('character-menu', menu.root));
    stack.push(dialog('choice', choice.root));
    expect(doc.activeElement).toBe(choice.root);
    stack.remove('choice');
    expect(doc.activeElement).toBe(menu.root);
    stack.remove('character-menu');
    expect(doc.activeElement).toBe(hudButton);
  });

  it('focuses a dialog drawn just after it was pushed (push, then open)', async () => {
    const { root } = makeRoot('diagnostics', 'tab-1');
    root.shown = false;
    stack.push(dialog('diagnostic-modal', root));
    expect(doc.activeElement).toBe(hudButton);
    root.shown = true; // what the caller's open() does right after the push
    await Promise.resolve();
    expect(doc.activeElement).toBe(root);
  });

  it('keeps Tab and Shift+Tab inside the dialog, wrapping at either end', () => {
    const { root, rows } = makeRoot('shop', 'buy', 'sell', 'leave');
    stack.push(dialog('shop', root));
    const forward = [tab(), tab(), tab(), tab()].map((e) => {
      stack.handleKeyDown(e);
      expect(e.prevented).toBe(true);
      return doc.activeElement?.name;
    });
    expect(forward).toEqual(['buy', 'sell', 'leave', 'buy']);
    stack.handleKeyDown(tab(true));
    expect(doc.activeElement).toBe(rows[2]);
  });

  it("skips controls that aren't shown", () => {
    const { root, rows } = makeRoot('shop', 'buy', 'hidden', 'leave');
    rows[1].shown = false;
    stack.push(dialog('shop', root));
    stack.handleKeyDown(tab());
    stack.handleKeyDown(tab());
    expect(doc.activeElement).toBe(rows[2]);
  });

  it('lets a dialog that moves its own focus with Tab keep doing so', () => {
    const { root, rows } = makeRoot('menu', 'panel-1', 'panel-2');
    const menu = dialog('character-menu', root);
    menu.handleKeyDown = (e) => {
      e.preventDefault();
      rows[1].focus();
      return true;
    };
    stack.push(menu);
    stack.handleKeyDown(tab());
    expect(doc.activeElement).toBe(rows[1]);
  });

  it('still stops Tab for a dialog without a root, leaving focus where it is', () => {
    stack.push({ id: 'targeting', isOpen: true, handleKeyDown: () => false, close: () => undefined });
    expect(doc.activeElement).toBe(hudButton);
    const e = tab();
    stack.handleKeyDown(e);
    expect(e.prevented).toBe(true);
    expect(doc.activeElement).toBe(hudButton);
  });
});
