import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimTree } from './kit';
import { BAND, FULL, ground, qpt, strand, frame, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9b portraits, group A: Gálmr, the Sun-Chariot Warden and Glóð. Conventions: portraitKit.ts. */

/**
 * The frost-jötunn under his rimed wolf-pelt hump, head thrust low: ice spires grown from the skull, a beard frozen to
 * icicles and pale eyes narrowed under a scowling brow. The Rime Shockwave gathers in the raised maul and lights him cold.
 */
export function galmrPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const p = [1, 1.12, 0.9, 1.05][f % 4];
  const o: Out = [];
  const BG = 'scr_gGalmr', H = 'scr_galmrHide', R = 'scr_galmrRime', FU = 'scr_galmrFur', BD = 'scr_galmrBeard', ICE = 'scr_galmrIce';
  o.push(
    P(FULL, BG, { ink: BAND[1] }),
    E(58, 28, 66, 60, BG, { fl: 1, ink: BAND[2] }),
  );
  // the ice spires of the vault, standing in the dark
  for (const [x, w, top, ink] of [[6, 8, -2, BAND[2] + 0.1], [22, 4.5, 24, BAND[2]], [64, 5, 4, BAND[2] + 0.06], [93, 7, 38, BAND[2] + 0.12]]) {
    o.push(
      P([x - w, 97, x + w, 97, x + w * 0.15, top], BG, { ink }),
      P([x - w * 0.1, 97, x + w, 97, x + w * 0.15, top], BG, { ink: ink + 0.12 }),
    );
  }
  const crust = (pts: Pt[], sd: number, ink: number): Prim[] => {
    const out: Prim[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.9);
      for (let j = 0; j < n; j++) {
        const t = j / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = hash2(i * 17 + j, sd);
        out.push(E(x, y + 0.8, 1.5 + h * 1.8, 1.1 + h * 1.1, R, { fl: 0.45, ink: (h - 0.5) * 0.2 + ink }));
        if (h > 0.6) out.push(P([x - 0.9, y + 1.4, x + 0.9, y + 1.4, x + (h - 0.8) * 2, y + 4 + h * 5], ICE, { bv: 0.5, ink: ink + 0.04 }));
      }
    }
    return out;
  };

  const by = -b * 0.5;
  // the hump: the brim-wolf pelt over his far shoulder, higher than his head, in shadow
  o.push(P([-2, 97, -2, 38, 4, 29, 13, 23.5, 23, 22.6, 31, 26, 36, 34, 37, 48, 33, 62, 32, 97], FU, { bv: 8, ink: -0.3, n: [0, -0.3, 1] }));
  for (let i = 0; i < 5; i++) o.push(strand(6 + i * 6, 34 - (i > 2 ? (i - 2) * 2 : 0), 4 + i * 6, 52, 6 + i * 6.4 + s * 0.2, 66 + hash2(i, 5) * 12, 1.4, 0.4, FU, 3, { ink: -0.44 })); // locks of the pelt
  o.push(
    crust([[-2, 36], [5, 28.4], [14, 24.4], [23, 23.6], [30, 27], [34, 33]], 3, -0.1),
    // the near shoulder and the chest, dark under the beard
    E(84, 99, 24, 22, FU, { fl: 0.3, ink: -0.3 }),
    crust([[62, 81], [72, 78], [84, 78.4], [97, 82]], 9, -0.22),
    E(46, 102, 26, 26, FU, { fl: 0.3, ink: -0.36 }),
  );

  // head, thrust forward and low under the hump
  const fx = 50, fy = 45 + by;
  // white hair from the back of the skull, frozen stiff over the hump
  for (const [x, y, dx, len, ink] of [[29, 38, -8, 24, -0.3], [33.6, 31, -6, 34, -0.12], [30, 34, -3, 38, -0.22], [37, 29, -2, 30, -0.04], [27, 45, -2, 18, -0.26]]) {
    const y0 = y + by, ex = x + dx + s * 0.25, ey = y0 + len;
    o.push(
      strand(x, y0, x + dx * 0.3 - 3, y0 + len * 0.45, ex, ey, 3.2, 1.3, BD, 4, { ink }),
      P([ex - 1.3, ey - 1, ex + 1.3, ey - 1, ex + dx * 0.08, ey + 5 + len * 0.15], ICE, { bv: 0.7, ink: ink + 0.04 }),
    );
  }
  o.push(
    E(fx - 6, fy - 5, 15.5, 16.5, H, { fl: 0.15 }),
    E(fx + 1, fy + 8, 14, 9.5, H, { fl: 0.2 }), // the heavy jaw
    E(fx - 18, fy + 0.6, 3.4, 6, H, { fl: 0.3, ink: -0.1 }), // ear
    E(fx - 17.6, fy + 1, 1.5, 3.4, H, { fl: 0.8, ink: -0.45 }),
    E(fx - 13, fy - 6, 4, 6, H, { fl: 0.7, ink: -0.2 }), // temple
    E(fx - 11.4, fy + 3, 3.6, 7, H, { fl: 0.7, ink: -0.24 }), // the side of the face, turned from the light
    E(fx + 10.4, fy + 1.4, 2.6, 4.6, H, { fl: 0.5, ink: -0.16 }), // far cheek
  );
  // hoarfrost on the scalp
  for (const [x, y, r] of [[34, 30, 2.4], [38.6, 26.6, 2], [44, 25, 1.8], [30, 35, 1.6], [52, 27, 1.4]]) o.push(E(x, y + by, r * 1.3, r, R, { fl: 0.5, ink: -0.14 }));
  // the crown: ice spires grown out of the skull, swept back, one snapped
  const spires = [
    [30.5, 31.5, 4, 14, -0.9], [36, 27.4, 5.2, 24, -0.55], [43.2, 24.6, 4.6, 19, -0.3],
    [49.6, 25.2, 3.6, 12, 0.05], [54.6, 28.4, 3, 9, 0.35], [40, 25.4, 2.2, 8, -0.75],
  ];
  spires.forEach(([x, y, w, h, lean], i) => {
    y += by;
    const ux = Math.sin(lean), uy = -Math.cos(lean), nx = -uy, ny = ux;
    const sh = h * (i === 3 ? 0.86 : 0.7), tip = i === 3 ? h * 0.9 : h;
    const L = [x - nx * w, y - ny * w], Rr = [x + nx * w, y + ny * w];
    const Ls = [L[0] + ux * sh, L[1] + uy * sh], Rs = [Rr[0] + ux * sh * 0.9, Rr[1] + uy * sh * 0.9];
    const T = i === 3 ? [x + ux * tip + nx * 1.4, y + uy * tip + ny * 1.4, x + ux * tip - nx * 2, y + uy * tip - ny * 2 + 1] : [x + ux * tip, y + uy * tip];
    o.push(
      P([...L, ...Ls, ...T, ...Rs, ...Rr], ICE, { bv: 1.2, ink: -0.1 }),
      P([x + ux * 1.5, y + uy * 1.5, ...T.slice(0, 2), ...Rs, ...Rr], ICE, { bv: 0.8, ink: -0.34 }), // the far facet
      K(L[0], L[1] + 0.4, Rr[0], Rr[1] + 0.4, 1.2, 1.2, R, { ink: -0.16 }), // rime where it grows
    );
  });
  // the brow: a heavy shelf driven down to the nose in a scowl
  o.push(
    K(fx - 18, fy - 9.6, fx - 0.6, fy - 6, 4.2, 3.2, H, { ink: 0.14 }),
    K(fx + 2.6, fy - 6, fx + 9.4, fy - 7.6, 2.8, 2, H, { ink: 0.04 }),
    E(fx + 1, fy - 7, 3, 2.6, H, { ink: 0.04 }),
    K(fx + 0.4, fy - 11.4, fx + 1, fy - 7.6, 0.5, 0.4, H, { ink: -0.3 }), // a furrow between them
  );
  // the shadow under the brow, and pale eyes narrowed in it
  const g = (p - 1) * 0.4;
  o.push(
    E(fx - 5.4, fy - 3.4, 9.4, 2.6, 'scr_galmrShade', { fl: 0.9, ink: -0.24 }),
    E(fx - 4.4, fy - 2.5, 4.6, 2, 'scr_galmrMaw', { fl: 0.85, ink: -0.1 }),
    P([fx - 8.4, fy - 1.8, fx - 4.4, fy - 3.4, fx - 0.8, fy - 2.6, fx - 1.6, fy - 1.4, fx - 5.4, fy - 0.9], 'emFrost', { ink: g - 0.12 }),
    X(fx - 3.8, fy - 3, 1.2, 1, '#ffffff', { em: true }),
  );
  // the broad nose, and the far eye beyond its bridge
  o.push(
    K(fx + 3, fy - 4.4, fx + 8.4, fy + 2.8, 2.3, 3.4, H, { ink: 0.04 }),
    E(fx + 9.2, fy + 4, 3.6, 2.8, H, { ink: 0.02 }),
    E(fx + 6.2, fy + 4.8, 2, 1.6, H, { ink: -0.12 }),
    X(fx + 8, fy + 5.4, 2.2, 1, 'scr_galmrMaw:2'),
    E(fx + 9, fy - 2.6, 2.2, 1.6, 'scr_galmrMaw', { fl: 0.85, ink: -0.1 }),
    P([fx + 7.6, fy - 2.4, fx + 10, fy - 3.3, fx + 10.4, fy - 2.2, fx + 8, fy - 1.6], 'emFrost', { ink: g - 0.12 }),
    X(fx + 8.8, fy - 3.1, 0.8, 0.8, '#ffffff', { em: true }),
    Lt(fx + 2, fy - 2, 10, '#9fe6ff', 0.32 * p, 3.5),
  );
  // the beard, frozen white: a stiff mass from ear to chin, locks in it, a fall of icicles
  o.push(P([fx - 16, fy - 0.6, fx - 12, fy + 6, fx - 6, fy + 10, fx - 1, fy + 13, fx + 7, fy + 14.4, fx + 13.4, fy + 12.6, fx + 15, fy + 17, fx + 11, fy + 25, fx + 3, fy + 30, fx - 5, fy + 28, fx - 13, fy + 19], BD, { bv: 3.4, ink: -0.02 }));
  for (const [x0, y0, x1, y1, ink] of [[-14, 4, -12, 20, -0.16], [-9, 9, -8, 25, -0.06], [-4, 12, -3, 28, -0.14], [2, 14, 3, 29, -0.04], [8, 14, 7.4, 26, -0.12], [12.6, 14, 11, 22, -0.06]]) {
    o.push(strand(fx + x0, fy + y0, fx + x0 + (x1 - x0) * 0.3 - 0.8, fy + (y0 + y1) / 2, fx + x1 + s * 0.1, fy + y1, 1.8, 1.1, BD, 3, { ink }));
  }
  const ice = [[-13, 18, 10, -1.2], [-10, 22, 16, -1], [-6.4, 25.6, 24, -0.6], [-2.6, 27.6, 30, 0], [1, 29, 38, 0.4], [4.6, 28, 26, 0.8], [8, 25.6, 20, 1.2], [11, 22.6, 13, 1.4], [13.6, 18.6, 8, 1.6], [-4.6, 26.6, 12, -0.4], [2.8, 28.8, 14, 0.4], [6.4, 27, 11, 1]];
  for (const [x, y, len, lean] of ice) {
    const w = 1.1 + len * 0.045, x0 = fx + x, y0 = fy + y;
    o.push(P([x0 - w, y0 - 1.5, x0 + w, y0 - 1.5, x0 + lean + s * 0.1, y0 + len], ICE, { bv: 0.9, ink: len > 20 ? -0.06 : 0 }));
  }
  // the mouth: a grimace through the beard, big square teeth clenched
  o.push(P([fx - 1.6, fy + 12.4, fx + 2, fy + 9.4, fx + 11.4, fy + 9.2, fx + 13, fy + 12.6, fx + 11, fy + 13.6, fx + 2, fy + 13.4], 'scr_galmrMaw'));
  for (let i = 0; i < 5; i++) o.push(X(fx + 1.8 + i * 2, fy + 9.8 + (i === 0 ? 0.6 : 0), 1.6, 1.6, 'scr_galmrTooth:' + (i < 3 ? 4 : 3)));
  for (let i = 0; i < 4; i++) o.push(X(fx + 2.6 + i * 2, fy + 11.8, 1.6, 1.2, 'scr_galmrTooth:2'));
  // a frozen moustache over the grimace
  o.push(P([fx + 1, fy + 8, fx + 5, fy + 6.6, fx + 8, fy + 7.4, fx + 11.6, fy + 7, fx + 13.6, fy + 9.4, fx + 11, fy + 9.8, fx + 7, fy + 9, fx + 2.6, fy + 10.2], BD, { bv: 1.2, ink: 0.06 }));
  for (const [x, len] of [[2.4, 3], [5.6, 2.2], [9, 2.8], [12.4, 3.4]]) o.push(P([fx + x - 0.8, fy + 9.4, fx + x + 0.8, fy + 9.4, fx + x + 0.1, fy + 9.4 + len], ICE, { bv: 0.4 }));
  // frost breath leaving the mouth and drifting
  const bo = { ol: false, occ: false };
  if (f === 1) o.push(E(fx + 16, fy + 11, 2.4, 2, 'scr_galmrBreath', bo));
  if (f === 2) o.push(E(fx + 18, fy + 9.4, 3.2, 2.6, 'scr_galmrBreath', bo), E(fx + 22, fy + 7.4, 2.2, 1.8, 'scr_galmrBreath', bo));
  if (f === 3) o.push(E(fx + 22, fy + 7, 3.2, 2.6, 'scr_galmrBreath', bo), E(fx + 25.6, fy + 4.4, 2, 1.6, 'scr_galmrBreath', bo));

  // the maul: haft up from his fist, the stone head rimed and cracked by the cold in it
  o.push(
    K(80, 99, 82, 32, 2.4, 2.2, 'woodDark'),
    P([67, 14, 93, 11.4, 95, 31.4, 69, 33.6], 'stoneDark', { bv: 2.6, ink: -0.06 }),
    K(72, 13.6, 73, 33.4, 1.2, 1.2, 'iron', { ink: -0.1 }), K(88.4, 12, 89.6, 31.8, 1.2, 1.2, 'iron', { ink: -0.1 }),
  );
  const ci = -0.25 + (p - 1) * 0.6;
  for (const pts of [[74, 19, 77.6, 22.6, 76.8, 26.4, 79.6, 31.6], [77.6, 22.6, 82.4, 21.4, 85, 16.4], [82.4, 21.4, 86.6, 25.4, 91, 26.6], [86.6, 25.4, 86, 30]]) {
    for (let i = 0; i < pts.length - 2; i += 2) o.push(K(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], 0.6 - i * 0.05, 0.45 - i * 0.05, 'emFrost', { ink: ci, occ: false }));
  }
  o.push(P([66, 14.6, 71, 10, 81, 8.6, 91, 7.6, 95.6, 9.6, 95.4, 14, 91, 15.6, 87, 13.4, 82, 16.4, 77, 13.8, 72, 16.6, 66.6, 17], R, { bv: 1.4, ink: -0.2 }));
  for (const [x, len] of [[69, 6], [74, 9], [79, 5], [85, 8], [91, 6]]) {
    const y = 33.4 - (x - 69) * 0.08;
    o.push(P([x - 1.2, y - 0.6, x + 1.2, y - 0.6, x + 0.2, y + len], ICE, { bv: 0.6 }));
  }
  // fist on the haft, the arm coming up out of the fur
  o.push(
    K(99, 104, 86, 78, 10, 7.6, H, { ink: -0.16 }),
    K(89, 82, 84.4, 75, 7.8, 7.2, 'leatherDark', { ink: -0.08 }), // a bracer
    K(88.4, 80.4, 83.6, 73.6, 0.9, 0.9, 'iron', { ink: -0.1 }),
    E(85, 68, 5.4, 6.4, H, { fl: 0.3, ink: -0.06 }),
  );
  for (let i = 0; i < 4; i++) {
    const y = 62.4 + i * 3.1;
    o.push(
      K(86, y + 0.4, 78, y - 0.2, 1.8, 1.7, H, { ink: i % 2 ? -0.08 : 0 }),
      E(78.2, y - 0.2, 1.7, 1.6, H, { ink: 0.06 }),
    );
  }
  o.push(K(87, 60.6, 80, 61.2, 1.7, 1.5, H, { ink: 0.06 })); // thumb
  // rime motes drifting off the maul
  for (let i = 0; i < 5; i++) {
    const y = (hash2(i, 41) * 36 + f * 2.4 * (1 + (i % 2))) % 36, x = 64 + hash2(i, 43) * 30;
    o.push(X(x, 36 + y, 0.8, 0.8, i % 2 ? '#ffffff' : 'emFrost:4', { em: true }));
  }
  // a glint walks the crown
  const gl = [[28, 7], [36.6, 7], [46, 12.4], null][f % 4];
  if (gl) o.push(X(gl[0] - 0.5, gl[1] - 0.5 + by, 1, 1, '#ffffff', { em: true }));
  // the Rime Shockwave gathering in the maul, lighting the side of his face
  o.push(Lt(72, 28, 56, '#5cb4e2', 0.85 * p, 10));
  return o;
}

