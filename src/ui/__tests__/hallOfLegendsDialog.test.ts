import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Leaderboard, MemoryStorage, type HallOfFameEntry } from '../../engine';
import { resolveBranding } from '../branding';
import { HallOfLegendsDialog } from '../hallOfLegendsDialog';

// The tests run under node, so the dialog renders into a stand-in scrim whose innerHTML
// is the dialog's markup, as in the shop dialog's test.
class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  public tabIndex = 0;
  public focused = false;
  public listeners: Record<string, (e: unknown) => void> = {};
  appendChild(): void {}
  addEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners[type] = fn;
  }
  focus(): void {
    this.focused = true;
  }
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
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

const champion = (over: Partial<HallOfFameEntry>): HallOfFameEntry => ({
  id: 'run-1',
  heroName: 'Ann',
  gender: 'female',
  status: 'fallen',
  epitaph: 'Slain on Floor 3',
  level: 4,
  deepestFloor: 3,
  turns: 400,
  xp: 900,
  goldCp: 120,
  score: 1200,
  date: 1700000000000,
  ...over,
});

describe('HallOfLegendsDialog', () => {
  let originalDocument: unknown;
  let doc: MockDocument;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    doc = new MockDocument();
    (globalThis as { document?: unknown }).document = doc;
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  const open = (champions: HallOfFameEntry[]) => {
    const leaderboard = new Leaderboard(new MemoryStorage());
    champions.forEach((c) => leaderboard.recordRun(c));
    const hall = new HallOfLegendsDialog({ leaderboard, branding: resolveBranding(), onShare: () => {}, onImport: () => {} });
    hall.open();
    return { hall, html: doc.scrim?.innerHTML ?? '' };
  };

  it('opens in the shared dialog frame under the pack-neutral hall name', () => {
    const { hall, html } = open([]);
    expect(doc.scrim?.id).toBe('valhalla-modal');
    expect(html).toContain('class="ui-dialog');
    expect(html).toContain(resolveBranding().hallOfFameName);
    expect(hall.isOpen).toBe(true);
    hall.close();
    expect(hall.isOpen).toBe(false);
  });

  it('holds focus and closes on Escape, which goes no further', () => {
    const { hall } = open([]);
    expect(doc.scrim?.focused).toBe(true);
    const key = (k: string) => {
      const e = { key: k, stopped: false, preventDefault() {}, stopPropagation() { this.stopped = true; } };
      doc.scrim?.listeners.keydown(e);
      return e;
    };
    expect(key('a').stopped).toBe(false);
    expect(hall.isOpen).toBe(true);
    expect(key('Escape').stopped).toBe(true);
    expect(hall.isOpen).toBe(false);
  });

  it('with no champions, says so and offers nothing to copy or share', () => {
    const { html } = open([]);
    expect(html).toContain('No champions have yet entered');
    expect(html).toMatch(/id="btn-valhalla-copy"[^>]*disabled/);
    expect(html).toMatch(/id="btn-valhalla-share"[^>]*disabled/);
  });

  it('lists champions best first, selects the first, and escapes their names', () => {
    const { html } = open([
      champion({ id: 'a', heroName: '<Ann>', score: 1200 }),
      champion({ id: 'b', heroName: 'Bo', status: 'victorious', gender: 'male', score: 9000 }),
    ]);
    expect(html.indexOf('data-champion="b"')).toBeLessThan(html.indexOf('data-champion="a"'));
    expect(html).toMatch(/ui-option hall-row is-focused" data-champion="b"/);
    expect(html).toContain('&lt;Ann&gt;');
    expect(html).toContain('Victor');
    expect(html).toContain('9,000 pts');
    expect(html).not.toMatch(/id="btn-valhalla-share"[^>]*disabled/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});
