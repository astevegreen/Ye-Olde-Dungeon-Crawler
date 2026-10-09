import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { DARK, fEye, type FamilyVariant } from './family';
import './materials';

/** The hag (mon_caster): bent double, a frost crystal hanging from her crook like a lamp. */
function hag(b: number, sw: number, f: number): PrimTree {
  // bent double: a humped back, the head thrust forward and low,
  // a shepherd's crook with a frost crystal hanging from it like a lamp
  const o: PrimTree[number][] = [Sh(15.8, 28.6, 7.8, 2)];
  const hx = 18.4;
  const hy = 14.4 + b * 0.3;
  const k = f % 2;
  const skin = 'mon1_hagSkin';
  const hair = 'mon1_hagHair';
  const shawl = 'mon1_hagShawl';
  // the crook, planted out in front
  o.push(K(25.2, 28.2, 24.6, 7.6, 0.55, 0.5, 'woodDark'));
  o.push(K(24.6, 7.6, 23.4, 4.8, 0.5, 0.42, 'woodDark'), K(23.4, 4.8, 21.6, 5.2, 0.42, 0.36, 'woodDark'), K(21.6, 5.2, 21.2, 6.2, 0.36, 0.3, 'woodDark'));
  o.push(E(24.9, 21, 0.75, 0.55, 'woodDark'), E(24.7, 12.6, 0.7, 0.5, 'woodDark'));
  o.push(K(24.8, 22.6, 25, 26.4, 0.75, 0.65, 'mon1_rime'));
  o.push(P([21.2, 6.2, 22.4, 7.4, 22, 10, 21.2, 10.8 + k * 0.2, 20.4, 9.8, 20.2, 7.4], 'emFrost', { bv: 0.4 }));
  o.push(X(20.9, 7.6, 0.5, 1.6, '#ffffff', { em: true }));
  o.push(Lt(21.2, 8.6, 8, '#9fe6ff', 0.85));
  // robe, hump and shawl
  o.push(P([11.6, 13.6, 18, 15, 21, 28.2, 19, 27.4, 17, 28.4, 14.8, 27.4, 12.6, 28.4, 9.8 + sw * 0.3, 27.8, 10.2, 20], 'mon1_hagRobe', { bv: 1.2 }));
  o.push(E(13.2, 14.4 + b * 0.15, 4.6, 4.1, shawl, { a: -0.5 }));
  o.push(P([10.4, 16, 16, 12.4, 19.2, 15.4, 18, 20, 16.4, 18.6, 14.8, 20.6, 13.2, 18.6, 11, 19.6], shawl, { bv: 0.8 }));
  o.push(K(16.2, 14.6, hx - 1.2, hy + 0.8, 1, 0.85, skin));
  // a curtain of frost-white hair falling from the back of the head over the shoulder
  o.push(P([hx - 2.8, hy - 1.8, hx - 0.4, hy - 2.8, hx - 0.2, hy + 1, hx - 0.8, hy + 6.6 + sw * 0.2, hx - 1.8, hy + 5.4, hx - 2.6, hy + 7.6 + sw * 0.2, hx - 3.6, hy + 5, hx - 3.8, hy + 1], hair, { bv: 0.7 }));
  // head: hooked nose, jutting chin
  o.push(E(hx, hy, 2.6, 2.7, skin, { fl: 0.2 }));
  o.push(K(hx + 1.8, hy - 0.4, hx + 4.4, hy + 1.2, 0.75, 0.4, skin), K(hx + 4.4, hy + 1.2, hx + 4.2, hy + 2.2, 0.4, 0.22, skin));
  o.push(K(hx + 0.6, hy + 2.2, hx + 2.6, hy + 2.8, 0.65, 0.35, skin));
  o.push(X(hx + 1, hy + 1.6, 1.4, 0.4, DARK));
  o.push(E(hx - 1, hy - 1.4, 2.8, 2.2, hair));
  o.push(X(hx + 0.4, hy - 1.3, 2.4, 0.4, skin + ':1'));
  o.push(fEye(hx + 0.8, hy - 0.7, 0.9, 0.8), fEye(hx + 2.3, hy - 0.6, 0.6, 0.7));
  // the near arm reaching out to the crook, long fingers
  o.push(K(17.6, 16.6, 21.4, 18.6, 0.95, 0.8, shawl), K(21.4, 18.6, 24, 17.8, 0.7, 0.55, skin));
  o.push(E(24.6, 17.6, 0.95, 1.1, skin), K(24.8, 16.8, 25.9, 17.2, 0.3, 0.2, skin), K(24.9, 18.2, 26, 18.6, 0.3, 0.2, skin));
  return o;
}

