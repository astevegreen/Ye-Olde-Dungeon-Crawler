import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuneOfReturnDiscoveryModal } from '../runeOfReturnDiscoveryModal';
import { CharacterTab } from '../characterMenu/characterTab';
import { GameEngine, GameMap, Player } from '../../engine';
import { RuneOfReturnItem } from '../../engine';

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

describe('RuneOfReturnDiscoveryModal & the Rune of Return ranks', () => {
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
        town: { name: 'Bjarnarhaven', npcs: [{ id: 'npc-rune-smith', name: 'Thrain the Rune-Smith' }] } as any,
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
      expect(el?.innerHTML).toContain('dissolves into a pulse of ethereal light');
      expect(el?.innerHTML).toContain('Two-Way Dimensional Recall:');
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

  describe('Rune of Return ranks on the Character tab', () => {
    const openTab = (): { tab: CharacterTab; container: MockElement } => {
      const tab = new CharacterTab();
      const container = new MockElement();
      tab.mount(container as unknown as HTMLElement);
      tab.onActivate({
        engine,
        worldState: engine.worldState,
        player: engine.player,
        map: engine.map,
        currentFloor: engine.currentFloor,
        turnCount: engine.turnCount,
        manifest: engine.manifest,
      });
      return { tab, container };
    };

    beforeEach(() => {
      engine.player.hasDiscoveredRune = true;
    });

    it('shows all three tracks beside the attributes that spend the same points', () => {
      const { container } = openTab();
      expect(container.innerHTML).toContain('Also spends points');
      expect(container.innerHTML).toContain('Channel Celerity');
      expect(container.innerHTML).toContain('Steadfast Weave');
      expect(container.innerHTML).toContain('Unbound Casting');
      expect(container.innerHTML).toContain('Recalls to');
      expect(container.innerHTML).toContain('Ranks learned');
      expect(container.innerHTML).toContain('3 / 3');
      expect(container.innerHTML).toContain('Thrain the Rune-Smith');
    });

    it('stays hidden until the rune is discovered, and 1-3 then fall through', () => {
      engine.player.hasDiscoveredRune = false;
      const { tab, container } = openTab();
      expect(container.innerHTML).not.toContain('Channel Celerity');
      expect(tab.handleKeyDown(makeKey('1', 'Digit1'))).toBe(false);
    });

    it('plans ranks on 1, 2, 3 and spends them through allocateRuneMastery on accept', () => {
      const { tab } = openTab();
      tab.handleKeyDown(makeKey('1', 'Digit1'));
      tab.handleKeyDown(makeKey('2', 'Digit2'));
      tab.handleKeyDown(makeKey('3', 'Digit3'));
      // Unbound Casting has one rank: a second can't be planned
      expect(tab.handleKeyDown(makeKey('3', 'Digit3'))).toBe(false);

      // Nothing is spent until accept
      expect(engine.player.runeMastery).toEqual({ celerityPoints: 0, weavePoints: 0, mobilityPoints: 0 });
      expect(engine.player.unspentStatPoints).toBe(5);

      expect(tab.accept()).toBe(true);
      expect(engine.player.runeMastery).toEqual({ celerityPoints: 1, weavePoints: 1, mobilityPoints: 1 });
      expect(engine.player.unspentStatPoints).toBe(2);
    });

    it('plans nothing without points', () => {
      engine.player.unspentStatPoints = 0;
      const { tab } = openTab();
      expect(tab.allocate('celerity')).toBe(false);
      expect(engine.player.runeMastery.celerityPoints).toBe(0);
    });

    it('enforces the 7-rank cap across all tracks', () => {
      engine.player.unspentStatPoints = 10;
      engine.player.runeMastery = { celerityPoints: 3, weavePoints: 2, mobilityPoints: 1 };
      const { tab } = openTab();
      expect(tab.allocate('weave')).toBe(true);
      expect(tab.allocate('weave')).toBe(false); // weave is at 3
      expect(tab.allocate('celerity')).toBe(false); // celerity is at 3, and the tree at 7
      tab.accept();
      expect(engine.player.unspentStatPoints).toBe(9);
    });

    it('marks the ranks when opened from a "rune tree" entry point', () => {
      const tab = new CharacterTab();
      tab.focusRuneSection();
      const container = new MockElement();
      const marked: string[] = [];
      container.querySelector = (selector: string) => {
        const el = new MockElement();
        el.className = selector.slice(1);
        marked.push(selector);
        Object.defineProperty(el, 'className', { set: (v: string) => marked.push(v), get: () => 'ch-rune' });
        return el;
      };
      tab.mount(container as unknown as HTMLElement);
      tab.onActivate({
        engine,
        worldState: engine.worldState,
        player: engine.player,
        map: engine.map,
        currentFloor: engine.currentFloor,
        turnCount: engine.turnCount,
        manifest: engine.manifest,
      });
      expect(marked).toEqual(['.ch-rune', 'ch-rune ui-glow']);
    });
  });
});
