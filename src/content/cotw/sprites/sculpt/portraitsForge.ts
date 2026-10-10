import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9c, group B: Gunther the Smith, Thrain the Rune-Smith and Ivalda, the Last Forge-Keeper. Conventions: portraitKit.ts. */

const NO: PrimOptions = { occ: false };
const no = (o: PrimOptions = {}): PrimOptions => ({ occ: false, ...o });

interface EyeOptions {
  socket?: number;
  look?: number;
  gs?: number;
  gy?: number;
  lid?: number;
}

/**
 * An eye seen in three-quarter: the socket's shadow, the iris, a glint; shut when blink.
 * o2.lid lifts the lower lid over the iris (a smile), o2.socket sets the socket's depth,
 * o2.look drops the gaze, o2.gs / o2.gy size and place the glint (gy in eye units).
 */
function eye(x: number, y: number, k: number, skin: string, dark: string, glint: string, blink: boolean, o2: EyeOptions = {}): Prim[] {
  const out: Prim[] = [E(x, y, 2.9 * k, 2 * k, skin, no({ fl: 0.8, ink: o2.socket ?? -0.42 }))];
  if (blink) out.push(K(x - 2.1 * k, y + 0.3, x + 2.1 * k, y + 0.4, 0.55 * k, 0.5 * k, skin, no({ ink: -0.12 })));
  else {
    const ly = (o2.look || 0) * k;
    out.push(E(x + 0.35 * k, y + 0.2 + ly, 1.25 * k, 1.2 * k, dark, NO));
    const gs = o2.gs ?? 0.75, gy = (o2.gy ?? -0.6) * k;
    out.push(X(x + 0.05 * k, y + gy + ly, gs, gs, glint, { em: true }));
    if (o2.lid) out.push(K(x - 2.4 * k, y + 1.5 * k, x + 2.2 * k, y + 1.1 * k, 0.75 * k, 0.6 * k, skin, no({ ink: o2.lid })));
  }
  return out;
}

/**
 * A three-strand braid from (x0, y0) to (x1, y1), w its half-width: a shadowed core, and
 * over it the strands crossing in a herringbone, slanted and overlapping like rope.
 */
function braid(x0: number, y0: number, x1: number, y1: number, w: number, m: string, ink: number, sw = 0, inkT = 0): Prim[] {
  const out: Prim[] = [];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const a = Math.atan2(dy, dx) - Math.PI / 2, n = Math.max(3, Math.round(L / (w * 0.95)));
  const at = (t: number): Pt => [x0 + dx * t + sw * t * t, y0 + dy * t];
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = at(i / 3), [bx, by] = at((i + 1) / 3);
    out.push(K(ax, ay, bx, by, w * (0.86 - i * 0.08), w * (0.78 - i * 0.08), m, { fl: 0.4, ink: ink - 0.3 + inkT * (i / 3) }));
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.25) / n, ww = w * (1 - t * 0.24), ik = ink + inkT * t, [x, y] = at(t);
    const h = ww * 0.42;
    out.push(E(x - nx * ww * 0.34, y - ny * ww * 0.34, ww * 0.74, ww * 0.38, m, { a: a + 0.75, fl: 0.55, ink: ik + 0.06 }));
    out.push(E(x + nx * ww * 0.34 + ux * h, y + ny * ww * 0.34 + uy * h, ww * 0.74, ww * 0.38, m, { a: a - 0.75, fl: 0.55, ink: ik - 0.05 }));
  }
  return out;
}

/**
 * A thick braid read at 96 px: one rounded rope of hair, tapering, and over it the
 * crossings cut as dark grooves (material gm) slanting in turn from either edge, a zigzag down its length.
 */
function plait(x0: number, y0: number, x1: number, y1: number, w: number, m: string, ink: number, sw = 0, gm = m, gap = 2.1): Prim[] {
  const out: Prim[] = [];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const at = (t: number): Pt => [x0 + dx * t + sw * t * t, y0 + dy * t];
  const wd = (t: number) => w * (1 - t * 0.22);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = at(i / 4), [bx, by] = at((i + 1) / 4);
    out.push(K(ax, ay, bx, by, wd(i / 4), wd((i + 1) / 4), m, { fl: 0.3, ink }));
  }
  const n = Math.round(L / (w * gap * 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n, [x, y] = at(t), ww = wd(t), sd = i % 2 ? 1 : -1, h = w * gap * 0.32;
    out.push(K(x + nx * sd * ww * 0.9, y + ny * sd * ww * 0.9, x - nx * sd * ww * 0.15 + ux * h, y - ny * sd * ww * 0.15 + uy * h, 0.6, 0.48, gm, no({ ink })));
  }
  return out;
}

/** Scale a list of prims in place about (cx, cy) by k: a head drawn at its own size, grown to fill the frame. */
function grow(list: Out, cx: number, cy: number, k: number): Out {
  const sx = (v: number) => cx + (v - cx) * k, sy = (v: number) => cy + (v - cy) * k;
  const walk = (q: PrimTree[number]): void => {
    if (!q) return;
    if (!('t' in q)) { for (const r of q) walk(r); return; }
    if (q.t === 'E') { q.cx = sx(q.cx); q.cy = sy(q.cy); q.rx *= k; q.ry *= k; }
    else if (q.t === 'K') { q.x1 = sx(q.x1); q.y1 = sy(q.y1); q.x2 = sx(q.x2); q.y2 = sy(q.y2); q.r1 *= k; q.r2 *= k; }
    else if (q.t === 'P') { q.pts = q.pts.map((v, i) => (i % 2 ? sy(v) : sx(v))); if (q.bv) q.bv *= k; }
    else if (q.t === 'X') { q.x = sx(q.x); q.y = sy(q.y); q.w *= k; q.h *= k; }
  };
  for (const q of list) walk(q);
  return list;
}

