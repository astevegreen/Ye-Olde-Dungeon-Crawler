import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9f, group B: the Vengeful Nisse, the Skratti and the Slag Amorphous (three creatures, three models). Conventions: portraitKit.ts. */

/** A polyline of capsules through pts [[x, y], ...], radius r0 -> r1. */
function line(pts: Pt[], r0: number, r1: number, m: string, o: PrimOptions = {}): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    out.push(K(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, m, o));
  }
  return out;
}

// ===================================================================== NISSE
/**
 * The farm's hearth-spirit, wronged once too often. An old, old little man, hunched in
 * grey wool under the red cap flopped back, his long grey beard full of byre-straw; he
 * holds his horn-paned lantern out at you like a threat, and its ember light, from below,
 * finds a face knotted in a scowl, the lip drawn back off worn teeth and the eyes shining
 * in the dark like a cat's. Four fingers on the hand that grips the bail.
 */
export function nissePortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.12, 0.9, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gNisse', HL = 'scr_nisseHalo', WO = 'scr_nisseWool', WD = 'scr_nisseWoolDark', CP = 'scr_nisseCap';
  const SK = 'scr_nisseSkin', NO = 'scr_nisseNose', BD = 'scr_nisseBeard', MW = 'scr_nisseMaw', TE = 'scr_nisseTooth', IR = 'scr_nisseIron', ST = 'scr_nisseStraw';
  const lx = 78 + s * 0.3, ly = 66; // the lantern
  // the byre at night: the loft beam and two posts, straw hanging from the loft
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 40, 60, 54, BG, { fl: 1, ink: BAND[2] }));
  o.push(P([-1, 7, 97, 3, 97, 11, -1, 15], BG, { ink: BAND[1] }));
  o.push(P([3, -1, 11, -1, 12, 97, 4, 97], BG, { ink: BAND[1] }), P([88, -1, 95, -1, 95, 97, 88, 97], BG, { ink: BAND[1] }));
  for (let i = 0; i < 7; i++) {
    const x = 16 + i * 10 + hash2(i, 5) * 6, len = 5 + hash2(i, 7) * 8, y0 = 13.6 - x * 0.04;
    o.push(K(x, y0, x + (hash2(i, 9) - 0.5) * 4 + s * 0.2, y0 + len, 0.55, 0.4, BG, { ink: BAND[3] - 0.06 }));
  }
  // the lantern's halo
  o.push(E(lx, ly, 28, 26, HL, { fl: 1, ink: BAND[1] }), E(lx, ly, 17, 16, HL, { fl: 1, ink: BAND[2] }), E(lx, ly, 10, 10, HL, { fl: 1, ink: BAND[3] }));

  const by = -b * 0.5;
  const hx = 49, hy = 45 + by;
  // the hunched back and shoulders in grey wool, the head sunk forward between them
  o.push(P([-2, 97, -2, 72, 6, 62, 18, 57 + by, 30, 60 + by, 40, 66 + by, 58, 70 + by, 72, 72, 84, 78, 96, 88, 98, 97], WO, { bv: 6, n: [0, -0.1, 1], ink: -0.2 }));
  o.push(K(8, 66, 30, 64 + by, 0.8, 0.8, WD, { ink: -0.3, occ: false }), K(4, 80, 26, 76, 0.8, 0.8, WD, { ink: -0.4, occ: false })); // folds in the wool
  o.push(E(hx + 2, hy + 24, 21, 8, WD, { fl: 0.3, ink: -0.1 })); // the rough collar
  // the cap's tip, flopped back over the left and hanging down behind
  o.push(strand(hx - 2, hy - 22, hx - 24, hy - 34, hx - 30, hy - 13 + s * 0.2, 6.2, 2.6, CP, 6, { ink: -0.14 }));
  o.push(E(hx - 30, hy - 12 + s * 0.2, 2.8, 2.6, CP, { ink: -0.2 }));
  // grey hair bristling from under the cap at the back
  o.push(P([hx - 9, hy - 7, hx - 15, hy - 6, hx - 18, hy, hx - 16, hy + 3, hx - 19, hy + 7, hx - 14, hy + 9, hx - 15, hy + 13, hx - 9, hy + 10], BD, { bv: 1.2, ink: -0.26 }));
  // the head
  o.push(E(hx, hy, 13, 14, SK, { fl: 0.15 }));
  o.push(E(hx + 4, hy + 6, 10.5, 9, SK, { fl: 0.2 }));
  o.push(E(hx - 7, hy - 0.5, 4, 6, SK, { fl: 0.6, ink: -0.22 })); // the temple, turned away
  // a big old man's ear
  o.push(E(hx - 11.4, hy + 2, 3.8, 5.6, SK, { a: -0.2, ink: -0.06 }));
  o.push(E(hx - 11, hy + 2.4, 2, 3.4, SK, { a: -0.2, fl: 0.8, ink: -0.45 }));
  // the long beard, matted, falling over the chest, darkening as it falls
  o.push(P([hx - 9, hy + 4, hx - 4, hy + 12, hx + 2, hy + 18.6, hx + 12, hy + 18, hx + 16, hy + 13, hx + 18, hy + 19, hx + 17, hy + 29, hx + 13 + s * 0.3, hy + 39, hx + 8 + s * 0.4, hy + 48, hx + 4 + s * 0.4, hy + 52, hx + 1 + s * 0.3, hy + 45, hx - 4 + s * 0.3, hy + 49, hx - 6, hy + 38, hx - 11, hy + 26, hx - 12, hy + 14], BD, { bv: 4, ink: -0.08 }));
  o.push(P([hx - 10, hy + 30, hx + 16, hy + 30, hx + 13 + s * 0.3, hy + 39, hx + 8 + s * 0.4, hy + 48, hx + 4 + s * 0.4, hy + 52, hx + 1 + s * 0.3, hy + 45, hx - 4 + s * 0.3, hy + 49, hx - 6, hy + 38], BD, { bv: 3, ink: -0.24, occ: false }));
  for (const [x0, y0, x1, y1, x2, y2] of [[-4, 22, -7, 32, -4, 43], [6, 24, 10, 33, 6, 45]]) o.push(strand(hx + x0, hy + y0, hx + x1 + s * 0.2, hy + y1, hx + x2 + s * 0.4, hy + y2, 0.5, 0.3, BD, 4, { ink: -0.4, occ: false })); // dark partings between the locks
  const locks = [[-8, 14, -10, 25, -7, 36, -0.12], [-2, 18, 0, 30, -1, 41, 0.04], [3, 20, 4, 34, 3, 49, -0.06], [11, 19, 14, 28, 12, 38, -0.18]];
  for (const [x0, y0, x1, y1, x2, y2, ink] of locks) o.push(strand(hx + x0, hy + y0, hx + x1 + s * 0.2, hy + y1, hx + x2 + s * 0.4, hy + y2, 1.4, 0.4, BD, 4, { ink, occ: false }));
  // straw caught in it
  for (const [x0, y0, x1, y1] of [[-6, 30, 2, 27], [8, 36, 15, 40], [0, 42, -6, 47]]) o.push(K(hx + x0, hy + y0, hx + x1, hy + y1, 0.5, 0.45, ST, { ink: -0.1, occ: false }));
  // the cap: worn red wool, pulled low on the brow, its rolled brim
  o.push(P([hx - 15, hy - 4, hx - 14, hy - 14, hx - 8, hy - 22, hx + 2, hy - 26, hx + 10, hy - 23, hx + 15, hy - 15, hx + 15.5, hy - 8], CP, { bv: 5, ink: -0.14 }));
  o.push(K(hx - 4, hy - 21, hx - 10, hy - 26, 1, 0.6, CP, { ink: -0.34, occ: false })); // the crease where it folds back
  o.push(strand(hx - 15, hy - 4, hx, hy - 7, hx + 15.5, hy - 9, 2.6, 2.4, CP, 5, { ink: -0.06 }));
  // the brow, the scowl: bushy grey brows driven down to the nose
  o.push(K(hx - 7, hy - 2.4, hx + 13, hy - 2.6, 2.4, 2, SK, { ink: 0.04 }));
  o.push(K(hx + 6, hy - 4.6, hx + 7, hy - 1.2, 0.4, 0.4, SK, { ink: -0.36, occ: false })); // the furrow between
  // deep sockets; the eyes catching the light like a cat's
  o.push(E(hx + 2, hy + 0.8, 3.8, 2.6, SK, { fl: 0.85, ink: -0.62 }));
  o.push(E(hx + 12, hy + 0.6, 2.1, 2.1, SK, { fl: 0.85, ink: -0.62 }));
  const ei = (fl - 1) * 0.3;
  o.push(E(hx + 2.6, hy + 1.1, 2, 1.15, 'emFire', { ink: ei }), E(hx + 12.2, hy + 1, 1.15, 0.95, 'emFire', { ink: ei }));
  o.push(E(hx + 2.8, hy + 1.2, 0.9, 0.6, 'emFireCore', { ink: ei }));
  o.push(X(hx + 3.2, hy + 0.5, 0.8, 0.7, '#fff0d0', { em: true }));
  o.push(strand(hx - 7, hy - 5.6, hx, hy - 4.6, hx + 6.6, hy - 1.4, 1.9, 1.4, BD, 4, { ink: 0.06 }));
  o.push(strand(hx + 9.6, hy - 1.6, hx + 12, hy - 4, hx + 15.6, hy - 4.6, 1.4, 1, BD, 3, { ink: -0.04 }));
  for (const [x0, y0, x1, y1] of [[-5, -6, -8, -9], [-1, -5.4, -2, -9], [3, -4.2, 4.6, -7.6]]) o.push(K(hx + x0, hy + y0, hx + x1, hy + y1, 0.7, 0.35, BD, { ink: 0.02 })); // tufts bristling
  o.push(K(hx - 1, hy + 3.6, hx + 5.4, hy + 3.8, 0.55, 0.5, SK, { ink: -0.3, occ: false })); // the bag under the eye
  o.push(E(hx + 1, hy + 6, 5, 2.4, SK, { fl: 0.4, ink: 0.08 })); // the cheekbone
  for (let i = 0; i < 3; i++) o.push(K(hx - 5.6, hy + 1 + i * 1.6, hx - 3, hy + 1.6 + i * 1.4, 0.35, 0.35, SK, { ink: -0.34, occ: false })); // crow's feet
  // the nose: a big red bulb of a nose
  o.push(K(hx + 7.8, hy - 0.4, hx + 12.4, hy + 5, 1.8, 2.8, NO, { ink: -0.02 }));
  o.push(E(hx + 13.4, hy + 7.6, 4.6, 4.2, NO));
  o.push(E(hx + 10.2, hy + 9.4, 2.4, 2, NO, { ink: -0.08 }));
  o.push(E(hx + 12, hy + 10.8, 1.3, 0.7, MW));
  o.push(E(hx + 15.2, hy + 5.4, 0.9, 0.8, NO, { ink: 0.12 }));
  // the snarl: the lip drawn back off a few worn teeth under the moustache
  o.push(P([hx + 1, hy + 15, hx + 12.6, hy + 13.6, hx + 13.4, hy + 17, hx + 3, hy + 18.4], MW));
  for (const [x, y, w, h] of [[3.6, 15, 1.5, 1.9], [6.4, 14.6, 1.5, 2.2], [10.2, 14.2, 1.3, 1.7], [8, 17, 1.3, 1.2]]) o.push(X(hx + x, hy + y, w, h, TE + ':' + (y > 16 ? 2 : 4)));
  o.push(K(hx + 2.4, hy + 18.6, hx + 12.4, hy + 17.6, 0.9, 0.8, NO, { ink: -0.14 })); // the lower lip
  o.push(strand(hx + 10, hy + 10.6, hx + 4, hy + 11, hx - 1, hy + 16 + s * 0.2, 2.2, 0.9, BD, 4, { ink: 0.04 })); // moustache
  o.push(strand(hx + 12.6, hy + 11, hx + 16, hy + 12, hx + 17, hy + 17 + s * 0.2, 1.8, 0.8, BD, 3, { ink: -0.04 }));

  // the lantern arm: a grey sleeve from the far shoulder, a four-fingered fist on the bail
  o.push(K(98, 99, 92, 80, 8, 6.4, WD, { ink: -0.12 }));
  o.push(K(92, 80, lx + 4, ly - 17, 5.4, 4.2, WD, { ink: -0.04 }));
  o.push(K(lx + 6, ly - 13, lx + 4.4, ly - 18, 3.4, 3.4, WO, { ink: -0.1 })); // the cuff
  o.push(strand(lx - 5.4, ly - 9.6, lx - 1, ly - 19, lx + 5.4, ly - 9.6, 0.65, 0.65, IR, 4)); // the bail
  o.push(E(lx + 2.4, ly - 17.4, 3.6, 3.2, SK, { ink: -0.04 }));
  for (let i = 0; i < 4; i++) {
    const y = ly - 20 + i * 1.9;
    o.push(K(lx + 2, y, lx - 2.2, y + 0.4, 1.05, 0.95, SK, { ink: i % 2 ? -0.06 : 0.02 }));
    o.push(E(lx - 2.4, y + 0.4, 0.8, 0.8, 'scr_nisseNail'));
  }
  o.push(K(lx + 1, ly - 20.8, lx - 1.8, ly - 20.4, 1.1, 0.9, SK, { ink: 0.08 })); // the thumb
  // the lantern: an iron frame, panes of scraped horn, the flame inside
  o.push(P([lx - 7.6, ly - 7, lx + 7.6, ly - 7, lx + 4, ly - 11.4, lx - 4, ly - 11.4], IR, { bv: 1.2 }));
  o.push(P([lx - 6.6, ly - 7, lx + 6.6, ly - 7, lx + 6.6, ly + 7.6, lx - 6.6, ly + 7.6], 'scr_nissePane', { ink: -0.2 + (fl - 1) * 0.4 }));
  o.push(E(lx, ly + 2, 4.4, 5, 'scr_nissePane', { ink: 0.04 + (fl - 1) * 0.4 })); // the glow through the horn, brightest at the flame
  const fw = [0, 0.6, -0.5, 0.2][f % 4], fh = [7.4, 8.2, 6.6, 7.8][f % 4];
  o.push(P([lx - 2.2, ly + 4, lx - 1.6, ly + 1.2, lx + fw, ly + 4 - fh, lx + 1.6, ly + 1.2, lx + 2.2, ly + 4, lx, ly + 5.6], 'emFireCore'));
  for (const x of [-6.6, 0, 6.6]) o.push(K(lx + x, ly - 7, lx + x, ly + 7.6, x ? 0.95 : 0.55, x ? 0.95 : 0.55, IR));
  o.push(K(lx - 6.8, ly + 0.4, lx + 6.8, ly + 0.4, 0.5, 0.5, IR, { ink: -0.1 }));
  o.push(P([lx - 7.6, ly + 7.4, lx + 7.6, ly + 7.4, lx + 6.4, ly + 10.2, lx - 6.4, ly + 10.2], IR, { bv: 0.9 }));
  // light: the lantern, from below and to the right
  o.push(Lt(lx - 3, ly - 3, 70, '#ff9a3c', 1.05 * fl, 14));
  return o;
}

