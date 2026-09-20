import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeybindModal } from '../settings/keybindModal';
import { SettingsManager } from '../settings/settingsManager';
import { MemoryStorage } from '../../engine';

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  public textContent = '';
  public checked = false;
  public value = '';
  public attributes: Record<string, string> = {};
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();
  public children: MockElement[] = [];

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
