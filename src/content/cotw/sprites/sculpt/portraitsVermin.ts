import { E, K, P, X, Lt, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9d, group D: the vermin. The Giant Rat, the Glacier Borer, the Rotwood Crawler, the Quicksilver Leech. Conventions: portraitKit.ts. */

/** A frame at (px, py), turned by ang, scaled by k: primitives in head space. */
function sframe(px: number, py: number, ang: number, k: number) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + x * c - y * s, py + x * s + y * c];
  return {
    P: (pts: number[], m: string, o?: PrimOptions) => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}) => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: (o.a || 0) + ang }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions) => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions) => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - (w * k) / 2, b - (h * k) / 2, w * k, h * k, m, o); },
    S: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r0: number, r1: number, m: string, n?: number, o?: PrimOptions) => { const a = pt(ax, ay), b = pt(bx, by), c2 = pt(cx, cy); return strand(a[0], a[1], b[0], b[1], c2[0], c2[1], r0 * k, r1 * k, m, n, o); },
  };
}

/** A tufted edge along a quadratic a -> b (control c): sgn 1 pushes the tufts out on the left of the direction of travel. */
function furEdge(a: Pt, c: Pt, b: Pt, n: number, amp: number, sgn: number, seed: number, lean = 0.4): number[] {
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

interface SpinePt { x: number; y: number; r: number; ux: number; uy: number }

/** Catmull-Rom through [x, y, r] points (the first and last only steer): n samples a span, each with the unit tangent. */
function spine(C: number[][], n: number): SpinePt[] {
  const out: SpinePt[] = [];
  for (let i = 1; i < C.length - 2; i++) {
    const p0 = C[i - 1], p1 = C[i], p2 = C[i + 1], p3 = C[i + 2];
    const last = i === C.length - 3;
    for (let j = 0; j < n + (last ? 1 : 0); j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const v = (k: number): number => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
      const d = (k: number): number => 0.5 * ((p2[k] - p0[k]) + 2 * (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t + 3 * (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t2);
      const tx = d(0), ty = d(1), l = Math.hypot(tx, ty) || 1;
      out.push({ x: v(0), y: v(1), r: v(2), ux: tx / l, uy: ty / l });
    }
  }
  return out;
}

// ================================================================= GIANT RAT
/**
 * The gnawer of winter stores, looming out of the cellar dark over the candle stub it has
 * been eating: the long wedge of its head thrust down at you, the jaw dropped off long
 * yellow incisors, a hard small eye shining amber under a heavy matted brow, ragged ears
 * laid flat, the hackles up in spikes along its hunched back, old scars bald in its fur;
 * the guttering flame lights it from below.
 */
export function giantRatPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.1, 0.88, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gRat', HL = 'scr_ratHalo', FU = 'scr_ratFur', FD = 'scr_ratFurDark', SK = 'scr_ratSkin', SC = 'scr_ratScar';
  const TE = 'scr_ratTeeth', MW = 'scr_ratMaw', GU = 'scr_ratGum', CL = 'scr_ratClaw', TW = 'scr_ratTallow';
  const cx = 86, ct = 86; // the candle stub: its gnawed rim
  // the cellar: rough stone courses in the dark, the candle's halo
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(40, 26, 58, 48, BG, { fl: 1, ink: BAND[2] }));
  for (const [x, y, w, h, k] of [[52, -1, 22, 11, 0.04], [76, -1, 22, 11, -0.04], [62, 11, 22, 12, -0.02], [86, 11, 12, 12, 0.04], [72, 24, 26, 12, 0.02]]) {
    o.push(P([x + 0.8, y + 0.8, x + w - 1, y + 0.4, x + w - 0.6, y + h - 1, x + 0.4, y + h - 0.8], BG, { ink: BAND[3] + k }));
  }
  o.push(E(cx, ct - 10, 16, 15, HL, { fl: 1, ink: BAND[1] }));
  o.push(E(cx, ct - 10, 10, 9.5, HL, { fl: 1, ink: BAND[2] }));
  o.push(E(cx, ct - 11, 5.5, 5.5, HL, { fl: 1, ink: BAND[3] }));

  const hb = -b * 0.5;
  // the hunched back behind the lowered head, the hackles up in spikes along it,
  // and the chest under the jaw
  o.push(P([...furEdge([42, 16], [18, -10], [-2, 14], 14, 4.6, 1, 7, 0.6), -2, 97, 68, 97,
    ...furEdge([66, 97], [60, 78], [46, 68], 8, 2.4, 1, 3, 0.5), 42, 40], FD, { bv: 8, ink: -0.28 }));
  o.push(E(12, 66, 18, 24, FD, { fl: 0.3, ink: -0.16, occ: false })); // the shoulder
  // matted clumps in the fur, and three old claw-rakes bald across the shoulder
  for (let i = 0; i < 16; i++) {
    const x = 2 + hash2(i, 61) * 40, y = 24 + hash2(i, 63) * 70;
    o.push(K(x, y, x - 2.4, y + 3.6, 0.8, 0.4, FD, { ink: -0.46, occ: false }), K(x + 1, y + 0.4, x - 1, y + 3.4, 0.5, 0.3, FD, { ink: -0.06, occ: false }));
  }
  for (let j = 0; j < 3; j++) o.push(K(6 + j * 3.6, 56 + j * 1.4, 15 + j * 3.6, 72 + j * 1.4, 0.6, 0.5, SC, { ink: -0.36, occ: false }));

  // the head, in its own frame: x along the snout, lowered and thrust at you
  const H = sframe(42, 35 + hb, 0.36, 2.15);
  const sn = [0, 0.18, 0, -0.14][f % 4]; // the nose twitches as it scents you
  // the far ear, a ragged sliver over the crown
  o.push(H.P([-2.4, -8.6, -5, -10.6, -9.6, -11, -7.4, -9.4], SK, { bv: 0.6, ink: -0.6 }));
  // the mouth a little open: the dark inside
  o.push(H.P([4, 5.4, 18.6, 3.6, 19.2, 5.6, 18, 8.6, 16, 9.2, 9, 7.4, 4, 6.4], MW, { ink: -0.5 }));
  // the head: a long narrow wedge, the skull running straight down into the snout;
  // the nape and throat in dark matted fur, spiky at the edge
  o.push(H.P([22.8, 0.6, 22.2, -0.9, 20.6, -1.9, 17, -3.1, 12, -4.7, 7, -6.3, 2, -7.9, -3, -8.9, -8, -8.9, -11.6, -7.9,
    ...furEdge([-12.6, -7], [-19.4, -0.6], [-13, 9.2], 8, 3, 1, 5, 0.6), ...furEdge([-11, 9.4], [-4, 11.4], [2, 8.2], 4, 1.8, 1, 9, 0.4),
    4.6, 6, 9, 4.8, 14, 4.2, 18.4, 3.6, 20.2, 3.2, 21.8, 2.4], FD, { bv: 5, ink: 0.04 }));
  // the lower jaw, dropped a little, the long lower incisors standing up out of it
  o.push(H.P([-3, 8.2, 4, 6.4, 9, 7.8, 13, 9.4, 16.4, 10.4, 17.6, 10.8, 17, 12.2, 12.4, 13, 7, 12, 2, 11, -4, 10.6], FU, { bv: 1.6, ink: -0.12 }));
  o.push(H.P([-4, 10.6, 2, 11, 7, 12, 12.4, 13, 17, 12.2, ...furEdge([16.2, 12.4], [7, 14.6], [-4, 11.4], 8, 1.4, -1, 13, 0.4)], FD, { bv: 1, ink: -0.14 })); // matted under the chin
  o.push(H.P([16.4, 10.6, 17.6, 10.6, 18.4, 7.8, 17.5, 7.6], TE, { bv: 0.4, ink: -0.4 })); // the far lower incisor
  o.push(H.P([17.2, 11, 18.6, 11, 19.6, 8, 18.6, 7.8], TE, { bv: 0.5, ink: -0.12 })); // the near one
  // the face, paler, its back edge breaking into the dark nape in matted spikes
  o.push(H.P([22.8, 0.6, 22.2, -0.9, 20.6, -1.9, 17, -3.1, 12, -4.7, 7, -6.3, 2, -7.9, -3.4, -8.8,
    ...furEdge([-4.4, -8.6], [-12, -1], [-6.4, 8.8], 8, 2.6, 1, 21, 0.5),
    -2, 9.6, 2, 8.2, 4.6, 6, 9, 4.8, 14, 4.2, 18.4, 3.6, 20.2, 3.2, 21.8, 2.4], FU, { bv: 4, ink: -0.15 }));
  o.push(H.E(-1.6, 3.2, 6.6, 4, FU, { a: -0.14, fl: 0.3, ink: -0.13, occ: false })); // the cheek's muscle
  o.push(H.K(-0.6, -7.5, 19, -2.2, 1.1, 0.7, FU, { ink: 0.02, occ: false })); // the crown and the long bridge in the light
  o.push(H.K(7, -0.4, 18.4, 0.8, 2.6, 1.6, FU, { ink: -0.14, occ: false })); // the side of the snout
  // the near ear: small, laid flat back along the skull, ragged, a notch bitten out of it
  o.push(H.P([-3.6, -8.8, -5.8, -10.4, -9, -11, -11.6, -10.6, -10.4, -10, -12.4, -9.4, -11.8, -8.6, -8.6, -8.3], SK, { bv: 1, ink: -0.5 }));
  o.push(H.P([-5.2, -9.3, -7.2, -10.2, -9.6, -10.1, -9.2, -9], SK, { bv: 0.6, ink: -0.7 })); // its hollow, in shadow
  o.push(H.K(-5.8, -10.4, -11.6, -10.6, 0.36, 0.3, FD, { ink: 0, occ: false })); // the furred rim
  // the eye: small and hard, the eyeshine amber, under a heavy brow of matted fur
  o.push(H.E(4.6, -2.8, 2.9, 2.1, FD, { fl: 0.4, ink: -0.44 })); // the socket
  o.push(H.E(4.8, -2.6, 1.9, 1.5, 'scr_ratEyeBall'));
  o.push(H.E(5.4, -2.2, 1.2, 0.9, 'eyeAmber', { ink: -0.16 + (fl - 1) * 0.4 })); // the eyeshine
  o.push(H.X(4.3, -2.9, 0.55, 0.55, '#fff4dc', { em: true }));
  o.push(H.P([-1.6, -5.6, 1.4, -7.4, 5.6, -7, 9.4, -5, 9.8, -3.8, 7.2, -3.4, 5, -3.6, 2.8, -3.8, 0.2, -4], FU, { bv: 1, ink: 0 })); // the brow
  o.push(H.K(1.6, -3.9, 8.6, -3.4, 0.5, 0.42, FD, { ink: -0.4, occ: false })); // its shadow on the eye
  o.push(H.K(2.6, -0.8, 7, -0.9, 0.5, 0.4, FD, { ink: -0.3, occ: false })); // the bag under it
  // scars, bald: a claw-rake across the cheek, a nick across the bridge
  for (const [x0, y0, x1, y1] of [[-6.4, -4.2, -1.6, -0.8], [-1.6, -0.8, 2.2, 2.8], [8.6, -5, 11.6, -3.4]]) {
    o.push(H.K(x0 + 0.2, y0 + 0.34, x1 + 0.2, y1 + 0.34, 0.34, 0.3, FD, { ink: -0.4, occ: false }));
    o.push(H.K(x0, y0, x1, y1, 0.3, 0.26, SC, { ink: -0.24, occ: false }));
  }
  // the whisker pad, the lip drawn back off the gum, the long upper incisors
  o.push(H.E(17.2, 1.4, 3.6, 2.2, FU, { fl: 0.6, ink: 0.02 }));
  for (const [x, y] of [[15.6, 0.8], [17, 1.8], [18.6, 1], [16.4, 2.6]]) o.push(H.X(x, y, 0.5, 0.5, FD + ':1'));
  o.push(H.P([14.4, 4.4, 17.4, 3.2, 20.4, 3.2, 21, 4.4, 17.6, 4.6, 15, 5.2], GU, { ink: -0.1 }));
  o.push(H.P([17.9, 3.8, 19, 3.8, 18.9, 6, 18.7, 7.8, 17.9, 7.6, 17.9, 5.8], TE, { bv: 0.4, ink: -0.36 })); // the far one
  o.push(H.P([19.1, 3.8, 20.5, 3.9, 20.4, 6.2, 20, 8.4, 18.9, 8.2, 19.1, 6], TE, { bv: 0.5, ink: 0.02 }));
  // the nose, scenting, and the split under it
  o.push(H.E(21.4 + sn, 0.6, 1.9, 1.7, 'scr_ratNose', { fl: 0.1 }));
  o.push(H.K(22 + sn, 1.3, 22.9 + sn, 0.8, 0.42, 0.36, MW, { occ: false }));
  o.push(H.K(21 + sn, 2.2, 20.4, 3.4, 0.3, 0.28, GU, { occ: false, ink: -0.3 }));
  // the whiskers, stiff, twitching
  for (const [x0, y0, ex, ey] of [[16, 0.6, 32, -5], [17.6, 1.4, 33, 4], [16.2, 2.4, 27, 11]]) {
    o.push(H.S(x0, y0, (x0 + ex) / 2 + 1, (y0 + ey) / 2 - 2, ex + s * 0.5, ey + s * 0.3, 0.22, 0.22, 'scr_ratWhisker', 3, { occ: false, ink: -0.34 }));
  }

  // the candle stub, gnawed at its rim, and the flame
  o.push(K(cx, ct + 0.6, cx + 0.4, 104, 6.2, 6.6, TW, { ink: -0.16 }));
  o.push(E(cx, ct, 6.2, 2.1, TW, { fl: 0.6, ink: -0.08 }));
  o.push(E(cx - 0.4, ct + 0.2, 4, 1.1, TW, { fl: 0.8, ink: -0.3 })); // the dish melted round the wick
  for (const [x, y, r] of [[-5.2, 1, 1.5], [3.2, 1.6, 1.3], [5.2, 0.8, 1.1]]) o.push(E(cx + x, ct + y, r, r * 0.9, TW, { fl: 0.8, ink: -0.56 })); // gnaw marks
  o.push(K(cx + 5.6, ct + 1.6, cx + 6.2, ct + 7 + (f % 2) * 0.4, 1, 0.9, TW, { ink: -0.12 })); // a run of tallow
  o.push(K(cx, ct, cx + 0.3, ct - 3.6, 0.5, 0.45, 'scr_ratWick'));
  const fw = [0, 0.7, -0.6, 0.3][f % 4], fh = [10, 11.2, 9, 10.4][f % 4], fb = ct - 3.6;
  o.push(P([cx - 2.4, fb, cx - 1.9, fb - 3.2, cx + fw * 0.7, fb - fh, cx + 1.9, fb - 3.6, cx + 2.4, fb, cx, fb + 1.6], 'emFire', { ink: -0.08 }));
  o.push(P([cx - 1.1, fb + 0.2, cx - 0.8, fb - 2.6, cx + fw * 0.45, fb - fh * 0.6, cx + 0.9, fb - 2.6, cx + 1.1, fb + 0.2, cx, fb + 1.2], 'emFireCore', { ink: 0 }));
  // the forepaw clamped on the stub: long fingers, black claws hooked into the tallow
  o.push(P([...furEdge([74, 87], [52, 81], [30, 90], 8, 2.2, 1, 17, 0.5), 28, 99, 70, 99, 76, 92], FD, { bv: 3, ink: -0.18 }));
  o.push(E(74, 89, 4.4, 3.2, FD, { a: -0.3, ink: -0.1 })); // the back of the paw
  for (let i = 0; i < 4; i++) {
    const x0 = 75 + i * 1.1, y0 = 86.6 + i * 1.2, x1 = 80 + i * 0.6, y1 = 85.4 + i * 1.3;
    o.push(K(x0, y0, x1, y1, 1, 0.8, SK, { ink: -0.5 + (i % 2) * 0.08 }));
    o.push(K(x1, y1, x1 + 2, y1 + 2.4, 0.75, 0.3, CL, {}));
  }

  // light: the candle, from below
  o.push(Lt(cx + 1, ct - 13, 66, '#ff9a40', 0.95 * fl, 16));
  return o;
}

// ============================================================ GLACIER-BORER
/** A spiral-grooved drill from base (bx,by) to tip (tx,ty); ph turns the grooves. */
function drill(o: Out, bx: number, by: number, tx: number, ty: number, r: number, ph: number, ink: number): void {
  const L = Math.hypot(tx - bx, ty - by), ux = (tx - bx) / L, uy = (ty - by) / L, nx = -uy, ny = ux;
  const pt = (t: number, side: number): Pt => { const tt = Math.max(0, Math.min(0.97, t)), rr = (r * (1 - tt) + 0.6 * tt) * 0.94; return [bx + ux * L * tt + nx * side * rr, by + uy * L * tt + ny * side * rr]; };
  o.push(K(bx, by, tx, ty, r, 0.6, 'scr_borerGroove', { ink: 0 })); // the flutes, dark
  // the lands: helical bands winding to the point; ph turns them
  const n = 7, w = 0.075, d = 0.17;
  for (let i = -1; i <= n; i++) {
    const t0 = (i + ph) / n;
    if (t0 + w + d < 0.02 || t0 > 0.97) continue;
    o.push(P([...pt(t0, -1), ...pt(t0 + d, 1), ...pt(t0 + d + w, 1), ...pt(t0 + w, -1)], 'scr_borerDrill', { bv: 1.2, ink: ink - 0.03 * i }));
  }
  o.push(K(...pt(0.06, -0.62), ...pt(0.9, -0.5), r * 0.1, 0.3, 'scr_borerDrill', { ink: ink + 0.3, occ: false })); // the glint along it
  o.push(K(...pt(0.86, 0), tx, ty, 0.9, 0.5, 'scr_borerDrill', { ink: ink + 0.34, occ: false })); // the point, bright
}

/** A rime crystal from base (x,y): height h, half-width w, its tip leaning by lean. */
function crystal(o: Out, x: number, y: number, h: number, w: number, lean: number, ink: number): void {
  const R = 'scr_borerRime', tx = x + lean, ty = y - h;
  o.push(P([x - w, y, x - w * 0.9 + lean * 0.3, y - h * 0.7, tx, ty, x + w * 0.9 + lean * 0.3, y - h * 0.7, x + w, y], R, { ink: ink - 0.56 }));
  o.push(P([x - w, y, x - w * 0.9 + lean * 0.3, y - h * 0.7, tx, ty, x + lean * 0.15 - w * 0.2, y - h * 0.62, x - w * 0.2, y], R, { ink: ink - 0.12 }));
  o.push(K(x - w * 0.86 + lean * 0.3, y - h * 0.66, tx - 0.3, ty + 1, 0.45, 0.3, R, { ink: ink + 0.1, occ: false })); // the lit edge
}

/**
 * What bores through glaciers: the beetle shouldering out of its own tunnel in the ice, its
 * head a low wedge of overlapping armour plates, small hard eyes under the brow; two spiral
 * drill-mandibles thrust at you and slowly turning, small hooked mandibles working between
 * their roots; the rime grown out of its back glows with the cold of the heart of ice inside.
 */
export function glacierBorerPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const gl = [1, 1.06, 0.97, 1.03][f % 4], ph = (f % 4) / 4;
  const o: Out = [];
  const BG = 'scr_gBorer', SH = 'scr_borerShell', CH = 'scr_borerChitin', PL = 'scr_borerPlate', LG = 'scr_borerLeg', SO = 'scr_borerSocket';
  // the glacier: faceted ice in flat bands, the bore-hole black behind the beetle
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(P([46, -1, 97, -1, 97, 44, 84, 34, 70, 24, 58, 10], BG, { ink: BAND[2] }));
  o.push(P([68, -1, 97, -1, 97, 22, 86, 14, 78, 4], BG, { ink: BAND[3] }));
  o.push(P([-1, 74, 14, 80, 22, 97, -1, 97], BG, { ink: BAND[2] }));
  o.push(P([62, 97, 70, 88, 86, 82, 97, 80, 97, 97], BG, { ink: BAND[2] }));
  o.push(P([80, 97, 88, 90, 97, 89, 97, 97], BG, { ink: BAND[3] }));
  o.push(E(14, 40, 42, 38, BG, { fl: 1, ink: BAND[3] })); // the tunnel's rim
  o.push(E(13, 41, 36, 33, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(12, 42, 31, 28, 'scr_borerHole', { fl: 1 }));

  const by = -b * 0.4;
  const line = (pts: number[], r: number, m: string, ink: number): void => { for (let i = 0; i + 3 < pts.length; i += 2) o.push(K(pts[i], pts[i + 1] + by, pts[i + 2], pts[i + 3] + by, r, r, m, { ink, occ: false })); };
  const hp = (pts: number[], m: string, oo?: PrimOptions) => P(pts.map((v, i) => (i % 2 ? v + by : v)), m, oo);
  // the far foreleg, under the drills
  o.push(K(58, 76, 66, 86, 3, 2.4, LG, { ink: -0.34 }), K(66, 86, 70, 97, 2.4, 1.6, LG, { ink: -0.38 }));
  // the wing-cases, rimed, and the seam down them
  o.push(E(-4, 54 + by, 26, 23, SH, { a: 0.25, ink: -0.46 }));
  o.push(K(-6, 42 + by, 12, 36 + by, 0.7, 0.7, CH, { occ: false, ink: -0.2 }));
  crystal(o, -1, 37 + by, 15, 4, -3.6, -0.14);
  crystal(o, 9, 34 + by, 23, 5.6, -1.8, -0.06);
  crystal(o, 4, 36 + by, 10, 2.6, -4.6, -0.16);
  // the shield behind the head
  o.push(E(22, 52 + by, 19, 18, SH, { a: 0.3, ink: -0.42 }));
  o.push(K(10, 40 + by, 32, 44 + by, 0.7, 0.6, CH, { occ: false, ink: -0.2 })); // its front rim
  for (const [x, y, a] of [[33, 46, -0.5], [36, 52, -0.2], [37.6, 59, 0.1], [37.6, 66, 0.4]]) { // spines along its edge, over the head
    const ux = Math.cos(a), uy = Math.sin(a);
    o.push(P([x - uy * 1.6, y + ux * 1.6 + by, x + ux * 6, y + uy * 6 + by, x + uy * 1.6, y - ux * 1.6 + by], SH, { bv: 0.8, ink: -0.3 }));
  }
  crystal(o, 19, 38 + by, 27, 6, 1.6, 0);
  crystal(o, 13, 38 + by, 12, 3, -1.6, -0.1);
  crystal(o, 28, 40 + by, 14, 4, 3.6, -0.08);
  // the near legs, thick and spurred, reaching for the lip of the bore
  // a flattened, angular leg segment from a to b, swelling at 40%, with spines on one edge
  const seg = (ax: number, ay: number, bx: number, by2: number, w0: number, wm: number, w1: number, ink: number, spines: number[]): void => {
    const L = Math.hypot(bx - ax, by2 - ay), ux = (bx - ax) / L, uy = (by2 - ay) / L, nx = -uy, ny = ux, mx = ax + ux * L * 0.4, my = ay + uy * L * 0.4;
    const pts = [ax + nx * w0, ay + ny * w0, mx + nx * wm, my + ny * wm, bx + nx * w1, by2 + ny * w1, bx - nx * w1, by2 - ny * w1];
    for (const t of spines) { const sx = ax + ux * L * t, sy = ay + uy * L * t, w = wm + (w1 - wm) * Math.max(0, (t - 0.4) / 0.6); pts.push(sx - nx * w + ux * 1, sy - ny * w + uy * 1, sx - nx * (w + 2.6) - ux * 1.2, sy - ny * (w + 2.6) - uy * 1.2, sx - nx * w - ux * 1, sy - ny * w - uy * 1); }
    pts.push(mx - nx * wm, my - ny * wm, ax - nx * w0, ay - ny * w0);
    o.push(P(pts, LG, { bv: 1.4, ink }));
  };
  for (const [x0, y0, x1, y1, x2, y2] of [[14, 64, 4, 74, 2, 86], [34, 68, 26, 76, 27, 88]]) {
    seg(x0, y0 + by, x1, y1, 2.6, 3.8, 2.2, -0.1, []); // the thigh
    seg(x1, y1, x2, y2, 2, 2, 1, -0.16, [0.75, 0.45]); // the shin, spined
    o.push(E(x1, y1, 2.4, 2, CH, { ink: -0.1 })); // the knee
  }
  // the far drill-mandible, behind the head, turning
  drill(o, 66, 56 + by, 97, 66, 7.2, (ph + 0.5) % 1, -0.06);
  // the head capsule: a low armoured wedge, the brow sloping down to the mouth
  o.push(hp([34, 44, 42, 42.4, 50, 43.2, 58, 46.6, 64, 51, 68, 55.4, 71, 58.6, 71.6, 61.6, 69, 64, 64, 70, 56, 74, 46, 75, 38, 72, 34, 66], CH, { bv: 3, ink: -0.22 }));
  // the mouth under the clypeus: small hooked mandibles working in it, the palps
  o.push(hp([63, 62, 71, 62, 75, 64.6, 73.6, 69.4, 66, 70.6, 61.6, 67], SO));
  const mo = [0, 0.4, 0.7, 0.3][f % 4];
  const mand = (a: Pt, c: Pt, bb: Pt, r0: number, ink: number): void => {
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = qpt(a, c, bb, i / 6), [x1, y1] = qpt(a, c, bb, (i + 1) / 6);
      o.push(K(x0, y0 + by, x1, y1 + by, r0 * (1 - i / 6) + 0.4, r0 * (1 - (i + 1) / 6) + 0.4, CH, { ink: ink - i * 0.04 }));
    }
  };
  mand([65, 63], [73, 61.6 - mo], [76.4, 66.4], 1.5, -0.1);
  mand([64, 69], [72.6, 71.4 + mo], [75.6, 65.6], 1.7, 0.02);
  o.push(K(66, 68 + by, 68 + s * 0.4, 72.6, 1.1, 0.9, CH, { ink: -0.1 }), K(68 + s * 0.4, 72.6, 71 + s * 0.5, 73.6, 0.9, 0.7, CH, { ink: -0.04 }));
  // the near drill-mandible, rooted under the cheek plate, thrust at you, turning
  drill(o, 54, 70 + by, 93, 79, 9.4, ph, -0.08);
  // the cheek plate, lapping over the drill's root, its lower edge a saw of spines
  o.push(hp([36, 58, 46, 57.6, 56, 59.4, 63, 62.4, 66, 66.4, 62, 72.4, 60.4, 77.4, 57.4, 75.8, 55.6, 80.4, 52.4, 77.8, 49.6, 81.4, 47, 78, 43.4, 79.6, 42, 76.4, 38, 76.6, 37, 73, 34, 66], PL, { bv: 2.6, n: [0.1, 0.42, 0.9], ink: -0.1 }));
  line([37, 58.4, 46, 58, 56, 59.8, 63, 62.8], 0.5, PL, 0.22); // its upper rim, lit
  // the plates overlap front to back: each rear plate's edge lit, the next one under it in shadow
  const seam = (a: Pt, c: Pt, e: Pt, w: number): void => {
    for (let i = 0; i < 5; i++) {
      const [x0, y0] = qpt(a, c, e, i / 5), [x1, y1] = qpt(a, c, e, (i + 1) / 5);
      o.push(K(x0 + 0.9, y0 + by, x1 + 0.9, y1 + by, w, w, SO, { ink: -0.2, occ: false }));
      o.push(K(x0, y0 + by, x1, y1 + by, 0.42, 0.42, PL, { ink: 0.26, occ: false }));
    }
  };
  seam([49, 58.2], [51.4, 67], [48.6, 79.4], 0.7);
  // the brow plate: low, sloped, drawn forward into a hooked beak over the mouth,
  // overhanging the eye, its leading edge catching the light
  o.push(hp([33, 44.4, 42, 42, 51, 42.8, 59, 46.2, 65, 50.8, 70, 54.8, 75, 60, 70.4, 58.6, 65, 56.2, 58, 53.8, 50, 52, 42, 51.8, 35, 53], PL, { bv: 2.6, n: [-0.2, -0.58, 0.79], ink: 0.02 }));
  line([34, 44.6, 42, 42.3, 51, 43.1, 59, 46.5, 65, 51.1, 70, 55.1, 74.4, 59.6], 0.5, PL, 0.3);
  line([42, 52.4, 50, 52.6, 58, 54.2, 65, 56.6, 70.4, 59], 0.6, SO, 0); // the undercut over the eye
  seam([44.6, 42.4], [46.4, 47], [44.2, 51.8], 0.65);
  seam([57.6, 45.6], [59.6, 49.6], [57.4, 53.6], 0.6);
  // the clypeus over the mouth, under the beak
  o.push(hp([64, 57.4, 69, 58.6, 71.6, 61.6, 66.6, 62.6, 63.4, 60], PL, { bv: 1, n: [0.5, -0.1, 0.86], ink: -0.1 }));
  // the eye: a small, hard, faceted kidney, hooded under the brow
  o.push(hp([47.6, 54.2, 50.6, 53.6, 53.6, 54.2, 54, 55.6, 52, 56.8, 49.4, 56.8, 47.6, 55.8], SO, { bv: 0.5 }));
  o.push(hp([48.6, 54.8, 50.8, 54.4, 53, 54.8, 53, 55.6, 51.6, 56.2, 49.6, 56.2, 48.6, 55.6], 'eyeAmber', { bv: 1, ink: -0.56 }));
  for (const [x, y] of [[50.4, 55.2], [52, 55.4]]) o.push(X(x, y + by, 1, 1, 'eyeAmber:1'));
  o.push(X(49.2, 54.8 + by, 1, 1, '#fff6e0', { em: true }));
  // the lip of the bore in front, the claws hooked over it
  o.push(P([-1, 86, 12, 82, 26, 84, 40, 83, 52, 86, 64, 84, 78, 87, 97, 85, 97, 97, -1, 97], 'scr_borerIce', { bv: 3, ink: -0.36 }));
  o.push(K(-1, 86.4, 12, 82.6, 0.8, 0.8, 'scr_borerIce', { ink: 0.1, occ: false }), K(12, 82.6, 26, 84.4, 0.8, 0.8, 'scr_borerIce', { ink: 0.06, occ: false }),
    K(26, 84.4, 40, 83.4, 0.8, 0.8, 'scr_borerIce', { ink: 0.02, occ: false }), K(40, 83.4, 52, 86.2, 0.8, 0.7, 'scr_borerIce', { ink: -0.04, occ: false }));
  for (const [x, y] of [[2, 85], [27, 86]]) {
    o.push(K(x, y, x + 2.4, y + 3, 1.4, 0.5, CH, { ink: -0.06 }), K(x - 1.4, y, x - 1.6, y + 3.4, 1.2, 0.4, CH, { ink: -0.12 }));
  }
  // ice chips thrown off the drill tips, drifting
  for (let i = 0; i < 4; i++) {
    const x = 82 + hash2(i, 31) * 12 + f * 0.25, y = 50 + hash2(i, 33) * 28 - f * 0.2 * (i % 2 ? 1 : -1);
    o.push(P([x, y - 1.4, x + 1.2, y, x, y + 1.2, x - 1.1, y], 'scr_borerChip', { ink: -0.1 }));
  }
  // light: the rime on its back, cold as the heart of ice
  o.push(Lt(30, 28, 80, '#9fe6ff', 1 * gl, 18));
  return o;
}

