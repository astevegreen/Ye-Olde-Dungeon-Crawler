import { E, K, P, X, Lt, breath, sway, hash2, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out } from './portraitKit';
import './materials';

/* Wave 9g, group D: the world-bark. The Amber Sap-Weeper and the Yggdrasil Parasite. Conventions: portraitKit.ts. */

/** A run of sap down a path of points: bulging where it pools, a bead at the end. */
function run(o: Out, pts: number[], r0: number, r1: number, m: string, ink: number): void {
  const n = pts.length / 2 - 1;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, bul = (t: number): number => r0 + (r1 - r0) * t + Math.sin(t * Math.PI * 2.6) * 0.18;
    o.push(K(pts[2 * i], pts[2 * i + 1], pts[2 * i + 2], pts[2 * i + 3], bul(t0), bul(t1), m, { ink: ink - t0 * 0.12, occ: false }));
  }
}

// ========================================================== AMBER SAP-WEEPER
/**
 * A bark beetle the size of a shield, coming at you down the wall of its own gallery in the World Tree's
 * wood. Its shield and wing-cases are grained like the tree's bark; where it has bored, the tree weeps:
 * living sap wells from a wound in its shield, pours over the toothed rim and runs down its face past the
 * eyes like tears, and strings between its jaws. The welling sap is the light. Elbowed, clubbed feelers
 * spread to either side; toothed forelegs grip.
 */
