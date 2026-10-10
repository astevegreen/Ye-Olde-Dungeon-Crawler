import { E, K, P, X, Lt, breath, sway, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9c, group A: Olaf the Chandler, Astrid the Alchemist and Banker Haakon. Conventions: portraitKit.ts. */

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
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, inset = 0.3): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push(cx + Math.cos(a) * (rx - inset), cy + Math.sin(a) * (ry - inset)); }
  return out;
}

/**
 * A flat shadow plane on the side of a face away from the light: its outer edge
 * follows the face's contour, its inner edge (the terminator) is drawn by hand.
 */
const shade = (H: Head, face: Face, a0: number, a1: number, inner: number[], m: string, ink: number) => H.P([...arc(...face, a0, a1, 8), ...inner], m, { ink, fl: 1 });

/**
 * Olaf the Chandler, Elder of Bjarnarhaven: round and merry under his fur hat,
 * a flaxen beard split by a grin, his red wrap round his neck; he holds up a
 * lit lantern from his own stock and it lights him warm from the right. His
 * tallow candles hang from the rafter behind, a bundle more in his fist.
 */
export function olafPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.86, 1.12, 0.94][f % 4];
  const o: Out = [];
  const GR = 'scr_olafGround', HA = 'scr_olafHalo', SK = 'scr_olafSkin', RU = 'scr_olafRuddy', BE = 'scr_olafBeard';
  const lx = 82 + s * 0.4, ly = 58; // the lantern's flame
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(70, 50, 70, 64, GR, { fl: 1, ink: BAND[2] }));
  o.push(E(lx, ly, 24, 24, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(lx, ly, 15, 15, HA, { fl: 1, ink: BAND[2] }));
  // a rafter, his candles hung from it by their wicks to harden
  o.push(K(-2, 7, 30, 6, 1.4, 1.4, GR, { ink: BAND[2] + 0.06 }));
  for (const [x0, n, l] of [[3, 4, 18], [15, 3, 14], [25, 3, 11]]) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 2.3, len = l - (i % 2) * 3;
      o.push(K(x, 11, x + 0.2, 11 + len, 1, 0.9, GR, { ink: BAND[3] - 0.04 - (i % 2) * 0.06 }));
    }
    o.push(K(x0 - 0.6, 9.6, x0 + (n - 1) * 2.3 + 0.6, 9.6, 1, 1, GR, { ink: BAND[2] + 0.04 }));
  }

  const by = -b * 0.5;
  // the round body in his ochre tunic
  o.push(E(46, 116 + by * 0.6, 60, 40, 'scr_olafTunic', { fl: 0.2, ink: -0.04 }));
  o.push(K(28, 88, 22, 100, 1.4, 2, 'scr_olafTunic', { ink: -0.34 }));
  // the warm wrap, wound thick round his neck, its end hanging
  o.push(E(46, 84 + by, 27, 8, 'scr_olafScarf', { fl: 0.3 }));
  o.push(K(22, 82 + by, 44, 88 + by, 0.8, 0.8, 'scr_olafScarf', { ink: -0.32 }));
  o.push(K(50, 89 + by, 68, 82 + by, 0.8, 0.8, 'scr_olafScarf', { ink: -0.32 }));
  o.push(P([58, 84 + by, 68, 82 + by, 71 + s * 0.3, 99, 59 + s * 0.3, 99], 'scr_olafScarf', { bv: 3, ink: -0.08 }));
  for (const x of [61, 64, 67]) o.push(K(x + s * 0.3, 95.4, x + 0.4 + s * 0.3, 99, 0.6, 0.6, 'scr_olafScarf', { ink: -0.3 })); // its fringe

  const H = hf(47, 45 + by, 1.25);
  // the face: big, round, warm in the lantern-light, shaded on the near side
  const FACE: Face = [0, 0, 12.6, 13];
  o.push(H.E(1, 5, 12, 9, SK, { fl: 0.25 }));
  o.push(H.E(...FACE, SK, { fl: 0.25 }));
  o.push(shade(H, FACE, 1.2 * Math.PI, 0.62 * Math.PI, [-6, 9, -7.4, 5, -8.2, 1, -8.4, -3, -9, -6.6], SK, -0.14));
  // the beard: flaxen, full and curling, from ear to ear
  const sw = s * 0.25;
  o.push(H.P([-10.6, 2, -12.8, 10, -11.6, 18, -8.8, 24, -6 + sw, 28.4, -3 + sw, 27.4, 0 + sw, 31, 3.4 + sw, 28.6, 6.6 + sw, 29.6, 9.2, 25, 11.8, 20, 13.4, 13, 13.2, 6, 12, 3,
    9, 6.6, 5, 7.4, 2, 7.8, -3, 6.8, -6.6, 6.4, -9, 4], BE, { bv: 5, ink: -0.04 }));
  const curls: Array<[Pt, Pt, Pt, number]> = [[[-8.6, 9], [-10.6, 16], [-8, 23], -0.3], [[-4, 14], [-5.4, 20], [-4 + sw, 26.4], -0.3], [[1, 16], [0, 23], [0.4 + sw, 29], -0.28], [[6, 15], [7.4, 21], [5.8 + sw, 27.6], -0.28], [[10.6, 9], [12, 15], [10, 21], -0.3]];
  for (const [a, c, e, ink] of curls) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.5, 0.4, BE, 3, { ink }));
  }
  for (const [a, c, e] of [[[8.4, 12], [10, 17], [8.6, 22]], [[3.4, 17], [4, 22], [3, 26.6]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0] + sw, e[1], 0.5, 0.4, BE, 3, { ink: 0.12 })); // locks catching the light
  // the grin, under a moustache swept up by it
  o.push(H.P([-3, 9.6, 3, 10.4, 9.4, 9.4, 7.8, 13, 3, 14.6, -1, 13], 'scr_olafMouth'));
  o.push(H.P([-2.4, 9.8, 3, 10.6, 9, 9.6, 8.6, 11.2, 3, 12, -1.8, 11.2], 'scr_olafTeeth'));
  o.push(H.E(3.4, 15, 3.4, 1.3, RU, { fl: 0.4, ink: -0.06 }));
  o.push(H.S(3.4, 7.4, -2, 8.6, -7.4, 6, 2.4, 0.9, BE, 4, { ink: -0.02 }));
  o.push(H.S(3.4, 7.4, 8.6, 8.4, 12, 5.8, 2.4, 0.9, BE, 4, { ink: 0.06 }));
  // round rosy cheeks under the eyes
  o.push(H.E(-5.6, 4.4, 3.8, 2.4, RU, { fl: 0.5, ink: -0.06, occ: false }));
  o.push(H.E(7.2, 4, 3, 2.2, RU, { fl: 0.5, occ: false }));
  // the eyes: twinkling half-moons, creased by the grin
  const blink = f === 2;
  for (const [x, y, w, k] of [[-4.8, -1.6, 2.5, 1], [5.4, -1.8, 2, 0.85]]) {
    o.push(H.E(x, y + 0.2, w + 1, 2.2, SK, { fl: 0.8, ink: -0.2 }));
    if (!blink) {
      o.push(H.E(x + 0.2, y + 0.5, w * 0.82, 1.3 * k, 'scr_olafEye'));
      o.push(H.X(x + 0.4, y - 0.2, 0.7, 0.7, '#fff2d8', { em: true }));
    } else o.push(H.K(x - w, y + 0.6, x + w, y + 0.4, 0.4, 0.4, 'scr_olafEye', { ink: 0.1 }));
    o.push(H.K(x - w - 0.4, y + 0.8, x, y - 1, 0.6, 0.6, 'scr_olafEye', { ink: 0.14 }), H.K(x, y - 1, x + w + 0.4, y + 0.6, 0.6, 0.5, 'scr_olafEye', { ink: 0.14 }));
    o.push(H.K(x - w * 0.6, y + 2.2, x + w * 0.8, y + 2, 0.4, 0.4, SK, { ink: -0.22 })); // the crease of the smile beneath
  }
  o.push(H.K(-8.4, -1.2, -10.2, -2.4, 0.4, 0.3, SK, { ink: -0.3 }), H.K(-8.4, 0.4, -10.2, 0.8, 0.4, 0.3, SK, { ink: -0.3 })); // laugh lines
  // brows, flaxen, lifted
  o.push(H.K(-8, -4.8, -1.8, -6.4, 1.1, 0.8, BE, { ink: -0.02 }));
  o.push(H.K(3.2, -6.2, 8.4, -5.4, 0.9, 0.7, BE, { ink: 0.04 }));
  // the nose: a round ruddy bulb
  o.push(H.P([0.6, -3.8, 2.2, -3.8, 4.4, 0.6, 3.2, 2, 1.4, -0.6], SK, { fl: 1, ink: -0.14 })); // the shadow side of the bridge
  o.push(H.E(5.6, 3, 3.1, 2.7, RU, { fl: 0.2, ink: 0.02 }));
  o.push(H.K(3.8, 4.8, 5.2, 5.2, 0.5, 0.5, 'scr_olafMouth', { ink: 0.1 }));
  // the hat: a round fur crown and a tawny roll for a brim, its flap over the near ear
  o.push(H.E(-12, 4, 3.6, 8, 'scr_olafBrim', { fl: 0.3, ink: -0.14 }));
  o.push(H.E(-1, -14.4, 15, 10.4, 'scr_olafHat', { fl: 0.15 }));
  o.push(H.S(-15, -6.4, -1, -13.2, 14.4, -8.8, 3.6, 3.4, 'scr_olafBrim', 6, { ink: 0.02 }));
  for (const t of [0.14, 0.38, 0.62, 0.86]) { const [x, y] = qpt([-15, -6.4], [-1, -13.2], [14.4, -8.8], t); o.push(H.K(x - 0.5, y - 2.6, x + 0.5, y + 2.6, 0.35, 0.35, 'scr_olafBrim', { ink: -0.32 })); }

  // the near fist, a bundle of tallow candles hanging from it by the wicks
  o.push(K(4, 99, 12, 84, 6.6, 5.4, 'scr_olafTunic', { ink: -0.12 }));
  o.push(K(4.6, 88, 15.4, 90, 1, 1, 'scr_olafTunic', { ink: -0.34 })); // the cuff
  o.push(E(14, 80, 4.6, 4, SK, { fl: 0.3, ink: -0.06 }));
  for (let i = 0; i < 3; i++) o.push(K(10.6, 77.6 + i * 2, 17.6, 77.8 + i * 2.1, 1.1, 1, SK, { ink: 0.02 }));
  for (let i = 0; i < 4; i++) {
    const x = 10.4 + i * 2.6 + s * 0.3;
    o.push(K(12.6 + i * 1.2, 83, x, 85.6, 0.5, 0.5, 'linen', { occ: false }));
    o.push(K(x, 86, x + 0.2, 99 - (i % 2) * 3, 1.2, 1.1, 'scr_olafTallow', { ink: -0.04 - (i % 2) * 0.06 }));
  }

  // the far arm raised, the lantern hung from the fist
  o.push(K(100, 100, 94, 74, 8, 6.4, 'scr_olafTunic', { ink: -0.12 }));
  o.push(K(94, 74, lx + 3.4, 42, 6.4, 4.8, 'scr_olafTunic', { ink: -0.04 }));
  o.push(K(87, 48, 92.6, 50.4, 0.9, 0.9, 'scr_olafTunic', { ink: -0.32 })); // the cuff
  o.push(E(lx + 1, 39.4, 4.6, 4.2, SK, { fl: 0.3 }));
  for (let i = 0; i < 3; i++) o.push(K(lx - 2.6, 37.6 + i * 1.9, lx + 1.8, 38 + i * 1.9, 0.9, 0.9, SK, { ink: 0.04 }));
  o.push(K(lx, 42, lx, 46, 0.6, 0.6, 'scr_olafIron'));
  // the lantern: iron cap and foot, horn panes glowing with the flame inside
  o.push(P([lx - 6.4, 50, lx + 6.4, 50, lx + 3.6, 45.6, lx - 3.6, 45.6], 'scr_olafIron', { bv: 1 }));
  o.push(E(lx, ly, 6, 8, 'scr_olafPane', { fl: 0.3, ink: -0.16 + (fl - 1) * 0.3 }));
  o.push(E(lx, ly + 0.6, 2.2 * fl, 3.8 * fl, 'emFire'));
  o.push(E(lx, ly + 1.4, 1.1, 1.8 * fl, 'emFireCore'));
  o.push(K(lx - 6, 50, lx - 6, 66, 0.8, 0.8, 'scr_olafIron'), K(lx + 6, 50, lx + 6, 66, 0.8, 0.8, 'scr_olafIron'), K(lx + 0.4, 50, lx + 0.4, 66, 0.5, 0.5, 'scr_olafIron', { ink: -0.1 }));
  o.push(P([lx - 6.8, 66, lx + 6.8, 66, lx + 5.2, 69.4, lx - 5.2, 69.4], 'scr_olafIron', { bv: 1 }));
  o.push(Lt(lx - 1, ly - 1, 78, '#ff9a40', 1.45 * fl, 9));
  return o;
}

