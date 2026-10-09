import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { ALLY_EYE, ALLY_PUPIL, ring } from './ally';
import './materials';

/**
 * Ranvild the Hound-Warden: broad-shouldered in a wolf-pelt mantle, grey-blond braids, a
 * whistle at the throat and a leash coiled at her hip; a pup in a kin collar sits at her feet.
 */
export function ranvildModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 14.4;
  const hy = 8.6 + b * 0.35;
  const ty = 16.8 + b * 0.25;
  const out: PrimTree[number][] = [Sh(16.4, 28.6, 10.4, 2.3)];
  out.push(
    // hair and the far braid behind the head
    E(hx - 1.8, hy + 1.2, 3.8, 4.6, 'ally_hairAsh'),
    K(hx - 3.0, hy + 2.0, hx - 4.0, hy + 9.6 + w * 0.2, 1.3, 0.85, 'ally_hairAsh'), X(hx - 4.6, hy + 7.8, 1.3, 0.6, 'leatherDark:2'),
    // back arm, fist on the hip
    K(10.0, 13.4, 8.6, 18.0, 1.6, 1.3, 'leather'), E(9.4, 18.8, 1.25, 1.25, 'ally_skinWeather'),
    // legs and fur-wrapped boots
    K(12.6, 21.0, 12.0, 26.8, 1.7, 1.4, 'woolBrown'), K(16.2, 21.0, 17.0, 26.8, 1.7, 1.4, 'woolBrown'),
    E(11.8, 27.6, 2.1, 1.35, 'furBrown'), E(17.4, 27.6, 2.1, 1.35, 'furBrown'),
    K(11.2, 25.4, 13.2, 25.6, 0.5, 0.5, 'leatherDark'), K(16.0, 25.4, 18.0, 25.6, 0.5, 0.5, 'leatherDark'),
    // tunic, belt
    E(14.4, ty, 5.4, 5.6, 'woolGreen', { fl: 0.15 }),
    P([10.0, ty + 3.0, 18.8, ty + 3.0, 19.6, ty + 7.0, 9.4, ty + 7.0], 'woolGreen', { bv: 0.8 }),
    K(9.6, ty + 2.6, 19.2, ty + 2.6, 0.75, 0.75, 'leatherDark'), X(13.8, ty + 2.0, 1.4, 1.2, 'bronze:4'),
    // the leash, coiled and hung at the front hip
    ring(19.4, ty + 5.2, 1.7, 1.3, 0.42, 'ally_collar'), ring(19.8, ty + 5.8, 1.5, 1.1, 0.4, 'ally_collar'),
    K(19.0, ty + 3.0, 19.2, ty + 4.0, 0.4, 0.4, 'ally_collar'),
    // wolf-pelt mantle: broad shoulders, shaggy edge
    P([7.4, 12.6, 9.8, 10.6, 19.0, 10.6, 21.4, 12.6, 20.8, 15.4, 19.2, 14.2, 18.0, 16.0, 16.6, 14.8, 15.2, 16.6, 13.8, 15.0, 12.2, 16.6, 10.8, 14.8, 9.4, 16.2, 8.0, 14.6], 'furGrey', { bv: 1.1 }),
    // the whistle on its cord
    K(hx + 0.2, hy + 3.8, hx + 1.4, ty - 0.6, 0.2, 0.2, 'leatherDark', { occ: false }), K(hx + 1.2, ty - 0.8, hx + 2.8, ty - 0.2, 0.55, 0.45, 'bone'),
    // head: weathered face, hair drawn back from the brow
    E(hx + 0.2, hy, 3.6, 4.0, 'ally_skinWeather', { fl: 0.2 }),
    P([hx - 4.0, hy + 2.4, hx - 3.8, hy - 2.6, hx - 1.4, hy - 4.5, hx + 1.8, hy - 4.3, hx + 3.6, hy - 2.7, hx + 3.9, hy - 1.2, hx + 2.6, hy - 1.9, hx + 1.0, hy - 2.0, hx - 1.0, hy - 1.2, hx - 2.0, hy + 0.6, hx - 2.8, hy + 2.6], 'ally_hairAsh', { bv: 0.9 }),
    // braided rows along the scalp, swept back
    K(hx + 2.8, hy - 2.9, hx - 2.6, hy - 2.0, 0.24, 0.24, 'ally_hairAshDark', { occ: false }), K(hx + 0.6, hy - 4.0, hx - 3.0, hy - 0.4, 0.24, 0.24, 'ally_hairAshDark', { occ: false }),
    X(hx + 0.3, hy + 0.3, 0.9, 1.0, '#1d1416'), X(hx + 2.6, hy + 0.3, 0.85, 1.0, '#1d1416'),
    X(hx + 1.3, hy + 2.6, 1.3, 0.5, '#8a4a3e'),
    X(hx - 0.6, hy + 1.6, 0.8, 0.4, 'ally_skinWeather:2'), // a weathered crease
    // the near braid over the mantle: thin and banded
    K(hx + 2.5, hy + 3.2, hx + 3.0, hy + 8.8 + w * 0.15, 0.85, 0.6, 'ally_hairAsh'),
  );
  for (let i = 0; i < 3; i++) out.push(X(hx + 2.1 + i * 0.15, hy + 4.2 + i * 1.4, 1.2, 0.4, 'ally_hairAsh:2'));
  out.push(
    X(hx + 2.3, hy + 8.4, 1.3, 0.6, 'leatherDark:2'),
    // front arm, hand on the coil
    K(18.8, 13.0, 19.8, 18.8, 1.5, 1.25, 'leather'),
    E(19.9, 19.6, 1.2, 1.2, 'ally_skinWeather'),
  );
  // the pup at her feet, in its own kin collar
  const pup = [
    K(25.0, 26.4, 23.4 + w * 0.6, 23.6, 0.7, 0.5, 'ally_furWar'), // tail, wagging
    E(25.8, 25.8, 2.6, 2.6, 'ally_furWar'), E(26.6, 27.4, 1.6, 1.1, 'ally_furWar'),
    K(27.2, 24.2, 27.6, 27.8, 0.9, 0.8, 'ally_furWar'), E(28.2, 28.2, 1.1, 0.6, 'ally_furWarPale'),
    E(27.6, 22.0, 2.1, 1.9, 'ally_furWar'),
    K(28.6, 22.6, 30.2, 23.0, 1.1, 0.8, 'ally_furWarPale'), E(30.3, 22.6, 0.55, 0.5, 'ally_nose'),
    E(26.4, 20.6 + (f === 2 ? 0.4 : 0), 0.9, 1.4, 'ally_furWarDark', { a: -0.5 }), // floppy ear
    X(28.0, 21.4, 0.8, 0.8, ALLY_EYE, { em: true, glow: false }), X(28.4, 21.5, 0.45, 0.6, ALLY_PUPIL),
    K(26.4, 23.4, 28.0, 24.4, 0.5, 0.5, 'ally_collar'), E(28.2, 25.0, 0.6, 0.7, 'emKin'), Lt(28.2, 25.0, 2.6, '#f0c062', 0.35),
  ];
  out.push(pup);
  return out;
}
