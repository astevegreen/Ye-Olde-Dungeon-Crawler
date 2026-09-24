import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChoiceModal } from '../choiceModal';
import { InputHandler } from '../../rendering/input-handler';
import { GameEngine } from '../../engine';
import { Player } from '../../engine';
import { GameMap } from '../../engine';
import { TILES } from '../../engine';
import type { ChoiceDefinition } from '../../engine';

class MockElement {
  public id: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

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
        listener();
      }
    }
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body = {
    appendChild: (el: MockElement) => {
      if (el.id) this.elements.set(el.id, el);
    },
  };

  getElementById(id: string): MockElement | null {
    if (this.elements.has(id)) {
      return this.elements.get(id)!;
    }
    for (const el of this.elements.values()) {
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

describe('ChoiceModal UI Component', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    const map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player, floor: 3 });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders modal with title, narrative text, and options', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'altar_tyr',
      title: 'Ancient Altar of Tyr',
      description: 'You stand before a sacred runic altar.',
      options: [
        {
          id: 'purify',
          label: 'Purify with Holy Waters',
          consequences: [],
        },
        {
          id: 'desecrate',
          label: 'Desecrate for Dark Power',
          consequences: [],
        },
      ],
    };

    const onSelect = vi.fn();
    const onCancel = vi.fn();

    modal.open(choice, engine, onSelect, onCancel);

    expect(modal.isOpen).toBe(true);
    const overlay = mockDoc.getElementById('choice-modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('flex');
    expect(overlay?.innerHTML).toContain('Ancient Altar of Tyr');
    expect(overlay?.innerHTML).toContain('Purify with Holy Waters');
    expect(overlay?.innerHTML).toContain('Desecrate for Dark Power');

    // Click option 1
    const optRow = mockDoc.getElementById('choice-opt-purify');
    expect(optRow).not.toBeNull();
    optRow?.click();

    expect(onSelect).toHaveBeenCalledWith('purify');
    expect(modal.isOpen).toBe(false);
  });

  it('renders disabled options with reason when predicate fails', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'locked_choice',
      title: 'Locked Vault Choice',
      description: 'Choose to open.',
      options: [
        {
          id: 'unlocked_opt',
          label: 'Normal Choice',
          consequences: [],
        },
        {
          id: 'locked_opt',
          label: 'Secret Option',
          disabledReason: 'Requires 10 Temple Standing',
          predicate: { type: 'minFaction', faction: 'temple_standing', value: 10 },
          consequences: [],
        },
      ],
    };

    modal.open(choice, engine, vi.fn(), vi.fn());

    const overlay = mockDoc.getElementById('choice-modal-overlay');
    expect(overlay?.innerHTML).toContain('Requires 10 Temple Standing');
    expect(overlay?.innerHTML).toContain('text-decoration: line-through');
  });

  it('handles cancellation via close button', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'test_choice',
      title: 'Test',
      description: 'Desc',
      options: [{ id: 'opt1', label: 'Opt 1', consequences: [] }],
      cancelable: true,
    };

    const onSelect = vi.fn();
    const onCancel = vi.fn();

    modal.open(choice, engine, onSelect, onCancel);

    const cancelBtn = mockDoc.getElementById('btn-choice-cancel');
    expect(cancelBtn).not.toBeNull();
    cancelBtn?.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(modal.isOpen).toBe(false);
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

