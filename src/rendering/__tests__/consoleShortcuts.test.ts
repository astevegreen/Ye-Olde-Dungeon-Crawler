import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { GameEngine, GameMap, Player, MemoryStorage } from '../../engine';
import { SettingsManager } from '../../ui/settings/settingsManager';
import { CommandPalette } from '../../ui/help/commandPalette';

function key(code: string, mods: { shiftKey?: boolean; ctrlKey?: boolean } = {}): KeyboardEvent {
  return {
    code,
    key: code,
    repeat: false,
    shiftKey: mods.shiftKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('console shortcuts: potion row and command palette', () => {
  let engine: GameEngine;
  let inputHandler: InputHandler;

  beforeEach(() => {
    engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ position: { x: 5, y: 5 } }) });
    const settingsManager = new SettingsManager(new MemoryStorage());
    inputHandler = new InputHandler(
      engine, vi.fn(), undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, settingsManager
    );
    inputHandler.enabled = true;
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  it('Shift+1 drinks from potion slot 1 instead of casting spell slot 1', () => {
    const drink = vi.fn();
    const cast = vi.fn();
    inputHandler.onDrinkPotionSlot = drink;
    inputHandler.onTriggerQuickSpell = cast;

    expect(inputHandler.handleKeyDown(key('Digit1', { shiftKey: true }))).toBe(true);
    expect(drink).toHaveBeenCalledWith(0);
    expect(cast).not.toHaveBeenCalled();

    inputHandler.handleKeyDown(key('Digit1'));
    expect(cast).toHaveBeenCalledWith(0);
  });

  it('Ctrl+K and Shift+/ open the command palette, which then sits on the modal stack', () => {
    const palette = new CommandPalette();
    palette.setModalStack(inputHandler.modalStack);
    inputHandler.onToggleCommandPalette = () => palette.toggle(engine);

    inputHandler.handleKeyDown(key('KeyK', { ctrlKey: true }));
    expect(palette.isOpen).toBe(true);
    expect(inputHandler.modalStack.top()?.id).toBe('command-palette');

    // Keys go to the palette now, not the game.
    const move = vi.spyOn(engine, 'handlePlayerAction');
    inputHandler.handleKeyDown(key('ArrowLeft'));
    expect(move).not.toHaveBeenCalled();

    inputHandler.handleKeyDown(key('Escape'));
    expect(palette.isOpen).toBe(false);
    expect(inputHandler.modalStack.isEmpty()).toBe(true);

    inputHandler.handleKeyDown(key('Slash', { shiftKey: true }));
    expect(palette.isOpen).toBe(true);
    palette.close();
    expect(inputHandler.modalStack.isEmpty()).toBe(true);
  });
});
