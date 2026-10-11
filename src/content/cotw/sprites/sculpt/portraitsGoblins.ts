import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree, type Rgb } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9e, group A: the goblin kin. The Kobold, the Kobold Shaman, the Goblin, the Hoarfrost Skraeling (one body in four colours). Conventions: portraitKit.ts. */

type Kind = 'kobold' | 'shaman' | 'goblin' | 'skraeling';

/** A frame at (px, py), turned by ang, scaled by k: primitives in head space. */
function sframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  return {
    pt,
    P: (pts: number[], m: string, o?: PrimOptions) => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}) => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions) => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
    Lt: (x: number, y: number, r: number, col: string, kk: number, z: number) => { const [a, b] = pt(x, y); return Lt(a, b, r * k, col, kk, z); },
    S: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n?: number, o?: PrimOptions) => { const a = pt(ax, ay), b = pt(bx, by), c2 = pt(cx, cy); return strand(a[0], a[1], b[0], b[1], c2[0], c2[1], r0 * k, r1 * k, m, n, o); },
  };
}
type Frame = ReturnType<typeof sframe>;

/** A tufted edge along a quadratic a -> b (control c): sgn 1 pushes the tufts out on the left of the direction of travel. */
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

/** An ear: base a, out along a curve (control ca) to the tip t, back along another (control cb) to base b; notch bites a V out of the second edge. */
function leaf(a: Pt, ca: Pt, t: Pt, cb: Pt, b: Pt, notch: number, n = 6): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) { const [x, y] = qpt(a, ca, t, i / n); pts.push(x, y); }
  const cx = (a[0] + t[0] + b[0]) / 3, cy = (a[1] + t[1] + b[1]) / 3;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    let [x, y] = qpt(t, cb, b, u);
    if (notch && Math.abs(u - notch) < 0.5 / n) { x += (cx - x) * 0.32; y += (cy - y) * 0.32; }
    pts.push(x, y);
  }
  pts.push(b[0], b[1]);
  return pts;
}
const toward = (p: Pt, c: Pt, k: number): Pt => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k];
/** y of a polyline [[x, y], ...] at x. */
function yAt(line: Pt[], x: number): number {
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    if ((x >= x0 && x <= x1) || (x >= x1 && x <= x0)) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return line[x < line[0][0] ? 0 : line.length - 1][1];
}

interface EarShape { a: Pt; ca: Pt; t: Pt; cb: Pt; b: Pt }
interface Nose { top: number[]; under: number[]; bot: number[]; wing: number[]; nos: Pt; hi: number[]; bulb: number[] | null }
interface Kin {
  SK: string; EYE: string; px: number; py: number; ang: number; k: number;
  ear: EarShape & { notch: number }; far: EarShape; nose: Nose;
  brow: number; dk: number; mouth: 'sly' | 'chant' | 'grin' | 'thin'; eye: number[]; look: number;
}

// Each kind: where its head sits (frame origin = the stop between the eyes, the
// nose along +x), its skin and eye, its ears, its nose and its mouth. The nose is
// an outline (top from the bridge to the tip, then back under to the cheek), its
// shadowed underside, its wing, a nostril and a light along the ridge.
const KIN: Record<Kind, Kin> = {
  kobold: {
    SK: 'scr_koboldSkin', EYE: 'eyeAmber', px: 46, py: 44, ang: 0.14, k: 1.26,
    ear: { a: [-9, -9], ca: [-20, -17], t: [-31, -16], cb: [-22, -1], b: [-12, 1], notch: 0.5 },
    far: { a: [3, -13], ca: [8, -22], t: [16, -27], cb: [14, -14], b: [10, -8] },
    nose: { top: [-0.6, -2, 5.6, 0.8, 11, 4, 15, 6.6, 17.4, 8.4, 18.2, 10.4], under: [16.8, 12, 13.4, 11.8, 8.6, 11.2, 5, 10.8, 2.8, 9.2, 0.4, 4.6, -1.4, 0],
      bot: [18.2, 10.4, 16.8, 12, 13.4, 11.8, 8.6, 11.2, 5, 10.8, 5.6, 9.6, 10.4, 9.8, 15.4, 9.4], wing: [4.6, 9, 2.4, 1.9], nos: [15.6, 11.2], hi: [0.8, -1, 15.4, 6.4], bulb: [16.2, 9.4, 2.2, 2.1] },
    brow: 1, dk: -0.1, mouth: 'sly', eye: [3.5, 2.7, 2.5, 2.4], look: 0.55,
  },
  shaman: {
    SK: 'scr_koboldShamanSkin', EYE: 'eyeAmber', px: 40, py: 48, ang: -0.16, k: 1.16,
    ear: { a: [-9, -9], ca: [-19, -15], t: [-29, -12], cb: [-21, -1], b: [-12, 1], notch: 0 },
    far: { a: [3, -13], ca: [8, -21], t: [15, -24], cb: [14, -13], b: [10, -8] },
    nose: { top: [-0.6, -2, 5, 1.4, 10, 4, 14.8, 5.4], under: [13, 7.4, 8.6, 9, 5.2, 9.8, 3, 8.6, 0.4, 4.4, -1.4, 0],
      bot: [14.8, 5.4, 13, 7.4, 8.6, 9, 5.2, 9.8, 5.4, 8.6, 10.4, 6.4], wing: [4.6, 8.4, 2.2, 1.7], nos: [6.4, 9], hi: [0.8, -1, 13.2, 4.6], bulb: null },
    brow: 0.9, dk: -0.05, mouth: 'chant', eye: [3.1, 2.4, 2.2, 2.2], look: 0.8,
  },
  goblin: {
    SK: 'scr_goblinSkin', EYE: 'eyeAmber', px: 49, py: 44, ang: 0.03, k: 1.26,
    ear: { a: [-9, -8], ca: [-22, -14], t: [-37, -11], cb: [-24, 3], b: [-12, 2], notch: 0.35 },
    far: { a: [4, -12], ca: [14, -21], t: [27, -24], cb: [20, -10], b: [10, -7] },
    nose: { top: [-0.6, -2, 4, 0.4, 8.4, 3.2, 12.2, 6.6], under: [12.8, 10, 10.4, 11.8, 6.4, 11.4, 3.4, 10.2, 0.8, 5, -1.4, 0],
      bot: [12.8, 10, 10.4, 11.8, 6.4, 11.4, 3.4, 10.2, 4.8, 9.2, 9.6, 10], wing: [4.4, 8.6, 3, 2.4], nos: [7.4, 10.6], hi: [0.8, -1.2, 8.4, 3], bulb: [10, 7.6, 3.8, 4] },
    brow: 1.4, dk: -0.07, mouth: 'grin', eye: [2.8, 2, 2, 1.8], look: 0.3,
  },
  skraeling: {
    SK: 'scr_skraelingSkin', EYE: 'scr_skraelingEye', px: 46, py: 50, ang: 0.06, k: 1.3,
    ear: { a: [-11, -5], ca: [-21, -7], t: [-28, 7], cb: [-21, 7], b: [-12, 3], notch: 0 },
    far: { a: [6, -9], ca: [13, -13], t: [21, -8], cb: [15, -4], b: [10, -4] },
    nose: { top: [-0.6, -2, 4.6, 1.6, 9, 4.8, 13, 8.6], under: [10.4, 9.4, 7, 9.8, 4.2, 9.6, 2.6, 8, 0.4, 4, -1.4, 0],
      bot: [13, 8.6, 10.4, 9.4, 7, 9.8, 4.2, 9.6, 4.6, 8.4, 9, 7.4], wing: [4, 8.2, 2, 1.6], nos: [5.2, 9], hi: [5.4, 2.6, 11, 7], bulb: null },
    brow: 0.8, dk: -0.12, mouth: 'thin', eye: [3.2, 2.4, 2.4, 2.2], look: 0,
  },
};

