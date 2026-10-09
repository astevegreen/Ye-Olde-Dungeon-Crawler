import { E, K, P, X, Lt, Sh, T, arc, breath, sway, type Prim, type PrimTree } from './kit';
import { block, ell, glint, rune } from './fixture';
import './materials';

/*
 * The shrines altarModel draws beside the gods' altars: two of the Norns' three places (Urðr's
 * Pool is in altar.ts), Ratatoskr's roost and the duergar barrows. Same light, plinth and rune
 * treatment as the altars; each reads as its own place from across the room.
 */

type Out = PrimTree[number][];

const PI = Math.PI;
/** Thin strands: no outline, so the floor shows between them. */
const THIN = { ol: false, occ: false };

/** A star of the Norns, on Urðr's cycle: a glint, a spark, then a faint point, a frame each. */
function nornStar(x: number, y: number, k: number): Prim | Prim[] {
  if (k === 0) return glint(x, y, 0.85);
  if (k === 2) return X(x - 0.3, y - 0.3, 0.6, 0.6, 'fix_star:5', { em: true });
  return X(x - 0.25, y - 0.25, 0.5, 0.5, 'fix_starWater:5', { em: true, glow: false });
}

/** The Norns' footing: the stone of Urðr's stem cut as a low plinth, the sister's rune on its face in silver. */
function nornPlinth(name: 'wunjo' | 'sowilo', p: number): PrimTree {
  return [
    block(10, 23.8, 22, 29, 1.5, 'stone', { bv: 0.5 }),
    rune(name, 16, 26.4, 4.2, 'fix_silver', { ink: p * 0.08, r: 0.5 }),
    Lt(16, 26.4, 7, '#dde8ff', 0.6 + 0.1 * p),
  ];
}

/** Verðandi's Loom: a warp-weighted loom of living boughs, golden sap and black rot in its warp, the shuttle crossing it. ᚹ. */
function verdandi(f: number): PrimTree {
  const p = breath(f);
  const w = 'alt_heartwood';
  const out: Out = [
    Sh(16, 28.6, 13, 2.4, 0.5),
    // the uprights' roots, gripping the floor
    K(7.8, 26.6, 4.6, 28.6, 1.1, 0.45, w), K(8.6, 27.2, 10.4, 28.9, 0.8, 0.35, w),
    K(24.2, 26.6, 27.4, 28.6, 1.1, 0.45, w), K(23.4, 27.2, 21.6, 28.9, 0.8, 0.35, w),
    nornPlinth('wunjo', p),
    // two living boughs: the left one still in leaf, the right one's tip gone black
    K(7.8, 28, 8.8, 3.6, 1.35, 0.85, w),
    K(24.2, 28, 23.2, 3.6, 1.35, 0.85, w),
    K(8.7, 4.4, 10.6, 2.8, 0.4, 0.2, w),
    E(6.7, 3.1, 1.3, 0.62, 'alt_leaf', { a: -0.6 }), E(11.2, 2.6, 1.2, 0.58, 'alt_leaf', { a: 0.35 }),
    K(23.3, 4.2, 21.9, 2.6, 0.38, 0.15, 'alt_rot'),
    // the cloth beam across their forks
    K(5.0, 6.2, 16, 5.4, 1.05, 0.95, w), K(16, 5.4, 27, 6.2, 0.95, 1.05, w),
    // the web woven so far: a band of rot, a band of sap
    P([10, 6.6, 22, 6.6, 22, 12.6, 10, 12.6], 'alt_weave', { bv: 0.45 }),
    X(10.2, 7.9, 11.6, 0.5, 'alt_rot:2'),
    X(10.2, 11.5, 11.6, 0.5, 'alt_weave:1'),
  ];
  for (let i = 0; i < 12; i++) out.push(X(10.1 + i * 0.98, 9.4 + (i % 2) * 0.6, 0.98, 0.6, 'alt_sap:4', { em: true, glow: false }));
  // the warp: linen threads, some running with sap, some gone to rot, gathered onto the loom-weights
  const weights = [11.6, 14.6, 17.4, 20.4];
  [...'wswrwswrswr'].forEach((t, i) => {
    const x = 10.6 + i * 1.08;
    const j = Math.min(3, Math.floor(i / 2.75));
    const wx = weights[j] + (x - weights[j]) * 0.3;
    if (t === 's') out.push(K(x, 12.6, wx, 20.6, 0.3, 0.3, 'alt_sap', { ...THIN, ink: 0.12 * p - 0.06 }));
    else out.push(K(x, 12.6, wx, 20.6, 0.26, 0.26, t === 'r' ? 'alt_rot' : 'alt_weave', THIN));
  });
  for (const x of weights) out.push(E(x, 21.5, 1.2, 1.05, 'fix_paleStone'));
  out.push(
    K(8.6, 15.4, 23.4, 15.4, 0.45, 0.45, 'woodDark'), // the heddle rod
    // rot climbing the right bough, bracket fungus on it
    E(23.7, 18.8, 0.9, 2.6, 'alt_rot'),
    E(25.1, 14.0, 1.4, 0.55, 'alt_fungus'), E(25.0, 15.9, 1.0, 0.45, 'alt_fungus'),
  );
  // the shuttle runs across and back with the heartbeat, laying a gold weft
  const sx = 11.6 + 8.8 * p;
  const sy = 18;
  if (sx > 12.4) out.push(K(10.2, sy, sx - 1.6, sy, 0.26, 0.26, 'alt_sap', THIN));
  out.push(
    P([sx - 2.6, sy, sx - 1, sy - 0.85, sx + 1, sy - 0.85, sx + 2.6, sy, sx + 1, sy + 0.85, sx - 1, sy + 0.85], 'bone', { bv: 0.6 }),
    X(sx - 0.7, sy - 0.35, 1.4, 0.7, 'alt_sap:4', { em: true }),
    f === 0 && glint(sx + 2.8, sy, 0.85),
    f === 2 && glint(sx - 2.8, sy, 0.85),
    Lt(16, 15, 11, '#ffc860', 0.25 + 0.15 * p),
  );
  return out;
}

