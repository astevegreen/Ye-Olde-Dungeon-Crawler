import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { aEye, eEye, fEye, rime, type FamilyVariant } from './family';
import './materials';

function caveTroll(b: number): PrimTree {
  // a mossy mound of a back, the head slung low in front of it,
  // a great drooping nose, and arms long enough to walk on its knuckles
  const hide = 'mon1_trollHide';
  const lim = 'mon1_trollLimb';
  const hed = 'mon1_trollHead';
  const far = { ink: -0.1 };
  const o: PrimTree[number][] = [Sh(15.6, 28.6, 11.4, 2.6)];
  o.push(K(10.6, 14.6, 8, 21, 2.2, 1.9, hide, far), K(8, 21, 7.4, 26.4, 1.9, 1.6, hide, far), E(7.6, 27.2, 2.2, 1.4, hide, far));
  o.push(K(12.6, 21.6, 11.4, 26.8, 2.6, 2.2, hide, { ink: -0.05 }), K(18.4, 21.6, 19, 26.8, 2.6, 2.2, hide));
  o.push(E(11.2, 27.8, 2.8, 1.3, hide, { ink: -0.05 }), E(19.8, 27.8, 2.8, 1.3, hide));
  o.push(E(13, 16.6 + b * 0.25, 7.8, 7.4, hide, { a: -0.25 }));
  o.push(E(16.8, 21.2, 4.4, 3.8, hide, { ink: 0.06 }));
  o.push(K(10.8, 24.4, 21.4, 24.6, 0.9, 0.9, 'leatherDark'), P([12.4, 24.4, 20.4, 24.4, 19.6, 27, 16.6, 25.8, 13.4, 27], 'hide', { bv: 0.5 }));
  o.push(E(10.6, 10.8 + b * 0.25, 5.6, 2.8, 'mon1_moss', { fl: 0.25, a: -0.3 }));
  o.push(P([6.8, 11.4, 7.6, 15.6, 8.8, 12.8, 10, 14.8, 11, 12.2, 13.4, 13.4, 15.8, 10.4, 15, 8.2], 'mon1_moss', { bv: 0.6 }));
  // near arm, behind the head: shoulder to knuckles on the floor
  o.push(K(20, 14.6, 24.4, 20.4, 2.4, 2, lim), K(24.4, 20.4, 25.6, 25.8, 2, 1.8, lim));
  o.push(E(26, 26.8, 2.4, 1.7, lim, { ink: 0.04 }));
  o.push(X(24.6, 27.8, 0.6, 0.6, 'bone:4'), X(26, 28, 0.6, 0.6, 'bone:4'), X(27.4, 27.8, 0.6, 0.6, 'bone:4'));
  // head, thrust forward and low
  const hx = 23;
  const hy = 14.2 + b * 0.35;
  o.push(P([hx - 2.4, hy - 1.2, hx - 5.4, hy - 3.2, hx - 2.4, hy + 0.8], hed));
  o.push(E(hx, hy, 3.4, 3, hed));
  o.push(K(hx - 1.2, hy + 2.2, hx + 2.6, hy + 2.6, 1.8, 1.4, hed, { ink: 0.04 }));
  o.push(K(hx - 1.8, hy - 1.6, hx + 2.6, hy - 1.4, 1.1, 0.9, hed, { ink: -0.08 }));
  o.push(K(hx + 2, hy - 0.6, hx + 5.2, hy + 2.2, 1.3, 1, hed, { ink: 0.08 }), E(hx + 5.3, hy + 2.5, 1.25, 1.15, hed, { ink: 0.1 }));
  o.push(aEye(hx + 0.6, hy - 0.6, 0.9, 0.8), aEye(hx + 2.2, hy - 0.5, 0.6, 0.7));
  o.push(K(hx + 0.2, hy + 3.4, hx + 0.6, hy + 1.4, 0.55, 0.25, 'bone'), K(hx + 2.2, hy + 3.6, hx + 2.6, hy + 1.8, 0.5, 0.22, 'bone'));
  return T(o, { s: 1.06 });
}