export function sapWeeperPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.1, 0.94, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gSapWeeper', SH = 'scr_sapWeeperShell', CH = 'scr_sapWeeperChitin', SAP = 'scr_sapWeeperSap', AM = 'scr_sapWeeperAmber', HO = 'scr_sapWeeperHole';
  // the gallery wall: the mother gallery behind it, the larval galleries
  // branching off it, widening as the grubs grew, each ending in its chamber
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(38, 46, 52, 48, BG, { fl: 1, ink: BAND[2] }));
  o.push(P([44, -1, 56, -1, 57, 97, 43, 97], BG, { ink: BAND[2] }));
  for (let i = 0; i < 12; i++) {
    const sd = i % 2 ? 1 : -1, j = i >> 1, y0 = 4 + j * 15 + hash2(i, 5) * 4, x0 = 50 + sd * 6;
    const len = 30 + hash2(i, 7) * 12, x2 = x0 + sd * len, y2 = y0 + (hash2(i, 9) - 0.4) * 14;
    o.push(strand(x0, y0, x0 + sd * len * 0.5, y0 + (hash2(i, 11) - 0.5) * 10, x2, y2, 0.8, 2.2, BG, 3, { ink: BAND[1] - 0.04 }));
    o.push(E(x2 + sd * 1.5, y2, 3.4, 2.4, BG, { fl: 1, ink: BAND[1] - 0.04 }));
  }

  const by = -b * 0.4;
  const B = (y: number): number => y + by;
  // the middle legs, out from under the shield, in shadow
  for (const sd of [-1, 1]) {
    const x = (v: number): number => 50 + sd * v;
    o.push(K(x(28), B(46), x(42), B(51), 2.4, 2, CH, { ink: -0.3 }), K(x(42), B(51), x(47.5), 68, 2, 1.2, CH, { ink: -0.36 }));
    o.push(K(x(47.5), 68, x(49), 72, 1, 0.4, CH, { ink: -0.3 }));
    for (const t of [0.35, 0.65]) o.push(K(x(42 + 5.5 * t), 51 + 17 * t, x(44.4 + 5.5 * t), 50 + 17 * t, 0.6, 0.2, CH, { ink: -0.3 }));
  }
  // the wing-cases, behind the shield, grained like bark
  o.push(E(50, B(20), 38, 22, SH, { fl: 0.05, ink: -0.16 }));
  o.push(K(50, B(-1), 50, B(26), 0.7, 0.7, HO, { occ: false })); // the seam
  for (const sd of [-1, 1]) for (const [x0, k] of [[8, -0.3], [17, -0.32], [27, -0.34]]) {
    o.push(strand(50 + sd * x0 * 1.25, B(30), 50 + sd * x0 * 1.1, B(10), 50 + sd * 3, B(-1), 0.5, 0.35, HO, 4, { occ: false, ink: k }));
  }
  // sap run down the flanks of the wing-cases, hardening to amber
  run(o, [17, B(14), 15, B(22), 15.6, B(30), 15, B(36)], 0.9, 1.2, AM, 0.02);
  run(o, [83, B(16), 85, B(24), 84.2, B(32)], 0.8, 1.1, AM, -0.04);

  // the head, under the shield
  const hx = 50, hy = B(64);
  o.push(E(hx, hy, 19, 15.5, CH, { fl: 0.08 }));
  o.push(E(hx, hy + 3, 9, 8, CH, { fl: 0.5, ink: 0.05 })); // the brow of the face
  o.push(K(hx, hy - 7, hx, hy + 6, 0.7, 0.5, CH, { ink: 0.16, occ: false })); // its keel
  // the eyes: long kidneys at the sides of the head, slanting in under the shield
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 14.6, ey = hy - 5.4;
    o.push(E(ex, ey, 4.4, 7.2, HO, { a: -sd * 0.38 }));
    o.push(E(ex + sd * 0.2, ey + 0.4, 3.3, 6.2, 'eyeAmber', { a: -sd * 0.38, ink: -0.32 }));
    o.push(E(ex - sd * 0.4, ey + 2.6, 1.8, 2.6, 'eyeAmber', { a: -sd * 0.38, ink: -0.06 }));
    for (let i = 0; i < 4; i++) o.push(X(ex - 1.2 + (i % 2) * 1.6, ey - 1 + (i >> 1) * 2.4, 0.6, 0.6, 'eyeAmber:1')); // facets
    o.push(X(ex - sd * 0.8 - 0.4, ey + 1.8, 0.9, 0.9, '#fff4dc', { em: true }));
    o.push(Lt(ex, ey + 1, 9, '#ffc23a', 0.4, 3));
  }
  // the mouth, and the jaws: short, heavy, toothed, open on a string of sap
  o.push(P([hx - 7, B(71), hx + 7, B(71), hx + 6, B(79), hx, B(81), hx - 6, B(79)], HO));
  const mo = [0, 0.3, 0.6, 0.3][f % 4];
  for (const sd of [-1, 1]) {
    const x = (v: number): number => hx + sd * v;
    o.push(P([x(9), B(69.5), x(13), B(73), x(12.6), B(78.5), x(9), B(83), x(3.4), B(85.6 + mo), x(-1.4), B(85 + mo), x(2.6), B(82.6 + mo), x(4.6), B(81.2), x(3.6), B(79.4), x(5.8), B(78.6), x(5.2), B(76.4), x(7), B(75.2), x(6), B(72)], CH, { bv: 1.6, ink: sd < 0 ? 0.04 : -0.08 }));
    o.push(K(x(11.6), B(72), x(11.2), B(78.6), 0.45, 0.4, CH, { ink: 0.22, occ: false })); // its lit outer edge
  }
  // the shield over the head: bark-grained, its front rim toothed and dipping
  // to a scowl over the face
  const rim = [[16, 40], [20, 48], [30, 52], [40, 55], [50, 58.6], [60, 55], [70, 52], [80, 48], [84, 40]];
  const pts = [16, B(40), 18, B(32), 26, B(26), 38, B(23), 50, B(22), 62, B(23), 74, B(26), 82, B(32)];
  for (let i = rim.length - 1; i >= 0; i--) pts.push(rim[i][0], B(rim[i][1]));
  o.push(P(pts, SH, { bv: 8, n: [0, -0.22, 1] }));
  // bark fissures across it
  for (const [x0, y0, x1, y1, x2, y2] of [[30, 26, 27, 34, 22, 44], [40, 24, 38, 34, 34, 46], [58, 24, 60, 32, 64, 44], [70, 27, 73, 35, 76, 44], [49, 23, 51, 31, 49, 40]]) {
    o.push(strand(x0, B(y0), x1, B(y1), x2, B(y2), 0.55, 0.4, HO, 3, { occ: false, ink: -0.1 }));
  }
  // the toothed rim, a row of hard tubercles hanging over the face
  for (let i = 0; i < rim.length - 1; i++) {
    const [ax, ay] = rim[i], [cx, cy] = rim[i + 1];
    for (const t of [0.25, 0.75]) {
      const x = ax + (cx - ax) * t, y = ay + (cy - ay) * t, l = Math.hypot(cx - ax, cy - ay), nx = -(cy - ay) / l, ny = (cx - ax) / l;
      const sg = x < 50 ? -1 : 1;
      o.push(P([x - (cx - ax) / l * 1.6, B(y - (cy - ay) / l * 1.6), x + (cx - ax) / l * 1.6, B(y + (cy - ay) / l * 1.6), x - nx * sg * 2.6, B(y - ny * sg * 2.6)], SH, { bv: 0.9, ink: -0.06 }));
    }
  }
  o.push(strand(20, B(46.4), 34, B(52.6), 50, B(56.8), 0.6, 0.6, SH, 4, { ink: 0.2, occ: false })); // the rim's lit edge
  // the wound in the shield where it has bored, and the tree's sap welling out of it
  o.push(E(37, B(42.6), 3.6, 2.4, HO, { a: -0.2 }));
  o.push(E(37.4, B(44.6), 3.2 * p, 2.8 * p, SAP, { ink: 0.08 }));
  run(o, [37.6, B(46), 38.6, B(50), 39.6, B(54), 40.2, B(57)], 1.5, 1.1, SAP, -0.02);
  // the tears: over the rim, down past the eyes, onto the jaws
  run(o, [40.2, B(57), 40.4, B(61), 41, B(65.5), 41.8, B(70), 42.4, B(74)], 1.1, 0.8, SAP, -0.1);
  run(o, [42.4, B(74), 41.6, B(78), 40.6, B(81)], 0.8, 0.6, SAP, -0.18);
  o.push(E(62.6, B(53), 1.4, 1.1, SAP, { ink: -0.12 }));
  run(o, [62.6, B(54), 61.4, B(59), 60.8, B(64), 59.8, B(69)], 0.8, 0.6, SAP, -0.22);
  // a bead swelling on the jaw's edge, and a drop falling from it
  const dl = [0, 0.6, 1.2, 1.8][f % 4];
  o.push(E(40.4, B(82) + dl * 0.5, 1.1, 1.3 + dl * 0.3, SAP, { ink: -0.1 }));
  // a string of sap sagging between the jaws
  o.push(strand(hx - 4.4, B(80.4), hx, B(84.6 + mo), hx + 4.4, B(80.4), 0.4, 0.4, SAP, 4, { ink: -0.2, occ: false }));
  // the elbowed feelers: a long stalk out to each side, a bent string of beads, a flattened club
  for (const sd of [-1, 1]) {
    const x = (v: number): number => hx + sd * v, tw = sd > 0 ? s * 0.5 : 0;
    o.push(K(x(9), B(68.6), x(23), B(63.6), 1.2, 1, CH, { ink: sd < 0 ? 0 : -0.1 }));
    for (let i = 0; i < 4; i++) o.push(E(x(23 + i * 1.9), B(64.6 + i * 1.8) + tw * i * 0.2, 0.95, 0.9, CH, { ink: -0.04 }));
    const cx = x(32.6), cy = B(73) + tw;
    o.push(E(cx, cy, 3.2, 5.2, CH, { a: sd * -0.55, fl: 0.3 }));
    for (const k of [-1.6, 0.6, 2.6]) o.push(K(cx - 2.6 * Math.cos(sd * 0.55) - sd * k * 0.3, cy + k - 1.4 * sd * 0.1, cx + 2.6 * Math.cos(sd * 0.55) - sd * k * 0.3, cy + k + sd * 1.6, 0.3, 0.3, HO, { occ: false, ink: -0.2 }));
  }
  // the forelegs, toothed on their outer edge, hooked into the gallery wall
  for (const sd of [-1, 1]) {
    const x = (v: number): number => hx + sd * v;
    o.push(K(x(12), B(77), x(24), B(84), 3, 2.5, CH, { ink: sd < 0 ? -0.04 : -0.16 }));
    o.push(P([x(22.4), B(82), x(26), B(86), x(30.4), 97, x(25.4), 97, x(21.6), 87], CH, { bv: 1.2, ink: sd < 0 ? -0.06 : -0.18 }));
    for (const t of [0.3, 0.55, 0.8]) o.push(P([x(26 + 4.4 * t), 86 + 11 * t, x(27.4 + 4.4 * t), 85.4 + 11 * t, x(30 + 4.4 * t), 84 + 11 * t], CH, { ink: -0.1 }));
  }
  // light: the sap welling from the wound
  o.push(Lt(37.6, B(46), 62, '#ffa040', 1.0 * p, 12));
  return o;
}