// ========================================================== ROTWOOD CRAWLER
interface Plate { t: number; x: number; y: number; ux: number; uy: number; px: number; py: number; w: number; h: number; tw: number; fade: number }

/**
 * The centipede of the World-Bark's rot, reared up out of the wood at the viewer: the
 * poison-claws spread wide round a mouth that glows bile-green, venom beading on their
 * points; the long feelers sweep the dark; plate after plate of its body, legs bristling,
 * runs back down into the rotten bark.
 */
export function rotwoodCrawlerPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.08, 0.94, 1.03][f % 4];
  const o: Out = [];
  const BG = 'scr_gCrawl', PL = 'scr_crawlPlate', BK = 'scr_crawlBark', LG = 'scr_crawlLeg', FG = 'scr_crawlFang';
  // the World-Bark: rotten wood in long flat grain, a bracket fungus, the glow
  o.push(P(FULL, BG, { ink: BAND[1] }));
  for (let i = 0; i < 7; i++) {
    const x0 = -4 + i * 15 + hash2(i, 41) * 5, w = 4 + hash2(i, 43) * 4, pts: number[] = [];
    for (let j = 0; j <= 6; j++) pts.push(x0 + Math.sin(j * 1.1 + i) * 2.4, -1 + j * 16.5);
    for (let j = 6; j >= 0; j--) pts.push(x0 + w + Math.sin(j * 1.1 + i + 0.6) * 2.4, -1 + j * 16.5);
    o.push(P(pts, BG, { ink: i % 3 === 1 ? BAND[3] : BAND[2] }));
  }
  o.push(P([-1, 20, 10, 21, 18, 24, 16, 27, 6, 27, -1, 26], BG, { ink: BAND[3] })); // a bracket fungus
  o.push(P([-1, 26, 6, 27, 16, 27, 10, 30, -1, 30], BG, { ink: BAND[2] - 0.06 }));

  const hy = -b * 0.4;
  // the body: plate after plate running back down into the bark, legs bristling
  // the spine runs from under the head back and down out of the frame
  const sa: Pt = [70, 47], sc: Pt = [36, 46], sb: Pt = [4, 102], NS = 9;
  const seg: Plate[] = [];
  for (let i = 0; i < NS; i++) {
    const t = (i + 0.6) / NS, [x0, y0, tx, ty] = qpt(sa, sc, sb, t), l = Math.hypot(tx, ty);
    const ux = tx / l, uy = ty / l;
    seg.push({ t, x: x0, y: y0 + hy * (1 - t), ux, uy, px: -uy, py: ux, w: 7.5 + t * 6, h: 2.8 + t * 1.6, tw: sway(f + i) * 0.35, fade: -t * 0.34 });
  }
  // the far legs, up and out, then down to the bark
  for (const g of seg) {
    const rx = g.x + g.px * g.w * 0.85, ry = g.y + g.py * g.w * 0.85, kx = rx + g.px * 7 - 1, ky = ry + g.py * 7 - 2;
    o.push(K(rx, ry, kx, ky, 1.3, 1, LG, { ink: -0.34 + g.fade }), K(kx, ky, kx - 2.4 + g.tw, ky + 9, 1, 0.3, LG, { ink: -0.4 + g.fade }));
  }
  // the soft body under the plates
  for (let i = 0; i < 12; i++) {
    const [x0, y0] = qpt(sa, sc, sb, i / 12), [x1, y1] = qpt(sa, sc, sb, (i + 1) / 12);
    o.push(K(x0, y0 + hy * (1 - i / 12), x1, y1 + hy * (1 - (i + 1) / 12), 6 + (i / 12) * 5, 6 + ((i + 1) / 12) * 5, 'scr_crawlMaw', {}));
  }
  // the plates, tail first, each with its lit front edge
  for (let i = NS - 1; i >= 0; i--) {
    const g = seg[i], M = i % 2 ? PL : BK, c = (a: number, b2: number): Pt => [g.x + g.px * a + g.ux * b2, g.y + g.py * a + g.uy * b2];
    o.push(P([...c(-g.w, -g.h), ...c(-g.w * 0.8, -g.h * 1.3), ...c(g.w * 0.8, -g.h * 1.3), ...c(g.w, -g.h), ...c(g.w * 0.9, g.h), ...c(-g.w * 0.9, g.h)], M, { bv: 2.2, ink: -0.02 + g.fade }));
    o.push(K(...c(-g.w * 0.75, -g.h * 1.1), ...c(g.w * 0.75, -g.h * 1.1), 0.55, 0.55, M, { ink: 0.14 + g.fade, occ: false }));
  }
  // the near legs, out and down, clawed
  for (const g of seg) {
    const rx = g.x - g.px * g.w * 0.9, ry = g.y - g.py * g.w * 0.9, kx = rx - g.px * 7 + 1, ky = ry - g.py * 7 - 2;
    o.push(K(rx, ry, kx, ky, 1.6, 1.2, LG, { ink: -0.08 + g.fade }), K(kx, ky, kx + 1.6 + g.tw, ky + 9.5, 1.2, 0.35, LG, { ink: -0.12 + g.fade }));
    o.push(K(kx + 1.6 + g.tw, ky + 9.5, kx + 2.6 + g.tw, ky + 11, 0.4, 0.2, 'scr_crawlFangTip', {}));
  }
  // the first segment, which carries the poison-claws
  o.push(E(72, 46 + hy, 12, 6.6, 'scr_crawlMaw', { a: 0.15 }));
  o.push(E(72.4, 45.2 + hy, 11.4, 6, BK, { a: 0.15, ink: 0.04 }));
  // the far feeler, sweeping back
  for (let i = 0; i < 14; i++) {
    const [x, y] = qpt([70, 21 + hy], [60, 4], [44 + s * 0.8, -3], (i + 0.5) / 14);
    o.push(E(x, y, 1.2 - i * 0.04, 1 - i * 0.03, LG, { ink: -0.32 + (i % 2) * 0.08 }));
  }
  // the head: a flat, hard shield of plate turned three-quarters to the viewer,
  // notched between the feelers, the cheek plate lapping over the claw's root
  const hpc = (pts: number[]): number[] => pts.map((v, i) => (i % 2 ? v + hy : v));
  o.push(P(hpc([62, 38, 61.4, 31, 63, 25.4, 66, 21.4, 70, 19.8, 72.4, 21.6, 75, 19.6, 81, 19.2, 86, 22, 88.4, 28, 87.6, 35, 84, 39.4, 74, 41.4, 66, 40.6]), PL, { bv: 2.4, ink: -0.3 }));
  o.push(K(63.4, 25 + hy, 66, 21.4 + hy, 0.6, 0.6, PL, { ink: 0.12, occ: false }), K(66, 21.4 + hy, 70, 20 + hy, 0.6, 0.6, PL, { ink: 0.14, occ: false }),
    K(75, 19.8 + hy, 81, 19.4 + hy, 0.6, 0.6, PL, { ink: 0.1, occ: false })); // its lit front rim
  o.push(K(72, 22.4 + hy, 71.6, 26.6 + hy, 0.45, 0.3, 'scr_crawlMaw', { occ: false })); // the notch's crease
  o.push(P(hpc([62, 38, 61.4, 31, 63, 25.4, 66, 21.4, 68.4, 20.4, 67.4, 27, 66.8, 33.6, 68, 40.8, 66, 40.6]), PL, { ink: -0.56 })); // its far side, turning away
  for (const c of [[76.6, 22.6, 75, 26.6, 76.4, 30, 75, 34.4], [81, 30.6, 83.4, 33.4, 83, 36.4]]) { // cracks in the rotten plate
    for (let i = 0; i + 3 < c.length; i += 2) o.push(K(c[i], c[i + 1] + hy, c[i + 2], c[i + 3] + hy, 0.4, 0.32, 'scr_crawlMaw', { occ: false }));
  }
  o.push(P(hpc([79.6, 30, 84, 28.4, 88.4, 28, 89, 35.4, 85.4, 40.6, 79.4, 39.2]), PL, { bv: 1.4, ink: -0.14 })); // the cheek plate
  o.push(K(64, 39.4, 74, 41 + hy, 0.9, 0.9, PL, { ink: 0.06, occ: false }), K(74, 41 + hy, 84, 37.6 + hy, 0.9, 0.8, PL, { ink: 0.1, occ: false })); // its jaw-edge, under the venom-light
  for (const [x, y, r] of [[67.4, 32.6, 1.2], [65, 36.2, 0.9]]) o.push(E(x, y + hy, r, r * 0.8, PL, { fl: 0.6, ink: -0.42 })); // rot-pits
  // the eyes: a few small hard ocelli clustered at its near front corner (the far ones turned away)
  for (const [x, y, r, k] of [[83.6, 24.6, 0.8, 0], [85.4, 24.9, 0.65, -0.06], [86.8, 26.2, 0.55, -0.12], [84.8, 26.5, 0.5, -0.16]]) {
    o.push(E(x, y + hy, r * 1.5, r * 1.3, 'scr_crawlMaw', {}), E(x, y + hy, r, r * 0.85, 'eyeAmber', { ink: -0.44 + k }));
  }
  o.push(X(83.2, 24.2 + hy, 0.6, 0.6, '#fff4dc', { em: true }));
  // the mouth, glowing with the venom in it
  o.push(P([73, 41 + hy, 83, 38.6 + hy, 88, 42 + hy, 84, 47.6 + hy, 76, 47 + hy], 'scr_crawlMaw'));
  o.push(E(81.4, 43.4 + hy, 3.8, 2.3, 'emPoison', { a: -0.2, ink: -0.16 * fl }));
  o.push(E(82, 43 + hy, 1.8, 1, 'emPoison', { a: -0.2, fl: 1, ink: 0.1 }));
  // the poison-claws: sickles curving in round the mouth, their points dark with venom
  const fang = (a: Pt, c: Pt, bb: Pt, r0: number, ink: number): void => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = qpt(a, c, bb, i / n), [x1, y1] = qpt(a, c, bb, (i + 1) / n);
      o.push(K(x0, y0, x1, y1, r0 * (1 - i / n) + 0.3, r0 * (1 - (i + 1) / n) + 0.3, i < 6 ? FG : 'scr_crawlFangTip', { ink: ink - i * 0.03 }));
    }
  };
  // the far one: its root, a tooth on its inner edge, the hook
  o.push(K(73, 47 + hy, 68, 54, 3.2, 2.8, BK, { ink: -0.2 }));
  o.push(P([67, 56, 71, 57, 68.4, 60], FG, { bv: 0.4, ink: -0.3 }));
  fang([68, 54], [61, 64], [68, 74], 2.6, -0.26);
  // the near one, spread wider
  o.push(K(84, 46 + hy, 90, 52, 3.6, 3.2, BK, { ink: 0.02 }));
  o.push(P([88, 55, 92, 57, 88.6, 60.4], FG, { bv: 0.4, ink: -0.1 }));
  fang([90, 52], [96, 63], [88, 75], 3, -0.04);
  // venom beading on their points, a drop falling
  o.push(E(68.4, 75.2, 1.1, 1.4, 'emPoison', { ink: -0.1 }), E(88.6, 76.2, 1.3, 1.6, 'emPoison', { ink: 0 }));
  o.push(E(88.6, 79.6 + f * 0.32, 0.9, 1.2, 'emPoison', { ink: -0.06 }));
  // the near feeler, beaded, twitching
  for (let i = 0; i < 12; i++) {
    const [x, y] = qpt([83, 22 + hy], [90, 8], [97 + s * 0.6, -2 + s * 0.4], (i + 0.5) / 12);
    o.push(E(x, y, 1.4 - i * 0.05, 1.15 - i * 0.04, LG, { ink: -0.04 + (i % 2) * 0.08 }));
  }
  // light: the venom in its mouth, bile-green
  o.push(Lt(80, 54, 54, '#95dc4c', 1 * fl, 9));
  return o;
}

