/**
 * The screens' pixel language (ported from the art bible's `screens.js`): a small buffer
 * of packed RGBA pixels, banded colour with ordered dither between bands, hard-edged
 * shapes, carved lettering and looping particles. Deterministic and DOM-free: every random
 * choice is `hash2`, and every motion is periodic in one `LOOP`.
 */
import { hash2 } from '../sprites/sculpt/kit';

export const TAU = Math.PI * 2;
/** Every motion repeats in this many ms, so t and t + LOOP paint the same image. */
export const LOOP = 4000;
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

// ------------------------------------------------------------------ colour
const unhex = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Packs an opaque colour so its bytes read r, g, b, a in memory (canvas pixel order). */
export const pack = (r: number, g: number, b: number): number => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
export const unpack = (c: number): [number, number, number] => (LE ? [c & 255, (c >>> 8) & 255, (c >>> 16) & 255] : [c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255]);
export const C = (h: string): number => pack(...unhex(h));
export const mixc = (a: number, b: number, t: number): number => { const A = unpack(a), B = unpack(b); return pack(Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t)); };
export const addc = (a: number, b: number): number => { const A = unpack(a), B = unpack(b); return pack(Math.min(255, A[0] + B[0]), Math.min(255, A[1] + B[1]), Math.min(255, A[2] + B[2])); };
export const mulc = (a: number, k: number): number => { const A = unpack(a); return pack(Math.round(A[0] * k), Math.round(A[1] * k), Math.round(A[2] * k)); };
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Smooth 1-D value noise in [0, 1], one knot every `step`. */
export const noise1 = (x: number, step: number, seed: number): number => { const i = Math.floor(x / step), f = x / step - i, s = f * f * (3 - 2 * f); return hash2(i, seed) * (1 - s) + hash2(i + 1, seed) * s; };

// ordered dither: a value between two bands picks one by a 4x4 Bayer threshold
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dl = (x: number, y: number, v: number): number => { const f = Math.floor(v); return f + (v - f > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? 1 : 0); };

// ------------------------------------------------------------------ pixel buffer
/** A pixel's new colour from its old one; 0 leaves it (in `poly`). */
export type Shade = (x: number, y: number, old: number) => number;
/** Packed pixels, 0 clear. */
export interface Sprite {
  w: number;
  h: number;
  px: Uint32Array;
}

export class Buf implements Sprite {
  readonly px: Uint32Array;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint32Array(w * h);
  }
  set(x: number, y: number, c: number): void { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  get(x: number, y: number): number { x = Math.floor(x); y = Math.floor(y); return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : 0; }
  rect(x: number, y: number, w: number, h: number, c: number | Shade): void {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.px[yy * this.w + xx] = typeof c === 'function' ? c(xx, yy, this.px[yy * this.w + xx]) : c;
  }
  /** Fill a polygon (pixel centres, even-odd). c: colour, or fn(x, y, old) -> colour | 0 (skip). */
  poly(pts: readonly number[], c: number | Shade): void {
    const n = pts.length / 2;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { if (pts[i] < minY) minY = pts[i]; if (pts[i] > maxY) maxY = pts[i]; }
    const ya = Math.max(0, Math.floor(minY)), yb = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = ya; y <= yb; y++) {
      const cy = y + 0.5; xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
        if ((yi > cy) !== (yj > cy)) xs.push(xi + ((cy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) {
          const q = y * this.w + x;
          if (typeof c === 'function') { const v = c(x, y, this.px[q]); if (v) this.px[q] = v; } else this.px[q] = c;
        }
      }
    }
  }
  /** Bresenham line stamped with a b x b square brush. */
  line(x0: number, y0: number, x1: number, y1: number, c: number, b = 1): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (b === 1) this.set(x0, y0, c); else this.rect(x0, y0, b, b, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  polyline(pts: readonly number[], c: number, b = 1): void { for (let i = 0; i + 3 < pts.length; i += 2) this.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c, b); }
  /** Draw a sprite {w, h, px} (0 = clear) at (dx, dy), optionally mirrored. */
  blit(sp: Sprite, dx: number, dy: number, flip = false): void {
    dx = Math.round(dx); dy = Math.round(dy);
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const c = sp.px[y * sp.w + (flip ? sp.w - 1 - x : x)];
      if (c) this.set(dx + x, dy + y, c);
    }
  }
}
/** A sprite from rows of characters and a key { char: colour }; '.' is clear. rimR: colour for the right edge of each row. */
export function sprite(rows: readonly string[], key: Readonly<Record<string, number>>, rimR?: number): Sprite {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1;
    for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch !== '.' && key[ch]) { px[y * w + x] = key[ch]; last = x; } }
    if (rimR && last >= 0) px[y * w + last] = rimR;
  }
  return { w, h, px };
}

