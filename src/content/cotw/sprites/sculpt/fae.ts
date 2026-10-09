import { E, K, P, X, Lt, Sh, arc, breath, sway, type PrimTree } from './kit';
import { claws, limb, spike, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** The farm's hearth-spirit, wronged once too often: small, hunched, holding his ember lantern out like a threat. */
function nisse(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const w = 'mon2_nWool';
  const out: Out = [Sh(16, 28.6, 5.8, 1.9)];
  out.push(K(14.6, 24, 14.2, 27, 1.1, 0.95, 'woolBrown'), K(17.4, 24, 17.8, 27, 1.1, 0.95, 'woolBrown'));
  out.push(E(13.8, 27.7, 1.7, 1, 'leatherDark'), E(18.4, 27.7, 1.7, 1, 'leatherDark'));
  // back arm: a clenched fist
  out.push(K(14, 19.8, 12.6, 22.8, 1, 0.85, w, { ink: -0.06 }), E(12.4, 23.3, 1.05, 1, 'skin'));
  // body
  out.push(E(15.8, 21.8 + b * 0.2, 3.8, 3.6, w));
  out.push(arc(15.8, 22.6, 3.8, 1.2, 0.15, Math.PI - 0.15, 5, 0.5, 0.5, 'leatherDark'));
  // beard
  out.push(P([15.6, 17.6, 20.6, 17.8, 20.4, 21, 18.8, 24.4, 16.8, 22.6, 15.2, 20.2], 'hairGrey', { bv: 1 }));
  // face, nose, scowl
  const hy = 17 + b * 0.15;
  out.push(E(17.6, hy, 2.4, 2.2, 'skin'));
  out.push(E(19.8, hy + 0.7, 0.95, 0.85, 'mon2_nose'));
  out.push(X(18.4, hy - 0.4, 0.75, 0.65, 'emFire:4'));
  out.push(K(17.2, hy - 1.4, 19.6, hy - 0.5, 0.5, 0.42, 'hairGrey'));
  // the red cap, its tip flopped back
  out.push(P([14.4, hy, 20.2, hy - 0.8, 19.6, hy - 2.2, 17.4, hy - 4.6, 15, hy - 3.2], 'woolRed', { bv: 1 }));
  out.push(limb([16.8, hy - 3.6, 14.6, hy - 4.8, 12.4, hy - 3.6 + sw * 0.2], 1.4, 0.5, 'woolRed'));
  // lantern arm
  out.push(K(17.8, 19.8, 20.8, 21.2, 1, 0.85, w), E(21.1, 21.1, 0.95, 0.95, 'skin'));
  const fl = [0, 0.08, -0.04, 0.06][f];
  out.push(K(21.2, 21.6, 21.3, 22.6, 0.2, 0.2, 'iron', { ol: false }));
  out.push(E(21.4, 24.4, 1.4, 1.8, 'emFire', { ink: fl }), E(21.4, 24.7, 0.6, 0.85, 'emFireCore', { ink: fl }));
  out.push(P([20, 22.9, 22.8, 22.9, 22.2, 22.1, 20.6, 22.1], 'blackIron'), P([20, 26.1, 22.8, 26.1, 22.4, 26.8, 20.4, 26.8], 'blackIron'));
  out.push(K(20.2, 23, 20.2, 26, 0.22, 0.22, 'blackIron'), K(22.6, 23, 22.6, 26, 0.22, 0.22, 'blackIron'));
  out.push(Lt(21.4, 24.4, 9, '#ff9a3c', 1));
  return out;
}

/** A scrawny frost imp, all ears and grin, crouched to spring. */
function skratti(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const sk = 'mon2_iceSkin';
  const out: Out = [Sh(15.4, 28.6, 6, 1.9)];
  // whip tail with a frost shard
  const tt = sw * 0.3;
  out.push(limb([12, 21.6, 8.4, 24.4, 5.6, 23.2, 4.8, 20.6 + tt], 0.6, 0.25, sk));
  out.push(P([4.2, 20.8 + tt, 5.6, 20.6 + tt, 4.6, 18 + tt], 'ice'));
  // far limbs
  out.push(limb([12.8, 21.4, 11, 24.2, 12, 27.8], 1, 0.6, sk, { ink: -0.1 }));
  out.push(limb([13.6, 16.8, 12.4, 20.4, 13.8, 23], 0.8, 0.5, sk, { ink: -0.1 }));
  out.push(claws(13.8, 23, 1.2, 1.4, 'ice'));
  // frost spines down the back
  out.push(spike(12.8, 15.4, 1.4, -2, -1.4, 'ice'), spike(12, 17.4, 1.3, -1.9, -0.8, 'ice'), spike(11.8, 19.6, 1.1, -1.6, -0.2, 'ice'));
  // body: scrawny, hunched, ribs
  out.push(E(14.6, 18.8 + b * 0.2, 2.8, 3.6, sk, { a: 0.45 }));
  out.push(X(15.6, 18.2, 1.6, 0.35, `${sk}:2`), X(15.4, 19.4, 1.6, 0.35, `${sk}:2`));
  // near leg
  out.push(limb([14.6, 21.6, 17.2, 24.2, 16, 27.6], 1.15, 0.6, sk));
  out.push(K(15.6, 27.9, 18.2, 28.2, 0.6, 0.35, sk));
  // head with the bat ears
  const hx = 18.6;
  const hy = 13 + b * 0.2;
  out.push(P([hx - 2.4, hy - 0.6, hx - 6.6, hy - 7.6, hx - 3.4, hy - 6.2, hx - 0.8, hy - 2.4], sk, { bv: 0.8 }));
  out.push(P([hx - 2.4, hy - 1.4, hx - 5.6, hy - 6.6, hx - 2.4, hy - 3.2], 'mon2_earIn'));
  out.push(E(hx, hy, 3.1, 2.7, sk));
  out.push(E(hx + 1.6, hy + 1.6, 2, 1.3, sk));
  out.push(P([hx + 0.6, hy - 2, hx + 3.4, hy - 8.6, hx + 3.8, hy - 4.6, hx + 3, hy - 1.4], sk, { bv: 0.8 }));
  out.push(P([hx + 1.4, hy - 2.4, hx + 3.2, hy - 7.2, hx + 3.2, hy - 3], 'mon2_earIn'));
  // the grin: a dark slash full of teeth
  out.push(P([hx + 0.2, hy + 0.9, hx + 3.6, hy + 0.3, hx + 3.2, hy + 1.6, hx + 1, hy + 2.2], 'mon2_earIn', { ink: -0.4 }));
  out.push(X(hx + 0.8, hy + 1, 0.5, 0.6, '#eef6ff'), X(hx + 1.7, hy + 0.9, 0.5, 0.6, '#eef6ff'), X(hx + 2.6, hy + 0.7, 0.5, 0.6, '#eef6ff'));
  out.push(X(hx + 1.2, hy + 1.6, 0.5, 0.5, '#d4e4f2'), X(hx + 2.2, hy + 1.4, 0.5, 0.5, '#d4e4f2'));
  out.push(X(hx + 0.5, hy - 1, 0.95, 0.8, 'emFrost:4'), X(hx + 2.3, hy - 1.1, 0.8, 0.8, 'emFrost:4'));
  out.push(K(hx + 2.6, hy - 0.2, hx + 4.2, hy + 0.2, 0.5, 0.2, sk));
  // near arm, claws out
  out.push(limb([16.6, 16.4, 19.6, 19.6, 22.4, 18.4 - b * 0.3], 0.85, 0.55, sk));
  out.push(claws(22.4, 18.4 - b * 0.3, -0.25, 2, 'ice'));
  out.push(Lt(hx + 1.4, hy - 1, 5, '#9fe6ff', 0.45));
  return out;
}

/** Hearth- and frost-imps: small spirits, big heads. Kinds: `nisse` (cap, beard, lantern) and `skratti` (ears and grin). */
export function faeModel(f: number, v: FamilyVariant): PrimTree {
  return v.kind === 'skratti' ? skratti(f) : nisse(f);
}
