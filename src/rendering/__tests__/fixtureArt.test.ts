import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player, Container, Item, Visibility, type FixtureArt, type PixelSprite } from '../../engine';
import { cotwManifest } from '../../content/cotw';
import { fixtureFigures, lootPileKey } from '../atlas/fixture-art';

// Wave 8: a pack draws its altars, portals, chests and loot heaps (`FixtureArt`); whatever it
// leaves out keeps the renderer's generic mark or badge.
describe('fixture art', () => {
  let originalDocument: unknown;
  let texts: string[];

  const mockCanvas = (): HTMLCanvasElement => {
    const ctx = new Proxy({
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      fillText: (text: string) => texts.push(text),
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

  const sprite = (frames = 1): PixelSprite => ({ frames, render: (_f, size) => new Uint8ClampedArray(size * size * 4) });

  beforeEach(() => {
    texts = [];
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => mockCanvas() };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
    vi.restoreAllMocks();
  });

  function setup(map: GameMap, fixtureArt: FixtureArt | undefined) {
    const engine = new GameEngine({
      map,
      player: new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } }),
      manifest: { ...cotwManifest, spriteRecipes: {}, pixelSprites: {}, heroSprite: undefined, fixtureArt },
    });
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    const atlas = (renderer as unknown as { atlas: { drawSprite: (...args: unknown[]) => void } }).atlas;
    return { renderer, drawSprite: vi.spyOn(atlas, 'drawSprite') };
  }

  const drawnKeys = (spy: ReturnType<typeof vi.fn>): string[] => spy.mock.calls.map((c) => c[1] as string);

  it('names each drawing by what it stands for', () => {
    const s = sprite();
    const keys = Object.keys(
      fixtureFigures({ tiles: { shrine: s }, containers: { chest: { unopened: s, opened: s, empty: s } }, lootPile: { small: s, large: s } })
    );
    expect(keys.sort()).toEqual(['chest.empty', 'chest.opened', 'chest.unopened', 'fixture.shrine', 'loot_pile', 'loot_pile.large']);
    expect(fixtureFigures(undefined)).toEqual({});
  });

  it('heaps four or more items in the large pile when the pack draws one', () => {
    const has = (key: string) => key === 'loot_pile.large';
    expect(lootPileKey(3, has)).toBe('loot_pile');
    expect(lootPileKey(4, has)).toBe('loot_pile.large');
    expect(lootPileKey(9, () => false)).toBe('loot_pile');
  });

  it("draws an altar the pack draws in place of the generic mark, and keeps the mark for one it doesn't", () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const drawn = { type: 'shrine_drawn', name: 'Drawn Shrine', passable: true, walkable: true, transparent: true, visual: 'altar' as const, glyph: 'ᛏ' };
    const plain = { ...drawn, type: 'shrine_plain', name: 'Plain Shrine', glyph: 'ᚨ' };
    map.setTile(6, 5, drawn);
    map.setTile(4, 5, plain);
    const { renderer, drawSprite } = setup(map, { tiles: { shrine_drawn: sprite(4) } });
    renderer.render();
    expect(drawnKeys(drawSprite)).toContain('fixture.shrine_drawn');
    expect(texts).toContain('ᚨ');
    expect(texts).not.toContain('ᛏ');
    renderer.destroy();
  });

  it('draws a chest by its state, with no badge, and badges a container the pack does not draw', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const chest = new Container({ id: 'c1', name: 'Ironbound Chest', category: 'container', containerType: 'chest', weight: 8000, bulk: 12000, maxWeightCapacity: 50000, maxBulkCapacity: 35000 });
    chest.addItem(new Item({ id: 'gem-1', name: 'Ruby', category: 'gem', weight: 50, bulk: 20 }));
    chest.markOpened();
    map.addItemAt(6, 5, chest);
    const s = sprite();
    const drawnArt = setup(map, { containers: { chest: { unopened: s, opened: s, empty: s } } });
    drawnArt.renderer.render();
    expect(drawnKeys(drawnArt.drawSprite)).toContain('chest.opened');
    expect(texts).not.toContain('•');
    drawnArt.renderer.destroy();

    texts = [];
    const plainArt = setup(map, undefined);
    plainArt.renderer.render();
    expect(drawnKeys(plainArt.drawSprite)).not.toContain('chest.opened');
    expect(texts).toContain('•');
    plainArt.renderer.destroy();
  });

  it('holds a remembered fixture on frame 0', () => {
    const map = new GameMap(40, 40, TILES.FLOOR);
    map.setTile(6, 5, { type: 'shrine_drawn', name: 'Drawn Shrine', passable: true, walkable: true, transparent: true, visual: 'altar' as const, glyph: 'ᛏ' });
    const { renderer, drawSprite } = setup(map, { tiles: { shrine_drawn: sprite(4) } });
    const engine = (renderer as unknown as { engine: GameEngine }).engine;
    vi.spyOn(engine.fov, 'getVisibility').mockReturnValue(Visibility.Explored);
    renderer.render();
    const call = drawSprite.mock.calls.find((c) => c[1] === 'fixture.shrine_drawn');
    expect(call?.slice(5, 7)).toEqual([Visibility.Explored, 0]);
    renderer.destroy();
  });
});
