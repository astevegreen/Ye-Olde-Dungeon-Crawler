import { E, K, P, X, Lt, T, breath, sway, hash2, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9e, group B: the Troll-Wife Warlock, the Coven Warlock and the Winter Hag (three heads, three lights). Conventions: portraitKit.ts. */

/**
 * A witch of the troll-wives in her prime: upright, black-haired, a long straight thorn
 * of a nose, amber goat-slit eyes under arched brows, a thin smirk. Her seiðr-staff's
 * crooked head clutches a black stone cut with Nauð, the need-rune, the fetter (her Slow
 * is the war-fetter of the old lays); its violet light rakes her face from above.
 * Charms hang in the dark of her den.
 */
export function trollWifeWarlockPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.12, 0.9, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gTwWarlock', HL = 'scr_twWarlockHalo', SK = 'scr_twWarlockSkin', HR = 'scr_twWarlockHair';
  const SH = 'scr_twWarlockShawl', DR = 'scr_twWarlockDress', ST = 'scr_twWarlockStaff', HX = 'scr_twWarlockHex';
  const sx = 69, sy = 21; // the hex-stone
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(44, 42, 68, 62, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(sx, sy, 27, 25, HL, { fl: 1, ink: BAND[1] }), E(sx, sy, 15.5, 14.5, HL, { fl: 1, ink: BAND[2] }), E(sx, sy, 9, 8.5, HL, { fl: 1, ink: BAND[3] }));
  // charms hung in the dark: a holed stone, a twig-man, a bird's skull
  for (const [x, len] of [[7, 30], [18, 17], [29, 24]]) o.push(K(x, -1, x + s * 0.15, len, 0.4, 0.4, BG, { ink: BAND[1] }));
  o.push(E(7.15, 33, 3, 3.4, BG, { fl: 1, ink: BAND[1] }), E(7.4, 33.4, 1.1, 1.2, BG, { fl: 1, ink: BAND[2] }));
  o.push(K(18.1, 17, 18.1, 26, 0.9, 0.9, BG, { ink: BAND[1] }), K(15, 19.6, 21.2, 19.6, 0.7, 0.7, BG, { ink: BAND[1] }), K(18.1, 25, 16.2, 30, 0.6, 0.5, BG, { ink: BAND[1] }), K(18.1, 25, 20, 30, 0.6, 0.5, BG, { ink: BAND[1] }));
  o.push(E(29.2, 26.4, 2.6, 2.2, BG, { fl: 1, ink: BAND[1] }), K(29.2, 27.6, 30.2, 32, 1.1, 0.3, BG, { ink: BAND[1] }));

  const by = -b * 0.5;
  const hx = 37, hy = 39 + by;
  const HT = (l: PrimTree) => T(l, { px: hx, py: hy + 22, s: 1.12 }); // the head, drawn a size up
  // the hair behind: black, lank, hanging in ragged locks
  o.push(HT([P([hx - 1, hy - 18, hx - 12, hy - 16, hx - 18.6, hy - 8, hx - 20.4, hy + 6, hx - 20, hy + 22, hx - 8, hy + 22, hx + 6, hy + 8, hx + 11, hy - 4, hx + 10, hy - 13], HR, { bv: 1.4, ink: -0.6 })]));
  // the dress, the neck, a cord of teeth at the throat
  o.push(P([-2, 97, -2, 80, 10, 72, 26, 67 + by, 40, 65 + by, 58, 67 + by, 70, 73, 80, 84, 84, 97], DR, { bv: 5, ink: -0.22 }));
  o.push(K(hx + 3.4, hy + 16, hx + 2.6, hy + 31, 5, 6.2, SK, { ink: -0.3 }));
  o.push(K(hx + 6.4, hy + 21, hx + 6.6, hy + 30, 0.7, 0.9, SK, { ink: -0.14 })); // the tendon
  const cord: Pt[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; cord.push([hx - 2 + t * 13, hy + 24.4 + Math.sin(t * Math.PI) * 3.4]); }
  for (let i = 0; i < 6; i++) o.push(K(cord[i][0], cord[i][1], cord[i + 1][0], cord[i + 1][1], 0.4, 0.4, 'scr_twWarlockMouth'));
  for (const i of [1, 2, 3, 4, 5]) { const [x, y] = cord[i]; o.push(P([x - 0.9, y, x + 0.9, y, x + 0.1, y + 3.4 - Math.abs(i - 3) * 0.4], 'scr_twWarlockTooth', { bv: 0.5 })); }
  // the russet shawl, a ragged hem, pinned at the throat with a bone
  o.push(P([-2, 78, 10, 70, 24, 66 + by, 33, 65.6 + by, 38, 75, 43, 67 + by, 56, 66 + by, 68, 71, 77, 80, 74, 90, 68, 84, 62, 94, 55, 86, 48, 96, 41, 88, 34, 95, 27, 86, 20, 93, 13, 85, 6, 92, -2, 86], SH, { bv: 3.4, ink: -0.24 }));
  for (const [x0, y0, x1, y1] of [[24, 69, 22, 86], [12, 74, 9, 88], [52, 70, 55, 86]]) o.push(K(x0, y0 + by, x1, y1, 0.7, 1.1, SH, { ink: -0.5, occ: false })); // folds
  o.push(K(33, 78, 44, 74, 0.7, 0.55, 'bone'));
  // the far lock, behind the jaw, catching the hex-light at its edge
  o.push(HT([strand(hx + 9, hy - 8, hx + 13, hy + 8, hx + 10.4 + s * 0.2, hy + 24, 2.6, 0.7, HR, 4, { ink: -0.3 })]));
  // the near hair, a lank sheet falling over the shawl, parting into rats'-tails at the ends
  const sw = s * 0.3;
  o.push(P([hx - 14, hy - 4, hx - 20, hy + 8, hx - 23, hy + 22, hx - 25 + sw, hy + 36, hx - 26 + sw, hy + 45, hx - 23 + sw, hy + 41, hx - 21 + sw, hy + 50, hx - 18 + sw, hy + 42, hx - 15 + sw, hy + 51, hx - 12.6 + sw, hy + 41, hx - 9.6 + sw, hy + 46, hx - 8.6, hy + 32, hx - 7.6, hy + 18, hx - 5, hy + 10], HR, { bv: 2.2, ink: -0.44 }));
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[-17, 4, -21, 22, -23, 42, -0.3], [-13, 8, -16, 26, -17, 46, -0.34], [-10, 12, -11.6, 28, -12, 44, -0.28]]) {
    o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2 + sw, hy + y2, 0.9, 0.4, HR, 5, { ink, occ: false })); // the sheen along the strands
  }

  // the head: cranium, the face, a long narrow jaw ending in a sharp chin
  const h: Out = [];
  h.push(E(hx - 1, hy - 5, 12, 12, SK, { fl: 0.15, ink: -0.12 }));
  h.push(E(hx + 2, hy + 3, 9.4, 11, SK, { fl: 0.2, ink: -0.08 }));
  h.push(P([hx - 7.6, hy + 5, hx - 6.4, hy + 13, hx - 2, hy + 19, hx + 3.2, hy + 22.8, hx + 7, hy + 22.4, hx + 9.2, hy + 18.8, hx + 9, hy + 12, hx + 10.4, hy + 5], SK, { bv: 3, ink: -0.1 }));
  h.push(E(hx - 3.6, hy + 11.4, 4.2, 5, SK, { fl: 0.2, ink: -0.22 })); // the hollow under the cheekbone
  h.push(E(hx - 2.6, hy + 4.6, 4.8, 2, SK, { fl: 0.5, ink: -0.04, a: -0.25 })); // the cheekbone, high
  h.push(E(hx + 9.6, hy + 6, 2.2, 4.4, SK, { fl: 0.6, ink: -0.26 })); // the far cheek, turned away
  h.push(E(hx + 5, hy + 20.4, 3, 2.2, SK, { fl: 0.2, ink: -0.12 })); // the chin
  h.push(K(hx - 8.4, hy - 4, hx + 10, hy - 5, 1.8, 1.4, SK, { ink: -0.04 })); // the brow
  // eyes: narrowed under heavy dark lids, amber, the pupils slit like a goat's
  const shut = f === 3;
  for (const [ex, ey, rx, ry] of [[hx - 3.4, hy - 0.8, 3.6, 2.2], [hx + 6.9, hy - 1, 2.6, 1.9]]) {
    h.push(E(ex, ey + 0.2, rx * 1.1, ry * 1.25, SK, { fl: 0.85, ink: -0.62, a: -0.1 })); // the shadowed socket
    if (shut) { h.push(K(ex - rx * 0.8, ey + 0.2, ex + rx * 0.8, ey - 0.1, 0.6, 0.5, HR, { ink: -0.1 })); continue; }
    h.push(E(ex + 0.5, ey + 0.4, rx * 0.5, ry * 0.56, 'eyeAmber', { ink: -0.04 }));
    h.push(X(ex + 0.25, ey - 0.5, 0.6, 1.8, '#140c0a'));
    h.push(K(ex - rx * 0.95, ey - 0.4, ex + rx * 0.9, ey - ry * 0.55, 0.75, 0.6, HR, { ink: -0.2 })); // the heavy lid
  }
  if (!shut) h.push(X(hx - 3.6, hy - 0.8, 0.7, 0.7, '#fff2c8', { em: true }), X(hx + 7.6, hy - 0.6, 0.6, 0.6, '#d8d0ff', { em: true }));
  // brows: thin, arched high, severe
  h.push(strand(hx - 8.6, hy - 3.4, hx - 4.6, hy - 9.6, hx + 0.4, hy - 5.2, 0.85, 0.45, HR, 3, { ink: -0.04 }));
  h.push(strand(hx + 4.4, hy - 4.8, hx + 7.2, hy - 8.2, hx + 10.4, hy - 5.6, 0.65, 0.35, HR, 3, { ink: -0.1 }));
  // the nose: a long straight thorn
  h.push(P([hx + 0.8, hy - 2.4, hx + 6, hy + 1.8, hx + 12.4, hy + 5.6, hx + 19.4, hy + 9.4, hx + 18.6, hy + 10.6, hx + 12.4, hy + 10.4, hx + 6.8, hy + 11, hx + 2.6, hy + 10.4, hx + 0.6, hy + 4.4], SK, { bv: 2.8, ink: -0.06 }));
  h.push(K(hx + 1.6, hy - 1.6, hx + 17.4, hy + 8.2, 0.45, 0.3, SK, { ink: 0.02, occ: false })); // the ridge, in the light
  h.push(E(hx + 3.8, hy + 8.6, 2.5, 1.9, SK, { ink: -0.1 })); // the nostril's wing
  h.push(E(hx + 5.2, hy + 10, 1.2, 0.6, 'scr_twWarlockMouth'));
  // the mouth: a thin smirk, the far corner drawn up and parted on small sharp teeth
  h.push(P([hx - 3.6, hy + 16.2, hx + 1, hy + 15.6, hx + 5.6, hy + 14.2, hx + 8.6, hy + 12, hx + 8.4, hy + 14.2, hx + 6.4, hy + 16.6, hx + 1.4, hy + 18, hx - 3, hy + 17.4], 'scr_twWarlockLip', { bv: 0.8 }));
  h.push(P([hx - 3.2, hy + 16.6, hx + 1.4, hy + 15.8, hx + 5.4, hy + 14.6, hx + 8.4, hy + 12.4, hx + 7.6, hy + 14.8, hx + 5, hy + 16.4, hx + 1.4, hy + 16.8], 'scr_twWarlockMouth'));
  h.push(P([hx + 3.2, hy + 15.3, hx + 4.6, hy + 14.8, hx + 4.1, hy + 16.4], 'scr_twWarlockTooth', { bv: 0.3 }), P([hx + 5.4, hy + 14.6, hx + 6.6, hy + 13.8, hx + 6.3, hy + 15.4], 'scr_twWarlockTooth', { bv: 0.3 }));
  h.push(strand(hx + 9.4, hy + 10.4, hx + 10.4, hy + 12.4, hx + 9.2, hy + 14.6, 0.35, 0.3, SK, 3, { ink: -0.42, occ: false })); // the crease of the smirk
  h.push(K(hx - 5.6, hy + 10, hx - 4.4, hy + 15.6, 0.35, 0.35, SK, { ink: -0.42, occ: false })); // the fold from nose to mouth
  // the hair in front: parted at the crown, falling flat past both temples
  h.push(P([hx - 13.6, hy + 12, hx - 13.4, hy - 2, hx - 11.6, hy - 11.4, hx - 6.4, hy - 16.8, hx + 1, hy - 18.4, hx + 7.4, hy - 16.6, hx + 11.6, hy - 11, hx + 12.6, hy - 3, hx + 11.2, hy + 1, hx + 10, hy - 5, hx + 6.4, hy - 8.4, hx + 1.6, hy - 9.6, hx - 3.6, hy - 8.6, hx - 7.6, hy - 5, hx - 9, hy + 1, hx - 9.6, hy + 11, hx - 12, hy + 20], HR, { bv: 1.6, ink: -0.16 }));
  h.push(strand(hx + 1.6, hy - 18, hx + 1.8, hy - 14, hx + 1, hy - 9.8, 0.4, 0.3, HR, 3, { ink: -0.5, occ: false })); // the parting
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[0, -16.6, -6.4, -14.4, -10.6, -6, 0.12], [-1.6, -15.4, -9.2, -10.6, -11.6, 4, 0.04], [-2.6, -13.8, -7.8, -7, -10.6, 14, 0.06], [3.6, -16.2, 8.4, -13.6, 11, -4, 0]]) {
    h.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2, hy + y2, 0.5, 0.3, HR, 4, { ink, occ: false })); // strands in the light
  }
  o.push(HT(h));

  // the seiðr-staff, leaning in: a crooked head of twigs clutching the stone
  o.push(K(88, 99, sx + 2, sy + 11, 2.3, 1.8, ST));
  for (const y of [86, 74]) { const t = (99 - y) / (99 - sy - 11); o.push(E(88 - (88 - sx - 2) * t, y, 2.6, 1.3, ST, { ink: -0.06, a: -0.2 })); } // knots
  o.push(strand(sx + 2, sy + 11, sx + 2.4, sy + 4, sx + 0.6, sy - 8.4, 1.3, 0.5, ST, 3, { ink: -0.2 })); // the twig behind
  o.push(E(sx, sy, 5.8, 6.8, 'scr_twWarlockStone', { fl: 0.2 }));
  const ri = (p - 1) * 0.5;
  o.push(K(sx + 0.2, sy - 4.4, sx - 0.2, sy + 4.4, 0.8, 0.8, HX, { ink: ri }), K(sx - 2.8, sy - 2, sx + 2.8, sy + 1.6, 0.7, 0.7, HX, { ink: ri }));
  o.push(strand(sx + 2, sy + 11, sx - 7, sy + 7, sx - 5.4, sy - 3.2, 1.4, 0.55, ST, 3)); // the twigs in front, hooked like claws
  o.push(strand(sx + 2, sy + 11, sx + 9.6, sy + 6, sx + 5.6, sy - 3.6, 1.4, 0.55, ST, 3));
  o.push(K(sx - 5.4, sy - 3.2, sx - 3.6, sy - 5.4, 0.5, 0.25, ST), K(sx + 5.6, sy - 3.6, sx + 3.8, sy - 5.6, 0.5, 0.25, ST));
  // three motes of the hex, circling the stone (as on the map)
  for (let i = 0; i < 3; i++) {
    const a = (f * Math.PI) / 2 + (i * Math.PI * 2) / 3 + 0.5;
    o.push(E(sx + Math.cos(a) * 10, sy + Math.sin(a) * 5.6, 1, 1, HX, { ink: i ? -0.1 : 0.2 }));
  }
  // her hand on the staff: long knuckled fingers, black nails
  const st = (y: number): number => 88 - (88 - sx - 2) * ((99 - y) / (99 - sy - 11));
  o.push(P([54, 97, 56, 86, 62, 76, 67.4, 68, 73, 66, 75.6, 70, 72.6, 77, 71, 86, 70, 97], SH, { bv: 3, ink: -0.26 })); // the sleeve, hanging wide from the raised arm
  o.push(K(60, 84, 66, 74, 0.6, 0.9, SH, { ink: -0.54, occ: false }), K(64.6, 90, 69, 77, 0.6, 0.9, SH, { ink: -0.54, occ: false })); // its folds
  o.push(P([66.4, 70.4, 69, 63.6, 75.4, 62.4, 77.6, 66, 75.6, 69.6, 74, 67.6, 72.4, 71.4, 70.4, 69.2, 68.6, 72], SH, { bv: 1.4, ink: -0.14 })); // the ragged cuff
  const gx = st(62);
  o.push(E(gx - 3.6, 63.2, 3.4, 4.4, SK, { a: -0.3 }));
  for (let i = 0; i < 4; i++) {
    const y = 59.4 + i * 2.5, x0 = gx - 4.4, x1 = gx + 2.6, x2 = gx + 4.2;
    o.push(K(x0, y, x1, y - 0.2, 1.2, 1.05, SK, { ink: i % 2 ? -0.04 : 0.04 }));
    o.push(E(x1, y - 0.2, 1.2, 1.15, SK, { ink: 0.1 })); // the knuckle
    o.push(K(x1, y - 0.2, x2, y + 2.2, 1, 0.8, SK, { ink: -0.06 }));
    o.push(K(x2, y + 2.2, x2 - 0.6, y + 4.6, 0.7, 0.2, 'scr_twWarlockNail'));
  }
  o.push(K(gx - 4.6, 61.4, gx - 1.8, 56.4, 1.2, 0.9, SK, { ink: 0.08 }), K(gx - 1.8, 56.4, gx - 0.4, 54.2, 0.7, 0.2, 'scr_twWarlockNail')); // the thumb
  // the hex-light, from above at the right
  o.push(Lt(sx, sy, 88, '#8c84ff', 1.8 * p, 12));
  return o;
}

