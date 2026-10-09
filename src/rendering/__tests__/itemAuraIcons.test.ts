import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player, Item, type ItemAuraArt } from '../../engine';
import { cotwManifest } from '../../content/cotw';
import { IDLE_FRAME_MS, idlePhase } from '../atlas/idle-frames';

// Wave 6: an identified item of a family wears the pack's aura on its menu icons, turning over
// while the icon is on the page; an unidentified one, or any under Reduce motion, holds still.
describe('drawItemIcon with item auras', () => {
  let originalDocument: unknown;

  const mockCanvas = (): HTMLCanvasElement => {
    const ctx = new Proxy({
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
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
      width: 40,
      height: 40,
      style: {},
      isConnected: true,
    } as unknown as HTMLCanvasElement;
  };

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => mockCanvas() };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
    vi.restoreAllMocks();
  });

  const blade = (identified: boolean) => {
    const item = new Item({ id: 'blade-7', name: 'Blade', category: 'weapon', weight: 500, bulk: 300, identified });
    item.addModifier({ id: 'm', name: 'cursed', alignment: 'negative', category: 'cursed' });
    return item;
  };

  function setup() {
    const art: ItemAuraArt = { frames: 16, tones: ['cursed'], render: (_item, size) => new Uint8ClampedArray(size * size * 4) };
    const engine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player: new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } }),
      manifest: { ...cotwManifest, spriteRecipes: {}, pixelSprites: {}, itemAuras: art },
    });
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const inner = renderer as unknown as {
      atlas: { drawItem: (...args: unknown[]) => void };
      idleIcons: { watch: (...args: unknown[]) => void };
    };
    return { renderer, drawItem: vi.spyOn(inner.atlas, 'drawItem'), watch: vi.spyOn(inner.idleIcons, 'watch') };
  }

  it('draws an identified cursed item in its aura at the frame the clock is on, and keeps it turning over', () => {
    const { renderer, drawItem, watch } = setup();
    vi.spyOn(Date, 'now').mockReturnValue(IDLE_FRAME_MS * 5 + 1);
    const item = blade(true);
    const icon = mockCanvas();
    renderer.drawItemIcon(icon, item);
    expect(drawItem.mock.calls[0][2]).toBe('cursed');
    expect(drawItem.mock.calls[0][6]).toBe((5 + idlePhase(item.id)) % 16);
    expect(watch.mock.calls[0].slice(0, 2)).toEqual([icon, item]);
    renderer.destroy();
  });

  it('draws an unidentified one plain and still, and holds an aura still under Reduce motion', () => {
    const { renderer, drawItem, watch } = setup();
    renderer.drawItemIcon(mockCanvas(), blade(false));
    expect([drawItem.mock.calls[0][2], drawItem.mock.calls[0][6]]).toEqual([null, 0]);

    renderer.idleMotion = false;
    renderer.drawItemIcon(mockCanvas(), blade(true));
    expect([drawItem.mock.calls[1][2], drawItem.mock.calls[1][6]]).toEqual(['cursed', 0]);
    expect(watch).not.toHaveBeenCalled();
    renderer.destroy();
  });
});
