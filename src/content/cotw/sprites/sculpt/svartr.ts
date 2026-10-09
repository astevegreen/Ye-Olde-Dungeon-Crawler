import { E, K, P, X, Lt, Sh, bolt, breath, drip, type PrimTree } from './kit';
import './materials';

/** The crown of dead roots: from (ax, ay) through a bend to (bx, by), off the head, and the root's radius. */
const CROWN: ReadonlyArray<[number, number, number, number, number]> = [
  [-2.6, -2, -5, -5.6, 0.75],
  [-1.2, -3, -2.2, -6.2, 0.8],
  [0.4, -3.2, 1, -6.5, 0.75],
  [1.8, -2.6, 3.8, -5.8, 0.7],
  [-3, -0.6, -5.6, -1.4, 0.6],
];

/**
 * Svartr, the Taproot Matriarch: an undead troll-matriarch grown into a rotten taproot, root
 * from the waist down, crowned in dead roots, both claws raised with lightning crawling
 * between them. Idle: the bolt re-forks, black sap drips.
 */
export function svartrModel(f: number): PrimTree {
  const b = breath(f);
  const out: PrimTree[number][] = [Sh(16, 28.6, 13.5, 2.4, 0.5)];
  out.push(E(15.4, 28, 9.4, 1.8, 'boss_sap', { fl: 0.9 }));
  // roots splaying over the floor
  out.push(K(11.6, 25.4, 3.2, 28.2, 1.9, 0.6, 'boss_root'));
  out.push(K(10, 23.4, 5.2, 24.6, 1.6, 1, 'boss_root'), K(5.2, 24.6, 3.4, 27.8, 1, 0.5, 'boss_root'));
  out.push(K(19.2, 25.2, 28.6, 27.8, 1.9, 0.6, 'boss_root'));
  out.push(K(17.6, 26.4, 23.4, 28.8, 1.6, 0.5, 'boss_root'));
  // the trunk her body grows from: buttressed and rounded
  out.push(P([10.6, 16.6, 20.2, 16.6, 21, 22.6, 23.6, 27.4, 19.2, 26.4, 15.6, 28.4, 12, 26.6, 7.6, 27.6, 10, 22.6], 'boss_root', { bv: 1.8 }));
  out.push(K(11.8, 18, 9.6, 26.8, 1.5, 2.2, 'boss_root'));
  out.push(K(19, 18, 21.4, 26.4, 1.5, 2.1, 'boss_root'));
  out.push(K(15.4, 18, 15.6, 27.6, 2, 2.6, 'boss_root'));
  out.push(K(13.4, 20, 13.2, 27, 0.4, 0.55, 'boss_sap', { occ: false }));
  out.push(K(17.6, 20.4, 18.2, 25.6, 0.35, 0.5, 'boss_sap', { occ: false }));
  // root-hair down her back
  out.push(P([12.2, 5.2, 14.8, 4.8, 13.6, 13, 10.6, 19.6, 9.2, 16.6, 10.4, 10], 'boss_root', { bv: 0.9, ink: -0.04 }));
  out.push(K(11.2, 9, 9.6, 17, 0.4, 0.3, 'boss_deadRoot', { occ: false }));
  // the far arm, raised high behind the head
  out.push(K(14, 11 - b * 0.2, 19, 5.2, 1.5, 1.3, 'boss_trollDead', { ink: -0.08 }));
  out.push(K(19, 5.2, 21.4, 2.6, 1.3, 1, 'boss_trollDead', { ink: -0.08 }));
  for (const [ex, ey] of [[20.4, 1], [22.2, 1], [23.6, 1.8]]) out.push(K(21.4, 2.6, ex, ey, 0.45, 0.18, 'boneOld'));
  // gaunt torso rising from the wood
  out.push(E(15.4, 13.6 - b * 0.2, 4.4, 5, 'boss_trollDead'));
  out.push(K(12.6, 13.2, 15.8, 14.2, 0.35, 0.35, 'boss_trollDead', { ink: -0.2, occ: false }));
  out.push(K(12.8, 15, 16.4, 15.8, 0.35, 0.35, 'boss_trollDead', { ink: -0.2, occ: false }));
  // the wood climbing her body: roots grown up over the hips and belly
  out.push(P([10.6, 17.4, 12, 15.4, 13.4, 16.6, 15.4, 14.6, 16.6, 16.4, 18.4, 15, 20.2, 17.4, 20.2, 19, 10.6, 19], 'boss_root', { bv: 0.9 }));
  out.push(K(12.6, 16.8, 13.8, 12.6, 0.5, 0.3, 'boss_root'), K(17.6, 16.4, 18.6, 12.4, 0.45, 0.25, 'boss_root'));
  // head: long troll nose, tusk, violet eyes, crown of dead roots
  const hx = 15.6;
  const hy = 7.8 - b * 0.25;
  for (const [ax, ay, bx, by, r] of CROWN) {
    const mx = hx + (ax + bx) / 2 + 0.6;
    const my = hy + (ay + by) / 2;
    out.push(K(hx + ax, hy + ay, mx, my, r, r * 0.7, 'boss_deadRoot'));
    out.push(K(mx, my, hx + bx, hy + by, r * 0.7, 0.25, 'boss_deadRoot'));
  }
  out.push(E(hx, hy, 3.4, 3.4, 'boss_trollHead'));
  out.push(K(hx - 0.6, hy + 2.6, hx + 3, hy + 3.2, 1.1, 0.85, 'boss_trollHead', { ink: -0.06 }));
  out.push(X(hx - 0.6, hy - 1.2, 4.4, 1.8, '#1d1a24'));
  out.push(X(hx + 0.1, hy - 0.9, 1.3, 1.1, 'emUnholy:4', { em: true }), X(hx + 2.1, hy - 0.8, 1.1, 1, 'emUnholy:4', { em: true }));
  out.push(K(hx - 1.6, hy - 1.7, hx + 3, hy - 1.5, 0.85, 0.7, 'boss_trollHead', { ink: 0.05 }));
  out.push(K(hx + 2.2, hy - 0.8, hx + 5.6, hy + 2, 1.25, 0.85, 'boss_trollHead'));
  out.push(K(hx + 5.6, hy + 2, hx + 5.2, hy + 3.4, 0.85, 0.5, 'boss_trollHead'));
  out.push(P([hx + 2, hy + 3, hx + 3, hy + 3, hx + 2.8, hy + 1.2], 'bone'));
  out.push(K(hx - 2.2, hy - 2.2, hx - 3, hy + 2.6, 0.35, 0.25, 'boss_deadRoot', { occ: false }));
  // near arm, bent with the claw raised forward
  out.push(K(18.2, 11.6, 23.4, 13.6, 1.7, 1.4, 'boss_trollDead'));
  out.push(K(23.4, 13.6, 26.6, 9.4, 1.4, 1.1, 'boss_trollDead'));
  out.push(K(19.6, 12.6, 21, 11.4, 0.5, 0.5, 'boss_root', { occ: false }), K(21.6, 13.8, 22.8, 12.4, 0.5, 0.5, 'boss_root', { occ: false }));
  for (const [ex, ey] of [[25.8, 6.8], [27.6, 6.8], [29, 8.2]]) out.push(K(26.6, 9.2, ex, ey, 0.45, 0.2, 'boneOld'));
  // lightning crawling between the claws: a main bolt, a fork, sparks at the tips
  const s = f * 7 + 3;
  const main = bolt(22.8, 1.4, 27.4, 6.8, s, 6, 1.3, 0.3, 'emBolt');
  out.push(main.prims);
  const [fx, fy] = main.pts[2];
  out.push(bolt(fx, fy, 25 + (f % 2) * 2, 7.4, s + 50, 3, 0.9, 0.24, 'emBolt').prims);
  out.push(bolt(21.8, 1.8, 26, 7, s + 101, 5, 1.5, 0.22, 'emBolt').prims);
  out.push(E(22.6, 1.5, 0.7, 0.7, 'emBolt'), E(27.4, 7, 0.7, 0.7, 'emBolt'));
  const [spx, spy] = [[20.6, 3.8], [25.2, 3], [28.4, 4.8], [23.6, 6.4]][f % 4];
  out.push(X(spx, spy, 0.7, 0.7, '#ffffff', { em: true }));
  // black sap drips
  out.push(drip(13.2, 26.6, 1.4, f, 0, 'boss_sap', 0.45));
  out.push(drip(23.6, 14.8, 4.2, f, 2, 'boss_sap', 0.45));
  out.push(Lt(24.8, 4.6, 10, '#fff27a', 0.8 + (f % 2) * 0.15));
  out.push(Lt(hx + 1, hy - 0.5, 3, '#a868ff', 0.4));
  return out;
}
