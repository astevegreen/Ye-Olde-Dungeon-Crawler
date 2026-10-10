import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9c, group D: Ranvild the Hound-Warden, the Frost-Ward Hound and the Ember-Fang Wolf. Conventions: portraitKit.ts. */

/** A braid along a quadratic curve a -> c (control b): beads leaning alternately. */
function braid(a: Pt, c: Pt, b: Pt, n: number, r: number, m: string, ink: number): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, tx, ty] = qpt(a, c, b, i / (n - 1)), an = Math.atan2(ty, tx);
    out.push(E(x, y, r * 1.3, r * 0.8, m, { a: an + 0.8, ink: ink + 0.08 }));
    out.push(E(x + Math.cos(an) * r * 0.6, y + Math.sin(an) * r * 0.6, r * 1.3, r * 0.8, m, { a: an - 0.8, ink: ink - 0.1 }));
  }
  return out;
}

/** A loop of leather: capsule segments round an ellipse. */
function loop(cx: number, cy: number, rx: number, ry: number, r: number, m: string, n = 12, o: PrimOptions = {}): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    out.push(K(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, r, r, m, { ink: Math.sin(a0) * 0.12 - 0.04, ...o }));
  }
  return out;
}

/** A lock of fur: a tapering tuft from its root (x0, y0) to its tip (x1, y1), bent by bx. */
function lock(x0: number, y0: number, x1: number, y1: number, r: number, m: string, ink: number, bx = 0): Prim[] {
  return strand(x0, y0, (x0 + x1) / 2 + bx, (y0 + y1) / 2, x1, y1, r, 0.35, m, 3, { ink });
}

/** The kin-mark: a gold rune-tag on a gold ring, glowing; its rune cut dark. */
function kinTag(x: number, y: number, s: number, k: number): Prim[] {
  return [
    E(x, y - 1.6 * s, 1.3 * s, 1.1 * s, 'gold', { fl: 0.4 }),
    P([x, y - 0.6 * s, x + 2.3 * s, y + 2.4 * s, x, y + 5.8 * s, x - 2.3 * s, y + 2.4 * s], 'emKin', { ink: (k - 1) * 0.5 }),
    K(x, y + 0.7 * s, x, y + 4.6 * s, 0.34 * s, 0.34 * s, 'gold', { ink: -0.34 }),
    K(x, y + 1.5 * s, x + 1.1 * s, y + 2.6 * s, 0.32 * s, 0.32 * s, 'gold', { ink: -0.34 }),
    K(x, y + 1.5 * s, x - 1.1 * s, y + 2.6 * s, 0.32 * s, 0.32 * s, 'gold', { ink: -0.34 }),
  ];
}

/**
 * The Hound-Warden in her kennel: a wolf pelt knotted at her throat by its own
 * forelegs, grey-blond hair drawn back in braided rows, an old bite scarring her
 * brow and cheek, a notch bitten from her ear and a ring of tooth-scars on her
 * forearm, the bone whistle on its cord. She holds up a new kin collar, the gold
 * rune-tag that will bond your hound to you lighting her face from below.
 */
