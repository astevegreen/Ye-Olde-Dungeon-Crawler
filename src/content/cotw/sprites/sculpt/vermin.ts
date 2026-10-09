import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { DARK, aEye, type FamilyVariant } from './family';
import './materials';

/** The giant rat: low and hunched, a bald tail trailing, teeth bared. */
function rat(b: number, sw: number): PrimTree {
  return [
    Sh(15, 28.6, 8, 1.8),
    K(8.2, 24.4, 4.6, 26.8, 0.9, 0.7, 'mon1_ratSkin'), K(4.6, 26.8, 2.2, 25.8, 0.7, 0.5, 'mon1_ratSkin'), K(2.2, 25.8, 1.8 + sw * 0.3, 22.6, 0.5, 0.3, 'mon1_ratSkin'),
    K(10.6, 25, 11, 27.8, 0.8, 0.6, 'mon1_ratFur', { ink: -0.15 }), K(19.6, 25.6, 20.6, 27.8, 0.7, 0.5, 'mon1_ratFur', { ink: -0.15 }),
    E(13.6, 22.6 + b * 0.15, 6.6, 5, 'mon1_ratFur'),
    E(12.4, 20.8 + b * 0.2, 4.6, 3.6, 'mon1_ratFur', { ink: 0.04 }),
    P([8.6, 19.6, 9.2, 17.6, 10.2, 18.8, 11, 16.8, 12, 18.2, 13, 16.4, 13.8, 18, 15, 17, 15.4, 19], 'mon1_ratFur', { ink: -0.04 }),
    E(10, 25, 2.6, 2.6, 'mon1_ratFur'), K(10, 26, 11.4, 27.8, 0.8, 0.6, 'mon1_ratFur'), E(11.8, 28, 1.2, 0.5, 'mon1_ratSkin'),
    E(20.2, 22.8, 3.2, 2.8, 'mon1_ratFur', { a: 0.2 }),
    K(21.4, 23.4, 26.6, 25.2, 2.2, 0.7, 'mon1_ratFur'),
    E(26.6, 25, 0.7, 0.6, 'mon1_ratSkin'),
    E(19.4, 19.9, 1.6, 1.8, 'mon1_ratSkin', { fl: 0.5 }),
    aEye(22, 21.8, 1, 0.9),
    X(24.6, 25.6, 0.9, 1.4, 'mon1_teeth:4'),
    K(19, 25.4, 20.6, 27.8, 0.85, 0.6, 'mon1_ratFur'), E(21, 28, 1.1, 0.5, 'mon1_ratSkin'),
  ];
}

/** The ice borer: a chitin beetle with a rimed back and two drill-mandibles. */
function borer(b: number): PrimTree {
  const o: PrimTree[number][] = [Sh(15.5, 28.6, 9, 1.9)];
  for (const [x, x2] of [[11, 9.6], [14.4, 13.4], [17.6, 17.8]]) o.push(K(x, 24, x2 - 1, 25.8, 0.6, 0.45, 'chitin', { ink: -0.1 }), K(x2 - 1, 25.8, x2 - 1.8, 28, 0.45, 0.3, 'chitin', { ink: -0.1 }));
  o.push(E(12.8, 22.4 + b * 0.1, 7.2, 5, 'mon1_iceChitin', { a: -0.1 }));
  o.push(K(6.6, 23.4, 18.6, 19.4, 0.25, 0.25, 'chitin'));
  o.push(P([8.4, 19.4, 9.2, 16.2, 10.4, 18.6], 'mon1_rime', { bv: 0.4 }), P([10.8, 18.4, 12, 14.8, 13.2, 17.8], 'mon1_rime', { bv: 0.4 }), P([13.6, 17.8, 14.6, 15.6, 15.6, 17.6], 'mon1_rime', { bv: 0.4 }));
  o.push(E(19.6, 22.6, 3.2, 3.4, 'mon1_iceChitin'));
  o.push(E(22.4, 23.6, 2.2, 2.2, 'chitin'));
  // two drill-mandibles, spiral-grooved, closing on a point
  o.push(K(23.6, 25.2, 29.8, 24.6, 1.35, 0.25, 'mon1_drill', { ink: -0.12 }), K(23.4, 22.2, 30.4, 23.4, 1.6, 0.25, 'mon1_drill'));
  for (const x of [24.6, 26.2, 27.8]) {
    const t = (x - 23.4) / 7;
    o.push(X(x, 22.2 + t * 1.2 - 1.6 * (1 - t), 0.45, 3.2 * (1 - t) + 0.3, 'mon1_drill:1'));
    o.push(X(x + 0.6, 25.2 - t * 0.6 - 1.2 * (1 - t), 0.4, 2.4 * (1 - t) + 0.3, 'mon1_drill:1'));
  }
  o.push(aEye(22.8, 22.6, 0.9, 0.8));
  for (const [x, x2] of [[10.4, 8.6], [14, 13.6], [18.4, 20.4]]) o.push(K(x, 25, x2, 26.4, 0.7, 0.5, 'chitin'), K(x2, 26.4, x2 + 0.6, 28.2, 0.5, 0.35, 'chitin'));
  return o;
}

