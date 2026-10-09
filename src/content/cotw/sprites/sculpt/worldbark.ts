import { E, K, P, X, Lt, Sh, arc, breath, drip, sway, type PrimTree } from './kit';
import { DARK, VIOL, aEye, vEye, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** A jointed insect leg: hip, knee, foot. */
const leg = (pts: number[], r: number, m: string, ink = 0): Out => [
  K(pts[0], pts[1], pts[2], pts[3], r, r * 0.8, m, { ink }),
  K(pts[2], pts[3], pts[4], pts[5], r * 0.8, r * 0.5, m, { ink }),
];

/**
 * The amber sap-weeper: a beetle the size of a shield, its wing-cases grained like the
 * world-tree's own bark. Resin weeps from the grain, runs down its flanks and pools behind it.
 */
function weeper(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const by = 20.4 - b * 0.25;
  const out: Out = [Sh(16, 28.6, 10.4, 2)];
  // the resin it leaves: a pool trailing off behind
  out.push(E(10.4, 28.6, 6.2, 0.9, 'mon3_resin', { fl: 0.9, ol: false }), E(4.6, 28.5, 1.6, 0.5, 'mon3_resin', { fl: 0.9, ol: false }));
  // far legs, in shadow
  out.push(leg([12.6, by + 3.4, 9.8, by + 4.4, 8.6, 27.4], 0.55, 'mon3_shellBelly', -0.08));
  out.push(leg([18.4, by + 3.6, 20.2, by + 4.8, 21, 27.4], 0.55, 'mon3_shellBelly', -0.08));
  out.push(leg([22.2, by + 3.2, 25.6, by + 3.8, 27.4, 27.2], 0.55, 'mon3_shellBelly', -0.08));
  // belly, then the domed wing-cases
  out.push(E(15.4, by + 2.6, 8, 3.2, 'mon3_shellBelly'));
  out.push(E(14.4, by, 8.6, 6, 'mon3_shell', { fl: 0.05 }));
  // the grain, and the seam between the wing-cases
  out.push(arc(14.4, by + 2.2, 8, 7.4, Math.PI * 1.08, Math.PI * 1.92, 8, 0.3, 0.3, 'mon3_shell', { ink: -0.18, ol: false, occ: false }));
  out.push(K(8.6, by - 1, 12.4, by + 2.8, 0.22, 0.22, 'mon3_shell', { ink: -0.14, ol: false, occ: false }), K(13.6, by - 3, 17.6, by + 1.6, 0.22, 0.22, 'mon3_shell', { ink: -0.14, ol: false, occ: false }));
  out.push(K(18.6, by - 3.4, 20.8, by + 0.2, 0.22, 0.22, 'mon3_shell', { ink: -0.14, ol: false, occ: false }));
  // resin weeping from the seam and the grain, running down the flanks
  out.push(E(10.4, by - 4, 1, 0.7, 'mon3_resin', { ol: false }), E(16.6, by - 5, 1.1, 0.7, 'mon3_resin', { ol: false }));
  out.push(K(10.2, by - 3.6, 9.4, by + 1.4, 0.45, 0.4, 'mon3_resin', { ol: false }), K(16.4, by - 4.6, 16.8, by + 0.6, 0.45, 0.4, 'mon3_resin', { ol: false }));
  out.push(K(12.4, by + 2.6, 12.6, by + 5.4, 0.4, 0.35, 'mon3_resin', { ol: false }), K(19.6, by - 0.4, 20.2, by + 4.2, 0.4, 0.35, 'mon3_resin', { ol: false }));
  out.push(drip(12.6, by + 5.6, 28.4 - by - 5.6, f, 0, 'mon3_resin', 0.45), drip(20.2, by + 4.4, 28.2 - by - 4.4, f, 2, 'mon3_resin', 0.45));
  out.push(X(10.2, by - 4.2, 0.5, 0.4, 'mon3_resin:5'), X(16.4, by - 5.2, 0.5, 0.4, 'mon3_resin:5'));
  // the shield behind the head, and the head
  out.push(E(22.6, by + 1, 3.2, 3.6, 'mon3_shell', { fl: 0.1 }));
  out.push(X(21.4, by - 1.6, 1.4, 0.4, 'mon3_shell:4'));
  out.push(E(25.6, by + 2.4, 2.3, 2.1, 'mon3_shellBelly'));
  out.push(aEye(25.8, by + 1.4, 0.8, 0.7));
  // clubbed antennae and short jaws
  out.push(K(25.4, by + 0.6, 27.4 + sw * 0.2, by - 2.6, 0.22, 0.18, 'mon3_shellBelly'), E(27.6 + sw * 0.2, by - 3, 0.6, 0.7, 'mon3_shellBelly'));
  out.push(K(27, by + 3.4, 29, by + 3.8, 0.4, 0.2, 'mon3_shellBelly'), K(26.6, by + 4, 28.4, by + 5, 0.35, 0.2, 'mon3_shellBelly'));
  // near legs
  out.push(leg([11.6, by + 4.2, 8.4, by + 4.8, 6.6, 28.2], 0.6, 'mon3_shellBelly'));
  out.push(leg([16.2, by + 4.6, 15.4, by + 6, 14.6, 28.4], 0.6, 'mon3_shellBelly'));
  out.push(leg([21.4, by + 4.2, 23.8, by + 5.2, 25.2, 28.2], 0.6, 'mon3_shellBelly'));
  out.push(Lt(14, by - 3, 6, '#ffb84a', 0.25));
  return out;
}

/**
 * The Yggdrasil parasite: a bloated tick out of the rotting bark, its belly so full of eggs they
 * glow through the skin. A few have already been laid behind it.
 */
function parasite(f: number): PrimTree {
  const b = breath(f);
  const pulse = [0, 0.06, 0.12, 0.06][f];
  const out: Out = [Sh(15.6, 28.6, 8, 1.8)];
  // eggs already laid
  for (const [x, y, r] of [[4.8, 27.9, 0.7], [6.2, 28.4, 0.75], [5.4, 26.9, 0.6]]) out.push(E(x, y, r, r * 0.85, 'mon3_egg', { ink: pulse * 0.5 }));
  // far legs
  out.push(leg([18, 24.6, 19.6, 25.4, 20.4, 27.8], 0.4, 'mon3_grubPlate', -0.1), leg([20.4, 24.4, 22.8, 24.8, 24, 27.6], 0.4, 'mon3_grubPlate', -0.1));
  // the swollen abdomen, ringed, the eggs pressing through
  const ax = 13.4;
  const ay = 22.2 - b * 0.3;
  const rx = 6.4 + b * 0.15;
  const ry = 5.4 + b * 0.15;
  out.push(E(ax, ay, rx, ry, 'mon3_grub', { a: -0.12 }));
  for (const t of [-0.5, 0, 0.5]) out.push(arc(ax + t * rx * 1.3, ay, 0.9, ry * 0.95, -Math.PI * 0.42, Math.PI * 0.42, 5, 0.18, 0.18, 'mon3_grub', { ink: -0.14, ol: false, occ: false }));
  for (const [x, y, r] of [[10.6, 21.4, 0.9], [12.8, 19.6, 1], [14.8, 22.4, 0.95], [11.8, 24, 0.8], [16.2, 19.8, 0.75], [9.4, 23.6, 0.6]]) {
    out.push(E(x, y - b * 0.3, r, r * 0.9, 'mon3_egg', { ink: pulse, ol: false }));
  }
  out.push(Lt(13, 21.6, 6, '#b8d050', 0.45 + pulse));
  // bark-plated thorax and head
  out.push(E(19.6, 23.6, 2.8, 2.6, 'mon3_grubPlate'));
  out.push(P([17.6, 21.8, 20.6, 20.8, 22.4, 22.6, 19.8, 22.8], 'mon3_grubPlate', { ink: 0.08, bv: 0.4 }));
  out.push(E(22.6, 24.8, 1.8, 1.6, 'mon3_grubPlate', { ink: -0.04 }));
  out.push(aEye(22.8, 23.9, 0.6, 0.5));
  // hooked mouthparts, bent to the bark
  out.push(K(23.8, 25.4, 25.2, 26.2, 0.32, 0.18, 'mon3_grubPlate'), K(23.2, 25.8, 24.2, 27, 0.3, 0.16, 'mon3_grubPlate'));
  // near legs
  out.push(leg([17.6, 25.4, 16.6, 26.2, 15.8, 28.2], 0.45, 'mon3_grubPlate'), leg([19.6, 25.8, 20.2, 26.6, 21.6, 28.3], 0.45, 'mon3_grubPlate'));
  out.push(leg([21.4, 25.6, 23.2, 26.2, 24.6, 28.2], 0.45, 'mon3_grubPlate'));
  return out;
}

/**
 * The root-bound berserker: a warrior who died raging in the world-tree's roots and was taken
 * into them. Bear-pelt over his head, taproots threaded through his chest and down into the
 * floor so nothing can shift him, sap pulsing in them; the bearded axe is raised.
 */
function berserker(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const pulse = [0, 0.1, 0.18, 0.08][f];
  const hx = 16.6;
  const hy = 7.8 + b * 0.25;
  const ty = 15.4 + b * 0.2;
  const sap = (x1: number, y1: number, x2: number, y2: number): PrimTree[number] => K(x1, y1, x2, y2, 0.16, 0.16, 'mon2_sap', { ink: pulse, ol: false, occ: false, glow: false });
  const out: Out = [Sh(16, 28.6, 10, 2.2)];
  // roots out of the floor: he stands in them
  out.push(K(12.4, 27.2, 6.4, 28.6, 0.7, 0.35, 'mon3_taproot'), K(12.6, 27.4, 9.4, 29.2, 0.55, 0.3, 'mon3_taproot'));
  out.push(K(19.8, 27.2, 25.8, 28.6, 0.7, 0.35, 'mon3_taproot'), K(19.6, 27.4, 22.6, 29.2, 0.55, 0.3, 'mon3_taproot'));
  // the bear-pelt down his back
  out.push(P([10.6, ty - 5.6, 14.4, ty - 6.6, 13.6, ty - 1, 12, ty + 7, 10.2 + sw * 0.3, ty + 8.6, 8.6, ty + 3], 'mon3_pelt', { bv: 0.9 }));
  // back arm hanging, a root wound round it and down into the floor
  out.push(K(11.8, ty - 4.4, 10.4, ty + 0.6, 1.25, 1.05, 'mon3_bsSkin'), K(10.4, ty + 0.6, 9.8, ty + 3.6, 1.05, 0.95, 'mon3_bsSkin'), E(9.7, ty + 4.2, 1.15, 1.05, 'mon3_bsSkin'));
  out.push(K(11.6, ty - 3.2, 9.2, ty - 0.6, 0.4, 0.4, 'mon3_taproot'), K(9.2, ty - 0.6, 10.8, ty + 2.4, 0.4, 0.4, 'mon3_taproot'));
  out.push(K(9.4, ty + 4.6, 8, ty + 8.6, 0.45, 0.4, 'mon3_taproot'), K(8, ty + 8.6, 7.4, 28.4, 0.4, 0.3, 'mon3_taproot'));
  // legs, roots coiled round them
  out.push(K(13.8, ty + 5, 12.6, 26.8, 1.55, 1.25, 'mon1_wrap'), K(18.4, ty + 5, 19.8, 26.8, 1.55, 1.25, 'mon1_wrap'));
  out.push(E(12.4, 27.4, 1.9, 1, 'mon3_taproot'), E(19.8, 27.4, 1.9, 1, 'mon3_taproot'));
  out.push(K(11.6, ty + 7.4, 14.4, ty + 9, 0.4, 0.4, 'mon3_taproot'), K(14, ty + 10.4, 11.4, ty + 11.4, 0.4, 0.4, 'mon3_taproot'));
  out.push(K(17.6, ty + 8, 20.4, ty + 6.6, 0.4, 0.4, 'mon3_taproot'), K(20.6, ty + 9.6, 18, ty + 11, 0.4, 0.4, 'mon3_taproot'));
  // bare chest, the roots threaded through it
  out.push(E(16.2, ty, 4.8, 5.4, 'mon3_bsSkin', { fl: 0.1 }));
  out.push(X(14.4, ty - 0.6, 3.6, 0.4, 'mon3_bsSkin:1'), X(14.6, ty + 0.8, 3.2, 0.4, 'mon3_bsSkin:1'));
  out.push(K(12.2, ty + 4, 19.6, ty - 4.2, 0.6, 0.5, 'mon3_taproot'), K(13, ty - 3.8, 19.8, ty + 3, 0.5, 0.45, 'mon3_taproot'));
  out.push(sap(12.4, ty + 3.8, 19.4, ty - 4), sap(13.2, ty - 3.6, 19.6, ty + 2.8));
  out.push(K(11.6, ty + 4.4, 20.8, ty + 4.4, 0.8, 0.8, 'leatherDark'), X(15.6, ty + 3.8, 1.4, 1.2, 'iron:4'));
  // head under the bear's: its ears and brow over his own, beard full of root fibre
  out.push(E(hx, hy + 0.4, 2.8, 3, 'mon3_bsSkin', { fl: 0.2 }));
  out.push(P([hx - 4.2, hy + 2, hx - 3.8, hy - 2.6, hx - 1, hy - 4.4, hx + 2.6, hy - 3.8, hx + 4.4, hy - 1.8, hx + 3.6, hy - 0.6, hx + 1.4, hy - 1.4, hx - 1.4, hy - 0.8, hx - 2, hy + 3.2], 'mon3_pelt', { bv: 0.9 }));
  out.push(E(hx - 2.4, hy - 4.2, 1, 1, 'mon3_pelt'), E(hx + 0.8, hy - 4.4, 1, 1, 'mon3_pelt'));
  out.push(X(hx + 3.4, hy - 1.4, 0.5, 0.6, 'bone:4'), X(hx + 2.6, hy - 1.2, 0.4, 0.5, 'bone:4'), X(hx + 4.2, hy - 1.6, 0.4, 0.4, DARK));
  out.push(X(hx - 0.4, hy - 0.2, 1.3, 1.1, DARK), X(hx + 1.6, hy - 0.2, 1.1, 1.1, DARK));
  out.push(vEye(hx - 0.1, hy, 0.8, 0.7), vEye(hx + 1.8, hy, 0.7, 0.7), Lt(hx + 0.8, hy + 0.2, 4.5, VIOL, 0.5));
  out.push(P([hx - 2.2, hy + 1.8, hx + 2.8, hy + 1.8, hx + 2.4, hy + 5, hx + 0.6 + sw * 0.2, hy + 7.2, hx - 1.2, hy + 5.4], 'hairDark', { bv: 0.6 }));
  out.push(K(hx - 1, hy + 2.6, hx - 1.6 + sw * 0.2, hy + 7.4, 0.25, 0.15, 'mon3_taproot'), K(hx + 1.6, hy + 2.8, hx + 1.8 + sw * 0.2, hy + 7.8, 0.25, 0.15, 'mon3_taproot'));
  // the bearded axe, raised in the front hand
  const gx = 23.4;
  const gy = ty - 4.8;
  out.push(K(20.4, ty - 4.4, 22.4, ty - 6.6, 1.2, 1, 'mon3_bsSkin'), K(22.4, ty - 6.6, gx, gy - 1, 1, 0.9, 'mon3_bsSkin'));
  out.push(K(21.8, ty + 0.8, 26.4, 3.4, 0.5, 0.45, 'woodDark'));
  out.push(P([25.8, 2.6, 28.4, 2.4, 29.4, 5, 29.2, 8.6, 27.6, 10.2, 27, 7.8, 25.4, 6.6], 'mon1_oldSteel', { bv: 0.7 }));
  out.push(X(28.8, 4.2, 0.4, 3.6, 'mon1_oldSteel:5'));
  out.push(K(gx - 1.4, gy, gx + 0.4, gy - 2.2, 0.4, 0.4, 'mon3_taproot'), E(gx + 0.2, gy - 1.4, 1.1, 1, 'mon3_bsSkin'));
  out.push(Lt(16, ty, 7, '#cddc52', 0.25 + pulse));
  return out;
}

/**
 * Things of the World-Bark Descent: what lives in the world-tree's wood and what it has taken.
 * Kinds: `weeper` (a resin-weeping bark beetle), `parasite` (an egg-swollen tick) and
 * `berserker` (a dead warrior bound into the roots).
 */
export function worldBarkModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'parasite': return parasite(f);
    case 'berserker': return berserker(f);
    default: return weeper(f);
  }
}