export function ranvildPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const k = [1, 1.07, 0.95, 1.04][f % 4];
  const blink = f === 2;
  const o: Out = [];
  const BG = 'scr_gRanvild', SK = 'scr_ranvildSkin', HR = 'scr_ranvildHair', HD = 'scr_ranvildHairDark';
  const FU = 'scr_ranvildFur', FD = 'scr_ranvildFurDark', FP = 'scr_ranvildFurPale';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(58, 50, 66, 62, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(68, 62, 32, 32, BG, { fl: 1, ink: BAND[3] }));
  // the kennel: a post, a rail, a spare lead coiled on its peg
  o.push(P([4, -1, 11, -1, 11, 97, 4, 97], BG, { ink: BAND[2] - 0.06 }), P([4, -1, 6, -1, 6, 97, 4, 97], BG, { ink: BAND[3] - 0.06 }));
  o.push(P([-1, 14, 97, 11, 97, 15, -1, 18], BG, { ink: BAND[2] }));
  o.push(K(88, 16, 88, 20, 1, 1, BG, { ink: BAND[3] }));
  for (let i = 0; i < 3; i++) o.push(loop(88 + i * 0.8, 28 + i * 0.6, 4.2, 7.6, 1, BG, 12, { ink: BAND[2] + 0.08 + i * 0.03 }));

  const by = -b * 0.5;
  const fx = 45, fy = 37 + by;
  // tunic, open in the V of the pelt
  o.push(P([16, 97, 26, 71, 40, 63, 56, 63, 66, 69, 76, 97], 'scr_ranvildWool', { bv: 3, ink: -0.08 }));
  o.push(K(fx - 7, fy + 28, fx + 1, fy + 38, 0.8, 0.6, 'scr_ranvildWool', { ink: -0.3 }), K(fx + 9, fy + 28, fx + 2, fy + 38, 0.8, 0.6, 'scr_ranvildWool', { ink: -0.3 })); // the neckline
  // neck, thick, and the shadow of the jaw on it
  o.push(K(fx - 0.6, fy + 8, fx - 1.4, fy + 25, 6.8, 8, SK, { ink: -0.12 }));
  o.push(E(fx + 2, fy + 14, 7, 3.6, SK, { fl: 0.7, ink: -0.34 }));
  o.push(K(fx - 7.4, fy + 16, fx - 6, fy + 26, 1.3, 1.5, SK, { ink: -0.3 }));
  // the whistle's cord round the neck
  o.push(strand(fx - 8, fy + 18, fx - 4, fy + 31, fx + 7, fy + 37, 0.4, 0.4, 'leatherDark', 5, { occ: false }));

  // the wolf pelt: two flaps over the shoulders, open down the front, shaggy at the edges
  const lEdge: number[] = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; lEdge.push(fx - 8 - t * 12 + (i % 2 ? 2.6 : 0), fy + 21 + t * 40); }
  o.push(P([-2, 97, -2, 67, 8, 61, 22, 57, 34, 56, fx - 8, fy + 21, ...lEdge], FU, { bv: 6, n: [0, -0.15, 1] }));
  const rEdge: number[] = [];
  for (let i = 7; i >= 0; i--) { const t = i / 7; rEdge.push(fx + 9 + t * 20 - (i % 2 ? 2.6 : 0), fy + 21 + t * 40); }
  o.push(P([fx + 9, fy + 21, 62, 56, 76, 57, 88, 61, 98, 67, 98, 97, ...rEdge], FU, { bv: 6, n: [0, -0.15, 1], ink: -0.2 }));
  // locks of it, combed down off the shoulders
  for (const [x0, y0, x1, y1, bx] of [[2, 69, -1, 92, -2], [10, 63, 6, 88, -2], [18, 60, 15, 84, -1], [26, 58, 24, 82, 1], [32, 59, 31, 78, 2], [64, 59, 68, 80, 2], [74, 60, 79, 82, 2], [84, 63, 90, 86, 2]]) {
    o.push(lock(x0, y0, x1, y1, 2.6, FU, 0.04, bx));
    o.push(lock(x0 + 3, y0 + 2, x1 + 3, y1 + 2, 1.1, FD, -0.06, bx));
  }
  o.push(K(4, 63, 34, 56, 1.6, 1.4, FP, { ink: -0.08 }), K(64, 57, 92, 63, 1.6, 1.4, FP, { ink: -0.14 })); // the pale guard-hair along the top
  // the pelt's forelegs knotted at her throat
  o.push(K(fx - 10, fy + 21, fx, fy + 28, 2.8, 2.4, FU, { ink: 0.02 }), K(fx + 11, fy + 21, fx + 2, fy + 28, 2.8, 2.4, FU, { ink: -0.1 }));
  o.push(E(fx + 1, fy + 28.6, 3.6, 3, FD, { ink: 0.06 }));
  o.push(K(fx + 0.4, fy + 30, fx - 1.4, fy + 35, 2.2, 1.6, FU, { ink: -0.04 }), K(fx + 2, fy + 30, fx + 4, fy + 34.6, 2, 1.5, FU, { ink: -0.12 }));
  // the bone whistle hanging on the tunic
  o.push(K(fx + 6, fy + 37, fx + 14, fy + 40.4, 1.7, 1.3, 'bone'));
  o.push(K(fx + 12.6, fy + 39.6, fx + 14.4, fy + 40.8, 1, 0.8, 'scr_ranvildMouth'));
  o.push(X(fx + 8.6, fy + 37.4, 1.2, 1, 'scr_ranvildMouth:2'));

  // the back of the head
  o.push(E(fx - 7, fy - 3, 12.6, 13.4, HR, { fl: 0.2, ink: -0.16 }));
  // the face
  o.push(E(fx, fy, 11, 13.6, SK, { fl: 0.2, ink: -0.02 }));
  o.push(E(fx + 1.6, fy + 7, 8.4, 6, SK, { fl: 0.35, ink: -0.02 })); // the jaw
  o.push(E(fx - 7.6, fy - 0.6, 4, 9.6, SK, { fl: 1, ink: -0.2 })); // the temple, in the hair's shadow
  // the ear, a notch bitten from its rim
  o.push(E(fx - 10.4, fy + 1.4, 2.4, 3.8, SK, { fl: 0.3, ink: -0.04 }));
  o.push(K(fx - 10.2, fy - 0.2, fx - 9.8, fy + 2.8, 0.7, 0.6, SK, { ink: -0.34 }));
  o.push(P([fx - 13.2, fy - 0.8, fx - 11.4, fy + 0.2, fx - 13.2, fy + 1.4], HR, { ink: -0.16 }));
  // hair drawn back off the brow, in braided rows over the crown
  o.push(P([fx + 7, fy - 9.4, fx + 2, fy - 11.4, fx - 3.4, fy - 10.6, fx - 8, fy - 7.6, fx - 10.4, fy - 3, fx - 12, fy + 3, fx - 16, fy + 7, fx - 20, fy - 2, fx - 17, fy - 12, fx - 8, fy - 17, fx + 3, fy - 16], HR, { bv: 3.4, ink: -0.02 }));
  o.push(braid([fx + 4.6, fy - 12], [fx - 6, fy - 15.4], [fx - 17.6, fy - 4], 8, 1.3, HR, 0.04));
  o.push(braid([fx - 2, fy - 10.6], [fx - 10.6, fy - 9.6], [fx - 16.6, fy + 1.6], 6, 1.2, HR, -0.02));
  o.push(braid([fx - 7.6, fy - 7], [fx - 11.6, fy - 3.4], [fx - 14.6, fy + 5], 4, 1.1, HR, -0.1));
  // one heavy braid forward over the pelt, bound in leather
  const sb = s * 0.3;
  o.push(braid([fx - 13, fy + 5], [fx - 16, fy + 20], [fx - 15 + sb, fy + 37], 9, 1.75, HR, -0.04));
  for (const [x, y] of [[fx - 15.2, fy + 17], [fx - 15 + sb, fy + 36.4]]) o.push(K(x - 2.4, y - 0.4, x + 2.4, y + 0.4, 0.8, 0.8, 'leatherDark'));
  o.push(strand(fx - 15 + sb, fy + 38, fx - 16.4 + sb, fy + 42, fx - 15 + sb * 1.6, fy + 46, 1.7, 0.6, HR, 3, { ink: -0.04 }));
  // brows: straight, a little heavy
  o.push(K(fx - 8.2, fy - 4.8, fx - 0.8, fy - 5.8, 1, 0.85, HD, { ink: 0.04 }));
  o.push(K(fx + 3.6, fy - 5.9, fx + 8.8, fy - 5, 0.85, 0.6, HD, { ink: 0.04 }));
  // the old bite: two pale rakes across the near cheek, toward the mouth
  o.push(K(fx - 8.6, fy + 1.4, fx - 4.4, fy + 6.6, 0.5, 0.38, 'scr_ranvildScar', { occ: false, ink: -0.06 }));
  o.push(K(fx - 6.4, fy + 0.8, fx - 2.4, fy + 5.6, 0.46, 0.34, 'scr_ranvildScar', { occ: false, ink: -0.06 }));
  // the eyes: grey and steady, deep-set
  const ey = fy - 1.4;
  o.push(E(fx - 4, ey, 3.4, 2.2, SK, { fl: 1, ink: -0.3 }));
  o.push(E(fx + 6, ey - 0.1, 2.1, 1.8, SK, { fl: 1, ink: -0.3 }));
  if (blink) {
    o.push(K(fx - 6.6, ey + 0.2, fx - 1.4, ey + 0.1, 0.55, 0.45, 'scr_ranvildMouth'), K(fx + 4.4, ey + 0.1, fx + 7.6, ey, 0.42, 0.4, 'scr_ranvildMouth'));
  } else {
    o.push(E(fx - 3.9, ey + 0.2, 2.5, 1.35, 'scr_ranvildWhite'));
    o.push(E(fx - 3, ey + 0.2, 1.4, 1.35, 'scr_ranvildIris'));
    o.push(E(fx + 6.2, ey + 0.2, 1.4, 1.15, 'scr_ranvildWhite', { ink: -0.18 }));
    o.push(E(fx + 6.6, ey + 0.2, 1, 1.15, 'scr_ranvildIris'));
    o.push(X(fx - 3.5, ey - 0.6, 0.8, 0.7, '#f4f2ea', { em: true }), X(fx + 6.2, ey - 0.5, 0.6, 0.6, '#f4f2ea', { em: true }));
    o.push(K(fx - 6.6, ey - 1.1, fx - 1.4, ey - 1.3, 0.5, 0.45, 'scr_ranvildMouth')); // the lashes
    o.push(K(fx + 4.6, ey - 1, fx + 7.6, ey - 0.8, 0.42, 0.36, 'scr_ranvildMouth'));
  }
  // nose: straight and strong
  o.push(K(fx + 3, fy - 2.8, fx + 6.6, fy + 3.6, 1.3, 1.7, SK, { ink: 0.02 }));
  o.push(E(fx + 6.6, fy + 4.3, 1.9, 1.6, SK));
  o.push(X(fx + 5.4, fy + 5.1, 1.4, 0.8, SK + ':1'));
  // the mouth: closed, set firm, one corner turned up
  o.push(K(fx + 0, fy + 9.4, fx + 6.8, fy + 9, 0.42, 0.36, 'scr_ranvildMouth'));
  o.push(K(fx + 0, fy + 9.4, fx - 0.8, fy + 8.6, 0.36, 0.3, 'scr_ranvildMouth'));
  o.push(E(fx + 3.6, fy + 10.5, 2.4, 0.7, 'scr_ranvildLip', { fl: 1, ink: -0.14 }));

  // her raised forearm: sleeve pushed up, a leather bracer at the wrist
  const hx = 72, hy = 54;
  o.push(K(104, 106, 92, 88, 7.4, 6.4, 'scr_ranvildLeather', { ink: -0.1 })); // the pushed-up sleeve
  o.push(K(93, 90, 79, 66, 4.8, 3.6, SK, { ink: -0.04 })); // the bare forearm
  // the old bite on it: two crescents of pale tooth-scars, facing
  const bx = 87, byt = 80;
  for (const [dx, dy] of [[-2.6, -0.4], [-1.4, -2], [0.4, -2.6], [2.2, -1.8]]) o.push(E(bx + dx, byt + dy, 0.7, 0.55, 'scr_ranvildScar', { occ: false }));
  for (const [dx, dy] of [[-1.6, 2], [0.4, 2.6], [2.2, 1.6]]) o.push(E(bx + dx, byt + dy, 0.65, 0.5, 'scr_ranvildScar', { occ: false }));
  o.push(K(80.6, 69.6, 78, 64, 4.2, 3.9, 'scr_ranvildLeather', { ink: 0.04 })); // the bracer
  for (const t of [0.3, 0.8]) o.push(K(80.6 - 2.6 * t - 3.6, 69.6 - 5.6 * t + 1.6, 80.6 - 2.6 * t + 3.4, 69.6 - 5.6 * t - 2, 0.4, 0.4, 'leatherDark', { occ: false }));
  // the collar, hanging from her fist: studded leather, the kin-tag at its buckle
  o.push(loop(hx - 1, hy + 13, 5.4, 7.4, 1.25, 'scr_ranvildLead', 14));
  for (const a of [0.2, 1.2, 2.2, 3.0]) o.push(E(hx - 1 + Math.cos(a) * 5.4, hy + 13 + Math.sin(a) * 7.4, 0.75, 0.75, 'bronze'));
  o.push(kinTag(hx - 1, hy + 19.6, 1.15, k));
  // the lead, clipped to it, falling away to the hounds below
  o.push(strand(hx + 3.6, hy + 18, hx + 8, hy + 32, hx + 4, hy + 45, 1.1, 1.1, 'scr_ranvildLead', 5, { ink: -0.08 }));
  // the fist, palm toward you, fingers curled over the collar's strap
  o.push(E(hx + 1.6, hy + 1.6, 4.6, 5.6, SK, { fl: 0.3, ink: -0.06 }));
  o.push(K(hx - 1, hy - 5, hx - 1, hy + 8, 1.2, 1.2, 'scr_ranvildLead'));
  for (let i = 0; i < 4; i++) {
    const y = hy - 2.6 + i * 2.4;
    o.push(K(hx - 4, y, hx + 3.2, y + 0.6, 1.2, 1.15, SK, { ink: i % 2 ? -0.02 : 0.06 }));
    o.push(E(hx - 4.2, y, 1.2, 1.15, SK, { ink: 0.1 }));
  }
  o.push(K(hx + 3, hy - 4.6, hx - 2.6, hy - 4.6, 1.35, 1.15, SK, { ink: 0.08 })); // thumb
  o.push(Lt(hx - 1, hy + 22, 64, '#f0c062', 1.15 * k, 12));
  return o;
}

