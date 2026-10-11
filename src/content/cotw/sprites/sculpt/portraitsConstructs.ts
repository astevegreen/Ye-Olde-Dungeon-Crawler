import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9f, group D: the constructs ("made, not born"). The Bark-Husk Miner, the Bellows-Automaton, the Prismatic Mirror-Skulker. Conventions: portraitKit.ts. */

const NO: PrimOptions = { occ: false };
const no = (o: PrimOptions): PrimOptions => ({ occ: false, ...o });

/** A lower half-ellipse arc as capsules: an iron hoop round a trunk seen from a little above. */
function hoop(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, r: number, m: string, o?: PrimOptions): Out {
  const out: Out = [];
  let px: number | null = null, py: number | null = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n), x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (px !== null && py !== null) out.push(K(px, py, x, y, r, r, m, o));
    px = x; py = y;
  }
  return out;
}

const onHoop = (cx: number, cy: number, rx: number, ry: number, a: number): Pt => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];

function flatten(list: PrimTree, out: Prim[] = []): Prim[] {
  for (const p of list) {
    if (!p) continue;
    if (Array.isArray(p)) flatten(p as PrimTree, out);
    else out.push(p as Prim);
  }
  return out;
}

/** Rotate (ang) and scale (k) a list of prims in place about (px, py); returns the same mapping for points. */
function place(list: PrimTree, px: number, py: number, ang: number, k: number, dx = 0, dy = 0): (x: number, y: number) => Pt {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pt = (x: number, y: number): Pt => [px + dx + ((x - px) * c - (y - py) * s) * k, py + dy + ((x - px) * s + (y - py) * c) * k];
  for (const q of flatten(list)) {
    if (q.t === 'E') { [q.cx, q.cy] = pt(q.cx, q.cy); q.rx *= k; q.ry *= k; q.a = (q.a || 0) + ang; }
    else if (q.t === 'K') { [q.x1, q.y1] = pt(q.x1, q.y1); [q.x2, q.y2] = pt(q.x2, q.y2); q.r1 *= k; q.r2 *= k; }
    else if (q.t === 'P') {
      const p2: number[] = [];
      for (let i = 0; i < q.pts.length; i += 2) p2.push(...pt(q.pts[i], q.pts[i + 1]));
      q.pts = p2;
      if (q.bv) q.bv *= k;
      if (q.n) q.n = [q.n[0] * c - q.n[1] * s, q.n[0] * s + q.n[1] * c, q.n[2]];
    } else if (q.t === 'X') { const [x, y] = pt(q.x + q.w / 2, q.y + q.h / 2); q.x = x - q.w / 2; q.y = y - q.h / 2; }
    else if (q.t === 'L') { [q.x, q.y] = pt(q.x, q.y); q.r *= k; }
  }
  return pt;
}

// ======================================================== BARK-HUSK MINER
/**
 * A trunk hollowed and hooped in iron, set to dig at the World Tree's root. Like Ask and
 * Embla before the gods' gifts it has no breath, no wit, no blood: where a face should be,
 * a slot; where blood should run, sap, and the sap is what lights it. Hunched, the head
 * sunk between the shoulders under a miner's iron cap pulled low, the pick-arm raised.
 */