const RIB = { cx: 20.5, cy: 23.4, rx: 10.4, ry: 20 };

/** Skuld's left rib, from the plinth up over the glass, its spurs rimed. */
function rib(): Prim[] {
  const b = 'alt_frostBone';
  const { cx, cy, rx, ry } = RIB;
  const out: Prim[] = arc(cx, cy, rx, ry, PI, PI * 1.43, 10, 1.1, 0.45, b);
  for (const [t, len] of [[1.1, 3.4], [1.27, 2.6]]) {
    const a = PI * t;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    const nl = Math.hypot(Math.cos(a) / rx, Math.sin(a) / ry);
    const nx = Math.cos(a) / rx / nl;
    const ny = Math.sin(a) / ry / nl - 0.55;
    const l = Math.hypot(nx, ny);
    out.push(K(x, y, x + (nx / l) * len, y + (ny / l) * len, 0.8, 0.22, b), X(x - 0.8, y - 1.1, 1.0, 0.5, 'alt_rime:4'));
  }
  out.push(K(10.6, 19.6, 10.7, 21.4, 0.32, 0.08, 'alt_rime'), K(12.5, 11.8, 12.6, 13.4, 0.3, 0.08, 'alt_rime'));
  return out;
}

/** The obsidian: a pointed arch whose two sides are ellipse arcs meeting at x 16. */
const GLASS: number[] = (() => {
  const half = ell(20.5, 23, 9.6, 19.2, PI, PI + Math.acos(4.5 / 9.6), 10);
  const pts = [...half];
  for (let i = half.length - 2; i >= 0; i -= 2) pts.push(32 - half[i], half[i + 1]);
  return pts;
})();

/** Skuld's Mirror: dragon ribs, frost-carved, cradling a slab of obsidian where green and red portents chase each other. ᛋ. */
function skuld(f: number): PrimTree {
  const p = breath(f);
  const cx = 16.2;
  const cy = 15;
  const out: Out = [
    Sh(16, 28.6, 11.5, 2.4, 0.5),
    nornPlinth('sowilo', p),
    T(rib(), { flip: true, px: 16 }),
    P(GLASS, 'alt_obsidian', { bv: 0.9 }),
    // a reflection, two streaks across the glass
    K(13.5, 13.4, 15.3, 10.4, 0.3, 0.3, 'alt_sheen', THIN), K(13.4, 16.4, 14.3, 14.9, 0.28, 0.28, 'alt_sheen', THIN),
  ];
  // the two futures, renewal and Ragnarök, turning about each other
  const turn = (f * PI) / 4;
  for (const [m, c, o] of [['alt_omenGreen', '#3ccf8c', 0], ['alt_omenRed', '#e44a3a', PI]] as const) {
    const a = turn + o;
    out.push(arc(cx, cy, 2.9, 2.6, a, a - PI * 0.7, 4, 0.5, 0.15, m, THIN), Lt(cx + 2.9 * Math.cos(a), cy + 2.6 * Math.sin(a), 5.5, c, 0.4));
  }
  [[13.2, 19.8], [18.4, 11.4], [18.8, 20.4]].forEach(([x, y], i) => out.push(nornStar(x, y, (i + f) % 4)));
  out.push(rib());
  return out;
}

