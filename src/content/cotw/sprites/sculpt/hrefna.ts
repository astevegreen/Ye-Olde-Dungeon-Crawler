import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Hrefna the völva, the voice of Seiðr in town: an old seeress as the sagas dress one, in a
 * blue cloak set with stones down its hem, a black lambskin hood lined with white catskin, a
 * string of glass beads, a touchwood belt with her pouch of charms, and a staff with a brass
 * knob where the Seiðr she borrows burns pale blue.
 */
export function hrefnaModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 16.4;
  const hy = 9.2 + b * 0.3;
  const ty = 17.0 + b * 0.25;
  const pulse = [0, 0.08, 0.16, 0.08][f];
  const out: PrimTree[number][] = [Sh(16, 28.6, 8.4, 2.2)];
  out.push(
    // the staff, held out at her side, behind the cloak's edge
    K(8.6, 28.2, 8.2, 6.4, 0.7, 0.65, 'woodDark'),
    // the cloak to the ground, its hem set with stones
    P([11.2, 12.2, 20.8, 12.0, 22.6, 27.6, 19.4, 28.6, 16.2, 28.2, 12.6, 28.6, 9.6, 27.6], 'vol_cloak', { bv: 1.3 }),
    K(14.4, 20.2, 13.4, 27.8, 0.45, 0.75, 'vol_cloakDark', { occ: false }),
    K(19.0, 20.4, 20.2, 27.8, 0.4, 0.65, 'vol_cloakDark', { occ: false }),
    X(11.0, 26.8, 0.6, 0.6, 'vol_bead:4'), X(14.4, 27.4, 0.6, 0.6, 'vol_bead:4'), X(17.8, 27.4, 0.6, 0.6, 'vol_bead:4'), X(21.0, 26.8, 0.6, 0.6, 'vol_bead:4'),
    E(13.6, 28.4, 1.5, 0.7, 'leather'), E(18.8, 28.5, 1.5, 0.7, 'leather'),
    // the touchwood belt, and the pouch of charms hung from it
    K(11.8, ty + 2.4, 20.6, ty + 2.2, 0.55, 0.55, 'wood'),
    K(19.6, ty + 2.6, 20.0 + w * 0.15, ty + 4.0, 0.2, 0.2, 'leatherDark', { occ: false }),
    E(20.0 + w * 0.15, ty + 5.0, 1.3, 1.5, 'leather', { fl: 0.3 }), X(19.4 + w * 0.15, ty + 3.8, 1.2, 0.5, 'leatherDark:3'),
    // back arm, the hand closed round the staff
    K(12.0, 13.4, 9.8, 17.0, 1.5, 1.9, 'vol_cloakDark'),
    E(8.6, 17.6, 1.1, 1.1, 'vol_skin'),
    // the hood's lambskin falling over the shoulders
    P([10.8, 12.0, 21.4, 11.8, 22.2, 15.2, 16.4, 16.4, 10.4, 15.4], 'vol_lamb', { bv: 1.0 }),
    // the glass beads, a loop across her breast
    X(12.8, 15.4, 0.7, 0.7, 'vol_bead:4'), X(14.2, 16.4, 0.7, 0.7, 'vol_bead:3'), X(15.8, 16.9, 0.7, 0.7, 'vol_bead:4'),
    X(17.4, 16.8, 0.7, 0.7, 'vol_bead:3'), X(18.9, 16.2, 0.7, 0.7, 'vol_bead:4'), X(20.1, 15.2, 0.7, 0.7, 'vol_bead:3'),
    // the hood: black lambskin, rounded, the white catskin showing round the face
    P([hx - 5.0, hy + 3.0, hx - 4.8, hy - 2.2, hx - 3.0, hy - 4.4, hx, hy - 5.2, hx + 3.2, hy - 4.4, hx + 4.8, hy - 2.0, hx + 4.8, hy + 3.0], 'vol_lamb', { bv: 1.2 }),
    E(hx + 1.0, hy + 0.6, 3.2, 3.6, 'vol_catskin', { fl: 0.4 }),
    E(hx + 1.3, hy + 0.9, 2.5, 2.9, 'vol_skin', { fl: 0.25 }),
    // grey hair parted under the hood
    P([hx - 1.2, hy - 1.4, hx + 1.4, hy - 2.6, hx + 3.8, hy - 1.4, hx + 3.4, hy - 0.6, hx + 1.4, hy - 1.6, hx - 0.8, hy - 0.4], 'hairGrey'),
    // eyes, half-lidded; a long nose; a thin mouth
    X(hx + 0.2, hy + 0.3, 1.0, 0.7, '#1d1416'), X(hx + 2.5, hy + 0.3, 0.8, 0.7, '#1d1416'),
    K(hx + 3.4, hy + 0.4, hx + 4.2, hy + 2.0, 0.55, 0.5, 'vol_skin'),
    X(hx + 1.2, hy + 2.6, 1.3, 0.35, '#7a4a42'),
  );
  // the staff's brass knob, where the Seiðr burns
  out.push(
    E(8.2, 5.4, 1.5, 1.4, 'bronze'),
    X(7.7, 3.4, 1.0, 1.3, 'vol_seidr:4', { ink: pulse }), X(7.2, 4.0, 0.6, 0.6, 'vol_seidr:4'), X(8.8, 3.8, 0.6, 0.6, 'vol_seidr:4'),
    Lt(8.2, 4.6, 9, '#9cc8ff', 0.7 + pulse),
    // front arm, the hand lifted to the beads
    K(20.2, 13.2, 21.4, 16.6, 1.5, 1.9, 'vol_cloak'), E(20.4, 16.8, 1.1, 1.1, 'vol_skin'),
  );
  return out;
}
