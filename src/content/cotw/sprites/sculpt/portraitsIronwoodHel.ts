import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, ground, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9b, group D: Iviðja, the Ironwood Troll-Wife and the Hel Warden. Conventions: portraitKit.ts. */

/** Points along a wavering thread from a to b: n segments, amplitude amp (fading toward b), phase ph. */
function thread(a: Pt, b: Pt, n: number, amp: number, turns: number, ph: number): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.sin(t * turns * Math.PI * 2 + ph) * amp * (1 - t * 0.85);
    out.push([a[0] + dx * t + nx * w, a[1] + dy * t + ny * w]);
  }
  return out;
}

/**
 * The Ironwood troll-witch under the antler-crowned mask, Algiz cut in its frowning brow, blue light
 * in the eye-holes. Her root-bound claw is raised in a binding, and the roots of the Ironwood rise to it.
 */
export function ividjaPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.12, 0.9, 1.05][f % 4];
  const rc = [0, 0.6, 1, 0.4][f % 4]; // the roots creep
  const o: Out = [];
  const BI = 'scr_gIvidja';
  o.push(ground(BI, 52, 40, 74, 66));
  // the Ironwood: black trunks standing in the murk
  for (const [a0, a1, c0, c1] of [[-2, 7, -2, 11], [19, 23, 21, 26], [67, 71, 70, 75], [86, 93, 89, 98]]) o.push(P([a0, -1, a1, -1, c1, 97, c0, 97], BI, { ink: BAND[1] }));
  o.push(K(22, 36, 31, 28, 1.3, 0.6, BI, { ink: BAND[1] }), K(70, 26, 62, 17, 1.3, 0.5, BI, { ink: BAND[1] }), K(6, 54, 14, 47, 1.4, 0.5, BI, { ink: BAND[1] }));

  const by = -b * 0.5;
  const hx = 47, hy = 41 + by;
  // long grey hair behind the mask, lank, falling over the shoulders
  o.push(P([hx - 11, hy - 12, hx + 9, hy - 12, hx + 14, hy + 2, hx + 19, hy + 26, hx - 21, hy + 28, hx - 15, hy + 2], 'hairGrey', { ink: -0.56 }));
  for (let i = 0; i < 11; i++) {
    const sd = i < 6 ? -1 : 1, j = i < 6 ? i : i - 6;
    const x = hx + sd * (9 + j * 1.6), y0 = hy - 6 + j * 2.4, len = 22 + hash2(i, 63) * 12;
    o.push(strand(x, y0, x + sd * (2 + j * 0.6), y0 + len * 0.5, x + sd * (3 + j * 1.2 + hash2(i, 61) * 2) + s * 0.4, y0 + len, 1.1, 0.3, 'hairGrey', 3, { ink: -0.14 - hash2(i, 65) * 0.26 }));
  }
  // the bark cloak; a mantle of moss over the shoulders, ragged, hanging in strands
  o.push(
    P([-2, 97, -2, 86, 10, 75, 28, 69, 47, 67 + by, 66, 69, 82, 75, 98, 86, 98, 97], 'bark', { bv: 5, n: [0, -0.1, 1], ink: -0.2 }),
    P([-2, 82, 10, 71, 28, 65.4, 47, 63.6 + by, 66, 65.4, 82, 71, 98, 81, 98, 84, 93, 82.8, 88, 88.4, 84, 83.4, 79, 86.6, 72, 82.4, 66, 90.6, 62, 85.6, 55, 88.4, 49, 85.2, 44, 91.6, 39, 86.8, 33, 88.2, 27, 83.6, 17, 89.6, 13, 84.2, 7, 86.6, 3, 83.4, -2, 85.4], 'scr_ironwoodMossDark', { bv: 3.4, ink: -0.1 }),
  );
  for (const [x, y, len] of [[17, 89, 5], [44, 91, 3.6], [66, 90, 4.4], [88, 88, 3]]) o.push(strand(x, y, x + s * 0.3, y + len * 0.5, x + 0.6 + s * 0.6, y + len, 1.2, 0.35, 'scr_ironwoodMossDark', 2, { ink: -0.16 }));
  for (const [x, y, rx, ry, a] of [[16, 73.6, 5.4, 2.4, -0.5], [29, 68.4, 4.2, 2, -0.25], [72, 70.4, 4.6, 2.1, 0.35], [84, 76.6, 4, 2, 0.55]]) o.push(E(x, y + by * 0.5, rx, ry, 'scr_ironwoodMoss', { fl: 0.5, a, ink: -0.14 })); // tufts on the shoulder
  // a ruff of bark slabs standing up out of it round her neck
  for (let i = -3; i <= 3; i++) {
    const hh = hash2(i + 4, 73), x0 = hx + i * 5.6, x1 = hx + i * 10.4 + (hh - 0.5) * 3, yt = 50 + Math.abs(i) * 2.6 + hash2(i + 4, 71) * 5 + by, w = 3.4 - Math.abs(i) * 0.2;
    o.push(P([x0 - w, 72 + by, x0 + w, 72 + by, x1 + w * 0.55, yt + 3 + hh * 2, x1 + (hh - 0.5) * 2.4, yt - 1.6, x1 - w * 0.6, yt + 1.6 + (1 - hh) * 2], 'bark', { bv: 1.6, ink: -0.06 - Math.abs(i) * 0.05 }));
  }

  // the antlers: petrified stag-tines spreading across the dark
  const antler = (A: Pt, C: Pt, B: Pt, tines: number[][], r0: number): Out => {
    const out: Out = [strand(A[0], A[1], C[0], C[1], B[0], B[1], r0, r0 * 0.4, 'scr_ividjaAntler', 6)];
    for (const [t, dx, dy, cx, cy] of tines) {
      const [x, y] = qpt(A, C, B, t);
      out.push(
        strand(x, y, x + cx, y + cy, x + dx, y + dy, r0 * (1 - t * 0.55) * 0.75, 0.45, 'scr_ividjaAntler', 3),
        E(x, y, r0 * (1 - t * 0.5) * 0.95, r0 * (1 - t * 0.5) * 0.85, 'scr_ividjaAntler', { ink: -0.06 }), // a knot where it forks
      );
    }
    out.push(E(A[0], A[1], r0 * 1.35, r0 * 1.15, 'scr_ividjaAntler', { ink: -0.14 })); // the burr
    return out;
  };
  o.push(
    antler([hx - 7, hy - 12], [hx - 21, hy - 15], [hx - 42, hy - 31], [[0.16, -3, -11, -1, -6], [0.42, -1, -15, 1, -8], [0.66, -3, -14, 0, -8], [0.86, -5, -9, -2, -6]], 3),
    antler([hx + 6, hy - 12], [hx + 19, hy - 16], [hx + 39, hy - 31], [[0.18, 3, -10, 1, -6], [0.45, 1, -14, -1, -8], [0.68, 3, -13, 0, -7], [0.88, 5, -8, 2, -5]], 2.6),
  );

  // the mask: the relic's own lines, turned a little to the right
  const mp = (x: number, y: number): Pt => [hx + (x - 16) * (x < 16 ? 2.05 : 1.6), hy + (y - 16) * 1.95];
  const MP = (pts: number[], m: string, op?: PrimOptions): Prim => { const q: number[] = []; for (let i = 0; i < pts.length; i += 2) q.push(...mp(pts[i], pts[i + 1])); return P(q, m, op); };
  const MK = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, op?: PrimOptions): Prim => { const a = mp(x1, y1), c = mp(x2, y2); return K(a[0], a[1], c[0], c[1], r1, r2, m, op); };
  const MS = 'scr_ividjaMask', groove = { ink: -0.4, occ: false };
  o.push(MP([12, 10.0, 16, 9.6, 20, 10.0, 21.6, 11.6, 22.0, 14.6, 21.0, 17.6, 18.6, 21.8, 16, 25.6, 13.4, 21.8, 11.0, 17.6, 10.0, 14.6, 10.4, 11.6], MS, { bv: 3.2 }));
  // the cheekbones, high and hard
  { const [a, c] = mp(12.2, 17.0); o.push(E(a, c, 3.6, 2, MS, { fl: 0.4, ink: 0.06, a: -0.5 })); }
  { const [a, c] = mp(19.8, 17.0); o.push(E(a, c, 2.6, 1.8, MS, { fl: 0.4, ink: -0.04, a: 0.5 })); }
  // a carved brow that frowns down to the nose
  o.push(MK(10.7, 12.4, 15.5, 14.1, 1.4, 1.1, MS, { ink: 0.1 }), MK(21.3, 12.2, 16.5, 14.1, 1.2, 1.1, MS, { ink: 0.02 }));
  for (const sd of [1, -1]) {
    const x = (v: number): number => (sd > 0 ? v : 32 - v);
    o.push(
      MP([x(11.3), 14.0, x(15.1), 15.1, x(14.6), 16.5, x(12.0), 15.9], 'scr_gum'), // eye-holes, slanted
      MK(x(12.2), 17.8, x(13.6), 21.2, 0.55, 0.45, MS, groove), // cheek groove
    );
  }
  o.push(MK(16, 14.6, 16, 19.6, 1, 1.5, MS, { ink: 0.12, occ: false })); // nose ridge
  { const [a, c] = mp(15, 19.7); o.push(X(a, c, 1.2, 0.8, '#141018')); const [d, e] = mp(16.4, 19.7); o.push(X(d, e, 1, 0.8, '#141018')); }
  o.push(
    MP([13.6, 21.9, 18.4, 21.9, 18.0, 22.5, 14.0, 22.5], 'scr_gum'), // a grim cut slot of a mouth
    MK(14.2, 23.2, 17.8, 23.2, 0.5, 0.5, MS, { ink: -0.2, occ: false }), // its lower lip, carved
  );
  // Algiz, the elk-sedge, cut in the brow
  const RN = 'scr_hornRoot', rune = { occ: false };
  o.push(MK(16, 13.0, 16, 10.0, 0.6, 0.55, RN, rune), MK(16, 11.8, 14.5, 10.2, 0.55, 0.45, RN, rune), MK(16, 11.8, 17.5, 10.2, 0.55, 0.45, RN, rune));
  // moss at the temple, bark tied at the jaw
  { const [a, c] = mp(21.2, 11.2); o.push(E(a, c, 3.2, 2.2, 'scr_ironwoodMoss'), E(a - 1.4, c + 1.8, 1.8, 1.4, 'scr_ironwoodMoss')); }
  o.push(MK(10.4, 15.2, 10.0, 20.4, 1.1, 0.8, 'bark'), MK(10.0, 20.4, 11.6, 22.6, 0.8, 0.6, 'bark'));
  // the binding gaze: a slit of blue light deep in each eye-hole
  for (const sd of [1, -1]) {
    const [a, c] = mp(sd > 0 ? 13.8 : 18.2, 15.4);
    o.push(
      E(a, c, sd > 0 ? 1.7 : 1.3, 0.75, 'emArcane', { a: sd * 0.22, ink: (p - 1) * 0.6 }),
      X(a - 0.4, c - 0.4, 0.8, 0.7, '#e4f0ff', { em: true }),
      Lt(a, c, 7, '#6aa6ff', 0.55 * p, 3),
    );
  }

  // grasping roots, rising from the dark at her call
  o.push(
    strand(6, 99, 2, 80, 12 + rc, 70, 3.6, 1.8, 'scr_root', 5),
    strand(12 + rc, 70, 21 + rc, 63, 18 + rc * 1.4, 58, 1.8, 0.5, 'scr_root', 4),
    K(4, 84, -2, 78, 1.4, 0.4, 'scr_root'), K(10, 74, 6, 66 + rc, 1.1, 0.3, 'scr_root'),
    strand(26, 99, 36, 92, 33 - rc, 82, 2.8, 0.6, 'scr_root', 5),
  );
  for (const [x, y] of [[4.6, 88], [15.6, 66], [33, 90]]) o.push(X(x, y, 0.8, 0.8, 'emArcane:4', { em: true }));

  // the raised claw: a long troll arm, roots coiled round it, light between the fingers
  o.push(K(98, 99, 88, 84, 8.5, 6.5, 'bark', { ink: -0.14 })); // the cloak's sleeve
  const w0 = [89, 87], w1 = [80, 65];
  // a root coiled round the arm: the turns behind it go down first, the turns in front after
  const ax = w1[0] - w0[0], ay = w1[1] - w0[1], al = Math.hypot(ax, ay), nx = -ay / al, ny = ax / al;
  const front: Prim[] = [], back: Prim[] = [];
  let q: [number, number, number, number] | null = null;
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * 0.86, th = t * 2.3 * Math.PI * 2 + 0.6 + rc * 0.25, r = (4.2 - t) * 1.1, w = Math.cos(th);
    const pt: [number, number, number] = [w0[0] + ax * t + nx * r * w, w0[1] + ay * t + ny * r * w, Math.sin(th)], rr = 1.15 - t * 0.5 + hash2(i, 81) * 0.25;
    if (q) (q[2] + pt[2] > 0 ? front : back).push(K(q[0], q[1], pt[0], pt[1], q[3], rr, 'scr_root', { ink: q[2] + pt[2] > 0 ? 0 : -0.2 }));
    q = [pt[0], pt[1], pt[2], rr];
  }
  o.push(
    ...back, K(w0[0], w0[1], w1[0], w1[1], 4.2, 3.2, 'scr_ividjaSkin', { ink: -0.06 }), ...front,
    strand(w1[0] + 3, w1[1] + 1, w1[0] + 7, w1[1] - 5, w1[0] + 10, w1[1] - 8 + rc, 0.8, 0.25, 'scr_root', 3), // a tendril curling off
    E(78.6, 60, 4.4, 5.4, 'scr_ividjaSkin', { a: -0.15 }),
  );
  const fingers = [
    [75, 56, 71.5, 49, 69, 43.5, 70.6, 38.6], [78, 55, 77.2, 47, 76, 40.4, 78, 36.2],
    [81, 56, 84, 49.4, 86.6, 44, 86.6, 39.6], [83, 59, 88, 55.6, 91, 51, 90.6, 47.4], [75, 63, 70.4, 61, 67.4, 57.4, 68.6, 54],
  ];
  fingers.forEach(([x0, y0, x1, y1, x2, y2, x3, y3], i) => {
    o.push(
      K(x0, y0, x1, y1, 1.5, 1.3, 'scr_ividjaSkin'), K(x1, y1, x2, y2, 1.3, 1, 'scr_ividjaSkin'),
      E(x1, y1, 1.65, 1.5, 'scr_ividjaSkin', { ink: 0.04 }), E(x2, y2, 1.2, 1.1, 'scr_ividjaSkin', { ink: 0.02 }), // knuckles
      K(x2, y2, x3, y3, 0.85, 0.2, 'scr_hornRoot'), // the claw, hooked
    );
    const sp = 0.55 + ((i + f) % 3) * 0.2;
    o.push(E(x3 + (x3 - x2) * 0.4, y3 + (y3 - y2) * 0.4, sp, sp, 'emArcane'));
  });
  // the gathering light, and sparks turning in it
  const cx = 78.4, cy = 44.5;
  o.push(E(cx, cy, 2.5 * p, 2.5 * p, 'emArcane', { ink: -0.1 }), E(cx, cy, 1.1, 1.1, 'emArcane', { ink: 0.35 }));
  for (let i = 0; i < 3; i++) {
    const a = (f * Math.PI) / 2 + (i * Math.PI * 2) / 3;
    o.push(X(cx + Math.cos(a) * 8 - 0.5, cy + Math.sin(a) * 4.6 - 0.5, 1, 1, i ? '#9cc4ff' : '#e4f0ff', { em: true }));
  }
  o.push(Lt(cx, cy - 2, 46, '#6aa6ff', 0.66 * p, 16));
  return o;
}

