import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuneOfReturnDiscoveryModal } from '../runeOfReturnDiscoveryModal';
import { RuneOfReturnTreeModal } from '../runeOfReturnTreeModal';
import { GameEngine, GameMap, Player } from '../../engine';
import { RuneOfReturnItem } from '../../engine';
import { ModalStackManager } from '../modalStack';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public textContent: string = '';
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  appendChild(el: MockElement) {
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
  }

  addEventListener(type: string, listener: (e?: any) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void) {
    this.eventListeners.get(type)?.delete(listener);
  }

  querySelector(selector: string): MockElement | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      if (this.innerHTML.includes(`id="${targetId}"`)) {
        const el = new MockElement();
        el.id = targetId;
        matches.push(el);
      }
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const regex = new RegExp(`class="[^"]*${cls}[^"]*"`, 'g');
      while (regex.exec(this.innerHTML) !== null) {
        const el = new MockElement();
        el.className = cls;
        matches.push(el);
      }
    } else if (selector.includes('data-track')) {
      const matchesTracks = this.innerHTML.matchAll(/data-track="([^"]+)"/g);
      for (const m of matchesTracks) {
        const el = new MockElement();
        el.id = m[1];
        matches.push(el);
      }
    }
    return matches;
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body: MockElement = new MockElement();

  constructor() {
    const app = new MockElement();
    app.id = 'app';
    this.elements.set('app', app);
  }

  getElementById(id: string): MockElement | null {
    if (this.elements.has(id)) {
      return this.elements.get(id)!;
    }
    return null;
  }

  createElement(_tag: string): MockElement {
    const el = new MockElement();
    return el;
  }
}

