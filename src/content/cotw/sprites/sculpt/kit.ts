/**
 * Sculpt: the cotw drawing kit for figures (heroes, creatures, items), "Hearth-lit".
 *
 * A model is `(frame, variant) => primitives` on the 32-unit sprite grid (x right, y down,
 * feet near y 28-29). `bake()` rasterises it straight into the atlas cell's final pixels:
 * every pixel takes the front-most primitive's surface normal, the upper-left key light and
 * the model's own point lights, banded into five hue-shifted tones, then occlusion lines, a
 * coloured outline, a rim from a side light and the glow of emissive parts. The atlas's own
 * shading and outline passes skip these cells (`PixelSprite`).
 *
 * Pure: no DOM, no clock, no randomness. Same model, frame and variant, same pixels.
 */

export type Rgb = [number, number, number];

// ---------------------------------------------------------------- colour

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function hex(h: string): Rgb {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mixc = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function rgb2hsl([r, g, b]: Rgb): Rgb {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hsl2rgb([h, s, l]: Rgb): Rgb {
  h = ((((h % 360) + 360) % 360) / 360);
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number): number => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function towardHue(h: number, target: number, amt: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return h + clamp(d, -amt, amt);
}

export interface RampOptions {
  /** Hue shift in degrees across the ramp (shadows toward cold, lights toward warm). */
  hs?: number;
}

/**
 * A material's six tones, index 0-5: outline, deep shadow, shadow, base, light, highlight.
 * Shadows slide toward cold blue-violet and gain saturation; lights slide toward warm gold
 * and lose it, so shading never reads as the base colour mixed with black.
 */
export function ramp(base: string | Rgb, o: RampOptions = {}): Rgb[] {
  const [h, s, l] = rgb2hsl(typeof base === 'string' ? hex(base) : base);
  const hs = o.hs ?? 18;
  const cold = 245;
  const warm = 50;
  const out: Rgb[] = [];
  for (let i = 0; i < 6; i++) {
    const k = i - 3;
    let hh = h;
    let ss = s;
    let ll = l;
    if (k < 0) {
      ll = l * (1 - 0.19 * -k);
      hh = towardHue(h, cold, (hs * -k) / 3);
      ss = clamp(s + 0.05 * -k, 0, 1);
    } else if (k > 0) {
      ll = l + (1 - l) * (k === 1 ? 0.22 : 0.46);
      hh = towardHue(h, warm, (hs * 0.6 * k) / 2);
      ss = clamp(s - 0.06 * k, 0, 1);
    }
    if (i === 0) {
      ll = Math.max(0.035, l * 0.22);
      ss = s * 0.75;
      hh = towardHue(h, cold, hs * 1.5);
    }
    out.push(hsl2rgb([hh, ss, ll]));
  }
  return out;
}

// ---------------------------------------------------------------- materials

export type Texture = 'fur' | 'mail' | 'stone' | 'scale' | 'wood' | 'bark' | 'cloth' | 'ice' | 'rot';

export interface Material {
  name: string;
  /** Six tones, outline to highlight. */
  r: Rgb[];
  /** Lit from within: ignores the key light and bleeds glow past the outline. */
  em: boolean;
  /** Takes a specular highlight. */
  shiny: boolean;
  tex: Texture | null;
  /** Opacity, for mist and ghosts. */
  a: number;
}

export interface MaterialOptions extends RampOptions {
  em?: boolean;
  shiny?: boolean;
  tex?: Texture;
  a?: number;
}

const MAT: Record<string, Material> = Object.create(null);

/** Registers a material by name; models refer to materials by these names. */
export function mat(name: string, base: string, o: MaterialOptions = {}): Material {
  MAT[name] = { name, r: ramp(base, o), em: !!o.em, shiny: !!o.shiny, tex: o.tex ?? null, a: o.a ?? 1 };
  return MAT[name];
}

/** A variant's palette swap: another material's name, a base colour, or a colour with options. */
export type PaletteSwap = string | ({ base: string } & MaterialOptions);

export interface Variant {
  /** Recolours materials by name, e.g. `{ furGrey: 'furBrown' }` or `{ furGrey: '#5a4a3a' }`. */
  pal?: Record<string, PaletteSwap>;
}

function resolve(m: string, v?: Variant): Material {
  const sw = v?.pal?.[m];
  if (sw) {
    if (typeof sw === 'string' && MAT[sw]) return MAT[sw];
    const key = `${m}@${typeof sw === 'string' ? sw : JSON.stringify(sw)}`;
    if (!MAT[key]) {
      const src = MAT[m];
      const o: MaterialOptions = typeof sw === 'string' ? {} : sw;
      const base = typeof sw === 'string' ? sw : sw.base;
      mat(key, base, {
        em: o.em ?? src?.em,
        shiny: o.shiny ?? src?.shiny,
        tex: o.tex ?? src?.tex ?? undefined,
        a: o.a ?? src?.a,
        hs: o.hs,
      });
    }
    return MAT[key];
  }
  const found = MAT[m];
  if (!found) throw new Error(`Sculpt: unknown material ${m}`);
  return found;
}

// ---------------------------------------------------------------- primitives

/** Options shared by the drawn primitives. */
export interface PrimOptions {
  /** Ellipse rotation in radians. */
  a?: number;
  /** Flatten 0-1: 0 is a full dome, 1 a flat disc facing the viewer. */
  fl?: number;
  /** Brightness nudge, ±. */
  ink?: number;
  /** false: no occlusion line where it meets parts behind it. */
  occ?: boolean;
  /** false: no outline grows from it. */
  ol?: boolean;
  /** false: an emissive part that casts no glow. */
  glow?: boolean;
  /** Polygon: bevel width that rounds its edges into the light. */
  bv?: number;
  /** Polygon: facing normal. */
  n?: Rgb;
  /** Mark: lit from within. */
  em?: boolean;
}

interface Ellipse extends PrimOptions { t: 'E'; cx: number; cy: number; rx: number; ry: number; m: string }
interface Capsule extends PrimOptions { t: 'K'; x1: number; y1: number; x2: number; y2: number; r1: number; r2: number; m: string }
interface Poly extends PrimOptions { t: 'P'; pts: number[]; m: string }
interface Mark extends PrimOptions { t: 'X'; x: number; y: number; w: number; h: number; c: string }
interface Light { t: 'L'; x: number; y: number; r: number; c: Rgb; k: number; z: number }
interface Shadow { t: 'S'; cx: number; cy: number; rx: number; ry: number; a: number }

export type Prim = Ellipse | Capsule | Poly | Mark | Light | Shadow;
/** What a model returns: primitives, nested freely; later entries draw in front. */
export type PrimTree = ReadonlyArray<Prim | PrimTree | null | undefined | false>;

/** Ellipsoid: bodies, heads, bellies, shields (`fl: 0.6`). */
export const E = (cx: number, cy: number, rx: number, ry: number, m: string, o: PrimOptions = {}): Prim => ({ ...o, t: 'E', cx, cy, rx, ry, m });
/** Tapered capsule: limbs, tails, necks, horns, hafts. */
export const K = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o: PrimOptions = {}): Prim => ({ ...o, t: 'K', x1, y1, x2, y2, r1, r2, m });
/** Polygon from a flat x,y list: blades, plates, cloaks, wings. */
export const P = (pts: number[], m: string, o: PrimOptions = {}): Prim => ({ ...o, t: 'P', pts, m });
/** Flat rectangle in a fixed colour: eyes, rune marks, glints. `c` is '#hex' or 'material:index'. */
export const X = (x: number, y: number, w: number, h: number, c: string, o: PrimOptions = {}): Prim => ({ ...o, t: 'X', x, y, w, h, c });
/** A point light the model casts on itself (ember core, staff gem, rune). Not drawn. */
export const Lt = (x: number, y: number, r: number, c: string, k = 0.8, z = 5): Prim => ({ t: 'L', x, y, r, c: hex(c), k, z });
/** Ground shadow ellipse under the figure. */
export const Sh = (cx: number, cy: number, rx: number, ry: number, a = 0.45): Prim => ({ t: 'S', cx, cy, rx, ry, a });

function flatten(list: PrimTree, out: Prim[] = []): Prim[] {
  for (const p of list) {
    if (!p) continue;
    if (Array.isArray(p)) flatten(p as PrimTree, out);
    else out.push(p as Prim);
  }
  return out;
}

/** How `T` moves a figure: scale about a pivot (default the feet, 16, 29), then translate, optionally mirrored. */
export interface TransformOptions {
  /** Uniform scale. */
  s?: number;
  sx?: number;
  sy?: number;
  /** Pivot; default (16, 29). */
  px?: number;
  py?: number;
  dx?: number;
  dy?: number;
  /** Mirror left to right. */
  flip?: boolean;
}

/** Scales, moves or mirrors a model's primitives: a variant drawn larger, smaller or facing the other way. */
export function T(list: PrimTree, o: TransformOptions): Prim[] {
  const px = o.px ?? 16;
  const py = o.py ?? 29;
  const sx = (o.s ?? 1) * (o.sx ?? 1) * (o.flip ? -1 : 1);
  const sy = (o.s ?? 1) * (o.sy ?? 1);
  const dx = o.dx || 0;
  const dy = o.dy || 0;
  const as = Math.abs(sx);
  const rs = (as + Math.abs(sy)) / 2;
  const mx = (x: number): number => px + (x - px) * sx + dx;
  const my = (y: number): number => py + (y - py) * sy + dy;
  return flatten(list).map((p): Prim => {
    switch (p.t) {
      case 'E': return { ...p, cx: mx(p.cx), cy: my(p.cy), rx: p.rx * as, ry: p.ry * Math.abs(sy), a: p.a ? (sx < 0 ? -p.a : p.a) : 0 };
      case 'K': return { ...p, x1: mx(p.x1), y1: my(p.y1), x2: mx(p.x2), y2: my(p.y2), r1: p.r1 * rs, r2: p.r2 * rs };
      case 'P': {
        const q: number[] = [];
        for (let i = 0; i < p.pts.length; i += 2) q.push(mx(p.pts[i]), my(p.pts[i + 1]));
        return { ...p, pts: q };
      }
      case 'X': {
        const x0 = mx(p.x);
        const x1 = mx(p.x + p.w);
        const y0 = my(p.y);
        const y1 = my(p.y + p.h);
        return { ...p, x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      }
      case 'L': return { ...p, x: mx(p.x), y: my(p.y), r: p.r * rs };
      case 'S': return { ...p, cx: mx(p.cx), cy: my(p.cy), rx: p.rx * as, ry: p.ry * Math.abs(sy) };
    }
  });
}

/** Idle-loop helpers for frame 0-3: a breath (0, .5, 1, .5) and a sway (0, 1, 0, -1). */
export const breath = (f: number): number => [0, 0.5, 1, 0.5][f % 4];
export const sway = (f: number): number => [0, 1, 0, -1][f % 4];

// ---------------------------------------------------------------- shared shapes

/** A drop falling on a 4-frame cycle from (x, y0): a bead, a stretch, falling, near the ground `len` below. */
export function drip(x: number, y0: number, len: number, f: number, ph: number, m: string, w = 0.5): Prim {
  const o = { ol: false };
  switch ((f + ph) % 4) {
    case 0: return E(x, y0 + 0.35, w * 0.8, w * 0.9, m, o);
    case 1: return E(x, y0 + 0.7, w * 0.8, w * 1.5, m, o);
    case 2: return E(x, y0 + len * 0.5, w * 0.75, w * 1.1, m, o);
    default: return E(x, y0 + len * 0.92, w * 0.7, w * 0.9, m, o);
  }
}

/** A jagged bolt from (x1, y1) to (x2, y2): `n` segments jittered by `seed`, and the joints between them. */
export function bolt(x1: number, y1: number, x2: number, y2: number, seed: number, n: number, amp: number, r: number, m: string): { prims: Prim[]; pts: Array<[number, number]> } {
  const prims: Prim[] = [];
  const pts: Array<[number, number]> = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  let px = x1;
  let py = y1;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const odd = i % 2 ? 1 : -1;
    const j = i === n ? 0 : (hash2(seed, i) - 0.5) * 2 * amp * odd + amp * 0.5 * odd;
    const qx = x1 + dx * t + nx * j;
    const qy = y1 + dy * t + ny * j;
    prims.push(K(px, py, qx, qy, r, r, m, { occ: false, ol: false }));
    pts.push([qx, qy]);
    px = qx;
    py = qy;
  }
  return { prims, pts };
}

/** An elliptical arc from angle t0 to t1 as a chain of `n` capsules, its radius easing r0 to r1. */
export function arc(cx: number, cy: number, rx: number, ry: number, t0: number, t1: number, n: number, r0: number, r1: number, m: string, o: PrimOptions = {}): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    out.push(K(cx + rx * Math.cos(a), cy + ry * Math.sin(a), cx + rx * Math.cos(b), cy + ry * Math.sin(b), lerp(r0, r1, i / n), lerp(r0, r1, (i + 1) / n), m, o));
  }
  return out;
}

