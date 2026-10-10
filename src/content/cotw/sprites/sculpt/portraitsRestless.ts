import { E, K, P, X, Lt, T, breath, sway, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out } from './portraitKit';
import './materials';

/* Wave 9d, group A: the restless dead. The Myling, the Kirkegrim, the Root-Wraith. Conventions: portraitKit.ts. */

/** A tufted edge along a quadratic a -> c (control b): every other point pushed out by amp on side sgn, leaning along the curve. */
function furEdge(a: [number, number], c: [number, number], b: [number, number], n: number, amp: number, sgn: number, seed: number, lean = 0.4): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = qpt(a, c, b, i / n), l = Math.hypot(tx, ty) || 1;
    if (i % 2) { pts.push(x, y); continue; }
    const tf = (0.6 + 0.7 * hash2(i, seed)) * amp, ox = -sgn * (ty / l), oy = sgn * (tx / l);
    pts.push(x + ox * tf + (tx / l) * tf * lean, y + oy * tf + (ty / l) * tf * lean);
  }
  return pts;
}

/** A C-shaped rim round (cx, cy): the band between two ellipses, open at the bottom by gap radians, as one bevelled polygon. */
function rim(cx: number, cy: number, rx0: number, ry0: number, rx1: number, ry1: number, gap: number, m: string, o?: PrimOptions): Prim {
  const pts: number[] = [], n = 18, a0 = Math.PI / 2 + gap / 2, span = Math.PI * 2 - gap;
  for (let i = 0; i <= n; i++) { const a = a0 + (span * i) / n; pts.push(cx + Math.cos(a) * rx0, cy + Math.sin(a) * ry0); }
  for (let i = n; i >= 0; i--) { const a = a0 + (span * i) / n; pts.push(cx + Math.cos(a) * rx1, cy + Math.sin(a) * ry1); }
  return P(pts, m, o);
}

/**
 * The unburied child: wrapped in the shroud it never got, tied off at the crown, its
 * starved face turned and bowed, a small hand holding the shroud closed under its chin,
 * violet eyes looking up at you, begging. It glows pale among the black trunks.
 */
