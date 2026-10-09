import type { FxSurface } from '../../../engine';
import { clamp, hash2, hex, type Rgb } from '../sprites/sculpt/kit';

/**
 * The drawing kit under the spell and melee art, ported from the style bible's FX module
 * (hearth style). Every effect is a pure function of its inputs: p (0-1 progress over the
 * effect's life), cs (tile size in px), tile-centre positions in px. No clock and no random
 * numbers: per-particle variety comes from `hash2` seeded by the tile, flicker from p
 * quantised to retro frames.
 *
 * Effects work in game units (1 unit = cs/32 px, one art pixel at 32 px tiles) and snap every
 * particle to that lattice, so they sit on the sprites' pixel grid. Each element is told apart
 * by SHAPE and MOTION before colour:
 *   fire rises and flickers      frost sinks and settles     lightning blinks
 *   poison arcs, drips, bubbles  arcane orbits and turns     holy falls as rays, rises as motes
 *   shadow pulls inward, and is the only effect darker than what it touches.
 * Gold helps, violet harms.
 */

export type Pt = [number, number];

export const TAU = Math.PI * 2;
export const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const seg = (p: number, a: number, b: number): number => sat((p - a) / (b - a));
export const eOut = (t: number): number => 1 - (1 - t) * (1 - t);
export const eOut3 = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const eIn = (t: number): number => t * t;
export const bell = (t: number): number => Math.sin(Math.PI * sat(t));
/** Seeded hash of two numbers, truncated to integers first. */
export const H = (a: number, b: number): number => hash2(a | 0, b | 0);

// ------------------------------------------------------------------ colour

/** An element's three tones: the bright core, the body, the rim. */
export interface Tones {
  core: string;
  mid: string;
  edge: string;
}

export const FALL = {
  fire: { core: '#fff1c2', mid: '#ff8a2c', edge: '#c2361a' },
  frost: { core: '#f2fdff', mid: '#9fe6ff', edge: '#2f78b8' },
  lightning: { core: '#ffffff', mid: '#fff27a', edge: '#d8a414' },
  poison: { core: '#e2ff9a', mid: '#95dc4c', edge: '#3d6b1a' },
  arcane: { core: '#e6f1ff', mid: '#6aa6ff', edge: '#2a45b8' },
  holy: { core: '#ffffff', mid: '#ffe9b0', edge: '#e0a83a' },
  unholy: { core: '#160a26', mid: '#a868ff', edge: '#d7c2ff' },
  chaos: { core: '#ffffff', mid: '#e05cff', edge: '#35e0c8' },
  physical: { core: '#ffffff', mid: '#e6edf5', edge: '#8a96a8' },
} satisfies Record<string, Tones>;

/** Supporting tones that sit inside each element's family. */
export const X = {
  fireHot: '#ffd27a',
  fireDeep: '#d8601c',
  smoke: '#2b2226',
  scorch: '#100906',
  mist: '#d6f3ff',
  rimeDeep: '#5fb4dc',
  bile: '#5fa032',
  bileDark: '#23400e',
  holyGold: '#f0c062',
  voidDeep: '#07030d',
  blood: '#a3141e',
  bloodLit: '#e2414a',
  steelGrey: '#8a96a8',
  steelPale: '#c9d1dd',
  ember: '#ff5a2a',
};

const RGB = new Map<string, Rgb>();
function rgba(h: string, a: number): string {
  let c = RGB.get(h);
  if (!c) {
    c = hex(h);
    RGB.set(h, c);
  }
  return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
}

// ------------------------------------------------------------------ seeds

/** Per-tile seed: the same spell on the same tile always draws the same. */
export const seedAt = (x: number, y: number, cs: number): number =>
  ((Math.round((x / cs) * 2) * 92821) ^ (Math.round((y / cs) * 2) * 68917)) & 0x7fff;
export const seed2 = (x0: number, y0: number, x1: number, y1: number, cs: number): number =>
  (seedAt(x0, y0, cs) * 31 + seedAt(x1, y1, cs)) & 0x7fff;

/** Bolt geometry in game units, lifted from the feet line to chest height. */
export function flight(x0: number, y0: number, x1: number, y1: number, cs: number, lift = -3) {
  const u = cs / 32,
    ax = x0 / u,
    ay = y0 / u + lift,
    bx = x1 / u,
    by = y1 / u + lift;
  const dx = bx - ax,
    dy = by - ay,
    D = Math.hypot(dx, dy);
  return { u, ax, ay, bx, by, dx, dy, D: D || 1, ux: D > 0.5 ? dx / D : 1, uy: D > 0.5 ? dy / D : 0 };
}