/**
 * The chariot horse's iron skull lowered under a bronze chamfron, ears pinned back, teeth clenched on the bit and a slit of
 * sun-fire for an eye. The stolen sun-disc rides in the bronze car as the hub of the turning wheel and lights it from below.
 */
export function chariotWardenPortrait(f: number): PrimTree {
  const b = breath(f);
  const p = [1, 1.08, 1.16, 1.08][f % 4];
  const pu = (p - 1) / 0.16;
  const o: Out = [];
  const BG = 'scr_gChariot', IR = 'scr_chariotIron', BZ = 'bronze', BI = 'blackIron', SUN = 'scr_chariotSun', MAW = 'scr_chariotMaw';
  const cx = 30, cy = 70;
  // the forge behind: a hood in the dark, and the arched mouth of a furnace far off
  o.push(
    ground(BG, cx, cy, 64, 60),
    P([40, -1, 97, -1, 97, 20, 86, 12, 62, 6], BG, { ink: BAND[1] + 0.06 }),
    P([80, 97, 80, 70, 83, 63, 89, 59, 97, 58, 97, 97], BG, { ink: BAND[2] + 0.08 }),
    P([84, 97, 84, 73, 87, 67, 92, 64, 97, 64, 97, 97], BG, { ink: BAND[3] + 0.04 }),
  );
  // the great wheel, turning one spoke over the loop
  const rot = (f * Math.PI) / 16, WR = 30;
  const spokeA = (i: number): number => rot + (i * Math.PI) / 4 + Math.PI / 8;
  for (let i = 0; i < 8; i++) {
    const a = spokeA(i), ca = Math.cos(a), sa = Math.sin(a);
    o.push(K(cx + ca * 9, cy + sa * 9, cx + ca * (WR - 1), cy + sa * (WR - 1), 2.3, 1.3, BZ, { ink: -0.24 }));
  }
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    o.push(K(cx + Math.cos(a0) * WR, cy + Math.sin(a0) * WR, cx + Math.cos(a1) * WR, cy + Math.sin(a1) * WR, 2.7, 2.7, IR, { ink: -0.26 }));
  }
  for (let i = 0; i < 8; i++) {
    const a = spokeA(i);
    o.push(E(cx + Math.cos(a) * WR, cy + Math.sin(a) * WR, 1.7, 1.7, BZ, { ink: -0.14 }));
  }

  const by = -b * 0.4;
  // the neck: riveted iron lames, rising out of the car to the head; darker than the head
  o.push(P([16, 66, 20, 50, 28, 35, 38, 24, 49, 14, 58, 9 + by, 66, 10 + by, 60, 26 + by, 55, 40, 60, 56, 70, 76, 76, 97, 40, 97, 28, 82], BI, { bv: 6, ink: -0.22 }));
  for (const [x0, y0, x1, y1] of [[38, 26, 56, 36], [30, 37, 56, 47], [24, 49, 59, 57], [22, 61, 64, 67]]) o.push(K(x0, y0, x1, y1, 0.6, 0.6, MAW, { ink: -0.1 })); // seams between the lames
  for (const [x, y] of [[50, 34], [48, 45], [52, 55], [57, 65]]) o.push(X(x - 0.6, y - 0.6, 1.2, 1.2, IR + ':4'));
  // the crest: bronze blades swept back along the neck, a mane of rays
  for (let i = 0; i < 8; i++) {
    const t = 0.06 + (i / 7) * 0.84;
    const [x, y, dx, dy] = qpt([57, 9 + by], [30, 22], [16, 66], t);
    const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const len = 11 - Math.abs(t - 0.3) * 8;
    const tx = x + nx * len + ux * 5, ty = y + ny * len + uy * 5;
    o.push(P([x - ux * 2.2 - nx, y - uy * 2.2 - ny, tx, ty, x + ux * 2.6 - nx, y + uy * 2.6 - ny], BZ, { bv: 0.9, ink: -0.14 - t * 0.16 }));
  }
  // ears pinned flat back along the neck: hostility in a horse
  o.push(
    P([62, 6.4 + by, 53, 6.4 + by, 44, 10.6 + by, 54, 11.4 + by, 63, 10.6 + by], IR, { bv: 1, ink: -0.24 }),
    P([64, 9 + by, 55, 10 + by, 45, 15.6 + by, 50, 16.4 + by, 58, 15 + by, 65, 13.6 + by], IR, { bv: 1.2, ink: -0.04 }),
    P([60, 11.2 + by, 51, 13.6 + by, 56, 13.6 + by], BI, { ink: -0.34 }),
  );

  // the head: the chariot horse's iron skull, lowered at you, in its own frame
  const H = frame(62, 22 + by, 0.82);
  o.push(
    H.E(0, 2, 13, 12.5, IR, { fl: 0.15 }), // the skull
    H.E(2, 12, 11.5, 9.6, IR, { fl: 0.2, ink: -0.14 }), // the round of the jaw
    H.P([-3, -10.5, 16, -10, 30, -7.6, 38, -5.8, 42, -2.4, 42, 3, 38, 6.2, 26, 7.8, 13, 10, 0, 12], IR, { bv: 3.6, ink: 0.02 }), // the long face
    H.P([5, 15.6, 18, 11.2, 28, 9.4, 38, 8, 41, 10, 36, 13, 23, 15, 12, 20], IR, { bv: 2, ink: -0.18 }), // lower jaw, shut
    H.E(5, 6.6, 6.5, 3, IR, { fl: 0.8, ink: -0.4, a: 0.18 }), // hollow under the cheekbone
    H.K(8, 3.4, 27, 2, 1.4, 0.8, IR, { ink: 0.1 }), // the facial crest, a hard bony ridge
    // the nostril, flared, the forge glowing faintly in it
    H.E(39, -0.6, 2.4, 1.5, MAW, { fl: 0.6, a: -0.3 }),
    H.E(39.3, -0.5, 1.2, 0.7, 'emFire', { a: -0.3, ink: -0.45 + pu * 0.2 }),
    // the mouth: long rows of teeth bared and clenched on the bit, fire between them
    H.K(14, 8.4, 42, 8.2, 1.4, 1.1, MAW, { occ: false }),
    H.K(18, 8.4, 41, 8.2, 0.55, 0.45, 'emFire', { occ: false, ink: -0.3 + pu * 0.3 }),
  );
  for (let i = 0; i < 11; i++) {
    const x = 15.4 + i * 2.35, big = i > 7;
    o.push(
      H.X(x, big ? 5.6 : 6.4, 1.9, big ? 2.6 : 1.9, IR + ':' + (i % 2 ? 3 : 4)),
      H.X(x + 0.6, 9.1, 1.9, big ? 2.2 : 1.5, IR + ':' + (i % 2 ? 2 : 3)),
    );
  }
  // the bridle: a cheek-strap, bronze-studded, to the bit ring
  o.push(H.K(-4, -6.5, 15.4, 8.6, 1.4, 1.4, 'leatherDark', { ink: -0.08 }));
  for (const [x, y] of [[3, -1.4], [10, 3.6]]) o.push(H.X(x - 0.6, y - 0.6, 1.2, 1.2, BZ + ':5'));
  o.push(
    H.E(15.4, 9.1, 3.4, 3.4, BI, { fl: 0.2 }),
    H.E(15.4, 9.1, 1.7, 1.7, MAW, { fl: 0.8 }),
  );
  // the chamfron over the brow and down the nose, a sun-boss on it
  o.push(
    H.P([-1.3, -12.7, 15.6, -12, 29, -9.2, 36, -7.4, 33, -5, 22, -4.6, 15.6, -5.2, 2.6, -5.2], BZ, { bv: 1.8, ink: -0.08 }),
    H.K(5, -9, 34, -7, 0.7, 0.5, BZ, { ink: 0.12 }),
  );
  for (const x of [14, 22, 29]) o.push(H.X(x - 0.6, -6 + x * 0.02, 1.2, 1.2, BI + ':1'));
  o.push(
    H.E(3, -8.6, 3.9, 3.9, 'gold', { fl: 0.3, ink: -0.06 }),
    H.E(3, -8.6, 1.7, 1.7, SUN, { ink: -0.2 + pu * 0.2 }),
    // the eye: a narrowed slit of sun-fire, sunk deep in the ring of the orbit
    H.E(13, -0.6, 7.6, 5.2, IR, { fl: 0.3, ink: 0.04, a: -0.12 }), // the orbit's bony ring
    H.E(13.2, -0.4, 5.8, 3.6, MAW, { fl: 0.6, a: -0.12 }), // the socket
    H.E(13.8, 0, 4.2, 0.85, 'emFireCore', { a: -0.32, ink: -0.08 + pu * 0.12 }),
    H.X(15.4, -1.2, 1, 1, '#fffaf0', { em: true }),
    H.P([5, -5.4, 13, -6.4, 21, -4.8, 19.4, -1.8, 12.6, -2.6, 6, -1.6], IR, { bv: 1, ink: 0.06 }), // the ridge scowling over it
    H.Lt(14, 0, 7, '#ffb060', 0.22 * p, 6),
  );
  // the reins, hanging slack from the bit: nothing drives it
  const [rx, ry] = H.pt(15.4, 9.1);
  o.push(strand(rx, ry, rx - 2, ry + 20, rx - 14, ry + 26, 1, 0.9, BI, 4, { ink: -0.12 }));

  // the car's breastwork: a bronze rail that carries the sun
  o.push(
    P([-1, 84, 10, 88, 22, 90, 34, 90, 48, 88, 60, 84, 68, 80, 72, 88, 70, 97, -1, 97], BZ, { bv: 2.6, ink: -0.42 }),
    strand(-1, 84, 20, 91, 40, 90, 1.4, 1.4, BI, 4, { ink: -0.06 }),
    strand(40, 90, 58, 86, 68, 80, 1.4, 1.4, BI, 3, { ink: -0.06 }),
  );
  for (const [x, y] of [[8, 91], [22, 93.4], [36, 93.4], [50, 92], [62, 88]]) o.push(X(x - 0.6, y - 0.6, 1.2, 1.2, BZ + ':4'));
  // the stolen sun-disc: white gold in a gold bezel, the hub of the wheel
  const cr = 8.4 + pu * 0.5;
  o.push(E(cx, cy, cr + 2.6, cr + 2.6, 'gold', { fl: 0.3, ink: -0.04 }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    o.push(X(cx + Math.cos(a) * (cr + 1.4) - 0.5, cy + Math.sin(a) * (cr + 1.4) - 0.5, 1, 1, BI + ':1'));
  }
  o.push(
    E(cx, cy, cr, cr, SUN, { fl: 0.5 }),
    E(cx - 1, cy - 1, cr * 0.55, cr * 0.55, 'scr_chariotSunWhite', { fl: 0.6 }),
  );

  // heat shimmer off the nostril
  [[88, 42], [90, 38]].forEach(([x, y], i) => {
    const k = (f + i) % 4;
    if (k < 3) o.push(K(x + (k === 1 ? 0.8 : -0.4), y - k * 1.8, x + (k === 1 ? -0.4 : 0.8), y - k * 1.8 - 3.4, 0.7, 0.45, 'scr_chariotHeat', { ol: false, occ: false }));
  });
  // sparks rising off the core
  for (let i = 0; i < 6; i++) {
    const y = (hash2(i, 61) * 50 + f * 3.5 * (1 + (i % 2))) % 50, x = cx - 22 + hash2(i, 67) * 26 + y * 0.1;
    o.push(X(x, cy - 12 - y, 0.8, 0.8, i % 3 ? 'emFire:4' : 'emFireCore:5', { em: true }));
  }
  // the sun lights everything
  o.push(Lt(cx, cy, 92, '#e89a44', 0.75 * p, 14));
  return o;
}

