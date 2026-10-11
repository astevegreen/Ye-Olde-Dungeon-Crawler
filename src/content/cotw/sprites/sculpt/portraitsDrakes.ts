import { E, K, P, X, Lt, breath, hash2, type Prim, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9g, group B: the drakes. The Frost Drake, the Ancient Wyrm, the Grave-Wyrmling. Conventions: portraitKit.ts. */

/** A local frame: x along the snout, y down, pivot (px, py), scale k; dir -1 mirrors it to face left. */
function fr(px: number, py: number, ang: number, dir = 1, k = 1) {
  const c = Math.cos(ang) * k, s = Math.sin(ang) * k;
  const pt = (x: number, y: number): Pt => [px + dir * (x * c - y * s), py + x * s + y * c];
  const ea = (a: number): number => (dir === 1 ? ang + a : -(ang + a));
  return {
    pt,
    P: (pts: number[], m: string, o?: PrimOptions): Prim => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...pt(pts[i], pts[i + 1])); return P(out, m, o); },
    E: (x: number, y: number, rx: number, ry: number, m: string, o: PrimOptions = {}): Prim => { const [a, b] = pt(x, y); return E(a, b, rx * k, ry * k, m, { ...o, a: ea(o.a || 0) }); },
    K: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: string, o?: PrimOptions): Prim => { const a = pt(x1, y1), b = pt(x2, y2); return K(a[0], a[1], b[0], b[1], r1 * k, r2 * k, m, o); },
    X: (x: number, y: number, w: number, h: number, m: string, o?: PrimOptions): Prim => { const [a, b] = pt(x + w / 2, y + h / 2); return X(a - w / 2, b - h / 2, w, h, m, o); },
    Lt: (x: number, y: number, r: number, col: string, kk: number, z: number): Prim => { const [a, b] = pt(x, y); return Lt(a, b, r, col, kk, z); },
  };
}
type Frame = ReturnType<typeof fr>;

/** An icicle or spine: base centre (x, y), out along (ux, uy), base half-width w, length h; a lit facet and a far one. */
function icicle(x: number, y: number, ux: number, uy: number, w: number, h: number, m: string, ink = 0, bend = 0): Prim[] {
  const nx = -uy, ny = ux;
  const tx = x + ux * h + nx * bend, ty = y + uy * h + ny * bend;
  const mx = x + ux * h * 0.45 + nx * bend * 0.3, my = y + uy * h * 0.45 + ny * bend * 0.3;
  return [
    P([x - nx * w, y - ny * w, mx - nx * w * 0.55, my - ny * w * 0.55, tx, ty, mx + nx * w * 0.55, my + ny * w * 0.55, x + nx * w, y + ny * w], m, { bv: 0.9, ink }),
    P([x, y, mx + nx * w * 0.08, my + ny * w * 0.08, tx, ty, mx + nx * w * 0.55, my + ny * w * 0.55, x + nx * w, y + ny * w], m, { bv: 0.6, ink: ink - 0.3 }),
  ];
}

// ================================================================= FROST DRAKE
/**
 * The rime-worm: wingless, its neck one long bow, a ridge of icicles from the crown down the back, and a breath
 * that smokes and pours like the rime of Élivágar that filled Ginnungagap. It yields only to flame, as the rime
 * did to Muspell's sparks. Its breath is the light.
 */
