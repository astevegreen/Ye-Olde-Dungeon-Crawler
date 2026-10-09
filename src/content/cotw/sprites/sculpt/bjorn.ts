import { E, K, P, X, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Bjorn the Town Guard: a big man in mail under a blue cloak and a nasal helm, a bushy brown
 * beard; the town's round shield (blue and bone halves, an iron boss) on his arm and a spear
 * grounded beside him, taller than he is.
 */
export function bjornModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 8.4 + b * 0.35;
  const ty = 17.0 + b * 0.25;
  const out: PrimTree[number][] = [Sh(16, 28.6, 9.6, 2.4)];
  out.push(
    // the blue cloak behind
    P([10.0, 12.0, 21.0, 12.0, 22.0, 25.6, 16.0, 26.4, 9.2, 25.6], 'wool', { bv: 1.0, ink: -0.1 }),
    // legs and boots, wrapped to the knee
    K(13.4, 21.8, 12.8, 26.8, 1.9, 1.6, 'woolBrown'), K(18.0, 21.8, 18.8, 26.8, 1.9, 1.6, 'woolBrown'),
    K(12.2, 24.4, 14.2, 24.6, 0.45, 0.45, 'leatherDark'), K(17.6, 24.4, 19.6, 24.6, 0.45, 0.45, 'leatherDark'),
    E(12.6, 27.6, 2.3, 1.3, 'leatherDark'), E(19.2, 27.6, 2.3, 1.3, 'leatherDark'),
    // the mail shirt, belted, a seax across the front
    E(15.8, ty, 6.2, 6.0, 'mail', { fl: 0.12 }),
    P([9.8, ty + 2.4, 21.8, ty + 2.4, 22.4, ty + 6.0, 9.2, ty + 6.0], 'mail', { bv: 0.7 }),
    K(9.6, ty + 2.2, 22.0, ty + 2.2, 0.75, 0.75, 'leatherDark'), X(15.2, ty + 1.6, 1.4, 1.2, 'iron:4'),
    K(13.8, ty + 3.2, 19.6, ty + 3.0, 0.55, 0.45, 'leather'), X(19.8, ty + 2.6, 0.6, 0.9, 'bronze:4'),
    // the cloak's clasp at the shoulder
    E(19.6, 12.6, 0.9, 0.9, 'bronze'),
  );
  out.push(
    // head: the beard first, then the helm over it
    E(hx, hy + 0.4, 3.6, 3.8, 'skin', { fl: 0.2 }),
    P([hx - 3.0, hy + 1.0, hx + 4.0, hy + 1.4, hx + 3.6, hy + 5.4, hx + 1.4, hy + 7.0, hx - 1.6, hy + 6.0, hx - 2.8, hy + 3.4], 'ally_hairBrown', { bv: 0.9 }),
    X(hx + 0.4, hy + 0.4, 0.9, 0.85, '#1d1416'), X(hx + 2.6, hy + 0.4, 0.9, 0.85, '#1d1416'),
    P([hx + 0.4, hy + 2.2, hx + 4.2, hy + 2.0, hx + 3.6, hy + 3.0, hx + 0.6, hy + 3.0], 'ally_hairBrown', { bv: 0.3 }),
    // the spangenhelm: a riveted dome, a brow band and a nasal
    P([hx - 3.8, hy - 0.6, hx - 3.4, hy - 3.2, hx - 1.4, hy - 4.8, hx + 0.6, hy - 5.2, hx + 2.6, hy - 4.6, hx + 3.8, hy - 2.8, hx + 4.0, hy - 0.6], 'iron', { bv: 1.0 }),
    K(hx - 3.8, hy - 0.6, hx + 4.0, hy - 0.6, 0.5, 0.5, 'bronze'),
    K(hx + 0.6, hy - 5.0, hx + 0.6, hy - 0.8, 0.25, 0.25, 'bronze', { occ: false }),
    K(hx + 3.4, hy - 0.6, hx + 3.6, hy + 1.8, 0.4, 0.3, 'iron'),
    E(hx - 3.0, hy + 1.0, 0.9, 1.6, 'mail'), // the mail hood at the neck
  );
  // the shield on the back arm: blue and bone halves, an iron boss, a rim
  const sx = 9.4;
  const sy = 18.0;
  out.push(
    K(11.4, 13.2, 10.4, 17.2, 1.7, 1.4, 'mail'),
    E(sx, sy, 4.4, 4.8, 'ally_shieldBlue', { fl: 0.65 }),
    P([sx, sy - 4.6, sx + 3.4, sy - 2.8, sx + 4.2, sy, sx + 3.4, sy + 2.8, sx, sy + 4.6], 'linen', { bv: 0.3, n: [0, 0, 1] }),
    E(sx + 0.2, sy, 1.3, 1.3, 'iron'),
  );
  // the spear, grounded and held upright: ash shaft, a leaf blade
  const px = 23.6;
  out.push(
    K(px + 0.2, 28.0, px - 0.2, 4.6, 0.45, 0.4, 'wood'),
    P([px - 0.2, 1.8, px + 0.9, 3.8, px + 0.6, 6.0, px - 0.2, 6.6, px - 1.0, 6.0, px - 1.3, 3.8], 'steel', { bv: 0.4 }),
    X(px - 0.3, 2.6, 0.4, 3.4, 'steel:5'),
    K(px - 0.7, 6.8, px + 0.3, 6.8, 0.4, 0.4, 'bronze'),
    // front arm, the fist round the shaft
    K(20.6, 12.8, 22.2, 17.6, 1.8, 1.5, 'mail'), K(22.2, 17.6, 23.0, 15.8 + w * 0.1, 1.5, 1.3, 'mail'),
    E(23.4, 15.6, 1.25, 1.25, 'skin'),
  );
  return out;
}
