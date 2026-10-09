import { E, K, P, X, Lt, Sh, breath, drip, type PrimTree } from './kit';
import './materials';

/**
 * Gloom-Tarr, the Bile-Drinker: a slumped mound of wet tar wallowing in a pool of bile, its
 * maw sunk to drink, a snuffed miner's lantern still caught in its hide. Lit only by the bile
 * below. Idle: bubbles rise and burst on its back, bile drips from the lip.
 */
export function gloomTarrModel(f: number): PrimTree {
  const b = breath(f);
  const out: PrimTree[number][] = [Sh(16, 28.4, 15, 2.4, 0.55)];
  out.push(E(16.4, 27.4, 14.6, 2.4, 'boss_pool', { fl: 0.9 }));
  // the mound
  out.push(K(6.2, 21, 4.6, 26.8, 2.6, 3, 'boss_tar', { ink: -0.04 }));
  out.push(E(13.4, 19.4, 11, 8.4 + b * 0.2, 'boss_tar'));
  out.push(E(11.2, 13.2 - b * 0.3, 7.6, 6.4, 'boss_tar'));
  out.push(E(9, 9.8 - b * 0.3, 3.6, 3, 'boss_tar'));
  // the snuffed lantern, hooked into the hump and half swallowed
  out.push(K(6.4, 7.2 - b * 0.3, 7.6, 10.4, 0.35, 0.35, 'iron', { occ: false }));
  out.push(P([5.3, 10.8, 9.3, 10.4, 9.7, 15.4, 5.7, 15.8], 'iron', { bv: 0.5 }));
  out.push(P([6.1, 11.6, 8.7, 11.3, 9, 14.8, 6.4, 15], 'boss_glassDead'));
  out.push(K(7.4, 11.4, 7.6, 15, 0.3, 0.3, 'iron', { occ: false }));
  out.push(P([5, 10.9, 7.2, 9.4, 9.6, 10.5], 'iron', { bv: 0.4 }));
  out.push(E(7.6, 16.4, 3, 1.6, 'boss_tar'));
  const [smx, smy, smr] = [[7.4, 8.2, 0.5], [7.8, 7, 0.6], [7.2, 5.8, 0.7], [7.6, 4.8, 0.5]][f % 4];
  out.push(E(smx, smy, smr, smr * 1.3, 'boss_smokeGrey', { ol: false, occ: false }));
  // the drinking head-lobe, maw gaping down into the bile
  out.push(E(22.2, 18.2, 6.8, 6.2, 'boss_tar'));
  out.push(K(19, 25, 21.4, 27.2, 2.6, 2.6, 'boss_tar'));
  out.push(P([21.4, 20.4, 26, 17.6, 29.4, 18.2, 30.6, 21, 30, 24.6, 27.6, 26.4, 23.2, 25.8], 'boss_maw'));
  out.push(E(26.6, 25.6, 3.4, 1.2, 'boss_bile', { fl: 0.6, ink: -0.1 }));
  // lips: an overhanging upper lip and a lower one sunk in the bile
  out.push(K(20.8, 20.2, 26, 17.4, 1.4, 1.2, 'boss_tar'));
  out.push(K(26, 17.4, 29.4, 17.8, 1.2, 1, 'boss_tar'));
  out.push(K(29.4, 17.8, 30.8, 20.6, 1, 0.8, 'boss_tar'));
  out.push(K(22.6, 25.8, 30, 26.6, 1.1, 0.9, 'boss_tar'));
  for (const [tx, ty, th] of [[23.6, 19.6, 1.6], [26, 18.6, 2], [28.4, 18.8, 1.5]]) out.push(P([tx - 0.6, ty - 0.2, tx + 0.6, ty - 0.3, tx + 0.1, ty + th], 'boneOld'));
  for (const [tx, ty] of [[25, 25.6], [28.6, 26]]) out.push(P([tx - 0.5, ty + 0.2, tx + 0.5, ty + 0.2, tx, ty - 1.3], 'boneOld'));
  // bile strands from lip to pool
  out.push(K(24.8, 19.8, 25.2, 25, 0.28, 0.34, 'boss_bile', { occ: false, ol: false }));
  out.push(drip(27.4, 19.4, 5.6, f, 0, 'boss_bile', 0.6));
  out.push(drip(29.2, 19.6, 5, f, 2, 'boss_bile', 0.5));
  // a cluster of small bile-lit eyes above the maw
  out.push(X(21.4, 14.4, 1, 0.9, 'emPoison:4', { em: true }), X(23.4, 13.8, 1.1, 1, 'emPoison:4', { em: true }), X(25.4, 14.6, 0.9, 0.8, 'emPoison:4', { em: true }));
  // bile bubbles rise and burst on its back
  const bubbles: Array<[number, number, number] | null> = [[15, 11.6, 0.7], [15.2, 11, 1.1], [15.3, 10.4, 1.5], null];
  const bub = bubbles[f % 4];
  if (bub) out.push(E(bub[0], bub[1], bub[2], bub[2] * 0.9, 'boss_bile', { ink: -0.15 }));
  else out.push(X(14, 9.2, 0.6, 0.6, 'boss_bile:4', { em: true }), X(16.2, 8.8, 0.6, 0.6, 'boss_bile:4', { em: true }), X(15.1, 8, 0.5, 0.5, 'boss_bile:4', { em: true }));
  const bubbles2: Array<[number, number, number] | null> = [null, [11, 17.2, 0.6], [11.1, 16.6, 0.9], [11.1, 16, 1.1]];
  const bub2 = bubbles2[f % 4];
  if (bub2) out.push(E(bub2[0], bub2[1], bub2[2], bub2[2] * 0.9, 'boss_bile', { ink: -0.2 }));
  // the bile lights it from below: a green sheen on every lower edge
  out.push(Lt(26.4, 24.6, 9, '#95dc4c', 0.8, 3));
  out.push(Lt(14, 30.5, 14, '#7fc040', 0.4, 1.5));
  return out;
}