/**
 * One of the two troll-wives at the fountain on the night of the raid: deep in a
 * snowed-on hood, head bowed over the soapstone bowl into which the village's hearth-fire
 * is being drawn (every hearth gutters as the rite goes on); the ember-light from below
 * finds the long nose, the chin, the open chanting mouth, and leaves the eyes black pits.
 * Her fingers are frost-black.
 */
export function covenWarlockPortrait(f: number): PrimTree {
  const b = breath(f);
  const fl = [1, 1.12, 0.9, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gCoven', HD = 'scr_covenHood', SK = 'scr_covenSkin', SN = 'scr_covenSnow', FB = 'scr_covenFrostbite';
  const bx = 56, bt = 77; // the bowl's rim
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(50, 30, 66, 54, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(48, 10, 92, 28, BG, { fl: 1, ink: BAND[3] - 0.04 })); // the snow-cloud
  // the town's gables, their bargeboards crossed above the ridge
  for (const [cx, cy, w] of [[8, 38, 18], [90, 32, 15]]) {
    o.push(P([cx - w, cy + w * 1.05, cx, cy, cx + w, cy + w * 1.05, cx + w, 97, cx - w, 97], BG, { ink: BAND[1] - 0.04 }));
    o.push(K(cx - w - 1, cy + w * 1.1, cx + 3.4, cy - 3.6, 0.9, 0.9, BG, { ink: BAND[1] + 0.08 }), K(cx + w + 1, cy + w * 1.1, cx - 3.4, cy - 3.6, 0.9, 0.9, BG, { ink: BAND[1] + 0.08 }));
    o.push(K(cx - w, cy + w * 1.05 - 1.2, cx - 1, cy - 1, 0.8, 0.8, BG, { ink: BAND[4] }));
  }
  for (let i = 0; i < 14; i++) {
    const y = (hash2(i, 41) * 96 + f * (1.6 + (i % 3) * 0.5)) % 96;
    const x = hash2(i, 43) * 96 + Math.sin(y * 0.15 + i) * 1.5;
    o.push(X(x, y, i % 4 ? 0.7 : 1, i % 4 ? 0.7 : 1, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
  }

  const by = -b * 0.45;
  const hx = 44, hy = 40 + by;
  // the cloak over bowed shoulders
  o.push(P([-2, 97, -2, 86, 8, 74, 24, 66 + by, 44, 62 + by, 64, 64 + by, 80, 70, 96, 80, 98, 97], HD, { bv: 6, ink: -0.24 }));
  for (const [x0, y0, x1, y1] of [[16, 74, 10, 97], [30, 70, 26, 97], [72, 72, 80, 97]]) o.push(K(x0, y0, x1, y1, 0.8, 1.6, HD, { ink: -0.44, occ: false })); // folds
  // the hood: its peak flopped back behind the shoulder
  o.push(P([hx - 6, hy - 19, hx - 16, hy - 19, hx - 24, hy - 11, hx - 29, hy + 2, hx - 30, hy + 12, hx - 26, hy + 6, hx - 21, hy - 2], HD, { bv: 3, ink: -0.4 }));
  // the cowl, the dark within it
  o.push(P([hx - 24, hy + 28, hx - 25, hy + 10, hx - 21, hy - 6, hx - 12, hy - 18, hx + 1, hy - 22, hx + 13, hy - 19, hx + 21, hy - 9, hx + 25, hy + 6, hx + 26, hy + 28], HD, { bv: 7, ink: -0.2 }));
  o.push(P([hx - 11, hy + 16, hx - 12.4, hy, hx - 8.6, hy - 11, hx - 1, hy - 16.6, hx + 8, hy - 15, hx + 14.6, hy - 6, hx + 18, hy + 8, hx + 17, hy + 20, hx + 6, hy + 26, hx - 5, hy + 23], 'scr_covenHollow'));
  o.push(strand(hx + 8, hy - 15, hx + 17, hy - 6, hx + 18.4, hy + 12, 1.6, 2, HD, 4, { ink: -0.34 })); // the far rim
  // the cowl drawn across the throat, under the chin
  o.push(P([hx - 13, hy + 17, hx - 2, hy + 21, hx + 10, hy + 21.4, hx + 19, hy + 16, hx + 21, hy + 24, hx + 12, hy + 29, hx - 2, hy + 29, hx - 14, hy + 25], HD, { bv: 3, ink: -0.16 }));
  o.push(K(hx - 10, hy + 26, hx + 14, hy + 26.4, 0.6, 0.6, HD, { ink: -0.4, occ: false }));
  // the face, bowed, three-quarters to the right; only the fire below lights it
  const FL = 'scr_covenFirelit';
  o.push(E(hx + 2, hy - 1, 9.8, 11, SK, { fl: 0.1, ink: -0.86 }));
  o.push(P([hx - 6.6, hy + 2, hx - 5.6, hy + 11, hx - 1.6, hy + 17, hx + 3.4, hy + 20.6, hx + 8.4, hy + 20, hx + 10.6, hy + 15.6, hx + 10.4, hy + 9, hx + 11, hy + 1], SK, { bv: 4, ink: -0.66 }));
  o.push(E(hx - 4.4, hy + 4, 3, 6, SK, { fl: 0.75, ink: -0.95 })); // the near cheek, in the hood's shadow
  o.push(E(hx - 0.6, hy + 4.6, 4.4, 2.4, SK, { ink: -0.62, a: -0.2 })); // the cheekbone
  o.push(E(hx + 5.6, hy + 17.4, 3.6, 2.8, SK, { ink: -0.56 })); // the chin
  o.push(E(hx + 5.8, hy + 19.2, 3, 1.3, FL, { fl: 0.5, ink: -0.24 })); // ...lit from beneath
  o.push(P([hx - 4.6, hy + 13.4, hx - 1.6, hy + 17, hx + 3.4, hy + 20.6, hx + 2.6, hy + 21.2, hx - 2.4, hy + 18.4], FL, { ink: -0.4 })); // the jaw's lower edge
  o.push(K(hx - 7.6, hy - 5.4, hx + 11, hy - 6, 2.4, 2, SK, { ink: -0.8 })); // the brow, overhanging
  // the eyes: black pits under the brow; only their lower lids catch the fire
  o.push(K(hx - 5.6, hy - 2.4, hx + 10, hy - 2.6, 3.2, 2.6, SK, { ink: -1.05, occ: false })); // the brow's shadow
  for (const [ex, ey, rx, ry] of [[hx - 1.8, hy - 2, 3.4, 2.6], [hx + 7.4, hy - 2.2, 2.5, 2.2]]) {
    o.push(E(ex + 0.2, ey + 0.2, rx * 0.8, ry * 0.8, 'scr_covenEye', { ink: -0.62 }));
    o.push(K(ex - rx * 0.7, ey + ry * 0.9, ex + rx * 0.8, ey + ry * 0.8, 0.5, 0.4, FL, { ink: -0.5, occ: false })); // the lower lid
    o.push(X(ex + 0.2, ey + ry * 0.2, 0.8, 0.6, '#ffb466', { em: true }));
  }
  // the long nose, reaching out of the hood and down
  o.push(P([hx + 1.4, hy - 3.6, hx + 7, hy - 0.2, hx + 13, hy + 4, hx + 18.4, hy + 8.4, hx + 19.6, hy + 11, hx + 18, hy + 12, hx + 13, hy + 10.4, hx + 7.6, hy + 10.4, hx + 3.6, hy + 10, hx + 1.2, hy + 4], SK, { bv: 2.6, ink: -0.56 }));
  o.push(E(hx + 4.4, hy + 8.6, 2.4, 1.8, SK, { ink: -0.5 }));
  o.push(K(hx + 6.4, hy + 10.6, hx + 18.4, hy + 12, 0.7, 0.5, FL, { ink: -0.18, occ: false })); // the nose's underside, in the fire's light
  o.push(K(hx + 2.6, hy + 10.2, hx + 5.4, hy + 10.8, 0.6, 0.6, FL, { ink: -0.3, occ: false }));
  o.push(E(hx + 5.6, hy + 9.8, 1.2, 0.6, 'scr_covenMouth'));
  // the mouth, open on the chant
  const mo = [2.8, 3.6, 2.4, 3.2][f % 4];
  o.push(P([hx - 1.4, hy + 13.4, hx + 3, hy + 13, hx + 7.6, hy + 12.8, hx + 7, hy + 13.2 + mo, hx + 3, hy + 13.8 + mo, hx - 0.8, hy + 13.6 + mo * 0.7], 'scr_covenMouth'));
  o.push(P([hx + 1.2, hy + 13.1, hx + 2.6, hy + 13.1, hx + 1.9, hy + 15], 'scr_covenTooth', { bv: 0.3 }), P([hx + 4.6, hy + 13, hx + 5.8, hy + 13, hx + 5.2, hy + 14.6], 'scr_covenTooth', { bv: 0.3 }));
  o.push(K(hx - 1.6, hy + 13.2, hx + 7.8, hy + 12.6, 0.6, 0.5, SK, { ink: -0.24 })); // the upper lip
  o.push(K(hx - 1, hy + 14.4 + mo * 0.7, hx + 7, hy + 13.8 + mo, 0.7, 0.55, FL, { ink: -0.2 })); // the lower lip, in the light
  o.push(K(hx - 4.6, hy + 8.4, hx - 2.4, hy + 13.4, 0.35, 0.35, SK, { ink: -0.5, occ: false }));
  // the near rim of the cowl, a heavy fold round the face
  o.push(strand(hx + 2, hy - 18, hx - 16, hy - 12, hx - 12, hy + 22, 3, 3.6, HD, 7, { ink: -0.08 }));
  // snow lying on the hood and the shoulders: lumps with flat undersides
  const drift = (x0: number, y0: number, x1: number, y1: number, h: number, sd: number) => {
    const pts: number[] = [], n = 6;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * h * (0.6 + 0.5 * hash2(i, sd))); }
    pts.push(x1 - (x1 - x0) * 0.08, y1 + 1.6, x0 + (x1 - x0) * 0.5, (y0 + y1) / 2 + 2.2, x0 + (x1 - x0) * 0.08, y0 + 1.6);
    return P(pts, SN, { bv: 1.6, ink: -0.04 });
  };
  o.push(drift(hx - 22, hy - 4, hx - 10, hy - 16.6, 4.2, 3), drift(hx - 7, hy - 19.6, hx + 8, hy - 20.4, 4.4, 5), drift(hx + 12, hy - 17.6, hx + 20, hy - 9.6, 3, 7));
  o.push(drift(1, 83 + by * 0.6, 21, 70.6 + by * 0.6, 4, 9), drift(69, 68.4 + by * 0.6, 91, 77.6 + by * 0.6, 3.6, 11));

  // the sleeves, the hands round the bowl
  o.push(K(26, 97, bx - 13, bt + 6, 7.4, 5.4, HD, { ink: -0.22 }), K(88, 97, bx + 14, bt + 6, 7.4, 5.4, HD, { ink: -0.26 }));
  // the soapstone bowl
  o.push(E(bx, bt + 4.8, 15, 7.6, 'scr_covenBowl', { fl: 0.2, ink: -0.16 }));
  o.push(E(bx, bt, 14.4, 3.6, 'scr_covenBowl', { fl: 0.4, ink: -0.04 }));
  o.push(E(bx, bt - 0.1, 12.2, 2.6, 'scr_covenHollow', { fl: 0.9 }));
  o.push(K(bx - 14, bt + 4.4, bx + 14, bt + 4.4, 0.45, 0.45, 'scr_covenBowl', { ink: -0.44, occ: false })); // a cut band
  // the hearth-fire gathered in it, licking up
  o.push(E(bx, bt - 0.4, 11, 2.2, 'emFire', { fl: 0.5, ink: -0.12 }));
  // a tongue of flame: round-bellied, drawn up to a curling point
  const tongue = (x: number, w: number, h: number, ln: number, m: string, ink: number) => {
    const r: number[] = [], l: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, wd = w * Math.pow(1 - t, 0.85) * (1 + 0.25 * Math.sin(t * Math.PI * 2)), cx0 = x + ln * t * t * 3, y = bt + 0.6 - h * t;
      r.push(cx0 + wd, y); l.unshift(cx0 - wd, y);
    }
    return P(r.concat(l), m, { occ: false, ink });
  };
  for (const [dx, w, h, ph, lean] of [[-7, 2.6, 8, 0.3, -1.4], [0, 3.6, 14.4, 0, 0], [7, 2.4, 9.4, 0.7, 1.4], [-2.6, 1.8, 10, 0.5, -0.8], [3.4, 1.6, 7, 0.9, 0.8]]) {
    const hh = h * (0.82 + 0.18 * Math.sin(f * Math.PI / 2 + ph * 6)), ln = lean + Math.sin(f * 1.3 + ph * 5) * 0.8;
    o.push(tongue(bx + dx, w, hh, ln, 'emFire', -0.3));
  }
  o.push(E(bx, bt - 1.4, 7.4, 3.2, 'emFireCore', { fl: 0.4, occ: false }));
  o.push(tongue(bx + 0.4, 2, 7.4 * fl, Math.sin(f * 1.3) * 0.6, 'emFireCore', -0.12));
  for (let i = 0; i < 3; i++) {
    const y = bt - 14 - ((f + i * 1.4) % 4) * 4.4, x = bx - 3 + i * 3.4 + Math.sin(f + i * 2) * 1.4;
    o.push(X(x, y, 1, 1, i === 1 ? 'emFireCore:4' : 'emFire:4', { em: true }));
  }
  // the hands, cupped round the bowl: fingers frost-black to the second knuckle
  for (const sd of [-1, 1]) {
    const wx = bx + sd * 14, wy = bt + 6;
    o.push(E(wx, wy, 4, 4.4, SK, { a: sd * 0.4, ink: -0.36 }));
    for (let i = 0; i < 4; i++) {
      const a = 0.25 + i * 0.32, y = wy - 1.6 + i * 2.2, x0 = wx - sd * 1.4, x1 = x0 - sd * 4.4 * Math.cos(a * 0.6), y1 = y + 2.6 * Math.sin(a), x2 = x1 - sd * (3.4 - i * 0.4) * Math.cos(a), y2 = y1 + 3 * Math.sin(a);
      o.push(K(x0, y, x1, y1, 1.2, 1.05, SK, { ink: -0.34 }));
      o.push(E(x1, y1, 1.15, 1.1, SK, { ink: -0.28 }));
      o.push(K(x1, y1, x2, y2, 1.05, 0.7, FB));
    }
    o.push(K(wx - sd * 1.6, wy - 3.6, wx - sd * 6.6, wy - 5.8, 1.1, 0.85, SK, { ink: -0.3 }), K(wx - sd * 6.6, wy - 5.8, wx - sd * 9.4, wy - 5.4, 0.85, 0.6, FB)); // the thumb over the rim
    o.push(X(wx - sd * 7.4 - 0.5, wy - 6.8, 1, 1, '#e8f2ff', { em: true })); // hoar-frost on it
  }
  // the stolen fire's light, from below
  o.push(Lt(bx, bt - 4, 60, '#ff8a2c', 1.6 * fl, 5));
  o.push(Lt(hx + 6, hy + 30, 42, '#ff9a40', 1.6 * fl, 2.5)); // the same light, on the face above it
  o.push(Lt(bx, bt - 2, 22, '#ffb060', 0.6 * fl, 5));
  return o;
}

