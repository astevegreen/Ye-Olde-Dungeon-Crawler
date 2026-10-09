import { E, K, P, X, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Banker Haakon: lean and upright in a wine-dark coat with a fur collar and a gold chain of
 * office, neat grey hair and a pointed beard; he holds out a balance scale whose pans teeter,
 * and a fat purse hangs at his belt.
 */
export function haakonModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 8.2 + b * 0.3;
  const ty = 16.8 + b * 0.25;
  const out: PrimTree[number][] = [Sh(16, 28.6, 8.6, 2.2)];
  out.push(
    // back arm, hand resting on the purse
    K(11.2, 13.2, 10.4, 18.6, 1.4, 1.2, 'ally_wineDark'), E(10.8, 19.4, 1.05, 1.05, 'skinPale'),
    // legs in dark hose, pointed shoes
    K(13.8, 21.6, 13.4, 26.8, 1.4, 1.2, 'furDark'), K(17.4, 21.6, 18.0, 26.8, 1.4, 1.2, 'furDark'),
    P([12.0, 26.6, 15.0, 26.6, 16.4, 28.2, 11.8, 28.4], 'leatherDark', { bv: 0.4 }), P([16.6, 26.6, 19.6, 26.6, 21.0, 28.2, 16.4, 28.4], 'leatherDark', { bv: 0.4 }),
    // the long coat, closed down the front, skirts to the knee
    P([11.4, 12.4, 19.8, 12.2, 20.8, 19.6, 21.6, 24.6, 15.8, 25.2, 10.2, 24.6, 11.0, 19.6], 'ally_wine', { bv: 1.1 }),
    K(16.0, 14.0, 16.2, 24.8, 0.3, 0.3, 'ally_wineDark', { occ: false }),
  );
  for (const y of [15.0, 17.2, 19.4]) out.push(X(16.5, y, 0.6, 0.6, 'gold:4'));
  out.push(
    K(10.8, ty + 3.0, 21.0, ty + 3.0, 0.55, 0.55, 'leatherDark'),
    // the purse: fat, tied, a coin's glint at the mouth
    E(11.4 + w * 0.12, ty + 5.2, 1.6, 1.8, 'leather', { fl: 0.3 }), K(10.6, ty + 3.6, 12.2, ty + 3.6, 0.35, 0.35, 'leatherDark'),
    X(11.4, ty + 3.8, 0.7, 0.5, 'gold:5'),
    // the fur collar and the chain of office, a medallion at its low point
    P([10.6, 12.6, 13.0, 11.0, 18.4, 11.0, 20.6, 12.4, 19.8, 14.4, 15.6, 13.4, 11.4, 14.4], 'furBrown', { bv: 0.8 }),
  );
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 12.0 + t * 7.6;
    const y = 13.8 + Math.sin(t * Math.PI) * 2.2;
    out.push(E(x, y, 0.45, 0.4, 'gold'));
  }
  out.push(
    E(15.8, 16.6, 1.15, 1.15, 'gold', { fl: 0.4 }), X(15.5, 16.3, 0.6, 0.6, 'woolRed:4'),
    // head: lean, a long nose, neat grey hair, a pointed beard
    E(hx, hy, 3.4, 3.8, 'skinPale', { fl: 0.2 }),
    P([hx - 3.4, hy + 1.6, hx - 3.6, hy - 1.8, hx - 1.4, hy - 3.8, hx + 1.8, hy - 3.8, hx + 3.4, hy - 2.2, hx + 2.0, hy - 2.2, hx - 0.6, hy - 1.4, hx - 1.8, hy + 1.6], 'hairGrey', { bv: 0.6 }),
    X(hx + 0.4, hy + 0.1, 0.8, 0.8, '#1d1416'), X(hx + 2.5, hy + 0.1, 0.8, 0.8, '#1d1416'),
    X(hx + 0.2, hy - 0.7, 1.3, 0.4, 'hairGrey:2'), X(hx + 2.3, hy - 0.8, 1.3, 0.4, 'hairGrey:2'),
    K(hx + 3.2, hy - 0.2, hx + 4.2, hy + 1.8, 0.5, 0.5, 'skinPale'),
    P([hx + 0.2, hy + 2.2, hx + 3.6, hy + 2.2, hx + 2.6, hy + 4.0, hx + 1.6, hy + 6.0, hx + 0.6, hy + 3.8], 'hairGrey', { bv: 0.4 }),
    X(hx + 1.0, hy + 2.2, 2.4, 0.4, 'hairGrey:1'),
    // front arm, held out, the scale hanging from the fist
    K(19.6, 13.0, 21.8, 16.4, 1.4, 1.2, 'ally_wine'), K(21.8, 16.4, 23.2, 13.0, 1.2, 1.0, 'ally_wine'),
    E(23.4, 12.4, 1.0, 1.0, 'skinPale'),
  );
  // the balance: a rod from the fist, a beam that teeters, two pans on cords; coins weigh one down
  const cx = 23.6;
  const cy = 6.2;
  const tilt = [0.0, 0.25, 0.4, 0.2][f];
  const lx = cx - 3.6;
  const rx = cx + 3.6;
  const ly = cy - tilt;
  const ry = cy + tilt;
  out.push(
    K(cx, 12.0, cx, cy - 0.6, 0.35, 0.3, 'bronze'), E(cx, cy - 0.9, 0.55, 0.55, 'bronze'),
    K(lx, ly, rx, ry, 0.3, 0.3, 'bronze'),
    K(lx, ly, lx - 0.8, ly + 3.4, 0.12, 0.12, 'linen', { occ: false }), K(lx, ly, lx + 0.8, ly + 3.4, 0.12, 0.12, 'linen', { occ: false }),
    K(rx, ry, rx - 0.8, ry + 3.4, 0.12, 0.12, 'linen', { occ: false }), K(rx, ry, rx + 0.8, ry + 3.4, 0.12, 0.12, 'linen', { occ: false }),
    E(lx, ly + 3.6, 1.5, 0.55, 'bronze', { fl: 0.5 }),
    E(rx, ry + 3.6, 1.5, 0.55, 'bronze', { fl: 0.5 }),
    E(rx - 0.4, ry + 3.0, 0.6, 0.4, 'gold'), E(rx + 0.5, ry + 3.1, 0.55, 0.38, 'gold'), E(rx + 0.1, ry + 2.6, 0.55, 0.38, 'gold'),
    X(lx - 0.3, ly + 3.1, 0.7, 0.4, 'silver:4'),
  );
  return out;
}