// =================================================================== SKRATTI
/**
 * A bat's ear: a tall leaf of skin from the root (front F, back B) to the tip T,
 * bowed out at both edges, a torn notch in its back edge, the membrane darker
 * inside and ridged across. sd = -1 for the left ear, 1 for the right.
 */
function batEar(F: Pt, B: Pt, T: Pt, sd: number, k: number, ink: number): Prim[] {
  const SK = 'scr_skrattiSkin', EA = 'scr_skrattiEar', out: Prim[] = [];
  const mid = (a: Pt, c: Pt): Pt => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const bow = (a: Pt, c: Pt, d: number): Pt => { const m = mid(a, c), l = Math.hypot(c[0] - a[0], c[1] - a[1]); return [m[0] + ((c[1] - a[1]) / l) * d, m[1] - ((c[0] - a[0]) / l) * d]; };
  const edge = (a: Pt, c: Pt, d: number, n: number, skip: boolean) => { const pts: Array<[number, number, number, number]> = []; const cc = bow(a, c, d); for (let i = skip ? 1 : 0; i <= n; i++) pts.push(qpt(a, cc, c, i / n)); return pts; };
  const outline = (f0: Pt, b0: Pt, t0: Pt, df: number, db: number, notch: boolean): number[] => {
    const fr = edge(f0, t0, df * sd, 8, false), bk = edge(t0, b0, db * sd, 8, true), pts: number[] = [];
    fr.forEach(([x, y]) => pts.push(x, y));
    bk.forEach(([x, y], i) => {
      if (notch && i === 3) { const c = mid(t0, b0); pts.push(x + (c[0] - x) * 0.16 + (b0[0] - t0[0]) * 0.03, y + (c[1] - y) * 0.16 + 1.6); }
      pts.push(x, y);
    });
    return pts;
  };
  out.push(P(outline(F, B, T, 5 * k, 9 * k, true), SK, { bv: 1.6, ink }));
  const inset = (p: Pt, c: Pt, t: number): Pt => [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t];
  const cen: Pt = [(F[0] + B[0] + T[0]) / 3, (F[1] + B[1] + T[1]) / 3];
  const F2 = inset(F, cen, 0.2), B2 = inset(B, cen, 0.2), T2 = inset(T, cen, 0.14);
  out.push(P(outline(F2, B2, T2, 3.6 * k, 6.6 * k, false), EA, { bv: 2.4, ink: ink - 0.06 }));
  // the hollow at the root, where it opens into the head
  const R = mid(F2, B2);
  out.push(E(R[0] + (T[0] - R[0]) * 0.12, R[1] + (T[1] - R[1]) * 0.12, 3.4 * k, 6 * k, EA, { a: Math.atan2(T[1] - R[1], T[0] - R[0]) + Math.PI / 2, fl: 0.6, ink: ink - 0.4 }));
  // ridges across the membrane
  const ax = T2[0] - R[0], ay = T2[1] - R[1], al = Math.hypot(ax, ay), px = -ay / al, py = ax / al;
  for (const [t, w] of [[0.3, 5.4], [0.46, 5], [0.62, 4.2], [0.77, 3]]) {
    const cx = R[0] + ax * t, cy = R[1] + ay * t, ww = w * k;
    out.push(K(cx - px * ww, cy - py * ww, cx + px * ww + ax * 0.03, cy + py * ww + ay * 0.03, 0.55, 0.45, EA, { ink: ink + 0.12, occ: false }));
  }
  return out;
}

