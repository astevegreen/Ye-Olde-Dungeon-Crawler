import { E, K, P, X, Lt, T, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9f, group C: the bound spirits. The Captive of the Chariot and the Choke-Damp Phantasm. Conventions: portraitKit.ts. */

/** A chain: alternating links along a polyline (the map's links(), at portrait scale s). */
function links(pts: number[], m: string, s: number, o: PrimOptions = {}): Prim[] {
  const out: Prim[] = [];
  let k = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3];
    const a = Math.atan2(y2 - y1, x2 - x1), n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / (1.25 * s)));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      out.push(k++ % 2 ? E(x, y, 0.95 * s, 0.42 * s, m, { a, ...o }) : E(x, y, 0.85 * s, 0.68 * s, m, { a, fl: 0.35, ...o }));
    }
  }
  return out;
}

/**
 * A tapering ribbon along a quadratic a -> b (control c), as one polygon: a wisp, a tongue of
 * vapour or flame. wob: a sideways wave growing toward the tip (waves along it, phase ph).
 */
function ribbon(a: Pt, c: Pt, b: Pt, w0: number, w1: number, n: number, m: string, o?: PrimOptions, wob = 0, waves = 1, ph = 0): Prim {
  const L: number[] = [], R: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x0, y0, tx, ty] = qpt(a, c, b, t), l = Math.hypot(tx, ty) || 1, w = w0 + (w1 - w0) * t;
    const nx = -ty / l, ny = tx / l, d = wob * t * Math.sin(t * Math.PI * 2 * waves + ph), x = x0 + nx * d, y = y0 + ny * d;
    L.push(x + nx * w, y + ny * w);
    R.unshift(x - nx * w, y - ny * w);
  }
  return P([...L, ...R], m, o);
}