/**
 * Astrid the Alchemist: slender and fine-boned, an auburn braid over her
 * shoulder, her vials against frost and venom on the bandolier; she lifts a
 * flask of the gold draught, and its glow (and its steam) is the light on her
 * knowing half-smile.
 */
export function astridPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.08, 0.94, 1.04][f % 4];
  const o: Out = [];
  const GR = 'scr_astridGround', HA = 'scr_astridHalo', SK = 'scr_astridSkin', HR = 'scr_astridHair';
  const kx = 77, ky = 62; // the flask's belly
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(64, 52, 66, 62, GR, { fl: 1, ink: BAND[2] }));
  o.push(E(kx, ky, 23, 22, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(kx, ky, 14, 13.5, HA, { fl: 1, ink: BAND[2] }));
  // a shelf of her bottles, dark at the top right
  o.push(K(60, 20, 99, 20, 1.2, 1.2, GR, { ink: BAND[2] + 0.06 }));
  for (const [x, w, h, neck] of [[66, 3.2, 6, 2], [74, 2.4, 9, 3], [82, 4, 5, 2], [90, 2.6, 7.6, 3]]) {
    o.push(E(x, 19 - h / 2, w, h / 2, GR, { fl: 1, ink: BAND[3] - 0.08 }));
    o.push(K(x, 19 - h, x, 19 - h - neck, 0.9, 0.8, GR, { ink: BAND[3] - 0.08 }));
  }
  // herbs hung to dry at the left
  for (const [x, l] of [[6, 16], [13, 12], [20, 15]]) {
    o.push(K(x, -1, x, 4, 0.5, 0.5, GR, { ink: BAND[2] }));
    o.push(P([x - 0.6, 4, x + 0.6, 4, x + 3.6, 4 + l, x, 4 + l * 0.8, x - 3.6, 4 + l], GR, { ink: BAND[2] + 0.08 }));
  }

  const by = -b * 0.45;
  const H = hf(45, 46.4 + by, 1.3);
  // hair gathered behind the head into a knot
  o.push(H.E(-7, 1, 8, 11, HR, { fl: 0.2, ink: -0.32 }));
  o.push(H.E(-12, -3.4, 4.8, 5.4, HR, { fl: 0.2, ink: -0.26 }));
  o.push(H.K(-14.4, -5, -9.6, -1.2, 0.4, 0.4, HR, { ink: -0.5 }));
  // gown and shawl over slender shoulders
  o.push(P([2, 97, 6, 84, 18, 76, 34, 70 + by, 54, 70 + by, 68, 73, 80, 82, 86, 97], 'scr_astridGown', { bv: 5, n: [0, -0.12, 1] }));
  o.push(H.P([-5.2, 6, 2.8, 8, 3, 22, -6.4, 22], SK, { n: [0.1, -0.1, 1], ink: -0.1 })); // the neck
  o.push(H.P([-5.2, 6, -2.6, 8, -3.4, 22, -6.4, 22], SK, { ink: -0.26 }));
  o.push(H.E(0.6, 13.6, 5.2, 2.6, SK, { fl: 1, ink: -0.3 })); // the shadow under the jaw
  o.push(P([33, 70 + by, 54, 70 + by, 55, 75, 45, 80, 34, 76], SK, { bv: 3, ink: -0.06 })); // the neckline
  o.push(P([2, 97, 6, 84, 16, 76, 31, 70, 36, 77, 30, 87, 24, 97], 'scr_astridShawl', { bv: 3, ink: 0.02 }));
  o.push(P([54, 71, 66, 72, 78, 80, 86, 97, 72, 97, 64, 86, 55, 77], 'scr_astridShawl', { bv: 3 }));
  // the bandolier across her, three vials on it: frost, venom, rune
  o.push(K(20, 77, 60, 99, 1.8, 1.8, 'leatherDark', { ink: 0.02 }));
  const vials: Array<[number, string]> = [[0.26, 'scr_astridFrost'], [0.5, 'scr_astridVenom'], [0.74, 'scr_astridRune']];
  for (const [t, m] of vials) {
    const x = 20 + 40 * t, y = 77 + 22 * t;
    o.push(K(x, y - 2.4, x, y + 3.4, 1.7, 1.6, m, { ink: -0.02 }));
    o.push(K(x, y - 3.6, x, y - 2.2, 1.1, 1.1, 'woodDark', { ink: 0.04 }));
    o.push(X(x - 1, y - 1.6, 0.8, 1.6, '#f6fbff', { em: true, glow: false }));
  }
  // the braid, from behind the far jaw down over her shoulder, tied in leather
  const bw = s * 0.25;
  const ba = H.pt(7, 7), bc = H.pt(10.4, 17), be: Pt = [ba[0] + 3 + bw, ba[1] + 31];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, [x, y] = qpt(ba, bc, be, t);
    const r = 3 - t * 0.8;
    o.push(E(x - 0.8, y, r * 1.05, r * 0.52, HR, { a: 0.62, fl: 0.15, ink: -0.04 }), E(x + 0.8, y + 1.5, r * 1.05, r * 0.52, HR, { a: -0.62, fl: 0.15, ink: -0.18 }));
  }
  o.push(K(be[0] - 1.6, be[1] + 1.6, be[0] + 1.6, be[1] + 1.6, 1.2, 1.2, 'leatherDark'));
  o.push(P([be[0] - 1.4, be[1] + 2.6, be[0] + 1.4, be[1] + 2.6, be[0] + 2 + bw, be[1] + 7.4, be[0] + bw, be[1] + 5.8, be[0] - 2 + bw, be[1] + 7.4], HR, { bv: 0.8 }));

  // the face: a narrow oval, a fine pointed chin, the near side in shadow
  const FACE: Face = [0, 0, 10, 12.6];
  o.push(H.E(2, 6.6, 7.2, 6.8, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.6 * Math.PI, [-3.2, 9.6, -4.6, 6.6, -5.4, 3.8, -6.4, 1.8, -6.4, -2, -7.2, -6.2], SK, -0.12));
  // the eyes: almond, green, on you
  const blink = f === 3;
  for (const [x, y, w, k] of [[-3.6, -0.8, 2.6, 1], [4.8, -1, 2.1, 0.84]]) {
    o.push(H.E(x, y, w + 0.8, 2, SK, { fl: 0.8, ink: -0.14 }));
    if (!blink) {
      o.push(H.E(x, y + 0.2, w, 1.2 * k, 'scr_astridWhite', { ink: -0.06 }));
      o.push(H.E(x + 0.6 * k, y + 0.2, 1.2 * k, 1.2 * k, 'scr_astridIris'));
      o.push(H.X(x + 0.3 * k, y - 0.3, 0.9, 1, 'scr_astridLash:1'));
      o.push(H.X(x + 0.1, y - 0.6, 0.6, 0.6, '#fff6e6', { em: true }));
      o.push(H.K(x - w - 0.2, y + 0.4, x + w * 0.2, y - 1, 0.5, 0.45, 'scr_astridLash'), H.K(x + w * 0.2, y - 1, x + w + 0.8, y - 0.6, 0.45, 0.35, 'scr_astridLash'));
    } else o.push(H.K(x - w - 0.2, y + 0.4, x + w + 0.8, y + 0.2, 0.45, 0.35, 'scr_astridLash'));
  }
  // brows: fine, the near one lifted
  o.push(H.K(-7, -3.4, -3.6, -5.2, 0.6, 0.55, HR), H.K(-3.6, -5.2, -0.8, -4.6, 0.55, 0.4, HR));
  o.push(H.K(2.8, -4.4, 7.6, -4, 0.55, 0.4, HR));
  // the nose: straight and fine, its shadow on the near side
  o.push(H.P([0.8, -2.4, 1.9, -2.4, 3.8, 2.8, 5.4, 4.6, 4.2, 5.9, 2.6, 5.5, 2.2, 3.4, 1.2, 0.2], SK, { fl: 1, ink: -0.15 }));
  o.push(H.E(4.5, 4.2, 1.5, 1.2, SK, { fl: 0.6, ink: -0.06 }));
  o.push(H.K(3, 5.5, 4.2, 5.6, 0.4, 0.35, SK, { ink: -0.34 }));
  // the mouth: closed, the near corner lifted in a knowing half-smile
  o.push(H.S(-0.4, 6.8, 2.4, 7.9, 5.2, 7, 0.62, 0.45, 'scr_astridLip', 3, { ink: -0.1, occ: false }));
  o.push(H.E(2.6, 9.5, 1.8, 0.85, 'scr_astridLip', { fl: 0.3, ink: 0.06, occ: false }));
  o.push(H.S(-0.6, 6.7, 2.4, 9.4, 5.4, 7.3, 0.42, 0.34, 'scr_astridLash', 4, { ink: -0.2 }));
  o.push(H.K(-1.4, 5.8, -0.7, 6.9, 0.4, 0.32, SK, { ink: -0.3 })); // the dimple of it
  o.push(H.E(2.8, 11.1, 1.5, 0.6, SK, { fl: 1, ink: -0.1 })); // under the lip
  // hair: a crown of auburn, the fringe swept across the near brow
  o.push(H.P([-9.6, 4, -11, -6, -6.6, -12.6, 1, -14.8, 7.6, -12.4, 10.4, -6.6, 9.4, -3.8, 6, -7, 1, -6.6, -3.6, -5.4, -7.6, -1.4], HR, { bv: 3 }));
  for (const [a, c, e] of [[[5, -12.6], [-2, -8.8], [-8.6, -1]], [[7.6, -10.6], [2, -7.4], [-3.6, -5.4]], [[1, -14], [-6.6, -10.6], [-10, -3]]]) {
    o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.45, 0.4, HR, 3, { ink: -0.26 }));
  }
  o.push(H.S(5.6, -13.2, 9.8, -8.8, 10, -3.6, 1, 0.7, HR, 3, { ink: 0.04 })); // the lit edge of the parting

  // the far arm raised, the hand cupping the flask
  o.push(K(99, 99, 89, 80, 6.4, 5, 'scr_astridGown', { ink: -0.06 }));
  o.push(K(89, 80, kx + 3, 71, 5, 3.8, 'scr_astridGown', { ink: 0 }));
  o.push(E(kx + 1, 71, 4.6, 3.4, SK, { fl: 0.3 }));
  // the flask: a round belly of glass, the gold draught in it, a long neck
  o.push(E(kx, ky, 7.6, 7.2, 'scr_astridGlass', { fl: 0.1 }));
  o.push(E(kx, ky + 1.2, 6.4, 5.6, 'scr_astridElixir', { ink: -0.12 + (p - 1) * 0.6 }));
  o.push(K(kx - 5.6, ky - 2, kx + 5.6, ky - 2, 0.5, 0.5, 'scr_astridElixir', { ink: 0.1 + (p - 1) * 0.6 }));
  o.push(K(kx, ky - 6.6, kx, ky - 16, 2, 1.7, 'scr_astridGlass'));
  o.push(K(kx - 2.6, ky - 16.4, kx + 2.6, ky - 16.4, 1, 1, 'scr_astridGlass', { ink: 0.06 }));
  o.push(X(kx - 4.6, ky - 4.4, 1.2, 2.2, '#f6fbff', { em: true, glow: false }));
  for (let i = 0; i < 3; i++) o.push(K(kx - 3.4 + i * 2.4, ky + 6.4, kx - 4.2 + i * 2.6, ky + 9.2, 1.1, 1, SK, { ink: 0.02 }));
  o.push(K(kx - 6.4, ky + 5.6, kx - 6, ky + 1.6, 1.1, 0.9, SK, { ink: 0.06 }));
  // the steam rising off it
  for (let i = 0; i < 4; i++) {
    const y = ky - 19.6 - i * 3.6 - (f % 2) * 1.2, x = kx + Math.sin(i * 1.3 + f * 0.9) * (0.8 + i * 0.7);
    o.push(E(x, y, 1.5 - i * 0.18, 1.2 - i * 0.12, 'scr_astridSteam', { ink: -0.3 - i * 0.12, glow: false }));
  }
  o.push(Lt(kx - 2, ky - 2, 70, '#f6c64a', 1.4 * p, 9));
  return o;
}

