import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { InputHandler } from '../input-handler';
import { RadialMenuOverlay, RADIAL_DIRECTIONS } from '../radialMenu';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { MovementAction } from '../../engine';
import { SettingsManager } from '../../ui/settings/settingsManager';
import { MemoryStorage } from '../../engine';
import { CommandPalette } from '../../ui/help/commandPalette';

function makeKeyEvent(code: string, repeat = false): KeyboardEvent {
  return {
    code,
    key: code,
    repeat,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('InputHandler <-> RadialMenuOverlay wiring', () => {
  let engine: GameEngine;
  let settingsManager: SettingsManager;
  let radialMenuOverlay: RadialMenuOverlay;
  let inputHandler: InputHandler;
  let onActionProcessed: Mock<() => void>;

  beforeEach(() => {
    const map = new GameMap(10, 10);
    const player = new Player({ position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player });
    settingsManager = new SettingsManager(new MemoryStorage());
    radialMenuOverlay = new RadialMenuOverlay();
    // An empty wheel doesn't open (R-rend-15), so the wiring tests start with one slot set.
    radialMenuOverlay.slots[RADIAL_DIRECTIONS.indexOf('W')] = { type: 'command', commandId: 'wait' };
    onActionProcessed = vi.fn();

    inputHandler = new InputHandler(
      engine,
      onActionProcessed,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settingsManager,
      radialMenuOverlay
    );
    inputHandler.enabled = true;
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  it('opens on the default trigger key and registers on the modal stack', () => {
    const handled = inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    expect(handled).toBe(true);
    expect(radialMenuOverlay.isOpen).toBe(true);
    expect(inputHandler.modalStack.has('radial-menu')).toBe(true);
  });

  // R-rend-15: nothing in the game fills a slot yet, so V opened eight empty wedges.
  it('does not open a wheel with every slot empty, and says so in the log', () => {
    radialMenuOverlay.slots.fill(null);
    const logged = vi.spyOn(engine, 'log');

    const handled = inputHandler.handleKeyDown(makeKeyEvent('KeyV'));

    expect(handled).toBe(true);
    expect(radialMenuOverlay.isOpen).toBe(false);
    expect(inputHandler.modalStack.has('radial-menu')).toBe(false);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  // R-rend-15: a blur closed the wheel's state but left it painted until the next render.
  it('a window blur closes the wheel and repaints, so it is not left on the canvas', () => {
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    onActionProcessed.mockClear();

    (inputHandler as unknown as { boundBlurHandler?: () => void }).boundBlurHandler?.();

    expect(radialMenuOverlay.isOpen).toBe(false);
    expect(inputHandler.modalStack.has('radial-menu')).toBe(false);
    expect(onActionProcessed).toHaveBeenCalled();
  });

  it('routes directional keys to wedge selection instead of movement while open', () => {
    const handleActionSpy = vi.spyOn(engine, 'handlePlayerAction');
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));

    const handled = inputHandler.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(handled).toBe(true);
    expect(radialMenuOverlay.getHoveredDirection()).toBe('E');
    expect(handleActionSpy).not.toHaveBeenCalledWith(expect.any(MovementAction));
  });

  it('Escape cancels without executing anything and closes the menu', () => {
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowUp'));

    const handled = inputHandler.handleKeyDown(makeKeyEvent('Escape'));
    expect(handled).toBe(true);
    expect(radialMenuOverlay.isOpen).toBe(false);
    expect(inputHandler.modalStack.has('radial-menu')).toBe(false);
  });

  it('confirmRadialMenu executes a hovered command slot and closes the menu', () => {
    const palette = new CommandPalette();
    const execute = vi.fn();
    palette.registerCommands([
      { id: 'wait', title: 'Wait', category: 'Action', shortcut: '.', description: 'Wait', execute },
    ]);
    inputHandler.commandPalette = palette;
    radialMenuOverlay.slots[RADIAL_DIRECTIONS.indexOf('S')] = { type: 'command', commandId: 'wait' };

    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowDown')); // S

    inputHandler.confirmRadialMenu();

    expect(execute).toHaveBeenCalledWith(engine);
    expect(radialMenuOverlay.isOpen).toBe(false);
    expect(inputHandler.modalStack.has('radial-menu')).toBe(false);
  });

  it('releasing the bound trigger key while open confirms the hovered slot end-to-end', () => {
    const palette = new CommandPalette();
    const execute = vi.fn();
    palette.registerCommands([
      { id: 'wait', title: 'Wait', category: 'Action', shortcut: '.', description: 'Wait', execute },
    ]);
    inputHandler.commandPalette = palette;
    radialMenuOverlay.slots[RADIAL_DIRECTIONS.indexOf('N')] = { type: 'command', commandId: 'wait' };

    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowUp')); // N

    // Simulate the real keyup path (the boundKeyUpHandler closure set up in init()).
    (inputHandler as unknown as { boundKeyUpHandler?: (e: KeyboardEvent) => void }).boundKeyUpHandler?.(
      makeKeyEvent('KeyV')
    );

    expect(execute).toHaveBeenCalledWith(engine);
    expect(radialMenuOverlay.isOpen).toBe(false);
  });

  it('does nothing when confirmed with no wedge hovered', () => {
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));
    expect(() => inputHandler.confirmRadialMenu()).not.toThrow();
    expect(radialMenuOverlay.isOpen).toBe(false);
  });

  it('selects diagonals when two adjacent arrow keys are pressed together', () => {
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));

    // Up + Right -> NE
    inputHandler.handleKeyDown(makeKeyEvent('ArrowUp'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('N');
    inputHandler.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('NE');

    // Release Up, hold Right, press Down -> SE
    inputHandler.handleKeyUp(makeKeyEvent('ArrowUp'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowDown'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('SE');

    // Release Right, press Left -> SW
    inputHandler.handleKeyUp(makeKeyEvent('ArrowRight'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowLeft'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('SW');

    // Release Down, press Up -> NW
    inputHandler.handleKeyUp(makeKeyEvent('ArrowDown'));
    inputHandler.handleKeyDown(makeKeyEvent('ArrowUp'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('NW');
  });

  it('supports WASD chording for diagonals in radial menu', () => {
    inputHandler.handleKeyDown(makeKeyEvent('KeyV'));

    // W + D -> NE
    inputHandler.handleKeyDown(makeKeyEvent('KeyW'));
    inputHandler.handleKeyDown(makeKeyEvent('KeyD'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('NE');

    // Keyup W and D
    inputHandler.handleKeyUp(makeKeyEvent('KeyW'));
    inputHandler.handleKeyUp(makeKeyEvent('KeyD'));

    // S + A -> SW
    inputHandler.handleKeyDown(makeKeyEvent('KeyS'));
    inputHandler.handleKeyDown(makeKeyEvent('KeyA'));
    expect(radialMenuOverlay.getHoveredDirection()).toBe('SW');
  });
});

