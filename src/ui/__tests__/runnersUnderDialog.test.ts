import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { AutoRestRunner } from '../autoRestRunner';
import { NavigationController } from '../navigation';

// A rest (R) or a click-to-travel runs on timers. A key press cancels it, but a dialog
// opened with the mouse (the header's Save, the HUD's Inventory button) doesn't press a
// key: the modal stack pauses the engine instead, and the runner must stop there rather
// than keep moving the hero and the turn under the dialog.

function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 10 }, stats: { hp: 5, maxHp: 50, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player });
  engine.fov.update(engine.map, player.x, player.y, 20);
  return engine;
}

describe('rest and travel stop when a dialog pauses the game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('a rest takes no more turns once a dialog opens', () => {
    const engine = buildEngine();
    const runner = new AutoRestRunner(engine);
    runner.start({ stepDelayMs: 30 });
    vi.advanceTimersByTime(100);
    expect(runner.active).toBe(true);

    engine.setPaused(true);
    const turn = engine.turnCount;
    const hp = engine.player.hp;
    vi.advanceTimersByTime(1000);

    expect(engine.turnCount).toBe(turn);
    expect(engine.player.hp).toBe(hp);
    expect(runner.active).toBe(false);
  });

  it('a click-to-travel takes no more steps once a dialog opens', () => {
    const engine = buildEngine();
    const nav = new NavigationController(engine);
    expect(nav.navigatePlayerTo(17, 10, { stepDelayMs: 55 })).toBe(true);
    vi.advanceTimersByTime(120);
    expect(nav.isNavigating).toBe(true);

    engine.setPaused(true);
    const x = engine.player.x;
    const turn = engine.turnCount;
    vi.advanceTimersByTime(2000);

    expect(engine.player.x).toBe(x);
    expect(engine.turnCount).toBe(turn);
    expect(nav.isNavigating).toBe(false);
  });
});
