import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Gunther the Smith: big, bald and soot-stained, a leather apron, a red braided beard ringed in
 * iron and the hammer on his shoulder; the forge lights him from below.
 */
export function guntherModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.8;
  const hy = 7.6 + b * 0.35;
  const ty = 16.6 + b * 0.25;
  const out: PrimTree[number][] = [Sh(16, 28.6, 9, 2.4)];
  out.push(
    // back arm, big and sooty
    K(10.2, 12.8, 8.8, 17.6, 2.1, 1.8, 'ally_skinBald'), K(8.8, 17.6, 9.0, 20.6, 1.8, 1.6, 'ally_soot'), E(9.2, 21.2, 1.6, 1.5, 'ally_soot'),
    // legs and heavy boots
    K(13.6, 21.4, 12.8, 26.6, 2.0, 1.7, 'woolBrown'), K(18.2, 21.4, 19.2, 26.6, 2.0, 1.7, 'woolBrown'),
    E(12.4, 27.5, 2.5, 1.45, 'leatherDark'), E(19.6, 27.5, 2.5, 1.45, 'leatherDark'),
    // barrel torso in a dark shirt
    E(15.8, ty, 6.4, 6.4, 'ally_shirt', { fl: 0.15 }),
    // leather apron (tilted to catch the forge below), neck strap, pocket
    P([11.0, 13.2, 20.6, 13.2, 21.8, 25.8, 15.8, 26.4, 9.8, 25.8], 'leather', { bv: 1.2, n: [0, 0.3, 1] }),
    K(11.6, 13.2, 13.0, 10.6, 0.55, 0.55, 'leatherDark'), K(20.0, 13.2, 18.6, 10.6, 0.55, 0.55, 'leatherDark'),
    K(9.8, ty + 2.4, 21.8, ty + 2.4, 0.6, 0.6, 'leatherDark'),
    P([12.4, ty + 4.0, 16.0, ty + 4.0, 15.8, ty + 7.4, 12.6, ty + 7.4], 'leatherDark', { bv: 0.5, n: [0, 0.3, 1] }),
    X(13.0, ty + 2.6, 0.6, 1.6, 'woodDark:3'), X(14.4, ty + 2.2, 0.6, 2.0, 'iron:4'),
    X(17.6, ty + 5.6, 1.4, 0.8, '#3a2e2a'), X(18.6, ty + 1.0, 0.9, 0.6, '#3a2e2a'), // soot on the apron
    // head: bald, heavy brow, braided beard
    E(hx - 3.6, hy + 0.6, 0.9, 1.3, 'ally_skinBald'),
    E(hx, hy, 4.0, 4.2, 'ally_skinBald', { fl: 0.18 }),
    X(hx - 0.4, hy - 0.6, 3.8, 0.7, '#4a2c1e'), // brow
    X(hx + 0.2, hy + 0.3, 0.9, 0.8, '#1d1416'), X(hx + 2.5, hy + 0.3, 0.9, 0.8, '#1d1416'),
    X(hx - 2.2, hy + 1.2, 1.4, 0.9, '#5a4036'), // soot on the cheek
    P([hx - 2.6, hy + 1.4, hx + 4.0, hy + 1.2, hx + 3.6, hy + 4.6, hx + 1.0, hy + 6.0, hx - 2.0, hy + 4.2], 'hairRed', { bv: 0.7 }),
    K(hx + 1.0, hy + 5.4, hx + 1.2 + w * 0.15, hy + 10.4, 0.85, 0.6, 'hairRed'), E(hx + 1.2 + w * 0.15, hy + 8.4, 0.9, 0.55, 'iron'),
    K(hx + 3.4, hy + 1.4, hx + 4.2, hy + 2.4, 0.65, 0.55, 'ally_skinBald'), // nose
    // front arm, hammer over the shoulder
    K(21.0, 12.6, 22.4, 17.6, 2.1, 1.8, 'ally_skinBald'), K(22.4, 17.6, 22.6, 19.6, 1.8, 1.6, 'ally_soot'),
    K(22.6, 21.6, 25.0, 8.4, 0.7, 0.6, 'woodDark'),
    P([22.6, 5.8, 27.6, 6.8, 27.2, 9.8, 22.0, 8.8], 'blackIron', { bv: 0.8 }), P([27.4, 6.6, 29.0, 7.6, 28.8, 9.0, 27.2, 9.6], 'blackIron', { bv: 0.4 }),
    E(22.8, 20.2, 1.65, 1.55, 'ally_soot'),
    // the forge glows on his front from below
    Lt(17.0, 31.0, 16, '#ff8a2c', 1.5 + [0, 0.1, 0.2, 0.06][f], 2),
  );
  return out;
}
