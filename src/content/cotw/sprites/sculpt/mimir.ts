import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Sage Mimir, the ancient rune-sage: a peaked indigo hood, one milky eye (the price of the
 * well), a white beard braided with rune beads, a horn of well-water at the belt and a staff
 * taller than he is with an Ansuz rune burning blue.
 */
export function mimirModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 17.0;
  const hy = 9.0 + b * 0.3;
  const out: PrimTree[number][] = [Sh(16, 28.6, 7.8, 2.2)];
  out.push(
    // long indigo robe, a little stooped
    P([11.4, 12.4, 20.4, 12.2, 22.4, 27.6, 19.6, 28.6, 16.0, 28.2, 12.4, 28.6, 9.4, 27.6], 'ally_indigo', { bv: 1.3 }),
    K(14.6, 20.4, 13.6, 27.8, 0.45, 0.75, 'ally_indigoDark', { occ: false }), K(18.8, 20.6, 19.8, 27.8, 0.4, 0.65, 'ally_indigoDark', { occ: false }),
    E(14.0, 28.3, 1.6, 0.8, 'leatherDark'), E(19.0, 28.4, 1.6, 0.8, 'leatherDark'),
    // back arm
    K(12.2, 13.4, 10.8, 18.0, 1.5, 2.2, 'ally_indigoDark'), E(11.0, 18.8, 1.1, 1.1, 'skinPale'),
    // rope belt; the horn of well-water hangs at the hip, mouth up, banded and silver-rimmed
    K(11.6, 19.6, 20.6, 19.2, 0.6, 0.6, 'linen'),
    K(12.0, 19.6, 11.2, 20.6, 0.3, 0.3, 'leatherDark', { occ: false }),
    K(11.2, 21.0, 12.2, 24.0, 1.6, 1.15, 'horn'), K(12.2, 24.0, 14.2, 25.6, 1.15, 0.6, 'horn'), K(14.2, 25.6, 15.2, 24.8, 0.6, 0.3, 'boneOld'),
    K(10.4, 22.4, 12.8, 22.0, 0.35, 0.35, 'leatherDark', { occ: false }), K(11.6, 24.4, 13.0, 23.4, 0.3, 0.3, 'leatherDark', { occ: false }),
    E(11.1, 20.8, 1.75, 0.8, 'silver', { a: 0.3 }), X(10.7, 20.5, 0.8, 0.5, '#bfe8f6'),
    // mantle over the shoulders
    P([10.8, 12.0, 21.0, 11.6, 22.2, 15.4, 16.4, 16.8, 10.4, 15.6], 'ally_indigoDark', { bv: 1.0 }),
    // the long braided beard, with rune beads
    P([hx - 1.4, hy + 2.0, hx + 3.6, hy + 1.8, hx + 3.2, hy + 7.0, hx + 2.0, hy + 11.0 + w * 0.2, hx + 0.8, hy + 12.6 + w * 0.3, hx - 0.4, hy + 9.0], 'ally_hairWhite', { bv: 0.9 }),
    K(hx + 0.4, hy + 9.0, hx + 0.9 + w * 0.2, hy + 13.6, 0.55, 0.45, 'ally_hairWhite'), K(hx + 2.4, hy + 8.0, hx + 2.6 + w * 0.2, hy + 11.6, 0.5, 0.4, 'ally_hairWhite'),
    E(hx + 0.95 + w * 0.2, hy + 14.2, 0.7, 0.7, 'runestone'), E(hx + 2.6 + w * 0.2, hy + 12.2, 0.65, 0.65, 'runestone'),
    X(hx + 0.75 + w * 0.2, hy + 14.0, 0.4, 0.4, 'emArcane:4', { glow: false }), X(hx + 2.4 + w * 0.2, hy + 12.0, 0.4, 0.4, 'emArcane:4', { glow: false }),
    // hood: peaked, deep
    P([hx - 5.0, hy + 2.4, hx - 4.6, hy - 2.6, hx - 2.6, hy - 5.4, hx - 1.6, hy - 7.6, hx + 1.6, hy - 5.2, hx + 4.4, hy - 2.0, hx + 4.4, hy + 2.4], 'ally_indigo', { bv: 1.2 }),
    E(hx + 1.3, hy + 0.6, 2.9, 3.2, 'ally_indigoDark', { fl: 0.4 }), // hood opening
    E(hx + 1.6, hy + 0.9, 2.5, 2.8, 'skinPale', { fl: 0.25 }),
    // brows, eyes (the near one milky), nose, moustache
    P([hx - 0.4, hy - 0.8, hx + 4.0, hy - 1.2, hx + 3.8, hy - 0.2, hx - 0.2, hy + 0.1], 'ally_hairWhite'),
    X(hx + 0.2, hy + 0.3, 1.2, 1.05, '#e6f0f4', { em: true, glow: false }), X(hx + 0.5, hy + 0.55, 0.55, 0.5, '#aebfcc', { em: true, glow: false }),
    X(hx + 2.6, hy + 0.3, 0.9, 1.0, '#1d1416'),
    K(hx + 3.6, hy + 0.6, hx + 4.4, hy + 2.0, 0.6, 0.55, 'skinPale'),
    P([hx - 0.4, hy + 2.0, hx + 4.4, hy + 2.0, hx + 4.0, hy + 3.4, hx + 1.6, hy + 2.8, hx - 0.2, hy + 3.6], 'ally_hairWhite', { bv: 0.5 }),
  );
  // staff: carved, taller than he is, an Ansuz rune burning blue at its head
  const sx = 22.4;
  const pulse = [0, 0.08, 0.16, 0.08][f];
  out.push(
    K(sx - 0.3, 28.2, sx + 0.3, 5.6, 0.75, 0.7, 'woodDark'),
    K(sx + 0.3, 6.4, sx + 0.5, 2.3, 1.35, 1.1, 'wood'), K(sx + 0.5, 2.3, sx - 0.6, 1.6, 0.8, 0.5, 'wood'),
    K(sx - 0.8, 6.6, sx + 1.4, 6.4, 0.5, 0.5, 'bronze'),
    X(sx - 0.1, 2.0, 0.6, 3.8, 'emArcane:4', { ink: pulse }), X(sx + 0.5, 2.4, 0.7, 0.6, 'emArcane:4'), X(sx + 0.5, 3.6, 0.7, 0.6, 'emArcane:4'), X(sx + 1.0, 2.9, 0.5, 0.6, 'emArcane:4'), X(sx + 1.0, 4.1, 0.5, 0.6, 'emArcane:4'),
    Lt(sx + 0.3, 3.6, 8.5, '#6aa6ff', 0.75 + pulse),
    // front arm in a bell sleeve, hand on the staff
    K(20.0, 13.2, 21.6, 18.0, 1.5, 2.1, 'ally_indigo'), E(sx + 0.1, 18.8, 1.2, 1.2, 'skinPale'),
  );
  return out;
}