// ------------------------------------------------------------------ the pen

/**
 * Draws on the art-pixel lattice. Positions are in game units (map pixels / u). Every method
 * returns the pen so calls chain.
 */
export interface Pen {
  readonly ctx: FxSurface;
  /** Pixels per game unit. */
  readonly u: number;
  col(c: string): Pen;
  alpha(a: number): Pen;
  /** n-unit square particle centred on (x, y). */
  dot(x: number, y: number, n?: number): Pen;
  cell(gx: number, gy: number, w?: number, h?: number): Pen;
  /** Horizontal run from x0 to x1 on the row holding y. */
  span(x0: number, x1: number, y: number): Pen;
  disc(x: number, y: number, r: number): Pen;
  ell(x: number, y: number, rx: number, ry: number): Pen;
  /** Bresenham line, n-unit brush. */
  line(xa: number, ya: number, xb: number, yb: number, n?: number): Pen;
  poly(pts: readonly Pt[], n?: number): Pen;
  /** One-unit elliptical ring between angles a0..a1 (deduplicated cells). */
  ring(x: number, y: number, rx: number, ry: number, a0?: number, a1?: number, every?: number): Pen;
  /** Additive light. */
  glow(x: number, y: number, r: number, c: string, a: number): Pen;
  /** Additive light pooled on the floor (an ellipse). */
  fglow(x: number, y: number, rx: number, ry: number, c: string, a: number): Pen;
  /** Subtractive dark: the shadow element's halo. */
  shade(x: number, y: number, rx: number, ry: number, c: string, a: number): Pen;
}

export function pen(ctx: FxSurface, cs: number): Pen {
  const u = cs / 32;
  const P: Pen = {
    ctx,
    u,
    col(c) {
      ctx.fillStyle = c;
      return P;
    },
    alpha(a) {
      ctx.globalAlpha = clamp(a, 0, 1);
      return P;
    },
    dot(x, y, n = 1) {
      ctx.fillRect(Math.round(x - n / 2) * u, Math.round(y - n / 2) * u, n * u, n * u);
      return P;
    },
    cell(gx, gy, w = 1, h = 1) {
      ctx.fillRect(gx * u, gy * u, w * u, h * u);
      return P;
    },
    span(x0, x1, y) {
      const a = Math.round(x0);
      let b = Math.round(x1);
      if (b <= a) b = a + 1;
      ctx.fillRect(a * u, Math.floor(y) * u, (b - a) * u, u);
      return P;
    },
    disc(x, y, r) {
      return P.ell(x, y, r, r);
    },
    ell(x, y, rx, ry) {
      if (rx <= 0 || ry <= 0) return P;
      if (rx < 0.62 && ry < 0.62) return P.dot(x, y, 1);
      const y0 = Math.floor(y - ry),
        y1 = Math.ceil(y + ry);
      for (let gy = y0; gy <= y1; gy++) {
        const t = (gy + 0.5 - y) / ry,
          w2 = 1 - t * t;
        if (w2 < 0) continue;
        const hw = rx * Math.sqrt(w2),
          a = Math.round(x - hw),
          b = Math.round(x + hw);
        if (b > a) ctx.fillRect(a * u, gy * u, (b - a) * u, u);
      }
      return P;
    },
    line(xa, ya, xb, yb, n = 1) {
      let x0 = Math.floor(xa),
        y0 = Math.floor(ya);
      const x1 = Math.floor(xb),
        y1 = Math.floor(yb);
      const dx = Math.abs(x1 - x0),
        dy = -Math.abs(y1 - y0),
        sx = x0 < x1 ? 1 : -1,
        sy = y0 < y1 ? 1 : -1,
        o = n >> 1;
      let err = dx + dy;
      for (let i = 0; i < 600; i++) {
        ctx.fillRect((x0 - o) * u, (y0 - o) * u, n * u, n * u);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
      return P;
    },
    poly(pts, n = 1) {
      for (let i = 1; i < pts.length; i++) P.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], n);
      return P;
    },
    ring(x, y, rx, ry, a0 = 0, a1 = TAU, every = 1) {
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * 1.5));
      const seen = new Set<number>();
      let k = 0;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const gx = Math.floor(x + Math.cos(a) * rx),
          gy = Math.floor(y + Math.sin(a) * ry),
          key = gx * 8192 + gy;
        if (seen.has(key)) continue;
        seen.add(key);
        if (k++ % every === 0) ctx.fillRect(gx * u, gy * u, u, u);
      }
      return P;
    },
    glow(x, y, r, c, a) {
      if (a <= 0.004) return P;
      const R = r * u,
        X0 = x * u,
        Y0 = y * u;
      const gr = ctx.createRadialGradient(X0, Y0, 0, X0, Y0, R);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(0.35, rgba(c, a * 0.5));
      gr.addColorStop(1, rgba(c, 0));
      const op = ctx.globalCompositeOperation,
        ga = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.fillStyle = gr;
      ctx.fillRect(X0 - R, Y0 - R, 2 * R, 2 * R);
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = ga;
      return P;
    },
    fglow(x, y, rx, ry, c, a) {
      if (a <= 0.004) return P;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.translate(x * u, y * u);
      ctx.scale(1, ry / rx);
      const R = rx * u,
        gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(0.5, rgba(c, a * 0.4));
      gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(-R, -R, 2 * R, 2 * R);
      ctx.restore();
      return P;
    },
    shade(x, y, rx, ry, c, a) {
      if (a <= 0.004) return P;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(x * u, y * u);
      ctx.scale(1, ry / rx);
      const R = rx * u,
        gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, rgba(c, a));
      gr.addColorStop(0.55, rgba(c, a * 0.7));
      gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(-R, -R, 2 * R, 2 * R);
      ctx.restore();
      return P;
    },
  };
  return P;
}

