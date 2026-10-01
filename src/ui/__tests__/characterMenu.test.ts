import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CharacterMenuModal } from '../characterMenu/characterMenuModal';
import { CharacterTab } from '../characterMenu/characterTab';
import type { MenuTab } from '../characterMenu/menuTab';
import type { GameState } from '../characterMenu/gameState';
import { ModalStackManager } from '../modalStack';
import { InputHandler } from '../../rendering/input-handler';
import { GameEngine, Player, GameMap } from '../../engine';
import { SpellbookTab } from '../characterMenu/spellbookTab';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public textContent: string = '';
  public disabled: boolean = false;
  public parentElement: MockElement | null = null;
  public children: MockElement[] = [];
  public attributes: Record<string, string> = {};
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  appendChild(el: MockElement): MockElement {
    el.parentElement = this;
    this.children.push(el);
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
    return el;
  }

  removeChild(el: MockElement): MockElement {
    const idx = this.children.indexOf(el);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      el.parentElement = null;
    }
    return el;
  }

  addEventListener(type: string, listener: (e?: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  public clientWidth: number = 0;
  public clientHeight: number = 0;
  public mockRect: { left: number; top: number; width: number; height: number } | null = null;

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return this.mockRect ?? { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  contains(el: MockElement): boolean {
    if (this === el) return true;
    for (const child of this.children) {
      if (child === el || child.contains(el)) return true;
    }
    return false;
  }

  removeEventListener(type: string, listener: (e?: any) => void): void {
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
      const found = (globalThis as any).document?.elements?.get(targetId);
      if (found) matches.push(found);
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      for (const child of this.children) {
        if (child.className.includes(cls)) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
    } else if (selector === 'button' || selector.includes('button')) {
      for (const child of this.children) {
        matches.push(child);
        matches.push(...child.querySelectorAll(selector));
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
    return this.elements.get(id) ?? null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

class MockTab implements MenuTab {
  public id: string;
  public label: string;
  public hotkeyActionId?: string;
  public mounted = false;
  public activatedState: GameState | null = null;
  public unmounted = false;
  public handledKeys: string[] = [];
  public claimsTabKey?: boolean;
  public lastEntry?: 'forward' | 'backward';

  constructor(id: string, label: string, hotkeyActionId?: string) {
    this.id = id;
    this.label = label;
    this.hotkeyActionId = hotkeyActionId;
  }

  mount(_container: HTMLElement): void {
    this.mounted = true;
    this.unmounted = false;
  }

  onActivate(state: GameState, entry?: 'forward' | 'backward'): void {
    this.activatedState = state;
    this.lastEntry = entry;
  }

  unmount(): void {
    this.unmounted = true;
    this.mounted = false;
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    if (this.handledKeys.includes(e.code) || this.handledKeys.includes(e.key)) {
      return true;
    }
    return false;
  }
}

function createTestEngine(customManifest?: any): GameEngine {
  const map = new GameMap(20, 20);
  const player = new Player({ position: { x: 5, y: 5 } });
  return new GameEngine({
    map,
    player,
    seed: 1337,
    manifest: customManifest ?? {
      id: 'test_manifest',
      name: 'Test Manifest',
      monsters: [],
      items: [],
      spells: [],
    },
  });
}

function createMockGameState(engine?: GameEngine): GameState {
  const eng = engine ?? createTestEngine();
  return {
    engine: eng,
    worldState: eng.worldState,
    player: eng.player,
    map: eng.map,
    currentFloor: eng.currentFloor,
    turnCount: eng.turnCount,
    manifest: eng.manifest,
    pacts: eng.pacts,
  };
}

function makeKey(key: string, code?: string, shiftKey: boolean = false): KeyboardEvent {
  return {
    key,
    code: code ?? key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('CharacterMenuModal & Consolidated Character Menu', () => {
  let modalStack: ModalStackManager;
  let tab1: MockTab;
  let tab2: MockTab;
  let tab3: MockTab;
  let menu: CharacterMenuModal;
  let engine: GameEngine;
  let originalDocument: any;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = new MockDocument();

    engine = createTestEngine();
    modalStack = new ModalStackManager();
    tab1 = new MockTab('inventory', 'Inventory', 'inventory');
    tab2 = new MockTab('character', 'Character', 'character_menu');
    tab3 = new MockTab('spellbook', 'Spellbook', 'cast_spell');
    menu = new CharacterMenuModal([tab1, tab2, tab3], () => createMockGameState(engine));
    menu.setModalStack(modalStack);
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('pushes and pops correctly on ModalStackManager', () => {
    expect(menu.isOpen).toBe(false);
    expect(modalStack.isEmpty()).toBe(true);

    menu.open('inventory');
    modalStack.push(menu);

    expect(menu.isOpen).toBe(true);
    expect(modalStack.top()?.id).toBe(menu.id);
    expect(menu.activeTabId).toBe('inventory');
    expect(tab1.mounted).toBe(true);
    expect(tab1.activatedState).not.toBeNull();

    menu.close();
    expect(menu.isOpen).toBe(false);
    expect(tab1.unmounted).toBe(true);
    expect(modalStack.isEmpty()).toBe(true);
  });

  it('Escape closes the shell and unmounts the active tab', () => {
    menu.open('character');
    modalStack.push(menu);
    expect(menu.activeTabId).toBe('character');
    expect(tab2.mounted).toBe(true);

    const escEvent = makeKey('Escape', 'Escape');
    const handled = menu.handleKeyDown(escEvent);

    expect(handled).toBe(true);
    expect(menu.isOpen).toBe(false);
    expect(tab2.unmounted).toBe(true);
  });

  it('Tab and Shift+Tab cycle tabs with wrap-around at both ends', () => {
    menu.open('inventory');

    // 1. Forward cycle
    const tabForward = makeKey('Tab', 'Tab', false);
    menu.handleKeyDown(tabForward);
    expect(menu.activeTabId).toBe('character');
    expect(tab1.unmounted).toBe(true);
    expect(tab2.mounted).toBe(true);

    menu.handleKeyDown(tabForward);
    expect(menu.activeTabId).toBe('spellbook');
    expect(tab2.unmounted).toBe(true);
    expect(tab3.mounted).toBe(true);

    // Wraps back to first tab
    menu.handleKeyDown(tabForward);
    expect(menu.activeTabId).toBe('inventory');

    // 2. Backward cycle with Shift+Tab (wraps to last tab)
    const tabBackward = makeKey('Tab', 'Tab', true);
    menu.handleKeyDown(tabBackward);
    expect(menu.activeTabId).toBe('spellbook');

    menu.handleKeyDown(tabBackward);
    expect(menu.activeTabId).toBe('character');
  });

  it('a tab that claims Tab keeps it until it declines, then Tab moves on to the next tab', () => {
    tab1.claimsTabKey = true;
    tab1.handledKeys = ['Tab']; // still panels to step through
    menu.open('inventory');

    expect(menu.handleKeyDown(makeKey('Tab', 'Tab', false))).toBe(true);
    expect(menu.activeTabId).toBe('inventory');

    tab1.handledKeys = []; // on its last panel, it declines
    menu.handleKeyDown(makeKey('Tab', 'Tab', false));
    expect(menu.activeTabId).toBe('character');

    // Tabs that do not claim it cycle as before.
    menu.handleKeyDown(makeKey('Tab', 'Tab', false));
    expect(menu.activeTabId).toBe('spellbook');
  });

  it('active tab gets first refusal; unhandled keys do not leak through to simulation', () => {
    tab1.handledKeys = ['KeyX'];
    menu.open('inventory');

    // Consumed by active tab
    const handledEvent = makeKey('x', 'KeyX');
    expect(menu.handleKeyDown(handledEvent)).toBe(true);

    // Declined by active tab, not a navigation key -> trapped by shell (returns true, prevents leak)
    const randomEvent = makeKey('w', 'KeyW');
    expect(menu.handleKeyDown(randomEvent)).toBe(true);
  });

  it('hotkey navigation switches directly to target tab or toggles active tab', () => {
    menu.open('inventory');

    // Press KeyE -> switches to Character tab
    const keyE = makeKey('e', 'KeyE');
    menu.handleKeyDown(keyE);
    expect(menu.activeTabId).toBe('character');

    // Press KeyE again -> toggles/closes the menu
    menu.handleKeyDown(keyE);
    expect(menu.isOpen).toBe(false);
  });

  it('fills the window for every tab, the inventory included', () => {
    const doc = (globalThis as any).document;
    const overlay = doc.getElementById('character-menu-modal');
    const win = overlay?.querySelector('.character-menu-window');
    menu.open('character');
    menu.activateTab('inventory');
    // The stylesheet sizes the window (full window less the margin); nothing inline.
    expect(overlay?.className).toBe('cm-overlay is-open');
    expect(win?.style.width ?? '').toBe('');
    expect(win?.style.height ?? '').toBe('');
  });

  it('owns the chrome: key chips, a badge, and a footer with the tab\'s keys and actions', () => {
    const run = vi.fn();
    (tab2 as MenuTab).badge = () => '+9';
    (tab2 as MenuTab).footer = () => ({
      keys: [{ keys: ['S', 'D'], label: 'plan a point' }],
      escLabel: 'close, keep points',
      actions: [{ id: 'accept', label: 'Accept 3 points', key: 'Enter', primary: true, run }],
    });
    menu.open('character');

    const doc = (globalThis as any).document;
    const win = doc.getElementById('character-menu-modal')?.querySelector('.character-menu-window');
    const nav = win?.querySelector('.character-menu-tabs');
    const footer = win?.querySelector('.cm-foot');
    const tabHtml = nav?.children.map((c: MockElement) => c.innerHTML).join('');
    expect(tabHtml).toContain('<span class="ui-key">E</span><span>Character</span><span class="cm-badge">+9</span>');
    expect(tabHtml).toContain('<span class="ui-key">I</span><span>Inventory</span>');
    expect(footer?.innerHTML).toContain('plan a point');
    expect(footer?.innerHTML).toContain('next tab');
    expect(footer?.innerHTML).toContain('close, keep points');
    expect(footer?.innerHTML).toContain('Accept 3 points');
  });

  it('Shift+Tab tells the tab it arrived backwards, so a tab with panels starts on its last', () => {
    menu.open('character');
    menu.handleKeyDown(makeKey('Tab', 'Tab', true));
    expect(menu.activeTabId).toBe('inventory');
    expect(tab1.lastEntry).toBe('backward');
    menu.handleKeyDown(makeKey('Tab', 'Tab', false));
    expect(tab2.lastEntry).toBe('forward');
  });

  it('follows rebound keys for its tab hotkeys', () => {
    menu.setKeyResolver((id) => (id === 'cast_spell' ? ['KeyQ'] : []));
    menu.open('inventory');
    menu.handleKeyDown(makeKey('q', 'KeyQ'));
    expect(menu.activeTabId).toBe('spellbook');
    // Unbound actions keep their default keys.
    menu.handleKeyDown(makeKey('e', 'KeyE'));
    expect(menu.activeTabId).toBe('character');
  });

  it('the Spellbook tab leaves Z to the shell, which closes the menu on its own tab key', () => {
    const spellbookTab = new SpellbookTab();
    const otherTab = new MockTab('character', 'Character', 'character_menu');
    const charMenu = new CharacterMenuModal([spellbookTab, otherTab], () => createMockGameState(engine));

    charMenu.open('spellbook');
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('spellbook');

    // Re-pressing KeyZ toggles the whole shell closed
    const keyZEvent = makeKey('z', 'KeyZ');
    const handledZ = charMenu.handleKeyDown(keyZEvent);
    expect(handledZ).toBe(true);
    expect(charMenu.isOpen).toBe(false);
  });
});

describe('CharacterTab stat allocation and attribute milestone surfacing', () => {
  let originalDocument: any;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = new MockDocument();
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders attributes, derived stats, and surfaces attribute milestones', () => {
    const manifestWithMilestones = {
      id: 'test_pack',
      name: 'Test Pack',
      monsters: [],
      items: [],
      spells: [],
      attributeMilestones: [
        { id: 'milestone_dex_15', attribute: 'dexterity' as const, threshold: 15, choiceId: 'c_dex' },
        { id: 'milestone_str_15', attribute: 'strength' as const, threshold: 15, choiceId: 'c_str' },
      ],
      choices: {
        c_dex: { id: 'c_dex', title: 'Dexterity Choice', description: 'Test', options: [{ id: 'opt1', label: 'Option 1', consequences: [] }] },
        c_str: { id: 'c_str', title: 'Strength Choice', description: 'Test', options: [{ id: 'opt2', label: 'Option 2', consequences: [] }] },
      },
    };
    const engine = createTestEngine(manifestWithMilestones);
    engine.player.strength = 14;
    engine.player.dexterity = 15;
    engine.player.unspentStatPoints = 2;

    const charTab = new CharacterTab();
    const container = new MockElement() as unknown as HTMLElement;
    charTab.mount(container);

    const state = createMockGameState(engine);
    state.manifest = manifestWithMilestones as any;
    charTab.onActivate(state);

    expect(container.innerHTML).toContain('Strength');
    expect(container.innerHTML).toContain('Dexterity');
    expect(container.innerHTML).toContain('points left to spend');
    // Previews come from the engine's formulas: 2.5 kg of carry per Strength
    expect(container.innerHTML).toContain('Carry 35 kg');
    // DEX 15 is at threshold -> Ready
    expect(container.innerHTML).toContain('<span class="ch-tag">Ready</span>');
    // STR 14 is below threshold -> Locked
    expect(container.innerHTML).toContain('<span class="ch-tag">Locked</span>');
    expect(container.innerHTML).toContain('Progress: 14 / 15');

    // Number keys do not allocate attributes (prevents accidental movement allocations)
    const key1 = makeKey('1', 'Digit1');
    expect(charTab.handleKeyDown(key1)).toBe(false);
    expect(engine.player.strength).toBe(14);
    expect(engine.player.unspentStatPoints).toBe(2);

    // Letter hotkey 'S' only plans a point; the player is untouched until accepted
    const keyS = makeKey('s', 'KeyS');
    const handled = charTab.handleKeyDown(keyS);
    expect(handled).toBe(true);
    expect(engine.player.strength).toBe(14);
    expect(engine.player.unspentStatPoints).toBe(2);
    expect(container.innerHTML).toContain('Carry 35 → <span class="ui-up">37.5 kg</span>');
    expect(container.innerHTML).toContain('If you accept');

    // Enter locks the planned point in
    expect(charTab.handleKeyDown(makeKey('Enter', 'Enter'))).toBe(true);
    expect(engine.player.strength).toBe(15);
    expect(engine.player.unspentStatPoints).toBe(1);

    // Locked-in points cannot be taken back; Enter with nothing planned falls through to the shell
    expect(charTab.deallocate('strength')).toBe(false);
    expect(charTab.handleKeyDown(makeKey('Enter', 'Enter'))).toBe(false);

    // After re-render, strength milestone is now Ready to Unlock
    expect(container.innerHTML).toContain('Strength ≥ 15');
  });

  it('keeps character sheet reachable even at 0 unspent points without error', () => {
    const engine = createTestEngine();
    engine.player.unspentStatPoints = 0;

    const charTab = new CharacterTab();
    const container = new MockElement() as unknown as HTMLElement;
    charTab.mount(container);
    charTab.onActivate(createMockGameState(engine));

    expect(container.innerHTML).toContain('You earn more each time you level up.');

    // Pressing allocation hotkey does nothing when 0 points available
    const keyS = makeKey('S', 'KeyS');
    expect(charTab.handleKeyDown(keyS)).toBe(false);
  });
});

describe('InputHandler legacy keybind routing to Consolidated Character Menu', () => {
  let originalDocument: any;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = new MockDocument();
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('opens expected tab for each legacy hotkey', () => {
    const engine = createTestEngine();
    const inputHandler = new InputHandler(engine, () => {});

    const inventoryTab = new MockTab('inventory', 'Inventory');
    const charTab = new MockTab('character', 'Character');
    const spellTab = new MockTab('spellbook', 'Spellbook');
    const bestiaryTab = new MockTab('bestiary', 'Bestiary');
    const pactsTab = new MockTab('pacts', 'Pacts');
    const storyTab = new MockTab('story', 'Story', 'story');

    const charMenu = new CharacterMenuModal([inventoryTab, charTab, spellTab, bestiaryTab, pactsTab, storyTab]);
    charMenu.setModalStack(inputHandler.modalStack);
    inputHandler.characterMenuModal = charMenu;

    // KeyE -> opens character tab
    inputHandler.handleKeyDown(makeKey('e', 'KeyE'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('character');
    expect(inputHandler.modalStack.top()?.id).toBe(charMenu.id);

    charMenu.close();

    // KeyI -> opens inventory tab
    inputHandler.handleKeyDown(makeKey('i', 'KeyI'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('inventory');

    charMenu.close();

    // KeyZ -> opens spellbook tab
    inputHandler.handleKeyDown(makeKey('z', 'KeyZ'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('spellbook');

    charMenu.close();

    // KeyB -> opens bestiary tab
    inputHandler.handleKeyDown(makeKey('b', 'KeyB'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('bestiary');

    charMenu.close();

    // KeyP -> opens pacts tab
    inputHandler.handleKeyDown(makeKey('p', 'KeyP'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('pacts');

    charMenu.close();

    // KeyO -> opens story tab
    inputHandler.handleKeyDown(makeKey('o', 'KeyO'));
    expect(charMenu.isOpen).toBe(true);
    expect(charMenu.activeTabId).toBe('story');
  });
});
