import { E, K, P, X, Lt, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9g, group A: the fiends of the roots. The Shadow Fiend, the Garmling, the Náströnd Feaster. Conventions: portraitKit.ts. */

/** A frame at (px, py), turned by ang, scaled by k: primitives in head space. */
function sframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  const pts = (a: number[]): number[] => { const out: number[] = []; for (let i = 0; i < a.length; i += 2) out.push(...pt(a[i], a[i + 1])); return out; };
  return {
    pt, pts,
    P: (a: number[], m: string, o?: PrimOptions) => P(pts(a), m, o),
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}) => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions) => { const [a, b] = pt(x, y); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
    Lt: (x: number, y: number, r: number, col: string, kk: number, z: number) => { const [a, b] = pt(x, y); return Lt(a, b, r * k, col, kk, z); },
    S: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n?: number, o?: PrimOptions) => { const a = pt(ax, ay), b = pt(bx, by), c2 = pt(cx, cy); return strand(a[0], a[1], b[0], b[1], c2[0], c2[1], r0 * k, r1 * k, m, n, o); },
  };
}

/** Turn a flat list of points about (cx, cy) by an. */
function turn(a: number[], cx: number, cy: number, an: number): number[] {
  const c = Math.cos(an), s = Math.sin(an), out: number[] = [];
  for (let i = 0; i < a.length; i += 2) { const x = a[i] - cx, y = a[i + 1] - cy; out.push(cx + x * c - y * s, cy + x * s + y * c); }
  return out;
}

/** A spiked edge along a quadratic a -> b (control c): every other point pushed out by amp on side sgn, leaning back along the curve (hackles, bristles). */
function spikes(a: Pt, c: Pt, b: Pt, n: number, amp: number, sgn: number, seed: number, lean = 0.5): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = qpt(a, c, b, i / n), l = Math.hypot(tx, ty) || 1;
    if (i % 2 === 0) { pts.push(x, y); continue; }
    const tf = (0.6 + 0.8 * hash2(i, seed)) * amp, ox = -sgn * (ty / l), oy = sgn * (tx / l);
    pts.push(x + ox * tf - (tx / l) * tf * lean, y + oy * tf - (ty / l) * tf * lean);
  }
  return pts;
}

// ================================================================ SHADOW FIEND
/**
 * A thing of smoke that crawled up from beneath the roots of the world, which only one who owes the Void
 * sees clearly: a horned mask of hardened smoke with violet slits for eyes and a hissing mouth of needles,
 * its image doubled where the eye cannot hold it; its heart a violet fire in a cage of black ribs; one
 * claw raised, white-yellow lightning crawling between the talons.
 */
