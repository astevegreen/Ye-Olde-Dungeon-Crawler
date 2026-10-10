import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, ground, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Portraits of the Maw: Víðnir, Sköll and the Malice-Weaver. Conventions: portraitKit.ts. */

/** `frame()` with a scale: local units times k. */
function sframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  return {
    pt,
    P: (pts: number[], m: string, o?: PrimOptions): Prim => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}): Prim => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions): Prim => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions): Prim => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
    Lt: (x: number, y: number, r: number, col: string, kk: number, z: number): Prim => { const [a, b] = pt(x, y); return Lt(a, b, r * k, col, kk, z); },
  };
}

/**
 * Herald of the Wyrm, neck reared proud, looking down his snout mid-prophecy: a crown of horn spines, a bronze-ringed barbel beard, the fang sigil on his tabard.
 * He holds the shed fang of Níðhögg, its green arc lighting his jaw.
 */
export function vidnirPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.8, 1.25, 0.92][f % 4];
  const ja = [0.08, 0.11, 0.15, 0.1][f % 4];
  const o: Out = [];
  const BV = 'scr_gVidnir', SC = 'scr_vidnirScale', MN = 'scr_vidnirMantle';
  o.push(ground(BV, 76, 44, 80, 78));

  // the banner of the Maw, hanging behind him in the dark
  const w = s * 0.6;
  o.push(
    K(6, 99, 7, 3, 1.4, 1.2, 'woodDark', { ink: -0.34 }),
    P([7, -1, 9.4, 4, 4.6, 4], 'bronze', { bv: 0.8, ink: -0.36 }),
    K(-1, 8, 27, 7, 1, 1, 'woodDark', { ink: -0.34 }),
    P([0, 9, 26, 8, 26 + w, 38, 23 + w, 34, 20 + w, 44, 17, 37, 13 + w, 49, 10, 40, 6 + w, 46, 3, 38, 0, 42], 'scr_vidnirBanner', { bv: 2.4, ink: -0.5 }),
    P([6, 13.6, 19, 13.2, 15, 21, 12.6 + w * 0.3, 31, 10, 21], 'boneOld', { bv: 1.2, ink: -0.56 }),
  );

  const hb = -b * 0.5;
  o.push(
    // the mantle, its hood fallen back in heavy folds round the neck
    P([-2, 97, -2, 82, 8, 76, 18, 72, 26, 68, 48, 71, 60, 76, 72, 84, 78, 97], MN, { bv: 6, n: [0, -0.15, 1] }),
    E(34, 73, 17, 7, MN, { fl: 0.3, ink: -0.04 }),
    K(19, 76, 50, 77, 2, 2, MN, { ink: -0.32 }),
    // the linen tabard in the open front, and its sigil: the wyrm's fang
    P([42, 97, 46, 81, 58, 81, 62, 97], 'linen', { bv: 2, ink: -0.14 }),
    P([47, 85, 57, 85, 54, 90, 52, 97, 50, 90], SC, { bv: 0.8, ink: -0.2 }),
  );

  // the neck, held high
  const n0: Pt = [36, 99], n1: Pt = [30, 66], n2: Pt = [43, 32 + hb];
  const nr = (t: number): number => 11 - t * 3;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, [x, y] = qpt(n0, n1, n2, t);
    o.push(E(x, y, nr(t), nr(t) * 1.05, SC, { fl: 0.2, ink: -0.2 }));
  }
  // scales on its back, lapping down
  for (let i = 0; i <= 7; i++) {
    const t = 0.24 + (i / 7) * 0.66, [x, y, tx, ty] = qpt(n0, n1, n2, t), l = Math.hypot(tx, ty), r = nr(t);
    const nx = ty / l, ny = -tx / l;
    for (let j = 0; j < 3; j++) {
      const k = 0.05 + j * 0.34 + (i % 2) * 0.17;
      o.push(E(x + nx * r * k, y + ny * r * k, 2.5, 1.7, SC, { fl: 0.6, a: Math.atan2(ty, tx) + Math.PI / 2, ink: -0.3 - j * 0.05 + hash2(i, j) * 0.05 }));
    }
  }
  // the pale throat: a strip of scutes down the front, seams between
  for (let i = 0; i <= 7; i++) {
    const t = 0.18 + (i / 7) * 0.74, [x, y, tx, ty] = qpt(n0, n1, n2, t), l = Math.hypot(tx, ty), r = nr(t);
    const nx = -ty / l, ny = tx / l, ux = tx / l, uy = ty / l;
    const cx = x + nx * r * 0.68, cy = y + ny * r * 0.68;
    o.push(
      E(cx, cy, r * 0.3, 3.2, 'scr_vidnirThroat', { a: Math.atan2(ty, tx) + Math.PI / 2, fl: 0.4, ink: -0.36 }),
      K(cx - nx * r * 0.28 + ux * 3, cy - ny * r * 0.28 + uy * 3, cx + nx * r * 0.24 + ux * 3.2, cy + ny * r * 0.24 + uy * 3.2, 0.3, 0.3, 'scr_vidnirThroat', { ink: -0.62, occ: false }),
    );
  }
  // a bronze torc where the neck leaves the hood
  o.push(
    strand(23, 67, 33, 72.4, 43, 66.4, 1.5, 1.5, 'scr_bronzeOld', 5, { fl: 0.3 }),
    E(43.4, 66.2, 2, 2, 'scr_bronzeOld'), E(22.8, 67, 1.7, 1.7, 'scr_bronzeOld', { ink: -0.2 }),
  );

  // the head, in its own frame: x along the snout, tipped down at you
  const HK = 1.26, H = sframe(41, 30 + hb, 0.3, HK);
  // horns, swept back proud over the banner, bound in bronze at the root
  const h1: Pt[] = [H.pt(-4, -9), [24, 6], [6, 8]];
  o.push(strand(h1[0][0], h1[0][1], h1[1][0], h1[1][1], h1[2][0], h1[2][1], 4.6, 0.7, 'horn', 5, { ink: -0.14 }));
  for (const t of [0.26, 0.41, 0.55, 0.68, 0.8]) { const [x, y, tx, ty] = qpt(h1[0], h1[1], h1[2], t); o.push(K(x, y, x - tx * 0.03, y - ty * 0.03, 4.7 - t * 3.9, 4.5 - t * 3.9, 'horn', { ink: -0.38 })); }
  { const [x, y, tx, ty] = qpt(h1[0], h1[1], h1[2], 0.1); o.push(K(x, y, x - tx * 0.05, y - ty * 0.05, 5.2, 5, 'scr_bronzeOld', { ink: -0.04 })); }
  const [h2x, h2y] = H.pt(-7, -4);
  o.push(
    strand(h2x, h2y, h2x - 11, h2y - 4, h2x - 22, h2y - 1, 3.1, 0.6, 'horn', 4, { ink: -0.32 }),
    // the ear-frill: spines and a dark web, a priest's bronze ring through it
    H.P([-6, -4, -19, -3, -17, 3, -18, 8, -12, 12, -4, 7], SC, { bv: 1.4, ink: -0.46 }),
  );
  for (const [dx, dy] of [[-19, -3], [-17, 3], [-18, 8], [-12, 12]]) o.push(H.K(-6, 1, dx, dy, 0.8, 0.25, 'horn', { ink: -0.4 }));
  { const [x, y] = H.pt(-15, 6.6); o.push(E(x, y, 1.9, 1.9, 'scr_bronzeOld', { fl: 0.6, ink: -0.06 })); }

  // the lower jaw, parted as he speaks, and the dark of the mouth
  const [jx, jy] = H.pt(0, 3.4);
  const J = sframe(jx, jy, 0.3 + ja, HK);
  o.push(
    H.P([2, 3, 16, 3.2, 30, 2.4, 29, 6.4, 22, 8.6, 10, 9, 2, 7], 'scr_maw'),
    J.P([-8, -1, 4, -0.6, 14, -0.4, 24, -0.2, 28.4, 0.4, 28.2, 2.4, 24, 4.2, 14, 6, 4, 6.8, -7, 4.6], SC, { bv: 2.2, ink: -0.3 }),
    J.P([20.4, -0.2, 22.4, -0.2, 21.6, -2.8], 'scr_fang', { bv: 0.5, ink: -0.2 }),
    // skull and snout in one: a high crown, a brow overhanging the eye, a long deep snout
    H.P([-12, 0, -11, -6, -6, -10.5, 2, -12, 9, -10.6, 15, -8.6, 17.4, -6.6, 22, -5.8, 27, -5.2, 30, -4.6, 32, -2.6, 32.4, 0, 31.4, 2.4, 26, 3, 18, 3.6, 10, 4, 5, 3.2, 2, 5, -4, 7.4, -10, 5.4], SC, { bv: 3.4, ink: -0.16 }),
    H.E(-3, 2.6, 7.4, 5.8, SC, { fl: 0.45, ink: -0.26 }), // the jaw muscle, in shadow
    H.K(14, -5.4, 29.4, -3.4, 1.5, 1, SC, { ink: -0.04, occ: false }), // the snout's lit ridge
    H.K(-7, 0.4, 9, 0.2, 1.6, 1, SC, { ink: -0.1, occ: false }), // cheekbone
  );
  for (let i = 0; i < 3; i++) o.push(H.K(19 + i * 3.6, -5.2 + i * 0.4, 19.4 + i * 3.6, -2.6 + i * 0.4, 0.22, 0.22, SC, { ink: -0.46, occ: false })); // plate seams
  o.push(
    H.K(27.4, -2.2, 30.2, -1.4, 0.7, 0.45, 'scr_maw'), // nostril
    H.K(26.6, -3.6, 30.6, -2.6, 0.6, 0.4, SC, { ink: -0.02, occ: false }), // its flare
    H.K(5, 3.2, 31, 2.4, 0.35, 0.3, 'scr_maw', { occ: false }), // the line of the mouth
  );
  // fangs over the lip: one great one
  for (const [x, len] of [[18.4, 5.8], [28.6, 1.6]]) o.push(H.P([x - 1, 3, x + 1.1, 3, x + 0.1, 3 + len], 'scr_fang', { bv: 0.5, ink: -0.16 }));
  o.push(
    // the brow: a crest of bone scowling over the eye, swept back into the horns
    H.E(12.4, -3.2, 5.4, 2.8, SC, { fl: 0.8, ink: -0.56 }), // the socket's shadow
    H.P([-4, -10.8, 4, -11.8, 11, -10.4, 16, -8.2, 18.8, -5.4, 14.6, -5.8, 8, -6.6, 0, -7.6], SC, { bv: 1.8, ink: -0.02 }),
  );
  for (const [x, y, l] of [[0, -11.2, 4.6], [5.4, -11.2, 4], [10.4, -9.9, 3.2], [14.6, -8.2, 2.4]]) o.push(H.P([x - 1.6, y + 0.8, x + 1.6, y + 0.6, x - 1.6 - l * 0.7, y - l], 'horn', { bv: 0.7, ink: -0.2 })); // a crown of spines
  o.push(
    // the eye, half-lidded: he looks down on you
    H.E(12.6, -2.6, 2.9, 1.2, 'emPoison', { ink: (g - 1) * 0.3 - 0.04 }),
    H.X(13.2, -3.4, 0.6, 1.7, '#0c140a'),
    H.K(9.4, -3.9, 16, -3.5, 0.8, 0.5, SC, { ink: -0.3 }), // the heavy lid
    H.Lt(12.6, -2.4, 6, '#b8f070', 0.35 * g, 3),
  );
  // a braided beard of barbels from the chin, bronze-ringed
  const [ba, bb] = J.pt(8, 5.4);
  const bc: Pt = [ba - 2, bb + 10], be: Pt = [ba - 1 + s * 0.6, bb + 20];
  for (let k = -1; k <= 1; k++) o.push(strand(ba + k * 1.8, bb, bc[0] + k * 0.6, bc[1], be[0], be[1], 1.2, 0.45, SC, 3, { ink: -0.34 - k * 0.05 }));
  for (const t of [0.42, 0.72]) { const [x, y] = qpt([ba, bb], bc, be, t); o.push(E(x, y, 2.1 - t * 0.6, 1.2, 'scr_bronzeOld', { fl: 0.4 })); }

  // the shed fang of Níðhögg, standing on its split root; his claw rests on it
  const fa: Pt = [80, 102], fc: Pt = [95, 80], fb: Pt = [86, 54];
  const fw = (t: number): number => (t < 0.25 ? 6.2 + t * 4 : 7.2 * ((1 - t) / 0.75) ** 0.85) + 0.3;
  const side = (sgn: number, i0: number, i1: number, st: number): number[] => { const out: number[] = []; for (let i = i0; st > 0 ? i <= i1 : i >= i1; i += st) { const t = i / 15, [x, y, tx, ty] = qpt(fa, fc, fb, t), l = Math.hypot(tx, ty); out.push(x - sgn * (ty / l) * fw(t), y + sgn * (tx / l) * fw(t)); } return out; };
  const R = side(1, 0, 15, 1), L = side(-1, 15, 0, -1);
  o.push(
    P([...R, ...L], 'boneOld', { bv: 2.4, ink: -0.52 }), // the root, stained
    P([...side(1, 4, 15, 1), ...side(-1, 15, 4, -1)], 'scr_vidnirIvory', { bv: 3.6, ink: -0.24 }), // the crown
  );
  for (const t of [0.42, 0.58, 0.74]) { // growth lines across the enamel
    const [x, y, tx, ty] = qpt(fa, fc, fb, t), l = Math.hypot(tx, ty), w2 = fw(t) * 0.8;
    o.push(K(x - (ty / l) * w2, y + (tx / l) * w2, x + (ty / l) * w2 * 0.6, y - (tx / l) * w2 * 0.6 + 1, 0.3, 0.25, 'scr_vidnirIvory', { ink: -0.55, occ: false }));
  }
  // venom welling at the point, and the arc crawling off it
  o.push(E(fb[0] + 0.2, fb[1] + 2.6, 1, 1.6, 'emPoison', { ink: (g - 1) * 0.4 }));
  let ax = fb[0] + 0.2, ay = fb[1] + 0.6;
  for (let i = 1; i <= 4; i++) {
    const x = ax + (hash2(f * 5 + i, 41) - 0.5) * 5, y = ay - 2.4 - hash2(f * 5 + i, 43) * 2.2;
    o.push(K(ax, ay, x, y, 0.42, 0.32, 'emPoison', { occ: false, ink: 0.1 }));
    ax = x; ay = y;
  }
  o.push(
    // the sleeve, and the claw resting on the fang's crown
    K(60, 99, 74, 84, 7, 5.4, MN, { ink: -0.06 }),
    E(77, 80, 4.2, 4.6, SC, { fl: 0.25, ink: -0.14 }),
  );
  for (let i = 0; i < 3; i++) {
    const y = 77 + i * 3.3;
    o.push(
      K(77, y, 85, y + 0.6, 1.35, 1.1, SC, { ink: i % 2 ? -0.18 : -0.08 }),
      K(85, y + 0.6, 86.2, y + 3, 0.85, 0.25, 'horn', { ink: -0.04 }),
    );
  }
  // venom drips from the great fang of his own jaw
  const [vx, vy] = H.pt(18.5, 9);
  o.push(
    E(vx, vy, 0.8, 1.1, 'emPoison'),
    E(vx - 0.2, vy + 2.6 + f * 3.6, 0.7, 1.2, 'emPoison'),
    // the fang's venom-light, on his jaw and throat
    Lt(84, 51, 50, '#a6e45c', 0.85 * g, 12),
  );
  return o;
}

