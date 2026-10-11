import { E, K, P, X, Lt, breath, sway, hash2, clamp, type PrimTree } from './kit';
import { BAND, ground, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9e, group E: the giants. The Jötunn Champion and the Fire Giant. Conventions: portraitKit.ts. */

/** Keep the part of a polygon where (p - m) . d <= off. */
function clipHalf(poly: Pt[], m: Pt, d: Pt, off: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = (a[0] - m[0]) * d[0] + (a[1] - m[1]) * d[1] - off, fb = (b[0] - m[0]) * d[0] + (b[1] - m[1]) * d[1] - off;
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// ============================================================= JÖTUNN CHAMPION
/**
 * A frost-jötunn champion of the Maw of Malice: he stands upright and looks down at you,
 * helmed, a bearskin on his shoulders, his beard gathered in one iron ring, his bearded
 * axe grounded at his side. The frost in his blood burns in his narrowed eyes, and they
 * are the only light.
 */
export function jotunChampionPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 1.1, 0.92, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gJotunChamp', SK = 'scr_jotunChampSkin', FUR = 'scr_jotunChampFur', BD = 'scr_jotunChampBeard';
  const HM = 'scr_jotunChampHelm', RM = 'scr_jotunChampRime', AX = 'scr_jotunChampAxe', MAW = 'scr_jotunChampMaw';
  o.push(ground(BG, 34, 26, 76, 62));
  // rime falling slow
  for (let i = 0; i < 7; i++) {
    const x = 4 + hash2(i, 31) * 88, y = (hash2(i, 33) * 60 + f * 3 + i * 2) % 60 + 4;
    o.push(X(x, y, 0.9, 0.9, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
  }

  const by = -b * 0.5;
  const hx = 49, hy = 44 + by;
  // the fur mantle over the great shoulders, in shadow below the light
  o.push(P([-2, 97, -2, 71, 6, 63, 18, 58.6, 32, 59 + by, 40, 63 + by, 58, 63 + by, 66, 59 + by, 80, 58.4, 92, 62, 98, 68, 98, 97], FUR, { bv: 9, n: [0, 0.45, 1], ink: -0.3 }));
  // a mail shirt on the chest, a baldric across it
  o.push(P([27, 97, 30, 72, 39, 66 + by, 59, 66 + by, 68, 72, 71, 97], 'scr_jotunChampMail', { bv: 5, ink: -0.06 }));
  o.push(K(28, 99, 70, 69, 2.2, 2.2, 'leatherDark', { ink: -0.06 }));
  // the great shoulders under the bearskin, and its tufted edges falling past the mail
  o.push(E(9, 80, 27, 22, FUR, { fl: 0.05 }));
  o.push(E(89, 82, 24, 22, FUR, { fl: 0.05, ink: -0.08 }));
  const tufts = (x0: number, y0: number, x1: number, y1: number, n: number, sd: number, ink: number, dir: number): void => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = hash2(i, sd);
      o.push(P([x - 2.8 * dir, y - 2.6, x + 2.4 * dir, y - 1.6, x + dir * (2.2 + h * 1.4) + s * 0.2, y + 3.4 + h * 1.6, x - 1.4 * dir, y + 1.6], FUR, { bv: 1.4, ink: ink - h * 0.1 - t * 0.12 }));
    }
  };
  tufts(32.6, 64, 31.4, 95, 7, 5, -0.02, 1);
  tufts(65.6, 66, 67, 95, 7, 9, -0.14, -1);
  // iron lames on the near shoulder, one over the other
  const lame = (a: Pt, c: Pt, e: Pt, w: number, ink: number): void => {
    const L: number[] = [], R: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const [x, y, tx, ty] = qpt(a, c, e, i / 8), l = Math.hypot(tx, ty) || 1, ww = w * (0.8 + 0.2 * Math.sin((i / 8) * Math.PI));
      L.push(x + (ty / l) * ww, y - (tx / l) * ww);
      R.unshift(x - (ty / l) * ww, y + (tx / l) * ww);
    }
    o.push(P([...L, ...R], HM, { bv: w * 0.7, n: [0.1, -0.3, 1], ink }));
    for (const t of [0.2, 0.5, 0.8]) { const [x, y] = qpt(a, c, e, t); o.push(X(x - 0.5, y - w * 0.55, 1.1, 1.1, HM + ':5')); }
  };
  lame([70, 82], [84, 68], [99, 73], 3.4, -0.2);
  lame([68, 76], [83, 61], [99, 67], 3.6, -0.08);
  lame([66, 70], [82, 54], [99, 61], 3.8, 0.04);
  // rime grown on the pauldron and on the far shoulder's fur, crystals standing up
  const rime = (pts: Pt[], sd: number): void => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2.2);
      for (let j = 0; j < n; j++) {
        const t = j / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = hash2(i * 17 + j, sd);
        o.push(E(x, y + 0.6, 1.4 + h * 1.4, 1 + h * 0.8, RM, { fl: 0.45, ink: (h - 0.5) * 0.16 - 0.08 }));
        if (h > 0.55) o.push(P([x - 1.1, y + 0.4, x + 1.1, y + 0.4, x + (h - 0.75) * 3, y - 2.4 - h * 3.4], RM, { bv: 0.6, ink: -0.06 }));
      }
    }
  };
  rime([[67, 66], [74, 59.6], [82, 56], [90, 55.2], [97, 56.6]], 5);
  rime([[-2, 61.4], [4, 58.6], [12, 58], [20, 59.6], [27, 63.4]], 11);

  // the neck, thick as a tree
  o.push(K(hx, hy + 12, hx + 0.6, hy + 24, 11.5, 12.5, SK, { ink: -0.26 }));
  // the face, broad, under the helm
  o.push(E(hx, hy + 3, 13.4, 15.6, SK, { fl: 0.15 }));
  o.push(E(hx + 0.5, hy + 11, 12.6, 8, SK, { fl: 0.2 }));
  o.push(E(hx - 6.6, hy + 4.6, 4.6, 2.6, SK, { fl: 0.4, ink: 0.06, a: -0.2 })); // cheekbones
  o.push(E(hx + 7.6, hy + 4.6, 3.8, 2.4, SK, { fl: 0.4, ink: 0, a: 0.2 }));
  o.push(E(hx - 5.4, hy + 8.4, 3.6, 2.6, SK, { fl: 0.7, ink: -0.18 })); // hollows under them
  o.push(E(hx + 10.6, hy + 7, 2.6, 4.6, SK, { fl: 0.6, ink: -0.22 })); // the far cheek, turning away
  // the broad nose under the nasal
  o.push(K(hx + 0.4, hy + 1, hx + 1, hy + 7, 2.2, 3, SK, { ink: 0.04 }));
  o.push(E(hx + 1, hy + 8.2, 3.8, 2.6, SK, { ink: 0.02 }));
  o.push(E(hx - 1.4, hy + 9.4, 1.1, 0.7, MAW), E(hx + 3.2, hy + 9.4, 1, 0.7, MAW));
  // the beard: a broad mass from ear to ear, gathered into one iron ring
  const rx = hx + 1 + s * 0.2, ry = hy + 37;
  o.push(P([hx - 15, hy + 4, hx - 12, hy + 12, hx - 8, hy + 16, hx - 2, hy + 17, hx + 4, hy + 17, hx + 10, hy + 15.4, hx + 14, hy + 11, hx + 15.4, hy + 4, hx + 16, hy + 14, hx + 14, hy + 22, hx + 10, hy + 28, rx + 4.6, ry - 4, rx + 3.4, ry, rx - 3.4, ry, rx - 4.6, ry - 4, hx - 9, hy + 29, hx - 14, hy + 22, hx - 16.4, hy + 13], BD, { bv: 4, ink: -0.08 }));
  for (const [x0, y0, ink] of [[-13, 12, -0.24], [-8, 18, -0.14], [-2.4, 19, -0.2], [4, 19, -0.16], [9.6, 17, -0.24], [13.4, 12, -0.3]]) {
    o.push(strand(hx + x0, hy + y0, hx + x0 * 0.7, hy + y0 + (ry - hy - y0) * 0.6, rx + x0 * 0.16, ry - 1, 1.3, 0.6, BD, 3, { ink }));
  }
  // the ring, and the end of the beard flaring out below it
  o.push(P([rx - 3, ry + 1, rx + 3, ry + 1, rx + 5.4 + s * 0.2, ry + 8, rx + 2.6 + s * 0.3, ry + 6.6, rx + 0.6 + s * 0.4, ry + 10, rx - 1.6 + s * 0.3, ry + 6.6, rx - 4.6 + s * 0.2, ry + 8], BD, { bv: 1.6, ink: -0.2 }));
  o.push(K(rx - 3.8, ry, rx + 3.8, ry, 2, 2, HM, { ink: -0.1 }), K(rx - 3.2, ry - 1.1, rx + 3.2, ry - 1.1, 0.45, 0.45, HM, { ink: 0.26, occ: false }));
  o.push(K(rx - 3.8, ry + 1.4, rx + 3.8, ry + 1.4, 0.35, 0.35, HM, { ink: -0.34, occ: false }));
  // the mouth: a sneer, the lip lifted off big teeth on one side, set hard on the other
  o.push(P([hx - 6.6, hy + 13.2, hx - 1, hy + 13, hx + 6, hy + 14.2, hx + 5.6, hy + 15, hx - 1, hy + 15.8, hx - 6, hy + 16.8], MAW));
  for (let i = 0; i < 3; i++) o.push(X(hx - 5.8 + i * 1.8, hy + 13.4 + i * 0.05, 1.4, 1.6, 'boneOld:' + (i ? 4 : 3)));
  for (let i = 0; i < 2; i++) o.push(X(hx - 5.2 + i * 1.8, hy + 15.4 - i * 0.2, 1.4, 1.1, 'boneOld:2'));
  o.push(K(hx - 5, hy + 17.4, hx + 5, hy + 15.8, 1.3, 1, SK, { ink: 0.02 })); // the lower lip, pushed out
  // the moustache, drooping past the corners of the mouth
  o.push(P([hx - 1, hy + 10.2, hx - 6, hy + 10.6, hx - 10, hy + 12.6, hx - 11.4, hy + 19.6, hx - 9, hy + 15.4, hx - 6.4, hy + 12.8, hx + 1, hy + 12.4, hx + 6.6, hy + 13.4, hx + 9.6, hy + 15.4, hx + 11.4, hy + 19, hx + 11.4, hy + 12.6, hx + 7, hy + 10.4, hx + 2.4, hy + 10.2], BD, { bv: 1.6, ink: 0.02 }));

  // the helm: a round iron cap, a ridge over the crown, rime crusted on it
  const hcy = hy - 5, hrx = 16.5, hry = 23;
  const dome: number[] = [];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI;
    dome.push(hx + 0.4 + Math.cos(a) * hrx, hcy + Math.sin(a) * hry);
  }
  o.push(P(dome, HM, { bv: 10, n: [0, -0.1, 1] }));
  o.push(K(hx + 0.4, hcy - hry + 1, hx + 0.4, hcy - 1, 1.3, 1.6, HM, { ink: 0.08 })); // the ridge
  for (const sd of [-1, 1]) o.push(strand(hx + 0.4 + sd * 2, hcy - hry + 3, hx + sd * 12, hcy - 15, hx + sd * 15, hcy - 1, 0.9, 1.1, HM, 4, { ink: 0.02 })); // its bands
  for (const [x, y] of [[-8, -14], [8.8, -14], [-13, -6], [13.6, -6], [0.4, -9], [0.4, -17]]) o.push(X(hx + x - 0.5, hcy + y - 0.5, 1, 1, HM + ':5'));
  for (const [x, y, r] of [[-6, -20, 2.2], [-11, -15, 1.8], [-2, -22.4, 1.6], [3.6, -21.6, 1.4], [-14, -9, 1.4]]) o.push(E(hx + x, hcy + y, r * 1.4, r, RM, { fl: 0.5, ink: -0.08 }));
  // cheek-guards hanging from the brow-band
  o.push(P([hx - 17.4, hcy - 1, hx - 10.6, hcy + 1, hx - 9.6, hcy + 9, hx - 11.6, hcy + 16, hx - 16, hcy + 13, hx - 17.6, hcy + 6], HM, { bv: 2.4, n: [-0.2, 0, 1] }));
  o.push(P([hx + 17.4, hcy - 1, hx + 11.6, hcy + 1, hx + 11, hcy + 9, hx + 12.6, hcy + 15, hx + 16, hcy + 12, hx + 17.4, hcy + 6], HM, { bv: 2.4, n: [0.3, 0, 1], ink: -0.08 }));
  // the brow-band, a scowl cut in iron, and the nasal
  o.push(P([hx - 17.6, hcy - 3, hx - 6, hcy - 3.6, hx + 0.4, hcy - 2, hx + 7, hcy - 3.6, hx + 17.6, hcy - 3, hx + 17.6, hcy + 1, hx + 7, hcy + 1.4, hx + 0.4, hcy + 4.2, hx - 6, hcy + 1.4, hx - 17.6, hcy + 1], HM, { bv: 1.4, ink: 0.06 }));
  o.push(P([hx - 1.6, hcy + 2, hx + 2.4, hcy + 2, hx + 2.2, hcy + 12, hx + 0.4, hcy + 13.4, hx - 1.4, hcy + 12], HM, { bv: 1, ink: 0.04 }));
  // the eyes: frost in his blood, narrowed slits burning cold in the helm's shadow
  const gi = (g - 1) * 0.5;
  o.push(E(hx - 5.8, hcy + 4.6, 4, 2, MAW, { fl: 0.6 }));
  o.push(E(hx + 6.6, hcy + 4.6, 3.6, 1.9, MAW, { fl: 0.6 }));
  o.push(P([hx - 9, hcy + 4.2, hx - 5, hcy + 3.6, hx - 2.2, hcy + 4.8, hx - 5.6, hcy + 5.4], 'emFrost', { ink: gi - 0.1 }));
  o.push(P([hx + 3.4, hcy + 4.8, hx + 6.6, hcy + 3.6, hx + 9.4, hcy + 4.2, hx + 6.4, hcy + 5.3], 'emFrost', { ink: gi - 0.14 }));
  o.push(X(hx - 5.2, hcy + 3.8, 1, 0.8, '#ffffff', { em: true }), X(hx + 6.2, hcy + 3.8, 0.8, 0.8, '#ffffff', { em: true }));
  o.push(Lt(hx + 0.4, hcy + 5, 15, '#9fe6ff', 0.5 * g, 4));

  // the bearded axe, grounded at his side, the frost on its edge
  o.push(K(5, 99, 16, 86, 6.4, 5.6, SK, { ink: -0.26 })); // the forearm
  o.push(K(19, 99, 17.4, 12, 1.8, 1.6, 'woodDark'));
  for (let y = 30; y < 82; y += 9) o.push(K(16.4 + (99 - y) * 0.018, y, 19 + (99 - y) * 0.018, y + 1.4, 0.45, 0.45, 'leatherDark'));
  o.push(E(18, 86, 4.6, 5, SK, { fl: 0.3, ink: -0.12 }));
  for (let i = 0; i < 4; i++) o.push(K(14, 82.4 + i * 2.5, 21.4, 83 + i * 2.5, 1.2, 1.15, SK, { ink: i % 2 ? -0.1 : -0.02 }));
  const ax = 17.4;
  o.push(P([ax + 1.6, 12, ax - 3, 12.4, ax - 8, 9, ax - 12.6, 5, ax - 14.4, 14, ax - 13.6, 24, ax - 12, 33, ax - 9, 38, ax - 7, 30, ax - 4, 25, ax + 1.6, 22], AX, { bv: 2, n: [-0.1, -0.1, 1] }));
  o.push(K(ax - 12.4, 6, ax - 13.4, 18, 0.9, 0.9, RM, { ink: 0.04 }), K(ax - 13.4, 18, ax - 11.4, 33, 0.9, 0.8, RM, { ink: 0.04 })); // rime on the edge
  o.push(K(ax, 10.6, ax, 23.4, 2.6, 2.6, HM, { ink: -0.04 })); // the socket
  o.push(K(ax - 1, 14, ax - 7.4, 14, 0.4, 0.4, AX, { ink: -0.3, occ: false }), K(ax - 1, 19, ax - 6, 23, 0.4, 0.4, AX, { ink: -0.3, occ: false }));
  const gl = [[ax - 13, 9], [ax - 13.8, 17], [ax - 12.8, 25], null][f % 4];
  if (gl) o.push(X(gl[0] - 0.5, gl[1] - 0.5, 1, 1, '#ffffff', { em: true }));
  return o;
}

