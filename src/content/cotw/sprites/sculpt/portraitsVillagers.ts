import { E, K, P, X, Lt, arc, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/*
 * The villagers who come home to Bjarnarhaven: the raid's three (Eir, Sigrun, Brandr) and the
 * Siphon Altar's four captives (Ingrid, Torstein, Sigrid, Leif), each at home and at their trade,
 * unbound. Each wears their map sprite's clothes and colours (villagers.ts). Conventions: portraitKit.ts.
 */

/** A head frame: local units around (px, py), scaled by k (the face is drawn once, sized after). */
function hf(px: number, py: number, k: number) {
  const x = (v: number) => px + v * k, y = (v: number) => py + v * k;
  return {
    pt: (a: number, b: number): Pt => [x(a), y(b)],
    E: (cx: number, cy: number, rx: number, ry: number, m: string, o?: PrimOptions) => E(x(cx), y(cy), rx * k, ry * k, m, o),
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => K(x(x1), y(y1), x(x2), y(y2), r1 * k, r2 * k, m, o),
    P: (pts: number[], m: string, o: PrimOptions = {}) => P(pts.map((v, i) => (i % 2 ? y(v) : x(v))), m, o.bv ? { ...o, bv: o.bv * k } : o),
    X: (a: number, b: number, w: number, h: number, m: string, o?: PrimOptions) => X(x(a), y(b), w * k, h * k, m, o),
    S: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n: number, o?: PrimOptions) => strand(x(ax), y(ay), x(bx), y(by), x(cx), y(cy), r0 * k, r1 * k, m, n, o),
  };
}
type Head = ReturnType<typeof hf>;
type Face = [number, number, number, number];

/** Points along an ellipse from angle a0 to a1 (y down), pulled in by `inset`. */
function rim(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, inset = 0.3): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push(cx + Math.cos(a) * (rx - inset), cy + Math.sin(a) * (ry - inset)); }
  return out;
}

/** A flat shadow plane on a face: its outer edge follows the contour from a0 to a1, its inner edge (the terminator) by hand. */
const shade = (H: Head, face: Face, a0: number, a1: number, inner: number[], m: string, ink: number) => H.P([...rim(...face, a0, a1, 8), ...inner], m, { ink, fl: 1 });

interface EyeSet { SK: string; WH: string; IR: string; LA: string; glint?: string }

/**
 * Two eyes looking right (the near one larger), Astrid's build: the socket, the white, the iris
 * and pupil, a glint and the lash line; `lid` lowers the upper lid over the iris (calm, kind, old).
 */
function eyes(H: Head, pair: Array<[number, number, number, number]>, m: EyeSet, blink: boolean, socket = -0.14, lid = 0): Out {
  const o: Out = [];
  for (const [x, y, w, k] of pair) {
    o.push(H.E(x, y, w + 0.8, 2, m.SK, { fl: 0.8, ink: socket }));
    if (blink) { o.push(H.K(x - w - 0.2, y + 0.4, x + w + 0.8, y + 0.2, 0.45, 0.35, m.LA)); continue; }
    o.push(H.E(x, y + 0.2, w, 1.2 * k, m.WH, { ink: -0.06 }));
    o.push(H.E(x + 0.6 * k, y + 0.2, 1.2 * k, 1.2 * k, m.IR));
    o.push(H.X(x + 0.3 * k, y - 0.3, 0.9, 1, `${m.LA}:1`));
    o.push(H.X(x + 0.1, y - 0.6, 0.6, 0.6, m.glint ?? '#fff6e6', { em: true }));
    const ly = lid * 0.7;
    if (lid) o.push(H.P([x - w - 0.4, y - 1.6, x + w + 0.9, y - 1.4, x + w + 0.7, y - 1 + ly, x - w - 0.2, y - 0.4 + ly], m.SK, { ink: -0.06 }));
    o.push(H.K(x - w - 0.2, y + 0.4, x + w * 0.2, y - 1 + ly, 0.5, 0.45, m.LA), H.K(x + w * 0.2, y - 1 + ly, x + w + 0.8, y - 0.6 + ly, 0.45, 0.35, m.LA));
  }
  return o;
}

/**
 * An open smile from x0 to x1 under the line y, `d` deep: a crescent with its corners turned up, the
 * upper teeth a band under the top lip that stops short of the dark corners, the lower lip's light under it.
 */
function smile(H: Head, x0: number, x1: number, y: number, d: number, MO: string, TE: string, SK: string): Out {
  const xm = (x0 + x1) / 2 - 0.4;
  return [
    H.P([x0, y - 1.2, xm, y + 0.2, x1, y - 1.4, x1 - 1, y + d * 0.5, xm + 0.6, y + d, x0 + 1.4, y + d * 0.55], MO),
    H.P([x0 + 1.2, y - 0.5, xm, y + 0.7, x1 - 1.2, y - 0.7, x1 - 1.8, y + 0.5, xm, y + 1.6, x0 + 1.8, y + 0.5], TE),
    H.E(xm + 0.4, y + d + 1.2, (x1 - x0) * 0.24, 0.8, SK, { fl: 0.6, ink: 0.06 }),
  ];
}

/** A hand closed round something running up through (x, y): the back of the hand and three fingers across. */
function grip(x: number, y: number, m: string, k = 1, ink = 0): Out {
  const o: Out = [E(x + 0.6 * k, y + 0.4 * k, 4.4 * k, 4 * k, m, { fl: 0.3, ink: ink - 0.04 })];
  for (let i = 0; i < 3; i++) o.push(K(x - 3 * k, y - 1.8 * k + i * 1.9 * k, x + 2.2 * k, y - 1.4 * k + i * 2 * k, 1 * k, 0.95 * k, m, { ink: ink + (i % 2 ? -0.02 : 0.05) }));
  return o;
}

/**
 * Eir the Acolyte, home at the temple: young and calm, dark hair bound back under a linen
 * band, the grey-blue mantle over the temple's undyed robe. She holds a sheaf of healing herbs
 * to her breast, and her clay broth-flask (the one she gave the hero) hangs at her side on its
 * cord. The temple's hanging lamp lights her gold from above: gold, the colour of the holy.
 */
