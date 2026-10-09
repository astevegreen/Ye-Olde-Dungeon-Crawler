import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { claws, limb, links, spike, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** Shadow Fiend: a lean runner of smoke around a violet heart. It leaves a trail of itself; its claws spit white-yellow sparks. */
function shadowFiend(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const sm = 'mon2_smoke';
  const s2 = 'mon2_smokeThin';
  const out: Out = [Sh(16, 28.6, 7.4, 2)];
  // smoke left hanging where it just was: streamers that taper and waver
  const so = { ol: false, occ: false };
  out.push(limb([14, 14.2, 10.2, 13.2 + sw * 0.3, 6.4, 14 - sw * 0.3, 2.6, 12.8 + sw * 0.2], 2.2, 0.2, s2, so));
  out.push(limb([12.8, 19, 9, 19.8 - sw * 0.3, 5.4, 19.2 + sw * 0.3, 2.4, 20], 1.6, 0.2, s2, so));
  out.push(limb([11, 24.2, 7.8, 25 + sw * 0.2, 4.6, 24.4], 1.1, 0.15, s2, so));
  // far limbs
  out.push(limb([16.4, 13.4, 12.6, 16.2, 9.4, 15.6], 1, 0.55, sm, { ink: -0.1 }));
  out.push(limb([13.6, 19.4, 10.6, 22.6, 9, 27.8], 1.4, 0.6, sm, { ink: -0.1 }));
  // torso leaning into the run
  out.push(K(13.4, 19.2, 17.8, 12.8, 2.4, 2.6, sm));
  out.push(E(16, 15.4 + b * 0.2, 1.3, 1.8, 'emUnholy', { a: -0.6 }));
  out.push(K(16, 15.4, 18.6, 12.6, 0.3, 0.15, 'emUnholy'), K(16, 15.6, 13.6, 18.6, 0.3, 0.15, 'emUnholy'));
  // near leg
  out.push(limb([15, 19.6, 18.6, 23, 17.2, 27.8], 1.5, 0.6, sm));
  out.push(claws(17.2, 27.9, 0.1, 1.4, 'mon2_claw', 2, 0.3));
  // head: horns of smoke streaming back
  out.push(K(19.6, 9.2, 14.6, 6.2 + sw * 0.2, 0.95, 0.2, sm), K(20.6, 9, 17.2, 4.8, 0.8, 0.15, sm));
  out.push(E(20.2, 10.4, 2.4, 2, sm, { a: 0.2 }), K(21, 11, 23.4, 11.8, 1.2, 0.6, sm));
  out.push(X(21.2, 9.9, 1.4, 0.6, 'emUnholy:5'));
  // near arm reaching, claws sparking
  out.push(limb([18.4, 13.2, 21.8, 17.4, 25.2, 19], 1.2, 0.65, sm));
  out.push(claws(25.2, 19, 0.15, 2.6, 'mon2_claw', 3, 0.38));
  const sp = [[28, 17.6], [28.6, 20.2], [27, 21.8], [29.2, 18.8]];
  for (let i = 0; i < 2; i++) {
    const s = sp[(i * 2 + f) % 4];
    out.push(X(s[0], s[1], 0.7, 0.7, '#fffbd2', { em: true }));
  }
  out.push(X(sp[(f + 1) % 4][0] - 0.8, sp[(f + 1) % 4][1] + 0.6, 0.5, 0.5, '#fff27a', { em: true }));
  out.push(Lt(16, 15, 9, '#a868ff', 0.9), Lt(27.6, 19.6, 4, '#fff27a', 0.5));
  return out;
}

/** Garmling: Garm's whelp. A black hound, head low, hackles up, its broken chain still dragging; violet eyes with ember at the core, an ember maw. */
function garmling(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const fur = 'mon2_hellFur';
  const out: Out = [Sh(15.6, 28.6, 11.4, 2.2)];
  out.push(limb([6.6, 15.6, 3.6, 17.4, 2.6, 21 + sw * 0.3], 1, 0.4, fur));
  // far legs
  out.push(limb([18.6, 20.4, 19.4, 24.2, 18.8, 27.8], 1.3, 0.8, fur, { ink: -0.12 }));
  out.push(limb([9, 20, 10.6, 24, 9.6, 27.8], 1.3, 0.8, fur, { ink: -0.12 }));
  // body, hackles up
  out.push(P([6.6, 15.2, 7.4, 11.6, 9, 13.6, 10.6, 10.4, 12.2, 13, 13.8, 10, 15.2, 12.8, 16.8, 10.2, 18, 13, 19.8, 11.6, 20.2, 15], fur, { bv: 0.6 }));
  out.push(E(9.4, 17.4, 3.8, 4.2, fur), E(14.4, 17.6 + b * 0.2, 6.6, 3.8, fur), E(19.6, 17.6, 4, 4.6, fur));
  // near legs
  out.push(limb([11, 19.6, 12.6, 23.8, 11.2, 27.8], 1.5, 0.85, fur), E(11.8, 28, 1.6, 0.8, fur));
  out.push(limb([21, 20.6, 21.8, 24.4, 21.2, 27.8], 1.4, 0.85, fur), E(21.9, 28, 1.6, 0.8, fur));
  // head, carried low
  out.push(K(20.4, 15.6, 23.4, 17.4, 3, 2.4, fur));
  out.push(P([22.4, 15.6, 19.2, 13.4, 22, 14.6], fur), P([23.6, 15.2, 21.4, 12.6, 23.8, 14], fur));
  out.push(E(24, 17.6, 2.8, 2.4, fur));
  const jaw = [0, 0.25, 0.4, 0.25][f];
  out.push(E(26.6, 20.5 + jaw * 0.5, 2.1, 1, 'emFire'), E(26, 20.4 + jaw * 0.5, 0.9, 0.5, 'emFireCore'));
  out.push(K(25, 18.2, 28.8, 19.4, 1.6, 1.05, fur));
  out.push(K(24.4, 20.4 + jaw, 27.8, 22 + jaw, 1, 0.7, fur));
  out.push(X(26, 19.9, 0.5, 0.8, '#efe6d6'), X(27.4, 20.3, 0.5, 0.7, '#efe6d6'), X(26.6, 20.9 + jaw, 0.5, 0.6, '#d8cfc0'));
  out.push(K(23.4, 15.9, 26, 16.5, 0.55, 0.4, fur, { ink: -0.12 }));
  out.push(X(24.2, 16.7, 1.7, 1, 'emUnholy:4'), X(25, 16.9, 0.7, 0.6, 'emFireCore:4'));
  // spiked collar and the broken chain
  out.push(K(20.6, 13.8, 21.8, 20.4, 1.1, 1.1, 'iron'));
  out.push(spike(20.4, 13.6, 1, -0.6, -1.4, 'steel'), spike(20.8, 16.4, 1, -1.4, -0.4, 'steel'), spike(21.4, 19.2, 1, -1.2, 0.6, 'steel'));
  out.push(links([21.8, 20.6, 21.6, 23.8, 18.6, 27.4, 14.4, 28.4], 'iron', 0.9));
  out.push(Lt(26.6, 21, 4.5, '#ff8a2c', 0.6, 2), Lt(24.8, 16.8, 4, '#a868ff', 0.6));
  return out;
}

/** Náströnd Feaster: from the shore of corpses. Bloated past standing, its belly split into a second mouth that glows violet, a gnawed bone in hand. */
function feaster(f: number): PrimTree {
  const b = breath(f);
  const fl = 'mon2_feastFlesh';
  const out: Out = [Sh(15.6, 28.6, 11.4, 2.4)];
  // back arm, knuckles down
  out.push(limb([9.6, 14.6, 6.4, 19.6, 5.4, 25.6], 1.4, 1, fl, { ink: -0.1 }));
  out.push(claws(5.4, 25.8, 1.8, 2, 'boneOld'));
  // stumps
  out.push(K(10.6, 24, 9.8, 27.6, 2, 1.7, fl), K(20, 24.4, 20.8, 27.6, 2, 1.7, fl));
  out.push(E(9.4, 28, 2.2, 0.9, fl), E(21.4, 28, 2.2, 0.9, fl));
  // hump, belly
  out.push(E(12.4, 13.4, 5.4, 4.8, fl));
  out.push(E(15.4, 20.4, 8.6 + b * 0.3, 7 + b * 0.3, fl));
  out.push(K(9.4, 15.4, 11.6, 18.6, 0.3, 0.2, 'mon2_maw', { ink: -0.35 }), K(21, 15.4, 22.4, 18.4, 0.3, 0.2, 'mon2_maw', { ink: -0.35 }));
  // the belly-maw
  const op = [0, 0.3, 0.5, 0.3][f];
  out.push(P([9.4, 19.6, 13.6, 21.4 - op * 0.3, 18, 21.2 - op * 0.3, 22.4, 18.8, 21.6, 22.6 + op, 17.6, 25.2 + op, 13, 25 + op, 10, 22.6], 'mon2_maw', { ink: -0.08 }));
  const up = [[10.4, 20.2], [12.2, 21], [14.2, 21.3], [16.2, 21.3], [18.2, 21], [20.2, 20.2]];
  for (const [x, y] of up) out.push(spike(x, y - op * 0.3 - 0.1, 1.5, 0.2, 2, 'bone'));
  const lo = [[11.2, 23.2], [13.2, 24.6], [15.4, 25], [17.6, 24.8], [19.8, 23.6]];
  for (const [x, y] of lo) out.push(spike(x, y + op + 0.2, 1.4, -0.1, -1.8, 'bone'));
  // small head on the hump, jaw slack
  out.push(E(18.8, 8.8, 2.4, 2.3, fl));
  out.push(K(19.4, 10.4, 22, 11.4, 1.2, 0.8, fl));
  out.push(X(20, 10.6, 0.5, 0.6, '#e2d8c0'), X(21, 10.9, 0.5, 0.6, '#e2d8c0'));
  out.push(X(19.6, 8.1, 0.85, 0.7, 'emUnholy:4'), X(21, 8.2, 0.7, 0.7, 'emUnholy:4'));
  out.push(K(17.4, 7.2, 15.6, 9.8, 0.3, 0.15, 'hairGrey', { ol: false }), K(18.4, 6.8, 17.2, 9.4, 0.25, 0.12, 'hairGrey', { ol: false }));
  // front arm with a gnawed thigh-bone
  out.push(limb([18.4, 13.4, 22.8, 17, 24.6, 22.2], 1.4, 1, fl));
  out.push(K(23, 25.6, 28.2, 21, 0.65, 0.55, 'bone'), E(22.6, 26, 1, 0.85, 'bone'), E(28.6, 20.6, 1, 0.85, 'bone'));
  out.push(E(24.8, 23, 1.3, 1.2, fl), claws(24.8, 23.4, 1.2, 1.6, 'boneOld'));
  out.push(Lt(15.8, 22.6, 10, '#a868ff', 0.9));
  return out;
}

/** Fiends of the roots: violet hearts in three bodies. Kinds: `shadow` (a sprinting smoke), `garm` (a chained hound), `feaster` (a corpse-eater whose belly is a mouth). */
export function fiendModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'garm': return garmling(f);
    case 'feaster': return feaster(f);
    default: return shadowFiend(f);
  }
}
