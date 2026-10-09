import type { ItemAuraArt } from '../../../../engine';
import { hash2, hex, hsl2rgb, type Rgb } from './kit';

/**
 * The alignment aura an identified item wears: its pixels in, the item with its aura out,
 * pure pixel work so it bakes anywhere. Each tone has its own motion (the cue that works
 * without colour) and its own colours, from the owner's scheme for item states: the harmful
 * tones sit in a black halo (cursed red, hexed jaundice yellow, unholy bile green, chaotic
 * purple and red); enchanted is rune blue; blessed, holy and artifact keep the style bible's
 * golds. Everything stays inside the item's cell.
 */
type AuraTone = 'blessed' | 'holy' | 'enchanted' | 'chaotic' | 'hexed' | 'unholy' | 'cursed' | 'artifact';

const AURA_TONES: readonly AuraTone[] = ['cursed', 'hexed', 'unholy', 'chaotic', 'enchanted', 'blessed', 'holy', 'artifact'];

/** An aura loops over 16 frames: about four seconds on the map's idle tick. */
const AURA_FRAMES = 16;

interface Look {
  ring: string;
  halo: string;
  /** Halo and ring strength. */
  hA: number;
  rA: number;
  /** A dark halo laid over the floor rather than light added to it. */
  dark?: boolean;
}

const LOOKS: Record<AuraTone, Look> = {
  blessed: { ring: '#ffe9b0', halo: '#e0a83a', hA: 0.34, rA: 0.55 },
  holy: { ring: '#fff1c8', halo: '#ffd27a', hA: 0.55, rA: 0.8 },
  enchanted: { ring: '#9cc4ff', halo: '#6aa6ff', hA: 0.42, rA: 0.75 },
  chaotic: { ring: '#b13ad8', halo: '#0b0209', hA: 0.66, rA: 0.85, dark: true },
  hexed: { ring: '#c4ad2a', halo: '#090800', hA: 0.66, rA: 0.72, dark: true },
  unholy: { ring: '#6f962c', halo: '#030802', hA: 0.72, rA: 0.66, dark: true },
  cursed: { ring: '#c8221e', halo: '#080101', hA: 0.82, rA: 0.85, dark: true },
  artifact: { ring: '#fff6dc', halo: '#ffe9b0', hA: 0.5, rA: 0.9 },
};

/** The colours the motions use, by tone. */
const HEX_HEAD = '#f0e05a';
const HEX_TAIL = '#a8921e';
const UNHOLY_SMUDGE = '#020601';
const UNHOLY_WISP = '#0a1406';
const UNHOLY_GLINT = '#a2c43c';
const CURSE_DARK = '#7c1010';
const CURSE_RED = '#d8281f';
const CURSE_SHINE = '#ff9c8c';
/** Chaos swings between purple and red. */
const CHAOS_HUE = { mid: 320, swing: 40 };

const TAU = Math.PI * 2;
const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const bell = (t: number): number => Math.sin(Math.PI * sat(t));
const eIn = (t: number): number => t * t;
const eOut = (t: number): number => 1 - (1 - t) * (1 - t);

/** Rune glyphs for the artifact's ring, 3 by 4. Two alternate, so a turn of two places loops. */
const RUNES = [['#.#', '.#.', '.#.', '.#.'], ['.#.', '###', '.#.', '.#.']];

// ---------------------------------------------------------------- the item's silhouette

interface Silhouette {
  w: number;
  mask: Uint8Array;
  cx: number;
  cy: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Top and bottom row per column, -1 where empty. */
  top: Int16Array;
  /** Up to three lowest points, spread apart: where drips gather. */
  low: Array<[number, number]>;
  /** The outer edge, traced clockwise. */
  edge: Array<[number, number]>;
  /** Distance outward from the silhouette, in pixels. */
  dist: Float32Array;
}

