import { E, K, P, X, Lt, breath, sway, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out } from './portraitKit';
import './materials';

/*
 * Hrefna the völva, by the plaza fountain at dusk: the map sprite's seeress (hrefna.ts), close.
 * Conventions: portraitKit.ts.
 */

/**
 * An old woman, calm and watchful, under a black lambskin hood lined with white catskin, grey
 * hair parted beneath it, a blue cloak at her shoulders and a loop of glass beads across it. Her
 * hand is closed round her staff, whose brass knob holds a flame of Seiðr: the one light, cold
 * and blue, on her face from the left.
 */
export function hrefnaPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.9, 1.1, 0.95][f % 4];
  const o: Out = [];
  const GR = 'scr_gHrefna', HA = 'scr_hrefnaHalo', ST = 'scr_hrefnaStone', SK = 'scr_hrefnaSkin', LN = 'scr_hrefnaLine';
  const HR = 'scr_hrefnaHair', CL = 'scr_hrefnaCloak', LB = 'scr_hrefnaLamb', CA = 'scr_hrefnaCat', BD = 'scr_hrefnaBead';
  const kx = 18, ky = 22; // the Seiðr flame on the staff's knob
  o.push(P(FULL, GR, { ink: BAND[1] }));
  o.push(E(54, 50, 64, 60, GR, { fl: 1, ink: BAND[2] }));
  // the fountain's rim behind her at the right, ice on its lip
  o.push(P([62, 64, 97, 58, 97, 74, 62, 78], ST, { ink: BAND[2] }));
  o.push(P([62, 62, 97, 56, 97, 59, 62, 65], ST, { ink: BAND[3] }));
  // the flame's halo
  o.push(E(kx, ky, 26, 25, HA, { fl: 1, ink: BAND[1] }));
  o.push(E(kx, ky, 14, 13, HA, { fl: 1, ink: BAND[2] }));

  const by = -b * 0.45;
  // the staff, from below the frame to the knob
  o.push(K(21, 99, 18.4, ky + 6, 2, 1.7, 'woodDark'));
  // the cloak at her shoulders, its folds
  o.push(P([2, 97, 8, 84, 22, 74, 36, 69 + by, 64, 69 + by, 78, 74, 90, 84, 95, 97], CL, { bv: 5, n: [0, -0.12, 1] }));
  for (const [x0, y0, x1, y1] of [[20, 78, 15, 94], [30, 74, 27, 94], [70, 75, 74, 94], [80, 79, 87, 94]]) o.push(K(x0, y0, x1, y1, 0.7, 1.1, CL, { ink: -0.3, occ: false }));
  // the hood's lambskin, falling to the shoulders round the head
  o.push(P([24, 78, 27, 52, 33, 34, 50, 21 + by, 67, 34, 73, 52, 76, 78, 62, 72 + by, 38, 72 + by], LB, { bv: 4 }));
  o.push(E(50, 43 + by, 22, 23, LB, { fl: 0.2 }));
  // the white catskin lining, a rim round the face
  o.push(E(51.2, 46 + by, 14.6, 18.2, CA, { fl: 0.3 }));
  // the face: long, lined, the far side in shadow
  const fy = 46 + by;
  o.push(E(51.6, fy + 1.4, 12.4, 15.6, SK, { fl: 0.3 }));
  o.push(P([58, fy - 12, 63, fy - 4, 62.6, fy + 6, 57, fy + 13, 60, fy + 4, 60, fy - 4], SK, { ink: -0.18, fl: 1 }));
  // grey hair, parted in the middle, drawn back under the hood
  o.push(P([39.6, fy - 3, 41, fy - 10, 46, fy - 14.4, 51, fy - 14, 56, fy - 14.4, 61.6, fy - 10, 63.2, fy - 3, 60, fy - 8, 54, fy - 11, 51, fy - 10.4, 48, fy - 11, 43, fy - 8], HR, { bv: 1.6 }));
  // the eyes: pale, the lids heavy with age, watching
  const blink = f === 1;
  for (const [ex, w] of [[46, 3.2], [57, 2.8]] as const) {
    const ey = fy - 1.6;
    o.push(E(ex, ey, w + 1, 2.2, SK, { fl: 0.8, ink: -0.16 }));
    if (blink) {
      o.push(K(ex - w, ey + 0.4, ex + w, ey + 0.4, 0.5, 0.5, 'scr_hrefnaLash'));
      continue;
    }
    o.push(E(ex, ey + 0.3, w, 1.3, 'scr_hrefnaWhite', { ink: -0.06 }));
    o.push(E(ex + 0.3, ey + 0.3, 1.3, 1.3, 'scr_hrefnaIris'));
    o.push(X(ex, ey, 0.8, 0.8, '#eef6ff', { em: true }));
    o.push(K(ex - w - 0.4, ey - 0.6, ex + w + 0.4, ey - 0.8, 0.8, 0.7, SK, { ink: -0.06 })); // the heavy lid
    o.push(K(ex - w, ey - 0.2, ex + w, ey - 0.4, 0.35, 0.3, 'scr_hrefnaLash'));
  }
  // brows: thin and grey
  o.push(K(42.4, fy - 5.6, 49, fy - 6.4, 0.6, 0.5, HR), K(54, fy - 6.4, 60, fy - 5.6, 0.55, 0.45, HR));
  // the lines of her years: at the eyes, beside the nose, across the brow
  o.push(K(40.4, fy - 2.4, 41.6, fy - 0.4, 0.3, 0.3, LN, { occ: false }), K(61.6, fy - 2.4, 60.8, fy - 0.2, 0.3, 0.3, LN, { occ: false }));
  o.push(K(46, fy - 9, 56, fy - 9.2, 0.3, 0.3, LN, { occ: false }));
  o.push(strand(47, fy + 3.6, 45.4, fy + 7, 46.4, fy + 10, 0.35, 0.3, LN, 3, { occ: false }));
  o.push(strand(56.4, fy + 3.6, 58, fy + 7, 57, fy + 10, 0.35, 0.3, LN, 3, { occ: false }));
  // the nose: long and straight
  o.push(P([50.4, fy - 4, 52.6, fy - 4, 54.4, fy + 4, 53.4, fy + 5.6, 49.8, fy + 5.6, 49, fy + 4], SK, { fl: 1, ink: -0.08 }));
  o.push(E(51.6, fy + 5, 2.4, 1.2, SK, { fl: 0.6, ink: -0.14 }));
  // the mouth: thin, closed, a little knowing
  o.push(strand(47.6, fy + 8.6, 51.6, fy + 9.6, 55.6, fy + 8.2, 0.55, 0.45, 'scr_hrefnaLip', 3, { occ: false }));
  o.push(E(51.6, fy + 11.6, 3.4, 1.2, SK, { fl: 1, ink: -0.1 }));

  // the glass beads, a loop across the cloak
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = 36 + t * 30;
    const y = 74 + by + Math.sin(t * Math.PI) * 9 + s * 0.2;
    o.push(E(x, y, 1.7, 1.7, BD, { fl: 0.2, ink: i % 2 ? -0.1 : 0.04 }));
  }
  // her hand closed round the staff
  o.push(E(20.6, 60, 4.6, 4.2, SK, { fl: 0.3, ink: -0.04 }));
  for (let i = 0; i < 3; i++) o.push(K(17.2, 57.6 + i * 2, 23.6, 58.2 + i * 2, 1, 0.95, SK, { ink: i % 2 ? -0.02 : 0.05 }));
  o.push(K(16, 64, 22, 74, 3.4, 4.2, CL)); // her sleeve
  // the brass knob, and the Seiðr burning in it
  o.push(E(kx + 0.2, ky + 6, 4.4, 3.8, 'bronze', { fl: 0.2 }));
  o.push(K(kx - 3.6, ky + 3.4, kx + 4, ky + 3.4, 0.7, 0.7, 'bronze', { ink: 0.1 }));
  o.push(E(kx, ky - 1, 2.6 * fl, 5 * fl, 'scr_hrefnaSeidr'));
  o.push(E(kx, ky, 1.2, 2.4 * fl, 'scr_hrefnaSeidrCore'));
  o.push(Lt(kx + 1, ky, 84, '#a8d0ff', 1.05 * fl, 12));
  return o;
}
