import { E, K, P, X, Lt, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9f, group A: the hidden folk. The Huldra and her old self (one model, two kinds), the Fylgja, the Näcken. Conventions: portraitKit.ts. */

/** A head frame: local units around (px, py), scaled by k and turned by ang. */
function hf(px: number, py: number, k: number, ang = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pt = (a: number, b: number): Pt => [px + (a * c - b * s) * k, py + (a * s + b * c) * k];
  return {
    pt,
    E: (cx: number, cy: number, rx: number, ry: number, m: string, o: PrimOptions = {}) => { const [x, y] = pt(cx, cy); return E(x, y, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => { const p = pt(x1, y1), q = pt(x2, y2); return K(p[0], p[1], q[0], q[1], r1 * k, r2 * k, m, o); },
    P: (pts: number[], m: string, o: PrimOptions = {}) => { const q: number[] = []; for (let i = 0; i < pts.length; i += 2) q.push(...pt(pts[i], pts[i + 1])); return P(q, m, o.bv ? { ...o, bv: o.bv * k } : o); },
    X: (a: number, b: number, w: number, h: number, m: string, o?: PrimOptions) => { const [x, y] = pt(a, b); return X(x - (w * k) / 2, y - (h * k) / 2, w * k, h * k, m, o); },
    S: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n?: number, o?: PrimOptions) => { const A = pt(ax, ay), B = pt(bx, by), C = pt(cx, cy); return strand(A[0], A[1], B[0], B[1], C[0], C[1], r0 * k, r1 * k, m, n, o); },
  };
}

// ===================================================================== HULDRA
// Seen from behind, turning to look back over her shoulder: the beauty in the
// face, the hollow of rotten wood down her back, the cow's tail she cannot hide.
// huldra: moss-blonde hair with white flowers, a moss gown, silver moonlight.
// old (the Hollow-Back): the same face gone to bark, hunched, the nose grown out
// into a snag, twigs up through hair like hanging lichen; the hollow has rotted
// wide and the foxfire in it is all her light.
function huldra(f: number, kind: 'huldra' | 'old'): PrimTree {
  const old = kind === 'old';
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const BG = old ? 'scr_gHuldraOld' : 'scr_gHuldra';
  const SK = old ? 'scr_huldraOldSkin' : 'scr_huldraSkin';
  const HR = old ? 'scr_huldraOldHair' : 'scr_huldraHair';
  const HD = old ? 'scr_huldraOldHairDark' : 'scr_huldraHairDark';
  const GW = old ? 'scr_huldraBarkGown' : 'scr_huldraMoss';
  const BD = old ? 'scr_huldraOldBark' : SK; // the body: skin, or bark
  const RIM = 'scr_huldraRim', HO = 'scr_huldraHollow', HX = 'scr_huldraHollowDeep', FG = 'scr_huldraFungus', LI = 'scr_huldraLichen';
  const LA = 'scr_huldraLash';
  const ff = [1, 1.1, 0.9, 1.05][f % 4];
  const blink = f === 2;

  // ---- the ground: the birch wood at night, dark behind her face, paler behind her hair
  o.push(P(FULL, BG, { ink: BAND[1] }));
  if (old) {
    o.push(E(58, 84, 54, 46, BG, { fl: 1, ink: BAND[2] }));
    o.push(E(58, 90, 26, 20, BG, { fl: 1, ink: BAND[3] }));
  } else {
    o.push(E(72, 30, 52, 50, BG, { fl: 1, ink: BAND[2] }));
    o.push(E(76, 22, 26, 24, BG, { fl: 1, ink: BAND[3] }));
  }
  for (const [x, w, lean, ink] of [[8, 5, 1.4, BAND[1] + 0.08], [62, 4, -0.8, BAND[2] + 0.06], [86, 6, 0.6, BAND[3] + 0.08]]) {
    o.push(P([x - w / 2 + lean, -1, x + w / 2 + lean, -1, x + w / 2, 97, x - w / 2, 97], BG, { ink }));
    for (let i = 0; i < 3; i++) { // a birch's black marks
      const y = 5 + i * 15 + hash2(x, i) * 6, l = lean * (1 - y / 96);
      o.push(K(x - w / 2 + l, y, x + w * 0.1 + l, y + 0.5, 0.6, 0.5, BG, { ink: BAND[1] }));
    }
  }

  const by = -b * 0.45;
  const hump = old ? 5 : 0;
  const H = old ? hf(34, 41 + by, 1.2, -0.16) : hf(35, 35 + by, 1.2, -0.06);

  // ---- the hair behind: from the back of her head, over the far shoulder
  o.push(P([44, 18 + hump * 0.6, 58, 20 + hump * 0.6, 66, 29 + hump, 68, 42, 74, 54, 84, 62, 92, 72, 96, 86, 97, 97, 84, 97, 82, 84, 74, 72, 64, 66, 56, 58, 50, 46], HD, { bv: 2, ink: -0.06 }));
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[50, 20, 66, 40, 80, 72, -0.02], [57, 22, 74, 44, 91, 82, 0.06], [62, 30, 80, 54, 94, 94, -0.1], [52, 36, 64, 56, 78, 86, -0.14]]) {
    o.push(strand(x0, y0 + hump, x1, y1 + hump * 0.5, x2 + s * 0.3, y2, 1.4, 0.5, HR, 4, { ink }));
  }

  // ---- the neck turned on the shoulders, the bare back
  o.push(K(46, 44 + hump * 0.6, 51, 62 - hump * 0.4, 5.2, 7, old ? SK : BD, { ink: -0.12 }));
  o.push(P([12, 97, 13, 82, 17, 73 - hump, 26, 67 - hump, 37, 64 - hump, 46, 62 - hump * 1.3, 56, 63 - hump * 1.4, 67, 66 - hump, 77, 71, 84, 80, 86, 97], BD, { bv: 6, n: [0, -0.1, 1], ink: -0.16 }));
  o.push(E(24, 75 - hump * 0.6, 10, 7.4, BD, { fl: 0.85, occ: false })); // the near shoulder
  o.push(K(17, 81, 15, 97, 5.4, 6, BD, { ink: -0.18 })); // the near arm
  o.push(K(42.6, 72, 41, 84, 0.6, 0.5, BD, { ink: -0.2, occ: false })); // the near shoulder blade's edge
  o.push(K(66, 72, 68, 84, 0.6, 0.5, BD, { ink: -0.3, occ: false })); // the far one's edge
  for (let i = 0; i < 2; i++) o.push(E(53 + i * 0.4, 60 - hump * 1.3 + i * 3, 1.1, 0.9, BD, { ink: 0.04 })); // the knobs of the spine

  // ---- the gown, low on the back
  o.push(P([12, 97, 13, 90, 22, 88, 34, 88, 44, 91, 48, 97], GW, { bv: 2.4, ink: -0.08 }));
  o.push(P([64, 97, 66, 91, 76, 89, 84, 89, 86, 97], GW, { bv: 2.4, ink: -0.18 }));

  // ---- the hollow down her spine: a lip of bark, the rotten wood, the dark inside
  const yt = old ? 56 : 65;
  const hol = (y0: number, w0: number, w1: number, jag: number, sd: number): number[] => {
    const Lf: number[] = [], Rt: number[] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9, y = y0 + (99 - y0) * t, cx = 55 + (y - y0) * 0.1, w = w0 + (w1 - w0) * Math.sqrt(t);
      Lf.push(cx - w * (1 + (hash2(i, sd) - 0.5) * jag), y);
      Rt.unshift(cx + w * (1 + (hash2(i, sd + 1) - 0.5) * jag), y);
    }
    return [55, y0 - 3, ...Lf, ...Rt];
  };
  const wk = old ? 1.3 : 1;
  o.push(P(hol(yt, 4 * wk, 13.4 * wk, 0.34, 3), RIM, { bv: 3 }));
  o.push(P(hol(yt + 2.4, 1.8 * wk, 8.6 * wk, 0.3, 5), HO, { bv: 2 }));
  for (let i = 0; i < 4; i++) o.push(K(52 + i * 2.2, yt + 9 + (i % 2) * 5, 53 + i * 2.4, 99, 0.5, 0.65, HO, { ink: -0.32, occ: false })); // the grain of the rot
  o.push(P(hol(yt + 9, 0.7 * wk, 5 * wk, 0.26, 7), HX, { ink: BAND[1] }));
  const shelves = old ? [[61.4, yt + 10, 3.2], [63.4, yt + 21, 4.2], [49, yt + 26, 3.4], [64.6, yt + 32, 2.8], [49.6, yt + 14, 2.4]] : [[61, yt + 13, 3], [62.6, yt + 23, 2.4], [48.6, yt + 27, 2.2]];
  for (const [x, y, w] of shelves) {
    o.push(E(x, y, w, w * 0.4, FG, { fl: 0.3 }));
    o.push(K(x - w * 0.8, y + w * 0.32, x + w * 0.8, y + w * 0.32, 0.5, 0.5, FG, { ink: -0.4, occ: false }));
  }
  o.push(E(56, yt + 1.4, 2.6, 1.3, LI), E(51.6, yt + 6, 1.7, 1, LI, { ink: -0.1 }));
  if (old) {
    // foxfire: the rot glows where the fungus feeds on it
    for (const [x, y, r] of [[54, yt + 16, 1.2], [57.6, yt + 23, 0.9], [53, yt + 31, 1.1], [58, yt + 37, 0.9], [55.6, yt + 42, 1]]) o.push(E(x, y, r, r * 1.4, 'scr_huldraFoxfire', { ink: (ff - 1) * 0.6 }));
  }

  // ---- the cow's tail, flicked up from under the gown
  const tk = s * 0.8;
  const TL = old ? 'bark' : 'scr_huldraTail', TF = old ? LI : 'scr_huldraTuft';
  o.push(strand(66, 99, 94, 98, 89 + tk * 0.4, 78, old ? 1.8 : 1.5, old ? 1.2 : 1, TL, 6));
  o.push(E(88.4 + tk, 71.6, 2.6, 4.8, TF, { a: 0.12 }));
  for (const dx of [-1.2, 0, 1.2]) o.push(K(88.4 + tk + dx, 74, 87.8 + tk + dx * 1.6, 79.4, 0.8, 0.5, TF, { ink: -0.06 }));

  // ---- the head
  o.push(H.E(7, -3, 11, 12, HD, { ink: -0.04 })); // the back of the head
  o.push(H.E(4, 12, 4.2, 2, SK, { fl: 1, ink: -0.2 })); // the jaw's shadow on the neck
  o.push(H.E(1, 0.4, 8.8, 12, SK, { fl: 0.2 }));
  o.push(H.E(-1.6, 6.6, 6, 4.4, SK, { fl: 0.3, occ: false })); // the jaw
  o.push(H.E(-5.4, 10.2, 2.6, 2.1, SK, { fl: 0.3, occ: false })); // the chin
  o.push(H.E(6.8, 2, 3.2, 9.4, SK, { fl: 1, ink: -0.1, occ: false })); // the side of the face, toward the ear
  o.push(H.E(9.2, 2.2, 1.9, 3.2, SK, { ink: -0.06 }), H.K(9, 1, 9.4, 3.8, 0.55, 0.45, SK, { ink: -0.3, occ: false })); // the ear
  if (old) o.push(H.E(-7.4, -4.2, 1.7, 1.3, SK, { fl: 0.6, occ: false })); // the brow, in profile
  const ey = -1.4;
  if (old) {
    // the same face gone to bark: grain, hollow cheeks, sockets with amber deep in them
    o.push(H.E(-4.2, 2.6, 3.6, 2, SK, { fl: 0.4, ink: 0.06 })); // cheekbone
    o.push(H.E(-2.6, 6.4, 3.2, 2.4, SK, { fl: 0.7, ink: -0.2 })); // the hollow under it
    for (const [x0, y0, x1, y1] of [[1, -11, 2, -5], [-4, -10, -3.6, -6], [4, 3, 5, 11], [-6, 5, -7, 9.6], [1, 9, 1.4, 13]]) o.push(H.K(x0, y0, x1, y1, 0.45, 0.42, SK, { ink: -0.32, occ: false }));
    o.push(H.K(-9.6, -4.2, -0.6, -4, 1.6, 1.3, SK, { ink: 0.06 }), H.K(-0.6, -4, 5, -5, 1.3, 1, SK, { ink: 0.02 })); // brow ridges
    o.push(H.E(-1.8, ey, 2.8, 2, 'scr_huldraSocket', { ink: -0.9 }), H.E(-6.6, ey, 1.5, 1.5, 'scr_huldraSocket', { ink: -0.9 }));
    if (!blink) o.push(H.X(-0.8, ey - 0.1, 1.1, 0.9, '#ffbe5a', { em: true }), H.X(-6.2, ey - 0.1, 0.7, 0.8, '#e8a040', { em: true }));
    o.push(H.K(-6.4, -2, -17, 5.4, 1.6, 0.6, 'bark')); // the nose, grown out into a snag
    o.push(H.E(-11.4, 1.6, 1.2, 1, 'bark', { ink: 0.06 }), H.K(-13.4, 2.8, -15, -0.2, 0.5, 0.42, 'bark'));
    o.push(H.P([-9.6, 7.4, -4.6, 7.6, -2.6, 6.4, -4.4, 9.2, -9, 9.2], 'scr_huldraSocket', { ink: BAND[1] })); // a sly crack of a mouth
    o.push(H.K(-9, 9.6, -4.6, 9.8, 0.45, 0.42, SK, { ink: 0.1, occ: false }));
    o.push(H.E(-6, -7.6, 2.4, 1.4, LI), H.E(5, 7, 1.8, 1.3, LI, { ink: -0.1 }));
    // the crown of twigs grown up through her hair, leaning back
    for (const [x0, y0, x1, y1, x2, y2, r] of [[0, -11, -1, -19, 3, -26, 1.1], [5, -12, 8, -19, 14, -23, 1], [10, -9, 15, -13, 20, -13, 0.85], [-4, -10, -7, -15, -8, -21, 0.8]]) {
      o.push(H.S(x0, y0, x1, y1, x2, y2, r, 0.42, 'bark', 3));
    }
    o.push(H.K(-0.6, -19, -3.6, -22.6, 0.5, 0.42, 'bark'), H.K(9.2, -18.4, 8, -23, 0.5, 0.42, 'bark'), H.E(2, -16, 1.8, 1.2, LI, { ink: -0.06 }));
    // hair like hanging lichen
    o.push(H.P([-9.4, -5, -7.6, -11, -2, -13.4, 6, -13.6, 13, -9, 15, 0, 13, 8, 10.6, 4, 9.6, -2, 6, -6, 0, -7.4, -5, -7.4], HR, { bv: 2 }));
    for (const [x0, y0, x1, y1, x2, y2, ink] of [[12, -8, 17, 6, 15, 22, -0.04], [14, -3, 20, 10, 21, 28, -0.16], [8, -11, 13, 2, 11, 14, 0.04], [-7, -8, -9.6, 0, -9.4, 8, -0.1], [16, 2, 21, 14, 24, 28, -0.2]]) {
      o.push(H.S(x0, y0, x1, y1, x2 + s * 0.3, y2, 1, 0.42, HR, 4, { ink }));
    }
  } else {
    o.push(H.E(-3.6, 3.2, 3.4, 2.6, SK, { fl: 0.92, ink: 0.03, occ: false })); // the cheek
    if (blink) {
      o.push(H.K(-4.6, ey + 0.2, 1.2, ey - 0.2, 0.45, 0.42, LA), H.K(-7.4, ey + 0.2, -5.4, ey, 0.42, 0.42, LA));
    } else {
      // the near eye: almond, the iris slid to its corner, toward you, under a heavy lid
      o.push(H.E(-1.6, ey, 3.2, 1.8, SK, { fl: 0.9, ink: -0.08, occ: false }));
      o.push(H.E(-1.6, ey + 0.2, 2.7, 1.2, 'scr_huldraFlower', { ink: -0.1 }));
      o.push(H.E(-0.2, ey + 0.1, 1.2, 1.2, 'scr_huldraIris'));
      o.push(H.X(0, ey + 0.2, 0.7, 0.8, '#1a120c'), H.X(0.5, ey - 0.3, 0.6, 0.6, '#fff4dc', { em: true }));
      o.push(H.K(-4.4, ey - 0.7, 1, ey - 1.3, 0.42, 0.42, LA), H.K(1, ey - 1.3, 2.4, ey - 1.9, 0.42, 0.42, LA));
      // the far eye, beyond the bridge
      o.push(H.E(-6.3, ey + 0.2, 1.1, 0.9, 'scr_huldraFlower', { ink: -0.2 }));
      o.push(H.E(-5.9, ey + 0.2, 0.65, 0.8, 'scr_huldraIris'));
      o.push(H.K(-7.4, ey - 0.5, -5.4, ey - 0.8, 0.42, 0.42, LA));
    }
    // fine brows
    o.push(H.S(-4.6, -4.6, -1.6, -6, 1.8, -5.2, 0.45, 0.42, HD, 3));
    o.push(H.K(-8, -4.2, -6.2, -4.7, 0.42, 0.42, HD));
    // the nose: straight and fine, standing just out of the profile
    o.push(H.K(-5.6, -2.4, -10.2, 3.2, 0.9, 1.3, SK, { ink: 0.04, occ: false }));
    o.push(H.E(-10, 3.8, 1.4, 1.15, SK, { ink: 0.02, occ: false }), H.E(-8.2, 4.5, 1.15, 0.95, SK, { ink: -0.05, occ: false }));
    o.push(H.X(-9.2, 4.9, 1, 0.85, SK + ':1'));
    // the mouth: small, closed, its corner lifted
    o.push(H.E(-7.3, 7.3, 1.5, 0.6, 'scr_huldraLip', { fl: 0.5, ink: -0.04, occ: false }), H.E(-6.9, 8.5, 1.4, 0.7, 'scr_huldraLip', { fl: 0.4, ink: 0.1, occ: false }));
    o.push(H.K(-8.6, 7.9, -5.8, 8, 0.42, 0.42, 'scr_huldraLip', { ink: -0.3, occ: false }), H.K(-5.8, 8, -5, 7.3, 0.42, 0.42, 'scr_huldraLip', { ink: -0.3, occ: false }));
    // the hair: swept back from the brow, down behind the ear; flowers in it
    o.push(H.P([-9.6, -6, -7, -11.6, -1, -14.2, 6, -14.6, 13, -11, 16, -3, 15, 6, 12.4, 10, 11, 5, 11.4, -1, 8, -5.4, 3, -7.4, -3, -8, -7, -7.4], HR, { bv: 2.6 }));
    for (const [x0, y0, x1, y1, x2, y2, ink] of [[-6, -10, 2, -12.6, 10, -9, 0.1], [-2, -8, 5, -9.6, 12, -4, -0.08], [4, -13, 11, -11, 14, -4, 0.06]]) o.push(H.S(x0, y0, x1, y1, x2, y2, 0.4, 0.36, HR, 3, { ink: ink - 0.22 })); // combed lines
    for (const [x0, y0, x1, y1, x2, y2, ink] of [[12, -8, 16, 6, 15, 22, -0.02], [14, -3, 19, 10, 21, 28, -0.12], [16, 2, 22, 16, 27, 32, -0.06]]) {
      o.push(H.S(x0, y0, x1, y1, x2 + s * 0.3, y2, 1.3, 0.35, HR, 4, { ink }));
    }
    for (const [x, y, r] of [[7, -13.6, 1.4], [11.4, -10.4, 1.2], [2, -14.4, 1]]) {
      const [cx, cy] = H.pt(x, y);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + x; o.push(E(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2, r * 0.8, r * 0.8, 'scr_huldraFlower')); }
      o.push(E(cx, cy, r * 0.5, r * 0.5, 'scr_huldraIris', { ink: 0.2 }));
    }
  }

  // ---- light
  if (old) {
    o.push(Lt(55, yt + 18, 44, '#9ee8c4', 0.5 * ff, 10), Lt(10, 4, 70, '#c8d4e8', 0.28, 24));
  } else {
    o.push(Lt(8, 6, 74, '#d0dcff', 0.45, 26));
    for (let i = 0; i < 4; i++) { // motes turning in the moonlight
      const x = 6 + hash2(i, 31) * 84, y = (hash2(i, 33) * 50 + f * 1.2 * (1 + (i % 2))) % 50 + 4;
      o.push(X(x, y, 1, 1, BG + ':5', { em: true }));
    }
  }
  return o;
}

