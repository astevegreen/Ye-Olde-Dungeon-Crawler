import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9b, group B: the Bile-Drinker, the Taproot Matriarch and the Root-Bound Berserker. Conventions: portraitKit.ts. */

/** A ring on an emissive ground: an ellipse band with another inside it. */
function ring(cx: number, cy: number, rx: number, ry: number, w: number, m: string, outer: number, inner: number): Prim[] {
  return [
    E(cx, cy, rx, ry, m, { fl: 1, ink: outer }),
    E(cx, cy, rx - w, ry - w * (ry / rx), m, { fl: 1, ink: inner }),
  ];
}

/** A thin curved stroke along an ellipse arc (angles in radians), tapering at both ends. */
function sheen(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, r: number, m: string, ink: number): Prim[] {
  const out: Prim[] = [], n = 4;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const w0 = 0.3 + r * Math.sin((Math.PI * i) / n), w1 = 0.3 + r * Math.sin((Math.PI * (i + 1)) / n);
    out.push(K(cx + Math.cos(t0) * rx, cy + Math.sin(t0) * ry, cx + Math.cos(t1) * rx, cy + Math.sin(t1) * ry, w0, w1, m, { ink, occ: false }));
  }
  return out;
}

/** The points of a jagged bolt from (x1, y1) to (x2, y2): n segments thrown off the line by up to amp. */
function jag(x1: number, y1: number, x2: number, y2: number, seed: number, n: number, amp: number): Pt[] {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const pts: Pt[] = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const j = (hash2(seed, i * 7 + 3) - 0.5) * 2 * amp;
    pts.push([x1 + (dx * i) / n + nx * j, y1 + (dy * i) / n + ny * j]);
  }
  pts.push([x2, y2]);
  return pts;
}

/** A bolt along jag points: a dim halo of width r, then a white-hot core. */
function boltAlong(pts: Pt[], r: number, ink: number): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(K(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, r * 0.8, 'emBolt', { ink: ink - 0.42, occ: false, ol: false }));
  for (let i = 0; i + 1 < pts.length; i++) out.push(K(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r * 0.36, r * 0.3, 'emBolt', { ink: ink + 0.3, occ: false, ol: false }));
  return out;
}

/**
 * The Bile-Drinker close: its head-lobe turned right with the maw sunk in the bile, long teeth
 * drinking, a cluster of narrow bile-lit eyes under a brow of tar. The snuffed miner's lantern
 * still smokes in its hump beside a drowned ore-cart's wheel, and the only light is the bile below.
 */
