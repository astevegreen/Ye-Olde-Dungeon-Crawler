import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Astrid the Alchemist: slender in a dark teal gown, an auburn braid over her shoulder, a
 * bandolier of stoppered vials and herbs at her belt; she holds up a flask of gold draught
 * (healing is gold) that steams.
 */
export function astridModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 14.8;
  const hy = 8.4 + b * 0.3;
  const ty = 16.6 + b * 0.25;
  const glow = [0, 0.1, 0.18, 0.08][f];
  const out: PrimTree[number][] = [Sh(16, 28.6, 8.4, 2.2)];
  out.push(
    // hair gathered behind the head
    E(hx - 2.0, hy + 0.6, 3.6, 4.2, 'ally_hairAuburn'),
    // back arm, the hand gathering her skirt
    K(11.4, 13.4, 10.2, 18.4, 1.4, 1.2, 'ally_tealDark'), E(10.4, 19.2, 1.05, 1.05, 'skinPale'),
    // the gown: fitted above, flared to the floor, a dark fold down the skirt
    P([11.8, 12.4, 18.8, 12.4, 20.0, 19.4, 22.2, 27.8, 16.4, 28.6, 10.0, 27.8, 11.2, 19.4], 'ally_teal', { bv: 1.2 }),
    K(15.4, 21.0, 14.6, 27.8, 0.45, 0.7, 'ally_tealDark', { occ: false }), K(18.6, 21.2, 19.6, 27.8, 0.4, 0.6, 'ally_tealDark', { occ: false }),
    E(13.6, 28.3, 1.4, 0.7, 'leatherDark'), E(18.6, 28.4, 1.4, 0.7, 'leatherDark'),
    // belt, and the herbs hung at the hip
    K(11.2, ty + 3.2, 20.2, ty + 3.0, 0.55, 0.55, 'leather'),
  );
  for (const [x, l] of [[10.8, 3.4], [11.6, 2.8], [12.4, 3.2]]) out.push(K(x + 0.4, ty + 3.6, x + w * 0.15, ty + 3.6 + l, 0.4, 0.22, 'woolGreen'));
  out.push(
    // the bandolier of vials across the chest
    K(12.0, 12.8, 19.4, 19.4, 0.6, 0.6, 'leatherDark'),
    X(13.3, 13.0, 0.8, 1.6, '#c04a34'), X(13.4, 12.6, 0.6, 0.5, 'woodDark:3'),
    X(15.1, 14.7, 0.8, 1.6, '#62a648'), X(15.2, 14.3, 0.6, 0.5, 'woodDark:3'),
    X(16.9, 16.4, 0.8, 1.6, '#4c7ed2'), X(17.0, 16.0, 0.6, 0.5, 'woodDark:3'),
    // a short shawl over the shoulders
    P([10.8, 12.2, 19.6, 11.8, 20.4, 14.2, 15.6, 14.8, 10.8, 14.6], 'ally_tealDark', { bv: 0.8 }),
    // head: pale, fine-boned, a fringe swept to one side
    E(hx + 0.2, hy, 3.4, 3.8, 'skinPale', { fl: 0.2 }),
    P([hx - 3.6, hy + 1.8, hx - 3.4, hy - 2.6, hx - 1.0, hy - 4.2, hx + 2.0, hy - 4.0, hx + 3.6, hy - 2.2, hx + 2.4, hy - 1.4, hx + 0.4, hy - 1.8, hx - 1.4, hy - 0.4, hx - 2.4, hy + 1.8], 'ally_hairAuburn', { bv: 0.8 }),
    X(hx + 0.4, hy + 0.3, 0.85, 0.95, '#1d1416'), X(hx + 2.5, hy + 0.3, 0.8, 0.95, '#1d1416'),
    K(hx + 3.2, hy + 0.8, hx + 3.7, hy + 1.9, 0.5, 0.45, 'skinPale'),
    X(hx + 1.4, hy + 2.6, 1.1, 0.4, '#a0524a'),
    // the braid, over the near shoulder and down the front, tied in leather
    K(hx + 2.2, hy + 3.0, hx + 2.8, hy + 9.8 + w * 0.15, 0.9, 0.6, 'ally_hairAuburn'),
    X(hx + 1.9, hy + 4.4, 1.3, 0.4, 'ally_hairAuburn:2'), X(hx + 2.1, hy + 6.2, 1.2, 0.4, 'ally_hairAuburn:2'),
    X(hx + 2.2, hy + 9.0, 1.2, 0.6, 'leatherDark:2'),
    // front arm, raised, the hand cupping the flask
    K(19.0, 13.2, 21.4, 16.8, 1.4, 1.2, 'ally_teal'), K(21.4, 16.8, 22.8, 13.6, 1.2, 1.0, 'ally_teal'),
    E(23.0, 13.0, 1.0, 1.0, 'skinPale'),
  );
  // the flask: a round belly of glass, a long neck, the gold draught glowing inside
  const fx = 23.2;
  const fy = 10.6;
  out.push(
    E(fx, fy, 2.1, 2.0, 'ally_glass'),
    E(fx, fy + 0.5, 1.6, 1.3, 'ally_elixir', { ink: glow }),
    K(fx, fy - 1.8, fx, fy - 3.8, 0.55, 0.5, 'ally_glass'),
    K(fx - 0.7, fy - 3.9, fx + 0.7, fy - 3.9, 0.3, 0.3, 'ally_glass'),
    X(fx - 1.1, fy - 0.8, 0.5, 0.7, '#f6fbff', { em: true, glow: false }), // a glint on the glass
    Lt(fx, fy + 0.4, 8, '#f6c64a', 0.75 + glow),
  );
  // the steam: a curl that rises from the neck and thins
  const curls = [
    [[fx + 0.2, fy - 5.0, 0.6, 0.5], [fx - 0.5, fy - 6.4, 0.5, 0.4]],
    [[fx + 0.4, fy - 5.2, 0.7, 0.55], [fx - 0.2, fy - 6.8, 0.55, 0.45]],
    [[fx + 0.1, fy - 5.0, 0.55, 0.5], [fx + 0.4, fy - 6.6, 0.6, 0.5], [fx - 0.4, fy - 7.8, 0.4, 0.35]],
    [[fx - 0.1, fy - 5.1, 0.6, 0.5], [fx - 0.6, fy - 6.6, 0.5, 0.4]],
  ][f];
  out.push(curls.map((p) => E(p[0], p[1], p[2], p[3], 'ally_vapour', { ol: false, occ: false })));
  return out;
}