/**
 * A hunched, unmasked crone of the coven: hooked nose, amber eyes, black boughs through her iron-grey
 * hair. A thread of blood climbs into the ball in her claw and lights her red from below.
 */
export function trollWifePortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.1, 0.92, 1.04][f % 4];
  const o: Out = [];
  const BT = 'scr_gTrollWife', HT = 'scr_haloTrollWife', SK = 'scr_trollWifeSkin', HR = 'scr_trollWifeHair';
  const bx = 65, bly = 71; // the ball of blood
  o.push(
    P(FULL, BT, { ink: BAND[1] }),
    // obsidian pillars of the siphon chamber, faceted
    P([0, -1, 14, -1, 16, 36, 10, 97, 0, 97], BT, { ink: BAND[2] }), P([7, -1, 14, -1, 16, 36, 11, 28], BT, { ink: BAND[3] }),
    P([72, -1, 94, -1, 92, 28, 86, 34, 76, 26], BT, { ink: BAND[2] }), P([86, -1, 94, -1, 92, 28, 86, 34], BT, { ink: BAND[3] }),
    // the blood's halo
    E(bx, bly, 27, 25, HT, { fl: 1, ink: BAND[1] }), E(bx, bly, 14, 13, HT, { fl: 1, ink: BAND[2] }),
  );

  const by = -b * 0.5;
  // the far shoulder, low; the hunched back rising high at the left
  o.push(
    E(86, 97, 20, 12, 'scr_trollWifeDress', { ink: -0.5 }),
    P([-2, 97, -2, 62, 6, 50, 18, 42 + by, 30, 44 + by, 38, 54, 44, 72, 50, 97], 'scr_trollWifeDress', { bv: 4, ink: -0.06 }),
    E(15, 53 + by, 16, 8.6, 'scr_ironwoodMossDark', { fl: 0.35, a: -0.45 }),
  );
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 6.6 + hash2(i, 51) * 2, y = 60 + by - i * 2.4 + i * i * 0.5, len = 4 + hash2(i, 53) * 5;
    o.push(strand(x, y, x - 0.5 + s * 0.3, y + len * 0.5, x + s * 0.5, y + len, 1.3, 0.4, 'scr_ironwoodMossDark', 3, { ink: -0.06 }));
  }
  // wild iron-grey hair behind the head, a knot of it pierced by black boughs
  const hx = 50, hy = 43 + by;
  o.push(
    P([hx - 2, hy - 20, hx - 16, hy - 18, hx - 26, hy - 9, hx - 32 + s * 0.3, hy + 8, hx - 30, hy + 22, hx - 20, hy + 20, hx - 12, hy + 14, hx + 14, hy - 4, hx + 10, hy - 16], HR, { bv: 0.8, ink: -0.52 }),
    strand(hx - 5, hy - 12, hx - 15, hy - 22, hx - 30, hy - 27, 1.5, 0.5, 'scr_hornRoot', 4), K(hx - 19, hy - 24, hx - 21, hy - 31, 0.7, 0.3, 'scr_hornRoot'),
    strand(hx - 8, hy - 6, hx - 20, hy - 10, hx - 31, hy - 9, 1.3, 0.45, 'scr_hornRoot', 3),
  );
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[-6, -18, -18, -14, -26, 0, -0.16], [-9, -15, -21, -8, -28, 9, -0.3], [-12, -10, -22, 0, -26, 15, -0.2], [-14, -4, -21, 6, -21, 19, -0.36], [-17, -12, -26, -6, -31, 10, -0.26]]) {
    o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2 + s * 0.3, hy + y2, 1, 0.3, HR, 3, { ink })); // strands over the mass
  }
  o.push(
    E(hx - 14, hy - 13, 6.4, 5.4, HR, { ink: -0.14 }), // the knot
    K(hx - 9, hy - 10, hx - 13, hy - 12, 1.3, 1.2, 'scr_hornRoot'), K(hx - 11, hy - 7, hx - 15, hy - 8, 1.2, 1.1, 'scr_hornRoot'), // where they pierce it
  );
  const locks = [[-4, -16, -16, -20, -30, -14, -0.12], [-8, -12, -22, -12, -33, 2, -0.2], [-10, -6, -22, -2, -29, 16, -0.26], [-12, 0, -20, 8, -24, 22, -0.32], [-2, -18, -10, -26, -20, -27, -0.1]];
  for (const [x0, y0, x1, y1, x2, y2, ink] of locks) o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2 + s * 0.4, hy + y2, 1.5, 0.35, HR, 4, { ink }));
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[8, -14, 13, -4, 13.6, 12, -0.34], [11, -11, 16, 1, 15.4, 19, -0.42]]) o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2 + s * 0.4, hy + y2, 1.5, 0.35, HR, 4, { ink })); // the far side, behind the face

  // the head, thrust forward: a long troll ear, the skull, a face of hollows
  o.push(
    K(hx - 10, hy - 2, hx - 22, hy - 10, 2.6, 0.5, SK, { ink: -0.08 }), K(hx - 11, hy - 2.6, hx - 18.6, hy - 7.6, 0.8, 0.3, SK, { ink: -0.4, occ: false }),
    E(hx - 1, hy - 5, 11.5, 11, SK, { fl: 0.15, ink: -0.04 }),
    E(hx + 1.6, hy + 5, 9.2, 10, SK, { fl: 0.2 }),
    // the long jaw, its chin jutting up toward the nose
    P([hx - 8.6, hy + 7, hx - 7, hy + 16, hx - 3, hy + 21.6, hx + 2.6, hy + 24.2, hx + 7.4, hy + 23.2, hx + 9.6, hy + 19.6, hx + 8.4, hy + 15, hx + 9.4, hy + 8], SK, { bv: 3 }),
    E(hx - 5.4, hy + 9.6, 3.8, 4.6, SK, { fl: 0.7, ink: -0.24 }), // hollow cheek
    E(hx + 9, hy + 6.4, 2.4, 4.4, SK, { fl: 0.6, ink: -0.22 }), // far cheek, turned away
    E(hx - 4.8, hy + 4, 4.4, 2.3, SK, { fl: 0.5, ink: 0.08, a: -0.2 }), // cheekbone
    // the brow, scowling down to the nose
    K(hx - 10, hy - 6.6, hx + 1.4, hy - 2.6, 2.6, 2, SK, { ink: 0.06 }), K(hx + 3, hy - 2.6, hx + 11, hy - 6.4, 2, 1.5, SK, { ink: 0 }),
  );
  // small deep eyes, amber, on you
  for (const [ex, ey, rx, ry] of [[hx - 4.2, hy - 1.6, 3.2, 2.2], [hx + 7.2, hy - 1.8, 2.4, 1.9]]) {
    o.push(
      E(ex, ey, rx, ry, SK, { fl: 0.85, ink: -0.55 }),
      E(ex + 0.3, ey + 0.2, rx * 0.5, ry * 0.55, 'eyeAmber', { ink: -0.1 }),
      X(ex - 0.2, ey - 0.3, 0.8, 0.9, '#120c0a'),
    );
  }
  o.push(
    X(hx - 3.4, hy - 2.4, 0.6, 0.6, '#fff2c8', { em: true }),
    K(hx - 9, hy + 0.2, hx - 11.4, hy - 1, 0.35, 0.35, SK, { ink: -0.35, occ: false }), K(hx - 8.8, hy + 1.2, hx - 11, hy + 1.6, 0.35, 0.35, SK, { ink: -0.35, occ: false }), // crow's feet
    // the mouth, wide and thin, open on the chant; a tusk over the lip
    P([hx - 4.6, hy + 15, hx + 1, hy + 16, hx + 7, hy + 14.8, hx + 6, hy + 17.4, hx + 0.6, hy + 18.4, hx - 3.6, hy + 17.4], 'scr_gum'),
    K(hx - 4.6, hy + 15, hx + 7, hy + 14.8, 0.6, 0.5, SK, { ink: -0.06 }),
    P([hx - 3.2, hy + 18.2, hx - 1.4, hy + 18.2, hx - 2.6, hy + 13.4], 'scr_fang', { bv: 0.4 }), P([hx + 3.6, hy + 18, hx + 4.8, hy + 18, hx + 4.2, hy + 15.8], 'scr_fang', { bv: 0.3, ink: -0.1 }),
    K(hx - 7, hy + 10.4, hx - 5, hy + 15.4, 0.4, 0.4, SK, { ink: -0.32, occ: false }), // the fold from nose to mouth
    // the long hooked beak of a nose, reaching out over the mouth toward the blood
    P([hx + 0.2, hy - 2, hx + 3.6, hy - 0.4, hx + 8.6, hy + 3.4, hx + 13.6, hy + 7.4, hx + 17, hy + 10.6, hx + 17.2, hy + 13, hx + 15.4, hy + 14.2, hx + 11.6, hy + 12.4, hx + 7, hy + 11.8, hx + 4.4, hy + 12.8, hx + 1.4, hy + 11.6, hx - 0.4, hy + 5], SK, { bv: 2 }),
    E(hx + 3.2, hy + 10.4, 2.6, 2.2, SK, { ink: -0.04 }), // the nostril's wing
    E(hx + 4.8, hy + 12.2, 1.3, 0.7, 'scr_gum'), // the nostril
    E(hx + 9.6, hy + 4.2, 1.1, 1, SK, { ink: 0.14 }), // a wart on the bridge
  );
  for (let i = 0; i < 3; i++) o.push(X(hx - 6 + i * 0.8, hy - 11 + i * 1.6, 6.6 - i * 1.2, 0.6, SK + ':2')); // furrows
  // hair falling forward round the face
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[-9, -14, -14, -2, -13, 14, -0.2], [-6, -15, -10, -4, -9.6, 8, -0.1]]) {
    o.push(strand(hx + x0, hy + y0, hx + x1, hy + y1, hx + x2 + s * 0.4, hy + y2, 1.5, 0.35, HR, 4, { ink }));
  }
  o.push(P([hx - 10, hy - 15, hx - 2, hy - 18, hx + 9, hy - 15, hx + 12, hy - 9, hx + 6, hy - 12.6, hx + 1, hy - 10.4, hx - 4, hy - 12, hx - 11, hy - 8], HR, { bv: 1.6, ink: -0.12 })); // the fringe

  // the claw, open beneath the blood
  o.push(
    K(36, 99, 52, 92, 6.4, 5.6, 'scr_trollWifeDress', { ink: -0.04 }), // sleeve
    K(51, 93, bx - 3, bly + 10.6, 4, 3, SK),
    E(bx, bly + 9, 5, 3.4, SK, { a: -0.15 }),
  );
  const cl = [[bx - 4.4, bly + 7.4, bx - 7, bly + 3, bx - 6, bly - 1.2], [bx - 1.6, bly + 6.2, bx - 3, bly + 1.4, bx - 2, bly - 3], [bx + 1.8, bly + 6.4, bx + 4.4, bly + 2.2, bx + 4, bly - 2.2], [bx + 4.2, bly + 8.4, bx + 8.2, bly + 5.4, bx + 8.6, bly + 1.6]];
  for (const [x0, y0, x1, y1, x2, y2] of cl) {
    o.push(
      K(x0, y0, x1, y1, 1.2, 1, SK), K(x1, y1, x2, y2, 1, 0.75, SK),
      K(x2, y2, x2 + (x2 - x1) * 0.5 + 0.6, y2 + (y2 - y1) * 0.5, 0.65, 0.15, 'scr_hornRoot'),
    );
  }
  // the thread of blood, climbing from the victim below, a drop running up it
  const th = thread([91, 100], [bx + 2.6, bly + 0.6], 10, 4.4, 1.6, (f * Math.PI) / 2);
  for (let i = 0; i < th.length - 1; i++) o.push(K(th[i][0], th[i][1], th[i + 1][0], th[i + 1][1], 0.35 + i * 0.03, 0.38 + i * 0.03, 'scr_trollWifeBlood', { occ: false }));
  for (const t of [(f % 4) / 4 + 0.08, ((f + 2) % 4) / 4 + 0.08]) { const i = Math.floor(t * 10); o.push(E(th[i][0], th[i][1], 0.85, 1, 'scr_trollWifeBlood', { ink: 0.15 })); }
  o.push(
    E(bx, bly, 3.9 * p, 3.9 * p, 'scr_trollWifeBlood'),
    X(bx - 1.6, bly - 1.8, 1.2, 1.2, '#ffd6d0', { em: true }),
    Lt(bx - 2, bly - 3, 56, '#e0303c', 0.95 * p, 12),
  );
  return o;
}