export function gloomTarrPortrait(f: number): PrimTree {
  const b = breath(f);
  const gl = [1, 1.1, 0.94, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gTarr', T = 'scr_tarrHide', PL = 'scr_tarrPool', BL = 'scr_tarrBile';
  // the cold rock of the silver workings, and the timbers of the drift
  o.push(
    P(FULL, BG, { ink: BAND[1] }),
    E(50, 44, 66, 56, BG, { fl: 1, ink: BAND[2] }),
    E(46, 34, 50, 34, BG, { fl: 1, ink: BAND[3] }),
  );
  for (const [x0, y0, x1, y1] of [[-1, 34, 30, 22], [40, 14, 97, 2], [62, 30, 97, 22]]) o.push(K(x0, y0, x1, y1, 0.7, 0.5, BG, { ink: BAND[1] }));
  o.push(
    P([-1, 2, 97, 6, 97, 11, -1, 8], BG, { ink: BAND[1] }),
    P([72, 8, 77, 8, 78, 60, 73, 60], BG, { ink: BAND[1] }),
  );

  const hb = -b * 0.6; // it heaves as it drinks
  const TK = -0.46;    // tar: the key light barely finds it
  // the hump behind, rising at the left, and the mound sinking into the bile
  o.push(
    E(16, 54 + hb * 0.5, 23, 42, T, { ink: TK - 0.06 }),
    E(20, 24 + hb * 0.7, 14, 12, T, { ink: TK }),
    sheen(20, 24 + hb * 0.7, 10, 8.4, 3.55, 4.35, 0.5, T, 0.1),
    E(38, 76, 22, 16, T, { ink: TK - 0.08 }),
  );
  // the snuffed lantern, its hook sunk in the hump
  const lx = 15, ly = 20 + hb * 0.7;
  o.push(
    K(lx + 1, ly - 7, lx + 3.4, ly - 11, 0.6, 0.6, 'iron', { occ: false, ink: -0.3 }),
    P([lx - 5, ly - 1.6, lx + 1, ly - 7, lx + 7, ly - 1.6], 'iron', { bv: 0.8, ink: -0.32 }), // its cap
    P([lx - 4.4, ly - 1.6, lx + 6.4, ly - 1.6, lx + 5.8, ly + 10, lx - 3.8, ly + 10], 'scr_tarrGlass', { ink: -0.1 }),
  );
  for (const x of [-4.2, 1, 6.2]) o.push(K(lx + x, ly - 1.6, lx + x * 0.92, ly + 10, 0.6, 0.6, 'iron', { occ: false, ink: -0.32 }));
  o.push(
    K(lx - 5, ly - 1.6, lx + 7, ly - 1.6, 0.8, 0.8, 'iron', { ink: -0.32 }),
    K(lx + 1, ly + 3, lx + 1, ly + 6.6, 0.6, 0.45, 'scr_tarrMaw'), // the dead wick
    E(lx + 1, ly + 13, 9, 4.6, T, { ink: TK }), // the tar swallowing its foot
    K(lx - 3, ly + 9, lx - 3.6, ly + 16, 1.2, 0.8, T, { ink: TK }),
  );
  // a thread of smoke still rising from the wick
  const wv = [0, 1, 0, -1];
  let px = lx + 1, py = ly - 7.4;
  for (let i = 1; i <= 4; i++) {
    const nx = lx + 1 + wv[(f + i) % 4] * 1.2 * (i / 2.5), ny = ly - 7.4 - i * 3.6;
    o.push(K(px, py, nx, ny, 0.4 + i * 0.12, 0.4 + (i + 1) * 0.12, 'scr_tarrSmoke', { occ: false }));
    px = nx; py = ny;
  }
  // a blister of tar swelling on its back, and bursting
  const bub = [1.6, 2.2, 2.8, 0][f % 4];
  if (bub) o.push(E(31, 44 + hb * 0.6 - bub * 0.4, bub, bub * 0.86, T, { ink: TK + 0.14 }), sheen(31, 44 + hb * 0.6 - bub * 0.4, bub * 0.7, bub * 0.6, 3.5, 4.5, 0.25, T, 0.3));
  else o.push(E(31, 44.6 + hb * 0.6, 2.4, 0.8, T, { ink: TK - 0.2 }), X(29.6, 40 + hb * 0.6, 0.6, 0.6, T + ':2'), X(32.4, 39.4 + hb * 0.6, 0.6, 0.6, T + ':2'));

  // the head-lobe, turned to the right and lowered to drink
  const hx = 62, hy = 50 + hb;
  o.push(
    E(hx, hy, 31, 25, T, { ink: TK }),
    E(hx - 6, hy - 16, 17, 10, T, { ink: TK + 0.02 }), // the crown of it
    sheen(hx - 6, hy - 16, 12.6, 7, 3.6, 4.4, 0.45, T, 0.06),
    E(hx + 20, hy + 2, 15, 15, T, { ink: TK - 0.02 }), // the brow-mass, pushed forward
    E(hx - 14, hy + 16, 14, 12, T, { ink: TK - 0.06 }), // the near jowl
  );
  // the tar of its hide sagging in lumps and folds, a wet shine on the ones the bile reaches
  for (const [x, y, rx, ry, sh] of [[-22, -4, 9, 7, 0], [-12, 4, 8, 6, 1], [6, -20, 9, 5, 0], [-24, 12, 6, 6, 1]]) {
    o.push(E(hx + x, hy + y, rx, ry, T, { ink: TK + 0.04 }));
    if (sh) o.push(sheen(hx + x, hy + y, rx * 0.74, ry * 0.7, 0.5, 1.5, 0.32, T, 0.12));
  }
  for (const [x, y, l, ph] of [[-28, 22, 8, 0], [-4, 21, 6, 1], [-36, 6, 7, 2]]) {
    const d = ((f + ph) % 4) * 0.25;
    o.push(K(hx + x, hy + y, hx + x - 0.3, hy + y + l * (0.6 + d * 0.5), 1.1, 0.6, T, { ink: TK }), E(hx + x - 0.3, hy + y + l * (0.6 + d * 0.5) + 0.8, 0.9, 1.1, T, { ink: TK + 0.08 }));
  }
  // the maw, gaping down into the bile: its throat glows with what it drinks
  o.push(
    P([hx - 12, 89, hx - 16, hy + 28, hx - 6, hy + 22.6, hx + 8, hy + 18.4, hx + 22, hy + 15, hx + 37, hy + 12, hx + 37, 89], 'scr_tarrMaw', { ink: -0.4 }),
    E(hx + 12, 86, 22, 6.4, BL, { fl: 0.8, ink: -0.8 + (gl - 1) * 0.6 }), // the bile rising into its throat
    E(hx + 14, 87.4, 12, 3, BL, { fl: 0.8, ink: -0.66 + (gl - 1) * 0.6 }),
    // the near corner of the mouth, a slumping fold of tar
    strand(hx - 17, hy + 20, hx - 17, hy + 30, hx - 12, 90, 3.6, 4.6, T, 4, { ink: TK - 0.04 }),
    // the lower lip, sunk in the bile, with a few teeth standing out of it
    strand(hx - 12, 87.6, hx + 10, 84.6, hx + 37, 86.4, 2.4, 2, T, 6, { ink: TK }),
  );
  for (const [x, h, lean] of [[hx - 3, 5, 0.2], [hx + 15, 7, 0.1], [hx + 28, 4.4, -0.1]]) {
    const y = 86 + (x - hx) * -0.02;
    o.push(P([x - 1.3, y, x + 1.3, y, x + lean * h, y - h], 'boneOld', { bv: 0.5, ink: -0.26 }));
  }
  // long teeth of old bone hanging from the upper jaw, broken, crowded, uneven
  const lip = (t: number) => qpt([hx - 15, hy + 26.6], [hx + 8, hy + 17], [hx + 37, hy + 12.4], t);
  const teeth = [[0.1, 6, 0.14, 1.1], [0.24, 11, 0.08, 1.4], [0.4, 8, 0.02, 1.2], [0.55, 15, -0.04, 1.7], [0.7, 10, -0.08, 1.3], [0.86, 19, -0.12, 1.9]];
  for (const [t, h, lean, w] of teeth) {
    const [x, y] = lip(t);
    o.push(P([x - w, y - 0.6, x + w, y - 0.6, x + w * 0.3 + lean * h, y + h * 0.75, x + lean * h, y + h], 'boneOld', { bv: 0.6, ink: -0.42 }));
  }
  // a string of bile from the lip to the surface, and a drop falling
  o.push(
    K(hx + 9, hy + 19, hx + 9.6, 85, 0.35, 0.5, BL, { ink: -0.5, occ: false }),
    E(hx + 22, hy + 22 + (f % 4) * 3.4, 0.6, 1.1, BL, { ink: -0.4 }),
    // the upper lip, overhanging and sagging
    strand(hx - 19, hy + 25, hx + 8, hy + 13.6, hx + 38, hy + 9.6, 3.4, 3, T, 7, { ink: TK }),
  );
  // the eyes: a cluster of bile-lit slits, each half-shut under a lid of tar
  // that slopes down toward the front, so the whole cluster glowers
  const eyes = [[18, 0, 3.8, 2, 0.16], [7, -1.6, 2.8, 1.6, 0.2], [28, -1, 2.2, 1.5, 0.12], [12, 6, 2.2, 1.2, 0.14], [24, 6.4, 1.6, 1, 0.1], [0, 3.4, 1.7, 1, 0.22]];
  for (const [x, y, rx, ry, a] of eyes) {
    o.push(
      E(hx + x, hy + y, rx + 1.4, ry + 1.3, T, { fl: 0.85, ink: -0.74 }),
      E(hx + x, hy + y + 0.2, rx, ry, 'emPoison', { ink: (gl - 1) * 0.5 }),
      X(hx + x - 0.3, hy + y - ry * 0.4, 0.7, ry * 1.4, '#0c140a'),
      E(hx + x - 0.4, hy + y - ry * 1.05, rx + 1.6, ry * 1.1, T, { ink: TK + 0.12, a }), // the lid
    );
  }
  o.push(
    Lt(hx + 15, hy + 3, 12, '#b8f070', 0.32 * gl, 3),
    // the brow: a heavy fold of tar drooping over the eyes
    strand(hx - 6, hy - 8, hx + 14, hy - 12, hx + 35, hy - 5, 3.4, 2.4, T, 5, { ink: TK + 0.08 }),
    strand(hx + 9, hy - 9, hx + 9, hy - 5, hx + 10, hy - 1.6 + b * 0.5, 0.9, 0.5, T, 2, { ink: TK }),
  );

  // a drowned ore-cart's wheel, standing out of the bile before it
  const wx = 14, wy = 89;
  o.push(E(wx, wy, 10, 10, 'iron', { fl: 0.7, ink: -0.36 }), E(wx, wy, 8.2, 8.2, T, { fl: 0.5, ink: TK - 0.1 }));
  for (const a of [0.2, 1.25, 2.3]) o.push(K(wx + Math.cos(a) * 8, wy - Math.sin(a) * 8, wx - Math.cos(a) * 8, wy + Math.sin(a) * 8, 0.7, 0.7, 'woodDark', { ink: -0.34 }));
  o.push(
    E(wx, wy, 2, 2, 'iron', { ink: -0.26 }),
    // a miner's pick, standing where its owner went under
    K(29, 91, 33.6, 74, 0.8, 0.7, 'woodDark', { ink: -0.36 }),
    P([27, 74.6, 31, 72.4, 34, 72.6, 39, 75.6, 34.6, 74.6, 31.6, 74.8], 'iron', { bv: 0.6, ink: -0.4 }),
  );

  // the pool's surface, in front: black, welling green only where it drinks
  o.push(
    P([-1, 89, 97, 88, 97, 97, -1, 97], PL, { ink: BAND[1] }),
    E(hx + 10, 90.4, 40, 5, PL, { fl: 1, ink: BAND[2] }),
  );
  const rp = (f % 4) * 3;
  o.push(
    ring(hx + 10, 90.4, 26 + rp, 3 + rp * 0.14, 1, PL, BAND[3], BAND[2]),
    E(hx + 10, 89.8, 22, 1.6, BL, { fl: 1, ink: -0.84 + (gl - 1) * 0.6 }),
    E(hx + 12, 89.6, 9, 0.8, BL, { fl: 1, ink: -0.7 + (gl - 1) * 0.6 }),
    // lit only by the bile, from below where it drinks
    Lt(hx + 10, 94, 46, '#95dc4c', 1.15 * gl, 3),
  );
  return o;
}

/**
 * The Taproot Matriarch in her gnawed hollow: an undead troll-crone grown into the root, long
 * hooked nose and a tusk, violet eyes deep under the brow, a crown of dead roots. Both claws are
 * raised with the storm she drank from the sky crawling between them, lighting her from the right.
 */
export function svartrPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.84, 1.16, 0.92][f % 4]; // the storm flickers
  const o: Out = [];
  const BG = 'scr_gSvartr', SK = 'scr_svartrSkin', RT = 'scr_svartrRoot', CR = 'scr_svartrCrown', SP = 'scr_svartrSap';
  // the hollow, violet-black, brightest where the storm is held
  o.push(
    P(FULL, BG, { ink: BAND[1] }),
    E(58, 44, 58, 52, BG, { fl: 1, ink: BAND[2] }),
    E(80, 52, 22, 32, BG, { fl: 1, ink: BAND[3] }),
    E(81, 52, 9, 19, BG, { fl: 1, ink: BAND[4] }),
  );
  // the wood of the hollow, scored by great gnawing teeth; dead rootlets hanging from its roof
  for (const [x, y, l] of [[60, 0, 22], [67, -1, 26], [74, 0, 20], [4, 30, 30], [10, 34, 26]]) {
    o.push(
      strand(x, y, x + 3, y + l * 0.5, x + 1, y + l, 1.3, 0.4, BG, 3, { ink: BAND[1] }),
      strand(x + 1.6, y + 1, x + 4.6, y + l * 0.5, x + 2.6, y + l - 2, 0.5, 0.2, BG, 3, { ink: BAND[3] }),
    );
  }
  for (const [x, l] of [[84, 12], [90, 20], [95, 9], [30, 8]]) o.push(strand(x, -1, x - 1 + s * 0.3, l * 0.5, x + 0.6 + s * 0.6, l, 0.6, 0.2, BG, 3, { ink: BAND[1] }));

  const by = -b * 0.5;
  const hx = 46, hy = 42 + by;
  // root-hair hanging down her back
  o.push(P([hx - 12, hy - 14, hx + 2, hy - 16, hx - 2, hy + 8, hx - 8, hy + 28, hx - 16 + s * 0.4, hy + 58, hx - 32, hy + 58, hx - 28, hy + 26, hx - 18, hy + 4], RT, { bv: 3, ink: -0.16 }));
  for (const [x0, y0, x1, y1, x2, y2] of [[-16, 0, -24, 22, -26 + s * 0.4, 44], [-10, 6, -16, 26, -18 + s * 0.6, 52], [-20, -4, -32, 14, -38 + s * 0.3, 34]]) {
    o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2, hy + y2, 1.1, 0.35, RT, 4, { ink: -0.08 }));
  }

  // the far arm, reaching forward from behind her, its claw held palm-down over the storm
  const claw = (cx: number, cy: number, fingers: number[][], r: number, ink: number): Prim[] => {
    const out: Prim[] = [E(cx, cy, r * 1.5, r * 1.3, SK, { ink })];
    for (const [a, l, curl] of fingers) {
      const kx = cx + Math.cos(a) * l * 0.5, ky = cy + Math.sin(a) * l * 0.5;
      const a2 = a + curl, tx = kx + Math.cos(a2) * l * 0.42, ty = ky + Math.sin(a2) * l * 0.42;
      const a3 = a2 + curl * 1.2;
      out.push(
        K(cx, cy, kx, ky, r * 0.5, r * 0.42, SK, { ink }),
        E(kx, ky, r * 0.46, r * 0.46, SK, { ink: ink + 0.06 }),
        K(kx, ky, tx, ty, r * 0.42, r * 0.3, SK, { ink }),
        K(tx, ty, tx + Math.cos(a3) * l * 0.34, ty + Math.sin(a3) * l * 0.34, r * 0.3, 0.1, 'boneOld', { ink: -0.1 }),
      );
    }
    return out;
  };
  const ux = 76, uy = 30 + by * 0.4;
  o.push(
    K(58, 64 + by, 70, 52 + by * 0.6, 5, 4.4, SK, { ink: -0.3 }),
    K(70, 52 + by * 0.6, ux - 1, uy + 2, 4.4, 3.2, SK, { ink: -0.24 }),
    K(66, 55, 72, 47, 0.9, 0.8, RT, { occ: false }), K(71, 43, 75, 37, 0.8, 0.7, RT, { occ: false }),
    claw(ux, uy, [[0.5, 10, 0.32], [0.95, 12, 0.3], [1.4, 11, 0.28], [1.85, 9, 0.3]], 2.5, -0.2),
    // her shoulders, hunched and gaunt
    P([-2, 97, -2, 80, 12, 70, 28, 65 + by, 46, 64 + by, 60, 66 + by, 68, 74, 72, 97], SK, { bv: 6, ink: -0.42 }),
    K(30, 72 + by, 44, 70 + by, 1, 0.8, SK, { ink: -0.1 }), K(52, 71 + by, 62, 73 + by, 0.9, 0.7, SK, { ink: -0.1 }), // collarbones
    // the neck, stringy, stooped forward
    K(hx + 2, hy + 30, hx + 4, hy + 16, 8, 7, SK, { ink: -0.34 }),
    K(hx + 8, hy + 28, hx + 9, hy + 18, 1, 0.8, SK, { ink: -0.16 }), K(hx - 2, hy + 28, hx, hy + 18, 0.9, 0.7, SK, { ink: -0.2 }),
  );

  // the head, turned three-quarters toward the storm: a long troll-crone's face
  const cx = hx + 7; // the line down the middle of her face
  o.push(
    K(hx - 11, hy + 1, hx - 19, hy + 15, 3.2, 1, SK, { ink: -0.34 }), K(hx - 12, hy + 3, hx - 17, hy + 12, 1, 0.4, SK, { ink: -0.62 }), // a long drooping ear
    E(hx, hy - 6, 15, 14, SK, { fl: 0.15, ink: -0.24 }),      // the skull
    E(cx - 2, hy + 6, 12, 15, SK, { fl: 0.2, ink: -0.16 }),    // the face, long
    E(cx, hy + 18, 9, 5.6, SK, { fl: 0.25, ink: -0.2 }),       // the jaw, underslung
    E(cx + 3, hy + 20.4, 5, 3.6, SK, { fl: 0.3, ink: -0.12 }),  // chin, thrust out
    E(cx - 7, hy + 9, 4, 5, SK, { fl: 0.8, ink: -0.44 }),      // hollow cheek
    E(cx - 6, hy + 3.6, 4.4, 1.5, SK, { fl: 0.4, ink: 0 }),    // cheekbone
    E(hx - 9, hy - 1, 3, 5, SK, { fl: 0.7, ink: -0.4 }),       // sunken temple
  );
  // deep sockets under a brow drawn down in a scowl, small violet eyes
  const ey = hy + 1;
  o.push(
    E(cx - 6.4, ey, 4.4, 3.4, SK, { fl: 0.85, ink: -0.7 }),
    E(cx + 6, ey - 0.2, 3, 3, SK, { fl: 0.85, ink: -0.7 }),
  );
  const ei = (g - 1) * 0.3;
  o.push(
    E(cx - 6, ey + 0.6, 1.5, 1, 'emUnholy', { ink: ei }), E(cx + 6.2, ey + 0.4, 1.1, 0.9, 'emUnholy', { ink: ei }),
    X(cx - 6.4, ey, 0.8, 0.8, '#f4ecff', { em: true }),
    E(cx - 6.4, ey - 4, 6, 2.6, SK, { ink: -0.06, fl: 0.3, a: 0.26 }), E(cx + 6, ey - 4.4, 4.4, 2.2, SK, { ink: -0.06, fl: 0.3, a: -0.28 }), // the brow, drawn down
    K(cx - 1.2, ey - 7.4, cx - 0.4, ey - 3, 0.4, 0.4, SK, { ink: -0.46, occ: false }), K(cx + 1.4, ey - 7, cx + 0.8, ey - 3.2, 0.35, 0.35, SK, { ink: -0.46, occ: false }), // the scowl between
  );
  for (const [x, y, l] of [[-6, -9, 7], [-4, -12, 9], [-5, -15, 6]]) o.push(K(cx + x - l / 2, hy + y + 0.6, cx + x + l / 2, hy + y, 0.4, 0.4, SK, { ink: -0.46, occ: false })); // furrows
  o.push(
    Lt(cx - 6, ey + 1.6, 8, '#a868ff', 0.34 * g, 3),
    // the mouth: a lipless gash turned down, snaggled teeth, a tusk thrust up past the lip
    K(cx - 10, ey + 8, cx - 9.6, hy + 19, 0.4, 0.4, SK, { ink: -0.46, occ: false }), // the fold beside it
    P([cx - 9.6, hy + 22.8, cx - 5, hy + 19.6, cx, hy + 18.6, cx + 6, hy + 19.4, cx + 8, hy + 21.4, cx + 3, hy + 20.6, cx - 2, hy + 20.6, cx - 6, hy + 21.8], 'scr_gum'),
    P([cx - 3.8, hy + 20.8, cx - 2.2, hy + 20.8, cx - 2.8, hy + 19.2], 'boneOld', { ink: -0.1 }), P([cx + 1.6, hy + 20.8, cx + 3, hy + 20.8, cx + 2.4, hy + 19.2], 'boneOld', { ink: -0.18 }),
    strand(cx - 7, hy + 24, cx - 1, hy + 22.4, cx + 5, hy + 23.4, 0.6, 0.5, SK, 3, { ink: -0.36, occ: false }), // under the lower lip
    P([cx - 9, hy + 23, cx - 6.4, hy + 23, cx - 8.4, hy + 15], 'bone', { bv: 0.6, ink: -0.06 }),
    // the long hooked nose, humped, hanging down over the mouth
    P([cx - 1.4, ey - 3, cx + 2, ey - 3, cx + 6, ey + 2, cx + 9, ey + 6, cx + 13, ey + 13, cx + 13.6, ey + 17.4, cx + 11.4, ey + 20.2, cx + 7.6, ey + 19.4, cx + 6, ey + 16.4, cx + 2.4, ey + 14, cx - 0.4, ey + 8], SK, { bv: 2.6, ink: -0.08 }),
    strand(cx - 0.4, ey + 1, cx + 0.4, ey + 9, cx + 3, ey + 14, 0.8, 1, SK, 3, { ink: -0.34, occ: false }), // its shadowed side
    strand(cx + 2.6, ey - 1, cx + 9, ey + 5, cx + 12.6, ey + 14.6, 0.6, 0.9, SK, 3, { ink: 0.16, occ: false }), // its ridge, in the storm-light
    E(cx + 8.8, ey + 18, 1.6, 0.9, 'scr_gum'),
    E(cx + 6.4, ey + 7.4, 0.9, 0.8, SK, { ink: -0.44 }), // a wart
    // black sap at the corner of her mouth
    strand(cx - 9.4, hy + 22.6, cx - 10, hy + 25, cx - 9.4, hy + 27.4 + b * 0.8, 0.6, 0.35, SP, 3),
    // dead roots grown up out of her skull and sweeping back, knotted, hung with rootlets
    P([hx - 14, hy - 9, hx - 11, hy - 17, hx - 2, hy - 20.6, hx + 8, hy - 18.4, hx + 13, hy - 12, hx + 2, hy - 15, hx - 6, hy - 14], CR, { bv: 2, ink: -0.14 }), // the root-cap over her crown
  );
  const roots = [[-6, -14, -10, -32, -30, -36, 2.4], [2, -16, 5, -31, -8, -41, 2], [-12, -10, -30, -20, -39, -7, 1.9], [-3, -15, -21, -23, -22, -41, 1.6], [8, -12, 11, -23, 3, -30, 1.3]];
  for (let i = 0; i < roots.length; i++) {
    const [x0, y0, x1, y1, x2, y2, r] = roots[i];
    const A: Pt = [hx + x0, hy - 3 + y0], C: Pt = [hx + x1, hy - 3 + y1], B: Pt = [hx + x2, hy - 3 + y2];
    o.push(strand(A[0], A[1], C[0], C[1], B[0], B[1], r, 0.4, CR, 5, { ink: -0.08 }));
    const [kx, ky] = qpt(A, C, B, 0.45);
    o.push(E(kx, ky, r * 1.1, r * 0.9, CR, { ink: -0.02 })); // a knot
    const sx = (x2 - x0) > 0 ? 1 : -1;
    o.push(K(kx, ky, kx + sx * 4 + 2, ky - 5, r * 0.45, 0.2, CR, { ink: -0.08 })); // a fork
    const [rx, ry] = qpt(A, C, B, 0.8);
    o.push(K(rx, ry, rx + s * 0.3 + (i % 2) * 1.6, ry + 5 + i, 0.3, 0.12, CR, { ink: -0.2, occ: false })); // a dangling rootlet
  }

  // the near arm, coming up out of the wood, its claw held palm-up under the storm
  const lx = 80, ly = 72 + by * 0.3;
  o.push(
    K(64, 99, 70, 88, 6, 5.2, SK, { ink: -0.44 }),
    K(70, 88, lx - 2, ly + 2, 5.2, 3.8, SK, { ink: -0.34 }),
    K(64, 96, 68, 88, 1.1, 1, RT, { occ: false }), K(70, 86, 75, 79, 0.9, 0.8, RT, { occ: false }),
    claw(lx, ly, [[-0.5, 10, -0.3], [-0.95, 12, -0.28], [-1.4, 11, -0.26], [-1.9, 9, -0.3]], 2.7, -0.12),
  );

  // the storm she drank from the sky, crawling between her claws
  const seed = f * 13 + 5;
  const main = jag(82, 38, 84, 64, seed, 6, 3.4);
  o.push(boltAlong(main, 1.5, 0));
  const [fx0, fy0] = main[2];
  o.push(
    boltAlong(jag(fx0, fy0, 90 - (f % 2) * 3, 62, seed + 40, 4, 2.2), 1.1, -0.06),
    boltAlong(jag(76, 40, 78 + (f % 3) * 1.6, 63, seed + 90, 5, 2.6), 0.9, -0.12),
  );
  const [spx, spy] = [[86, 44], [78, 50], [88, 56], [80, 60]][f % 4];
  o.push(
    X(spx, spy, 0.8, 0.8, '#ffffff', { em: true }), X(spx - 3, spy + 4, 0.6, 0.6, '#ffffff', { em: true }),
    // the wood climbing her: roots twisting up out of the dark over her shoulder and breast
    P([-2, 97, -2, 84, 6, 80, 16, 84, 24, 92, 26, 97], RT, { bv: 3, ink: -0.14 }),
    strand(4, 97, 8, 82, 22, 74 + by, 3.4, 1.6, RT, 5, { ink: -0.1 }),
    strand(16, 97, 20, 84, 34, 78 + by, 3, 1.2, RT, 5, { ink: -0.08 }),
    strand(28, 97, 34, 88, 46, 84 + by, 2.6, 1, RT, 5, { ink: -0.08 }),
    strand(22, 74 + by, 30, 70 + by, 36, 72 + by, 1.4, 0.4, RT, 3), strand(34, 78 + by, 42, 74 + by, 48, 76 + by, 1.2, 0.3, RT, 3),
    // black sap weeping from the bark
    E(26, 80 + (f % 4) * 2.4, 0.7, 1.1, SP), E(40, 84 + ((f + 2) % 4) * 2.2, 0.6, 1, SP),
    Lt(82, 50, 66, '#fff6b8', 1.0 * g, 10),
  );
  return o;
}

