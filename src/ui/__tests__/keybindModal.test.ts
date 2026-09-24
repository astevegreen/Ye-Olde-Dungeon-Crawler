import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeybindModal } from '../settings/keybindModal';
import { SettingsManager, ACTION_METADATA } from '../settings/settingsManager';
import { InputHandler } from '../../rendering/input-handler';
import { GameEngine, GameMap, MemoryStorage, Player, TILES } from '../../engine';

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  public textContent = '';
  public checked = false;
  public value = '';
  public tabIndex = 0;
  public attributes: Record<string, string> = {};
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();
  public children: MockElement[] = [];

  focus(): void {
    (globalThis as any).document.activeElement = this;
  }

  blur(): void {
    (globalThis as any).document.activeElement = (globalThis as any).document.body;
  }

  contains(el: unknown): boolean {
    return el === this || this.children.some((c) => c.contains(el));
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  classList = {
    add: (cls: string) => {
      if (!this.className.includes(cls)) {
        this.className = (this.className + ' ' + cls).trim();
      }
    },
    remove: (cls: string) => {
      this.className = this.className.replace(cls, '').trim();
    },
    contains: (cls: string) => this.className.includes(cls),
  };

  appendChild(child: MockElement): void {
    this.children.push(child);
    if (child.id) {
      (globalThis as any).document?.elements?.set(child.id, child);
    }
  }

  remove(): void {
    if (this.id) {
      (globalThis as any).document?.elements?.delete(this.id);
    }
  }

  addEventListener(type: string, listener: (e?: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string }): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((l) => l(event));
    }
  }

  querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];

    // Search by ID
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      const fromDoc = (globalThis as any).document?.getElementById(targetId);
      if (fromDoc) return [fromDoc];
      if (this.innerHTML.includes(`id="${targetId}"`)) {
        const el = new MockElement();
        el.id = targetId;
        (globalThis as any).document?.elements?.set(targetId, el);
        return [el];
      }
    }

    // Search by class
    if (selector.startsWith('.')) {
      const cls = selector.slice(1).split('.')[0];
      const regex = new RegExp(`class="[^"]*${cls}[^"]*"`, 'g');
      while (regex.exec(this.innerHTML) !== null) {
        const el = new MockElement();
        el.className = cls;
        results.push(el);
      }
    }

    return results;
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body: MockElement = new MockElement();
  public activeElement: MockElement | null = this.body;

  getElementById(id: string): MockElement | null {
    return this.elements.get(id) ?? null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

function makeKey(code: string, repeat = false): KeyboardEvent {
  return {
    code,
    key: code,
    repeat,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('KeybindModal', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let originalWindow: any;
  let storage: MemoryStorage;
  let settingsManager: SettingsManager;
  let modal: KeybindModal;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    storage = new MemoryStorage();
    settingsManager = new SettingsManager(storage);
    modal = new KeybindModal({ settingsManager });
  });

  afterEach(() => {
    modal.close();
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it('implements UIModal interface with id "settings"', () => {
    expect(modal.id).toBe('settings');
    expect(modal.isOpen).toBe(false);
  });

  it('opens and closes DOM element and fires onClose callback', () => {
    const onClose = vi.fn();
    const testModal = new KeybindModal({ settingsManager, onClose });

    testModal.open();
    expect(testModal.isOpen).toBe(true);

    testModal.close();
    expect(testModal.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('contains the required movement mode explanations in rendered HTML', () => {
    modal.open();
    const modalEl = mockDoc.getElementById('settings-keybind-modal');
    expect(modalEl).not.toBeNull();

    const html = modalEl!.innerHTML;
    // Exact user requirement text check
    expect(html).toContain('Standard (NumPad &amp; Vi-Keys)');
    expect(html).toContain('Micro-Debounce Buffer (Arrow-Key Chording)');
    expect(html).toContain('The \'Hover Ring\' (Mouse Vectoring)');
  });

  it('closes on Escape when not listening for a key', () => {
    modal.open();
    expect(modal.isOpen).toBe(true);

    const escEvent = makeKey('Escape');
    const handled = modal.handleKeyDown(escEvent);
    expect(handled).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('rebinds key and persists in SettingsManager', () => {
    modal.open();

    settingsManager.bindKey('move_n', 'KeyP');
    expect(settingsManager.getCodesForAction('move_n')).toContain('KeyP');
    expect(storage.getItem('yodc_settings')).toContain('KeyP');
  });
});

class MockWindow {
  public listeners: Map<string, Set<(e: any) => void>> = new Map();

  addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; [key: string]: any }): void {
    for (const listener of Array.from(this.listeners.get(event.type) ?? [])) listener(event);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/** A keydown on `target`, dispatched as the DOM does: `target`'s own listeners first, then
 *  the window's (InputHandler's) unless one of them stopped propagation. */
function press(target: MockElement, win: MockWindow, code: string) {
  let stopped = false;
  const e = {
    type: 'keydown',
    code,
    key: code,
    repeat: false,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(() => {
      stopped = true;
    }),
  };
  target.dispatchEvent(e);
  if (!stopped) win.dispatchEvent(e);
  return e;
}

/**
 * Settings also opens from the main menu, where InputHandler is disabled, so it takes keys
 * through a listener on its own focus-holding overlay (never a window listener) and stops
 * them there; it pushes and removes its own single stack entry (ARCHITECTURE.md §6). Its old
 * capture-phase window listener plus the stack delivered every key it didn't stop twice.
 */
describe('KeybindModal input', () => {
  let mockDoc: MockDocument;
  let win: MockWindow;
  let originalDocument: unknown;
  let originalWindow: unknown;
  let engine: GameEngine;
  let input: InputHandler;
  let settingsManager: SettingsManager;
  let modal: KeybindModal;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onToggleDiagnostics: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;
    mockDoc = new MockDocument();
    win = new MockWindow();
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = win;

    engine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player: new Player({ position: { x: 5, y: 5 }, stats: { hp: 20, maxHp: 20, attack: 3, defense: 1 } }),
    });
    onToggleDiagnostics = vi.fn<() => void>();
    input = new InputHandler(engine, vi.fn(), undefined, undefined, undefined, undefined, onToggleDiagnostics);

    settingsManager = new SettingsManager(new MemoryStorage());
    onClose = vi.fn<() => void>();
    modal = new KeybindModal({ settingsManager, onClose });
    modal.setModalStack(input.modalStack);
  });

  afterEach(() => {
    modal.close();
    input.destroy();
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  const overlay = () => mockDoc.getElementById('settings-keybind-modal')!;

  it('adds no window keydown listener, holds focus, and holds one stack entry', () => {
    modal.open();
    modal.open();

    expect(win.listenerCount('keydown')).toBe(1); // InputHandler's
    expect(mockDoc.activeElement).toBe(overlay());
    expect(input.modalStack.getStackIds()).toEqual(['settings']);
  });

  it('takes a key pressed inside it once, and keeps it from InputHandler', () => {
    modal.open();
    const handle = vi.spyOn(modal, 'handleKeyDown');
    const turn = engine.turnCount;

    const e = press(overlay(), win, 'ArrowRight');

    expect(handle).toHaveBeenCalledTimes(1);
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(engine.turnCount).toBe(turn);
    expect(modal.isOpen).toBe(true);
  });

  it('takes a key pressed outside it once, through the modal stack', () => {
    modal.open();
    const handle = vi.spyOn(modal, 'handleKeyDown');

    press(mockDoc.body, win, 'KeyW');

    expect(handle).toHaveBeenCalledTimes(1);
    expect(modal.isOpen).toBe(true);
  });

  it('binds a key InputHandler would claim, pressed right after the list re-renders', () => {
    modal.open();
    const action = ACTION_METADATA.find((m) => m.category === 'Locomotion')!;
    const list = mockDoc.getElementById('settings-keybind-list')!;
    const addButton = list.children[0].children[1].children.at(-1)!;

    // The browser focuses the clicked button; the re-render then removes it.
    addButton.focus();
    addButton.dispatchEvent({ type: 'click', stopPropagation: vi.fn() } as any);
    expect(mockDoc.activeElement).toBe(overlay());

    press(overlay(), win, 'F2');

    expect(settingsManager.getCodesForAction(action.id)).toContain('F2');
    expect(onToggleDiagnostics).not.toHaveBeenCalled();
  });

  it('closes on Escape once: hidden, off the stack, onClose once', () => {
    modal.open();

    press(overlay(), win, 'Escape');

    expect(modal.isOpen).toBe(false);
    expect(overlay().style.display).toBe('none');
    expect(input.modalStack.isEmpty()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The stack clears isOpen before it calls close(); the window must still hide.
  it('hides its window when the modal stack closes it', () => {
    modal.open();

    input.modalStack.closeAll();

    expect(overlay().style.display).toBe('none');
    expect(modal.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    modal.open();
    expect(overlay().style.display).toBe('flex');
    expect(input.modalStack.getStackIds()).toEqual(['settings']);
  });
});