/** `frame()` with a scale: local units times k. */
function hframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  return {
    pt,
    P: (pts: number[], m: string, o?: PrimOptions): Prim => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}): Prim => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions): Prim => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions): Prim => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
    Lt: (x: number, y: number, r: number, col: string, kk: number, z: number): Prim => { const [a, b] = pt(x, y); return Lt(a, b, r * k, col, kk, z); },
  };
}
type Hframe = ReturnType<typeof hframe>;

/**
 * A tufted edge along a quadratic a -> c (control b): every other point pushed
 * out by amp along the normal on side sgn, leaning lean along the curve, each
 * lock's back swelling so it reads as a lock of fur, not a sawtooth.
 */
function furEdge(a: Pt, c: Pt, b: Pt, n: number, amp: number, sgn: number, seed: number, lean = 0.4): number[] {
  const pts: number[] = [];
  let px: number | null = null, py: number | null = null;
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = qpt(a, c, b, i / n), l = Math.hypot(tx, ty) || 1;
    if (i % 2) { pts.push(x, y); px = x; py = y; continue; }
    const tf = (0.6 + 0.7 * hash2(i, seed)) * amp, ox = -sgn * (ty / l), oy = sgn * (tx / l);
    const ex = x + ox * tf + (tx / l) * tf * lean, ey = y + oy * tf + (ty / l) * tf * lean;
    if (px !== null && py !== null) pts.push((px + ex) / 2 + ox * tf * 0.32, (py + ey) / 2 + oy * tf * 0.32);
    pts.push(ex, ey);
  }
  return pts;
}