/**
 * A bear-shirt taken by the roots where he died raging: the bear's hide over his head and
 * shoulders, its ears, brow and upper jaw over his own with the fangs on his forehead. Violet
 * eyes, a snarl in a beard full of root fibre, two knotted taproots driven through his chest and
 * out of his back with the sap glowing in the wounds, and the bearded axe still raised.
 */
export function berserkerPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const pulse = [0, 0.1, 0.18, 0.08][f % 4];
  const o: Out = [];
  const BG = 'scr_gBerserker', SK = 'scr_bsSkin', PE = 'scr_bsPelt', RT = 'scr_bsRoot', SA = 'scr_bsSap';
  // the root-gallery behind him, its pillars of living wood
  o.push(
    P(FULL, BG, { ink: BAND[1] }),
    E(46, 54, 56, 52, BG, { fl: 1, ink: BAND[2] }),
    E(40, 34, 30, 26, BG, { fl: 1, ink: BAND[3] }),
  );
  for (const [x, w, lean] of [[4, 6, 3], [94, 7, -2], [66, 3.4, 1]]) {
    o.push(
      P([x - w, -1, x + w, -1, x + w + lean, 97, x - w + lean, 97], BG, { ink: BAND[1] }),
      strand(x - w * 0.5, -1, x + w * 0.4 + lean * 0.5, 48, x - w * 0.3 + lean, 97, 0.5, 0.5, BG, 4, { ink: BAND[2] }),
    );
  }

  const by = -b * 0.6;
  const hx = 48, hy = 40 + by * 0.6;
  const cx = hx - 5; // the line down his face: he is turned a little to his right
  /** A knotted taproot along a curve: the strand, then two knots, each throwing a rootlet. */
  const root = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, r0: number, r1: number, seed: number, ink: number): Out => {
    const out: Out = [strand(x0, y0, x1, y1, x2, y2, r0, r1, RT, 5, { ink })];
    for (const [i, t] of [[1, 0.3], [2, 0.64]]) {
      const [px, py, tx, ty] = qpt([x0, y0], [x1, y1], [x2, y2], t);
      const L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L, r = r0 + (r1 - r0) * t;
      const side = hash2(seed, i) < 0.5 ? -1 : 1, nx = -uy * side, ny = ux * side, l = r + 3.4 + hash2(seed, i + 4) * 2;
      out.push(
        E(px + nx * r * 0.4, py + ny * r * 0.4, r * 1.05, r * 0.95, RT, { ink: ink + 0.05 }), // a burl on one side
        K(px + nx * r, py + ny * r, px + nx * l + ux * 2.4, py + ny * l + uy * 2.4, 0.8, 0.2, RT, { ink: ink - 0.06 }),
      );
    }
    return out;
  };
  // where the roots go into him; (ux, uy) is the way each root is travelling as it enters
  const wA = [41, 88 + by * 0.5, 0.98, -0.21], wB = [57, 71.5 + by, -0.78, -0.63];
  /** The skin pushed up round the root, the sap creeping out under it, a torn rim, the sap welling round the root. */
  const entry = ([x, y, ux, uy]: number[], seed: number): Out => {
    const out: Out = [E(x + 0.6, y + 0.4, 7, 6, SK, { ink: -0.2 }), strand(x - 5.6, y + 3, x + 0.6, y + 7.8, x + 6.6, y + 2.2, 0.9, 0.9, SK, 3, { ink: -0.82, occ: false })];
    for (let i = 0; i < 3; i++) {
      const a = Math.atan2(uy, ux) + (i - 1) * 1.1 + (hash2(seed, i) - 0.5) * 0.5, l = 6.4 + hash2(seed, i + 3) * 3.6;
      out.push(K(x + Math.cos(a) * 3.8, y + Math.sin(a) * 3.2, x + Math.cos(a + 0.2) * l, y + Math.sin(a + 0.2) * l, 0.36, 0.18, SA, { ink: -0.82 + pulse, occ: false, ol: false }));
    }
    out.push(E(x + ux * 0.6, y + uy * 0.6, 4.8, 4.4, SK, { fl: 0.6, ink: -0.8 }), E(x + ux * 1.1, y + uy * 1.1, 3.8, 3.6, SA, { a: Math.atan2(uy, ux), fl: 0.8, ink: -0.1 + pulse, ol: false }));
    return out;
  };
  /** The skin's torn lip on the far side of the hole the root goes into, and a drip running from the wound. */
  const seep = ([x, y, ux, uy]: number[], k: number): Out => [
    strand(x + ux * 2.4 + uy * 4.4, y + uy * 2.4 - ux * 4.4, x + ux * 6.8, y + uy * 6.8, x + ux * 2.4 - uy * 4.4, y + uy * 2.4 + ux * 4.4, 0.9, 0.9, SK, 4, { ink: -0.3 }),
    K(x + 1, y + 4.8, x + 1.1, y + 5.6 + ((f + k) % 4) * 1.1, 0.4, 0.3, SA, { ink: -0.5 + pulse * 0.5, occ: false, ol: false }),
  ];

  // the far ends of the roots, out of his back and away into the gallery
  o.push(
    root(74, 87, 92, 80, 99, 56, 3.6, 4.4, 5, -0.34),
    root(30, 58, 14, 43, -3, 30, 3.4, 4.2, 17, -0.34),
    // the bear-hide hanging from his head over both shoulders and down his sides
    P([hx - 13, hy - 17, hx + 15, hy - 18, hx + 20, hy - 4, hx + 22, hy + 10, 80, 60 + by, 87 + s * 0.4, 70, 86, 78, 84 + s * 0.4, 97, 2, 97, 1 + s * 0.4, 80, 6, 66 + by, 16, 56 + by, hx - 24, hy + 8, hx - 18, hy - 4], PE, { bv: 4, ink: -0.6 }),
  );
  for (const [x, y, d] of [[20, 51, -1], [13, 58, -1], [6, 66, -1], [2, 76, -1], [86, 78, 1], [85, 88, 1]]) o.push(K(x, y + by, x + d * 3 + s * 0.3, y + 3.6 + by, 1.6, 0.3, PE, { ink: -0.5 }));
  for (const [x0, y0, x1, x2] of [[16, 58, 10, 7], [27, 52, 22, 25], [80, 70, 82, 79]]) o.push(strand(x0, y0 + by, x1 + s * 0.3, 78, x2 + s * 0.5, 97, 1.1, 0.5, PE, 3, { ink: -0.44 })); // the lie of the fur
  // the bare chest between, a dead man's: the breast, the breastbone, ribs under the arms, old scars
  o.push(
    P([33, 60 + by, 63, 60 + by, 65, 72 + by, 63, 86, 61, 97, 35, 97, 33, 86, 31, 72 + by], SK, { bv: 5, ink: -0.62 }),
    E(40.5, 73 + by, 8.4, 5.6, SK, { a: 0.12, fl: 0.1, ink: -0.44 }), E(56.5, 73 + by, 7.6, 5.4, SK, { a: -0.12, fl: 0.15, ink: -0.48 }),
    K(33.5, 78.6 + by, 47, 80 + by, 1.3, 1, SK, { ink: -0.84, occ: false }), K(49.5, 80 + by, 63, 78 + by, 1.3, 1, SK, { ink: -0.84, occ: false }),
    K(48, 68 + by, 48, 93, 0.5, 0.7, SK, { ink: -0.72, occ: false }),
  );
  for (const y of [86, 92]) o.push(K(43, y, 47, y + 0.6, 0.5, 0.4, SK, { ink: -0.7, occ: false }), K(49, y + 0.6, 53, y, 0.5, 0.4, SK, { ink: -0.7, occ: false }));
  for (let i = 0; i < 3; i++) o.push(K(33, 81 + i * 3.6, 37.6, 83.4 + i * 3.6, 0.5, 0.3, SK, { ink: -0.74, occ: false }), K(63, 81 + i * 3.6, 58.4, 83.4 + i * 3.6, 0.5, 0.3, SK, { ink: -0.74, occ: false }));
  o.push(K(34.4, 75 + by, 44, 82, 0.4, 0.3, SK, { ink: -0.2, occ: false })); // an old slash
  for (let i = 0; i < 3; i++) o.push(K(52.4 + i * 2, 61.6 + by, 54.6 + i * 2, 66.4 + by, 0.32, 0.26, SK, { ink: -0.24, occ: false })); // old claw-marks
  // the hide's edge hanging over the breast, breaking into fur
  for (let i = 0; i < 5; i++) {
    const y = 62 + i * 8 + by * (1 - i / 5), j = hash2(i, 31) * 1.4;
    o.push(K(31.4 + j, y, 35.8 + j, y + 5.4, 1.9, 0.3, PE, { ink: -0.4 }), K(64.6 - j - (i > 2 ? 2 : 0), y, 60.2 - j - (i > 2 ? 2 : 0), y + 5.4, 1.9, 0.3, PE, { ink: -0.46 }));
  }
  // the bear's foreleg, knotted over his shoulder, its claws hanging on his breast
  o.push(
    K(22, 54 + by, 32, 68 + by, 4, 3.4, PE, { ink: -0.36 }),
    E(33, 69.5 + by, 4, 3, PE, { ink: -0.3 }),
  );
  for (const [dx, l] of [[-2.6, 4.2], [-0.8, 5], [1, 4.8], [2.6, 3.8]]) o.push(K(33 + dx, 71.5 + by, 33 + dx * 1.3, 71.5 + l + by, 0.6, 0.15, 'boneOld', { ink: -0.2 }));
  o.push(
    // a neck like a bull's
    K(hx - 2, hy + 28, hx - 3, hy + 14, 9, 8, SK, { ink: -0.46 }),
    // his face, under the bear's
    E(cx, hy + 4, 10, 12.6, SK, { fl: 0.2, ink: -0.2 }),
    E(cx + 7.6, hy + 2, 3, 7, SK, { fl: 0.7, ink: -0.36 }), // the far side of the face, in shadow
    E(cx - 5.6, hy + 5.4, 3.4, 3.6, SK, { fl: 0.8, ink: -0.42 }), E(cx + 4.4, hy + 5.6, 2.6, 3.6, SK, { fl: 0.8, ink: -0.44 }), // hollow cheeks
    E(cx - 5, hy + 1.8, 4, 1.4, SK, { fl: 0.4, ink: -0.06 }), E(cx + 4, hy + 1.8, 3, 1.3, SK, { fl: 0.4, ink: -0.1 }), // cheekbones
  );
  // the hide's edge at his cheeks, breaking into fur
  for (let i = 0; i < 4; i++) o.push(K(cx - 11.2 + (i === 3 ? 0.8 : 0), hy - 1.4 + i * 4, cx - 7.2 + (i === 3 ? 0.8 : 0), hy + 2.6 + i * 4, 1.8, 0.3, PE, { ink: -0.26 }));
  for (let i = 0; i < 3; i++) o.push(K(cx + 12, hy - 0.4 + i * 4.4, cx + 8.4, hy + 3.4 + i * 4.4, 1.7, 0.3, PE, { ink: -0.4 }));
  // the beard, full of root fibre, and stirring
  o.push(P([cx - 10, hy + 6, cx - 6, hy + 14, cx + 4, hy + 14, cx + 9, hy + 6, cx + 10, hy + 16, cx + 6, hy + 26, cx + 1 + s * 0.4, hy + 33, cx - 4 + s * 0.4, hy + 30, cx - 9, hy + 23, cx - 11, hy + 15], 'hairDark', { bv: 2.6, ink: 0.08 }));
  for (const [x0, x1, x2, l] of [[-6, -8, -6, 22], [-1, -2, 0, 26], [4, 6, 5, 22], [-3, -5, -4, 18]]) o.push(strand(cx + x0, hy + 14, cx + x1 + s * 0.3, hy + 14 + l * 0.5, cx + x2 + s * 0.6, hy + 14 + l, 0.45, 0.15, RT, 3, { ink: 0.02, occ: false }));
  // the roar frozen on him: lips drawn back from his teeth
  o.push(P([cx - 7, hy + 9.4, cx - 2, hy + 8.2, cx + 3, hy + 8.4, cx + 6, hy + 9.6, cx + 4.4, hy + 14.6, cx - 0.6, hy + 16, cx - 5.4, hy + 14.4], 'scr_gum'));
  for (const [x, h, w] of [[-5, 3.2, 1.1], [-3.2, 1.6, 1.3], [-1.4, 1.8, 1.4], [0.6, 1.4, 1.2], [2.4, 1.7, 1.2], [4, 2.8, 1]]) o.push(P([cx + x - w / 2, hy + 8.6, cx + x + w / 2, hy + 8.6, cx + x + w * 0.1, hy + 8.6 + h], 'boneOld', { ink: x < 0 ? -0.04 : -0.14 })); // his teeth, a canine at each corner
  for (const [x, h] of [[-3, 2], [-1, 1.4], [1.4, 1.8]]) o.push(P([cx + x - 0.6, hy + 14.6, cx + x + 0.6, hy + 14.6, cx + x, hy + 14.6 - h], 'boneOld', { ink: -0.2 }));
  o.push(
    strand(cx - 7.4, hy + 9.6, cx - 0.6, hy + 6.6, cx + 6.4, hy + 9.8, 0.8, 0.8, SK, 4, { ink: -0.08 }), // the upper lip, curled
    K(cx - 1, hy + 0.6, cx - 1.4, hy + 5.6, 1.6, 2.2, SK, { ink: -0.06 }), E(cx - 1.4, hy + 6, 2.6, 1.4, SK, { ink: -0.18 }), // the nose
    K(cx - 6, hy + 3, cx - 7.6, hy + 9, 0.4, 0.4, SK, { ink: -0.52, occ: false }), K(cx + 4, hy + 3.4, cx + 5.4, hy + 9, 0.4, 0.4, SK, { ink: -0.52, occ: false }), // the snarl's folds
  );
  // eyes deep in the shadow of the bear's jaw, violet with what took him
  const ey = hy - 1;
  o.push(
    E(cx - 4.8, ey, 3.6, 2.6, SK, { fl: 0.85, ink: -0.74 }), E(cx + 3.6, ey, 2.8, 2.5, SK, { fl: 0.85, ink: -0.74 }),
    E(cx - 4.6, ey + 0.4, 1.5, 1, 'emUnholy', { ink: pulse * 0.6 }), E(cx + 3.6, ey + 0.4, 1.1, 1, 'emUnholy', { ink: pulse * 0.6 }),
    X(cx - 5, ey - 0.1, 0.8, 0.8, '#f4ecff', { em: true }),
    K(cx - 9.6, ey - 3, cx - 0.8, ey - 1, 1.6, 1.3, SK, { ink: -0.14 }), K(cx + 0.6, ey - 1, cx + 7.6, ey - 2.8, 1.3, 1.2, SK, { ink: -0.2 }), // the brow, knotted
    Lt(cx, ey + 0.6, 9, '#a868ff', 0.4, 3),
  );

  // the bear's head over his, in its own form: round ears, the skull, a heavy brow, its upper jaw and fangs over his forehead
  for (const [x, y, r] of [[hx - 5, hy - 20.6, 3.8], [hx + 10, hy - 19.4, 4.2]]) o.push(E(x, y, r, r * 0.92, PE, { ink: -0.22 }), E(x + 0.2, y + 0.6, r * 0.5, r * 0.44, PE, { fl: 0.7, ink: -0.62 })); // ears, cupped
  o.push(
    E(hx + 3, hy - 11.5, 15, 10, PE, { ink: -0.2 }), // its skull
    strand(hx - 9, hy - 16, hx + 3, hy - 23, hx + 16, hy - 15, 0.6, 0.5, PE, 4, { ink: 0.04, occ: false }), // fur catching the light
    K(hx - 6, hy - 9.6, hx - 18, hy - 6.6, 6, 4.2, PE, { ink: -0.1 }), // the muzzle
    K(hx - 7, hy - 13.6, hx - 17, hy - 9.6, 1.4, 1, PE, { ink: 0.06, occ: false }), // the bridge of its nose, lit
    K(hx - 12, hy - 14.6, hx + 1, hy - 16.4, 2.8, 2.4, PE, { ink: -0.02 }), // its heavy brow
    E(hx - 6.4, hy - 11.8, 2.2, 1.3, 'scr_gum', { ink: -0.3 }), // its empty eye, under the brow
    E(hx - 20.4, hy - 6.6, 2.8, 2.3, 'scr_gum', { ink: -0.16 }), // its dead nose
    P([hx - 20.6, hy - 4.4, hx - 6, hy - 3.6, hx + 3, hy - 4.2, hx + 3, hy - 2, hx - 6, hy - 1.8, hx - 19.6, hy - 2.2], 'scr_gum', { ink: -0.2 }), // its gums
    strand(hx - 21, hy - 4.6, hx - 10, hy - 3, hx + 3, hy - 3.4, 1.5, 1.2, PE, 4, { ink: -0.3 }), // its lip
  );
  // its teeth: small incisors at the tip, the two great canines, then the cheek teeth between his eyes
  for (const [x, h, w, k] of [[-19.6, 1.4, 1, -0.3], [-18, 1.6, 1, -0.3], [-16.6, 5.4, 2, -0.42], [-14.2, 6.6, 2.4, -0.18], [-12, 1.8, 1.3, -0.3], [-5.6, 2, 1.4, -0.3], [2.6, 2.2, 1.4, -0.36]]) o.push(P([hx + x - w / 2, hy - 2.4, hx + x + w / 2, hy - 2.4, hx + x + w * 0.12, hy - 2.4 + h], 'bone', { bv: 0.5, ink: k }));

  // the taproots, out of the dark below and into his chest, the sap glowing in the wounds
  o.push(
    entry(wA, 3), entry(wB, 7),
    root(3, 99, 22, 92, wA[0], wA[1], 5.6, 2.8, 11, -0.08),
    root(77, 99, 72, 83, wB[0], wB[1], 4.8, 2.6, 23, -0.1),
    seep(wA, 0), seep(wB, 2),
    // the near arm raised from under the hide, the bearded axe in his fist, a root wound round the wrist
    K(72, 70 + by, 88, 56 + by * 0.5, 6.4, 5.4, SK, { ink: -0.38 }),
    K(88, 56 + by * 0.5, 84, 36, 5.4, 4.4, SK, { ink: -0.28 }),
    K(79, 66 + by * 0.8, 83.6, 60 + by * 0.6, 0.36, 0.3, SK, { ink: -0.14, occ: false }), // an old scar
    K(84, 60, 80, 6, 1.3, 1.2, 'woodDark', { ink: -0.1 }),
    P([79, 5, 83, 3, 89, 2.4, 94, 4, 95, 12, 93, 22, 89.6, 27, 88.6, 20, 86, 14, 82, 12.6], 'scr_bsSteel', { bv: 1.2, n: [0.2, -0.3, 1], ink: -0.42 }),
    strand(94.4, 5, 95.4, 13, 92.4, 21.6, 0.45, 0.35, 'scr_bsSteel', 3, { ink: 0.3, occ: false }), // its edge, catching the light
    K(84, 9, 89, 7, 0.7, 0.4, 'scr_rust', { fl: 0.6, occ: false }), K(88, 18, 90.4, 23, 0.5, 0.3, 'scr_rust', { fl: 0.6, occ: false }),
    K(79.6, 5.4, 82.6, 12.6, 1.6, 1.6, 'scr_bsSteel', { ink: -0.3 }), // the socket round the haft
    E(84, 34, 4.6, 4.2, SK, { ink: -0.16 }),
  );
  for (let i = 0; i < 3; i++) o.push(K(79.6, 31.6 + i * 2.4, 85.6, 31 + i * 2.4, 1.1, 1.1, SK, { ink: i % 2 ? -0.22 : -0.12 }));
  o.push(
    K(85, 44, 90, 40, 1, 1, RT, { ink: -0.1 }), K(84.4, 48, 90.6, 43.6, 1, 1, RT, { ink: -0.1 }), K(90, 43, 94, 60, 0.9, 0.7, RT, { ink: -0.1 }),
    // the hide falling over that shoulder
    E(72.6, 62.6 + by, 8.6, 5, PE, { a: 0.5, ink: -0.5 }),
  );
  for (let i = 0; i < 3; i++) o.push(K(67.6 + i * 4.2, 65.6 + by + i * 1.8, 68.4 + i * 4.6, 69.4 + by + i * 1.8, 1.3, 0.3, PE, { ink: -0.54 }));

  // the sap's light, from the wounds; the higher one lights his beard and snarl from below
  o.push(
    Lt(wB[0] - 2, wB[1] - 3, 26, '#d8e860', 0.38 + pulse, 8),
    Lt(wA[0], wA[1], 15, '#d8e860', 0.3 + pulse, 5),
  );
  return o;
}
