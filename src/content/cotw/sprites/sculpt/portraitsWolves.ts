import { E, K, P, X, Lt, T, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9d, group C: the Wolf, the Rime-Wolf and the Brim-Howler (one model, three kinds). Conventions: portraitKit.ts. */

type WolfKind = 'wolf' | 'rime' | 'brim';

/** A frame at (px, py), turned by ang, scaled by k: primitives in head space. */
function wframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  const pts = (a: number[]): number[] => { const out: number[] = []; for (let i = 0; i < a.length; i += 2) out.push(...pt(a[i], a[i + 1])); return out; };
  return {
    pt, pts,
    P: (a: number[], m: string, o?: PrimOptions) => P(pts(a), m, o),
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}) => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions) => { const [a, b] = pt(x, y); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
  };
}

/**
 * A tufted edge along a quadratic a -> b (control c): every other point pushed out
 * by amp on side sgn, leaning along the curve, so it reads as locks of fur.
 */
function tufts(a: Pt, c: Pt, b: Pt, n: number, amp: number, sgn: number, seed: number, lean = 0.4): number[] {
  const pts: number[] = [];
  let px: number | null = null, py: number | null = null;
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = qpt(a, c, b, i / n), l = Math.hypot(tx, ty) || 1;
    if (i % 2) { pts.push(x, y); px = x; py = y; continue; }
    const tf = (0.6 + 0.7 * hash2(i, seed)) * amp, ox = -sgn * (ty / l), oy = sgn * (tx / l);
    const ex = x + ox * tf + (tx / l) * tf * lean, ey = y + oy * tf + (ty / l) * tf * lean;
    if (px !== null && py !== null) pts.push((px + ex) / 2 + ox * tf * 0.32, (py + ey) / 2 + oy * tf * 0.32);
    pts.push(ex, ey);
  }
  return pts;
}

/** Turn a flat list of head-space points about (cx, cy) by an. */
function turn(a: number[], cx: number, cy: number, an: number): number[] {
  const c = Math.cos(an), s = Math.sin(an), out: number[] = [];
  for (let i = 0; i < a.length; i += 2) { const x = a[i] - cx, y = a[i + 1] - cy; out.push(cx + x * c - y * s, cy + x * s + y * c); }
  return out;
}

/**
 * One wild wolf, three-quarter on, its head low; not the god-wolf in profile
 * (Skoll) nor the collared hounds of the Oath (both in profile).
 * wolf: grey, the hackles up dark along its back, the lip curled off the
 *   teeth, amber eyes under a hard brow; moonlight through the pines.
 * rime: the coven's white wolf of the night raid, turned the other way, a
 *   ridge of ice along its back glowing cold, hoar-frost on its ruff; ears
 *   flat, eyes showing white, a fear-grin: it will bolt. Snow falling past a
 *   gable of the town.
 * brim: the Rime Hollows' storm-grey howler, head thrown back, jaws wide,
 *   breathing the freezing mist that lights its throat; ice on its neck.
 */
