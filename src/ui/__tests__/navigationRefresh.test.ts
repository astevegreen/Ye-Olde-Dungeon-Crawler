import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster, Item } from '../../engine';
import type { ItemModifier } from '../../engine';
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

// A click-to-travel moves the hero one tile a step: it never jumps back onto its route after a
// blink or a teleport carried the hero off it, nor hops over a door it has just opened.
describe('click-to-travel moves one tile a step', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const trickster: ItemModifier = {
    id: "c-Trickster's Step",
    name: "Trickster's Step",
    alignment: 'chaotic',
    category: 'chaotic',
    evasionBonus: 0.25,
    blinkEverySteps: 10,
    blinkRange: [2, 4],
  };

  it("stops where Trickster's Step flings the hero, rather than stepping back through the wall", () => {
    const engine = buildEngine();
    // A wall column between the blink's landing spot (0,6) and the route along y = 10.
    for (let y = 0; y < 10; y++) engine.map.setTile(2, y, TILES.WALL);
    engine.rng = () => 0;
    const ring = new Item({ id: 'ring', name: 'Ring', category: 'ring', slot: 'fingerLeft', weight: 100, bulk: 100, identified: true });
    ring.addModifier(trickster);
    engine.player.inventory.paperdoll.equip(ring, 'fingerLeft');
    engine.modifyWorldCounter(`steps:${trickster.id}`, 9); // the trip's first step blinks
    const reasons: string[] = [];
    const nav = new NavigationController(engine);
    nav.navigatePlayerTo(14, 10, { stepDelayMs: 10, onCancel: (r) => reasons.push(r) });
    vi.advanceTimersByTime(500);

    expect({ x: engine.player.x, y: engine.player.y }).toEqual({ x: 0, y: 6 });
    expect(nav.isNavigating).toBe(false);
    expect(reasons).toHaveLength(1);
  });

  it('opens a door on its way and walks through it a tile at a time', () => {
    const engine = buildEngine();
    for (let y = 0; y < 20; y++) engine.map.setTile(6, y, TILES.WALL);
    engine.map.setTile(6, 10, TILES.DOOR_CLOSED);
    engine.fov.update(engine.map, engine.player.x, engine.player.y, 20);
    const seen: Array<{ x: number; y: number }> = [{ x: engine.player.x, y: engine.player.y }];
    let done = false;
    const nav = new NavigationController(engine);
    nav.navigatePlayerTo(9, 10, { stepDelayMs: 10, onStep: () => seen.push({ x: engine.player.x, y: engine.player.y }), onComplete: () => (done = true) });
    vi.advanceTimersByTime(500);

    expect(done).toBe(true);
    expect({ x: engine.player.x, y: engine.player.y }).toEqual({ x: 9, y: 10 });
    const hops = seen.slice(1).map((p, i) => Math.max(Math.abs(p.x - seen[i].x), Math.abs(p.y - seen[i].y)));
    expect(Math.max(...hops)).toBeLessThanOrEqual(1);
    expect(seen).toContainEqual({ x: 6, y: 10 });
  });
});