interface Mouth { up: Pt[]; lo: Pt[]; ut: number[]; ul: number[]; lt: number[]; ll: number[]; tusk: number[] | null; tongue?: boolean }
const MOUTH: Record<Kin['mouth'], Mouth> = {
  // the kobold: a lopsided sneer, up at the far corner, needle teeth
  sly: { up: [[-6, 12.6], [-1, 13.2], [4, 12.8], [8.6, 11.4], [12.4, 10.4]], lo: [[-6, 12.6], [-5.2, 14.4], [-2, 15.8], [3, 16], [8, 14.8], [12.4, 10.4]],
    ut: [-4.4, -2.4, -0.4, 1.6, 3.6, 5.6, 7.6, 9.6, 11.4], ul: [1.8, 2.4], lt: [-3.2, -1, 1.2, 3.4, 5.6, 7.8, 10], ll: [1.4, 1.9], tusk: null },
  // the shaman: open on the chant
  chant: { up: [[-5, 12], [0, 11.2], [5, 11], [9.6, 11.6]], lo: [[-5, 12], [-4.2, 15.6], [-0.6, 18.6], [4, 19], [8.4, 16.4], [9.6, 11.6]],
    ut: [-3.4, -1.4, 0.6, 2.6, 4.6, 6.6, 8.4], ul: [1.6, 2], lt: [-1.4, 0.8, 3, 5.2, 7.2], ll: [1.4, 1.6], tusk: null, tongue: true },
  // the goblin: a wide jagged grin, two tusks up out of the lower jaw
  grin: { up: [[-8, 12.4], [-3, 13.6], [3, 13.8], [8.6, 12.6], [12.4, 10.6]], lo: [[-8, 12.4], [-6.6, 15], [-2, 17], [4, 17.4], [9, 15.6], [12.4, 10.6]],
    ut: [-5.6, -3, -0.6, 2.4, 4.6, 7.4, 10], ul: [2.2, 1.4], lt: [-3.6, -0.8, 2, 5, 7.6], ll: [1.6, 2.2], tusk: [-5.6, 9.8] },
  // the skraeling: a hard thin mouth, a row of needles
  thin: { up: [[-6, 12], [0, 12.8], [5.6, 12.4], [10, 10.6]], lo: [[-6, 12], [-4, 15], [1.6, 16.4], [7, 15], [10, 10.6]],
    ut: [-4.4, -2.6, -0.8, 1, 2.8, 4.6, 6.4, 8.2], ul: [1.6, 2.2], lt: [-2.6, -0.6, 1.4, 3.4, 5.4, 7.4], ll: [1.6, 2], tusk: null },
};

// ======================================================================== HEAD
/** An ear in the frame H, with its dark hollow and its lit upper rim. */
function ear(o: Out, H: Frame, A: EarShape, tip: Pt, m: string, ink: number, notch: number): void {
  o.push(H.P(leaf(A.a, A.ca, tip, A.cb, A.b, notch), m, { bv: 1.8, ink }));
  const c: Pt = [(A.a[0] + A.b[0] + tip[0]) / 3, (A.a[1] + A.b[1] + tip[1]) / 3];
  o.push(H.P(leaf(toward(A.a, c, 0.55), toward(A.ca, c, 0.62), toward(tip, c, 0.8), toward(A.cb, c, 0.62), toward(A.b, c, 0.55), 0), m, { bv: 1.2, ink: ink - 0.42 }));
  o.push(H.S(A.a[0], A.a[1], A.ca[0] + 0.6, A.ca[1] + 1.2, tip[0] + 0.8, tip[1] + 0.3, 0.7, 0.25, m, 4, { ink: ink + 0.12, occ: false }));
}