/**
 * A tongue of flame growing from (x, y) along the unit direction (ux, uy),
 * bending upward as it rises, its body whipping with the phase ph.
 */
function flameDir(x: number, y: number, ux: number, uy: number, h: number, w: number, ph: number, m: string, ink: number): Prim {
  const px = -uy, py = ux, Lp: number[] = [], Rp: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, wv = h * 0.13 * t * Math.sin(t * Math.PI * 1.5 + ph);
    const cx = x + ux * h * t * (1 - 0.45 * t) + px * wv, cy = y + uy * h * t * (1 - 0.45 * t) - h * 0.5 * t * t + py * wv;
    const ww = w * Math.pow(1 - t, 1.5) * (1 + 2 * t);
    Lp.push(cx + px * ww, cy + py * ww); Rp.unshift(cx - px * ww, cy - py * ww);
  }
  return P([...Lp, ...Rp.slice(2)], m, { ink });
}

/**
 * An almond eye in frame H at (x, y): w and h its half-length and half-height,
 * its front (inner) corner set lower by sl; the iris, the pupil, a glint, the lid.
 */
function almond(H: Hframe, x: number, y: number, w: number, h: number, sl: number, IR: string, RIMm: string, lidM: string, lidDrop: number, closed: boolean, glint: string): Prim[] {
  const p = (u: number, v: number): Pt => [x + u * w, y + v * h + u * sl];
  const out: Prim[] = [H.P([...p(-1, 0), ...p(-0.45, -1), ...p(0.4, -1.05), ...p(1, 0.1), ...p(0.4, 0.95), ...p(-0.45, 0.8)], RIMm, { bv: 0.4 })];
  if (closed) { out.push(H.K(...p(-0.95, 0.1), ...p(0.95, 0.2), 0.5, 0.45, lidM)); return out; }
  out.push(H.E(x + 0.22 * w, y + 0.05 * h + 0.22 * sl, 0.5 * w, 0.74 * h, IR));
  out.push(H.E(x + 0.3 * w, y + 0.1 * h + 0.3 * sl, 0.17 * w, 0.55 * h, 'scr_houndMouth'));
  out.push(H.X(x + 0.02 * w, y - 0.5 * h, 0.55, 0.55, glint, { em: true }));
  out.push(H.K(...p(-0.95, -0.7 + lidDrop), ...p(0.9, -0.62 + lidDrop), 0.62, 0.5, lidM)); // the upper lid
  return out;
}

