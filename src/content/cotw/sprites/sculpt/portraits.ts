import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimTree } from './kit';
import { BAND, ground, qpt, strand, frame, type Out, type Pt } from './portraitKit';
import './materials';

/* Mímir and Níðhögg (wave 9a; the draugr moved to portraitsDraugr.ts). Conventions: portraitKit.ts. */

/**
 * The rune-sage: one milky eye (the price of the well), a horn of its water, and a staff
 * whose rune lights his face from the right.
 */
export function mimirPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.1, 0.93, 1.05][f % 4];
  const o: Out = [];
  const BM = 'scr_gMimir', HM = 'scr_haloMimir';
  const sx = 79.5, sy = 31.5; // the rune
  o.push(ground(BM, sx - 6, sy + 6, 74, 70));
  // banded halo around the rune
  o.push(E(sx, sy, 22, 21, HM, { fl: 1, ink: BAND[1] }));
  o.push(E(sx, sy, 13, 12.5, HM, { fl: 1, ink: BAND[2] }));
  o.push(E(sx, sy, 8, 7.6, HM, { fl: 1, ink: BAND[3] }));

  const by = -b * 0.5;
  const fx = 54, fy = 45 + by;
  // robe shoulders
  o.push(E(44, 102 + by * 0.8, 48, 31, 'scr_indigo', { fl: 0.2, ink: -0.1 }));
  o.push(K(40, 74, 26, 100, 2.2, 3, 'scr_indigo', { ink: -0.3 }));
  // hood: a peak falling behind, the cowl, the dark inside it
  o.push(P([29, fy - 7, 30, fy - 23, 38, fy - 31, 49, fy - 30, 43, fy - 19], 'scr_indigo', { bv: 3, ink: -0.2 }));
  o.push(E(45, fy - 1, 20.5, 25, 'scr_indigo', { fl: 0.12, ink: -0.16 }));
  o.push(E(fx - 2, fy + 1, 13, 15.5, 'scr_indigo', { fl: 0.6, ink: -0.5 }));
  // face
  o.push(E(fx, fy, 10.6, 13, 'scr_oldSkin', { fl: 0.2, ink: -0.04 }));
  o.push(E(fx + 2, fy + 7, 8, 6, 'scr_oldSkin', { fl: 0.3, ink: -0.04 }));
  o.push(E(fx - 6, fy - 1, 7, 12.5, 'scr_oldSkin', { fl: 0.6, ink: -0.3 })); // the cowl's shadow
  for (let i = 0; i < 3; i++) o.push(X(fx - 2.2 + i * 0.6, fy - 9.4 + i * 1.5, 9.4 - i * 1.4, 0.6, 'scr_oldSkin:2')); // furrows
  o.push(E(fx - 0.6, fy + 3, 4, 2.4, 'scr_oldSkin', { fl: 0.5, ink: 0.04 })); // cheek
  // brows, white and heavy
  o.push(K(fx - 7, fy - 4.4, fx - 0.5, fy - 5, 1.4, 1, 'scr_beardW', { ink: -0.08 }), K(fx - 7, fy - 4.4, fx - 9, fy - 2.2, 1.1, 0.5, 'scr_beardW', { ink: -0.14 }));
  o.push(K(fx + 3.6, fy - 4.6, fx + 8.8, fy - 4.2, 1.2, 0.7, 'scr_beardW'));
  // the milky eye, and the other, sharp
  o.push(E(fx - 3.6, fy - 1.4, 3, 2.2, 'scr_oldSkin', { fl: 0.8, ink: -0.35 }));
  o.push(E(fx - 3.5, fy - 1.3, 2, 1.45, 'scr_milk'));
  o.push(E(fx - 3.1, fy - 1.1, 0.9, 0.9, 'scr_milk', { ink: -0.16 })); // the ghost of an iris
  o.push(K(fx - 5.6, fy - 2.6, fx - 1.6, fy - 2.7, 0.75, 0.7, 'scr_oldSkin', { ink: -0.06 })); // heavy lid
  o.push(E(fx + 5.8, fy - 1.3, 1.9, 1.6, 'scr_oldSkin', { fl: 0.8, ink: -0.35 }));
  o.push(E(fx + 6, fy - 1.2, 1.15, 1.1, 'scr_gum'));
  o.push(X(fx + 6.3, fy - 1.9, 0.7, 0.7, '#d6ecff', { em: true }));
  // the long hooked nose
  o.push(K(fx + 2.6, fy - 3, fx + 8.2, fy + 4.4, 1.6, 2.2, 'scr_oldSkin'));
  o.push(E(fx + 8.3, fy + 5, 2.3, 2, 'scr_oldSkin'));
  o.push(X(fx + 7.4, fy + 6.2, 1.2, 0.7, 'scr_oldSkin:1'));
  // beard: a great fall of white, its shaded side under the cowl
  const sw = s * 0.4;
  o.push(P([fx - 9, fy + 2, fx - 4, fy + 9, fx + 3, fy + 10, fx + 10, fy + 8, fx + 12.5, fy + 18, fx + 10 + sw, fy + 34, fx + 7 + sw, 97, fx - 15 + sw, 97, fx - 17, fy + 30, fx - 12, fy + 14], 'scr_beardW', { bv: 6 }));
  o.push(P([fx - 9, fy + 2, fx - 6, fy + 12, fx - 7, fy + 40, fx - 14 + sw, 97, fx - 17, fy + 30, fx - 12, fy + 14], 'scr_beardW', { bv: 3, ink: -0.2 }));
  for (const [x0, x1, x2] of [[-4, -6, -5], [6, 8, 5], [9, 11, 9]]) o.push(strand(fx + x0, fy + 12, fx + x1, fy + 26, fx + x2 + sw, fy + 52, 0.55, 0.45, 'scr_beardW', 4, { ink: -0.28 }));
  // moustache over it
  o.push(P([fx + 1, fy + 6.6, fx + 9, fy + 6.2, fx + 11.5, fy + 13, fx + 8, fy + 10, fx + 3, fy + 10.4, fx - 4, fy + 14, fx - 2, fy + 8.4], 'scr_beardW', { bv: 1.6, ink: 0.04 }));
  // braids with rune beads
  const braid = (x0: number, y0: number, x1: number, y1: number, n: number, beadAt: number[], beadMat: string, ink: number): Prim[] => {
    const out: Prim[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = x0 + (x1 - x0) * t + sw * t, y = y0 + (y1 - y0) * t;
      if (beadAt.includes(i)) {
        out.push(E(x, y, 2.5, 2.8, beadMat, { fl: 0.15 }));
        out.push(K(x - 0.3, y - 1.5, x - 0.3, y + 1.5, 0.34, 0.34, 'emArcane', { ink: -0.25 }), K(x - 0.3, y - 1, x + 1, y, 0.3, 0.3, 'emArcane', { ink: -0.25 }));
      } else {
        out.push(E(x - 0.75, y, 1.75, 1.2, 'scr_beardW', { a: 0.65, ink: ink + 0.06 }), E(x + 0.75, y + 0.75, 1.75, 1.2, 'scr_beardW', { a: -0.65, ink: ink - 0.08 }));
      }
    }
    return out;
  };
  o.push(braid(fx + 3, fy + 15, fx + 4, fy + 47, 9, [3, 7], 'bronze', -0.04));
  o.push(strand(fx + 4, fy + 49, fx + 3 + sw, fy + 55, fx + 5 + sw, fy + 60, 1.6, 0.5, 'scr_beardW', 3, { ink: -0.06 })); // its tuft
  o.push(braid(fx - 10, fy + 15, fx - 12, fy + 40, 7, [5], 'bone', -0.2));
  // hood rim, framing the face from the left
  o.push(strand(fx + 4, fy - 14.5, fx - 12, fy - 16, fx - 12.5, fy + 2, 2.6, 3.2, 'scr_indigo', 5, { ink: 0.04 }));
  o.push(K(fx - 12.5, fy + 2, fx - 13.5, fy + 20, 3.2, 3.8, 'scr_indigo', { ink: 0.02 }));

  // the horn of well-water, held up in the far hand
  o.push(K(-3, 101, 15, 85, 7.6, 6, 'scr_indigo', { ink: -0.08 }));
  const ha: Pt = [31, 70], hc: Pt = [14, 76], hb: Pt = [8, 95];
  for (let i = 0; i < 9; i++) {
    const [x0, y0] = qpt(ha, hc, hb, i / 9), [x1, y1] = qpt(ha, hc, hb, (i + 1) / 9);
    o.push(K(x0, y0, x1, y1, 5 - i * 0.45, 5 - (i + 1) * 0.45, i > 5 ? 'scr_hornTip' : 'horn', { ink: -0.3 }));
  }
  o.push(E(8.2, 95.5, 1.6, 1.6, 'bronze'));
  { const [x, y] = qpt(ha, hc, hb, 0.45); o.push(K(x - 2.6, y - 3, x + 2.4, y + 2.6, 0.9, 0.9, 'bronze')); }
  o.push(E(31.5, 70, 6.2, 2.6, 'bronze', { fl: 0.4 }));
  o.push(E(31.6, 69.8, 5, 1.7, 'scr_water', { fl: 0.85 }));
  o.push(X(29 + f * 1.2, 69.4, 1.6, 0.6, '#cfe8ff', { em: true }));
  o.push(E(21, 80, 5.2, 4.4, 'scr_oldSkin'));
  for (let i = 0; i < 3; i++) o.push(K(17.5 + i * 0.6, 77.4 + i * 2.3, 25.5, 78 + i * 2.6, 1.15, 1.1, 'scr_oldSkin', { ink: 0.04 }));

  // the staff, carved, and the rune that lights everything
  o.push(K(66, 101, 75, 79, 7.4, 5.6, 'scr_indigo', { ink: -0.04 }));
  o.push(K(sx + 1, 99, sx - 0.6, sy + 9, 2, 1.8, 'wood'));
  for (let y = sy + 14; y < 96; y += 6.5) o.push(K(sx - 1.9 + (99 - y) * 0.028, y, sx + 1.9 + (99 - y) * 0.028, y + 1.8, 0.5, 0.5, 'woodDark'));
  o.push(K(sx - 2, sy + 9, sx - 5, sy + 0.5, 1.4, 1.1, 'woodDark'), K(sx - 5, sy + 0.5, sx - 3, sy - 7, 1.1, 0.6, 'woodDark'));
  o.push(K(sx + 1.4, sy + 9, sx + 4.6, sy + 0.5, 1.4, 1.1, 'woodDark'), K(sx + 4.6, sy + 0.5, sx + 2.4, sy - 7, 1.1, 0.6, 'woodDark'));
  o.push(E(sx - 0.2, sy, 4.2, 5.4, 'runestone', { fl: 0.2 }));
  const ri = (p - 1) * 0.5;
  o.push(K(sx - 1.3, sy - 3.5, sx - 1.3, sy + 3.9, 0.62, 0.62, 'emArcane', { ink: ri }));
  o.push(K(sx - 1.3, sy - 3.3, sx + 1.4, sy - 1.5, 0.55, 0.55, 'emArcane', { ink: ri }));
  o.push(K(sx - 1.3, sy - 0.7, sx + 1.4, sy + 1.1, 0.55, 0.55, 'emArcane', { ink: ri }));
  const a = (f * Math.PI) / 2 + 0.4;
  o.push(X(sx - 0.2 + Math.cos(a) * 8, sy + Math.sin(a) * 5, 1, 1, '#dcebff', { em: true }));
  o.push(X(sx - 0.2 - Math.cos(a) * 8, sy - Math.sin(a) * 5, 1, 1, '#9cc4ff', { em: true }));
  o.push(E(sx - 0.2, 72, 4.6, 5.4, 'scr_oldSkin'));
  for (let i = 0; i < 4; i++) o.push(K(sx - 4.2, 68.4 + i * 2.5, sx + 3.6, 69.4 + i * 2.6, 1.15, 1.1, 'scr_oldSkin', { ink: 0.04 }));
  o.push(Lt(sx - 0.2, sy, 70, '#6aa6ff', 1.4 * p, 10));
  return o;
}