/**
 * A frost imp of the Rime Hollows, all ears and grin: the skratti is the cackler
 * (skratta, to laugh), and it is laughing at you. Bat ears flared up into the dark,
 * a mouth split ear to ear on needles of ice, eyes narrowed to cold slits of light;
 * frost spines bristle on its back and one ice-clawed hand comes up to scratch. Its own
 * eyes are the light on it.
 */
export function skrattiPortrait(f: number): PrimTree {
  const b = breath(f);
  const g = [1, 0.86, 1.14, 0.94][f % 4];
  const o: Out = [];
  const BG = 'scr_gSkratti', SK = 'scr_skrattiSkin', SO = 'scr_skrattiSocket', MW = 'scr_skrattiMaw', TE = 'scr_skrattiTooth', IC = 'scr_skrattiIce';
  // the Rime Hollows: an ice ceiling hung with icicles, rime drifting down
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 50, 62, 52, BG, { fl: 1, ink: BAND[2] }));
  const ice: number[] = [-1, -1];
  for (let x = -1, i = 0; x < 98; i++) {
    const w = 4 + hash2(i, 31) * 5, d = 3 + hash2(i, 33) * (i % 3 ? 6 : 14);
    ice.push(x, 3 + hash2(i, 35) * 2, x + w * 0.5, 3 + d, x + w, 3 + hash2(i, 37) * 2);
    x += w;
  }
  ice.push(97, -1);
  o.push(P(ice, BG, { ink: BAND[3] - 0.04 }));
  for (let i = 0; i < 10; i++) {
    const x = 4 + hash2(i, 41) * 88, y = (hash2(i, 43) * 90 + f * 3 + i) % 92 + 4;
    o.push(X(x, y, 0.8, 0.8, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
  }

  const by = -b * 0.5;
  const hx = 48, hy = 52 + by;
  // frost spines bristling up off the back, behind the shoulders
  for (const [x0, y0, x1, y1, tx, ty] of [[15, 88, 21, 81, 5, 68], [22, 80, 29, 77, 15, 60], [30, 77, 36, 76, 28, 62], [62, 76, 68, 77, 75, 60], [72, 80, 79, 86, 89, 68]]) {
    o.push(P([x0, y0 + by, x1, y1 + by, tx, ty + by], IC, { bv: 1.2, ink: -0.16 }));
  }
  // the ears: great bat ears flared up into the dark, ridged, one torn
  const et = [0, 0, 0.9, 0.3][f % 4]; // the near ear flicks
  o.push(batEar([hx - 5, hy - 15], [hx - 12, hy - 2], [hx - 38 - et, hy - 47 + et * 0.6], -1, 1, 0));
  o.push(batEar([hx + 5, hy - 15.4], [hx + 12, hy - 3], [hx + 37, hy - 48], 1, 0.9, -0.08));
  // a scrawny neck and bony shoulders hunched up round it, the ribs showing
  const HD = 'scr_skrattiHide';
  o.push(P([10, 97, 14, 88, 19, 82, 27, 77 + by, 35, 75 + by, 42, 77 + by, 48, 79 + by, 54, 77 + by, 61, 75 + by, 69, 77 + by, 77, 82, 82, 88, 86, 97], HD, { bv: 5, ink: -0.2 }));
  o.push(E(48, 97, 15, 12, HD, { ink: -0.22 })); // the narrow chest
  o.push(E(25, 82 + by, 10, 6.4, HD, { a: -0.55, ink: 0.02 }), E(71, 82 + by, 10, 6.4, HD, { a: 0.55, ink: -0.06 })); // knobs of shoulder
  o.push(K(72, 84 + by, 88, 98, 4.4, 4.8, HD, { ink: -0.12 })); // the upper arm, down to the elbow
  o.push(K(hx - 1, hy + 12, hx - 2, hy + 24, 3.6, 4.6, HD, { ink: -0.04 }));
  o.push(K(hx - 5.6, hy + 11, hx - 2.4, hy + 25, 0.9, 0.8, HD, { ink: 0.12 }), K(hx + 4.4, hy + 11, hx - 0.6, hy + 25, 0.9, 0.8, HD, { ink: 0.06 })); // its tendons
  o.push(K(30, 75 + by, 45, 80 + by, 1.3, 0.9, HD, { ink: 0.14 }), K(66, 75 + by, 51, 80 + by, 1.3, 0.9, HD, { ink: 0.08 })); // collarbones
  for (let i = 0; i < 3; i++) {
    o.push(K(36 - i * 2, 86 + i * 4, 45, 88 + i * 4, 0.6, 0.5, HD, { ink: -0.6, occ: false }));
    o.push(K(60 + i * 2, 86 + i * 4, 51, 88 + i * 4, 0.6, 0.5, HD, { ink: -0.6, occ: false }));
  }
  // the head: a narrow skull, gaunt at the temples, the face run to a point at the chin
  o.push(E(hx, hy - 5, 12, 11, SK, { fl: 0.15 }));
  o.push(E(hx + 1, hy + 5, 11.6, 9.4, SK, { fl: 0.2 }));
  o.push(K(hx + 1, hy + 10, hx + 1.4, hy + 18.4, 4.6, 1.6, SK, { ink: -0.04 }));
  o.push(E(hx - 10.6, hy - 4, 2.2, 4, SK, { fl: 0.6, ink: -0.2 }), E(hx + 11.4, hy - 4.4, 2, 3.6, SK, { fl: 0.6, ink: -0.26 }));
  for (const [x, y, l] of [[-5, -14, -21], [0.6, -15.6, -24], [6, -14.6, -21]]) o.push(P([hx + x - 1.6, hy + y + 1, hx + x + 1.6, hy + y + 1, hx + x * 1.3, hy + l], IC, { bv: 0.8 })); // ice spines on the crown
  o.push(E(hx - 8, hy + 2.4, 4.6, 3.4, SK, { fl: 0.4, ink: 0.06 }), E(hx + 9.4, hy + 2, 4.2, 3.2, SK, { fl: 0.4, ink: 0.02 })); // cheeks pushed up by the grin
  // the eyes: slits narrowed in glee, cold light in them
  for (const [ex, ey, a, rx] of [[hx - 6, hy - 3.2, 0.36, 3.5], [hx + 7.2, hy - 3.4, -0.36, 3.1]]) {
    o.push(E(ex, ey, rx + 1.1, 2.4, SO, { a }));
    o.push(E(ex, ey + 0.1, rx, 1.35, 'emFrost', { a, ink: (g - 1) * 0.4 }));
    o.push(X(ex - 0.4, ey - 1.1, 0.8, 2.2, '#0c1a28'));
    o.push(X(ex - 1.6, ey - 0.8, 0.7, 0.6, '#f2fcff', { em: true }));
  }
  o.push(K(hx - 12.8, hy - 8.4, hx - 1.4, hy - 5, 1.8, 1.4, SK, { ink: 0.1 }), K(hx + 1.6, hy - 5, hx + 13.2, hy - 9, 1.4, 1.7, SK, { ink: 0.04 })); // the brows, driven down
  o.push(K(hx + 0.1, hy - 6, hx + 0.1, hy - 11, 0.4, 0.4, SK, { ink: -0.36, occ: false }));
  // a bat's snub nose
  o.push(K(hx + 0.6, hy - 2.6, hx + 1, hy + 0.8, 1.2, 1.7, SK, { ink: 0.1 }));
  o.push(E(hx + 1, hy + 1.6, 2.7, 1.9, SK, { ink: 0.06 }));
  o.push(X(hx - 0.8, hy + 2, 1, 0.8, '#10202e'), X(hx + 2, hy + 2, 1, 0.8, '#10202e'));
  // the grin, split from ear to ear, full of needles of ice
  const ua: Pt = [hx - 12.6, hy + 3.4], uc: Pt = [hx + 1, hy + 10], ub: Pt = [hx + 14, hy + 2.6], lc: Pt = [hx + 1, hy + 19.4];
  const mouth: number[] = [];
  for (let i = 0; i <= 10; i++) { const [x, y] = qpt(ua, uc, ub, i / 10); mouth.push(x, y); }
  for (let i = 9; i >= 1; i--) { const [x, y] = qpt(ua, lc, ub, i / 10); mouth.push(x, y); }
  o.push(P(mouth, MW, { ink: -0.4 }));
  for (let i = 1; i <= 9; i++) {
    const [x, y] = qpt(ua, uc, ub, i / 10), len = 2.2 + (1 - Math.abs(i - 5) / 5) * 1.4;
    o.push(P([x - 0.8, y - 0.4, x + 0.8, y - 0.4, x + 0.1, y + len], TE, { bv: 0.4 }));
  }
  for (let i = 1; i <= 8; i++) {
    const t = (i + 0.5) / 10, [x, y] = qpt(ua, lc, ub, t), len = 1.8 + (1 - Math.abs(t - 0.5) * 2) * 1.2;
    o.push(P([x - 0.7, y + 0.4, x + 0.7, y + 0.4, x - 0.1, y - len], TE, { bv: 0.4, ink: -0.14 }));
  }
  o.push(K(hx - 5, hy + 0.4, hx - 12.6, hy + 4.4, 0.5, 0.4, SK, { ink: -0.36, occ: false }), K(hx + 6.4, hy + 0.2, hx + 14, hy + 3.6, 0.5, 0.4, SK, { ink: -0.36, occ: false })); // the grin's creases
  // the hand comes up beside the grin, claws of ice hooked to scratch
  o.push(K(88, 99, 80, 78 + by, 4.6, 3.6, SK, { ink: -0.2 }));
  o.push(E(79, 74 + by, 4, 4.6, SK, { a: 0.2, ink: -0.06 }));
  const fingers = [[76, 71, 72, 64, 72.6, 58], [79, 70, 78, 61, 80, 55.4], [82, 71, 85, 63, 87.6, 58.4], [84, 74, 89, 70, 92, 66]];
  for (const [x0, y0, x1, y1, x2, y2] of fingers) {
    o.push(K(x0, y0 + by, x1, y1 + by, 1.2, 1, SK), K(x1, y1 + by, x2, y2 + by, 1, 0.8, SK), E(x1, y1 + by, 1.3, 1.2, SK, { ink: 0.04 }));
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    o.push(P([x2 - uy * 0.9, y2 + by + ux * 0.9, x2 + uy * 0.9, y2 + by - ux * 0.9, x2 + ux * 4 - uy * 1.6, y2 + by + uy * 4 + ux * 1.6], IC, { bv: 0.5 }));
  }
  // light: its own eyes
  o.push(Lt(hx + 0.6, hy - 2, 38, '#9fe6ff', 0.8 * g, 6));
  return o;
}

// ====================================================================== SLAG
/** Keep the part of a convex polygon (array of [x, y]) where nx*x + ny*y <= c. */
function clipHalf(poly: Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], q = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c, dq = nx * q[0] + ny * q[1] - c;
    if (da <= 0) out.push(a);
    if (da <= 0 !== dq <= 0) { const t = da / (da - dq); out.push([a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t]); }
  }
  return out;
}

