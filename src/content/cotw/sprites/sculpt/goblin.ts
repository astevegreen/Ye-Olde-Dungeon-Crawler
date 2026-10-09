import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { DARK, aEye, fEye, type FamilyVariant } from './family';
import './materials';

const SKINS: Record<string, string> = { kobold: 'mon1_kobold', shaman: 'mon1_shaman', goblin: 'mon1_goblin', skraeling: 'mon1_skrael' };

/**
 * mon_goblin: small and mean. Big head, big ears, bent knees. `kind` picks the body: the
 * `kobold` (default) backs away with a dagger, the `goblin` is squat with a studded club, the
 * `shaman` carries a flaming staff, the `skraeling` wears a fur hood and carries an ice spear.
 */
export function goblinModel(f: number, v: FamilyVariant): PrimTree {
  const kind = v.kind || 'kobold';
  const b = breath(f);
  const sw = sway(f);
  const skin = SKINS[kind];
  const squat = kind === 'goblin';
  const sk = kind === 'skraeling';
  const sh = kind === 'shaman';
  const kb = kind === 'kobold';
  const o: PrimTree[number][] = [Sh(16, 28.6, squat ? 6.6 : 5.8, 1.9)];
  const hx = kb ? 15.8 : sk ? 17.6 : 18;
  const hy = (kb ? 14.4 : squat ? 13.6 : sk ? 12.2 : 13.4) + b * 0.3;
  const ty = (kb ? 20.8 : sk ? 19.6 : 20.4) + b * 0.2;
  // shaman's staff behind the near hand
  if (sh) {
    const fl = f % 4;
    o.push(K(23.2, 28.2, 22.6, 8.6, 0.6, 0.55, 'woodDark'));
    o.push(K(22.6, 9.6, 21.4, 7.6, 0.45, 0.35, 'woodDark'), K(22.8, 9.6, 24.2, 7.8, 0.45, 0.35, 'woodDark'));
    o.push(K(21.8, 10.6, 21.4, 13.4 + sw * 0.2, 0.25, 0.25, 'linen'), E(21.4, 13.8 + sw * 0.2, 0.7, 0.8, 'bone'), K(23.6, 10.4, 24.2, 12.8 - sw * 0.2, 0.25, 0.25, 'linen'), K(24.2, 13, 24.4, 14.2 - sw * 0.2, 0.4, 0.3, 'bone'));
    o.push(E(22.8, 7.4 - fl * 0.1, 1.8, 2 + (fl % 2) * 0.3, 'emFire'), E(22.9, 7.8, 1, 1.1, 'emFireCore'));
    o.push(P([22, 6, 22.8, 3.6 + (fl % 2) * 0.5, 23.6, 6], 'emFire'));
    o.push(Lt(22.8, 7.6, 9, '#ff8a2c', 0.95));
  }
  if (sk) {
    // ice spear, upright, behind the near hand
    o.push(K(22.8, 28, 22.2, 7.4, 0.55, 0.5, 'wood'));
    o.push(P([21.4, 7.8, 22.2, 1.6, 23.1, 7.8, 22.3, 8.8], 'ice', { bv: 0.6 }));
    o.push(K(21.6, 8.8, 23, 8.8, 0.45, 0.45, 'leatherDark'));
  }
  // kobold: a thin rat tail, tucked low
  if (kb) o.push(K(13.6, ty + 2.4, 9.4, 25.6, 0.85, 0.5, skin, { ink: -0.1 }), K(9.4, 25.6, 6.6 + sw * 0.25, 24, 0.5, 0.25, skin, { ink: -0.1 }));
  // back arm
  if (kb) o.push(K(13.8, ty - 2.4, 12.4, ty + 0.4, 0.8, 0.65, skin, { ink: -0.08 }), E(12.2, ty + 0.8, 0.8, 0.8, skin, { ink: -0.08 }));
  else if (squat) o.push(K(13.4, ty - 2.6, 11.6, ty + 2, 1.1, 0.9, skin, { ink: -0.08 }), E(11.5, ty + 2.4, 1, 1, skin, { ink: -0.08 }));
  else if (sh) o.push(K(14.4, ty - 2.6, 12.8, ty + 1.6, 0.85, 0.7, skin, { ink: -0.08 }), E(12.8, ty + 2, 0.85, 0.85, skin, { ink: -0.08 }));
  else o.push(K(14, ty - 2.6, 12.6, ty + 2, 1.1, 0.9, 'mon1_skFur', { ink: -0.08 }));
  // legs: knees bent, flat feet
  const lm = sk ? 'leatherDark' : skin;
  const lr = squat ? 1.25 : 0.95;
  // kobold backs away: rear leg bent under it, front leg braced out ahead
  if (kb) o.push(K(14.4, ty + 2, 12.8, 24.6, lr, lr * 0.8, lm, { ink: -0.06 }), K(12.8, 24.6, 12.4, 27.6, lr * 0.8, 0.7, lm, { ink: -0.06 }), K(16.6, ty + 2, 19, 24.6, lr, lr * 0.8, lm), K(19, 24.6, 20.2, 27.6, lr * 0.8, 0.7, lm));
  else o.push(K(14.4, ty + 2, 13.6, 27.4, lr, lr * 0.85, lm), K(17.6, ty + 2, 18.6, 27.4, lr, lr * 0.85, lm));
  const fm = sk ? 'mon1_skFur' : skin;
  if (kb) o.push(E(12.8, 27.9, 1.6, 0.7, fm, { ink: -0.06 }), E(20.8, 27.9, 1.6, 0.7, fm));
  else o.push(E(13.6, 27.8, squat ? 2 : 1.7, 0.8, fm), E(19.2, 27.8, squat ? 2 : 1.7, 0.8, fm));
  // torso
  if (squat) {
    o.push(E(15.8, ty, 4.4, 4.4, skin));
    o.push(P([12, ty - 2.6, 19.6, ty - 2.6, 20, ty + 2.6, 11.6, ty + 2.6], 'leather', { bv: 0.8 }));
    o.push(P([12, ty + 2, 19.8, ty + 2, 20.2, ty + 5.6, 18, ty + 4.6, 16, ty + 6, 14, ty + 4.6, 11.6, ty + 5.4], 'mon1_ragBrown', { bv: 0.5 }));
  } else if (sk) {
    o.push(E(15.8, ty, 4, 4.6, 'mon1_skFur'));
    o.push(P([11.8, ty + 1.6, 19.8, ty + 1.6, 20.6, ty + 6.4, 18.4, ty + 5.4, 16, ty + 6.8, 13.6, ty + 5.4, 11.2, ty + 6.4], 'mon1_skFur', { bv: 0.6, ink: -0.04 }));
    o.push(K(11.8, ty + 1.4, 19.8, ty + 1.4, 0.6, 0.6, 'leatherDark'));
  } else {
    o.push(E(kb ? 15.2 : 15.6, ty, 3.1, 3.8, skin, { a: kb ? -0.3 : 0.15 }));
    if (kb) o.push(X(14.6, ty - 1, 1.8, 0.45, skin + ':2'), X(14.6, ty + 0.2, 1.8, 0.45, skin + ':2'));
    o.push(P([12.8, ty + 1.8, 18.8, ty + 1.8, 19.2, ty + 5, 17.2, ty + 4.2, 15.6, ty + 5.6, 14, ty + 4.2, 12.4, ty + 4.8], 'mon1_ragBrown', { bv: 0.5 }));
    if (sh) for (let i = 0; i < 5; i++) o.push(E(14.2 + i * 1.1, ty - 2.4 + Math.abs(i - 2) * -0.4 + 1.2, 0.5, 0.65, 'bone'));
  }
  // head
  if (sk) {
    // white fur hood with a dark opening, so the face reads inside it
    o.push(E(hx - 0.6, hy - 0.4, 4.2, 4.2, 'mon1_skFur'));
    o.push(E(hx + 1.3, hy + 0.7, 3, 3.2, 'leatherDark', { fl: 0.3 }));
    o.push(E(hx + 1.7, hy + 0.9, 2.2, 2.5, skin, { fl: 0.2 }));
    o.push(K(hx + 3, hy + 0.8, hx + 4.4, hy + 1.8, 0.8, 0.45, skin));
    o.push(fEye(hx + 1.2, hy + 0.1, 0.9, 0.8), fEye(hx + 3, hy + 0.2, 0.7, 0.8));
    o.push(Lt(hx + 2, hy + 0.4, 3, '#9fe6ff', 0.4));
    o.push(X(hx + 1.8, hy + 2.3, 1.6, 0.4, DARK));
    o.push(P([hx - 3.6, hy - 3.6, hx + 2, hy - 4.8, hx + 3.8, hy - 2.4, hx + 1.4, hy - 2.8, hx - 3, hy - 1.6], 'mon1_furRime', { bv: 0.5 }));
  } else {
    const ear = squat ? 1.5 : 1;
    o.push(P([hx - 2.4, hy - 1, hx - 2.4 - 5.2 * ear, hy - 2.6 * ear, hx - 2.6, hy + 1.2], skin, { bv: 0.5, ink: -0.06 }));
    if (kb) o.push(K(hx - 1, hy - 2.4, hx - 1.8, hy - 4.4, 0.5, 0.25, 'horn'), K(hx + 1, hy - 2.8, hx + 0.6, hy - 4.8, 0.5, 0.25, 'horn'));
    o.push(E(hx, hy, squat ? 3.8 : 3.4, squat ? 3.1 : 3, skin));
    o.push(K(hx + 2.2, hy + 0.4, hx + (kb ? 5 : 4.6), hy + (kb ? 1.8 : 1.4), 1.1, 0.55, skin));
    o.push(P([hx + 0.4, hy - 2, hx + 3.6 * ear, hy - 2.4 - 3.6 * ear, hx + 2.2, hy - 0.4], skin, { bv: 0.5 }));
    o.push(aEye(hx + 0.6, hy - 0.6, kb ? 1.3 : 1.1, kb ? 1.2 : 0.9), aEye(hx + 2.4, hy - 0.4, 0.8, kb ? 1 : 0.9));
    o.push(X(hx + 0.8, hy + 1.6, 2.4, 0.5, DARK), X(hx + 1.2, hy + 1.4, 0.5, 0.6, 'bone:5'), X(hx + 2.4, hy + 1.4, 0.5, 0.6, 'bone:5'));
    if (sh) {
      o.push(X(hx + 0.2, hy + 0.3, 1.6, 0.4, 'bone:4'), X(hx + 2.2, hy + 0.4, 1, 0.4, 'bone:4'));
      o.push(E(hx - 0.6, hy - 2.8, 2, 1.4, 'bone'), X(hx - 0.6, hy - 3, 0.6, 0.6, DARK), X(hx + 0.4, hy - 3, 0.5, 0.6, DARK));
      o.push(K(hx - 1.6, hy - 3.6, hx - 3.4, hy - 6.6 + sw * 0.2, 0.45, 0.2, 'feather'));
    }
  }
  // near arm and weapon
  if (kb) {
    // dagger thrust out at arm's length, as far from the body as it will go
    o.push(K(16.4, ty - 2.6, 21, ty - 1.4, 0.8, 0.65, skin));
    o.push(P([21.8, ty - 1.4, 22.2, ty - 2.4, 26.6, ty - 3.8, 22.6, ty - 0.6], 'mon1_oldSteel', { bv: 0.5 }), K(21, ty - 0.8, 22.2, ty - 1.8, 0.45, 0.45, 'bronze'));
    o.push(E(21.4, ty - 1.2, 0.85, 0.85, skin));
  } else if (squat) {
    o.push(K(18.6, ty - 2.4, 21, ty + 1.6, 1.15, 0.95, skin));
    o.push(K(21.4, ty + 2.4, 24.4, ty - 8.6, 0.75, 1.9, 'wood'), X(23.2, ty - 6.8, 0.6, 0.6, 'iron:4'), X(24.8, ty - 8.2, 0.6, 0.6, 'iron:4'), X(22.8, ty - 4.6, 0.6, 0.6, 'iron:4'));
    o.push(E(21.4, ty + 2, 1.1, 1.1, skin));
  } else if (sh) {
    o.push(K(17.6, ty - 2.4, 21.6, ty - 1.4, 0.85, 0.7, skin), E(22.6, ty - 1.6, 0.9, 0.95, skin));
  } else {
    o.push(K(17.8, ty - 2.4, 21.8, ty + 0.6, 1.1, 0.9, 'mon1_skFur'), E(22.4, ty + 0.4, 0.95, 0.95, skin));
  }
  return o;
}