export function eirPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.9, 1.1, 0.95][f % 4];
  const o: Out = [];
  const GR = 'scr_gEir', HA = 'scr_eirHalo', SK = 'scr_eirSkin', HR = 'scr_eirHair', RB = 'scr_eirRobe', MA = 'scr_eirMantle', HB = 'scr_eirHerb';
  const lx = 80, ly = 25; // the lamp's flame
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(58, 48, 66, 62, GR, { fl: 1, ink: BAND[2] }));
  // a carved post of the temple at the left, banded in knotwork
  o.push(P([-1, -1, 10, -1, 10, 97, -1, 97], GR, { ink: BAND[1] + 0.06 }));
  o.push(P([7, -1, 10, -1, 10, 97, 7, 97], GR, { ink: BAND[2] }));
  for (const y of [12, 50]) {
    o.push(P([-1, y, 11, y, 11, y + 7, -1, y + 7], GR, { ink: BAND[2] + 0.04 }));
    for (let i = 0; i < 4; i++) o.push(K(i * 3 - 0.6, y + 6, i * 3 + 1.6, y + 1, 0.5, 0.5, GR, { ink: BAND[1], fl: 1, occ: false }));
  }
  // the lamp's halo, and its three chains from the roof
  o.push(E(lx, ly, 26, 25, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(lx, ly, 15, 14, HA, { fl: 1, ink: BAND[2] }));
  for (const x of [-6.4, 0, 6.4]) o.push(K(lx + x * 0.3, -1, lx + x, ly + 2.4, 0.5, 0.5, 'blackIron', { fl: 0.6, occ: false }));

  const by = -b * 0.45;
  const H = hf(46, 44 + by, 1.3);
  // the back of her head, the hair gathered at the nape into the braid
  o.push(H.E(-6.4, 0.6, 8.6, 11.6, HR, { fl: 0.2, ink: -0.3 }));
  o.push(H.E(-10.6, 8, 3.4, 4.2, HR, { fl: 0.2, ink: -0.2 }));
  o.push(H.S(-11.4, 10.6, -13.4, 16, -12.6 + s * 0.15, 21, 2.2, 1.6, HR, 4, { ink: -0.26 }));
  // the white robe of the temple
  o.push(P([4, 97, 9, 84, 22, 75, 36, 70 + by, 58, 70 + by, 70, 74, 82, 84, 88, 97], RB, { bv: 5, n: [0, -0.12, 1] }));
  // the hood, down, bunched behind her neck
  o.push(E(37, 69 + by, 17, 7, MA, { fl: 0.3, ink: -0.24 }));
  // the neck
  o.push(H.P([-5.2, 6, 2.8, 8, 3, 21, -6.4, 21], SK, { n: [0.1, -0.1, 1], ink: -0.1 }));
  o.push(H.P([-5.2, 6, -2.6, 8, -3.4, 21, -6.4, 21], SK, { ink: -0.26 }));
  o.push(H.E(0.6, 13.6, 5.2, 2.6, SK, { fl: 1, ink: -0.3 }));
  // the robe's round collar at the throat, and the mantle over her shoulders, open down the front
  o.push(strand(36, 71.6 + by, 45, 78.4, 54, 71.6 + by, 0.9, 0.9, RB, 4, { ink: -0.14 }));
  o.push(P([-1, 97, -1, 84, 8, 76, 22, 71, 34, 69 + by, 37, 77, 35, 88, 31, 97], MA, { bv: 3.4, n: [0, -0.1, 1] }));
  o.push(P([56, 69 + by, 70, 71, 84, 77, 97, 84, 97, 97, 62, 97, 58, 87, 54, 77], MA, { bv: 3.4, n: [0, -0.1, 1] }));
  for (const [x0, y0, x1, y1] of [[18, 76, 14, 92], [28, 73, 25, 92], [66, 74, 70, 92], [78, 78, 86, 92]]) o.push(K(x0, y0, x1, y1, 0.7, 1.1, MA, { ink: -0.3, occ: false })); // its folds
  o.push(K(44, 84, 46, 97, 0.6, 0.9, RB, { ink: -0.22, occ: false })); // the robe's fold
  // the cord of the broth-flask over the far shoulder, the flask at her side
  o.push(K(58, 71 + by, 76, 86, 0.55, 0.55, 'leatherDark', { occ: false }));
  o.push(E(77, 92, 6.4, 6.8, 'scr_eirClay', { fl: 0.15 }));
  o.push(K(77, 86, 77, 83, 2.2, 2, 'scr_eirClay', { ink: 0.02 }));
  o.push(E(77, 82.4, 2.4, 1.1, 'scr_eirClay', { fl: 0.4, ink: -0.2 }));
  o.push(K(77, 82, 77, 80, 1.4, 1.5, 'woodDark'));
  o.push(K(72, 90, 82, 90, 0.5, 0.5, 'leatherDark', { occ: false })); // its sling

  // the face: a young oval, a soft chin, the near side away from the lamp
  const FACE: Face = [0, 0, 10, 12.4];
  o.push(H.E(1.8, 6.4, 7.2, 6.6, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.6 * Math.PI, [-3.2, 9.8, -4.6, 6.6, -5.6, 3.6, -6.4, 1.4, -6.4, -2.2, -7.2, -6.4], SK, -0.12));
  o.push(H.E(-4.6, 4.2, 1.8, 1.1, 'scr_eirBlush', { fl: 0.6, ink: 0.04, occ: false }));
  o.push(H.E(6, 3.8, 1.8, 1.3, 'scr_eirBlush', { fl: 0.6, occ: false }));
  // the eyes: grey-blue, the lids lowered, kind
  const blink = f === 1;
  o.push(eyes(H, [[-3.6, -0.6, 2.5, 1], [4.8, -0.8, 2, 0.84]], { SK, WH: 'scr_eirWhite', IR: 'scr_eirIris', LA: 'scr_eirLash' }, blink, -0.14, 0.6));
  // brows: dark, soft arcs
  o.push(H.K(-7, -3.4, -3.6, -4.8, 0.6, 0.55, HR), H.K(-3.6, -4.8, -0.8, -4.2, 0.55, 0.4, HR));
  o.push(H.K(2.8, -4, 7.4, -3.8, 0.55, 0.4, HR));
  // the nose: small and straight
  o.push(H.P([0.8, -2.2, 1.9, -2.2, 3.6, 2.6, 4.8, 4.2, 3.8, 5.4, 2.4, 5, 2, 3.2, 1.2, 0.2], SK, { fl: 1, ink: -0.14 }));
  o.push(H.E(4, 4, 1.4, 1.1, SK, { fl: 0.6, ink: -0.04 }));
  o.push(H.K(2.8, 5.2, 3.8, 5.3, 0.4, 0.35, SK, { ink: -0.34 }));
  // the mouth: closed in a gentle smile
  o.push(H.S(-0.6, 7, 2.4, 8.2, 5, 7.2, 0.6, 0.45, 'scr_eirLip', 3, { ink: -0.08, occ: false }));
  o.push(H.E(2.4, 9.4, 1.7, 0.8, 'scr_eirLip', { fl: 0.3, ink: 0.06, occ: false }));
  o.push(H.S(-0.8, 6.8, 2.2, 9, 5.2, 7.3, 0.4, 0.32, 'scr_eirLash', 4, { ink: -0.16 }));
  o.push(H.E(2.6, 11.1, 1.5, 0.6, SK, { fl: 1, ink: -0.1 }));
  // hair: dark, smooth from the parting, drawn down past the ear and back
  o.push(H.P([-9.8, 6, -11, -5, -7, -12.4, 0, -14.4, 6.6, -12.6, 10, -7.6, 10, -4.6, 6.6, -7, 2.4, -8.2, -2, -7.4, -6, -4.8, -7.6, 0, -8, 5], HR, { bv: 3 }));
  for (const [a, c, e] of [[[1, -13.6], [-6, -10.6], [-9.4, -1]], [[4.6, -12], [-1, -9.4], [-6.4, -4.4]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.4, 0.36, HR, 3, { ink: 0.12 }));
  // the linen band round her brow, knotted at the nape
  o.push(H.S(-9.4, -2.6, -1.4, -10.2, 9.8, -6.6, 1, 0.9, 'scr_eirBand', 6, { ink: 0.02 }));
  o.push(H.E(-10.2, -1.6, 1.6, 1.4, 'scr_eirBand', { ink: -0.08 }));

  // the near hand at her breast, the sheaf of herbs in it, yellow flowers among the leaves
  o.push(K(2, 99, 14, 91, 6.4, 5.2, RB, { ink: -0.08 }));
  const stems: Array<[number, number, number]> = [[22, 62, 0.4], [28, 60, -0.3], [34, 64, 0.2], [17, 66, -0.5], [38, 70, 0.6]];
  for (const [tx, ty] of stems) o.push(K(21, 92, tx + s * 0.3, ty + 3, 0.6, 0.5, HB, { ink: -0.12, occ: false }));
  for (const [tx, ty, a] of stems) {
    const x = tx + s * 0.3;
    for (const t of [0.3, 0.55, 0.8]) {
      const lxp = 21 + (x - 21) * t, lyp = 92 + (ty + 3 - 92) * t;
      o.push(E(lxp + (t % 0.5 ? 1.8 : -1.8), lyp, 2.4, 1.1, HB, { a: a + (t % 0.5 ? -0.5 : 0.5), fl: 0.3, ink: t * 0.08 }));
    }
    o.push(E(x, ty + 1, 1.6, 1.4, 'scr_eirFlower', { fl: 0.3 }));
    o.push(E(x + 0.3, ty + 0.7, 0.6, 0.6, 'scr_eirFlower', { ink: 0.2 }));
  }
  o.push(K(17.6, 84, 24.6, 85, 0.7, 0.7, 'scr_eirBand')); // the tie round the stems
  o.push(grip(21, 89, SK, 1));
  // the lamp: a bronze bowl on its chains, the flame standing in it
  o.push(P([lx - 7, ly + 2.4, lx + 7, ly + 2.4, lx + 4.4, ly + 6.6, lx - 4.4, ly + 6.6], 'bronze', { bv: 1.2 }));
  o.push(K(lx - 7.4, ly + 2.4, lx + 7.4, ly + 2.4, 0.7, 0.7, 'bronze', { ink: 0.1 }));
  o.push(E(lx, ly + 7.8, 1.2, 1.4, 'bronze'));
  o.push(E(lx, ly - 1.4, 1.9 * fl, 3.8 * fl, 'scr_eirFlame'));
  o.push(E(lx, ly - 0.4, 0.9, 1.8 * fl, 'scr_eirFlameCore'));
  o.push(Lt(lx - 1, ly, 80, '#ffe2a6', 1.05 * fl, 12));
  return o;
}

/**
 * Sigrun, Olaf's daughter, in her father's store: his flaxen hair in a braid over her shoulder
 * and his red wool for a headscarf, his round rosy cheeks, a madder dress under a linen apron.
 * She holds up a lit tallow candle on its iron dish (the chandler's trade), its light warm on her face.
 */
export function sigrunPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.84, 1.12, 0.93][f % 4];
  const o: Out = [];
  const GR = 'scr_gSigrun', HA = 'scr_sigrunHalo', SK = 'scr_sigrunSkin', RU = 'scr_sigrunRuddy', HR = 'scr_sigrunHair', SC = 'scr_sigrunScarf', DR = 'scr_sigrunDress';
  const cx = 73, cy = 57; // the candle's flame
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(52, 48, 64, 60, GR, { fl: 1, ink: BAND[2] }));
  o.push(E(cx, cy, 25, 25, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(cx, cy, 14, 14, HA, { fl: 1, ink: BAND[2] }));
  // her father's shelves: crocks and jars at the upper left
  for (const [y, items] of [[20, [[5, 4, 7], [14, 3, 10], [22, 4.6, 6], [31, 3.2, 8]]], [44, [[4, 3.6, 8], [12, 4.4, 6]]]] as Array<[number, number[][]]>) {
    o.push(K(-1, y, 36, y, 1.2, 1.2, GR, { ink: BAND[2] + 0.06, fl: 1 }));
    for (const [x, w, h] of items) {
      o.push(E(x, y - 1 - h / 2, w, h / 2, GR, { fl: 1, ink: BAND[3] - 0.1 }));
      o.push(K(x - w * 0.5, y - 1.6 - h, x + w * 0.5, y - 1.6 - h, 0.8, 0.8, GR, { ink: BAND[3] - 0.06, fl: 1 }));
    }
  }

  const by = -b * 0.45;
  const H = hf(43, 44 + by, 1.34);
  // the scarf's knot at her nape, its tails hanging
  o.push(H.E(-10.4, 5, 3.4, 3, SC, { fl: 0.2, ink: -0.2 }));
  o.push(H.S(-11, 6.6, -13.4, 12, -12.8 + s * 0.2, 17, 1.6, 1.1, SC, 3, { ink: -0.24 }));
  o.push(H.S(-9.6, 7, -10.6, 12, -9.6 + s * 0.2, 16, 1.4, 1, SC, 3, { ink: -0.16 }));
  // the madder dress, the apron's bib over it
  o.push(P([2, 97, 6, 84, 18, 76, 32, 71 + by, 54, 71 + by, 68, 75, 80, 84, 86, 97], DR, { bv: 5, n: [0, -0.12, 1] }));
  o.push(P([30, 83, 58, 83, 61, 97, 27, 97], 'scr_sigrunApron', { bv: 1.6, ink: -0.04 }));
  o.push(K(31, 83, 34, 73 + by, 1.1, 1, 'scr_sigrunApron', { ink: -0.08 }), K(57, 83, 55, 73 + by, 1.1, 1, 'scr_sigrunApron', { ink: -0.08 }));
  // the neck, and the dress's round neckline
  o.push(H.P([-5.4, 6, 2.8, 8, 3, 20, -6.4, 20], SK, { n: [0.1, -0.1, 1], ink: -0.1 }));
  o.push(H.E(0.4, 13.4, 5.4, 2.6, SK, { fl: 1, ink: -0.3 }));
  o.push(P([33, 71 + by, 53, 71 + by, 50, 76, 43, 78, 36, 76], SK, { bv: 2.4, ink: -0.06 }));
  o.push(K(33, 71.4 + by, 36, 76, 0.7, 0.7, DR, { ink: -0.2 }), K(36, 76, 43, 78, 0.7, 0.7, DR, { ink: -0.2 }), K(43, 78, 50, 76, 0.7, 0.7, DR, { ink: -0.2 }), K(50, 76, 53, 71.4 + by, 0.7, 0.7, DR, { ink: -0.2 }));

  // the face: round, ruddy, her father's apple cheeks
  const FACE: Face = [0, 0, 11, 12.2];
  o.push(H.E(1.4, 6, 8.4, 6.8, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.6 * Math.PI, [-3.6, 9.4, -5.4, 6, -6.6, 2.6, -7.4, -1.4, -8, -6.4], SK, -0.12));
  o.push(H.E(-5.4, 4.2, 3.6, 2.4, RU, { fl: 0.5, ink: -0.06, occ: false }));
  o.push(H.E(6.6, 3.8, 2.6, 2, RU, { fl: 0.5, occ: false }));
  // the eyes: blue, wide, smiling
  const blink = f === 3;
  o.push(eyes(H, [[-4, -1, 2.5, 1], [5, -1.2, 2, 0.84]], { SK, WH: 'scr_sigrunWhite', IR: 'scr_sigrunIris', LA: 'scr_sigrunLash', glint: '#fff4e0' }, blink));
  for (const [x, w] of [[-4, 2.5], [5, 2]]) o.push(H.K(x - w * 0.7, 1.6, x + w * 0.8, 1.4, 0.35, 0.3, SK, { ink: -0.22 })); // the smile under them
  // brows: flaxen, lifted
  o.push(H.K(-7.4, -4.4, -1.6, -5.6, 0.7, 0.55, HR, { ink: -0.08 }));
  o.push(H.K(2.8, -5.4, 7.6, -4.8, 0.6, 0.45, HR, { ink: -0.04 }));
  // the nose: short, turned up
  o.push(H.P([0.6, -2.6, 1.8, -2.6, 3.6, 2, 4.6, 3.4, 3.6, 4.4, 2.2, 4, 1.8, 2.4, 1, 0], SK, { fl: 1, ink: -0.14 }));
  o.push(H.E(3.8, 3.4, 1.6, 1.3, SK, { fl: 0.5, ink: 0.02 }));
  o.push(H.K(2.6, 4.4, 3.6, 4.6, 0.4, 0.35, 'scr_sigrunMouth', { ink: 0.1 }));
  // the mouth: an open, glad smile
  o.push(smile(H, -1.4, 6.8, 7.6, 2.6, 'scr_sigrunMouth', 'scr_sigrunTeeth', SK));
  // the headscarf over her crown, its edge folded back, a flaxen fringe under it
  o.push(H.P([-8.6, -1.6, -2.4, -7, 3.4, -7.6, 8.6, -5.2, 7.6, -3.6, 3, -5, -2, -4.6, -7.4, 0.6], HR, { bv: 1.4 }));
  for (const x of [-5.4, -2, 1.6, 4.8]) o.push(H.K(x, -6.6, x - 1, -4, 0.35, 0.3, HR, { ink: -0.22 }));
  o.push(H.P([-11.6, 6, -12.4, -4, -8.6, -12.4, -1, -15.6, 6.6, -13.6, 11, -8, 11.4, -4.4, 8.6, -5.6, 3, -7.4, -2.6, -7, -8.4, -2, -9.4, 5], SC, { bv: 3 }));
  o.push(H.S(-9.6, 1, -4.4, -8.4, 10.4, -5.6, 1.1, 1.1, SC, 6, { ink: 0.08 })); // the folded edge
  for (const [a, c, e] of [[[-2, -14.4], [-8, -10], [-10.6, -2]], [[5, -13], [1, -11], [-4, -8.4]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.4, 0.36, SC, 3, { ink: -0.26 }));
  // the braid, forward over her shoulder, tied with red wool
  const bw = s * 0.25;
  const ba = H.pt(-8.6, 5), bc = H.pt(-11, 17), be: Pt = [ba[0] - 2 + bw, ba[1] + 32];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, [x, y] = qpt(ba, bc, be, t);
    const r = 2.8 - t * 0.7;
    o.push(E(x - 0.8, y, r * 1.05, r * 0.52, HR, { a: 0.62, fl: 0.15, ink: 0.02 }), E(x + 0.8, y + 1.4, r * 1.05, r * 0.52, HR, { a: -0.62, fl: 0.15, ink: -0.12 }));
  }
  o.push(K(be[0] - 1.6, be[1] + 1.6, be[0] + 1.6, be[1] + 1.6, 1.2, 1.2, SC));
  o.push(P([be[0] - 1.4, be[1] + 2.6, be[0] + 1.4, be[1] + 2.6, be[0] + 2 + bw, be[1] + 7, be[0] + bw, be[1] + 5.6, be[0] - 2 + bw, be[1] + 7], HR, { bv: 0.8 }));

  // the far hand under the candle's dish, the near hand cupped round the flame
  o.push(K(99, 99, 88, 84, 6.4, 5.4, DR, { ink: -0.08 }));
  o.push(K(88, 84, cx + 2, 75, 5.4, 4.2, DR, { ink: -0.02 }));
  o.push(E(cx + 1, 74, 5, 3.2, SK, { fl: 0.3 }));
  o.push(E(cx, 70.6, 6.6, 1.8, 'blackIron', { fl: 0.4 }));
  o.push(K(cx, 70, cx, 62, 2.4, 2.3, 'scr_sigrunTallow', { ink: -0.04 }));
  o.push(E(cx + 0.3, 62.2, 2.1, 0.8, 'scr_sigrunTallow', { fl: 0.6, ink: 0.06 }));
  o.push(K(cx + 0.2, 61.8, cx + 0.2, 60.6, 0.4, 0.4, 'blackIron', { occ: false }));
  o.push(E(cx + 0.4, cy, 1.8 * fl, 3.6 * fl, 'emFire'));
  o.push(E(cx + 0.4, cy + 0.9, 0.9, 1.7 * fl, 'emFireCore'));
  o.push(Lt(cx - 1, cy, 70, '#ffa850', 1.05 * fl, 9));
  return o;
}

