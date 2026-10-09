import { E, K, P, X, Sh, type Prim, type PrimTree, type Variant } from './kit';
import './materials';

type Out = PrimTree[number][];

/** A sword lying with its hilt at (x, y), the blade running `len` away along angle `ang`. */
function sword(x: number, y: number, ang: number, len: number): Prim[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const px = -s;
  const py = c;
  const bx = x + c * 1.2;
  const by = y + s * 1.2;
  const tx = x + c * len;
  const ty = y + s * len;
  return [
    P([bx + px * 0.9, by + py * 0.9, tx + px * 0.5, ty + py * 0.5, tx + c * 1.2, ty + s * 1.2, tx - px * 0.5, ty - py * 0.5, bx - px * 0.9, by - py * 0.9], 'steel', { bv: 0.6 }),
    K(x + px * 2.4, y + py * 2.4, x - px * 2.4, y - py * 2.4, 0.65, 0.65, 'iron'),
    K(x, y, x - c * 3.2, y - s * 3.2, 0.72, 0.72, 'leatherDark'),
    E(x - c * 3.9, y - s * 3.9, 1.1, 1.1, 'iron'),
  ];
}

/** A tied coin-pouch at (x, y), scale s, a coin peeking from its mouth. */
function pouch(x: number, y: number, s = 1): Prim[] {
  return [
    E(x, y, 4.2 * s, 3.5 * s, 'leather'),
    P([x - 1.5 * s, y - 3 * s, x + 1.5 * s, y - 3 * s, x + 2.2 * s, y - 4.8 * s, x - 2 * s, y - 4.8 * s], 'leather', { bv: 0.5 }),
    K(x - 1.8 * s, y - 3 * s, x + 1.8 * s, y - 3.1 * s, 0.45, 0.45, 'leatherDark'),
    X(x + 1.2 * s, y - 5.2 * s, 0.9, 0.7, 'gold:5'),
  ];
}

/** A green glass bottle lying from (x, y) along angle `ang`, corked. */
function bottle(x: number, y: number, ang: number): Prim[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [
    K(x, y, x + c * 4.2, y + s * 4.2, 1.85, 1.85, 'fix_glass'),
    K(x + c * 4.2, y + s * 4.2, x + c * 6.6, y + s * 6.6, 0.75, 0.75, 'fix_glass'),
    E(x + c * 7.2, y + s * 7.2, 0.75, 0.75, 'wood'),
    X(x + c * 1.4 - 0.4, y + s * 1.4 - 1.3, 2.4, 0.5, '#e8f6ee', { em: true, glow: false }),
  ];
}

/**
 * The loot heap, one frame: a heap you can read. `small` is the hilt of a sword, a tied
 * coin-pouch and a bottle; `big` adds a leaning round shield, a helm, a scroll and spilled coin.
 * Any other size draws `small`.
 */
export function lootPileModel(_f: number, v: Variant & { size: 'small' | 'big' }): PrimTree {
  if (v.size !== 'big') {
    return [
      Sh(16.4, 27.8, 10.5, 2.3, 0.5),
      sword(13.6, 19.8, 0.62, 12),
      pouch(19.6, 23.6),
      bottle(7.6, 26.2, -0.2),
    ];
  }
  const out: Out = [Sh(16, 28, 13, 2.5, 0.55)];
  // a round shield leaning at the back
  out.push(E(11.6, 17, 6, 6.2, 'iron', { fl: 0.6 }), E(11.6, 17, 5.2, 5.4, 'wood', { fl: 0.65 }));
  out.push(K(11.6, 12, 11.6, 22, 0.5, 0.5, 'woolRed', { fl: 0.6 }), E(11.6, 17, 1.4, 1.4, 'iron'));
  out.push(sword(19.4, 15.6, 0.95, 11));
  // a helm on its side
  out.push(P([19.4, 22.6, 20.6, 17.8, 24.2, 16.4, 27.4, 18.6, 27.4, 22.6], 'steel', { bv: 1.4 }), K(19.6, 22.4, 27.2, 22.4, 0.55, 0.55, 'bronze'));
  out.push(pouch(14.2, 24.2, 0.95));
  out.push(bottle(4.6, 26.6, -0.35));
  // a scroll and spilled coin
  out.push(K(19.6, 26.6, 26.6, 25.4, 1.05, 1.05, 'linen'), E(19.6, 26.6, 0.8, 1.05, 'linen', { ink: -0.1 }));
  for (const [x, y] of [[9.6, 28], [11.4, 27.2], [17.6, 28.2], [27.8, 27.4], [22.4, 28.4]]) out.push(E(x, y, 1.15, 0.6, 'gold'));
  return out;
}
