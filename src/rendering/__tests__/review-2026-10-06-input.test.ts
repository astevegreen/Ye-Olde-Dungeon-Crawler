import { describe, it, expect, vi, afterEach } from 'vitest';
import { InputHandler } from '../input-handler';
import { CloseDoorAction, GameEngine, GameMap, Player, MemoryStorage, MovementAction, TILES } from '../../engine';
import { SettingsManager, ACTION_METADATA } from '../../ui/settings/settingsManager';

/**
 * Whole-codebase review, 2026-10-06, area 8 (keyboard dispatch). Each test reproduces one
 * finding from `.prompts/codebase-review-2026-10-06/areas/08-rendering.md` and is marked
 * `it.fails` so the suite stays green until the bug is fixed.
 */

const ev = (code: string): KeyboardEvent =>
  ({ code, key: code, repeat: false, preventDefault() {}, stopPropagation() {}, target: null }) as unknown as KeyboardEvent;

describe('R-rend-2 · Disarm Trap has no key: T is Channel Rune of Return and the hard-wired fallback is dead', () => {
  it('the settings offer a bindable Disarm action', () => {
    expect(ACTION_METADATA.some((a) => /disarm/i.test(a.id) || /disarm/i.test(a.name))).toBe(true);
  });

  it('its key (Shift+D) disarms; T still channels the Rune of Return', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ position: { x: 10, y: 10 } }) });
    const actions: string[] = [];
    const orig = engine.handlePlayerAction.bind(engine);
    engine.handlePlayerAction = ((a: { constructor: { name: string } }) => {
      actions.push(a.constructor.name);
      return orig(a as never);
    }) as typeof engine.handlePlayerAction;
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    ih.enabled = true;
    ih.handleKeyDown({ ...ev('KeyD'), shiftKey: true } as KeyboardEvent);
    ih.handleKeyDown(ev('KeyT'));
    ih.destroy();

    expect(actions).toEqual(['DisarmTrapAction', 'ChannelRuneOfReturnAction']);
  });
});

describe('R-rend-3 · a key still held when the game ends stays "held" in the reused ChordBuffer', () => {
  afterEach(() => vi.useRealTimers());

  it('after a game over with Up held, the next game’s first Down press moves down', () => {
    vi.useFakeTimers();
    const map = new GameMap(20, 20);
    const player = new Player({ position: { x: 10, y: 10 } });
    const engine = new GameEngine({ map, player });
    const moves: Array<[number, number]> = [];
    const orig = engine.handlePlayerAction.bind(engine);
    engine.handlePlayerAction = ((a: unknown) => {
      if (a instanceof MovementAction) moves.push([a.dx, a.dy]);
      return orig(a as never);
    }) as typeof engine.handlePlayerAction;
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    ih.enabled = true;

    // Last life: Up is pressed, the buffered step lands the killing blow, the game-over screen
    // disables input before the finger lifts, so the keyup is dropped.
    ih.handleKeyDown(ev('ArrowUp'));
    vi.advanceTimersByTime(60);
    ih.enabled = false;
    ih.handleKeyUp(ev('ArrowUp'));

    // New game on the same handler (launchGame resets only the modal stack and the lock).
    ih.enabled = true;
    ih.isInputLocked = false;
    moves.length = 0;
    ih.handleKeyDown(ev('ArrowDown'));
    vi.advanceTimersByTime(60);
    ih.destroy();

    expect(moves).toEqual([[0, 1]]);
  });
});

describe('R-main-6 · a new run on the same InputHandler starts clean', () => {
  it('reset() drops a pending "Close which door?" prompt and held keys', () => {
    const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ position: { x: 10, y: 10 } }) });
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    ih.pendingCloseDoorDirection = true;
    ih.isInputLocked = true;

    ih.reset();
    ih.destroy();

    expect(ih.pendingCloseDoorDirection).toBe(false);
    expect(ih.isInputLocked).toBe(false);
  });
});

describe('R-rend-5 · the game’s function keys never reach the browser (Help tab, find bar, quick find)', () => {
  it.each(['F1', 'F2', 'F3', 'Slash', 'Backquote'])('%s is preventDefaulted, even while effects lock input', (code) => {
    const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ position: { x: 10, y: 10 } }) });
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    ih.enabled = true;
    ih.isInputLocked = true;
    const prevented = vi.fn();

    ih.handleKeyDown({ ...ev(code), preventDefault: prevented } as KeyboardEvent);
    ih.destroy();

    expect(prevented).toHaveBeenCalled();
  });
});

