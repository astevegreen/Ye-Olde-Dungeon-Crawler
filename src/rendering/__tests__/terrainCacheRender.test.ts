import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player, type GameContentManifest, type TerrainArtConfig } from '../../engine';

// R-rend-16: the renderer keeps each cell's terrain layers between frames. A tile that
// changes between two frames must still be drawn as it now is.
describe('cached terrain on the map', () => {
  let originalDocument: unknown;

  const mockCanvas = (): HTMLCanvasElement => {
    const ctx = new Proxy({
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as Record<string, unknown>, {
      get: (target, prop: string) =>
        prop in target ? target[prop] : prop.startsWith('create') ? () => ({ addColorStop: () => {} }) : vi.fn(),
      set: (target, prop: string, value) => ((target[prop] = value), true),
    });
    return {
      getContext: () => ctx,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      width: 800,
      height: 600,
      style: {},
    } as unknown as HTMLCanvasElement;
  };

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => mockCanvas() };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  const ART: TerrainArtConfig = { styles: { floor: { kind: 'field' }, wall: { kind: 'wall' } } };
  const draw = () => {};
  const recipes = Object.fromEntries(
    ['floor~t0', 'wall~top', 'wall~face0', 'wall~rimN', 'wall~rimE', 'wall~rimW', 'wall~edgeE', 'wall~edgeW', 'door_closed~face', 'door_open~face'].map((k) => [k, draw])
  );
  const manifest = { id: 'test', name: 'Test', atlas: { themeId: 'test', terrain: ART }, spriteRecipes: recipes } as unknown as GameContentManifest;

  /** A room split by a wall line with a door in it, and a secret door further along. */
  function setup() {
    const map = new GameMap(20, 12, TILES.FLOOR);
    for (let x = 0; x < 20; x++) map.setTile(x, 6, TILES.WALL);
    map.setTile(8, 6, TILES.DOOR_CLOSED);
    map.setTile(12, 6, TILES.SECRET_DOOR);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 5 } }), manifest, floor: 1 });
    engine.fov.revealAllTiles();
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const drawn = vi.spyOn(renderer.atlas, 'drawSprite');
    const frame = () => {
      drawn.mockClear();
      renderer.render();
      return drawn.mock.calls.map((c) => c[1]);
    };
    return { map, renderer, frame };
  }

  it('draws a door open on the next frame after it opens', () => {
    const { map, renderer, frame } = setup();
    expect(frame()).toContain('door_closed~face');
    expect(frame()).toContain('door_closed~face');

    map.setTile(8, 6, TILES.DOOR_OPEN);
    const keys = frame();
    expect(keys).toContain('door_open~face');
    expect(keys).not.toContain('door_closed~face');
    renderer.destroy();
  });

  it('draws a secret door as a door on the next frame after it is found', () => {
    const { map, renderer, frame } = setup();
    const doors = () => frame().filter((k) => k === 'door_closed~face').length;
    expect(doors()).toBe(1);
    expect(doors()).toBe(1);

    map.setTile(12, 6, TILES.DOOR_CLOSED);
    expect(doors()).toBe(2);
    renderer.destroy();
  });
});