/** The huldra of the Hollow Wood, seen from behind, turning to look back over her shoulder: a fair face under moss-blonde hair and white flowers, the hollow of a rotten tree down her bare back, her cow's tail flicking up from under the moss gown; moonlight in the birch wood. */
export function huldraPortrait(f: number): PrimTree {
  return huldra(f, 'huldra');
}

/** The huldra gone to bark: hunched, a snag of a nose, twigs through lichen hair, amber in deep sockets; the foxfire in her rotten hollow lights her from below. */
export function huldraHollowBackPortrait(f: number): PrimTree {
  return huldra(f, 'old');
}

// ===================================================================== FYLGJA
// The fetch that walks ahead of a doomed man: a white stag turning its long head
// to you, a wide crown of bone-white antlers with only the tips gone faintly gold,
// eyes pale and empty; from the throat down it thins into the mist, and the dark
// trunks behind show through it. Its own pallor is all the light there is.
/** The fetch that walks ahead of a doomed man: a white stag turning its long head to you under a crown of bone-white antlers, only their tips faintly gold; below the throat it goes down into a bank of mist. */
export function fylgjaPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const BG = 'scr_gFylgja', FW = 'scr_fylgjaFur', AN = 'scr_fylgjaAntler', MI = 'scr_fylgjaMist', IN = 'scr_fylgjaInner', NO = 'scr_fylgjaNose', GO = 'scr_fylgjaGold';
  const g = [1, 1.08, 0.94, 1.03][f % 4];

  // ---- the ground: pines at night, a pallor behind the head, mist low
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 34, 62, 52, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(40, 24, 30, 26, BG, { fl: 1, ink: BAND[3] }));
  for (const [cx, w, top, ink] of [[6, 11, -4, BAND[1] - 0.05], [88, 13, 6, BAND[1] - 0.03], [74, 7, 26, BAND[2] - 0.04]]) {
    o.push(K(cx, top, cx, 97, 1, 1.4, BG, { ink: ink - 0.04 }));
    for (let i = 0; i < 6; i++) { // the spruce's tiers
      const y = top + i * 13, ww = w * (0.45 + i * 0.13);
      o.push(P([cx, y, cx + ww, y + 13, cx + ww * 0.4, y + 11, cx, y + 13.6, cx - ww * 0.4, y + 11, cx - ww, y + 13], BG, { ink }));
    }
  }
  for (let i = 0; i < 2; i++) o.push(E(30 + ((i * 41 + f * 2) % 40), 91 + i * 4, 30, 2.4, MI, { fl: 0.5, ink: -0.66 + i * 0.06 }));

  // ---- the head frame: the muzzle down to the left
  const hb = -b * 0.45;
  const H = hf(50, 42 + hb, 1.1, -0.6);
  const tw = f === 3 ? 0.12 : 0; // an ear's twitch

  // ---- the far ear and the far antler, behind the head
  { const [x, y] = H.pt(-2, -11); o.push(E(x - 6, y - 4, 6.4, 2.8, FW, { a: 0.62, ink: -0.2 }), E(x - 6.2, y - 3.6, 4.6, 1.6, IN, { a: 0.62, ink: -0.16 })); }
  const beam = (A: Pt, C: Pt, B: Pt, tines: number[][], r0: number, ink: number): void => {
    o.push(strand(A[0], A[1], C[0], C[1], B[0], B[1], r0, r0 * 0.4, AN, 7, { ink }));
    for (const [t, dx, dy, cx, cy] of tines) {
      const u = 1 - t;
      const x = u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], y = u * u * A[1] + 2 * u * t * C[1] + t * t * B[1];
      o.push(strand(x, y, x + cx, y + cy, x + dx, y + dy, r0 * (1 - t * 0.55) * 0.72, 0.5, AN, 4, { ink: ink - 0.02 }));
      o.push(E(x + dx, y + dy, 0.8, 1, GO, { ink: (g - 1) * 0.6 - 0.18 }));
    }
    o.push(E(B[0], B[1], 0.9, 1.1, GO, { ink: (g - 1) * 0.6 - 0.1 }));
    o.push(E(A[0], A[1], r0 * 1.25, r0 * 1, AN, { ink: ink - 0.12 })); // the burr
  };
  const fb = H.pt(6, -9.6), nb = H.pt(0.6, -8.6);
  beam(fb, [fb[0] + 14, fb[1] - 12], [fb[0] + 24, fb[1] - 33], [[0.1, 8, -3, 5, 0], [0.36, 9, -8, 6, -3], [0.6, 7, -10, 4, -6], [0.82, -4, -8, -2, -5]], 2.2, -0.2);

  // ---- the neck, out of the mist: the throat toward you, the mane down the back
  const [jx, jy] = H.pt(-2, 9.2), [nx, ny] = H.pt(11, 2);
  const low = [88, 76, 84, 82, 77, 80, 70, 85, 62, 81, 54, 84, 47, 79];
  o.push(P([jx - 1, jy - 2, nx - 2, ny, nx + 6, ny + 4, 76, 52, 84, 64, ...low, 47, 70, 49, 60], FW, { bv: 8, n: [0.1, 0, 1], ink: -0.08 })); // the neck
  o.push(K(jx + 2, jy + 2, 52, 74, 4, 6, FW, { ink: 0.06, occ: false })); // the throat, toward the light
  o.push(K(nx + 5, ny + 8, 84, 74, 2.6, 4.6, FW, { ink: -0.26, occ: false })); // the shadowed far side of the neck
  for (let i = 0; i < 4; i++) o.push(strand(nx + 3 + i * 3, ny + 3 + i * 7, nx + 10 + i * 3, ny + 10 + i * 7, nx + 9 + i * 3.4, ny + 16 + i * 7, 1.6, 0.5, FW, 3, { ink: -0.2 - i * 0.03 })); // the mane
  for (let i = 0; i < 4; i++) { // the ruff under the throat
    const y = jy + 3 + i * 4.4, x = jx - 2 - i * 0.6;
    o.push(strand(x + 5, y - 2, x + 1, y + 2, x + 0.4 + s * 0.3 * (i % 2), y + 8, 2, 0.5, FW, 3, { ink: 0.04 - i * 0.04 }));
  }
  // where the fetch thins out: the neck greys toward the night and goes down into a
  // bank of mist, and the mist is no paler than it is
  o.push(P([46, 76, 58, 74, 70, 70, 84, 70, 88, 80, 46, 84], 'scr_fylgjaFade', { ink: 0.36, n: [0, 0, 1], occ: false }));
  o.push(P([-1, 97, -1, 88, 97, 84, 97, 97], MI, { ink: -0.72 }));
  for (let i = 0; i < 9; i++) { // the bank's billows, one soft shape
    const mid = i > 3 && i < 8, x = 2 + i * 11.4 + Math.sin(f * 1.57 + i) * 1.2, y = 87 - (mid ? 5 : 0) + (i % 2) * 2.4;
    o.push(E(x, y, 8.4 + (i % 3), 5.4, MI, { fl: 1, ink: mid ? -0.5 : -0.58 }));
  }
  for (let i = 0; i < 5; i++) { // light on the billows' tops
    const x = 44 + i * 10 + Math.sin(f * 1.57 + i * 2) * 1.2, y = 80 + (i % 2) * 2.4;
    o.push(E(x, y, 4.4, 2, MI, { fl: 1, ink: -0.38 - (i % 2) * 0.05 }));
  }
  for (let i = 0; i < 3; i++) o.push(E(60 + i * 9 + s * (i % 2 ? -1 : 1), 75 - i * 3.6, 10 - i * 2, 1.2, MI, { fl: 1, ink: -0.46 - i * 0.06 })); // wisps lifting off it

  // ---- the head
  o.push(H.E(3, 0, 10.4, 9, FW, { fl: 0.2 })); // the skull
  o.push(H.P([-2, -7.2, -11, -5.6, -18, -3.2, -22, -1.2, -22.4, 2.4, -19, 4.6, -12, 6.2, -5, 8.8, 4, 8], FW, { bv: 4.4 })); // the face, tapering
  o.push(H.E(0, 4.4, 7, 5.4, FW, { fl: 0.75, ink: 0.02, occ: false })); // the cheek
  o.push(H.E(-17.6, 1.4, 4, 3.4, FW, { fl: 0.3, ink: 0.04, occ: false })); // the muzzle
  o.push(H.E(-19, 0.8, 1.4, 3.4, FW, { fl: 0.6, ink: 0.14, occ: false })); // the pale band behind the nose
  o.push(H.E(-16, 5.6, 3.2, 1.7, FW, { fl: 0.6, ink: -0.1, occ: false })); // the chin
  o.push(H.K(-3, -6.2, -17, -3, 2, 2.2, FW, { ink: 0.08, occ: false })); // the bridge, catching the light
  o.push(H.E(-10.4, 3, 4, 1.7, FW, { fl: 1, ink: -0.14, occ: false })); // the hollow under the eye
  // the nose and mouth
  o.push(H.E(-21.4, 0.6, 2.4, 3, NO), H.E(-22.4, 2.2, 0.9, 0.7, 'scr_fylgjaPupil', { ink: -0.3 }), H.E(-20.8, -1.2, 0.9, 0.5, NO, { ink: 0.3 }));
  o.push(H.K(-21, 4.2, -17, 5, 0.46, 0.46, NO, { ink: -0.1, occ: false }));
  // the eye: a deer's, large and dark, with a faint gold deep in it; the gland before it
  o.push(H.E(-6.6, -2.4, 3.6, 2.6, IN, { ink: -0.08 }));
  o.push(H.E(-6.6, -2.3, 2.7, 1.9, 'scr_fylgjaPupil'));
  o.push(H.E(-6.2, -2, 1.3, 1, 'scr_fylgjaEye', { ink: (g - 1) * 0.6 - 0.2 }));
  o.push(H.X(-7.4, -3.2, 0.7, 0.7, '#fff8e8', { em: true }));
  o.push(H.K(-9.6, -3.8, -3.8, -4.4, 0.5, 0.42, IN, { ink: -0.1 })); // the lid
  o.push(H.K(-10, -1.4, -13.4, 0.6, 0.7, 0.46, IN, { ink: -0.2, occ: false })); // the gland
  // the near ear, flat back, its pale inside toward you
  { const [x, y] = H.pt(8.4, -5); o.push(E(x + 8, y - 2, 8.8, 3.8, FW, { a: -0.34 + tw, ink: -0.04 }), E(x + 8.6, y - 1.6, 6.6, 2.3, IN, { a: -0.34 + tw, ink: 0.04 }), K(x + 3, y - 0.4, x + 13, y - 3.6 + tw * 9, 0.5, 0.46, FW, { ink: 0.12, occ: false })); }
  // the near antler, the bigger, spreading toward you
  beam(nb, [nb[0] - 18, nb[1] - 10], [nb[0] - 26, nb[1] - 34], [[0.08, -9, 2, -6, 2], [0.32, -10, -6, -6, -1], [0.56, -3, -11, -3, -6], [0.78, -9, -7, -5, -3]], 2.8, 0);
  // its breath on the cold
  { const [x, y] = H.pt(-22, 4.4); for (let i = 0; i < 3; i++) o.push(E(x - 2 - i * 2.2 - f * 0.5, y + 3 + i * 2.6, 1.8 + i * 0.8, 1 + i * 0.4, MI, { fl: 0.4, ink: -0.04 - i * 0.1 })); }
  // motes of the fetch rising
  for (let i = 0; i < 5; i++) {
    const x = 40 + hash2(i, 41) * 50, y = 94 - ((hash2(i, 43) * 50 + f * 2.4) % 50);
    o.push(X(x, y, 1, 1, '#e6eef4', { em: true }));
  }

  o.push(Lt(30, -6, 60, '#f4f0e4', 0.32 * g, 18));
  o.push(Lt(70, 40, 44, '#c8d8f0', 0.35, 16));
  return o;
}