/**
 * One lobe of the heap: a molten heart (emissive, hottest where it faces you)
 * under a crust broken into irregular plates (a Voronoi of jittered sites,
 * shrunk apart by `gap`), the gaps between them the cracks. Each plate takes
 * the lobe's normal at its centre; near `hot2` [x, y, r] the heart burns
 * brighter and the plates are the dull cooling crust.
 */
function crustLobe(cx: number, cy: number, rx: number, ry: number, seed: number, hot: number, o2: { s?: number; gap?: number; ink?: number; hot2?: [number, number, number]; shut?: number } = {}): Prim[] {
  const CR = 'scr_slagCrust', CL = 'scr_slagClinker', CO = 'scr_slagCooling';
  const out: Prim[] = [E(cx, cy, rx * 0.95, ry * 0.95, 'scr_slagHeart', { ink: hot })];
  const s = o2.s || 8, gap = o2.gap || 0.6, ink0 = o2.ink || 0, h2 = o2.hot2;
  if (h2) out.push(E(h2[0], h2[1], h2[2], h2[2] * 0.7, 'scr_slagHeart', { ink: hot + 0.32 }));
  const sites: Pt[] = [];
  for (let j = 0; j <= Math.ceil((ry * 2) / (s * 0.86)) + 1; j++) {
    for (let i = 0; i <= Math.ceil((rx * 2) / s) + 1; i++) {
      const x = cx - rx - s * 0.5 + (i + (j % 2) * 0.5) * s + (hash2(seed * 31 + i, j) - 0.5) * s * 0.7;
      const y = cy - ry - s * 0.4 + j * s * 0.86 + (hash2(i, seed * 17 + j) - 0.5) * s * 0.6;
      const qx = (x - cx) / rx, qy = (y - cy) / ry;
      if (qx * qx + qy * qy < 1.3) sites.push([x, y]);
    }
  }
  const ell: Pt[] = [];
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * 6.283, w = 1.03 + 0.04 * Math.sin(a * 5 + seed);
    ell.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  const shut = o2.shut ?? 0.45; // the share of cracks that have closed up cold
  sites.forEach(([x, y], si) => {
    let poly = ell;
    for (let k = 0; k < sites.length; k++) {
      const [u, v] = sites[k], dx = u - x, dy = v - y, l = Math.hypot(dx, dy);
      if (k === si || l > s * 2.6) continue;
      const g = hash2(seed * 5 + Math.min(si, k), Math.max(si, k) + 3) < shut ? 0.15 : gap;
      poly = clipHalf(poly, dx / l, dy / l, (dx / l) * (x + u) * 0.5 + (dy / l) * (y + v) * 0.5 - g * 0.5);
      if (poly.length < 3) return;
    }
    let px = 0, py = 0;
    for (const [a, c] of poly) { px += a; py += c; }
    px /= poly.length; py /= poly.length;
    const qx = (px - cx) / rx, qy = (py - cy) / ry, d = Math.min(0.92, qx * qx + qy * qy), nz = Math.sqrt(1 - d), nl = Math.hypot(qx * 0.8, qy * 0.8, nz);
    const h = hash2(seed * 13 + si, si * 3 + 1);
    const near = h2 && Math.hypot(px - h2[0], (py - h2[1]) / 0.7) < h2[2] * 1.1;
    const m = near && h < 0.45 ? CO : h < 0.22 ? CL : h > 0.92 ? CO : CR;
    out.push(P(poly.flat(), m, { n: [(qx * 0.8) / nl, (qy * 0.8) / nl, nz / nl], bv: 1.5, ink: ink0 + (hash2(si, seed + 5) - 0.5) * 0.12 }));
    if (h > 0.6 && h < 0.7) out.push(E(px + (h - 0.65) * 30, py + 0.6, 1.1, 0.8, CL, { fl: 0.8, ink: -0.3, occ: false })); // a gas-pit
  });
  return out;
}

