import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { cotwManifest } from '../../content/cotw';

// The sidebar's Nearby icons come from drawEntityIcon; they must use the same sprite as
// the map, which applies the pack's spriteTagRules (audit B, N33: a Draugr Warrior was a
// draugr on the map and a skeleton in the sidebar).
describe('drawEntityIcon', () => {
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

  it("draws a monster's icon from its own drawing or the pack's tag rules, as the map does", () => {
    // Every cotw monster now has its own drawing, so the tag rules are reached through copies
    // of two definitions under ids that have none.
    const monsters = cotwManifest.monsters ?? [];
    const undrawn = (id: string, from: string) => ({ ...monsters.find((m) => m.id === from)!, id });
    const engine = new GameEngine({
      map: new GameMap(30, 30, TILES.FLOOR),
      player: new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } }),
      manifest: { ...cotwManifest, monsters: [...monsters, undrawn('undrawn_haugbui', 'haugbui'), undrawn('undrawn_wight', 'silver_wight')] },
    });
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const atlas = (renderer as unknown as { atlas: { drawSprite: (...args: unknown[]) => void } }).atlas;
    const drawn = vi.spyOn(atlas, 'drawSprite');

    const keys: Record<string, unknown> = {};
    for (const id of ['draugr_warrior', 'undrawn_haugbui', 'undrawn_wight']) {
      const monster = engine.diagnostics.spawnMonster(id, { position: { x: 6, y: 5 } })!;
      drawn.mockClear();
      renderer.drawEntityIcon(mockCanvas(), monster);
      keys[id] = drawn.mock.calls[0]?.[1];
      engine.map.removeEntity(monster);
    }
    expect(keys).toEqual({ draugr_warrior: 'draugr_warrior', undrawn_haugbui: 'duergar', undrawn_wight: 'wight' });
    renderer.destroy();
    // Baking the pack's atlas through the mocked context takes ~1 s alone and 11–16 s while
    // the whole suite runs in parallel, past the 5 s default.
  }, 30_000);

  it("paints a creature's portrait in its picture when the pack has one, else its sprite whole and centred", () => {
    const monsters = cotwManifest.monsters ?? [];
    const portrait = { frames: 1, render: (_frame: number, size: number) => new Uint8ClampedArray(size * size * 4).fill(7) };
    const engine = new GameEngine({
      map: new GameMap(30, 30, TILES.FLOOR),
      player: new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } }),
      manifest: { ...cotwManifest, portraits: { draugr: portrait } },
    });
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const atlas = (renderer as unknown as { atlas: { drawSprite: (...args: unknown[]) => void } }).atlas;
    const drawn = vi.spyOn(atlas, 'drawSprite').mockImplementation(() => {});
    const picture = () => {
      const put: Uint8ClampedArray[] = [];
      const ctx = {
        imageSmoothingEnabled: true,
        clearRect: () => {},
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img: { data: Uint8ClampedArray }) => put.push(img.data),
      };
      return { put, canvas: { width: 96, height: 96, getContext: () => ctx } as unknown as HTMLCanvasElement };
    };

    expect(renderer.hasPortraits).toBe(true);
    const draugr = picture();
    renderer.drawMonsterPicture(draugr.canvas, monsters.find((m) => m.id === 'draugr')!);
    expect(draugr.put).toHaveLength(1);
    expect(draugr.put[0][0]).toBe(7);
    expect(drawn).not.toHaveBeenCalled();

    const wolf = picture();
    renderer.drawMonsterPicture(wolf.canvas, monsters.find((m) => m.id === 'wolf')!);
    expect(wolf.put).toHaveLength(0);
    expect(drawn.mock.calls[0]?.slice(1)).toEqual(['wolf', 16, 16, 64]);
    expect(renderer.hasEntityPortrait(engine.player)).toBe(false);
    renderer.destroy();
  }, 30_000);
});