// ===================================================================== NÄCKEN
// The fiddler of the falls, after Josephson: a naked youth, wet through, his head
// laid on the fiddle under his chin and the bow across it; his pale eyes have slid
// to you while he plays. Behind him the falls hang half frozen. The cold light
// rising off his pool is all the light there is. He never moves; only the bow does.
/** The fiddler of the falls, naked and wet, his head laid on the fiddle under his chin, the bow across it; his pale eyes slide to you while he plays, the falls behind him half frozen, the cold light of his pool rising from below. */
export function nackenPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const BG = 'scr_gNacken', SK = 'scr_nackenSkin', HR = 'scr_nackenHair', FD = 'scr_nackenFiddle', FK = 'scr_nackenFiddleDark', ST = 'scr_nackenString', IC = 'scr_nackenIce';
  const g = [1, 1.06, 0.95, 1.02][f % 4];

  // ---- the ground: the rock of the falls, sheets of water down it, ice at the lip
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 80, 70, 52, BG, { fl: 1, ink: BAND[2] }));
  for (const [x, w, ink] of [[6, 7, BAND[3]], [17, 3, BAND[2]], [27, 4, BAND[3] - 0.04], [70, 4, BAND[2]], [80, 8, BAND[3]], [92, 4, BAND[2]]]) {
    o.push(P([x - w / 2, 4, x + w / 2, 4, x + w / 2 + 1.4, 97, x - w / 2 + 1.4, 97], BG, { ink }));
    o.push(K(x - w / 4 + 0.4, 8 + ((f * 6 + x * 3) % 20), x - w / 4 + 0.7, 18 + ((f * 6 + x * 3) % 20), 0.5, 0.5, BG, { ink: BAND[4] })); // water running
  }
  o.push(P([-1, -1, 97, -1, 97, 5, 70, 6, 40, 4, -1, 6], IC, { ink: -0.56 })); // the frozen lip
  for (const [x, l, w] of [[4, 14, 2.4], [12, 9, 1.6], [24, 18, 2.6], [36, 8, 1.6], [64, 11, 2], [76, 20, 3], [88, 12, 2.2]]) o.push(P([x - w, 4, x + w, 4, x + 0.3, 4 + l], IC, { ink: -0.46 }));
  for (let i = 0; i < 4; i++) { // spray drifting up off the pool
    const x = 6 + hash2(i, 51) * 86, y = 96 - ((hash2(i, 53) * 40 + f * 2) % 40);
    o.push(X(x, y, 1, 1, '#cfeef6', { em: true }));
  }

  const by = -b * 0.4;
  // ---- the long wet hair behind, down over both shoulders
  const H = hf(38, 41 + by, 1.15, 0.24);
  o.push(H.P([-11, -6, -8, -13, 0, -15, 9, -13, 12, -5, 13, 8, 16, 22, 15, 34, 6, 30, 2, 18, -6, 18, -10, 30, -17, 32, -15, 16], HR, { bv: 2, ink: -0.24 }));

  // ---- shoulders and chest, wet: lean, a youth's
  o.push(P([6, 97, 7, 82, 11, 74, 20, 69 + by, 30, 66 + by, 44, 66 + by, 56, 68, 66, 72, 72, 80, 74, 97], 'scr_nackenBody', { bv: 3, n: [0, 0.3, 1], ink: -0.2 }));
  o.push(K(36, 50 + by, 38, 65 + by, 5, 6.2, SK, { ink: -0.14 })); // the neck
  o.push(K(31, 60 + by, 33, 68, 0.9, 0.6, SK, { ink: 0.04, occ: false })); // its cord, lifted by the turn
  o.push(K(18, 70, 34, 68.6, 1, 0.8, 'scr_nackenBody', { ink: 0.12, occ: false }), K(42, 68.6, 58, 70, 0.8, 1, 'scr_nackenBody', { ink: 0.08, occ: false })); // the collarbones
  o.push(K(15, 88, 31, 91, 0.7, 0.5, 'scr_nackenBody', { ink: -0.2, occ: false }), K(43, 91, 57, 88, 0.5, 0.7, 'scr_nackenBody', { ink: -0.24, occ: false })); // the lower edge of the chest
  o.push(K(37, 78, 37, 97, 0.5, 0.7, 'scr_nackenBody', { ink: -0.2, occ: false })); // the line of the breastbone

  // ---- the head, laid over on the fiddle
  o.push(H.E(0, 0, 9, 11.6, SK, { fl: 0.25 }));
  o.push(H.E(0.6, 6, 7, 5.6, SK, { fl: 0.35, occ: false })); // the jaw
  o.push(H.E(1, 10.4, 3, 2, SK, { fl: 0.4, ink: 0.04, occ: false })); // the chin
  o.push(H.E(-4.8, 2.4, 3, 2.4, SK, { fl: 0.6, ink: 0.04, occ: false }), H.E(5.4, 2.4, 2.6, 2.4, SK, { fl: 0.6, ink: 0.02, occ: false })); // cheekbones
  o.push(H.E(-4.4, 5.6, 2.6, 2, SK, { fl: 1, ink: -0.14, occ: false }), H.E(5.2, 5.6, 2.2, 2, SK, { fl: 1, ink: -0.14, occ: false })); // hollows under them
  // the eyes: deep, pale, the pupils pinpricks slid toward you
  const ey = -0.6;
  for (const [x, w] of [[-3.6, 2.4], [4.2, 2.2]]) {
    o.push(H.E(x, ey, w + 0.8, 1.9, SK, { fl: 1, ink: -0.34, occ: false }));
    o.push(H.E(x, ey + 0.1, w, 1.1, 'scr_nackenEye', { ink: (g - 1) * 0.5 - 0.06 }));
    o.push(H.X(x - w * 0.5, ey + 0.1, 0.8, 0.9, '#1a2426'));
    o.push(H.K(x - w - 0.4, ey - 0.9, x + w + 0.4, ey - 1.1, 0.42, 0.36, HR, { occ: false })); // the lid
  }
  o.push(H.K(-6.6, -3.8, -1, -3.2, 1.2, 0.9, SK, { ink: 0.06, occ: false }), H.K(1.6, -3.2, 7, -3.8, 0.9, 0.8, SK, { ink: 0.02, occ: false })); // the brows
  o.push(H.K(-6.4, -4.4, -1.6, -4.4, 0.45, 0.44, HR, { occ: false }), H.K(1.8, -4.4, 6.4, -4.6, 0.44, 0.44, HR, { occ: false }));
  // the nose, long and straight; a thin smile that is not for you
  o.push(H.K(0.4, -2, 0.8, 4.2, 1, 1.5, SK, { ink: 0.06, occ: false }));
  o.push(H.E(0.8, 4.8, 1.7, 1.2, SK, { ink: 0.04, occ: false }), H.X(-0.4, 5.6, 1, 0.9, SK + ':1'), H.X(2, 5.6, 1, 0.9, SK + ':1'));
  o.push(H.K(-2.8, 8, 3.6, 8, 0.44, 0.44, 'scr_nackenMouth', { ink: 0.2 }), H.K(-2.8, 8, -3.8, 7.2, 0.44, 0.44, 'scr_nackenMouth', { ink: 0.2 }));
  o.push(H.E(0.6, 9.2, 2.2, 0.7, SK, { ink: 0.06, occ: false })); // the lower lip
  // wet hair plastered over the brow and down the face, a strand of weed in it
  o.push(H.P([-10, -4, -8, -11, -2, -13.6, 5, -13.4, 10, -9, 11, -2, 9, -6, 5, -7.6, 1, -6, -3, -8, -7, -6.4], HR, { bv: 1.6 }));
  for (const [x0, y0, x1, y1, x2, y2] of [[-9, -4, -10.6, 6, -9.4, 18], [-7, -6, -7.6, 4, -7, 12], [10, -2, 11, 8, 10, 20]]) o.push(H.S(x0, y0, x1, y1, x2, y2, 1.3, 0.45, HR, 4));
  o.push(H.S(-6, -10, -12, -2, -11.6, 12, 0.7, 0.45, 'scr_nackenWeed', 4, { ink: -0.22 }), H.S(9, -8, 13, 0, 12, 12, 0.6, 0.4, 'scr_nackenWeed', 4, { ink: -0.3 }));

  // ---- the fiddle on his shoulder, under his chin, its neck up to the right
  const cx = 56, cy = 54, a = -0.5, ca = Math.cos(a), sa = Math.sin(a);
  const L = (u: number, v: number): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const fe = (u: number, v: number, rx: number, ry: number, m: string, op: PrimOptions = {}) => { const [x, y] = L(u, v); return E(x, y, rx, ry, m, { ...op, a: (op.a || 0) + a }); };
  const fk = (u1: number, v1: number, u2: number, v2: number, r1: number, r2: number, m: string, op?: PrimOptions) => { const p = L(u1, v1), q = L(u2, v2); return K(p[0], p[1], q[0], q[1], r1, r2, m, op); };
  o.push(K(62, 70, 58, 63, 6, 5, 'scr_nackenBody', { ink: -0.06 })); // his left shoulder, under it
  o.push(K(60, 94, L(32, 3)[0], L(32, 3)[1] + 2, 5.8, 3.4, 'scr_nackenBody', { ink: -0.12 })); // the forearm up to the neck
  o.push(K(64.4, 95, L(32, 3)[0] + 2.4, L(32, 3)[1] + 3, 2.4, 1.2, 'scr_nackenBody', { ink: -0.34, occ: false }));
  o.push(fe(-9, 0, 10.4, 9.2, FD), fe(7, 0, 8.2, 7.4, FD), fe(-1, 0, 4.4, 6.4, FD));
  o.push(fe(-1, -5.6, 2, 1.4, FD, { ink: -0.34 }), fe(-1, 5.6, 2, 1.4, FD, { ink: -0.34 })); // the waist
  o.push(fe(-10, 0, 7, 6, FD, { fl: 0.7, ink: 0.06, occ: false })); // the belly of the lower bout
  o.push(fk(-4, -3, 1, -3.4, 0.4, 0.4, FK), fk(-4, 3, 1, 3.4, 0.4, 0.4, FK)); // f-holes
  o.push(fk(-18, 0, -12, 0, 1.4, 1.2, FK)); // the tailpiece
  o.push(fk(-1, 0, 40, 0, 1.8, 1.4, FK)); // fingerboard and neck
  o.push(fe(43, 0, 2.6, 2.2, FD), fe(43.4, -0.4, 1.2, 1, FK)); // the scroll
  o.push(fk(-14, 0, 40, 0, 0.55, 0.45, ST, { occ: false, ink: -0.12 })); // the strings
  o.push(fk(-6, -3, -6, 3, 0.45, 0.45, ST)); // the bridge
  o.push(H.E(1.6, 10, 3.6, 2.2, SK, { fl: 0.5, ink: -0.04 })); // his jaw, laid on it
  // the fingering hand, long fingers over the neck, and the forearm out of frame
  { const [x, y] = L(32, 2.6); o.push(E(x, y + 1, 3.6, 3.2, SK)); for (let i = 0; i < 4; i++) o.push(fk(28.6 + i * 2.3, -0.6, 29.6 + i * 2.3, -4.6, 0.95, 0.75, SK, { ink: 0.04 })); }
  // ---- the bow: from his right hand, across the strings by the bridge, sliding
  const bs = s * 0.6, du = 0.966, dv = 0.26;
  const fx = 12 + bs * du, fy = 52 + bs * dv;
  o.push(K(-4, 80, fx - 1, fy + 3, 5.8, 3.6, 'scr_nackenBody', { ink: -0.08 })); // the bow arm
  o.push(K(-4, 84.4, fx - 0.4, fy + 5.6, 2.4, 1.2, 'scr_nackenBody', { ink: -0.3, occ: false })); // its underside
  o.push(K(fx, fy, fx + du * 78, fy + dv * 78, 0.7, 0.5, FK)); // the stick
  o.push(K(fx + 1, fy + 1.6, fx + 1 + du * 76, fy + 1.6 + dv * 76, 0.5, 0.5, ST, { occ: false })); // the hair
  o.push(K(fx - 1, fy - 0.2, fx + 3, fy + 1, 1.2, 1.2, FK)); // the frog
  o.push(E(fx + 1, fy + 2, 3.8, 3.2, SK));
  for (let i = 0; i < 3; i++) o.push(K(fx - 1.4 + i * 2, fy - 0.8 + i * 0.6, fx - 0.6 + i * 2.2, fy + 3.6, 0.9, 0.75, SK, { ink: 0.04 }));
  // water running off him
  { const [x, y] = H.pt(-10, 30); o.push(X(x, y + ((f * 2.4) % 8), 1, 1.4, '#cfeef6', { em: true })); }
  { const [x, y] = H.pt(15, 34); o.push(X(x, y + (((f + 2) * 2.4) % 8), 1, 1.4, '#cfeef6', { em: true })); }

  // the pool's cold light, from below; a little off his eyes
  o.push(Lt(44, 108, 74, '#8fe0f4', 0.36 * g, 16));
  { const [x, y] = H.pt(0, ey); o.push(Lt(x, y, 12, '#d8f6ee', 0.25 * g, 4)); }
  return o;
}
