import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9g, group C: the Cinder-Gilded Duergar, the Haugbúi and the Forge Wretch, the dwarves of the Abandoned Dwarven Works. Conventions: portraitKit.ts. */

const NO: PrimOptions = { occ: false };
const no = (o: PrimOptions = {}): PrimOptions => ({ occ: false, ...o });

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
    else if (q.t === 'L') { q.x = sx(q.x); q.y = sy(q.y); q.r *= k; }
  };
  for (const q of list) walk(q);
  return list;
}

/** A thick plait from (x0, y0) to (x1, y1): one tapering rope, the crossings cut in it as grooves slanting from either edge in turn. */
function plait(x0: number, y0: number, x1: number, y1: number, w: number, m: string, ink: number, sw = 0, gm = m, gap = 2.1): Prim[] {
  const out: Prim[] = [];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const at = (t: number): Pt => [x0 + dx * t + sw * t * t, y0 + dy * t];
  const wd = (t: number) => w * (1 - t * 0.3);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = at(i / 4), [bx, by] = at((i + 1) / 4);
    out.push(K(ax, ay, bx, by, wd(i / 4), wd((i + 1) / 4), m, { fl: 0.3, ink }));
  }
  const n = Math.round(L / (w * gap * 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n, [x, y] = at(t), ww = wd(t), sd = i % 2 ? 1 : -1, h = w * gap * 0.32;
    out.push(K(x + nx * sd * ww * 0.9, y + ny * sd * ww * 0.9, x - nx * sd * ww * 0.15 + ux * h, y - ny * sd * ww * 0.15 + uy * h, 0.55, 0.42, gm, no({ ink: ink - 0.34 })));
  }
  return out;
}

/** A crack with fire in it: a dark seam along the points, the ember line inside. */
function crack(pts: number[], r: number, pit: string, ink: number): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const r1 = r * (1 - (i / pts.length) * 0.5), r2 = r * (1 - ((i + 2) / pts.length) * 0.5);
    out.push(K(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r1 + 0.35, r2 + 0.3, pit, NO));
    out.push(K(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r1 * 0.55, r2 * 0.5, 'emFire', no({ ink })));
  }
  return out;
}

/**
 * A dead smith of the works, burnt to charcoal under his plate and buried in a
 * gold death-mask; the gold ran in the burning and set in drips on his beard.
 * Fire still lives in his cracks, and the mask is cracked too; violet looks out
 * of its slits. He raises the forge tongs he came out of the fire with, their
 * jaws still glowing: they light the gold from the right.
 */
