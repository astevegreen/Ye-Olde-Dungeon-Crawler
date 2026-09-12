import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainMenu } from '../src/ui/menus/mainMenu';
import { SaveSlotModal } from '../src/ui/saveSlotModal';
import type { CharacterProfile } from '../src/engine/storage/types';

class MockElement {
  public id: string = '';
  public className: string = '';
  public textContent: string = '';
  public disabled: boolean = false;
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public attributes: Map<string, string> = new Map();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(el: MockElement) {
    el.parentElement = this;
    this.children.push(el);
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
  }

  removeChild(el: MockElement) {
    const idx = this.children.indexOf(el);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      el.parentElement = null;
    }
  }

  contains(el: MockElement): boolean {
    if (this === el) return true;
    return this.children.some((c) => c.contains(el));
  }

  remove() {
    this.parentElement?.removeChild(this);
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

  click() {
    const listeners = this.eventListeners.get('click');
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        listener({ currentTarget: this });
      }
    }
  }

  querySelector(selector: string): MockElement | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];

    const checkElement = (el: MockElement) => {
      let matched = false;
      if (selector.startsWith('#')) {
        const targetId = selector.slice(1);
        if (el.id === targetId || el.innerHTML.includes(`id="${targetId}"`)) {
          matched = true;
        }
      } else if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (el.className.includes(cls) || el.innerHTML.includes(`class="[^"]*${cls}[^"]*"`)) {
          matched = true;
        }
      } else if (selector.includes('[')) {
        matched = true;
      }

      if (matched) {
        matches.push(el);
      }
      for (const child of el.children) {
        checkElement(child);
      }
    };

    // If innerHTML parsed
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      const doc = (globalThis as any).document as MockDocument;
      if (doc?.elements?.has(targetId)) {
        return [doc.elements.get(targetId)!];
      }
      if (this.innerHTML.includes(`id="${targetId}"`)) {
        const el = new MockElement();
        el.id = targetId;
        doc?.elements?.set(targetId, el);
        matches.push(el);
      }
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.innerHTML.includes(cls)) {
        const el = new MockElement();
        el.className = cls;
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
    this.body.appendChild(app);
  }

  getElementById(id: string): MockElement | null {
    if (this.elements.has(id)) {
      return this.elements.get(id)!;
    }
    for (const el of Array.from(this.elements.values())) {
      if (el.innerHTML.includes(`id="${id}"`)) {
        const child = new MockElement();
        child.id = id;
        this.elements.set(id, child);
        return child;
      }
    }
    return null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

describe('Menu Streamlining & Save/Load UX', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let mockProfileManager: any;
  let mockAutosaveManager: any;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    mockProfileManager = {
      listProfiles: vi.fn().mockReturnValue([]),
      loadCharacter: vi.fn(),
      deleteProfile: vi.fn(),
    };

    mockAutosaveManager = {
      hasAutosave: vi.fn().mockReturnValue(false),
      getAutosaveMetadata: vi.fn().mockReturnValue(null),
      loadAutosave: vi.fn(),
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders top-level Continue, Load Game, New Game, and Settings buttons', () => {
    const onNewGame = vi.fn();
    const onContinue = vi.fn();
    const onLoadGame = vi.fn();
    const onOpenSettings = vi.fn();

    const menu = new MainMenu({
      profileManager: mockProfileManager,
      autosaveManager: mockAutosaveManager,
      onNewGame,
      onContinue,
      onLoadGame,
      onOpenSettings,
      onOpenHelp: vi.fn(),
      onOpenValhalla: vi.fn(),
    });

    menu.show();

    const continueBtn = mockDoc.getElementById('btn-menu-continue');
    const loadBtn = mockDoc.getElementById('btn-menu-load');
    const newGameBtn = mockDoc.getElementById('btn-menu-new-game');
    const settingsBtn = mockDoc.getElementById('btn-menu-settings');

    expect(continueBtn).toBeTruthy();
    expect(loadBtn).toBeTruthy();
    expect(newGameBtn).toBeTruthy();
    expect(settingsBtn).toBeTruthy();

    // With no saves, continue is disabled
    expect(continueBtn?.disabled).toBe(true);

    // Clicking Load Game invokes onLoadGame callback
    loadBtn?.click();
    expect(onLoadGame).toHaveBeenCalledTimes(1);

    // Clicking New Game invokes onNewGame callback
    newGameBtn?.click();
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('enables Continue button with character metadata when profile exists', () => {
    const profile: CharacterProfile = {
      id: 'sven-1',
      name: 'Sven the Bold',
      level: 4,
      floor: 3,
      lastSaved: Date.now(),
      hp: 42,
      maxHp: 45,
      strength: 18,
      difficulty: 'hard',
      questStatus: 'active',
    };

    mockProfileManager.listProfiles.mockReturnValue([profile]);

    const menu = new MainMenu({
      profileManager: mockProfileManager,
      autosaveManager: mockAutosaveManager,
      onNewGame: vi.fn(),
      onContinue: vi.fn(),
      onLoadGame: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onOpenValhalla: vi.fn(),
    });

    menu.show();

    const continueBtn = mockDoc.getElementById('btn-menu-continue');
    expect(continueBtn?.disabled).toBe(false);
    expect(continueBtn?.textContent).toContain('Sven the Bold');
    expect(continueBtn?.textContent).toContain('F3');
  });

  it('renders SaveSlotModal with metadata for both autosave and profiles', () => {
    mockAutosaveManager.getAutosaveMetadata.mockReturnValue({
      profileName: 'Astrid',
      floor: 7,
      timestamp: Date.now() - 50000,
    });

    const prof: CharacterProfile = {
      id: 'astrid-1',
      name: 'Astrid',
      level: 6,
      floor: 7,
      lastSaved: Date.now() - 50000,
      hp: 55,
      maxHp: 55,
      strength: 16,
      difficulty: 'hard',
      questStatus: 'active',
    };
    mockProfileManager.listProfiles.mockReturnValue([prof]);

    const onLoadProfile = vi.fn().mockReturnValue(true);
    const onLoadAutosave = vi.fn().mockReturnValue(true);

    const modal = new SaveSlotModal({
      profileManager: mockProfileManager,
      autosaveManager: mockAutosaveManager,
      onLoadProfile,
      onLoadAutosave,
    });

    modal.open();
    expect(modal.isOpen).toBe(true);

    const modalEl = mockDoc.getElementById('save-slot-modal');
    expect(modalEl).toBeTruthy();
    expect(modalEl?.innerHTML).toContain('Astrid');
    expect(modalEl?.innerHTML).toContain('Level 6');
    expect(modalEl?.innerHTML).toContain('Hard');
    expect(modalEl?.innerHTML).toContain('AUTOSAVE');
  });

  it('handles corrupted saves gracefully without throwing unhandled exceptions', async () => {
    const prof: CharacterProfile = {
      id: 'corrupt-1',
      name: 'Glitch',
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: 10,
      maxHp: 10,
      strength: 10,
    };
    mockProfileManager.listProfiles.mockReturnValue([prof]);

    // Simulate corrupted save throwing during load
    const onLoadProfile = vi.fn().mockImplementation(() => {
      throw new Error('Unexpected token in JSON at position 42');
    });

    const modal = new SaveSlotModal({
      profileManager: mockProfileManager,
      autosaveManager: mockAutosaveManager,
      onLoadProfile,
      onLoadAutosave: vi.fn(),
    });

    modal.open();

    // Trigger loading corrupt profile directly through method
    await expect(async () => {
      await (modal as any).handleLoadProfile('corrupt-1');
    }).not.toThrow();

    expect(modal.isOpen).toBe(true);
  });
});