/** A fist closed round a haft running (ux, uy) at (x, y): the back of the hand, four fingers, the thumb. */
function fist(x: number, y: number, ux: number, uy: number, k: number, m: string, side = 1, ink = 0): Prim[] {
  const nx = -uy * side, ny = ux * side, out: Prim[] = [];
  out.push(E(x - nx * 1.6 * k, y - ny * 1.6 * k, 4.4 * k, 4.8 * k, m, { fl: 0.3, ink: ink - 0.08, a: Math.atan2(uy, ux) }));
  for (let i = 0; i < 4; i++) {
    const u = (i - 1.5) * 2.35 * k, cx = x + ux * u, cy = y + uy * u;
    out.push(K(cx - nx * 3.2 * k, cy - ny * 3.2 * k, cx + nx * 2.6 * k, cy + ny * 2.6 * k, 1.25 * k, 1.15 * k, m, { ink: ink + (i % 2 ? -0.02 : 0.05) }));
    out.push(E(cx + nx * 2.6 * k, cy + ny * 2.6 * k, 1.15 * k, 1.15 * k, m, { ink: ink + 0.12 }));
  }
  out.push(K(x - ux * 4.4 * k - nx * 2.4 * k, y - uy * 4.4 * k - ny * 2.4 * k, x - ux * 3.6 * k + nx * 2 * k, y - uy * 3.6 * k + ny * 2 * k, 1.35 * k, 1.15 * k, m, { ink: ink + 0.1 }));
  return out;
}

/**
 * The town's smith, big, bald and soot-black to the elbows: a red beard with
 * one iron-ringed braid, a brow like an anvil's edge knit in a warning ("Mind
 * your guard down there"). The open forge below-right lights him ember orange;
 * his sledge stands upright in his fist like a second shoulder.
 */