describe('R-rend-10 · a key pressed while effects lock input never presses the focused HUD button', () => {
  it.each(['Space', 'Enter', 'ArrowUp', 'Numpad5'])('%s is dropped and preventDefaulted while locked', (code) => {
    const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ position: { x: 10, y: 10 } }) });
    const acted = vi.spyOn(engine, 'handlePlayerAction');
    const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
    ih.enabled = true;
    const release = ih.holdInput();
    const prevented = vi.fn();

    ih.handleKeyDown({ ...ev(code), preventDefault: prevented } as KeyboardEvent);
    release();
    ih.destroy();

    expect(acted).not.toHaveBeenCalled();
    expect(prevented).toHaveBeenCalled();
  });
});

/** A handler on a fresh engine with stub overlays, recording what each key opened. */
function wiredHandler() {
  const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ position: { x: 10, y: 10 } }) });
  const ih = new InputHandler(engine, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new SettingsManager(new MemoryStorage()));
  ih.enabled = true;
  const opened: string[] = [];
  ih.characterMenuModal = {} as never;
  vi.spyOn(ih, 'toggleCharacterMenu').mockImplementation((tab?: string) => { opened.push(`tab:${tab}`); });
  const look = { isOpen: false, open: vi.fn(() => { opened.push('look'); }), close: vi.fn(() => { opened.push('close-look'); }), moveCursor: vi.fn((dx: number, dy: number) => { opened.push(`cursor:${dx},${dy}`); }) };
  ih.inspectOverlay = look as never;
  ih.mapOverlay = { isOpen: false, toggle: vi.fn(() => { opened.push('map'); }), handleKeyDown: vi.fn() } as never;
  ih.autoRestRunner = { active: false, start: vi.fn(() => { opened.push('rest'); }), cancel: vi.fn() } as never;
  return { engine, ih, opened, look };
}

describe('R-rend-11 · hard-wired keys are positional, so a non-QWERTY layout reaches its own bindings', () => {
  const press = (code: string, key: string) => ({ ...ev(code), key }) as KeyboardEvent;

  it("Colemak: the key at R (it types 'p') rests, and the key at I (it types 'u') opens the inventory", () => {
    const { ih, opened } = wiredHandler();
    ih.handleKeyDown(press('KeyR', 'p'));
    ih.handleKeyDown(press('KeyI', 'u'));
    ih.destroy();

    expect(opened).toEqual(['rest', 'tab:inventory']);
  });

  it("Workman: the key at M (it types 'l') opens the map, not Look", () => {
    const { ih, opened } = wiredHandler();
    ih.handleKeyDown(press('KeyM', 'l'));
    ih.destroy();

    expect(opened).toEqual(['map']);
  });

  it("Dvorak, in Look: the key at B (it types 'x') moves the cursor south-west instead of closing Look", () => {
    const { ih, opened, look } = wiredHandler();
    look.isOpen = true;
    ih.handleKeyDown(press('KeyB', 'x'));
    ih.destroy();

    expect(opened).toEqual(['cursor:-1,1']);
  });
});

describe('R-rend-12 · browser and system chords (Ctrl, Alt, Meta) never drive the hero', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ['Ctrl+F', 'KeyF', { ctrlKey: true }],
    ['Ctrl+R', 'KeyR', { ctrlKey: true }],
    ['Ctrl+S', 'KeyS', { ctrlKey: true }],
    ['Ctrl+W', 'KeyW', { ctrlKey: true }],
    ['Cmd+Q', 'KeyQ', { metaKey: true }],
    ['Ctrl+Left', 'ArrowLeft', { ctrlKey: true }],
    ['Alt+F', 'KeyF', { altKey: true }],
  ])('%s is left to the browser', (_name, code, mods) => {
    vi.useFakeTimers();
    const { engine, ih, opened } = wiredHandler();
    const acted = vi.spyOn(engine, 'handlePlayerAction');
    ih.onContextAction = () => { opened.push('context'); };
    ih.onSaveAndExit = () => { opened.push('save-quit'); };
    const prevented = vi.fn();

    const handled = ih.handleKeyDown({ ...ev(code), ...mods, preventDefault: prevented } as KeyboardEvent);
    vi.advanceTimersByTime(100);
    ih.destroy();

    expect(handled).toBe(false);
    expect(acted).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
    expect(prevented).not.toHaveBeenCalled();
  });

  it.each([
    ['Alt+Left', 'ArrowLeft'],
    ['Alt+Right', 'ArrowRight'],
    ['Alt+Home', 'Home'],
    ['Alt+Numpad4', 'Numpad4'],
    ['Alt+Numpad5', 'Numpad5'],
  ])('%s, the browser\'s way off the page, moves nobody and goes nowhere', (_name, code) => {
    vi.useFakeTimers();
    const { engine, ih } = wiredHandler();
    const acted = vi.spyOn(engine, 'handlePlayerAction');
    const prevented = vi.fn();

    const handled = ih.handleKeyDown({ ...ev(code), altKey: true, preventDefault: prevented } as KeyboardEvent);
    vi.advanceTimersByTime(100);
    ih.destroy();

    expect(handled).toBe(false);
    expect(acted).not.toHaveBeenCalled();
    expect(prevented).toHaveBeenCalled();
  });

  it('Ctrl+K and Cmd+K, the chords the game owns, still toggle the command palette', () => {
    const { ih } = wiredHandler();
    const toggled = vi.fn();
    ih.onToggleCommandPalette = toggled;

    ih.handleKeyDown({ ...ev('KeyK'), ctrlKey: true } as KeyboardEvent);
    ih.handleKeyDown({ ...ev('KeyK'), metaKey: true } as KeyboardEvent);
    ih.destroy();

    expect(toggled).toHaveBeenCalledTimes(2);
  });
});

