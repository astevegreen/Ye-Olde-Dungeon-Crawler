import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { SettingsManager } from '../../ui/settings/settingsManager';
import { MemoryStorage } from '../../engine';
import { MovementAction } from '../../engine';

function makeKeyEvent(code: string, repeat = false): KeyboardEvent {
  return {
    code,
    key: code,
    repeat,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('InputHandler Keybind Remapping & Movement Modes', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let storage: MemoryStorage;
  let settingsManager: SettingsManager;
  let inputHandler: InputHandler;
  let onActionProcessed: ReturnType<typeof vi.fn>;
  let onSaveAndExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    map = new GameMap(10, 10);
    player = new Player({ position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player });

    storage = new MemoryStorage();
    settingsManager = new SettingsManager(storage);
    onActionProcessed = vi.fn();
    onSaveAndExit = vi.fn();

    inputHandler = new InputHandler(
      engine,
      onActionProcessed,
      undefined,
      onSaveAndExit,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      settingsManager
    );
    inputHandler.enabled = true;
  });

  afterEach(() => {
    inputHandler.destroy();
    vi.useRealTimers();
  });

  it('dispatches MovementAction based on custom rebound key', () => {
    const handleActionSpy = vi.spyOn(engine, 'handlePlayerAction');

    // Rebind Move North to 'KeyT'
    settingsManager.bindKey('move_n', 'KeyT');

    const handled = inputHandler.handleKeyDown(makeKeyEvent('KeyT'));
    expect(handled).toBe(true);
    expect(handleActionSpy).toHaveBeenCalledTimes(1);

    const action = handleActionSpy.mock.calls[0][0] as MovementAction;
    expect(action).toBeInstanceOf(MovementAction);
    expect(action.dx).toBe(0);
    expect(action.dy).toBe(-1);
  });

  it('routes arrow keys through ChordBuffer and forms diagonal move on chord', () => {
    const handleActionSpy = vi.spyOn(engine, 'handlePlayerAction');

    // Press ArrowUp then ArrowRight within 40ms buffer
    inputHandler.handleKeyDown(makeKeyEvent('ArrowUp'));
    expect(handleActionSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15);
    inputHandler.handleKeyDown(makeKeyEvent('ArrowRight'));

    // Should immediately dispatch diagonal MovementAction (1, -1)
    expect(handleActionSpy).toHaveBeenCalledTimes(1);
    const action = handleActionSpy.mock.calls[0][0] as MovementAction;
    expect(action).toBeInstanceOf(MovementAction);
    expect(action.dx).toBe(1);
    expect(action.dy).toBe(-1);
  });

  it('dispatches 0ms immediate cardinal move when arrowChordingEnabled is false', () => {
    const handleActionSpy = vi.spyOn(engine, 'handlePlayerAction');
    settingsManager.updateSettings({ arrowChordingEnabled: false });

    const handled = inputHandler.handleKeyDown(makeKeyEvent('ArrowUp'));
    expect(handled).toBe(true);
    expect(handleActionSpy).toHaveBeenCalledTimes(1);

    const action = handleActionSpy.mock.calls[0][0] as MovementAction;
    expect(action.dx).toBe(0);
    expect(action.dy).toBe(-1);
  });

  it('invokes onSaveAndExit when Escape is pressed and no overlays are open', () => {
    const handled = inputHandler.handleKeyDown(makeKeyEvent('Escape'));
    expect(handled).toBe(true);
    expect(onSaveAndExit).toHaveBeenCalledTimes(1);
  });
});