export function guntherPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.1, 0.93, 1.14][f % 4];
  const o: Out = [];
  const BG = 'scr_gGunther', HG = 'scr_guntherHalo', SK = 'scr_guntherSkin', DK = 'scr_guntherDark', BR = 'scr_guntherBeard';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(42, 34, 62, 58, BG, { fl: 1, ink: BAND[2] }));
  // the smithy wall: tongs and a horseshoe hung on their rail
  const wall = { ink: BAND[1] + 0.04 };
  o.push(K(-2, 12, 30, 12, 1, 1, BG, wall));
  for (const x of [5, 14]) o.push(K(x, 12, x - 1.6, 40, 0.8, 0.7, BG, wall), K(x + 1.6, 12, x + 3, 40, 0.8, 0.7, BG, wall));
  o.push(strand(21, 16, 25, 30, 29, 16, 1.4, 1.4, BG, 4, wall));
  // the forge's glow, beside him at the right
  o.push(E(108, 62, 40, 46, HG, { fl: 1, ink: BAND[1] }));
  o.push(E(108, 62, 22, 28, HG, { fl: 1, ink: BAND[2] }));

  const by = -b * 0.5;
  // the far arm, bare and sooty, at the edge
  o.push(K(5, 82, 1, 99, 8, 7.6, SK, { ink: -0.4 }));
  o.push(K(1.6, 93, 0, 99, 7.6, 7.6, 'scr_guntherSoot', { ink: -0.24 }));
  // the bull neck, in the shadow of the jaw
  o.push(K(45, 48 + by, 46, 58 + by, 10, 11, SK, { ink: -0.36 }));
  // the barrel of him: a dark sleeveless shirt
  o.push(P([4, 99, 6, 80, 14, 70 + by, 28, 62 + by, 36, 58 + by, 56, 58 + by, 66, 62 + by, 80, 70 + by, 88, 82, 92, 99], 'scr_guntherShirt', { bv: 7, n: [0, -0.1, 1], ink: -0.08 }));
  // the leather apron, its straps up round the neck
  o.push(P([26, 76 + by, 64, 76 + by, 68, 99, 22, 99], 'scr_guntherApron', { bv: 2.4, n: [0, 0.25, 1], ink: -0.1 }));
  o.push(K(28, 77 + by, 36, 59 + by, 1.5, 1.4, 'scr_guntherStrap'), K(62, 77 + by, 56, 59 + by, 1.5, 1.4, 'scr_guntherStrap'));
  o.push(E(31, 87, 2.6, 1.1, 'scr_guntherSoot', no({ fl: 0.7, a: 0.3 })), E(56, 92, 3, 1.2, 'scr_guntherSoot', no({ fl: 0.7, a: -0.2 }))); // soot on the apron

  const fx = 47, fy = 37 + by;
  // the ear, on the far side of the skull from his face
  o.push(E(fx - 14, fy + 2, 3, 4.8, SK, { fl: 0.3, ink: -0.08 }), E(fx - 13.6, fy + 2.2, 1.4, 2.8, SK, no({ fl: 0.7, ink: -0.36 })));
  // the skull: one great bald dome, shining where the key light falls
  o.push(E(fx - 1, fy - 3, 15.4, 18, 'scr_guntherScalp', { fl: 0.14 }));
  // the jaw and cheeks, broad and square
  o.push(E(fx + 2.4, fy + 6.4, 12.4, 10.4, SK, no({ fl: 0.3 })));
  o.push(E(fx - 9.6, fy + 1, 3.6, 9, SK, no({ fl: 0.7, ink: -0.1 }))); // the turn of the temple
  for (let i = 0; i < 2; i++) o.push(K(fx - 6 + i * 0.6, fy - 13 + i * 2.4, fx + 3 - i * 1, fy - 13.6 + i * 2.4, 0.42, 0.42, SK, no({ ink: -0.2 }))); // furrows
  // the brow ridge, heavy as an anvil's edge, and the brows knit over it
  o.push(K(fx - 9, fy - 5, fx + 10.6, fy - 5.6, 2.6, 2.2, 'scr_guntherScalp', no({ ink: 0.04 })));
  o.push(P([fx - 10, fy - 7.6, fx - 4, fy - 8, fx + 0.6, fy - 5.4, fx - 0.2, fy - 3.8, fx - 5, fy - 5.6, fx - 10, fy - 5.2], 'scr_guntherBrow', { bv: 0.8 }));
  o.push(P([fx + 3.4, fy - 4.8, fx + 7, fy - 7, fx + 10.6, fy - 6.8, fx + 10.4, fy - 5.2, fx + 6.6, fy - 5.2, fx + 3.6, fy - 3.4], 'scr_guntherBrow', { bv: 0.8 }));
  o.push(K(fx + 0.8, fy - 6.2, fx + 1.6, fy - 3, 0.4, 0.35, SK, no({ ink: -0.3 }))); // the knot between them
  // the eyes, small and hard under the brow
  const bl = f === 2;
  o.push(eye(fx - 4.4, fy - 1.4, 0.95, SK, DK, '#ffe2bc', bl));
  o.push(eye(fx + 6.2, fy - 1.4, 0.78, SK, DK, '#ffe2bc', bl));
  // the cheek, the nose broad and ruddy
  o.push(E(fx - 3, fy + 4.6, 5.4, 3, SK, no({ fl: 0.5, ink: -0.04 })));
  o.push(K(fx + 2.6, fy - 3, fx + 7.6, fy + 3.4, 2, 2.8, SK, NO));
  o.push(E(fx + 7.8, fy + 4.4, 3.3, 2.7, 'scr_guntherFlush', NO));
  o.push(E(fx + 5, fy + 5.2, 1.6, 1.4, 'scr_guntherFlush', no({ ink: -0.14 }))); // the near wing of the nose
  o.push(X(fx + 7.6, fy + 6, 1.6, 0.8, DK + ':2'));
  // the red beard: full on the jaw, the mouth set hard in it
  const sw = s * 0.3;
  o.push(P([fx - 9.6, fy + 2, fx - 6, fy + 9, fx + 1, fy + 11.4, fx + 7, fy + 9.6, fx + 13, fy + 6, fx + 14.4, fy + 13, fx + 11.4, fy + 23, fx + 4 + sw, fy + 30, fx - 4 + sw, fy + 29, fx - 10.4, fy + 21, fx - 12, fy + 10], BR, { bv: 4 }));
  o.push(P([fx - 9.6, fy + 2, fx - 7, fy + 12, fx - 6, fy + 22, fx - 2 + sw, fy + 29, fx - 10.4, fy + 21, fx - 12, fy + 10], BR, no({ bv: 2, ink: -0.18 })));
  for (const [x0, x1, x2] of [[-5, -6, -4], [7, 8, 6]]) o.push(strand(fx + x0, fy + 17, fx + x1, fy + 21, fx + x2 + sw, fy + 25, 0.4, 0.3, BR, 3, no({ ink: -0.12 })));
  o.push(K(fx + 1.8, fy + 10.6, fx + 8.4, fy + 10.2, 0.5, 0.45, DK, NO));
  o.push(P([fx - 2.6, fy + 7.4, fx + 3, fy + 6.6, fx + 9, fy + 6.6, fx + 12.2, fy + 10.4, fx + 9, fy + 9.6, fx + 4, fy + 10.2, fx - 1, fy + 11.4, fx - 5, fy + 12.4], BR, { bv: 1.6, ink: 0.08 }));
  // the braid, ringed in iron
  o.push(braid(fx + 2.6, fy + 26, fx + 3.4, fy + 51, 3.4, BR, 0.02, sw * 2));
  for (const t of [0.3, 0.74]) o.push(E(fx + 2.6 + 0.8 * t + sw * 2 * t * t, fy + 26 + 25 * t, 3.4 - t, 1.6, 'blackIron', { fl: 0.4 }));
  o.push(strand(fx + 3.4 + sw * 2, fy + 52, fx + 2 + sw * 2, fy + 56, fx + 3.4 + sw * 2.4, fy + 59, 1.7, 0.6, BR, 3, { ink: -0.06 }));

  // the sledge, standing upright in his fist
  const hx0 = 76, hy0 = 99, hx1 = 80.4, hy1 = 26, hl = Math.hypot(hx1 - hx0, hy1 - hy0);
  o.push(K(hx0, hy0, hx1, hy1, 1.9, 1.7, 'woodDark'));
  o.push(P([70, 15, 90, 16.4, 91, 30, 71, 29], 'blackIron', { bv: 2.2, n: [0.1, 0, 1] }));
  o.push(P([90, 17.6, 93.6, 18.4, 93.6, 27.6, 90.6, 28.6], 'blackIron', { bv: 0.8, ink: 0.04 })); // the striking face
  o.push(K(78, 14.6, 83, 15, 1.2, 1.2, 'blackIron', { ink: 0.06 }), K(78.4, 29.6, 83, 30, 1.2, 1.2, 'blackIron', { ink: -0.08 })); // the eye's collar
  o.push(P([70, 15, 64, 18, 64, 26, 71, 29], 'blackIron', { bv: 1, ink: -0.1 })); // the peen
  // the sooty forearm and the fist on the haft
  o.push(K(92, 99, 80, 88, 7.6, 6.4, 'scr_guntherSoot', { ink: -0.1 }));
  const t0 = (84 - hy0) / (hy1 - hy0), fhx = hx0 + (hx1 - hx0) * t0;
  o.push(fist(fhx, 84, (hx1 - hx0) / hl, (hy1 - hy0) / hl, 1.2, SK, -1, -0.26));

  // embers rising off the forge
  for (let i = 0; i < 5; i++) {
    const y = 72 - ((hash2(i, 31) * 64 + f * 7) % 64), x = 90 + hash2(i, 37) * 7 - (72 - y) * 0.12 + sway(f + i) * 0.6;
    o.push(X(x, y, 0.9, 0.9, i % 2 ? 'emFire:5' : 'emFireCore:5', { em: true }));
  }
  // the open forge, beside him and out of the picture
  o.push(Lt(96, 62, 94, '#ff9a3c', 1.4 * fl, 26));
  return o;
}

