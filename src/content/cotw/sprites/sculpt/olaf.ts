import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Olaf the Chandler: round and cheerful in an ochre tunic and a red scarf, a round fur hat and
 * a flaxen beard; a bundle of tallow candles swings from one hand and the other holds a lit
 * lantern out into the dark.
 */
export function olafModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 8.6 + b * 0.35;
  const ty = 17.0 + b * 0.3;
  const flame = [1, 0.86, 1.1, 0.94][f];
  const cw = w * 0.25; // the candle bundle swings
  const out: PrimTree[number][] = [Sh(16.4, 28.6, 9.6, 2.3)];
  out.push(
    // back arm and the bundle of tallow candles, hung by their wicks
    K(10.4, 13.4, 8.8, 18.0, 1.8, 1.5, 'ally_ochreDark'), E(8.8, 18.8, 1.2, 1.2, 'skin'),
    K(8.8, 19.6, 8.8 + cw, 20.8, 0.22, 0.22, 'linen', { occ: false }),
    K(7.7 + cw, 21.0, 7.6 + cw, 24.2, 0.5, 0.45, 'ally_tallow'), K(8.9 + cw, 21.0, 8.9 + cw, 24.8, 0.5, 0.45, 'ally_tallow'), K(10.1 + cw, 21.0, 10.2 + cw, 23.8, 0.5, 0.45, 'ally_tallow'),
    // legs and boots
    K(13.6, 21.8, 13.0, 26.6, 1.9, 1.6, 'woolBrown'), K(18.0, 21.8, 18.8, 26.6, 1.9, 1.6, 'woolBrown'),
    E(12.8, 27.5, 2.3, 1.3, 'leatherDark'), E(19.2, 27.5, 2.3, 1.3, 'leatherDark'),
    // the round body in an ochre tunic, belted, a pouch at the hip
    E(15.8, ty, 6.6, 6.2 + b * 0.2, 'ally_ochre', { fl: 0.12 }),
    P([9.4, ty + 2.6, 22.2, ty + 2.6, 22.8, ty + 6.4, 8.8, ty + 6.4], 'ally_ochre', { bv: 0.8 }),
    K(9.4, ty + 2.2, 22.2, ty + 2.2, 0.7, 0.7, 'leatherDark'), X(15.0, ty + 1.6, 1.4, 1.2, 'bronze:4'),
    E(11.6, ty + 4.0, 1.4, 1.6, 'leather', { fl: 0.4 }),
    // the warm wrap: a red scarf round the shoulders, one end hanging
    P([10.2, 12.2, 21.4, 12.0, 21.2, 14.6, 15.8, 15.6, 10.4, 14.6], 'woolRed', { bv: 0.9 }),
    K(19.2, 14.2, 20.0, 18.6, 0.95, 0.7, 'woolRed'),
    X(19.2, 18.2, 1.6, 0.5, 'woolRed:2'),
  );
  out.push(
    // head: ruddy, round-nosed, a full flaxen beard
    E(hx, hy, 3.8, 3.9, 'skin', { fl: 0.2 }),
    P([hx - 2.4, hy + 1.4, hx + 4.0, hy + 1.6, hx + 3.6, hy + 5.0, hx + 1.0, hy + 6.6, hx - 1.8, hy + 4.8], 'hairFlax', { bv: 0.8 }),
    X(hx + 0.3, hy + 0.2, 0.9, 0.9, '#1d1416'), X(hx + 2.6, hy + 0.2, 0.9, 0.9, '#1d1416'),
    X(hx + 2.4, hy + 1.3, 1.1, 0.6, '#c8705a'), // a rosy cheek
    P([hx + 0.4, hy + 2.0, hx + 4.2, hy + 1.8, hx + 3.6, hy + 2.8, hx + 2.2, hy + 2.4, hx + 0.6, hy + 2.9], 'hairFlax', { bv: 0.4 }),
    E(hx + 3.9, hy + 1.2, 0.95, 0.85, 'skin'),
    // the cap: a round fur hat with ear flaps, tied under the beard
    E(hx - 0.2, hy - 2.6, 4.0, 2.6, 'furBrown', { fl: 0.15 }),
    K(hx - 4.0, hy - 1.4, hx + 3.8, hy - 1.7, 1.0, 1.0, 'furTawny'),
    E(hx - 3.2, hy + 0.8, 1.2, 2.0, 'furTawny'),
    // front arm, held out with the lantern
    K(20.6, 13.2, 23.4, 15.4, 1.8, 1.5, 'ally_ochre'), K(23.4, 15.4, 25.8, 13.4, 1.5, 1.3, 'ally_ochre'),
    E(26.2, 13.0, 1.2, 1.2, 'skin'),
  );
  // the lantern, hung from the fist: iron cap and base, a warm flame behind horn panes
  const lx = 26.4 + w * 0.15;
  const ly = 17.2;
  out.push(
    K(26.2, 13.6, lx, 14.6, 0.25, 0.25, 'blackIron'),
    P([lx - 1.5, ly - 1.8, lx + 1.5, ly - 1.8, lx + 0.9, ly - 2.8, lx - 0.9, ly - 2.8], 'blackIron', { bv: 0.4 }),
    E(lx, ly, 1.5, 1.8, 'ally_horn'),
    E(lx, ly + 0.2, 0.75 * flame, 1.15 * flame, 'emFire'), X(lx - 0.2, ly, 0.45, 0.7, 'emFireCore:5', { em: true }),
    K(lx - 1.5, ly - 1.8, lx - 1.5, ly + 1.7, 0.3, 0.3, 'blackIron'), K(lx + 1.5, ly - 1.8, lx + 1.5, ly + 1.7, 0.3, 0.3, 'blackIron'),
    P([lx - 1.8, ly + 1.7, lx + 1.8, ly + 1.7, lx + 1.3, ly + 2.6, lx - 1.3, ly + 2.6], 'blackIron', { bv: 0.4 }),
    Lt(lx, ly, 10, '#ff8a2c', 0.9 * flame),
  );
  return out;
}