// ========================================================= YGGDRASIL PARASITE
/**
 * A tick off the rotting side of the World Tree, that drops from the boughs of Verðandi's loom when the
 * blackened fibres are cut: swollen with the tree's sap until its belly is a pale sac so full of eggs they
 * glow through the skin. It clings to a rotten bough and quests at you, its front legs raised and
 * reaching, its barbed beak (made to hold fast in the wound) wet with sap; the eggs' bile-green glow is
 * the light.
 */
export function yggdrasilParasitePortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const pu = [0, 0.06, 0.12, 0.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gYggParasite', SK = 'scr_yggParasiteSkin', EG = 'scr_yggParasiteEgg', PL = 'scr_yggParasitePlate', LG = 'scr_yggParasiteLeg', BK = 'scr_yggParasiteBeak', HO = 'scr_yggParasiteHole', RT = 'scr_yggParasiteRot';
  // the loom's warp: the tree's fibres hanging in the dark, some blackened and broken
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(38, 38, 54, 50, BG, { fl: 1, ink: BAND[2] }));
  for (let i = 0; i < 8; i++) {
    const x = 4 + i * 12.4 + hash2(i, 3) * 4, br = hash2(i, 5) > 0.6, y1 = br ? 30 + hash2(i, 7) * 30 : 97;
    o.push(strand(x, -1, x + (hash2(i, 9) - 0.5) * 4, y1 * 0.5, x + (hash2(i, 11) - 0.5) * 6, y1, 1.4, br ? 0.5 : 1.2, BG, 3, { ink: i % 2 ? BAND[1] + 0.06 : BAND[3] - 0.06 }));
  }

  // the rotten bough it clings to
  o.push(K(-4, 96, 100, 82, 9, 7, RT, { ink: -0.2 }));
  o.push(strand(-2, 88.4, 50, 82.6, 100, 75.6, 0.8, 0.7, RT, 4, { ink: 0.06, occ: false }));
  for (const [x, y] of [[22, 90], [60, 86], [84, 83]]) o.push(E(x, y, 3, 1.6, HO, { fl: 0.6, a: -0.14 })); // rot holes
  // eggs already laid on the bough
  for (const [x, y, r] of [[8, 85.6, 1.8], [11.4, 86.6, 2], [9.6, 83.2, 1.6], [13.6, 84, 1.5], [6, 82.8, 1.3]]) o.push(E(x, y, r, r * 0.86, EG, { ink: -0.3 + pu }));

  const by = -b * 0.3;
  // the far legs, under the belly, gripping
  for (const [x0, y0, x1, y1, x2, y2] of [[56, 68, 44, 72, 38, 84], [58, 70, 50, 78, 50, 87]]) {
    o.push(K(x0, y0 + by, x1, y1, 1.8, 1.4, LG, { ink: -0.34 }), K(x1, y1, x2, y2, 1.4, 0.6, LG, { ink: -0.4 }));
  }
  // the belly: a pale sac drum-tight with eggs, ringed with grooves
  const ax = 36, ay = 36 + by, rx = 31 + b * 0.25, ry = 27 + b * 0.25;
  o.push(E(ax, ay, rx, ry, SK, { a: -0.45 }));
  for (const k of [-0.62, -0.25, 0.12, 0.48]) {
    const a0 = [ax + k * rx * 0.9 - 4, ay - ry * 0.86 + Math.abs(k) * 8], a1 = [ax + k * rx * 1.05 + 6, ay], a2 = [ax + k * rx * 0.8 + 10, ay + ry * 0.82 - Math.abs(k) * 8];
    o.push(strand(a0[0], a0[1], a1[0], a1[1], a2[0], a2[1], 0.45, 0.45, SK, 5, { ink: -0.34, occ: false }));
  }
  // the eggs pressing out through the skin, the deepest dimmest
  const eggs = [[30, 30, 3.6, 0], [40, 24, 3.2, -0.08], [46, 36, 3.8, 0.04], [24, 42, 3, -0.16], [36, 44, 3.4, 0.02], [18, 30, 2.6, -0.26], [52, 26, 2.4, -0.2], [28, 18, 2.4, -0.3], [44, 50, 2.6, -0.12], [56, 42, 2.6, -0.06], [14, 40, 2, -0.36]];
  for (const [x, y, r, k] of eggs) {
    o.push(E(x + 0.6, y + 0.8 + by, r * 1.2, r * 1.05, SK, { ink: -0.18 })); // the skin stretched over it
    o.push(E(x, y + by, r, r * 0.88, EG, { ink: -0.34 + k + pu }));
    o.push(E(x - r * 0.3, y - r * 0.3 + by, r * 0.4, r * 0.34, EG, { ink: 0.1 + k + pu }));
  }
  o.push(Lt(36, 36 + by, 66, '#b8d050', 0.9 + pu * 1.5, 10));

  // the head end: the bark-plated shield, two hard amber eyes at its edges
  const hx = 67, hy = 61 + by;
  // far front leg, raised and reaching
  o.push(K(hx - 7, hy - 2, hx - 10, hy - 16, 2.2, 1.7, LG, { ink: -0.1 }), K(hx - 10, hy - 16, hx - 6 + s * 0.3, hy - 30, 1.7, 1, LG, { ink: -0.12 }));
  o.push(K(hx - 6 + s * 0.3, hy - 30, hx - 2 + s * 0.3, hy - 33, 0.9, 0.4, LG), K(hx - 6 + s * 0.3, hy - 30, hx - 9 + s * 0.3, hy - 34, 0.8, 0.3, LG));
  o.push(E(hx - 10, hy - 16, 2.1, 2, LG, { ink: -0.04 }));
  // the near legs, splayed out and gripping the bough
  for (const [x0, y0, x1, y1, x2, y2] of [[hx + 6, hy + 8, hx + 18, hy + 12, hx + 24, 79], [hx + 2, hy + 11, hx + 8, hy + 20, hx + 6, 84], [hx - 5, hy + 10, hx - 10, hy + 18, hx - 14, 85]]) {
    o.push(K(x0, y0, x1, y1, 2.2, 1.8, LG, { ink: -0.06 }), E(x1, y1, 2, 1.9, LG, { ink: 0.02 }), K(x1, y1, x2, y2, 1.8, 0.7, LG, { ink: -0.1 }));
    o.push(K(x2, y2, x2 + 1.6, y2 + 1.6, 0.6, 0.25, LG), K(x2, y2, x2 - 1.6, y2 + 1.6, 0.6, 0.25, LG));
  }
  o.push(P([hx - 13, hy - 3, hx - 9, hy - 9, hx, hy - 11, hx + 9, hy - 9, hx + 13, hy - 3, hx + 12, hy + 6, hx + 6, hy + 11, hx - 6, hy + 11, hx - 12, hy + 6], PL, { bv: 3.4, n: [0, -0.3, 1] }));
  o.push(K(hx - 10, hy - 6, hx - 1, hy - 9.6, 0.6, 0.6, PL, { ink: 0.24, occ: false }), K(hx - 1, hy - 9.6, hx + 8, hy - 8, 0.6, 0.5, PL, { ink: 0.16, occ: false }));
  for (const [x0, y0, x1, y1] of [[-6, -6, -4, 6], [5, -6, 4, 6]]) o.push(K(hx + x0, hy + y0, hx + x1, hy + y1, 0.5, 0.5, HO, { occ: false, ink: -0.1 })); // its grooves
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 10.4, ey = hy - 1.6;
    o.push(E(ex, ey, 2.4, 2, HO));
    o.push(E(ex, ey + 0.2, 1.7, 1.4, 'eyeAmber', { ink: -0.2 }));
    o.push(X(ex - 0.8, ey - 0.6, 0.8, 0.8, '#fff4dc', { em: true }));
  }
  // the mouthparts: the base, two spread palps, and the barbed beak between them, dripping
  o.push(P([hx - 6, hy + 9, hx + 6, hy + 9, hx + 5, hy + 15, hx - 5, hy + 15], PL, { bv: 1.6, ink: -0.08 }));
  for (const sd of [-1, 1]) {
    const x = (v: number): number => hx + sd * v;
    o.push(K(x(4.4), hy + 13, x(8.6), hy + 18, 2, 2.4, PL, { ink: sd < 0 ? 0 : -0.1 }), K(x(8.6), hy + 18, x(8), hy + 25, 2.4, 1.6, PL, { ink: sd < 0 ? 0.04 : -0.08 }));
    o.push(K(x(8), hy + 25, x(6.6), hy + 27.6, 1.4, 0.5, PL, { ink: -0.04 }));
  }
  o.push(P([hx - 2.4, hy + 14, hx + 2.4, hy + 14, hx + 1.2, hy + 27, hx, hy + 30, hx - 1.2, hy + 27], BK, { bv: 1 }));
  for (let i = 0; i < 5; i++) {
    const y = hy + 16 + i * 2.4, w = 2.4 - i * 0.3;
    for (const sd of [-1, 1]) o.push(P([hx + sd * (w - 0.6), y, hx + sd * (w + 1.2), y - 1.4, hx + sd * (w - 0.2), y + 1.2], BK, { ink: 0.06 }));
  }
  const dr = [0, 0.8, 1.6, 2.4][f % 4];
  o.push(E(hx, hy + 30.6 + dr * 0.3, 1, 1.2 + dr * 0.25, 'scr_sapWeeperAmber', { ink: -0.1 }));
  // near front leg, raised high, questing for you
  o.push(K(hx + 10, hy - 1, hx + 20, hy - 14, 2.4, 1.9, LG, { ink: 0.02 }), E(hx + 20, hy - 14, 2.3, 2.2, LG, { ink: 0.06 }));
  o.push(K(hx + 20, hy - 14, hx + 24 + s * 0.4, hy - 32, 1.9, 1.1, LG, { ink: 0 }));
  o.push(K(hx + 24 + s * 0.4, hy - 32, hx + 27 + s * 0.4, hy - 35, 1, 0.4, LG), K(hx + 24 + s * 0.4, hy - 32, hx + 21 + s * 0.4, hy - 36, 0.9, 0.3, LG));
  return o;
}