/**
 * The rune-smith, a dwarf of the Völuspá's roll: short, broad, hooded in
 * leather under a brass band, his forked black beard tucked in his belt. The
 * Rune of Return lies on his anvil, its Raidho flaring blue where his hammer
 * fell; it lights him from below, and he looks up from it at you, glad of the work.
 */
export function thrainPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1.18, 0.96, 1.06, 0.9][f % 4]; // the rune flares at the strike, then settles
  const o: Out = [];
  const BG = 'scr_gThrain', HG = 'scr_thrainHalo', SK = 'scr_thrainSkin', DK = 'scr_thrainDark', BD = 'scr_thrainBeard', HD = 'scr_thrainHood';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(42, 40, 62, 62, BG, { fl: 1, ink: BAND[2] }));
  // his carving stone behind him, scored with half-cut runes of return
  o.push(P([2, 99, 0, 30, 6, 12, 16, 8, 24, 14, 26, 60, 24, 99], BG, { ink: BAND[3] - 0.08 }));
  for (const [x, y] of [[9, 22], [14, 40]]) {
    const c = { ink: BAND[1] + 0.06 };
    o.push(K(x, y, x, y + 10, 0.55, 0.55, BG, c), K(x, y, x + 3, y + 2.4, 0.5, 0.5, BG, c), K(x + 3, y + 2.4, x + 0.3, y + 4.8, 0.5, 0.5, BG, c));
  }
  // the rune's light, banded round the anvil
  const rx = 74, ry = 80;
  o.push(E(rx, ry, 34, 30, HG, { fl: 1, ink: BAND[1] }));
  o.push(E(rx, ry, 19, 16, HG, { fl: 1, ink: BAND[2] }));

  const by = -b * 0.5;
  // the rust-red tunic, the hood's leather cape over his shoulders
  o.push(P([2, 99, 6, 82, 18, 72 + by, 34, 68 + by, 54, 68 + by, 68, 74 + by, 74, 86, 76, 99], 'scr_thrainTunic', { bv: 6, n: [0, -0.1, 1] }));
  o.push(P([8, 84, 14, 72 + by, 26, 64 + by, 44, 62 + by, 60, 66 + by, 66, 76 + by, 56, 80 + by, 40, 78 + by, 24, 82 + by, 12, 90], HD, { bv: 4, n: [0, -0.2, 1] }));
  // the apron
  o.push(P([28, 82 + by, 58, 82 + by, 62, 99, 26, 99], 'scr_thrainApron', { bv: 2, n: [0, 0.2, 1] }));

  // the head, drawn at its own scale and grown to fill the frame: a dwarf's big head
  const fx = 42, fy = 37 + by, hk = 1.16, hy = fy + 6;
  const M = (x: number, y: number): Pt => [fx + (x - fx) * hk, hy + (y - hy) * hk];
  const h: Out = [];
  // the hood: a leather cowl round the head
  h.push(E(fx - 5, fy - 4, 17, 19, HD, { fl: 0.15, ink: -0.16 }));
  h.push(P([fx - 20, fy + 8, fx - 21, fy - 6, fx - 15, fy - 18, fx - 4, fy - 24, fx + 6, fy - 22, fx + 10, fy - 16, fx - 2, fy - 14, fx - 10, fy - 6, fx - 12, fy + 22, fx - 18, fy + 26], HD, { bv: 3, ink: -0.22 }));
  // the face, broad and ruddy
  h.push(E(fx + 2, fy + 1, 11.6, 13, SK, { fl: 0.2, ink: -0.12 }));
  h.push(E(fx + 3, fy + 7, 10.6, 8, SK, no({ fl: 0.25, ink: -0.12 })));
  h.push(E(fx - 6.4, fy + 1, 3.6, 10, SK, no({ fl: 0.6, ink: -0.24 }))); // the hood's shadow on it
  // the brass band round the hood's brow
  h.push(strand(fx - 13, fy - 9, fx - 2, fy - 13.6, fx + 11.6, fy - 9.6, 1.6, 1.4, 'bronze', 6, { fl: 0.3 }));
  for (const t of [0.2, 0.5, 0.8]) { const [x, y] = qpt([fx - 13, fy - 9], [fx - 2, fy - 13.6], [fx + 11.6, fy - 9.6], t); h.push(X(x - 0.5, y - 0.6, 1, 1, 'bronze:5')); }
  // brows, black and lifted: he is glad of the work
  h.push(P([fx - 8, fy - 5.4, fx - 4, fy - 7.6, fx + 0.6, fy - 6.8, fx + 0.4, fy - 5.6, fx - 4, fy - 6, fx - 7.6, fy - 4.2], BD, { bv: 0.6 }));
  h.push(P([fx + 4, fy - 6.4, fx + 7.6, fy - 7.6, fx + 10.6, fy - 6, fx + 10, fy - 5.2, fx + 7.4, fy - 6.2, fx + 4.2, fy - 5.2], BD, { bv: 0.6 }));
  // eyes, creased at the corners with smiling
  const bl = f === 3;
  h.push(eye(fx - 3.4, fy - 1.6, 0.9, SK, DK, '#d6ecff', bl, { socket: -0.3, lid: 0.04 }));
  h.push(eye(fx + 6.8, fy - 1.6, 0.72, SK, DK, '#d6ecff', bl, { socket: -0.3, lid: 0.04 }));
  h.push(K(fx - 7.2, fy - 1.2, fx - 9.2, fy - 0.2, 0.35, 0.3, SK, no({ ink: -0.24 }))); // a crow's foot
  // the heavy nose
  h.push(K(fx + 4.6, fy - 1, fx + 7.6, fy + 3, 1.7, 2.4, SK, no({ ink: -0.08 })));
  h.push(E(fx + 8, fy + 3.8, 3.4, 3, 'scr_thrainFlush', no({ ink: -0.1 })));
  h.push(X(fx + 8, fy + 5.6, 1.6, 0.8, DK + ':2'));
  // the black beard: full on the cheeks, the moustache lifting at the corners
  const sw = s * 0.3;
  h.push(P([fx - 8, fy + 3, fx - 5, fy + 9, fx + 2, fy + 10.4, fx + 8, fy + 8.6, fx + 13, fy + 6, fx + 13.6, fy + 13, fx + 10, fy + 21, fx + 2, fy + 24, fx - 6, fy + 22, fx - 10, fy + 14], BD, { bv: 3.6, ink: -0.24 }));
  h.push(K(fx + 2.6, fy + 10.6, fx + 8.6, fy + 10.2, 0.5, 0.45, DK, NO)); // the mouth, under it
  h.push(K(fx + 8.6, fy + 10.2, fx + 9.6, fy + 9.4, 0.4, 0.35, DK, NO)); // turned up
  h.push(P([fx - 2, fy + 7.8, fx + 3, fy + 6.6, fx + 9, fy + 6.4, fx + 12.6, fy + 7.4, fx + 13.6, fy + 5.2, fx + 13, fy + 9.4, fx + 9, fy + 9.4, fx + 4, fy + 10, fx - 1, fy + 11.2, fx - 4.6, fy + 11.4], BD, { bv: 1.4, ink: -0.08 }));
  for (const [x0, x1] of [[-3, -4], [3, 2.6], [9, 8]]) h.push(K(fx + x0, fy + 13, fx + x1 + sw, fy + 21, 0.35, 0.3, BD, no({ ink: -0.06 })));
  o.push(grow(h, fx, hy, hk));

  // the two forks, flat locks down to the belt and tucked in it
  const fork = (x0: number, x1: number, xm: number, ink: number): Out => {
    const [ax, ay] = M(fx + x0 - 4.4, fy + 18), [bx, byy] = M(fx + x0 + 4.4, fy + 18);
    const out: Out = [P([ax, ay, bx, byy, fx + xm + 3.4 + sw, 80, fx + x1 + 2.2 + sw, 93, fx + x1 - 2.2 + sw, 93, fx + xm - 3.4 + sw, 80], BD, { bv: 2.4, ink })];
    out.push(K(bx - 1.2, byy + 2, fx + x1 + 1.4 + sw, 90, 0.4, 0.35, BD, no({ ink: ink + 0.22 }))); // its edge, lit by the rune
    out.push(K((ax + bx) / 2 - 0.6, ay + 3, fx + x1 - 0.4 + sw, 90, 0.35, 0.3, BD, no({ ink: ink - 0.26 })));
    return out;
  };
  o.push(fork(-3, -3, -5, -0.3), fork(8, 7.6, 9, -0.24));
  o.push(K(4, 92, 76, 92, 2.4, 2.4, 'leatherDark', { ink: -0.04 }), P([fx - 4, 89, fx + 2, 89, fx + 2, 95, fx - 4, 95], 'bronze', { bv: 0.8 }), P([fx - 2.6, 90.4, fx + 0.6, 90.4, fx + 0.6, 93.6, fx - 2.6, 93.6], DK));

  // the anvil, its horn running out of the picture, the rune-stone on its face
  o.push(P([60, 99, 64, 92, 92, 92, 96, 99], 'blackIron', { bv: 1, ink: -0.3 })); // the waist
  o.push(P([56, 85, 98, 85, 98, 92, 62, 92, 56, 88.6], 'blackIron', { bv: 1.8, n: [0, -0.2, 1], ink: -0.22 }));
  const st = [63, 85.2, 67, 79, 82, 77.6, 88, 81, 86, 85.4];
  o.push(P(st, 'runestone', { bv: 1.6, n: [0, -0.4, 1], ink: -0.24 }));
  const ri = (p - 1) * 0.6;
  o.push(K(72, 78.8, 71.4, 84.2, 0.7, 0.7, 'emArcane', { ink: ri }), K(72, 78.8, 76, 80, 0.6, 0.6, 'emArcane', { ink: ri }), K(76, 80, 72.4, 81.6, 0.6, 0.6, 'emArcane', { ink: ri }), K(73, 81.8, 78, 84.2, 0.6, 0.6, 'emArcane', { ink: ri }));
  // the hammer, lifting off the stone after the blow: a bare forearm, the sleeve rolled to the elbow
  const ha = [0, -0.9, -0.5, 0.3][f % 4];
  o.push(K(46, 99, 52, 93, 7, 6.6, 'scr_thrainTunic', { ink: -0.14 })); // the sleeve
  o.push(P([46.9, 89.6, 50.4, 80.6, 56, 71 + ha, 60.2, 64.2 + ha, 67.8, 67.8 + ha, 60.8, 85, 57.1, 94.4], SK, { bv: 3.6, n: [-0.4, -0.2, 0.9], ink: -0.2 })); // the forearm, turned from the light
  o.push(K(48.6, 96.4, 55.4, 89.6, 3, 3, 'scr_thrainTunic', { ink: -0.02 })); // the roll of the sleeve
  o.push(K(62.4, 70 + ha, 65.6, 63.6 + ha, 4.7, 4.4, 'leatherDark', { ink: -0.2 })); // the bracer
  o.push(K(60, 62 + ha, 90, 49 + ha, 1.5, 1.4, 'woodDark', { ink: -0.1 }));
  o.push(fist(71, 57.2 + ha, 0.92, -0.4, 1.1, SK, -1, -0.34));
  o.push(P([84.6, 39 + ha, 93.6, 36.6 + ha, 98, 56 + ha, 89, 58.6 + ha], 'iron', { bv: 1.6, n: [0.2, 0.2, 1], ink: -0.12 }));
  o.push(K(91.6, 58 + ha, 97, 56.4 + ha, 0.6, 0.6, 'silver', { ink: 0.1 })); // its striking face, toward the stone
  // sparks of the strike, blue-white, a new scatter each frame
  for (let i = 0; i < 4; i++) {
    const h1 = hash2(i + f * 7, 51), h2 = hash2(i + f * 7, 53);
    o.push(X(66 + h1 * 22, 66 + h2 * 10, i ? 0.8 : 1.1, i ? 0.8 : 1.1, i % 2 ? '#dcebff' : '#9cc4ff', { em: true }));
  }
  o.push(Lt(74, 80, 100, '#6aa6ff', 1.6 * p, 8));
  return o;
}

