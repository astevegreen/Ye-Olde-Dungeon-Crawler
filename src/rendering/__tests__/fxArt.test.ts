import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasFXRunner } from '../fxRunner';
import { Camera } from '../camera';
import { TargetingOverlay } from '../targeting-overlay';
import { GameEngine, GameMap, Player } from '../../engine';
import type { FxSurface, GameContentManifest, SpellDefinition, SpellFxArt, SpellFxCatalog, VisualEffectDescriptor } from '../../engine';

/**
 * Drawn spell and melee art (`SpellFxCatalog`): the runner plays the pack's bolt along the
 * flight, its impact where it lands, its self cast on the caster and melee blows on their
 * target, in world pixels, holding input no longer than the generic shapes did (§4).
 */

type Call = { what: string; args: number[]; tx: number; ty: number };

/** Art that records each draw with the translation the context had when it ran. */
function recordingArt(calls: Call[], ms = { msBolt: 400, msImpact: 800, msSelf: 1000 }): SpellFxArt {
  const at = (ctx: FxSurface) => (ctx as unknown as { tx: number; ty: number });
  return {
    bolt: (ctx, x0, y0, x1, y1, p) => calls.push({ what: 'bolt', args: [x0, y0, x1, y1, p], ...pos(at(ctx)) }),
    impact: (ctx, x, y, p) => calls.push({ what: 'impact', args: [x, y, p], ...pos(at(ctx)) }),
    self: (ctx, x, y, p) => calls.push({ what: 'self', args: [x, y, p], ...pos(at(ctx)) }),
    ...ms,
  };
}
const pos = (c: { tx: number; ty: number }) => ({ tx: c.tx, ty: c.ty });

function catalog(calls: Call[]): SpellFxCatalog {
  return {
    elements: { fire: recordingArt(calls) },
    melee: {
      hit: (_c, x, y, p, _cs, dir) => calls.push({ what: 'hit', args: [x, y, p, ...dir], tx: 0, ty: 0 }),
      crit: (_c, x, y, p) => calls.push({ what: 'crit', args: [x, y, p], tx: 0, ty: 0 }),
      miss: (_c, x, y, p) => calls.push({ what: 'miss', args: [x, y, p], tx: 0, ty: 0 }),
      ms: 300,
    },
  };
}

