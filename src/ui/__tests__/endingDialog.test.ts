import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EndingDialog } from '../endingDialog';

// The tests run under node: a stand-in scrim holds the markup, and one stand-in button
// stands for the dialog's Continue button.
type Listener = (e: unknown) => void;

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  public listeners: Record<string, Listener[]> = {};
  public button: MockElement | null = null;
  appendChild(): void {}
  addEventListener(type: string, fn: Listener): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== fn);
  }
  dispatch(type: string, e: unknown = {}): void {
    for (const fn of this.listeners[type] ?? []) fn(e);
  }
  focus(): void {}
  querySelector(): MockElement | null {
    this.button ??= new MockElement();
    return this.button;
  }
}

class MockDocument {
  public scrim: MockElement | null = null;
  getElementById(id: string): MockElement | null {
    if (id === 'app') {
      const app = new MockElement();
      app.appendChild = (el?: unknown) => {
        this.scrim = el as MockElement;
      };
      return app;
    }
    return this.scrim && this.scrim.id === id ? this.scrim : null;
  }
  createElement(): MockElement {
    return new MockElement();
  }
}

const key = (k: string) => ({ key: k, preventDefault() {}, stopPropagation() {} });

describe('EndingDialog', () => {
  let doc: MockDocument;
  beforeEach(() => {
    doc = new MockDocument();
    (globalThis as unknown as { document: unknown }).document = doc;
  });
  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('tells the ending as escaped paragraphs under its title', () => {
    new EndingDialog().show({ title: 'Ragnarök', kicker: 'Sven · Level 31', paragraphs: ['The <root> splits.', 'The gods ride.'] }, () => {});
    const html = doc.scrim!.innerHTML;
    expect(html).toContain('Ragnarök');
    expect(html).toContain('Sven · Level 31');
    expect(html).toContain('<p>The &lt;root&gt; splits.</p><p>The gods ride.</p>');
    expect(html).toContain('btn-ending-continue');
    expect(doc.scrim!.style.display).toBe('flex');
  });

  it('moves on once, by its button or by Enter', () => {
    const byClick = vi.fn();
    const dialog = new EndingDialog();
    dialog.show({ title: 'The Root Sealed', paragraphs: ['Home.'] }, byClick);
    doc.scrim!.button!.dispatch('click');
    doc.scrim!.button!.dispatch('click');
    expect(byClick).toHaveBeenCalledTimes(1);
    expect(dialog.isOpen).toBe(false);

    const byKey = vi.fn();
    dialog.show({ title: 'The Root Sealed', paragraphs: ['Home.'] }, byKey);
    doc.scrim!.dispatch('keydown', key('a'));
    expect(byKey).not.toHaveBeenCalled();
    doc.scrim!.dispatch('keydown', key('Enter'));
    expect(byKey).toHaveBeenCalledTimes(1);
  });
});