/** The rot crawler: a segmented, many-legged centipede rearing its head, venom on its fangs. */
function crawler(b: number, sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(14.5, 28.6, 10, 1.8)];
  const seg: Array<[number, number, number]> = [[4, 26.4, 1.3], [6.2, 26.2, 1.6], [8.6, 26, 1.8], [11, 25.9, 2], [13.4, 25.6, 2.1], [15.6, 24.8, 2.1], [17.6, 23.2, 2.1], [19, 21, 2], [20, 18.6, 1.9], [20.8, 16.2 + b * 0.2, 1.8]];
  for (let i = 0; i < 6; i++) {
    const [x, y] = seg[i];
    o.push(K(x, y, x - 1.2, 28.2, 0.35, 0.22, 'mon1_rotChitin', { ink: -0.2 }));
  }
  seg.forEach(([x, y, r], i) => {
    o.push(E(x, y, r, r * 0.82, i % 2 ? 'mon1_rotChitin' : 'bark', { ink: i % 2 ? 0 : 0.06 }));
    if (i < 6) o.push(K(x + 0.4, y + 0.8, x + 1.4, 28.2, 0.35, 0.22, 'mon1_rotChitin'));
    else o.push(K(x + 0.8, y + 0.4, x + 2.8, y + 1.6 + sway(f + i) * 0.2, 0.32, 0.2, 'mon1_rotChitin'));
  });
  const hx = 22.2;
  const hy = 14 + b * 0.25;
  o.push(K(hx + 0.6, hy - 1.2, hx + 4.4, hy - 5 + sw * 0.3, 0.3, 0.15, 'mon1_rotChitin'), K(hx - 0.2, hy - 1.4, hx + 1.4, hy - 6 - sw * 0.3, 0.3, 0.15, 'mon1_rotChitin'));
  o.push(E(hx, hy, 2.3, 1.9, 'mon1_rotChitin'));
  o.push(E(hx + 1.2, hy + 1.4, 1.2, 1, 'emPoison'));
  o.push(K(hx + 1.2, hy + 1.6, hx + 3.6, hy + 2.8, 0.55, 0.25, 'boneOld'), K(hx + 0.6, hy + 2, hx + 2.4, hy + 3.8, 0.5, 0.22, 'boneOld'));
  o.push(X(hx + 3.2, hy + 3.4 + (f % 2) * 0.6, 0.5, 0.8, 'emPoison:4', { em: true }));
  o.push(aEye(hx + 1, hy - 0.8, 0.8, 0.7));
  o.push(Lt(hx + 1.4, hy + 1.6, 6, '#95dc4c', 0.7));
  return o;
}

/** The leech: a bloated, reflective worm rearing from the floor. */
function leech(b: number): PrimTree {
  const seg: Array<[number, number, number, number]> = [[5.6, 27.2, 1.5, 1.1], [8.6, 26.6, 2.6, 1.9], [11.8, 26, 3, 2.3], [14.8, 24.4, 2.9, 2.4], [17, 21.8, 2.6, 2.4], [18.4, 19 + b * 0.1, 2.4, 2.2], [19.4, 16.4 + b * 0.2, 2.2, 2.1]];
  const o: PrimTree[number][] = [Sh(13, 28.6, 9, 1.8)];
  // living quicksilver: bright and dark bands like a mirror of the room, a round sucking mouth
  seg.forEach(([x, y, rx, ry], i) => {
    o.push(E(x, y, rx, ry, i % 2 ? 'mon1_quick2' : 'mon1_quick'));
    if (i > 0) o.push(X(x - rx * 0.5, y - ry * 0.55, rx * 0.7, 0.45, 'silver:5'));
  });
  const hx = 20.6;
  const hy = 14.2 + b * 0.25;
  o.push(E(hx, hy, 2, 2.2, 'mon1_quick'));
  o.push(E(hx + 1.7, hy - 0.3, 1.2, 2.2, 'mon1_quick2', { a: 0.4 }));
  o.push(X(hx + 1.7, hy - 1.3, 0.9, 2, DARK));
  o.push(X(hx + 1.5, hy - 1.8, 0.5, 0.5, 'bone:5'), X(hx + 2.4, hy - 0.4, 0.5, 0.5, 'bone:5'), X(hx + 1.5, hy + 0.7, 0.5, 0.5, 'bone:5'));
  o.push(aEye(hx - 0.4, hy - 1.6, 0.6, 0.6), aEye(hx + 0.6, hy - 1.8, 0.5, 0.5));
  o.push(X(hx - 1.2, hy - 1.4, 0.8, 0.45, 'silver:5'));
  return T(o, { s: 0.9 });
}

/**
 * mon_vermin: low, many-legged, 10-14 units tall. `kind` picks the creature: a giant rat by
 * default, or the ice `borer`, the rot `crawler`, the quicksilver `leech`.
 */
export function verminModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  switch (v.kind) {
    case 'borer': return borer(b);
    case 'crawler': return crawler(b, sw, f);
    case 'leech': return leech(b);
  }
  return rat(b, sw);
}