/**
 * Níðhögg arches over and lowers its head at you: a slit eye under a scowling brow, the jaw
 * shut on its fangs, bile glowing through the seam of the mouth, horns laid back like dead
 * roots, and under it the gnawed root of the World Tree it has been feeding on.
 */
export function nidhoggPortrait(f: number): PrimTree {
  const b = breath(f);
  const gl = [0.9, 1.04, 1.18, 1.02][f % 4];
  const o: Out = [];
  const BN = 'scr_gNid', SB = 'scr_scaleBlack';
  o.push(ground(BN, 70, 108, 96, 74));
  // the rootlets of Yggdrasil, hanging in the dark
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 17 + hash2(i, 3) * 8, len = 20 + hash2(i, 5) * 26;
    o.push(strand(x, -2, x + (hash2(i, 7) - 0.5) * 12, len * 0.5, x + (hash2(i, 9) - 0.5) * 10, len, 2.2, 0.5, BN, 4, { ink: BAND[2] + 0.04 }));
  }
  // the far wing, a torn shadow at the top right
  o.push(P([60, -1, 97, -1, 97, 30, 92, 22, 88, 31, 83, 19, 77, 25, 72, 13, 65, 11], 'scr_wing', { ink: -0.52, n: [0.2, -0.4, 1] }));
  o.push(K(62, 1, 97, -2, 1.3, 1.6, SB, { ink: -0.35 }), K(84, -1, 83, 19, 0.8, 0.4, SB, { ink: -0.35 }), K(94, -1, 92, 22, 0.8, 0.4, SB, { ink: -0.35 }));
  for (const pts of [[86, 6, 89, 5, 88, 10], [75, 8, 78, 9, 76, 12]]) o.push(P(pts, BN, { ink: BAND[1] }));

  // the great root it has been gnawing, crossing below
  o.push(K(26, 106, 104, 82, 10, 7.5, 'scr_root', { ink: -0.56 }));
  o.push(K(30, 98, 102, 76, 1.2, 1, 'scr_root', { ink: -0.4 })); // its lit upper edge
  o.push(E(71, 81.6, 9.5, 3.6, 'scr_root', { a: -0.3, fl: 0.8, ink: -0.82 })); // the bite: a dark gouge
  for (let i = 0; i < 4; i++) o.push(K(65 + i * 3.8, 79.6 - i * 0.6, 66 + i * 3.8, 84.4 - i * 0.6, 0.45, 0.35, 'scr_root', { ink: -0.95 })); // tooth-marks
  o.push(P([79, 77, 83, 72.4, 82, 78, 86, 74, 83.4, 80], 'scr_splinter', { bv: 0.6, ink: -0.62 })); // splinters standing up
  o.push(E(71, 81.4, 4.2, 1, 'emPoison', { ink: -0.5 + (gl - 1) * 0.5 })); // bile pooling in the bite

  const hb = -b * 0.6; // the head sinks and lifts as it breathes
  // neck: rising from the dark at the left, arching over, coming down at you
  const n0: Pt = [-6, 104], n1: Pt = [6, -10], n2: Pt = [48, 47 + hb];
  const nr = (t: number): number => 16 - t * 6.5;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, [x, y] = qpt(n0, n1, n2, t);
    o.push(E(x, y, nr(t), nr(t) * 1.05, SB, { fl: 0.1, ink: -0.14 }));
  }
  for (let i = 0; i <= 28; i++) {
    const t = i / 28 * 0.96, [x, y, tx, ty] = qpt(n0, n1, n2, t), l = Math.hypot(tx, ty), r = nr(t);
    const nx = -ty / l, ny = tx / l;
    for (let j = -3; j <= 1; j++) {
      const k = (j + (i % 2) * 0.5) / 3.6;
      const sz = 1.9 - t * 0.5;
      o.push(E(x + nx * r * k * 0.95, y + ny * r * k * 0.95, sz * 1.15, sz * 0.9, SB, { fl: 0.3, a: Math.atan2(ty, tx) + Math.PI / 2, ink: -0.52 + hash2(i, j + 9) * 0.08 }));
    }
  }
  // spines along the outer curve, laid back
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + i * 0.12, [x, y, tx, ty] = qpt(n0, n1, n2, t), r = nr(t), l = Math.hypot(tx, ty);
    const nx = ty / l, ny = -tx / l, ux = tx / l, uy = ty / l;
    const bx = x + nx * r * 0.8, byy = y + ny * r * 0.8, len = 4 + i * 0.4;
    o.push(P([bx + ux * 2.4, byy + uy * 2.4, bx - ux * 2.4, byy - uy * 2.4, bx + nx * len - ux * 4.2, byy + ny * len - uy * 4.2], 'scr_hornRoot', { bv: 0.8 }));
  }
  // the belly: dark plates, the light inside showing only at the seams
  for (let i = 0; i <= 26; i++) {
    const t = (i / 26) * 0.95, [x, y, tx, ty] = qpt(n0, n1, n2, t), r = nr(t), l = Math.hypot(tx, ty);
    const nx = -ty / l, ny = tx / l;
    o.push(E(x + nx * r * 0.7, y + ny * r * 0.7, r * 0.28, 2.2, 'scr_bellyDark', { a: Math.atan2(ty, tx) + Math.PI / 2, fl: 0.2, ink: -0.3 }));
  }
  // the head, in its own frame: x along the snout, lowered toward the viewer
  const H = frame(54, 45 + hb, 0.48);
  // horns laid back along the neck, like broken roots
  const horns = [
    [-2, -7, -14, -12, -30, -13, 3.8, 1.2],
    [2, -8, -6, -16, -16, -23, 3, 1],
    [-5, -3, -18, -5, -32, -3, 3.4, 1.1],
    [-4, 3, -14, 6, -24, 10, 2.4, 0.8],
  ];
  for (const [ax, ay, cx, cy, ex, ey, r0, r1] of horns) {
    const [a0, a1] = H.pt(ax, ay), [c0, c1] = H.pt(cx, cy), [e0, e1] = H.pt(ex, ey);
    o.push(strand(a0, a1, c0, c1, e0, e1, r0, r1, 'scr_hornRoot', 4, { ink: -0.14 }));
    o.push(E((a0 * 2 + c0) / 3, (a1 * 2 + c1) / 3, r0 * 0.95, r0 * 0.8, 'scr_hornRoot', { ink: -0.08 })); // a knot
  }
  // jaw hinge, cheek spikes raking back
  o.push(H.E(-2, 6, 7, 6, SB, { ink: -0.16 }));
  o.push(H.K(-6, 8, -15, 11, 1.8, 0.3, 'scr_hornRoot'), H.K(-3, 11, -10, 16.5, 1.5, 0.3, 'scr_hornRoot'));
  // lower jaw, shut
  o.push(H.P([-3, 6, 10, 6.2, 24, 6, 36, 5.6, 39, 6.6, 36, 9.4, 24, 10.6, 10, 11.6, 0, 12, -5, 9.5], SB, { bv: 2.6, ink: -0.46 }));
  // skull and the long, lean snout
  o.push(H.E(2, -1, 11, 9, SB, { fl: 0.1, ink: -0.46 }));
  o.push(H.P([-2, -8, 10, -8.5, 22, -6.5, 32, -4, 39, -1.6, 42.5, 1, 42, 3.6, 38, 5, 26, 5.4, 12, 5.8, 0, 6.5, -6, 3], SB, { bv: 3.6, ink: -0.44 }));
  o.push(H.K(10, -7.6, 36, -2.8, 0.5, 0.4, SB, { ink: -0.22 })); // the bony ridge
  for (let i = 0; i < 4; i++) o.push(H.K(13 + i * 6, -7.3 + i * 1.2, 13.6 + i * 6, -3.2 + i * 1.2, 0.3, 0.3, SB, { ink: -0.45 })); // plate seams
  o.push(H.E(8, 2.4, 6, 2.6, SB, { fl: 0.8, ink: -0.5 })); // the sunken cheek
  o.push(H.K(37.5, -0.8, 40, 0, 0.6, 0.4, 'scr_maw')); // nostril
  o.push(H.K(38, -1.4, 41, -5.2, 1.2, 0.3, 'scr_hornRoot')); // nose horn
  // the seam of the mouth, and the light of the bile behind the teeth
  o.push(H.K(-1, 6.2, 38.5, 5.6, 0.7, 0.5, 'scr_maw', { occ: false }));
  o.push(H.K(12, 6.1, 35, 5.7, 0.32, 0.26, 'emPoison', { occ: false, ink: -0.3 + (gl - 1) * 0.5 }));
  // fangs: the upper over the lower lip, one great one; two lower ones up over the snout
  const up = [[10, 3.2], [15, 3.8], [20, 3.4], [26, 9.5], [31, 4], [35.5, 3]];
  for (const [x, len] of up) o.push(H.P([x - 1.1, 5, x + 1.1, 5, x + 0.1, 5 + len], 'scr_fang', { bv: 0.6 }));
  for (const x of [33.5, 37.5]) o.push(H.P([x - 1, 7, x + 1, 7, x + 0.2, 2.6], 'scr_fang', { bv: 0.5 }));
  // the brow: a heavy plate scowling down over the eye, a spur raking back
  o.push(H.P([-2, -9.5, 10, -9.8, 22, -6.4, 24, -3.6, 18, -4.2, 10, -4.6, 2, -5.4], SB, { bv: 1.4, ink: -0.32 }));
  o.push(H.P([0, -9, 5, -9.4, -7, -15], 'scr_hornRoot', { bv: 0.7 }));
  // the eye: a narrowed slit of bile under the brow, no catch-light
  o.push(H.E(15, -2.4, 5, 2.1, SB, { fl: 0.85, ink: -0.64, a: -0.12 }));
  o.push(H.E(15.6, -2.2, 3.7, 1.1, 'emPoison', { a: -0.12, ink: (gl - 1) * 0.5 }));
  o.push(H.X(15.4, -3.2, 0.6, 2, '#0c140a'));
  o.push(H.K(11.6, -1.1, 19.4, -1.5, 0.45, 0.35, SB, { ink: -0.5 })); // lower lid
  o.push(H.Lt(15.5, -1, 11, '#b8f070', 0.65 * gl, 3));

  // a fibre of the World Tree hanging from the teeth
  const [fx0, fy0] = H.pt(31, 6.5);
  o.push(strand(fx0, fy0, fx0 - 2, fy0 + 7, fx0 + 1, fy0 + 13, 0.7, 0.45, 'scr_root', 4));
  o.push(K(fx0 + 1, fy0 + 13, fx0, fy0 + 15.6, 0.4, 0.2, 'scr_splinter'), K(fx0 + 1, fy0 + 13, fx0 + 2.4, fy0 + 15.4, 0.4, 0.2, 'scr_splinter'));
  // bile from the great fang, falling on the root
  const [gx, gy] = H.pt(26.1, 14.6);
  o.push(E(gx, gy + 0.6, 0.9, 1.2, 'emPoison'));
  o.push(E(gx - 0.2, gy + 3 + f * 2.6, 0.8, 1.3, 'emPoison'));
  o.push(Lt(gx, gy + 4, 14, '#95dc4c', 0.45 * gl, 4));
  // lit from below, by the bile in the bite
  o.push(Lt(66, 108, 92, '#95dc4c', 0.82 * gl, 20));
  return o;
}