function silhouette(px: Uint8ClampedArray, w: number): Silhouette {
  const mask = new Uint8Array(w * w);
  let n = 0, sx = 0, sy = 0, x0 = w, x1 = -1, y0 = w, y1 = -1;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 128) {
      mask[y * w + x] = 1; n++; sx += x; sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const dist = new Float32Array(w * w).fill(1e6);
  for (let k = 0; k < w * w; k++) if (mask[k]) dist[k] = 0;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (x > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1);
    if (y > 0) {
      dist[k] = Math.min(dist[k], dist[k - w] + 1);
      if (x > 0) dist[k] = Math.min(dist[k], dist[k - w - 1] + 1.414);
      if (x < w - 1) dist[k] = Math.min(dist[k], dist[k - w + 1] + 1.414);
    }
  }
  for (let y = w - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x;
    if (x < w - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1);
    if (y < w - 1) {
      dist[k] = Math.min(dist[k], dist[k + w] + 1);
      if (x < w - 1) dist[k] = Math.min(dist[k], dist[k + w + 1] + 1.414);
      if (x > 0) dist[k] = Math.min(dist[k], dist[k + w - 1] + 1.414);
    }
  }
  const top = new Int16Array(w).fill(-1);
  const bot = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) if (mask[y * w + x]) { if (top[x] < 0) top[x] = y; bot[x] = y; }
  const cols: number[] = [];
  for (let x = 0; x < w; x++) if (bot[x] >= 0) cols.push(x);
  cols.sort((a, b) => bot[b] - bot[a] || a - b);
  const low: Array<[number, number]> = [];
  for (const x of cols) {
    if (low.every((q) => Math.abs(q[0] - x) >= w * 0.16)) low.push([x, bot[x] + 1]);
    if (low.length >= 3) break;
  }
  return {
    w, mask, cx: n ? sx / n : w / 2, cy: n ? sy / n : w / 2, x0, x1, y0, y1, top, low,
    edge: traceEdge(mask, w), dist,
  };
}

/** Moore-neighbour trace of the outer edge, clockwise from the top-left pixel. */
function traceEdge(mask: Uint8Array, w: number): Array<[number, number]> {
  let s = -1;
  for (let k = 0; k < w * w; k++) if (mask[k]) { s = k; break; }
  if (s < 0) return [];
  const N8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < w && mask[y * w + x] === 1;
  const sx = s % w, sy = (s / w) | 0;
  const out: Array<[number, number]> = [[sx, sy]];
  let cx = sx, cy = sy, back = 0;
  for (let it = 0; it < w * w; it++) {
    let found = -1;
    for (let i = 1; i <= 8; i++) {
      const d = (back + i) % 8;
      if (on(cx + N8[d][0], cy + N8[d][1])) { found = d; break; }
    }
    if (found < 0) break;
    cx += N8[found][0];
    cy += N8[found][1];
    if (cx === sx && cy === sy) break;
    out.push([cx, cy]);
    back = (found + 4) % 8;
  }
  return out;
}

// ---------------------------------------------------------------- a premultiplied layer

class Layer {
  readonly p: Float32Array;
  constructor(readonly w: number) {
    this.p = new Float32Array(w * w * 4);
  }