// ------------------------------------------------------------------ lettering
// A carved display face: Latin capitals built only from straight strokes,
// the angular hand of runes cut in stone. Polylines on an 8 x 12 cell.
const GLYPH: Record<string, number[][]> = {
  A: [[0, 12, 0, 4, 4, 0, 8, 4, 8, 12], [0, 7, 8, 7]],
  B: [[0, 0, 0, 12, 5, 12, 8, 9, 5, 6, 0, 6], [0, 0, 5, 0, 8, 3, 5, 6]],
  C: [[8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12, 6, 12, 8, 10]],
  D: [[0, 0, 0, 12, 4, 12, 8, 8, 8, 4, 4, 0, 0, 0]],
  E: [[8, 0, 0, 0, 0, 12, 8, 12], [0, 6, 6, 6]],
  F: [[8, 0, 0, 0, 0, 12], [0, 6, 6, 6]],
  H: [[0, 0, 0, 12], [8, 0, 8, 12], [0, 6, 8, 6]],
  I: [[0, 0, 0, 12]],
  L: [[0, 0, 0, 12, 8, 12]],
  N: [[0, 12, 0, 0, 8, 12, 8, 0]],
  O: [[2, 0, 6, 0, 8, 2, 8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0]],
  S: [[8, 2, 6, 0, 2, 0, 0, 2, 0, 4, 8, 8, 8, 10, 6, 12, 2, 12, 0, 10]],
  T: [[0, 0, 8, 0], [4, 0, 4, 12]],
  W: [[0, 0, 2, 12, 5, 5, 8, 12, 10, 0]],
  // for the victory screen
  G: [[8, 2, 6, 0, 2, 0, 0, 2, 0, 10, 2, 12, 6, 12, 8, 10, 8, 6, 5, 6]],
  M: [[0, 12, 0, 0, 5, 7, 10, 0, 10, 12]],
  R: [[0, 12, 0, 0, 5, 0, 8, 3, 5, 6, 0, 6], [4, 6, 8, 12]],
  V: [[0, 0, 4, 12, 8, 0]],
  Y: [[0, 0, 4, 6, 8, 0], [4, 6, 4, 12]],
  // for the Ragnarök screen; the umlaut sits above the cap
  K: [[0, 0, 0, 12], [8, 0, 0, 7], [3, 5, 8, 12]],
  'Ö': [[2, 0, 6, 0, 8, 2, 8, 10, 6, 12, 2, 12, 0, 10, 0, 2, 2, 0], [2, -3.4, 2, -2.4], [6, -3.4, 6, -2.4]],
};
const GW: Record<string, number> = { I: 0, W: 10, M: 10, ' ': 3 };
/** Width of a word set at cap height `cap` with brush `b` and letter gap `gap`. */
export function measure(str: string, cap: number, b: number, gap: number): number {
  const sc = (cap - b) / 12;
  let w = 0;
  for (const ch of str) w += Math.round((GW[ch] ?? 8) * sc) + b + gap;
  return w - gap;
}
/** Stamp a word into a mask buffer (value 1); returns its width. */
export function letter(mask: Buf, str: string, x: number, y: number, cap: number, b: number, gap: number): number {
  const sc = (cap - b) / 12;
  let cx = x;
  for (const ch of str) {
    for (const pl of GLYPH[ch] || []) {
      const pts = pl.map((v, i) => (i % 2 ? Math.round(y + v * sc) : Math.round(cx + v * sc)));
      mask.polyline(pts, 1, b);
    }
    cx += Math.round((GW[ch] ?? 8) * sc) + b + gap;
  }
  return cx - gap - x;
}
/** One line of lettering: its top row and cap height; `plain` for a rule that takes no snow. */
export interface TextLine {
  y: number;
  cap: number;
  small?: boolean;
  plain?: boolean;
}
/** Lettering stamped into a mask (value 1), and the box it is painted in. */
export interface TextMask {
  mask: Buf;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lines: TextLine[];
}
/** The lettering's colours: metal bands by the row within a line, [below this fraction, colour]. */
export interface TextPalette {
  shadow: number;
  outline: number;
  snow: number;
  glint: number;
  bands: Array<[number, number]>;
}
/**
 * Paint a lettering mask: drop shadow, dark outline, banded metal fill by the
 * row inside each line, snow on the letters' tops, and a glint that sweeps
 * across once per loop. lines: [{ y, cap }] give each line's band rows.
 */
