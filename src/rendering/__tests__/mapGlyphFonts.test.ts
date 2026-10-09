import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player, Item, Container, Monster, type GameContentManifest, type TileDefinition } from '../../engine';

// R-rend-18: text the map draws (a fixture's glyph, a pile's count) is set in the pack's
// theme faces, never in a family the renderer names itself. The container badge and the
// wind-up warning are drawn shapes, so they set no text at all.
describe('map glyphs and badges use the theme fonts', () => {
  let originalDocument: unknown;
  let texts: Array<{ text: string; font: string }> = [];

  const mockCanvas = (): HTMLCanvasElement => {
    const state: Record<string, unknown> = { font: '' };
    const ctx = new Proxy(state, {
      get: (target, prop: string) => {
        if (prop === 'fillText') return (text: string) => texts.push({ text, font: String(target.font) });
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if (prop.startsWith('create')) return () => ({ addColorStop: () => {} });
        return prop in target ? target[prop] : () => {};
      },
      set: (target, prop: string, value) => ((target[prop] = value), true),
    });
    return {
      getContext: () => ctx,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
      width: 960,
      height: 600,
      style: {},
    } as unknown as HTMLCanvasElement;
  };

  beforeEach(() => {
    texts = [];
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => mockCanvas() };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  it('sets fixture glyphs in the display face and badges in the number face', () => {
    const theme = { fontDisplay: 'TestDisplay', fontBody: 'TestBody', fontNum: 'TestNum' };
    const manifest = { id: 'test', name: 'Test', theme, atlas: { themeId: 'test' } } as unknown as GameContentManifest;
    const map = new GameMap(20, 12, TILES.FLOOR);
    const fixture = (type: string, visual: string, glyph: string): TileDefinition => ({ ...TILES.FLOOR, type, visual, glyph });
    map.setTile(4, 5, fixture('gate', 'portal', '▲'));
    map.setTile(6, 5, fixture('shrine', 'altar', 'ᛏ'));
    // A pile of three with a chest in it: a count badge and a container badge.
    const chest = new Container({ id: 'chest', name: 'Chest', category: 'container', containerType: 'chest', weight: 8000, bulk: 12000, maxWeightCapacity: 50000, maxBulkCapacity: 35000 });
    chest.addItem(new Item({ id: 'gem', name: 'Gem', category: 'gem', weight: 50, bulk: 20 }));
    map.addItemAt(5, 6, chest);
    map.addItemAt(5, 6, new Item({ id: 'a', name: 'A', category: 'gem', weight: 50, bulk: 20 }));
    map.addItemAt(5, 6, new Item({ id: 'b', name: 'B', category: 'gem', weight: 50, bulk: 20 }));
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 7 } }), manifest });
    // A monster winding up wears the hazard sign.
    const brute = new Monster({ id: 'brute', name: 'Brute', position: { x: 7, y: 7 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 } });
    brute.intent = { type: 'windup', targetTile: { x: 6, y: 7 } } as Monster['intent'];
    engine.addEntity(brute);
    engine.updateFov();
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    texts = [];
    renderer.render();

    const fontOf = (text: string) => texts.find((t) => t.text === text)?.font;
    expect(fontOf('▲')).toMatch(/px TestDisplay$/);
    expect(fontOf('ᛏ')).toMatch(/px TestDisplay$/);
    expect(fontOf('3')).toMatch(/px TestNum$/);
    expect(texts.map((t) => t.text)).not.toContain('★');
    expect(texts.map((t) => t.text)).not.toContain('!');
    for (const t of texts) expect(t.font).not.toMatch(/serif|monospace|Courier/);
    renderer.destroy();
  });
});