function ogre(b: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 10, 2.5)];
  o.push(K(10.6, 13.8, 8.6, 20.6, 2.2, 1.9, 'mon1_ogre', { ink: -0.1 }), E(8.4, 21.4, 1.8, 1.8, 'mon1_ogre', { ink: -0.1 }));
  o.push(K(13.4, 22, 12.8, 27, 2.5, 2.1, 'leatherDark'), K(19, 22, 19.8, 27, 2.5, 2.1, 'leatherDark'));
  o.push(E(12.6, 27.8, 2.6, 1.2, 'leather'), E(20.2, 27.8, 2.6, 1.2, 'leather'));
  o.push(E(15.8, 14.6, 6.4, 5.2, 'mon1_ogre'));
  o.push(E(16.8, 19.6 + b * 0.3, 7, 5.8, 'mon1_ogre', { ink: 0.04 }));
  o.push(X(19.4, 19.4, 0.8, 0.8, 'mon1_ogre:1'));
  o.push(K(11, 11.6, 21.6, 22.4, 0.8, 0.8, 'leatherDark'));
  o.push(K(10, 23.4, 23.4, 23.4, 1.1, 1.1, 'leather'), X(15.6, 22.6, 2, 1.6, 'iron:4'));
  o.push(P([11.4, 23.6, 22.2, 23.6, 21.4, 26.4, 19, 25.4, 16.8, 26.8, 14.4, 25.4, 12, 26.4], 'leather', { bv: 0.6 }));
  o.push(E(11.6, 11.4, 2.8, 2.2, 'leatherDark'));
  const hx = 18.4;
  const hy = 8.2 + b * 0.35;
  o.push(E(hx, hy, 3.3, 3.2, 'mon1_ogre'));
  o.push(K(hx - 0.4, hy + 2.4, hx + 3, hy + 2.6, 1.6, 1.4, 'mon1_ogre', { ink: 0.05 }));
  o.push(E(hx + 2.6, hy + 0.4, 1.2, 1, 'mon1_ogre', { ink: 0.08 }));
  o.push(P([hx - 2.8, hy - 0.4, hx - 4.6, hy - 1.6, hx - 2.8, hy + 1.2], 'mon1_ogre'));
  o.push(aEye(hx + 0.2, hy - 0.8, 0.9, 0.7), aEye(hx + 1.9, hy - 0.7, 0.6, 0.6));
  o.push(K(hx - 0.6, hy - 1.8, hx + 2.6, hy - 1.6, 0.6, 0.5, 'mon1_ogre', { ink: -0.08 }));
  o.push(X(hx + 0.6, hy + 2.6, 0.6, 1, 'bone:5'), X(hx + 2.4, hy + 2.6, 0.6, 0.9, 'bone:5'));
  o.push(K(21.4, 12.6, 24.6, 17.4, 2.2, 1.9, 'mon1_ogre'));
  o.push(K(25.6, 19.6, 26, 12.4, 0.75, 0.7, 'wood'));
  o.push(P([24.2, 12.8, 30.4, 10.6, 30.6, 4.4, 24.6, 6.8], 'mon1_cleaver', { bv: 0.8, n: [0.2, -0.1, 1] }));
  o.push(E(25.8, 8.6, 0.7, 0.7, 'mon1_void'), X(29.6, 5.2, 0.6, 5, 'mon1_cleaver:5'));
  o.push(E(25.6, 17.8, 1.8, 1.8, 'mon1_ogre'));
  return o;
}

