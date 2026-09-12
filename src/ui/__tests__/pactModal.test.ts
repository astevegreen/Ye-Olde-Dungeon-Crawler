import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PactModal } from '../pactModal';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { COTW_PACTS } from '../../content/cotw/pacts';
import { ModalStackManager } from '../modalStack';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
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
    } else if (selector.includes('data-toggle-id')) {
      const m = selector.match(/data-toggle-id="([^"]+)"/);
      if (m && this.innerHTML.includes(`data-toggle-id="${m[1]}"`)) {
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

describe('PactModal UI Surface', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let engine: GameEngine;
  let modal: PactModal;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    const map = new GameMap(10, 10);
    const player = new Player({ position: { x: 5, y: 5 } });
    engine = new GameEngine({
      map,
      player,
      manifest: {
        id: 'cotw',
        name: 'Castle of the Winds',
        monsters: [],
        items: [],
        spells: [],
        town: {} as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        pacts: COTW_PACTS,
      },
    });

    modal = new PactModal();
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('initializes in closed state with DOM element created', () => {
    expect(modal.isOpen).toBe(false);
    const overlay = mockDoc.getElementById('pact-modal');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('none');
  });

  it('opens and renders all available pacts from engine', () => {
    modal.open(engine);
    expect(modal.isOpen).toBe(true);

    const overlay = mockDoc.getElementById('pact-modal');
    expect(overlay?.style.display).toBe('flex');

    const rows = overlay?.querySelectorAll('.pact-row');
    expect(rows?.length).toBe(COTW_PACTS.length);

    // Verify first pact details rendered in innerHTML
    expect(overlay?.innerHTML).toContain('Pact of the Blood Moon');
    expect(overlay?.innerHTML).toContain('-25% Maximum Health');
    expect(overlay?.innerHTML).toContain('2.0x Gold drops');
  });

  it('navigates through pacts via ArrowDown and ArrowUp', () => {
    modal.open(engine);

    // Press ArrowDown
    modal.handleKeyDown(makeKey('ArrowDown'));

    const overlay = mockDoc.getElementById('pact-modal');
    expect(overlay?.innerHTML).toContain('data-pact-id="pact_gloom"');

    // Press ArrowUp to return to first
    modal.handleKeyDown(makeKey('ArrowUp'));
    expect(overlay?.innerHTML).toContain('data-pact-id="pact_blood"');
  });

  it('toggles pact activation on Space / Enter key press', () => {
    modal.open(engine);

    expect(engine.pacts.isPactActive('pact_blood')).toBe(false);

    // Press Space on selected pact_blood
    modal.handleKeyDown(makeKey(' '));

    expect(engine.pacts.isPactActive('pact_blood')).toBe(true);
    const overlay = mockDoc.getElementById('pact-modal');
    expect(overlay?.innerHTML).toContain('[SEALED]');
    expect(overlay?.innerHTML).toContain('ACTIVE PACTS: 1');

    // Press Space again to deactivate
    modal.handleKeyDown(makeKey(' '));
    expect(engine.pacts.isPactActive('pact_blood')).toBe(false);
    expect(overlay?.innerHTML).toContain('ACTIVE PACTS: 0');
  });

  it('closes on Escape or KeyP key press', () => {
    const onClose = vi.fn();
    modal.open(engine, onClose);

    modal.handleKeyDown(makeKey('Escape'));

    expect(modal.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockDoc.getElementById('pact-modal')?.style.display).toBe('none');
  });

  it('integrates cleanly with ModalStackManager', () => {
    const stack = new ModalStackManager();
    modal.open(engine);
    stack.push(modal);

    expect(stack.size).toBe(1);
    expect(stack.top()?.id).toBe('pact-modal');

    // Key routing through stack
    const handled = stack.handleKeyDown(makeKey('Escape'));
    expect(handled).toBe(true);
    expect(modal.isOpen).toBe(false);
  });
});