export function duergarPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.1, 0.92, 1.05][f % 4]; // the fire in him breathes
  const ci = (fl - 1) * 0.8;
  const o: Out = [];
  const BG = 'scr_gildedGround', HG = 'scr_gildedHalo', MK = 'scr_gildedMask', CH = 'scr_gildedChar', PL = 'scr_gildedPlate';
  const AS = 'scr_gildedAsh', PIT = 'scr_gildedPit', SO = 'scr_gildedSoot';
  const jx = 82, jy = 17; // the tongs' jaws
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(44, 46, 52, 56, BG, { fl: 1, ink: BAND[2] }));
  // the cold forge behind him: the hood of its chimney, dark against dark
  o.push(P([-1, -1, 30, -1, 26, 18, 6, 24, -1, 24], BG, { ink: BAND[1] - 0.06 }));
  o.push(P([-1, 24, 6, 24, 26, 18, 27, 20, 7, 26.4, -1, 26.4], BG, { ink: BAND[2] + 0.06 }));
  // the tongs' glow, banded round the jaws
  o.push(E(jx, jy, 34, 30, HG, { fl: 1, ink: BAND[1] }), E(jx, jy, 18, 16, HG, { fl: 1, ink: BAND[2] }));

  const by = -b * 0.5;
  // the charcoal of him over the shoulders, the breastplate, the pauldrons
  o.push(P([-2, 97, -2, 82, 10, 72, 26, 64 + by, 38, 60 + by, 58, 60 + by, 70, 64 + by, 86, 72, 98, 82, 98, 97], CH, { bv: 6, n: [0, -0.15, 1], ink: -0.2 }));
  o.push(P([24, 97, 26, 74 + by, 36, 67 + by, 60, 67 + by, 70, 74 + by, 72, 97], PL, { bv: 4, n: [0, -0.1, 1], ink: -0.12 }));
  o.push(E(12, 86 + by, 15, 8.4, PL, { a: -0.15, ink: -0.2 }), E(14, 75 + by, 16, 10.4, PL, { a: -0.3, ink: -0.04 }));
  o.push(E(84, 86 + by, 14, 8, PL, { a: 0.15, ink: -0.26 }), E(82, 75 + by, 15, 10, PL, { a: 0.3, ink: -0.14 }));
  o.push(strand(-1, 80 + by, 14, 85.6 + by, 29, 78 + by, 0.9, 0.9, 'gold', 4, no({ ink: -0.2 }))); // gilt edging
  o.push(strand(67, 78 + by, 82, 85 + by, 97, 80 + by, 0.9, 0.9, 'gold', 4, no({ ink: -0.3 })));
  // fire in the cracks of the plate
  o.push(crack([6, 70 + by, 11, 74 + by, 9, 78 + by, 14, 82 + by], 0.7, PIT, ci));
  o.push(crack([30, 97, 33, 90, 31, 86, 35, 80], 0.8, PIT, ci));
  o.push(crack([66, 97, 64, 92, 67, 88, 65, 84], 0.7, PIT, ci));

  const fx = 46, fy = 36 + by, hk = 1.16, hy0 = fy + 6;
  const M = (x: number, y: number): Pt => [fx + (x - fx) * hk, hy0 + (y - hy0) * hk];
  const sw = s * 0.3;
  // the two plaits of the ash beard, bound in gold rings, down over the plate
  const PA: [number, number, number, number] = [...M(fx - 5, fy + 27), fx - 7.4, 97], PB: [number, number, number, number] = [...M(fx + 7, fy + 27), fx + 9.4, 97];
  const plaits: Array<[[number, number, number, number], number]> = [[PB, -0.2], [PA, -0.08]];
  for (const [q, ink] of plaits) {
    o.push(plait(...q, 3.8, AS, ink, sw, AS));
    for (const t of [0.3, 0.68]) {
      const x = q[0] + (q[2] - q[0]) * t + sw * t * t, y = q[1] + (q[3] - q[1]) * t;
      o.push(E(x, y, 4.2 - t * 1.2, 1.7, 'gold', { fl: 0.4, ink: -0.16 }), K(x - 3 + t, y - 0.6, x + 2 - t, y - 0.6, 0.3, 0.3, 'gold', no({ ink: 0.2 })));
    }
  }
  const h: Out = [];
  // the charred hood round the head, crazed like burnt wood
  h.push(E(fx, fy - 3, 19.5, 21.5, CH, { fl: 0.12, ink: -0.14 }));
  h.push(P([fx - 19, fy - 4, fx - 22, fy + 16, fx - 25, fy + 26, fx - 14, fy + 24, fx - 12, fy + 6], CH, { bv: 3, ink: -0.26 }));
  h.push(P([fx + 19, fy - 4, fx + 22, fy + 16, fx + 25, fy + 26, fx + 14, fy + 24, fx + 12, fy + 6], CH, { bv: 3, ink: -0.32 }));
  for (const [x0, y0, x1, y1] of [[-16, -12, -11, -17], [-17, -2, -14, -8], [-18, 8, -15, 14], [12, -20, 16, -15], [16, 2, 19, 10]]) h.push(K(fx + x0, fy + y0, fx + x1, fy + y1, 0.4, 0.3, PIT, no({ ink: 0.1 })));
  h.push(crack([fx - 5, fy - 24.4, fx - 9, fy - 19.4, fx - 7, fy - 15], 0.6, PIT, ci));
  h.push(crack([fx + 12, fy - 19, fx + 16.4, fy - 13, fx + 15, fy - 7], 0.6, PIT, ci));
  // the ash beard, full under the mask, flaking
  h.push(P([fx - 13.4, fy + 6, fx + 14.4, fy + 6, fx + 16, fy + 18, fx + 12.4, fy + 27, fx + 4, fy + 30, fx - 3, fy + 30, fx - 11.4, fy + 27, fx - 15, fy + 18], AS, { bv: 4, ink: -0.1 }));
  for (const [x0, y0, x1, y1, k] of [[-11, 10, -12, 24, -0.36], [-5, 12, -5.4, 27, -0.3], [1, 13, 1.4, 28, -0.34], [7, 12, 8, 27, -0.3], [12, 10, 13, 22, -0.4]]) h.push(K(fx + x0, fy + y0, fx + x1 + sw, fy + y1, 0.45, 0.3, AS, no({ ink: k })));
  for (let i = 0; i < 5; i++) h.push(X(fx - 11 + hash2(i, 81) * 24, fy + 15 + hash2(i, 83) * 12, 0.8, 0.8, i < 2 ? 'emFire:' + (i % 2 ? 4 : 5) : AS + ':1', { em: i < 2 }));

  // the gold death-mask: a broad dwarf's face, stern, turned a little to the right; a lip of shadow where it lies on the char
  const mask = [fx - 12, fy - 12, fx - 6, fy - 15.6, fx + 2, fy - 16.4, fx + 9, fy - 15.4, fx + 13.6, fy - 11, fx + 14.4, fy - 3, fx + 13.4, fy + 5,
    fx + 10.6, fy + 11, fx + 5.4, fy + 14.4, fx + 0.4, fy + 15.4, fx - 5, fy + 14.4, fx - 10, fy + 10.4, fx - 13, fy + 3, fx - 13.4, fy - 5];
  h.push(P(mask.map((v, i) => v + (i % 2 ? 1.1 : 0.9)), PIT));
  h.push(P(mask, MK, { bv: 5.4 }));
  h.push(E(fx + 0.6, fy - 10.4, 11, 5, MK, no({ fl: 0.5, ink: 0.04 }))); // the brow's dome
  h.push(E(fx - 6.6, fy + 3, 5, 3.6, MK, no({ fl: 0.4, ink: 0.06 })), E(fx + 8.6, fy + 3, 4.4, 3.4, MK, no({ fl: 0.4 }))); // cheekbones
  h.push(E(fx + 12.4, fy + 1, 2.4, 7, MK, no({ fl: 0.7, ink: -0.24 }))); // the far side turning away
  h.push(E(fx - 11.6, fy - 1, 2, 6.4, SO, no({ fl: 1, ink: -0.06 }))); // soot along the near edge
  // the heavy brow, frowning down to the nose
  h.push(K(fx - 12, fy - 7.6, fx - 1, fy - 4.8, 2.3, 1.6, MK, no({ ink: 0.1 })), K(fx + 14, fy - 7.6, fx + 4, fy - 4.8, 2.1, 1.6, MK, no({ ink: 0.02 })));
  // the eye-slits, and the dead light behind them; soot run down from them like tears
  const g = [1, 0.88, 1.1, 0.95][f % 4];
  h.push(K(fx - 6.8, fy - 1, fx - 7.6, fy + 7.4, 1, 0.45, SO, no({ ink: -0.04 })), K(fx + 9.6, fy - 1, fx + 9.8, fy + 5.4, 0.9, 0.4, SO, no({ ink: -0.1 })));
  h.push(P([fx - 11, fy - 2.2, fx - 6.8, fy - 4.6, fx - 2.2, fy - 3.6, fx - 2.8, fy - 1.6, fx - 7.2, fy - 1.2], PIT));
  h.push(P([fx + 13.4, fy - 2.2, fx + 9.6, fy - 4.6, fx + 5.2, fy - 3.6, fx + 5.8, fy - 1.6, fx + 9.8, fy - 1.2], PIT));
  h.push(E(fx - 6.6, fy - 2.8, 2.4, 0.85, 'emUnholy', { ink: (g - 1) * 0.5 }), E(fx + 9.4, fy - 2.8, 2.1, 0.8, 'emUnholy', { ink: (g - 1) * 0.5 }));
  h.push(X(fx - 7.2, fy - 3.4, 0.9, 0.7, '#f4ecff', { em: true }));
  h.push(Lt(fx + 1.4, fy - 2.6, 9, '#a868ff', 0.5 * g, 2));
  // the nose, the nostrils, the moulded moustache over the mouth-slot
  h.push(K(fx + 1.4, fy - 5, fx + 2, fy + 3.6, 1.7, 2.8, MK, no({ ink: 0.08 })));
  h.push(E(fx + 2, fy + 4.4, 3.4, 2.4, MK, no({ ink: 0.04 })));
  h.push(X(fx - 0.2, fy + 5.6, 1.2, 0.8, PIT + ':1'), X(fx + 3.2, fy + 5.6, 1.2, 0.8, PIT + ':1'));
  h.push(K(fx - 6, fy + 10.4, fx + 10, fy + 10, 0.9, 0.9, SO, no({ ink: -0.14 }))); // the moustache's shadow
  h.push(P([fx - 7, fy + 9.6, fx - 2, fy + 7, fx + 2, fy + 7.8, fx + 6, fy + 7, fx + 11, fy + 9.4, fx + 6, fy + 9, fx + 2, fy + 9.6, fx - 2, fy + 9], MK, { bv: 1, ink: 0.06 }));
  h.push(K(fx - 3, fy + 12, fx + 7.4, fy + 12, 0.65, 0.65, PIT, NO));
  // the crack across it, fire in it
  h.push(crack([fx - 3, fy - 16.2, fx - 5.4, fy - 11, fx - 3.8, fy - 7.4, fx - 5.6, fy - 4.8], 0.7, PIT, ci));
  h.push(crack([fx - 8.6, fy - 0.8, fx - 10.4, fy + 4.6, fx - 8.8, fy + 9.6, fx - 10.4, fy + 13.4], 0.7, PIT, ci));
  // gold that ran in the burning and set in drips on the beard
  for (const [x, y, l] of [[-7.4, 12.6, 3.6], [4.6, 14.4, 5], [9.6, 11.4, 2.4]]) {
    h.push(K(fx + x, fy + y, fx + x + 0.2, fy + y + l, 0.75, 0.55, MK, no({ ink: -0.1 })), E(fx + x + 0.2, fy + y + l, 0.9, 1, MK, no({ ink: -0.04 })));
  }
  o.push(grow(h, fx, hy0, hk));

  // the tongs, raised out of the fire: the reins up from his fist, the jaws aglow
  const hx = 74, hy = 82; // the fist
  const px = 81.4, py = 30; // the rivet
  o.push(K(hx - 1.8, hy, px + 0.8, py + 3, 1.4, 1.2, 'blackIron', { ink: -0.12 }));
  o.push(K(hx + 1.8, hy, px + 1.8, py + 3, 1.4, 1.2, 'blackIron', { ink: -0.24 }));
  { const t = 0.36, x = hx + (px + 1.3 - hx) * t, y = hy + (py + 3 - hy) * t; o.push(E(x, y, 3, 1.3, 'blackIron', { a: 0.15, ink: 0.06 })); } // the ring on the reins
  // the heat run down the reins from the jaws
  o.push(K(px + 1.2, py + 11, px + 0.9, py + 3, 1.25, 1.2, 'emFire', { ink: -0.7 + ci }), K(px + 2.1, py + 11, px + 1.9, py + 3, 1.25, 1.2, 'emFire', { ink: -0.75 + ci }));
  o.push(E(px + 1.3, py + 1.6, 2.4, 2.2, 'emFire', { ink: -0.4 + ci }));
  // the jaws, open: straight bits bent in at the tips
  o.push(K(px + 1.3, py + 1.6, jx - 4.6, jy - 1, 1.6, 1.2, 'emFire', { ink: -0.14 + ci }), K(jx - 4.6, jy - 1, jx - 1.4, jy - 4, 1.2, 0.9, 'emFireCore', { ink: ci }));
  o.push(K(px + 1.3, py + 1.6, jx + 6, jy, 1.6, 1.2, 'emFire', { ink: -0.08 + ci }), K(jx + 6, jy, jx + 3.4, jy - 3.6, 1.2, 0.9, 'emFireCore', { ink: ci }));
  // the arm in its charred plate, the gauntlet on the reins
  o.push(K(98, 99, hx + 4, hy + 6, 9, 7, PL, { ink: -0.2 }));
  o.push(fist(hx, hy, 0.14, -0.99, 1.35, PL, -1, -0.06));
  o.push(crack([88, 96, 86, 90, 89, 87], 0.6, PIT, ci));
  // embers rising off the jaws, ash falling
  for (let i = 0; i < 4; i++) {
    const y = jy - 2 - ((hash2(i, 31) * 22 + f * 5) % 22), x = jx - 4 + hash2(i, 37) * 8 + sway(f + i) * 0.5;
    o.push(X(x, y, 0.8, 0.8, i % 2 ? 'emFire:5' : 'emFireCore:5', { em: true }));
  }
  for (let i = 0; i < 6; i++) {
    const y = (hash2(i, 41) * 96 + f * 2.4) % 96, x = 6 + hash2(i, 43) * 30 + (i > 2 ? 56 : 0) * hash2(i, 47);
    o.push(X(x, y, 0.9, 0.7, BG + ':5', { em: true }));
  }
  o.push(Lt(jx, jy + 2, 82, '#ff8a3c', 1.5 * fl, 12));
  return o;
}