/**
 * The last forge-keeper of the Iron Clans, of the line of the Ivaldi who made
 * Sif's golden hair: an iron-grey duergar, white braids ringed in iron (one
 * bound in gold wire, her line's craft), black-iron pauldrons over her mail,
 * the duergar rune silver on her scorched apron. She sits by the banked coals;
 * they light her from below, low and deep, and her eyes go to your hands. Her
 * mouth is set. "The coals are banked, not dead. Neither are we."
 */
export function ivaldaPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.9, 1.08, 0.95][f % 4]; // the coals breathe
  const o: Out = [];
  const BG = 'scr_gIvalda', HG = 'scr_ivaldaHalo', SK = 'scr_ivaldaSkin', WM = 'scr_ivaldaWarm', DK = 'scr_ivaldaDark', HR = 'scr_ivaldaHair', HD = 'scr_ivaldaHairDk';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(44, 38, 40, 40, BG, { fl: 1, ink: BAND[2] - 0.08 }));
  // the coals' glow, rising from below the picture
  o.push(E(48, 110, 80, 46, HG, { fl: 1, ink: BAND[1] }));
  o.push(E(48, 110, 56, 28, HG, { fl: 1, ink: BAND[2] }));

  const by = -b * 0.5;
  // the neck, short and thick
  o.push(K(46, 50 + by, 46, 59 + by, 9.6, 10.6, SK, { ink: -0.36 }));
  // mail over the broad shoulders, the scorched apron's bib, black-iron pauldrons
  o.push(P([0, 99, 1, 80, 12, 70 + by, 28, 62 + by, 36, 57 + by, 58, 57 + by, 66, 62 + by, 82, 70 + by, 95, 80, 96, 99], 'scr_ivaldaMail', { bv: 6, n: [0, -0.55, 0.84], ink: -0.1 }));
  o.push(P([32, 74 + by, 62, 74 + by, 65, 99, 29, 99], 'scr_ivaldaApron', { bv: 2, n: [0, -0.6, 0.8], ink: -0.04 }));
  o.push(K(34.4, 75 + by, 36.6, 64 + by, 1.4, 1.3, 'leatherDark'), K(59.6, 75 + by, 57.4, 64 + by, 1.4, 1.3, 'leatherDark'));
  // the duergar rune burned silver into the leather
  const rn = { ink: -0.24 };
  o.push(K(47, 78 + by, 47, 85 + by, 0.5, 0.5, 'silver', rn), K(47, 80.6 + by, 44.2, 78 + by, 0.45, 0.45, 'silver', rn), K(47, 80.6 + by, 49.8, 78 + by, 0.45, 0.45, 'silver', rn));
  // black-iron pauldrons, two lames each, the near one closer and larger
  const pl = { bv: 2.4, n: [-0.1, -0.3, 0.95] as [number, number, number] };
  o.push(P([-2, 80 + by, 6, 79 + by, 18, 78 + by, 25, 81 + by, 24, 89 + by, 12, 90 + by, -2, 89 + by], 'scr_ivaldaPlate', { ...pl, ink: -0.1 }));
  o.push(P([-2, 66 + by, 6, 62 + by, 16, 63 + by, 24, 68 + by, 26, 76 + by, 18, 80.6 + by, 6, 81.4 + by, -2, 80.6 + by], 'scr_ivaldaPlate', { ...pl, ink: 0 }));
  o.push(P([98, 79 + by, 92, 78.4 + by, 83, 78.4 + by, 77.6, 80.6 + by, 78.4, 86.6 + by, 88, 87.4 + by, 98, 86.6 + by], 'scr_ivaldaPlate', { ...pl, ink: -0.16 }));
  o.push(P([98, 67 + by, 92, 64.4 + by, 85, 65.4 + by, 78.4, 69.4 + by, 77.4, 76 + by, 84, 79.4 + by, 92, 80 + by, 98, 79.4 + by], 'scr_ivaldaPlate', { ...pl, ink: -0.08 }));
  for (const [x, y] of [[8, 66], [18, 67.4], [88, 68], [94, 67]]) o.push(E(x, y + by, 0.9, 0.9, 'iron', { ink: 0.1 }));

  // the head is drawn at its own size and grown to fill the frame
  const fx = 45, fy = 40 + by, hk = 1.1, hy = fy + 6;
  const M = (x: number, y: number): Pt => [fx + (x - fx) * hk, hy + (y - hy) * hk];
  const sw = s * 0.4;
  // the plaits: gathered at the nape behind each ear, falling over the chest inside the pauldrons
  const BF: [number, number, number, number] = [...M(fx + 10, fy + 15), fx + 19, 96], BN: [number, number, number, number] = [...M(fx - 17.8, fy + 8), fx - 16, 96];
  const rp = (q: number[], t: number): Pt => [q[0] + (q[2] - q[0]) * t + sw * t * t, q[1] + (q[3] - q[1]) * t];
  // the far plait, from behind the jaw
  o.push(plait(...BF, 3.5, HR, -0.32, sw, HD));
  for (const t of [0.06, 0.5]) { const [x, y] = rp(BF, t); o.push(E(x, y, 3.8, 1.6, 'blackIron', { fl: 0.4, ink: -0.06 })); }

  const h: Out = [];
  // the head: a broad, heavy-boned duergar face, iron-grey
  h.push(E(fx - 1, fy - 2.6, 15.4, 14.8, SK, { fl: 0.2, ink: -0.08 }));
  h.push(E(fx + 2, fy + 6.6, 15, 9.4, SK, no({ fl: 0.25, ink: -0.08 })));
  h.push(E(fx - 9.6, fy + 2.4, 3.8, 9.6, SK, no({ fl: 0.6, ink: -0.22 }))); // the turn of the face, in shadow
  // white hair drawn back off the brow from a parting, the crown catching the light, gathered at the nape
  h.push(P([fx + 14.4, fy - 6, fx + 13, fy - 12.4, fx + 8, fy - 17, fx - 2, fy - 18.8, fx - 12, fy - 15.6, fx - 18.4, fy - 6, fx - 19, fy + 3, fx - 17.6, fy + 8.4,
    fx - 16, fy + 3, fx - 15.8, fy - 3, fx - 14, fy - 8, fx - 7, fy - 10.8, fx + 1, fy - 12, fx + 7.4, fy - 11.2, fx + 11.6, fy - 8.4], HR, { bv: 3, ink: -0.12 }));
  h.push(E(fx - 17.2, fy + 3, 2.4, 6, HR, no({ fl: 0.5, ink: -0.44 }))); // the back of the hair, turned from the light
  h.push(E(fx - 6, fy - 14.6, 7, 3.4, HR, no({ fl: 0.4, a: -0.25, ink: 0.06 }))); // the crown, lit
  h.push(strand(fx + 1, fy - 12, fx - 1, fy - 16, fx - 5, fy - 18.6, 0.5, 0.36, HD, 3, no({ ink: -0.04 }))); // the parting
  // combed strands: back from the hairline to the nape on the near side, up over the crown on the far
  [[-1.4, -12], [-4, -11.6], [-6.6, -10.8], [-9, -9.6], [-11.4, -8.4], [-13.4, -6.6]].forEach(([x0, y0], i) => h.push(strand(fx + x0, fy + y0, fx + x0 - 6 - i * 0.6, fy + y0 - 3 + i * 0.8, fx - 17.6, fy + 5.6, 0.32, 0.26, i % 2 ? HR : HD, 5, no({ ink: i % 2 ? 0.1 : 0.16 }))));
  [[3.2, -12], [5.8, -11.4], [8.4, -10.2], [10.8, -8.6]].forEach(([x0, y0], i) => h.push(strand(fx + x0, fy + y0, fx + x0 - 1.6, fy - 16.4, fx + x0 - 9, fy - 18.6, 0.3, 0.24, i % 2 ? HR : HD, 4, no({ ink: i % 2 ? 0.1 : 0.16 }))));
  // the bare temple and the ear, a dark hollow between cheek and hair
  h.push(E(fx - 13.4, fy - 3.4, 2.6, 4.6, SK, no({ fl: 0.6, ink: -0.36 })));
  h.push(E(fx - 13.4, fy + 1.8, 2.6, 4.2, SK, { fl: 0.3, ink: -0.12 }), E(fx - 13, fy + 2, 1.2, 2.4, SK, no({ fl: 0.7, ink: -0.42 })));
  h.push(E(fx - 15, fy + 8.6, 2, 3.4, DK, no({ fl: 0.6, ink: -0.1 }))); // the shadow behind the jaw, at the nape
  // the brow ridge, and heavy white brows drawn down over deep eyes
  h.push(K(fx - 9.4, fy - 4.2, fx + 11, fy - 4.6, 2.4, 2, SK, no({ ink: -0.04 })));
  h.push(K(fx - 2, fy - 8.6, fx + 6, fy - 9, 0.4, 0.4, SK, no({ ink: -0.2 }))); // a furrow across the brow
  h.push(P([fx - 10.4, fy - 5.2, fx - 5, fy - 7.8, fx + 0.8, fy - 6, fx + 1.2, fy - 4, fx - 4.4, fy - 4.8, fx - 10, fy - 3.4], HR, { bv: 1, ink: -0.02 }));
  h.push(P([fx + 4, fy - 5.6, fx + 8, fy - 7.2, fx + 11.8, fy - 5.8, fx + 11.2, fy - 4.2, fx + 7.8, fy - 5, fx + 4.2, fy - 3.8], HR, { bv: 1, ink: -0.02 }));
  // the eyes, deep under the brow, going to your hands, a coal in each
  const bl = f === 1, gl = { socket: -0.42, look: 0.5, gs: 1.05, gy: 0.5 };
  h.push(eye(fx - 4, fy - 0.8, 1.05, SK, DK, '#ffc27a', bl, gl));
  h.push(eye(fx + 7.8, fy - 0.8, 0.84, SK, DK, '#ffc27a', bl, gl));
  h.push(K(fx - 7.4, fy + 2.6, fx - 1.6, fy + 2.8, 0.45, 0.4, SK, no({ ink: -0.2 }))); // the line under the eye
  // the broad flat nose, the hard lines down to the set mouth
  h.push(K(fx + 3.6, fy - 2.2, fx + 6.4, fy + 3.4, 1.9, 2.8, SK, no({ ink: -0.04 })));
  h.push(E(fx + 6.6, fy + 4.4, 3.8, 2.6, SK, NO));
  h.push(E(fx + 3, fy + 5, 1.6, 1.4, SK, no({ ink: -0.16 })));
  h.push(X(fx + 6.2, fy + 5.8, 1.8, 0.8, DK + ':2'));
  h.push(K(fx - 0.6, fy + 5, fx - 0.2, fy + 11, 0.5, 0.4, SK, no({ ink: -0.26 })), K(fx + 10.8, fy + 5.6, fx + 11.2, fy + 10.6, 0.45, 0.4, SK, no({ ink: -0.24 })));
  // the coals' warmth on the planes that face down: under the brows, the nose, the lip, the chin, the jaw
  const wm = (o2: PrimOptions) => no({ fl: 0.5, ...o2 });
  h.push(K(fx - 7.6, fy - 2.6, fx + 1, fy - 2.8, 0.5, 0.45, WM, wm({ ink: -0.22 })), K(fx + 4.4, fy - 3, fx + 10.4, fy - 3.2, 0.45, 0.4, WM, wm({ ink: -0.24 })));
  h.push(E(fx + 6.6, fy + 5.4, 2.6, 1, WM, wm({ ink: -0.1 })));
  h.push(K(fx + 1.4, fy + 10.6, fx + 9.8, fy + 10.4, 0.62, 0.56, DK, NO)); // the mouth, set
  h.push(K(fx + 1.8, fy + 10.6, fx + 0.8, fy + 12, 0.4, 0.3, DK, NO), K(fx + 9.4, fy + 10.4, fx + 10.2, fy + 11.6, 0.4, 0.3, DK, NO)); // its corners turned down
  h.push(E(fx + 5.6, fy + 12, 3.2, 1.1, WM, wm({ ink: -0.04 }))); // the lower lip, pressed
  h.push(E(fx + 5, fy + 14.8, 5, 2.4, WM, wm({ ink: 0.02 }))); // the chin, set hard, warm from below
  h.push(K(fx - 8, fy + 12.6, fx + 1, fy + 15.6, 0.9, 1.1, WM, wm({ ink: -0.12 }))); // the jaw's underside
  o.push(grow(h, fx, hy, hk));

  // the near plait, ringed in iron at the nape and bound in gold wire, her line's craft
  o.push(plait(...BN, 4, HR, -0.2, sw, HD));
  for (const t of [0.04, 0.44]) { const [x, y] = rp(BN, t); o.push(E(x, y, 4.2, 1.7, 'blackIron', { fl: 0.4 })); }
  for (let i = 0; i < 3; i++) { const [x, y] = rp(BN, 0.74 + i * 0.045); o.push(E(x, y, 3.6, 0.7, 'gold', { fl: 0.4, ink: 0.02 })); }

  // the banked coals along the foot of the picture: an ash-crusted heap, red at the cracks
  o.push(P([-2, 99, -2, 93, 6, 90.6, 14, 92, 22, 90.2, 32, 91.6, 42, 90, 52, 91.2, 62, 89.8, 72, 91.6, 82, 90.4, 90, 91.8, 98, 90.6, 98, 99], 'scr_ivaldaAsh', { bv: 2, n: [0, -0.9, 0.42], ink: -0.22 }));
  for (let i = 0; i < 11; i++) {
    const x = i * 9 + hash2(i, 61) * 6, y = 93.4 + hash2(i, 63) * 4, r = 1.6 + hash2(i, 65) * 2.4;
    o.push(E(x, y, r, r * 0.66, 'scr_ivaldaCoal', { ink: -0.3 + hash2(i, 67) * 0.24 + (g - 1) * 0.8 }));
    if (hash2(i, 69) > 0.45) o.push(E(x - r * 0.4 + hash2(i, 75) * r * 0.8, y - r * 0.4, r * 0.9, r * 0.42, 'scr_ivaldaAsh', { a: hash2(i, 77) - 0.5, ink: -0.14 }));
  }
  for (let i = 0; i < 3; i++) o.push(X(8 + hash2(i + f * 5, 71) * 80, 88.4 - hash2(i + f * 5, 73) * 3, 0.8, 0.8, i % 2 ? 'emFire:5' : 'emFireCore:5', { em: true }));
  o.push(Lt(48, 96, 104, '#f0702c', 1.5 * g, 20));
  return o;
}
