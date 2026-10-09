import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { claws, limb, spike, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** Frost Drake: wingless, long-necked, a ridge of icicles from crown to tail, breath smoking in the cold. */
function frostDrake(f: number): PrimTree {
  const b = breath(f);
  const sc = 'mon2_frostScale';
  const bl = 'mon2_frostBelly';
  const out: Out = [Sh(15, 28.6, 12.4, 2.3)];
  out.push(limb([9, 20, 4.6, 22.6, 2.6, 26, 5.4, 28, 10, 28.2], 2.2, 0.35, sc));
  // far legs
  out.push(limb([19.6, 21, 21, 24.4, 20.4, 27.8], 1.5, 1.1, sc, { ink: -0.12 }));
  out.push(limb([11.4, 21, 13.4, 24, 12.2, 27.8], 1.6, 1.1, sc, { ink: -0.12 }));
  // body
  out.push(E(13.6, 19.4 + b * 0.2, 7.4, 4.6, sc, { a: -0.12 }));
  out.push(E(15.8, 22.2, 5.2, 2, bl));
  out.push(E(10.4, 20.6, 3.2, 3.8, sc));
  out.push(limb([10.6, 22.6, 9.2, 25.2, 10, 27.8], 1.8, 1.1, sc), claws(10.4, 28, 0, 1.6, 'ice', 3, 0.4));
  // neck and throat
  const hy = b * 0.15;
  out.push(limb([17.8, 17, 20, 12.4, 21.8, 8.2 + hy], 2.8, 1.8, sc));
  out.push(limb([19.8, 18, 21.8, 13.2, 23.2, 9.6 + hy], 1.2, 0.8, bl));
  // near front leg
  out.push(limb([19, 20.6, 20.4, 24.2, 19.6, 27.8], 1.7, 1.2, sc), claws(20, 28, 0, 1.7, 'ice', 3, 0.42));
  // icicle ridge
  const sp = [[21.4, 7.8, 2.4], [20.6, 10.4, 2.8], [19.4, 13, 3.2], [17.6, 15.2, 3.6], [15, 15.4, 4.2], [12.4, 15.8, 3.6], [9.8, 17, 3], [7.4, 18.8, 2.2], [5, 20.8, 1.6]];
  for (const [x, y, h] of sp) out.push(spike(x, y + 0.6, 1.5, -1.3, -h, 'ice', { bv: 0.35 }));
  // head
  out.push(E(23.2, 7.4 + hy, 2.8, 2.2, sc, { a: 0.2 }));
  out.push(K(24, 7.8 + hy, 28.4, 9.2 + hy, 1.7, 1.1, sc));
  out.push(K(23.6, 9.6 + hy, 27.4, 10.8 + hy, 1.05, 0.7, bl));
  out.push(K(22.4, 5.8 + hy, 18.6, 3.2 + hy, 0.9, 0.2, 'ice'), K(23.4, 5.6 + hy, 21.4, 2.2 + hy, 0.8, 0.2, 'ice'));
  out.push(X(24, 7.1 + hy, 1, 0.7, 'emFrost:4'));
  // breath, curling down from the mouth and clear of the cell's right edge
  const m = f * 0.3;
  out.push(E(28.4 + m * 0.4, 11.4 + m, 1.6, 1.3, 'mon2_mist'), E(29.2, 13.8 + m * 0.6, 1.3, 1.6, 'mon2_mist'), E(27.2, 15.4 + m, 1.1, 0.9, 'mon2_mist'));
  out.push(Lt(27.4, 10.4, 5, '#9fe6ff', 0.5));
  return out;
}

/** Ancient Wyrm: old, huge, bronze gone black, wings folded high, scarred by a thousand years of hunters. Its throat glows between the plates. */
function ancientWyrm(f: number): PrimTree {
  const b = breath(f);
  const sc = 'mon2_wyrmScale';
  const bl = 'mon2_wyrmBelly';
  const wg = 'mon2_wyrmWing';
  const out: Out = [Sh(15.6, 28.8, 14.6, 2.6)];
  // far wing, folded high, its peak a unit below the cell's top row
  out.push(P([13.4, 13.4, 9.6, 3.6, 6.4, 2, 4.6, 6, 2, 9.4, 4.2, 12.2, 1.4, 16.4, 6.4, 17.2, 9, 19], wg, { bv: 0.8, ink: -0.04 }));
  out.push(limb([13.4, 13.4, 9.6, 3.6, 6.4, 2], 1, 0.5, 'horn'), K(6.4, 2, 2.2, 9.2, 0.4, 0.2, 'horn'), K(6.4, 2, 1.6, 16, 0.4, 0.2, 'horn'));
  out.push(E(5.2, 11.4, 0.8, 0.6, 'mon2_wyrmWing', { ink: -0.5, ol: false }));
  // tail curled round the front
  out.push(limb([8.6, 22, 4, 24.4, 3.2, 27.2, 7.4, 28.6, 13, 28.6], 3.2, 0.4, sc));
  out.push(limb([21, 22, 22.4, 25, 21.8, 28], 2.1, 1.6, sc, { ink: -0.12 }));
  // body
  out.push(E(13.8, 19.6 + b * 0.2, 9.6, 6.8, sc, { a: -0.1 }));
  out.push(E(16.4, 23.4, 7.2, 3, bl));
  for (const x of [12, 15, 18, 21]) out.push(K(x, 21.4, x + 0.4, 25.8, 0.3, 0.3, bl, { ink: -0.25 }));
  // scars
  out.push(K(9, 16, 13.2, 20.2, 0.35, 0.3, 'mon2_scar'), K(11.6, 15.2, 15.2, 18.8, 0.35, 0.3, 'mon2_scar'), K(17.6, 18, 18.8, 21.6, 0.3, 0.3, 'mon2_scar'));
  // haunch and back foot
  out.push(E(8.6, 21.6, 4.4, 4.8, sc), E(9.6, 27.8, 3.4, 1.4, sc), claws(11.8, 28, -0.1, 1.6, 'horn', 3, 0.45));
  // near wing folded on the flank
  out.push(P([9.4, 15, 15.4, 10.2, 18.4, 11.4, 16.6, 17.4, 12.6, 20, 8.4, 19.4], wg, { bv: 1 }));
  out.push(limb([9.4, 15, 15.4, 10.2, 18.4, 11.4], 0.6, 0.45, 'horn'));
  // neck, with the ember throat showing between plates
  out.push(limb([18.4, 17, 21.6, 12.6, 23.8, 9.6], 4.2, 2.8, sc));
  const pl = [0, 0.06, 0.1, 0.05][f];
  out.push(limb([20.6, 19, 23.2, 14.6, 25.6, 12.4], 1.5, 1.05, 'emFire', { ink: pl }));
  for (const [x, y] of [[21.2, 17.4], [22.2, 15.6], [23.4, 14], [24.8, 12.8]]) out.push(K(x - 1.1, y - 0.7, x + 1.1, y + 0.7, 0.42, 0.42, bl, { ink: -0.1 }));
  // dorsal plates
  for (const [x, y, h] of [[20.6, 11.2, 2.2], [17.6, 13.4, 2.6], [14.4, 13, 2.6], [11.2, 13.8, 2.2]]) out.push(spike(x, y + 0.6, 1.8, -1.4, -h, 'bronze', { bv: 0.5 }));
  // front leg
  out.push(limb([20, 20.6, 21.2, 24.6, 20.6, 27.8], 2.6, 2, sc), E(22, 28, 2.8, 1.3, sc), claws(24, 28.1, 0, 1.7, 'horn', 3, 0.45));
  // head: heavy brow, swept horns, beard of spikes
  const hy = b * 0.15;
  out.push(limb([24, 6.6 + hy, 20.6, 4.6 + hy, 17.4, 4.8 + hy], 1.6, 0.35, 'horn'));
  out.push(E(25.4, 8.6 + hy, 3.6, 2.8, sc, { a: 0.2 }));
  // the muzzle is shorter than the bible's, whose tip ran past the cell's right edge
  out.push(K(26.4, 9.2 + hy, 29.2, 10.6 + hy, 2.2, 1.3, sc));
  out.push(K(25.4, 11.4 + hy, 28.8, 12.6 + hy, 1.5, 1, sc));
  out.push(spike(25.8, 12.6 + hy, 1.4, -0.8, 2, 'horn'), spike(27, 13.1 + hy, 1.2, -0.6, 1.6, 'horn'));
  out.push(K(23.4, 6.8 + hy, 27.6, 7.6 + hy, 1, 0.8, sc));
  out.push(limb([25.4, 6.2 + hy, 24.2, 3 + hy, 21.8, 1.2 + hy], 1.2, 0.3, 'horn'));
  out.push(K(24.8, 10.2 + hy, 27.4, 9.4 + hy, 0.3, 0.3, 'mon2_scar'));
  out.push(X(26.2, 8.2 + hy, 1.2, 0.7, 'emFire:4'), X(28.4, 9.8 + hy, 0.6, 0.5, 'emFire:4'));
  out.push(Lt(23.2, 14.6, 11, '#ff8a2c', 1));
  return out;
}

/** Grave-Wyrmling: one of Níðhögg's brood. Big head, wings that will never carry it, acid dripping on the stone. */
function wyrmling(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const sc = 'mon2_graveScale';
  const out: Out = [Sh(15.6, 28.6, 7.4, 1.9)];
  out.push(limb([11.6, 24.6, 7.6, 26.4, 5, 25.4, 4.6, 23 + sw * 0.3], 1.4, 0.3, sc));
  out.push(limb([18.4, 25, 19.6, 27.8], 1, 0.8, sc, { ink: -0.12 }));
  // far stub wing
  out.push(P([14.6, 21.6, 14.6, 17.6, 16.2, 18.6, 17.6, 17.4, 17.6, 21], 'mon2_graveWing', { ink: -0.12 }));
  // body
  out.push(E(14.8, 24.4 + b * 0.15, 4.6, 3, sc));
  out.push(E(16, 26, 3, 1.3, 'mon2_graveBelly'));
  out.push(E(12, 24.6, 2.6, 2.8, sc), E(12.6, 28, 1.7, 0.75, sc), claws(14, 28.1, 0, 1, 'boneOld', 3, 0.3));
  out.push(limb([17.6, 25, 18.6, 27.8], 1.1, 0.8, sc), claws(19.2, 28.1, 0, 1.1, 'boneOld', 3, 0.3));
  // near stub wing, too small
  out.push(P([13, 22.4, 11.6, 17.8, 13.2, 19, 14.4, 17.4, 15.6, 21.6], 'mon2_graveWing'));
  out.push(limb([13, 22.4, 11.6, 17.8], 0.4, 0.3, 'boneOld'));
  // neck, head
  const hy = b * 0.2;
  out.push(limb([17.4, 23, 18.8, 20.4 + hy], 1.8, 1.5, sc));
  out.push(K(19, 16.6 + hy, 17.4, 14.8 + hy, 0.6, 0.2, 'boneOld'), K(20.4, 16.2 + hy, 19.8, 14.2 + hy, 0.5, 0.18, 'boneOld'));
  out.push(E(20.4, 18.6 + hy, 3.2, 2.7, sc, { a: 0.15 }));
  out.push(E(23.2, 21.2 + hy, 1.2, 0.5, 'emPoison'));
  out.push(K(21.4, 19.2 + hy, 25, 20.4 + hy, 1.6, 1.1, sc));
  out.push(K(21, 21.2 + hy, 24.4, 22.2 + hy, 1, 0.7, sc));
  out.push(X(21.2, 18.2 + hy, 0.9, 0.8, 'emPoison:4'));
  // acid drool, a drop, a sizzling puddle
  out.push(K(23.8, 22.4 + hy, 23.9, 23.6 + f * 0.4, 0.35, 0.25, 'emPoison'));
  out.push(E(24, 24.6 + f * 0.8, 0.45, 0.55, 'emPoison'));
  out.push(E(24.2, 28.3, 1.7, 0.45, 'emPoison', { fl: 0.8, ink: -0.15 }));
  out.push(Lt(23.4, 21.6, 6, '#95dc4c', 0.7));
  return out;
}

/** Drakes and wyrms: one body plan at three ages. Kinds: `frost` (all neck and spines), `ancient` (all mass and wing), `grave` (the hatchling, all head). */
export function drakeModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'ancient': return ancientWyrm(f);
    case 'grave': return wyrmling(f);
    default: return frostDrake(f);
  }
}
