import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { MapOverlay } from '../map-overlay';
import { GameEngine, GameMap, Player, TILES } from '../../engine';

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
      engine, vi.fn(), undefined, onSaveAndExit, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, mapOverlay
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
