import { E, K, P, X, Lt, T, breath, sway, hash2, type Prim, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9c, group C: Father Torvald, priest of Thor, and Bjorn the Town Guard. Conventions: portraitKit.ts. */

/** Zig-zag points from (x1, y1) to (x2, y2): n steps, amplitude amp. */
function zig(x1: number, y1: number, x2: number, y2: number, seed: number, n: number, amp: number): Pt[] {
  const pts: Pt[] = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i <= n; i++) {
    const t = i / n, odd = i % 2 ? 1 : -1;
    const j = i === n ? (hash2(seed, 9) - 0.5) * amp : (hash2(seed, i) - 0.5) * 2 * amp * odd + amp * 0.5 * odd;
    pts.push([x1 + dx * t + nx * j, y1 + dy * t + ny * j]);
  }
  return pts;
}

/** A bolt of lightning: a jagged main stroke tapering r0 -> r1, and a branch forking off it. */
function crackle(x1: number, y1: number, x2: number, y2: number, seed: number, n: number, amp: number, r0: number, r1: number, m: string): Prim[] {
  const out: Prim[] = [], pts = zig(x1, y1, x2, y2, seed, n, amp);
  for (let i = 1; i < pts.length; i++) {
    const t0 = (i - 1) / n, t1 = i / n;
    out.push(K(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, m, { occ: false }));
  }
  const k = 1 + Math.floor(hash2(seed, 17) * (n - 1)), [bx, by] = pts[k];
  const a = Math.atan2(y2 - y1, x2 - x1) + (hash2(seed, 19) > 0.5 ? 0.75 : -0.75), l = Math.hypot(x2 - x1, y2 - y1) * 0.45;
  const bp = zig(bx, by, bx + Math.cos(a) * l, by + Math.sin(a) * l, seed + 50, 3, amp * 0.7);
  for (let i = 1; i < bp.length; i++) out.push(K(bp[i - 1][0], bp[i - 1][1], bp[i][0], bp[i][1], r1 + 0.1, r1, m, { occ: false }));
  return out;
}

/** An eye looking right: socket shadow, white, iris, lid, glint; shut when blink. */
function eye(x: number, y: number, w: number, SK: string, WH: string, IR: string, blink: boolean, glint: string): Prim[] {
  const o: Prim[] = [];
  o.push(E(x, y - w * 0.18, w * 1.45, w * 0.92, SK, { fl: 0.85, ink: -0.32 }));
  if (blink) {
    o.push(K(x - w * 1.1, y + 0.1, x + w * 1.1, y + 0.2, w * 0.5, w * 0.45, SK, { ink: -0.12 }));
    o.push(K(x - w * 1.05, y + w * 0.45, x + w * 1.05, y + w * 0.5, 0.4, 0.35, SK, { ink: -0.5, occ: false }));
    return o;
  }
  o.push(E(x + 0.1, y + 0.15, w * 1.05, w * 0.55, WH));
  o.push(E(x + w * 0.42, y + 0.15, w * 0.55, w * 0.55, IR));
  o.push(K(x - w * 1.1, y - w * 0.42, x + w * 1.0, y - w * 0.5, w * 0.26, w * 0.2, SK, { ink: -0.38, occ: false })); // the lid's line
  if (glint) o.push(X(x + w * 0.2, y - w * 0.3, 0.7, 0.7, glint, { em: true }));
  return o;
}

/**
 * The goði of Thor's Hall, broad in his white robe and madder stole, a forked
 * dark beard ring-bound in gold under a high bald brow: he raises Thor's
 * hammer and its lightning lights his face; the gold Mjölnir on his breast
 * glows with the blessing he gives. A carved high-seat pillar stands behind.
 */