/**
 * The mound-dweller, who never leaves his barrow: he sits in it still, as Kárr
 * the Old sat when Grettir broke in. Blue as Hel and broad as an ox (the saga
 * words for the barrow-dead), squat in his rusted mail under an old
 * spangenhelm with the mound's turf grown over its crown, the roots of the roof
 * down into it; rime and barrow-dirt in his beard; his fist on the butt of the
 * long-axe planted beside him, a little of his hoard at his feet. No light
 * reaches in: only the violet of his own eyes, under the brim.
 */
export function haugbuiPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.9, 1.1, 0.96][f % 4];
  const o: Out = [];
  const BG = 'scr_haugbuiGround', SK = 'scr_haugbuiSkin', PIT = 'scr_haugbuiPit', HM = 'scr_haugbuiHelm', BZ = 'scr_haugbuiBronze';
  const BD = 'scr_haugbuiBeard', TF = 'scr_haugbuiTurf', GR = 'scr_haugbuiGrass', RM = 'scr_haugbuiRime', ML = 'scr_haugbuiMail';
  const RU = 'scr_haugbuiRust', CL = 'scr_haugbuiCloak', EA = 'scr_haugbuiEarth', RT = 'scr_haugbuiRoot';
  // the barrow's chamber: earth walls, a timber post each side, the roof-beam, roots through it
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 50, 50, 56, BG, { fl: 1, ink: BAND[2] }));
  for (let i = 0; i < 10; i++) {
    const x = 6 + hash2(i, 5) * 84, y = 12 + hash2(i, 7) * 50, r = 3 + hash2(i, 9) * 3;
    if (Math.abs(x - 48) < 22 && y < 60) continue;
    o.push(E(x, y, r * 1.4, r, BG, { fl: 1, ink: BAND[1] + 0.06 }), E(x - 0.5, y - 0.6, r * 1.2, r * 0.7, BG, { fl: 1, ink: BAND[2] + 0.04 }));
  }
  o.push(P([-1, -1, 97, -1, 97, 7, -1, 8], BG, { ink: BAND[1] - 0.08 }), P([-1, 8, 97, 7, 97, 8.6, -1, 9.6], BG, { ink: BAND[2] + 0.04 })); // the roof-beam
  o.push(P([-1, 9, 7, 9, 8, 97, -1, 97], BG, { ink: BAND[1] - 0.06 }), P([6, 9, 7.4, 9, 8.4, 97, 7, 97], BG, { ink: BAND[2] })); // the posts
  o.push(P([89, 9, 97, 9, 97, 97, 88, 97], BG, { ink: BAND[1] - 0.06 }), P([89, 9, 90.4, 9, 89.4, 97, 88, 97], BG, { ink: BAND[2] - 0.04 }));
  for (const [x, len, dx] of [[16, 22, 3], [30, 12, -2], [70, 18, 2], [80, 28, -3]]) o.push(strand(x, 8, x + dx, 8 + len * 0.5, x + dx * 0.4 + s * 0.2, 8 + len, 1.4, 0.4, RT, 3, { ink: -0.5 }));

  const by = -b * 0.45;
  const hx = 48, ey = 46 + by;
  // the barrow-cloak over the broad shoulders, the mail at the chest
  o.push(P([-2, 97, -2, 76, 8, 66, 24, 61 + by, 38, 58 + by, 58, 58 + by, 72, 61 + by, 88, 66, 98, 76, 98, 97], CL, { bv: 6, n: [0, -0.2, 1], ink: -0.3 }));
  o.push(P([24, 97, 26, 66 + by, 40, 61 + by, 56, 61 + by, 70, 66 + by, 72, 97], ML, { bv: 3, n: [0, -0.1, 1], ink: -0.2 }));
  for (const [x, y, w, h] of [[28, 76, 3, 2], [66, 72, 2, 3], [30, 88, 4, 2]]) o.push(X(x, y, w, h, RU + ':2'));
  // turf on the shoulders, rime on the turf, grass standing out of it
  for (const [x, y, rx, ry, a] of [[16, 66, 13, 5.4, -0.3], [80, 66, 12, 5, 0.3]]) {
    o.push(E(x, y + by, rx, ry, TF, { a, fl: 0.2, ink: -0.16 }));
    o.push(E(x - 2, y - 2 + by, rx * 0.6, ry * 0.55, TF, no({ a, fl: 0.4, ink: -0.02 })));
  }
  for (const [x, y, r] of [[10, 63, 1.6], [14, 61.6, 1.2], [20, 62, 1.4], [76, 62, 1.2], [84, 63, 1.5]]) o.push(E(x, y + by, r * 1.5, r, RM, { fl: 0.4, ink: -0.18 }));
  for (const [x, y, dx, h] of [[8, 63, -2, 7], [12, 62, 1, 9], [18, 61, -1, 6], [24, 62.4, 2, 5], [74, 62, -2, 6], [80, 61, 1, 8], [86, 63, 2, 6]]) o.push(K(x, y + by, x + dx + s * 0.3, y - h + by, 0.55, 0.15, GR, { ink: -0.1 }));

  // the face: dead-blue, broad and heavy, the jowls sagging into the beard
  o.push(E(hx, ey + 2, 16, 12.4, SK, { fl: 0.15, ink: -0.12 }));
  o.push(E(hx - 10, ey + 7, 6.4, 6, SK, { ink: -0.14 }), E(hx + 10, ey + 7, 6.4, 6, SK, { ink: -0.22 }));
  // the shadow of the brim over the eyes, the sockets, and the violet in them
  o.push(E(hx, ey - 1, 16, 5, SK, no({ fl: 0.9, ink: -0.66 })));
  o.push(E(hx - 6.6, ey, 3.8, 2.6, PIT), E(hx + 6.6, ey, 3.6, 2.5, PIT));
  o.push(E(hx - 6.6, ey + 0.2, 1.8, 1.25, 'emUnholy', { ink: (g - 1) * 0.5 }), E(hx + 6.6, ey + 0.2, 1.7, 1.2, 'emUnholy', { ink: (g - 1) * 0.5 - 0.04 }));
  o.push(X(hx - 7.2, ey - 0.5, 0.8, 0.8, '#f4ecff', { em: true }), X(hx + 6, ey - 0.5, 0.7, 0.7, '#f4ecff', { em: true }));
  // the nose, broad and flattened
  o.push(K(hx, ey - 2, hx + 0.3, ey + 5, 2.4, 3.4, SK, no({ ink: 0.02 })));
  o.push(E(hx + 0.3, ey + 6, 4.2, 2.8, SK, no({ ink: 0 })));
  o.push(X(hx - 2.2, ey + 7.2, 1.4, 0.8, PIT + ':1'), X(hx + 1.4, ey + 7.2, 1.4, 0.8, PIT + ':1'));
  // the beard: a great spade of grey, matted, rime in it and clods of the mound
  const sw = s * 0.3;
  o.push(P([hx - 15, ey + 6, hx - 6, ey + 9, hx, ey + 8.4, hx + 6, ey + 9, hx + 15, ey + 6, hx + 19, ey + 14, hx + 21, ey + 27, hx + 16 + sw, ey + 41, hx + 7 + sw, 99,
    hx - 9 + sw, 99, hx - 17 + sw, ey + 41, hx - 21, ey + 27, hx - 19, ey + 14], BD, { bv: 6, ink: -0.08 }));
  for (const [x0, x1, x2, k] of [[-12, -15, -12, -0.3], [-6, -7, -6, -0.36], [0, 0.6, 0, -0.3], [6, 7, 6, -0.36], [12, 15, 12, -0.4]]) o.push(strand(hx + x0, ey + 14, hx + x1, ey + 28, hx + x2 + sw, ey + 46, 0.5, 0.4, BD, 4, no({ ink: k })));
  o.push(P([hx - 2, ey + 9.4, hx + 2, ey + 9.4, hx + 8, ey + 10, hx + 13, ey + 14, hx + 12, ey + 20, hx + 9, ey + 15, hx + 3, ey + 13, hx - 3, ey + 13, hx - 9, ey + 15, hx - 12, ey + 20, hx - 13, ey + 14, hx - 8, ey + 10], BD, { bv: 1.6, ink: 0.04 })); // the moustache
  o.push(K(hx - 3.4, ey + 14.2, hx + 3.4, ey + 14.2, 0.6, 0.6, PIT, NO));
  for (const [x, y, r] of [[-15, 22, 1.4], [-10, 34, 1.1], [12, 26, 1.3], [16, 18, 1], [4, 38, 1.2], [-4, 26, 0.9]]) o.push(E(hx + x, ey + y, r * 1.4, r, RM, no({ fl: 0.4, ink: -0.1 })));
  for (const [x, y, r] of [[-7, 31, 1.6], [9, 35, 1.4], [-14, 40, 1.2]]) o.push(E(hx + x, ey + y, r * 1.3, r, EA, no({ ink: -0.2 })));

  // the old spangenhelm: iron plates on bronze bands, the brim low over the eyes
  o.push(P([hx - 18, ey - 5, hx - 17, ey - 15, hx - 12, ey - 24, hx - 5, ey - 30, hx, ey - 31.6, hx + 5, ey - 30, hx + 12, ey - 24, hx + 17, ey - 15, hx + 18, ey - 5, hx, ey - 3.4], HM, { bv: 9, n: [0, -0.1, 1] }));
  o.push(K(hx, ey - 30, hx, ey - 6, 1.3, 1.6, BZ, { ink: -0.04 }), K(hx - 8, ey - 26, hx - 14, ey - 6.6, 1.1, 1.4, BZ, { ink: -0.04 }), K(hx + 8, ey - 26, hx + 14, ey - 6.6, 1.1, 1.4, BZ, { ink: -0.16 }));
  o.push(strand(hx - 18.6, ey - 6, hx, ey - 2.4, hx + 18.6, ey - 6, 2.4, 2.4, BZ, 6, { fl: 0.3 }));
  for (const t of [-15, -9, -3, 3, 9, 15]) o.push(X(hx + t - 0.5, ey - 5 + Math.abs(t) * -0.1 - 0.4, 1, 1, BZ + ':5'));
  for (const [x, y, r] of [[-12, -16, 1.6], [10, -12, 1.2], [5, -22, 1]]) o.push(E(hx + x, ey + y, r * 1.3, r, RU, no({ fl: 0.6 })));
  // the mound's turf grown over its crown, grass in it, a root of the roof grown down into it
  o.push(E(hx - 1, ey - 30, 11, 5, TF, { fl: 0.2, ink: -0.1 }), E(hx - 7, ey - 27, 6, 3.4, TF, { fl: 0.3, ink: -0.04 }), E(hx + 6, ey - 28, 5, 2.6, TF, { fl: 0.3, ink: -0.18 }));
  for (const [x, dx, h] of [[-9, -2, 8], [-5, 1, 11], [-1, -1, 9], [3, 2, 12], [7, 1, 7]]) o.push(K(hx + x, ey - 31, hx + x + dx + s * 0.3, ey - 31 - h, 0.6, 0.15, GR, { ink: -0.06 }));
  o.push(strand(56, 8, 54, 12, hx + 4, ey - 32, 1.1, 0.7, RT, 3, { ink: -0.4 }));
  for (const [x, y, r] of [[-14, -14, 1.2], [-10, -21, 1], [-6, -26, 0.9]]) o.push(E(hx + x, ey + y, r * 1.4, r, RM, { fl: 0.5, ink: -0.14 }));

  // the long-axe planted beside him, his fist over the butt
  const ax = 84;
  o.push(K(ax + 0.4, 99, ax, 56 + by, 1.8, 1.7, 'scr_haugbuiHaft', { ink: -0.2 }));
  o.push(E(ax, 55 + by, 2.4, 2, BZ, { ink: -0.04 }));
  o.push(K(98, 96, ax + 4, 70 + by, 7.6, 6, ML, { ink: -0.24 })); // the mail sleeve
  o.push(fist(ax, 63 + by, 0, 1, 1.2, SK, 1, -0.12));
  // a little of his hoard at his feet, catching his light
  for (let i = 0; i < 8; i++) {
    const x = 4 + hash2(i, 91) * 20, y = 88 + hash2(i, 93) * 8;
    o.push(E(x, y, 2, 0.9, 'gold', { fl: 0.5, ink: -0.3 - hash2(i, 95) * 0.2 }));
  }
  o.push(X(9 + f * 2.6, 89, 0.8, 0.8, '#ffffff', { em: true }));
  // the only light in the mound: his eyes
  o.push(Lt(hx, ey + 1.4, 30, '#a868ff', 1.15 * g, 4.5));
  return o;
}