/** A point along a polyline of [x, y] pairs at t in [0, 1], by length. */
function along(pts: Pt[], t: number): Pt {
  let tot = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
  let d = Math.max(0, Math.min(1, t)) * tot;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const u = seg[i] ? Math.min(1, d / seg[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/**
 * The two companions of the Oath, as their map model draws them: one function,
 * two kinds, the head in profile to the right as the wolf-portraits are, built
 * from rounded forms that turn in the key light: braincase, brow and stop, a
 * muzzle tapering to the nose, cheek fur flaring back, the jaw under it.
 * frost: the Frost-Ward Hound, broad and calm (it wards): thick furred ears, the
 * husky's dark cap and mask, a short rounded muzzle shut, level eyes of pale
 * frost, a pale ruff, the iron chest-plate with the kin rune, its breath rising
 * in puffs of rime that light its face. ember: the Ember-Fang Wolf, lean (it
 * bites): tall ears, a pale cheek, a snarl (lip curled off a fang that burns like
 * a coal, the bridge wrinkled, the glow deep in its throat), ember eyes under a
 * hard brow, the hackles up along its neck and their tips turning to flame.
 */
function hound(f: number, kind: 'frost' | 'ember'): PrimTree {
  const b = breath(f);
  const frost = kind === 'frost';
  const C = frost ? 'scr_frostFur' : 'scr_emberFur', D = frost ? 'scr_frostFurDark' : 'scr_emberFurDark', L = frost ? 'scr_frostFurPale' : 'scr_emberFurPale';
  const RIM = frost ? 'scr_frostRim' : 'scr_emberRim', MO = 'scr_houndMouth';
  const BG = frost ? 'scr_gFrostHound' : 'scr_gEmberWolf';
  const fl = [1, 1.12, 0.9, 1.06][f % 4];
  const o: Out = [];
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(frost ? 60 : 44, 42, 62, 58, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(frost ? 86 : 12, frost ? 26 : 34, 24, 24, BG, { fl: 1, ink: BAND[3] }));
  const hb = -b * 0.45;

  // drifting motes: rime falling past the frost hound, embers rising off the wolf
  for (let i = 0; i < 7; i++) {
    if (frost) {
      const yy = (hash2(i, 41) * 96 + f * 2.5) % 96, x = 62 + hash2(i, 43) * 34;
      o.push(X(x, yy, 1, 1, BG + ':' + (i % 2 ? 4 : 5), { em: true }));
    } else {
      const yy = 70 - ((hash2(i, 31) * 66 + f * 5) % 66), x = 2 + hash2(i, 33) * 24 + (70 - yy) * 0.1;
      o.push(X(x, yy, 1, 1, i % 3 ? 'emFire:3' : 'emFireCore:4', { em: true }));
    }
  }

  if (frost) {
    // ---- the Frost-Ward Hound
    // the forequarters in three bands, each with a tufted edge: the back and
    // shoulder dark, the side of the neck grey, the ruff at the chest pale
    o.push(K(31, 50, 36, 104, 16, 24, C, { ink: -0.2 })); // the neck, turning in the light
    o.push(P([...furEdge([20, 40], [8, 60], [6, 97], 8, 2.6, 1, 5, 0.6), ...furEdge([30, 97], [24, 68], [28, 44], 6, 1.6, 1, 13, 0.5)], D, { occ: false, bv: 2.5, ink: -0.22 }));
    o.push(E(14, 94, 15, 10, D, { occ: false, fl: 0.3, ink: -0.14 })); // the shoulder
    o.push(P([...furEdge([48, 52], [38, 74], [44, 97], 8, 2.4, 1, 3, 0.5), ...furEdge([80, 97], [78, 72], [60, 54], 8, 2.4, 1, 11, 0.4)], L, { occ: false, bv: 2.5, ink: -0.28 }));
    o.push(E(62, 92, 15, 11, L, { occ: false, fl: 0.5, ink: -0.3 })); // the chest under the ruff
    // the collar, studded
    const ca: Pt = [14, 52], cc: Pt = [30, 72], cb: Pt = [56, 66];
    o.push(strand(ca[0], ca[1], cc[0], cc[1], cb[0], cb[1], 2, 2, 'scr_houndCollar', 6, { ink: -0.08 }));
    for (const t of [0.12, 0.36, 0.6, 0.84]) { const [x, y] = qpt(ca, cc, cb, t); o.push(E(x, y, 0.8, 0.8, 'steel')); }
    // the iron chest-plate hung from it, the kin rune on it
    const px = 54, py = 84 + hb * 0.4;
    o.push(K(px - 4, py - 6.6, 46, 67.6, 0.8, 0.8, 'scr_houndCollar'), K(px + 4, py - 7, 53.4, 66.6, 0.8, 0.8, 'scr_houndCollar'));
    o.push(P([px - 5.8, py - 6.2, px + 5.8, py - 7, px + 6.4, py + 3.8, px + 0.8, py + 9, px - 5.8, py + 4.4], 'iron', { bv: 2, n: [0.15, -0.1, 1] }));
    o.push(K(px, py - 3.8, px, py + 4.6, 0.6, 0.6, 'emKin'), K(px, py - 2, px + 2.2, py, 0.5, 0.5, 'emKin'), K(px, py + 0.8, px + 2.2, py + 2.8, 0.5, 0.5, 'emKin'), K(px, py - 0.9, px - 2.2, py + 1.1, 0.5, 0.5, 'emKin'));
    o.push(Lt(px, py, 13, '#f0c062', 0.45 + b * 0.1, 5));

    // the head: a broad husky's, the dark cap and mask over a pale face
    const H = hframe(38, 35 + hb, 0.05, 1.6), MK = 'scr_frostMask';
    o.push(H.P([3.4, -9.8, 2, -15.6, 0.4, -20, -0.8, -19.8, -2.2, -14, -2.6, -9.8], MK, { bv: 1.2, ink: -0.24 })); // the far ear
    // the head's shape: the skull, the stop, the short muzzle, the ruff flaring back
    o.push(H.P([17, -2.8, 13.9, -4.4, 10, -5.4, 6.5, -6, 4.8, -7.6, 2.6, -9.8, -1, -11.2, -6, -11.4, -10, -10,
      ...furEdge([-11, -9.4], [-21, -4], [-15, 10], 8, 2.6, 1, 5, 0.5), ...furEdge([-14, 11.4], [-6, 15.6], [4, 10.6], 6, 1.8, 1, 9, 0.4),
      8.6, 8.4, 12.2, 6.6, 14.6, 4.8, 15.5, 3.4, 16, 2.2, 17.3, 1.6, 18.1, 0.2, 18.3, -1.4, 18, -2.4], C, { bv: 6, ink: -0.04 }));
    // the pale face: cheek, muzzle and jaw, its back edge tufted into the grey ruff
    o.push(H.P([17.3, -2.2, 13, -3.4, 8.6, -3, 6.4, -1.2, 3.4, -0.8, 0, -1.8, -4.6, -3,
      ...furEdge([-6.4, -3], [-14, -0.6], [-12.6, 9.4], 6, 2, 1, 3, 0.5), -6, 12.6, 4, 10.2,
      8.6, 8.4, 12.2, 6.6, 14.6, 4.8, 15.5, 3.4, 16, 2.2, 17.3, 1.6, 18.1, 0.2], L, { occ: false, bv: 3.4, ink: -0.04 }));
    o.push(H.E(0.4, 3.8, 8, 6, L, { occ: false, fl: 0.2, ink: -0.02 })); // the cheek
    o.push(H.K(6.4, 6.6, 14.3, 4.2, 3, 1.7, 'scr_frostChin', { ink: -0.24 })); // the jaw under the lip
    o.push(H.K(7.4, 0.2, 15.2, -0.4, 5.2, 3.5, L, { ink: 0 })); // the muzzle
    o.push(H.E(-3.4, -6.4, 10.2, 5.4, MK, { occ: false, fl: 0.2, ink: 0.02 })); // the dark cap over the braincase
    o.push(H.E(3.8, -3.8, 4.4, 2.6, MK, { occ: false, fl: 0.4, a: 0.1, ink: 0.02 })); // the mask round the eye
    o.push(H.K(6.4, -5.2, 14.3, -3.8, 1.6, 0.8, D, { occ: false, ink: 0 })); // the grey down the bridge
    o.push(H.K(0.2, -7, 6.2, -5.8, 1.4, 1, MK, { ink: 0.14 })); // the brow over the stop
    o.push(H.E(2.4, -8.4, 1.8, 1.1, L, { occ: false, fl: 0.5, ink: 0.04 })); // the pale brow-spot
    o.push(H.K(7, 4.6, 9, 5.2, 0.55, 0.45, D, { ink: -0.3, occ: false })); // the corner of the lip
    o.push(H.E(16.7, -1.6, 2.3, 1.9, 'scr_houndNose', { fl: 0.1 }));
    o.push(H.K(17.6, -0.6, 18.5, -0.8, 0.45, 0.4, MO, { occ: false }));
    // the eye: almond, pale frost, level and steady under a calm lid
    o.push(almond(H, 4, -3.8, 2.7, 1.35, 0.25, 'scr_frostEye', RIM, MK, 0.15, f === 3, '#ffffff'));
    // the near ear: thick, triangular, dark outside, pale fur in its hollow
    o.push(H.P([-0.6, -10.2, -3, -16, -5.2, -21, -6.6, -21.4, -8.6, -16, -11, -8.4], MK, { bv: 1.4, ink: 0.06 }));
    o.push(H.K(-2.6, -11.2, -5.2, -18.4, 1.4, 0.4, RIM));
    o.push(H.K(-1.4, -10.6, -4.4, -17.4, 1.1, 0.4, L, { ink: -0.34 }));
    // its breath: a plume of broken puffs of rime, rising off the nose and curling away
    const plume: Pt[] = [[70.4, 34 + hb], [76, 33], [83, 31], [87, 27.6], [88.6, 23], [87.4, 18.6], [84, 15.6], [79.6, 14.6]];
    for (let i = 0; i < 5; i++) {
      const t = (i + f / 4) / 5, [x, y] = along(plume, t), r = 1.3 + 2.8 * t, ink = -0.46 - 0.12 * t, ra = i * 1.9;
      const lumps = [[0, 0, 1], [-0.62, -0.3, 0.64], [0.56, 0.24, 0.6], [0.06, 0.56, 0.5]].map(([dx, dy, s]) => [x + (dx * Math.cos(ra) - dy * Math.sin(ra)) * r, y + (dx * Math.sin(ra) + dy * Math.cos(ra)) * r, r * s]);
      for (const [lx, ly, lr] of lumps) o.push(E(lx, ly, lr + 0.9, lr * 0.9 + 0.9, BG, { fl: 1, ink: BAND[4] + 0.04 - 0.1 * t, occ: false }));
      for (const [lx, ly, lr] of lumps) o.push(E(lx, ly, lr, lr * 0.9, 'scr_frostMist', { fl: 1, ink, occ: false }));
      o.push(E(x - r * 0.2, y - r * 0.2, r * 0.46, r * 0.38, 'scr_frostMist', { fl: 1, ink: ink + 0.24, occ: false }));
    }
    o.push(Lt(82, 30 + hb, 48, '#9fe6ff', 0.6 * fl, 12));
  } else {
    // ---- the Ember-Fang Wolf
    // the forequarters, lean: the neck mid, the throat pale and shaggy, the shoulder
    // dark; along the crest of the neck the hackles stand up dark, burning at the tips
    o.push(K(30, 46, 31, 104, 13, 19, C, { ink: -0.32 })); // the neck, turning in the light
    o.push(E(16, 95, 14, 8, D, { occ: false, fl: 0.3, ink: -0.16 })); // the shoulder
    o.push(P([...furEdge([40, 54], [33, 76], [38, 97], 8, 2.2, 1, 3, 0.5), 52, 97, 50, 82, 46, 64], L, { occ: false, bv: 2.5, ink: -0.38 }));
    const cA: Pt = [24, 27], cC: Pt = [12, 35], cB: Pt = [11, 92], crest: number[] = [], tips: Array<[number, number, number, number, number, number]> = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, [x, y, tx, ty] = qpt(cA, cC, cB, t), l = Math.hypot(tx, ty);
      if (i % 2) { crest.push(x, y); continue; }
      const nx = -ty / l, ny = tx / l, dx = nx - (tx / l) * 0.6, dy = ny - (ty / l) * 0.6, dl = Math.hypot(dx, dy);
      const len = (4.4 + 3 * hash2(i, 7)) * (0.7 + 0.6 * Math.sin(t * Math.PI));
      const ex = x + (dx / dl) * len, ey = y + (dy / dl) * len;
      if (i) { const bx = crest[crest.length - 2], by = crest[crest.length - 1]; crest.push((bx + ex) / 2 + nx * len * 0.22, (by + ey) / 2 + ny * len * 0.22); }
      crest.push(ex, ey);
      tips.push([x, y, dx / dl, dy / dl, len, i]);
    }
    // the heat along the crest, then the hackles dark against it
    const glow: number[] = [];
    for (let i = 0; i <= 8; i++) { const [x, y, tx, ty] = qpt(cA, cC, cB, i / 8), l = Math.hypot(tx, ty); glow.push(x - (ty / l) * 6, y + (tx / l) * 6); }
    for (let i = 8; i >= 0; i--) { const [x, y] = qpt(cA, cC, cB, i / 8); glow.push(x, y); }
    o.push(P(glow, 'emFire', { ink: -0.68, occ: false }));
    o.push(P([...crest, ...furEdge([18, 92], [20, 44], [30, 33], 8, 1.8, 1, 3, 0.3)], D, { occ: false, bv: 1.6, ink: -0.2 }));
    const ph = f * 1.6;
    for (const [x, y, ux, uy, len, i] of tips) {
      const ex = x + ux * len, ey = y + uy * len, fx = ux * 0.8, fy = uy * 0.8 - 0.3, fd = Math.hypot(fx, fy);
      o.push(K(x + ux * len * 0.62, y + uy * len * 0.62, ex, ey, 1, 0.5, 'emFire', { ink: -0.4, occ: false })); // the fur's tip catching
      const hh = (7 + 5 * hash2(i, 19)) * [1, 1.15, 0.88, 1.06][(f + i) % 4];
      o.push(flameDir(ex - ux * 0.5, ey - uy * 0.5, fx / fd, fy / fd, hh + 1.2, 1.9, ph + i * 2.1, 'emFire', -0.52));
      o.push(flameDir(ex, ey, fx / fd, fy / fd, hh * 0.74, 1.2, ph + i * 2.1, 'emFire', -0.3));
      if (hh > 8.4) o.push(flameDir(ex + ux * 0.4, ey + uy * 0.4, fx / fd, fy / fd, hh * 0.36, 0.8, ph + i * 2.1 + 0.5, 'emFireCore', -0.18));
    }
    // the collar, the kin-tag at the throat
    const ca: Pt = [14, 54], cc: Pt = [28, 70], cb: Pt = [46, 64];
    o.push(strand(ca[0], ca[1], cc[0], cc[1], cb[0], cb[1], 2, 2, 'scr_houndCollar', 6, { ink: -0.08 }));
    for (const t of [0.15, 0.42, 0.68, 0.92]) { const [x, y] = qpt(ca, cc, cb, t); o.push(E(x, y, 0.75, 0.75, 'steel')); }
    o.push(kinTag(32, 69, 1.2, 1 + b * 0.08));
    o.push(Lt(32, 73, 12, '#f0c062', 0.45 + b * 0.1, 4));

    // the head: lean, a wolf's, snarling
    const H = hframe(38, 42 + hb, 0.14, 1.5);
    const jo = [0, 0.2, 0.4, 0.2][f % 4];
    o.push(H.P([3, -10, 0.8, -15.6, -1, -21, -2.2, -20.8, -3.8, -15, -3.4, -10], D, { bv: 1.2, ink: -0.22 })); // the far ear
    // the mouth, open a little: dark inside, the ember glow deep in the throat
    o.push(H.P([6.4, 3.6, 11, 3.6, 16, 2.6, 20.6, 2.6, 21, 4.4 + jo, 15, 6 + jo, 9, 6.6 + jo * 0.6, 5.8, 6.2], MO));
    o.push(H.E(8, 5 + jo * 0.4, 1.9, 1.1, 'emFire', { ink: -0.38 + (fl - 1) * 0.6, occ: false }));
    o.push(H.E(7.6, 5 + jo * 0.4, 0.9, 0.6, 'emFireCore', { ink: -0.2 + (fl - 1) * 0.5, occ: false }));
    // the head's shape: skull, stop, muzzle to the nose, the cheek ruff flaring back
    o.push(H.P([21.6, -3, 18.6, -4.6, 13.6, -5.8, 7, -6.8, 5, -8.6, 2.6, -10.4, -2, -11.4, -7, -11, -11, -9.2,
      ...furEdge([-12, -8.6], [-19, -3], [-14.4, 7.4], 6, 2.4, 1, 5, 0.5), ...furEdge([-13, 8.6], [-7, 12.4], [2, 9.6], 4, 1.6, 1, 9, 0.4),
      5.4, 6.6, 6.4, 3.6, 10, 3, 14, 1.4, 16.8, -0.2, 18.6, 0.4, 20.4, 1.6, 22.2, 1, 23.2, -0.6, 23.2, -2, 22.6, -2.8], C, { bv: 5, ink: -0.04 }));
    // the pale cheek, tufted back into the ruff
    o.push(H.P([8, -1.4, 4, -1.6, 0, -2.6, -5, -3.2, ...furEdge([-6.4, -3.2], [-13, -0.8], [-12, 7.4], 6, 2, 1, 3, 0.5), -6, 10.6, 2, 9.4, 5.4, 6.6, 6.4, 3.6, 9.6, 2.8], L, { occ: false, bv: 2.6, ink: -0.1 }));
    o.push(H.E(0.4, 3.4, 7.2, 5.2, L, { occ: false, fl: 0.45, ink: -0.12 })); // the cheek
    o.push(H.E(-3, -5.6, 9, 5.2, C, { occ: false, fl: 0.18, ink: 0.04 })); // the braincase
    // the lower jaw dropped a little, its canine up before the great fang
    o.push(H.P([5, 5.6 + jo * 0.5, 11, 6.2 + jo, 17, 5 + jo, 21, 4.4 + jo, 22, 5.4 + jo, 20.8, 7 + jo, 15, 8.4 + jo, 8, 9.2 + jo * 0.5, 4, 8.6], 'scr_emberChin', { bv: 1.6, ink: -0.3 }));
    o.push(H.P([18.6, 4.8 + jo, 20.4, 4.6 + jo, 19.6, 1.4 + jo], 'emFireCore', { bv: 0.4, ink: -0.14 }));
    o.push(H.P([20.8, 4.6 + jo, 22, 4.6 + jo, 21.4, 3.2 + jo], 'emFireCore', { ink: -0.3 }));
    // the muzzle: rounded, tapering to the nose
    o.push(H.K(7.6, -1.8, 19.4, -1.6, 4.4, 2.9, C, { ink: 0.02 }));
    // the lip curled up off the gum, the teeth bared under it
    o.push(H.P([9, 3.2, 14, 1.4, 16.8, -0.2, 18.6, 0.4, 20.4, 1.6, 20.6, 2.8, 16, 2.8, 11, 3.8], 'scr_houndGum'));
    for (const [x, h] of [[12, 1.4], [13.8, 1.6]]) o.push(H.P([x - 0.9, 3.4, x + 0.9, 3.2, x, 3.4 + h], 'emFireCore', { ink: -0.36 }));
    o.push(H.P([20, 2.6, 21.4, 2.4, 20.8, 4], 'emFireCore', { ink: -0.2 })); // the incisors
    o.push(H.P([15.8, 2.4, 18.2, 2.2, 17.2, 8.4], 'emFireCore', { bv: 0.5, ink: 0.02 })); // the great fang
    for (const [x0, y0, x1, y1] of [[6.4, 3.6, 10, 3], [10, 3, 14, 1.4], [14, 1.4, 16.8, -0.2], [16.8, -0.2, 18.6, 0.4], [18.6, 0.4, 20.4, 1.6]]) o.push(H.K(x0, y0, x1, y1, 0.6, 0.6, RIM, { occ: false })); // the black lip
    o.push(H.K(7.4, -5.8, 20.2, -3.4, 1.2, 0.7, D, { occ: false, ink: 0.06 })); // the dark of the bridge
    for (let i = 0; i < 4; i++) o.push(H.K(10.6 + i * 2.2, -6 + i * 0.5, 11.8 + i * 2.2, -3 + i * 0.6, 0.5, 0.4, D, { ink: -0.34, occ: false })); // the snarl's wrinkles
    o.push(H.K(15.4, -1.2, 12.4, -3.6, 0.5, 0.4, D, { ink: -0.3, occ: false }));
    o.push(H.E(22, -1.6, 2.2, 1.9, 'scr_houndNose', { fl: 0.1 }));
    o.push(H.K(22.8, -0.6, 23.8, -0.8, 0.45, 0.4, MO, { occ: false }));
    // the eye: almond, slanted, ember-bright under a brow drawn hard down
    o.push(almond(H, 4.6, -4, 2.8, 1.15, 0.55, 'scr_emberEye', RIM, D, 0.32, false, '#fff1c2'));
    o.push(H.K(0.2, -7.4, 7.8, -5.4, 1.5, 1, C, { ink: 0.14 })); // the brow
    o.push(H.Lt(4.8, -3.8, 6, '#ff8a2c', 0.4 * fl, 3));
    // the near ear: tall, laid back in the snarl
    o.push(H.P([-0.6, -10.4, -3.4, -15.4, -6.2, -20.4, -7.6, -20.8, -9.6, -15.6, -11.4, -8.4], C, { bv: 1.4, ink: 0.06 }));
    o.push(H.K(-2.8, -11.4, -6.4, -18.2, 1.6, 0.4, RIM));
    o.push(H.K(-1.4, -10.8, -5.4, -18, 1.1, 0.4, L, { ink: -0.34 }));
    // the light: the burning hackles, the fire in its throat
    o.push(Lt(6, 30, 44, '#ff8a2c', 0.8 * fl, 8));
    o.push(H.Lt(8, 5, 9, '#ff8a2c', 0.5 * fl, 4));
  }
  return o;
}

/** The Frost-Ward Hound: broad and calm, a husky's head, its breath rising in puffs of rime. */
export function frostHoundPortrait(f: number): PrimTree {
  return hound(f, 'frost');
}

/** The Ember-Fang Wolf: lean, snarling, its hackles turning to flame along its neck. */
export function emberWolfPortrait(f: number): PrimTree {
  return hound(f, 'ember');
}
