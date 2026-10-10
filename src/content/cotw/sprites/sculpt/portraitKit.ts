import { E, K, P, X, Lt, type Prim, type PrimOptions, type PrimTree } from './kit';

/*
 * Portraits: large art for the bestiary, the shop greeting and the companion panel. Each is
 * drawn on a 96-unit square (three tiles across) and bakes at 192 px in the hearth style.
 *
 * Each portrait carries its own ground, part of the model: an emissive dark material in flat
 * ink bands (a pixel-art vignette: no airbrush, no key light, no occlusion on it). Because the
 * ground fills the square, the outline and glow passes (which only paint empty pixels) do
 * nothing inside a portrait: the figure separates from the ground by value, and every glow is
 * a real point light on the surfaces around it. One strong light per portrait.
 *
 * This module holds what every portrait file shares.
 */

/** The square every portrait is drawn on, in units. */
export const PORTRAIT_GRID = 96;

export type Pt = [number, number];
export type Out = PrimTree[number][];

export const FULL = [0, 0, 96, 0, 96, 96, 0, 96];
/** Ink for each emissive band: 1 = deep, 2 = mid, 3 = base, 4 = light. */
export const BAND = { 1: -0.8, 2: -0.6, 3: -0.4, 4: -0.2, 5: 0 } as const;

/** The ground: flat emissive bands of one dark material around (cx, cy). */
export function ground(m: string, cx: number, cy: number, rx: number, ry: number): Prim[] {
  return [
    P(FULL, m, { ink: BAND[1] }),
    E(cx, cy, rx, ry, m, { fl: 1, ink: BAND[2] }),
    E(cx, cy, rx * 0.58, ry * 0.58, m, { fl: 1, ink: BAND[3] }),
  ];
}

/** Point on a quadratic curve a -> b (control c), and its tangent. */
export function qpt(a: Pt, c: Pt, b: Pt, t: number): [number, number, number, number] {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];
}

/** A tapering strand along a quadratic curve a -> c (control b), as capsules. */
export function strand(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n = 4, o: PrimOptions = {}): Prim[] {
  const out: Prim[] = [];
  let px = ax, py = ay;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const [x, y] = qpt([ax, ay], [bx, by], [cx, cy], t);
    out.push(K(px, py, x, y, r0 + (r1 - r0) * ((i - 1) / n), r0 + (r1 - r0) * t, m, o));
    px = x; py = y;
  }
  return out;
}

/** A rotated local frame: x along the snout, y down, pivot (px, py). */
export function frame(px: number, py: number, ang: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  return {
    pt,
    P: (pts: number[], m: string, o?: PrimOptions): Prim => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}): Prim => { const [a, b] = pt(x, y); return E(a, b, rx, ry, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions): Prim => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1, r2, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions): Prim => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - w / 2, b - h / 2, w, h, m, o); },
    Lt: (x: number, y: number, r: number, col: string, k: number, z: number): Prim => { const [a, b] = pt(x, y); return Lt(a, b, r, col, k, z); },
  };
}