/**
 * A living dwarf, a thrall of the works, worked to the bone at the forges for a
 * hundred years: bald and scorched, the beard burnt short, an iron collar with
 * its broken chain. Soot-blind: a black smear across the eyes, the eyes gone
 * milky. He has heard you; his head thrusts at the sound and the hammer goes
 * up. The forge mouth he stokes and cannot see lights him from the left.
 */
export function forgeWretchPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.12, 0.94, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_wretchGround', HG = 'scr_wretchHalo', SK = 'scr_wretchSkin', SC = 'scr_wretchScar', SO = 'scr_wretchSoot';
  const SM = 'scr_wretchSmear', MI = 'scr_wretchMilk', BD = 'scr_wretchBeard', PIT = 'scr_wretchPit', IR = 'scr_wretchIron';
  // the forge: its arch at the left, the glow banded round its mouth
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(52, 44, 50, 56, BG, { fl: 1, ink: BAND[2] - 0.06 }));
  o.push(E(4, 80, 40, 40, HG, { fl: 1, ink: BAND[1] }), E(4, 80, 24, 26, HG, { fl: 1, ink: BAND[2] }));
  o.push(P([-1, 54, 6, 50, 16, 52, 22, 60, 24, 97, -1, 97], BG, { ink: BAND[1] - 0.04 })); // the stonework
  o.push(P([-1, 64, 6, 61, 13, 64, 16, 72, 16, 97, -1, 97], HG, { ink: BAND[3] })); // its mouth
  for (let i = 0; i < 6; i++) o.push(E(1 + i * 3, 92 + hash2(i, 7) * 3, 2.4, 1.6, 'emFire', { ink: -0.3 + hash2(i, 9) * 0.3 + (fl - 1) * 0.6 }));

  const by = -b * 0.5;
  // the hunched back and shoulders, soot-grey, the apron's straps over them
  o.push(P([20, 97, 22, 80, 30, 68 + by, 46, 60 + by, 62, 52 + by, 76, 46 + by, 90, 48, 98, 56, 98, 97], SO, { bv: 7, n: [0.1, -0.2, 1], ink: -0.22 }));
  o.push(P([30, 97, 32, 84, 44, 78 + by, 60, 78 + by, 70, 86, 72, 97], 'scr_wretchApron', { bv: 2, ink: -0.2 }));
  o.push(K(42, 79 + by, 52, 58 + by, 1.3, 1.2, 'scr_wretchApron'), K(66, 82 + by, 74, 52 + by, 1.3, 1.2, 'scr_wretchApron', { ink: -0.2 }));
  o.push(K(38, 70 + by, 56, 66 + by, 0.5, 0.5, SO, no({ ink: 0.08 }))); // a collarbone
  for (const [x, y] of [[36, 76], [50, 70], [80, 62]]) o.push(E(x, y + by, 2.2, 1.2, SC, no({ fl: 0.5, ink: -0.1 })));

  // the head, thrust forward and low at the sound
  const hx = 44, hy = 40 + by;
  o.push(K(58, 62 + by, hx + 4, hy + 12, 6.4, 6, SK, { ink: -0.3 })); // the neck, stretched
  o.push(K(54, 60 + by, hx + 1, hy + 14, 0.8, 0.7, SK, no({ ink: -0.1 }))); // a tendon
  o.push(E(hx + 4, hy - 4, 15, 15, SK, { fl: 0.12, ink: -0.06 })); // the skull
  o.push(E(hx - 3, hy + 6, 11, 10, SK, no({ fl: 0.2, ink: -0.06 }))); // the face, forward
  o.push(E(hx - 4, hy + 13, 8, 4.4, SK, no({ ink: -0.12 }))); // the jaw
  // burns on the scalp, blisters, a few singed tufts above the ear
  for (const [x, y, rx, ry] of [[4, -12, 4.6, 2.6], [10, -4, 3, 2], [-4, -14, 2.4, 1.4]]) o.push(E(hx + x, hy + y, rx, ry, SC, no({ fl: 0.4, ink: -0.04 })));
  for (const [x, y] of [[1, -9], [12, -9]]) o.push(E(hx + x, hy + y, 1, 0.9, SK, no({ ink: 0.2 })));
  for (const [x, y, dx] of [[15, -6, 2], [17, -2, 2.4], [16, 2, 2]]) o.push(K(hx + x, hy + y, hx + x + dx, hy + y - 2, 0.5, 0.2, BD, { ink: -0.2 }));
  // the ear, turned to you: he listens
  o.push(E(hx + 14, hy + 3, 3.4, 5.2, SK, { ink: -0.06 }), E(hx + 13.6, hy + 3.2, 1.6, 3, SK, no({ fl: 0.6, ink: -0.36 })));
  // the brow, bare of hair, burnt
  o.push(K(hx - 14, hy - 1, hx + 4, hy - 2, 2.4, 2, SK, no({ ink: 0.06 })));
  // the soot smeared across the eyes, and the eyes gone milky in it
  o.push(K(hx - 15, hy + 2.4, hx + 6, hy + 1.6, 3.6, 3.4, SM, no({ ink: -0.1 })));
  o.push(E(hx - 12, hy + 4.6, 2.4, 1.6, SM, no({ ink: -0.1 })), E(hx + 2, hy + 4.4, 2.6, 1.6, SM, no({ ink: -0.14 })));
  o.push(E(hx - 8.4, hy + 2.6, 2.2, 1.5, MI, NO), E(hx + 1.6, hy + 2.2, 1.9, 1.4, MI, no({ ink: -0.1 })));
  o.push(E(hx - 8, hy + 2.8, 0.8, 0.8, MI, no({ ink: -0.26 })), E(hx + 2, hy + 2.6, 0.7, 0.7, MI, no({ ink: -0.3 })));
  // the nose, broken and hooked
  o.push(K(hx - 3, hy + 2, hx - 7.4, hy + 9, 1.6, 2.4, SK, no({ ink: 0.06 })));
  o.push(E(hx - 7, hy + 9.4, 2.6, 2, SK, no({ ink: 0.04 })), X(hx - 6.6, hy + 10.6, 1.2, 0.7, PIT + ':1'));
  // the mouth, open: a snarl of broken teeth
  o.push(P([hx - 13, hy + 12, hx - 6, hy + 11.4, hx - 1, hy + 12.6, hx - 2, hy + 17.6, hx - 7, hy + 18.6, hx - 12, hy + 16.4], PIT));
  for (const [x, h] of [[-11.6, 1.6], [-9.4, 2.2], [-5.6, 1.4], [-3.4, 2]]) o.push(X(hx + x, hy + 12, 1.4, h, 'scr_wretchTooth:3'));
  for (const [x, h] of [[-10.4, 1.4], [-6.4, 1.8]]) o.push(X(hx + x, hy + 17 - h, 1.3, h, 'scr_wretchTooth:2'));
  // the beard, burnt short: a scorched stubble on the jaw
  o.push(P([hx - 14, hy + 14, hx - 12, hy + 19, hx - 6, hy + 21, hx + 2, hy + 19, hx + 7, hy + 13, hx + 6, hy + 18, hx + 1, hy + 21.6, hx - 6, hy + 23, hx - 12, hy + 21.4, hx - 15, hy + 17], BD, { bv: 1.2, ink: -0.1 }));
  for (let i = 0; i < 6; i++) o.push(X(hx - 13 + hash2(i, 51) * 18, hy + 18 + hash2(i, 53) * 4, 0.8, 0.8, BD + ':1'));
  // the iron collar, the broken chain hanging from it
  o.push(strand(hx - 6, hy + 22, hx + 6, hy + 28, hx + 18, hy + 22, 2.4, 2.4, IR, 5, { ink: -0.06 }));
  o.push(E(hx + 4, hy + 26.4, 1.4, 1.4, IR, { ink: 0.1 }));
  for (let i = 0; i < 3; i++) {
    const x = hx + 3 + s * 0.2 * i, y = hy + 30 + i * 4.2;
    o.push(E(x, y, i % 2 ? 1 : 2, 2.4, IR, { ink: -0.1 }), E(x, y, i % 2 ? 0.3 : 1, 1.3, PIT));
  }

  // the near arm flung up, the hammer swung blind
  o.push(K(78, 54 + by, 86, 34, 6, 5, SO, { ink: -0.1 })); // the upper arm
  o.push(K(86, 34, 80, 20, 4.6, 3.8, SO, { ink: -0.04 })); // the forearm
  for (const [x, y] of [[82, 44], [84, 28]]) o.push(E(x, y, 1.6, 1, SC, no({ fl: 0.5 })));
  const hdx = 0.33, hdy = -0.94, cx = 86 + s * 0.3, cy = 2;
  o.push(K(79, 26, cx, cy + 3, 1.3, 1.2, 'scr_wretchHaft', { ink: -0.1 }));
  const cr = (u: number, w: number): number[] => [cx - hdy * u + hdx * w, cy + hdx * u + hdy * w];
  o.push(P([...cr(-7, -3.4), ...cr(7, -3.4), ...cr(7, 3.4), ...cr(-7, 3.4)], IR, { bv: 1.4 }));
  o.push(fist(80, 20, hdx, hdy, 1, SO, 1, -0.02));
  // embers off the forge
  for (let i = 0; i < 5; i++) {
    const y = 92 - ((hash2(i, 31) * 70 + f * 6) % 70), x = 4 + hash2(i, 37) * 22 + (92 - y) * 0.1 + sway(f + i) * 0.5;
    o.push(X(x, y, 0.8, 0.8, i % 2 ? 'emFire:5' : 'emFireCore:5', { em: true }));
  }
  o.push(Lt(6, 72, 92, '#ff8a3c', 1.45 * fl, 14));
  return o;
}