export function torvaldPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.82, 1.2, 0.92][f % 4];
  const o: Out = [];
  const BG = 'scr_gTorvald', HL = 'scr_haloTorvald', PL = 'scr_gTorvaldPillar';
  const SK = 'scr_torvaldSkin', HR = 'scr_torvaldHair', RB = 'scr_torvaldRobe', ST = 'scr_torvaldStole', GD = 'scr_torvaldGold';
  const hx = 80, hy = 19; // the hammer's head
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(62, 34, 66, 62, BG, { fl: 1, ink: BAND[2] }));
  // the high-seat pillar, carved in bands
  o.push(P([-1, -1, 13, -1, 13, 97, -1, 97], PL, { ink: BAND[1] }));
  o.push(P([8, -1, 13, -1, 13, 97, 8, 97], PL, { ink: BAND[2] }));
  for (const y of [10, 48]) { // bands carved as a twisted cable
    o.push(P([-1, y, 14, y, 14, y + 8, -1, y + 8], PL, { ink: BAND[2] }));
    for (let i = 0; i < 5; i++) o.push(K(i * 3.2 - 0.6, y + 6.6, i * 3.2 + 1.6, y + 1.4, 0.55, 0.55, PL, { ink: BAND[1], occ: false }));
  }
  // the lightning's halo
  o.push(E(hx, hy, 28, 26, BG, { fl: 1, ink: BAND[3] }));
  o.push(E(hx, hy, 19, 18, BG, { fl: 1, ink: BAND[4] }));
  o.push(E(hx, hy + 0.5, 14.5, 11, BG, { fl: 1, ink: BAND[5] }));
  o.push(E(hx, hy + 0.5, 12.4, 6.6, HL, { fl: 1, ink: BAND[5] })); // a white-hot corona hugging the head

  const by = -b * 0.5;
  const fx = 47, fy = 43 + by;
  // the robe: broad shoulders
  o.push(E(46, 108 + by * 0.8, 54, 38, RB, { fl: 0.25, ink: -0.06 }));
  for (const [ax, ay, cx, cy, ex, ey] of [[31, 76, 27, 87, 21, 99], [23, 75, 16, 82, 8, 93], [70, 78, 73, 88, 75, 99]]) o.push(strand(ax, ay, cx, cy, ex, ey, 1, 2.2, RB, 3, { ink: -0.2 })); // folds
  // the stole over both shoulders, gold-edged
  const stole = (pts: number[], e1: [number, number, number, number], e2: [number, number, number, number]): Prim[] => [P(pts, ST, { bv: 1.6 }), K(...e1, 0.6, 0.6, GD, { occ: false }), K(...e2, 0.6, 0.6, GD, { occ: false })];
  o.push(stole([fx - 15, fy + 22, fx - 8, fy + 24, fx - 8, 97, fx - 17, 97], [fx - 15, fy + 22, fx - 17, 97], [fx - 8, fy + 24, fx - 8, 97]));
  o.push(stole([fx + 9, fy + 22, fx + 15, fy + 21, fx + 18, 97, fx + 10, 97], [fx + 9, fy + 22, fx + 10, 97], [fx + 15, fy + 21, fx + 18, 97]));
  const h: Out = []; // the head, drawn a little larger than life
  // hair, long and dark, falling behind
  h.push(P([fx - 7, fy - 9, fx - 14, fy - 7, fx - 18, fy + 2, fx - 20, fy + 18, fx - 19 + s * 0.3, fy + 30, fx - 13, fy + 32, fx - 9, fy + 20, fx - 6, fy + 4], HR, { bv: 3, ink: -0.24 }));
  for (const [x0, y0, x1, y1, x2, y2] of [[-14, -4, -18, 10, -17, 28], [-11, -2, -14, 12, -12, 26]]) h.push(strand(fx + x0, fy + y0, fx + x1, fy + y1, fx + x2 + s * 0.3, fy + y2, 0.6, 0.4, HR, 4, { ink: -0.46 }));
  // neck, in the beard's shadow
  h.push(K(fx - 1, fy + 8, fx - 2, fy + 22, 7, 8, SK, { ink: -0.34 }));
  // the head: a high bald crown, the face below it
  h.push(E(fx - 2, fy - 6, 12.4, 14, SK, { fl: 0.15 }));
  h.push(E(fx + 1, fy + 3, 10.2, 11, SK, { fl: 0.2 }));
  h.push(E(fx - 5, fy - 14.4, 3.6, 2, SK, { fl: 0.7, ink: 0.1, a: -0.4 })); // the shine on the pate
  h.push(K(fx - 3, fy - 9.4, fx + 4.4, fy - 9.8, 0.4, 0.35, SK, { ink: -0.22, occ: false })); // a furrow
  // the fringe of hair left round the back of the skull, the ear in front of it
  h.push(P([fx - 5, fy - 7, fx - 12, fy - 9, fx - 15, fy - 2, fx - 14, fy + 8, fx - 9, fy + 7, fx - 8, fy - 2], HR, { bv: 1.6, ink: -0.08 }));
  h.push(E(fx - 9.6, fy + 1.4, 2.4, 3.6, SK, { ink: -0.04 }), K(fx - 9.4, fy - 0.4, fx - 9.8, fy + 2.8, 0.5, 0.5, SK, { ink: -0.4, occ: false }));
  h.push(E(fx - 1, fy + 3.4, 4.6, 2.6, SK, { fl: 0.5, ink: 0.06 })); // cheekbone
  h.push(E(fx + 8.2, fy + 1.6, 2, 4, SK, { fl: 0.6, ink: -0.14 })); // far cheek, turned away
  // the brows: heavy, dark
  h.push(K(fx - 7.6, fy - 4.4, fx - 1.2, fy - 3.6, 1.5, 1.1, HR, { ink: -0.04 }));
  h.push(K(fx + 2.8, fy - 3.8, fx + 8.4, fy - 4.4, 1.3, 0.8, HR, { ink: -0.04 }));
  // the eyes: grey, under the brows; a blink on frame 2
  const bl = f === 2;
  h.push(eye(fx - 4.2, fy - 0.8, 2.1, SK, 'scr_torvaldWhite', 'scr_torvaldIris', bl, '#fffbe6'));
  h.push(eye(fx + 5.6, fy - 0.8, 1.5, SK, 'scr_torvaldWhite', 'scr_torvaldIris', bl, '#fffbe6'));
  // the nose, strong and straight
  h.push(K(fx + 2.4, fy - 2.6, fx + 8.4, fy + 5.2, 1.5, 2.2, SK));
  h.push(E(fx + 8.6, fy + 5.8, 2.4, 2.1, SK));
  h.push(E(fx + 6.2, fy + 6.6, 1.6, 1.3, SK, { ink: -0.08 }));
  h.push(X(fx + 7, fy + 7.2, 1.2, 0.8, SK + ':1'));
  // the beard: a dark mass, then two forks bound in gold
  const sw = s * 0.3;
  h.push(P([fx - 10, fy - 1, fx - 6.5, fy + 6, fx - 1.5, fy + 8.8, fx + 4, fy + 8, fx + 9.6, fy + 7.6, fx + 11.4, fy + 12, fx + 10.6, fy + 18, fx + 8, fy + 24, fx + 4.5, fy + 27, fx + 1.5, fy + 25, fx - 1.5, fy + 27.5, fx - 6, fy + 25, fx - 10, fy + 18, fx - 11.4, fy + 8], HR, { bv: 4 }));
  for (const [x0, x1, x2] of [[-7, -8, -6], [-2, -3, -2], [4, 5, 4], [8, 9, 6]]) h.push(strand(fx + x0, fy + 10, fx + x1, fy + 17, fx + x2, fy + 25, 0.5, 0.4, HR, 3, { ink: -0.3, occ: false }));
  const forks = [[fx - 4, fy + 23, fx - 6.5, fy + 32, fx - 5 + sw, fy + 41, 3.6], [fx + 5, fy + 23, fx + 7.5, fy + 31, fx + 7 + sw, fy + 40, 3.3]];
  for (const [ax, ay, cx, cy, ex, ey, r] of forks) {
    h.push(strand(ax, ay, cx, cy, ex, ey, r, 0.7, HR, 4, { ink: -0.06 }));
    h.push(strand(ax + 1, ay + 2, cx + 0.6, cy, ex + 0.3, ey - 3, 0.45, 0.3, HR, 3, { ink: 0.12, occ: false })); // a lit lock
    const [rx, ry] = qpt([ax, ay], [cx, cy], [ex, ey], 0.62);
    h.push(E(rx, ry, r * 0.72, 1.5, GD, { fl: 0.3 }));
    h.push(X(rx - r * 0.5, ry - 0.6, 1, 1, GD + ':5'));
  }
  // the lip under the moustache, and the moustache over it
  h.push(K(fx + 0.6, fy + 12.4, fx + 7.2, fy + 12, 0.6, 0.5, 'scr_torvaldMouth'));
  h.push(E(fx + 3.8, fy + 13.6, 2.4, 0.9, SK, { ink: -0.06 }));
  h.push(P([fx + 1, fy + 7.4, fx + 6, fy + 6.6, fx + 10, fy + 8, fx + 11.6, fy + 12.4, fx + 9, fy + 11, fx + 5, fy + 10.8, fx + 1, fy + 12, fx - 3, fy + 14, fx - 1.4, fy + 9.6], HR, { bv: 1.6, ink: 0.06 }));
  o.push(T(h, { px: fx, py: fy + 16, s: 1.06 }));

  // Thor's hammer on his breast: a Viking-age Mjölnir pendant, glowing gold
  const px = fx + 1.2, py = fy + 41 + by * 0.3;
  o.push(K(px - 3.4, py - 6, px, py - 2.6, 0.4, 0.4, 'leatherDark', { occ: false }), K(px + 3.6, py - 6, px, py - 2.6, 0.4, 0.4, 'leatherDark', { occ: false }));
  o.push(E(px, py - 2.4, 1.4, 1.2, GD, { fl: 0.3 })); // the loop
  // the haft, then the head: two arms flaring down and out, the underside curved up
  o.push(P([px - 1.1, py - 1.4, px + 1.1, py - 1.4, px + 1.2, py + 2.2, px + 4, py + 2.4, px + 5.4, py + 6.6, px + 2.6, py + 5.2, px, py + 4.8, px - 2.6, py + 5.2, px - 5.4, py + 6.6, px - 4, py + 2.4, px - 1.2, py + 2.2], GD, { bv: 0.8 }));
  o.push(K(px - 3.6, py + 3.6, px + 3.6, py + 3.6, 0.5, 0.5, 'scr_torvaldBlessing', { ink: -0.1 + (g - 1) * 0.3 }));
  o.push(Lt(px, py + 3, 16, '#ffd98a', 0.6, 4));

  // the raised arm: the wide sleeve fallen back, the fist round the haft
  o.push(K(99, 104, 86, 75, 11.5, 8.6, RB, { ink: -0.04 }));
  o.push(E(85, 70.6, 7, 3.8, RB, { fl: 0.4, ink: 0.04 })); // the cuff
  o.push(E(84.6, 70.4, 5, 2.4, RB, { fl: 0.6, ink: -0.55 })); // inside it
  o.push(K(84.4, 70.6, 81.4, 55, 4.3, 3.6, SK, { ink: -0.04 }));
  o.push(K(hx, 60, hx, hy + 3, 1.2, 1.1, 'scr_torvaldHaft'));
  o.push(E(hx + 0.2, 50, 4.8, 5.4, SK));
  for (let i = 0; i < 4; i++) o.push(K(hx - 4.4, 45.6 + i * 2.4, hx + 3.4, 46.4 + i * 2.5, 1.2, 1.1, SK, { ink: i % 2 ? -0.04 : 0.04 }));
  o.push(K(hx - 3.6, 45, hx + 1.4, 44, 1.3, 1.1, SK, { ink: 0.08 })); // the thumb over the top
  // the hammer's head: short, broad, the faces flaring
  o.push(P([hx - 10, hy - 4.6, hx - 7.4, hy - 3, hx + 7.4, hy - 3, hx + 10, hy - 4.6, hx + 10, hy + 4.6, hx + 7.4, hy + 3, hx - 7.4, hy + 3, hx - 10, hy + 4.6], 'scr_torvaldIron', { ink: -0.62 }));
  o.push(P([hx - 1.8, hy - 3, hx + 1.8, hy - 3, hx + 1.8, hy + 3, hx - 1.8, hy + 3], 'scr_torvaldIron', { ink: -0.5 })); // the eye of the haft
  o.push(K(hx - 7.4, hy - 2.6, hx + 7.4, hy - 2.6, 0.5, 0.5, 'scr_torvaldIron', { ink: -0.2 })); // its top edge, lit
  o.push(K(hx - 9.6, hy - 4, hx - 9.6, hy + 4, 0.55, 0.55, 'scr_torvaldBolt', { ink: -0.1 }), K(hx + 9.6, hy - 4, hx + 9.6, hy + 4, 0.55, 0.55, 'scr_torvaldBolt', { ink: -0.1 })); // the faces, white-hot
  // the lightning leaping off its faces
  const arcs = [
    [hx - 10.4, hy - 1, hx - 25, hy - 15 + f * 1.5, 3 + f * 7, 5, 2.4, 0.95],
    [hx + 10.4, hy - 2, hx + 19, hy - 19 + (f % 2) * 4, 11 + f * 5, 4, 2.2, 0.9],
    [hx + 10.4, hy + 2.4, hx + 18, hy + 13 - f, 19 + f * 3, 3, 1.8, 0.7],
  ];
  if (f % 2 === 0) arcs.push([hx - 10.4, hy + 3, hx - 18, hy + 12 + f, 31 + f, 3, 1.6, 0.6]);
  for (const [x1, y1, x2, y2, sd, n, a, r] of arcs) o.push(crackle(x1, y1, x2, y2, sd, n, a, r * g, 0.35, 'scr_torvaldBolt'));
  for (let i = 0; i < 3; i++) { const a = f * 1.7 + i * 2.1; o.push(X(hx + Math.cos(a) * 14 - 0.5, hy + Math.sin(a) * 10 - 0.5, 1, 1, '#fffbe0', { em: true })); }
  o.push(Lt(hx, hy, 74, '#fff0a0', 1.3 * g, 12));
  return o;
}