/**
 * The sun-chasing wolf crouched over the void-bone he gnaws: hide rotted off the muzzle, a slanted violet-coal eye, the split end of the bone glowing into his teeth.
 * The eclipsed sun is behind him, the ossuary bars at the edge.
 */
export function skollPortrait(f: number): PrimTree {
  const gn = [0, 0.03, 0.06, 0.02][f % 4]; // gnaw: the lower jaw works
  const d = sway(f), fl = [1, 1.12, 0.9, 1.05][f % 4];
  const o: Out = [];
  const BS = 'scr_gSkoll', CR = 'scr_skollCorona', HD = 'scr_skollHide', SK = 'scr_skollSocket', BN = 'scr_skollBone';
  o.push(
    P(FULL, BS, { ink: BAND[1] }),
    E(50, 50, 58, 54, BS, { fl: 1, ink: BAND[2] }),
  );
  // the eaten sun: a black disc slipping over a thin pale ring
  const sx = 62, sy = 30;
  o.push(
    E(sx, sy, 28, 28, CR, { fl: 1, ink: BAND[1] }),
    E(sx, sy, 26, 26, CR, { fl: 1, ink: BAND[2] }),
    E(sx, sy, 24.6, 24.6, CR, { fl: 1, ink: BAND[3] }),
    E(sx - 1, sy + 0.8, 24, 24, BS, { fl: 1, ink: BAND[1] - 0.12 }),
  );
  // the iron bars of the ossuary
  for (const x of [92]) o.push(P([x - 2.4, -1, x + 2.4, -1, x + 2.4, 97, x - 2.4, 97], BS, { ink: BAND[2] + 0.04 }), P([x - 2.4, -1, x - 1.2, -1, x - 1.2, 97, x - 2.4, 97], BS, { ink: BAND[3] - 0.04 }));
  // black smoke off his hackles, swelling as it rises, drifting over the sun
  const smokes: [Pt, Pt, Pt, number, number, number][] = [[[22, 30], [20, 12], [40, 0], 3.4, 7, 1], [[8, 34], [2, 16], [14, -2], 3, 6, -1]];
  for (const [a, c, b, r0, r1, w] of smokes) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, [x, y] = qpt(a, c, b, t); pts.push([x + d * w * t * 1.8 + (hash2(i, w + 3) - 0.5) * 2.4 * t, y, r0 + (r1 - r0) * t]); }
    for (const [x, y, r] of pts) o.push(E(x, y, r * 1.15, r, BS, { fl: 1, ink: BAND[2] + 0.1 }));
    for (const [x, y, r] of pts) o.push(E(x + 0.8, y + 0.8, r * 0.85, r * 0.72, BS, { fl: 1, ink: BAND[1] + 0.02 }));
  }

  const H = sframe(40, 52, 0.5, 1.25);
  // the shoulders, hunched high behind the head, tufted along the hackles
  const hk: Pt[] = [H.pt(-12, -6), [20, 22], [-2, 30]];
  const back: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, [x, y, tx, ty] = qpt(hk[0], hk[1], hk[2], t), l = Math.hypot(tx, ty), tuft = i % 2 ? 0 : 1;
    back.push(x + (ty / l) * tuft * 2.8 - (tx / l) * tuft * 1.8, y - (tx / l) * tuft * 2.8 - (ty / l) * tuft * 1.8);
  }
  const rest = [-2, 98, 40, 98, 38, 84, ...H.pt(2, 10), ...H.pt(-6, 6)];
  o.push(
    P([...back.map((v, i) => v + (i % 2 ? -1 : 0.7)), ...rest], CR, { ink: BAND[2] + 0.04 }), // the sun's rim on his hackles
    P([...back, ...rest], HD, { bv: 5, ink: -0.14 }),
    // the far ear
    H.P([-9, -7, -3, -9.6, -17, -21], HD, { bv: 1.2, ink: -0.3 }),
    // the dark of the mouth
    H.P([8, 3, 35, 2.4, 34, 5.4, 10, 6.4], SK),
  );
  // the void-bone on the floor: its split end in his teeth, its knob under his paw
  const [gx, gy] = H.pt(15.4, 5), kx = 13, ky = 86;
  const ln = Math.hypot(kx - gx, ky - gy), ux = (kx - gx) / ln, uy = (ky - gy) / ln;
  const mx = (gx + kx) / 2, my = (gy + ky) / 2;
  const lobes: Pt[] = [[kx + uy * 3, ky - ux * 3], [kx - uy * 3, ky + ux * 3]];
  const bone = (dr: number, m: string, o2: PrimOptions): Prim[] => [K(gx, gy, mx, my, 3.2 + dr, 2.3 + dr, m, o2), K(mx, my, kx, ky, 2.3 + dr, 3 + dr, m, o2), ...lobes.map(([x, y]) => E(x, y, 3.4 + dr, 3.4 + dr, m, o2))];
  o.push(
    bone(0.9, 'emUnholy', { ink: -0.44 + (fl - 1) * 0.4, occ: false }),
    bone(0, 'scr_skollVoidBone', { ink: -0.08 }),
  );
  const cr = (t0: number, t1: number, s: number): Prim => K(gx + (kx - gx) * t0 + uy * s, gy + (ky - gy) * t0 - ux * s, gx + (kx - gx) * t1 - uy * s * 0.4, gy + (ky - gy) * t1 + ux * s * 0.4, 0.3, 0.25, 'emUnholy', { ink: -0.1 + (fl - 1) * 0.4, occ: false });
  o.push(cr(0.22, 0.38, 1), cr(0.46, 0.6, -1));
  // the forepaw pinning it: hide over the wrist, toes curled over the bone, pale claws
  const px = gx + (kx - gx) * 0.66, py = gy + (ky - gy) * 0.66 - 1.6;
  o.push(
    K(px - 7, 99, px - 1, py + 2, 4.6, 3.6, HD, { ink: -0.18 }),
    E(px + 1, py, 5.4, 3.4, HD, { fl: 0.3, a: -0.2, ink: -0.12 }),
  );
  for (let i = 0; i < 3; i++) {
    const tx = px + 4.6 + i * 0.2, ty = py - 2.4 + i * 2.1;
    o.push(
      E(tx, ty, 1.9, 1.4, HD, { ink: -0.1 - i * 0.06 }),
      K(tx + 1.3, ty + 0.2, tx + 3, ty + 2.8, 0.75, 0.2, BN, { ink: -0.16 }),
    );
  }

  // the lower jaw, bare bone, working on the bone
  const J = sframe(...H.pt(-1, 4.4), 0.55 + gn, 1.25);
  o.push(J.P([-6, -1, 4, -0.8, 16, -0.4, 28, -0.1, 33, 0.3, 34.4, 1.3, 33, 2.6, 22, 3.2, 10, 4, 2, 5, -4, 4.4, -7, 1.4], BN, { bv: 1.4, ink: -0.2 }));
  for (const [x, h] of [[15.4, 2.6], [18.8, 2.2]]) o.push(J.P([x - 1.3, 0, x + 1.3, 0, x, -h], BN, { bv: 0.5, ink: -0.04 }));
  o.push(
    J.P([30.4, 0.2, 32.6, 0.2, 31.8, -4.6], BN, { bv: 0.6, ink: 0.04 }), // the lower canine
    J.K(25, 2, 30, 1.6, 0.25, 0.25, BN, { ink: -0.5, occ: false }), // a crack in it
  );

  o.push(
    // the head: hide over the skull, rotted off the muzzle
    H.P([13, -7.2, 20, -5.8, 28, -4.6, 34, -3.6, 36.6, -2.4, 37.6, -0.4, 36.8, 1.8, 33, 3, 24, 3.6, 14, 4, 10, 2], BN, { bv: 2.6, ink: -0.1 }), // the bare muzzle
    H.E(25, 0.8, 8.4, 1.6, BN, { fl: 0.7, ink: -0.36 }), // the hollow along its side
    H.K(18, -5, 34.6, -2.8, 0.9, 0.5, BN, { ink: 0, occ: false }), // the nasal ridge in the light
    H.E(35.2, -0.8, 1.2, 1.7, SK, { a: 0.4 }), // the nose-hole
  );
  // the upper teeth bare: the carnassials on the bone, the great canine over the jaw
  for (const [x, h] of [[15, 3], [18.4, 3.4], [22, 2], [34.4, 1.6]]) o.push(H.P([x - 1.3, 3.6, x + 1.3, 3.6, x + 0.2, 3.6 + h], BN, { bv: 0.5, ink: -0.02 }));
  o.push(
    H.P([27.8, 3.2, 30.6, 3.2, 29.6, 11.4], BN, { bv: 0.7, ink: 0.06 }),
    // the split end of the bone in his teeth, its void-marrow glowing
    E(gx + 0.4, gy, 2, 1.6, 'emUnholy', { ink: 0.02 + (fl - 1) * 0.5, occ: false }),
    // the hide of the head: cranium, cheek, ragged where it ends on the muzzle
    H.P([-14, -2, -12, -8, -4, -10.6, 4, -10.4, 10, -9, 15, -7, 17.6, -5.8, 16, -3.8, 18.2, -1.6, 15, 0.4, 15.4, 2.8, 12, 4, 8, 7.4, 0, 10, -6, 10, -12, 7], HD, { bv: 2.4, ink: -0.04 }),
    // the near ear, tall and laid back, a notch torn from it
    H.P([-5, -9.6, 3.6, -10, -2.4, -17, -4.6, -17.6, -9, -27], HD, { bv: 1.6, ink: 0.12 }),
    H.P([-3, -10, 1.4, -10.2, -3.4, -15.4, -7.6, -22.6], HD, { ink: -0.5 }),
    // the eye: slanted, deep under the brow, a violet coal
    H.E(10.4, -3.2, 4.4, 2.6, SK, { a: -0.22, fl: 0.5 }),
    H.E(10.8, -3.2, 2.7, 1.05, 'emUnholy', { a: -0.22, ink: (fl - 1) * 0.4 }),
    H.X(10.2, -3.9, 0.8, 0.8, '#f4ecff', { em: true }),
    H.K(4, -6.6, 15.4, -5.2, 1.9, 1, HD, { ink: 0.04 }), // the brow
    H.Lt(10.8, -3, 9, '#a868ff', 0.45 * fl, 3),
    // violet light from the split bone, up into his teeth and throat
    Lt(gx - 1, gy + 4, 36, '#a868ff', 0.9 * fl, 10),
  );
  return o;
}

