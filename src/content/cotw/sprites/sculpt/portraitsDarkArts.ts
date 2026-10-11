import { E, K, P, X, Lt, T, breath, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9e, group C: the men of the dark arts. The Dark Sorcerer and the Sól-Brand Zealot. Conventions: portraitKit.ts. */

/** Zig-zag points from (x1, y1) to (x2, y2): n steps, amplitude amp. */
function zig(x1: number, y1: number, x2: number, y2: number, seed: number, n: number, amp: number): Pt[] {
  const pts: Pt[] = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i <= n; i++) {
    const t = i / n, sd = i % 2 ? 1 : -1;
    const j = i === n ? 0 : sd * amp * (0.45 + hash2(seed, i) * 0.8);
    pts.push([x1 + dx * t + nx * j, y1 + dy * t + ny * j]);
  }
  return pts;
}

/** A chain of capsules through pts, tapering r0 -> r1. */
function arc(pts: Pt[], r0: number, r1: number, m: string, op: PrimOptions = {}): Prim[] {
  const out: Prim[] = [], n = pts.length - 1;
  for (let i = 1; i <= n; i++) out.push(K(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r0 + (r1 - r0) * ((i - 1) / n), r0 + (r1 - r0) * (i / n), m, { occ: false, ...op }));
  return out;
}

// ============================================================== DARK SORCERER
/**
 * A seiðmaðr of the deep veins, the kind the sagas stoned or drowned: the hood's dark
 * swallows his face, two cold eyes burning in it; only the side the lightning reaches
 * shows, a hooked nose, a gaunt cheek, a sneer. The lightning crawls up out of his
 * clawed hand; in the other a hellfire waits.
 */