/** The goblin kin's head in its frame H: x along the nose (to the right), y down. */
function head(o: Out, H: Frame, C: Kin, f: number, kind: Kind): void {
  const SK = C.SK, MW = 'scr_goblinKinMaw', TH = 'scr_goblinKinTooth';
  const gb = kind === 'goblin', sk = kind === 'skraeling';
  const tw = [0, 0, 1, 0][f % 4]; // an ear twitches
  // the far ear, behind the skull
  if (C.far && !sk) ear(o, H, C.far, [C.far.t[0] + tw * 0.6, C.far.t[1] - tw * 0.8], SK, -0.34, 0);
  // the skull, the face, the long chin
  o.push(H.E(-9, -5, 9, 10, SK, { fl: 0.2, ink: -0.12 }));
  o.push(H.E(-3, -9, 13, 11.5, SK, { fl: 0.12 }));
  o.push(H.E(1, 2, 10.5, 10, SK, { fl: 0.2 }));
  const jw = gb ? 1.14 : 1;
  o.push(H.P([-10 * jw, 2, -9.4 * jw, 8.6, -6 * jw, 13.6, -1, 17, 4, 18.8, 8, 18.2, 10.6, 14.6, 11.4, 9, 10.6, 3], SK, { bv: 3, ink: -0.02 }));
  // the planes of the face: temple, hollow cheek, cheekbone, the far cheek turned away
  o.push(H.E(-9.6, -2.6, 2.4, 4, SK, { fl: 0.7, ink: -0.18 }));
  o.push(H.E(-5.6, 8.6, 3.6, 3.2, SK, { fl: 0.7, ink: -0.2 }));
  o.push(H.E(-5, 4, 4.6, 2, SK, { fl: 0.5, ink: 0.06, a: -0.12 }));
  o.push(H.E(9.4, 4, 2.4, 4.6, SK, { fl: 0.6, ink: -0.2 }));
  // the eyes: deep sockets, heavy lids slanting down to the nose in a scowl
  const [nrx, nry, frx, fry] = C.eye, blink = f % 4 === 3 && !sk;
  const eye = (ex: number, ey: number, rx: number, ry: number, side: number): void => {
    o.push(H.E(ex, ey + 0.2, rx + 1.4, ry + 1.2, SK, { fl: 0.85, ink: -0.56 }));
    const inner = side < 0 ? ex + rx + 0.4 : ex - rx - 0.4, outer = side < 0 ? ex - rx - 0.6 : ex + rx + 0.6;
    if (blink) {
      o.push(H.K(outer, ey - 0.2, inner, ey + 0.2, ry + 0.3, ry + 0.3, SK, { ink: -0.06 }));
      o.push(H.K(outer, ey + ry * 0.5, inner, ey + ry * 0.6, 0.45, 0.45, SK, { ink: -0.4, occ: false }));
      return;
    }
    o.push(H.E(ex, ey, rx, ry, C.EYE, { ink: sk ? -0.02 : -0.1 }));
    if (!sk) o.push(H.X(ex + C.look * rx * 0.4 - 0.4, ey - ry * 0.75, 0.8, ry * 1.5, '#140a06'));
    o.push(H.X(ex - rx * 0.4, ey - ry * 0.1, 0.7, 0.7, sk ? '#ffffff' : '#fff6dc', { em: true }));
    o.push(H.K(outer, ey - ry * 0.95, inner, ey - ry * 0.35, ry * 0.62, ry * 0.62, SK, { ink: -0.04 })); // the upper lid
    o.push(H.K(outer, ey + ry * 0.85, inner, ey + ry * 0.7, 0.55, 0.5, SK, { ink: -0.02 })); // the lower
  };
  eye(-5, 0.4, nrx, nry, -1);
  eye(6.8, -1.4, frx, fry, 1);
  // the brow, a bony ridge scowling down to the nose; the frown between; crow's feet
  const bw = C.brow, up: Rgb = [-0.1, -0.35, 0.93];
  o.push(H.P([-12.6, -7.4 - 0.6 * bw, -7, -6.8 - 0.8 * bw, -2.4, -4.6 - 0.8 * bw, 0.6, -2.6 - 0.6 * bw, 0.2, -1.4, -2.6, -2.2, -7, -3.8, -12, -5], SK, { bv: 1.4, n: up, ink: 0.02 }));
  o.push(H.P([2, -3.6 - 0.6 * bw, 6.4, -5.4 - 0.7 * bw, 11.2, -6.6 - 0.4 * bw, 11.2, -5.4, 6.4, -3.8, 2.4, -1.8], SK, { bv: 1.2, n: up, ink: -0.06 }));
  o.push(H.K(-0.4, -3.8 - bw, 0.2, -8.6 - bw, 0.5, 0.45, SK, { ink: -0.34, occ: false }));
  o.push(H.K(-9.4, 0.4, -12.2, -0.6, 0.45, 0.45, SK, { ink: -0.32, occ: false }), H.K(-9.2, 1.8, -11.8, 2.8, 0.45, 0.45, SK, { ink: -0.32, occ: false }));

  // the nose: one bevelled form from the bridge to the tip, its underside in shadow
  const N = C.nose;
  o.push(H.P([...N.top, ...N.under], SK, { bv: 2, ink: 0.02 }));
  o.push(H.P(N.bot, SK, { bv: 0.8, n: [0.05, 0.5, 0.86], ink: -0.04 }));
  if (N.bulb) o.push(H.E(N.bulb[0], N.bulb[1], N.bulb[2], N.bulb[3], SK, { ink: 0.02, a: 0.3 }));
  o.push(H.E(N.wing[0], N.wing[1], N.wing[2], N.wing[3], SK, { ink: -0.02 }));
  o.push(H.E(N.nos[0], N.nos[1], 1.2, 0.6, MW, { a: 0.25 }));
  o.push(H.K(N.hi[0], N.hi[1], N.hi[2], N.hi[3], 0.5, 0.45, SK, { ink: 0.16, occ: false })); // the light along the ridge
  if (gb) o.push(H.E(7.6, 2, 1.1, 1, SK, { ink: 0.08 }), H.E(12.2, 6.2, 0.9, 0.9, SK, { ink: 0.12 }), H.E(-7.4, 6.6, 1, 0.9, SK, { ink: 0.04 })); // warts
  if (kind === 'kobold') o.push(H.E(9.4, 4.2, 0.9, 0.8, SK, { ink: 0.1 }));

  // the mouth
  const M = MOUTH[C.mouth];
  const maw: number[] = [];
  for (const [x, y] of M.up) maw.push(x, y);
  for (let i = M.lo.length - 2; i >= 1; i--) maw.push(M.lo[i][0], M.lo[i][1]);
  o.push(H.P(maw, MW));
  if (M.tongue) o.push(H.E(2.4, 16.8, 3.6, 1.5, 'scr_koboldShamanTongue', { ink: -0.2 }));
  M.ut.forEach((x, i) => {
    const y = yAt(M.up, x), l = M.ul[i % 2] * (gb && i === 3 ? 0.4 : 1); // one broken
    o.push(H.P([x - 0.8, y - 0.4, x + 0.8, y - 0.4, x + 0.1, y + l], TH, { bv: 0.4, ink: -0.04 - i * 0.02 }));
  });
  M.lt.forEach((x, i) => {
    const y = yAt(M.lo, x), l = M.ll[i % 2];
    o.push(H.P([x - 0.7, y + 0.4, x + 0.7, y + 0.4, x - 0.1, y - l], TH, { bv: 0.4, ink: -0.2 - i * 0.02 }));
  });
  if (M.tusk) for (const x of M.tusk) {
    const y = yAt(M.lo, x);
    o.push(H.P([x - 1.3, y + 0.8, x + 1.3, y + 0.8, x + 0.8, y - 3.4, x + 0.2, y - 5.6], TH, { bv: 0.7, ink: -0.02 }));
  }
  // the lips: the upper drawn back, the lower hanging; the fold of the sneer
  for (let i = 0; i < M.up.length - 1; i++) o.push(H.K(M.up[i][0], M.up[i][1] - 0.5, M.up[i + 1][0], M.up[i + 1][1] - 0.5, 0.7, 0.7, SK, { ink: 0.02, occ: false }));
  for (let i = 1; i < M.lo.length - 2; i++) o.push(H.K(M.lo[i][0], M.lo[i][1] + 0.6, M.lo[i + 1][0], M.lo[i + 1][1] + 0.6, 0.9, 0.9, SK, { ink: -0.06, occ: false }));
  o.push(H.K(-1.4, 9.6, M.up[0][0] - 0.6, M.up[0][1] + 0.4, 0.5, 0.45, SK, { ink: -0.3, occ: false }));

  // the near ear, over the side of the skull
  if (C.ear && !sk) ear(o, H, C.ear, [C.ear.t[0] - tw * 0.6, C.ear.t[1] - tw * 1.2], SK, -0.04, C.ear.notch);
}