export function barkHuskMinerPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 1.1, 0.9, 1.05][f % 4]; // the sap swells and ebbs
  const o: Out = [];
  const BG = 'scr_gBarkHusk', BK = 'scr_barkHuskBark', HW = 'scr_barkHuskHeart', HO = 'scr_barkHuskHollow', SP = 'scr_barkHuskSap', LC = 'scr_barkHuskLichen', IR = 'scr_barkHuskIron', RU = 'scr_barkHuskRust';
  // the gallery: hewn rock, pick-scars, roots of the World Tree hanging through the roof
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 36, 58, 50, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(42, 30, 30, 24, BG, { fl: 1, ink: BAND[3] - 0.1 }));
  for (const [x, y] of [[64, 10], [70, 20], [8, 40], [88, 46]]) for (let i = 0; i < 3; i++) o.push(K(x + i * 2.2, y + i * 0.6, x + i * 2.2 + 3, y + i * 0.6 + 5, 0.5, 0.4, BG, { ink: BAND[1] + 0.06 }));
  for (const [x0, x1, x2, len] of [[30, 28, 31, 14], [56, 54, 57, 24], [80, 82, 78, 30], [94, 96, 92, 18]]) o.push(strand(x0, -1, x1, len * 0.5, x2 + s * 0.2, len, 1.2, 0.4, BG, 4, { ink: BAND[1] + 0.04 }));

  const by = -b * 0.5;
  // the knuckle-arm, down at the right, leaning on its fist out of the picture
  o.push(K(86, 64, 92, 99, 9.6, 9, BK, { ink: -0.34 }));
  o.push(hoop(90.4, 88, 9, 2.4, 0.1, Math.PI - 0.1, 5, 1, IR, NO));
  // the trunk, hunched: the far shoulder a burl with a limb snapped off it, the chest, the near shoulder
  o.push(K(84, 50 + by, 95, 30 + by, 5.4, 4, BK, { ink: -0.16 })); // the snapped limb
  o.push(P([91, 31 + by, 93, 27 + by, 95, 30 + by, 97, 26 + by, 99, 33 + by, 98, 35 + by, 92, 34 + by], HW, { bv: 0.8, ink: -0.14 })); // its splintered end
  o.push(E(80, 62 + by, 20, 18, BK, { fl: 0.25, ink: -0.1 }));
  o.push(E(46, 98 + by, 48, 46, BK, { fl: 0.2, ink: -0.04 }));
  o.push(E(16, 66 + by, 18, 15, BK, { fl: 0.3, ink: -0.06 }));
  // fissures in the bark, forking
  for (let i = 0; i < 16; i++) {
    const x = 4 + hash2(i, 11) * 90, y = 66 + hash2(i, 13) * 26, len = 7 + hash2(i, 15) * 9, d = (hash2(i, 17) - 0.5) * 4;
    if (Math.abs(x - 44) < 9) continue;
    o.push(strand(x, y, x + d, y + len * 0.5, x + d * 0.4, y + len, 0.45, 0.85, BK, 2, no({ ink: -0.5 })));
    if (hash2(i, 19) > 0.5) o.push(K(x + d * 0.6, y + len * 0.5, x + d * 0.6 + 3, y + len * 0.8, 0.5, 0.3, BK, no({ ink: -0.46 })));
  }
  for (const [x0, y0, x1, y1] of [[8, 58, 6, 70], [16, 54, 18, 66], [26, 58, 28, 68], [70, 48, 68, 62], [80, 46, 82, 62], [90, 50, 92, 66]]) o.push(K(x0, y0 + by, x1, y1 + by, 0.5, 0.8, BK, no({ ink: -0.5 })));
  // lichen crusting the shoulders, grey-green and flat; a beard of it hanging
  for (const [x, y, rx, ry, a] of [[72, 47, 4.4, 1.6, -0.3], [77, 45, 2.6, 1.2, -0.1], [86, 47, 3.4, 1.4, 0.3], [10, 53, 4.2, 1.5, -0.3], [16, 51.4, 2.4, 1, -0.1]]) {
    o.push(E(x, y + by, rx, ry, LC, no({ fl: 0.85, a, ink: -0.18 })), E(x + rx * 0.5, y + 0.8 + by, rx * 0.5, ry * 0.8, LC, no({ fl: 0.85, a, ink: -0.3 })));
  }
  for (const [x, y, len] of [[88, 48, 8], [74, 48.6, 5]]) o.push(strand(x, y + by, x + 0.6 + s * 0.2, y + len * 0.5 + by, x - 0.4 + s * 0.4, y + len + by, 0.6, 0.25, LC, 3, { ink: -0.3 }));

  // the split down the chest, sap welling in it: pale wood at the lips, the glow inside
  const sx = 44;
  const lips = [sx + 1, 62, sx + 5, 67, sx + 3.4, 72, sx + 6.6, 78, sx + 3.8, 85, sx + 6.4, 91, sx + 3.6, 99, sx - 5, 99, sx - 2.2, 90, sx - 5.4, 83, sx - 2, 76, sx - 4.4, 70, sx - 1.6, 65];
  o.push(P(lips, HW, { bv: 1.4, ink: -0.1 }));
  const core = [sx + 0.8, 64.6, sx + 3, 68, sx + 1.6, 72.4, sx + 4.4, 78, sx + 2, 85, sx + 4, 91, sx + 1.6, 99, sx - 2.6, 99, sx - 0.6, 90, sx - 3.2, 83, sx, 76, sx - 2.4, 70.4, sx - 0.2, 66.4];
  o.push(P(core, SP, { ink: -0.16 + (g - 1) * 0.6 }));
  o.push(K(sx + 0.6, 67, sx + 1.6, 76, 0.55, 0.8, SP, { ink: 0.32 }), K(sx + 1.4, 80, sx + 1, 97, 0.8, 0.6, SP, { ink: 0.32 }));
  // sap run out over the bark, a drop sliding down
  o.push(K(sx + 5, 70, sx + 6, 76.6, 0.6, 0.45, SP, { ink: -0.12 }), K(sx - 4.8, 86, sx - 6, 93, 0.6, 0.4, SP, { ink: -0.12 }));
  o.push(E(sx - 6.1, 93.4 + f * 0.6, 0.8, 1.1, SP, { ink: 0.06 }));
  // the iron hoops, beaten on over the split, the bark bulging past them
  o.push(hoop(46, 72 + by, 48, 8, 0.12, Math.PI - 0.12, 10, 1.7, IR));
  o.push(hoop(46, 72.6 + by, 48, 8, 0.4, Math.PI - 0.4, 8, 0.45, IR, no({ ink: 0.3 })));
  o.push(hoop(46, 92, 52, 8, 0.2, Math.PI - 0.2, 10, 1.8, IR));
  for (const a of [0.5, 1.2, 2.0, 2.6]) { const [x, y] = onHoop(46, 72 + by, 48, 8, a); o.push(X(x - 0.6, y - 1, 1.2, 1.2, 'steel:4')); }
  for (const a of [0.7, 1.4, 2.3]) { const [x, y] = onHoop(46, 92, 52, 8, a); o.push(X(x - 0.6, y - 1, 1.2, 1.2, 'steel:3')); }
  for (const [a, r] of [[0.9, 1.6], [2.3, 1.3]]) { const [x, y] = onHoop(46, 72 + by, 48, 8, a); o.push(E(x, y + 0.6, r * 1.4, r, RU, { fl: 0.6 })); }

  // the head, sunk between the shoulders, turned a little to the left
  const hx = 39, hy = 50 + by, h: Out = [];
  h.push(E(hx + 2, hy + 11, 21, 9, BK, { fl: 0.6, ink: -0.6 })); // the dark it sinks into
  h.push(E(hx, hy + 1, 15, 13, BK, { fl: 0.22, ink: -0.06 }));
  h.push(E(hx + 9, hy + 3, 5, 9, BK, { fl: 0.6, ink: -0.3 })); // the far side, turned away
  h.push(E(hx - 1, hy + 8.4, 12, 6.4, BK, { fl: 0.3, ink: -0.04 })); // a heavy jaw
  // the slot where a face should be, cut in a scowl; the sap seen through it for eyes
  h.push(P([hx - 13, hy - 2.4, hx - 1.4, hy + 1.6, hx + 11, hy - 2.8, hx + 11.4, hy + 1.2, hx - 1.4, hy + 5.4, hx - 13.4, hy + 1.4], HO));
  h.push(E(hx - 7, hy + 1.2, 2.8, 1.05, SP, { a: 0.3, ink: (g - 1) * 0.5 }), E(hx + 5.2, hy + 1, 2.4, 0.95, SP, { a: -0.32, ink: (g - 1) * 0.5 - 0.05 }));
  h.push(X(hx - 8, hy + 0.2, 1, 0.9, '#f6ffd2', { em: true }), X(hx + 4.6, hy + 0.1, 0.8, 0.8, '#f6ffd2', { em: true }));
  h.push(Lt(hx - 1, hy + 2, 12, '#cddc52', 0.5 * g, 3));
  // the brow of bark over it, scowling down to the middle
  h.push(K(hx - 14, hy - 3.8, hx - 1.4, hy + 0.2, 1.7, 1.3, BK, no({ ink: 0.04 })), K(hx - 1.4, hy + 0.2, hx + 12, hy - 4.2, 1.3, 1.5, BK, no({ ink: -0.06 })));
  // a crack down the jaw, a thread of sap in it
  h.push(K(hx - 1.4, hy + 5, hx - 0.4, hy + 9, 0.7, 0.6, HO, NO), K(hx - 0.4, hy + 9, hx - 2, hy + 14.4, 0.6, 0.4, HO, NO));
  h.push(K(hx - 1.2, hy + 6, hx - 0.6, hy + 9, 0.25, 0.25, SP, no({ ink: -0.3 })));
  for (const [x0, y0, x1, y1] of [[-9, 6, -11, 11], [7, 5, 9, 10], [-6, 9, -6.4, 13]]) h.push(K(hx + x0, hy + y0, hx + x1, hy + y1, 0.4, 0.3, BK, no({ ink: -0.48 })));
  // the miner's iron cap pulled low: a dented dome, its brim over the slot, riveted and rusting
  const cy = hy - 4, dome: number[] = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; dome.push(hx - 0.6 + Math.cos(a) * 16.4, cy + Math.sin(a) * 14.4); }
  h.push(P(dome, IR, { bv: 6, n: [0, -0.1, 1] }));
  h.push(K(hx - 4, cy - 13.8, hx - 6.4, cy - 1.6, 0.9, 1.1, IR, no({ ink: 0.1 }))); // the ridge
  h.push(E(hx + 6.6, cy - 7.4, 2.6, 1.8, IR, { fl: 0.7, ink: -0.3 })); // a dent beaten into it
  for (const [x, y, rx, ry] of [[-9, -5, 2.4, 1.4], [8, -3, 1.6, 1.1], [-2, -11, 1.4, 1]]) h.push(E(hx + x, cy + y, rx, ry, RU, no({ fl: 0.7, ink: -0.1 })));
  h.push(P([hx - 19.4, cy, hx + 17.6, cy - 1.4, hx + 16.8, cy + 1.8, hx - 18.6, cy + 3.4], IR, { bv: 1.2, n: [0, 0.3, 0.95] }));
  for (const t of [0.06, 0.3, 0.55, 0.8]) h.push(X(hx - 18.6 + 35 * t - 0.5, cy + 0.6 - 1.4 * t, 1, 1, 'steel:5'));
  place(h, hx, hy + 6, 0, 1.18);
  o.push(h);

  // the pick-arm, raised over the head at the left: the bark forearm, the haft driven into it and banded
  const ps = s * 0.3;
  o.push(K(18, 66 + by, 6, 84, 9, 8, BK, { ink: -0.16 }));
  o.push(K(6, 84, 12 + ps, 42, 7.4, 6, BK, { ink: -0.06 }));
  o.push(K(8.6, 80, 10 + ps, 50, 0.5, 0.5, BK, no({ ink: -0.5 })), K(14, 76, 15 + ps, 54, 0.4, 0.4, BK, no({ ink: -0.46 })));
  o.push(hoop(12 + ps, 47, 6.6, 1.8, 0.1, Math.PI - 0.1, 5, 1.3, IR), hoop(8.4, 68, 7.4, 2, 0.1, Math.PI - 0.1, 5, 1.3, IR));
  o.push(K(12 + ps, 44, 15 + ps, 13, 2.2, 2, 'woodDark'));
  // the pick's head: one point over the cap, the other down past the shoulder
  const px = 15 + ps, py = 11;
  o.push(K(px, py, px + 27, py - 5, 2.8, 0.3, 'steel', { ink: -0.08 }), K(px, py, px - 15, py + 11, 2.8, 0.4, 'steel', { ink: -0.14 }));
  o.push(K(px + 2.6, py - 2.6, px + 23, py - 6, 0.4, 0.3, 'steel', no({ ink: 0.4 }))); // the edge, catching the light
  o.push(E(px, py, 3.4, 3.4, IR, { ink: 0.04 }));
  // the sap's light, from the split, up into the face
  o.push(Lt(sx, 80, 40, '#cddc52', 0.95 * g, 10));
  return o;
}