const keydown = (code: string, key = code) => ({
  type: 'keydown',
  code,
  key,
  repeat: false,
  target: null,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

/**
 * A choice opens only in game, so it takes keys only through the modal stack, which
 * InputHandler's window listener routes to (ARCHITECTURE.md §6). Its own window listener
 * was a second path, and because the stack entry had no handleKeyDown, the stack's default
 * Escape pop closed every choice — even one that cannot be cancelled — without onCancel.
 */
describe('ChoiceModal input through the modal stack', () => {
  let win: MockWindow;
  let originalWindow: unknown;
  let originalDocument: unknown;
  let input: InputHandler;
  let engine: GameEngine;
  let modal: ChoiceModal;
  let closed: ReturnType<typeof vi.fn<() => void>>;
  let onSelect: ReturnType<typeof vi.fn<(optionId: string) => void>>;
  let onCancel: ReturnType<typeof vi.fn<() => void>>;

  const choice = (cancelable: boolean): ChoiceDefinition => ({
    id: 'crossroads',
    title: 'Crossroads',
    description: 'Pick a road.',
    options: [
      { id: 'left', label: 'Left', consequences: [] },
      { id: 'right', label: 'Right', consequences: [] },
    ],
    cancelable,
  });

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    win = new MockWindow();
    (globalThis as any).window = win;
    (globalThis as any).document = new MockDocument();

    engine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player: new Player({ position: { x: 5, y: 5 }, stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 } }),
    });
    input = new InputHandler(engine, vi.fn());

    // Wired as main.ts wires it: the closed callback removes the stack entry.
    closed = vi.fn(() => {
      input.modalStack.remove('choice');
    });
    modal = new ChoiceModal(closed);
    onSelect = vi.fn<(optionId: string) => void>();
    onCancel = vi.fn<() => void>();
  });

  afterEach(() => {
    input.destroy();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  const openAsMainDoes = (cancelable: boolean) => {
    modal.open(choice(cancelable), engine, onSelect, onCancel);
    input.modalStack.push(modal);
  };
  const overlay = () => (globalThis as any).document.getElementById('choice-modal-overlay') as MockElement;

  it('holds one stack entry and adds no window keydown listener of its own', () => {
    openAsMainDoes(true);

    expect(input.modalStack.getStackIds()).toEqual(['choice']);
    expect(win.listenerCount('keydown')).toBe(1); // InputHandler's
  });

  it('selects once on a number key, delivered to handleKeyDown once', () => {
    openAsMainDoes(true);
    const handle = vi.spyOn(modal, 'handleKeyDown');

    win.dispatchEvent(keydown('Digit2', '2'));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('right');
    expect(closed).toHaveBeenCalledTimes(1);
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  it('moves focus with the arrows and selects the focused option on Enter', () => {
    openAsMainDoes(true);

    win.dispatchEvent(keydown('ArrowDown'));
    expect(onSelect).not.toHaveBeenCalled();
    win.dispatchEvent(keydown('Enter'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('right');
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  it('cancels a cancelable choice on Escape through its onCancel, once', () => {
    openAsMainDoes(true);

    win.dispatchEvent(keydown('Escape'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(overlay().style.display).toBe('none');
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  it('keeps a choice that cannot be cancelled open on Escape', () => {
    openAsMainDoes(false);

    win.dispatchEvent(keydown('Escape'));

    expect(onCancel).not.toHaveBeenCalled();
    expect(modal.isOpen).toBe(true);
    expect(overlay().style.display).toBe('flex');
    expect(input.modalStack.getStackIds()).toEqual(['choice']);

    win.dispatchEvent(keydown('Digit1', '1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('left');
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  it('keeps gameplay keys from the simulation while open', () => {
    openAsMainDoes(true);
    const turn = engine.turnCount;
    const pos = { x: engine.player.x, y: engine.player.y };

    win.dispatchEvent(keydown('KeyL', 'l'));
    win.dispatchEvent(keydown('Period', '.'));

    expect(engine.turnCount).toBe(turn);
    expect({ x: engine.player.x, y: engine.player.y }).toEqual(pos);
    expect(modal.isOpen).toBe(true);
  });

  // The stack clears isOpen before it calls close(); the overlay must still hide.
  it('hides when the modal stack closes it, running the closed callback once', () => {
    openAsMainDoes(true);

    input.modalStack.closeAll();

    expect(overlay().style.display).toBe('none');
    expect(modal.isOpen).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
