import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, Player, TILES, type CharacterProfile, type ProfileManager } from '../../engine';
import { InputHandler } from '../../rendering/input-handler';
import { SaveQuitModal } from '../saveQuitModal';

class MockEventTarget {
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

class MockElement extends MockEventTarget {
  public id = '';
  public className = '';
  public innerHTML = '';
  public textContent = '';
  public style: Record<string, string> = {};
  private readonly children = new Map<string, MockElement>();

  querySelector(selector: string): MockElement {
    if (!this.children.has(selector)) this.children.set(selector, new MockElement());
    return this.children.get(selector)!;
  }

  click(): void {
    this.dispatchEvent({ type: 'click' });
  }

  remove(): void {}
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
 * Save & Quit opens only in game, so it takes keys only through the modal stack, which
 * InputHandler's window listener routes to (ARCHITECTURE.md §6). Its own window listener
 * was a second path that delivered every key to handleKeyDown twice.
 */
describe('SaveQuitModal input', () => {
  let win: MockEventTarget;
  let originalWindow: unknown;
  let originalDocument: unknown;
  let input: InputHandler;
  let engine: GameEngine;
  let modal: SaveQuitModal;
  let onResume: ReturnType<typeof vi.fn<() => void>>;
  const profile = { id: 'hero', name: 'Hero' } as CharacterProfile;

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    win = new MockEventTarget();
    (globalThis as any).window = win;
    let modalEl: MockElement | null = null;
    (globalThis as any).document = {
      getElementById: (id: string) => (modalEl?.id === id ? modalEl : null),
      createElement: () => new MockElement(),
      body: { appendChild: (el: MockElement) => (modalEl = el) },
    };

    engine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player: new Player({ position: { x: 5, y: 5 }, stats: { hp: 20, maxHp: 20, attack: 3, defense: 1 } }),
    });
    input = new InputHandler(engine, vi.fn());

    // Wired as main.ts wires it: onResume removes the stack entry.
    onResume = vi.fn(() => {
      input.modalStack.remove('save-quit');
    });
    modal = new SaveQuitModal({
      profileManager: {} as ProfileManager,
      onSaveAndExit: vi.fn(),
      onResume,
    });
  });

  afterEach(() => {
    input.destroy();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  const openAsMainDoes = () => {
    modal.open(engine, profile);
    input.modalStack.push(modal);
  };
  const overlay = () => (globalThis as any).document.getElementById('save-quit-modal') as MockElement;

  it('holds one stack entry and adds no window keydown listener of its own', () => {
    openAsMainDoes();

    expect(input.modalStack.getStackIds()).toEqual(['save-quit']);
    expect(win.listenerCount('keydown')).toBe(1); // InputHandler's
  });

  it('delivers each key to handleKeyDown once and keeps it from the simulation', () => {
    openAsMainDoes();
    const handle = vi.spyOn(modal, 'handleKeyDown');
    const turn = engine.turnCount;

    win.dispatchEvent(keydown('KeyW', 'w'));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(engine.turnCount).toBe(turn);
    expect(modal.isOpen).toBe(true);
  });

  it('closes on one Escape, resumes once, and leaves the stack empty', () => {
    openAsMainDoes();
    const handle = vi.spyOn(modal, 'handleKeyDown');

    win.dispatchEvent(keydown('Escape'));

    expect(handle).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(overlay().style.display).toBe('none');
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  it('resumes once when the Resume button closes it', () => {
    openAsMainDoes();

    overlay().querySelector('#btn-savequit-resume').click();

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(input.modalStack.isEmpty()).toBe(true);
  });

  // The stack clears isOpen before it calls close(); the window must still hide.
  it('hides its window when the modal stack closes it', () => {
    openAsMainDoes();

    input.modalStack.closeAll();

    expect(overlay().style.display).toBe('none');
    expect(modal.isOpen).toBe(false);
    expect(onResume).toHaveBeenCalledTimes(1);

    openAsMainDoes();
    expect(overlay().style.display).toBe('flex');
    expect(input.modalStack.getStackIds()).toEqual(['save-quit']);
  });
});