export function darkSorcererPortrait(f: number): PrimTree {
  const b = breath(f);
  const g = [1, 0.82, 1.2, 0.92][f % 4];
  const fl = [1, 1.12, 0.9, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gSorcerer', VN = 'scr_gSorcererVein';
  const RB = 'scr_sorcererRobe', TR = 'scr_sorcererTrim', VD = 'scr_sorcererVoid', SK = 'scr_sorcererSkin', EY = 'scr_sorcererEye', BT = 'scr_sorcererBolt';
  const lx = 79, ly = 42; // the lightning's heart, over his palm
  const SH = 'scr_sorcererShade', EG = 'scr_sorcererEyeGlow';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(44, 40, 64, 60, BG, { fl: 1, ink: BAND[2] }));
  // veins of tarnished silver in the rock, thin and dull
  for (const [ax, ay, cx, cy, ex, ey, r] of [[-2, 30, 8, 18, 22, 8, 1.3], [8, 18, 4, 10, 6, -1, 0.8], [62, -2, 76, 8, 98, 6, 1.2], [-2, 70, 6, 60, 13, 54, 1]]) {
    o.push(strand(ax, ay, cx, cy, ex, ey, r, Math.max(0.5, r * 0.5), VN, 4, { fl: 1, ink: BAND[1] }));
  }
  // the lightning's halo: the rock lit pale round it
  o.push(E(lx, ly - 2, 20, 24, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(lx - 1, ly - 3, 10, 15, BG, { fl: 1, ink: BAND[3] }));

  const by = -b * 0.5;
  // the robe's shoulders under the hood's mantle
  o.push(P([-2, 97, -2, 80, 10, 70, 24, 64, 40, 61 + by, 62, 61 + by, 76, 65, 90, 72, 98, 78, 98, 97], RB, { bv: 5, n: [0, -0.12, 1], ink: -0.5 }));
  for (const [ax, ay, cx, cy, ex, ey] of [[26, 66, 22, 82, 18, 97], [34, 68, 35, 84, 32, 97], [68, 68, 70, 84, 72, 97]]) o.push(strand(ax, ay, cx, cy, ex, ey, 0.8, 1.6, RB, 3, { ink: -0.64 }));
  // the robe's silver-edged front
  o.push(strand(54, 64 + by, 52, 80, 53, 97, 1.1, 1.2, TR, 3, { ink: -0.3 }));
  const hx = 44, hy = 40 + by;
  // the hood's peak, falling back
  o.push(P([hx - 6, hy - 23, hx - 20, hy - 21, hx - 31, hy - 15, hx - 40, hy - 8, hx - 32, hy - 4, hx - 22, hy + 10], RB, { bv: 3, ink: -0.62 }));
  o.push(K(hx - 20, hy - 15, hx - 36, hy - 8, 0.6, 0.4, RB, { ink: -0.72, occ: false }));
  // the cowl, and the dark inside it
  o.push(E(hx, hy, 22, 25, RB, { fl: 0.15, ink: -0.5 }));
  o.push(E(hx + 6, hy + 4, 13, 17, VD, { fl: 1, ink: BAND[1] }));
  // the face in the dark: a gaunt shape a shade off the black, the eyes' own light on it
  o.push(E(hx + 9.4, hy + 8.6, 8.4, 13, VD, { fl: 1, ink: BAND[2] }));
  o.push(E(hx + 10.6, hy + 12, 6.4, 9.6, SH, { fl: 1, ink: BAND[1] }));
  // where the lightning reaches: the far cheekbone and hollow, the hooked nose, the lip, the jaw
  o.push(E(hx + 15.4, hy + 7.4, 2, 4.4, SK, { a: 0.18, ink: -0.34 })); // the cheekbone
  o.push(E(hx + 14.6, hy + 15.4, 1.6, 4, SK, { a: 0.62, ink: -0.38 })); // the jaw's edge
  o.push(E(hx + 11.6, hy + 19.4, 2.4, 1.9, SK, { ink: -0.36 })); // the chin
  o.push(K(hx + 10.2, hy + 4.6, hx + 11.8, hy + 9.2, 0.8, 1.3, SK, { ink: -0.34 })); // the hooked nose
  o.push(E(hx + 11.8, hy + 9.6, 1.6, 1.3, SK, { ink: -0.3 }));
  o.push(X(hx + 10.6, hy + 10.4, 1.2, 0.8, 'scr_sorcererMouth:1'));
  // the eyes: slits of cold light, slanting to the nose
  const ep = (g - 1) * 0.3;
  o.push(E(hx + 4.2, hy + 3, 3.6, 2, EG, { a: 0.3, fl: 1, ink: BAND[2] }), E(hx + 13.6, hy + 2.8, 2.6, 1.7, EG, { a: -0.3, fl: 1, ink: BAND[2] }));
  o.push(E(hx + 4.2, hy + 3, 2.3, 1, EY, { a: 0.3, ink: ep }));
  o.push(E(hx + 13.6, hy + 2.8, 1.6, 0.85, EY, { a: -0.3, ink: ep }));
  o.push(X(hx + 3.7, hy + 2.4, 1, 0.8, '#eef6ff', { em: true }), X(hx + 13.4, hy + 2.3, 0.7, 0.7, '#eef6ff', { em: true }));
  // a thin mouth in a sneer, the near corner lifting
  o.push(K(hx + 7.6, hy + 14, hx + 12.4, hy + 13.6, 0.5, 0.45, 'scr_sorcererMouth'), K(hx + 12.4, hy + 13.6, hx + 15.2, hy + 12, 0.45, 0.4, 'scr_sorcererMouth'));
  o.push(K(hx + 10, hy + 15.2, hx + 14, hy + 14.4, 0.55, 0.45, SK, { ink: -0.32 }));
  // the jaw: shaven, gaunt, a pointed chin catching the light from below
  o.push(K(hx + 9.8, hy + 18.8, hx + 13.2, hy + 18.2, 0.5, 0.4, SH, { fl: 1, ink: BAND[1], occ: false }));
  // the near rim of the hood, silver-edged, and the far rim, lit
  o.push(strand(hx + 15, hy - 16, hx - 9, hy - 17, hx - 8, hy + 22, 3, 3.6, RB, 6, { ink: -0.42 }));
  o.push(strand(hx + 15, hy - 13.4, hx - 5.4, hy - 14.4, hx - 4.6, hy + 21, 0.6, 0.7, TR, 6, { ink: -0.16 }));
  o.push(strand(hx + 16, hy - 13, hx + 21.6, hy, hx + 19.6, hy + 22, 1.8, 2.8, RB, 4, { ink: -0.2 }));

  // the hellfire in the low hand
  o.push(K(-2, 99, 12, 86, 9, 7, RB, { ink: -0.3 }));
  o.push(E(14.6, 84.6, 6.2, 3.4, RB, { a: -0.6, ink: -0.16 }));
  o.push(E(18.4, 81, 4.4, 2.8, SK, { ink: -0.18, a: -0.2 }));
  for (const [x0, y0, x1, y1] of [[15.6, 80, 14.4, 76.6], [18.2, 79, 17.6, 75.4], [20.8, 79.2, 21.4, 75.8], [22.4, 80.6, 24.6, 78]]) o.push(K(x0, y0, x1, y1, 1, 0.75, SK, { ink: -0.16 }), K(x1, y1, x1 + (x1 - x0) * 0.5, y1 - 1, 0.6, 0.35, 'scr_sorcererNail'));
  const fh = [0, 1.2, -0.8, 0.6][f % 4];
  o.push(P([16, 75, 17.2, 69, 18.4 + fh * 0.4, 63 - fh, 20.6, 68.4, 22.4, 74.6, 19.4, 77.4], 'emFire', { bv: 1.2 }));
  o.push(E(19.4, 74.2, 2.2, 2.6, 'emFireCore', { ink: -0.1 }));
  o.push(X(18.6 + fh * 0.6, 60 - f * 1.4, 1, 1, 'emFire:4', { em: true }));
  o.push(Lt(19, 72, 22, '#ff8a2c', 0.6 * fl, 6));

  // the clawed hand, palm up, the lightning crawling out of it
  o.push(K(98, 99, 82.6, 70, 10, 7, RB, { ink: -0.2 }));
  o.push(E(80.6, 67, 6.4, 3.4, RB, { a: -0.5, ink: -0.06 }));
  o.push(E(80.4, 66.8, 4.2, 1.9, VD, { a: -0.5, fl: 1, ink: BAND[1] }));
  o.push(K(80, 66.6, 78, 61, 2.4, 2.4, SK, { ink: -0.14 }));
  o.push(E(77.4, 58.6, 4.6, 3.4, SK, { a: -0.1, ink: -0.06 }));
  const fingers = [[73.4, 57, 70.6, 52, 71.4, 47.6], [75.8, 56, 74.6, 50, 76, 45.6], [78.8, 56, 80, 50.4, 82.2, 47.2], [81, 58.4, 84.2, 54.4, 86.6, 52.6]];
  for (const [x0, y0, x1, y1, x2, y2] of fingers) {
    o.push(K(x0, y0, x1, y1, 1.3, 1.1, SK, { ink: -0.06 }), K(x1, y1, x2, y2, 1.05, 0.8, SK, { ink: -0.06 }));
    o.push(E(x1, y1, 1.35, 1.25, SK));
    o.push(K(x2, y2, x2 + (x2 - x1) * 0.45, y2 + (y2 - y1) * 0.45, 0.7, 0.2, 'scr_sorcererNail'));
  }
  o.push(K(73.6, 61, 69.6, 59.6, 1.4, 1.1, SK), K(69.6, 59.6, 68.4, 56.4, 1.1, 0.8, SK));
  // the bolt: a jagged stroke rising out of the palm, forking, and sparks off the claws
  const sd = f * 7 + 3;
  const main = zig(77.4, 55, 80, 22, sd, 6, 2.6);
  o.push(arc(main, 1.9 * g, 0.6, BT), arc(main.slice(0, 5), 0.8 * g, 0.4, 'scr_sorcererBoltCore'));
  o.push(arc(zig(78, 44, 89, 31, sd + 11, 3, 1.6), 0.8, 0.35, BT));
  o.push(arc(zig(78.6, 36, 69, 27, sd + 23, 3, 1.4), 0.7, 0.3, BT));
  for (const [x0, y0, x1, y1, k] of [[71.6, 46, 76.6, 48, 31], [82.6, 46.4, 78.4, 48.4, 37], [86.8, 51.6, 90, 46, 41]]) o.push(arc(zig(x0, y0, x1, y1, sd + k, 2, 1), 0.55, 0.5, BT));
  o.push(E(77.6, 54, 2.2 * g, 1.6 * g, 'scr_sorcererBoltCore'));
  for (let i = 0; i < 3; i++) { const a = f * 1.9 + i * 2.1; o.push(X(lx + Math.cos(a) * 12 - 0.5, ly + Math.sin(a) * 10 - 0.5, 1, 1, i ? '#fff8c0' : '#ffffff', { em: true })); }
  o.push(Lt(lx - 3, ly + 6, 60, '#fff27a', 1.2 * g, 9));
  return o;
}

// ============================================================ SÓL-BRAND ZEALOT
/**
 * A sun-zealot of the Obsidian Siphon: the cowl thrown back off a shaved, burn-scarred
 * head, the robe torn open on Sól's disc seared into his breast and still white-hot.
 * He bears the stolen sun on an iron rod, a coal of the chariot's fire in a ring of
 * black spikes, and roars his sermon at you.
 */
export function solBrandZealotPortrait(f: number): PrimTree {
  const b = breath(f);
  const p = [1, 1.1, 0.9, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gZealot', GL = 'scr_gZealotGlass', HL = 'scr_haloZealot';
  const SK = 'scr_zealotSkin', RB = 'scr_zealotRobe', CH = 'scr_zealotChar', SC = 'scr_zealotScar', IR = 'scr_zealotIron', BR = 'scr_zealotBrow', BN = 'scr_zealotBrand';
  const sx = 19, sy = 19; // the stolen sun on its rod
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(40, 36, 70, 64, BG, { fl: 1, ink: BAND[2] }));
  // shards of black glass standing in the dark, a facet of each catching the fire
  o.push(P([60, -1, 76, -1, 71, 30, 64, 42], GL, { ink: BAND[1] }), P([66, -1, 76, -1, 71, 30], GL, { ink: BAND[2] }));
  o.push(P([82, -1, 98, -1, 98, 62, 90, 54, 80, 26], GL, { ink: BAND[1] }), P([86, -1, 98, -1, 98, 44, 90, 34], GL, { ink: BAND[2] }));
  // the sun's halo
  o.push(E(sx, sy, 28, 27, HL, { fl: 1, ink: BAND[1] }));
  o.push(E(sx, sy, 18, 17.4, HL, { fl: 1, ink: BAND[2] }));
  o.push(E(sx, sy, 12, 11.6, HL, { fl: 1, ink: BAND[3] }));
  // embers and ash rising
  for (let i = 0; i < 9; i++) {
    const y = (hash2(i, 41) * 96 - f * 2.4 * (1 + (i % 2)) + 192) % 96, x = 4 + hash2(i, 43) * 88 + Math.sin(y * 0.2 + i) * 1.4;
    o.push(X(x, y, 1, 1, i % 3 ? BG + ':4' : 'emFire:3', { em: true }));
  }

  const by = -b * 0.5;
  const hx = 55, hy = 38 + by; // the head
  // the robe's shoulders
  o.push(P([-2, 97, -2, 82, 14, 73, 32, 68, 46, 67 + by, 62, 67 + by, 78, 70, 90, 76, 98, 81, 98, 97], RB, { bv: 5, n: [0, -0.12, 1], ink: -0.08 }));
  for (const [ax, ay, cx, cy, ex, ey] of [[28, 72, 24, 84, 22, 97], [76, 74, 80, 86, 82, 97]]) o.push(strand(ax, ay + by, cx, cy, ex, ey, 0.7, 1.4, RB, 3, { ink: -0.34 }));
  // the neck, its cords standing out
  o.push(K(hx - 3.5, hy + 17, hx - 4.5, hy + 30, 5.8, 7.2, SK, { ink: -0.22 }));
  o.push(K(hx - 8.6, hy + 14, hx - 2.6, hy + 30, 1.1, 1.3, SK, { ink: -0.02 }));
  o.push(E(hx - 0.2, hy + 22, 1.4, 1.8, SK, { ink: -0.04 }));
  // the cowl thrown back: a heavy roll of linen behind the neck
  o.push(E(50, 69 + by, 25, 8, RB, { fl: 0.3, ink: -0.12 }));
  o.push(strand(30, 68 + by, 40, 74, 46, 73 + by, 0.7, 1, RB, 3, { ink: -0.36 }), strand(60, 73 + by, 68, 73, 74, 68 + by, 1, 0.7, RB, 3, { ink: -0.36 }));
  // the breast, bared where the robe is torn open, its edges charred
  o.push(P([43, 73 + by, 63, 73 + by, 58, 97, 48, 97], SK, { bv: 3, ink: -0.1 }));
  o.push(strand(43, 73 + by, 45.6, 85, 48, 97, 1.6, 1.3, CH, 4), strand(63, 73 + by, 60.6, 85, 58, 97, 1.6, 1.3, CH, 4));
  for (const [x, y, k] of [[44.4, 78, 0], [46.8, 91, 1], [61.8, 79, 2], [59.4, 92, 3]]) o.push(X(x - 0.5, y - 0.5, 1, 1, (k + f) % 3 ? 'emFire:3' : 'emFire:5', { em: true }));
  // Sól's disc, seared into him, still white-hot
  const bx = 53, bry = 86 + by * 0.6;
  o.push(P([bx - 7.4, bry - 1, bx - 5, bry - 5.6, bx - 0.6, bry - 6.8, bx + 4.6, bry - 6, bx + 7.6, bry - 2, bx + 7, bry + 3.4, bx + 3.4, bry + 6.6, bx - 2, bry + 6.8, bx - 6.4, bry + 3.6], 'scr_zealotBlister', { bv: 2.4, ink: -0.16 }));
  o.push(E(bx, bry, 5.6, 5, SC, { fl: 0.6, ink: -0.3 })); // the scorched ring round it
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.1, ca = Math.cos(a), sa = Math.sin(a), l = 5.6 + hash2(i, 17) * 1.4;
    o.push(K(bx + ca * 3.6, bry + sa * 3.3, bx + ca * l, bry + sa * l * 0.9, 0.55, 0.35, BN, { ink: -0.12 + (p - 1) * 0.4 }));
  }
  o.push(E(bx, bry, 3, 2.8, BN, { ink: (p - 1) * 0.4 }));
  o.push(Lt(bx, bry - 3, 30, '#ffc896', 0.6 * p, 6));

  // the head, a little larger than life
  const h: Out = [];
  h.push(E(hx - 1.6, hy - 4.6, 13.2, 14.4, SK, { fl: 0.12 })); // the shaved skull
  h.push(E(hx + 0.6, hy + 9, 11, 12.2, SK, { fl: 0.18 })); // the face, the jaw dropped
  h.push(E(hx + 4.2, hy + 19.6, 5.2, 4.2, SK, { fl: 0.22 })); // the chin
  h.push(E(hx - 8, hy - 12.4, 4.2, 2.4, SK, { fl: 0.7, ink: 0.16, a: -0.7 })); // the fire on the pate
  // an old burn across the crown, healed ridged and shiny
  h.push(P([hx - 9, hy - 9, hx - 6, hy - 14, hx - 1, hy - 16.4, hx + 1, hy - 15.4, hx - 4, hy - 12.6, hx - 7.4, hy - 7.6], SC, { bv: 1, ink: -0.12 }));
  h.push(K(hx - 7.6, hy - 10, hx - 1.6, hy - 15.4, 0.35, 0.3, SC, { ink: 0.12, occ: false }));
  // the ear
  h.push(E(hx - 11.6, hy + 2.6, 2.4, 4, SK, { ink: -0.04 }), K(hx - 11.2, hy + 0.8, hx - 11.8, hy + 4.4, 0.5, 0.5, SK, { ink: -0.4, occ: false }));
  // a hard cheekbone over a hollow cheek
  h.push(E(hx - 2.8, hy + 4.4, 4.6, 2, SK, { fl: 0.35, ink: 0.06, a: -0.2 }));
  // the brow ridge, heavy, and the brows dragged down on it in fury
  h.push(K(hx - 8.6, hy - 4, hx + 9.6, hy - 3.4, 2.2, 1.8, SK, { ink: 0.02 }));
  h.push(K(hx - 9, hy - 6.6, hx + 1.8, hy - 2.2, 1.7, 1.2, BR));
  h.push(K(hx + 4.6, hy - 2.4, hx + 10, hy - 5.4, 1.3, 0.9, BR));
  h.push(K(hx + 2.8, hy - 4.6, hx + 3.2, hy - 9, 0.55, 0.5, SK, { fl: 1, ink: -0.62, occ: false }), K(hx + 1.2, hy - 4.8, hx + 0.8, hy - 8, 0.5, 0.5, SK, { fl: 1, ink: -0.56, occ: false }));
  // the eyes: wide, the white all round the iris, fixed on you
  for (const [ex, ey, w] of [[hx - 3.2, hy + 0.6, 2.5], [hx + 7.2, hy + 0.4, 1.8]]) {
    h.push(E(ex, ey - 0.3, w * 1.36, w * 0.92, SK, { fl: 0.85, ink: -0.26 }));
    h.push(E(ex + 0.1, ey, w * 1.12, w * 0.76, 'scr_zealotWhite', { fl: 1, ink: 0 }));
    h.push(E(ex, ey + 0.05, w * 0.4, w * 0.4, 'scr_zealotIris'));
    h.push(X(ex - 0.3, ey - 0.25, 0.6, 0.6, '#120c0a'));
    h.push(X(ex - w * 0.3, ey - w * 0.3, 0.7, 0.7, '#fff0dc', { em: true }));
    h.push(K(ex - w * 1.1, ey - w * 0.5, ex + w * 1.05, ey - w * 0.62, 0.52, 0.46, BR, { occ: false })); // the upper lid, a hard line
  }
  // the nose, broad, the nostrils flared
  h.push(K(hx + 2.8, hy - 1, hx + 8, hy + 6.4, 1.5, 2.1, SK));
  h.push(E(hx + 8.4, hy + 7, 2.4, 2, SK));
  h.push(E(hx + 5.6, hy + 7.8, 1.8, 1.4, SK, { ink: -0.06 }));
  h.push(X(hx + 6.4, hy + 8.4, 1.3, 0.8, SK + ':1'));
  // the folds from nose to mouth, cut deep by the shout
  h.push(strand(hx + 3.4, hy + 8.4, hx - 0.6, hy + 10.6, hx - 2, hy + 15, 0.6, 0.45, SK, 3, { fl: 1, ink: -0.6, occ: false }));
  // the mouth, open on the sermon: teeth bared above, the tongue below
  h.push(P([hx - 1.4, hy + 13.2, hx + 2, hy + 12.2, hx + 6.6, hy + 12.2, hx + 9.4, hy + 13.4, hx + 8.6, hy + 17, hx + 5.4, hy + 19, hx + 1.4, hy + 18.6, hx - 0.8, hy + 16.4], 'scr_zealotMouth'));
  h.push(P([hx - 0.6, hy + 13.2, hx + 2, hy + 12.6, hx + 6.6, hy + 12.6, hx + 8.8, hy + 13.6, hx + 8.4, hy + 14.8, hx + 6.4, hy + 14.4, hx + 2, hy + 14.6, hx - 0.2, hy + 15.2], 'scr_zealotTooth', { bv: 0.5 }));
  h.push(E(hx + 4, hy + 17.6, 3, 1.3, 'scr_zealotTongue', { fl: 0.4 }));
  h.push(P([hx + 1.2, hy + 18.6, hx + 2, hy + 16.8, hx + 2.8, hy + 18.6], 'scr_zealotTooth', { ink: -0.1 }), P([hx + 6.2, hy + 18.4, hx + 6.9, hy + 16.4, hx + 7.6, hy + 18], 'scr_zealotTooth', { ink: -0.1 }));
  h.push(K(hx - 1.6, hy + 13, hx + 9.6, hy + 12.8, 0.7, 0.55, SK)); // the upper lip, stretched
  h.push(strand(hx - 0.6, hy + 17, hx + 4, hy + 20.8, hx + 8.8, hy + 17.2, 0.85, 0.75, SK, 3, { ink: 0.06 })); // the lower lip
  h.push(K(hx + 1, hy + 21.8, hx + 7, hy + 21.2, 0.5, 0.45, SK, { ink: -0.2, occ: false }));
  o.push(T(h, { px: hx, py: hy + 22, s: 1.1 }));

  // the near arm, the fist on the rod
  o.push(K(-2, 99, 12, 84, 10, 7.6, RB, { ink: -0.1 }));
  o.push(E(14, 81.6, 6.8, 4, RB, { a: -0.7, ink: 0.02 }));
  o.push(strand(9, 85, 14, 80, 19, 77.4, 0.8, 0.8, CH, 3));
  o.push(K(sx + 1.6, 99, sx, sy + 8, 1.5, 1.3, IR));
  o.push(E(sx - 0.6, 75.6, 4.8, 5.4, SK, { a: -0.2 }));
  for (let i = 0; i < 4; i++) o.push(K(sx - 3.6, 71.6 + i * 2.5, sx + 3.6, 72.4 + i * 2.6, 1.25, 1.15, SK, { ink: i % 2 ? -0.04 : 0.04 }));
  o.push(K(sx - 3.4, 71, sx + 1.6, 70, 1.3, 1.1, SK, { ink: 0.08 }));
  // the stolen sun: a coal of the chariot's fire in a ring of black spikes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, ca = Math.cos(a), sa = Math.sin(a), na = -sa, nb = ca;
    o.push(P([sx + ca * 8.4 + na * 1.8, sy + sa * 8.4 + nb * 1.8, sx + ca * 15, sy + sa * 15, sx + ca * 8.4 - na * 1.8, sy + sa * 8.4 - nb * 1.8], IR, { bv: 0.8 }));
  }
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    o.push(K(sx + Math.cos(a0) * 8.2, sy + Math.sin(a0) * 8.2, sx + Math.cos(a1) * 8.2, sy + Math.sin(a1) * 8.2, 1.4, 1.4, IR));
  }
  o.push(E(sx, sy, 6.8, 6.8, 'emFire', { fl: 0.3 }));
  o.push(E(sx - 0.6, sy - 0.6, 4.6 * p, 4.6 * p, 'scr_zealotSun', { fl: 0.4 }));
  const fk = [0, 1, -1, 0.5][f % 4];
  o.push(P([sx - 4, sy - 5, sx - 2 + fk, sy - 13, sx - 0.6, sy - 8, sx + 1.4 - fk * 0.5, sy - 16, sx + 3.4, sy - 7, sx + 4.6, sy - 4], 'emFire', { bv: 1 }));
  o.push(Lt(sx, sy, 96, '#ff9a4c', 1.05 * p, 16));
  return o;
}