export function shadowFiendPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const hp = [1, 1.1, 0.94, 1.05][f % 4]; // the heart's pulse
  const o: Out = [];
  const BG = 'scr_gShadowFiend', SM = 'scr_shadowFiendSmoke', DP = 'scr_shadowFiendDeep', WS = 'scr_shadowFiendWisp';
  const MK = 'scr_shadowFiendMask', MW = 'scr_shadowFiendMaw', CL = 'scr_shadowFiendClaw', HT = 'scr_shadowFiendHeart';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(50, 58, 58, 50, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(50, 74, 32, 26, BG, { fl: 1, ink: BAND[3] - 0.06 }));
  // the roots of the world overhead, that it crawled up from beneath
  for (let i = 0; i < 6; i++) {
    const x = 4 + i * 18 + hash2(i, 3) * 8, len = 8 + hash2(i, 5) * 14;
    o.push(strand(x, -2, x + (hash2(i, 7) - 0.5) * 10, len * 0.5, x + (hash2(i, 9) - 0.5) * 8, len, 2.2, 0.5, BG, 3, { ink: BAND[2] + 0.04 }));
  }
  const by = -b * 0.5;
  // the hunched shoulders, smoke tearing off their edges and streaming away to the left
  o.push(P([...spikes([-1, 86], [2, 54 + by], [34, 52 + by], 12, 5, -1, 3, 0.9), ...spikes([66, 52 + by], [90, 50 + by], [97, 72], 8, 4.4, -1, 5, 0.9), 104, 104, -4, 104], SM, { bv: 5, ink: -0.3 }));
  o.push(strand(6, 66 + by, 12, 55 + by, 32, 54 + by, 2.4, 1.2, WS, 4, { ink: -0.22, occ: false })); // the light along the shoulder
  // smoke tearing off the shoulder, streaming away to the left
  o.push(strand(18, 57 + by, 6, 50 + by, -4 + s, 48 + by, 3.4, 0.6, DP, 4, { ink: -0.04, occ: false }));
  // the heart: a violet fire showing through the torn-open chest, behind ribs of black, hardened smoke
  const hx = 50, hy = 77 + by;
  const band = (sc: number, m: string, ink: number): number => o.push(P([0, -16, 4, -11, 7, -4, 6, 3, 8, 9, 4, 15, 1, 21, -3, 15, -7, 10, -6, 3, -8, -4, -4, -10].map((v, i) => (i % 2 ? hy : hx) + v * sc * hp), m, { fl: 1, ink, occ: false }));
  band(1.25, 'emUnholy', -0.56 + (hp - 1) * 0.5);
  band(0.95, 'emUnholy', -0.3 + (hp - 1) * 0.5);
  o.push(E(hx - 0.4, hy - 1, 3.2 * hp, 4.6 * hp, HT, { fl: 1, ink: -0.14 + (hp - 1) * 0.4, occ: false }));
  // the two halves of the chest, the rent between them ragged
  o.push(P([32, 61 + by, 45, 62 + by, 44, 66, 46, 70, 42.6, 74, 45.4, 78, 42, 83, 45, 88, 42, 93, 43, 104, 18, 104, 22, 80], SM, { bv: 3, ink: -0.26 }));
  o.push(P([68, 61 + by, 55, 62 + by, 56.6, 67, 54, 71, 57.4, 76, 54.6, 81, 58, 86, 55, 91, 57.6, 104, 82, 104, 78, 80], SM, { bv: 3, ink: -0.32 }));
  // ribs of black across the rent
  for (const [y, dy] of [[67, -1.4], [74, -1.2], [81, -0.8]]) o.push(strand(41, y + by, 50, y + dy + by, 59, y + 0.6 + by, 1.3, 1.3, MK, 3, { ink: -0.2 }));

  const skull = [-5, -13, 5, -13, 9.6, -8, 11, -1, 9, 5, 6, 11, 2.4, 15, -2.4, 15, -6, 11, -9, 5, -11, -1, -9.6, -8];
  const horns = (Hf: ReturnType<typeof sframe>, m: string, o2: PrimOptions) => [Hf.S(-7, -10, -17, -14, -19, -24, 3, 0.8, m, 5, o2), Hf.S(7, -10, 17, -14, 18, -24, 3, 0.8, m, 5, o2)];
  o.push(P([40, 50 + by, 60, 50 + by, 64, 64 + by, 36, 64 + by], DP, { bv: 3, ink: -0.24 })); // the neck
  // the head: a horned mask of hardened smoke, the horns fraying off into smoke at their tips
  const H = sframe(50, 37 + by, -0.06, 1.55);
  o.push(horns(H, MK, { ink: 0.02 }));
  o.push(H.S(-19, -24, -21, -30, -28, -31 + s * 0.5, 1.4, 0.4, WS, 4, { ink: -0.28, occ: false }));
  o.push(H.S(18, -24, 17, -30, 10, -33 + s * 0.5, 1.4, 0.4, WS, 4, { ink: -0.28, occ: false }));
  o.push(H.P(skull, MK, { bv: 4, ink: 0.02 }));
  // the planes of the mask: a ridge up the forehead, the cheekbones, the brow knotted hard down
  o.push(H.K(0, -12.4, 0, -5, 1.6, 0.8, MK, { ink: 0.12, occ: false }));
  o.push(H.K(-9.4, 1.4, -4, 4.6, 1.6, 0.8, MK, { ink: 0.1, occ: false }), H.K(9.4, 1.4, 4, 4.6, 1.6, 0.8, MK, { ink: 0.04, occ: false }));
  o.push(H.E(-5, -1.4, 4, 2.2, MW, { a: 0.32 }), H.E(5, -1.4, 4, 2.2, MW, { a: -0.32 }));
  o.push(H.E(-5, -1.2, 3.4, 0.62, 'emUnholy', { a: 0.32, ink: (hp - 1) * 0.3 }), H.E(5, -1.2, 3.4, 0.62, 'emUnholy', { a: -0.32, ink: (hp - 1) * 0.3 }));
  o.push(H.X(-4, -1.2, 1, 0.7, '#f0e0ff', { em: true }), H.X(4, -1.2, 1, 0.7, '#f0e0ff', { em: true }));
  o.push(H.K(-10.4, -5.4, -1.2, -2.8, 2.2, 1.2, MK, { ink: 0.14 }), H.K(10.4, -5.4, 1.2, -2.8, 2.2, 1.2, MK, { ink: 0.08 }));
  // the slits of its nostrils; the mouth, open in a hiss, needles in it and violet behind them
  o.push(H.K(-1.4, 3.4, -0.8, 5, 0.6, 0.4, MW, { occ: false }), H.K(1.4, 3.4, 0.8, 5, 0.6, 0.4, MW, { occ: false }));
  const mo = [0.3, 0.5, 0.7, 0.5][f % 4];
  o.push(H.P([-7.4, 7, -3, 6.4, 0, 7, 3, 6.4, 7.4, 7, 5.6, 10.4 + mo, 2, 12.2 + mo, -2, 12.2 + mo, -5.6, 10.4 + mo], MW));
  o.push(H.E(0, 10.2 + mo * 0.5, 2.8, 0.8, 'emUnholy', { fl: 1, ink: -0.66 + (hp - 1) * 0.4, occ: false }));
  for (const x of [-5.6, -3.4, -1.2, 1.2, 3.4, 5.6]) o.push(H.P([x - 0.6, 6.8, x + 0.6, 6.8, x * 0.96, 9.8], CL, { ink: -0.02 }));
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) o.push(H.P([x - 0.55, 11.8 + mo, x + 0.55, 11.8 + mo, x, 9.4 + mo], CL, { ink: -0.18 }));
  o.push(H.Lt(0, -1.4, 7, '#a868ff', 0.45, 3));

  // the near claw raised, lightning crawling between its talons
  o.push(K(72, 58 + by, 88, 72, 6.4, 5, SM, { ink: -0.24 }));
  o.push(K(88, 72, 84, 52, 5, 3.6, SM, { ink: -0.14 }));
  o.push(E(83, 49, 4.6, 4, SM, { ink: -0.06 }));
  const tips: Pt[] = [[73, 34], [80, 30], [88, 31], [94, 38]];
  for (const [tx, ty] of tips) {
    const mx = (83 + tx) / 2 + (tx - 83) * 0.08, my = (49 + ty) / 2 + 1;
    o.push(K(83, 49, mx, my, 1.6, 1.2, SM, { ink: 0.04 }), K(mx, my, tx, ty, 1.2, 0.3, CL, { ink: -0.04 }));
  }
  let ax = tips[0][0], ay = tips[0][1];
  for (let i = 1; i < 4; i++) {
    const [tx, ty] = tips[i];
    const x = (ax + tx) / 2 + (hash2(f * 7 + i, 13) - 0.5) * 4, y = (ay + ty) / 2 - 2 + (hash2(f * 7 + i, 17) - 0.5) * 4;
    o.push(K(ax, ay, x, y, 0.55, 0.5, 'emBolt', { occ: false, ink: 0.1 }), K(x, y, tx, ty, 0.5, 0.5, 'emBolt', { occ: false, ink: 0.1 }));
    ax = tx; ay = ty;
  }
  { const j = (hash2(f, 21) - 0.5) * 3; o.push(K(80, 30, 77 + j, 22, 0.55, 0.5, 'emBolt', { occ: false, ink: 0.1 }), K(77 + j, 22, 82 - j, 14, 0.5, 0.5, 'emBolt', { occ: false, ink: 0.1 })); }
  for (let i = 0; i < 3; i++) { const [x, y] = [[76, 26], [92, 30], [86, 24], [96, 44]][(i + f) % 4]; o.push(X(x - 0.5, y - 0.5, 1, 1, i ? '#fff27a' : '#ffffff', { em: true })); }
  o.push(Lt(84, 34, 18, '#fff27a', 0.55, 4));
  // the heart's violet light, up under its jaw
  o.push(Lt(hx, hy - 4, 40, '#a868ff', 0.9 * hp, 9));
  return o;
}