export function frostDrakePortrait(f: number): PrimTree {
  const b = breath(f);
  const pf = [1, 1.08, 0.94, 1.04][f % 4];
  const o: Out = [];
  const BG = 'scr_gFrostDrake', SC = 'scr_frostDrakeScale', BL = 'scr_frostDrakeBelly', ICE = 'scr_frostDrakeIce', MAW = 'scr_frostDrakeMaw', TH = 'scr_frostDrakeTooth', BR = 'scr_frostDrakeBreath';
  // the ground: the dark of the chasm, the cold glow of the breath low at the left
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(34, 44, 64, 62, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(24, 56, 34, 36, BG, { fl: 1, ink: BAND[3] }));
  // icicles hanging from the roof of the chasm, far off
  for (const [x, w, len, ink] of [[4, 4, 22, BAND[2]], [12, 2.6, 12, BAND[2] + 0.06], [30, 3, 16, BAND[2]], [40, 2, 9, BAND[2] + 0.08], [88, 4.4, 26, BAND[2] + 0.04], [96, 3, 14, BAND[2]]]) {
    o.push(P([x - w, -1, x + w, -1, x + w * 0.1, len], BG, { ink }));
  }
  // a rimed ledge of the chasm, bottom left
  o.push(P([-1, 82, 12, 79, 26, 81, 40, 86, 52, 97, -1, 97], BG, { ink: BAND[2] + 0.06 }));
  o.push(P([-1, 82, 12, 79, 26, 81, 40, 86, 38, 87.6, 26, 83.4, 12, 81.4, -1, 84.4], BG, { ink: BAND[4] }));
  // the cold it breathes, pooled in a low bank over the ledge
  const fw = (y0: number, amp: number, ph: number): number[] => { const pts: number[] = []; for (let x = -1; x <= 70; x += 7) pts.push(x, y0 + Math.sin(x * 0.21 + ph) * amp - (x > 40 ? (x - 40) * 0.2 : 0)); return pts; };
  o.push(P([...fw(88, 1.6, f * 0.5), 70, 97, -1, 97], BG, { ink: BAND[3] + 0.04 }));
  o.push(P([...fw(91.6, 1.2, f * 0.5 + 2), 70, 97, -1, 97], BG, { ink: BAND[2] + 0.06 }));

  const by = -b * 0.5;
  // the neck: one long bow rising from below right, the head lowered at the end of it
  const n0: Pt = [72, 108], n1: Pt = [92, 50], n2: Pt = [62, 28 + by];
  const nr = (t: number): number => 13.5 - t * 5.5;
  // the outer side of the bow (right, then up), unit vectors
  const side = (t: number): [number, number, number, number, number, number] => { const [x, y, tx, ty] = qpt(n0, n1, n2, t), l = Math.hypot(tx, ty); return [x, y, tx / l, ty / l, -ty / l, tx / l]; };
  // the icicle ridge down the outside of the bow, swept back toward the tail
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.1, [x, y, ux, uy, nx, ny] = side(t), r = nr(t);
    const len = 9 + Math.sin(t * Math.PI) * 6 + hash2(i, 3) * 4;
    const ox = nx * 0.8 - ux * 0.6, oy = ny * 0.8 - uy * 0.6, ol = Math.hypot(ox, oy);
    o.push(icicle(x + nx * r * 0.7, y + ny * r * 0.7, ox / ol, oy / ol, 2.6 + (1 - t) * 0.6, len, ICE, -0.1 - (1 - t) * 0.26, -1.6));
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, [x, y] = qpt(n0, n1, n2, t);
    o.push(E(x, y, nr(t), nr(t) * 1.05, SC, { fl: 0.1, ink: -0.14 - (1 - t) * 0.2 }));
  }
  // scales, row by row from the tail up, each lapping the one behind it: a dark free edge, then the scale
  for (let i = 0; i <= 11; i++) {
    const t = 0.08 + (i / 11) * 0.8, [x, y, ux, uy, nx, ny] = side(t), r = nr(t);
    for (let j = -1; j <= 1; j++) {
      const k = (j + (i % 2) * 0.5 - 0.25) / 2.2;
      const sz = 3.6 - t * 1, sx = x + nx * r * k * 0.92, sy = y + ny * r * k * 0.92, a = Math.atan2(uy, ux) + Math.PI / 2;
      const ink = -0.16 - (1 - t) * 0.22 + hash2(i, j + 4) * 0.05;
      o.push(E(sx - ux * 0.9, sy - uy * 0.9, sz * 1.05, sz * 0.78, SC, { fl: 0.4, a, ink: ink - 0.34 }));
      o.push(E(sx, sy, sz * 1.0, sz * 0.72, SC, { fl: 0.45, a, ink }));
    }
  }
  // the throat plates down the inside of the bow, pale
  for (let i = 0; i <= 15; i++) {
    const t = (i / 15) * 0.92, [x, y, ux, uy, nx, ny] = side(t), r = nr(t);
    o.push(E(x - nx * r * 0.62, y - ny * r * 0.62, r * 0.36, 2.7, BL, { a: Math.atan2(uy, ux) + Math.PI / 2, fl: 0.2, ink: -0.1 - (1 - t) * 0.34 }));
  }

  // the head, lowered at you, facing left: x along the snout
  const HK = 1.22, H = fr(60, 25 + by, 0.42, -1, HK);
  // spines out along a direction given in the head's own frame
  const hSpine = (x: number, y: number, ax: number, ay: number, w: number, h: number, ink: number, bend: number, F: Frame = H): Prim[] => {
    const [bx, bby] = F.pt(x, y), [ex, ey] = F.pt(x + ax, y + ay), ux = ex - bx, uy = ey - bby, l = Math.hypot(ux, uy);
    return icicle(bx, bby, ux / l, uy / l, w * HK, h * HK, ICE, ink, bend * HK);
  };
  // the horns: two of ice, swept back
  o.push(strand(...H.pt(2, -7), ...H.pt(-12, -14), ...H.pt(-30, -15), 2.4 * HK, 0.5, ICE, 4, { ink: -0.14 }));
  o.push(strand(...H.pt(6, -8), ...H.pt(-4, -18), ...H.pt(-16, -26), 2 * HK, 0.4, ICE, 4, { ink: 0.02 }));
  // the crest of icicles from the crown
  for (const [x, y, ax, ay, w, h] of [[-4, -8, -0.6, -1, 2, 9], [-9, -6, -0.8, -0.9, 2.2, 10], [-13, -3, -1, -0.5, 2.2, 9]]) o.push(hSpine(x, y, ax, ay, w, h, -0.04, 1));
  // the skull, the cheek, the frill of ice spines at the back of the jaw
  o.push(H.E(1, 0, 11.5, 9, SC, { fl: 0.15, ink: -0.02 }));
  for (const [y, a, h] of [[2, 0.3, 7], [6, 0.6, 8], [10, 0.9, 6]]) o.push(hSpine(-6, y, -Math.cos(a), Math.sin(a), 1.8, h, -0.2, 0.6));
  // the lower jaw, dropped open, and the dark of the mouth
  const jo = 0.36 + [0, 0.02, 0.04, 0.02][f % 4];
  const J = fr(...H.pt(-1, 5), 0.42 + jo, -1, HK);
  o.push(J.P([-3, -2, 10, -1.6, 22, -1, 29, 0, 30, 2.6, 23, 4.2, 10, 5.4, 0, 6, -4, 3], SC, { bv: 2.4, ink: -0.08 }));
  o.push(J.P([4, 3.4, 26, 2.6, 29, 1.6, 22, 4.4, 10, 5.6], BL, { ink: -0.06 })); // the pale underside of the jaw
  o.push(P([...H.pt(-1, 4.6), ...H.pt(30, 3.2), ...J.pt(28, -0.6), ...J.pt(0, -1.2)], MAW));
  // teeth: needles of ice on both jaws
  for (let i = 0; i < 7; i++) { const x = 6 + i * 3.6; o.push(H.P([x - 0.8, 3.6, x + 0.8, 3.6, x + 0.1, 3.6 + (i === 5 ? 4.4 : 2.4)], TH, { bv: 0.4 })); }
  for (let i = 0; i < 6; i++) { const x = 8 + i * 3.6; o.push(J.P([x - 0.8, -0.8, x + 0.8, -0.8, x, -0.8 - (i === 4 ? 3.6 : 2.2)], TH, { bv: 0.4, ink: -0.1 })); }
  // the upper jaw and snout
  o.push(H.P([-2, -8.6, 8, -9.6, 14, -9, 20, -6.8, 25, -5.4, 30, -5.2, 34, -3, 35.4, 0.4, 33.6, 3.2, 26, 4, 12, 4.6, 0, 5.4, -6, 3], SC, { bv: 3, ink: 0.02 }));
  o.push(H.K(20, -6.2, 33, -3.2, 0.5, 0.4, SC, { ink: 0.16 })); // the ridge of the snout
  o.push(H.E(31.2, -3.4, 2.6, 1.8, SC, { ink: 0.04 })); // the boss over the nostril
  o.push(H.K(31.6, -1.4, 34, -0.2, 0.7, 0.5, MAW)); // nostril
  // the cheek: a hard ridge from under the eye to the hinge, its underside in shade
  o.push(H.K(18, 1.2, 0, 2.8, 1.6, 2.2, SC, { ink: -0.22 }));
  o.push(H.K(19, 0, 1, 1, 0.9, 1.2, SC, { ink: 0.12 }));
  // icicles of frozen breath hanging from the chin
  for (const [x, h] of [[24, 6], [27, 9], [29.5, 5]]) o.push(hSpine(x, 4.2, 0, 1, 0.8, h, -0.06, 0.4, J));
  // the eye: sunk in a shaded socket, a slit of frost-light, the brow scowling down over it
  o.push(H.E(15.2, -2.6, 6, 2.6, 'scr_frostDrakeShade', { fl: 0.6, a: 0.14 }));
  o.push(H.E(15.4, -2.4, 4.2, 1.3, MAW, { fl: 0.8, a: 0.16 }));
  o.push(H.P([11.2, -3.2, 14.2, -3.6, 19.8, -1.6, 15, -1.4], 'emFrost', { ink: -0.4 + (pf - 1) * 0.6 }));
  o.push(H.P([13.2, -3.2, 15.6, -3.2, 17.6, -2, 15, -2], 'emFrost', { ink: -0.02 }));
  o.push(H.X(14.2, -3.4, 0.9, 0.9, '#ffffff', { em: true }));
  o.push(H.P([2, -10.6, 12, -10.6, 22, -6.6, 23.4, -1.6, 17, -3, 9, -4.4, 3, -6.2], SC, { bv: 1.6, ink: 0.12 }));
  for (const [x, y, h] of [[6, -10, 5], [11, -10, 4.4], [16, -8.6, 3.4]]) o.push(hSpine(x, y, -0.8, -0.7, 1.1, h, 0, 0.4));
  o.push(H.Lt(15.6, -2.4, 8, '#9fe6ff', 0.24 * pf, 3));

  // the breath: cold, so it sinks; it smokes out of the jaws in a lumpy cloud that thins as it falls
  const [mx, my] = H.pt(28, 6.5);
  const mo = { fl: 1, ol: false, occ: false };
  const billows = [[-18, 34, 5, -0.6], [-9, 33, 4, -0.62], [-19, 25, 5.6, -0.48], [-11, 27, 4.6, -0.5], [-16, 17, 5.4, -0.36], [-8, 19, 4, -0.38], [-12, 10, 5, -0.24], [-5, 9, 3.6, -0.26], [-7, 4, 4.2, -0.12], [-1.5, 1.4, 3.2, -0.02]];
  billows.forEach(([dx, dy, r, ink], i) => {
    const d = (f + i) % 4 * 0.5, x = mx + dx - d * 0.4, y = my + dy + d * 0.7, rr = r + [0, 0.3, 0.5, 0.2][(f + i) % 4];
    o.push(E(x + rr * 0.14, y + rr * 0.16, rr, rr * 0.84, BR, { ...mo, ink: ink - 0.2 }));
    o.push(E(x - rr * 0.12, y - rr * 0.14, rr * 0.8, rr * 0.66, BR, { ...mo, ink }));
    if (ink > -0.4) o.push(E(x - rr * 0.3, y - rr * 0.36, rr * 0.4, rr * 0.3, BR, { ...mo, ink: ink + 0.16 }));
  });
  // rime motes falling
  for (let i = 0; i < 6; i++) {
    const y = (hash2(i, 31) * 96 + f * 2.2 * (1 + (i % 2))) % 96, x = hash2(i, 33) * 90 + 3;
    o.push(X(x, y, 0.8, 0.8, i % 2 ? '#ffffff' : 'emFrost:4', { em: true }));
  }
  // the breath lights the jaw and throat from below
  o.push(Lt(mx - 4, my + 8, 44, '#9fe6ff', 0.95 * pf, 9));
  return o;
}

