import { E, K, P, X, Lt, Sh, type PrimTree } from './kit';
import './materials';

/** The spine's five flame tongues: where each rises and how tall. */
const PEAKS: ReadonlyArray<[number, number]> = [[8.6, 3.6], [11.6, 6.2], [15, 8], [18.6, 5.4], [21.6, 3.2]];
/** Seams of fire across the crust. */
const CRACKS: ReadonlyArray<[number, number, number, number]> = [
  [9, 19.6, 11, 21.2], [11, 21.2, 10.6, 23.2], [11, 21.2, 13.2, 22], [14.6, 18.8, 15.8, 20.8], [15.8, 20.8, 18.4, 21.6],
  [15.8, 20.8, 15.2, 23.2], [19.6, 19.2, 21.4, 21], [21.4, 21, 23.4, 20.6], [12.2, 18.6, 12.8, 19.8],
];

/**
 * Glóð, the fire salamander: long and low, cooling magma, a black crust cracked open on the
 * fire inside, flames licking back along the spine. Lit from within. Idle: the flames
 * flicker, the cracks pulse, an ember drifts up.
 */
export function glodModel(f: number): PrimTree {
  const pulse = [0, 0.6, 1, 0.4][f % 4];
  const out: PrimTree[number][] = [Sh(16, 28.6, 14.5, 2.1, 0.5)];
  const ci = -0.25 + pulse * 0.25;
  // tail curling back up behind
  out.push(K(9, 22, 4.4, 24.6, 2.3, 1.5, 'boss_crust'));
  out.push(K(4.4, 24.6, 1.8, 21.8, 1.5, 0.9, 'boss_crust'));
  out.push(K(1.8, 21.8, 2.8, 18.6, 0.9, 0.4, 'boss_crust'));
  out.push(E(2.8, 18.4, 0.6, 0.7, 'emFire'));
  // far legs
  out.push(K(10.6, 23, 8.2, 26.6, 1.2, 0.9, 'boss_crust', { ink: -0.08 }), E(7.6, 27.2, 1.5, 0.8, 'boss_crust', { ink: -0.08 }));
  out.push(K(21, 23, 23.6, 26.4, 1.2, 0.9, 'boss_crust', { ink: -0.08 }), E(24.4, 27, 1.5, 0.8, 'boss_crust', { ink: -0.08 }));
  // one crest of fire along the spine: five tongues of uneven height, all streaming back, flickering
  const by = 19.2;
  const outer = [6.6, by];
  const inner = [8, by];
  PEAKS.forEach(([x, h], i) => {
    const hh = h * [1, 1.15, 0.88, 1.06][(f + i * 3) % 4];
    const L = [-1.6, -2.3, -1.1, -1.9][(f + i * 2) % 4];
    outer.push(x - 0.9, by - 1.2 - (i ? 0.6 : 0), x + L * 0.5 - 0.2, by - hh * 0.6, x + L, by - hh, x + 0.6 + L * 0.3, by - hh * 0.5, x + 1.3, by - 1.4);
    inner.push(x - 0.6, by - 0.6, x + L * 0.55, by - hh * 0.55, x + 0.7, by - 0.8);
  });
  outer.push(23.4, by);
  inner.push(22.2, by);
  out.push(P(outer, 'emFire', { bv: 0.6 }));
  out.push(P(inner, 'emFireCore'));
  // the body: crust over fire
  out.push(E(15.6, 21.6, 9.4, 4, 'boss_crust'));
  out.push(E(15.6, 20.8, 8.6, 3, 'boss_crust'));
  for (const [x1, y1, x2, y2] of CRACKS) out.push(K(x1, y1, x2, y2, 0.4, 0.34, 'emFire', { ink: ci, occ: false, ol: false }));
  // near legs, splayed
  out.push(K(12.6, 23, 13.8, 27, 1.5, 1, 'boss_crust'), E(14.4, 27.6, 1.8, 0.9, 'boss_crust'));
  out.push(K(22.4, 23, 21.6, 27, 1.5, 1, 'boss_crust'), E(22.4, 27.6, 1.8, 0.9, 'boss_crust'));
  out.push(X(15.6, 27.5, 0.7, 0.6, 'emFire:3', { em: true }), X(23.6, 27.5, 0.7, 0.6, 'emFire:3', { em: true }));
  // head: broad and flat, eyes bulging up top, a seam of fire for a mouth
  out.push(E(25.4, 20.8, 3.6, 2.8, 'boss_crust'));
  out.push(K(25.6, 21.2, 29.8, 22.2, 2.2, 1.3, 'boss_crust'));
  out.push(K(25.2, 22.6, 29.8, 22.8, 0.32, 0.3, 'emFire', { occ: false, ol: false }));
  out.push(E(26.6, 18.6, 1.4, 1.1, 'boss_crust'));
  out.push(X(26.6, 18.2, 1.1, 0.9, 'emFireCore:4', { em: true }));
  out.push(K(27.6, 20.2, 28.8, 21.2, 0.3, 0.3, 'emFire', { ink: ci, occ: false, ol: false }));
  // an ember drifting up off the flames
  const [emx, emy] = [[12, 9.4], [16.4, 7.4], [8.2, 11], [19.6, 10.2]][f % 4];
  out.push(X(emx, emy, 0.6, 0.6, 'emFireCore:4', { em: true }));
  out.push(Lt(15, 18.4, 12, '#ff8a2c', 0.6 + pulse * 0.25));
  return out;
}