// =================================================================== GARMLING
/**
 * The whelp that came out of Hel bloody about the breast (Baldrs draumar) and bayed at Óðinn; Garmr's get,
 * slipped from the chain before Gnipahellir. Head low, hackles up in a ridge of spikes, the jaw dropped in a
 * bay with the fire of its throat lighting it from below; violet eyes with ember at the core, the spiked
 * collar, and the snapped chain hanging from it.
 */
export function garmlingPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.12, 0.9, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gGarmling', HD = 'scr_garmlingHide', DK = 'scr_garmlingHideDark', IR = 'scr_garmlingIron', FG = 'scr_garmlingFang';
  // Gnipahellir: the cliff-face in broken slabs, the cave's mouth black behind the head
  o.push(P(FULL, BG, { ink: BAND[1] }));
  const slabs: Array<[number[], number]> = [[[-1, -1, 40, -1, 34, 14, 10, 22, -1, 18], BAND[2] - 0.02], [[40, -1, 97, -1, 97, 16, 72, 24, 46, 20, 34, 14], BAND[2] + 0.04],
    [[-1, 18, 10, 22, 34, 14, 46, 20, 36, 40, 14, 44, -1, 40], BAND[3] - 0.06], [[46, 20, 72, 24, 97, 16, 97, 34, 80, 38, 60, 36], BAND[3] - 0.02], [[-1, 40, 14, 44, 30, 56, 20, 97, -1, 97], BAND[2]]];
  for (const [pts, ink] of slabs) o.push(P(pts, BG, { ink }));
  for (const [x0, y0, x1, y1] of [[34, 14, 40, -1], [10, 22, 14, 44], [72, 24, 80, 38]]) o.push(K(x0, y0, x1, y1, 0.5, 0.4, BG, { ink: BAND[1] }));
  o.push(P([36, 97, 42, 64, 52, 46, 66, 38, 82, 37, 97, 42, 97, 97], BG, { ink: BAND[1] - 0.1 })); // the cave's mouth
  for (const [x, l, w] of [[62, 46, 2], [72, 45, 2.6], [86, 47, 2]]) o.push(P([x - w, 38.4, x + w, 38.2, x + 0.3, l], BG, { ink: BAND[2] - 0.04 }));

  const hb = -b * 0.45;
  const H = sframe(60, 50 + hb, 0.5, 1.7);
  const jaw = [0.36, 0.4, 0.44, 0.4][f % 4];
  const JC: Pt = [-4, 5];
  /** A head-space point turned about the mouth's corner by the dropped jaw. */
  const jp = (x: number, y: number): Pt => { const [a, c] = turn([x, y], ...JC, jaw); return [a, c]; };
  // the neck and shoulders hunched up behind the lowered head, the hackles up in a ridge of bristles
  const nape = H.pt(-15, -9);
  o.push(P([...spikes(nape, [30, 4], [-2, 16], 18, 6, -1, 7, 0.7), -1, 97, 64, 97,
    ...spikes([64, 97], [56, 82], [44, 70], 6, 2.2, -1, 3, 0.5), ...H.pt(-8, 9.6), ...H.pt(-16, 2)], DK, { bv: 6, ink: -0.04 }));
  // the light catching the bristles of the crest, and the shoulder's mass under the hide
  { const n0 = H.pt(-13, -6), inner: number[] = [];
    for (let i = 8; i >= 0; i--) { const [x, y] = qpt(n0, [36, 12], [6, 24], i / 8); inner.push(x, y); }
    o.push(P([...spikes(H.pt(-14, -8.4), [32, 7], [2, 20], 16, 4.4, -1, 11, 0.8), ...inner], HD, { bv: 2, ink: -0.02, occ: false })); }
  // the breast under the jaw, and the blood matted down it in clotted streaks
  o.push(P([40, 62, 48, 68, 56, 80, 62, 97, 30, 97, 32, 78], HD, { bv: 4, ink: -0.16, occ: false }));
  o.push(P([38, 64, 45, 65, 49, 71, 47, 74, 44, 72, 41, 74, 37, 72], 'scr_garmlingBlood', { bv: 1.6, ink: -0.16, occ: false }));
  for (const [x0, y0, x1, y1, x2, y2, r] of [[46, 70, 49, 76, 48, 84, 1.9], [42, 72, 44, 78, 42, 87, 1.7], [39, 72, 38, 76, 36.6, 81, 1.4], [44, 66, 51, 70, 52.6, 77, 1.3]]) {
    o.push(strand(x0, y0, x1, y1, x2, y2, r, 0.5, 'scr_garmlingBlood', 4, { ink: -0.16, occ: false }));
  }
  // the collar: a broad band of black iron round the neck behind the skull, spikes standing out from it
  const ca: Pt = [47, 21], cc: Pt = [31, 37], cb: Pt = [37, 61], nc: Pt = [56, 42];
  o.push(strand(ca[0], ca[1], cc[0], cc[1], cb[0], cb[1], 4.2, 4.2, IR, 6, { fl: 0.3, ink: -0.06 }));
  o.push(strand(ca[0] - 2, ca[1] - 2.4, cc[0] - 3, cc[1] - 0.6, cb[0] - 2.6, cb[1] + 1.2, 0.8, 0.8, IR, 6, { ink: 0.2, occ: false })); // its lit edge
  for (const t of [0.18, 0.4, 0.62, 0.84]) { const [x, y] = qpt(ca, cc, cb, t); o.push(E(x + 0.6, y, 1, 1, IR, { ink: 0.14 })); } // rivets
  for (let i = 0; i < 5; i++) {
    const t = 0.04 + i * 0.23, [x, y, tx, ty] = qpt(ca, cc, cb, t), l = Math.hypot(tx, ty), rx = x - nc[0], ry = y - nc[1], rl = Math.hypot(rx, ry);
    const len = i === 0 || i === 4 ? 7.6 : 6.4, w = 2.2;
    const bx = x + (rx / rl) * 3, by2 = y + (ry / rl) * 3;
    o.push(P([bx - (tx / l) * w, by2 - (ty / l) * w, bx + (rx / rl) * len, by2 + (ry / rl) * len, bx + (tx / l) * w, by2 + (ty / l) * w], 'steel', { bv: 1, ink: -0.14 }));
  }
  // the ring at the throat, the snapped chain hanging off it
  o.push(E(39, 66, 2.6, 3, IR, { fl: 0.3 }));
  const links = [[39, 69.4], [38.6 + s * 0.2, 74], [39.2 + s * 0.4, 78.6], [38.6 + s * 0.6, 83.4]];
  links.forEach(([x, y], i) => {
    if (i % 2) o.push(K(x, y - 2.2, x, y + 2.2, 0.8, 0.8, IR, { ink: -0.08 }));
    else { o.push(E(x, y, 1.8, 2.8, IR, { fl: 0.3 })); o.push(E(x, y, 0.7, 1.6, 'scr_garmlingSocket')); }
  });
  o.push(P([36.8 + s * 0.6, 85.8, 37.8 + s * 0.6, 86, 37.2 + s * 0.6, 89.4, 36 + s * 0.6, 88.4], IR, { bv: 0.4 })); // the snapped half-link

  // the far ear, pricked back beyond the skull
  o.push(H.P([-1, -10.6, -6, -11.8, -11, -20.4, -4.6, -15], DK, { bv: 1, ink: -0.06 }));
  // the inside of the mouth: the fire of its throat, flat as a forge's mouth
  o.push(H.P([...turn([-4, 6, 3, 6.6, 10, 7], ...JC, jaw), 13.6, 3.4, 8, 3, 0, 4], 'scr_garmlingThroat'));
  { const [x, y] = turn([1, 6.4], ...JC, jaw * 0.5); o.push(H.E(x, y, 6.6, 3.2, 'emFire', { a: 0.1 + jaw * 0.5, fl: 1, ink: -0.36 + (fl - 1) * 0.5, occ: false }), H.E(x - 1.6, y, 3.4, 1.6, 'emFireCore', { a: 0.1 + jaw * 0.5, fl: 1, ink: -0.1 + (fl - 1) * 0.4, occ: false })); }
  // the head: a broad skull with a hard stop, a heavy blunt muzzle
  o.push(H.P([2, -8, -1, -11.6, -7, -12.8, -13, -10.8, -17, -5, -17, 2, -13, 7.6, -6, 9.6, -1, 7, 1, 3, 3, -3], HD, { bv: 5, ink: -0.02 }));
  o.push(H.E(-5, -8.4, 6, 3.4, HD, { fl: 0.5, ink: 0.06, occ: false })); // the domed forehead in the light
  o.push(H.E(-9, 2, 6.4, 5.4, HD, { fl: 0.4, ink: -0.16, occ: false })); // the jaw muscle
  // the lower jaw, dropped in the bay; its teeth
  o.push(H.P(turn([-5, 5.4, 3, 6.2, 10, 6.6, 13.4, 6.6, 13.6, 8.6, 10, 10, 3, 10.6, -4, 10], ...JC, jaw), HD, { bv: 1.8, ink: -0.08 }));
  o.push(H.P(turn([10, 6.6, 12.2, 6.6, 11.2, 2.6], ...JC, jaw), FG, { bv: 0.5 })); // the lower canine
  for (const x of [2.6, 5.2, 7.6]) o.push(H.P(turn([x - 0.7, 6.4, x + 0.7, 6.4, x, 4.8], ...JC, jaw), FG, { ink: -0.1 }));
  o.push(H.K(...jp(-3, 10.4), ...jp(12, 9.4), 0.7, 0.5, 'scr_garmlingGum', { occ: false, ink: -0.1 })); // the lip under it
  // the muzzle, deep and blunt, the flews hanging at the corner
  o.push(H.K(0, -1.8, 12.6, -0.6, 5.8, 4.6, HD, { ink: 0.02 }));
  o.push(H.P([0, 2, 6, 2.6, 12, 2.2, 15.4, 1.4, 15.6, 3.6, 11, 4.6, 5, 5.2, 0, 7, -2, 4.6], HD, { bv: 1.6, ink: -0.06 }));
  o.push(H.P([-0.4, 4.2, 2, 7.6, -0.6, 8.8, -3, 6], 'scr_garmlingGum', { bv: 0.8, ink: -0.1 })); // the flew at the corner
  // the upper teeth bared: the great canine, the carnassials
  o.push(H.P([9.6, 3.6, 11.8, 3.6, 10.8, 9.2], FG, { bv: 0.6, ink: 0.04 }));
  for (const [x, h] of [[3, 1.8], [5.4, 2.2], [7.6, 1.6], [13.6, 1.2]]) o.push(H.P([x - 0.8, 3.8, x + 0.8, 3.8, x, 3.8 + h], FG, { ink: -0.06 }));
  o.push(H.K(-1, 4.2, 14.6, 3.2, 0.5, 0.4, 'scr_garmlingGum', { occ: false })); // the lip drawn up
  // the bridge, wrinkled in the snarl
  o.push(H.K(2.4, -6.4, 12.6, -3.6, 1.4, 0.9, HD, { ink: 0.1, occ: false }));
  for (let i = 0; i < 3; i++) o.push(H.K(4.4 + i * 2.4, -6.4 + i * 0.7, 5.2 + i * 2.4, -3.4 + i * 0.7, 0.45, 0.35, DK, { ink: -0.2, occ: false }));
  o.push(H.E(15.4, -0.8, 2.8, 2.6, 'scr_garmlingNose', { fl: 0.1 }));
  o.push(H.K(16.2, 0.8, 17.6, 0.6, 0.5, 0.4, 'scr_garmlingSocket', { occ: false }));
  o.push(H.X(14.8, -2.4, 0.9, 0.7, '#d8d2dc', { em: true }));
  // the eye: violet with ember at the core, rolled up at you under the brow
  o.push(H.E(-3.2, -4.4, 3.8, 2.2, 'scr_garmlingSocket', { a: -0.3 }));
  o.push(H.E(-3, -4.4, 2.8, 1.5, 'emUnholy', { a: -0.3, ink: -0.06 }));
  o.push(H.E(-2.4, -4.8, 1.1, 0.9, 'emFireCore', { ink: (fl - 1) * 0.4 }));
  o.push(H.K(-7.6, -7.2, 1.6, -6.2, 1.6, 1, HD, { ink: 0.08 })); // the brow, hard down
  o.push(H.E(4, -6.4, 1.3, 0.8, 'emUnholy', { ink: -0.3 })); // the far eye, beyond the bridge
  // the near ear: pricked back, its hollow dark, a notch torn from its back edge
  o.push(H.P([-5, -11.6, -9, -15, -15, -19.4, -21, -19.6, -18.4, -16, -19.6, -14.4, -16.4, -13.6, -14, -9.6], HD, { bv: 1.2, ink: 0.04 }));
  o.push(H.P([-7, -11.6, -14.6, -17.4, -18.4, -18.2, -15.6, -14.4, -12.6, -10.8], 'scr_garmlingSocket', { bv: 0.6 }));
  o.push(H.K(-8, -12.4, -14.4, -17, 0.5, 0.3, HD, { ink: -0.1, occ: false })); // the hollow's lit rim
  // embers off its breath, rising
  for (let i = 0; i < 3; i++) {
    const t = ((f + i * 1.4) % 4) / 4, [mx, my] = H.pt(14, 9);
    o.push(X(mx + 2 + t * 6 + i * 2, my - t * 18 - i * 3, 0.8, 0.8, i ? 'emFire:4' : 'emFireCore:4', { em: true }));
  }
  o.push(H.Lt(-1.8, -4.6, 5, '#a868ff', 0.5, 3));
  // the fire of its throat, lighting it from below
  { const [lx, ly] = H.pt(8, 9); o.push(Lt(lx, ly, 46, '#ff8a2c', 1.05 * fl, 7)); }
  return o;
}