/**
 * Face-on before the bars of Hel's gate: an iron visor over half its face, rot to the bone on the other
 * half (Hel's own split), her rune burning on its breast, a crescent glaive at its side.
 */
export function helWardenPortrait(f: number): PrimTree {
  const b = breath(f);
  const g = [1, 0.84, 1.16, 0.94][f % 4];
  const o: Out = [];
  const BH = 'scr_gHelWarden', HI = 'scr_helWardenIron', HC = 'scr_helWardenCloth';
  o.push(ground(BH, 50, 42, 70, 62));
  // the bars of the gate
  for (const x of [4, 21, 78, 92]) o.push(P([x - 2.4, -1, x + 2.4, -1, x + 2.4, 97, x - 2.4, 97], BH, { ink: BAND[1] }));
  o.push(P([-1, 9, 97, 9, 97, 13, -1, 13], BH, { ink: BAND[1] }));
  for (const x of [4, 21, 78, 92]) o.push(X(x - 1, 10, 2, 2, BH + ':3', { em: true }));
  // Niflhel's rime, falling slow
  for (let i = 0; i < 12; i++) {
    const x = 2 + hash2(i, 91) * 92, y = (hash2(i, 93) * 72 + f * 4 + i * 2) % 72 + 2;
    o.push(X(x, y, 1, 1, BH + ':' + (i % 3 ? 4 : 5), { em: true }));
  }
  // Niflhel's mist drifting at its feet
  for (let i = 0; i < 4; i++) {
    const x = ((i * 31 + f * 3) % 110) - 8;
    o.push(E(x, 90 - (i % 2) * 4, 14, 3.4, BH, { fl: 1, ink: BAND[3] - 0.04 }));
  }

  const by = -b * 0.4;
  // the glaive: a crescent on a black-iron haft, its edge cold violet
  const gx = 10;
  o.push(K(gx + 0.6, 99, gx, 2, 1.5, 1.3, 'blackIron'));
  const blade = [gx, 33, gx + 5, 30, gx + 9.6, 24, gx + 11.6, 17, gx + 10.6, 10, gx + 7.6, 5, gx + 2.6, 1.4, gx - 1, 1, gx + 3.6, 6, gx + 6, 11, gx + 6.4, 17, gx + 5, 23, gx + 1.6, 27, gx, 28];
  o.push(P(blade, HI, { bv: 1.6 }));
  const ge = { ink: (g - 1) * 0.4, occ: false };
  o.push(
    strand(gx + 5, 30.4, gx + 12.4, 20, gx + 10.6, 9.4, 0.55, 0.5, 'emUnholy', 4, ge), strand(gx + 10.6, 9.4, gx + 8.4, 3.4, gx + 2.6, 0.9, 0.5, 0.4, 'emUnholy', 3, ge),
    K(gx - 1.6, 34, gx + 1.6, 34, 1.8, 1.8, HI), // collar
  );
  for (let i = 0; i < 4; i++) o.push(K(gx - 1.7, 52 + i * 2.4 + 0.8, gx + 2, 52 + i * 2.4 - 0.8, 0.7, 0.7, HC, { ink: -0.1 - (i % 2) * 0.12 })); // a grip of grave-cloth

  const hx = 48, hy = 44 + by;
  // the hood, peaked, and the mantle falling over the shoulders
  o.push(
    P([26, 62, 27, 36, 34, 21, hx, 11 + by, 62, 21, 69, 36, 70, 62, 80, 70, 16, 70], HC, { bv: 3 }),
    P([-2, 97, -2, 82, 12, 71, 30, 65, 66, 65, 84, 71, 98, 82, 98, 97], HC, { bv: 4, n: [0, -0.1, 1] }),
  );
  for (const sd of [-1, 1]) o.push(K(hx + sd * 20, 30 + by, hx + sd * 22.6, 58, 0.6, 1, HC, { ink: -0.3, occ: false })); // the hood's folds
  o.push(P([hx - 15, hy + 22, hx - 16, hy - 2, hx - 10, hy - 17, hx, hy - 24, hx + 10, hy - 17, hx + 16, hy - 2, hx + 15, hy + 22], HC, { ink: -0.62 })); // the dark inside it
  // pauldrons of overlapping lames, spiked
  for (const sd of [-1, 1]) {
    const x = 48 + sd * 30;
    o.push(
      P([x - sd * 3, 69, x + sd * 4, 66, x + sd * 12, 53], HI, { bv: 1 }),
      E(x + sd * 3.4, 88, 13, 6, HI, { fl: 0.4, a: sd * 0.4, ink: -0.1 }),
      E(x + sd * 1.6, 81, 14.4, 7, HI, { fl: 0.4, a: sd * 0.37, ink: -0.06 }),
      E(x, 74, 16, 8.4, HI, { fl: 0.35, a: sd * 0.34 }),
    );
  }
  // breastplate, gorget, and the rune that burns on it
  o.push(
    P([32, 67, 64, 67, 68, 97, 28, 97], HI, { bv: 4, n: [0, -0.05, 1], ink: -0.22 }),
    K(48, 69, 48, 97, 0.9, 1, HI, { ink: -0.02, occ: false }),
  );
  for (const t of [0.15, 0.42, 0.7]) o.push(X(33.2 - 4 * t - 0.5, 67 + 30 * t, 1, 1, HI + ':4'), X(62.8 + 4 * t - 0.5, 67 + 30 * t, 1, 1, HI + ':2')); // rivets
  o.push(K(36, 65, 60, 65, 3.4, 3.4, HI, { ink: -0.04 }));
  const ri = (g - 1) * 0.4;
  o.push(K(48, 75, 48, 91, 0.8, 0.8, 'emUnholy', { ink: ri }), K(48, 81, 42.8, 75, 0.75, 0.75, 'emUnholy', { ink: ri }), K(48, 81, 53.2, 75, 0.75, 0.75, 'emUnholy', { ink: ri }));

  // the head: a black-iron cap, the dead face on the right, the visor over the left
  o.push(
    E(hx, hy - 8, 13.6, 11.4, HI, { fl: 0.55, ink: -0.2 }),
    E(hx + 5.4, hy + 5.6, 9.4, 12.6, 'scr_helWardenRot', { fl: 0.15 }),
    E(hx + 6.4, hy + 0.6, 3.8, 3.4, 'scr_helWardenRot', { fl: 0.85, ink: -0.64 }), // the socket
    E(hx + 6.7, hy + 1, 1.7, 1.45, 'emUnholy', { ink: (g - 1) * 0.4 }),
    X(hx + 6.1, hy + 0.3, 0.9, 0.9, '#f4ecff', { em: true }),
    E(hx + 7.6, hy + 5.6, 4.4, 1.6, 'boneOld', { fl: 0.4, a: -0.12 }), // the cheekbone, bare
    E(hx + 12, hy + 7, 2.2, 5, 'scr_helWardenRot', { fl: 0.5, ink: -0.34 }),
  );
  for (const [x, y, r] of [[12.6, 0.6, 1.4], [10.6, 16.8, 1.6], [4.4, 18.4, 1.2]]) o.push(E(hx + x, hy + y, r, r * 0.8, 'scr_helWardenRot', { fl: 0.7, ink: -0.42, occ: false })); // rot eaten through
  o.push(
    P([hx + 0.6, hy + 5, hx + 3.6, hy + 4.8, hx + 2.2, hy + 9.4], 'scr_gum'), // the nose, gone
    P([hx, hy + 10.4, hx + 10.4, hy + 9.8, hx + 10, hy + 14.8, hx, hy + 15.4], 'scr_gum'),
  );
  for (let i = 0; i < 6; i++) o.push(X(hx + 0.6 + i * 1.6, hy + 10.4 - i * 0.1, 1.1, 2, 'boneOld:' + (i < 4 ? 4 : 3)));
  for (let i = 0; i < 6; i++) o.push(X(hx + 0.6 + i * 1.6, hy + 12.6 - i * 0.1, 1.1, 1.8, 'boneOld:2'));
  o.push(
    K(hx + 1, hy + 16.4, hx + 11.4, hy + 13.4, 1.3, 1, 'boneOld', { ink: -0.12 }), // the jaw
    K(hx + 10.4, hy + 9.4, hx + 12.6, hy + 15, 0.5, 0.4, 'scr_helWardenRot', { ink: 0.1 }), K(hx + 9, hy + 9.8, hx + 9.4, hy + 15, 0.4, 0.4, 'scr_helWardenRot', { ink: 0.06 }), // sinews
  );
  // the visor over the left half, a cold slit for an eye
  o.push(
    P([hx - 14, hy - 4, hx + 0.8, hy - 2, hx + 0.6, hy + 18, hx - 6, hy + 17, hx - 12.6, hy + 10, hx - 14.2, hy + 3], HI, { bv: 2.2 }),
    K(hx - 11.6, hy - 0.4, hx - 2.2, hy + 1.6, 0.75, 0.65, 'emUnholy', { ink: (g - 1) * 0.4 }),
  );
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) o.push(X(hx - 9 + i * 2.6, hy + 7.4 + j * 2.6, 1, 1, '#141018'));
  for (let i = 0; i < 4; i++) o.push(X(hx - 0.2, hy + 2 + i * 4, 1, 1, HI + ':5'));
  // the brow-guard, frowning across both halves
  o.push(K(hx - 14.6, hy - 5.8, hx + 0.6, hy - 1.6, 2.2, 1.9, HI, { ink: 0.06 }), K(hx + 0.6, hy - 1.6, hx + 14.2, hy - 6.2, 1.9, 2, HI, { ink: 0.04 }));
  // the hood's edges, close round the face
  for (const sd of [-1, 1]) o.push(strand(hx, hy - 24.6, hx + sd * 18, hy - 14, hx + sd * 16.4, hy + 22, 1.6, 3, HC, 6, { ink: 0.04 - (sd > 0 ? 0.1 : 0) }));
  o.push(Lt(hx - 6.6, hy + 1, 10, '#a868ff', 0.5 * g, 3), Lt(hx + 6.8, hy + 1, 10, '#a868ff', 0.65 * g, 3));
  // a gauntlet on the haft
  o.push(
    K(24, 92, gx + 3, 83, 5.6, 4.6, HI, { ink: -0.06 }),
    E(gx + 0.6, 80, 4.2, 5.2, HI, { fl: 0.3 }),
  );
  for (let i = 0; i < 3; i++) o.push(K(gx - 3.4, 76.6 + i * 2.8, gx + 3.4, 77.4 + i * 2.8, 1.2, 1.2, HI, { ink: 0.06 }));
  // the rune's light, from below
  o.push(Lt(48, 80, 36, '#a868ff', 0.42 * g, 10));
  return o;
}