/**
 * Brandr, Gunther's apprentice, back at the forge: a lanky lad with a shock of red hair and no
 * beard yet, soot on his cheek, a scorched apron over his grey shirt, the sleeves rolled. He
 * holds up the rime-bit chisel ("Gunther still owes me a chisel"), its frosted edge winking
 * cyan; the forge mouth at his left lights him ember orange.
 */
export function brandrPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.1, 0.92, 1.06][f % 4];
  const glint = [0.4, 0.7, 1, 0.7][f % 4];
  const o: Out = [];
  const GR = 'scr_gBrandr', HA = 'scr_brandrHalo', SK = 'scr_brandrSkin', HR = 'scr_brandrHair', SH = 'scr_brandrShirt', AP = 'scr_brandrApron';
  const fx0 = 2, fy0 = 88; // the forge's heart
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(52, 46, 62, 58, GR, { fl: 1, ink: BAND[2] }));
  // tongs and a hammer hung on their rail, at the upper right
  const wall = { ink: BAND[2] + 0.04, fl: 1 };
  o.push(K(60, 10, 99, 10, 1, 1, GR, wall));
  for (const x of [70, 82]) o.push(K(x, 10, x - 1.4, 34, 0.8, 0.7, GR, wall), K(x + 1.6, 10, x + 3, 34, 0.8, 0.7, GR, wall));
  o.push(K(92, 10, 92, 30, 0.8, 0.8, GR, wall), K(88.6, 30, 95.4, 30, 2, 2, GR, wall));
  // the forge mouth at the lower left: its halo, the stone arch, the coals
  o.push(E(fx0, fy0, 40, 40, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(fx0, fy0, 24, 24, HA, { fl: 1, ink: BAND[2] }));
  o.push(P([-1, 70, 6, 66, 14, 70, 18, 80, 18, 97, -1, 97], GR, { ink: BAND[2] - 0.06 }));
  o.push(P([-1, 76, 5, 73, 11, 77, 13, 86, 13, 97, -1, 97], 'scr_brandrCoal', { ink: -0.62 }));
  for (const [x, y, r] of [[3, 92, 3.4], [9, 94, 2.8], [6, 86, 2.2], [-1, 86, 2.6]]) o.push(E(x, y, r, r * 0.7, 'scr_brandrCoal', { ink: -0.32 + (hash2(x, f) - 0.5) * 0.2 }));
  for (let i = 0; i < 3; i++) { const y = 70 - ((f * 5 + i * 9) % 26), x = 8 + i * 4 + Math.sin(f + i * 2) * 1.4; o.push(X(x, y, 1, 1, i % 2 ? 'scr_brandrCoal:4' : 'emFireCore:4', { em: true })); }

  const by = -b * 0.5;
  const H = hf(49, 45 + by, 1.25);
  // the grey shirt over lanky shoulders, the scorched apron and its strap
  o.push(P([12, 97, 16, 85, 28, 76, 40, 70 + by, 58, 70 + by, 68, 74, 78, 83, 84, 97], SH, { bv: 5, n: [0, -0.12, 1] }));
  o.push(H.P([-4.6, 6, 3, 8.4, 3.2, 21, -5.6, 21], SK, { n: [-0.1, -0.1, 1], ink: -0.06 })); // the neck
  o.push(H.P([1, 8.4, 3, 8.4, 3.2, 21, 0.6, 21], SK, { ink: -0.24 }));
  o.push(H.E(0.6, 13.4, 4.6, 2.4, SK, { fl: 1, ink: -0.26 })); // the shadow under the jaw
  o.push(P([41, 70 + by, 57, 70 + by, 54, 77, 49, 79, 44, 77], SK, { bv: 2, ink: -0.08 })); // the open neck of the shirt
  o.push(P([32, 81, 64, 81, 66, 97, 30, 97], AP, { bv: 2, ink: -0.06 }));
  o.push(K(33, 82, 41, 69 + by, 1.3, 1.2, 'scr_brandrStrap'), K(63, 82, 57, 69 + by, 1.3, 1.2, 'scr_brandrStrap'));
  o.push(E(40, 90, 3, 1.4, 'scr_brandrSoot', { fl: 0.7, a: 0.3, occ: false }), E(56, 93, 2.6, 1.2, 'scr_brandrSoot', { fl: 0.7, a: -0.2, occ: false })); // scorch on the apron

  // the near ear, sticking out
  o.push(H.E(-9.6, 1.4, 2.6, 4, SK, { fl: 0.3, ink: 0.02 }));
  o.push(H.E(-9.4, 1.6, 1.2, 2.4, SK, { fl: 0.8, ink: -0.26 }));
  // the face: long, young, the far side in shadow away from the forge
  const FACE: Face = [0, 0, 9.4, 12.8];
  o.push(H.E(1.6, 6.6, 7, 7, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, -0.42 * Math.PI, 0.38 * Math.PI, [4.4, 11.6, 6.2, 7.4, 7, 2.4, 6.8, -3.4, 5.6, -9.4], SK, -0.14));
  // freckles, and the soot on his near cheek
  for (const [x, y] of [[-4.6, 3.6], [-2.6, 4.4], [-5.8, 5.2], [4.4, 3.4], [6, 4.2], [-3.6, 2.4]]) o.push(H.X(x, y, 0.8, 0.8, 'scr_brandrFreckle:2'));
  o.push(H.E(-5.4, 6.8, 1.8, 0.9, 'scr_brandrSoot', { fl: 0.8, a: 0.5, ink: 0.04, occ: false }));
  // the eyes: hazel, bright
  const blink = f === 2;
  o.push(eyes(H, [[-3.6, -1, 2.4, 1], [4.8, -1.2, 1.9, 0.84]], { SK, WH: 'scr_brandrWhite', IR: 'scr_brandrIris', LA: 'scr_brandrLash', glint: '#fff0dc' }, blink, -0.1));
  // brows: red, raised
  o.push(H.K(-6.8, -5, -3.6, -6.2, 0.65, 0.55, HR, { ink: -0.06 }), H.K(-3.6, -6.2, -0.8, -5.4, 0.55, 0.4, HR, { ink: -0.06 }));
  o.push(H.K(2.8, -5.4, 7.4, -5.6, 0.55, 0.4, HR, { ink: -0.1 }));
  // the nose: long and straight, a lad's
  o.push(H.P([0.8, -3, 2, -3, 4.4, 3, 5.6, 4.8, 4.4, 5.8, 2.8, 5.4, 2.4, 3.4, 1.2, 0], SK, { fl: 1, ink: 0.06 }));
  o.push(H.E(4.8, 4.6, 1.6, 1.3, SK, { fl: 0.5, ink: 0.04 }));
  o.push(H.K(3.4, 5.8, 4.6, 6, 0.4, 0.35, 'scr_brandrMouth', { ink: 0.1 }));
  // the grin, wide and lopsided
  o.push(smile(H, -2.4, 7.2, 8.4, 2.8, 'scr_brandrMouth', 'scr_brandrTeeth', SK));
  o.push(H.K(-3.2, 6.6, -2.6, 8, 0.4, 0.35, SK, { ink: -0.24 })); // the dimple
  // the shock of red hair, standing up and swept back
  const hs = s * 0.2;
  o.push(H.P([-10, 3, -11.6, -4, -10.4, -10.4, -7, -15, -2 + hs, -18, 1.6, -15.6, 5.4 + hs, -17.4, 7.2, -13.6, 10.6 + hs, -12.4, 9.6, -7.6, 10.4, -4.2, 7.4, -6.2, 4.6, -7.4, 1, -7, -2.6, -5.6, -5.4, -4, -7.4, -1, -7.8, 3], HR, { bv: 2.6 }));
  for (const [a, c, e, ink] of [[[-8.6, -2], [-8, -11], [-2.6 + hs, -16.6], 0.1], [[-4.6, -5], [-2, -12], [4.6 + hs, -15.8], 0.12], [[0, -7], [4, -11], [9 + hs, -11.6], 0.04], [[-9.4, 1], [-10.6, -6], [-7.4, -12.4], -0.22]] as Array<[Pt, Pt, Pt, number]>) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.55, 0.35, HR, 3, { ink }));
  }

  // the far arm raised, the sleeve rolled to the elbow, the rime-bit chisel held up
  const kx = 77, ky = 27; // the chisel's frosted edge
  o.push(E(kx, ky, 8, 8, 'scr_brandrRimeHalo', { fl: 1, ink: BAND[1] }));
  o.push(E(kx, ky, 4.6, 4.6, 'scr_brandrRimeHalo', { fl: 1, ink: BAND[2] }));
  o.push(K(99, 99, 88, 80, 7, 6, SH, { ink: -0.06 }));
  o.push(E(87.4, 79, 5.6, 3.6, SH, { fl: 0.3, ink: 0.04, a: -0.5 })); // the rolled cuff
  o.push(K(86, 78, kx + 1, 62, 4.4, 3.8, SK, { ink: 0 }));
  o.push(K(kx, 64, kx, 69, 1.9, 1.8, 'scr_brandrHandle'));
  o.push(K(kx, 55, kx, 38, 1.7, 1.6, 'scr_brandrSteel'));
  o.push(P([kx - 1.6, 39, kx + 1.6, 39, kx + 3, ky + 2, kx - 3, ky + 2], 'scr_brandrSteel', { bv: 0.8 }));
  o.push(P([kx - 3, ky + 2.2, kx + 3, ky + 2.2, kx + 2.8, ky - 1.4, kx - 2.8, ky - 1.4], 'scr_brandrRime', { bv: 0.5 }));
  o.push(K(kx - 0.6, 54, kx - 0.6, 37, 0.45, 0.45, 'scr_brandrSteel', { ink: 0.3, occ: false }));
  o.push(K(kx, 61, kx, 54, 2, 2, 'scr_brandrHandle'));
  o.push(grip(kx, 58, SK, 1.15, 0.02));
  o.push(X(kx - 2, ky - 1.4, 1, 1, '#f2fdff', { em: true, glow: false }), X(kx + 1, ky - 0.6, 1, 1, '#f2fdff', { em: true, glow: false }));
  if (glint > 0.6) o.push(X(kx + 3.6, ky - 3 - glint, 1, 1, 'emFrost:5', { em: true }));
  o.push(Lt(kx, ky, 16, '#9fe6ff', 0.5 * glint, 4));
  o.push(Lt(fx0 + 4, fy0 - 6, 96, '#ff8a3c', 1.3 * fl, 12));
  return o;
}