// ========================================================== NÁSTRÖND FEASTER
/**
 * A corpse-eater of Náströnd, the shore of corpses, where the hall is woven of serpents' backs and venom
 * drips in at the smoke-hole (Völuspá 38). Bloated past standing: its belly split into a second mouth, the
 * lowest ribs gone to its teeth, glowing violet from within; the small head on the hump hangs slack-jawed;
 * a gnawed thigh-bone in its fist.
 */
export function nastrondFeasterPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const op = [0, 0.4, 0.7, 0.4][f % 4]; // the belly-maw opens and closes
  const gl = [1, 1.08, 1.16, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gNastrondFeaster', FL = 'scr_feasterFlesh', FD = 'scr_feasterFleshDark', VN = 'scr_feasterVein';
  const LP = 'scr_feasterLip', TO = 'scr_feasterTooth', MW = 'scr_feasterMaw';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 58, 58, 52, BG, { fl: 1, ink: BAND[2] }));
  // the hall woven of serpents' backs: spines laid in courses, wattled through uprights
  for (let r = 0; r < 4; r++) {
    const y = 6 + r * 13;
    for (let i = 0; i < 14; i++) {
      const x = -2 + i * 7.6 + (r % 2) * 3.8, yy = y + Math.sin(i * 1.3 + r) * 1.2;
      o.push(E(x, yy, 3.2, 2.2, BG, { fl: 1, ink: BAND[3] - 0.06 - (r > 1 ? 0.06 : 0) }));
    }
  }
  for (const x of [16, 48, 80]) o.push(P([x - 2, -1, x + 2, -1, x + 2.4, 97, x - 2.4, 97], BG, { ink: BAND[1] + 0.02 }));
  // venom dripping in through the roof
  for (const [x, y0, sp] of [[26, 4, 9], [72, 2, 11]]) {
    const y = y0 + ((f * sp + x) % 40);
    o.push(E(x, y, 0.7, 1.2, 'emPoison', { ink: -0.62 }));
  }

  const by = -b * 0.6;
  // the back arm, knuckles on the ground
  o.push(K(22, 44, 10, 72, 6, 5, FD, { ink: -0.1 }));
  o.push(K(10, 72, 6, 92, 5, 4.6, FD, { ink: -0.12 }));
  o.push(E(7, 93, 6, 4, FD, { ink: -0.1 }));
  for (let i = 0; i < 3; i++) o.push(K(3 + i * 3.6, 95, 1 + i * 3.6, 99, 1, 0.6, 'boneOld', { ink: -0.2 }));
  // the hump, and the swollen belly
  o.push(E(40, 38 + by * 0.5, 22, 18, FL, { fl: 0.1, ink: -0.14 }));
  o.push(E(48, 68 + by * 0.3, 36 + b * 0.5, 30 + b * 0.5, FL, { fl: 0.05, ink: -0.02 }));
  o.push(E(42, 60 + by * 0.3, 20, 14, FL, { fl: 0.3, ink: 0.04, occ: false })); // the light on the swell
  // marbling: dark veins spidering over the swell
  for (const [x0, y0, x1, y1, x2, y2] of [[22, 52, 30, 48, 36, 40], [28, 82, 22, 74, 18, 66], [66, 50, 72, 56, 78, 54], [70, 84, 76, 78, 82, 80], [56, 44, 52, 38, 56, 32]]) {
    o.push(strand(x0, y0, x1, y1, x2, y2, 0.6, 0.25, VN, 3, { ink: -0.1, occ: false }));
    o.push(K(x1, y1, x1 + (hash2(x0, y0) - 0.5) * 8, y1 - 4, 0.4, 0.2, VN, { ink: -0.1, occ: false }));
  }
  // the stretch-splits of skin over the gut
  for (const [x, y, a] of [[30, 90, 0.3], [64, 92, -0.3], [76, 70, -1.2]]) o.push(E(x, y, 4, 0.7, FD, { a, ink: -0.3, occ: false }));
  // the belly-maw: the lips, the violet within, the gullet
  const mx = 48, my = 70 + by * 0.3;
  const top = [24, my - 1, 32, my - 4 - op, 40, my - 5 - op, 48, my - 5.4 - op, 56, my - 5 - op, 64, my - 4 - op, 72, my - 1];
  const bot = [72, my - 1, 66, my + 5 + op * 2, 58, my + 8 + op * 2.4, 48, my + 9 + op * 2.6, 38, my + 8 + op * 2.4, 30, my + 5 + op * 2];
  o.push(P([...top, ...bot.slice(2)], LP, { bv: 3, ink: -0.1 }));
  const inner = (k: number): number[] => { const out: number[] = []; for (let i = 0; i < top.length; i += 2) out.push(mx + (top[i] - mx) * k, my + (top[i + 1] - my) * k); for (let i = 2; i < bot.length; i += 2) out.push(mx + (bot[i] - mx) * k, my + (bot[i + 1] - my) * k); return out; };
  o.push(P(inner(0.86), MW, { ink: -0.4 + (gl - 1) * 0.5 }));
  o.push(P(inner(0.6), MW, { ink: -0.16 + (gl - 1) * 0.5 }));
  o.push(E(mx, my + 1.6 + op, 7, 2.2 + op, 'scr_feasterGullet', { fl: 0.6 }));
  // the upper teeth: the lowest ribs, split from the breast and grown down into fangs
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6, x = 26 + t * 44, y = my - 4.6 - op - Math.sin(t * Math.PI) * 1.2, h = 4 + Math.sin(t * Math.PI) * 3 + hash2(i, 3) * 1.6;
    const lean = (t - 0.5) * 3;
    o.push(K(x - lean * 2, y - 8, x, y, 1.6, 1.3, TO, { ink: -0.3 })); // the rib's root, under the skin
    o.push(P([x - 1.5, y - 0.6, x + 1.5, y - 0.6, x + lean * 0.4, y + h], TO, { bv: 0.7, ink: -0.04 }));
  }
  // the lower teeth, broken and uneven
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.7) / 6, x = 30 + t * 38, y = my + 6 + op * 2.2 + Math.sin(t * Math.PI) * 2, h = 3 + hash2(i, 9) * 2.6;
    o.push(P([x - 1.3, y + 0.6, x + 1.3, y + 0.6, x + 0.3, y - h], TO, { bv: 0.6, ink: -0.12 }));
  }
  // a string of drool, glowing, swinging from the lip
  o.push(strand(44, my + 8 + op * 2.4, 43 + s * 0.6, my + 14, 44 + s, my + 18 + op, 0.5, 0.35, MW, 3, { ink: -0.2, occ: false }));
  o.push(E(44 + s, my + 19 + op, 0.8, 1, MW, { ink: -0.1 }));

  // the small head on the hump, the jaw hanging slack
  const hx = 64, hy = 26 + by;
  o.push(E(hx - 2, hy + 10, 7, 6, FL, { ink: -0.18 })); // the neck, sunk in fat
  o.push(E(hx, hy, 10, 10.6, FL, { fl: 0.15, ink: -0.04 }));
  o.push(P([hx - 6, hy + 5, hx + 8, hy + 4, hx + 10, hy + 7, hx + 9, hy + 16, hx + 4, hy + 19, hx - 3, hy + 16], FL, { bv: 2, ink: -0.08 })); // the slack jaw
  o.push(P([hx - 2, hy + 5.4, hx + 8, hy + 5, hx + 7.4, hy + 13, hx + 3, hy + 15, hx - 1, hy + 11], 'scr_feasterMouth'));
  for (let i = 0; i < 4; i++) o.push(X(hx - 1 + i * 2.2, hy + 5, 1.2, 1.6, 'scr_feasterTooth:' + (i % 2 ? 2 : 3)));
  o.push(X(hx + 1, hy + 12.4, 1.2, 1.4, 'scr_feasterTooth:2'), X(hx + 4.2, hy + 12.2, 1.2, 1.6, 'scr_feasterTooth:3'));
  o.push(E(hx + 1, hy + 1.2, 1.4, 1.2, FD, { ink: -0.3 })); // the nose: a pit
  // the eyes: small, set deep, violet
  o.push(E(hx - 3.6, hy - 2.4, 2.8, 2.2, FD, { fl: 0.8, ink: -0.4 }), E(hx + 4.6, hy - 2.6, 2.4, 2, FD, { fl: 0.8, ink: -0.4 }));
  o.push(E(hx - 3.4, hy - 2.2, 1.3, 1.1, 'emUnholy', { ink: (gl - 1) * 0.4 }), E(hx + 4.6, hy - 2.4, 1.1, 1, 'emUnholy', { ink: (gl - 1) * 0.4 }));
  o.push(K(hx - 7, hy - 5, hx + 7, hy - 5.4, 1.4, 1.2, FL, { ink: 0.04 })); // the brow
  // lank grey hair off the crown
  for (const [x0, y0, x1, y1, x2, y2, r] of [[-4, -9, -10, -6, -12, 4, 0.8], [0, -10, -6, -6, -8, 6, 0.7], [-7, -6, -12, -1, -11, 10, 0.6], [4, -9.6, 9, -6, 11, 1, 0.6]]) {
    o.push(strand(hx + x0, hy + y0, hx + x1 + s * 0.3, hy + y1, hx + x2 + s * 0.6, hy + y2, r, 0.2, 'scr_feasterHair', 4, { ink: -0.2, occ: false }));
  }
  o.push(Lt(hx, hy - 2, 5, '#a868ff', 0.4, 3));

  // the front arm, and the gnawed thigh-bone in its fist
  o.push(K(72, 40 + by, 82, 58, 6.4, 5.4, FL, { ink: -0.06 }));
  o.push(K(82, 58, 80, 74, 5.4, 4.6, FL, { ink: -0.02 }));
  const bA = [70, 92], bB = [96, 46];
  o.push(K(bA[0], bA[1], bB[0], bB[1], 2.2, 1.8, 'bone', { ink: -0.06 }));
  o.push(E(bA[0], bA[1], 3.4, 2.6, 'bone', { a: 0.6 }), E(bA[0] + 2, bA[1] + 1, 2.4, 2.2, 'bone', { ink: -0.06 }));
  o.push(E(bB[0] - 1, bB[1] + 1, 3, 2.6, 'bone', { a: 0.6, ink: -0.04 }));
  for (const [t, d] of [[0.62, 1], [0.7, -1], [0.78, 1]]) { const x = bA[0] + (bB[0] - bA[0]) * t, y = bA[1] + (bB[1] - bA[1]) * t; o.push(E(x + d * 1.2, y + d * 0.6, 1.1, 0.7, 'scr_feasterGullet', { a: -1 })); } // tooth-marks
  o.push(E(bA[0] + (bB[0] - bA[0]) * 0.28, bA[1] + (bB[1] - bA[1]) * 0.28, 2.6, 2, 'scr_feasterLip', { a: -1, ink: -0.1 })); // a shred of meat on it
  o.push(E(80, 74, 5, 4.6, FL, { ink: 0.02 })); // the fist
  for (let i = 0; i < 3; i++) o.push(K(76.4 + i * 2.6, 73, 75.6 + i * 2.6, 79, 1.5, 1.3, FL, { ink: i % 2 ? -0.06 : 0.04 }));
  o.push(K(84, 72, 79.6, 70.4, 1.5, 1.2, FL, { ink: 0.06 }));

  // the belly-maw's light, on the bone, the hump and the jaw above
  o.push(Lt(mx, my, 54, '#a868ff', 1.05 * gl, 9));
  return o;
}
