import { K, Sh, T, type Prim, type PrimOptions, type PrimTree } from './kit';
import type { FamilyVariant } from './family';
import './materials';

/**
 * Shared pieces of the item models. Every item is drawn in a local frame (upright, tip up,
 * centred on 16,16), then laid down with `rot`: long things lie on the diagonal, hilt at the
 * lower left, so the light from the upper left runs along their lit flat. Each gets a soft
 * contact shadow that peeks out to the lower right.
 *
 * The binding rule: an item's drawing carries no alignment colour. A cursed mace is a plain
 * mace; holy, cursed and enchanted are the aura the game adds once the item is identified.
 * Colour on an item is only its material or, for wands, tablets and relics, its element.
 */
export type ItemVariant = FamilyVariant;

export type Out = PrimTree[number][];

export const RAD = Math.PI / 180;

function flat(list: PrimTree, out: Prim[] = []): Prim[] {
  for (const p of list) {
    if (!p) continue;
    if (Array.isArray(p)) flat(p as PrimTree, out);
    else out.push(p as Prim);
  }
  return out;
}

/** Rotates a point by deg (clockwise on screen) about (px, py). */
export const rp = (x: number, y: number, deg: number, px = 16, py = 16): [number, number] => {
  const a = deg * RAD;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c];
};

/** Rotates a primitive list by deg (clockwise on screen) about (px, py). */
export function rot(list: PrimTree, deg: number, px = 16, py = 16): Prim[] {
  const a = deg * RAD;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const r = (x: number, y: number): [number, number] => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c];
  return flat(list).map((p): Prim => {
    switch (p.t) {
      case 'E': { const [x, y] = r(p.cx, p.cy); return { ...p, cx: x, cy: y, a: (p.a || 0) + a }; }
      case 'K': { const [x1, y1] = r(p.x1, p.y1); const [x2, y2] = r(p.x2, p.y2); return { ...p, x1, y1, x2, y2 }; }
      case 'P': {
        const q: number[] = [];
        for (let i = 0; i < p.pts.length; i += 2) q.push(...r(p.pts[i], p.pts[i + 1]));
        const o = { ...p, pts: q };
        if (p.n) o.n = [p.n[0] * c - p.n[1] * s, p.n[0] * s + p.n[1] * c, p.n[2]];
        return o;
      }
      case 'X': { const [x, y] = r(p.x + p.w / 2, p.y + p.h / 2); return { ...p, x: x - p.w / 2, y: y - p.h / 2 }; }
      case 'L': { const [x, y] = r(p.x, p.y); return { ...p, x, y }; }
      case 'S': { const [x, y] = r(p.cx, p.cy); return { ...p, cx: x, cy: y }; }
    }
  });
}

/** Contact shadow along a lying object: a row of soft ellipses, nudged down-right. */
export function shLine(x1: number, y1: number, x2: number, y2: number, r: number, a = 0.36, ox = 0.6, oy = 1.2): Prim[] {
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / r));
  const out: Prim[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(Sh(x1 + (x2 - x1) * t + ox, y1 + (y2 - y1) * t + oy, r * 1.15, r * 0.85, a));
  }
  return out;
}

/** Lays an upright local drawing down at deg, with a shadow from (16, y0) to (16, y1). */
export function lay(parts: PrimTree, deg: number, y0: number, y1: number, r = 1.5, a = 0.36): PrimTree {
  const mid = (y0 + y1) / 2;
  const dy = 16 - mid;
  const local = T(parts, { dy });
  const p0 = rp(16, y0 + dy, deg);
  const p1 = rp(16, y1 + dy, deg);
  return [shLine(p0[0], p0[1], p1[0], p1[1], r, a), rot(local, deg)];
}

/** A closed loop of capsules: rings, bows of keys, cords. r may be a function of the angle. */
export function loop(cx: number, cy: number, rx: number, ry: number, r: number | ((t: number) => number), m: string, n = 16, o: PrimOptions = {}, from = 0, to = 1): Prim[] {
  const out: Prim[] = [];
  const rr = typeof r === 'function' ? r : (): number => r;
  for (let i = 0; i < n; i++) {
    const t0 = (from + (to - from) * (i / n)) * 2 * Math.PI;
    const t1 = (from + (to - from) * ((i + 1) / n)) * 2 * Math.PI;
    out.push(K(cx + rx * Math.cos(t0), cy + ry * Math.sin(t0), cx + rx * Math.cos(t1), cy + ry * Math.sin(t1), rr(t0), rr(t1), m, o));
  }
  return out;
}

/** A hard white glint line. */
export const glint = (x1: number, y1: number, x2: number, y2: number, r = 0.4): Prim =>
  K(x1, y1, x2, y2, r, r, 'item_glint', { glow: false, ol: false, occ: false });

/** A rune stroke: a dark carved groove with the glow laid in it. */
export const stroke = (x1: number, y1: number, x2: number, y2: number, m: string, ink = 0): Prim[] => [
  K(x1, y1, x2, y2, 0.95, 0.95, 'stoneDark', { ink: -0.25, occ: false, ol: false }),
  K(x1, y1, x2, y2, 0.5, 0.5, m, { ink, occ: false, ol: false }),
];