/**
 * The town's watch at the cellar that leads down: a big man in mail and the
 * town's blue cloak, a bushy brown beard under a nasal spangenhelm, his spear
 * grounded and the round shield on his arm. The torch on the gatepost lights
 * him from the left; behind him the dark of the cellar mouth. Stern, not
 * unkind: "Halt! Keep your weapons sheathed."
 */
export function bjornPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 0.86, 1.12, 0.95][f % 4];
  const o: Out = [];
  const BG = 'scr_gBjorn', HL = 'scr_haloBjorn', STN = 'scr_gBjornStone', PIT = 'scr_bjornPit';
  const SK = 'scr_bjornSkin', BD = 'scr_bjornBeard', HM = 'scr_bjornHelm', BZ = 'scr_bjornBronze', ML = 'scr_bjornMail', CL = 'scr_bjornCloak';
  const tx = 15, ty = 13; // the torch's flame
  o.push(P(FULL, BG, { ink: BAND[1] }));
  // the gatehouse planks
  for (const x of [9, 20, 31, 42]) o.push(K(x, -1, x, 97, 0.5, 0.5, BG, { ink: BAND[1] - 0.12, occ: false }));
  // the torch's halo
  o.push(E(tx, ty, 34, 32, HL, { fl: 1, ink: BAND[1] }));
  o.push(E(tx, ty, 20, 19, HL, { fl: 1, ink: BAND[2] }));
  o.push(E(tx, ty, 11, 10.5, HL, { fl: 1, ink: BAND[3] }));
  // the cellar mouth behind him: a stone arch, and the dark going down
  const ax = 78, aw = 15, at = 30;
  const arch = (w: number): number[] => { const pts = [ax - w, 97]; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push(ax + Math.cos(a) * w, at + Math.sin(a) * w * 0.8); } pts.push(ax + w, 97); return pts; };
  o.push(P(arch(aw + 6), STN, { ink: BAND[1] }));
  for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; o.push(K(ax + Math.cos(a) * aw, at + Math.sin(a) * aw * 0.8, ax + Math.cos(a) * (aw + 6), at + Math.sin(a) * (aw + 6) * 0.8, 0.4, 0.4, STN, { ink: BAND[1] - 0.15, occ: false })); }
  o.push(P(arch(aw), PIT, { ink: BAND[1] }));
  for (const y of [80, 88]) o.push(P([ax - aw, y, ax + aw, y, ax + aw, y + 1.4, ax - aw, y + 1.4], STN, { ink: BAND[1] - 0.06 })); // the first steps

  // the torch in its iron ring on the post
  o.push(K(tx - 2.2, 42, tx, ty + 6, 1.5, 2.1, 'scr_bjornTorch', { ink: -0.06 }));
  o.push(K(tx - 9, 33.6, tx - 3.4, 33.6, 0.9, 0.9, 'blackIron', { ink: -0.1 })); // the bracket's arm
  o.push(E(tx - 1.2, 33.6, 3.2, 1.6, 'blackIron', { fl: 0.4 }), E(tx - 1.2, 33.6, 2, 0.7, 'scr_bjornTorch', { ink: -0.2 })); // its ring
  o.push(E(tx - 9.4, 33.6, 1.4, 2.6, 'blackIron', { ink: -0.2 })); // the staple in the post
  // the torch's head, pitch-soaked wrappings
  o.push(E(tx - 0.4, ty + 7, 3, 2.8, 'scr_bjornTorchWrap', { fl: 0.5, ink: -0.3 }));
  o.push(K(tx - 3, ty + 7.4, tx + 2.2, ty + 8.6, 0.5, 0.5, 'scr_bjornTorchWrap', { ink: -0.55, occ: false }));
  // the flame: a teardrop that leans and licks each frame, a yellow heart
  const fh = [11, 9.4, 12.2, 10.2][f % 4], fw = [0, 1.4, -1, 0.7][f % 4], tl = [0, 1, 0.4, -0.6][f % 4];
  o.push(P([tx - 3.8, ty + 5, tx - 4.4, ty + 1, tx - 3, ty - 3, tx - 4.4 + tl, ty - 7 - tl, tx - 1.2, ty - 4.4, tx + fw, ty - fh, tx + 2.2, ty - 4.2, tx + 4.2, ty - 6 + tl, tx + 3.8, ty - 1, tx + 3.6, ty + 4, tx, ty + 6.2], 'scr_bjornFlame', { ink: -0.4 }));
  o.push(P([tx - 2.8, ty + 4.6, tx - 3, ty + 1, tx - 1.4, ty - 2.6, tx + fw * 0.7, ty - fh * 0.72, tx + 1.6, ty - 2.4, tx + 2.8, ty + 0.4, tx + 2.6, ty + 4.6], 'scr_bjornFlameCore', { ink: -0.4 }));
  o.push(E(tx + fw * 0.2, ty + 2.2, 1.7, 2.4, 'scr_bjornFlameCore', { ink: 0.05 }));
  for (let i = 0; i < 3; i++) { const y = ty - 8 - ((f * 4 + i * 7) % 20), x = tx + (hash2(i, 61) - 0.5) * 10 + Math.sin(f + i) * 1.5; o.push(X(x, y, 1, 1, i % 2 ? 'scr_bjornFlame:4' : 'scr_bjornFlameCore:4', { em: true })); }

  const by = -b * 0.5;
  const fx = 49, fy = 47 + by;
  // the body: mail over broad shoulders, the blue cloak over them
  o.push(E(48, 110 + by * 0.8, 54, 40, ML, { fl: 0.2, ink: -0.06 }));
  o.push(P([-2, 97, -2, 82, 10, 73, 24, 67, 34, 66 + by, 38, 78, 33, 97], CL, { bv: 5, n: [0, -0.15, 1] }));
  o.push(P([62, 97, 61, 78, 64, 67 + by, 76, 68, 90, 76, 98, 82, 98, 97], CL, { bv: 5, n: [0, -0.15, 1] }));
  o.push(K(33, 80, 30, 97, 1, 1.4, CL, { ink: -0.3 }), K(66, 80, 68, 97, 1, 1.4, CL, { ink: -0.3 }));
  // the ring brooch pinning the cloak
  o.push(E(66, 74, 3, 2.8, BZ, { fl: 0.5, ink: -0.06 }), E(66, 74, 1.4, 1.3, CL, { ink: -0.3 }));
  o.push(K(62.8, 71, 69.4, 77.4, 0.6, 0.5, BZ, { ink: 0.06 }));
  const h: Out = []; // the head, drawn a little larger than life
  // the mail coif under the helm, down over the neck
  h.push(P([fx - 15, fy - 4, fx - 17, fy + 8, fx - 16, fy + 20, fx - 10, fy + 25, fx + 10, fy + 23, fx + 12, fy + 12, fx - 6, fy + 4], ML, { bv: 3, ink: -0.08 }));
  // the face
  h.push(E(fx + 0.6, fy + 2, 10.4, 11.5, SK, { fl: 0.2 }));
  h.push(E(fx - 1.4, fy + 3.6, 4.4, 2.6, SK, { fl: 0.5, ink: 0.06 })); // cheekbone
  h.push(E(fx + 8.4, fy + 2, 2, 4, SK, { fl: 0.6, ink: -0.16 })); // far cheek, turned away
  // the brows: lowered, level, watchful
  h.push(K(fx - 7.6, fy - 3.4, fx - 1, fy - 2.4, 1.4, 1.1, BD, { ink: -0.1 }));
  h.push(K(fx + 3.6, fy - 2.4, fx + 8.6, fy - 3.2, 1.1, 0.8, BD, { ink: -0.1 }));
  const bl = f === 3;
  h.push(eye(fx - 4, fy + 0.2, 2.1, SK, 'scr_bjornWhite', 'scr_bjornIris', bl, '#fff0d8'));
  h.push(eye(fx + 6.6, fy + 0.2, 1.5, SK, 'scr_bjornWhite', 'scr_bjornIris', bl, '#fff0d8'));
  // the nose, broad, its tip out past the nasal
  h.push(K(fx + 3, fy - 2, fx + 8.2, fy + 5.4, 1.6, 2.3, SK));
  h.push(E(fx + 8.4, fy + 6, 2.5, 2.2, SK));
  h.push(E(fx + 6, fy + 6.8, 1.7, 1.4, SK, { ink: -0.08 }));
  h.push(X(fx + 6.8, fy + 7.4, 1.2, 0.8, SK + ':1'));
  // the beard: bushy, brown, to the chest
  h.push(P([fx - 10, fy - 1, fx - 7, fy + 5, fx - 2, fy + 8, fx + 4, fy + 8.6, fx + 10.6, fy + 8, fx + 12.8, fy + 13, fx + 12.6, fy + 19, fx + 10.6, fy + 24, fx + 7, fy + 28, fx + 1.6, fy + 30, fx - 4, fy + 29, fx - 9, fy + 25.6, fx - 12.4, fy + 19, fx - 13, fy + 10], BD, { bv: 5.5 }));
  for (const [x, y, r] of [[-10.4, 21, 2.6], [-5, 27, 2.8], [6.6, 26.6, 2.6]]) h.push(E(fx + x, fy + y, r, r * 0.8, BD, { fl: 0.4, ink: -0.08 })); // curls at its edge
  for (const [x0, x1, x2, y2] of [[-8, -10, -7, 24], [-4, -5, -3, 27], [0, 0, 1, 28], [4, 5.4, 4, 27], [8.4, 9.6, 7, 23]]) h.push(strand(fx + x0, fy + 11, fx + x1 + s * 0.1, fy + 19, fx + x2, fy + y2, 0.5, 0.35, BD, 3, { ink: -0.32, occ: false }));
  for (const [x0, x1, y2] of [[-6, -7.4, 22], [2, 2.8, 25], [6.4, 7.4, 21]]) h.push(strand(fx + x0, fy + 13, fx + x1, fy + 18, fx + x0 + 0.4, fy + y2, 0.4, 0.3, BD, 2, { ink: 0.14, occ: false })); // lit hairs
  // the mouth, set firm, under a heavy moustache
  h.push(K(fx + 0.6, fy + 12.6, fx + 7.4, fy + 12.4, 0.6, 0.5, 'scr_bjornMouth'));
  h.push(E(fx + 4, fy + 13.8, 2.4, 0.9, SK, { ink: -0.08 }));
  h.push(P([fx - 1, fy + 7.6, fx + 5, fy + 6.6, fx + 10.6, fy + 8, fx + 12.4, fy + 13, fx + 9.4, fy + 11.6, fx + 4.6, fy + 11.2, fx - 0.6, fy + 12.2, fx - 4, fy + 14, fx - 3, fy + 9], BD, { bv: 1.6, ink: 0.06 }));
  // the spangenhelm: a riveted dome, a bronze brow band and crest, the nasal
  const hcx = fx - 1.2, rimY = fy - 5.4, hrx = 13.4, hry = 17;
  const rim = (t: number) => qpt([hcx - hrx, rimY], [hcx + 1, rimY + 3], [hcx + hrx + 0.6, rimY - 1], t);
  const dome: number[] = [];
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI + (i / 18) * Math.PI, c = Math.cos(a);
    dome.push(hcx + c * hrx, rimY + Math.sin(a) * hry * (1 + 0.1 * (1 - Math.abs(c))));
  }
  for (let i = 7; i >= 1; i--) { const [x, y] = rim(i / 8); dome.push(x, y); }
  h.push(P(dome, HM, { bv: 8, n: [0, -0.12, 1] }));
  h.push(strand(hcx + 1, rimY - hry - 1.4, hcx + 5, rimY - 12, fx + 3.4, rimY + 1, 1.2, 1.4, BZ, 4)); // the crest band
  h.push(strand(hcx - 3, rimY - hry - 1, hcx - 9, rimY - 10, hcx - 9.6, rimY + 1.4, 1, 1.2, BZ, 4, { ink: -0.12 })); // a side band
  h.push(strand(hcx - hrx, rimY, hcx + 1, rimY + 3, hcx + hrx + 0.6, rimY - 1, 1.5, 1.5, BZ, 6, { fl: 0.3, ink: -0.06 }));
  for (const t of [0.12, 0.32, 0.52, 0.72, 0.9]) { const [x, y] = rim(t); h.push(X(x - 0.5, y - 0.9, 1, 1, BZ + ':5')); }
  h.push(K(fx + 3.4, rimY + 1.6, fx + 4, fy + 4.6, 1.6, 1.2, HM, { ink: 0.04 })); // the nasal
  o.push(T(h, { px: fx, py: fy + 14, s: 1.1 }));

  // the round shield on his arm: blue and bone halves, an iron boss
  const shx = 7, shy = 90;
  o.push(E(shx, shy, 16, 17, 'scr_bjornShield', { fl: 0.7, ink: -0.08 }));
  const half = [shx + 1, shy - 17]; for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; half.push(shx + Math.cos(a) * 15.6, shy + Math.sin(a) * 16.6); }
  half.push(shx + 1, shy + 17);
  o.push(P(half, 'scr_bjornBoneHalf', { bv: 1, ink: -0.3 }));
  o.push(E(shx + 1, shy, 4.2, 4.2, HM, { fl: 0.2 }));

  // the spear, grounded: ash shaft, bronze socket, leaf blade
  const sx = 85;
  o.push(K(sx + 1, 99, sx - 0.4, 16, 1.3, 1.1, 'scr_bjornShaft'));
  o.push(K(sx - 0.4, 17, sx - 0.4, 13.6, 1.6, 1.4, BZ));
  o.push(P([sx - 0.4, 0, sx + 2.8, 5, sx + 2.4, 10, sx - 0.4, 14, sx - 3.2, 10, sx - 3.6, 5], 'scr_bjornSteel', { bv: 1.4 }));
  o.push(K(sx - 0.4, 2, sx - 0.4, 12.6, 0.4, 0.4, 'scr_bjornSteel', { ink: 0.3, occ: false }));
  // the mail sleeve and the fist round the shaft
  o.push(K(66, 104, 79, 80, 7.4, 5.8, ML, { ink: -0.04 }));
  o.push(K(78, 82, 81, 79, 4.6, 4.4, 'leather'));
  o.push(E(sx - 0.6, 74, 4.8, 5.4, SK));
  for (let i = 0; i < 4; i++) o.push(K(sx - 4.6, 69.6 + i * 2.4, sx + 3.4, 70.4 + i * 2.5, 1.2, 1.1, SK, { ink: i % 2 ? -0.04 : 0.04 }));
  o.push(K(sx - 3.8, 69, sx + 1.2, 68, 1.3, 1.1, SK, { ink: 0.08 }));

  o.push(Lt(tx, ty + 2, 90, '#ffa04a', 1.3 * fl, 14));
  return o;
}