/**
 * Ingrid of the Mill: a broad, strong woman with flour on her nose and her bared forearms, a
 * linen kerchief tied over her hair. A sack of meal sits on her shoulder like nothing and her
 * other fist is on her hip; she laughs. The mill door's daylight falls on her, flour motes
 * drifting in its shaft.
 */
export function ingridPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const GR = 'scr_gIngrid', SA = 'scr_ingridShaft', SK = 'scr_ingridSkin', RU = 'scr_ingridRuddy', KE = 'scr_ingridKerchief', DR = 'scr_ingridDress', SC = 'scr_ingridSack', FL = 'scr_ingridFlour';
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(56, 46, 64, 60, GR, { fl: 1, ink: BAND[2] }));
  // the shaft of daylight from the door, high at the right, and the flour drifting in it
  o.push(P([66, -1, 97, -1, 97, 30, 52, 97, 26, 97], SA, { ink: BAND[1] }));
  o.push(P([76, -1, 97, -1, 97, 14, 62, 97, 42, 97], SA, { ink: BAND[2] }));
  for (let i = 0; i < 7; i++) {
    const t = ((f * 0.25 + hash2(i, 3)) % 1), x = 70 + hash2(i, 5) * 22 - t * 18, y = hash2(i, 7) * 50 + t * 10;
    o.push(X(x, y, 1, 1, '#f4ecd8', { em: true, glow: false }));
  }
  // the hopper's post and a beam of the mill, dark at the left
  o.push(P([-1, 8, 40, 4, 40, 9, -1, 13], GR, { ink: BAND[2] - 0.04 }));

  const by = -b * 0.45;
  const H = hf(52, 44 + by, 1.3);
  // the broad body in the brown dress
  o.push(P([4, 97, 6, 85, 18, 75, 36, 70 + by, 60, 70 + by, 76, 74, 88, 84, 92, 97], DR, { bv: 5, n: [0, -0.12, 1] }));
  // the far arm akimbo: the elbow out, the sleeve pushed up, the fist on her hip below
  o.push(K(76, 75, 92, 88, 7, 6, DR, { ink: -0.06 }));
  o.push(E(91, 87, 5, 4, DR, { fl: 0.3, ink: 0.02, a: 0.8 })); // the pushed-up sleeve
  o.push(K(92, 89, 83, 99, 5.6, 5.2, SK, { ink: -0.02 }));
  for (const [x, y] of [[88, 93], [90.4, 91], [86.4, 96]]) o.push(X(x, y, 1, 1, `${FL}:4`));
  // the flour-white apron's bib
  o.push(P([36, 82, 64, 82, 66, 97, 34, 97], FL, { bv: 1.6, ink: -0.04 }));
  o.push(K(37, 82, 40, 72 + by, 1.1, 1, FL, { ink: -0.08 }), K(63, 82, 60, 72 + by, 1.1, 1, FL, { ink: -0.08 }));
  // the neck, thick, and the dress's neckline
  o.push(H.P([-6.4, 6, 3.4, 8, 3.6, 21, -7.4, 21], SK, { n: [0.1, -0.1, 1], ink: -0.1 }));
  o.push(H.E(0.4, 13.6, 6.4, 2.8, SK, { fl: 1, ink: -0.3 }));
  o.push(P([39, 70 + by, 62, 70 + by, 58, 76, 50, 78, 42, 76], SK, { bv: 2.4, ink: -0.06 }));

  // the sack of meal on her near shoulder, its tied neck behind her head
  o.push(E(20, 58 + by, 19, 14, SC, { fl: 0.15, a: -0.5 }));
  o.push(E(14, 50 + by, 10, 8, SC, { fl: 0.2, a: -0.6, ink: 0.04 }));
  o.push(P([6, 44 + by, 1, 34, 6, 30, 12, 32, 11, 42 + by], SC, { bv: 1.6, ink: -0.02 }));
  o.push(K(5.4, 42 + by, 11.6, 40 + by, 1, 1, 'leatherDark'));
  for (const [x0, y0, x1, y1] of [[10, 60, 22, 52], [18, 68, 32, 58], [26, 50, 30, 48]]) o.push(K(x0, y0 + by, x1, y1 + by, 0.5, 0.4, SC, { ink: -0.22, occ: false })); // its creases
  o.push(X(16, 54 + by, 2.4, 1, 'scr_ingridSack:2')); // the miller's mark
  // her near arm up round it, the fist at its neck
  o.push(K(30, 74, 20, 60, 5.4, 4.4, DR, { ink: -0.04 }));
  o.push(K(20, 60, 12, 46 + by, 4, 3.4, SK, { ink: 0.02 }));
  o.push(grip(10.6, 43.4 + by, SK, 1.05));

  // the face: broad and square-jawed, ruddy, flour on her nose
  const FACE: Face = [0, 0, 12, 12.6];
  o.push(H.E(1, 6.4, 10, 7.4, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.25 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.6 * Math.PI, [-4, 10.6, -6, 7, -7.4, 3.2, -8.4, -1, -9, -6.4], SK, -0.12));
  o.push(H.E(-5.8, 4.4, 3.4, 2.2, RU, { fl: 0.5, ink: -0.06, occ: false }));
  o.push(H.E(7, 4, 2.6, 1.8, RU, { fl: 0.5, occ: false }));
  // the eyes: brown, creased with laughing
  const blink = f === 2;
  o.push(eyes(H, [[-4.4, -1, 2.4, 0.9], [5.4, -1.2, 1.9, 0.76]], { SK, WH: 'scr_ingridWhite', IR: 'scr_ingridIris', LA: 'scr_ingridLash' }, blink, -0.14, 0.4));
  for (const [x, w] of [[-4.4, 2.4], [5.4, 1.9]]) o.push(H.K(x - w * 0.7, 1.4, x + w * 0.8, 1.2, 0.4, 0.34, SK, { ink: -0.22 }));
  o.push(H.K(-8.8, -1.6, -10.4, -2.6, 0.4, 0.3, SK, { ink: -0.28 }), H.K(-8.8, 0, -10.4, 0.4, 0.4, 0.3, SK, { ink: -0.28 }));
  // brows: brown, strong
  o.push(H.K(-8, -4.4, -1.6, -5.6, 0.9, 0.7, 'scr_ingridHair'));
  o.push(H.K(3, -5.4, 8.2, -4.8, 0.8, 0.6, 'scr_ingridHair'));
  // the nose: broad, floured at the tip
  o.push(H.P([0.6, -3, 2, -3, 4.4, 2.4, 5.6, 4.2, 4.4, 5.4, 2.6, 5, 2.2, 2.8, 1, -0.2], SK, { fl: 1, ink: -0.14 }));
  o.push(H.E(4.8, 4, 2.2, 1.8, SK, { fl: 0.4, ink: 0.04 }));
  o.push(H.K(3.4, 5.6, 4.8, 5.8, 0.45, 0.4, 'scr_ingridMouth', { ink: 0.1 }));
  o.push(H.E(5, 3, 1.3, 0.9, FL, { fl: 0.6, ink: 0.1, occ: false }));
  o.push(H.X(-6, 1.8, 1, 1, `${FL}:4`), H.X(7.6, 2.4, 1, 1, `${FL}:4`));
  // the laugh: wide open
  o.push(smile(H, -2.6, 8.6, 8, 4, 'scr_ingridMouth', 'scr_ingridTeeth', SK));
  // brown hair under the kerchief's edge, and the kerchief over it, knotted at the nape
  o.push(H.P([-9.8, 3, -9.4, -4.6, -4, -8.8, 3.4, -9.6, 9.8, -8, 12.2, -5, 9, -5.6, 3.4, -6.8, -2.6, -6.2, -7, -2.6, -8.2, 3], 'scr_ingridHair', { bv: 1.6 }));
  for (const [a, c, e] of [[[8, -7.6], [2, -8], [-4, -6.8]], [[-4, -7.4], [-7.6, -4.6], [-8.8, 1]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.36, 0.3, 'scr_ingridHair', 3, { ink: 0.14 }));
  o.push(H.P([-11.4, 2, -12.6, -6, -9, -13.4, -1, -16.4, 7, -14.8, 11.6, -9.4, 12.6, -6.6, 9.4, -8.2, 3.4, -9.4, -2.6, -8.8, -7.6, -5.2, -9.8, 1], KE, { bv: 3 }));
  o.push(H.S(-10.2, -1.6, -4, -10.4, 12, -7.4, 1, 1, KE, 6, { ink: 0.06 }));
  for (const [a, c, e] of [[[-3, -14.4], [-9, -9.6], [-11, -2]], [[4, -13.6], [0, -11], [-5, -8.2]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.4, 0.36, KE, 3, { ink: -0.24 }));
  o.push(H.E(-12, 2, 2.6, 2.2, KE, { fl: 0.2, ink: -0.16 }));
  o.push(H.S(-12.4, 3.4, -14.6, 7, -13.6 + s * 0.2, 10, 1.2, 0.8, KE, 3, { ink: -0.24 }));
  o.push(Lt(94, 4, 104, '#fff0d4', 1.3, 14));
  return o;
}

/**
 * Torstein the Cooper in his yard: stocky, his dark beard cut square, his green wool cap, a
 * slate tunic and a leather apron. An iron barrel hoop hangs on his shoulder and his mallet is
 * in his fist; behind him stand finished casks, and the fire that bends the staves of the next
 * one lights him from below, its sparks going up.
 */
export function torsteinPortrait(f: number): PrimTree {
  const b = breath(f);
  const fl = [1, 1.08, 0.94, 1.12][f % 4];
  const o: Out = [];
  const GR = 'scr_gTorstein', HA = 'scr_torsteinHalo', SK = 'scr_torsteinSkin', BD = 'scr_torsteinBeard', CP = 'scr_torsteinCap', TU = 'scr_torsteinTunic', HO = 'scr_torsteinHoop';
  const gx = 100, gy = 100; // the fire's heart, below the frame
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(46, 46, 62, 58, GR, { fl: 1, ink: BAND[2] }));
  // finished casks stacked behind him at the right, their hoops
  for (const [x, y] of [[80, 20], [96, 20], [88, 4]]) {
    o.push(E(x, y, 8, 9.6, GR, { fl: 1, ink: BAND[2] + 0.14 }));
    o.push(E(x, y, 6, 7.4, GR, { fl: 1, ink: BAND[2] + 0.02 }));
    o.push(E(x, y, 1.4, 1.4, GR, { fl: 1, ink: BAND[1] }));
  }
  // the fire's halo from the lower right, and the staves of the cask being bent over it
  o.push(E(gx, gy, 44, 40, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(gx, gy, 26, 24, HA, { fl: 1, ink: BAND[2] }));
  for (let i = 0; i < 5; i++) o.push(K(80 + i * 4.4, 99, 82 + i * 4.8, 80, 1.4, 1.4, GR, { ink: BAND[1] + 0.02, fl: 1 }));
  for (let i = 0; i < 4; i++) { const y = 96 - ((f * 6 + i * 11) % 34), x = 90 + hash2(i, 13) * 8 - (96 - y) * 0.12 + Math.sin(f + i) * 1.2; o.push(X(x, y, 1, 1, i % 2 ? 'scr_torsteinSpark:4' : 'emFireCore:4', { em: true })); }

  const by = -b * 0.5;
  const H = hf(46, 42 + by, 1.3);
  // the stocky body: the slate tunic, the apron's bib and strap
  o.push(P([-1, 97, -1, 84, 10, 73, 28, 67 + by, 64, 67 + by, 80, 73, 92, 84, 97, 97], TU, { bv: 6, n: [0, -0.12, 1] }));
  o.push(H.P([-7, 6, 4, 8, 4.4, 20, -8, 20], SK, { ink: -0.3 })); // the neck, in the beard's shadow
  o.push(P([28, 82, 64, 82, 66, 97, 26, 97], 'scr_torsteinApron', { bv: 2, ink: -0.06 }));
  o.push(K(30, 82, 34, 69 + by, 1.4, 1.3, 'leatherDark'), K(62, 82, 58, 69 + by, 1.4, 1.3, 'leatherDark'));
  o.push(X(38, 90, 1.6, 1, 'scr_torsteinHaft:4'), X(52, 93, 1.4, 1, 'scr_torsteinHaft:4')); // shavings caught in it

  // the face: square, weathered
  const FACE: Face = [0, 0, 11.4, 12.4];
  o.push(H.E(-12, 1.6, 2.4, 3.6, SK, { fl: 0.3, ink: -0.06 }));
  o.push(H.E(...FACE, SK, { fl: 0.25 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.62 * Math.PI, [-6, 8, -7, 4, -7.6, 0, -7.6, -4, -8.6, -6.6], SK, -0.12));
  // the beard: dark, full, cut square at the jaw
  o.push(H.P([-11, 0, -11.6, 8, -10, 15, -6, 19.4, 0, 20.4, 6, 19.4, 10.6, 16, 12, 9, 12, 2, 9.6, 5.4, 5.6, 6.6, 2, 7, -2, 6.4, -6, 5, -8.6, 2], BD, { bv: 3.6 }));
  for (const [x0, x1, x2] of [[-7, -8, -6.4], [-2.6, -3, -2.4], [2, 2.4, 2], [6.6, 7.4, 6.4]]) o.push(H.S(x0, 9, x1, 13, x2, 18.6, 0.4, 0.32, BD, 3, { ink: -0.28, occ: false }));
  for (const [x0, x1] of [[-4.6, -5.4], [4.4, 5]]) o.push(H.S(x0, 11, x1, 14, x0, 17, 0.36, 0.3, BD, 2, { ink: 0.16, occ: false })); // lit hairs
  // the moustache over a shut mouth, a smile in the creases above it
  o.push(H.P([-2.6, 6.6, 2.4, 5.8, 7.6, 6.4, 9, 9.4, 6, 8.6, 2.4, 8.4, -1, 9, -3.6, 9.6], BD, { bv: 1.2, ink: 0.06 }));
  o.push(H.K(-0.6, 9.6, 6, 9.4, 0.4, 0.36, 'scr_torsteinLash', { ink: 0.1 }));
  // the eyes: dark brown, steady, creased at the corners
  const blink = f === 3;
  o.push(eyes(H, [[-3.8, -1, 2.3, 0.9], [5.2, -1.2, 1.8, 0.76]], { SK, WH: 'scr_torsteinWhite', IR: 'scr_torsteinIris', LA: 'scr_torsteinLash', glint: '#ffe8d0' }, blink, -0.2, 0.5));
  o.push(H.K(-7.6, -1.8, -9.4, -2.8, 0.4, 0.3, SK, { ink: -0.3 }), H.K(-7.6, -0.2, -9.4, 0.2, 0.4, 0.3, SK, { ink: -0.3 }));
  // brows: dark and heavy, level
  o.push(H.K(-7.6, -4.2, -1.2, -4.6, 1.1, 0.9, BD));
  o.push(H.K(3, -4.6, 8.4, -4.2, 0.9, 0.7, BD));
  // the nose: broad, straight
  o.push(H.P([0.6, -3, 2, -3, 4.6, 2.4, 6, 4, 4.6, 5.2, 2.6, 4.8, 2.2, 2.6, 1, -0.2], SK, { fl: 1, ink: -0.14 }));
  o.push(H.E(5, 3.8, 2.1, 1.7, SK, { fl: 0.4, ink: 0.04 }));
  o.push(H.K(3.4, 5.2, 4.8, 5.4, 0.45, 0.4, 'scr_torsteinLash', { ink: 0.14 }));
  // the green wool cap, its brim rolled
  o.push(H.P([-12, -2.4, -12.4, -8, -9, -14.4, -2, -17.4, 5, -16.4, 10.4, -12, 12.4, -5.6, 11.6, -3.4], CP, { bv: 4 }));
  o.push(H.S(-12.4, -2.2, 0, -7.6, 12.2, -4.4, 2, 2, CP, 6, { ink: 0.04 }));
  o.push(H.S(-11.6, -4.4, 0, -9.8, 11.6, -6.6, 0.4, 0.4, CP, 6, { ink: -0.26, occ: false })); // the roll's upper edge
  o.push(H.K(-6, -14, 2, -16.4, 0.5, 0.4, CP, { ink: 0.14, occ: false }));

  // the iron hoop hung on his near shoulder, his hand on it
  o.push(arc(14, 90, 15, 24, Math.PI * 1.02, Math.PI * 2.02, 16, 1.5, 1.5, HO));
  o.push(arc(14, 90, 13.2, 22.2, Math.PI * 1.1, Math.PI * 1.9, 12, 0.5, 0.5, HO, { ink: -0.3, occ: false }));
  o.push(K(4, 99, 22, 84, 6.4, 5.6, TU, { ink: -0.08 }));
  o.push(grip(27, 84, SK, 1.1));
  // the far fist round the mallet's haft, its head up
  const mx = 81, my = 50;
  o.push(K(99, 99, 88, 80, 7, 6, TU, { ink: -0.06 }));
  o.push(K(mx, my + 4, mx, 82, 1.4, 1.3, 'scr_torsteinHaft'));
  o.push(K(mx - 7, my, mx + 7, my, 5, 5, 'scr_torsteinMallet', { ink: -0.02 }));
  o.push(E(mx - 7, my, 1.8, 5, 'scr_torsteinMallet', { fl: 0.5, ink: 0.06 }), E(mx + 7, my, 1.8, 5, 'scr_torsteinMallet', { fl: 0.5, ink: -0.1 }));
  for (const x of [-4, 4]) o.push(K(mx + x, my - 5, mx + x, my + 5, 0.6, 0.6, 'blackIron', { ink: -0.06 })); // its iron bands
  o.push(grip(mx, 72, SK, 1.1));
  o.push(Lt(gx - 8, gy - 10, 100, '#ff9440', 1.4 * fl, 12));
  return o;
}

/**
 * Sigrid the Weaver, at home before her loom: grey-haired and straight-backed, her hair in a
 * bun, a green shawl with a red border. The distaff of fleece is tucked under her arm and she
 * spins as she talks, the thread running down from her fingers to the turning spindle. The
 * hearth at her left lights her; the warp and its weights hang in the dark behind.
 */
export function sigridPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.92, 1.08, 0.97][f % 4];
  const spin = [0, 1, 2, 3][f % 4];
  const o: Out = [];
  const GR = 'scr_gSigrid', HA = 'scr_sigridHalo', SK = 'scr_sigridSkin', HR = 'scr_sigridHair', SW = 'scr_sigridShawl', BO = 'scr_sigridBorder', DR = 'scr_sigridDress', FC = 'scr_sigridFleece', YA = 'scr_sigridYarn';
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(46, 50, 62, 58, GR, { fl: 1, ink: BAND[2] }));
  // the hearth's glow, at the left beyond the frame
  o.push(E(-12, 58, 32, 34, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(-12, 58, 17, 18, HA, { fl: 1, ink: BAND[2] }));
  // the loom behind her: the beam, the cloth she has woven with a chevron band in it, the
  // warp hanging from it, the heddle-rod across, and the row of loom weights that pull it taut
  const lw = { ink: BAND[3] - 0.08, fl: 1 };
  o.push(K(2, 4, 2, 97, 1.8, 1.8, GR, lw), K(-1, 4, 99, 4, 2, 2, GR, lw));
  o.push(P([4, 6, 99, 6, 99, 22, 4, 22], GR, { ink: BAND[2] + 0.04 }));
  for (let x = 6; x < 99; x += 6) o.push(K(x, 16, x + 3, 12, 0.6, 0.6, GR, { ...lw, occ: false }), K(x + 3, 12, x + 6, 16, 0.6, 0.6, GR, { ...lw, occ: false }));
  for (let x = 6; x < 99; x += 4) o.push(K(x, 22, x, 54, 0.45, 0.45, GR, { ink: BAND[2] + 0.1, fl: 1, occ: false }));
  o.push(K(-1, 36, 99, 36, 1.2, 1.2, GR, lw));
  for (let x = 7; x < 99; x += 8) o.push(E(x, 56, 2.8, 3, GR, lw));

  const by = -b * 0.4;
  const H = hf(44, 46 + by, 1.25);
  // the bun at the back of her head
  o.push(H.E(-9.4, -7.4, 5.8, 5.2, HR, { fl: 0.2, ink: -0.1 }));
  o.push(H.S(-13, -9, -9, -12.6, -5, -10, 0.5, 0.4, HR, 3, { ink: -0.32, occ: false }));
  o.push(H.S(-13.6, -6, -10, -4, -5.6, -5.6, 0.5, 0.4, HR, 3, { ink: -0.32, occ: false }));
  o.push(H.E(-6.6, 0.6, 8.2, 11.6, HR, { fl: 0.2, ink: -0.18 }));
  // the blue dress, straight-backed shoulders
  o.push(P([6, 97, 10, 84, 22, 75, 34, 70 + by, 54, 70 + by, 66, 74, 78, 84, 84, 97], DR, { bv: 5, n: [0, -0.12, 1] }));
  // the neck, thin, a cord at the throat
  o.push(H.P([-5, 6, 2.6, 8, 2.8, 19, -6, 19], SK, { n: [0.1, -0.1, 1], ink: -0.1 }));
  o.push(H.P([1.2, 8, 2.6, 8, 2.8, 19, 1, 19], SK, { ink: -0.26 }));
  o.push(H.E(0.6, 13.6, 4.8, 2.4, SK, { fl: 1, ink: -0.26 })); // the shadow under the jaw
  // the shawl round her shoulders, its red-bordered edges brought together at a brooch
  o.push(P([-1, 97, -1, 84, 8, 76, 22, 71, 34, 69 + by, 40, 78, 46, 90, 46, 97], SW, { bv: 3, n: [0, -0.1, 1] }));
  o.push(P([54, 69 + by, 64, 71, 76, 76, 86, 84, 92, 97, 46, 97, 46, 90, 50, 78], SW, { bv: 3, n: [0, -0.1, 1], ink: -0.06 }));
  o.push(strand(34, 69.6 + by, 39, 80, 45.6, 90, 1.1, 1.1, BO, 5, { occ: false }));
  o.push(strand(54, 70 + by, 51, 80, 46.4, 90, 1.1, 1.1, BO, 5, { occ: false }));
  o.push(E(46, 90.6, 3, 2.6, 'iron', { fl: 0.3 }), E(46, 90.6, 1.2, 1, 'iron', { ink: -0.2 }));
  for (const [x0, y0, x1, y1] of [[14, 78, 10, 92], [26, 74, 26, 90], [70, 76, 74, 90]]) o.push(K(x0, y0, x1, y1, 0.6, 1, SW, { ink: -0.3, occ: false }));

  // the face: long and fine-boned, lined, the far side in shadow away from the hearth
  const FACE: Face = [0, 0, 9.8, 13];
  o.push(H.E(1.8, 6.8, 7, 7, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, -0.42 * Math.PI, 0.38 * Math.PI, [4, 11.6, 5.6, 7.2, 6.6, 2.4, 6.4, -3.4, 5.2, -9.6], SK, -0.14));
  // the near ear
  o.push(H.E(-9, 1.6, 2.2, 3.6, SK, { fl: 0.3, ink: 0.02 }));
  o.push(H.E(-8.8, 1.8, 0.9, 2, SK, { fl: 0.8, ink: -0.14 }));
  // the eyes: grey-green, kind, the lids heavy with years; the lines round them
  const blink = f === 2;
  o.push(eyes(H, [[-3.6, -0.8, 2.3, 0.9], [4.8, -1, 1.8, 0.76]], { SK, WH: 'scr_sigridWhite', IR: 'scr_sigridIris', LA: 'scr_sigridLash' }, blink, -0.16, 0.7));
  o.push(H.K(-6.8, -0.8, -8.4, -1.8, 0.35, 0.3, SK, { ink: -0.18 }), H.K(-6.8, 0.6, -8.4, 1, 0.35, 0.3, SK, { ink: -0.18 }));
  // brows: grey, fine
  o.push(H.K(-6.6, -3.6, -1.4, -4.6, 0.6, 0.45, HR, { ink: -0.1 }));
  o.push(H.K(2.8, -4.4, 7, -3.8, 0.5, 0.4, HR, { ink: -0.1 }));
  // the nose: fine and straight
  o.push(H.P([0.8, -2.4, 1.9, -2.4, 4, 3, 5.2, 4.8, 4.2, 6, 2.6, 5.6, 2.2, 3.6, 1.2, 0.2], SK, { fl: 1, ink: 0.04 }));
  o.push(H.E(4.4, 4.6, 1.5, 1.2, SK, { fl: 0.6, ink: 0.02 }));
  o.push(H.K(3, 5.8, 4.2, 6, 0.4, 0.35, SK, { ink: -0.34 }));
  // the mouth: closed, a quiet smile, the lines beside it
  o.push(H.S(-0.6, 7.6, 2.4, 8.6, 5.4, 7.8, 0.55, 0.42, 'scr_sigridLip', 3, { ink: -0.12, occ: false }));
  o.push(H.S(-0.8, 7.4, 2.2, 9.2, 5.6, 8, 0.38, 0.3, 'scr_sigridLash', 4, { ink: -0.1 }));
  o.push(H.K(-1.6, 5.4, -2.4, 8.6, 0.35, 0.3, SK, { ink: -0.24 })); // the line from nose to mouth
  o.push(H.E(2.6, 11.2, 1.6, 0.7, SK, { fl: 1, ink: 0.04 }));
  // hair: grey, drawn smooth back from the brow to the bun
  o.push(H.P([7, -10.4, 2, -13.4, -4.4, -13.4, -9.6, -10.4, -11.2, -4, -10, 3, -8.6, 4.6, -8.4, -1, -6.4, -5.6, -2.4, -8.4, 2.4, -9.6, 6.6, -8.6], HR, { bv: 2.6 }));
  for (const [a, c, e, ink] of [[[5, -11.6], [-2, -12.6], [-8.6, -8.4], 0.14], [[2, -9.6], [-4, -10], [-9, -4.6], -0.2], [[6, -9.4], [0, -11.4], [-6, -9.4], -0.2], [[-6.4, -4], [-9, -1], [-9.4, 3], 0.1]] as Array<[Pt, Pt, Pt, number]>) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.4, 0.34, HR, 3, { ink }));
  }

  // the distaff tucked under her far arm: its shaft, the fleece bound on its head
  const dx = 84, dy = 24;
  o.push(K(96, 99, dx, dy + 6, 1, 0.9, 'wood'));
  o.push(E(dx - 0.4, dy, 6, 9, FC, { fl: 0.15 }));
  for (const [x, y] of [[-3, -6], [2.6, -4], [-2.6, 4], [3, 5]]) o.push(E(dx + x, dy + y, 2.4, 1.8, FC, { fl: 0.4, ink: -0.08 }));
  o.push(K(dx - 5.6, dy + 1, dx + 5, dy - 1, 0.5, 0.5, 'leatherDark', { occ: false }));
  // the far hand raised, drawing the thread from the fleece; the thread down to the spindle
  const hx = 70, hy = 58;
  o.push(K(96, 99, 84, 82, 6.4, 5.4, SW, { ink: -0.04 }));
  o.push(K(84, 82, hx + 3, hy + 6, 5, 3.8, DR, { ink: -0.02 }));
  o.push(K(dx - 4, dy + 4, hx + 1, hy - 3.6, 0.5, 0.5, YA, { occ: false, ol: false }));
  o.push(E(hx + 1.4, hy + 1, 3.4, 3.8, SK, { fl: 0.3, ink: 0.02 }));
  o.push(K(hx - 1.4, hy - 1, hx + 2, hy - 3.4, 1, 0.9, SK, { ink: 0.08 }), K(hx + 0.4, hy - 0.4, hx + 3.6, hy - 3, 0.95, 0.85, SK, { ink: 0.04 }));
  const sx = hx + 0.8;
  o.push(K(sx, hy + 3, sx, 76, 0.5, 0.5, YA, { occ: false, ol: false }));
  o.push(K(sx, 76, sx + s * 0.5, 95, 0.7, 0.6, 'wood'));
  o.push(E(sx, 82, 2.8, 4, YA, { fl: 0.2 }));
  for (let i = 0; i < 2; i++) o.push(K(sx - 2.6, 80 + i * 2.4 + spin * 0.4, sx + 2.6, 79.4 + i * 2.4 + spin * 0.4, 0.4, 0.4, YA, { ink: -0.22, occ: false }));
  o.push(E(sx, 91, 4.6, 1.6, 'woodDark', { fl: 0.4 }));
  o.push(X(sx - 3.4 + spin * 2, 90.6, 1.2, 1, 'wood:5'));
  o.push(Lt(-4, 46, 92, '#ffa858', 1.1 * fl, 16));
  return o;
}