// ================================================================ ANCIENT WYRM
/**
 * Old as the hoard it lies on, like Fáfnir on Gnitaheiðr: bronze scale gone black, wings folded high behind it
 * like a hall's gables, the hunters of a thousand years written on it (pale scars across the snout and brow, a
 * horn snapped off, the stub of a spear in its throat, struck from below as Sigurd struck Fáfnir). The Song of
 * the Roots says the ancient wyrms sleep lightly over their hoards: one eye has opened on you. The fire in its
 * belly is banked, not out: it glows between the throat plates, smoulders in the nostril, and lights the jaw and
 * the hoard from below. The head is short, deep and heavy, its chin sunk on the hoard: not Níðhögg's long lean snout.
 */
export function ancientWyrmPortrait(f: number): PrimTree {
  const b = breath(f);
  const p = [1, 1.08, 1.15, 1.06][f % 4], pu = (p - 1) / 0.15;
  const o: Out = [];
  const BG = 'scr_gAncientWyrm', GW = 'scr_gAncientWyrmGlow', SC = 'scr_ancientWyrmScale', PL = 'scr_ancientWyrmPlate', HN = 'scr_ancientWyrmHorn', WG = 'scr_ancientWyrmWing', SR = 'scr_ancientWyrmScar', MAW = 'scr_ancientWyrmMaw', FG = 'scr_ancientWyrmFang', SM = 'scr_ancientWyrmSmoke';
  const spike = (x: number, y: number, ux: number, uy: number, w: number, h: number, m: string, ink = 0): Prim => { const l = Math.hypot(ux, uy); ux /= l; uy /= l; return P([x - uy * w, y + ux * w, x + ux * h, y + uy * h, x + uy * w, y - ux * w], m, { bv: 0.7, ink }); };
  // the ground: the cold dark of the lair, warmed low down by the fire under the jaw
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(54, 34, 56, 42, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(62, 102, 58, 32, GW, { fl: 1, ink: BAND[1] }));
  o.push(E(62, 102, 38, 20, GW, { fl: 1, ink: BAND[2] }));

  // the wings, folded high behind it: the far one at the right, the near one at the left
  o.push(P([66, 40, 86, 4, 97, 8, 97, 64, 91, 54, 85, 60, 79, 50], WG, { bv: 2, ink: -0.4 }));
  o.push(P([89, 30, 92, 28, 93, 35, 90, 36], BG, { ink: BAND[2] })); // a tear
  o.push(K(66, 40, 86, 4, 2.2, 1.5, HN, { ink: -0.5 }), K(86, 4, 97, 28, 1.1, 0.7, HN, { ink: -0.52 }), K(86, 4, 95, 58, 1, 0.6, HN, { ink: -0.56 }));
  o.push(K(86, 4, 81, -1, 1.3, 0.3, HN, { ink: -0.36 })); // the wrist claw
  o.push(P([22, 56, 12, 4, 4, 6, -1, 12, -1, 66, 8, 60, 14, 68], WG, { bv: 2, ink: -0.34 }));
  o.push(P([3, 34, 7, 32, 6, 38], BG, { ink: BAND[2] }), P([5, 50, 9, 47, 10, 52], BG, { ink: BAND[2] }));
  o.push(K(22, 56, 12, 4, 2.4, 1.6, HN, { ink: -0.42 }), K(12, 4, -1, 24, 1.1, 0.7, HN, { ink: -0.48 }), K(12, 4, -1, 50, 1, 0.6, HN, { ink: -0.5 }));
  o.push(K(12, 4, 16, -1, 1.4, 0.3, HN, { ink: -0.26 }));

  const by = -b * 0.4;
  // the neck, coming down out of the dark at the left, its throat plates seamed with fire
  o.push(K(30, 50 + by, 6, 104, 14, 21, SC, { ink: -0.44 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const t = 0.2 + i * 0.2, x = 30 - 24 * t - 9 + j * 6 + (i % 2) * 3, y = 50 + 54 * t - 2 + j * 3;
    o.push(E(x + 0.6, y + 0.8, 3, 2.2, SC, { a: 0.46, fl: 0.7, ink: -0.62 }), E(x, y, 2.8, 2, SC, { a: 0.46, fl: 0.7, ink: -0.44 + hash2(i, j) * 0.05 }));
  }
  const tA = [42, 68 + by], tB = [24, 104];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6, x = tA[0] + (tB[0] - tA[0]) * t, y = tA[1] + (tB[1] - tA[1]) * t;
    o.push(E(x, y, 9 + t * 3, 3.2 + t, PL, { a: 0.46, fl: 0.3, ink: -0.5 - t * 0.12 }));
  }
  for (let i = 1; i <= 6; i++) {
    const t = (i - 0.5) / 6, x = tA[0] + (tB[0] - tA[0]) * t, y = tA[1] + (tB[1] - tA[1]) * t, w = 7.6 + t * 3;
    o.push(K(x - w * 0.88, y - w * 0.44, x + w * 0.88, y + w * 0.44, 0.6, 0.6, 'emFire', { ink: -0.48 + pu * 0.16 - t * 0.16, occ: false }));
  }

  // the head, in its own frame: x along the snout, its chin sunk on the hoard, facing right.
  // Old and heavy: a deep blunt head, short in the muzzle, all brow, jowl and horn
  const HK = 1.12, H = fr(38, 44 + by, 0.2, 1, HK);
  const hs = (x: number, y: number, ux: number, uy: number, w: number, h: number, ink: number): Prim => { const [a, c] = H.pt(x, y), [d, e] = H.pt(x + ux, y + uy); return spike(a, c, d - a, e - c, w * HK, h * HK, HN, ink); };
  // the far horn, snapped off by some old blow
  o.push(strand(...H.pt(4, -11), ...H.pt(0, -16), ...H.pt(-4, -19), 3.6 * HK, 2.8 * HK, HN, 3, { ink: -0.46 }));
  o.push(P([...H.pt(-6.4, -17.2), ...H.pt(-7, -21), ...H.pt(-5, -19.8), ...H.pt(-4, -22.6), ...H.pt(-2.4, -20.4), ...H.pt(-2.6, -17.6)], 'boneOld', { ink: -0.26 }));
  // the near horns, swept back over the wing, the great one ringed with age
  const hb = H.pt(-6, -9), hc: Pt = [16, 24 + by], he: Pt = [2, 10 + by];
  o.push(strand(...H.pt(-10, -2), ...H.pt(-19, -5), ...H.pt(-27, -3), 3 * HK, 0.8, HN, 4, { ink: -0.24 }));
  o.push(strand(...hb, ...hc, ...he, 6, 1.4, HN, 5, { ink: -0.06 }));
  for (let i = 1; i <= 4; i++) { const [x, y, tx, ty] = qpt(hb, hc, he, i / 5), l = Math.hypot(tx, ty), r = 6 - i * 0.9; o.push(K(x + (ty / l) * r, y - (tx / l) * r, x - (ty / l) * r, y + (tx / l) * r, 0.45, 0.45, HN, { ink: -0.4 })); }
  // the frill of spikes at the hinge of the jaw
  for (const [x, y, ux, uy, h] of [[-12, 3, -1, -0.4, 9], [-13, 9, -1, 0.05, 10], [-11, 15, -1, 0.5, 8]]) o.push(hs(x, y, ux, uy, 2, h, -0.22));
  // the beard of spikes under the jaw, resting on the hoard
  for (const [x, h] of [[6, 8], [18, 9], [30, 7]]) o.push(hs(x, 19.4 - x * 0.06, -0.5, 1, 2.4, h, -0.42));
  // the lower jaw, shut: deep and heavy
  o.push(H.P([-10, 7, 4, 9.4, 20, 10, 34, 10, 40, 9.4, 42.4, 11.6, 39, 15.6, 28, 18, 16, 19.6, 4, 20, -6, 18, -12, 13], SC, { bv: 3, ink: -0.16 }));
  // the skull
  o.push(H.E(0, -0.5, 15, 13, SC, { fl: 0.15, ink: -0.04 }));
  // the muzzle: short, deep and blunt, its bridge in the light, the far brow showing beyond it
  o.push(H.K(10, -1.4, 32, 1.4, 11, 8.2, SC, { ink: 0.02 }));
  o.push(H.P([17, -9.4, 27, -8.6, 34, -6.6, 37.4, -4.6, 33, -4.4, 25, -6.2, 18, -7.2], SC, { bv: 1.2, ink: 0.08, n: [-0.25, -0.6, 0.76] }));
  o.push(H.E(35.4, 0.6, 7.2, 6.6, SC, { fl: 0.1, ink: 0.02 })); // the nose
  o.push(H.E(40, 1.8, 2, 1.4, MAW, { a: -0.4, ink: -0.5 })); // the nostril, the banked fire smouldering in it
  o.push(H.E(40.2, 2, 1.1, 0.7, 'emFire', { a: -0.4, ink: -0.3 + pu * 0.2 }));
  o.push(H.E(-3, 7, 11, 9.6, SC, { fl: 0.25, ink: -0.08 })); // the heavy jowl
  o.push(H.K(5, 1.6, -11, 0.4, 1.6, 2.4, SC, { ink: 0.04 })); // the cheekbone, ridged back to the frill
  // the mouth, shut on its fangs
  o.push(H.K(-7, 8.6, 41, 9.4, 0.8, 0.6, MAW, { occ: false, ink: -0.5 }));
  for (const [x, h] of [[8, 3], [15, 4], [22, 7.4], [29, 4.4], [35, 3.6], [39.4, 2.8]]) o.push(H.P([x - 1.2, 8.6, x + 1.2, 8.6, x + 0.2, 8.6 + h], FG, { bv: 0.6, ink: -0.04 }));
  for (const [x, h] of [[18, 3.6], [32, 4.4]]) o.push(H.P([x - 1.1, 10.2, x + 1.1, 10.2, x + 0.1, 10.2 - h], FG, { bv: 0.5, ink: -0.12 }));
  // the brow: a heavy arch scowling down over the eye, a spur raking back off it
  o.push(H.K(-1, -9.4, 19.6, -6.2, 4.4, 2.6, SC, { ink: 0.1 }));
  o.push(hs(-5, -9, -1, -1, 2.4, 9, -0.08));
  // the gouges of old blades: one down across the muzzle, one through the brow
  for (const [x0, y0, x1, y1] of [[23, -9.6, 31, 0.4], [6, -12.2, 10.4, -6.6]]) o.push(H.K(x0, y0, x1, y1, 0.7, 0.5, SR, { ink: -0.12 })); // healed pale
  // the eye: an ember slit under a heavy lid, opened on you
  const lid = [0, 0, 0.4, 0.15][f % 4];
  o.push(H.E(12.6, -2.2, 6.4, 3, MAW, { fl: 0.7, a: 0.06, ink: -0.5 }));
  o.push(H.P([7, -2.2, 11, -3.8 + lid, 16.6, -3.2 + lid, 18.4, -1.6, 12.6, -0.8, 8.6, -1.1], 'emFire', { ink: -0.3 + pu * 0.1 }));
  o.push(H.P([10.2, -2.8 + lid, 14, -3 + lid, 15.6, -1.6, 11.6, -1.4], 'emFireCore', { ink: -0.2 + pu * 0.1 }));
  o.push(X(...H.pt(12.6, -3.6 + lid), 0.8, 2.8, '#2a0f06'));
  o.push(H.K(6.6, -4 + lid, 18.4, -3.4 + lid, 1.1, 0.9, SC, { ink: -0.02 })); // the lid's heavy edge
  o.push(H.K(8.2, -0.4, 17.2, -0.6, 0.6, 0.5, SC, { ink: -0.14 })); // the lower lid
  o.push(H.Lt(12.6, -2.4, 10, '#ffa040', 0.35 * p, 3));

  // smoke curling from the nostril
  const [nx, ny] = H.pt(40.6, 1.4), sw = [0, 0.6, 1, 0.4][f % 4];
  o.push(strand(nx + 1, ny - 1, nx + 6 + sw, ny - 8, nx + 2 + sw * 1.4, ny - 15, 0.9, 1.6, SM, 4, { ink: -0.36, occ: false }));
  o.push(strand(nx + 2 + sw * 1.4, ny - 15, nx - 3 + sw, ny - 21, nx + 1 + sw * 2, ny - 28, 1.6, 0.8, SM, 4, { ink: -0.5, occ: false }));

  // the stub of a hunter's spear in the throat, struck from below as Sigurd struck Fáfnir, and snapped
  o.push(K(30, 84, 45, 93, 1.1, 1, 'woodDark', { ink: -0.06 }));
  o.push(P([44, 91.4, 47.6, 92, 46, 93.4, 47.4, 95, 44.4, 94.4], 'wood', { ink: 0 }));
  // the hoard under its chin: the gear of hunters who came for it
  o.push(K(30, 94, 64, 86, 1.3, 1.1, 'steel', { ink: -0.4 })); // a broken blade
  o.push(K(26, 95.4, 31, 94.2, 1.8, 1.8, 'woodDark', { ink: -0.1 })); // its grip
  o.push(K(84, 84, 98, 80, 0.9, 0.9, 'wood', { ink: -0.3 })); // a spear-shaft
  o.push(E(78, 90, 8, 7, 'iron', { fl: 0.1, ink: -0.3 }), K(70, 91.6, 86, 91.6, 1, 1, 'iron', { ink: -0.44 }), K(78, 84, 78, 96, 0.8, 0.8, 'iron', { ink: -0.24 })); // a helm
  o.push(E(91, 89, 4.4, 4, 'boneOld', { ink: -0.2 }), E(89.6, 89.4, 1.2, 1.1, MAW, { ink: -0.5 }), E(92.8, 89.2, 1.1, 1.1, MAW, { ink: -0.5 })); // a skull
  for (const [x, y] of [[48, 92], [54, 95], [66, 96], [60, 92.6], [96, 95], [40, 96]]) o.push(E(x, y, 2, 1.2, 'bronze', { fl: 0.5, ink: -0.24 }), E(x, y - 0.2, 0.9, 0.5, MAW, { ink: -0.5 }));

  // the banked fire in the throat lights the jaw and the hoard from below
  o.push(Lt(48, 64 + by, 50, '#ff8a2c', 0.9 * p, 12));
  o.push(H.Lt(41, 3, 8, '#ff8a2c', 0.35 * p, 3));
  return o;
}

// ============================================================== GRAVE-WYRMLING
/**
 * One of Níðhögg's brood, like the sons of Grafvitnir the Grímnismál counts under the Ash: a whelp still all
 * head, crouched over a skull on Náströnd, where its sire sucks the corpses of the dead. Its wings are stubs that
 * will never carry it. It rears back its neck to spit: the jaws wide on needle teeth and a string of bile, and
 * the bile welling in its throat is its light.
 */
export function graveWyrmlingPortrait(f: number): PrimTree {
  const b = breath(f);
  const gl = [1, 1.08, 1.16, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gGraveWyrmling', SC = 'scr_graveWyrmlingScale', BL = 'scr_graveWyrmlingBelly', WG = 'scr_graveWyrmlingWing', BN = 'scr_graveWyrmlingBone';
  const MAW = 'scr_graveWyrmlingMaw', GU = 'scr_graveWyrmlingGum', TH = 'scr_graveWyrmlingTooth', SK = 'scr_graveWyrmlingSkull';
  // the ground: the dark of Náströnd's hall, its walls woven of serpents' backs
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(58, 40, 58, 50, BG, { fl: 1, ink: BAND[2] }));
  for (const [ax, ay, cx, cy, ex, ey, ph] of [[-2, 20, 30, -6, 98, 10, 0], [-2, 4, 52, 30, 98, -2, 3]]) {
    o.push(strand(ax, ay, cx, cy, ex, ey, 3.6, 3.6, BG, 6, { ink: BAND[2] + 0.05 }));
    for (let i = 1; i < 12; i++) { const [x, y, tx, ty] = qpt([ax, ay], [cx, cy], [ex, ey], i / 12 + ph * 0.01), l = Math.hypot(tx, ty); o.push(K(x - ty / l * 3, y + tx / l * 3, x + tx / l * 1.6, y + ty / l * 1.6, 0.5, 0.5, BG, { ink: BAND[2] - 0.04 })); }
  }
  o.push(E(64, 44, 30, 31, BG, { fl: 1, ink: BAND[3] }));
  // venom dripping in through the roof-vents of the hall
  for (const [x, ph] of [[90, 0], [8, 2]]) {
    const y = ((f + ph) % 4) * 9 + 4;
    o.push(E(x, y, 0.7, 1.1, 'emPoison', { ink: -0.3 }));
  }

  const by = -b * 0.4;
  // the tail, curled up behind it at the left
  o.push(strand(14, 90, -6, 96, 2, 70, 4.4, 1.2, SC, 5, { ink: -0.36 }));
  // the far stub wing, behind
  o.push(P([38, 62, 35, 46, 33, 34, 37, 40, 41, 46, 43, 56], WG, { bv: 1.4, ink: -0.44 }));
  // the body crouched low over its kill, the haunch drawn up under it
  o.push(P([54, 70, 54, 82, 42, 90, 28, 95, 12, 96, 3, 88, 6, 76, 18, 68, 32, 62, 42, 62 + by * 0.5], SC, { bv: 8, ink: -0.2 }));
  // scales down the flank, each lapping the one behind it
  const backY = (x: number): number => (x < 18 ? 76 - (x - 6) * 0.667 : x < 32 ? 68 - (x - 18) * 0.43 : 62);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const x = 16 + c * 6 + (r % 2) * 3, y = backY(x) + 4.6 + r * 5;
    o.push(E(x + 0.8, y + 0.9, 3, 2.2, SC, { a: -0.3, fl: 0.8, ink: -0.44 }), E(x, y, 2.8, 2, SC, { a: -0.3, fl: 0.8, ink: -0.24 + hash2(r, c) * 0.05 }));
  }
  // the spines down its back, small and hooked
  for (const [x, y, ux, uy, h] of [[40, 62.4, -0.3, -1, 3.4], [33, 63.2, -0.45, -1, 4], [26, 65.4, -0.55, -1, 3.8], [19, 68.4, -0.7, -1, 3.4], [12.4, 72, -0.9, -1, 3], [7, 77, -1, -0.7, 2.4]]) {
    const l = Math.hypot(ux, uy); o.push(icicle(x, y, ux / l, uy / l, 1.5, h, SC, -0.26, -0.5));
  }
  // the haunch drawn up under it, the hind foot splayed on the bones
  o.push(E(16, 82, 10, 10.4, SC, { fl: 0.45, ink: -0.14 }));
  o.push(K(9, 86, 7, 93, 4.6, 3.2, SC, { ink: -0.24 }), K(7, 94, 22, 95, 3, 2.2, SC, { ink: -0.2 }));
  for (const [x, y] of [[22, 94], [24, 95.4]]) o.push(K(x, y, x + 2.8, y + 1.2, 0.8, 0.3, BN, { ink: -0.26 }));
  for (let i = 0; i < 4; i++) { const t = i / 3; o.push(E(30 + t * 18, 92 - t * 7, 3.8, 2, BL, { a: -0.36, fl: 0.4, ink: -0.36 })); }
  // the near stub wing, half raised: too small ever to carry it
  o.push(P([30, 64, 23, 50, 15, 36, 11, 41, 7, 47, 10, 49.6, 9, 56, 13, 56.4, 15, 61, 18, 60, 22, 65], WG, { bv: 2, ink: -0.2 }));
  o.push(K(30, 64, 23, 50, 1.6, 1.2, BN, { ink: -0.26 }), K(23, 50, 15, 36, 1.2, 0.9, BN, { ink: -0.22 }));
  o.push(K(15, 36, 7.4, 46.6, 0.7, 0.4, BN, { ink: -0.22 }), K(15, 36, 9.4, 55.4, 0.6, 0.4, BN, { ink: -0.26 }), K(15, 36, 15.4, 60.4, 0.6, 0.4, BN, { ink: -0.3 }));
  o.push(K(15, 36, 16, 30, 1, 0.2, BN, { ink: 0.04 })); // the wrist claw
  o.push(P([11.6, 50.6, 13.6, 48.8, 14, 52.4, 12.4, 53], BG, { ink: BAND[2] })); // a tear

  // the head, reared back to spit: x along the snout, facing right
  const HK = 1.25, H = fr(54, 34 + by, -0.14, 1, HK);
  // the neck, bent back like a drawn bow: a smooth tube, scales down its back, pale plates down its throat
  const n0: Pt = [46, 72], n1: Pt = [28, 54], n2 = H.pt(-5, 3);
  const nr = (t: number): number => 9.4 - t * 2.8;
  const side = (t: number): [number, number, number, number, number, number] => { const [x, y, tx, ty] = qpt(n0, n1, n2, t), l = Math.hypot(tx, ty); return [x, y, tx / l, ty / l, -ty / l, tx / l]; };
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6, [x0, y0] = qpt(n0, n1, n2, t0), [x1, y1] = qpt(n0, n1, n2, t1);
    o.push(K(x0, y0, x1, y1, nr(t0), nr(t1), SC, { ink: -0.14 }));
  }
  for (let i = 0; i <= 8; i++) {
    const t = 0.06 + i * 0.1, [x, y, ux, uy, nx, ny] = side(t), r = nr(t), a = Math.atan2(uy, ux) + Math.PI / 2;
    o.push(E(x - nx * r * 0.5 - ux, y - ny * r * 0.5 - uy, 2.6, 1.8, SC, { a, fl: 0.4, ink: -0.46 }));
    o.push(E(x - nx * r * 0.5, y - ny * r * 0.5, 2.5, 1.7, SC, { a, fl: 0.4, ink: -0.22 + hash2(i, 5) * 0.06 }));
    o.push(E(x + nx * r * 0.6, y + ny * r * 0.6, r * 0.34, 1.9, BL, { a, fl: 0.3, ink: -0.14 }));
  }
  // the chest, and the near foreleg reaching to clamp the skull
  o.push(E(47, 73, 9, 8.4, SC, { fl: 0.3, ink: -0.14 }));
  o.push(K(47, 75, 56, 85, 5.2, 3.8, SC, { ink: -0.12 }), K(56, 85, 65, 78.6, 3.6, 2.8, SC, { ink: -0.04 }));
  o.push(E(66.4, 78.4, 3.8, 2.8, SC, { a: 0.2, ink: 0 }));

  // the skull it crouches over, and a long bone
  o.push(K(48, 96, 97, 88, 2.2, 2.2, SK, { ink: -0.6 }));
  o.push(E(74, 84, 9.6, 8.6, SK, { fl: 0.15, ink: -0.24 }));
  o.push(P([66, 86, 82.6, 86, 81.4, 92, 77.4, 95.4, 70, 95.4, 67, 92], SK, { bv: 1.6, ink: -0.3 }));
  o.push(E(70.4, 87, 2.6, 2.5, MAW, { ink: -0.5 }), E(78.6, 87, 2.2, 2.4, MAW, { ink: -0.5 }));
  o.push(P([73.4, 89.6, 75.6, 89.6, 74.5, 92.4], MAW, { ink: -0.5 }));
  o.push(K(69.6, 93.6, 80, 93.4, 0.5, 0.5, MAW, { ink: -0.5 }));
  for (let i = 0; i < 4; i++) o.push(X(70.6 + i * 2.4, 92.6, 1.4, 1.6, SK + ':2'));
  o.push(K(77, 76.4, 79.6, 81.4, 0.4, 0.35, MAW, { ink: -0.5 })); // a crack
  // the claws hooked over its crown
  for (const [x0, y0, x1, y1] of [[68, 77, 72.4, 78.6], [69, 79.4, 72, 82], [67.6, 81, 69.4, 84.4]]) o.push(K(x0, y0, x1, y1, 0.9, 0.3, BN, { ink: -0.06 }));

  // the horns: two short hooks of bone, swept back
  o.push(strand(...H.pt(-2, -7), ...H.pt(-8, -13), ...H.pt(-15, -14), 2.2 * HK, 0.5, BN, 4, { ink: -0.06 }));
  o.push(strand(...H.pt(3, -8), ...H.pt(0, -14), ...H.pt(-5, -19), 1.8 * HK, 0.4, BN, 3, { ink: -0.24 }));
  // the frill of bone spikes at the back of the jaw
  for (const [y, dy] of [[0, -1], [4, 1], [8, 3]]) o.push(H.K(-7, y, -14, y + dy, 1.2, 0.2, BN, { ink: -0.16 }));
  // the skull: big for the body, as a whelp's is; the temple sunk behind the eye
  o.push(H.E(0, -0.5, 9.5, 8, SC, { fl: 0.15, ink: -0.04 }));
  o.push(H.E(-2, -0.4, 4.2, 4.4, SC, { fl: 0.7, ink: -0.2 }));
  // the open maw: its far gum slanting back from the front, the bile welling in the throat, the tongue
  const J = fr(...H.pt(-3, 4.6), -0.14 + 0.58, 1, HK);
  o.push(P([...H.pt(-4, 3.6), ...H.pt(20.5, 3), ...H.pt(18.4, 6.2), ...H.pt(15.6, 9.4), ...J.pt(16.6, -1.3), ...J.pt(-1, -1.6)], MAW, { ink: -0.5 }));
  o.push(P([...H.pt(20.5, 3), ...H.pt(18.4, 6.2), ...H.pt(15.6, 9.4), ...J.pt(16.6, -1.3), ...H.pt(14.8, 9.2), ...H.pt(17.4, 5.8)], GU, { ink: -0.34 })); // the far gum
  o.push(H.E(3.6, 5.2, 4.4, 1.8, 'emPoison', { ink: -0.22 + (gl - 1) * 0.5, a: 0.3 }));
  o.push(H.E(4, 5.4, 2.2, 1, 'emPoison', { ink: 0.1, a: 0.3 }));
  o.push(J.K(3, -2.2, 13, -2.8, 1.2, 0.7, GU, { ink: -0.12 }));
  o.push(J.K(13, -2.8, 16.4, -4.4, 0.5, 0.3, GU, { ink: -0.12 }), J.K(13, -2.8, 16.8, -2, 0.5, 0.3, GU, { ink: -0.12 }));
  // the lower jaw, dropped wide: a lean tapering jaw, its pale underside, a hook at the chin
  o.push(J.K(-2, 1.8, 20.4, 0.9, 3.6, 2.3, SC, { ink: -0.2 }));
  o.push(J.K(1, 4, 19, 2.6, 1.4, 0.8, BL, { ink: -0.3 }));
  o.push(J.P([19.4, -1.2, 23.4, -2.2, 22.4, 1, 20.6, 2.6], SC, { bv: 0.8, ink: -0.04 }));
  for (let i = 0; i < 5; i++) { const x = 4.4 + i * 3.6; o.push(J.P([x - 0.8, -1.2, x + 0.8, -1.2, x + 0.1, -1.2 - (i === 3 ? 3.8 : 2.2 + (i % 2) * 0.6)], TH, { bv: 0.4, ink: -0.08 })); }
  // the upper jaw: a short, blunt snout; the gum drawn back off the needle teeth
  o.push(H.K(4, -2.4, 21.6, -0.8, 6.2, 3.8, SC, { ink: 0 }));
  o.push(H.K(7, -7.4, 21.4, -3.6, 0.7, 0.5, SC, { ink: 0.16 })); // the bridge in the light
  o.push(H.E(21.2, -2.6, 2.6, 2, SC, { ink: 0.04 })); // the boss over the nostril
  o.push(H.K(21.8, -1.2, 24, -0.6, 0.6, 0.4, MAW, { ink: -0.5 })); // nostril
  o.push(H.P([20.6, -4, 22.4, -6.4, 23.4, -3.2], BN, { bv: 0.5, ink: -0.04 })); // the egg-tooth not yet shed
  o.push(H.K(1, 3.6, 22, 2.4, 0.8, 0.6, GU, { ink: -0.14 }));
  for (let i = 0; i < 6; i++) { const x = 3 + i * 3.4; o.push(H.P([x - 0.8, 3.2, x + 0.8, 3.2, x + 0.1, 3.4 + (i === 4 ? 4.8 : 2.4 + (i % 2) * 0.8)], TH, { bv: 0.4 })); }
  // a string of bile between the jaws
  const [sx0, sy0] = H.pt(11.2, 4.4), [sx1, sy1] = J.pt(9.6, -1.6);
  o.push(strand(sx0, sy0, (sx0 + sx1) / 2 - 1.6, (sy0 + sy1) / 2 + 0.6, sx1, sy1, 0.5, 0.36, 'emPoison', 3, { occ: false, ink: -0.16 }));
  // the eye: a bile-green slit sunk under a bony brow that scowls down over it
  o.push(H.E(9.8, -2.4, 4.8, 2.6, MAW, { fl: 0.7, a: 0.08, ink: -0.5 }));
  o.push(H.P([6, -3, 9, -3.8, 12.6, -3.2, 14.2, -1.8, 10.6, -1, 7, -1.6], 'emPoison', { ink: -0.32 + (gl - 1) * 0.5 }));
  o.push(H.P([8.4, -3.2, 11.4, -3.1, 12.4, -1.8, 9.4, -1.6], 'emPoison', { ink: -0.08 + (gl - 1) * 0.5 }));
  o.push(X(...H.pt(9.9, -3.9), 0.8, 2.6, '#0a1206'));
  o.push(H.K(6.4, -0.8, 13.4, -1, 0.55, 0.45, SC, { ink: 0.02 })); // the lower lid
  o.push(H.K(0, -6.6, 15.6, -3.6, 2.8, 1.6, SC, { ink: 0.1 })); // the brow ridge
  o.push(icicle(...H.pt(1, -7.4), -0.86, -0.5, 1.4, 5, BN, -0.1, -0.6)); // a spur off the brow
  o.push(H.Lt(9.8, -2.4, 9, '#b8f070', 0.3 * gl, 3));

  // bile drooling from the lower jaw onto the skull, where it smokes
  const [jx, jy] = J.pt(20.4, 2.4);
  o.push(K(jx, jy, jx + 0.3, jy + 5 + f * 0.5, 0.75, 0.45, 'emPoison', { occ: false, ink: -0.1 }));
  o.push(E(jx + 0.4, jy + 9 + f * 3.4, 0.9, 1.3, 'emPoison'));
  o.push(E(75, 77.4, 3.6, 1.2, 'emPoison', { fl: 0.8, ink: -0.2 }));
  for (let i = 0; i < 3; i++) o.push(X(73 + i * 2 + (f % 2), 75.6 - ((f + i) % 3) * 1.4, 0.8, 0.8, 'emPoison:4', { em: true }));
  o.push(Lt(75, 76, 14, '#95dc4c', 0.5 * gl, 3));
  // the bile in the throat lights the jaws and throat from inside
  o.push(H.Lt(4, 5.6, 28, '#a8e860', 0.75 * gl, 6));
  return o;
}