export function mylingPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.9, 1.12, 0.96][f % 4];
  const o: Out = [];
  const BG = 'scr_gMyling', SH = 'scr_mylingShroud', FC = 'scr_mylingFace', HO = 'scr_mylingHollow';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(48, 44, 58, 62, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(50, 40, 30, 34, BG, { fl: 1, ink: BAND[3] }));
  // the winter wood it was left in: black trunks
  for (const [x, w, lean] of [[5, 6, 1.5], [19, 3, -1], [82, 4, 1.2], [93, 7, -1]]) o.push(P([x - w / 2, -1, x + w / 2, -1, x + w / 2 + lean, 97, x - w / 2 + lean, 97], BG, { ink: BAND[1] - 0.04 }));
  o.push(K(19, 30, 26, 22, 0.9, 0.4, BG, { ink: BAND[1] - 0.04 }), K(82, 40, 74, 31, 1, 0.4, BG, { ink: BAND[1] - 0.04 }));
  // snow falling
  for (let i = 0; i < 12; i++) {
    const x = 2 + hash2(i, 41) * 92, y = (hash2(i, 43) * 96 + f * 2.2) % 96;
    o.push(X(x, y, 1, 1, BG + ':' + (i % 3 ? 4 : 5), { em: true }));
  }

  const n0 = o.length; // the figure, drawn at map proportions, then brought up close
  const by = -b * 0.5;
  const hx = 45, hy = 36 + by; // the crown of the shroud
  const fx = hx + 4, fy = hy + 5; // the face
  // the shroud as one shape: a dome over the head, falling round the shoulders,
  // the body curling away down to the left and fraying into nothing
  const tat: number[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, x = hx + 19 - t * (hx + 16), y = 84 + by - t * 6;
    tat.push(x + (i % 2 ? s * 0.6 * t : 0), y + (i % 2 ? 5 + hash2(i, 51) * 4 : 0));
  }
  const dome: number[] = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (1 + i / 12); dome.push(hx + Math.cos(a) * 18.5, hy + Math.sin(a) * 20); }
  o.push(P([...dome, hx + 20, hy + 12, hx + 24, hy + 28, hx + 25, hy + 42, hx + 21, 84 + by, ...tat, 5, 80, 11, 66, hx - 26, hy + 26, hx - 20, hy + 10], SH, { bv: 9, ink: -0.26 }));
  // its folds: long valleys down the body, each with a soft ridge beside it
  for (const [x0, y0, x1, y1, x2, y2, ink] of [[hx - 17, hy + 14, hx - 24, hy + 38, 12, 84, -0.5], [hx - 6, hy + 30, hx - 12, hy + 46, 22, 92, -0.46], [hx + 19, hy + 24, hx + 22, hy + 40, hx + 14, 88, -0.44], [hx + 7, hy + 33, hx + 6, hy + 44, hx + 2, 92, -0.42]]) {
    o.push(strand(x0, y0, x1, y1, x2, y2, 0.6, 1.4, SH, 5, { ink, occ: false }));
    o.push(strand(x0 + 2, y0, x1 + 2.2, y1, x2 + 2.4, y2, 0.5, 1, SH, 5, { ink: -0.16, occ: false }));
  }
  // tied off at the crown like a sack: the end of the shroud flopping back to the left, bound
  const kx = hx - 6, ky = hy - 17;
  for (const [x2, y2] of [[hx - 17, hy - 4], [hx - 11, hy - 12], [hx + 2, hy - 15], [hx + 11, hy - 11]]) o.push(K(kx + 1, ky + 2, x2, y2, 0.4, 0.9, SH, { ink: -0.46, occ: false }));
  o.push(P([kx - 2.6, ky + 1.6, kx - 4.6, ky - 2.4, kx - 9, ky - 5.6, kx - 13.4, ky - 4.6, kx - 15.4, ky - 1.6, kx - 13.4, ky - 2.2, kx - 10.6, ky - 1, kx - 6.4, ky + 3.4, kx - 2, ky + 4.4, kx + 2.6, ky + 2.4], SH, { bv: 2, ink: -0.14 }));
  o.push(K(kx - 3.4, ky - 1.6, kx - 1.2, ky + 3.8, 1.2, 1.2, SH, { ink: -0.52, occ: false })); // the binding
  // the opening, dark under the brim, and the face filling it: turned and bowed, a starved infant's
  o.push(E(fx + 0.6, fy + 0.4, 12.8, 14.2, HO, { fl: 0.6, ink: -0.24 }));
  // the face in planes, as the approved faces are cut: lit brow and near cheek, the far side turned away
  const F = (pts: number[], m: string, op?: PrimOptions): Prim => P(pts.map((v, i) => v + (i % 2 ? fy : fx)), m, op);
  o.push(F([-8, -10, -2, -12, 5, -11.6, 10, -8, 12, -2, 11.4, 4, 9, 9, 5, 13, 2, 14, -1.6, 13, -6, 10, -9.6, 5, -11, -1, -10.6, -6], FC, { bv: 2.4, n: [-0.15, -0.2, 0.97], ink: -0.14 }));
  o.push(F([-8, -10, -2, -12, 5, -11.6, 8.6, -8.6, 8, -3.4, 2, -2.6, -4, -3, -9.6, -3.4, -10.6, -6], FC, { bv: 1.6, n: [-0.24, -0.3, 0.92], ink: -0.2 })); // the big infant brow
  o.push(F([7, -10.6, 10, -8, 12, -2, 11.4, 4, 9, 9, 5, 13, 4.4, 10.4, 7.2, 5.6, 8.4, -0.4, 8, -6], FC, { bv: 1.2, n: [0.62, 0.1, 0.78], ink: -0.14 })); // the far side, turned away
  o.push(F([-11, -1, -7.6, 2.4, -4.6, 5.4, -1, 8.4, -1.6, 13, -6, 10, -9.6, 5], FC, { bv: 1.2, n: [-0.45, 0.05, 0.89], ink: -0.12 })); // the near cheek
  o.push(F([-9.4, 6.4, -5.4, 7.2, -1.6, 9.4, -2.4, 11.8, -6, 10], FC, { bv: 1, ink: -0.36 })); // hollow under the cheekbone
  // sunken eyes under a sad, lifted brow; a violet point in each, looking up at you
  const ey = fy + 1.6;
  o.push(F([-8, 0.4, -6, -0.8, -1.2, -2.8, 0.6, -0.2, -0.4, 3.6, -4, 5, -7.2, 3.6], FC, { bv: 1.4, ink: -0.46 }), F([3.4, -2, 6.8, -1.2, 8.8, 0.8, 8.2, 4, 5.4, 4.8, 3.4, 2.6], FC, { bv: 1.2, ink: -0.52 }));
  o.push(E(fx - 3.6, ey, 2.7, 1.7, HO, { fl: 0.6, a: -0.12, ink: -0.16 }), E(fx + 5.8, ey, 1.7, 1.6, HO, { fl: 0.6, a: 0.12, ink: -0.2 }));
  if (f !== 3) {
    o.push(E(fx - 3.2, ey - 0.6, 1.25, 1.25, 'emUnholy', { ink: (g - 1) * 0.4 }), E(fx + 6, ey - 0.6, 0.95, 1.1, 'emUnholy', { ink: -0.06 + (g - 1) * 0.4 }));
    o.push(X(fx - 3.7, ey - 1.3, 0.6, 0.6, '#f4ecff', { em: true }));
  } else {
    o.push(K(fx - 6.2, ey + 0.2, fx - 1, ey - 0.4, 0.6, 0.6, FC, { ink: -0.3 }), K(fx + 4.2, ey - 0.2, fx + 7.4, ey + 0.2, 0.55, 0.55, FC, { ink: -0.36 })); // lids shut
  }
  // the small nose, its shadow to the far side; a little mouth, parted, begging
  o.push(F([2.4, 2.6, 4.2, 6.6, 3.2, 7.6, 1.4, 7.4], FC, { ink: -0.38 }), E(fx + 1.4, fy + 6.8, 1.3, 1, FC, { ink: -0.04 }));
  o.push(F([-0.2, 10.4, 1, 9.6, 3.2, 9.6, 4.4, 10.4, 3.2, 10.9, 1, 10.9], 'scr_mylingMouth'));
  o.push(F([0.4, 11.5, 3.6, 11.5, 3, 12.5, 1, 12.5], FC, { ink: -0.32 }));
  // the rim of the opening: the cloth folded close round the face, overhanging the brow
  o.push(rim(fx + 0.6, fy + 0.2, 15.4, 16.2, 11.6, 12.4, 1.4, SH, { bv: 2.6, ink: -0.02 }));
  // a small hand holding the shroud closed under its chin, out of a slit in the cloth
  const cx = fx + 2, cy = fy + 20.6;
  o.push(E(cx, cy + 3, 8.4, 3.4, SH, { fl: 0.8, ink: -0.6, occ: false }));
  o.push(strand(cx - 8, cy + 1.4, cx, cy - 3.4, cx + 8, cy + 0.6, 1.9, 1.9, SH, 8, { ink: -0.12 })); // the gathered edge it grips
  o.push(E(cx - 0.4, cy + 2, 4.6, 3, FC, { ink: -0.34 }));
  for (let i = 0; i < 4; i++) o.push(E(cx - 3.8 + i * 2.4, cy - 1 - Math.sin(((i + 0.5) / 4) * Math.PI) * 0.8, 1.25, 1.7, FC, { ink: -0.16 - i * 0.05 }));
  // its pale grave-light, and the violet of the eyes
  o.push(Lt(fx - 1, fy - 2, 30, '#dcd6ff', 0.2 * g, 18));
  o.push(Lt(fx, ey, 10, '#a868ff', 0.45 * g, 4));
  o.push(...T(o.splice(n0), { px: 48, py: 40, s: 1.2 }));
  return o;
}

