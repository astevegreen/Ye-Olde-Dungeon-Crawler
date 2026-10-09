import { E, K, P, X, Lt, Sh, arc, breath, type PrimTree } from './kit';
import './materials';

/**
 * Gálmr the Frost-Warden: a hunched frost-jötunn leaning on his grounded maul like a warden
 * at a gate. Ice spires grow from his skull and his beard is icicles. Idle: his breath
 * puffs out and drifts, and a glint walks the crown.
 */
export function galmrModel(f: number): PrimTree {
  const cb = breath(f) * 0.4;
  const hb = breath(f) * 0.35;
  const out: PrimTree[number][] = [Sh(16.5, 28.6, 14, 2.5, 0.5)];
  // far arm: hangs to the ground, knuckles down
  out.push(K(10.5, 12, 7.2, 18.6, 3, 2.5, 'boss_jotun', { ink: -0.08 }));
  out.push(K(7.2, 18.6, 6.6, 24, 2.5, 2.2, 'boss_jotun', { ink: -0.08 }));
  out.push(E(6.6, 25.4, 2.7, 2.4, 'boss_jotun', { ink: -0.08 }));
  out.push(P([4.4, 24.6, 6.4, 23.4, 5.4, 25.8], 'boss_rime', { bv: 0.4 }));
  // legs, wrapped in fur
  out.push(K(12, 20.5, 11.4, 26.4, 2.9, 2.4, 'boss_jotun'), K(17.6, 20.5, 18.6, 26.4, 3, 2.5, 'boss_jotun'));
  out.push(E(11, 27.5, 3.2, 1.6, 'furGrey'), E(19.4, 27.5, 3.4, 1.6, 'furGrey'));
  // body: belly, a ragged fur kilt, chest, and the great hunch under a rimed pelt
  out.push(E(15.2, 17.6 - cb * 0.3, 7, 5.6, 'boss_jotun'));
  out.push(P([10, 18.6, 21.2, 18.6, 21.6, 22.6, 20.2, 22, 18.8, 24, 17.2, 22.6, 15.6, 24.4, 14, 22.6, 12.4, 23.8, 11, 22.2, 9.8, 22.8], 'furGrey', { bv: 1, ink: -0.12 }));
  out.push(arc(15.6, 15.6, 6.4, 3.8, 0.3, Math.PI - 0.3, 6, 0.7, 0.7, 'leatherDark'));
  out.push(X(14.9, 18.8, 1.4, 1.2, 'iron:4'));
  out.push(E(14.6, 12.8 - cb, 7.8, 6, 'boss_jotun'));
  out.push(E(11.6, 10.6 - cb, 6.6, 5.6, 'furGrey'));
  out.push(P([5.4, 12.4, 8, 7.2, 12, 5 - cb, 16.6, 6.6 - cb, 15.4, 9, 11.4, 9.4, 7.6, 13.4], 'boss_rime', { bv: 0.9 }));
  // the maul: head grounded in front, haft up to his fist
  out.push(K(26.2, 22.4, 24.9, 13.2, 0.95, 0.85, 'woodDark'));
  out.push(P([22.8, 21.6, 29.6, 21.2, 30.6, 22.2, 30.6, 27.6, 29.8, 28.6, 22.8, 28.7, 22, 27.8, 22, 22.4], 'boss_maul', { bv: 1.3 }));
  out.push(K(24, 21.7, 24, 28.6, 0.7, 0.7, 'iron'), K(28.5, 21.5, 28.6, 28.5, 0.7, 0.7, 'iron'));
  out.push(P([21.9, 21.8, 30.5, 21.3, 30.5, 23.3, 29.2, 23.9, 27.4, 23, 25.8, 24.2, 23.8, 23.1, 22, 23.6], 'boss_rime', { bv: 0.7 }));
  out.push(P([30.6, 23, 29.6, 23.4, 30.3, 26], 'ice'), P([23, 23.3, 22.1, 23.4, 22.4, 25.4], 'ice'));
  // near arm: thick, rimed along the top, fist on the haft
  out.push(E(18.6, 11.4 - cb, 3.6, 3.4, 'boss_jotun'));
  out.push(K(18.8, 12 - cb, 23.6, 15.8, 3, 2.5, 'boss_jotun'));
  out.push(K(19.2, 9.6 - cb, 22.8, 12.8, 1, 0.8, 'boss_rime', { occ: false }));
  out.push(K(21.6, 14, 22.6, 16.6, 1.1, 1.1, 'iron'));
  out.push(E(24.6, 16.4, 2.5, 2.4, 'boss_jotun'));
  // head thrust forward and low beneath the hunch
  const hx = 21;
  const hy = 9.6 + hb;
  // ice crown: spires grow from the skull, swept back
  out.push(P([17.4, hy - 1.4, 18.9, hy - 2.8, 16.6, hy - 7.4], 'ice', { bv: 0.7 }));
  out.push(P([18.8, hy - 3, 20.8, hy - 3.6, 19.4, hy - 9.4], 'ice', { bv: 0.8 }));
  out.push(P([20.8, hy - 3.6, 22.6, hy - 3.2, 22.2, hy - 8], 'ice', { bv: 0.7 }));
  out.push(P([22.6, hy - 2.8, 24, hy - 1.6, 24.8, hy - 5.4], 'ice', { bv: 0.6 }));
  out.push(E(hx, hy, 3.8, 3.8, 'boss_jotunHead'));
  out.push(K(hx - 1.6, hy - 3.2, hx + 2.4, hy - 3, 1, 1, 'boss_rime', { occ: false }));
  // deep-set eyes under a frosted brow
  out.push(X(hx - 1.2, hy - 0.9, 5.2, 1.9, '#1a2230'));
  out.push(X(hx - 0.3, hy - 0.5, 1.4, 1.1, 'emFrost:5', { em: true }), X(hx + 2.1, hy - 0.4, 1.2, 1.1, 'emFrost:5', { em: true }));
  out.push(K(hx - 2, hy - 1.5, hx + 3.6, hy - 1.1, 0.95, 0.85, 'boss_rime'));
  out.push(K(hx + 3.2, hy - 0.4, hx + 4.6, hy + 1.6, 1, 0.8, 'boss_jotunHead'));
  // icicle beard
  out.push(P([hx - 2.2, hy + 1.8, hx - 0.4, hy + 2.4, hx - 1.4, hy + 6.8], 'ice', { bv: 0.5 }));
  out.push(P([hx - 0.6, hy + 2.6, hx + 1.4, hy + 2.8, hx + 0.6, hy + 8.4], 'ice', { bv: 0.6 }));
  out.push(P([hx + 1.2, hy + 2.8, hx + 3, hy + 2.6, hx + 2.4, hy + 7.4], 'ice', { bv: 0.5 }));
  out.push(P([hx + 2.8, hy + 2.5, hx + 4.2, hy + 1.8, hx + 3.9, hy + 5.6], 'ice', { bv: 0.5 }));
  // a glint travels the crown from spire to spire
  const glints: Array<[number, number] | null> = [[19.4, hy - 7.6], [22.1, hy - 6.4], [24.3, hy - 4.2], null];
  const gl = glints[f % 4];
  if (gl) out.push(X(gl[0] - 0.35, gl[1] - 0.35, 0.7, 0.7, 'boss_glint:4', { em: true }));
  // frost breath: a puff leaves the mouth and drifts
  const bo = { ol: false, occ: false };
  if (f === 1) out.push(E(hx + 5.2, hy + 2.6, 1, 0.9, 'boss_breath', bo));
  if (f === 2) out.push(E(hx + 6, hy + 2.2, 1.3, 1.2, 'boss_breath', bo), E(hx + 7.4, hy + 1.6, 1, 0.9, 'boss_breath', bo));
  if (f === 3) out.push(E(hx + 7.2, hy + 1.2, 1.3, 1.1, 'boss_breath', bo), E(hx + 8.4, hy + 0.2, 0.9, 0.8, 'boss_breath', bo), E(hx + 5.2, hy + 2.6, 0.6, 0.5, 'boss_breath', bo));
  out.push(Lt(20.4, hy - 6, 5, '#9fe6ff', 0.25));
  return out;
}