/** A context that tracks its translation through save/restore; every other call is a no-op. */
function mockContext(): CanvasRenderingContext2D {
  const state = { tx: 0, ty: 0, stack: [] as Array<[number, number]> };
  const target: Record<string, unknown> = {
    canvas: { width: 800, height: 600 },
    save: () => state.stack.push([state.tx, state.ty]),
    restore: () => {
      const top = state.stack.pop();
      if (top) [state.tx, state.ty] = top;
    },
    translate: (x: number, y: number) => {
      state.tx += x;
      state.ty += y;
    },
  };
  return new Proxy(target, {
    get(t, prop: string) {
      if (prop === 'tx') return state.tx;
      if (prop === 'ty') return state.ty;
      if (prop in t) return t[prop];
      return () => ({ addColorStop: () => {} });
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('CanvasFXRunner with pack art', () => {
  let frames: Array<(t: number) => void>;
  let clock: number;
  let calls: Call[];
  let runner: CanvasFXRunner;
  const ctx = mockContext();
  const camera = new Camera(25, 18);
  const CS = 32;

  /** Plays `ms` of frames, rendering each, and returns the calls made in that span. */
  const play = (ms: number): Call[] => {
    const from = calls.length;
    const end = clock + ms;
    while (clock < end) {
      clock += 16;
      const due = frames;
      frames = [];
      for (const f of due) f(clock);
      runner.render(ctx, camera, CS, 0, 0);
    }
    return calls.slice(from);
  };

  beforeEach(() => {
    frames = [];
    clock = 1000;
    calls = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    camera.startX = 0;
    camera.startY = 0;
    runner = new CanvasFXRunner({ mode: 'smooth', art: () => catalog(calls) });
  });
  afterEach(() => {
    runner.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const bolt = (extra: Partial<Extract<VisualEffectDescriptor, { type: 'projectile' }>> = {}): VisualEffectDescriptor => ({
    type: 'projectile',
    origin: { x: 1, y: 1 },
    path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
    color: '#f80',
    fx: 'fire',
    stepDelayMs: 20,
    ...extra,
  });

  it('flies the bolt from the caster to the last cell, then lands its impact there', async () => {
    let settled = false;
    void runner.playQueue([bolt()]).then(() => (settled = true));
    const flight = 20 * 1.75 * 3;
    const during = play(flight - 20).filter((c) => c.what === 'bolt');
    expect(during.length).toBeGreaterThan(3);
    const [x0, y0, x1, y1] = during[0].args;
    expect([x0, y0, x1, y1]).toEqual([1.5 * CS, 1.5 * CS, 4.5 * CS, 1.5 * CS]);
    const ps = during.map((c) => c.args[4]);
    expect(ps).toEqual([...ps].sort((a, b) => a - b));
    expect(settled).toBe(false);

    const after = play(400);
    const impacts = after.filter((c) => c.what === 'impact');
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts[0].args.slice(0, 2)).toEqual([4.5 * CS, 1.5 * CS]);
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('holds input for the first 250 ms of an impact only, and plays the rest as ambient', async () => {
    let settledAt = 0;
    void runner.playQueue([bolt()]).then(() => (settledAt = clock));
    const flightEnd = clock + 20 * 1.75 * 3;
    for (let i = 0; i < 200 && !settledAt; i++) {
      play(16);
      await Promise.resolve();
    }
    // Settles about 250 ms after landing (a frame or two of slack either side).
    expect(settledAt - flightEnd).toBeGreaterThan(250 - 40);
    expect(settledAt - flightEnd).toBeLessThan(250 + 50);
    // The impact keeps drawing after input is free, to the end of its 800 ms.
    const tail = play(400).filter((c) => c.what === 'impact');
    expect(tail.length).toBeGreaterThan(0);
    expect(tail[tail.length - 1].args[2]).toBeLessThanOrEqual(1);
    expect(play(400).filter((c) => c.what === 'impact').length).toBeLessThan(tail.length);
  });

  it('a fireball lands in its burst: the burst draws the impact, the flight draws none of its own', () => {
    void runner.playQueue([
      bolt(),
      { type: 'burst', epicenter: { x: 4, y: 1 }, radius: 1, color: '#f80', fx: 'fire', durationMs: 250, style: 'flame' },
    ]);
    const drawn = play(1500).filter((c) => c.what === 'impact');
    // One impact's worth of frames, at the epicentre, not two overlapping ones.
    const starts = drawn.filter((c, i) => i === 0 || c.args[2] < drawn[i - 1].args[2]);
    expect(starts).toHaveLength(1);
    expect(drawn[0].args.slice(0, 2)).toEqual([4.5 * CS, 1.5 * CS]);
  });

  it('a flight that does not land on a burst keeps its impact when a self cast shares its batch', () => {
    void runner.playQueue([bolt(), { type: 'burst', epicenter: { x: 9, y: 9 }, radius: 1, color: '#f80', fx: 'fire', durationMs: 200, style: 'aura' }]);
    const drawn = play(2000);
    expect(drawn.some((c) => c.what === 'impact' && c.args[0] === 4.5 * CS)).toBe(true);
    expect(drawn.some((c) => c.what === 'self' && c.args[0] === 9.5 * CS)).toBe(true);
  });

  it('follows each straight stretch of a bouncing flight', () => {
    void runner.playQueue([
      bolt({
        path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 1, isReflection: true }, { x: 2, y: 2 }, { x: 1, y: 3 }],
        stepDelayMs: 30,
      }),
    ]);
    const legs = new Set(play(30 * 1.75 * 5).filter((c) => c.what === 'bolt').map((c) => c.args.slice(0, 4).join(',')));
    expect([...legs]).toEqual([
      [1.5, 1.5, 3.5, 1.5].map((v) => v * CS).join(','),
      [3.5, 1.5, 1.5, 3.5].map((v) => v * CS).join(','),
    ]);
  });

  it('draws in world pixels: the context is translated by the camera', () => {
    camera.startX = 3;
    camera.startY = 2;
    void runner.playQueue([bolt()]);
    const first = play(32).find((c) => c.what === 'bolt')!;
    expect([first.tx, first.ty]).toEqual([-3 * CS, -2 * CS]);
    expect(first.args[0]).toBe(1.5 * CS);
  });

  it('plays melee blows on the target, struck from the attacker, without holding anything', () => {
    runner.playMelee('hit', { x: 5, y: 5 }, [1, 0]);
    runner.playMelee('miss', { x: 6, y: 5 }, [0, -1]);
    expect(runner.isPlaying).toBe(false);
    const drawn = play(320);
    const hit = drawn.filter((c) => c.what === 'hit');
    expect(hit[0].args).toEqual([5.5 * CS, 5.5 * CS, expect.any(Number), 1, 0]);
    expect(drawn.some((c) => c.what === 'miss')).toBe(true);
    expect(play(100)).toHaveLength(0);
  });

  it('an ambient effect still playing does not hold a tactical batch', async () => {
    runner.playMelee('crit', { x: 5, y: 5 }, [1, 0]);
    runner.playAmbient([{ type: 'screen_flash', color: '#fff', durationMs: 2000 }]);
    let settled = false;
    void runner.playEffects([{ type: 'chain_link', from: { x: 1, y: 1 }, to: { x: 3, y: 1 }, color: '#ff0', fx: 'fire', durationMs: 20 }]).then(() => (settled = true));
    for (let i = 0; i < 40 && !settled; i++) {
      play(16);
      await Promise.resolve();
    }
    expect(settled).toBe(true);
  });

  it('draws the generic shapes for an effect the pack has no art for, and no melee without melee art', () => {
    runner.destroy();
    runner = new CanvasFXRunner({ mode: 'smooth', art: () => ({ elements: {} }) });
    void runner.playQueue([bolt({ fx: 'physical' })]);
    runner.playMelee('hit', { x: 1, y: 1 }, [1, 0]);
    expect(play(400)).toHaveLength(0);
  });
});

describe('the targeting overlay after a cast', () => {
  const BOLT = {
    id: 'test_bolt', name: 'Test Bolt', manaCost: 3, targetType: 'ray', range: 6,
    element: 'fire', areaOfEffect: 0, reflects: false, effects: [],
  } as unknown as SpellDefinition;

  function fire(spellFx?: SpellFxCatalog): TargetingOverlay {
    const manifest = { id: 'test', name: 'Test', spellFx } as unknown as GameContentManifest;
    const engine = new GameEngine({ map: new GameMap(20, 20), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }), manifest });
    const targeting = new TargetingOverlay();
    targeting.startTargeting({ key: '', type: 'spell', id: BOLT.id, name: BOLT.name, spellDef: BOLT }, engine);
    targeting.confirmFire(engine);
    return targeting;
  }

  it('leaves no after-image over a spell the pack draws, and keeps it for one it does not', () => {
    expect(fire({ elements: { fire: { msBolt: 300, msImpact: 600 } } }).lastFired).toBeUndefined();
    expect(fire({ elements: { cold: { msBolt: 300, msImpact: 600 } } }).lastFired).toBeDefined();
    expect(fire().lastFired).toBeDefined();
  });
});