/**
 * A long low salamander of cooling magma crawling out of the obsidian: a broad flat head lowered, an ember eye slit under a
 * lid of crust, the mouth a seam of molten fire. A crest of flame streams back along the spine, its ember-tracks burning behind.
 */
export function glodPortrait(f: number): PrimTree {
  const b = breath(f);
  const p = [1, 1.1, 1.18, 1.06][f % 4];
  const pu = (p - 1) / 0.18;
  const o: Out = [];
  const BG = 'scr_gGlod', CR = 'scr_glodCrust', CD = 'scr_glodCrustDark', MAW = 'scr_glodMaw';
  const ci = -0.34 + pu * 0.3; // how bright the cracks burn
  const seam = (pts: number[], w: number, tf: (x: number, y: number) => Pt = (x, y) => [x, y], ink = ci): void => {
    for (let i = 0; i < pts.length - 2; i += 2) {
      const [a, c] = tf(pts[i], pts[i + 1]), [d, e] = tf(pts[i + 2], pts[i + 3]);
      o.push(K(a, c, d, e, w, w * 0.8, 'emFire', { ink, occ: false, ol: false }));
    }
  };
  // a tongue of flame: dark red edge, orange body, yellow heart
  const flame = (x: number, y: number, ux: number, uy: number, h: number, L: number, w: number): void => {
    const nx = -uy, ny = ux;
    const at = (a: number, s: number, c: number): Pt => [x + nx * h * a + ux * (L * s + c), y + ny * h * a + uy * (L * s + c)];
    const tip = at(1, 1, 0), m1 = at(0.5, 0.25, -w * 0.6), m2 = at(0.45, 0.6, w * 0.7);
    o.push(P([x - ux * w, y - uy * w, ...m1, ...tip, ...m2, x + ux * w, y + uy * w], 'emFire', { ink: -0.6 }));
    const i1 = at(0.45, 0.25, -w * 0.3), it = at(0.82, 0.8, 0), i2 = at(0.4, 0.55, w * 0.4);
    o.push(P([x - ux * w * 0.7, y - uy * w * 0.7, ...i1, ...it, ...i2, x + ux * w * 0.7, y + uy * w * 0.7], 'emFire', { ink: -0.2 }));
    const c1 = at(0.5, 0.3, 0);
    o.push(P([x - ux * w * 0.4, y - uy * w * 0.4, ...c1, x + ux * w * 0.4, y + uy * w * 0.4], 'emFireCore', { ink: -0.14 }));
  };
  // the obsidian floor, glassy and black, seamed with fire
  o.push(
    ground(BG, 30, 24, 76, 60),
    P([-1, 76, 40, 72, 97, 70, 97, 97, -1, 97], BG, { ink: BAND[1] + 0.03 }),
  );
  seam([50, 96, 60, 92, 70, 95, 80, 91, 97, 93], 0.5, undefined, -0.54 + pu * 0.1);
  seam([70, 80, 78, 82, 88, 78], 0.4, undefined, -0.58);
  // the ember-tracks behind it: a footprint still burning, an older one going out
  const track = (x: number, y: number, s: number, ink: number): void => {
    o.push(E(x, y, 4.4 * s, 1.7 * s, 'emFire', { fl: 1, ink }));
    for (const [dx, dy] of [[-4, -1.6], [-1.4, -2.6], [1.8, -2.4], [4.4, -1]]) o.push(E(x + dx * s, y + dy * s, 1.2 * s, 0.8 * s, 'emFire', { fl: 1, ink }));
  };
  track(7, 92, 1, -0.4 + pu * 0.14);
  track(2, 80, 0.75, -0.6);

  const by = -b * 0.4;
  // the crest of flame along the spine: one burning ridge, its tongues streaming back
  const sp: number[][] = [];
  for (let i = 0; i <= 8; i++) sp.push(qpt([48, 38 + by], [26, 22], [-2, 14], i / 8));
  o.push(P([...sp.flatMap(([x, y, dx, dy]) => { const l = Math.hypot(dx, dy); return [x - (dy / l) * 4.4, y + (dx / l) * 4.4]; }), ...sp.slice().reverse().flatMap(([x, y]) => [x, y + 3])], 'emFire', { ink: -0.5 }));
  for (let i = 0; i < 7; i++) {
    const t = 0.02 + i * 0.145 + hash2(i, 7) * 0.03;
    const [x, y, dx, dy] = qpt([48, 38 + by], [26, 22], [-2, 14], t);
    const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const k = (f + i * 3) % 4;
    const h = (7 + hash2(i, 11) * 7 + (1 - Math.abs(t - 0.3)) * 5) * [1, 1.16, 0.84, 1.06][k];
    const L = (15 + hash2(i, 13) * 7) * [1, 1.2, 0.84, 1.08][(f + i * 2) % 4];
    flame(x, y, ux, uy, h, L, 4.4);
  }
  // the long body, crawling out of the dark
  o.push(
    K(-6, 20, 14, 31, 10, 11.6, CR, { ink: -0.22 }),
    K(14, 31, 30, 42, 11.6, 12.6, CR, { ink: -0.16 }),
    K(30, 42, 42, 52, 12.6, 12, CR, { ink: -0.1 }),
  );
  seam([2, 20, 6, 27, 4, 35], 0.5);
  seam([14, 28, 18, 36, 15, 45], 0.55);
  seam([18, 36, 27, 38], 0.5);
  seam([30, 38, 33, 46, 30, 56], 0.6);
  seam([33, 46, 42, 47], 0.5);

  // the near foreleg: elbow out, the foot planted in its own fire
  o.push(
    K(42, 60, 24, 70, 6.4, 5.2, CR, { ink: -0.06 }),
    K(24, 70, 27, 85, 5.2, 4, CR, { ink: -0.02 }),
  );
  seam([36, 62, 27, 69, 28, 79], 0.5);
  for (let i = 0; i < 4; i++) {
    const k = (f + i) % 4, h = [8, 11, 7, 10][k] - (i % 2) * 2, lean = [-0.2, -0.36, -0.1, -0.28][(k + i) % 4];
    flame(17 + i * 6, 91, -Math.cos(lean), -Math.sin(lean), h, 1.2, 2.6);
  }
  o.push(E(27, 90, 8.4, 2.8, CR, { fl: 0.3, ink: -0.04 })); // the foot
  for (const [dx, dy] of [[-6, 0.6], [-2.4, 2], [2, 2.2], [6, 0.8]]) {
    o.push(
      K(27 + dx * 0.6, 90 + dy * 0.4, 27 + dx * 1.45, 90 + dy * 1.3, 1.5, 0.8, CR),
      E(27 + dx * 1.5, 90 + dy * 1.35, 0.8, 0.6, CD),
    );
  }

  // the head, lowered at you, in its own frame: x along the snout
  const H = frame(50, 52 + by, 0.2);
  const ht = (x: number, y: number): Pt => H.pt(x, y);
  o.push(
    H.E(10, 13, 18, 4, 'emFire', { fl: 0.7, ink: -0.52 + pu * 0.08 }), // the throat, thin crust over fire
    // the lower jaw, dropped a little: the gape glows
    H.P([-8, 6, 4, 8, 20, 10, 36, 9.6, 41, 11, 36, 14.4, 18, 16, 2, 15, -8, 12], CR, { bv: 2.4, ink: -0.22 }),
    H.P([-4, 4.4, 40, 2.6, 39, 9.6, 20, 10.2, 2, 8.4], MAW),
    H.P([2, 5.4, 32, 4, 31, 8.4, 18, 8.8, 4, 7.6], 'emFire', { ink: -0.3 + pu * 0.2 }),
    H.P([2, 6, 14, 5.4, 12, 8, 4, 7.6], 'emFireCore', { ink: -0.2 + pu * 0.2 }),
  );
  for (const [x, t] of [[12, 0.5], [22, 0.7], [30, 0.4]]) o.push(H.K(x, 4.4, x + t, 9.4, 0.3, 0.45, 'emFireCore', { occ: false })); // molten strings between the jaws
  // crust teeth: jagged, along both lips
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 4.3, hgt = 2 + hash2(i, 91) * 1.6;
    o.push(H.P([x - 1.2, 3.4, x + 1.2, 3.4, x + 0.3, 3.4 + hgt], CD, { bv: 0.4, ink: 0.02 }));
    if (i < 7) o.push(H.P([x + 1, 9.8, x + 3, 9.6, x + 1.8, 9.6 - hgt * 0.8], CD, { bv: 0.4, ink: -0.04 }));
  }
  // the skull: a flat wedge, cheek-plates, a rounded snout
  o.push(
    H.E(0, -1, 12, 10, CR, { fl: 0.2, ink: -0.08 }),
    H.P([-8, -7, 4, -11, 20, -10.6, 32, -7.6, 40, -4, 42.4, -0.6, 41, 2.6, 30, 3.6, 16, 3.8, 2, 4.2, -8, 4], CR, { bv: 3, ink: 0 }),
    H.E(2, -1.6, 7, 5, CR, { fl: 0.5, ink: -0.14 }), // the cheek-plate
  );
  seam([-6, -4, 0, -1, -2, 4], 0.5, ht);
  seam([0, -1, 8, 0], 0.45, ht);
  seam([24, -9.6, 26, -4, 22, 1], 0.5, ht);
  seam([26, -4, 34, -3], 0.45, ht);
  seam([10, 0, 16, 2.6], 0.4, ht);
  o.push(H.E(40, -2.2, 1.3, 0.8, MAW), H.E(40.2, -2.1, 0.7, 0.45, 'emFire', { ink: ci })); // nostril
  // crust spurs raking back off the skull
  for (const [x, y, ex, ey, r] of [[-2, -9, -12, -13, 2], [4, -10.4, -4, -16, 1.8], [-6, -4, -16, -6, 1.8]]) o.push(H.K(x, y, ex, ey, r, 0.4, CR, { ink: -0.06 }));
  // the eye: an ember with a slit pupil, under a heavy brow scowling down at the snout
  o.push(
    H.E(13, -6, 6, 4.6, CR, { fl: 0.25, ink: 0.04 }), // the turret
    H.E(13.6, -5.4, 4.6, 2.8, MAW, { fl: 0.6 }), // the socket
    H.E(14, -5, 3.4, 1.6, 'emFireCore', { ink: -0.04 + pu * 0.1 }),
    H.X(13.8, -6.4, 0.9, 2.8, '#1a0a06'), // the slit
    H.P([4, -12.4, 14, -12.2, 23, -7.6, 21.6, -4, 16, -5.4, 10, -6.4, 5, -6.8], CR, { bv: 1.2, ink: 0.1 }), // the brow
    H.K(6, -7, 20.6, -4.4, 0.35, 0.3, 'emFire', { ink: ci - 0.06, occ: false, ol: false }), // a burning rim under it
    H.Lt(14, -5, 9, '#ffb347', 0.28 * p, 5),
  );
  // molten drool off the lip
  const dr = [0, 2.4, 5.2, 8.4][f % 4];
  const [dx0, dy0] = H.pt(26, 10.4);
  o.push(E(dx0, dy0 + dr * 0.15, 1, 1.4 + dr * 0.2, 'emFireCore'));
  if (f % 4) o.push(E(dx0 + 0.2, dy0 + 2.6 + dr, 0.8, 1.2, 'emFire'));
  // embers rising off the crest
  for (let i = 0; i < 6; i++) {
    const y = (hash2(i, 81) * 40 + f * 2.6 * (1 + (i % 2))) % 40, x = 6 + hash2(i, 83) * 46 - y * 0.25;
    o.push(X(x, 30 - y, 0.8, 0.8, i % 3 ? 'emFire:4' : 'emFireCore:5', { em: true }));
  }
  // lights: the crest behind, the fire under its foot, the molten gape
  o.push(
    Lt(24, 14, 74, '#ff8026', 0.85 * p, 14),
    Lt(26, 92, 44, '#ff7a26', 0.65 * p, 10),
  );
  const [mx, my] = H.pt(16, 7);
  o.push(Lt(mx, my, 26, '#ff8a2c', 0.5 * p, 6));
  return o;
}
