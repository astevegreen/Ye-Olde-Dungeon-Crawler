import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import './materials';

/**
 * Thrain the Rune-Smith: a dwarf in a leather hood, a rust-red tunic and an apron, his forked black beard tucked in
 * his belt, at a small anvil where a rune of return glows blue under his hammer; sparks jump
 * where the hammer last struck.
 */
export function thrainModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 13.6;
  const hy = 12.4 + b * 0.3;
  const ty = 20.4 + b * 0.2;
  const pulse = [0.12, 0, 0.06, 0.18][f];
  const out: PrimTree[number][] = [Sh(16.4, 28.6, 11.0, 2.3)];
  out.push(
    // back arm, fist on the hip
    K(9.6, 17.4, 8.2, 21.0, 1.7, 1.4, 'woolRed'), E(8.8, 21.8, 1.3, 1.3, 'skin'),
    // short legs, heavy boots
    K(11.8, 24.4, 11.4, 27.0, 1.9, 1.7, 'woolBrown'), K(15.6, 24.4, 16.0, 27.0, 1.9, 1.7, 'woolBrown'),
    E(11.2, 27.7, 2.3, 1.2, 'leatherDark'), E(16.4, 27.7, 2.3, 1.2, 'leatherDark'),
    // a stout body in a rust-red tunic under a scorched apron
    E(13.4, ty, 5.8, 5.2, 'woolRed', { fl: 0.12 }),
    P([9.6, ty - 2.6, 17.4, ty - 2.6, 18.2, ty + 5.4, 13.4, ty + 6.0, 8.8, ty + 5.4], 'leather', { bv: 1.0 }),
    X(14.8, ty + 2.4, 1.2, 0.8, '#3a2e2a'),
    K(8.6, ty + 0.6, 18.4, ty + 0.6, 0.7, 0.7, 'leatherDark'), X(12.8, ty, 1.4, 1.2, 'bronze:4'),
    // head: a hood of leather with a brass band, a ruddy face, a heavy nose
    E(hx, hy, 3.7, 3.8, 'skin', { fl: 0.2 }),
    P([hx - 4.2, hy + 2.8, hx - 4.0, hy - 1.6, hx - 2.4, hy - 3.8, hx + 0.6, hy - 4.6, hx + 3.0, hy - 3.6, hx + 4.0, hy - 1.4, hx + 1.4, hy - 1.6, hx - 1.4, hy - 0.8, hx - 2.4, hy + 2.8], 'leatherDark', { bv: 0.9 }),
    K(hx - 3.8, hy - 1.4, hx + 3.8, hy - 1.8, 0.4, 0.4, 'bronze'),
    X(hx + 0.2, hy - 0.6, 1.4, 0.5, 'hairDark:2'), X(hx + 2.2, hy - 0.7, 1.4, 0.5, 'hairDark:2'),
    X(hx + 0.4, hy + 0.1, 0.85, 0.85, '#1d1416'), X(hx + 2.6, hy + 0.1, 0.85, 0.85, '#1d1416'),
    E(hx + 3.8, hy + 1.3, 1.0, 0.95, 'skin'),
    // the forked black beard, down to the belt and tucked in
    P([hx - 2.4, hy + 1.6, hx + 4.0, hy + 1.8, hx + 3.6, hy + 4.4, hx + 1.0, hy + 5.0, hx - 2.0, hy + 4.2], 'hairDark', { bv: 0.7 }),
    K(hx - 0.2, hy + 4.2, hx - 0.6 + w * 0.12, ty + 0.4, 1.1, 0.6, 'hairDark'), K(hx + 2.2, hy + 4.0, hx + 2.6 + w * 0.12, ty + 0.4, 1.0, 0.6, 'hairDark'),
    P([hx + 0.4, hy + 2.2, hx + 4.4, hy + 2.0, hx + 3.8, hy + 3.0, hx + 0.6, hy + 3.0], 'hairDark', { bv: 0.3, ink: 0.06 }),
  );
  // the anvil on its stump, the rune of return glowing on its face
  const ax = 24.4;
  const ay = 21.4;
  out.push(
    K(ax - 1.8, 27.8, ax - 1.6, ay + 2.4, 1.7, 1.6, 'woodDark'), E(ax - 1.7, 27.9, 2.4, 0.8, 'woodDark'),
    P([ax - 4.0, ay + 2.4, ax + 0.8, ay + 2.4, ax + 0.4, ay + 1.2, ax - 3.6, ay + 1.2], 'blackIron', { bv: 0.3 }),
    P([ax - 4.6, ay - 1.0, ax + 1.2, ay - 1.0, ax + 4.6, ay - 0.6, ax + 1.0, ay + 0.6, ax - 0.6, ay + 1.4, ax - 3.2, ay + 1.4, ax - 4.6, ay + 0.4], 'blackIron', { bv: 0.5 }),
    P([ax - 4.4, ay - 1.8, ax - 0.8, ay - 1.8, ax - 1.2, ay - 1.0, ax - 4.0, ay - 1.0], 'runestone', { bv: 0.3 }),
    X(ax - 3.2, ay - 1.7, 0.4, 0.8, 'emArcane:4', { ink: pulse }), X(ax - 2.4, ay - 1.7, 0.4, 0.8, 'emArcane:4', { ink: pulse }), X(ax - 2.9, ay - 1.6, 0.6, 0.3, 'emArcane:4'),
    Lt(ax - 2.6, ay - 1.6, 6, '#6aa6ff', 0.5 + pulse),
  );
  // the sparks of the last strike, a different scatter each frame
  const sparks = [
    [[ax - 0.6, ay - 3.2], [ax + 0.8, ay - 2.4]],
    [[ax + 0.2, ay - 4.2]],
    [[ax - 4.4, ay - 2.8], [ax + 1.4, ay - 3.6], [ax - 1.4, ay - 4.6]],
    [[ax - 3.8, ay - 4.0]],
  ][f];
  out.push(sparks.map(([x, y]) => X(x, y, 0.5, 0.5, 'emFireCore:5', { em: true })));
  out.push(
    // front arm, the rune-hammer held over the anvil
    K(17.6, 17.4, 19.8, 19.4, 1.7, 1.4, 'woolRed'), K(19.8, 19.4, 20.8, 15.8, 1.4, 1.2, 'woolRed'),
    E(21.0, 15.2, 1.3, 1.3, 'skin'),
    K(20.4, 16.2, 22.4, 11.0, 0.4, 0.35, 'woodDark'),
    P([20.6, 9.4, 24.4, 10.6, 23.8, 12.6, 20.0, 11.4], 'iron', { bv: 0.5 }),
    X(21.4, 10.2, 1.8, 0.4, 'silver:4'),
  );
  return out;
}