/**
 * Young Leif in the snowy yard at sundown: a boy of ten in a blue tunic a size too big, its
 * neck slipping off his shoulder, his flax hair every which way and freckles across his nose.
 * His wooden sword is up and his chin is up: the town's youngest guard. The last of the sun at
 * his left lights him warm against the blue dusk and the snowed-in longhouses, flakes drifting.
 */
export function leifPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const GR = 'scr_gLeif', SY = 'scr_leifSky', SN = 'scr_leifSnow', SK = 'scr_leifSkin', HR = 'scr_leifHair', TU = 'scr_leifTunic';
  o.push(P(FULL, GR, { ink: BAND[2] }));
  // the last of the sundown at the left, low behind the houses
  o.push(P([-1, 40, 97, 50, 97, 76, -1, 76], SY, { ink: BAND[1] + 0.04 }));
  o.push(P([-1, 50, 54, 58, 54, 76, -1, 76], SY, { ink: BAND[2] }));
  // two longhouses across the yard, gable-on: the snow along the roof, the crossed gable boards
  // over the ridge, a wall under the eaves and a window lit within
  for (const [x, y, w, h] of [[12, 50, 20, 14], [88, 56, 16, 11]]) {
    const dark = { ink: BAND[1] + 0.04, fl: 1 };
    o.push(P([x - w + 3, y + h, x + w - 3, y + h, x + w - 3, 97, x - w + 3, 97], GR, { ink: BAND[1] + 0.1 }));
    o.push(P([x - w, y + h + 1, x, y, x + w, y + h + 1], GR, dark));
    o.push(P([x - w - 1, y + h + 0.6, x, y - 1.2, x + w + 1, y + h + 0.6, x + w + 1, y + h + 2.8, x, y + 2.2, x - w - 1, y + h + 2.8], SN, { ink: BAND[3] }));
    o.push(K(x - 4, y - 5, x + 1.4, y + 1.2, 0.8, 0.8, GR, dark), K(x + 4, y - 5, x - 1.4, y + 1.2, 0.8, 0.8, GR, dark));
    o.push(X(x - 2, y + h + 7, 3, 3, '#ffb35c', { em: true }));
  }
  // the flakes drifting down
  for (let i = 0; i < 9; i++) {
    const t = ((f * 0.25 + hash2(i, 11)) % 1), x = hash2(i, 13) * 96 + Math.sin(t * 6 + i) * 1.4, y = t * 70 - 4 + hash2(i, 17) * 10;
    o.push(X(x, y, 1, 1, `${SN}:${i % 3 ? 4 : 5}`, { em: true, glow: false }));
  }

  const by = -b * 0.45;
  const H = hf(46, 51 + by, 1.34);
  // a boy's narrow shoulders in the big tunic, its neck slipped toward one shoulder
  o.push(P([12, 97, 16, 86, 26, 79, 36, 74.6 + by, 58, 74.6 + by, 68, 79, 78, 86, 82, 97], TU, { bv: 5, n: [0, -0.12, 1] }));
  for (const [x0, y0, x1, y1] of [[24, 84, 22, 97], [34, 82, 36, 97], [62, 82, 66, 97]]) o.push(K(x0, y0, x1, y1, 0.7, 1.1, TU, { ink: -0.3, occ: false })); // its loose folds
  o.push(H.P([-4.4, 6, 3.4, 8, 3.6, 18, -5.6, 18], SK, { n: [0.1, -0.1, 1], ink: -0.06 }));
  o.push(H.E(0.6, 12.6, 5, 2.4, SK, { fl: 1, ink: -0.3 }));
  o.push(P([34, 74.6 + by, 56, 74.6 + by, 54, 82, 44, 85, 32, 81], SK, { bv: 2.4, ink: -0.06 })); // the wide neck, slipping
  o.push(strand(32, 80.6, 42, 86, 54, 81.4, 1, 1, TU, 4, { ink: 0.04 }));

  // the face: round, a boy's, the chin up
  const FACE: Face = [0, 0, 11.2, 11.6];
  o.push(H.E(-9.6, 1.6, 2.2, 3.4, SK, { fl: 0.3, ink: 0.02 }));
  o.push(H.E(-9.4, 1.8, 1, 2, SK, { fl: 0.8, ink: -0.26 }));
  o.push(H.E(1.4, 5, 8.6, 6.8, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.25 }));
  o.push(shade(H, FACE, -0.42 * Math.PI, 0.4 * Math.PI, [4.6, 10.4, 6.6, 6.6, 7.6, 2, 7.4, -3.4, 6, -8.6], SK, -0.12));
  // the freckles over his nose and cheeks
  for (const [x, y] of [[-4.6, 3], [-2.8, 3.8], [-5.8, 4.4], [-1.4, 2.6], [5, 3], [6.4, 3.8], [-3.6, 5]]) o.push(H.X(x, y, 0.8, 0.8, 'scr_leifFreckle:2'));
  // the eyes: big and blue, fixed on you
  const blink = f === 1;
  o.push(eyes(H, [[-3.8, -1, 2.7, 1.08], [5, -1.2, 2.2, 0.92]], { SK, WH: 'scr_leifWhite', IR: 'scr_leifIris', LA: 'scr_leifLash', glint: '#fff8ec' }, blink, -0.1));
  // brows: flax, up and determined
  o.push(H.K(-7.2, -4.6, -1.6, -5.4, 0.65, 0.5, HR, { ink: -0.12 }));
  o.push(H.K(2.8, -5.2, 7.6, -5.4, 0.55, 0.4, HR, { ink: -0.12 }));
  // the nose: a snub
  o.push(H.P([0.8, -2.4, 1.8, -2.4, 3.2, 1.6, 4, 3, 3, 3.8, 2, 3.4, 1.8, 2, 1, 0], SK, { fl: 1, ink: 0.04 }));
  o.push(H.E(3.4, 3, 1.5, 1.2, SK, { fl: 0.5, ink: 0.04 }));
  o.push(H.K(2.2, 4, 3.2, 4.1, 0.4, 0.35, 'scr_leifMouth', { ink: 0.1 }));
  // the grin: proud, a tooth missing
  o.push(smile(H, -1.8, 6.6, 7, 2.8, 'scr_leifMouth', 'scr_leifTeeth', SK));
  // the flax hair: a mop grown out over his brow in uneven locks, a cowlick and tufts sticking out
  const hs = s * 0.25;
  o.push(H.P([-9.6, 3, -11.8, -3, -11.6, -9, -8, -13.6, -2, -15.6, 4.6, -14.6, 9.6, -11, 12, -6.6, 11.4, -3.6, 9.4, -5.2, 8, -3.6, 6.4, -5.6, 4.2, -3.4, 2, -5.4, -0.6, -3.8, -3.4, -5.4, -6.2, -3.8, -7.6, -0.4, -8.4, 3], HR, { bv: 2.4 }));
  for (const [a, c, e, r, ink] of [[[-3, -14], [-4 + hs, -17.4], [-7 + hs, -17.2], 1.8, 0.1], [[-9.6, -8.6], [-12.4, -9.4], [-13.4 + hs, -7.6], 1.8, -0.12], [[8.4, -10.6], [10.6 + hs, -12.4], [12 + hs, -11.4], 1.6, 0.04]] as Array<[Pt, Pt, Pt, number, number]>) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], r, 0.8, HR, 4, { ink }));
  }
  for (const [a, c, e, ink] of [[[3, -14], [-2, -11], [-4, -5.6], 0.16], [[8, -10.4], [6, -7.6], [6.4, -5.8], 0.1], [[-5, -13], [-8.6, -9], [-9.6, -2], -0.14], [[1, -12], [2.6, -8], [2, -5.6], -0.16]] as Array<[Pt, Pt, Pt, number]>) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.42, 0.32, HR, 3, { ink }));
  }

  // the wooden sword, held up in his far fist, the long sleeve over the wrist
  const wx = 76, wy = 74;
  o.push(K(99, 99, 86, 86, 6, 5.4, TU, { ink: -0.06 }));
  o.push(K(86, 86, wx + 2, wy + 4, 5.4, 4.6, TU, { ink: 0 }));
  o.push(K(wx - 0.4, wy + 6, wx, wy + 2, 1.4, 1.4, 'woodDark'));
  o.push(K(wx, wy - 4, wx + 1.6, 18, 2.2, 1.8, 'scr_leifSword'));
  o.push(P([wx + 0.2, 18.4, wx + 3.6, 18.4, wx + 2.4, 13.4], 'scr_leifSword', { bv: 0.8 }));
  o.push(K(wx + 0.6, wy - 6, wx + 1.4, 22, 0.45, 0.4, 'scr_leifSword', { ink: 0.16, occ: false }));
  o.push(K(wx - 7, wy - 4.6, wx + 7, wy - 5.4, 1.4, 1.4, 'woodDark'));
  o.push(grip(wx, wy, SK, 1.1));
  o.push(E(wx + 3.4, wy + 3.6, 4.4, 3, TU, { fl: 0.3, ink: 0.04, a: -0.6 })); // the cuff, over the wrist
  o.push(Lt(0, 60, 96, '#ffc890', 0.85, 12));
  return o;
}
