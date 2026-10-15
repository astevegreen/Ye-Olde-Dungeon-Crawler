import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgeOfferCard, type ForgeOfferView } from '../forgeOfferCard';

// No DOM library: a scrim stub holding the markup, whose buttons are read back from it so a test can click them.
class FakeButton {
  private click?: () => void;
  constructor(private readonly attrs: Record<string, string>) {}
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  addEventListener(_type: string, fn: () => void): void {
    this.click = fn;
  }
  fire(): void {
    this.click?.();
  }
}

class FakeScrim {
  id = '';
  className = '';
  style: Record<string, string> = {};
  buttons: FakeButton[] = [];
  private html = '';
  get innerHTML(): string {
    return this.html;
  }
  set innerHTML(html: string) {
    this.html = html;
    this.buttons = [];
  }
  appendChild(): void {}
  private bind(attr: string, value?: string): FakeButton[] {
    const found: FakeButton[] = [];
    for (const m of this.html.matchAll(new RegExp(`${attr}="([^"]*)"`, 'g'))) {
      if (value !== undefined && m[1] !== value) continue;
      const btn = new FakeButton({ [attr]: m[1] });
      this.buttons.push(btn);
      found.push(btn);
    }
    return found;
  }
  querySelector(sel: string): FakeButton | null {
    const id = sel.replace('#', '');
    return this.html.includes(`id="${id}"`) && !new RegExp(`id="${id}"[^>]*disabled`).test(this.html) ? (this.bind('id', id)[0] ?? null) : null;
  }
  querySelectorAll(sel: string): FakeButton[] {
    return this.bind(sel.slice(1, -1));
  }
  press(attr: string, value: string): void {
    this.buttons.find((b) => b.getAttribute(attr) === value)?.fire();
  }
}

const free: ForgeOfferView = {
  index: 1,
  source: 'Ivalda’s forge',
  elements: ['cold', 'fire'],
  known: [
    { id: 'firebolt', name: 'Firebolt' },
    { id: 'slow', name: 'Slow' },
  ],
};

describe('ForgeOfferCard', () => {
  const scrim = new FakeScrim();
  beforeEach(() => {
    scrim.innerHTML = '';
    (globalThis as any).document = {
      getElementById: () => null,
      createElement: () => scrim,
      body: { appendChild: () => {} },
    };
  });
  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('asks for a spell and an element, previews the pair, then forges it and closes', () => {
    const forged: unknown[] = [];
    let closed = 0;
    const card = new ForgeOfferCard({
      preview: (spellId, element) => ({ html: `${spellId}+${element}`, ok: spellId === 'firebolt' && element === 'cold' }),
      onForge: (...args) => forged.push(args),
      onClose: () => closed++,
    });
    card.open(free);
    expect(scrim.innerHTML).toContain('Ivalda’s forge');
    expect(scrim.innerHTML).toContain('data-forge-element="cold"');
    expect(scrim.innerHTML).toMatch(/id="forge-offer-forge"[^>]*disabled/);

    scrim.press('data-forge-spell', 'firebolt');
    scrim.press('data-forge-element', 'fire');
    expect(scrim.innerHTML).toContain('firebolt+fire');
    expect(scrim.innerHTML).toMatch(/id="forge-offer-forge"[^>]*disabled/);

    scrim.press('data-forge-element', 'cold');
    expect(scrim.innerHTML).not.toMatch(/id="forge-offer-forge"[^>]*disabled/);
    scrim.press('id', 'forge-offer-forge');
    expect(forged).toEqual([[1, 'firebolt', 'cold']]);
    expect(closed).toBe(1);
    expect(card.isOpen).toBe(false);
  });

  it('a fixed element asks only for the spell; Not now closes without forging', () => {
    const forged: unknown[] = [];
    const card = new ForgeOfferCard({ preview: () => ({ html: 'ok', ok: true }), onForge: (...args) => forged.push(args), onClose: () => {} });
    card.open({ ...free, source: 'Skuld’s mirror', elements: ['healing'] });
    expect(scrim.innerHTML).toContain('It works healing into one spell you know');
    expect(scrim.innerHTML).not.toContain('data-forge-element');
    scrim.press('id', 'forge-offer-later');
    expect(forged).toEqual([]);
    expect(card.isOpen).toBe(false);
  });
});
