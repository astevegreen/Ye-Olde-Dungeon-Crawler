import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MasteryChoiceModal } from '../masteryChoiceModal';
import { GameEngine, GameMap, Player } from '../../engine';

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  appendChild(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
}

class MockDocument {
  public overlay: MockElement | null = null;
  getElementById(id: string): MockElement | null {
    if (id === 'app') {
      const app = new MockElement();
      app.appendChild = (el?: unknown) => {
        this.overlay = el as MockElement;
      };
      return app;
    }
    return this.overlay && this.overlay.id === id ? this.overlay : null;
  }
  createElement(): MockElement {
    return new MockElement();
  }
}

const key = (k: string, code = k) => ({ key: k, code, preventDefault: () => {} }) as unknown as KeyboardEvent;

describe('MasteryChoiceModal', () => {
  let originalDocument: unknown;
  let engine: GameEngine;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = new MockDocument();
    engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p', name: 'Hero', position: { x: 1, y: 1 } }),
      floor: 2,
    });
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('wolf', 'Wolf');
    for (let i = 0; i < 15; i++) engine.compendium.recordKill('rat', 'Rat');
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  const openWith = (...ids: string[]) => {
    const modal = new MasteryChoiceModal();
    for (const id of ids) modal.enqueue({ scope: 'species', masteryId: id, name: id, kills: 15 });
    modal.open(engine);
    (modal as any).openedAt = 0;
    return modal;
  };

  it('ignores number keys and does nothing on Enter until a perk is highlighted', () => {
    const modal = openWith('wolf');
    modal.handleKeyDown(key('1', 'Digit1'));
    modal.handleKeyDown(key('3', 'Numpad3'));
    modal.handleKeyDown(key('Enter'));
    expect(engine.compendium.getPerk('wolf')).toBeUndefined();
    expect(modal.isOpen).toBe(true);
  });

  it('swallows keys in flight when it opens', () => {
    const modal = new MasteryChoiceModal();
    modal.enqueue({ scope: 'species', masteryId: 'wolf', name: 'Wolf', kills: 15 });
    modal.open(engine);
    modal.handleKeyDown(key('ArrowDown'));
    modal.handleKeyDown(key('Enter'));
    expect(engine.compendium.getPerk('wolf')).toBeUndefined();
  });

  it('highlights with arrows and locks in on Enter, then shows the next queued mastery', () => {
    const modal = openWith('wolf', 'rat');
    modal.handleKeyDown(key('ArrowDown')); // anatomist
    modal.handleKeyDown(key('ArrowDown')); // survivor
    expect(engine.compendium.getPerk('wolf')).toBeUndefined();
    modal.handleKeyDown(key('Enter'));
    expect(engine.compendium.getPerk('wolf')).toBe('survivor');
    expect(modal.isOpen).toBe(true); // rat is next

    (modal as any).openedAt = 0;
    modal.highlight(4);
    expect(modal.confirm()).toBe(true);
    expect(engine.compendium.getPerk('rat')).toBe('plunderer');
    expect(modal.isOpen).toBe(false);
  });

  it('Escape defers the choice, leaving the mastery pending', () => {
    const modal = openWith('wolf');
    modal.handleKeyDown(key('ArrowDown'));
    modal.handleKeyDown(key('Escape'));
    expect(modal.isOpen).toBe(false);
    expect(engine.compendium.getPerk('wolf')).toBeUndefined();
  });

  it('does not queue the same mastery twice', () => {
    const modal = new MasteryChoiceModal();
    modal.enqueue({ scope: 'species', masteryId: 'wolf', name: 'Wolf', kills: 15 });
    modal.enqueue({ scope: 'species', masteryId: 'wolf', name: 'Wolf', kills: 15 });
    modal.enqueue({ scope: 'category', masteryId: 'wolf', name: 'Wolves', kills: 50 });
    expect((modal as any).queue).toHaveLength(2);
  });
});
