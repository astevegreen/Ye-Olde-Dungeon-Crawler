import { E, K, P, X, Lt, Sh, breath, drip, sway, type PrimTree } from './kit';
import './materials';

/**
 * Víðnir, Herald of the Wyrm: upright and proud, a half-dragon priest in a tattered mantle,
 * the wyrm's fang-banner in one claw, the other resting on the great shed fang he guards.
 * Idle: venom drips from green fangs, the banner stirs.
 */
export function vidnirModel(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const out: PrimTree[number][] = [Sh(16, 28.6, 13, 2.4, 0.5)];
  // the banner: pole, crossbar, tattered cloth that stirs, a fang for a sigil
  out.push(K(6.8, 28.4, 7.4, 1.6, 0.6, 0.55, 'woodDark'));
  out.push(P([7.4, 0.9, 8.2, 2, 6.6, 2], 'bronze', { bv: 0.4 }));
  out.push(K(3.4, 2.6, 11.4, 2.6, 0.45, 0.45, 'woodDark'));
  const w = sw * 0.45;
  out.push(P([3.6, 2.8, 11.2, 2.8, 11.2 + w, 10.6, 10.2 + w, 9.4, 9.4 + w, 13.6, 8.2 + w, 11.4, 7.2 + w * 1.2, 15.2, 6, 11.6 + w, 5 + w, 13.6, 4.2 + w * 0.6, 10.8, 3.6, 11.4], 'boss_banner', { bv: 0.7 }));
  out.push(P([5.8, 4.4, 9.2, 4.2, 8.4, 6.8, 7.4 + w * 0.3, 10.2, 6.6, 6.8], 'bone', { bv: 0.4 }));
  // tail curling out behind the hem
  out.push(K(11.6, 25.2, 5.4, 27.6, 1.8, 1.1, 'boss_wyrmScale'), K(5.4, 27.6, 2.6, 25.4, 1.1, 0.5, 'boss_wyrmScale'));
  // clawed feet under the mantle
  out.push(E(12.4, 27.8, 2.4, 1.2, 'boss_wyrmScale'), E(19.6, 27.8, 2.6, 1.2, 'boss_wyrmScale'));
  out.push(X(14.2, 27.6, 0.8, 0.8, 'bone:4'), X(21.6, 27.6, 0.8, 0.8, 'bone:4'));
  // back arm holding the pole
  out.push(K(12.6, 12.4, 8.6, 15.6, 1.5, 1.2, 'boss_mantle', { ink: -0.06 }));
  out.push(E(7.4, 15.8, 1.4, 1.4, 'boss_wyrmScale'));
  // the mantle, tattered at the hem
  const hm = sw * 0.3;
  out.push(P([11.4, 10.6, 18.8, 10.6, 20.6, 18.4, 21.8, 27 + hm, 20.2, 26.2, 18.8, 27.8 - hm, 17, 26.4, 15.2, 28.2 + hm, 13.6, 26.4, 11.6, 27.8, 10.2, 26.2 - hm, 9.6, 18.4], 'boss_mantle', { bv: 1.3 }));
  // tabard in pale linen
  out.push(P([15.4, 11.6, 19, 11.6, 19.6, 25.6, 17.6, 24.6, 15.6, 25.8], 'linen', { bv: 0.7 }));
  out.push(P([16.4, 14.2, 18.6, 14.2, 18, 16.4, 17.4, 18.6, 16.8, 16.4], 'boss_wyrmScale', { bv: 0.3 }));
  out.push(K(15.2, 20.4, 19.8, 20.4, 0.55, 0.55, 'bronze'));
  // chest and a long neck rising: verdigris scales with a pale throat
  out.push(E(16.4, 11.6 - b * 0.2, 3.8, 2.6, 'boss_wyrmScale'));
  out.push(K(16.4, 11 - b * 0.2, 17.6, 6.8, 2, 1.6, 'boss_wyrmScale'));
  out.push(K(17.6, 6.8, 19.4, 4, 1.6, 1.4, 'boss_wyrmScale'));
  out.push(K(18.4, 10.2, 18.9, 6.8, 0.75, 0.65, 'horn', { occ: false }));
  out.push(K(18.9, 6.8, 20.2, 4.8, 0.65, 0.55, 'horn', { occ: false }));
  // head: proud, horned, jaws parted on green fangs
  const hx = 20;
  const hy = 3.6 - b * 0.15;
  out.push(K(hx - 1, hy - 0.8, hx - 5.5, hy - 2, 0.9, 0.3, 'horn'));
  out.push(K(hx - 0.2, hy - 1.4, hx - 3.9, hy - 2.3, 0.7, 0.25, 'horn'));
  out.push(E(hx, hy, 2.6, 2.1, 'boss_wyrmScale'));
  out.push(K(hx + 0.6, hy + 0.2, hx + 5.6, hy + 1.6, 1.6, 1, 'boss_wyrmScale'));
  out.push(K(hx + 0.6, hy + 1.8, hx + 5, hy + 3.2, 1, 0.7, 'boss_wyrmScale', { ink: -0.08 }));
  out.push(X(hx + 1.6, hy + 2.2, 3.2, 0.6, '#16120e'));
  out.push(P([hx + 3.2, hy + 2, hx + 3.9, hy + 2, hx + 3.6, hy + 3.6], 'emPoison'));
  out.push(P([hx + 4.6, hy + 2.4, hx + 5.2, hy + 2.4, hx + 4.9, hy + 3.8], 'emPoison'));
  out.push(X(hx + 0.5, hy - 0.7, 1.2, 0.9, 'emPoison:4', { em: true }));
  out.push(K(hx - 0.6, hy - 1.4, hx + 1.8, hy - 1.2, 0.5, 0.4, 'boss_wyrmScale', { ink: 0.08, occ: false }));
  out.push(drip(hx + 3.6, hy + 3.6, 6, f, 0, 'emPoison', 0.45));
  out.push(drip(hx + 4.9, hy + 3.8, 5, f, 2, 'emPoison', 0.4));
  // the great shed fang, standing on its broken root and curving to a point; his claw rests on its inner curve
  out.push(P([21.8, 28.6, 23.4, 24.2, 25.2, 19.8, 27, 15.6, 28.2, 12.4, 29, 9.2, 29.6, 11.6, 29.8, 15.6, 29.4, 19.6, 28.6, 23.6, 28, 28.6], 'boss_ivory', { bv: 1.6 }));
  out.push(K(26.6, 25.4, 28.6, 13.6, 0.3, 0.18, 'boss_ivory', { ink: 0.3, occ: false, ol: false }));
  out.push(P([21.6, 28.7, 22.3, 26.6, 23.6, 27.2, 25, 26, 26.6, 26.8, 28.2, 26.2, 28.2, 28.7], 'boneOld', { bv: 0.5 }));
  out.push(E(18.6, 12.4, 1.9, 1.8, 'boss_mantle'));
  out.push(K(18.8, 12.8, 23.2, 17.6, 1.5, 1.3, 'boss_mantle'));
  out.push(E(24.6, 18.4, 1.6, 1.4, 'boss_wyrmScale'));
  out.push(K(25.2, 17.6, 26.6, 18.6, 0.42, 0.25, 'bone', { occ: false }), K(25.2, 18.8, 26.4, 20, 0.42, 0.25, 'bone', { occ: false }));
  out.push(Lt(hx + 3.6, hy + 3, 6, '#95dc4c', 0.6));
  return out;
}