function jotun(b: number, sw: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 9.6, 2.4)];
  o.push(P([10, 8.6, 21.8, 8.6, 22.6 + sw * 0.3, 23, 18.6, 22, 15.6, 23.6, 12.4, 22, 9 + sw * 0.4, 23.4], 'furWhite', { bv: 1.2, ink: -0.06 }));
  o.push(K(10.8, 10.4, 9.4, 16.4, 2, 1.7, 'mon1_jotun', { ink: -0.08 }), K(9.4, 16.4, 9, 20.4, 1.7, 1.5, 'mon1_jotun', { ink: -0.08 }), E(9, 21.2, 1.6, 1.5, 'mon1_jotun', { ink: -0.08 }));
  o.push(K(13.6, 20.6, 12.8, 26.6, 2.2, 1.8, 'leatherDark'), K(18.4, 20.6, 19.4, 26.6, 2.2, 1.8, 'leatherDark'));
  o.push(E(12.6, 27.4, 2.6, 1.6, 'furWhite'), E(19.8, 27.4, 2.6, 1.6, 'furWhite'));
  o.push(E(16, 13.6 + b * 0.25, 6.2, 6.2, 'mon1_jotun'));
  o.push(X(14, 12.4, 1.6, 0.5, 'mon1_jotun:2'), X(17.6, 12.4, 1.6, 0.5, 'mon1_jotun:2'));
  o.push(P([10.6, 17.4, 21.4, 17.4, 22.4, 23.4, 19.6, 22.4, 16.2, 24, 12.8, 22.4, 9.8, 23.2], 'mail', { bv: 0.6 }));
  o.push(K(10.4, 17.6, 21.6, 17.6, 1, 1, 'leatherDark'), E(16, 17.6, 1.4, 1.2, 'iron'));
  o.push(rime(11.2, 9.4, 2.6), E(21, 9.4, 3.4, 2.4, 'iron'), rime(21.2, 8.2, 2.2));
  const hx = 16.8;
  const hy = 5.4 + b * 0.35;
  o.push(E(hx, hy, 3.3, 3.5, 'mon1_jotun'));
  o.push(P([hx - 0.8, hy + 1.6, hx + 3.4, hy + 1.4, hx + 3, hy + 6, hx + 1.8 + sw * 0.2, hy + 8.4, hx + 0.6, hy + 6.4, hx - 0.8, hy + 4], 'mon1_furRime', { bv: 0.7 }));
  o.push(K(hx + 1.2, hy + 5, hx + 1.8 + sw * 0.2, hy + 8.4, 0.5, 0.3, 'iron'));
  o.push(P([hx - 3.6, hy - 0.4, hx - 2.8, hy - 3.4, hx + 0.2, hy - 4.2, hx + 3, hy - 3.4, hx + 3.7, hy - 0.4], 'iron', { bv: 1.2 }));
  o.push(K(hx - 3.6, hy - 0.4, hx + 3.7, hy - 0.4, 0.6, 0.6, 'iron', { ink: 0.08 }), K(hx + 1.2, hy - 0.6, hx + 1.2, hy + 1.6, 0.45, 0.4, 'iron'));
  o.push(P([hx - 3.4, hy - 0.4, hx - 1.6, hy - 0.4, hx - 1.8, hy + 3, hx - 3.2, hy + 2.6], 'iron', { bv: 0.5 }));
  o.push(fEye(hx + 0.1, hy + 0.2, 0.9, 0.8), fEye(hx + 2.2, hy + 0.3, 0.8, 0.8));
  o.push(Lt(hx + 1.2, hy + 0.4, 4, '#9fe6ff', 0.6));
  o.push(K(22.4, 27.8, 25.6, 2.6, 0.75, 0.7, 'woodDark'));
  // the axe's flat back kept off the cell's right edge, where it would read as cut
  o.push(P([23, 7.2, 24.4, 3.6, 27.6, 2.6, 29.8, 4.4, 30.2, 9.8, 28.4, 8.4, 26.4, 9.6], 'steel', { bv: 1, n: [0.25, -0.15, 1] }));
  o.push(K(29.6, 4.8, 30, 9.4, 0.45, 0.45, 'mon1_rime'));
  o.push(K(21.4, 10.4, 23.2, 14.2, 2.1, 1.8, 'mon1_jotun'), E(23.8, 14.4, 1.7, 1.6, 'mon1_jotun'));
  return o;
}