/**
 * A spider that thinks at you: the swollen brain-sac glows rune-blue in its chitin cup, eight burning eyes below, forelegs raised and trembling with the drone.
 * Sparks of thought run along the web behind.
 */
export function weaverPortrait(f: number): PrimTree {
  const b = breath(f);
  const o: Out = [];
  const BG = 'scr_gWeaver', CH = 'scr_weaverChitin', BR = 'scr_weaverBrain', FO = 'scr_weaverFold', EY = 'scr_weaverEye';
  const tr = (i: number, a = 0.7): Pt => [(hash2(f, i) - 0.5) * a, (hash2(f, i + 9) - 0.5) * a]; // the drone's tremor
  const sx = 46, sy = 27;
  o.push(ground(BG, sx, sy + 6, 70, 64));
  // the web: threads out from behind the sac, rings of spiral between them
  const N = 9, ang = (i: number): number => -Math.PI / 2 + (i / N) * Math.PI * 2 + 0.2;
  const inSac = (x: number, y: number): boolean => ((x - sx) / 26) ** 2 + ((y - sy) / 20.5) ** 2 < 1;
  for (let i = 0; i < N; i++) for (const [r0, r1] of [[20, 52], [52, 92]]) o.push(K(sx + Math.cos(ang(i)) * r0, sy + Math.sin(ang(i)) * r0, sx + Math.cos(ang(i)) * r1, sy + Math.sin(ang(i)) * r1, 0.3, 0.3, BG, { ink: BAND[3] + 0.04, occ: false }));
  for (const R of [36, 50, 65]) {
    for (let i = 0; i < N; i++) {
      const a0 = ang(i), a1 = ang(i + 1), r0 = R + hash2(i, R) * 4, r1 = R + hash2(i + 1, R) * 4;
      const x0 = sx + Math.cos(a0) * r0, y0 = sy + Math.sin(a0) * r0, x1 = sx + Math.cos(a1) * r1, y1 = sy + Math.sin(a1) * r1;
      if (inSac((x0 + x1) / 2, (y0 + y1) / 2) || Math.max(y0, y1) < -2 || Math.min(x0, x1) > 98 || Math.max(x0, x1) < -2) continue;
      o.push(K(x0, y0, x1, y1, 0.25, 0.25, BG, { ink: BAND[3] - 0.04, occ: false }));
    }
  }
  // sparks of thought running out along the threads
  for (let i = 0; i < 4; i++) {
    const a = ang(1 + i * 3), r = 30 + ((f * 9 + i * 13) % 34);
    o.push(X(sx + Math.cos(a) * r - 0.5, sy + Math.sin(a) * r - 0.5, 1.2, 1.2, 'emArcane:4', { em: true }));
  }

  // a leg: femur up to a high knee, tibia down, the last joint to the tip
  const leg = (pts: number[], r: number, ink: number, ti: number): Prim[] => {
    const [ax, ay, kx0, ky0, nx0, ny0, tx0, ty0] = pts, [dx, dy] = tr(ti);
    const kx = kx0 + dx, ky = ky0 + dy, nx = nx0 + dx * 1.6, ny = ny0 + dy * 1.6, tx = tx0 + dx * 2, ty = ty0 + dy * 2;
    return [K(ax, ay, kx, ky, r, r * 0.78, CH, { ink }), E(kx, ky, r * 0.9, r * 0.9, CH, { ink: ink + 0.04 }), K(kx, ky, nx, ny, r * 0.72, r * 0.5, CH, { ink }), E(nx, ny, r * 0.55, r * 0.55, CH, { ink }), K(nx, ny, tx, ty, r * 0.46, 0.25, CH, { ink: ink - 0.04 })];
  };
  o.push(
    // the hind legs, behind
    leg([40, 66, 16, 58, 8, 84, 6, 99], 2.2, -0.36, 1), leg([64, 66, 86, 56, 92, 82, 94, 99], 2.2, -0.36, 2),
    leg([38, 62, 6, 34, 1, 64, -2, 86], 2.4, -0.28, 3), leg([66, 62, 94, 32, 98, 60, 99, 80], 2.4, -0.28, 4),
  );

  // the brain-sac, swollen and pulsing: two lobes, their folds meandering across them
  const rx = 25 + b * 0.7, ry = 19.5 + b * 0.6;
  o.push(E(sx, sy, rx, ry, BR, { ink: -0.34 + b * 0.05 }));
  for (const s of [-1, 1]) {
    const lx = sx + s * rx * 0.42, lrx = rx * 0.6, lry = ry * 0.94;
    o.push(E(lx, sy - 0.6, lrx, lry, BR, { ink: -0.26 + b * 0.05 }));
    for (let j = 0; j < 8; j++) {
      const v = -0.8 + j * 0.225 + (hash2(j, s + 4) - 0.5) * 0.06;
      let top: number[] = [], bot: number[] = [];
      const flush = (): void => { if (top.length >= 6) o.push(P([...top, ...bot], FO, { ink: -0.12 })); top = []; bot = []; };
      for (let k = 0; k <= 16; k++) {
        const u = -1 + k / 8, x = lx + u * lrx * 0.92;
        const w = v + Math.sin(u * 6 + j * 2.1 + s) * 0.06 + (hash2(k, j * 7 + s + 20) - 0.5) * 0.1;
        if (u * u + w * w > 0.86 || hash2(k, j + s * 11 + 40) < 0.13) { flush(); continue; }
        const y = sy - 0.6 + w * lry, hw = 0.6 + hash2(k, j * 3 + s) * 0.3;
        top.push(x, y - hw); bot.unshift(x, y + hw);
        const h = hash2(k + 3, j * 5 + s + 60);
        if (h < 0.24) o.push(K(x, y, x + (h - 0.12) * 12, y + (h < 0.12 ? -2 : 2), 0.6, 0.5, FO, { ink: -0.14, occ: false }));
      }
      flush();
    }
  }
  o.push(
    strand(sx - 1.4, sy - ry + 0.8, sx + 0.4, sy - 4, sx + 0.6, sy + ry - 1.6, 1.2, 0.8, FO, 2, { ink: -0.3, occ: false }), // the fissure between the lobes
    // the chitin cup it sits in, its rim lit from above
    P([19, 36, 33, 40.4, 46, 42, 59, 40.4, 73, 36, 67, 49, 46, 55, 25, 49], CH, { bv: 3, ink: -0.5 }),
    strand(19, 36, 46, 47, 73, 36, 1.4, 1.4, CH, 4, { ink: -0.14 }),
    // the face: the carapace front, low under the sac
    P([34, 58, 38, 50, 46, 47, 58, 47, 66, 50, 70, 58, 66, 68, 58, 73, 46, 73, 38, 68], CH, { bv: 4, ink: -0.3 }),
  );
  // the chelicerae, and the pale fangs folded under them
  for (const [x0, x1, fx] of [[49, 48, 51.4], [58, 59.4, 56.4]]) {
    o.push(K(x0, 66, x1, 79, 4.8, 2.6, CH, { ink: -0.24 }));
    for (let i = 0; i < 2; i++) { const y = 70 + i * 4, x = x0 + (x1 - x0) * (i * 0.3) + (x0 < 53 ? -3.6 : 3.6); o.push(K(x, y, x + (x0 < 53 ? -2 : 2), y + 1.4, 0.3, 0.15, CH, { ink: -0.1, occ: false })); }
    o.push(K(x1, 79.4, fx, 86, 1.3, 0.3, EY, { ink: 0 }), K(fx + (x1 - fx) * 0.3, 84, fx, 86, 0.55, 0.25, 'boneOld', { ink: -0.2 }));
  }
  // the pedipalps, held up by the jaws
  for (const s of [-1, 1]) {
    const ax = 53.5 + s * 11, [dx, dy] = tr(20 + s);
    o.push(K(ax, 67, ax + s * 6, 75 + dy, 2, 1.7, CH, { ink: -0.14 }), K(ax + s * 6, 75 + dy, ax + s * 2 + dx, 85, 1.7, 1.5, CH, { ink: -0.14 }), E(ax + s * 2 + dx, 86, 2.2, 2, CH, { ink: -0.1 }));
  }
  // the eyes: a row of four, two great ones over them, two more set wide; all burning with its thought
  for (const [x, y, r] of [[47.6, 59.4, 1.1], [51.6, 60, 1.1], [55.6, 60, 1.1], [59.6, 59.4, 1.1], [49.6, 55.2, 2.3], [57.6, 55.2, 2.3], [44.4, 51.6, 1.5], [62.8, 51.6, 1.5]]) {
    o.push(
      E(x, y, r + 0.5, r + 0.5, EY, { ink: -0.2 }),
      E(x, y + 0.2, r * 0.82, r * 0.82, 'emArcane', { ink: (r > 2 ? -0.14 : -0.26) + b * 0.08 }),
    );
    if (r > 2) o.push(X(x - r * 0.5, y - r * 0.55, 0.8, 0.8, '#e8f2ff', { em: true }));
  }
  // the forelegs, raised in an arch round its face, trembling
  o.push(leg([39, 58, 15, 18, 6, 42, 5, 66], 2.9, -0.04, 5), leg([66, 58, 88, 18, 95, 42, 95, 66], 2.9, -0.06, 6));
  // bristles on the forelegs
  for (const [ax, ay, kx, ky, s] of [[39, 58, 15, 18, -1], [66, 58, 88, 18, 1]]) {
    for (let i = 1; i <= 3; i++) { const t = i / 4, x = ax + (kx - ax) * t, y = ay + (ky - ay) * t; o.push(K(x, y, x + s * 2.6, y - 1.6, 0.3, 0.15, CH, { ink: -0.1, occ: false })); }
  }
  o.push(
    // light: the sac, from above; a little in the eyes
    Lt(sx, sy - 6, 58, '#6aa6ff', 0.9 + b * 0.1, 14),
    Lt(54, 56, 14, '#6aa6ff', 0.5, 4),
  );
  return o;
}