export function paintText(dst: Buf, T: TextMask, t: number, pal: TextPalette): void {
  const { mask, lines } = T, w = dst.w, m = mask.px;
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < dst.h ? m[y * w + x] : 0);
  for (let y = T.y0 - 2; y < T.y1 + 4; y++) for (let x = T.x0 - 2; x < T.x1 + 4; x++) {
    if (at(x, y)) continue;
    if (at(x - 1, y - 2) || at(x - 2, y - 2)) dst.set(x, y, pal.shadow);
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y + 1) || at(x + 1, y - 1) || at(x - 1, y + 1)) dst.set(x, y, pal.outline);
  }
  const sweep = (t % LOOP) < 1600 ? -24 + ((T.x1 - T.x0) + 60) * ((t % LOOP) / 1600) : -999;
  for (let y = T.y0; y < T.y1; y++) {
    let L = lines[0];
    for (const ln of lines) if (y >= ln.y) L = ln;
    const rel = (y - L.y) / L.cap;
    const band = pal.bands.find((bd) => rel < bd[0]) || pal.bands[pal.bands.length - 1];
    for (let x = T.x0; x < T.x1; x++) {
      if (!at(x, y)) continue;
      let c = band[1];
      if (!at(x, y - 1) && !L.plain) c = hash2(x, 41) > 0.35 ? pal.snow : pal.bands[0][1];
      const g = (x - T.x0) + (y - L.y) * 0.7 - sweep;
      if (Math.abs(g) < 1.2) c = pal.glint; else if (Math.abs(g) < 3) c = mixc(c, pal.glint, 0.55);
      dst.set(x, y, c);
    }
  }
  // a little snow heaped on some tops (not on plain lines such as a carved rule)
  const plainY = Math.min(...lines.filter((ln) => ln.plain).map((ln) => ln.y), T.y1);
  for (let y = T.y0; y < plainY; y++) for (let x = T.x0; x < T.x1; x++) {
    if (at(x, y) && !at(x, y - 1) && hash2(x * 3, y) > 0.8 && !at(x, y - 2)) dst.set(x, y - 1, pal.snow);
  }
}

/** Composite a layer (0 = clear) over the frame. */
export function over(dst: Buf, src: Buf): void { const d = dst.px, s = src.px; for (let i = 0; i < s.length; i++) if (s[i]) d[i] = s[i]; }
/** Darken the corners: a banded, dithered vignette. */
export function vignette(sc: { IW: number; IH: number }): Uint8Array {
  const { IW, IH } = sc, v = new Uint8Array(IW * IH);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const dx = x / IW - 0.5, dy = (y / IH - 0.5) * 1.15, r = Math.sqrt(dx * dx + dy * dy);
    v[y * IW + x] = clamp(dl(x, y, (r - 0.42) * 7), 0, 3);
  }
  return v;
}
const VIG = [1, 0.84, 0.7, 0.58];
export function applyVignette(buf: Buf, v: Uint8Array): void { const p = buf.px; for (let i = 0; i < p.length; i++) if (v[i]) p[i] = mulc(p[i], VIG[v[i]]); }

/**
 * Particles on looping tracks: each track is walked in n loops and carries n
 * flakes half a cycle apart, so the set is the same after every 4 s loop.
 * kx/ky: whole screen-widths/heights crossed per track; sway: px of wobble.
 */
export interface Particles {
  count: number;
  seed: number;
  /** Tracks per particle, each half a cycle apart. */
  n?: number;
  kx: number;
  ky: number;
  sway?: number;
  wob?: number;
  cols: readonly number[];
  len: number;
  slope?: number;
  big?: boolean;
}
export function particles(buf: Buf, t: number, o: Particles): void {
  const IW = buf.w, IH = buf.h;
  const n = o.n || 1, Wr = IW + 16, Hr = IH + 16, ph = (t % LOOP) / LOOP;
  for (let i = 0; i < o.count; i++) {
    const x0 = hash2(i, o.seed) * Wr, y0 = hash2(i, o.seed + 1) * Hr, sp = hash2(i, o.seed + 2) * TAU;
    for (let j = 0; j < n; j++) {
      const q = ((ph + j + hash2(i, o.seed + 3) * n) % n) / n; // 0..1 along the track
      let x = (x0 - o.kx * Wr * q) % Wr; if (x < 0) x += Wr;
      let y = (y0 + o.ky * Hr * q) % Hr; if (y < 0) y += Hr;
      x += Math.sin(q * TAU * (o.wob || 1) + sp) * (o.sway || 0);
      x -= 8; y -= 8;
      const c = o.cols[i % o.cols.length];
      if (o.len > 1) {
        for (let k = 0; k < o.len; k++) buf.set(x + k, y + Math.round(k * (o.slope || 0)), k === 0 ? c : mixc(c, buf.get(x + k, y), Math.min(0.85, k / o.len + 0.2)));
      } else buf.set(x, y, c);
      if (o.big && hash2(i, o.seed + 5) > 0.7) { buf.set(x + 1, y, c); buf.set(x, y + 1, c); buf.set(x + 1, y + 1, mixc(c, buf.get(x + 1, y + 1), 0.5)); }
    }
  }
}
