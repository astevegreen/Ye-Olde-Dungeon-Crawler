import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { MapOverlay } from '../map-overlay';
import { AutoRestManager, GameEngine, GameMap, MemoryStorage, Player, TILES } from '../../engine';
import { SettingsManager } from '../../ui/settings/settingsManager';

function key(code: string, keyName = code): KeyboardEvent {
  return { code, key: keyName, repeat: false, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
}

// While the map is open it owns the keyboard (ARCHITECTURE.md §6): nothing reaches the
// simulation, and Escape closes the map rather than opening the save menu.
describe('InputHandler routes keys to an open map overlay', () => {
  let engine: GameEngine;
  let player: Player;
  let mapOverlay: MapOverlay;
  let onSaveAndExit: ReturnType<typeof vi.fn<() => void>>;
  let inputHandler: InputHandler;

  beforeEach(() => {
    player = new Player({ position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
    mapOverlay = new MapOverlay();
    onSaveAndExit = vi.fn<() => void>();
    inputHandler = new InputHandler(
      engine, vi.fn(), onSaveAndExit, undefined, undefined, undefined,
      undefined, undefined, undefined, mapOverlay
    );
    inputHandler.enabled = true;
    mapOverlay.open(engine);
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  it('keeps movement keys from moving the player or spending turns', () => {
    const turn = engine.turnCount;
    for (const code of ['Numpad6', 'KeyH', 'Period']) inputHandler.handleKeyDown(key(code));

    expect([player.x, player.y]).toEqual([5, 5]);
    expect(engine.turnCount).toBe(turn);
    expect(mapOverlay.isOpen).toBe(true);
  });

  it('closes the map on Escape without opening the save menu', () => {
    expect(inputHandler.handleKeyDown(key('Escape'))).toBe(true);

    expect(mapOverlay.isOpen).toBe(false);
    expect(onSaveAndExit).not.toHaveBeenCalled();
  });

  it('closes the map on M', () => {
    inputHandler.handleKeyDown(key('KeyM', 'm'));
    expect(mapOverlay.isOpen).toBe(false);
  });
});

// Rest pressed over the open map (X5, #102): the map keeps the key, but says why nothing
// happened instead of swallowing it silently. The line follows the `rest` binding.
describe('InputHandler: rest with the map open', () => {
  let engine: GameEngine;
  let mapOverlay: MapOverlay;
  let settingsManager: SettingsManager;
  let inputHandler: InputHandler;
  let log: ReturnType<typeof vi.spyOn>;
  let start: ReturnType<typeof vi.fn>;
  let fullRest: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ position: { x: 5, y: 5 } }) });
    mapOverlay = new MapOverlay();
    settingsManager = new SettingsManager(new MemoryStorage());
    inputHandler = new InputHandler(
      engine, vi.fn(), vi.fn(), undefined, undefined, undefined,
      undefined, undefined, undefined, mapOverlay, settingsManager
    );
    inputHandler.enabled = true;
    start = vi.fn();
    inputHandler.autoRestRunner = { active: false, start, cancel: vi.fn() } as never;
    fullRest = vi.spyOn(AutoRestManager, 'executeFullRest');
    mapOverlay.open(engine);
    log = vi.spyOn(engine, 'log');
  });

  afterEach(() => {
    inputHandler.destroy();
    vi.restoreAllMocks();
  });

  it('logs "Close the map to rest." once, keeps the map open and passes no turn', () => {
    const turn = engine.turnCount;
    expect(inputHandler.handleKeyDown(key('KeyR', 'r'))).toBe(true);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Close the map to rest.');
    expect(mapOverlay.isOpen).toBe(true);
    expect(engine.turnCount).toBe(turn);
    expect(start).not.toHaveBeenCalled();
    expect(fullRest).not.toHaveBeenCalled();
  });

  it('logs the line again on a second press', () => {
    inputHandler.handleKeyDown(key('KeyR', 'r'));
    inputHandler.handleKeyDown(key('KeyR', 'r'));

    expect(log.mock.calls).toEqual([['Close the map to rest.'], ['Close the map to rest.']]);
  });

  it('follows the rest binding, not the physical R key', () => {
    settingsManager.unbindKey('KeyR');
    settingsManager.bindKey('rest', 'KeyK');

    inputHandler.handleKeyDown(key('KeyR', 'r'));
    expect(log).not.toHaveBeenCalled();

    inputHandler.handleKeyDown(key('KeyK', 'k'));
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Close the map to rest.');
    expect(mapOverlay.isOpen).toBe(true);
    expect(start).not.toHaveBeenCalled();
  });

  it('logs nothing for a key that is not rest', () => {
    inputHandler.handleKeyDown(key('KeyZ', 'z'));

    expect(log).not.toHaveBeenCalled();
    expect(mapOverlay.isOpen).toBe(true);
  });

  it('starts a rest as before once the map is closed', () => {
    mapOverlay.close();
    inputHandler.handleKeyDown(key('KeyR', 'r'));

    expect(start).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalledWith('Close the map to rest.');
  });
});
