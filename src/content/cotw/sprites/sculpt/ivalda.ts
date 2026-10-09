import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Ivalda, the Last Forge-Keeper: a stout duergar smith with iron-grey skin, heavy white braids
 * ringed in iron, rune-etched tongs taller than she is, and a forge-lantern whose fire has gone
 * cold and blue.
 */
export function ivaldaModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 12.6 + b * 0.3;
  const ty = 20.4 + b * 0.2;
  const flame = [1, 0.85, 1.12, 0.92][f];
  const lx = 9.4;
  const ly = 25.0;
  const out: PrimTree[number][] = [Sh(15.4, 28.6, 8.2, 2.2)];
  out.push(
    // white hair gathered behind the head
    E(hx - 2.2, hy + 0.8, 3.0, 3.8, 'ally_hairWhite'),
    // back arm with the cold forge-lantern
    K(11.0, 17.6, 9.8, 21.4, 1.7, 1.4, 'ally_mailDark'), E(9.8, 22.0, 1.3, 1.3, 'ally_skinIron'),
    K(9.8, 22.2, lx, 23.0, 0.25, 0.25, 'blackIron'),
    P([lx - 1.6, ly - 1.4, lx + 1.6, ly - 1.4, lx + 1.0, ly - 2.4, lx - 1.0, ly - 2.4], 'blackIron', { bv: 0.4 }),
    E(lx, ly, 1.5, 1.6, 'ally_glass'),
    E(lx, ly + 0.2, 0.7 * flame, 1.05 * flame, 'emFrost'), X(lx - 0.2, ly - 0.1, 0.4, 0.6, '#f2fdff', { em: true }),
    K(lx - 1.5, ly - 1.4, lx - 1.5, ly + 1.4, 0.3, 0.3, 'blackIron'), K(lx + 1.5, ly - 1.4, lx + 1.5, ly + 1.4, 0.3, 0.3, 'blackIron'),
    P([lx - 1.8, ly + 1.4, lx + 1.8, ly + 1.4, lx + 1.4, ly + 2.4, lx - 1.4, ly + 2.4], 'blackIron', { bv: 0.4 }),
    Lt(lx, ly, 8, '#9fe6ff', 0.8 * flame),
    // short legs, iron-capped boots
    K(13.6, 24.6, 13.2, 27.0, 1.8, 1.6, 'woolBrown'), K(17.4, 24.6, 17.8, 27.0, 1.8, 1.6, 'woolBrown'),
    E(13.0, 27.7, 2.2, 1.2, 'blackIron'), E(18.2, 27.7, 2.2, 1.2, 'blackIron'),
    // stout body: mail under a scorched leather apron
    E(15.6, ty, 5.9, 5.2, 'ally_mailDark', { fl: 0.12 }),
    P([11.6, ty - 2.6, 19.6, ty - 2.6, 20.6, ty + 5.4, 15.6, ty + 6.0, 10.6, ty + 5.4], 'leatherDark', { bv: 1.0 }),
    K(10.4, ty + 0.6, 20.8, ty + 0.6, 0.7, 0.7, 'leather'), X(15.0, ty + 0.0, 1.4, 1.2, 'iron:4'),
    X(13.0, ty + 2.8, 0.5, 1.6, 'silver:3'), X(13.5, ty + 3.4, 0.8, 0.5, 'silver:3'), // a duergar rune stitched on the apron
    // broad iron pauldrons
    E(10.8, ty - 3.6, 2.4, 1.8, 'blackIron', { fl: 0.3 }), E(20.4, ty - 3.6, 2.4, 1.8, 'blackIron', { fl: 0.3 }),
    // head: iron-grey skin, heavy white brows, a bitter set mouth
    E(hx, hy, 3.8, 3.9, 'ally_skinIron', { fl: 0.2 }),
    P([hx - 4.0, hy + 0.2, hx - 3.4, hy - 3.0, hx - 0.6, hy - 4.4, hx + 2.6, hy - 3.8, hx + 3.6, hy - 2.2, hx + 1.0, hy - 2.4, hx - 1.4, hy - 1.6, hx - 2.6, hy + 0.8], 'ally_hairWhite', { bv: 0.8 }),
    P([hx - 0.4, hy - 0.4, hx + 1.4, hy - 0.9, hx + 1.4, hy - 0.2, hx - 0.4, hy + 0.3], 'ally_hairWhite'), P([hx + 1.9, hy - 0.9, hx + 3.6, hy - 0.5, hx + 3.6, hy + 0.2, hx + 1.9, hy - 0.2], 'ally_hairWhite'),
    X(hx + 0.2, hy + 0.5, 0.9, 0.8, '#15161c'), X(hx + 2.5, hy + 0.5, 0.9, 0.8, '#15161c'),
    K(hx + 3.4, hy + 1.0, hx + 3.9, hy + 2.2, 0.6, 0.55, 'ally_skinIron'),
    X(hx + 1.0, hy + 2.8, 2.0, 0.45, 'ally_skinIron:1'), X(hx + 0.6, hy + 3.1, 0.5, 0.4, 'ally_skinIron:1'),
    // two thick white braids framing the face, ringed in iron
    K(hx - 2.9, hy + 1.6, hx - 3.3, hy + 9.6 + w * 0.15, 1.3, 0.9, 'ally_hairWhite'), K(hx + 3.0, hy + 2.6, hx + 3.4, hy + 9.8 + w * 0.15, 1.15, 0.85, 'ally_hairWhite'),
    E(hx - 3.2, hy + 7.0, 1.2, 0.5, 'iron'), E(hx + 3.3, hy + 7.4, 1.1, 0.5, 'iron'),
    // front arm and the rune-etched tongs, taller than she is: long reins, a rivet, open jaws
    K(20.2, 17.6, 21.6, 21.4, 1.7, 1.4, 'ally_mailDark'),
    K(21.4, 23.0, 24.2, 10.8, 0.5, 0.45, 'iron'), K(22.4, 22.8, 24.6, 10.8, 0.5, 0.45, 'iron'),
    // the jaws grip a cold blade-blank: the forge has nothing left to heat it
    P([21.2, 4.0, 27.4, 1.2, 28.0, 2.4, 21.8, 5.4], 'steel', { bv: 0.6, n: [0.1, -0.3, 1] }), K(20.4, 4.9, 21.6, 4.5, 0.35, 0.35, 'iron'),
    X(23.2, 3.2, 2.2, 0.4, 'steel:5'),
    K(24.4, 10.6, 23.2, 6.0, 0.6, 0.5, 'iron'), K(24.4, 10.6, 25.8, 6.2, 0.6, 0.5, 'iron'),
    K(23.2, 6.0, 24.0, 3.6, 0.5, 0.45, 'iron'), K(25.8, 6.2, 25.0, 3.2, 0.5, 0.45, 'iron'),
    E(24.4, 10.6, 0.85, 0.85, 'blackIron'),
    X(22.6, 15.2, 0.5, 1.0, 'silver:5'), X(23.1, 13.0, 0.5, 0.6, 'silver:5'), X(22.0, 18.6, 0.5, 1.0, 'silver:5'),
    E(21.9, 22.0, 1.35, 1.35, 'ally_skinIron'),
  );
  return out;
}
