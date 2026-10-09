import { K, P, X, type Prim } from './kit';
import './materials';

/**
 * Shared pieces of the fixtures: altars, portals, the siphon and chests, things that stand on
 * the floor. A fixture that glows lights itself with its own point light at the rune, water or
 * rift. Runes are drawn strokes (capsules), never font glyphs.
 */

const PI = Math.PI;

/** Points around an ellipse from angle a0 to a1, as a flat x,y list; a full turn does not repeat its first point. */
export function ell(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = PI * 2, n = 28): number[] {
  const pts: number[] = [];
  const full = Math.abs(a1 - a0 - PI * 2) < 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return pts;
}

/**
 * A block seen from the south with a sliver of its right side showing: front face x0..x1 by
 * y0..y1, its top receding by d (and 0.3d to the right). Lit top, base front, shadowed side.
 */
export function block(x0: number, y0: number, x1: number, y1: number, d: number, m: string, o: { sideInk?: number; topInk?: number; frontInk?: number; bv?: number } = {}): Prim[] {
  const ex = d * 0.3;
  const ey = -d;
  return [
    P([x1, y0, x1 + ex, y0 + ey, x1 + ex, y1 + ey, x1, y1], m, { n: [0.7, -0.2, 0.7], bv: 0.4, ink: o.sideInk || 0 }),
    P([x0, y0, x1, y0, x1 + ex, y0 + ey, x0 + ex, y0 + ey], m, { n: [0, -0.93, 0.37], bv: 0.5, ink: o.topInk || 0 }),
    P([x0, y0, x1, y0, x1, y1, x0, y1], m, { bv: o.bv ?? 0.7, ink: o.frontInk || 0 }),
  ];
}

/** Rune strokes in a unit box (u across, v down). */
const RUNES = {
  tiwaz: [[0.5, 0, 0.5, 1], [0.5, 0, 0, 0.42], [0.5, 0, 1, 0.42]], // Tyr
  ansuz: [[0.15, 0, 0.15, 1], [0.15, 0, 0.95, 0.3], [0.15, 0.34, 0.95, 0.64]], // Odin
  algiz: [[0.5, 0, 0.5, 1], [0.5, 0.45, 0, 0], [0.5, 0.45, 1, 0]], // Hel
  laguz: [[0.2, 0, 0.2, 1], [0.2, 0, 0.9, 0.42]], // Loki
  uruz: [[0.1, 0, 0.1, 1], [0.1, 0, 0.9, 0.34], [0.9, 0.34, 0.9, 1]], // Urðr
  othala: [[0.5, 0, 0.92, 0.36], [0.5, 0, 0.08, 0.36], [0.08, 0.36, 0.95, 1], [0.92, 0.36, 0.05, 1]],
  thurisaz: [[0.15, 0, 0.15, 1], [0.15, 0.2, 0.88, 0.5], [0.88, 0.5, 0.15, 0.8]], // the thorn
} satisfies Record<string, Array<[number, number, number, number]>>;

/** A rune drawn as strokes, centred at (cx, cy), h tall; `aspect` is its width over its height. */
export function rune(name: keyof typeof RUNES, cx: number, cy: number, h: number, m: string, o: { aspect?: number; r?: number; ink?: number } = {}): Prim[] {
  const w = h * (o.aspect ?? 0.62);
  const r = o.r ?? 0.6;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  return RUNES[name].map(([a, b, c, d]) => K(x0 + a * w, y0 + b * h, x0 + c * w, y0 + d * h, r, r, m, { fl: 0.3, ink: o.ink || 0 }));
}

/** A ring of n capsules: a manacle, a lock ring, a chain link seen face-on. */
export function ring(cx: number, cy: number, rx: number, ry: number, r: number, m: string, n = 8): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const b = ((i + 1) / n) * PI * 2;
    out.push(K(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, r, r, m));
  }
  return out;
}

/** A four-point star glint of half-size s, in tone 5 of material c. */
export const glint = (x: number, y: number, s: number, c = 'fix_star'): Prim[] => [
  X(x - s, y - 0.25, s * 2, 0.5, `${c}:5`, { em: true }),
  X(x - 0.25, y - s, 0.5, s * 2, `${c}:5`, { em: true }),
];