function fireGiant(b: number, f: number): PrimTree {
  // Surtr's kin: basalt split by ember seams, a mane of flame streaming back,
  // and a black sword whose edge burns. Taller than the trolls: he stands straight.
  const k = f % 4;
  const fl = [0, 0.6, 0.2, -0.4][k];
  const rock = 'mon1_basalt';
  const far = { ink: -0.1 };
  const o: PrimTree[number][] = [Sh(16, 28.6, 10, 2.5)];
  const hx = 16.6;
  const hy = 4.8 + b * 0.35;
  // flame mane, streaming back behind everything; it sweeps back rather than up, as the head
  // sits close under the top of the cell
  o.push(P([hx - 0.6, hy - 3.1, hx - 3, hy - 3.6 - fl * 0.4, hx - 3.6, hy - 2.6, hx - 6.2 + fl * 0.3, hy - 3.4, hx - 5.2, hy - 1.2, hx - 7.8, hy + 0.2 - fl * 0.3, hx - 4.4, hy + 0.8, hx - 1.6, hy + 0.6], 'emFire'));
  o.push(P([hx - 1.4, hy - 2.4, hx - 3.4, hy - 1.6, hx - 4.2, hy + 0.2, hx - 1.8, hy + 0.2], 'emFireCore'));
  // far arm, fist at the side
  o.push(K(10.4, 10.6, 8.8, 17.6, 2.2, 1.9, rock, far), E(8.6, 18.8, 1.9, 1.9, rock, far));
  // legs, iron-shod
  o.push(K(13.4, 20.4, 12.6, 26.8, 2.4, 2, rock, { ink: -0.04 }), K(18.6, 20.4, 19.6, 26.8, 2.4, 2, rock));
  o.push(E(12.4, 27.6, 2.6, 1.4, 'blackIron'), E(20, 27.6, 2.6, 1.4, 'blackIron'));
  // torso with ember seams
  o.push(E(16, 14.2 + b * 0.25, 6.6, 6.8, rock));
  o.push(K(13, 10.8, 14.6, 14.6, 0.3, 0.25, 'emFire'), K(14.6, 14.6, 13.4, 17.6, 0.25, 0.2, 'emFire'), K(18.4, 13.8, 19.8, 17.4, 0.3, 0.2, 'emFire'), K(10.2, 11.8, 9.4, 14.8, 0.25, 0.2, 'emFire'));
  // a short leather kilt under an iron belt with an ember buckle
  o.push(P([10.6, 19.4, 21.4, 19.4, 22.2, 23.8, 19.4, 23, 16, 24.2, 12.6, 23, 9.8, 23.8], 'leatherDark', { bv: 0.6 }));
  o.push(K(10.2, 19.4, 21.8, 19.4, 0.9, 0.9, 'blackIron', { ink: 0.1 }), E(16, 19.4, 1.1, 1, 'emFire'));
  o.push(E(11, 9.8, 3, 2.2, 'blackIron'), E(21.2, 9.8, 3, 2.2, 'blackIron'));
  // head: heavy brow, ember eyes, a charred beard with live coals in it
  o.push(K(hx - 0.4, 8.6, hx, hy + 2, 1.4, 1.3, rock));
  o.push(E(hx, hy, 3.1, 3.3, rock, { ink: 0.1 }));
  o.push(K(hx - 1.6, hy - 1.6, hx + 2.8, hy - 1.4, 1, 0.9, rock, { ink: -0.08 }));
  o.push(K(hx + 2.2, hy - 0.6, hx + 3.6, hy + 0.8, 0.6, 0.4, rock, { ink: 0.06 }));
  o.push(eEye(hx + 0.2, hy - 0.6, 1.1, 0.8), eEye(hx + 2.2, hy - 0.5, 0.8, 0.8));
  o.push(P([hx - 1.2, hy + 1.2, hx + 3.4, hy + 1.2, hx + 2.8, hy + 4.2, hx + 1.6, hy + 6.2, hx + 0.4, hy + 4.6, hx - 1.2, hy + 3.4], 'mon1_char', { bv: 0.5 }));
  o.push(X(hx + 0.4, hy + 3, 0.5, 0.5, 'emFire:4', { em: true }), X(hx + 1.8, hy + 4.4, 0.5, 0.5, 'emFire:3', { em: true }));
  // the burning sword, raised
  o.push(P([23.7, 12.9, 29.2, 2.2, 30.5, 1.2, 30.2, 2.9, 25.3, 13.7], 'blackIron', { bv: 0.5 }));
  o.push(K(25.3, 13.5, 30.1, 3, 0.4, 0.3, 'emFire'), K(26.6, 10.4, 29.2, 5.4, 0.25, 0.2, 'emFireCore'));
  o.push(P([27.6, 8.2 - fl * 0.3, 29.4 + fl * 0.4, 5.6, 28.6, 8.8], 'emFire'), P([25.8, 11.8, 27.4 - fl * 0.3, 9.4, 26.8, 12.4], 'emFire'));
  o.push(K(22.6, 12.4, 26.4, 14.4, 0.55, 0.55, 'blackIron'));
  o.push(Lt(27.2, 7.6, 10, '#ff8a2c', 0.95), Lt(hx - 4, hy + 1, 6, '#ff8a2c', 0.5));
  // near arm and fist round the grip
  o.push(K(21.4, 10.4, 23.4, 14, 2.2, 1.9, rock), E(23.8, 14.8, 1.8, 1.8, rock));
  o.push(K(22, 11.8, 22.8, 12.8, 0.25, 0.2, 'emFire'));
  return o;
}