/** A cloud: an ellipse whose edge swells into round lobes (pinched between them). */
function billow(cx: number, cy: number, rx: number, ry: number, lobes: number, amp: number, ph: number, m: string, o?: PrimOptions): Prim {
  const pts: number[] = [], n = Math.max(16, lobes * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + amp * Math.abs(Math.sin((lobes * a) / 2 + ph));
    pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  return P(pts, m, o);
}

// ======================================================== CAPTIVE OF THE CHARIOT
/**
 * A spirit of Sól's light, taken when "iron nets dragged the golden chariot low" (the
 * Siphon's runestone) and staked out in the Siphon to be drained. As on the map: a body of
 * light, the broken sun-wheel behind its head, a black-iron collar, chains crossed over its
 * breast and its arms dragged down to iron stakes. Where the iron bites, its light is burnt
 * to ember: the coven turns the sun's light into the fire it lashes you with.
 */
export function captivePortrait(f: number): PrimTree {
  const b = breath(f);
  const p = [1, 1.06, 1.12, 1.05][f % 4];
  const pi = (p - 1) * 0.6;
  const o: Out = [];
  const BG = 'scr_gCaptive', HA = 'scr_captiveHalo', LI = 'scr_captiveLight', CO = 'scr_captiveCore', RY = 'scr_captiveRay', BU = 'scr_captiveBurn', IR = 'scr_captiveIron', MW = 'scr_captiveMaw';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 44, 62, 60, BG, { fl: 1, ink: BAND[2] }));
  // its light on the dark of the Siphon
  o.push(E(49, 33, 42, 40, HA, { fl: 1, ink: BAND[1] }), E(49, 30, 26, 26, HA, { fl: 1, ink: BAND[2] }));

  // the broken sun-wheel behind its head: rays snapped and missing, the rim cracked
  const wx = 49, wy = 30;
  for (let i = 0; i < 11; i++) {
    if (i === 3 || i === 8) continue;
    const a = Math.PI + 0.12 + (i * (Math.PI - 0.24)) / 10, r0 = 17, r1 = i === 6 ? 23 : i % 2 ? 29 : 35;
    const w = 0.1;
    o.push(P([wx + Math.cos(a - w) * r0, wy + Math.sin(a - w) * r0, wx + Math.cos(a + w) * r0, wy + Math.sin(a + w) * r0, wx + Math.cos(a) * r1, wy + Math.sin(a) * r1], RY, { bv: 1.2, ink: -0.28 + pi }));
  }
  const arc = (a0: number, a1: number, r: number, n: number, rad: number, m: string, op?: PrimOptions): Prim[] => { const out: Prim[] = []; for (let i = 0; i < n; i++) { const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n; out.push(K(wx + Math.cos(t0) * r, wy + Math.sin(t0) * r, wx + Math.cos(t1) * r, wy + Math.sin(t1) * r, rad, rad, m, op)); } return out; };
  o.push(arc(Math.PI - 0.1, Math.PI * 1.38, 16, 5, 1.4, RY, { ink: -0.34 }), arc(Math.PI * 1.5, Math.PI * 2.08, 16, 7, 1.4, RY, { ink: -0.34 }));
  // the iron net that dragged it down, black against its light
  for (let i = 0; i < 6; i++) {
    const x0 = -2 + i * 17;
    o.push(K(x0, -1, x0 + 24, 46, 0.6, 0.6, BG, { ink: BAND[1] - 0.06 }), K(x0 + 14, -1, x0 - 10, 46, 0.6, 0.6, BG, { ink: BAND[1] - 0.06 }));
  }

  const n0 = o.length; // the figure, brought up close
  const by = -b * 0.45;
  const hx = 49, hy = 32 + by;
  // arms dragged down and out to the stakes
  for (const sd of [-1, 1]) {
    const sx = hx + sd * 24, sy = 66 + by, ex = hx + sd * 30, ey = 74, wxx = hx + sd * 34, wyy = 80;
    const ln = Math.hypot(wxx - ex, wyy - ey), dx = (wxx - ex) / ln, dy = (wyy - ey) / ln;
    o.push(ribbon([sx, sy], [ex + sd * 0.4, ey - 0.6], [wxx + dx * 3, wyy + dy * 3], 6.4, 4, 6, LI, { bv: 3, ink: -0.36 + pi }));
    o.push(E(wxx + dx * 6.4, wyy + dy * 6.4, 4, 4.4, LI, { fl: 0.3, ink: -0.5 + pi })); // the fist, clenched
    // the shackle, and the light burnt to ember where it bites
    o.push(K(wxx - dx * 2.6, wyy - dy * 2.6, wxx + dx * 0.4, wyy + dy * 0.4, 5.4, 5.4, BU, { ink: -0.2 + pi }));
    o.push(K(wxx - dx * 1.8, wyy - dy * 1.8, wxx + dx * 1.8, wyy + dy * 1.8, 4.8, 4.8, IR, { ink: -0.04 }));
    o.push(K(wxx - dx * 1.6 - dy * 4, wyy - dy * 1.6 + dx * 4, wxx + dx * 1.6 - dy * 4, wyy + dy * 1.6 + dx * 4, 0.7, 0.7, IR, { ink: 0.2 }));
    // the chain, taut in its fist, dragging the arm down to a stake below
    o.push(links([wxx + dx * 3.4, wyy + dy * 3.4, wxx + sd * 5, 101], IR, 2.3));
  }
  // the body: shoulders and breast of light, brightest at the heart
  o.push(P([hx - 10, 55 + by, hx - 21, 59 + by, hx - 27, 65 + by, hx - 23, 77, hx - 18, 97, hx + 18, 97, hx + 23, 77, hx + 27, 65 + by, hx + 21, 59 + by, hx + 10, 55 + by], LI, { bv: 9, ink: -0.28 + pi }));
  for (const sd of [-1, 1]) {
    o.push(K(hx + sd * 6, 58 + by, hx + sd * 20, 61 + by, 1.3, 1, LI, { ink: -0.04 + pi })); // the collarbone
    o.push(P([hx + sd * 24.4, 70 + by, hx + sd * 16, 76, hx + sd * 13.6, 97, hx + sd * 18, 97, hx + sd * 22.6, 79], LI, { ink: -0.55 + pi })); // the flank, turned from the heart
  }
  o.push(E(hx, 79, 10, 11, LI, { fl: 0.3, ink: 0.06 + pi }));
  // the heart of it, its light leaking out between the chains, ragged
  for (const [a, len, w] of [[-1.72, 10, 3], [-0.62, 7, 2.4], [0.44, 8.6, 2.8], [1.62, 6.6, 2.6], [2.66, 8.2, 2.6]]) {
    const ca = Math.cos(a), sa = Math.sin(a);
    o.push(P([hx - sa * w, 78 + ca * w, hx + sa * w, 78 - ca * w, hx + ca * len, 78 + sa * len], CO, { bv: 1.4, ink: -0.16 + pi }));
  }
  o.push(E(hx, 78, 5, 5.6, CO, { ink: pi }));
  // the chains crossed over its breast, the light burnt to ember where they bite
  o.push(K(hx - 19, 62 + by, hx + 17, 97, 1.95, 1.95, BU, { ink: -0.24 + pi, occ: false }), K(hx + 19, 62 + by, hx - 17, 97, 1.95, 1.95, BU, { ink: -0.24 + pi, occ: false }));
  o.push(links([hx - 19, 62 + by, hx + 17, 97], IR, 2), links([hx + 19, 62 + by, hx - 17, 97], IR, 2));
  // the neck, and the black-iron collar, curved round it
  o.push(K(hx, hy + 12, hx, hy + 24, 6, 7.4, LI, { ink: -0.34 + pi }));
  const col: number[] = [];
  for (let i = 0; i <= 8; i++) { const [x, y] = qpt([hx - 12.6, hy + 19], [hx, hy + 23.6], [hx + 12.6, hy + 19], i / 8); col.push(x, y); }
  for (let i = 8; i >= 0; i--) { const [x, y] = qpt([hx - 13.6, hy + 26.6], [hx, hy + 31.4], [hx + 13.6, hy + 26.6], i / 8); col.push(x, y); }
  o.push(P(col, IR, { bv: 2.8 }));
  o.push(strand(hx - 13.4, hy + 26, hx, hy + 30.6, hx + 13.4, hy + 26, 1.1, 1.1, IR, 6, { ink: -0.18 }));
  for (const t of [0.12, 0.34, 0.66, 0.88]) { const [x, y] = qpt([hx - 13, hy + 22.6], [hx, hy + 27.4], [hx + 13, hy + 22.6], t); o.push(X(x - 0.6, y - 0.6, 1.2, 1.2, IR + ':5')); }
  o.push(K(hx + 2.4, hy + 21, hx + 0.8, hy + 25, 0.5, 0.5, CO, { occ: false }), K(hx + 0.8, hy + 25, hx + 2, hy + 29, 0.5, 0.45, CO, { occ: false })); // the crack in it

  // its hair: the sun's light rising off the crown in wavering tongues, like flame
  for (let i = 0; i < 6; i++) {
    const u = (i + 0.5) / 6, rx0 = hx - 10 + u * 20, ry0 = hy - 6 - Math.sin(u * Math.PI) * 5;
    const tx = rx0 + (u - 0.5) * 14 + 5, ty = hy - 25 - Math.sin(u * Math.PI) * 9 - hash2(i, 13) * 6;
    const cxp = (rx0 + tx) / 2 + (i % 2 ? 3 : -3), cyp = (ry0 + ty) / 2;
    o.push(ribbon([rx0, ry0], [cxp, cyp], [tx, ty], 4.4, 0, 8, LI, { bv: 1.8, ink: -0.2 - Math.abs(u - 0.5) * 0.2 + pi }, 2.4, 1, f * 1.2 + i * 2));
  }
  for (let i = 0; i < 3; i++) { // brighter tongues inside them
    const u = (i + 1) / 4, rx0 = hx - 7 + u * 14, ry0 = hy - 9 - Math.sin(u * Math.PI) * 4;
    o.push(ribbon([rx0, ry0], [rx0 + (i - 1) * 2 + 2, ry0 - 8], [rx0 + (u - 0.5) * 10 + 1, ry0 - 15 - (i === 1 ? 4 : 0)], 2.2, 0, 6, LI, { bv: 1, ink: 0.04 + pi }, 1.6, 1, f * 1.2 + i * 3));
  }
  o.push(E(hx, hy - 7, 12.4, 8.6, LI, { fl: 0.4, ink: -0.06 + pi }));
  // the head: a face of light in wrath, the eyes burnt to embers
  o.push(E(hx, hy - 1.6, 11, 12.6, LI, { fl: 0.3, ink: -0.02 + pi }));
  o.push(P([hx - 10.4, hy - 1, hx - 9.6, hy + 7, hx - 6.2, hy + 13.4, hx - 2, hy + 16.6, hx + 2, hy + 16.6, hx + 6.2, hy + 13.4, hx + 9.6, hy + 7, hx + 10.4, hy - 1], LI, { bv: 3.6, ink: -0.02 + pi }));
  // cut in planes, the key light from the upper left: the far side of the face in shadow
  o.push(P([hx + 4, hy - 9, hx + 9.6, hy - 6, hx + 11, hy, hx + 9.6, hy + 7, hx + 6.2, hy + 13.4, hx + 2.4, hy + 16.4, hx + 4.6, hy + 11, hx + 6.6, hy + 6, hx + 7.4, hy, hx + 6.6, hy - 5], LI, { ink: -0.34 + pi }));
  for (const sd of [-1, 1]) {
    const dk = sd > 0 ? -0.08 : 0;
    o.push(P([hx + sd * 9.6, hy - 1.6, hx + sd * 5, hy - 2.6, hx + sd * 1.4, hy - 0.6, hx + sd * 1.6, hy + 2.8, hx + sd * 4.6, hy + 3.8, hx + sd * 8.6, hy + 2.6], LI, { ink: -0.6 + dk })); // the socket
    o.push(P([hx + sd * 9.4, hy + 6.4, hx + sd * 5.4, hy + 7.4, hx + sd * 3.8, hy + 12, hx + sd * 5.6, hy + 13, hx + sd * 9, hy + 8.8], LI, { ink: -0.52 + dk })); // the hollow under the cheekbone
    o.push(E(hx + sd * 6.6, hy + 5.4, 3.6, 1.4, LI, { fl: 0.4, ink: 0.06 + dk * 2, a: sd * 0.2 })); // cheekbone
    o.push(K(hx + sd * 10, hy - 4.4, hx + sd * 1.6, hy - 0.8, 1.9, 1.5, LI, { ink: 0.12 + dk })); // the brow, knotted down
    // the eye: a narrowed slit burnt dark, an ember in it
    o.push(E(hx + sd * 5, hy + 1.2, 3, 1.05, MW, { a: -sd * 0.22 }));
    o.push(E(hx + sd * 4.7, hy + 1.1, 1, 0.75, BU, { ink: -0.25 }));
  }
  o.push(X(hx - 5.6, hy + 0.5, 0.6, 0.6, '#fff2c8', { em: true }));
  o.push(P([hx - 1, hy - 3, hx + 1, hy - 3, hx + 0.4, hy - 0.4, hx - 0.4, hy - 0.4], LI, { ink: -0.5 })); // the crease between the brows
  // the nose: the bridge lit, its far side and the shadow under it
  o.push(K(hx - 0.2, hy - 0.6, hx - 0.4, hy + 6.4, 1.1, 1.7, LI, { ink: 0.14 }));
  o.push(P([hx + 0.9, hy, hx + 2.6, hy + 6.6, hx + 0.6, hy + 7.4], LI, { ink: -0.5 }));
  o.push(P([hx - 2.4, hy + 7.4, hx + 2.6, hy + 7.4, hx + 1.4, hy + 8.6, hx - 1.4, hy + 8.6], LI, { ink: -0.62 }));
  // the mouth, open on a cry, its corners dragged down
  o.push(P([hx - 3.6, hy + 10.8, hx, hy + 10, hx + 3.6, hy + 10.8, hx + 4.4, hy + 12.6, hx + 2.4, hy + 14, hx, hy + 14.6, hx - 2.4, hy + 14, hx - 4.4, hy + 12.6], MW));
  o.push(E(hx, hy + 13.6, 1.8, 0.8, BU, { ink: -0.45 })); // the fire welling in its throat
  o.push(P([hx - 2.6, hy + 15, hx + 2.6, hy + 15, hx + 1.6, hy + 16, hx - 1.6, hy + 16], LI, { ink: -0.5 })); // under the lip
  o.push(E(hx - 0.4, hy + 16.4, 2.2, 0.8, LI, { fl: 0.4, ink: 0.04 })); // the chin

  // sparks of its light rising
  for (let i = 0; i < 8; i++) {
    const y = (hash2(i, 31) * 70 + f * 2.6 * (1 + (i % 2))) % 70, x = 10 + hash2(i, 37) * 76;
    o.push(X(x, 74 - y, 0.9, 0.9, i % 3 ? RY + ':4' : CO + ':5', { em: true }));
  }
  o.push(Lt(hx, 74, 64, '#ffe0a0', 0.9 * p, 10));
  o.push(...T(o.splice(n0), { px: 49, py: 34, s: 1.07 }));
  return o;
}

