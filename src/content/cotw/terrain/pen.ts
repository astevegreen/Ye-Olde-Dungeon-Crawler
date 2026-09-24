/**
 * Drawing helpers for the terrain recipes. Recipes run in the rendering tier with a Canvas
 * 2D context, but content code stays DOM-free (§2): this structural type names only what
 * the recipes use. All variation is seeded from the recipe key, never Math.random.
 */
export interface Gradient {
  addColorStop(offset: number, color: string): void;
}

export interface Pen {
  fillStyle: string | Gradient;
  strokeStyle: string | Gradient;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient;
}

export type Rand = () => number;

/** Mulberry32 seeded from a string (the recipe key), so every bake draws the same cell. */
export function seeded(key: string): Rand {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function ell(pen: Pen, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  pen.beginPath();
  pen.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function poly(pen: Pen, pts: ReadonlyArray<readonly [number, number]>): void {
  pen.beginPath();
  pen.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) pen.lineTo(pts[i][0], pts[i][1]);
  pen.closePath();
}

export function wavyH(pen: Pen, r: Rand, y: number, amp: number, x0 = 0, x1 = 32, step = 4): void {
  pen.beginPath();
  pen.moveTo(x0, y);
  for (let x = x0 + step; x <= x1; x += step) pen.lineTo(x, y + (r() - 0.5) * amp);
  pen.stroke();
}

export function wavyV(pen: Pen, r: Rand, x: number, amp: number, y0: number, y1: number, step = 4): void {
  pen.beginPath();
  pen.moveTo(x, y0);
  for (let y = y0 + step; y <= y1; y += step) pen.lineTo(x + (r() - 0.5) * amp, y);
  pen.stroke();
}

/**
 * Draws a seamless 64x64 pattern and keeps the quadrant `q` (0-3, row-major) of it: the
 * four cells of a 2x2 block show one continuous pattern, and blocks tile edge to edge.
 * `pattern` draws in 64-unit space and is called at 9 offsets so shapes wrap.
 */
export function macroQuadrant(pen: Pen, q: number, pattern: (pen: Pen) => void): void {
  pen.save();
  pen.beginPath();
  pen.rect(0, 0, 32, 32);
  pen.clip();
  pen.translate(-(q & 1) * 32, -(q >> 1) * 32);
  for (const dy of [-64, 0, 64]) {
    for (const dx of [-64, 0, 64]) {
      pen.save();
      pen.translate(dx, dy);
      pattern(pen);
      pen.restore();
    }
  }
  pen.restore();
}