/**
 * The Vetrarkona, of Winter's grim and cold-breasted kin (so the lore names the family of
 * Vetr, Vindsvalr's son): bent double under her hump, her head thrust out below it,
 * frost-white hair hanging in icicles; a shepherd's crook arches over her, a frost crystal
 * hung from it like a lamp, and its pale light falls from above on her brow, her hooked nose
 * (a drop frozen at its tip) and her sunken mouth. Her eyes are the winter's, white-cyan,
 * without pupils.
 */
export function winterHagPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.1, 0.92, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gWinterHag', HL = 'scr_winterHagHalo', SK = 'scr_winterHagSkin', HR = 'scr_winterHagHair';
  const RB = 'scr_winterHagRobe', SH = 'scr_winterHagShawl', CR = 'scr_winterHagCrook', RM = 'scr_winterHagRime';
  const cx = 63, cy = 24; // the frost crystal
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(50, 46, 66, 60, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(cx, cy, 23, 22, HL, { fl: 1, ink: BAND[1] }), E(cx, cy, 12.5, 12, HL, { fl: 1, ink: BAND[2] }));
  // icicles from the roof of the hollow
  for (let i = 0; i < 9; i++) {
    const x = 3 + i * 11 + hash2(i, 31) * 5, len = 8 + hash2(i, 33) * 16, w = 1.8 + hash2(i, 35) * 1.6;
    o.push(P([x - w, -1, x + w, -1, x + 0.3, len], BG, { ink: BAND[3] - 0.06 }));
    o.push(P([x - w * 0.5, -1, x + 0.1, -1, x + 0.2, len * 0.7], BG, { ink: BAND[4] - 0.08 }));
  }
  // rime drifting down
  for (let i = 0; i < 10; i++) {
    const y = (hash2(i, 37) * 96 + f * (1.2 + (i % 3) * 0.4)) % 96, x = hash2(i, 39) * 96;
    o.push(X(x, y, 0.8, 0.8, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
  }

  const by = -b * 0.5;
  const hx = 49, hy = 50 + by;
  // the robe below; the neck thrust out from under the hump, the sinews standing
  o.push(P([-2, 97, -2, 74, 14, 64, 36, 66, 56, 72, 72, 82, 78, 97], RB, { bv: 5, ink: -0.34 }));
  for (const [x0, y0, x1, y1] of [[50, 74, 56, 97], [62, 79, 66, 97]]) o.push(K(x0, y0, x1, y1, 0.8, 1.4, RB, { ink: -0.56, occ: false })); // folds
  o.push(K(34, 52, hx - 4, hy + 13, 6.4, 5.6, SK, { ink: -0.44 }));
  o.push(K(40, 56, hx - 3, hy + 17, 0.8, 0.8, SK, { ink: -0.26, occ: false }));
  // the hump rising behind her at the left, under a fringed shawl
  o.push(E(17, 50 + by * 0.6, 23, 20, SH, { a: -0.4, fl: 0.2, ink: -0.26 }));
  o.push(E(31, 39 + by * 0.6, 10, 7.4, SH, { a: -0.3, fl: 0.2, ink: -0.2 })); // the shoulder-blade, knotted under it
  o.push(P([-2, 76, -2, 50, 5, 38, 16, 31.6 + by * 0.6, 29, 32.4 + by * 0.6, 39, 39, 45, 52, 44, 66, 40, 72, 37, 68, 34, 75, 30, 70, 26, 78, 22, 72, 18, 80, 14, 73, 10, 81, 6, 74, 2, 82, -2, 78], SH, { bv: 5, ink: -0.24 }));
  for (const [x0, y0, x1, y1] of [[10, 40, 6, 74], [22, 36, 20, 72], [34, 40, 36, 66]]) o.push(K(x0, y0 + by * 0.6, x1, y1, 0.8, 1.3, SH, { ink: -0.52, occ: false })); // folds
  // the shawl's hem, wrapped over the hump and down to the nape
  const hb = by * 0.6;
  o.push(P([20, 31.4 + hb, 27, 31.6 + hb, 35, 35 + hb, 41, 43, 45, 53, 43, 58, 39, 50, 33, 41 + hb, 25, 36 + hb, 17, 35.6 + hb], SH, { bv: 1.6, ink: -0.1 }));
  o.push(strand(17, 36.4 + hb, 32, 41 + hb, 42, 57, 0.7, 0.9, SH, 5, { ink: -0.56, occ: false })); // the shadow under it
  // a little rime glinting on the hump's crown
  for (const [x, y] of [[9, 37.4], [17.6, 33.4], [21, 34.6], [34.4, 32.8]]) o.push(X(x, y + by * 0.6, 1, 1, '#d8f4ff', { em: true }));

  const HT = (l: PrimTree) => T(l, { px: hx, py: hy, s: 1.2 }); // the head, a size up
  // the hair behind: thin frost-white strands hanging from the back of her skull, iced at the ends
  const back: Out = [];
  for (const [x0, y0, x1, y1, x2, y2, r, ink] of [[-9, -10, -16, 2, -17, 22, 1.5, -0.3], [-8, -8, -13, 6, -13.4, 26, 1.3, -0.2], [-6, -6, -9.6, 8, -9, 24, 1.2, -0.12], [-10.4, -6, -18, 6, -20.6, 18, 1.2, -0.36], [-4.6, -4, -6.4, 10, -5, 21, 1, -0.1]]) {
    back.push(strand(hx + x0, hy + y0, hx + x1 + s * 0.1, hy + y1, hx + x2 + s * 0.3, hy + y2, r, 0.45, HR, 5, { ink }));
    back.push(P([hx + x2 + s * 0.3 - 0.8, hy + y2 - 0.4, hx + x2 + s * 0.3 + 0.8, hy + y2 - 0.4, hx + x2 + s * 0.36 + 0.1, hy + y2 + 3.4], RM, { bv: 0.3 }));
  }
  o.push(HT(back));
  // the head: a bony skull, a gaunt face, the jaw drawn up toward the nose
  const h: Out = [];
  h.push(E(hx - 1, hy - 3, 11, 10.6, SK, { fl: 0.15, ink: -0.06 }));
  h.push(E(hx + 2, hy + 3, 9, 10, SK, { fl: 0.2, ink: -0.04 }));
  h.push(P([hx - 7, hy + 4, hx - 5.4, hy + 12, hx - 0.6, hy + 16.2, hx + 4.6, hy + 18.2, hx + 9, hy + 17.4, hx + 10.8, hy + 14.6, hx + 9.6, hy + 11.6, hx + 9.6, hy + 5], SK, { bv: 3, ink: -0.06 }));
  h.push(E(hx - 3.4, hy + 9.8, 3.8, 4.8, SK, { fl: 0.3, ink: -0.42 })); // the sunken cheek
  h.push(E(hx - 2, hy + 3.6, 4.6, 2, SK, { fl: 0.5, ink: -0.04, a: -0.2 })); // the cheekbone
  h.push(E(hx + 9.4, hy + 5, 2, 4, SK, { fl: 0.6, ink: -0.3 }));
  h.push(E(hx + 7.8, hy + 15.4, 2.8, 2.2, SK, { fl: 0.3, ink: -0.1 })); // the chin
  h.push(P([hx - 4.6, hy + 13, hx - 0.6, hy + 16.2, hx + 4.6, hy + 18.2, hx + 9, hy + 17.4, hx + 8.2, hy + 18.8, hx + 4, hy + 19.4, hx - 1.4, hy + 17.6], SK, { ink: -0.5, occ: false })); // the shadow under the jaw
  h.push(K(hx - 8.6, hy - 4.8, hx + 10, hy - 5.6, 2.2, 1.6, SK, { ink: -0.04 })); // the brow, catching the lamp
  // the eyes: deep under the brow, white-cyan, without pupils
  const gl = (p - 1) * 0.4;
  for (const [ex, ey, rx, ry] of [[hx - 2.8, hy - 0.9, 3.7, 2.4], [hx + 7, hy - 1.9, 2.4, 2]]) {
    h.push(E(ex, ey, rx, ry, 'scr_winterHagSocket', { fl: 0.7, ink: -0.36 }));
    h.push(E(ex + 0.4, ey + 0.4, rx * 0.5, ry * 0.34, 'scr_winterHagEye', { ink: gl, occ: false }));
  }
  h.push(Lt(hx + 1, hy - 0.6, 8, '#bff0ff', 0.35 * p, 3));
  // crow's feet, and two furrows across the brow
  h.push(K(hx - 7, hy - 0.4, hx - 9.4, hy - 1.8, 0.35, 0.35, SK, { ink: -0.36, occ: false }), K(hx - 6.8, hy + 1, hx - 9.2, hy + 1.8, 0.35, 0.35, SK, { ink: -0.36, occ: false }));
  for (let i = 0; i < 2; i++) h.push(K(hx - 5 + i, hy - 9.4 + i * 1.8, hx + 4 - i, hy - 10 + i * 1.8, 0.35, 0.35, SK, { ink: -0.3, occ: false }));
  // brows of frost, long and drooping over the eyes
  h.push(strand(hx - 8.6, hy - 3.6, hx - 4.6, hy - 7.4, hx + 0.6, hy - 4.2, 1, 0.4, HR, 4, { ink: -0.04 }));
  h.push(strand(hx - 8.6, hy - 3.6, hx - 10.6, hy - 2.6, hx - 11, hy + 0.6, 0.7, 0.3, HR, 3, { ink: -0.14 }));
  h.push(strand(hx + 4, hy - 5, hx + 7.4, hy - 7, hx + 10.4, hy - 4.6, 0.8, 0.35, HR, 3, { ink: -0.08 }));
  // the hooked nose, a wart on the bridge, a drop frozen at its tip
  h.push(P([hx + 0.6, hy - 3.4, hx + 5.6, hy - 1, hx + 10.4, hy + 1.2, hx + 13.6, hy + 4.4, hx + 14.6, hy + 7.8, hx + 13.6, hy + 10.8, hx + 12, hy + 11.6, hx + 11.4, hy + 9.4, hx + 9, hy + 9, hx + 5.6, hy + 9.8, hx + 2.6, hy + 9.4, hx + 0.4, hy + 4], SK, { bv: 2.4 }));
  h.push(K(hx + 2, hy - 2.2, hx + 12.6, hy + 3.8, 0.5, 0.4, SK, { ink: 0.08, occ: false })); // the ridge, in the light
  h.push(E(hx + 3.8, hy + 7.8, 2.4, 1.8, SK, { ink: -0.06 }));
  h.push(E(hx + 5.2, hy + 9.2, 1.1, 0.55, 'scr_winterHagMouth'));
  h.push(E(hx + 8.8, hy + 2.2, 1.1, 0.9, SK, { ink: 0.1 })); // the wart
  h.push(P([hx + 11.8, hy + 11.2, hx + 13.2, hy + 10.8, hx + 12.6, hy + 15], RM, { bv: 0.4 }));
  // the mouth: fallen in over toothless gums, a thin dark line turned down
  h.push(E(hx + 4.4, hy + 12, 5.6, 1.6, SK, { fl: 0.6, ink: -0.3 })); // the hollow of the upper lip
  h.push(strand(hx - 0.6, hy + 13.8, hx + 4, hy + 12.4, hx + 9.4, hy + 12.8, 0.5, 0.4, 'scr_winterHagMouth', 4, { occ: false }));
  h.push(K(hx + 1, hy + 14.8, hx + 8, hy + 14.2, 0.5, 0.4, SK, { ink: 0.02, occ: false })); // the lower lip, in the light
  h.push(strand(hx - 4.4, hy + 7.8, hx - 3, hy + 12, hx - 0.8, hy + 15, 0.4, 0.35, SK, 3, { ink: -0.36, occ: false })); // the fold, nose to mouth
  // the hair over the crown: thin, combed back, the scalp showing through
  h.push(P([hx - 11.4, hy + 2, hx - 12, hy - 7, hx - 7.6, hy - 13.4, hx - 1, hy - 15, hx + 2, hy - 13.6, hx - 2, hy - 11.6, hx - 6, hy - 8, hx - 8.4, hy - 2, hx - 9, hy + 2], HR, { bv: 1.6, ink: -0.14 }));
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[5, -13.6, -2, -15, -9.4, -9, 0.04], [7.4, -11.4, 0, -13.4, -8, -6.4, -0.04], [3, -14.6, -4, -15.2, -11, -6, 0.1], [8.6, -9, 2, -11.4, -6, -4, -0.1]]) {
    h.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2, hy + y2, 0.55, 0.4, HR, 4, { ink, occ: false })); // strands combed back
  }
  o.push(HT(h));

  // the crook: planted at the right, arching over her, the crystal hung from it
  o.push(K(85, 99, 82.6, 15, 2, 1.8, CR));
  o.push(strand(82.6, 15, 82, 3, 72.4, 3, 1.8, 1.5, CR, 5));
  o.push(strand(72.4, 3, cx + 0.4, 3.4, cx - 0.4, 9.6, 1.5, 1.3, CR, 3));
  for (const y of [40, 76]) o.push(E(83.4 + (99 - y) * 0.02, y, 2.4, 1.2, CR, { ink: -0.06 })); // knots
  o.push(P([82.6, 97, 82.8, 88, 83.6, 91, 84.2, 84, 85, 89, 86, 86, 86.6, 92, 87.4, 97], RM, { bv: 0.6, ink: -0.12 })); // rime creeping up its foot
  o.push(K(cx - 0.4, 9.4, cx, 15, 0.45, 0.45, 'leatherDark'));
  o.push(P([cx - 3.4, cy - 7, cx + 3, cy - 7.6, cx + 4.6, cy, cx + 0.4, cy + 10, cx - 4.4, cy + 0.6], 'scr_winterHagCrystal', { bv: 1.4 }));
  o.push(P([cx - 1, cy - 6.6, cx + 2.4, cy - 7, cx + 3, cy - 0.6, cx + 0.4, cy + 7], 'scr_winterHagCrystal', { ink: 0.18 }));
  o.push(X(cx - 2.4, cy - 4.4, 1, 3.6, '#ffffff', { em: true }));
  // the hand on the crook, out of the shawl: long knuckled fingers, nails like icicles
  o.push(K(70, 80, 78.6, 68.6, 5, 3.8, SH, { ink: -0.3 }));
  o.push(P([73, 74, 76.6, 66, 81.6, 66.6, 80.6, 71, 78.6, 69.6, 77.6, 73.4, 75.6, 71.6, 74.6, 76], SH, { bv: 1.2, ink: -0.2 })); // the shawl's edge over the wrist
  const gx = 84.2, gy = 64;
  o.push(E(gx - 4.4, gy + 1.4, 3.2, 4.2, SK, { a: -0.3, ink: -0.08 }));
  for (let i = 0; i < 4; i++) {
    const y = gy - 2 + i * 2.4, x0 = gx - 5, x1 = gx + 2, x2 = gx + 3.4;
    o.push(K(x0, y, x1, y - 0.2, 1.1, 1, SK, { ink: i % 2 ? -0.1 : -0.02 }));
    o.push(E(x1, y - 0.2, 1.15, 1.1, SK, { ink: 0.06 }));
    o.push(K(x1, y - 0.2, x2, y + 2, 0.95, 0.75, SK, { ink: -0.1 }));
    o.push(K(x2, y + 2, x2 - 0.4, y + 4.8, 0.65, 0.2, 'scr_winterHagNail'));
  }
  o.push(K(gx - 5.4, gy - 0.6, gx - 2.4, gy - 5, 1.1, 0.85, SK, { ink: 0.04 }));
  // the frost-lamp's light, from above
  o.push(Lt(cx, cy + 2, 80, '#9fe6ff', 1.05 * p, 14));
  return o;
}