// ---------------------------------------------------------------- rasterising

/** A drawn primitive ready to hit-test: bounds and resolved colour. */
interface Prepped {
  t: 'E' | 'K' | 'P' | 'X';
  src: Ellipse | Capsule | Poly | Mark;
  mat: Material | null;
  /** Mark colour. */
  col: Rgb;
  em: boolean;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  // ellipse rotation
  ca: number;
  sa: number;
  // capsule axis
  dx: number;
  dy: number;
  ll: number;
  // polygon winding
  wind: number;
  outlineRamp?: Rgb[];
}

const FLAT: Rgb = [0, 0, 1];

function prep(p: Ellipse | Capsule | Poly | Mark, v: Variant): Prepped {
  const q: Prepped = { t: p.t, src: p, mat: null, col: [0, 0, 0], em: false, x0: 0, x1: 0, y0: 0, y1: 0, ca: 1, sa: 0, dx: 0, dy: 0, ll: 1, wind: 1 };
  if (p.t === 'X') {
    q.x0 = p.x;
    q.x1 = p.x + p.w;
    q.y0 = p.y;
    q.y1 = p.y + p.h;
    if (p.c[0] === '#') {
      q.col = hex(p.c);
      q.em = !!p.em;
    } else {
      const [mn, ix] = p.c.split(':');
      q.mat = resolve(mn, v);
      q.col = q.mat.r[Number(ix)];
      q.em = p.em ?? q.mat.em;
    }
    return q;
  }
  q.mat = resolve(p.m, v);
  q.em = q.mat.em;
  if (p.t === 'E') {
    const r = Math.max(p.rx, p.ry);
    q.x0 = p.cx - r;
    q.x1 = p.cx + r;
    q.y0 = p.cy - r;
    q.y1 = p.cy + r;
    q.ca = Math.cos(-(p.a ?? 0));
    q.sa = Math.sin(-(p.a ?? 0));
  } else if (p.t === 'K') {
    const r = Math.max(p.r1, p.r2);
    q.x0 = Math.min(p.x1, p.x2) - r;
    q.x1 = Math.max(p.x1, p.x2) + r;
    q.y0 = Math.min(p.y1, p.y2) - r;
    q.y1 = Math.max(p.y1, p.y2) + r;
    q.dx = p.x2 - p.x1;
    q.dy = p.y2 - p.y1;
    q.ll = q.dx * q.dx + q.dy * q.dy || 1e-6;
  } else {
    let x0 = 1e9;
    let x1 = -1e9;
    let y0 = 1e9;
    let y1 = -1e9;
    let area = 0;
    const pt = p.pts;
    for (let i = 0; i < pt.length; i += 2) {
      const ax = pt[i];
      const ay = pt[i + 1];
      const bx = pt[(i + 2) % pt.length];
      const by = pt[(i + 3) % pt.length];
      x0 = Math.min(x0, ax);
      x1 = Math.max(x1, ax);
      y0 = Math.min(y0, ay);
      y1 = Math.max(y1, ay);
      area += ax * by - bx * ay;
    }
    q.x0 = x0;
    q.x1 = x1;
    q.y0 = y0;
    q.y1 = y1;
    q.wind = area > 0 ? 1 : -1;
  }
  return q;
}

