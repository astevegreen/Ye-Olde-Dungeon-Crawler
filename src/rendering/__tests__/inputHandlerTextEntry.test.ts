import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { GameEngine, GameMap, Player } from '../../engine';

/** Stand-in for a focused <input>/<textarea>; InputHandler only inspects tagName/isContentEditable. */
const TEXTAREA = { tagName: 'TEXTAREA', isContentEditable: false };

function keyIn(code: string, key: string, target: unknown = TEXTAREA): KeyboardEvent {
  return { code, key, target, repeat: false, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
}

describe('InputHandler leaves typing in text fields alone', () => {
  let engine: GameEngine;
  let input: InputHandler;
  let onToggleDiagnostics: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }) });
    onToggleDiagnostics = vi.fn<() => void>();
    input = new InputHandler(engine, vi.fn(), undefined, undefined, undefined, undefined, onToggleDiagnostics);
    input.enabled = true;
  });
  afterEach(() => input.destroy());

  it.each([
    ['Space', ' '],
    ['ArrowLeft', 'ArrowLeft'],
    ['ArrowUp', 'ArrowUp'],
    ['Enter', 'Enter'],
  ])('%s keeps its default (caret movement, spaces, newlines)', (code, key) => {
    const e = keyIn(code, key);
    input.handleKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('typed characters never become game commands', () => {
    const turn = engine.turnCount;
    const pos = { x: engine.player.x, y: engine.player.y };
    for (const [code, key] of [['ArrowRight', 'ArrowRight'], ['Period', '.'], ['KeyL', 'l']]) {
      input.handleKeyDown(keyIn(code, key));
    }
    expect(engine.turnCount).toBe(turn);
    expect({ x: engine.player.x, y: engine.player.y }).toEqual(pos);
  });

  it('typing ~ or ` does not toggle the diagnostics overlay', () => {
    input.handleKeyDown(keyIn('Backquote', '~'));
    expect(onToggleDiagnostics).not.toHaveBeenCalled();
  });

  it('Escape still reaches the open modal so a form can be dismissed', () => {
    const modal = { id: 'form', isOpen: true, handleKeyDown: vi.fn(() => true), close: vi.fn() };
    input.modalStack.push(modal);
    input.handleKeyDown(keyIn('Escape', 'Escape'));
    expect(modal.handleKeyDown).toHaveBeenCalled();
  });

  it('outside text fields, navigation keys still suppress page scrolling', () => {
    const e = keyIn('Space', ' ', { tagName: 'BODY', isContentEditable: false });
    input.handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });
});