// ======================================================== BELLOWS-AUTOMATON
/**
 * The dwarves' bellows, made to blow on its own. In Skáldskaparmál Brokkr works Eitri's
 * bellows and must not stop; Loki, a fly, stings his eyelid, the bellows falter, and
 * Mjölnir's handle comes out short. This is the answer to that: a bellows that needs no
 * hand, walking on brass bird-legs. Its handles stick out bare behind; its firebox is the
 * only fire left in the cold forge, and the draught-port over the nozzle burns like an
 * eye. It lowers the nozzle at you like a beak.
 */
export function bellowsAutomatonPortrait(f: number): PrimTree {
  const b = breath(f);
  const op = b * 0.9; // the top board lifts as it breathes
  const fl = [1, 1.12, 0.92, 1.06][f % 4]; // the firebox flickers
  const o: Out = [];
  const BG = 'scr_gBellows', HD = 'scr_bellowsHide', BR = 'scr_bellowsBrass', SO = 'scr_bellowsSoot', PT = 'scr_bellowsPit';
  // the cold forge: dressed stone, the hood over a dead hearth
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 52, 62, 54, BG, { fl: 1, ink: BAND[2] }));
  for (const y of [20, 36, 52, 68, 84]) o.push(K(-2, y, 98, y, 0.5, 0.5, BG, { ink: BAND[1] + 0.06 }));
  for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) { const x = ((r % 2) * 13 + i * 26 + 6) % 104 - 4, y = 4 + r * 16; o.push(K(x, y, x, y + 15, 0.5, 0.5, BG, { ink: BAND[1] + 0.06 })); }
  o.push(P([54, -1, 98, -1, 98, 30, 90, 22, 62, 22], BG, { ink: BAND[1] })); // the forge hood
  o.push(P([58, 22, 94, 22, 98, 30, 98, 34, 54, 34], BG, { ink: BAND[1] - 0.06 }));

  const B: Out = [];
  // the far leg, behind
  B.push(K(60, 62, 70, 74, 3, 2.6, BR, { ink: -0.4 }), K(70, 74, 64, 92, 2.6, 2, BR, { ink: -0.4 }));
  B.push(E(70, 74, 3, 3, 'iron', { ink: -0.34 }));
  for (const [dx, dy] of [[-6, 2.2], [5, 2.6], [0, 3.4]]) B.push(K(64, 92, 64 + dx, 92 + dy, 1.2, 0.3, BR, { ink: -0.36 }));
  // the stack
  B.push(K(36, 34 - op, 35, 22, 3.2, 3.8, 'iron', { ink: -0.06 }));
  for (const y of [26, 30]) B.push(K(31.4, y, 39.4, y + 0.2, 0.6, 0.6, 'blackIron'));
  B.push(E(35, 21, 5.4, 2, 'blackIron'), E(35, 20.4, 3.6, 1, PT));
  // the bottom board, its handle bare behind
  B.push(K(10, 62, -3, 66, 1.8, 1.6, 'woodDark', { ink: -0.06 }));
  B.push(P([8, 58, 74, 55, 75, 60, 9, 64], 'woodDark', { bv: 1.4, ink: -0.08 }));
  // the leather: pleats spreading from the nozzle, its back edge zig-zagging out past the boards
  const ya = 36 - op, yb = 58, nz = 4, back: Array<[number, number]> = [];
  for (let i = 0; i <= nz; i++) {
    back.push([12, ya + ((yb - ya) * i) / nz]);
    if (i < nz) back.push([2 - op * 0.4, ya + ((yb - ya) * (i + 0.5)) / nz]);
  }
  const hide: number[] = [70, 45];
  for (const [x, y] of back) hide.push(x, y);
  hide.push(70, 56);
  B.push(P(hide, HD, { bv: 2.6 }));
  // each pleat: lit on its upper face, shadowed on its lower, the creases running to the hinge
  for (let i = 0; i < nz; i++) {
    const y1 = ya + ((yb - ya) * (i + 1)) / nz, ym = ya + ((yb - ya) * (i + 0.5)) / nz, x0 = 2 - op * 0.4;
    B.push(P([x0, ym, 12, y1, 66, 52 + (y1 - 47) * 0.25, 66, 50 + (ym - 47) * 0.2], HD, { n: [0.1, 0.55, 0.83], ink: -0.24 }));
    B.push(K(12.6, y1, 64, 50.6 + (y1 - 47) * 0.22, 0.5, 0.3, HD, no({ ink: -0.52 })));
  }
  B.push(E(28, 50, 3, 1.6, SO, no({ fl: 0.8, ink: -0.2 })), E(46, 47, 2.4, 1.2, SO, no({ fl: 0.8, ink: -0.2 }))); // soot on the leather
  // the top board, hinged at the nozzle, brass studs along it, its handle bare behind
  B.push(K(8, 34 - op, -4, 28 - op * 1.4, 1.8, 1.6, 'wood', { ink: 0.02 }));
  B.push(P([6, 32 - op, 72, 42, 73, 47, 7, 38 - op], 'wood', { bv: 1.4, n: [0, -0.35, 0.94] }));
  for (const t of [0.12, 0.34, 0.56, 0.78]) B.push(E(6 + 66 * t, 35.6 - op * (1 - t) + 7.4 * t, 1.1, 0.9, BR, { ink: 0.1 }));
  // the hinge-block, the beak of a nozzle, the draught-port burning in its side
  B.push(P([62, 40, 74, 39, 79, 44, 79, 57, 74, 62, 62, 61], 'blackIron', { bv: 2.6 }));
  for (const y of [42, 59]) B.push(K(62, y, 76, y - 0.4, 1, 1, 'iron', { ink: 0.02 }));
  for (const [x, y] of [[64.6, 42], [74, 41.6], [64.6, 59], [74, 58.6]]) B.push(X(x - 0.5, y - 0.6, 1, 1, 'iron:5'));
  B.push(K(77, 50, 97, 55.6, 6.4, 2.4, BR, { ink: 0.02 }));
  B.push(K(79, 45.6, 95, 52.4, 0.6, 0.4, BR, no({ ink: 0.34 }))); // its top, lit
  for (const t of [0.12, 0.55]) { const x = 77 + 20 * t, y = 50 + 5.6 * t, r = 6.4 - 4 * t + 0.3; B.push(K(x, y - r, x, y + r, 0.9, 0.9, 'blackIron')); }
  B.push(K(90, 53.6, 98, 56, 3.2, 2.6, 'blackIron', { ink: -0.06 })); // the tip, burnt black
  B.push(E(98.6, 56.2, 1.4, 2.2, PT));
  // the port
  B.push(E(70, 50, 4.8, 4.8, 'iron', { ink: 0.06 }), E(70, 50, 3.4, 3.4, PT));
  B.push(E(70.3, 50.4, 2.4, 2, 'emFire', { ink: (fl - 1) * 0.6 }), E(70.4, 50.6, 1.2, 1, 'emFireCore', { ink: (fl - 1) * 0.4 }), X(69.2, 49, 0.9, 0.9, '#fff0c8', { em: true }));
  B.push(K(64, 44, 76, 45.4, 1.3, 1.1, 'blackIron', { ink: 0.1 })); // an iron lid over it, a brow
  B.push(Lt(70, 50, 10, '#ff8a2c', 0.55 * fl, 3));
  // the firebox under the belly, its grille alight
  B.push(P([30, 64, 60, 62, 59, 80, 31, 81], BR, { bv: 1.8, n: [0, 0.1, 1], ink: -0.1 }));
  B.push(P([33, 66.4, 57, 64.6, 56.4, 77.6, 33.6, 78.4], PT));
  B.push(P([34, 70, 56, 68.6, 55.6, 77.4, 34.4, 78], 'emFire', { ink: (fl - 1) * 0.5 - 0.06 }));
  B.push(P([36, 74, 54, 73, 54, 77, 36, 77.6], 'emFireCore', { ink: (fl - 1) * 0.4 }));
  for (const x of [38, 43, 48, 53]) B.push(K(x, 65.6 - (x - 33) * 0.07, x, 78.4, 0.8, 0.8, 'blackIron'));
  B.push(K(31, 64.4, 59.6, 62.4, 1, 1, 'blackIron', { ink: 0.04 }));
  // the near leg: brass, a bird's, bent back at the hock, ringed like a bird's shank; talons
  B.push(K(36, 66, 25, 79, 3.4, 2.8, BR, { ink: -0.06 }), K(25, 79, 32, 93, 2.8, 2, BR, { ink: -0.02 }));
  for (const t of [0.3, 0.55, 0.8]) B.push(K(25 + 7 * t - 2.6, 79 + 14 * t - 0.2, 25 + 7 * t + 2.4, 79 + 14 * t + 0.6, 0.35, 0.35, BR, no({ ink: -0.42 })));
  B.push(E(25, 79, 3.2, 3.2, 'iron'));
  for (const [dx, dy] of [[-7, 2.4], [6, 2.8], [0.6, 3.6]]) B.push(K(32, 93, 32 + dx, 93 + dy, 1.4, 0.6, BR), K(32 + dx, 93 + dy, 32 + dx * 1.2, 93 + dy + 1.6, 0.6, 0.2, 'blackIron'));
  B.push(Lt(45, 74, 56, '#ff8a2c', 1.15 * fl, 12));
  const pt = place(B, 48, 52, 0.14, 1.04, -4, 2);
  o.push(B);

  // soot rolling off the stack, up into the hood
  const [stx, sty] = pt(35, 19), sk = f * 0.7;
  for (const [x, y, r, k] of [[0, -4, 3.6, -0.06], [3, -9, 4.6, -0.1], [-2, -14, 5, -0.16], [5, -17, 4, -0.2], [9, -12, 3, -0.12], [-6, -19, 3.4, -0.24]]) {
    o.push(E(stx + x + sk * 0.5, sty + y - sk, r, r * 0.84, SO, { fl: 0.25, ink: k }));
  }
  // a curl of soot at the nozzle, and embers spat from the grille
  const [nx, ny] = pt(99, 56);
  o.push(E(nx - 1 + f * 0.5, ny + 4 + f * 0.3, 2.4, 1.9, SO, { fl: 0.3, ink: -0.1 }), E(nx + 1.4 + f * 0.6, ny + 7 + f * 0.4, 1.6, 1.3, SO, { fl: 0.3, ink: -0.2 }));
  for (let i = 0; i < 3; i++) {
    const h1 = hash2(i + f * 3, 41), h2 = hash2(i + f * 3, 43);
    o.push(X(34 + h1 * 22, 87 + h2 * 7, 0.8, 0.8, i % 2 ? 'emFire:5' : 'emFireCore:5', { em: true }));
  }
  return o;
}