function sorcerer(b: number, sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 7, 2)];
  const hx = 17.2;
  const hy = 8.8 + b * 0.3;
  o.push(K(12.6, 13.6, 9.4, 16.4, 1.5, 1.2, 'mon1_sorcRobe', { ink: -0.08 }));
  o.push(E(8.8, 16.8, 0.9, 0.9, 'skinPale'));
  o.push(E(8.6, 15.8 - (f % 2) * 0.3, 1, 1.3, 'emFire'), P([8, 15.2, 8.6, 13 - (f % 2) * 0.4, 9.2, 15.2], 'emFire'));
  o.push(Lt(8.6, 15.6, 5, '#ff8a2c', 0.65));
  o.push(P([12.4, 12.4, 20, 12.4, 22.6, 28.2, 20, 27.4, 17.4, 28.4, 14.8, 27.4, 12.2, 28.4, 9.8 + sw * 0.3, 27.6], 'mon1_sorcRobe', { bv: 1.3 }));
  o.push(K(12.6, 19.2, 20.4, 20.2, 0.6, 0.6, 'mon1_trim'));
  o.push(K(17.6, 20.4, 17.2 + sw * 0.2, 24.6, 0.35, 0.25, 'mon1_trim'));
  o.push(P([hx - 3.6, hy - 1, hx - 2.4, hy - 4, hx - 6.4, hy - 1.4, hx - 4.4, hy + 3], 'mon1_sorcRobe'));
  o.push(E(hx, hy, 3.9, 4.2, 'mon1_sorcRobe'));
  o.push(E(hx + 1.6, hy + 0.8, 2.3, 2.8, 'mon1_void'));
  o.push(X(hx + 1.6, hy + 0.4, 0.8, 0.6, '#9cc6ff', { em: true }), X(hx + 3, hy + 0.5, 0.6, 0.6, '#9cc6ff', { em: true }));
  o.push(K(hx + 0.8, hy + 2.4, hx + 2.8, hy + 4.6, 0.5, 0.25, 'hairGrey'));
  o.push(K(19.8, 13.6, 23.4, 15.2, 1.6, 1.25, 'mon1_sorcRobe'), E(24.4, 15, 0.95, 0.95, 'skinPale'));
  const k = f % 4;
  const bolt = k % 2 ? [23.6, 13.6, 25, 11.4, 24.4, 12.8, 26.6, 10.4, 25.2, 12.6, 26.6, 12.4, 24.6, 14.4] : [23.8, 13.4, 24.4, 10.6, 25, 12.4, 26.8, 11.6, 25.4, 13.2, 27, 14.4, 24.8, 14.2];
  o.push(P(bolt, 'emBolt'));
  o.push(E(24.6, 14, 1, 1, 'emBolt', { ink: 0.2 }));
  o.push(Lt(25, 13, 8, '#fff27a', 0.9));
  return o;
}

function zealot(b: number, _sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 7, 2)];
  const hx = 17.8;
  const hy = 9.6 + b * 0.3;
  o.push(K(12.6, 13.4, 11.4, 19.6, 1.3, 1.1, 'mon1_zealRobe', { ink: -0.08 }), E(11.4, 20.2, 1.05, 1.05, 'skin'));
  o.push(P([12.2, 12.6, 20.2, 12.6, 22.2, 27.8, 19.8, 27, 17.4, 28.4, 15, 27.2, 12.6, 28.4, 10.2, 27.6], 'mon1_zealRobe', { bv: 1.2 }));
  o.push(P([10.4, 25, 21.8, 25, 22.2, 27.8, 20.6, 26.8, 19, 28.4, 17.4, 27, 15.6, 28.4, 13.6, 27, 12, 28.4, 10.2, 27.6], 'mon1_char', { bv: 0.5 }));
  o.push(X(12.6, 24.4, 0.6, 0.6, 'emFire:3', { em: true }), X(19.8, 24.2, 0.6, 0.6, 'emFire:3', { em: true }));
  o.push(P([14, 12.6, 19, 12.6, 16.6, 19], 'skin'));
  o.push(E(16.6, 15.4, 1.6, 1.6, 'mon1_scar'));
  o.push(E(16.6, 15.4, 0.8, 0.8, 'emFire', { ink: -0.25 }));
  o.push(K(12.6, 19.8, 20.4, 19.8, 0.6, 0.6, 'leatherDark'));
  // thrown-back cowl framing a small shaved head, mouth open mid-sermon
  o.push(E(hx - 2.4, hy + 3, 2.8, 1.8, 'mon1_zealRobe', { ink: -0.1 }));
  o.push(K(hx - 0.6, 13, hx - 0.2, hy + 2, 1, 0.9, 'skin'));
  o.push(E(hx, hy, 2.7, 3, 'skin', { fl: 0.15 }));
  o.push(K(hx + 0.2, hy + 1.8, hx + 2.2, hy + 2.4, 1, 0.7, 'skin'));
  o.push(K(hx + 2.2, hy - 0.6, hx + 3.3, hy + 0.8, 0.55, 0.35, 'skin'));
  o.push(X(hx + 0.2, hy - 1.2, 2.6, 0.45, 'skin:1'));
  o.push(X(hx + 0.6, hy - 0.7, 0.8, 0.7, DARK), X(hx + 2.2, hy - 0.6, 0.6, 0.6, DARK));
  o.push(X(hx + 0.8, hy - 0.6, 0.35, 0.35, '#fff1c2'), X(hx + 2.3, hy - 0.5, 0.3, 0.3, '#fff1c2'));
  o.push(E(hx + 1.7, hy + 1.8, 0.65, 0.75, 'mon1_void'));
  o.push(K(hx - 1.6, hy - 2, hx + 0.2, hy - 2.6, 0.4, 0.35, 'mon1_scar'));
  o.push(K(20, 13.4, 22.4, 10.6, 1.3, 1.1, 'mon1_zealRobe'), E(22.8, 10, 1.1, 1.1, 'skin'));
  const k = f % 2;
  o.push(K(22.6, 11.4, 24.8, 5.2, 0.45, 0.4, 'iron'));
  o.push(E(25.2, 4.2, 2.1, 2.1, 'emFire'), E(25.2, 4.2, 1.1, 1.1, 'emFireCore'));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 0.2;
    o.push(X(25.2 + Math.cos(a) * 2.8 - 0.3, 4.2 + Math.sin(a) * 2.8 - 0.3, 0.6, 0.6, 'emFire:4', { em: true }));
  }
  o.push(Lt(25.2, 4.4, 9, '#ff8a2c', 0.9));
  return o;
}

/** mon_caster: human casters, robed to the floor, a light in the hand. */
export function casterModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  switch (v.kind) {
    case 'sorcerer': return sorcerer(b, sw, f);
    case 'zealot': return zealot(b, sw, f);
  }
  return hag(b, sw, f);
}
