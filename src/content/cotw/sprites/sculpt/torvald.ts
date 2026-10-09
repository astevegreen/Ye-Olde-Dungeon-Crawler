import { E, K, P, X, Lt, Sh, bolt, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Father Torvald, the goði of Thor's Hall: broad in a white robe with a red stole, a forked
 * dark beard and a bare brow; Thor's hammer hangs gold on his chest, and the small hammer in
 * his raised fist crackles with the Thunderer's lightning.
 */
export function torvaldModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.6;
  const hy = 8.4 + b * 0.35;
  const ty = 17.0 + b * 0.25;
  const out: PrimTree[number][] = [Sh(16, 28.6, 9.0, 2.3)];
  out.push(
    // back arm in a wide sleeve
    K(10.4, 13.2, 9.2, 19.0, 1.8, 2.3, 'ally_robeWhite', { ink: -0.08 }), E(9.4, 19.8, 1.2, 1.2, 'skin'),
    // the robe, broad at the shoulder, to the floor
    P([10.6, 12.2, 21.0, 12.0, 22.4, 27.8, 19.4, 28.6, 16.0, 28.2, 12.6, 28.6, 9.4, 27.8], 'ally_robeWhite', { bv: 1.3 }),
    K(14.4, 21.0, 13.6, 27.8, 0.45, 0.7, 'linen', { occ: false }), K(19.0, 21.0, 20.0, 27.8, 0.4, 0.6, 'linen', { occ: false }),
    E(13.8, 28.3, 1.6, 0.8, 'leatherDark'), E(19.0, 28.4, 1.6, 0.8, 'leatherDark'),
    // the red stole down the front, edged in gold
    P([14.4, 12.2, 17.0, 12.2, 17.2, 26.6, 14.6, 26.6], 'woolRed', { bv: 0.6 }),
    K(14.4, 12.6, 14.6, 26.4, 0.25, 0.25, 'gold', { occ: false }), K(17.0, 12.6, 17.2, 26.4, 0.25, 0.25, 'gold', { occ: false }),
    // the belt: a plaited cord
    K(10.2, ty + 3.0, 21.6, ty + 2.8, 0.55, 0.55, 'leather'),
    // head: weathered, a high bare brow, the hair long behind
    E(hx - 2.0, hy + 1.6, 3.0, 4.4, 'hairDark'),
    E(hx, hy, 3.7, 4.0, 'skin', { fl: 0.2 }),
    P([hx - 3.8, hy + 2.4, hx - 3.6, hy - 1.6, hx - 2.0, hy - 3.4, hx - 0.6, hy - 3.0, hx - 1.4, hy - 1.0, hx - 2.2, hy + 2.6], 'hairDark', { bv: 0.6 }),
    X(hx - 0.2, hy - 0.8, 1.6, 0.6, 'hairDark:2'), X(hx + 2.0, hy - 0.9, 1.6, 0.6, 'hairDark:2'), // heavy brows
    X(hx + 0.3, hy + 0.1, 0.9, 0.9, '#1d1416'), X(hx + 2.6, hy + 0.1, 0.9, 0.9, '#1d1416'),
    K(hx + 3.6, hy + 0.4, hx + 4.3, hy + 2.0, 0.65, 0.55, 'skin'),
    // the forked beard, each fork bound in a gold ring
    P([hx - 2.0, hy + 1.6, hx + 4.0, hy + 1.6, hx + 3.6, hy + 4.6, hx + 1.0, hy + 5.4, hx - 1.6, hy + 4.4], 'hairDark', { bv: 0.7 }),
    K(hx + 0.2, hy + 4.6, hx - 0.2 + w * 0.15, hy + 9.0, 0.95, 0.5, 'hairDark'), K(hx + 2.4, hy + 4.4, hx + 2.8 + w * 0.15, hy + 8.8, 0.9, 0.5, 'hairDark'),
    E(hx - 0.1 + w * 0.12, hy + 7.4, 0.8, 0.45, 'gold'), E(hx + 2.7 + w * 0.12, hy + 7.2, 0.75, 0.45, 'gold'),
  );
  // Thor's hammer on his chest: a gold pendant on a cord, softly lit
  const px = 15.8;
  const py = 17.4 + b * 0.2;
  out.push(
    K(hx - 1.6, hy + 4.4, px, py - 1.6, 0.18, 0.18, 'leatherDark', { occ: false }), K(hx + 3.0, hy + 4.4, px, py - 1.6, 0.18, 0.18, 'leatherDark', { occ: false }),
    X(px - 0.35, py - 1.6, 0.7, 1.8, 'gold:4'),
    P([px - 1.6, py, px + 1.6, py, px + 1.2, py + 1.5, px - 1.2, py + 1.5], 'gold', { bv: 0.4 }),
    X(px - 0.6, py + 0.4, 1.2, 0.5, 'emHoly:4', { em: true, glow: false }),
    Lt(px, py + 0.6, 5, '#ffe9b0', 0.55 + b * 0.1),
  );
  // the front arm raised, the fist round a short hammer, lightning playing on its head
  out.push(
    K(20.8, 13.0, 23.6, 15.6, 1.8, 2.2, 'ally_robeWhite'), K(23.6, 15.6, 24.4, 11.2, 1.5, 1.3, 'skin'),
    E(24.4, 10.6, 1.25, 1.25, 'skin'),
    K(24.4, 12.4, 24.4, 7.4, 0.45, 0.4, 'woodDark'),
    // the head: short and broad, its faces flaring at the ends
    P([21.8, 4.6, 23.0, 5.2, 25.8, 5.2, 27.0, 4.6, 27.0, 7.6, 25.8, 7.0, 23.0, 7.0, 21.8, 7.6], 'blackIron', { bv: 0.5 }),
    X(23.2, 5.6, 2.4, 0.4, 'iron:4'),
  );
  // one crackle leaps from a face of the head, first one side, then the other
  const left = f % 2 === 0;
  const arc = left ? bolt(21.6, 5.6, 19.4, 3.2 - f * 0.2, 3 + f, 3, 0.55, 0.24, 'emBolt') : bolt(27.2, 5.8, 29.0, 3.6 + f * 0.2, 5 + f, 3, 0.55, 0.24, 'emBolt');
  out.push(arc.prims, Lt(left ? 21.0 : 27.6, 5.2, 6, '#fff27a', 0.45 + [0, 0.1, 0.2, 0.05][f]));
  return out;
}
