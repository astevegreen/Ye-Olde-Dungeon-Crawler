import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { DARK, aEye, type FamilyVariant } from './family';
import './materials';

/**
 * Wolves: lean, long-legged, nose to the right. Kinds: `wolf` (grey, hackles raised), `rime`
 * (white, a ridge of ice shards, smaller) and `brim` (storm-grey, head thrown back, breathing
 * a plume of frost).
 */
export function wolfModel(f: number, v: FamilyVariant): PrimTree {
  const kind = v.kind || 'wolf';
  const b = breath(f);
  const sw = sway(f);
  const rimeW = kind === 'rime';
  const howl = kind === 'brim';
  const fur = rimeW ? 'mon1_furRime' : howl ? 'mon1_furStorm' : 'furGrey';
  const pale = rimeW ? 'furWhite' : 'mon1_muzzle';
  const far = { ink: -0.2 };
  const by = b * 0.15;
  const o: PrimTree[number][] = [Sh(15.4, 28.6, 9.4, 1.9)];
  // tail: out and level while it bristles, low while it howls
  if (howl) o.push(K(8.2, 16.6, 5.4, 20.6, 1.7, 1.3, fur), K(5.4, 20.6, 4.6 + sw * 0.3, 24.2, 1.3, 0.5, fur, { ink: -0.06 }));
  else o.push(K(8.2, 16, 4.6, 17.2, 1.7, 1.4, fur), K(4.6, 17.2, 1.8 + sw * 0.25, 19.4, 1.4, 0.5, fur, { ink: -0.06 }));
  // far legs
  o.push(K(11.6, 20.2, 10.4, 24.4, 1.2, 0.8, fur, far), K(10.4, 24.4, 11.4, 27.8, 0.75, 0.65, fur, far), E(11.8, 27.9, 1.2, 0.6, fur, far));
  o.push(K(21.2, 20.4, 21.6, 24.6, 1.05, 0.75, fur, far), K(21.6, 24.6, 22, 27.8, 0.75, 0.65, fur, far), E(22.6, 27.9, 1.2, 0.6, fur, far));
  // body: haunch, tucked loin, deep chest
  o.push(E(9.8, 18 + by, 3, 3.4, fur));
  o.push(K(10.6, 17.4 + by, 16, 17.2 + by, 2.6, 3.2, fur));
  o.push(E(18.4, 17.6 + by, 3.8, 4.2, fur));
  // near hind leg, bent at the hock
  o.push(E(9.6, 19.4, 2.7, 3.4, fur));
  o.push(K(10.2, 21.4, 8.2, 24.6, 1.35, 0.85, fur), K(8.2, 24.6, 9, 27.8, 0.8, 0.7, fur), E(9.5, 27.9, 1.3, 0.62, fur));
  // pale chest and near foreleg
  o.push(E(21, 16.6, 1.6, 2.6, pale, { a: -0.3, occ: false, ink: 0.18 }));
  o.push(K(19.4, 20.4, 19.6, 24.6, 1.3, 0.85, fur), K(19.6, 24.6, 19.8, 27.8, 0.8, 0.7, fur), E(20.4, 27.9, 1.3, 0.62, fur));
  if (!howl) {
    o.push(K(19.2, 15.8, 22.6, 14, 3, 2.4, fur));
    // the back line: raised hackles, or a ridge of ice shards
    if (rimeW) o.push(P([12.8, 15.2, 13.8, 12.2, 15, 14.8], 'ice', { bv: 0.4 }), P([15.2, 14.6, 16.8, 10.6, 17.8, 14.2], 'ice', { bv: 0.4 }), P([18, 14, 19.8, 9.6, 20.6, 13.4], 'ice', { bv: 0.4 }), P([20.4, 13.4, 21.6, 10.8, 22.4, 13.6], 'ice', { bv: 0.4 }));
    else o.push(P([11.6, 15.8, 12.8, 13.8, 13.8, 15, 15.2, 12.6, 16.2, 14.4, 17.6, 11.4, 18.4, 13.6, 19.8, 10.6, 20.6, 13, 21.8, 10.6, 22.4, 13.6, 20.6, 15.8, 13, 16.8], 'mon1_hackle', { bv: 0.6 }));
    const hy = 13.6 + b * 0.2;
    o.push(E(23.8, hy, 2.6, 2.3, fur));
    o.push(P([21.4, hy - 0.4, 23, hy + 2.6, 21.6, hy + 3.6, 20.4, hy + 1.6], pale));
    o.push(P([22, hy - 1.2, 22.4, hy - 5, 23.8, hy - 1.8], fur, { ink: -0.08 }), P([23.4, hy - 1.6, 24.6, hy - 5.4, 25.4, hy - 1.4], fur, { ink: 0.05 }));
    o.push(K(25, hy + 0.6, 29.4, hy + 1.6, 1.45, 0.8, pale));
    o.push(K(24.6, hy - 0.5, 28.4, hy + 0.7, 0.7, 0.45, fur));
    o.push(K(25.2, hy + 2.2, 28.6, hy + 2.8, 0.75, 0.5, pale, { ink: -0.14 }));
    o.push(X(26.4, hy + 1.9, 2, 0.45, 'bone:5'), X(28, hy + 1.9, 0.45, 0.9, 'bone:5'));
    o.push(X(29.3, hy + 0.7, 1, 0.9, DARK));
    o.push(X(24, hy - 1.3, 1.8, 0.45, DARK), aEye(24.5, hy - 0.8, 1.1, 0.7));
  } else {
    // head thrown back, breathing a plume of frost
    o.push(K(18.6, 15.6, 21, 10.4, 3, 2.4, fur));
    o.push(P([15, 15, 16.2, 12, 17.2, 14.4, 18.6, 10.8, 19.6, 13.6], 'ice', { bv: 0.4 }), P([20.2, 17, 22.6, 17.6, 21, 19.4], 'ice', { bv: 0.3 }));
    const hy = 9.2 + b * 0.2;
    o.push(E(21.8, hy, 2.5, 2.3, fur));
    o.push(P([20.6, hy - 1, 18, hy - 2.4, 20.6, hy - 2.6], fur, { ink: 0.05 }));
    o.push(K(23, hy - 1, 25.6, hy - 4.6, 1.4, 0.75, 'mon1_furRime'));
    o.push(K(22.6, hy - 1.8, 25, hy - 5, 0.65, 0.45, fur));
    o.push(K(23.4, hy + 0.6, 26.6, hy - 1.8, 0.75, 0.45, 'mon1_furRime', { ink: -0.14 }));
    o.push(X(25.3, hy - 5.7, 0.9, 0.9, DARK));
    o.push(aEye(22.2, hy - 1.1, 1, 0.45));
    const m = f % 4;
    o.push(K(26, 4.4, 27.4, 2.4 - m * 0.1, 0.95, 0.75, 'mon1_frostMist'), K(27.4, 2.4 - m * 0.1, 29.4 + sw * 0.3, 1.2, 0.75, 0.3, 'mon1_frostMist'));
    o.push(E(28.8, 4.2 - m * 0.15, 0.6, 0.55, 'mon1_frostMist'));
    o.push(Lt(26.8, 4.6, 8, '#9fe6ff', 0.85));
  }
  return rimeW ? T(o, { s: 0.84 }) : o;
}