/**
 * The church-grim face-on, sitting its watch in a barrow door with the grave-mist
 * glowing behind it: a great shaggy black dog, ears pricked, violet eyes burning
 * under a heavy brow, lip curled off its fangs; below the ruff its body is already mist.
 */
export function kirkegrimPortrait(f: number): PrimTree {
  const b = breath(f);
  const g = [1, 0.86, 1.14, 0.94][f % 4];
  const o: Out = [];
  const BG = 'scr_gKirkegrim', HZ = 'scr_kirkegrimHaze', FU = 'scr_kirkegrimFur', RF = 'scr_kirkegrimRuff', MI = 'scr_kirkegrimMist', MO = 'scr_kirkegrimMouth', TT = 'scr_kirkegrimTooth';
  const hb = -b * 0.4;
  const hx = 48, hy = 40 + hb;
  o.push(P(FULL, BG, { ink: BAND[1] }));
  // the barrow's door, the grave-mist glowing in it behind its head; the stones and lintel black against it
  o.push(P([16, 97, 17, 16, 80, 15, 81, 97], HZ, { ink: BAND[1] + 0.02 }));
  o.push(E(48, 36, 28, 34, HZ, { fl: 1, ink: BAND[1] + 0.1 }), E(48, 34, 18, 22, HZ, { fl: 1, ink: BAND[2] + 0.02 }));
  o.push(P([-1, 97, 1, 22, 8, 16, 17, 19, 21, 97], BG, { ink: BAND[1] + 0.06 }), P([75, 97, 79, 20, 87, 15, 95, 21, 97, 97], BG, { ink: BAND[1] + 0.06 }));
  o.push(P([-1, 3, 97, 1, 97, 17, 60, 18.4, 30, 18, -1, 17.4], BG, { ink: BAND[1] + 0.1 }));
  o.push(K(-1, 17.6, 97, 17.2, 0.9, 0.9, BG, { ink: BAND[1] - 0.04, occ: false })); // the lintel's shadowed edge
  // the neck and chest: thick, shaggy
  o.push(P([hx - 15, hy, ...furEdge([hx - 17, hy + 4], [hx - 31, hy + 20], [hx - 30, 97], 10, 2.6, -1, 3, 0.3), ...furEdge([hx + 30, 97], [hx + 31, hy + 20], [hx + 17, hy + 4], 10, 2.6, -1, 7, 0.3), hx + 15, hy], RF, { bv: 7, ink: -0.2 }));
  o.push(P([hx - 12, hy + 20, ...furEdge([hx - 14, hy + 24], [hx - 17, hy + 38], [hx - 4, hy + 50], 6, 2.2, -1, 11, 0.4), ...furEdge([hx + 4, hy + 50], [hx + 17, hy + 38], [hx + 14, hy + 24], 6, 2.2, -1, 13, 0.4), hx + 12, hy + 20], RF, { bv: 3, ink: -0.1 })); // the chest ruff
  // ears, pricked, thick, set high at the corners of the skull
  for (const sd of [-1, 1]) {
    o.push(P([hx + sd * 6, hy - 13, hx + sd * 16.6, hy - 7.6, hx + sd * 18.4, hy - 17, hx + sd * 17.6, hy - 27, hx + sd * 15.4, hy - 26.6, hx + sd * 10, hy - 19], FU, { bv: 2.2, ink: sd < 0 ? 0.02 : -0.1 }));
    o.push(P([hx + sd * 9.6, hy - 12.4, hx + sd * 15.4, hy - 9.6, hx + sd * 16.4, hy - 22.4], MO));
    o.push(K(hx + sd * 10.6, hy - 13, hx + sd * 14.6, hy - 18, 0.8, 0.3, RF, { ink: -0.3 })); // hair in the ear
  }
  // shaggy fur standing out from the cheeks, framing the face
  for (const sd of [-1, 1]) o.push(P([hx + sd * 8, hy - 8, ...furEdge([hx + sd * 15, hy - 8], [hx + sd * 10, hy + 26], [hx + sd * 23, hy + 8], 8, 2.4, sd < 0 ? 1 : -1, 17 + sd, 0.3), hx + sd * 4, hy + 20], RF, { bv: 3, ink: sd < 0 ? -0.08 : -0.18 }));
  // the skull, broad and flat-topped; the cheeks
  o.push(E(hx, hy - 6, 16.6, 12, FU, { fl: 0.1 }));
  o.push(E(hx - 11, hy + 3, 7.6, 9.4, FU, { fl: 0.2, ink: 0.02 }), E(hx + 11, hy + 3, 7.6, 9.4, FU, { fl: 0.2, ink: -0.08 }));
  // the muzzle, a broad blunt block coming at you; the bridge catching the light
  o.push(K(hx, hy + 2, hx, hy + 12, 7, 8.4, FU, { ink: 0.02 }));
  o.push(K(hx, hy, hx, hy + 10, 2.4, 3.2, FU, { ink: 0.14 }));
  // the flews and the jaw; the lip curled back off its teeth: it is warning you off
  o.push(E(hx - 7.2, hy + 20, 5.8, 4.6, FU, { ink: -0.06 }), E(hx + 7.2, hy + 20, 5.8, 4.6, FU, { ink: -0.14 }));
  o.push(E(hx, hy + 26.4, 6, 3, FU, { ink: -0.24 }));
  o.push(P([hx - 9.4, hy + 22.2, hx - 5.4, hy + 19.4, hx - 1.8, hy + 19.6, hx, hy + 18.8, hx + 1.8, hy + 19.6, hx + 5.4, hy + 19.4, hx + 9.4, hy + 22.2, hx + 5.4, hy + 25.4, hx, hy + 26.4, hx - 5.4, hy + 25.4], MO));
  for (const sd of [-1, 1]) {
    o.push(P([hx + sd * 3.6, hy + 19.6, hx + sd * 6.6, hy + 19.8, hx + sd * 4.9, hy + 24.8], TT, { bv: 0.8, ink: sd < 0 ? 0 : -0.12 })); // the fangs
    o.push(P([hx + sd * 2, hy + 25.8, hx + sd * 4.2, hy + 25.3, hx + sd * 3, hy + 22.2], TT, { bv: 0.6, ink: -0.18 }));
    o.push(E(hx + sd * 1.3, hy + 20.1, 1, 0.9, TT, { ink: -0.2 })); // the incisors
  }
  // the nose
  o.push(E(hx, hy + 14.4, 5.6, 3.6, 'scr_kirkegrimNose', { fl: 0.2 }));
  o.push(E(hx - 2.6, hy + 15.6, 1.4, 0.9, MO), E(hx + 2.6, hy + 15.6, 1.4, 0.9, MO));
  // the brow, heavy, drawn down; the burning eyes deep under it
  for (const sd of [-1, 1]) {
    const ex = hx + sd * 7.6, ey = hy + 0.6;
    o.push(E(ex, ey, 3.8, 2.6, MO, { a: -sd * 0.22 }));
    o.push(E(ex, ey + 0.2, 2.7, 1.6, 'emUnholy', { a: -sd * 0.22, ink: (g - 1) * 0.4 }));
    o.push(X(ex - 0.6, ey - 0.3, 0.9, 0.8, '#f4ecff', { em: true }));
    o.push(K(hx + sd * 13.4, hy - 3.8, hx + sd * 3, hy - 0.8, 2.2, 1.6, FU, { ink: 0.12 }));
  }
  // below the ruff its body is already mist: tongues of it curling up, three flat bands
  const ph = (f % 4) * 0.3;
  for (const [yb, A, lam, p0, lean, ink, seed] of [[90, 16, 30, 6, 7, -0.64, 21], [95, 11, 22, 17, -6, -0.56, 23], [99, 7, 17, 3, 5, -0.48, 25]]) {
    const pts: number[] = [];
    for (let i = 0; i <= 54; i++) {
      const x = -6 + i * 2, u = (x - p0 - ph) / lam, k = Math.floor(u + 0.5);
      const h = A * (0.55 + 0.5 * hash2(k, seed)) * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * u), 1.2);
      pts.push(x + (lean * h) / A, yb - h);
    }
    o.push(P([...pts, 102, 99, -6, 99], MI, { ink }));
  }
  // the light of its eyes
  o.push(Lt(hx, hy + 2, 24, '#a868ff', 0.85 * g, 6));
  return o;
}