// ======================================================= CHOKE-DAMP PHANTASM
/**
 * Choke-damp: the dead air of a mine that smothers a crew, and that a miner read in his
 * lamp's flame, which sinks and dies in it. This is that gas, wearing the face of its last
 * victim: a gaunt skull of vapour with its jaw hung open on his last gasp, poison-green
 * points deep in the sockets, streaming wisps; the dead man's lamp still hangs from its
 * hand, a coil of the damp round the glass, the flame guttering. The lamp lights its face
 * from below; the damp lies pooled on the floor of the drift.
 */
export function chokeDampPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.86, 1.08, 0.78][f % 4];
  const o: Out = [];
  const BG = 'scr_gChokeDamp', PO = 'scr_chokeDampPool', GA = 'scr_chokeDampGas', GD = 'scr_chokeDampGasDeep', GF = 'scr_chokeDampGasFaint', GL = 'scr_chokeDampGasLight', HO = 'scr_chokeDampHole';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(46, 44, 60, 56, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(72, 70, 28, 26, BG, { fl: 1, ink: BAND[3] })); // the lamp's pool of light
  // the drift: a timber set, two props and a cap, black against it
  o.push(P([3, -1, 11, -1, 12, 97, 2, 97], BG, { ink: BAND[1] - 0.06 }), P([84, -1, 92, -1, 94, 97, 84, 97], BG, { ink: BAND[1] - 0.06 }));
  o.push(P([-1, 2, 97, 0, 97, 9, -1, 11], BG, { ink: BAND[1] - 0.06 }));
  // the damp, pooled heavy on the floor
  const ph = (f % 4) * 0.4;
  for (const [yb, A, lam, p0, ink, seed] of [[92, 5, 26, 4, -0.7, 3], [97, 3.4, 18, 13, -0.62, 5]]) {
    const pts: number[] = [];
    for (let i = 0; i <= 52; i++) {
      const x = -4 + i * 2, u = (x - p0 - ph) / lam, k = Math.floor(u + 0.5);
      pts.push(x, yb - A * (0.6 + 0.5 * hash2(k, seed)) * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * u), 1.4));
    }
    o.push(P([...pts, 101, 99, -4, 99], PO, { ink }));
  }

  const by = -b * 0.4;
  const hx = 42, hy = 30 + by;
  // the damp streaming back off the skull in flat, wavering tongues, fading into the dark
  const streams: Array<[number, number, number, number, number, number, number, string, number]> = [[-6, -12, -18, -22, -34, -23, 4.6, GF, 0], [-12, 12, -26, 20, -40, 18, 4.4, GF, 2], [-10, -5, -24, -8, -42, -8, 6, GD, 1], [-12, 4, -28, 6, -44, 3, 5.4, GD, 3]];
  for (const [x0, y0, x1, y1, x2, y2, w, m, ph] of streams) {
    o.push(ribbon([hx + x0, hy + y0], [hx + x1, hy + y1], [hx + x2, hy + y2], w, 0, 9, m, { ink: 0.02 }, 3, 1, ph + f * 0.5));
  }
  // the body: flat billows of gas slumping down to the left, the tail curling into the pool
  o.push(ribbon([hx - 12, hy + 48], [hx - 34, hy + 58], [hx - 24, 99], 7, 1.2, 9, GD, { ink: -0.04 }, 2.4, 1, f * 0.5));
  o.push(billow(hx - 9, hy + 42, 15, 12.6, 7, 0.14, 0.3, GD, { ink: 0.02 }));
  o.push(billow(hx - 9, hy + 37, 11, 8.6, 6, 0.16, 1.1, GA, { ink: 0 }));
  o.push(billow(hx - 13, hy + 33, 5.4, 3.6, 4, 0.2, 0.4, GA, { ink: 0.22 })); // its lit crest
  // the arm reaching out to the right, the lamp hanging from the wisp-hand
  const lx = 74 + s * 0.3, ly = 68;
  o.push(ribbon([hx + 8, hy + 32], [hx + 22, hy + 20], [lx - 1, ly - 11], 5.4, 2, 6, GA, { bv: 3, ink: -0.04 }));
  // the lamp: bronze cap and bail, the glass, iron bars, bronze base
  o.push(K(lx - 1, ly - 10.4, lx, ly - 6, 0.55, 0.55, 'blackIron'));
  o.push(E(lx, ly - 5.4, 2.4, 1.6, 'bronze'), E(lx, ly - 3.8, 4.4, 1.8, 'bronze'));
  o.push(K(lx, ly - 2.4, lx, ly + 4.8, 3.6, 3.6, 'scr_chokeDampGlass', { ink: -0.16 + (fl - 1) * 0.6 }));
  o.push(E(lx, ly + 2.4, 1.2, 2 * fl, 'scr_chokeDampFlame', { ink: (fl - 1) * 0.6 }));
  o.push(K(lx - 3.9, ly - 2.6, lx - 3.9, ly + 5.4, 0.6, 0.6, 'blackIron'), K(lx + 3.9, ly - 2.6, lx + 3.9, ly + 5.4, 0.6, 0.6, 'blackIron'));
  o.push(E(lx, ly + 6.6, 4.6, 1.8, 'bronze'));
  // the fingers of gas curled over the bail
  for (const [x0, y0, x1, y1, x2, y2, r] of [[-6, -13, -1.6, -15.6, 1.8, -11.4, 1.7], [-5.4, -10, -1, -12.6, 2.4, -8.6, 1.4]]) {
    o.push(strand(lx + x0, ly + y0, lx + x1, ly + y1, lx + x2, ly + y2, r, 0.8, GA, 3, { ink: -0.12 }));
  }
  // a coil of the damp round the glass, smothering the flame
  o.push(strand(lx - 5.6, ly + 3.6, lx, ly + 0.6, lx + 5.6, ly + 4.6, 1.3, 0.6, GA, 4, { ink: -0.06 }));

  // the skull of gas: the cranium, the face long and gaunt
  o.push(billow(hx - 4, hy - 1.4, 14, 12.8, 7, 0.12, 0.6, GA, { ink: 0.02 })); // the back of it, coming apart
  o.push(billow(hx + 1, hy - 1.4, 13.6, 12.8, 7, 0.1, 0.9, GA, { ink: 0.02 })); // the crown, its edge smoking
  o.push(billow(hx - 3.4, hy - 3.6, 6.4, 5.4, 5, 0.12, 0.2, GA, { ink: 0.19 })); // lit from above, left
  o.push(billow(hx + 10.4, hy + 1, 3.6, 8.4, 4, 0.1, 0.6, GA, { ink: -0.2 })); // the far temple, in shadow
  o.push(P([hx - 13, hy + 2, hx - 11, hy + 12, hx - 7, hy + 20, hx - 3, hy + 28, hx + 3, hy + 33, hx + 9, hy + 30, hx + 12, hy + 20, hx + 14, hy + 10, hx + 15, hy + 2], GA, { bv: 4 }));
  o.push(E(hx - 12, hy + 2, 3.4, 6.4, GA, { fl: 0.6, ink: -0.24 })); // sunken temple
  o.push(E(hx - 6, hy + 17, 4, 5, GA, { fl: 0.6, ink: -0.24 }), E(hx + 10.6, hy + 16, 2.4, 5, GA, { fl: 0.6, ink: -0.24 })); // hollow cheeks
  // the brows arched over the sockets
  o.push(strand(hx - 10.4, hy + 1.4, hx - 5, hy - 3.2, hx - 0.6, hy + 0.6, 1.5, 1.1, GA, 4, { ink: 0.12 }));
  o.push(strand(hx + 2.4, hy + 0.4, hx + 7.4, hy - 2.8, hx + 12.4, hy + 0.6, 1.2, 1, GA, 4, { ink: 0.06 }));
  // the sockets, slanted, deep; a green point in each
  o.push(E(hx - 4.6, hy + 4.8, 4.2, 5.2, HO, { a: 0.3 }), E(hx + 7.2, hy + 4.4, 3.4, 4.6, HO, { a: -0.3 }));
  o.push(X(hx - 5, hy + 4.6, 1.3, 1.3, 'emPoison:4', { em: true }), X(hx + 6.6, hy + 4.4, 1.1, 1.1, 'emPoison:4', { em: true }));
  o.push(K(hx - 11, hy + 11, hx - 5, hy + 13, 1.1, 0.7, GL, { ink: -0.15 }), K(hx + 9, hy + 12, hx + 13, hy + 9.6, 0.9, 0.6, GL, { ink: -0.2 })); // cheekbones
  o.push(P([hx + 1, hy + 10, hx + 3.6, hy + 15, hx + 0.4, hy + 15.4], HO)); // the nose, gone
  // the jaw hung open on the last gasp
  o.push(E(hx + 2.4, hy + 23.6, 4.6, 7.6, HO));
  for (let i = 0; i < 5; i++) o.push(E(hx - 0.8 + i * 1.6, hy + 17.6 + Math.abs(i - 2) * 0.3, 0.62, 1.2 - Math.abs(i - 2) * 0.1, GL, { ink: -0.1 - i * 0.04 })); // the upper teeth
  for (const x of [0.2, 4.4]) o.push(E(hx + x, hy + 29.6, 0.6, 1, GL, { ink: -0.22 })); // two left in the dropped jaw
  o.push(strand(hx - 4, hy + 26, hx + 1, hy + 33, hx + 8, hy + 28, 1.4, 1.2, GA, 4, { ink: 0.06 }));
  // the dead man's beard, drifting off the jaw into the body of the gas
  for (const [x0, y0, x1, y1, x2, y2, w, ink] of [[-2, 30, -6, 40, -14, 44, 4, -0.02], [3, 32, 0, 42, -6, 48, 3.4, -0.08], [7, 29, 8, 38, 3, 44, 2.6, -0.14]]) {
    o.push(ribbon([hx + x0, hy + y0], [hx + x1, hy + y1], [hx + x2, hy + y2], w, 0, 7, GA, { ink: ink + 0.04 }, 1.6, 1, f * 0.5 + x0));
  }

  // the lamp's light from below, the eyes' faint green
  o.push(Lt(lx, ly + 1, 70, '#f0b860', 0.95 * fl, 10));
  o.push(Lt(hx + 1, hy + 4.6, 9, '#95dc4c', 0.35, 3));
  return o;
}
