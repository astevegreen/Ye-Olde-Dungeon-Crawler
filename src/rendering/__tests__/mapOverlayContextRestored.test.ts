import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { MapOverlay } from '../map-overlay';

/** An element that records its listeners; the scrim hands out the one viewer canvas. */
function fakeElement(): { style: Record<string, string>; listeners: Map<string, Array<() => void>>; addEventListener(type: string, fn: () => void): void } {
  const listeners = new Map<string, Array<() => void>>();
  return {
    style: {},
    listeners,
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
  };
}

describe('MapOverlay after a GPU reset', () => {
  let canvas: ReturnType<typeof fakeElement>;

  beforeEach(() => {
    canvas = fakeElement();
    const scrim = {
      ...fakeElement(),
      id: '',
      className: '',
      innerHTML: '',
      querySelector: (sel: string) => (sel === '#map-viewer-canvas' ? canvas : fakeElement()),
      querySelectorAll: () => [],
    };
    vi.stubGlobal('document', {
      getElementById: () => null,
      body: { appendChild: () => {} },
      createElement: () => scrim,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws the open floor again when the browser restores the viewer canvas', () => {
    const player = new Player({ id: 'p', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player, floor: 1 });
    const overlay = new MapOverlay();
    const drawFloor = vi.spyOn(overlay as unknown as { drawFloor: (c: unknown) => void }, 'drawFloor').mockImplementation(() => {});

    overlay.open(engine);
    expect(drawFloor).toHaveBeenCalledTimes(1);
    const restored = canvas.listeners.get('contextrestored') ?? [];
    expect(restored).toHaveLength(1);

    restored[0]();
    expect(drawFloor).toHaveBeenCalledTimes(2);
    expect(drawFloor).toHaveBeenLastCalledWith(canvas);
  });
});
