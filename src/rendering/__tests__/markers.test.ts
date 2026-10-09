import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { IntentOverlay } from '../intentOverlay';
import { Camera } from '../camera';
import { IDLE_FRAME_MS } from '../atlas/idle-frames';
import { drawDangerZone, drawHostileBrackets, drawHpBar, drawSensedCreature, drawSensedItem } from '../markers/markers';
import { resolveThemeTokens } from '../theme';
import { GameEngine, GameMap, TILES, Player, Monster } from '../../engine';

interface Call {
  op: string;
  args: unknown[];
  stroke: unknown;
  fill: unknown;
}

/** A 2D context that records every call with the colours set when it was made. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { canvas: { width: 960, height: 600 } };
  const ctx = new Proxy(state, {
    get: (target, prop) => {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop.startsWith('create')) return () => ({ addColorStop: () => {} });
      return (...args: unknown[]) => {
        calls.push({ op: prop, args, stroke: target.strokeStyle, fill: target.fillStyle });
      };
    },
    set: (target, prop: string, value) => ((target[prop] = value), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

/** Each moveTo followed by a lineTo, as [x0, y0, x1, y1]. */
function segments(calls: readonly Call[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 1 < calls.length; i++) {
    if (calls[i].op === 'moveTo' && calls[i + 1].op === 'lineTo') out.push([...(calls[i].args as number[]), ...(calls[i + 1].args as number[])]);
  }
  return out;
}

/** The straight sides stroked, deduplicated, as "x0,y0,x1,y1". */
function straightSides(calls: readonly Call[]): Set<string> {
  return new Set(
    segments(calls)
      .filter(([x0, y0, x1, y1]) => x0 === x1 || y0 === y1)
      .map((s) => s.join(','))
  );
}

/** Each path's points, one list a beginPath. */
function polygons(calls: readonly Call[]): number[][][] {
  const out: number[][][] = [];
  for (const c of calls) {
    if (c.op === 'beginPath') out.push([]);
    else if ((c.op === 'moveTo' || c.op === 'lineTo') && out.length > 0) out[out.length - 1].push(c.args as number[]);
  }
  return out.filter((p) => p.length > 0);
}

const theme = resolveThemeTokens(undefined);

