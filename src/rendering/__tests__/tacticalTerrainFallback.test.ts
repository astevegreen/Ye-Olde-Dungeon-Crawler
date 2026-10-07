import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { resolveThemeTokens } from '../theme';
import { GameEngine, GameMap, TILES, Player, type GameContentManifest } from '../../engine';

// R-rend-18: where the pack's terrain art doesn't draw water, chasms, bars or pillars, the
// renderer marks them in the pack's theme roles, not in hues of its own.
describe('water, chasms, bars and pillars without pack terrain art', () => {
  let originalDocument: unknown;
  let calls: Array<{ op: string; style: unknown; x: number; y: number }> = [];

  const mockCanvas = (): HTMLCanvasElement => {
    const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '' };
    const ctx = new Proxy(state, {
      get: (target, prop: string) => {
        if (prop === 'fillRect' || prop === 'strokeRect') {
          return (x: number, y: number) => calls.push({ op: prop, style: prop === 'fillRect' ? target.fillStyle : target.strokeStyle, x, y });
        }
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
    calls = [];
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => mockCanvas() };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  it('draws each in the theme roles', () => {
    const theme = { info: '#0000a1', surface0: '#0000a2', surface3: '#0000a3', textMuted: '#0000a4', lineStrong: '#0000a5', line: '#0000a6' };
    const manifest = { id: 'test', name: 'Test', theme, atlas: { themeId: 'test' } } as unknown as GameContentManifest;
    const map = new GameMap(20, 12, TILES.FLOOR);
    map.setTile(4, 5, TILES.SHALLOW_WATER);
    map.setTile(5, 5, TILES.CHASM);
    map.setTile(6, 5, TILES.IRON_BARS);
    map.setTile(7, 5, TILES.PILLAR);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 7 } }), manifest });
    engine.updateFov();
    const renderer = new CanvasRenderer(mockCanvas(), engine);
    calls = [];
    renderer.render();

    // The four cells sit side by side, 32 units apart, from the water's.
    const water = calls.filter((c) => c.op === 'fillRect' && c.style === theme.info);
    expect(water).toHaveLength(1);
    const { x, y } = water[0];
    const inCell = (i: number) => calls.filter((c) => c.x >= x + 32 * i && c.x < x + 32 * (i + 1) && c.y >= y && c.y < y + 32);
    expect(inCell(1)).toContainEqual({ op: 'fillRect', style: theme.surface3, x: x + 32, y });
    expect(inCell(2).filter((c) => c.style === theme.textMuted)).toHaveLength(4);
    expect(inCell(2)[0]).toEqual({ op: 'fillRect', style: theme.surface0, x: x + 64, y });
    expect(inCell(3).map((c) => c.style)).toContain(theme.lineStrong);
    // No hue of the renderer's own in these cells: every style is a role, a gradient or a shadow.
    const roles = new Set(Object.values(resolveThemeTokens(theme)));
    for (const c of [0, 1, 2, 3].flatMap(inCell)) {
      if (typeof c.style === 'string' && !c.style.startsWith('rgba(0, 0, 0')) expect(roles, String(c.style)).toContain(c.style);
    }
    renderer.destroy();
  });
});
