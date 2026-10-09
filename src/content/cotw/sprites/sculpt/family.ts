import { E, K, P, X, type Prim, type PrimOptions, type Variant } from './kit';
import './materials';

/**
 * Shared pieces of the regular monster families. A family is one model drawing several
 * definitions: `kind` picks the body (gear, horns, posture), `pal` recolours it. Eyes carry
 * a creature's nature: violet for the dead, amber for the living, pale cyan for frost,
 * ember for fire.
 */
export interface FamilyVariant extends Variant {
  kind?: string;
}

export const VIO = '#dcc0ff';
export const VIOL = '#a868ff';
export const DARK = '#15121a';

/** A violet eye: the dead. */
export const vEye = (x: number, y: number, w = 1, h = 1): Prim => X(x, y, w, h, VIO, { em: true });
/** An amber eye: the living. */
export const aEye = (x: number, y: number, w = 1, h = 0.9): Prim => X(x, y, w, h, 'eyeAmber:4', { em: true });
/** A pale cyan eye: frost. */
export const fEye = (x: number, y: number, w = 1, h = 0.9): Prim => X(x, y, w, h, '#d8f8ff', { em: true });
/** An ember eye: fire. */
export const eEye = (x: number, y: number, w = 1, h = 0.9): Prim => X(x, y, w, h, '#ffd87e', { em: true });

/** A chain of alternating face-on and edge-on links from (x0, y0) to (x1, y1). */
export function chain(x0: number, y0: number, x1: number, y1: number, n: number, m = 'iron'): Prim[] {
  const o: Prim[] = [];
  const dx = (x1 - x0) / n;
  const dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + dx * (i + 0.5);
    const cy = y0 + dy * (i + 0.5);
    const r = i % 2 ? 0.34 : 0.62;
    o.push(K(cx - dx * 0.42, cy - dy * 0.42, cx + dx * 0.42, cy + dy * 0.42, r, r, m, { ink: i % 2 ? -0.1 : 0.04 }));
  }
  return o;
}

/** A polyline of capsules (flat x,y list) whose radius tapers from r0 to r1. */
export function limb(pts: number[], r0: number, r1: number, m: string, o?: PrimOptions): Prim[] {
  const out: Prim[] = [];
  const n = pts.length / 2 - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    out.push(K(pts[2 * i], pts[2 * i + 1], pts[2 * i + 2], pts[2 * i + 3], ra, rb, m, o));
  }
  return out;
}

/** A chain along a polyline (flat x,y list): links of size `s` alternate face-on and edge-on. */
export function links(pts: number[], m: string, s = 1): Prim[] {
  const out: Prim[] = [];
  let k = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x1 = pts[i];
    const y1 = pts[i + 1];
    const x2 = pts[i + 2];
    const y2 = pts[i + 3];
    const a = Math.atan2(y2 - y1, x2 - x1);
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / (1.25 * s)));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      out.push(k++ % 2 ? E(x, y, 0.95 * s, 0.42 * s, m, { a }) : E(x, y, 0.85 * s, 0.68 * s, m, { a, fl: 0.35 }));
    }
  }
  return out;
}

/** A spike: base centred at (x, y), width w, tip offset (dx, dy). */
export const spike = (x: number, y: number, w: number, dx: number, dy: number, m: string, o?: PrimOptions): Prim => P([x - w / 2, y, x + w / 2, y, x + dx, y + dy], m, o);

/** Claws: n hooked capsules fanning from (x, y) toward angle `dir`. */
export function claws(x: number, y: number, dir: number, len: number, m: string, n = 3, r = 0.38): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const a = dir + (i - (n - 1) / 2) * 0.45;
    out.push(K(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, r, 0.1, m));
  }
  return out;
}

/** Rime crust with upward crystals across a shoulder. */
export function rime(cx: number, cy: number, w: number): Prim[] {
  return [
    E(cx, cy, w, w * 0.45, 'mon1_rime', { fl: 0.4 }),
    P([cx - w * 0.85, cy, cx - w * 0.6, cy - w * 0.7, cx - w * 0.3, cy - w * 0.25, cx - w * 0.05, cy - w * 0.95, cx + w * 0.25, cy - w * 0.3, cx + w * 0.6, cy - w * 0.65, cx + w * 0.9, cy], 'mon1_rime', { bv: 0.35 }),
  ];
}