describe('R-rend-13 · Settings own the movement keys: a key the player unbinds does nothing', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['KeyW', 'KeyH', 'Numpad8', 'KeyY', 'Space', 'Period', 'ArrowUp'])('%s does nothing once unbound', (code) => {
    vi.useFakeTimers();
    const { engine, ih } = wiredHandler();
    const acted = vi.spyOn(engine, 'handlePlayerAction');
    ih.settingsManager.unbindKey(code);

    ih.handleKeyDown(ev(code));
    vi.advanceTimersByTime(100);
    ih.handleKeyUp(ev(code));
    ih.destroy();

    expect(acted).not.toHaveBeenCalled();
  });

  it('every default movement and wait key still acts as Settings list it', () => {
    vi.useFakeTimers();
    const { engine, ih } = wiredHandler();
    const got: string[] = [];
    vi.spyOn(engine, 'handlePlayerAction').mockImplementation((a: unknown) => {
      got.push(a instanceof MovementAction ? `${a.dx},${a.dy}` : (a as object).constructor.name);
      return undefined as never;
    });
    const deltas: Record<string, string> = {
      move_n: '0,-1', move_s: '0,1', move_w: '-1,0', move_e: '1,0',
      move_nw: '-1,-1', move_ne: '1,-1', move_sw: '-1,1', move_se: '1,1', wait: 'WaitAction',
    };
    const expected: string[] = [];
    for (const action of ACTION_METADATA.filter((a) => a.id in deltas)) {
      for (const code of action.defaultCodes) {
        expected.push(deltas[action.id]);
        ih.handleKeyDown(ev(code));
        vi.advanceTimersByTime(100);
        ih.handleKeyUp(ev(code));
      }
    }
    ih.destroy();

    expect(expected.length).toBeGreaterThan(20);
    expect(got).toEqual(expected);
  });
});

describe("Smart Close Door's 'Close which door?' takes the player's movement keys", () => {
  it('a key bound to a direction picks that door; a default letter moved off it does not', () => {
    const { engine, ih } = wiredHandler();
    engine.map.setTile(11, 10, TILES.DOOR_OPEN);
    engine.map.setTile(9, 10, TILES.DOOR_OPEN);
    const closed: Array<[number, number]> = [];
    vi.spyOn(engine, 'handlePlayerAction').mockImplementation((a: unknown) => {
      if (a instanceof CloseDoorAction) closed.push([a.x, a.y]);
      return undefined as never;
    });
    ih.settingsManager.bindKey('move_e', 'KeyO');
    ih.settingsManager.unbindKey('KeyD');

    ih.handleKeyDown(ev('KeyC'));
    expect(ih.pendingCloseDoorDirection).toBe(true);
    ih.handleKeyDown(ev('KeyD'));
    expect(closed).toEqual([]);
    ih.handleKeyDown(ev('KeyO'));
    ih.destroy();

    expect(closed).toEqual([[11, 10]]);
  });
});

describe('R-rend-14 · a key bound to Smart Close Door closes the door, like C', () => {
  it('Semicolon, added to Smart Close Door, closes the open door beside the hero', () => {
    const { engine, ih } = wiredHandler();
    engine.map.setTile(11, 10, TILES.DOOR_OPEN);
    const acted: string[] = [];
    vi.spyOn(engine, 'handlePlayerAction').mockImplementation((a: unknown) => {
      acted.push((a as object).constructor.name);
      return undefined as never;
    });
    ih.settingsManager.bindKey('close_door', 'Semicolon');

    const handled = ih.handleKeyDown(ev('Semicolon'));
    ih.destroy();

    expect(handled).toBe(true);
    expect(acted).toEqual(['CloseDoorAction']);
  });
});
