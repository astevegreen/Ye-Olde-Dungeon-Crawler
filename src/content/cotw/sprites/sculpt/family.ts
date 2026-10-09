import { E, K, P, X, type Prim, type Variant } from './kit';
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

/** Rime crust with upward crystals across a shoulder. */
export function rime(cx: number, cy: number, w: number): Prim[] {
  return [
    E(cx, cy, w, w * 0.45, 'mon1_rime', { fl: 0.4 }),
    P([cx - w * 0.85, cy, cx - w * 0.6, cy - w * 0.7, cx - w * 0.3, cy - w * 0.25, cx - w * 0.05, cy - w * 0.95, cx + w * 0.25, cy - w * 0.3, cx + w * 0.6, cy - w * 0.65, cx + w * 0.9, cy], 'mon1_rime', { bv: 0.35 }),
  ];
}