function makeKey(key: string, code?: string): KeyboardEvent {
  return {
    key,
    code: code ?? key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('RuneOfReturnDiscoveryModal & RuneOfReturnTreeModal', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let engine: GameEngine;
  let rune: RuneOfReturnItem;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    const map = new GameMap(10, 10);
    const player = new Player({ position: { x: 5, y: 5 } });
    player.unspentStatPoints = 5;
    rune = new RuneOfReturnItem({ id: 'rune-test', name: 'Rune of Return' });
    player.inventory.primaryPack.addItem(rune);

    engine = new GameEngine({
      map,
      player,
      manifest: {
        id: 'cotw',
        name: 'Castle of the Winds',
        monsters: [],
        items: [],
        spells: [],
        town: { name: 'Bjarnarhaven' } as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        runeOfReturn: {
          attunementNpcId: 'npc-rune-smith',
        },
      },
    });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  describe('RuneOfReturnDiscoveryModal', () => {
    it('initializes in closed state and sets up DOM element', () => {
      const modal = new RuneOfReturnDiscoveryModal();
      expect(modal.isOpen).toBe(false);
      const el = mockDoc.getElementById('rune-of-return-discovery-modal');
      expect(el).not.toBeNull();
      expect(el?.style.display).toBe('none');
    });

    it('opens and displays relic details and instructions', () => {
      const modal = new RuneOfReturnDiscoveryModal();
      modal.open(engine);
      expect(modal.isOpen).toBe(true);

      const el = mockDoc.getElementById('rune-of-return-discovery-modal');
      expect(el?.style.display).toBe('flex');
      expect(el?.innerHTML).toContain('ANCIENT RELIC DISCOVERED');
      expect(el?.innerHTML).toContain('THE RUNE OF RETURN');
      expect(el?.innerHTML).toContain('Thrain the Rune-Smith');
      expect(el?.innerHTML).toContain('Channeling (T):');
      expect(el?.innerHTML).toContain('Vulnerability & Concentration:');
      expect(el?.innerHTML).toContain('Depth Scaling:');
    });

    it('closes on Escape or Space', () => {
      const onClose = vi.fn();
      const modal = new RuneOfReturnDiscoveryModal({ onClose });
      modal.open(engine);

      const handled = modal.handleKeyDown(makeKey('Escape'));
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    it('closes and triggers onOpenTree callback on KeyU', () => {
      const onOpenTree = vi.fn();
      const modal = new RuneOfReturnDiscoveryModal({ onOpenTree });
      modal.open(engine);

      const handled = modal.handleKeyDown(makeKey('u', 'KeyU'));
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(false);
      expect(onOpenTree).toHaveBeenCalled();
    });
  });

  describe('RuneOfReturnTreeModal', () => {
    it('initializes in closed state and creates overlay DOM', () => {
      const modal = new RuneOfReturnTreeModal();
      expect(modal.isOpen).toBe(false);
      const el = mockDoc.getElementById('rune-of-return-tree-modal');
      expect(el).not.toBeNull();
      expect(el?.style.display).toBe('none');
    });

    it('opens and renders all 3 mastery tracks with unspent points', () => {
      const modal = new RuneOfReturnTreeModal();
      modal.open(engine);
      expect(modal.isOpen).toBe(true);

      const el = mockDoc.getElementById('rune-of-return-tree-modal');
      expect(el?.style.display).toBe('flex');
      expect(el?.innerHTML).toContain('Channel Celerity');
      expect(el?.innerHTML).toContain('Steadfast Weave');
      expect(el?.innerHTML).toContain('Unbound Casting');
      expect(el?.innerHTML).toContain('Unspent Stat Points:');
      expect(el?.innerHTML).toContain('3/3');
    });

    it('allocates points into tracks via number keys 1, 2, 3', () => {
      const modal = new RuneOfReturnTreeModal();
      modal.open(engine);

      // Allocate Celerity (1)
      expect(engine.player.runeMastery.celerityPoints).toBe(0);
      modal.handleKeyDown(makeKey('1', 'Digit1'));
      expect(engine.player.runeMastery.celerityPoints).toBe(1);
      expect(engine.player.unspentStatPoints).toBe(4);

      // Allocate Weave (2)
      expect(engine.player.runeMastery.weavePoints).toBe(0);
      modal.handleKeyDown(makeKey('2', 'Digit2'));
      expect(engine.player.runeMastery.weavePoints).toBe(1);
      expect(engine.player.unspentStatPoints).toBe(3);

      // Allocate Mobility (3)
      expect(engine.player.runeMastery.mobilityPoints).toBe(0);
      modal.handleKeyDown(makeKey('3', 'Digit3'));
      expect(engine.player.runeMastery.mobilityPoints).toBe(1);
      expect(engine.player.unspentStatPoints).toBe(2);

      // Mobility is capped at 1 point max (binary)
      modal.handleKeyDown(makeKey('3', 'Digit3'));
      expect(engine.player.runeMastery.mobilityPoints).toBe(1);
      expect(engine.player.unspentStatPoints).toBe(2);
    });

    it('respects track caps and does not allocate without points', () => {
      engine.player.unspentStatPoints = 0;
      const modal = new RuneOfReturnTreeModal();
      modal.open(engine);

      const allocated = modal.allocate('celerity');
      expect(allocated).toBe(false);
      expect(engine.player.runeMastery.celerityPoints).toBe(0);
    });

    it('enforces total 7-point cap across all tracks', () => {
      engine.player.unspentStatPoints = 10;
      engine.player.runeMastery = {
        celerityPoints: 3,
        weavePoints: 3,
        mobilityPoints: 1,
      };
      const modal = new RuneOfReturnTreeModal();
      modal.open(engine);

      const allocated = modal.allocate('celerity');
      expect(allocated).toBe(false);
      expect(engine.player.unspentStatPoints).toBe(10);
    });

    it('closes on Escape and updates modalStack', () => {
      const modalStack = new ModalStackManager();
      const modal = new RuneOfReturnTreeModal();
      modal.setModalStack(modalStack);
      modal.open(engine);
      modalStack.push(modal);

      expect(modalStack.isEmpty()).toBe(false);
      modal.handleKeyDown(makeKey('Escape'));
      expect(modal.isOpen).toBe(false);
      expect(modalStack.isEmpty()).toBe(true);
    });
  });
});
