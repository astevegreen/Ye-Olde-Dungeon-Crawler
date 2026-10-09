import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { DARK, VIOL, vEye, type FamilyVariant } from './family';
import './materials';

/** A drowned or exposed child in its grave-shroud: head bowed, hands clasped, the hem trailing into nothing. */
function myling(b: number, sw: number): PrimTree {
  const y = -1.6 - b * 0.5;
  return [
    Sh(16, 28.6, 3.6, 1.1, 0.24),
    P([12.8, 18.4 + y, 19.4, 18.4 + y, 20, 22.4 + y, 18.4, 24.6 + y, 15.8 + sw * 0.4, 26.4 + y, 12.6 + sw * 0.8, 28.6 + y, 13.6 + sw * 0.5, 26 + y, 12.4, 23 + y], 'mon1_myling', { bv: 1.4 }),
    E(16.1, 19.8 + y, 3.8, 4, 'mon1_myling'),
    P([13, 15.8 + y, 12.4, 12.6 + y, 14.4, 11.4 + y, 16, 12.6 + y], 'mon1_myling', { bv: 0.6 }),
    E(16.4, 15.2 + y, 3.6, 3.6, 'mon1_myling', { fl: 0.1 }),
    E(17.5, 16.1 + y, 2.4, 2.4, 'mon1_mylingFace', { fl: 0.2 }),
    vEye(16.4, 15.9 + y, 0.8, 1.1), vEye(18.5, 15.9 + y, 0.7, 1.1),
    X(16.9, 15.5 + y, 0.8, 0.4, 'mon1_myling:1'), X(18.1, 15.5 + y, 0.6, 0.4, 'mon1_myling:1'),
    X(16.5, 17.1 + y, 0.4, 0.9, 'mon1_mylingFace:5'),
    X(17.4, 17.9 + y, 1.2, 0.4, '#3a3150'), X(17.2, 18.2 + y, 0.4, 0.3, '#3a3150'), X(18.4, 18.2 + y, 0.4, 0.3, '#3a3150'),
    E(18.6, 20 + y, 1.1, 1.1, 'mon1_mylingFace'), E(17.4, 20.4 + y, 1, 1, 'mon1_mylingFace'),
    Lt(17.4, 16.2 + y, 5, VIOL, 0.35),
  ];
}

/** The church-grim: a black dog buried under the threshold, sitting its watch; its haunch is already mist. */
function kirkegrim(b: number, sw: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16.4, 28.6, 6.4, 1.9, 0.35)];
  o.push(P([11.6, 17.6, 8.4 + sw * 0.4, 18.4, 5.2 + sw * 0.7, 16.8, 6.4 + sw * 0.5, 20.4, 3 + sw * 0.8, 22.6, 6.4, 23.4, 3.6 + sw * 0.6, 26.4, 8.6, 25.8, 10.6, 27.6], 'mon1_grimMist', { bv: 1.4 }));
  o.push(E(12, 23.2, 4.4, 4.6, 'mon1_grimMist'));
  o.push(E(12.4, 22.8, 3.4, 3.8, 'mon1_grim', { ink: -0.04 }));
  o.push(E(13.6, 27.1, 3.4, 1.4, 'mon1_grimMist', { ink: 0.04 }));
  o.push(K(19.6, 20.4, 20.8, 27.6, 1.3, 0.95, 'mon1_grim', { ink: -0.12 }));
  o.push(E(16.8, 18.8, 4.6, 6.4, 'mon1_grim', { a: -0.3 }));
  o.push(K(18.4, 21, 18.6, 27.6, 1.55, 1.1, 'mon1_grim'));
  o.push(E(19.4, 27.9, 1.8, 0.9, 'mon1_grim'), E(21.8, 27.9, 1.6, 0.8, 'mon1_grim', { ink: -0.1 }));
  o.push(K(17.8, 16, 20, 11.6, 3.2, 2.7, 'mon1_grim'));
  o.push(P([14.4, 15.6, 14.8, 12.4, 16, 13.4, 16.4, 10, 17.6, 11.6, 18.4, 8.4, 19.6, 10.4, 19.2, 14, 16.6, 17.4], 'mon1_grimMist', { bv: 0.8 }));
  const hy = 9.6 + b * 0.25;
  o.push(E(21.2, hy, 3.4, 3, 'mon1_grim'));
  o.push(K(22.8, hy + 1, 27.2, hy + 1.8, 1.9, 1.3, 'mon1_grim', { ink: 0.05 }));
  o.push(K(23, hy + 2.6, 26.4, hy + 3, 0.9, 0.6, 'mon1_grim', { ink: -0.1 }));
  o.push(X(26.8, hy + 0.8, 1, 0.9, DARK));
  o.push(P([19.2, hy - 1.8, 19, hy - 6.4, 21.2, hy - 2.6], 'mon1_grim'), P([20.8, hy - 2.2, 22, hy - 6.6, 22.8, hy - 2], 'mon1_grim', { ink: 0.06 }));
  o.push(vEye(22.8, hy - 0.6, 1.4, 0.9), vEye(24.6, hy - 0.3, 0.8, 0.8));
  o.push(Lt(23.6, hy, 6, VIOL, 0.7));
  return o;
}

