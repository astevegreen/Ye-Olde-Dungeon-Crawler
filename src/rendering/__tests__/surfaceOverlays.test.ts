import { describe, it, expect, vi } from 'vitest';
import { IntentOverlay } from '../intentOverlay';
import { Camera } from '../camera';
import { resolveThemeTokens } from '../theme';
import { GameEngine, GameMap, TILES, Player, type CellOverlayArt, type GameContentManifest, type GasType } from '../../engine';

// R-rend-18: surfaces and gases are drawn with the pack's art (`atlas.overlays`); a type the
// pack draws nothing for still shows, in the theme's role colors.
function setup(overlays?: Record<string, CellOverlayArt>) {
  const manifest = { id: 'test', name: 'Test', atlas: { themeId: 'test', overlays } } as unknown as GameContentManifest;
  const engine = new GameEngine({
    map: new GameMap(20, 12, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
    manifest,
  });
  engine.fov.revealAllTiles();
  const camera = new Camera(30, 18);
  camera.update(engine.player, 20, 12);
  const fills: Array<{ op: string; style: unknown; alpha: number; args: number[] }> = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', globalAlpha: 1 };
  const stack: Array<Record<string, unknown>> = [];
  const ctx = new Proxy(state, {
    get: (target, prop: string) => {
      if (prop === 'save') return () => stack.push({ ...target });
      if (prop === 'restore') return () => Object.assign(target, stack.pop());
      if (prop === 'fillRect' || prop === 'strokeRect' || prop === 'arc') {
        return (...args: number[]) => fills.push({ op: prop, style: prop === 'strokeRect' ? target.strokeStyle : target.fillStyle, alpha: target.globalAlpha as number, args });
      }
      return prop in target ? target[prop] : () => {};
    },
    set: (target, prop: string, value) => ((target[prop] = value), true),
  }) as unknown as CanvasRenderingContext2D;
  const draw = () => new IntentOverlay().renderSurfaces(ctx, engine, camera, 32, 0, 0);
  const screen = (x: number, y: number) => camera.worldToScreen(x, y, 32, 0, 0)!;
  return { engine, ctx, fills, draw, screen };
}

describe('surface and gas art comes from the pack', () => {
  it("calls the pack's art for each surface and gas, at the cell's place, with the clock", () => {
    const oil = vi.fn();
    const cloud = vi.fn();
    const { engine, ctx, draw, screen } = setup({ 'surface~oil_slick': oil, 'gas~poison_cloud': cloud });
    engine.surfaces.setSurface(6, 5, 'oil_slick');
    engine.surfaces.setGas(6, 5, 'poison_cloud');
    vi.spyOn(Date, 'now').mockReturnValue(123_456);
    draw();
    vi.restoreAllMocks();

    const at = screen(6, 5);
    for (const art of [oil, cloud]) {
      expect(art).toHaveBeenCalledTimes(1);
      const [given, ...args] = art.mock.calls[0];
      expect(given).toBe(ctx);
      expect(args).toEqual([at.x, at.y, 32, { x: 6, y: 5, now: 123_456 }]);
    }
  });

  it('shows a surface and a gas the pack draws no art for, in the theme roles', () => {
    const { engine, fills, draw, screen } = setup({});
    const theme = resolveThemeTokens(engine.manifest?.theme);
    engine.surfaces.setSurface(7, 5, 'brimstone');
    engine.surfaces.setGas(8, 5, 'miasma' as GasType);
    draw();

    const ground = screen(7, 5);
    const wash = fills.find((f) => f.op === 'fillRect' && f.args[0] === ground.x + 1 && f.args[1] === ground.y + 1);
    expect(wash).toMatchObject({ style: theme.warn });
    expect(wash!.alpha).toBeGreaterThan(0);
    expect(wash!.alpha).toBeLessThan(1);

    const air = screen(8, 5);
    const cloud = fills.find((f) => f.op === 'arc' && f.args[0] === air.x + 16 && f.args[1] === air.y + 16);
    expect(cloud).toMatchObject({ style: theme.textSoft });
  });

  it('draws the neutral art for every type of a pack with no overlays at all', () => {
    const { engine, fills, draw } = setup(undefined);
    for (const [i, type] of ['water', 'oil_slick', 'acid_pool', 'ice_sheet', 'mud', 'fire'].entries()) engine.surfaces.setSurface(2 + i, 3, type);
    for (const [i, type] of (['fire_storm', 'poison_cloud', 'dense_steam'] as const).entries()) engine.surfaces.setGas(2 + i, 7, type);
    draw();
    expect(fills.filter((f) => f.op === 'fillRect')).toHaveLength(6);
    expect(fills.filter((f) => f.op === 'arc')).toHaveLength(3);
  });

  it('leaves the context as it found it, whatever the art changes', () => {
    const { engine, ctx, draw } = setup({
      'surface~mud': (c) => {
        const g = c as CanvasRenderingContext2D;
        g.globalAlpha = 0.1;
        g.fillStyle = 'red';
      },
    });
    engine.surfaces.setSurface(6, 5, 'mud');
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'blue';
    draw();
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.fillStyle).toBe('blue');
  });
});
