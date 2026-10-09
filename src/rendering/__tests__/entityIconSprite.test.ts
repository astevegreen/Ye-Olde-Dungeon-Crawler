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

  it("draws a monster's icon with the pack's tag rules, as the map does", () => {
    const engine = new GameEngine({
      map: new GameMap(30, 30, TILES.FLOOR),
      player: new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } }),
      manifest: cotwManifest,
    });
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const atlas = (renderer as unknown as { atlas: { drawSprite: (...args: unknown[]) => void } }).atlas;
    const drawn = vi.spyOn(atlas, 'drawSprite');

    const keys: Record<string, unknown> = {};
    for (const id of ['draugr_warrior', 'ironwood_troll_wife', 'haugbui']) {
      const monster = engine.diagnostics.spawnMonster(id, { position: { x: 6, y: 5 } })!;
      drawn.mockClear();
      renderer.drawEntityIcon(mockCanvas(), monster);
      keys[id] = drawn.mock.calls[0]?.[1];
      engine.map.removeEntity(monster);
    }
    expect(keys).toEqual({ draugr_warrior: 'draugr', ironwood_troll_wife: 'troll_witch', haugbui: 'duergar' });
    renderer.destroy();
    // Baking the pack's atlas through the mocked context takes ~1 s alone and 11–16 s while
    // the whole suite runs in parallel, past the 5 s default.
  }, 30_000);
});