/** A shrouded wraith whose lower body is roots, bile-lit where they meet the ground. */
function rootWraith(b: number, sw: number): PrimTree {
  const y = -b * 0.4;
  const o: PrimTree[number][] = [Sh(16, 28.6, 8, 2, 0.4)];
  const roots = [[12.4, 20, 9.6, 24, 6.6 + sw * 0.3, 27.8], [14.6, 21, 13.6, 25, 12, 28.2], [17, 21, 18.4, 25, 17.8, 28.4], [19, 20.4, 21.4, 24.2, 24.4 - sw * 0.3, 27.8]];
  for (const [ax, ay, bx, by, cx, cy] of roots) o.push(K(ax, ay + y, bx, by, 1.4, 0.95, 'mon1_root'), K(bx, by, cx, cy, 0.95, 0.4, 'mon1_root'));
  o.push(K(9.6, 24, 8.4, 25.4, 0.5, 0.25, 'mon1_root'), K(21.4, 24.2, 22.2, 26, 0.5, 0.25, 'mon1_root'));
  o.push(P([12, 12 + y, 20, 12 + y, 21.6, 20 + y, 20, 22.6 + y, 18.8, 20.6 + y, 17.4, 23.4 + y, 16, 21 + y, 14.4, 23.2 + y, 13, 20.8 + y, 11, 22.2 + y, 10.6, 17 + y], 'mon1_rootCloth', { bv: 1.2 }));
  o.push(K(12.6, 13 + y, 10.4, 18.6 + y, 1.2, 0.9, 'mon1_rootCloth', { ink: -0.08 }));
  o.push(P([14.4, 6.6 + y, 11.6, 7.2 + y, 9.4 + sw * 0.4, 10.4 + y, 11.2, 10.2 + y, 13.6, 11.4 + y], 'mon1_rootCloth', { bv: 0.6 }));
  o.push(E(17, 9 + y, 4, 4.2, 'mon1_rootCloth'));
  o.push(P([19.6, 13.6 + y, 22.4, 15.6 + y, 22, 17.8 + y, 21, 16.4 + y, 20.2, 18 + y], 'mon1_rootCloth', { ink: -0.06 }));
  o.push(E(18.6, 10 + y, 2.4, 2.8, 'mon1_void'));
  o.push(vEye(18.2, 9.6 + y, 1, 0.9), vEye(20, 9.8 + y, 0.8, 0.8));
  o.push(K(19.6, 13 + y, 23.6, 16.2 + y, 1.3, 0.9, 'mon1_rootCloth'));
  o.push(K(23.4, 16 + y, 25.8, 15.2 + y, 0.65, 0.35, 'mon1_rootBone'), K(23.4, 16.4 + y, 26.2, 17.6 + y, 0.6, 0.32, 'mon1_rootBone'), K(23.2, 16.6 + y, 24.6, 19.2 + y, 0.55, 0.3, 'mon1_rootBone'));
  o.push(X(15.4, 21.8, 0.7, 0.7, 'emPoison:4', { em: true }), X(18.6, 23, 0.6, 0.6, 'emPoison:3', { em: true }));
  o.push(Lt(16.4, 22.6, 7, '#95dc4c', 0.55), Lt(19, 10, 4, VIOL, 0.5));
  return o;
}