// ===================================================== PRISMATIC MIRROR-SKULKER
/**
 * A crawler cut from glass and mirror in the obsidian of the Siphon, set to gather the
 * stolen sun. Grímnismál says a shield, Svalinn, stands before the sun and keeps the world
 * from burning; this is that shield turned: facets that catch every light and a lens that
 * pours it into one searing point. The lens is its one eye; the prism-spines on its back
 * turn to feed it, each throwing its sliver of rainbow, and a foreleg is up to strike.
 */
export function mirrorSkulkerPortrait(f: number): PrimTree {
  const b = breath(f);
  const g = [1, 1.1, 0.94, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gMirrorSkulker', SM = 'scr_mirrorSkulkerSeam', GL = 'scr_mirrorSkulkerGlass', DK = 'scr_mirrorSkulkerDark', QZ = 'scr_mirrorSkulkerQuartz', SU = 'scr_mirrorSkulkerSun';
  // obsidian: glassy spires in the dark, a polished floor, a seam of magma in it
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 46, 60, 50, BG, { fl: 1, ink: BAND[2] }));
  o.push(P([-2, 74, 6, 26, 12, 22, 18, 74], BG, { ink: BAND[2] + 0.06 }), P([6, 26, 12, 22, 14, 74, 8, 74], BG, { ink: BAND[1] + 0.08 }));
  o.push(P([78, 74, 86, 16, 92, 12, 98, 74], BG, { ink: BAND[2] + 0.04 }), P([86, 16, 92, 12, 90, 74, 82, 74], BG, { ink: BAND[3] - 0.12 }));
  o.push(P([-2, 76, 30, 74, 66, 75, 98, 73, 98, 97, -2, 97], BG, { ink: BAND[1] + 0.06 }));
  const seam: Pt[] = [[-2, 90], [10, 87], [18, 89], [30, 86], [40, 88], [56, 85.6], [66, 88], [78, 86], [88, 89], [98, 87]];
  for (let i = 0; i < seam.length - 1; i++) o.push(K(...seam[i], ...seam[i + 1], 0.7, 0.7, SM, { ink: BAND[3] }));
  for (const i of [2, 5, 7]) o.push(K(...seam[i], seam[i][0] + 2, seam[i][1] + 4, 0.5, 0.3, SM, { ink: BAND[2] }));

  const by = -b * 0.4;
  const cx = 46, cy = 54 + by;
  const leg = (x0: number, y0: number, kx: number, ky: number, fx: number, fy: number, ink: number, m: string = GL): Out => [
    P([x0, y0 - 1.8, kx, ky - 0.9, kx + 1.3 * Math.sign(kx - x0), ky + 1.5, x0, y0 + 2], m, { bv: 1, ink }),
    P([kx - 1.5, ky + 0.4, kx + 1.5, ky + 0.4, fx, fy], m, { bv: 0.8, ink }),
  ];
  // the far legs, splayed, their points in the obsidian
  o.push(leg(cx + 18, cy + 4, 86, 34, 94, 80, -0.32, DK), leg(cx - 14, cy + 6, 16, 44, 6, 80, -0.36, DK));
  o.push(leg(cx + 14, cy + 8, 76, 46, 82, 84, -0.18), leg(cx - 10, cy + 8, 22, 52, 18, 86, -0.2));
  // the prism-spines on its back, leaning to the lens; a spectrum down each lit edge
  const o2: Out = [];
  const spine = (x: number, y: number, tx: number, ty: number, w: number, ink: number): Out => {
    const L = Math.hypot(tx - x, ty - y), ux = (tx - x) / L, uy = (ty - y) / L, nx = -uy, ny = ux;
    const a = [x - nx * w, y - ny * w], c = [x + nx * w, y + ny * w], m = [x + ux * 1.2, y + uy * 1.2];
    const ta = [tx - ux * w * 1.8 - nx * w * 0.8, ty - uy * w * 1.8 - ny * w * 0.8], tc = [tx - ux * w * 1.8 + nx * w * 0.8, ty - uy * w * 1.8 + ny * w * 0.8], tm = [tx - ux * w * 1.4, ty - uy * w * 1.4];
    const out: Out = [
      P([...a, ...m, ...tm, ...ta], QZ, { n: [-0.62, -0.3, 0.72], ink }),
      P([...m, ...c, ...tc, ...tm], DK, { n: [0.62, -0.2, 0.76], ink }),
      P([...ta, ...tm, ...tc, tx, ty], QZ, { n: [0, -0.8, 0.6], ink: ink + 0.12 }),
    ];
    const sp = ['scr_mirrorSkulkerRose', 'scr_mirrorSkulkerLemon', 'scr_mirrorSkulkerCyan'];
    for (let i = 0; i < 3; i++) {
      const d = (i - 1) * 1.0, s0 = 0.25, s1 = 0.8;
      o2.push(K(a[0] + (ta[0] - a[0]) * s0 + nx * (1.2 + d), a[1] + (ta[1] - a[1]) * s0 + ny * (1.2 + d), a[0] + (ta[0] - a[0]) * s1 + nx * (1.2 + d), a[1] + (ta[1] - a[1]) * s1 + ny * (1.2 + d), 0.5, 0.5, sp[(i + f) % 3], no({ ink: -0.1 })));
    }
    return out;
  };
  o.push(spine(cx + 16, cy - 8, 84, 20, 3, -0.2));
  o.push(spine(cx - 6, cy - 12, 24, 4, 4.2, -0.04), spine(cx + 6, cy - 13, 62, 2, 4, -0.1));
  o.push(o2);
  // the body: a cut gem, every facet its own plane; some mirror the light, some the dark
  const rim: Pt[] = [[-24, 2], [-20, -8], [-10, -14], [0, -16], [10, -14], [20, -8], [24, 2], [18, 10], [8, 14], [-8, 14], [-18, 10]];
  const tbl: Pt[] = [[-9, -6], [0, -8], [9, -6], [10, 2], [0, 6], [-10, 2]];
  const R = (i: number): Pt => [cx + rim[i % 11][0], cy + rim[i % 11][1]], T = (i: number): Pt => [cx + tbl[i % 6][0], cy + tbl[i % 6][1]];
  o.push(P(rim.flatMap(([x, y]) => [cx + x, cy + y]), DK, { bv: 2 }));
  const facets: Array<[Pt[], string, [number, number, number]]> = [
    [[R(0), R(1), T(5)], GL, [-0.8, -0.2, 0.56]], [[R(1), R(2), T(0), T(5)], GL, [-0.55, -0.55, 0.62]], [[R(2), R(3), T(1), T(0)], DK, [-0.2, -0.75, 0.62]],
    [[R(3), R(4), T(2), T(1)], GL, [0.2, -0.75, 0.62]], [[R(4), R(5), T(2)], DK, [0.5, -0.5, 0.7]], [[R(5), R(6), T(3), T(2)], GL, [0.8, -0.2, 0.56]],
    [[R(6), R(7), T(3)], DK, [0.7, 0.4, 0.6]], [[R(7), R(8), T(4), T(3)], GL, [0.4, 0.6, 0.7]], [[R(8), R(9), T(4)], DK, [0, 0.7, 0.72]],
    [[R(9), R(10), T(5), T(4)], GL, [-0.4, 0.6, 0.7]], [[R(10), R(0), T(5)], DK, [-0.7, 0.35, 0.62]],
  ];
  for (const [pts, m, n] of facets) o.push(P(pts.flat(), m, { n, ink: -0.04 }));
  o.push(P(tbl.flatMap(([x, y]) => [cx + x, cy + y]), GL, { n: [-0.1, -0.35, 0.93], ink: 0.02 })); // the table
  // light skating over the upper facets; the magma seam mirrored in the lower ones
  o.push(K(cx - 18, cy - 5, cx - 11, cy - 11, 0.5, 0.4, GL, no({ ink: 0.45 })), K(cx + 12, cy - 11.4, cx + 18, cy - 6, 0.4, 0.3, GL, no({ ink: 0.36 })));
  o.push(K(cx - 18, cy + 9, cx - 9, cy + 12.6, 0.5, 0.5, 'scr_mirrorSkulkerSeam', no({ ink: 0.05 })), K(cx + 9, cy + 12.6, cx + 18, cy + 9, 0.5, 0.5, 'scr_mirrorSkulkerSeam', no({ ink: -0.05 })));
  // the near legs: one planted, one raised and drawn back to strike
  o.push(leg(cx + 12, cy + 10, 80, 56, 74, 92, 0));
  // the raised one: a thick upper shard to a knee held high, then a long blade hooked down at you
  const kx = 9, ky = 26 - b * 0.3;
  o.push(P([cx - 16, cy - 1, kx - 1, ky - 2.6, kx + 2.6, ky + 1.4, cx - 13, cy + 5], GL, { bv: 1.2, n: [-0.5, -0.5, 0.7], ink: 0.02 }));
  o.push(P([kx - 2.4, ky, kx + 2.8, ky - 0.6, 20, 44, 23, 52, 17.4, 45.4], GL, { bv: 1, n: [-0.6, 0.1, 0.8], ink: 0.06 }));
  o.push(P([kx + 2.8, ky - 0.6, 20, 44, 23, 52, 21.6, 43], DK, { n: [0.6, 0.1, 0.8], ink: -0.1 }));
  o.push(K(kx - 1.2, ky + 0.4, 18.6, 45, 0.4, 0.3, GL, no({ ink: 0.42 }))); // its edge, catching the sun
  // fangs of glass under the lens
  o.push(P([cx - 8, cy + 11, cx - 2.6, cy + 12, cx - 4.4, cy + 25], QZ, { bv: 0.6, n: [-0.3, 0.2, 0.93] }), P([cx + 2.6, cy + 12, cx + 8, cy + 11, cx + 4.4, cy + 25], DK, { bv: 0.6, n: [0.3, 0.2, 0.93] }));
  o.push(K(cx - 6.6, cy + 13, cx - 4.6, cy + 22, 0.35, 0.25, QZ, no({ ink: 0.4 })));
  // the lens: a mirror rim, the glass, the sun caught in it
  const lx = cx, ly = cy + 3;
  o.push(E(lx, ly, 10.4, 10, 'silver', { fl: 0.2, ink: -0.12 }));
  o.push(E(lx, ly, 8.2, 7.9, QZ, { fl: 0.4, ink: -0.2 }));
  o.push(E(lx, ly, 5.4 * g, 5.2 * g, SU, { ink: -0.2 }));
  o.push(E(lx, ly, 2.8, 2.7, SU, { ink: 0.2 }));
  o.push(X(lx - 0.6, ly - 0.6, 1.2, 1.2, '#ffffff', { em: true }));
  o.push(X(lx - 5, ly - 5.2, 1.4, 1, '#ffffff', { em: true })); // the glass's own glint
  // the point it pours the sun to: a four-rayed star, flaring
  const st = 4.2 + (g - 1) * 12;
  o.push(X(lx - st, ly - 0.35, st * 2, 0.7, '#fffbe6', { em: true }), X(lx - 0.35, ly - st, 0.7, st * 2, '#fffbe6', { em: true }));
  // prismatic glints wandering the facet edges
  const pc = ['#ff9ae8', '#9af0ff', '#fff59a', '#ffffff'];
  const spots: Pt[] = [[cx - 20, cy - 8], [cx - 10, cy - 14], [cx + 10, cy - 14], [cx + 20, cy - 8], [cx + 18, cy + 10], [cx - 18, cy + 10], [cx, cy - 16]];
  for (let i = 0; i < 3; i++) { const sp = spots[(i * 2 + f) % spots.length]; o.push(X(sp[0] - 0.6, sp[1] - 0.6, 1.2, 1.2, pc[(i + f) % 4], { em: true })); }
  o.push(Lt(lx, ly, 46, '#fff1ba', 1.1 * g, 8));
  return o;
}