/**
 * A heap of slag that will not cool, slumped against the cut-stone wall of
 * the Abandoned Dwarven Works: lumps of clinker crust broken into plates over
 * a molten heart, most cracks gone cold, the rest breathing ember; a ragged
 * vent of a mouth gaping in it, crags of crust for teeth, spilling slag over
 * its lip, and two ember eyes squinting out of the crust above it.
 */
export function slagPortrait(f: number): PrimTree {
  const b = breath(f);
  const pl = [0, 0.06, 0.1, 0.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gSlag', HL = 'scr_slagHalo', CR = 'scr_slagCrust', CL = 'scr_slagClinker', MW = 'scr_slagMaw';
  const hb = -b * 0.5;
  const mx = 45, my = 52 + hb; // the vent
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(mx, my - 10, 40, 32, HL, { fl: 1, ink: BAND[1] }));
  // the Works' wall behind it, courses of cut stone, lit warm by the vent
  for (let r = 0; r < 6; r++) {
    const y0 = -2 + r * 8.4, off = (r % 2) * 7 + hash2(r, 9) * 3;
    for (let x0 = -14 + off; x0 < 96; x0 += 14) {
      const w = 13 + hash2(x0, r) * 1.2, d = Math.hypot(x0 + w / 2 - mx, (y0 + 4 - my + 8) * 1.15), j = (hash2(x0 * 3, r) - 0.5) * 0.06;
      const pts = [x0 + 0.6, y0 + 0.6, x0 + w - 0.6, y0 + 0.6, x0 + w - 0.6, y0 + 7.8, x0 + 0.6, y0 + 7.8];
      if (d < 26) o.push(P(pts, HL, { ink: BAND[2] + j }));
      else o.push(P(pts, BG, { ink: (d < 44 ? BAND[3] : BAND[2]) + j }));
    }
  }

  // the heap: lobes heaped on a slumped base, each a crust of plates
  o.push(crustLobe(72, 38 + hb * 0.6, 16, 12, 7, -0.66 + pl, { s: 8, ink: -0.08 }));
  o.push(crustLobe(23, 43 + hb * 0.6, 14, 10, 8, -0.66 + pl, { s: 8, ink: -0.06 }));
  o.push(crustLobe(47, 60 + hb * 0.5, 36, 30, 4, -0.66 + pl, { s: 10.5, gap: 0.7, ink: -0.08, hot2: [mx, my + 1, 18] }));
  o.push(crustLobe(9, 76, 19, 21, 2, -0.72 + pl, { s: 9.5, ink: -0.14 }));
  o.push(crustLobe(88, 72, 19, 23, 3, -0.72 + pl, { s: 9.5, ink: -0.16 }));
  o.push(crustLobe(48, 92, 56, 8, 1, -0.8 + pl, { s: 10, gap: 0.6, ink: -0.3 }));
  // the eyes: two ember slits squinting out of the crust, under heavy brows
  for (const [ex, ey, a, sd] of [[38, 38, 0.3, -1], [53, 37.4, -0.3, 1]]) {
    o.push(E(ex, ey + hb, 4.8, 2.4, CL, { a, ink: -0.34 }));
    o.push(E(ex, ey + hb + 0.2, 3.6, 1.05, 'emFireCore', { a, ink: pl * 0.5 }));
    o.push(X(ex - 0.6, ey + hb - 0.2, 1.2, 0.8, '#fff6dc', { em: true }));
    o.push(P([ex - 5.6, ey + hb - 2 + sd * 1.7, ex + 5.6, ey + hb - 2 - sd * 1.7, ex + 4.8, ey + hb - 5.6 - sd * 1.4, ex - 4.8, ey + hb - 5.6 + sd * 1.4], CR, { bv: 1.6, n: [0, -0.5, 0.86], ink: 0.04 }));
  }
  // the vent: a ragged gape of clinker, molten slag welling in its throat
  const lip: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, top = Math.sin(a) < 0, r = i % 2 ? 1 : top ? 0.74 : 0.86;
    lip.push(mx + Math.cos(a) * 14 * (i % 2 ? 1 : 0.94), my + Math.sin(a) * 7.6 * r);
  }
  o.push(P(lip, CL, { bv: 1.2, ink: 0.02 }));
  o.push(E(mx, my + 0.4, 11.8, 6, MW, { ink: -0.3 }));
  o.push(E(mx + 0.4, my + 2.4, 10, 3.4, 'emFire', { ink: -0.1 + pl }));
  o.push(E(mx + 0.8, my + 2.9, 6.2, 1.9, 'emFireCore', { ink: pl }));
  const bub = [[-4, 2.6, 1], [2, 2.8, 1.5], [5, 2.4, 0.8], [-1, 2.8, 1.8]][f % 4];
  o.push(E(mx + bub[0], my + bub[1], bub[2], bub[2] * 0.7, 'emFireCore', { ink: 0.2 }));
  // clinker teeth hanging over the throat, and stubs of it standing in the lower lip
  for (const [x, w, l, t] of [[-9.4, 1.3, 2.4, 0.6], [-6, 2.2, 5, -0.8], [-2.4, 1.1, 2.2, 0.4], [0.8, 2, 4.4, 1], [4.8, 1.2, 2.4, -0.4], [7.8, 2, 4.2, -1]]) {
    const y = my - 5 + Math.abs(x) * 0.16;
    o.push(P([mx + x - w, y, mx + x + w, y, mx + x + t, y + l], CR, { bv: 0.6, ink: 0.12 }));
  }
  for (const [x, w, l] of [[-7, 1.3, 2.4], [3.6, 1.4, 2.8], [8, 1.1, 2]]) {
    const y = my + 5.4 - Math.abs(x) * 0.12;
    o.push(P([mx + x - w, y, mx + x + w, y, mx + x - 0.2, y - l], CL, { bv: 0.5, ink: 0.1 }));
  }
  // slag spilling over the front lip, a drop falling
  o.push(line([[mx - 3, my + 5.4], [mx - 4.4, my + 9.6], [mx - 3.8, my + 14.6]], 1.5, 0.8, 'emFire', { ink: -0.06 + pl }));
  o.push(E(mx - 3.8, my + 15.2, 1.2, 1.3, 'emFire', { ink: -0.04 + pl }));
  o.push(line([[mx + 5.4, my + 5.4], [mx + 6.2, my + 8.6]], 1.1, 0.7, 'emFire', { ink: -0.14 + pl }));
  o.push(E(mx - 3.8, my + 18 + (f % 4) * 1.8, 0.9, 1.2, 'emFire'));
  o.push(E(87, 62 + (f % 4) * 1.6, 0.8, 1.1, 'emFire', { ink: -0.1 }));
  // embers rising from the vent
  for (let i = 0; i < 4; i++) {
    const y = 22 - ((f + i * 1.7) % 4) * 4 - i * 2, x = 50 + (hash2(i, 71) - 0.5) * 24 + ((f + i) % 2) * 0.6;
    o.push(X(x, y, 0.8, 0.8, i % 2 ? 'emFire:4' : 'emFireCore:4', { em: true }));
  }
  // light: the vent
  o.push(Lt(mx + 1, my, 62, '#ff8a2c', 0.8 + pl, 18));
  return o;
}