/** Small plus-shaped twinkle: the shared "glint" mark. */
export function twinkle(P: Pen, x: number, y: number, arm: number, cCore: string, cArm: string): void {
  P.col(cArm);
  for (let i = 1; i <= arm; i++) {
    P.dot(x - i, y);
    P.dot(x + i, y);
    P.dot(x, y - i);
    P.dot(x, y + i);
  }
  P.col(cCore).dot(x, y);
}

/** Jagged lightning polyline by midpoint displacement: jags at every scale, like the real thing. */
export function zig(sd: number, ax: number, ay: number, bx: number, by: number, segLen: number, amp: number): Pt[] {
  const D = Math.hypot(bx - ax, by - ay);
  let pts: Pt[] = [
    [ax, ay],
    [bx, by],
  ];
  let disp = Math.min(D * 0.17, amp * 3);
  for (let level = 0; level < 9; level++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        L = Math.hypot(dx, dy);
      if (L > segLen) {
        const o = (H(sd + level * 131, i) - 0.5) * 2 * disp;
        next.push([(a[0] + b[0]) / 2 - (dy / L) * o, (a[1] + b[1]) / 2 + (dx / L) * o]);
      }
      next.push(b);
    }
    if (next.length === pts.length) break;
    pts = next;
    disp *= 0.56;
  }
  return pts;
}

/** Side branches off a zigzag: `count` of them, each its own jagged line. */
export function forks(sd: number, pts: readonly Pt[], count: number, len: number, amp: number): Pt[][] {
  const out: Pt[][] = [];
  for (let k = 0; k < count; k++) {
    const i = 1 + Math.floor(H(sd, 70 + k) * (pts.length - 2));
    const a = pts[i],
      b = pts[Math.min(pts.length - 1, i + 1)];
    const base = Math.atan2(b[1] - a[1], b[0] - a[0]) + (H(sd, 80 + k) < 0.5 ? -1 : 1) * (0.55 + 0.45 * H(sd, 90 + k));
    const L = len * (0.6 + 0.6 * H(sd, 100 + k));
    out.push(zig(sd + 31 * (k + 1), a[0], a[1], a[0] + Math.cos(base) * L, a[1] + Math.sin(base) * L, 2.6, amp));
  }
  return out;
}

/** A bolt stroke. Level 2 = full stroke (mid fringe + white core), 1 = core only, 0 = dim afterimage. */
export function bolt3(P: Pen, pts: readonly Pt[], c: Tones, level: number): void {
  if (level >= 2) {
    P.col(c.mid);
    P.poly(pts, 2);
  }
  P.col(level >= 1 ? c.core : c.edge);
  P.poly(pts, 1);
}

// 3-wide x 4-tall rune marks (arcane circles)
const RUNES = [
  ['#.#', '.#.', '.#.', '.#.'],
  ['.#.', '#.#', '.#.', '#.#'],
  ['#..', '##.', '#.#', '#..'],
  ['.#.', '###', '.#.', '.#.'],
  ['##.', '#.#', '##.', '#.#'],
  ['.##', '.#.', '##.', '#..'],
  ['#.#', '#.#', '.#.', '#.#'],
  ['###', '#..', '##.', '#..'],
];
export function rune(P: Pen, x: number, y: number, i: number): void {
  const R = RUNES[((i % RUNES.length) + RUNES.length) % RUNES.length];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) if (R[r][c] === '#') P.dot(x - 1 + c, y - 2 + r);
}