/** Surface normal at (x, y), or null when the point misses. */
function hit(q: Prepped, x: number, y: number): Rgb | null {
  const p = q.src;
  if (p.t === 'E') {
    const lx = x - p.cx;
    const ly = y - p.cy;
    const rx = lx * q.ca - ly * q.sa;
    const ry = lx * q.sa + ly * q.ca;
    const qx = rx / p.rx;
    const qy = ry / p.ry;
    const d = qx * qx + qy * qy;
    if (d > 1) return null;
    const fl = 1 - (p.fl ?? 0);
    const nx = qx * fl;
    const ny = qy * fl;
    const nz = Math.sqrt(1 - d);
    const c = q.ca;
    const s = -q.sa;
    const ox = nx * c - ny * s;
    const oy = nx * s + ny * c;
    const len = Math.hypot(ox, oy, nz) || 1;
    return [ox / len, oy / len, nz / len];
  }
  if (p.t === 'K') {
    const t = clamp(((x - p.x1) * q.dx + (y - p.y1) * q.dy) / q.ll, 0, 1);
    const cx = p.x1 + q.dx * t;
    const cy = p.y1 + q.dy * t;
    const r = lerp(p.r1, p.r2, t);
    const qx = (x - cx) / r;
    const qy = (y - cy) / r;
    const d = qx * qx + qy * qy;
    if (d > 1) return null;
    const fl = 1 - (p.fl ?? 0);
    const nz = Math.sqrt(1 - d);
    const len = Math.hypot(qx * fl, qy * fl, nz) || 1;
    return [(qx * fl) / len, (qy * fl) / len, nz / len];
  }
  if (p.t === 'P') {
    const pt = p.pts;
    const n = pt.length;
    let inside = false;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = pt[i];
      const yi = pt[i + 1];
      const xj = pt[j];
      const yj = pt[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (!inside) return null;
    let n0: Rgb = p.n ?? FLAT;
    if (p.bv) {
      let best = 1e9;
      let ex = 0;
      let ey = 0;
      for (let i = 0; i < n; i += 2) {
        const ax = pt[i];
        const ay = pt[i + 1];
        const ddx = pt[(i + 2) % n] - ax;
        const ddy = pt[(i + 3) % n] - ay;
        const ll = ddx * ddx + ddy * ddy || 1e-6;
        const t = clamp(((x - ax) * ddx + (y - ay) * ddy) / ll, 0, 1);
        const d = Math.hypot(x - (ax + ddx * t), y - (ay + ddy * t));
        if (d < best) {
          best = d;
          const l = Math.sqrt(ll);
          ex = (ddy / l) * q.wind;
          ey = (-ddx / l) * q.wind;
        }
      }
      if (best < p.bv) {
        const k = (1 - best / p.bv) * 0.85;
        const vx = n0[0] - ex * k;
        const vy = n0[1] - ey * k;
        const l = Math.hypot(vx, vy, n0[2]);
        n0 = [vx / l, vy / l, n0[2] / l];
      }
    }
    return n0;
  }
  return x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1 ? FLAT : null;
}

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function texture(kind: Texture, x: number, y: number): number {
  switch (kind) {
    case 'fur': return (hash2(x, Math.floor(y / 2)) - 0.5) * 0.2 + ((x + Math.floor(y / 3)) % 3 === 0 ? -0.05 : 0);
    case 'mail': return ((x + y) % 2 === 0 ? 0.07 : -0.09) + (y % 3 === 0 ? -0.04 : 0);
    case 'stone': return (hash2(x >> 1, y >> 1) - 0.5) * 0.24;
    case 'scale': return (x + ((y >> 1) % 2) * 2) % 4 === 0 || y % 2 === 0 ? -0.1 : 0.04;
    case 'wood': return Math.sin(x * 1.7 + hash2(x >> 2, 3) * 2) * 0.07;
    case 'bark': return (x % 3 === 0 ? -0.12 : 0.02) + (hash2(x, y >> 2) - 0.5) * 0.1;
    case 'cloth': return (hash2(x, y) - 0.5) * 0.08;
    case 'ice': return (x - y) % 5 === 0 ? 0.14 : 0;
    case 'rot': return (hash2(x >> 1, y >> 1) - 0.5) * 0.3;
  }
}

const norm3 = (x: number, y: number, z: number): Rgb => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
/** The key light, from the upper left and in front. */
const KEY = norm3(-0.55, -0.72, 0.6);

/** Hearth-lit: five banded tones, a two-ring coloured outline, glow from emissive parts. */
const HEARTH = { cut: [0.27, 0.47, 0.71, 0.9], idx: [1, 2, 3, 4, 5], amb: 0.2, spec: 0.88, bloom: 2.6 };

/** Raster edge of a cell on the 32-unit grid: the atlas stores 64 px cells. */
export const CELL_PX = 64;

export interface BakeOptions<V extends Variant> {
  /** Idle frame. */
  frame?: number;
  variant?: V;
  /** Grid edge in units: 32 for a map sprite, larger for portraits (same pixel density). */
  grid?: number;
  /** Raster edge in pixels; default 64 per 32 units. */
  px?: number;
  /** A side light that rims the silhouette: direction toward it (pixel steps) and colour. */
  rim?: { from: [number, number]; c: string; k?: number };
}

export type Model<V extends Variant = Variant> = (frame: number, v: V) => PrimTree;

const NEIGHBOURS: ReadonlyArray<[number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Rasterises a model into straight-alpha RGBA pixels, `px` × `px`. */
export function bake<V extends Variant>(model: Model<V>, o: BakeOptions<V> = {}): Uint8ClampedArray {
  const grid = o.grid ?? 32;
  const R = o.px ?? Math.round((CELL_PX * grid) / 32);
  const v = (o.variant ?? {}) as V;
  const prims: Prepped[] = [];
  const lights: Light[] = [];
  const shadows: Shadow[] = [];
  for (const p of flatten(model(o.frame ?? 0, v))) {
    if (p.t === 'L') lights.push(p);
    else if (p.t === 'S') shadows.push(p);
    else prims.push(prep(p, v));
  }
  const u = grid / R;
  const N = R * R;
  const col = new Float32Array(N * 3);
  const al = new Float32Array(N);
  const pid = new Int16Array(N).fill(-1);
  const band = new Int8Array(N);
  const emis = new Uint8Array(N);
  const nPr = prims.length;

  for (let y = 0; y < R; y++) {
    const uy = (y + 0.5) * u;
    for (let x = 0; x < R; x++) {
      const ux = (x + 0.5) * u;
      for (let i = nPr - 1; i >= 0; i--) {
        const p = prims[i];
        if (ux < p.x0 || ux > p.x1 || uy < p.y0 || uy > p.y1) continue;
        const n = hit(p, ux, uy);
        if (!n) continue;
        const k = y * R + x;
        pid[k] = i;
        const m = p.mat;
        let c: Rgb;
        let b = 3;
        let isEm = false;
        if (p.t === 'X') {
          c = p.col;
          b = -1;
          isEm = p.em;
        } else {
          const mm = m as Material;
          let val: number;
          const ink = p.src.ink ?? 0;
          if (mm.em) {
            val = 0.42 + 0.58 * n[2] + ink;
            isEm = true;
          } else {
            const d = n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2];
            val = HEARTH.amb + (1 - HEARTH.amb) * Math.max(0, d);
            // ambient occlusion toward the feet
            val *= 1 - 0.2 * clamp((uy - 13) / 17, 0, 1);
            val += ink + (mm.tex ? texture(mm.tex, x, y) : 0);
            if (mm.shiny && 2 * d * n[2] - KEY[2] > HEARTH.spec) val = 1.2;
          }
          val = clamp(val, 0, 1.2);
          let bi = 0;
          while (bi < HEARTH.cut.length && val > HEARTH.cut[bi]) bi++;
          b = HEARTH.idx[bi];
          c = mm.r[b];
        }
        let cr = c[0];
        let cg = c[1];
        let cb = c[2];
        // the model's own lights: ember cores, gems, runes
        if (!isEm) {
          for (const L of lights) {
            const ldx = L.x - ux;
            const ldy = L.y - uy;
            const dd = Math.hypot(ldx, ldy);
            if (dd >= L.r) continue;
            const dir = norm3(ldx, ldy, L.z);
            const f = Math.pow(1 - dd / L.r, 1.6) * Math.max(0.15, n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2]) * L.k * 0.85;
            cr += L.c[0] * f;
            cg += L.c[1] * f;
            cb += L.c[2] * f;
          }
        }
        col[k * 3] = cr;
        col[k * 3 + 1] = cg;
        col[k * 3 + 2] = cb;
        al[k] = m ? m.a : 1;
        band[k] = b;
        emis[k] = isEm ? 1 : 0;
        break;
      }
    }
  }

  const idx = (x: number, y: number): number => (x < 0 || y < 0 || x >= R || y >= R ? -1 : y * R + x);
  const solid = (k: number): boolean => k >= 0 && pid[k] >= 0;
  const occludes = (q: Prepped): boolean => q.t !== 'X' && q.src.occ !== false;

  // occlusion: a part tucked behind another darkens one tone where they meet
  const dark = new Uint8Array(N);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      const i = pid[k];
      if (i < 0 || !occludes(prims[i])) continue;
      for (const [ax, ay] of NEIGHBOURS) {
        const q = idx(x + ax, y + ay);
        if (q < 0) continue;
        const j = pid[q];
        if (j > i && occludes(prims[j]) && prims[j].mat !== prims[i].mat) {
          dark[k] = 1;
          break;
        }
      }
    }
  }
  for (let k = 0; k < N; k++) {
    if (!dark[k] || emis[k]) continue;
    const m = prims[pid[k]].mat as Material;
    const c = m.r[Math.max(1, band[k] - 1)];
    col[k * 3] = c[0];
    col[k * 3 + 1] = c[1];
    col[k * 3 + 2] = c[2];
  }

  // rim: light from a source beside the figure (a torch, a nearby fire)
  if (o.rim) {
    const [rx, ry] = o.rim.from;
    const rc = hex(o.rim.c);
    const rk = o.rim.k ?? 0.6;
    const depth = Math.max(1, Math.round(R / 64));
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < R; x++) {
        const k = y * R + x;
        if (!solid(k) || emis[k]) continue;
        let edge = false;
        for (let d = 1; d <= depth && !edge; d++) if (!solid(idx(x + rx * d, y + ry * d))) edge = true;
        if (!edge) continue;
        const c = mixc([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], rc, rk);
        col[k * 3] = c[0];
        col[k * 3 + 1] = c[1];
        col[k * 3 + 2] = c[2];
      }
    }
  }

  // outline: the darkest tone of the part it surrounds, a shade lighter on the lit side
  const oc = new Float32Array(N * 3);
  const oa = new Float32Array(N);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      if (solid(k)) continue;
      let src = -1;
      let lit = false;
      for (const [ax, ay] of NEIGHBOURS) {
        const q = idx(x + ax, y + ay);
        if (solid(q) && prims[pid[q]].src.ol !== false) {
          src = q;
          lit = ax > 0 || ay > 0;
          break;
        }
      }
      if (src < 0) continue;
      const p = prims[pid[src]];
      const r = p.mat ? p.mat.r : (p.outlineRamp ??= ramp(p.col));
      let c = lit ? mixc(r[0], r[1], 0.45) : r[0];
      if (emis[src]) c = mixc(r[1], r[2], 0.5);
      oc[k * 3] = c[0];
      oc[k * 3 + 1] = c[1];
      oc[k * 3 + 2] = c[2];
      oa[k] = 1;
    }
  }
  // a second, softer ring keeps the silhouette when the game draws the 64 px cell at 32-40 px
  const ring = oa.slice();
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      if (solid(k) || ring[k]) continue;
      for (const [ax, ay] of NEIGHBOURS) {
        const q = idx(x + ax, y + ay);
        if (q >= 0 && ring[q] === 1) {
          oc[k * 3] = oc[q * 3];
          oc[k * 3 + 1] = oc[q * 3 + 1];
          oc[k * 3 + 2] = oc[q * 3 + 2];
          oa[k] = 0.62;
          break;
        }
      }
    }
  }

  // glow: emissive pixels bleed light past the outline
  const gc = new Float32Array(N * 3);
  const ga = new Float32Array(N);
  const rb = HEARTH.bloom * (R / CELL_PX) * (32 / grid);
  const ir = Math.ceil(rb);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      if (!emis[k] || prims[pid[k]].src.glow === false) continue;
      for (let dy = -ir; dy <= ir; dy++) {
        for (let dx = -ir; dx <= ir; dx++) {
          const q = idx(x + dx, y + dy);
          if (q < 0 || solid(q)) continue;
          const d = Math.hypot(dx, dy);
          if (d > rb) continue;
          const a = 0.5 * (1 - d / rb);
          if (a > ga[q]) {
            ga[q] = a;
            gc[q * 3] = col[k * 3];
            gc[q * 3 + 1] = col[k * 3 + 1];
            gc[q * 3 + 2] = col[k * 3 + 2];
          }
        }
      }
    }
  }

  // compose: shadow, glow, outline, body
  const img = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const k = y * R + x;
      const ux = (x + 0.5) * u;
      const uy = (y + 0.5) * u;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const s of shadows) {
        const d = ((ux - s.cx) / s.rx) ** 2 + ((uy - s.cy) / s.ry) ** 2;
        if (d > 1) continue;
        a = Math.max(a, d < 0.55 ? s.a : s.a * 0.55);
      }
      const over = (cr: number, cg: number, cb: number, ca: number): void => {
        r = r * (1 - ca) + cr * ca;
        g = g * (1 - ca) + cg * ca;
        b = b * (1 - ca) + cb * ca;
        a = a + ca * (1 - a);
      };
      if (ga[k]) over(gc[k * 3], gc[k * 3 + 1], gc[k * 3 + 2], ga[k]);
      if (oa[k]) over(oc[k * 3], oc[k * 3 + 1], oc[k * 3 + 2], oa[k]);
      if (pid[k] >= 0) over(col[k * 3], col[k * 3 + 1], col[k * 3 + 2], al[k]);
      // r, g, b are premultiplied by a; store straight colour
      img[k * 4] = a ? r / a : 0;
      img[k * 4 + 1] = a ? g / a : 0;
      img[k * 4 + 2] = a ? b / a : 0;
      img[k * 4 + 3] = a * 255;
    }
  }
  return img;
}
