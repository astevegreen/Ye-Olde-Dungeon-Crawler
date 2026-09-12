import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SagaShareModal } from '../sagaShareModal';
import { Leaderboard, type ValhallaEntry } from '../../engine';
import { MemoryStorage } from '../../engine';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public value: string = '';
  public textContent: string = '';
  public disabled: boolean = false;
  public classList = {
    add: (c: string) => {
      if (!this.className.includes(c)) this.className += ` ${c}`;
    },
    remove: (c: string) => {
      this.className = this.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim();
    },
  };
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  appendChild(el: MockElement) {
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
  }

  remove() {}

  addEventListener(type: string, listener: (e?: any) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void) {
    this.eventListeners.get(type)?.delete(listener);
  }
}

describe('SagaShareModal (Headless)', () => {
  let originalDocument: any;
  let elementMap: Map<string, MockElement>;
  let leaderboard: Leaderboard;

  const testEntry: ValhallaEntry = {
    id: 'hero-freya',
    heroName: 'Freya the Shieldmaiden',
    gender: 'female',
    status: 'victorious',
    epitaph: 'Restored peace to Midgard',
    level: 7,
    deepestFloor: 8,
    turns: 950,
    xp: 8000,
    goldCp: 50000,
    score: 12500,
    date: 1700000000000,
  };

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    elementMap = new Map();

    const mockDoc = {
      elements: elementMap,
      getElementById: (id: string) => {
        if (!elementMap.has(id)) {
          const el = new MockElement();
          el.id = id;
          elementMap.set(id, el);
        }
        return elementMap.get(id);
      },
      createElement: (_tag: string) => {
        return new MockElement();
      },
      body: {
        appendChild: (el: MockElement) => {
          if (el.id) elementMap.set(el.id, el);
        },
      },
    };

    (globalThis as any).document = mockDoc;
    leaderboard = new Leaderboard(new MemoryStorage());
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('initializes in closed state and creates modal DOM elements', () => {
    const modal = new SagaShareModal({ leaderboard });
    expect(modal.isOpen).toBe(false);
    expect(modal.id).toBe('saga-share-modal');
  });

  it('openShare populates share code, web share link, and preview', () => {
    const modal = new SagaShareModal({ leaderboard });
    modal.openShare(testEntry);

    expect(modal.isOpen).toBe(true);

    const codeInput = (globalThis as any).document.getElementById('saga-code-input');
    const urlInput = (globalThis as any).document.getElementById('saga-url-input');

    expect(codeInput.value.startsWith('SAGA1_')).toBe(true);
    expect(urlInput.value).toContain('?saga=SAGA1_');
  });

  it('openImport prepares import tab and inspects prefilled query string', () => {
    const modal = new SagaShareModal({ leaderboard });
    const code = Leaderboard.encodeRunShare(testEntry);
    const shareUrl = `https://cotw.game/play?saga=${code}`;

    modal.openImport(shareUrl);
    expect(modal.isOpen).toBe(true);

    const inspected = modal.inspectInputCode();
    expect(inspected).not.toBeNull();
    expect(inspected?.heroName).toBe('Freya the Shieldmaiden');
    expect(inspected?.score).toBe(12500);
  });

  it('inscribeInspectedSaga records run to leaderboard and invokes callback', () => {
    const inscribedSpy = vi.fn();
    const modal = new SagaShareModal({
      leaderboard,
      onSagaInscribed: inscribedSpy,
    });

    const code = Leaderboard.encodeRunShare(testEntry);
    modal.openImport(code);
    modal.inspectInputCode();
    modal.inscribeInspectedSaga();

    expect(inscribedSpy).toHaveBeenCalledWith(expect.objectContaining({ heroName: 'Freya the Shieldmaiden' }));
    expect(leaderboard.getChampions().length).toBe(1);
    expect(leaderboard.getChampions()[0].heroName).toBe('Freya the Shieldmaiden');
  });

  it('handles Escape key to close modal', () => {
    const closeSpy = vi.fn();
    const modal = new SagaShareModal({
      leaderboard,
      onClose: closeSpy,
    });

    modal.openShare(testEntry);
    expect(modal.isOpen).toBe(true);

    const handled = modal.handleKeyDown({ key: 'Escape' } as KeyboardEvent);
    expect(handled).toBe(true);
    expect(modal.isOpen).toBe(false);
    expect(closeSpy).toHaveBeenCalled();
  });
});