  /** Paints one pixel: source-over, or added light. */
  put(x: number, y: number, c: Rgb, a: number, add = false): void {
    x |= 0; y |= 0;
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.w) return;
    const k = (y * this.w + x) * 4, p = this.p;
    a = Math.min(1, a);
    const r = (c[0] / 255) * a, g = (c[1] / 255) * a, b = (c[2] / 255) * a;
    if (add) {
      p[k] = Math.min(1, p[k] + r); p[k + 1] = Math.min(1, p[k + 1] + g); p[k + 2] = Math.min(1, p[k + 2] + b); p[k + 3] = Math.min(1, p[k + 3] + a);
    } else {
      const q = 1 - a;
      p[k] = r + p[k] * q; p[k + 1] = g + p[k + 1] * q; p[k + 2] = b + p[k + 2] * q; p[k + 3] = a + p[k + 3] * q;
    }
  }

  /** Fills a rectangle of pixels. */
  rect(x: number, y: number, w: number, h: number, c: Rgb, a: number, add = false): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.put(xx, yy, c, a, add);
  }

  /** A soft round glow, fading linearly to nothing at radius r. */
  glow(x: number, y: number, r: number, c: Rgb, a: number, add = true): void {
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
      if (d < 1) this.put(xx, yy, c, a * (1 - d), add);
    }
  }

  /** Lays straight-alpha pixels over the layer. */
  over(px: Uint8ClampedArray): void {
    for (let k = 0; k < this.w * this.w; k++) {
      const a = px[k * 4 + 3] / 255;
      if (a > 0) this.put(k % this.w, (k / this.w) | 0, [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]], a);
    }
  }

  /** Straight-alpha RGBA. */
  pixels(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.w * this.w * 4), p = this.p;
    for (let k = 0; k < this.w * this.w; k++) {
      const a = p[k * 4 + 3];
      if (a <= 0) continue;
      out[k * 4] = (p[k * 4] / a) * 255; out[k * 4 + 1] = (p[k * 4 + 1] / a) * 255; out[k * 4 + 2] = (p[k * 4 + 2] / a) * 255; out[k * 4 + 3] = a * 255;
    }
    return out;
  }
}

// ---------------------------------------------------------------- the aura

const RGB = new Map<string, Rgb>();
const rgb = (h: string): Rgb => {
  let c = RGB.get(h);
  if (!c) { c = hex(h); RGB.set(h, c); }
  return c;
};

const SILHOUETTES = new WeakMap<Uint8ClampedArray, Silhouette>();

/** The pack's alignment auras (`manifest.itemAuras`). */
export const COTW_ITEM_AURAS: ItemAuraArt = {
  frames: AURA_FRAMES,
  tones: AURA_TONES,
  render: (item, size, tone, frame) => withAura(item, size, tone as AuraTone, frame),
};

/**
 * The item's pixels (`size` by `size`, straight alpha) with the tone's aura at `frame` of
 * `AURA_FRAMES`. Deterministic: the same item, tone and frame give the same pixels.
 */