describe('map markers', () => {
  it("brackets an enemy with four corners and ticks pinching in from the sides only, never the top, where its health sits", () => {
    const { ctx, calls } = recorder();
    drawHostileBrackets(ctx, 0, 0, 32, 0, theme);
    const polys = polygons(calls);
    expect(polys).toHaveLength(6);
    const ticks = polys.filter((p) => p.length === 3);
    expect(ticks).toHaveLength(2);
    for (const tick of ticks) {
      const cx = tick.reduce((s, p) => s + p[0], 0) / 3;
      const cy = tick.reduce((s, p) => s + p[1], 0) / 3;
      expect(Math.abs(cy - 16)).toBeLessThan(4);
      expect(Math.abs(cx - 16)).toBeGreaterThan(10);
    }
  });

  it('outlines a danger zone on its outer sides only, leaving the seam between its tiles open', () => {
    const { ctx, calls } = recorder();
    drawDangerZone(ctx, [{ x: 0, y: 0 }, { x: 32, y: 0 }], 32, 0, theme);
    expect(straightSides(calls)).toEqual(new Set(['0,0,32,0', '0,32,32,32', '0,0,0,32', '32,0,64,0', '32,32,64,32', '64,0,64,32']));
  });

  it("shows an ally's health as a round pill and an enemy's as a slanted bar, in their own colours", () => {
    const ally = recorder();
    drawHpBar(ally.ctx, 0, 0, 32, 0.5, 'ally', theme);
    expect(ally.calls.some((c) => c.op === 'arc')).toBe(true);
    expect(ally.calls.some((c) => c.op === 'fillRect' && c.fill === theme.hpAlly)).toBe(true);

    const enemy = recorder();
    drawHpBar(enemy.ctx, 0, 0, 32, 0.5, 'enemy', theme);
    expect(enemy.calls.some((c) => c.op === 'arc')).toBe(false);
    expect(enemy.calls.some((c) => c.op === 'fillRect' && c.fill === theme.hpEnemy)).toBe(true);
    expect(enemy.calls.some((c) => c.fill === theme.hpAlly)).toBe(false);
  });

  it('draws no health bar at full health or none', () => {
    for (const frac of [0, 1]) {
      const { ctx, calls } = recorder();
      drawHpBar(ctx, 0, 0, 32, frac, 'enemy', theme);
      expect(calls).toEqual([]);
    }
  });

  it('marks a creature sensed through a wall with a core as wide as the old mark, and ticks that close on it inside its tile', () => {
    const width = (p: number[][]): number => Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
    for (let frame = 0; frame < 5; frame++) {
      const { ctx, calls } = recorder();
      drawSensedCreature(ctx, 0, 0, 32, frame * IDLE_FRAME_MS, theme);
      const polys = polygons(calls);
      const core = polys[polys.length - 1];
      expect(width(core)).toBeGreaterThanOrEqual(18);
      const d = width(core) / 2;
      const ticks = polys.slice(0, -1);
      expect(ticks).toHaveLength(4);
      for (const [px, py] of ticks.flat()) {
        expect(px).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(32);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(py).toBeLessThanOrEqual(32);
        expect(Math.abs(px - 16) + Math.abs(py - 16)).toBeGreaterThan(d + 1);
      }
    }
  });

  it('marks an object sensed through a wall with a diamond as wide as the old mark at every breath', () => {
    for (let frame = 0; frame < 6; frame++) {
      const { ctx, calls } = recorder();
      drawSensedItem(ctx, 0, 0, 32, frame * IDLE_FRAME_MS, theme);
      const outline = polygons(calls)[0];
      expect(Math.max(...outline.map((q) => q[0])) - Math.min(...outline.map((q) => q[0]))).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('the danger zone over wind-ups', () => {
  it('joins the tiles every wind-up will strike into one zone, edged only round its outside', () => {
    const map = new GameMap(20, 12, TILES.FLOOR);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
    const stats = { hp: 10, maxHp: 10, attack: 1, defense: 0 };
    const a = new Monster({ id: 'a', name: 'A', position: { x: 6, y: 7 }, stats });
    const b = new Monster({ id: 'b', name: 'B', position: { x: 7, y: 7 }, stats });
    a.intent = { type: 'windup', targetTile: { x: 6, y: 6 }, turnsRemaining: 1 } as Monster['intent'];
    b.intent = { type: 'windup', targetTiles: [{ x: 7, y: 6 }, { x: 6, y: 6 }], turnsRemaining: 1 } as Monster['intent'];
    engine.addEntity(a);
    engine.addEntity(b);
    engine.updateFov();
    const camera = new Camera(20, 12);
    const { ctx, calls } = recorder();

    expect(new IntentOverlay().render(ctx, engine, camera, 32, 0, 0)).toBe(true);
    const at = camera.worldToScreen(6, 6, 32, 0, 0)!;
    const side = (x0: number, y0: number, x1: number, y1: number): string => [at.x + x0, at.y + y0, at.x + x1, at.y + y1].join(',');
    expect(straightSides(calls)).toEqual(
      new Set([side(0, 0, 32, 0), side(0, 32, 32, 32), side(0, 0, 0, 32), side(32, 0, 64, 0), side(32, 32, 64, 32), side(64, 0, 64, 32)])
    );

    a.intent = { type: 'idle' } as Monster['intent'];
    b.intent = { type: 'idle' } as Monster['intent'];
    expect(new IntentOverlay().render(recorder().ctx, engine, camera, 32, 0, 0)).toBe(false);
  });
});

describe('markers on the map', () => {
  let originalDocument: unknown;
  const offscreen = (): HTMLCanvasElement =>
    ({
      getContext: () => recorder().ctx,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
      width: 960,
      height: 600,
      style: {},
    }) as unknown as HTMLCanvasElement;

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { createElement: () => offscreen() };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  const hurt = { hp: 5, maxHp: 10, attack: 1, defense: 0 };

  /** A renderer over a small lit floor, the hero at (5, 5), recording its map canvas. */
  function setup(place: (engine: GameEngine) => void): { renderer: CanvasRenderer; ctx: CanvasRenderingContext2D; calls: Call[] } {
    const map = new GameMap(20, 12, TILES.FLOOR);
    const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
    place(engine);
    engine.updateFov();
    const rec = recorder();
    const canvas = { ...offscreen(), getContext: () => rec.ctx } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, engine);
    rec.calls.length = 0;
    return { renderer, ...rec };
  }

  it('rings an ally in sight under its feet before its sprite, and never a foe or the hero', () => {
    const pup = new Monster({ id: 'pup', name: 'Pup', position: { x: 6, y: 5 }, stats: hurt, faction: 'player' });
    const { renderer, ctx, calls } = setup((engine) => {
      engine.addEntity(pup);
      engine.addEntity(new Monster({ id: 'rat', name: 'Rat', position: { x: 8, y: 5 }, stats: hurt }));
    });
    const pupKey = (renderer as unknown as { entitySpriteKey: (e: Monster) => string }).entitySpriteKey(pup);
    const atlas = (renderer as unknown as { atlas: { drawSprite: (...a: unknown[]) => void } }).atlas;
    const draw = atlas.drawSprite.bind(atlas);
    vi.spyOn(atlas, 'drawSprite').mockImplementation((...args: unknown[]) => {
      if (args[0] === ctx) calls.push({ op: 'sprite', args, stroke: null, fill: null });
      draw(...args);
    });
    renderer.render();

    const cs = (renderer as unknown as { cellSize: number }).cellSize;
    const ring = calls
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.op === 'ellipse' && calls[i + 1]?.op === 'stroke' && calls[i + 1].stroke === theme.ally);
    expect(ring).toHaveLength(4);
    const centres = new Set(ring.map(({ c }) => `${c.args[0]}`));
    expect(centres.size).toBe(1);
    const allySprite = calls.findIndex((c) => c.op === 'sprite' && c.args[1] === pupKey && (c.args[2] as number) + cs / 2 === ring[0].c.args[0]);
    expect(allySprite).toBeGreaterThan(ring[3].i);
    expect(calls[allySprite].args[3] as number).toBeCloseTo((ring[0].c.args[1] as number) - cs * 0.87);

    // Hurt, the ally's bar is the ally's colour and the foe's the enemy's.
    expect(calls.some((c) => c.op === 'fillRect' && c.fill === theme.hpAlly)).toBe(true);
    expect(calls.some((c) => c.op === 'fillRect' && c.fill === theme.hpEnemy)).toBe(true);
    renderer.destroy();
  });

  it('holds every marker still under Reduce motion, and moves them otherwise', () => {
    const trace = (motion: boolean, now: number): string => {
      const { renderer, calls } = setup((engine) => {
        engine.addEntity(new Monster({ id: 'pup', name: 'Pup', position: { x: 6, y: 5 }, stats: hurt, faction: 'player' }));
        const brute = new Monster({ id: 'brute', name: 'Brute', position: { x: 8, y: 5 }, stats: hurt });
        brute.intent = { type: 'windup', targetTiles: [{ x: 7, y: 5 }, { x: 7, y: 6 }], turnsRemaining: 1 } as Monster['intent'];
        engine.addEntity(brute);
      });
      renderer.idleMotion = motion;
      const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
      renderer.render();
      clock.mockRestore();
      renderer.destroy();
      return JSON.stringify(calls.map((c) => [c.op, c.args.map((a) => (typeof a === 'object' ? typeof a : a)), c.stroke, c.fill]));
    };
    const t0 = 1_000_000 * IDLE_FRAME_MS;
    expect(trace(false, t0)).toBe(trace(false, t0 + IDLE_FRAME_MS));
    expect(trace(true, t0)).not.toBe(trace(true, t0 + IDLE_FRAME_MS));
  });
});
