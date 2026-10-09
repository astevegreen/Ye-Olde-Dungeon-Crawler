import { E, X, Lt, Sh, breath, type PrimTree } from './kit';
import { limb } from './family';
import './materials';

/**
 * Slag Amorphous: a heap of slag that will not cool. A crust over a molten heart, cracks
 * breathing, a mouth on top, drops falling and crawling back. One kind.
 */
export function slagModel(f: number): PrimTree {
  const b = breath(f);
  const pl = [0, 0.06, 0.1, 0.05][f];
  const c = 'mon2_crust';
  const out: PrimTree[number][] = [Sh(16, 28.6, 11.4, 2.4)];
  out.push(E(16, 26.6, 11, 2.6, c, { fl: 0.4 }));
  out.push(E(16.4, 22.6 - b * 0.2, 9.4, 5.6 + b * 0.25, c));
  out.push(E(13.4, 18.8 - b * 0.3, 5.4, 4.6, c));
  out.push(E(20.6, 19.8 - b * 0.2, 4.2, 3.8, c));
  // molten mouth
  out.push(E(13.6, 16.4 - b * 0.3, 3.1, 1.7, 'emFire', { fl: 0.5, ink: pl }), E(13.6, 16.2 - b * 0.3, 1.8, 0.9, 'emFireCore', { ink: pl }));
  // cracks
  const ck = { ink: pl - 0.04 };
  out.push(limb([9.2, 20.8, 11.6, 23.2, 10.6, 25.8], 0.5, 0.3, 'emFire', ck));
  out.push(limb([17.4, 19.4, 19.4, 22, 18.2, 24.6, 20.4, 27], 0.5, 0.3, 'emFire', ck));
  out.push(limb([22.4, 22.4, 24.8, 24.2], 0.45, 0.25, 'emFire', ck));
  out.push(limb([13.4, 20.8, 15, 23], 0.4, 0.25, 'emFire', ck));
  // two ember eyes in the crust
  out.push(X(19.4, 18.4, 1, 0.6, 'emFireCore:4'), X(21.4, 18.6, 0.8, 0.6, 'emFireCore:4'));
  // drops: one falls, one cools on the floor
  out.push(E(26.2, 22.6 + f * 0.7, 0.55, 0.75, 'emFire'), E(6.2, 23.4 + ((f + 2) % 4) * 0.6, 0.5, 0.7, 'emFire'));
  out.push(E(4.4, 28.3, 0.9, 0.4, c), E(27.8, 28.2, 0.8, 0.4, 'emFire', { ink: -0.2 }));
  out.push(Lt(14, 17.4, 12, '#ff8a2c', 1));
  return out;
}