function withAura(item: Uint8ClampedArray, size: number, tone: AuraTone, frame: number): Uint8ClampedArray {
  let M = SILHOUETTES.get(item);
  if (!M) { M = silhouette(item, size); SILHOUETTES.set(item, M); }
  const L = new Layer(size);
  const A = LOOKS[tone];
  const t = (((frame % AURA_FRAMES) + AURA_FRAMES) % AURA_FRAMES) / AURA_FRAMES;
  const f = Math.round(t * AURA_FRAMES);
  const un = size / 32;
  /** Bible distances were measured on a 64 px cell. */
  const s64 = size / 64;
  const sn = (v: number): number => Math.round(v / un) * un;
  const dot = (x: number, y: number, c: Rgb, a: number, n = 1, add = false): void => L.rect(sn(x - (n * un) / 2), sn(y - (n * un) / 2), n * un, n * un, c, a, add);
  const ccx = M.cx, ccy = M.cy;

  // ---- behind the item
  if (tone === 'cursed') wrongShadow(L, item, M, t, un);
  if (tone === 'artifact') {
    // a pale beam from above; it fades out toward the cell's top rather than being cut off there
    const pulse = 0.8 + 0.2 * Math.sin(t * TAU);
    const topY = -size * 1.1, botY = ccy + size * 0.28, bw = size * 0.55;
    for (const [w, a] of [[bw, 0.13], [bw * 0.42, 0.2]]) {
      for (let y = 0; y < Math.min(size, botY); y++) {
        const g = (y - topY) / (botY - topY);
        const al = (g < 0.65 ? (a * pulse * g) / 0.65 : a * pulse * (1 - (g - 0.65) / 0.35)) * sat(y / (size * 0.35));
        L.rect(sn(ccx - w / 2), y, sn(w), 1, rgb('#fff6dc'), al, true);
      }
    }
    runeRing(false);
  }
  if (tone === 'holy') {
    // soft rays rise behind it
    for (let i = 0; i < 3; i++) {
      const k = (t * 2 + i * 0.37) % 1, rx = ccx + (i - 1) * size * 0.24, len = size * 0.34;
      const ry = ccy + size * 0.2 - k * size * 0.75;
      for (let j = 0; j < len; j += un) L.rect(sn(rx), sn(ry + j), un, un, rgb('#ffe9b0'), 0.42 * bell(k) * bell(j / len), true);
    }
  }
  const orbit = (k: number, back = 0): [number, number, boolean] => {
    // centred near the cell's middle, so the points stay inside however lopsided the item
    const a = (t - back) * TAU + k * Math.PI, ox = size / 2 + (ccx - size / 2) * 0.3;
    return [ox + Math.cos(a) * size * 0.4, ccy + size * 0.05 + Math.sin(a) * size * 0.17, Math.sin(a) >= 0];
  };
  if (tone === 'enchanted') for (let k = 0; k < 2; k++) { const o = orbit(k); if (!o[2]) dot(o[0], o[1], rgb('#6aa6ff'), 0.6); }

  // ---- halo and outline
  let ring = rgb(A.ring), jx = 0, jy = 0;
  if (tone === 'chaotic') {
    const hue = Math.round((CHAOS_HUE.mid + CHAOS_HUE.swing * Math.sin(t * TAU)) / 15) * 15;
    ring = hsl2rgb([hue, 0.85, 0.52]);
    if (hash2(f, 7) > 0.45) { jx = (hash2(f, 8) < 0.5 ? -1 : 1) * un; jy = (hash2(f, 9) < 0.3 ? -1 : 0) * un; }
  }
  const pulse = 0.78 + 0.22 * Math.sin(t * TAU * (A.dark ? 1 : 2));
  const PAD = 12 * s64;
  const halo = rgb(A.halo);
  const ringA = A.rA * (A.dark ? 0.75 + 0.25 * pulse : 0.85 + 0.15 * pulse);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = M.dist[y * size + x];
    if (d > 0 && d <= PAD) L.put(x, y, halo, Math.pow(1 - d / PAD, 1.7) * A.hA * pulse, !A.dark);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.round(x - jx), sy = Math.round(y - jy);
    if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
    const d = M.dist[sy * size + sx] / s64;
    if (d > 0 && d <= 2.01) L.put(x, y, ring, ringA * (d <= 1.01 ? 1 : 150 / 255));
  }

  // ---- the item
  if (tone === 'chaotic') {
    // a narrow upright sheen sweeps across in a shifting hue; the item keeps its own colours
    const k = (t * 2) % 1, bw = size * 0.22, bandX = -bw + k * (size + 2 * bw);
    const hc = hsl2rgb([CHAOS_HUE.mid - CHAOS_HUE.swing * Math.sin(t * TAU), 1, 0.62]);
    const lit = new Uint8ClampedArray(item);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k4 = (y * size + x) * 4;
      if (!lit[k4 + 3]) continue;
      const g = (x + 0.5 - bandX) / bw;
      const a = g > 0 && g < 1 ? 0.6 * (1 - Math.abs(g * 2 - 1)) : 0;
      for (let c = 0; c < 3; c++) lit[k4 + c] = lit[k4 + c] * (1 - a) + hc[c] * a;
    }
    L.over(lit);
  } else L.over(item);

  // ---- in front of the item
  if (tone === 'blessed') {
    // a glint runs along the top edge once a loop
    if (f < 5) {
      const k = f / 5, span = M.x1 - M.x0;
      for (let s = 3; s >= 0; s--) {
        const kk = k - s * 0.05;
        if (kk < 0) continue;
        let cx = Math.round(M.x0 + span * kk);
        while (cx < M.x1 && M.top[cx] < 0) cx++;
        const gx = cx, gy = M.top[cx] + un * 0.5;
        dot(gx, gy, rgb(s ? '#ffe9b0' : '#ffffff'), s ? 0.8 - s * 0.2 : 1);
        if (!s && bell(k) > 0.6) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) dot(gx + ox * un, gy + oy * un, rgb('#fff1c2'), 0.9);
      }
    }
  } else if (tone === 'holy') {
    for (let i = 0; i < 2; i++) {
      const k = (t + i * 0.5) % 1;
      const mx = ccx + (i ? 0.2 : -0.18) * size + Math.sin(k * 5 + i) * un * 1.5, my = ccy + size * 0.15 - k * size * 0.8;
      L.glow(mx, my, 3 * un, rgb('#ffe9b0'), 0.45 * bell(k));
      dot(mx, my, rgb('#fff6dc'), bell(k));
    }
  } else if (tone === 'enchanted') {
    for (let k = 0; k < 2; k++) {
      for (let s = 3; s >= 1; s--) {
        const [x, y, front] = orbit(k, s * 0.022);
        if (front) dot(x, y, rgb(s > 1 ? '#2a45b8' : '#6aa6ff'), 0.9 - s * 0.2);
      }
      const [x, y, front] = orbit(k);
      if (front) {
        L.glow(x, y, 4 * un, rgb('#6aa6ff'), 0.5);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) dot(x + ox * un, y + oy * un, rgb('#6aa6ff'), 1);
        dot(x, y, rgb('#e6f1ff'), 1);
      }
    }
  } else if (tone === 'hexed') {
    // a jaundiced fleck crawls the edge, one lap a loop, its tail covering the last step
    const E = M.edge, n = E.length;
    if (n) {
      const i0 = Math.floor(t * n), step = n / AURA_FRAMES;
      for (let s = 5; s >= 0; s--) {
        const q = E[(((i0 - Math.round((s * step) / 4)) % n) + n) % n];
        dot(q[0] + 0.5, q[1] + 0.5, rgb(s ? HEX_TAIL : HEX_HEAD), s ? 0.85 - s * 0.12 : 1, s ? 1 : 2);
      }
    }
  } else if (tone === 'unholy') {
    // dark wisps peel off the underside, sink, curl and spread as they thin
    const E = M.edge, nE = E.length;
    for (let i = 0; i < 4; i++) {
      const ph = (f + i * 2) % AURA_FRAMES, k = (ph % 8) / 8, cyc = Math.floor(ph / 8);
      let P0: [number, number] = M.low[i % Math.max(1, M.low.length)] ?? [M.cx, M.y1];
      if (nE) {
        const q = E[Math.floor(hash2(cyc * 4 + i, 77) * nE)];
        if (q[1] > M.cy) P0 = q;
      }
      const sway = Math.sin(k * 5 + i * 2) * un * (1 + k * 2.5);
      const wx = P0[0] + 0.5 + sway, wy = P0[1] + eOut(k) * size * 0.18, a = 1 - eIn(k);
      L.glow(wx, wy, (2.5 + k * 3) * un, rgb(UNHOLY_SMUDGE), 0.55 * a, false);
      const n = k < 0.5 ? 3 : 2, sg = Math.sign(sway || 1);
      dot(wx, wy, rgb(UNHOLY_WISP), 0.9 * a, n);
      dot(wx - sg * un * 1.5, wy - un * 1.5, rgb(UNHOLY_WISP), 0.9 * a);
      dot(wx - sg * un * 2, wy - 2.5 * un, rgb(UNHOLY_WISP), 0.9 * a);
      dot(wx - un * 0.5, wy - un * (n * 0.5 + 0.5), rgb(UNHOLY_GLINT), 0.8 * a);
      dot(wx + un * 0.5, wy - un * (n * 0.5 + 0.5), rgb(UNHOLY_GLINT), 0.8 * a);
    }
  } else if (tone === 'cursed') {
    // blood-red drips swell at the lowest points, fall and splash
    for (let i = 0; i < M.low.length; i++) {
      const k = ((f + i * 3) % 8) / 8, [lx, ly] = M.low[i];
      const dx = lx + 0.5, dy0 = ly, fall = size * 0.2;
      if (k < 0.5) {
        const n = k < 0.25 ? 1 : 2;
        dot(dx, dy0 + un * 0.5 * n, rgb(CURSE_DARK), 1);
        if (n === 2) dot(dx, dy0 + un * 1.5, rgb(CURSE_RED), 1);
      } else if (k < 0.82) {
        const dy = dy0 + un + eIn((k - 0.5) / 0.32) * fall;
        dot(dx, dy, rgb(CURSE_RED), 1);
        dot(dx, dy - un, rgb(CURSE_DARK), 1);
        dot(dx, dy - un, rgb(CURSE_SHINE), 1, 0.5);
      } else {
        const dy = dy0 + un + fall, s = (k - 0.82) / 0.18;
        dot(dx - un * (1 + s * 2), dy, rgb(CURSE_RED), 1 - s * 0.6);
        dot(dx + un * (1 + s * 2), dy, rgb(CURSE_RED), 1 - s * 0.6);
      }
    }
  } else if (tone === 'artifact') {
    runeRing(true);
    // a slow glint, once a loop
    const k = t;
    if (k > 0.1 && k < 0.3) {
      const b = bell((k - 0.1) / 0.2), gx = ccx + size * 0.12, gy = M.y0 + size * 0.12;
      dot(gx, gy, rgb('#ffffff'), b);
      for (let i = 1; i <= Math.round(1 + 2 * b); i++) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) dot(gx + ox * i * un, gy + oy * i * un, rgb('#ffffff'), b);
    }
  } else if (tone === 'chaotic') {
    // a single off-colour fleck hops about the edge
    const E = M.edge;
    if (E.length && f % 3 !== 0) {
      const q = E[Math.floor(hash2(f, 11) * E.length)];
      dot(q[0], q[1], hsl2rgb([hash2(f, 12) < 0.5 ? CHAOS_HUE.mid - CHAOS_HUE.swing : CHAOS_HUE.mid + CHAOS_HUE.swing, 1, 0.62]), 1);
    }
  }
  return L.pixels();

  /** The artifact's ring of runes, turning two places a loop; the back half draws behind the item. */
  function runeRing(front: boolean): void {
    const n = 6, turn = (t * 2 * TAU) / n, rx = size * 0.4, ry = size * 0.14, cy = ccy + size * 0.2;
    for (let i = 0; i < n; i++) {
      const a = turn + (i * TAU) / n, s = Math.sin(a);
      if ((s >= 0) !== front) continue;
      const gx = ccx + Math.cos(a) * rx, gy = cy + s * ry, R = RUNES[i % 2];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        if (R[r][c] === '#') L.rect(sn(gx) + (c - 1) * un, sn(gy) + (r - 2) * un, un, un, rgb(front ? '#ffe9b0' : '#e0a83a'), front ? 0.95 : 0.45);
      }
    }
    // the faint ring that carries them
    for (let i = 0; i < 48; i++) {
      const a = turn + (i * TAU) / 48 + TAU / 96, s = Math.sin(a);
      if ((s >= 0) !== front || i % 2) continue;
      dot(ccx + Math.cos(a) * rx, cy + s * ry, rgb(front ? '#ffe9b0' : '#e0a83a'), front ? 0.5 : 0.3);
    }
  }
}

/**
 * A cursed item's shadow falls toward the light, not away from it, and wavers like
 * something alive: the silhouette, dark with a red tip, slid up and left along the floor.
 */
function wrongShadow(L: Layer, item: Uint8ClampedArray, M: Silhouette, t: number, un: number): void {
  const w = M.w, base = 0.6 + 0.08 * Math.sin(t * TAU * 2);
  const ox = -3.5 * un, oy = -2.5 * un;
  for (let y = M.y0; y <= M.y1; y++) {
    const h = (M.y1 - y) / Math.max(1, M.y1 - M.y0);
    const wav = Math.round(Math.sin(y * 0.32 + t * TAU * 3) * 1.4 * (0.4 + h));
    const tip: Rgb = [6 + 50 * h, 2 + 4 * h, 4 + 6 * h];
    for (let x = M.x0; x <= M.x1; x++) {
      if (!M.mask[y * w + x] || item[(y * w + x) * 4 + 3] === 0) continue;
      L.put(x + ox + wav, y + oy, tip, base);
    }
  }
}