/**
 * A wraith of the World Tree's root: a hooded shroud of grave-moss with only two
 * slanted violet eyes in the dark of it; below the tattered mantle its body is roots
 * twisting down into the bile that lights it from below; one bony hand, its fingers
 * grown into rootlets, reaches out at you.
 */
export function rootWraithPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 1.1, 0.92, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gRootWraith', CL = 'scr_rootWraithCloth', RT = 'scr_rootWraithRoot', BN = 'scr_rootWraithBone', VD = 'scr_rootWraithVoid';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(44, 34, 54, 48, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(42, 102, 52, 20, 'scr_rootWraithBile', { fl: 1, ink: BAND[1] }), E(42, 102, 34, 11, 'scr_rootWraithBile', { fl: 1, ink: BAND[2] }));
  // the World Tree's rootlets, hanging in the dark
  for (let i = 0; i < 6; i++) {
    const x = 3 + i * 18 + hash2(i, 3) * 6, len = 14 + hash2(i, 5) * 22;
    o.push(strand(x, -2, x + (hash2(i, 7) - 0.5) * 10, len * 0.5, x + (hash2(i, 9) - 0.5) * 8, len, 1.8, 0.4, BG, 4, { ink: BAND[1] - 0.04 }));
  }
  const by = -b * 0.45;
  // its body below the mantle: roots, splayed and twisting down into the bile
  for (const [x, w] of [[6, 7], [26, 6], [46, 8], [68, 6], [90, 6]]) o.push(E(x, 95.4, w, 2.4, 'emPoison', { fl: 0.7, ink: -0.3 + (g - 1) * 0.5 })); // bile pooled round them
  for (const [x0, x1, y1, x2, r0, sd] of [[24, 10, 82, 4, 5, 7], [38, 30, 86, 26, 4.4, 9], [52, 54, 86, 48, 4.8, 11], [66, 76, 84, 70, 4.4, 13], [76, 90, 80, 92, 4.6, 15]]) {
    o.push(strand(x0, 68, x1 + (hash2(sd, 1) - 0.5) * 6, y1, x2, 98, r0, 1.4, RT, 9, { ink: -0.1 }));
    const [kx, ky] = qpt([x0, 68], [x1, y1], [x2, 98], 0.4);
    o.push(E(kx, ky, r0 * 0.9, r0 * 0.75, RT, { ink: -0.06 })); // a knot
    o.push(strand(x2, 96, x2 + (hash2(sd, 2) - 0.5) * 8, 92, x2 + (hash2(sd, 3) - 0.5) * 14, 96, 1, 0.5, RT, 3)); // a rootlet in the bile
  }
  // the mantle over the shoulders, hanging in tatters
  const hx = 44, hy = 34 + by;
  const tat: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = t * 96, y = 68 + Math.sin(t * Math.PI) * 4;
    tat.push(x + (i % 2 ? s * 0.4 : 0), y + (i % 2 ? 7 + hash2(i, 61) * 9 : 0));
  }
  o.push(P([hx - 18, hy + 14, 22, hy + 22, 6, hy + 34, -2, 64, ...tat, 98, 62, 84, hy + 32, 68, hy + 22, hx + 18, hy + 14], CL, { bv: 5, ink: -0.3 }));
  for (const [x0, y0, x1, y1] of [[20, 58, 14, 76], [34, 54, 32, 78], [58, 54, 62, 80], [74, 58, 80, 76]]) o.push(K(x0, y0, x1, y1, 0.6, 1.1, CL, { ink: -0.54, occ: false })); // folds
  // a root grown up through the mantle and over the shoulder
  o.push(strand(14, 99, 8, 76, 22, 56, 3, 2, RT, 8), strand(22, 56, 30, 48, 30, 40, 2, 1, RT, 5));
  // the hood, peaked and slumped forward
  o.push(P([hx - 22, hy + 26, hx - 22, hy + 4, hx - 20, hy - 8, hx - 16, hy - 17, hx - 15, hy - 23, hx - 19, hy - 30, hx - 10, hy - 26, hx - 2, hy - 24, hx + 8, hy - 21, hx + 15, hy - 14, hx + 20, hy - 3, hx + 21, hy + 10, hx + 20, hy + 26], CL, { bv: 4.4, ink: -0.14 }));
  o.push(E(hx, hy + 2, 11, 14.5, VD, { fl: 0.9, ink: -0.24 }));
  // the hood's lip, a thick fold of moss-cloth round the dark
  o.push(rim(hx, hy + 1, 15.4, 18.4, 10.6, 14, 1.2, CL, { bv: 2.6, ink: 0 }));
  // the violet eyes, deep in it, slanted
  o.push(E(hx - 4, hy, 2.3, 1.05, 'emUnholy', { a: 0.34, ink: (g - 1) * 0.4 }), E(hx + 4, hy + 0.4, 2, 1, 'emUnholy', { a: -0.34, ink: (g - 1) * 0.4 }));
  o.push(Lt(hx, hy + 1, 10, '#a868ff', 0.5 * g, 3));
  // the arm, reaching out of a ragged sleeve; bony fingers grown into rootlets
  o.push(P([98, 62, 86, 63, 76, 65.6, 71.6, 72, 72.6, 80, 75.6, 89, 78.6, 84, 82.6, 93, 86.6, 86, 91.6, 95, 98, 88], CL, { bv: 3, ink: -0.26 }));
  o.push(K(96, 70, 80, 72, 0.6, 1.1, CL, { ink: -0.54, occ: false }), K(94, 80, 82, 80, 0.6, 1, CL, { ink: -0.54, occ: false }));
  o.push(K(76.4, 65.8, 72.4, 76, 1.2, 1.2, CL, { ink: -0.08 })); // the cuff's edge
  o.push(K(76, 71, 66, 70, 2.6, 2.2, BN, { ink: -0.06 }));
  o.push(E(64, 68, 4, 3.4, BN, { a: 0.5 }));
  const fingers = [[60, 64, 54, 58, 50, 56], [61, 67, 54, 64, 49, 64], [62, 70, 56, 71, 51, 73], [65, 64, 62, 57, 59, 53]];
  for (const [x0, y0, x1, y1, x2, y2] of fingers) {
    o.push(K(x0, y0, x1, y1, 1.1, 0.9, BN), K(x1, y1, x2, y2, 0.9, 0.6, BN));
    o.push(strand(x2, y2, x2 - 3, y2 + 1, x2 - 5, y2 + 4, 0.5, 0.2, RT, 3));
  }
  o.push(Lt(42, 108, 60, '#95dc4c', 0.6 * g, 14));
  return o;
}