/** Ratatoskr's Roost: a hollow in grey world-bark, the rust-red squirrel on its mossy lip with his hoard, tail twitching. ᚱ in amber. */
function ratatoskr(f: number): PrimTree {
  const p = breath(f);
  const s = sway(f);
  const hb = f % 2 ? -0.3 : 0; // he chatters: the head bobs
  const bk = 'alt_worldBark';
  const fur = 'alt_squirrel';
  const cream = 'alt_squirrelBelly';
  const out: Out = [
    Sh(16, 28.6, 13.4, 2.6, 0.5),
    K(7.4, 25.4, 2.8, 28.6, 1.7, 0.7, bk), K(24.6, 25.4, 29.2, 28.6, 1.7, 0.7, bk), // root flares
    // a broken bole of the colossal trunk
    P([5.6, 28.4, 6.6, 22, 6.2, 14.4, 7.4, 8.4, 8.6, 5.0, 10.4, 7.2, 13, 5.4, 15.6, 7, 18.6, 5, 21.4, 6.8, 23.6, 4.8, 25, 8, 25.8, 14.4, 25.4, 22, 26.4, 28.4], bk, { bv: 3.2 }),
    X(9.2, 9.6, 0.5, 13.4, `${bk}:1`), X(22.8, 9.2, 0.5, 12.6, `${bk}:1`), // furrows
    X(7.8, 11.6, 1.1, 0.6, 'alt_moss:4'), X(8.8, 21.4, 0.9, 0.5, 'alt_moss:4'), X(23.4, 17.6, 1.0, 0.6, 'alt_moss:4'), // lichen
    // the hollow: a lip of bark, the dark inside, deeper toward the top
    E(16, 14.8, 6, 6.8, bk, { ink: 0.06 }),
    E(16, 15.2, 5, 5.9, 'alt_hollow', { fl: 1 }),
    E(16, 12.6, 4.2, 2.8, 'alt_hollow', { fl: 1, ink: -0.25 }),
    // his hoard behind him: river glass, a pine cone
    E(11.7, 19.0, 0.8, 0.6, 'alt_riverGlass'), E(20.9, 18.7, 0.8, 1.1, 'alt_cone', { a: 0.4 }),
    E(16, 20.8, 6.2, 1.3, 'alt_moss'), // the moss on the lip
    // the tail, rising behind him out of the hollow, its plume twitching
    K(18.4, 19, 19.9, 15.4, 1.5, 1.9, fur),
    K(19.9, 15.4, 20.5 + 0.2 * s, 11.2, 1.9, 2.05, fur),
    K(20.5 + 0.2 * s, 11.2, 19.6 + 0.6 * s, 7.8, 2.05, 1.65, fur),
    K(19.6 + 0.6 * s, 7.8, 17.6 + 0.9 * s, 6.9, 1.65, 0.95, fur),
    // body, haunch, belly, feet
    E(15.6, 17, 2.5, 2.9, fur, { a: 0.25 }),
    E(17, 18.8, 1.9, 1.5, fur),
    E(14.5, 17.6, 1.2, 2, cream),
    E(14.4, 20.2, 1.2, 0.5, fur), E(17.6, 20.2, 1.3, 0.5, fur),
    // forepaws clutching a bead of river glass: tribute, or theft
    E(12.4, 16.2 + hb * 0.5, 0.75, 0.65, 'alt_riverGlass'), E(13.2, 16.6, 0.7, 0.55, fur),
    // the head, ears tufted, an insolent eye
    E(13.6, 13.4 + hb, 2, 1.75, fur),
    E(12, 14 + hb, 0.95, 0.8, cream),
    X(11, 13.6 + hb, 0.5, 0.5, '#2a1a14'),
    X(12.7, 12.7 + hb, 0.7, 0.7, '#120a08'), X(12.75, 12.75 + hb, 0.3, 0.3, 'fix_star:5', { em: true, glow: false }),
    K(14.2, 12 + hb, 14, 10 + hb, 0.55, 0.22, fur), K(15.2, 12.3 + hb, 15.8, 10.4 + hb, 0.5, 0.2, fur),
    // more of the hoard, spilled on the floor
    E(9.6, 28, 1.0, 1.3, 'alt_cone', { a: 1.1 }), E(11.8, 28.8, 0.8, 0.55, 'alt_pebble'),
    E(20.4, 28.8, 0.8, 0.55, 'alt_riverGlass'), E(22.6, 28.2, 0.9, 1.2, 'alt_cone', { a: -1 }),
    rune('raidho', 16, 24.8, 4.4, 'alt_amber', { ink: p * 0.08, r: 0.5 }),
    Lt(16, 24.8, 7, '#ffb24c', 0.5 + 0.15 * p),
  ];
  // the glass in his hoard catches the light, a piece at a time
  [[12.4, 16.1], [11.7, 18.9], [20.4, 28.7], [7.2, 26.6]].forEach(([x, y], i) => {
    const k = (i + f) % 4;
    if (k === 0) out.push(glint(x, y, 0.8));
    else if (k === 2) out.push(X(x - 0.3, y - 0.3, 0.6, 0.6, 'fix_star:5', { em: true }));
  });
  return out;
}