// ====================================================================== GOBLIN
function scene(f: number, kind: Kind): Out {
  const C = KIN[kind];
  const kb = kind === 'kobold', sh = kind === 'shaman', gb = kind === 'goblin';
  const b = breath(f), s = sway(f);
  const fl = [1, 1.08, 0.9, 1.04][f % 4];
  const o: Out = [];
  const SK = C.SK, hb = -b * 0.5;
  const H = sframe(C.px, C.py + hb, C.ang, C.k);

  if (kb) {
    // ------------------------------------------------------------ the kobold
    // the cistern wall in your torchlight, and its own shadow thrown huge on it
    const BG = 'scr_gKobold', TW = 'scr_koboldTorchWall';
    o.push(P(FULL, BG, { ink: BAND[1] }));
    o.push(E(62, 38, 64, 58, TW, { fl: 1, ink: BAND[1] }));
    o.push(E(74, 36, 34, 34, TW, { fl: 1, ink: BAND[2] }));
    for (const [y, x0] of [[18, 0], [38, 0], [58, 0]]) o.push(P([x0, y, 97, y - 1, 97, y + 0.3, x0, y + 1.3], BG, { ink: BAND[1] }));
    for (const [x, y] of [[40, 0], [78, 0], [22, 19], [60, 19], [6, 39], [44, 39], [80, 39], [28, 59], [70, 59]]) o.push(P([x, y, x + 1.1, y, x + 1.1, y + 18.4, x, y + 18.4], BG, { ink: BAND[1] }));
    // the cistern's damp running down the stones
    for (const [x, y0, y1] of [[70, 20, 31], [87, 40, 52], [13, 20, 29], [56, 1, 12]]) o.push(K(x, y0, x + 0.3, y1, 0.55, 0.5, TW, { fl: 1, ink: BAND[3] }));
    // the rat's tail, curling up behind it, flicking
    const tt = [0, 1.2, 2, 0.8][f % 4];
    o.push(strand(6, 99, -4, 76, 7 + tt, 62 - tt * 0.5, 2.6, 0.7, SK, 5, { ink: -0.26 }));
    // the far shoulder; the narrow hunched body, ribs standing out
    o.push(E(66, 90, 13, 9, SK, { ink: -0.34 }));
    o.push(P([2, 99, 4, 84, 12, 74, 24, 68 + hb, 36, 67 + hb, 48, 69 + hb, 58, 74, 66, 86, 68, 99], SK, { bv: 6, ink: -0.12 }));
    o.push(K(...H.pt(-2, 14), 38, 71 + hb, 6.6, 8.4, SK, { ink: -0.16 }));
    o.push(K(...H.pt(3, 17), 42, 70 + hb, 0.8, 1, SK, { ink: 0.04, occ: false }));
    o.push(K(17, 75 + hb, 35, 76 + hb, 0.8, 0.7, SK, { ink: 0.04, occ: false }), K(42, 76 + hb, 55, 78 + hb, 0.7, 0.6, SK, { ink: -0.04, occ: false }));
    for (let i = 0; i < 3; i++) {
      const y = 83 + i * 4.6 + hb;
      o.push(strand(18 + i, y, 32, y + 3.6, 47 - i, y - 0.6, 0.6, 0.5, SK, 3, { ink: -0.42, occ: false }));
      o.push(strand(18 + i, y - 1.3, 32, y + 2.3, 47 - i, y - 1.9, 0.5, 0.4, SK, 3, { ink: 0.04, occ: false }));
    }
    // the arm thrust out, the dagger held as far from it as it will go
    o.push(K(56, 99, 68, 87, 4.4, 3.4, SK, { ink: -0.06 }));
    const gx = 74.6, gy = 80.6, tx = 93.5, ty = 57;
    const L = Math.hypot(tx - gx, ty - gy), ux = (tx - gx) / L, uy = (ty - gy) / L, nx = -uy, ny = ux;
    const bl = (t: number, w: number): Pt => [gx + ux * L * t + nx * w, gy + uy * L * t + ny * w];
    o.push(P([...bl(0, 2), ...bl(0.45, 1.9), ...bl(0.5, 1.1), ...bl(0.56, 1.8), ...bl(0.85, 1), tx, ty, ...bl(0.8, -1.1), ...bl(0.3, -1.8), ...bl(0, -2)], 'scr_koboldBlade', { bv: 1.2, n: [0.3, -0.2, 0.93] }));
    o.push(K(...bl(0.05, 1.1), ...bl(0.8, 0.5), 0.5, 0.5, 'scr_koboldBlade', { ink: 0.4, occ: false })); // the torch on its edge
    o.push(K(...bl(-0.02, -4.4), ...bl(-0.02, 4.4), 1.1, 1.1, 'scr_koboldBronze'));
    o.push(K(...bl(-0.04, 0), ...bl(-0.36, 0), 1.3, 1.2, 'scr_koboldBronze', { ink: -0.1 }));
    // the fist round the grip
    o.push(E(70.6, 85, 4.2, 3.8, SK, { ink: -0.04, a: -0.5 }));
    for (let i = 0; i < 4; i++) {
      const x = 71.2 + i * 1.1, y = 81.4 + i * 1.9;
      o.push(K(x - 2.6, y + 0.4, x + 1.6, y - 0.6, 1.2, 1.1, SK, { ink: 0.02 - i * 0.04 }));
      o.push(K(x + 1.6, y - 0.6, x + 2.6, y + 0.8, 0.7, 0.3, 'scr_goblinKinNail'));
    }
    o.push(K(67.6, 82.6, 72.6, 79.2, 1.3, 1, SK, { ink: 0.06 })); // the thumb over the guard
    // the head, horns first
    o.push(H.S(-5, -17, -7, -25, -12, -30, 2.4, 0.6, 'scr_koboldHorn', 4, { ink: -0.06 }));
    o.push(H.S(3, -18, 3, -26, -1, -32, 2.2, 0.55, 'scr_koboldHorn', 4, { ink: -0.14 }));
    for (const [x0, y0, x1, y1] of [[-8.6, -22.4, -4.2, -23.2], [-10.4, -26, -6.8, -27.4], [0.8, -23.4, 4.8, -23.6], [-0.4, -27.4, 3, -28.2]]) o.push(H.K(x0, y0, x1, y1, 0.45, 0.45, 'scr_koboldHorn', { ink: -0.4, occ: false }));
    head(o, H, C, f, kind);
    // light: your torch, off to the right
    o.push(Lt(104, 52, 96, '#ffb050', 1.35 * fl, 22));
    return o;
  }

  if (sh) {
    // ------------------------------------------------------------ the shaman
    const BG = 'scr_gKoboldShaman', HL = 'scr_koboldShamanHalo', ST = 'scr_koboldShamanStaff', BN = 'scr_koboldShamanBone', LN = 'scr_koboldShamanLinen';
    const fx = 79.6, fy = 15;
    o.push(P(FULL, BG, { ink: BAND[1] }));
    o.push(E(40, 42, 58, 56, BG, { fl: 1, ink: BAND[2] }));
    // pillars of the colonnade, the smoke of the chant drifting across
    o.push(P([2, -1, 13, -1, 12, 97, 3, 97], BG, { ink: BAND[1] }), P([89, 44, 97, 44, 97, 97, 89, 97], BG, { ink: BAND[1] }));
    for (let i = 0; i < 3; i++) {
      const x = ((i * 37 + f * 2) % 120) - 12, y = 6 + i * 9;
      o.push(E(x, y, 16, 2.4, BG, { fl: 1, ink: BAND[3] - 0.08 }));
    }
    o.push(E(fx, fy - 6, 11, 15, HL, { fl: 1, ink: BAND[1] }), E(fx, fy - 5, 6.4, 9, HL, { fl: 1, ink: BAND[2] }));
    // the staff, forked, and its charms of bone on linen
    o.push(K(78, 99, fx, 26, 2, 1.7, ST, { ink: -0.06 }));
    o.push(K(fx, 27, fx - 5, 15, 1.5, 0.7, ST, { ink: -0.02 }), K(fx, 27, fx + 5.4, 15.4, 1.5, 0.7, ST, { ink: -0.1 }));
    for (let i = 0; i < 3; i++) o.push(K(fx - 2, 28.4 + i * 1.6, fx + 2, 29 + i * 1.6, 0.6, 0.6, LN, { ink: -0.06 }));
    o.push(strand(fx - 4, 19, fx - 6 + s * 0.3, 26, fx - 5 + s * 0.5, 33, 0.5, 0.5, LN, 3), E(fx - 5 + s * 0.5, 34.6, 1.1, 1.7, BN));
    o.push(strand(fx + 4.4, 19, fx + 6 - s * 0.3, 25, fx + 5.4 - s * 0.4, 30, 0.5, 0.5, LN, 3), P([fx + 4.4 - s * 0.4, 30, fx + 6.4 - s * 0.4, 30, fx + 5.6 - s * 0.4, 35], BN, { bv: 0.5 }));
    // the flame in the fork: a ragged tongue curling up, two lesser ones, a white-gold heart low down
    const fw = [0, 0.8, -0.6, 0.4][f % 4], fh = [17, 18.4, 15.6, 17.4][f % 4], lt = [0, 1, -0.6, 0.4][f % 4];
    o.push(P([fx - 4.4, fy + 3.4, fx - 6, fy - 1, fx - 6.4 - lt * 0.4, fy - 6, fx - 7.6 - lt * 0.6, fy - 11.4 + lt, fx - 4.2, fy - 7.4, fx - 3, fy - 10.4, fx - 1.8 + fw * 0.6, fy - fh * 0.72, fx + fw, fy - fh, fx + 1.8 + fw * 0.4, fy - fh * 0.62, fx + 3.4, fy - 9, fx + 6 + lt * 0.4, fy - 12.6 - lt * 0.6, fx + 5.4, fy - 6, fx + 6.2, fy - 1.4, fx + 4.6, fy + 3.4, fx, fy + 5.4], 'emFire', { bv: 2, ink: -0.1 }));
    o.push(P([fx - 2.4, fy + 2.6, fx - 3, fy - 1.6, fx - 1 + fw * 0.3, fy - 6.4, fx + 0.6 + fw * 0.5, fy - 9.4, fx + 1.6, fy - 5.4, fx + 3, fy - 1.4, fx + 2.4, fy + 2.6, fx, fy + 3.6], 'emFireCore', { bv: 1, ink: 0 }));
    for (let i = 0; i < 3; i++) {
      const y = fy - 12 - ((f * 5 + i * 7) % 18), x = fx - 6 + i * 6 + Math.sin(f + i) * 1.4;
      o.push(X(x, y, 0.8, 0.8, 'emFire:' + (i % 2 ? 4 : 5), { em: true }));
    }
    // the far shoulder; the body; the bone-bead necklace
    o.push(E(64, 92, 14, 10, SK, { ink: -0.34 }));
    o.push(P([4, 99, 8, 86, 18, 79, 30, 75 + hb, 42, 74 + hb, 54, 76 + hb, 64, 82, 70, 92, 72, 99], SK, { bv: 6, ink: -0.1 }));
    o.push(K(...H.pt(-2, 15), 38, 78 + hb, 6.2, 8, SK, { ink: -0.14 }));
    const cA: Pt = [18, 80 + hb], cC: Pt = [36, 100], cB: Pt = [58, 82 + hb];
    o.push(strand(cA[0], cA[1], cC[0], cC[1], cB[0], cB[1], 0.5, 0.5, LN, 6, { occ: false }));
    for (let i = 0; i < 9; i++) {
      const t = 0.1 + i * 0.1, [x, y] = qpt(cA, cC, cB, t);
      if (i === 4) o.push(P([x - 1.6, y - 0.6, x + 1.6, y - 0.6, x + 0.4, y + 6], BN, { bv: 0.6 })); // a fang
      else o.push(E(x, y, 1.2, 1.5, BN, { ink: -0.04 }));
    }
    // the arm on the staff
    o.push(K(70, 99, 75, 78, 4.6, 3.8, SK, { ink: -0.16 }));
    o.push(E(76, 74.4, 4, 3.8, SK, { ink: -0.08 }));
    for (let i = 0; i < 4; i++) {
      const y = 70.6 + i * 2.2;
      o.push(K(74, y, 80.6, y - 0.2, 1.2, 1.1, SK, { ink: 0.04 - i * 0.04 }), K(80.6, y - 0.2, 81.6, y + 1, 0.7, 0.3, 'scr_goblinKinNail'));
    }
    // the feather, behind the skull-cap
    const fa: Pt = [-8, -19], fc: Pt = [-17, -32 + s * 0.4], fe: Pt = [-24 + s, -42];
    const vane: number[] = [], vw = (t: number): number => Math.sin(Math.PI * Math.min(1, t * 1.3));
    for (let i = 0; i <= 6; i++) { const t = i / 6, [x, y] = qpt(fa, fc, fe, t); vane.push(x - 4 * vw(t), y + 0.8 * vw(t)); }
    for (let i = 6; i >= 0; i--) { const t = i / 6, [x, y] = qpt(fa, fc, fe, t); vane.push(x + 3.2 * vw(t), y + 1.4 * vw(t)); }
    o.push(H.P(vane, 'scr_koboldShamanFeather', { bv: 1.2, ink: -0.04 }));
    for (const t of [0.42, 0.62, 0.82]) {
      const [x, y] = qpt(fa, fc, fe, t), w = vw(t);
      o.push(H.K(x - 3.6 * w, y + 0.2 + 0.7 * w, x + 2.8 * w, y - 0.8 + 1.2 * w, 0.6, 0.6, BN, { ink: -0.22, occ: false })); // its bars
    }
    o.push(H.S(fa[0], fa[1], fc[0], fc[1], fe[0], fe[1], 0.5, 0.45, BN, 4, { ink: -0.1, occ: false }));
    // the head
    head(o, H, C, f, kind);
    // war-paint: bars of bone-white run down from the eyes
    o.push(H.P([-7.6, 3.4, -5.8, 3.4, -5.4, 10.4, -7, 10.4], BN, { ink: -0.06 }), H.P([-4.4, 3.6, -2.8, 3.6, -2.6, 9.2, -4, 9.4], BN, { ink: -0.08 }));
    o.push(H.P([6.2, 1.4, 7.8, 1.2, 8, 7.4, 6.6, 7.6], BN, { ink: -0.18 }));
    // a giant rat's skull worn as a cap, bound on with linen
    o.push(H.E(-3, -15.6, 11.6, 6.8, BN, { fl: 0.2, a: -0.06 }));
    o.push(H.P([4, -20, 10, -18.6, 15.6, -15.4, 16, -13.4, 11, -12.4, 5, -13.2], BN, { bv: 1.4, ink: -0.02 }));
    o.push(H.P([13.6, -13.2, 15.4, -13.4, 15, -9.6, 14, -9.8], 'scr_goblinKinTooth', { bv: 0.4, ink: -0.1 }));
    o.push(H.E(3.6, -16, 2.6, 2.1, 'scr_goblinKinMaw'));
    o.push(H.K(-12, -16, -6, -21.4, 0.45, 0.45, BN, { ink: -0.42, occ: false }), H.K(6, -18.8, 14.4, -15.6, 0.45, 0.45, BN, { ink: 0.2, occ: false }));
    o.push(H.K(-14, -10.4, 7.6, -11.8, 1, 0.9, LN, { ink: -0.04 }));
    // light: the hellfire on the staff
    o.push(Lt(fx, fy - 4, 86, '#ff8a2c', 1.1 * fl, 14));
    return o;
  }

  if (gb) {
    // ------------------------------------------------------------ the goblin
    const BG = 'scr_gGoblin', LE = 'scr_goblinLeather', CL = 'scr_goblinClub', ID = 'scr_goblinStud';
    o.push(P(FULL, BG, { ink: BAND[1] }));
    o.push(E(46, 40, 56, 50, BG, { fl: 1, ink: BAND[2] }));
    o.push(P([-1, 30, 10, 22, 18, 40, 8, 60, -1, 64], BG, { ink: BAND[1] }), P([97, 10, 86, 2, 80, 20, 90, 34, 97, 30], BG, { ink: BAND[1] }));
    // the cook-fire of the warren, down at its feet, glowing up the rock
    o.push(E(-4, 104, 44, 50, 'scr_goblinFireGlow', { fl: 1, ink: BAND[1] }), E(-6, 104, 28, 36, 'scr_goblinFireGlow', { fl: 1, ink: BAND[2] }), E(-6, 104, 16, 26, 'scr_goblinFireGlow', { fl: 1, ink: BAND[3] }));
    // the squat body: a bull neck, shoulders as broad as the frame, a studded pauldron
    o.push(E(76, 92, 22, 14, SK, { ink: -0.32 }));
    o.push(P([-2, 99, -2, 84, 10, 74 + hb, 26, 68 + hb, 44, 66 + hb, 60, 68 + hb, 72, 74, 84, 86, 88, 99], SK, { bv: 8, ink: -0.08 }));
    o.push(K(...H.pt(-1, 14), 46, 72 + hb, 10, 12, SK, { ink: -0.14 }));
    o.push(P([14, 74 + hb, 20, 70 + hb, 66, 99, 57, 99], LE, { bv: 1.4, ink: -0.04 }));
    o.push(E(36, 84, 2.8, 2.8, ID, { ink: -0.04 }), E(36, 84, 1.3, 1.3, 'scr_goblinKinMaw'));
    // a pauldron of two riveted leather lames
    o.push(P([-2, 90, 6, 80, 17, 74 + hb, 28, 71.6 + hb, 30.4, 75.6 + hb, 20.4, 79 + hb, 10, 85.6, 2, 96], LE, { bv: 1.6, ink: -0.06 }));
    o.push(P([0, 81, 8, 73.6 + hb, 18, 69 + hb, 27.4, 67.6 + hb, 28.6, 71.4 + hb, 19.4, 74 + hb, 9.4, 79.6, 2, 87], LE, { bv: 1.6, ink: 0.04 }));
    for (const [x, y] of [[23.4, 71.4], [15, 75.2], [6.6, 80.8], [25.4, 75.8], [16.2, 79.6], [7.4, 86.2]]) o.push(E(x, y + hb, 1.1, 1.1, ID, { ink: 0.04 }));
    // the club, raised, its studs and nails
    o.push(K(80, 96, 91, 30, 2.6, 6.6, CL, { ink: -0.04 }));
    o.push(K(82, 74, 89, 36, 0.5, 0.6, CL, { ink: -0.4, occ: false })); // a split in it
    for (const [t, w] of [[0.62, -3], [0.7, 2.6], [0.8, -2.2], [0.88, 3.4], [0.94, -0.6], [0.76, 0.4]]) {
      const x = 80 + 11 * t + w, y = 96 - 66 * t;
      o.push(E(x, y, 1.1, 1.1, ID, { ink: 0.06 }));
    }
    o.push(K(95.4, 38, 99, 36, 0.5, 0.3, ID), K(85.6, 32, 82, 29, 0.5, 0.3, ID));
    // the arm and the fist on the haft
    o.push(K(70, 99, 79, 86, 6.4, 5.2, SK, { ink: -0.06 }));
    o.push(E(81, 84, 5, 4.6, SK, { ink: -0.02 }));
    for (let i = 0; i < 4; i++) {
      const y = 79.6 + i * 2.6;
      o.push(K(78.6, y, 85.6, y - 0.6, 1.5, 1.4, SK, { ink: 0.04 - i * 0.04 }), K(85.6, y - 0.6, 86.6, y + 0.8, 0.8, 0.3, 'scr_goblinKinNail'));
    }
    head(o, H, C, f, kind);
    // a scar over the brow, an iron ring in the ear
    o.push(H.K(-7.6, -13, -3.4, -4.6, 0.5, 0.45, SK, { ink: 0.18, occ: false }));
    o.push(H.E(-22, 2.4, 1.8, 2.2, ID, { ink: 0 }), H.E(-22, 2.4, 0.9, 1.3, BG, { ink: BAND[1] }));
    // light: the fire below, on the underside of its face; a little in its eyes
    o.push(Lt(-4, 108, 108, '#ff9040', 0.85 * fl, 18));
    o.push(H.Lt(-5, 0.6, 6, '#ffb030', 0.35, 2), H.Lt(6.8, -1.2, 5, '#ffb030', 0.3, 2));
    return o;
  }

  // -------------------------------------------------------------- the skraeling
  const BG = 'scr_gSkraeling', FU = 'scr_skraelingFur', FD = 'scr_skraelingFurDark', RI = 'scr_skraelingRime', IC = 'scr_skraelingIce';
  // night in the Rime Hollows: the dark ice of the roof, its icicles, the spear's cold light on the far wall
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(84, 22, 36, 34, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(87, 16, 17, 18, BG, { fl: 1, ink: BAND[3] }));
  for (const [x, l, w] of [[8, 14, 3], [17, 8, 2], [28, 18, 3.2], [58, 10, 2.4], [70, 20, 3], [94, 16, 3]]) o.push(P([x - w, -1, x + w, -1, x + 0.3, l], BG, { ink: x > 60 ? BAND[3] : BAND[2] }));
  for (let i = 0; i < 10; i++) {
    const y = (hash2(i, 71) * 96 + f * (1.6 + (i % 3) * 0.5)) % 96, x = hash2(i, 73) * 96 + Math.sin(y * 0.15 + i) * 1.5;
    o.push(X(x, y, 0.8, 0.8, BG + ':' + (i % 3 ? 3 : 4), { em: true }));
  }
  // the spear, upright, its knapped ice point burning cold
  const sx = 87;
  o.push(K(sx + 0.6, 99, sx, 32, 1.8, 1.6, 'scr_skraelingShaft', { ink: -0.04 }));
  o.push(P([sx, 34, sx - 3.6, 26, sx - 2.4, 16, sx + 0.4, 4, sx + 2.8, 15, sx + 3.8, 25], IC, { ink: -0.28 }));
  o.push(P([sx, 34, sx - 3.6, 26, sx - 2.4, 16, sx + 0.4, 4, sx + 0.4, 22], IC, { ink: -0.06 * fl }));
  o.push(K(sx - 1.6, 24, sx + 0.2, 8, 0.5, 0.5, IC, { ink: 0.2, occ: false }));
  for (let i = 0; i < 3; i++) o.push(K(sx - 2.2, 33 + i * 1.6, sx + 2.2, 34 + i * 1.6, 0.6, 0.6, 'scr_skraelingThong'));
  // the shaggy hunched shoulders, the dark fur hanging in tiers, rime only on the tips
  const top = furEdge([-2, 64], [30, 58], [66, 76], 10, 5, -1, 57, 0.2);
  o.push(P([...furEdge([-2, 63], [30, 57], [66, 75], 10, 5.8, -1, 57, 0.2), 70, 99, -2, 99], FU, { bv: 0.8, ink: -0.14 }));
  o.push(P([...top, 70, 99, -2, 99], FD, { bv: 1.4, ink: -0.44 }));
  o.push(P([...top, ...furEdge([68, 92], [30, 82], [-2, 90], 11, 6.4, -1, 51, 0.15)], FD, { bv: 1.4, ink: -0.34 }));
  o.push(P([...top, ...furEdge([66, 82], [30, 72], [-2, 77], 11, 6, -1, 61, 0.15)], FD, { bv: 1.4, ink: -0.24 }));
  // a shadow under the jaw; the far ear; the head
  o.push(H.E(1, 17, 9, 4.6, FD, { ink: -0.4 }));
  const tw = [0, 0, 1, 0][f % 4];
  ear(o, H, C.far, [C.far.t[0], C.far.t[1] - tw], SK, -0.3, 0);
  for (const [x, l] of [[18, 2.6], [15, 3.2]]) o.push(H.P([x - 0.8, -5.6 + (18 - x) * 0.3, x + 0.8, -5.4 + (18 - x) * 0.3, x, -5.4 + (18 - x) * 0.3 + l], RI, { ink: -0.2 }));
  head(o, H, C, f, kind);
  // its hackles: stiff dark fur bristling from the brow back over the crown and
  // down the neck, every bristle frozen white at the tip
  const S0: Pt = [8, -12], S1: Pt = [-22, -34], S2: Pt = [-18, 12];
  const back: number[] = []; for (let i = 8; i >= 0; i--) { const [x, y] = qpt(S0, [-10, -22], S2, i / 8); back.push(x, y); }
  o.push(H.P([...furEdge(S0, S1, S2, 14, 6, 1, 7, 0.8), ...back], FU, { bv: 1.2, ink: 0 }));
  o.push(H.P([...furEdge(S0, S1, S2, 14, 4.6, 1, 7, 0.8), ...back], FD, { bv: 2, ink: -0.34 }));
  // the near ear, out through the fur, icicles off its edge
  ear(o, H, C.ear, [C.ear.t[0] - tw * 0.4, C.ear.t[1] - tw], SK, -0.16, 0);
  for (const [x, y, l] of [[-24, 7.2, 3.4], [-19, 5.6, 2.6]]) o.push(H.P([x - 0.9, y - 0.4, x + 0.9, y - 0.6, x, y + l], RI, { ink: -0.16 }));
  for (const [x, y] of [[-12.6, 4], [-11.4, 10]]) o.push(H.P([x - 2.4, y - 2.6, x + 1.4, y - 2.6, x + 1.6, y + 1.6, x + 0.6, y + 5], FD, { bv: 1, ink: -0.3 })); // fur down the cheek
  // the arm, furred to the wrist; the hand on the shaft
  o.push(P([...furEdge([58, 99], [62, 80], [80, 68], 8, 2.2, -1, 23, 0.3), 88, 76, 84, 99], FD, { bv: 3, ink: -0.24 }));
  o.push(E(85, 72, 3.8, 3.6, SK, { ink: -0.04 }));
  for (let i = 0; i < 4; i++) {
    const y = 68.4 + i * 2.1;
    o.push(K(83, y, 89.4, y - 0.2, 1.1, 1, SK, { ink: 0.04 - i * 0.04 }), K(89.4, y - 0.2, 90.6, y + 1.2, 0.7, 0.25, 'scr_goblinKinNail'));
  }
  // light: the ice spear's point; a little more in its eyes
  o.push(Lt(sx, 18, 56, '#9fe6ff', 0.8 * fl, 14));
  o.push(H.Lt(-5, 0.4, 5, '#bff4ff', 0.35, 2), H.Lt(6.8, -1.4, 4.4, '#bff4ff', 0.3, 2));
  return o;
}