// ================================================================= FIRE GIANT
/**
 * One of Múspell's sons as he comes at the end of the world, the giant of the Ragnarök
 * ending close up. Surtr's name means "the black", and so is his hide: a crust of black
 * plates, the fire showing through a seam here and there and most at the heart; his head
 * burns. The head is thrust forward under hunched shoulders, white-hot eyes under the
 * brow, the fire of his throat through clenched teeth, embers in a burnt beard, and the
 * black sword with the burning edge raised beside him.
 */
export function fireGiantPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f) * 0.3;
  const p = [1, 1.1, 1.18, 1.06][f % 4];
  const pu = (p - 1) / 0.18;
  const o: Out = [];
  const BG = 'scr_gFireGiant', CR = 'scr_fireGiantCrust', CH = 'scr_fireGiantChar', BL = 'scr_fireGiantBlade', MAW = 'scr_fireGiantMaw';
  o.push(ground(BG, 36, 22, 78, 64));
  // smoke rolling off the fire of his head
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 30 + ((f + i) % 4) * 0.8, y = 10 + (i % 2) * 9;
    o.push(E(x, y, 15, 4.4, BG, { fl: 1, ink: BAND[1] + 0.1 }));
  }
  // ash coming down, embers going up
  for (let i = 0; i < 7; i++) {
    const up = i % 2, y = up ? 70 - ((hash2(i, 51) * 70 + f * 3.2) % 70) : (hash2(i, 51) * 70 + f * 2) % 70, x = 4 + hash2(i, 53) * 88;
    o.push(X(x, y, 0.9, 0.9, up ? 'emFire:4' : BG + ':5', { em: true }));
  }
  /** A lick of flame along a curve a -> e (control c), half-width w at its root: a dark rim, an orange body, a yellow heart. */
  const lick = (a: Pt, c: Pt, e: Pt, w: number, k: number): void => {
    const layers: Array<[number, number, string, number]> = [[1, 1, 'emFire', -0.6], [0.62, 0.78, 'emFire', -0.24], [0.32, 0.46, 'emFireCore', -0.06]];
    for (const [sc, te, m, ink] of layers) {
      const L: number[] = [], R: number[] = [];
      for (let i = 0; i <= 7; i++) {
        const t = (i / 7) * te, [x, y, tx, ty] = qpt(a, c, e, t), l = Math.hypot(tx, ty) || 1, u = t / te;
        const ww = w * sc * Math.pow(1 - u, 0.75) * (1 + 0.25 * Math.sin(u * Math.PI));
        L.push(x - (ty / l) * ww, y + (tx / l) * ww);
        R.unshift(x + (ty / l) * ww, y - (tx / l) * ww);
      }
      o.push(P([...L, ...R], m, { ink: ink + k }));
    }
  };

  const by = -b * 0.4;
  const hx = 48, hy = 48 + by;
  // the head of fire: one blaze off the crown, streaming up and back, tongues tearing off it
  const flames = [
    [-13, -10, -23, -19, -37, -22, 5.4], [8, -14, 13, -27, 6, -39, 5.2], [13, -7, 18, -15, 15, -23, 3.4],
    [-2, -14, -3, -38, -22, -54, 13.5],
  ];
  flames.forEach(([ax, ay, cx, cy, ex, ey, w], i) => {
    const k = (f + i * 3) % 4, fl = [1, 1.08, 0.94, 1.04][k], cu = [0, 1.4, -1, 0.7][k] * (i === 3 ? 1.6 : 1);
    lick([hx + ax, hy + ay], [hx + cx + cu, hy + cy], [hx + ax + (ex - ax) * fl + cu * 1.5, hy + ay + (ey - ay) * fl], w * (0.96 + (fl - 1) * 0.6), (fl - 1) * 0.4);
  });

  // ------------------------------------------------ the body: black plates over fire
  const forms = [
    { cx: 10, cy: 84, rx: 27, ry: 28 }, // the far shoulder and arm
    { cx: 90, cy: 86, rx: 25, ry: 28 }, // the near shoulder
    { cx: 49, cy: 102, rx: 34, ry: 32 }, // the chest
    { cx: 29, cy: 72, rx: 17, ry: 13 }, // the slopes of the neck
    { cx: 69, cy: 73, rx: 16, ry: 13 },
  ];
  const heart = [50, 96], hotAt = (x: number, y: number): number => clamp(1 - Math.hypot(x - heart[0], y - heart[1]) / 42, 0, 1);
  // the fire inside: dull under the shoulders, hottest at the heart
  for (const F of forms) o.push(E(F.cx, F.cy, F.rx - 3, F.ry - 3, 'emFire', { fl: 1, ink: -0.72 }));
  o.push(E(50, 95, 24, 20, 'emFire', { fl: 1, ink: -0.48 + pu * 0.1 }));
  o.push(E(50, 96, 13, 11, 'emFire', { fl: 1, ink: -0.22 + pu * 0.12 }));
  o.push(E(50, 97, 6, 5, 'emFireCore', { fl: 1, ink: -0.16 + pu * 0.12 }));
  // the plates: Voronoi cells of seeds in staggered rows, each faced like the form
  // under it; two plates part to show the fire only along some seams, more near the heart
  const cell = 10.5, seeds: Pt[] = [];
  for (let j = 0; j < 7; j++) for (let i = 0; i < 12; i++) {
    seeds.push([-8 + i * cell + (j % 2) * cell * 0.5 + (hash2(i, j + 61) - 0.5) * cell * 0.7, 46 + j * cell * 0.86 + (hash2(i + 9, j + 67) - 0.5) * cell * 0.6]);
  }
  const inForm = seeds.map(([sx, sy]) => {
    let best: [number, number, number] | null = null;
    for (const F of forms) {
      const qx = (sx - F.cx) / F.rx, qy = (sy - F.cy) / F.ry, d = qx * qx + qy * qy;
      if (d < 1.12 && (!best || 1 - d > best[2])) best = [qx, qy, 1 - d];
    }
    return best;
  });
  const rims: Array<[Pt, Pt, number]> = [];
  seeds.forEach(([sx, sy], ia) => {
    const best = inForm[ia];
    if (!best) return;
    let poly: Pt[] = [[-12, 38], [108, 38], [108, 108], [-12, 108]];
    const tops: Array<[Pt, Pt]> = [];
    seeds.forEach(([tx, ty], ib) => {
      if (ib === ia || Math.hypot(tx - sx, ty - sy) > cell * 2.4) return;
      const l = Math.hypot(tx - sx, ty - sy), d: Pt = [(tx - sx) / l, (ty - sy) / l], m: Pt = [(sx + tx) / 2, (sy + ty) / 2];
      const vein = inForm[ib] && hash2(Math.min(ia, ib) * 7, Math.max(ia, ib) * 13 + 5) < 0.08 + 0.7 * hotAt(m[0], m[1]);
      poly = clipHalf(poly, m, d, vein ? -0.55 : 0);
      if (!inForm[ib] && d[1] < -0.3) tops.push([m, d]);
    });
    if (poly.length < 3) return;
    const nz = Math.sqrt(Math.max(0.06, best[2])), tilt = (hash2(ia, 71) - 0.5) * 0.34;
    o.push(P(poly.flat(), CR, { bv: 2.2, n: [best[0] * 0.85 + tilt, best[1] * 0.85 - tilt * 0.4, nz + 0.15], ink: -0.04 + (hash2(ia, 73) - 0.5) * 0.12 }));
    // the edges this plate shows against the dark above catch the fire of his head
    const on = (q: Pt, [m, d]: [Pt, Pt]): boolean => Math.abs((q[0] - m[0]) * d[0] + (q[1] - m[1]) * d[1]) < 0.05;
    poly.forEach((a, i) => {
      const c = poly[(i + 1) % poly.length];
      const t = tops.find((tp) => on(a, tp) && on(c, tp));
      if (t) rims.push([a, c, -t[1][1]]);
    });
  });
  for (const [a, c, up] of rims) o.push(K(a[0], a[1] + 0.3, c[0], c[1] + 0.3, 0.6, 0.6, 'emFire', { ink: -0.62 + up * 0.3 + pu * 0.06, occ: false }));

  // ------------------------------------------------ the head, thrust forward under them
  const crack = (pts: number[], ink: number): void => { for (let i = 0; i < pts.length - 2; i += 2) o.push(K(hx + pts[i], hy + pts[i + 1], hx + pts[i + 2], hy + pts[i + 3], 0.5, 0.4, 'emFire', { ink, occ: false })); };
  o.push(E(hx - 2, hy - 6, 15.5, 14, CR, { fl: 0.1 })); // the skull
  // the fire breaking out of the crown itself, all along its top
  [[-150, 3], [-122, 3.6], [-94, 3.8], [-66, 3.4], [-40, 2.8]].forEach(([deg, w], i) => {
    const a = (deg * Math.PI) / 180, x = hx - 2 + Math.cos(a) * 14.6, y = hy - 6 + Math.sin(a) * 13, k = (f + i) % 4, fl = [1, 1.12, 0.9, 1.05][k];
    lick([x, y + 2], [x - 1 + [0, 0.8, -0.6, 0.4][k], y - 5 * fl], [x - 6, y - 11 * fl], w, (fl - 1) * 0.4);
  });
  o.push(E(hx + 1, hy + 3, 14, 15, CR, { fl: 0.15 })); // the face
  o.push(E(hx - 13.4, hy + 1, 3.2, 7, CR, { fl: 0.5, ink: -0.2 })); // the side of the head, turned away
  // the jaw, heavy and jutting
  o.push(P([hx - 14.6, hy + 6, hx - 12, hy + 16, hx - 6, hy + 21, hx + 4, hy + 23, hx + 12, hy + 19, hx + 15.6, hy + 12, hx + 15.4, hy + 5], CR, { bv: 4, ink: -0.04 }));
  o.push(E(hx - 8, hy + 4.6, 5, 3.4, CR, { fl: 0.4, ink: 0.06, a: -0.2 })); // cheekbones
  o.push(E(hx + 10.4, hy + 4, 3.6, 3, CR, { fl: 0.4, ink: -0.02, a: 0.2 }));
  o.push(E(hx - 6.6, hy + 9.6, 4, 3, CR, { fl: 0.7, ink: -0.2 })); // the hollow under it
  // the brow: a heavy shelf of crust scowling down to the nose
  o.push(K(hx - 15, hy - 4.6, hx + 0.6, hy - 1.4, 4.2, 3.4, CR, { ink: 0.1 }));
  o.push(K(hx + 3, hy - 1.8, hx + 14.6, hy - 4.6, 3.2, 2.6, CR, { ink: 0.04 }));
  o.push(E(hx + 1.6, hy - 2.2, 3.2, 2.8, CR, { ink: 0.06 }));
  // the eyes: white-hot, deep under the brow
  o.push(E(hx - 6.6, hy + 1.2, 4.4, 2.2, MAW, { fl: 0.6 }), E(hx + 10.2, hy + 0.8, 3, 1.9, MAW, { fl: 0.6 }));
  o.push(P([hx - 10, hy + 1.4, hx - 6.6, hy + 0.2, hx - 3, hy + 0.8, hx - 4.4, hy + 2.2, hx - 8, hy + 2.4], 'emFireCore', { ink: 0.04 + pu * 0.06 }));
  o.push(P([hx + 8, hy + 1, hx + 10.4, hy + 0.1, hx + 12.6, hy + 0.6, hx + 10.6, hy + 1.9], 'emFireCore', { ink: pu * 0.06 }));
  o.push(X(hx - 7, hy + 0.6, 1.4, 1, '#fff8e8', { em: true }), X(hx + 10, hy + 0.4, 1, 1, '#fff8e8', { em: true }));
  o.push(Lt(hx - 6.6, hy + 1.4, 9, '#ffd27a', 0.45 * p, 3), Lt(hx + 10.4, hy + 1, 7, '#ffd27a', 0.35 * p, 3));
  // the broad, blunt nose
  o.push(K(hx + 2, hy - 0.6, hx + 5, hy + 6.4, 2.4, 3.4, CR, { ink: 0.06 }));
  o.push(E(hx + 4.8, hy + 7.8, 4.6, 3, CR, { ink: 0.02 }));
  o.push(E(hx + 2.6, hy + 9.2, 1.2, 0.8, MAW), E(hx + 7.4, hy + 9, 1.1, 0.8, MAW));
  // cracks across the face, the fire dull in them
  crack([-4, -19, -3, -12, -0.4, -7], -0.42);
  crack([-15, -9, -12, -6.4, -12.6, -2], -0.5);
  crack([-13.6, 4, -10, 8, -11, 14], -0.46);
  crack([12, 6, 13.6, 10, 12.4, 15], -0.5);
  crack([5, -12, 8.6, -8], -0.48);
  // the mouth: clenched black teeth, the fire of the throat through the gaps
  o.push(P([hx - 6.6, hy + 12.6, hx + 13, hy + 12, hx + 12.4, hy + 15.6, hx - 6, hy + 16], MAW));
  o.push(K(hx - 4.6, hy + 14.2, hx + 11, hy + 13.8, 1, 0.8, 'emFire', { ink: -0.04 + pu * 0.2, occ: false }));
  for (let i = 0; i < 7; i++) {
    const x = hx - 5.4 + i * 2.6;
    o.push(P([x - 1.1, hy + 12.4, x + 1.1, hy + 12.4, x + 0.2, hy + 14.4], CR, { ink: -0.1 }));
    if (i < 6) o.push(P([x + 0.3, hy + 15.8, x + 2.5, hy + 15.8, x + 1.5, hy + 13.8], CR, { ink: -0.2 }));
  }
  o.push(K(hx - 6.4, hy + 11.6, hx + 13, hy + 11.2, 1, 0.9, CR, { ink: 0.04 })); // the upper lip
  o.push(Lt(hx + 3, hy + 14.2, 12, '#ff9a3c', 0.5 * p, 4));
  // the beard, burnt to a ragged edge, embers at its ends
  o.push(P([hx - 12, hy + 16.4, hx - 5, hy + 18.4, hx + 5, hy + 18.4, hx + 13, hy + 16, hx + 14.6, hy + 21, hx + 12.4, hy + 28, hx + 10, hy + 26.4, hx + 8, hy + 33, hx + 5, hy + 30, hx + 2 + s, hy + 38, hx - 1, hy + 31, hx - 4, hy + 35, hx - 6, hy + 28, hx - 9, hy + 30, hx - 11, hy + 24, hx - 13.4, hy + 20], CH, { bv: 2.6, ink: -0.04 }));
  for (const [x0, y0, x1, y1, ink] of [[-10, 19, -8.6, 28, -0.2], [-5, 19, -3.6, 33, -0.12], [1, 19, 2 + s, 36, -0.2], [6, 19, 7.4, 31, -0.14], [11, 18, 10, 26, -0.22]]) o.push(strand(hx + x0, hy + y0, hx + x0 + (x1 - x0) * 0.4 + 0.6, hy + (y0 + y1) / 2, hx + x1, hy + y1, 1.3, 0.5, CH, 3, { ink }));
  [[8, 33], [2 + s, 38], [-4, 35], [-9, 30], [12.4, 28]].forEach(([x, y], i) => o.push(E(hx + x, hy + y - 0.6, 1, 1.1, i % 2 ? 'emFireCore' : 'emFire', { ink: -0.32 + ((f + i) % 4) * 0.1 })));
  crack([-7, 22, -5, 26, -6.4, 29], -0.2 + pu * 0.1);
  crack([5, 22, 6.4, 26.6], -0.24 + pu * 0.1);

  // ------------------------------------------------ the sword with the burning edge
  o.push(K(104, 104, 86, 90, 11, 8.6, CR, { ink: -0.2 })); // the forearm
  o.push(K(96, 92, 90, 96, 0.5, 0.4, 'emFire', { ink: -0.5, occ: false }));
  const bx0 = 82, by0 = 79, bx1 = 93, by1 = -1;
  const bl = Math.hypot(bx1 - bx0, by1 - by0), ux = (bx1 - bx0) / bl, uy = (by1 - by0) / bl, nx = -uy, ny = ux;
  const at = (t: number, w: number): Pt => [bx0 + ux * bl * t + nx * w, by0 + uy * bl * t + ny * w];
  o.push(P([...at(0, -4.2), ...at(0.97, -3), ...at(1.04, 0), ...at(0.97, 3), ...at(0, 4.2)], BL, { bv: 2, n: [0.2, -0.1, 1] }));
  o.push(K(...at(0.02, 0.6), ...at(0.88, 0.5), 0.7, 0.5, BL, { ink: -0.32 })); // the fuller
  o.push(K(...at(0, -4.1), ...at(0.98, -2.9), 1.1, 0.8, 'emFire', { ink: -0.1 + pu * 0.1, occ: false })); // the burning edge
  o.push(K(...at(0.04, -4.2), ...at(0.94, -3), 0.45, 0.35, 'emFireCore', { ink: -0.12 + pu * 0.08, occ: false }));
  for (let i = 0; i < 3; i++) {
    const t = 0.18 + i * 0.3, [x, y] = at(t, -4), k = (f + i * 2) % 4, fl = [1, 1.12, 0.9, 1.05][k];
    lick([x, y], [x - 5, y - 6 * fl], [x - 5 + [0, 1.6, -1.2, 0.7][k], y - 14 * fl], 3, (fl - 1) * 0.4);
  }
  o.push(K(...at(0, -7.4), ...at(0, 7.4), 1.7, 1.7, 'blackIron', { ink: -0.06 })); // the guard
  // the fist round the grip: black knuckles, the fire in the cracks between them
  o.push(E(83, 87, 7.4, 6.6, 'emFire', { fl: 1, ink: -0.66 }));
  for (let i = 0; i < 4; i++) o.push(K(76.6, 81.6 + i * 2.8, 88.4, 82.4 + i * 2.9, 1.55, 1.5, CR, { ink: i % 2 ? -0.06 : 0.02 }));
  o.push(K(86, 80, 79, 79.4, 1.3, 1.1, CR, { ink: 0.06 })); // the thumb
  // lights: the head of fire above, the blade, the heart under the beard
  o.push(Lt(hx - 6, hy - 26, 62, '#ff8a2c', 0.85 * p, 16));
  o.push(Lt(84, 36, 34, '#ff8a2c', 0.4 * p, 8));
  o.push(Lt(50, 96, 32, '#ff7a26', 0.5 * p, 8));
  return o;
}
