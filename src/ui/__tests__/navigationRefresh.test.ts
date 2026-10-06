import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster } from '../../engine';
import { NavigationController } from '../navigation';

// R-main-1: a click-to-travel must hand every step, and whatever stops it, to the HUD's
// post-action refresh (auto-pickup, the log, the orbs), as a key press does.

function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 10 }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player });
  engine.fov.update(engine.map, player.x, player.y, 20);
  return engine;
}

describe('click-to-travel reports to the post-action refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('every step and the arrival call back', () => {
    const engine = buildEngine();
    const calls: string[] = [];
    const nav = new NavigationController(engine);
    nav.navigatePlayerTo(6, 10, { stepDelayMs: 10, onStep: () => calls.push('step'), onComplete: () => calls.push('done') });
    vi.advanceTimersByTime(500);

    expect(calls).toEqual(['step', 'step', 'step', 'step', 'done']);
  });

  it('a trip stopped by a hostile coming into view reports its stop, once, with the log line', () => {
    const engine = buildEngine();
    const reasons: string[] = [];
    const nav = new NavigationController(engine);
    nav.navigatePlayerTo(17, 10, { stepDelayMs: 10, onCancel: (r) => reasons.push(r) });
    vi.advanceTimersByTime(25);
    engine.map.addEntity(new Monster({ id: 'orc', name: 'Orc', position: { x: 10, y: 12 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } }));
    engine.fov.update(engine.map, engine.player.x, engine.player.y, 20);
    vi.advanceTimersByTime(500);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/Orc comes into view/);
    expect(nav.isNavigating).toBe(false);
  });

  it('a trip stopped by a dialog reports its stop too', () => {
    const engine = buildEngine();
    let stopped = 0;
    const nav = new NavigationController(engine);
    nav.navigatePlayerTo(17, 10, { stepDelayMs: 10, onCancel: () => stopped++ });
    vi.advanceTimersByTime(25);
    engine.setPaused(true);
    vi.advanceTimersByTime(500);

    expect(stopped).toBe(1);
  });
});