/** Every drawn primitive of a tree, in draw order. */
function drawn(list: PrimTree, out: Prim[] = []): Prim[] {
  for (const p of list) {
    if (!p) continue;
    if (Array.isArray(p)) drawn(p as PrimTree, out);
    else out.push(p as Prim);
  }
  return out;
}

/** The scene, with the skin a shade darker (C.dk) so that its one light models it. */
function goblin(f: number, kind: Kind): PrimTree {
  const o = scene(f, kind), C = KIN[kind];
  if (C.dk) for (const p of drawn(o)) if ('m' in p && p.m === C.SK) p.ink = (p.ink || 0) + C.dk;
  return o;
}

/** The little trickster of the Sunken Cistern caught in your torchlight: horn-nubs, great swept ears, a sly sneer of needle teeth, its dagger held out at arm's length. */
export function koboldPortrait(f: number): PrimTree {
  return goblin(f, 'kobold');
}

/** A rust-skinned kobold chanting up at the hellfire in the fork of its staff: a rat's skull for a cap, a barred feather, bone-white paint. */
export function koboldShamanPortrait(f: number): PrimTree {
  return goblin(f, 'shaman');
}

/** The squat green goblin of the warrens, lit from below by its cook-fire: notched ears, a hooked warty nose, a jagged grin with two tusks, a studded club raised. */
export function goblinPortrait(f: number): PrimTree {
  return goblin(f, 'goblin');
}

/** A frost-goblin of the Rime Hollows: pale frost eyes, needle teeth, dark hackles frozen white at the tip, an ice spear burning cold. */
export function skraelingPortrait(f: number): PrimTree {
  return goblin(f, 'skraeling');
}
