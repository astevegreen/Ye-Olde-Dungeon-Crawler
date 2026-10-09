import { K, P, X, Lt, breath, type Prim } from './kit';
import './materials';

/**
 * Shared pieces of the companions and townsfolk. A companion reads as yours from the drawing
 * alone: it wears the kin-mark (a leather collar with a gold rune-tag that glows faintly),
 * stands calm with ears up and mouth shut, and has steady amber eyes that do not glow.
 */
export const ALLY_EYE = '#ffc23a';
export const ALLY_PUPIL = '#24160e';

/** The kin-mark: a gold rune-tag hung from the collar's lowest point. Its light is faint and steady. */
export function kinTag(x: number, y: number, f: number, s = 1): Prim[] {
  const k = 0.42 + breath(f) * 0.12;
  return [
    X(x - 0.35, y - 0.3, 0.7, 0.8, 'gold:4'),
    P([x, y + 0.3, x + 1.3 * s, y + 1.8 * s, x, y + 3.3 * s, x - 1.3 * s, y + 1.8 * s], 'emKin'),
    X(x - 0.25, y + 1.0 * s, 0.5, 1.6 * s, 'gold:2', { em: true, glow: false }),
    Lt(x, y + 1.8, 5, '#f0c062', k),
  ];
}

/** A calm amber eye with a dark pupil toward the front: steady, no glow. */
export const calmEye = (x: number, y: number): Prim[] => [
  X(x, y, 1.15, 0.95, ALLY_EYE, { em: true, glow: false }),
  X(x + 0.6, y + 0.1, 0.55, 0.75, ALLY_PUPIL),
];

/** A loop of rope or leash: capsule segments around an ellipse, open in the middle. */
export function ring(cx: number, cy: number, rx: number, ry: number, r: number, m: string, n = 10): Prim[] {
  const o: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI;
    const a1 = ((i + 1) / n) * 2 * Math.PI;
    o.push(K(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, r, r, m, { occ: false }));
  }
  return o;
}
