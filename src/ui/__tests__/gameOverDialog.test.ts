import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameOverDialog, type GameOverView } from '../gameOverDialog';
import { epitaphHtml } from '../epitaph';
import type { HallOfFameEntry } from '../../engine';

const ann: HallOfFameEntry = {
  id: 'ann', heroName: '<Ann>', gender: 'female', status: 'fallen', epitaph: 'Slain by Ogre on Floor 3', level: 4,
  deepestFloor: 3, turns: 1234, xp: 900, goldCp: 350, score: 1200, date: Date.UTC(2026, 9, 2),
};

// The tests run under node, so the dialog renders into a stand-in scrim whose innerHTML
// is the dialog's markup, as in the shop dialog's test.
class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  appendChild(): void {}
  querySelector(): null {
    return null;
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

const noop = () => {};
const view = (over: Partial<GameOverView> = {}): GameOverView => ({
  status: 'fallen',
  title: 'Fallen in Battle',
  banner: 'Your journey ends here.',
  factsHtml: epitaphHtml(ann, 'Megin'),
  exportLabel: 'Export save (.sav)',
  ...over,
});

describe('GameOverDialog', () => {
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

  const open = (v: GameOverView) => {
    const dialog = new GameOverDialog({ onLoadAutosave: noop, onShare: noop, onExport: noop, onReturn: noop });
    dialog.show(v);
    return { dialog, html: doc.scrim?.innerHTML ?? '' };
  };

  it('shows in the shared dialog frame, on the scrim the e2e tests look for', () => {
    const { dialog } = open(view());
    expect(doc.scrim?.id).toBe('game-over-modal');
    expect(doc.scrim?.className).toBe('ui-scrim');
    expect(doc.scrim?.innerHTML).toContain('class="ui-dialog');
    expect(dialog.isOpen).toBe(true);
    dialog.hide();
    expect(dialog.isOpen).toBe(false);
  });

  it('marks a loss and a win by tone and icon, with no colors of its own', () => {
    const lost = open(view()).html;
    expect(lost).toContain('data-icon="fallen"');
    expect(lost).toContain('go-banner is-lost');
    const won = open(view({ status: 'victorious', title: 'Victory!' })).html;
    expect(won).toContain('data-icon="trophy"');
    expect(won).toContain('go-banner is-won');
    expect(lost + won).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });

  it('escapes the epitaph and labels, and offers the autosave only when there is one', () => {
    const plain = open(view()).html;
    expect(plain).toContain('<dt>Hero</dt><dd>&lt;Ann&gt;</dd>');
    expect(plain).toContain('<dt>Wealth</dt><dd>350 CP</dd>');
    expect(plain).not.toMatch(/[╔║═]/);
    expect(plain).toContain('Export save (.sav)');
    expect(plain).not.toContain('btn-game-over-autosave');
    const withSave = open(view({ autosaveLabel: 'Load the autosave (Ann, F3)', score: 'Legends score: 1,200' })).html;
    expect(withSave).toContain('btn-game-over-autosave');
    expect(withSave).toContain('Legends score: 1,200');
  });

  it('never offers the autosave after a victory', () => {
    const won = open(view({ status: 'victorious', autosaveLabel: 'Load the autosave (Ann, F50)' })).html;
    expect(won).not.toContain('btn-game-over-autosave');
  });
});