/** Hel's warden: black iron over a rotted body, the face half helm and half skull, a violet-edged glaive. */
function helWarden(b: number, sw: number): PrimTree {
  const y = -b * 0.4;
  const o: PrimTree[number][] = [Sh(16, 28.6, 9, 2.4, 0.45)];
  o.push(P([9.4, 9.6 + y, 22.6, 9.6 + y, 24 + sw * 0.3, 26.4, 21.6, 25, 19.4, 28, 16.8, 25.6, 14.4, 28.2, 12, 25.4, 8.4 + sw * 0.4, 27], 'mon1_helCloth', { bv: 1.4 }));
  // Hel's glaive: a long crescent on a black-iron haft, its edge cold violet
  const gx = 25.2;
  o.push(K(gx + 0.6, 28.2, gx - 0.3, 3.8, 0.6, 0.55, 'mon1_helIron'));
  o.push(P([gx - 0.2, 11.2, gx - 0.6, 6.8, gx - 0.2, 2.4, gx + 0.8, 1.2, gx + 2.6, 2.8, gx + 4, 5.6, gx + 4.4, 9.2, gx + 3.4, 12.4, gx + 1.4, 13.4, gx + 2.4, 10.4, gx + 2, 7.2, gx + 0.8, 5.2, gx + 0.4, 9.8], 'mon1_helIron', { bv: 0.7 }));
  o.push(K(gx + 2.8, 3.4, gx + 4.2, 7.2, 0.32, 0.32, 'emUnholy'), K(gx + 4.2, 7.2, gx + 3.8, 11.2, 0.32, 0.28, 'emUnholy'));
  o.push(P([11.6, 18 + y, 20.6, 18 + y, 22.2, 25.6, 19.8, 24.4, 17.6, 27, 15.4, 24.6, 13, 26.6, 10.4, 24.8], 'mon1_helIron', { bv: 1 }));
  o.push(P([11, 9.8 + y, 21.4, 9.8 + y, 20.6, 17.6 + y, 16.2, 19.6 + y, 11.8, 17.6 + y], 'mon1_helIron', { bv: 1.6, n: [0, -0.1, 1] }));
  o.push(K(16.2, 12.4 + y, 16.2, 17 + y, 0.3, 0.3, 'emUnholy'), K(16.2, 14 + y, 17.8, 12.6 + y, 0.28, 0.28, 'emUnholy'), K(16.2, 14 + y, 14.6, 12.6 + y, 0.28, 0.28, 'emUnholy'));
  o.push(E(11, 10.4 + y, 3.6, 2.8, 'mon1_helIron'), P([8.6, 10 + y, 9.2, 6.2 + y, 11.4, 8.4 + y], 'mon1_helIron', { bv: 0.5 }));
  const hx = 17;
  const hy = 6 + y;
  // the face is half a helm, half a rotted skull
  o.push(E(hx - 0.2, hy, 3.6, 3.8, 'mon1_rotFlesh', { fl: 0.2 }));
  o.push(P([hx - 3.8, hy + 2.6, hx - 3.9, hy - 1.6, hx - 2, hy - 4.4, hx + 1.6, hy - 4.6, hx + 3.6, hy - 2.4, hx + 0.4, hy - 1.8, hx - 0.2, hy + 3.4], 'mon1_helIron', { bv: 1.1 }));
  o.push(X(hx - 2.8, hy - 0.4, 2, 0.6, 'emUnholy:4', { em: true }));
  o.push(X(hx + 0.8, hy - 1, 1.8, 1.7, DARK), vEye(hx + 1.1, hy - 0.7, 1.2, 1.1));
  o.push(X(hx + 2.4, hy + 0.6, 0.6, 1, DARK));
  o.push(X(hx + 0.4, hy + 1.8, 3, 0.8, 'bone:4'), X(hx + 1, hy + 1.8, 0.4, 0.8, DARK), X(hx + 2, hy + 1.8, 0.4, 0.8, DARK), X(hx + 0.6, hy + 2.6, 2.4, 0.5, DARK));
  o.push(E(21.6, 10.4 + y, 3.6, 2.8, 'mon1_helIron'), P([21, 8.4 + y, 22.6, 5.6 + y, 23.4, 9 + y], 'mon1_helIron', { bv: 0.5 }));
  o.push(K(21.8, 12 + y, 24.4, 16.4 + y, 1.5, 1.3, 'mon1_helIron'), E(24.9, 17 + y, 1.4, 1.4, 'mon1_helIron'));
  o.push(Lt(16.6, 14 + y, 8, VIOL, 0.5), Lt(hx + 1.6, hy, 4, VIOL, 0.6));
  return o;
}

/**
 * The restless spirits. They float (bob, no feet) and trail off; size and lower body tell
 * them apart: shroud (`myling`), mist (`grim`), roots (`root`), iron (`warden`).
 */
export function ghostModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  switch (v.kind) {
    case 'grim': return kirkegrim(b, sw);
    case 'root': return rootWraith(b, sw);
    case 'warden': return helWarden(b, sw);
  }
  return myling(b, sw);
}