/**
 * Banker Haakon of the First Bank of Bjarnarhaven: lean, upright, his grey
 * hair combed back and his beard trimmed to a point, the gold chain of office
 * on his fur collar. He holds up his balance and weighs your coin with a
 * shrewd half-lidded eye, lit by the lamp on his counter of gold.
 */
export function haakonPortrait(f: number): PrimTree {
  const b = breath(f);
  const fl = [1, 0.9, 1.08, 0.96][f % 4];
  const tilt = [0, 0.5, 0.8, 0.4][f % 4];
  const o: Out = [];
  const GR = 'scr_haakonGround', HA = 'scr_haakonHalo', SK = 'scr_haakonSkin', HR = 'scr_haakonHair';
  const lx = 76, ly = 76; // the lamp's flame
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(62, 54, 64, 60, GR, { fl: 1, ink: BAND[2] }));
  o.push(E(lx, ly, 26, 24, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(lx, ly, 15, 14, HA, { fl: 1, ink: BAND[2] }));
  // his strongbox, iron-bound, dark behind him at the left
  o.push(P([-1, 30, 20, 27, 22, 66, -1, 70], GR, { ink: BAND[2] + 0.04 }));
  for (const y of [34, 48, 62]) o.push(K(-1, y + 2, 21, y - 1, 1.1, 1.1, GR, { ink: BAND[3] - 0.04 }));

  const by = -b * 0.45;
  // the coat: lean shoulders, held straight; the dark doublet in its opening
  o.push(P([-2, 97, 2, 86, 16, 78, 34, 73 + by, 58, 73 + by, 74, 78, 86, 88, 90, 97], 'scr_haakonCoat', { bv: 5, n: [0, -0.12, 1] }));
  o.push(P([40, 73, 54, 73, 57, 99, 37, 99], 'scr_haakonCoatDark', { bv: 1.4 }));
  o.push(E(46, 72, 17, 6.4, 'scr_haakonFur', { fl: 0.3, ink: -0.16 })); // the fur rising behind his neck
  const H = hf(47, 44.4 + by, 1.25);
  o.push(H.P([-6.2, 6, 2.8, 9, 3.4, 24, -6.8, 24], SK, { n: [0.1, -0.1, 1], ink: -0.14 })); // the neck
  o.push(H.P([-6.2, 6, -3.4, 9, -4, 24, -6.8, 24], SK, { ink: -0.3 }));
  o.push(H.E(0.8, 14.6, 5.4, 2.6, SK, { fl: 1, ink: -0.32 })); // the shadow under the jaw
  o.push(P([40, 71 + by, 54, 71 + by, 53, 77, 47, 80, 41, 77], 'linen', { bv: 1.4, ink: 0.04 })); // a white collar at the throat
  // the fur collar: over the shoulders and down both edges of the gown's opening
  o.push(P([-1, 90, 10, 80, 26, 73 + by, 39, 71 + by, 42, 76, 40, 86, 38, 99, 22, 99, 10, 96], 'scr_haakonFur', { bv: 3.6, ink: -0.02 }));
  o.push(P([53, 71 + by, 64, 72 + by, 78, 78, 88, 90, 82, 97, 68, 99, 56, 99, 54, 86, 52, 76], 'scr_haakonFur', { bv: 3.2, ink: -0.08 }));
  for (const [x0, y0, x1, y1] of [[8, 84, 12, 88], [16, 79, 19, 84], [24, 76, 26, 81], [41, 80, 37, 82], [40, 90, 36, 91], [60, 74, 59, 79], [70, 77, 68, 82], [54, 82, 58, 84], [55, 92, 59, 93]]) o.push(K(x0, y0, x1, y1, 0.55, 0.4, 'scr_haakonFur', { ink: -0.32 }));
  // the chain of office, swagged low, its medallion at the point
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, [x, y] = qpt([22, 82], [47, 104], [72, 82], t);
    o.push(E(x, y, 1.4, 1.2, 'gold', { fl: 0.3, ink: i % 2 ? -0.08 : 0 }));
  }
  o.push(E(47, 93, 4.6, 4.6, 'gold', { fl: 0.4 }));
  o.push(E(47, 93, 2.6, 2.6, 'gold', { fl: 0.7, ink: -0.24 }));
  o.push(E(47.6, 92.4, 1.2, 1.2, 'gold', { ink: 0.08 }));

  // the face: long and lean, the near side in shadow, hollow under the cheekbone
  const FACE: Face = [0, 0, 9.6, 13.4];
  o.push(H.E(2, 6.6, 7.4, 7.6, SK, { fl: 0.3 }));
  o.push(H.E(...FACE, SK, { fl: 0.3 }));
  o.push(shade(H, FACE, 1.22 * Math.PI, 0.6 * Math.PI, [-2.4, 10.6, -1.8, 8, -2.6, 5.6, -5, 3.6, -6, 1.4, -6, -3, -6.8, -7.4], SK, -0.13));
  // the near ear
  o.push(H.E(-8.4, 1.4, 2.2, 3.8, SK, { fl: 0.3, ink: -0.08 }));
  o.push(H.E(-8.2, 1.6, 1, 2.2, SK, { fl: 0.8, ink: -0.3 }));
  // hair: iron-grey, combed straight back from a high brow, full at the nape
  o.push(H.P([6.6, -10.6, 3, -14.4, -4, -15.4, -10.4, -12, -12.6, -4, -11.4, 3.6, -9.6, 5.6, -10, -1, -7.4, -6.2, -3.2, -9.2, 1.8, -10.4], HR, { bv: 2.6 }));
  for (const [a, c, e] of [[[4, -12.6], [-3, -13.4], [-9.4, -8]], [[1.4, -10.6], [-5, -10.8], [-10.4, -4]]]) o.push(H.S(a[0], a[1], c[0], c[1], e[0], e[1], 0.4, 0.35, HR, 3, { ink: 0.12 }));
  o.push(H.S(-9.8, -6, -11.6, 0, -10.2, 4.6, 0.5, 0.4, HR, 3, { ink: -0.3 }));
  // the eyes: grey-blue, narrowed under heavy lids
  const blink = f === 1;
  for (const [x, y, w, k] of [[-3.2, -1, 2.5, 1], [5, -1.2, 2, 0.84]]) {
    o.push(H.E(x, y, w + 1, 2.4, SK, { fl: 0.8, ink: -0.24 }));
    if (!blink) {
      o.push(H.E(x, y + 0.3, w * 0.9, 1 * k, 'scr_haakonWhite', { ink: -0.08 }));
      o.push(H.E(x + 0.5 * k, y + 0.3, 1.05 * k, 1 * k, 'scr_haakonIris'));
      o.push(H.X(x + 0.3 * k, y, 0.7, 0.7, 'scr_haakonEye:1'));
      o.push(H.X(x, y - 0.1, 0.5, 0.5, '#fff4e0', { em: true }));
    }
    o.push(H.K(x - w - 0.4, y - 0.3, x + w + 0.3, y - 0.6, 0.8, 0.65, SK, { ink: -0.06 })); // the heavy lid
    o.push(H.K(x - w - 0.4, y + 0.2, x + w + 0.3, y - 0.1, 0.32, 0.28, 'scr_haakonEye', { ink: 0.1 }));
    o.push(H.K(x - w * 0.6, y + 2, x + w * 0.7, y + 1.8, 0.35, 0.3, SK, { ink: -0.24 })); // the pouch beneath
  }
  // brows: grey, the near one arched in doubt
  o.push(H.K(-6.8, -3.4, -3.4, -5.8, 0.75, 0.65, HR, { ink: 0.04 }), H.K(-3.4, -5.8, -0.6, -4.8, 0.65, 0.45, HR, { ink: 0.04 }));
  o.push(H.K(2.8, -4, 8, -4.2, 0.65, 0.45, HR, { ink: 0.06 }));
  // the nose: long and straight
  o.push(H.P([0.6, -3.6, 1.9, -3.6, 4.8, 3.2, 6.8, 5.8, 5.4, 7, 3.6, 6.6, 3, 4.2, 1.2, 0.2], SK, { fl: 1, ink: -0.15 })); // its shadow side
  o.push(H.E(6.1, 5.1, 1.9, 1.6, SK, { fl: 0.5, ink: -0.01 }));
  o.push(H.K(4.4, 6.7, 5.9, 6.9, 0.45, 0.45, 'scr_haakonEye', { ink: 0.1 }));
  // the mouth: thin lips pressed into a polite smile under a trim moustache
  o.push(H.P([0.2, 9.8, 1.8, 7.9, 4.4, 7.4, 7.2, 7.9, 8.6, 9.6, 6.8, 9, 4.4, 8.6, 2.2, 9.2], HR, { bv: 0.8, ink: -0.02 }));
  o.push(H.K(1.8, 9.6, 6.8, 9.4, 0.3, 0.26, SK, { ink: -0.36 }));
  o.push(H.E(4.3, 10.5, 1.8, 0.7, SK, { fl: 0.4, ink: -0.02 }));
  // the beard, trimmed to a point
  o.push(H.P([-1, 10.4, 1.6, 11.8, 7.4, 11.4, 8.6, 13.4, 6.4, 20.6, 3.4, 26.4, 1.2, 20.6, -2.2, 14.6], HR, { bv: 2 }));
  o.push(H.K(3.8, 13.6, 3.4, 23.6, 0.35, 0.3, HR, { ink: -0.28 }));

  // the counter, the lamp on it and his gold
  o.push(P([54, 89, 99, 87, 99, 99, 54, 99], 'scr_haakonCounter', { bv: 1.6, ink: -0.06 }));
  o.push(K(54, 89, 99, 87, 0.7, 0.7, 'scr_haakonCounter', { ink: 0.1 }));
  for (const [x, n] of [[60, 4], [65.4, 6], [92, 3]]) for (let i = 0; i < n; i++) o.push(E(x, 88 - i * 1.5, 2.6, 1, 'gold', { fl: 0.5, ink: i % 2 ? -0.08 : 0.02 }));
  o.push(E(lx - 2, 85, 6.4, 3.6, 'scr_haakonLamp', { fl: 0.3 }));
  o.push(K(lx - 3, 83, lx + 0.6, 80, 1.5, 1.1, 'scr_haakonLamp', { ink: 0.02 })); // its spout
  o.push(E(lx + 0.6, ly + 0.6, 1.6 * fl, 3.4 * fl, 'emFire'));
  o.push(E(lx + 0.6, ly + 1.6, 0.8, 1.6, 'emFireCore'));
  // the balance, held up in his fist; the gold weighs one pan down
  const px = 80, py = 36;
  const ax = px - 12, ay = py + tilt, bx = px + 12, bY = py - tilt;
  o.push(K(99, 99, 91, 66, 6.4, 5, 'scr_haakonCoat', { ink: -0.08 }));
  o.push(K(px, 60, px, py - 1, 0.8, 0.7, 'bronze'));
  o.push(E(px, py - 1.6, 1.4, 1.4, 'bronze'));
  o.push(K(ax, ay, bx, bY, 0.8, 0.8, 'bronze'));
  for (const [x, y, load] of [[ax, ay, 1], [bx, bY, 0]]) {
    o.push(K(x, y, x - 3.6, y + 10, 0.4, 0.4, 'linen', { occ: false }), K(x, y, x + 3.6, y + 10, 0.4, 0.4, 'linen', { occ: false }));
    o.push(E(x, y + 10.6, 5, 1.6, 'bronze', { fl: 0.5 }));
    if (load) for (const [dx, dy] of [[-2, 0], [1.4, 0], [-0.4, -1.3]]) o.push(E(x + dx, y + 9.2 + dy, 1.8, 0.8, 'gold', { fl: 0.4 }));
    else o.push(E(x + 0.4, y + 9.4, 1.6, 0.7, 'silver', { fl: 0.4 }));
  }
  o.push(E(px + 3, 62, 4.4, 4, SK, { fl: 0.3, ink: -0.02 }));
  for (let i = 0; i < 3; i++) o.push(K(px - 1.4, 59.8 + i * 1.8, px + 4.4, 60.4 + i * 1.8, 0.9, 0.85, SK, { ink: 0.04 }));
  o.push(Lt(lx, ly - 1, 84, '#ffbe5c', 1.45 * fl, 10));
  return o;
}