const MOUND = { base: 28.4, rx: 13, ry: 13.8 };
const halfWidth = (y: number): number => MOUND.rx * Math.sqrt(Math.max(0, 1 - ((MOUND.base - y) / MOUND.ry) ** 2));

/** One course of the barrow's dressed stone, from y0 down to y1 (y0 < y1), cut to the mound's curve. */
function course(y0: number, y1: number, m: string): Prim {
  const pts: number[] = [];
  for (let i = 0; i <= 3; i++) {
    const y = y1 + ((y0 - y1) * i) / 3;
    pts.push(16 + halfWidth(y), y);
  }
  for (let i = 3; i >= 0; i--) {
    const y = y1 + ((y0 - y1) * i) / 3;
    pts.push(16 - halfWidth(y), y);
  }
  return P(pts, m, { bv: 0.7 });
}

/** A Duergar Barrow: a low dome of dressed stone, its door-stone banded in iron, ᛟ in pale wight-light, silver glinting in the joints. */
function barrow(f: number): PrimTree {
  const p = breath(f);
  const m = 'alt_barrowStone';
  const rows: Array<[number, number]> = [[25, 28.4], [21.6, 25], [18.2, 21.6], [14.8, 18.2]];
  const out: Out = [Sh(16, 28.5, 14.4, 2.6, 0.5), rows.map(([a, b]) => course(a, b, m))];
  // the joints between the stones, staggered course by course
  rows.forEach(([a, b], r) => {
    const lim = Math.min(halfWidth(a), halfWidth(b)) - 0.9;
    for (let x = 16 - lim + (r % 2 ? 1.6 : 3.2); x < 16 + lim; x += 3.4) {
      if (b > 18.2 && x > 10.4 && x < 21.4) continue; // the door is there
      out.push(X(x, a + 0.4, 0.45, b - a - 0.8, `${m}:1`));
    }
  });
  out.push(
    // the door-stone between its jambs, under the capstone
    P([12.8, 19.4, 19.2, 19.4, 19.2, 28.4, 12.8, 28.4], 'alt_sealStone', { bv: 0.5 }),
    P([11.2, 19, 12.8, 19, 12.8, 28.4, 11, 28.4], m, { bv: 0.5 }),
    P([19.2, 19, 20.8, 19, 21, 28.4, 19.2, 28.4], m, { bv: 0.5 }),
    block(10.4, 17.2, 21.6, 19.4, 1.2, m, { bv: 0.5 }),
    [11.6, 13.2, 14.8, 17.2, 18.8, 20.4].map((x) => X(x, 17.8, 0.4, 1.0, `${m}:1`)), // runes asking for the rites
    // two iron bands sealing it, nailed into the jambs
    P([10.6, 20.2, 21.4, 20.2, 21.4, 21.3, 10.6, 21.3], 'blackIron', { bv: 0.35 }),
    P([10.6, 26.2, 21.4, 26.2, 21.4, 27.3, 10.6, 27.3], 'blackIron', { bv: 0.35 }),
    [11.2, 20.4].map((x) => [X(x, 20.5, 0.5, 0.5, 'iron:5'), X(x, 26.5, 0.5, 0.5, 'iron:5')]),
    rune('othala', 16, 23.75, 4.4, 'alt_wight', { ink: p * 0.1, r: 0.5, aspect: 0.8 }),
    Lt(16, 23.7, 8, '#a8f0c8', 0.45 + 0.18 * p),
  );
  // the grave-silver, glinting between the stones
  [[6.4, 25], [25.2, 21.8], [8.8, 18.4], [23.4, 25.2], [21.4, 16.4], [5.2, 27.2]].forEach(([x, y], i) => {
    const k = (i + f) % 4;
    if (k === 0) out.push(glint(x, y, 0.75, 'fix_silver'));
    else if (k === 2) out.push(X(x - 0.3, y - 0.3, 0.6, 0.6, 'fix_silver:5', { em: true, glow: false }));
  });
  return out;
}

/** altar.ts merges these into altarModel's kinds. */
export const SHRINES = { verdandi, skuld, ratatoskr, barrow };