function orc(b: number, sw: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 9.4, 2.6)];
  o.push(K(11, 11.4, 9.4, 18.8, 2.1, 1.8, 'mon1_orc', { ink: -0.1 }), E(9.2, 19.6, 1.7, 1.7, 'mon1_orc', { ink: -0.1 }));
  o.push(K(13.2, 20.6, 12.4, 26.8, 2.1, 1.7, 'leatherDark'), K(18.6, 20.6, 19.6, 26.8, 2.1, 1.7, 'leatherDark'));
  o.push(E(12.2, 27.6, 2.5, 1.4, 'iron'), E(20, 27.6, 2.5, 1.4, 'iron'));
  o.push(E(16, 15 + b * 0.25, 6, 6.4, 'mail', { fl: 0.1 }));
  o.push(P([10.6, 17.6, 21.4, 17.6, 22.2, 23.2, 19, 22.2, 16, 23.6, 13, 22.2, 9.8, 23.2], 'leather', { bv: 0.6 }));
  o.push(K(10.4, 18, 21.6, 18, 1, 1, 'leatherDark'), X(15.4, 17, 2, 2, 'iron:4'));
  o.push(P([11.6, 10.8, 20.4, 10.8, 19.8, 16.6, 16, 17.6, 12.2, 16.6], 'iron', { bv: 1.2 }));
  o.push(E(11, 10.4, 3.4, 2.6, 'iron'), P([9, 10, 9.6, 6.6, 11.6, 8.6], 'iron', { bv: 0.4 }));
  const hx = 17.4;
  const hy = 7.2 + b * 0.35;
  o.push(E(hx, hy, 3.4, 3.4, 'mon1_orc'));
  o.push(K(hx - 0.6, hy + 2.2, hx + 3, hy + 2.6, 1.6, 1.3, 'mon1_orc', { ink: 0.05 }));
  o.push(P([hx - 3.6, hy - 0.2, hx - 2.8, hy - 3.2, hx, hy - 4.2, hx + 2.8, hy - 3.2, hx + 3.6, hy - 0.8, hx + 0.4, hy - 1.6], 'iron', { bv: 1 }));
  o.push(P([hx - 2.8, hy - 0.4, hx - 5.4, hy - 2, hx - 3, hy + 1.4], 'mon1_orc'));
  o.push(aEye(hx + 0.4, hy - 0.4, 1, 0.8), aEye(hx + 2.3, hy - 0.3, 0.7, 0.7));
  o.push(K(hx + 0.6, hy + 3.4, hx + 0.8, hy + 1.6, 0.55, 0.25, 'bone'), K(hx + 2.8, hy + 3.4, hx + 3.2, hy + 1.8, 0.5, 0.22, 'bone'));
  o.push(K(hx - 3.4, hy - 1.2, hx - 5 + sw * 0.2, hy + 4, 0.7, 0.4, 'hairDark'));
  o.push(E(21.2, 10.4, 3.4, 2.6, 'iron'));
  o.push(K(21.4, 12, 23.6, 16.8, 2, 1.7, 'mon1_orc'));
  o.push(K(24.2, 20.4, 25.6, 4.6, 0.75, 0.7, 'woodDark'));
  o.push(P([25.2, 5.6, 30.6, 3.4, 31.2, 10.6, 28, 9, 25.4, 10.2], 'steel', { bv: 1, n: [0.25, -0.15, 1] }));
  o.push(K(30.4, 3.8, 31, 10, 0.45, 0.45, 'silver'));
  o.push(E(24.4, 17.4, 1.7, 1.7, 'mon1_orc'));
  return T(o, { s: 0.8 });
}

/**
 * mon_troll, Jötnar & Trolls: `kind` picks the cave troll (default), ogre, frost jötun, fire giant
 * or orc. Idle: the chest breathes, the beard stirs, the fire giant's mane and blade flicker.
 */
export function trollModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  switch (v.kind) {
    case 'ogre': return ogre(b);
    case 'jotun': return jotun(b, sw);
    case 'fire': return fireGiant(b, f);
    case 'orc': return orc(b, sw);
  }
  return caveTroll(b);
}