function wolf(f: number, kind: WolfKind): PrimTree {
  const b = breath(f), s = sway(f);
  const grey = kind === 'wolf', rime = kind === 'rime', brim = kind === 'brim';
  const C = grey ? 'scr_wolfFur' : rime ? 'scr_rimeWolfFur' : 'scr_brimFur';
  const D = grey ? 'scr_wolfFurDark' : rime ? 'scr_rimeWolfFurDark' : 'scr_brimFurDark';
  const L = grey ? 'scr_wolfFurPale' : rime ? 'scr_rimeWolfFurPale' : 'scr_brimFurPale';
  const BG = grey ? 'scr_gWolf' : rime ? 'scr_gRimeWolf' : 'scr_gBrim';
  const RIM = 'scr_wolfRim', MO = 'scr_wolfMouth', GUM = 'scr_wolfGum', TO = 'scr_wolfTooth';
  const fl = [1, 1.1, 0.92, 1.05][f % 4];
  const o: Out = [];
  // ---------------------------------------------------------------- the ground
  // (the rime-wolf is drawn facing right like the others, then turned about as a whole)
  o.push(P(FULL, BG, { ink: BAND[1] }));
  if (grey) {
    // the pines at night: the gaps between the trunks a shade paler than the trunks
    o.push(E(56, 40, 60, 58, BG, { fl: 1, ink: BAND[2] }));
    for (const [x, w, lean] of [[4, 7, 1], [19, 5, 0.4], [83, 6, -0.6], [95, 8, 0]]) o.push(P([x - w / 2 + lean, -1, x + w / 2 + lean, -1, x + w * 0.6, 97, x - w * 0.6, 97], BG, { ink: BAND[1] - 0.04 }));
    for (const [x, y, l] of [[19, 22, -7], [83, 30, 8], [4, 40, 7]]) o.push(K(x, y, x + l, y - 6, 0.9, 0.5, BG, { ink: BAND[1] - 0.04 })); // dead limbs
  } else if (rime) {
    // the night of the raid: a gable of the town against the snow-cloud, the snow underfoot, snow falling
    o.push(E(44, 30, 66, 54, BG, { fl: 1, ink: BAND[2] }));
    o.push(E(40, 12, 92, 30, BG, { fl: 1, ink: BAND[3] - 0.04 })); // the snow-cloud's belly
    const cx = 82, cy = 26, w = 16;
    o.push(P([cx - w, cy + w * 1.05, cx, cy, cx + w, cy + w * 1.05, cx + w, 97, cx - w, 97], BG, { ink: BAND[1] - 0.04 }));
    o.push(K(cx - w - 1, cy + w * 1.1, cx + 3.4, cy - 3.6, 0.9, 0.9, BG, { ink: BAND[1] + 0.08 }), K(cx + w + 1, cy + w * 1.1, cx - 3.4, cy - 3.6, 0.9, 0.9, BG, { ink: BAND[1] + 0.08 }));
    o.push(K(cx - w, cy + w * 1.05 - 1.2, cx - 1, cy - 1, 0.8, 0.8, BG, { ink: BAND[4] }));
    o.push(P([-1, 74, 30, 70, 60, 74, 97, 71, 97, 97, -1, 97], BG, { ink: BAND[2] + 0.04 }));
    for (let i = 0; i < 12; i++) {
      const y = (hash2(i, 51) * 96 + f * (1.6 + (i % 3) * 0.5)) % 96, x = hash2(i, 53) * 96 + Math.sin(y * 0.15 + i) * 1.5;
      o.push(X(x, y, i % 4 ? 0.7 : 1, i % 4 ? 0.7 : 1, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
    }
  } else {
    // the Rime Hollows: icicles hanging in the dark of the cave
    o.push(E(60, 34, 56, 56, BG, { fl: 1, ink: BAND[2] }));
    o.push(E(76, 18, 30, 28, BG, { fl: 1, ink: BAND[3] }));
    for (const [x, l, w] of [[6, 16, 3], [13, 9, 2], [22, 22, 3.4], [31, 11, 2.2], [88, 14, 2.6], [95, 24, 3.2], [70, 8, 2]]) o.push(P([x - w, -1, x + w, -1, x + 0.3, l], BG, { ink: BAND[3] + 0.04 - (x > 60 ? 0 : 0.08) }));
    o.push(P([-1, -1, 97, -1, 97, 2, -1, 3], BG, { ink: BAND[3] }));
  }
  const hb = -b * 0.45;
  // the head's frame: the stop between the eyes is the origin, the nose along +x
  const [hx, hy, ang, k]: [number, number, number, number] = grey ? [52, 47, 0.36, 1.55] : rime ? [50, 54, 0.5, 1.58] : [42, 57, -0.98, 1.5];
  const H = wframe(hx, hy + hb, ang, k);

  // ---------------------------------------------------------------- the forequarters
  const cA = H.pt(-17, -9), cC: Pt = brim ? [14, 44] : [18, 30], cB: Pt = brim ? [-2, 72] : [-2, 50];
  if (brim) {
    // the neck stretched up to the howl, its throat to the mist
    o.push(K(...H.pt(-6, 3), 30, 104, 15, 27, C, { ink: -0.32 }));
    for (const [x0, y0, x1, y1, x2, y2, r, ik] of [[44, 66, 42, 78, 38, 90, 2.4, 0.06], [36, 70, 33, 82, 30, 95, 2.4, -0.04], [50, 74, 49, 86, 46, 98, 2.2, 0.04], [28, 80, 26, 90, 24, 99, 2.2, 0.02]]) {
      o.push(strand(x0, y0, x1, y1, x2, y2, r, 0.4, C, 4, { ink: -0.32 + ik, occ: false }));
    }
    o.push(P([...tufts(H.pt(-18, -4), [10, 60], [-1, 80], 10, 2.4, -1, 11, 0.5), -1, 97, 20, 97, 28, 72, ...H.pt(-8, 4)], D, { occ: false, bv: 2, ink: -0.2 })); // the dark of the nape
    o.push(P([...H.pts([0, 9, 6, 9.4]), ...tufts([66, 62], [72, 80], [66, 98], 8, 2.4, -1, 3, 0.4), 44, 97, ...tufts([44, 96], [46, 80], [50, 68], 6, 2, -1, 13, 0.4)], L, { occ: false, bv: 3, ink: -0.3 })); // the pale throat
  } else {
    // the neck going back into the body, the shoulder dark; the chest-fur, and the pale bib under the jaw
    const dk = rime ? -0.28 : -0.06; // the body falls into the dark, the white wolf's further
    o.push(K(...H.pt(-8, 4), 22, 104, 15, 30, C, { ink: -0.42 + dk }));
    // locks of the neck's fur, flowing down and back
    for (const [x0, y0, x1, y1, x2, y2, r, ik] of [[36, 56, 29, 67, 22, 79, 2.6, 0.06], [42, 64, 37, 76, 31, 88, 2.4, -0.04], [27, 61, 19, 71, 12, 83, 2.4, 0.04], [31, 73, 25, 85, 20, 98, 2.6, -0.06], [17, 69, 11, 79, 4, 89, 2.2, 0.03], [24, 84, 18, 92, 13, 99, 2.2, 0.05]]) {
      o.push(strand(x0, y0, x1, y1, x2, y2, r, 0.4, C, 4, { ink: -0.42 + dk + ik, occ: false }));
    }
    o.push(E(8, 96, 18, 12, D, { occ: false, fl: 0.3, ink: -0.26 + dk }));
    o.push(P([...H.pts([-10, 6, 10, 9]), ...tufts(H.pt(10.5, 9), [78, 80], [72, 98], 8, 2.6, -1, 5, 0.4), 34, 97, ...tufts([34, 97], [30, 80], H.pt(-12, 6), 8, 2.4, -1, 17, 0.4)], C, { occ: false, bv: 3, ink: -0.32 + dk }));
    for (const [x0, y0, x1, y1, x2, y2, r, ik] of [[56, 80, 53, 89, 55, 99, 2.6, 0.06], [46, 84, 43, 92, 44, 99, 2.4, -0.05], [66, 80, 68, 89, 66, 99, 2.4, 0.04], [38, 78, 36, 88, 37, 99, 2.2, -0.04]]) {
      o.push(strand(x0, y0, x1, y1, x2, y2, r, 0.5, C, 4, { ink: -0.32 + dk + ik, occ: false })); // locks of the chest's fur
    }
    o.push(P([...H.pts([-9, 8, -2, 10.6, 6, 10.4, 10, 8.4]), ...tufts(H.pt(10.5, 9), [70, 72], [64, 84], 6, 2.2, -1, 3, 0.4), ...tufts([64, 84], [54, 90], [42, 82], 8, 2.6, -1, 7, 0.3), ...tufts([42, 82], [38, 72], H.pt(-10, 8), 6, 2, -1, 13, 0.4)], L, { occ: false, bv: 3, ink: -0.22 + dk * 0.4 }));
  }
  // the crest of the back: hackles raised (grey), a ridge of ice (rime), ice on the nape (brim)
  if (grey) {
    const crest: number[] = [], front: Array<[number, number, number, number, number]> = [], n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n, [x, y, tx, ty] = qpt(cA, cC, cB, t), l = Math.hypot(tx, ty);
      if (i % 2) { crest.push(x, y); continue; }
      const nx = ty / l, ny = -tx / l, dx = nx - (tx / l) * 0.7, dy = ny - (ty / l) * 0.7, dl = Math.hypot(dx, dy);
      const len = (6.4 + 4 * hash2(i, 7)) * (0.55 + 0.6 * Math.sin(t * Math.PI)) + s * 0.15;
      const ex = x + (dx / dl) * len, ey = y + (dy / dl) * len;
      if (i) { const bx = crest[crest.length - 2], by = crest[crest.length - 1]; crest.push((bx + ex) / 2 + nx * len * 0.24, (by + ey) / 2 + ny * len * 0.24); }
      crest.push(ex, ey);
      if (i > 0 && i < n) front.push([x + nx * 1.4, y + ny * 1.4, dx / dl, dy / dl, len * 0.55]);
    }
    o.push(P([...crest, -1, 68, ...tufts([-1, 66], [14, 58], H.pt(-15, -1), 8, 2.2, 1, 23, 0.4)], D, { occ: false, bv: 2, ink: -0.08 }));
    for (const [x, y, ux, uy, len] of front) o.push(P([x - uy * 1.8, y + ux * 1.8, x + ux * len, y + uy * len, x + uy * 1.8, y - ux * 1.8], C, { ink: -0.06 })); // the nearer row, its tips catching the light
  } else {
    // ice shards along the crest, leaning back, each set in a dark notch of fur
    const IC = rime ? 'scr_rimeWolfIce' : 'scr_brimIce', nS = rime ? 6 : 4;
    o.push(P([...tufts(cA, cC, cB, 10, 1.4, 1, 21, 0.3), -1, rime ? 70 : 76, ...tufts(rime ? [-1, 68] : [-1, 74], rime ? [14, 58] : [12, 70], H.pt(-14, 0), 8, 2, 1, 23, 0.4)], D, { occ: false, bv: 2, ink: -0.08 }));
    for (let i = 0; i < nS; i++) {
      const t = 0.08 + i / (nS - 0.4) * 0.86, [x, y, tx, ty] = qpt(cA, cC, cB, t), l = Math.hypot(tx, ty), nx = ty / l, ny = -tx / l;
      const len = (rime ? 9 : 6.4) * (0.7 + 0.5 * Math.sin(t * Math.PI)) * (0.85 + 0.3 * hash2(i, 5)), w = len * 0.26;
      const ux = nx - (tx / l) * 0.45, uy = ny - (ty / l) * 0.45, ul = Math.hypot(ux, uy), ex = x + (ux / ul) * len, ey = y + (uy / ul) * len;
      const ax = tx / l, ay = ty / l;
      o.push(P([x - ax * w * 1.9, y - ay * w * 1.9, ex + (ux / ul) * 0.8, ey + (uy / ul) * 0.8, x + ax * w * 1.9, y + ay * w * 1.9], RIM, { ink: 0.1 })); // the dark round it
      o.push(P([x - ax * w * 1.4, y - ay * w * 1.4, ex, ey, x + ax * w * 1.4, y + ay * w * 1.4], IC, { bv: 0.8, ink: rime ? -0.16 + 0.08 * hash2(i, 9) + (fl - 1) * 0.5 : 0 }));
      o.push(K(x + (ux / ul) * len * 0.2 - ax * w * 0.5, y + (uy / ul) * len * 0.2 - ay * w * 0.5, ex - ax * 0.2, ey - ay * 0.2, w * 0.4, 0.2, IC, { ink: rime ? 0.2 : 0.3, occ: false })); // its lit edge
    }
    if (brim) for (const [x, y, a] of [[60, 70, 0.4], [55, 82, 0.2]]) o.push(P([x - 2, y, x + 4, y - 1.6 + a, x + 0.6, y + 3.4], IC, { bv: 0.6 })); // ice in the throat-fur
  }

  // ---------------------------------------------------------------- the head
  /** An ear in head space: its base b0 (front) to b1 (back), its tip; the hollow inside it. */
  const lerp = (a: Pt, c: Pt, t: number): Pt => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  const ear = (b0: Pt, b1: Pt, tip: Pt, ink: number, flat: boolean): void => {
    const cx = (b0[0] + b1[0] + tip[0]) / 3, cy = (b0[1] + b1[1] + tip[1]) / 3;
    const bul = (a: Pt, t: number, amt: number): Pt => { const [x, y] = lerp(a, tip, t), dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * amt, y + (dy / l) * amt]; };
    o.push(H.P([...b0, ...bul(b0, 0.5, flat ? 1.8 : 1.2), ...bul(b0, 0.9, flat ? 1 : 0.3), ...tip, ...bul(b1, 0.88, flat ? 0.8 : 0.3), ...bul(b1, 0.5, flat ? 1.4 : 0.9), ...b1], C, { bv: 1.3, ink }));
    if (flat) { o.push(H.K(...lerp(b0, b1, 0.25), ...lerp(lerp(b0, b1, 0.5), tip, 0.7), 0.8, 0.4, D, { ink: -0.3, occ: false })); return; } // the crease where it lies back
    // the hollow, dark, its front edge feathered with pale fur
    const h0 = lerp(b0, b1, 0.12), h1 = lerp(b0, b1, 0.74), ht = lerp(lerp(b0, b1, 0.38), tip, 0.82);
    o.push(H.P([...h0, ...lerp(h0, ht, 0.55), ...ht, ...lerp(h1, ht, 0.5), ...h1], RIM, { bv: 0.6, ink: -0.04 }));
    for (const t of [0.12, 0.36, 0.6]) o.push(H.K(...lerp(h0, ht, t), ...lerp(lerp(h0, h1, 0.62), ht, t + 0.1), 0.8, 0.3, L, { ink: -0.28 - t * 0.2, occ: false }));
  };
  const jaw = brim ? 0.42 : grey ? 0.1 + [0, 0.02, 0.04, 0.02][f % 4] : 0.02; // the lower jaw dropped about the mouth's corner
  const JC: Pt = [0.6, 6];
  // the far ear: upright, laid flat (rime), swept back (brim)
  ear([5, -10.4], [-3, -11.2], grey ? [1.4, -21.4] : rime ? [-6.6, -15.4] : [-7, -15.8], -0.14, !grey);
  // the mouth's inside, dark
  o.push(H.P([...turn([1, 6.6, 8, 6.4, 15.4, 5.6], ...JC, jaw), 16.4, 4, 9, 3.4, 1.4, 5], MO));
  if (brim) o.push(H.E(10, 5.4 + jaw * 6, 3.6, 1 + jaw * 2.6, 'scr_brimMist', { fl: 0.6, ink: -0.46, occ: false })); // the mist welling in the throat
  // the head's mass: braincase, the jowl ruff flaring back, the cheek
  o.push(H.P([2, -9.6, -2, -12, -8, -12.6, -13.6, -11, -17.4, -8,
    ...tufts([-18, -7], [-24, 2], [-15, 12], 8, 2.6, 1, 5, 0.5), ...tufts([-14, 12], [-8, 14.4], [0, 9.4], 4, 1.6, 1, 9, 0.4),
    2, 7, 1, 2, 3.6, -3, 6, -6.8], C, { bv: 5, ink: -0.04 }));
  o.push(H.P([-1.4, -0.6, -5, -1, -9, -0.6, -12, 0, ...tufts([-13, 0], [-18, 5], [-12.6, 10.6], 6, 2, 1, 3, 0.5), -6, 11, -0.4, 8.4, 1, 3], L, { occ: false, bv: 2.6, ink: -0.08 })); // the pale cheek
  o.push(H.E(-6, 4, 6, 4.6, L, { occ: false, fl: 0.4, ink: -0.1 }));
  o.push(H.E(-8.4, -6.6, 9, 6.2, C, { occ: false, fl: 0.2, ink: 0.04 })); // the crown
  // the lower jaw, its canine and teeth
  o.push(H.P(turn([0.8, 6.2, 8, 5.8, 13.6, 5.2, 15.4, 5.6, 15, 7.2, 10, 8.8, 4, 9.6, 0.4, 8.6], ...JC, jaw), L, { bv: 1.6, ink: -0.24 }));
  o.push(H.P(turn([12, 5.6, 13.6, 5.4, 12.6, 2.6], ...JC, jaw), TO, { bv: 0.4, ink: -0.12 }));
  for (const x of [5.4, 8, 10.2]) o.push(H.P(turn([x - 0.7, 5.8, x + 0.7, 5.7, x, 4.6], ...JC, jaw), TO, { ink: -0.3 }));
  // the muzzle, tapering to the nose, and its pale lip
  o.push(H.K(-0.6, -1.4, 16, -0.6, 5.8, 3.4, C, { ink: 0.02 }));
  o.push(H.P([1.6, 1, 6, -0.4, 11, -0.6, 15.6, 0.2, 17.6, 1.6, 17, 3.4, 12, 3, 6, 4.4, 1.4, 5.4], L, { bv: 1.4, ink: -0.04 }));
  // the lip curled back off the gum, the teeth bared: a snarl (grey), a fear-grin drawn back (rime), wide in the howl (brim)
  const curl = grey ? 1 : rime ? 0.5 : 0.2;
  const lip: Pt[] = rime ? [[1.4, 5.4], [5.4, 5], [9.4, 4.2], [13.6, 3.2], [16.8, 3.4]] : [[1.4, 5.6], [6.6, 4.2 - curl * 1.2], [10.6, 3 - curl * 1.4], [14.4, 2.8 - curl * 0.8], [16.8, 3.4]];
  o.push(H.P([...lip.flatMap(([x, y]) => [x, y - 0.4]), 16.2, 4.6, 12, 4.6, 6, 5.6, 3, 5.6], GUM));
  for (const [x, h] of [[6.4, 1.2], [8.4, 1.4], [10.2, 1.3]]) o.push(H.P([x - 0.9, 4.6, x + 0.9, 4.4, x, 4.4 + h], TO, { ink: -0.26 }));
  o.push(H.P([15, 4.2, 16.6, 4, 15.8, 5.6], TO, { ink: -0.1 })); // the incisors
  o.push(H.P([12.2, 4, 14.4, 3.8, 13.4, 8.8], TO, { bv: 0.5, ink: 0.06 })); // the great fang
  for (let i = 0; i < lip.length - 1; i++) o.push(H.K(...lip[i], ...lip[i + 1], 0.55, 0.55, RIM, { occ: false })); // the black lip
  // the bridge, wrinkled in the snarl
  o.push(H.K(3, -5.6, 15.6, -3, 1.3, 0.8, D, { occ: false, ink: 0.04 }));
  if (grey) for (let i = 0; i < 3; i++) o.push(H.K(6.4 + i * 2.4, -5.6 + i * 0.5, 7.4 + i * 2.4, -2.6 + i * 0.6, 0.5, 0.4, D, { ink: -0.3, occ: false }));
  o.push(H.E(17.6, -0.6, 2.9, 2.4, 'scr_wolfNose', { fl: 0.1 }));
  o.push(H.K(18.4, 0.6, 19.8, 0.2, 0.5, 0.45, MO, { occ: false })); // the nostril
  o.push(H.X(17, -2.2, 1, 0.8, '#d8dde6', { em: true })); // the wet glint
  // the face's markings: the dark down the forehead, pale over the eyes, the line from the eye's corner
  o.push(H.K(-2.6, -8.6, -7, -11.4, 1.4, 2.4, D, { occ: false, ink: 0.02 }));
  o.push(H.E(-6.2, -7.6, 2.2, 1.1, L, { occ: false, fl: 0.4, ink: -0.06 }), H.E(3.4, -8.4, 1.6, 0.9, L, { occ: false, fl: 0.4, ink: -0.06 }));
  o.push(H.K(-8.8, -3, -12.6, -1.8, 0.7, 0.4, D, { occ: false, ink: -0.1 }));
  // the eyes: almond, slanted, amber; the near one full, the far one beyond the bridge
  const EY = grey ? 'scr_wolfEye' : rime ? 'scr_rimeWolfEye' : 'scr_brimEye';
  const lid = brim ? 0.62 : rime ? -0.2 : 0.3; // lowered in the snarl, drawn back wide in fear, half shut in the howl
  const eye = (x: number, y: number, w: number, h: number, sl: number, sc: number): void => {
    const p = (u: number, v: number): Pt => [x + u * w, y + v * h + u * sl];
    o.push(H.P([...p(-1, 0), ...p(-0.45, -1), ...p(0.4, -1.05), ...p(1, 0.1), ...p(0.4, 0.95), ...p(-0.45, 0.8)], RIM, { bv: 0.4 }));
    if (rime) o.push(H.E(x - 0.1 * w, y + 0.05 * h, 0.82 * w, 0.62 * h, 'scr_rimeWolfWhite', { ink: -0.1 })); // the white showing
    o.push(H.E(x + 0.2 * w, y + 0.05 * h + 0.2 * sl, (rime ? 0.42 : 0.52) * w, 0.74 * h, EY));
    o.push(H.E(x + 0.28 * w, y + 0.1 * h + 0.28 * sl, (rime ? 0.24 : 0.16) * w, 0.52 * h, MO));
    if (f !== 3 || !grey) o.push(H.X(x + 0.05 * w, y - 0.45 * h, 0.55 * sc, 0.55 * sc, '#fff4d8', { em: true }));
    o.push(H.K(...p(-0.95, -0.72 + lid), ...p(0.9, -0.64 + lid), 0.6, 0.5, C, { ink: 0.06 })); // the upper lid
    if (f === 3 && grey) o.push(H.K(...p(-0.9, -0.1), ...p(0.9, 0.1), 0.62, 0.5, C, { ink: 0.06 })); // a blink
  };
  eye(-5.6, -3.4, 2.9, 1.5, 0.5, 1);
  eye(4.2, -5.4, 1.8, 1.25, 0.4, 0.8);
  // the brows drawn down hard (or lifted, in fear)
  const bdn = rime ? -0.8 : grey ? 0.6 : 0.2;
  o.push(H.K(-10.4, -6.4 - bdn * 0.2, -2.4, -5.2 + bdn, 1.4, 1, C, { ink: 0.12 }));
  o.push(H.K(1.8, -7.6 + bdn * 0.6, 6.8, -7.4 - bdn * 0.2, 1.1, 0.8, C, { ink: 0.1 }));
  // the near ear
  ear([-6, -11.6], [-17.6, -9.4], grey ? [-12.6, -23.4] : rime ? [-20, -14 + s * 0.2] : [-20.6, -14.2], 0.06, !grey);

  if (rime) {
    // hoar-frost on the tips of its ruff, glinting in turn
    const gl: Pt[] = [...[0.2, 0.45, 0.7, 0.92].map((t): Pt => { const [x, y] = qpt([64, 84], [54, 90], [42, 82], t); return [x, y + 2.6]; }),
      ...[0.3, 0.6, 0.85].map((t): Pt => { const [x, y] = qpt([-18, -7], [-24, 2], [-15, 12], t); return H.pt(x - 2.4, y); })];
    gl.forEach(([x, y], i) => o.push(X(x - 0.5, y - 0.5, 1, 1, i % 4 === f % 4 ? '#ffffff' : 'scr_rimeWolfIce:4', { em: true })));
  }

  // ---------------------------------------------------------------- the light
  if (grey) {
    // cold moonlight through the pines, from above-left
    o.push(Lt(8, -4, 84, '#b4c6e2', 0.55, 34));
  } else if (rime) {
    // the cold glow of the ice along its back
    const [lx, ly] = qpt(cA, cC, cB, 0.12);
    o.push(Lt(lx + 4, ly + 2, 40, '#9fe0ff', 0.85 * fl, 10));
  } else {
    // the Freezing Mist Cone: a fog that widens as it rolls out of the jaws
    const mouth = H.pt(15, 5.6 + jaw * 4), ux = 0.52, uy = -0.85, len = 46, an = Math.atan2(uy, ux);
    const at = (t: number, side: number): Pt => [mouth[0] + ux * len * t - uy * side, mouth[1] + uy * len * t + ux * side];
    for (const [layer, ink0, rs] of [[0, -0.66, 1], [1, -0.54, 0.66], [2, -0.42, 0.4]]) {
      for (let i = 0; i < 12; i++) {
        const t = (i + (f % 4) / 4) / 12, wv = Math.sin(i * 2.3 + layer) * (1 + 6 * t) * 0.5;
        const [x, y] = at(t, wv), r = (1.6 + 11 * t) * rs + 0.6;
        o.push(E(x, y, r * 1.25, r, 'scr_brimMist', { fl: 0.8, a: an, ink: ink0 - 0.14 * t + hash2(i, layer + 3) * 0.04, occ: false }));
      }
    }
    o.push(Lt(...at(0.22, 0), 50, '#9fe6ff', 0.9 * fl, 12));
  }
  return rime ? T(o, { flip: true, px: 48, py: 48 }) : o;
}

/** A plain grey wolf, three-quarter on, head low: hackles up, the lip curled off the fangs, amber eyes; moonlight through the pines. */
export function wolfPortrait(f: number): PrimTree {
  return wolf(f, 'wolf');
}

/** The coven's white wolf of the night raid: ears flat, eyes showing white, a fear-grin; ice glowing along its back, snow falling. */
export function rimeWolfPortrait(f: number): PrimTree {
  return wolf(f, 'rime');
}

/** The Rime Hollows' storm-grey howler: head thrown back, jaws wide, breathing the Freezing Mist Cone that lights its throat. */
export function brimHowlerPortrait(f: number): PrimTree {
  return wolf(f, 'brim');
}