// ========================================================= QUICKSILVER LEECH
/**
 * Living quicksilver from the Tarnished Silver Veins, coiled on the mine floor and reared
 * at the viewer: a soft muscular worm, swelling and pinching as it heaves, its skin a liquid
 * mirror of the vein above; the sucker turned on you, a wet ragged lip of flesh opening on
 * rings of hooked teeth that spiral into the dark gullet; the eye-spots sunk in the skin
 * behind it.
 */
export function quicksilverLeechPortrait(f: number): PrimTree {
  const b = breath(f);
  const gl = [1, 1.05, 0.96, 1.02][f % 4];
  const o: Out = [];
  const BG = 'scr_gLeech', Q = 'scr_leechQuick', QD = 'scr_leechQuickDark', LP = 'scr_leechLip', FN = 'scr_leechFlesh', MW = 'scr_leechMaw', TH = 'scr_leechTooth';
  // the mine: slate in flat bands, the quicksilver vein weeping across the rock above
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(P([-1, -1, 56, -1, 42, 14, 24, 28, 8, 40, -1, 44], BG, { ink: BAND[2] }));
  o.push(P([-1, -1, 30, -1, 18, 10, -1, 20], BG, { ink: BAND[3] }));
  o.push(P([97, 46, 88, 56, 84, 70, 97, 74], BG, { ink: BAND[2] }));
  const vein: Array<[number, number, number]> = [[-1, 36, 1.6], [6, 30.4, 2.6], [13, 25.6, 3.4], [20, 21.4, 2.6], [27, 15.6, 3.4], [34, 10.6, 2.6], [41, 4, 2.2], [47, -1, 1.6]];
  const ribbon = (k: number, dy: number): number[] => { // the vein's outline at k times its width
    const l: number[] = [], r: number[] = [];
    for (let i = 0; i < vein.length; i++) {
      const [x, y, w] = vein[i], a = vein[Math.max(0, i - 1)], c = vein[Math.min(vein.length - 1, i + 1)];
      const tx = c[0] - a[0], ty = c[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      l.push(x + nx * w * k, y + dy + ny * w * k); r.push(x - nx * w * k, y + dy - ny * w * k);
    }
    for (let i = r.length - 2; i >= 0; i -= 2) l.push(r[i], r[i + 1]);
    return l;
  };
  o.push(P(ribbon(2.8, 0), BG, { ink: BAND[2] }), P(ribbon(1.7, 0), BG, { ink: BAND[3] }));
  o.push(P(ribbon(0.6, 0), 'scr_leechVein', { ink: -0.62 }), P(ribbon(0.26, -0.3), 'scr_leechVein', { ink: -0.42 }));
  for (const [x, y, r] of [[13.6, 29.4, 1.5], [28, 19.6, 1.3], [35.4, 14, 1]]) o.push(E(x, y, r * 0.8, r, Q, { ink: -0.1 })); // its beads
  o.push(E(21.4, 25.4 + f * 0.3, 0.9, 1.2, Q, { ink: -0.1 }));

  const hy = -b * 0.35, L = [-0.45, -0.89];
  // the body: one muscle coiled on the floor and rising, swelling and pinching as it heaves
  const C = [[122, 100, 13], [97, 91, 14], [75, 92, 10], [53, 89, 16.5], [31, 83, 11], [16, 67, 15.5], [19, 52, 10.5], [31, 43, 14], [45, 41, 16.5], [58, 41, 17]];
  // sampled n to a span; the side the key light falls on turns across the body
  // where it bends toward the light
  const body = (n: number): [SpinePt[], Array<[number, number, number]>, number] => {
    const sp = spine(C, n), N = sp.length;
    for (let i = 0; i < N; i++) { const t = i / (N - 1); sp[i].y += hy * t * t; }
    const sd = sp.map((p): [number, number, number] => { const nx = -p.uy, ny = p.ux, s = Math.max(-1, Math.min(1, (nx * L[0] + ny * L[1]) * 3)); return [nx * s, ny * s, Math.abs(s)]; });
    return [sp, sd, N];
  };
  const [sp, , N] = body(3);
  for (let i = 0; i < N - 1; i++) { const p = sp[i], q = sp[i + 1]; o.push(K(p.x, p.y, q.x, q.y, p.r, q.r, QD, { ink: -0.12 })); }
  // its skin a liquid mirror: between each pinch and the next the reflections pool in
  // the swell and thin out into the pinches, as on a bead of mercury: the floor's dark
  // in its belly, the vein's light on its back with a hot core, and the floor's glow
  // a thin rim along its far edge
  const SN = 8, [fp, fd, FNn] = body(SN);
  const wv = (u: number, ph: number): number => 0.6 * Math.sin(u * 2.75 + ph) + 0.4 * Math.sin(u * 6.85 + ph * 1.7);
  const strip = (a: number, e: number, off: number, w: number, pw: number, ph: number, amp: number, rim?: boolean): number[] => {
    const l: number[] = [], r: number[] = [];
    for (let i = a; i <= e; i++) {
      const p = fp[i], [nx, ny, s] = fd[i], u = i / SN;
      const t = pw ? Math.pow(Math.sin((Math.PI * (i - a)) / (e - a)), pw) : 1;
      const c = off + amp * wv(u, ph), hw = w * t * (rim ? s : 1) * (1 + 0.3 * wv(u, ph + 2));
      l.push(p.x + nx * p.r * (c + hw), p.y + ny * p.r * (c + hw));
      r.push(p.x + nx * p.r * (c - hw), p.y + ny * p.r * (c - hw));
    }
    for (let i = r.length - 2; i >= 0; i -= 2) l.push(r[i], r[i + 1]);
    return l;
  };
  const pin = [0];
  for (let i = 1; i < FNn - 1; i++) if (fp[i].r < fp[i - 1].r && fp[i].r < fp[i + 1].r) pin.push(i);
  pin.push(FNn - 1);
  for (let s = 0; s + 1 < pin.length; s++) {
    const a = pin[s], e = pin[s + 1];
    o.push(P(strip(a, e, -0.88, 0.06, 0, 2.4, 0.03, true), Q, { ink: -0.2 }));
    o.push(P(strip(a, e, -0.36, 0.3, 0.8, 1.1, 0.08), QD, { bv: 1.2, ink: -0.5 }));
    o.push(P(strip(a, e, 0.42, 0.32, 0.6, 0.3, 0.08), Q, { bv: 2, ink: -0.02 }));
    o.push(P(strip(a, e, 0.5, 0.12, 1.4, 0.3, 0.08), Q, { ink: 0.54 }));
  }
  // soft wrinkles where it pinches, crowding on its shadowed side; a bead of the
  // vein's light where it swells
  const arc = (a: Pt, c: Pt, e: Pt, r: number, m: string, ink: number): void => { for (let j = 0; j < 2; j++) { const [x0, y0] = qpt(a, c, e, j / 2), [x1, y1] = qpt(a, c, e, (j + 1) / 2); o.push(K(x0, y0, x1, y1, r * (1 - j * 0.3), r * (1 - (j + 1) * 0.3), m, { ink, occ: false })); } };
  for (let i = 1; i < FNn - 1; i++) {
    const p = fp[i], [sx, sy] = fd[i];
    if (p.r < fp[i - 1].r && p.r < fp[i + 1].r) {
      for (const [d, reach] of [[-1.6, 0.1], [0.6, 0.5]]) {
        const ax = p.x + p.ux * d, ay = p.y + p.uy * d, bw = p.r * 0.26;
        const A0: Pt = [ax - sx * p.r * 0.96, ay - sy * p.r * 0.96], A1: Pt = [ax + sx * p.r * reach, ay + sy * p.r * reach], Cc: Pt = [ax - sx * p.r * 0.3 + p.ux * bw, ay - sy * p.r * 0.3 + p.uy * bw];
        arc(A0, Cc, A1, 0.6, QD, -0.3);
      }
    } else if (p.r > fp[i - 1].r && p.r > fp[i + 1].r) {
      o.push(E(p.x + sx * p.r * 0.5, p.y + sy * p.r * 0.5, p.r * 0.26, p.r * 0.13, Q, { a: Math.atan2(p.uy, p.ux), fl: 0.6, ink: 0.56, occ: false }));
    }
  }

  // the sucker turned on you, flaring from the end of it
  const cx = 60, cy = 40 + hy, A = 0.28, ca = Math.cos(A), sa = Math.sin(A);
  const at = (x: number, y: number): Pt => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  const lobe = (th: number): number => 0.1 * Math.sin(3 * th + 0.5) + 0.07 * Math.sin(5 * th + 2.1) + 0.05 * Math.sin(8 * th + 0.3);
  const ring = (rx: number, ry: number, ox: number, oy: number, k: number): number[] => {
    const p: number[] = [];
    for (let i = 0; i < 28; i++) { const th = (i / 28) * Math.PI * 2, w = 1 + lobe(th) * k; p.push(...at(ox + Math.cos(th) * rx * w, oy + Math.sin(th) * ry * w)); }
    return p;
  };
  const LK = 1.1; // how ragged the lip is
  const lipAt = (th: number, r: number): Pt => { const w = 1 + lobe(th) * LK; return at(0.6 + Math.cos(th) * r * w, 0.4 + Math.sin(th) * r * 0.88 * w); };
  o.push(P(ring(20.4, 18.6, -2.6, -2.4, 0.4), Q, { bv: 5, ink: -0.14 })); // the hood, the silver skin flaring behind the lip
  o.push(E(...at(0.6, 0.4), 17.8, 15.8, LP, { a: A, ink: -0.36 })); // the lip's root, in shadow
  // the opening: flesh sinking in rings toward a gullet set deeper, down and back
  const oc: Pt = [0.8, 0.6], gc: Pt = [2.4, 2.6], R0: Pt = [13.8, 12];
  const mid = (q: number): Pt => [gc[0] + (oc[0] - gc[0]) * q, gc[1] + (oc[1] - gc[1]) * q];
  for (const [q, ink] of [[1, -0.5], [0.8, -0.64], [0.6, -0.78], [0.42, -0.9]]) {
    const [ox, oy] = mid(q);
    o.push(P(ring(R0[0] * q, R0[1] * q, ox, oy, 1.2), FN, { ink }));
  }
  // the lip: a ring of swollen lobes of wet flesh, no two alike, rolling over the opening
  for (let i = 0; i < 14; i++) {
    const th = (i / 14) * Math.PI * 2 + 0.2 + (hash2(i, 41) - 0.5) * 0.24, rr = 15.8 + (hash2(i, 43) - 0.5) * 1.6;
    const [x, y] = lipAt(th, rr), [x1, y1] = lipAt(th + 0.05, rr);
    o.push(E(x, y, 5.4 + hash2(i, 45) * 2, 2.6 + hash2(i, 47) * 0.9, LP, { a: Math.atan2(y1 - y, x1 - x), ink: -0.1 + hash2(i, 49) * 0.05, occ: false }));
  }
  // here and there a deep crease between them
  for (const th of [-2.6, -0.9, 0.6, 2.2]) o.push(K(...lipAt(th, 13.6), ...lipAt(th + 0.04, 17.6), 0.6, 0.25, FN, { ink: -0.62, occ: false }));
  // rings of hooked teeth, inner first, each ring turned on from the last and every
  // tooth raked the same way round, so they spiral down into the gullet
  const [gx, gy] = at(gc[0], gc[1]);
  for (const [q, n, Ln, w, ink, rot] of [[0.48, 8, 2.4, 1.6, -0.46, 1.1], [0.7, 11, 3.2, 2.2, -0.28, 0.55], [0.94, 13, 4.2, 2.8, -0.1, 0]]) {
    const [ox, oy] = mid(q);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2 + rot, w0 = 1 + lobe(th) * 1.2;
      const [x, y] = at(ox + Math.cos(th) * R0[0] * q * w0, oy + Math.sin(th) * R0[1] * q * w0);
      let dx = gx - x, dy = gy - y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const tx = -dy, ty = dx, hk = Ln * 0.55;
      o.push(P([x - tx * w * 0.5, y - ty * w * 0.5, x + tx * w * 0.5, y + ty * w * 0.5, x + dx * Ln * 0.55 + tx * w * 0.5, y + dy * Ln * 0.55 + ty * w * 0.5, x + dx * Ln + tx * hk, y + dy * Ln + ty * hk, x + dx * Ln * 0.45 - tx * w * 0.1, y + dy * Ln * 0.45 - ty * w * 0.1],
        TH, { bv: 0.4, ink: ink - hash2(i, 77) * 0.12 }));
    }
  }
  { const [ox, oy] = mid(0.3); o.push(P(ring(R0[0] * 0.3, R0[1] * 0.3, ox, oy, 1.5), MW, { ink: -0.56 })); } // the gullet
  // the wet shine on the lip's lobes where the vein-light catches them, and on the
  // inner wall across from it
  for (const [th, r, k] of [[-3.35, 16.6, 0.4], [-2.85, 16.8, 0.56], [-2.3, 16.4, 0.5], [-1.7, 16.6, 0.3], [-3.85, 16.4, 0.26], [0.3, 14.6, 0.2], [0.85, 14.4, 0.24]]) {
    o.push(K(...lipAt(th, r), ...lipAt(th + 0.14, r), 0.6, 0.4, LP, { ink: k, fl: 0.5, occ: false }));
  }
  // the eye-spots: a loose cluster sunk in the skin behind the hood, dim amber in pits
  for (const [x, y, r, k] of [[36.6, 31.6, 1.2, 0], [39.6, 28.4, 0.9, -0.08], [35.2, 35.4, 0.7, -0.14], [41.4, 33.2, 0.65, -0.16], [33.4, 29.8, 0.6, -0.2]]) {
    o.push(E(x + 0.2, y + 0.2 + hy, r * 1.6, r * 1.3, QD, { ink: -0.3, occ: false }), E(x, y + hy, r, r * 0.8, 'eyeAmber', { ink: -0.36 + k }));
  }
  o.push(X(36.2, 31 + hy, 0.8, 0.8, '#fff4dc', { em: true }));
  // a bead of quicksilver dripping from the lower lip
  const [dx0, dy0] = lipAt(1.75, 18.4);
  o.push(K(dx0, dy0, dx0 - 0.2, dy0 + 2.6 + f * 0.3, 0.7, 0.5, Q, { ink: 0.06 }), E(dx0 - 0.2, dy0 + 3.6 + f * 0.3, 1.2, 1.5, Q, { ink: 0.1 }));
  // light: the quicksilver vein in the rock above
  o.push(Lt(20, 20, 94, '#dfe8f4', 1.15 * gl, 16));
  return o;
}
