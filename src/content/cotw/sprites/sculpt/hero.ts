import { E, K, P, X, Lt, Sh, breath, sway, type Prim, type PrimTree, type Variant } from './kit';
import './materials';

export type HeroArmor = 'none' | 'light' | 'medium' | 'heavy';
export type HeroWeapon = 'none' | 'sword' | 'dagger' | 'axe' | 'mace' | 'hammer' | 'spear' | 'staff' | 'bow';
export type HeroOffHand = 'none' | 'round' | 'tower' | 'torch';

/** What the hero's map sprite shows: who, the armour's weight band, the weapon's kind, the off hand. */
export interface HeroLook extends Variant {
  g: 'm' | 'f';
  armor: HeroArmor;
  weapon: HeroWeapon;
  off: HeroOffHand;
}

export const HERO_FRAMES = 4;

/** The weapon in the front hand, gripped at (hx, hy); it sways a quarter unit with the idle. */
function weapon(kind: HeroWeapon, hx: number, hy: number, f: number): Prim[] {
  const s = sway(f) * 0.25;
  switch (kind) {
    case 'sword':
      return [
        P([hx - 0.9, hy - 1.2, hx + 0.9, hy - 1.2, hx + 1.1 + s, hy - 13, hx + s, hy - 14.6, hx - 1.1 + s, hy - 13], 'steel', { bv: 0.9, n: [0.2, -0.1, 1] }),
        X(hx - 0.2 + s * 0.5, hy - 12, 0.5, 9.5, 'steel:5'),
        K(hx - 2.6, hy - 1.1, hx + 2.6, hy - 1.3, 0.75, 0.75, 'bronze'),
        K(hx, hy - 0.8, hx, hy + 2, 0.7, 0.7, 'leatherDark'),
        E(hx, hy + 2.6, 1, 1, 'bronze'),
      ];
    case 'axe':
      return [
        K(hx - 0.2, hy + 3.5, hx + 0.6 + s, hy - 11, 0.7, 0.65, 'wood'),
        P([hx + 0.4 + s, hy - 11.6, hx + 5.6 + s, hy - 13.5, hx + 6.4 + s, hy - 8.4, hx + 3.4 + s, hy - 6.4, hx + 0.6 + s, hy - 8.4], 'steel', { bv: 1, n: [0.25, -0.15, 1] }),
        K(hx + 5.6 + s, hy - 13.3, hx + 6.3 + s, hy - 8.6, 0.45, 0.45, 'silver'),
      ];
    case 'mace':
      return [
        K(hx, hy + 3, hx + 0.5 + s, hy - 8.5, 0.65, 0.6, 'woodDark'),
        E(hx + 0.6 + s, hy - 10.4, 2.5, 2.7, 'iron'),
        P([hx + 0.6 + s, hy - 14.2, hx + 1.6 + s, hy - 12, hx - 0.4 + s, hy - 12], 'iron'),
        P([hx + 4 + s, hy - 10.4, hx + 2 + s, hy - 9.2, hx + 2 + s, hy - 11.6], 'iron'),
        P([hx - 2.8 + s, hy - 10.4, hx - 0.8 + s, hy - 9.2, hx - 0.8 + s, hy - 11.6], 'iron'),
        K(hx - 0.2, hy + 0.8, hx + 0.2, hy + 2.4, 0.8, 0.8, 'leatherDark'),
      ];
    case 'hammer':
      // a smith's war hammer: a squared iron head on a long haft, a beak behind
      return [
        K(hx - 0.1, hy + 3.4, hx + 0.5 + s, hy - 10.5, 0.65, 0.6, 'wood'),
        P([hx - 1.6 + s, hy - 13.6, hx + 3.6 + s, hy - 13.6, hx + 3.8 + s, hy - 9.6, hx - 1.8 + s, hy - 9.6], 'iron', { bv: 1, n: [0.15, -0.15, 1] }),
        P([hx - 1.6 + s, hy - 13, hx - 4.4 + s, hy - 11.4, hx - 1.6 + s, hy - 10.4], 'iron', { bv: 0.5 }),
        K(hx - 1.6 + s, hy - 11.6, hx + 3.6 + s, hy - 11.6, 0.4, 0.4, 'bronze', { occ: false }),
        K(hx - 0.2, hy + 0.8, hx + 0.2, hy + 2.4, 0.8, 0.8, 'leatherDark'),
      ];
    case 'spear':
      return [
        K(hx - 0.6, hy + 7, hx + 1.8 + s, hy - 15, 0.6, 0.55, 'wood'),
        P([hx + 1.6 + s, hy - 14.4, hx + 3.2 + s, hy - 16, hx + 2.6 + s, hy - 21, hx + 1.1 + s, hy - 16.2], 'steel', { bv: 0.7 }),
        K(hx + 1.4 + s, hy - 14, hx + 1.8 + s, hy - 14.6, 0.85, 0.85, 'bronze'),
      ];
    case 'dagger':
      return [
        P([hx - 0.6, hy - 1, hx + 0.6, hy - 1, hx + 0.9, hy - 6.6, hx + 0.1, hy - 8, hx - 0.6, hy - 6.6], 'steel', { bv: 0.6 }),
        K(hx - 1.8, hy - 0.9, hx + 1.8, hy - 1, 0.55, 0.55, 'bronze'),
        K(hx, hy - 0.6, hx, hy + 1.6, 0.6, 0.6, 'leatherDark'),
      ];
    case 'staff':
      return [
        K(hx - 0.4, hy + 8.5, hx + 0.4, hy - 13, 0.75, 0.7, 'wood'),
        K(hx + 0.4, hy - 13, hx + 1.6, hy - 15.4, 0.6, 0.4, 'woodDark'),
        K(hx + 0.4, hy - 13, hx - 1, hy - 15.8, 0.6, 0.4, 'woodDark'),
        E(hx + 0.3, hy - 15.2, 1.5 + breath(f) * 0.15, 1.5 + breath(f) * 0.15, 'emArcane'),
        Lt(hx + 0.3, hy - 15.2, 7, '#6aa6ff', 0.9),
      ];
    case 'bow':
    case 'none':
      return [];
  }
}

/** A torch raised in the back hand, leaning out from the body; the flame flickers per frame. */
function torch(f: number): Prim[] {
  const fl = [0, 0.35, 0.1, 0.45][f % 4];
  const lean = [0, 0.25, -0.15, 0.2][f % 4];
  return [
    K(10.6, 21, 8.8, 13.4, 0.65, 0.75, 'wood'),
    K(8.9, 13.9, 8.7, 12.9, 0.95, 0.95, 'leatherDark'),
    E(8.6 + lean * 0.5, 11.2 - fl * 0.3, 1.7 + fl * 0.2, 2.5 + fl, 'emFire'),
    P([7.4 + lean, 11, 8.6 + lean * 2, 7.4 - fl * 1.6, 9.8 + lean, 11], 'emFire'),
    E(8.7 + lean * 0.4, 11.9, 0.95, 1.3, 'emFireCore'),
    Lt(8.7, 11.4, 10, '#ff9a40', 0.95),
  ];
}

/**
 * The hero and heroine: one body, drawn gear layers, three-quarter view facing right.
 * Layer order: shadow, cloak, back arm and off hand, legs, body armour, head and helm,
 * shield, weapon arm and weapon. Armour weight picks cloak, sleeves, legs and helm, so
 * the band reads from the silhouette (hood, nasal helm, spectacle helm) and not only hue.
 */
export function heroModel(f: number, v: HeroLook): PrimTree {
  const { armor, weapon: wk } = v;
  const fem = v.g === 'f';
  const hair = fem ? 'hairRed' : 'hairFlax';
  const b = breath(f);
  const sw = sway(f);
  const hy = 8.6 + b * 0.35; // head
  const ty = 16.8 + b * 0.25; // torso
  const off = wk === 'bow' ? 'none' : v.off;
  const shield = off === 'round' || off === 'tower';
  const out: PrimTree[number][] = [Sh(16, 28.6, 7.5, 2.2)];

  // cloak behind: medium and heavy wear a long one, light a short hooded cape, none bare
  const cloakMat = armor === 'heavy' ? 'woolRed' : armor === 'medium' ? 'cloak' : 'woolGreen';
  if (armor !== 'none') {
    const hem = armor === 'light' ? 20 : 26.6;
    out.push(P([11.4, 12.6, 20.4, 12.6, 21.5 + sw * 0.3, hem, 16 + sw * 0.4, hem + 1.1, 10 + sw * 0.5, hem + 0.2], cloakMat, { bv: 1.2, ink: -0.08 }));
  }

  const sleeve = armor === 'heavy' ? 'steel' : armor === 'medium' ? 'mail' : armor === 'light' ? 'leather' : 'woolBrown';
  // back arm and off hand
  if (wk === 'bow') {
    out.push(K(12.2, 13.4, 11, 18.4, 1.3, 1.1, sleeve));
  } else if (shield) {
    out.push(K(12.2, 13.4, 10.4, 18.6, 1.3, 1.1, sleeve));
  } else if (off === 'torch') {
    out.push(K(12.2, 13.4, 10.8, 19.6, 1.3, 1.1, sleeve), torch(f), E(10.6, 20.2, 1.2, 1.2, 'skin'));
  } else {
    out.push(K(12.2, 13.4, 11.2, 19.6, 1.3, 1.1, sleeve), E(11.2, 20.2, 1.2, 1.2, 'skin'));
  }

  // legs and boots
  const legMat = armor === 'heavy' ? 'mail' : armor === 'medium' ? 'woolBrown' : 'leatherDark';
  const boot = armor === 'heavy' ? 'iron' : 'leatherDark';
  out.push(K(14.2, 21, 13.4, 26.8, 1.6, 1.3, legMat), K(17.8, 21, 18.8, 26.8, 1.6, 1.3, legMat));
  out.push(E(13.1, 27.6, 2, 1.3, boot), E(19.3, 27.6, 2, 1.3, boot));

  // body armour
  if (armor === 'none') {
    // a plain wool tunic and a rope belt
    out.push(E(16, ty, fem ? 4.3 : 4.6, 5.3, 'woolBrown', { fl: 0.15 }));
    out.push(P([12.2, ty + 3, 19.8, ty + 3, 20.4, ty + 6, 11.6, ty + 6], 'woolBrown', { bv: 0.8, ink: -0.05 }));
    out.push(K(11.8, ty + 2.4, 20.2, ty + 2.4, 0.55, 0.55, 'linen'));
  } else if (armor === 'light') {
    out.push(E(16, ty, fem ? 4.4 : 4.8, 5.4, 'leather', { fl: 0.15 }));
    out.push(P([12, ty + 3.2, 20, ty + 3.2, 20.6, ty + 6.2, 11.4, ty + 6.2], 'leatherDark', { bv: 0.8 }));
    out.push(K(11.6, ty + 2.4, 20.4, ty + 2.4, 0.75, 0.75, 'leatherDark'));
    out.push(X(15.4, ty + 1.8, 1.4, 1.2, 'bronze:4'));
    out.push(K(12.4, ty - 4, 19.8, ty + 1.6, 0.5, 0.5, 'leatherDark')); // baldric
  } else if (armor === 'medium') {
    out.push(E(16, ty + 0.3, fem ? 4.6 : 5, 5.8, 'mail', { fl: 0.1 }));
    out.push(P([12.2, ty + 3, 19.8, ty + 3, 20.8, ty + 7, 11.2, ty + 7], 'mail', { bv: 0.6 }));
    out.push(K(11.4, ty + 2.6, 20.6, ty + 2.6, 0.8, 0.8, 'leather'));
    out.push(X(15.3, ty + 2, 1.6, 1.3, 'bronze:4'));
  } else {
    out.push(P([11.6, ty + 3, 20.4, ty + 3, 21.2, ty + 7.2, 10.8, ty + 7.2], 'mail', { bv: 0.6 }));
    out.push(P([11.2, ty - 4.4, 20.8, ty - 4.4, 20, ty + 3.4, 16, ty + 4.4, 12, ty + 3.4], 'steel', { bv: 1.6, n: [0, -0.1, 1] }));
    out.push(K(16, ty - 3.6, 16, ty + 3.4, 0.35, 0.35, 'silver', { occ: false }));
    out.push(K(11.2, ty + 3, 20.8, ty + 3, 0.8, 0.8, 'leatherDark'));
  }

  // head
  const hx = 16.2;
  if (fem) out.push(K(hx - 2.6, hy + 1, hx - 3.6, hy + 9 + sw * 0.3, 1.25, 0.8, hair)); // braid
  if (armor === 'medium') out.push(E(hx - 1.4, hy - 0.2, 4.2, 4.4, hair)); // hair behind the head
  if (armor === 'none') out.push(E(hx - 2.2, hy - 0.4, 3.2, 4, hair));
  out.push(E(hx, hy, 3.9, 4.1, 'skin', { fl: 0.2 }));
  if (armor === 'heavy') {
    // spectacle helm: the Gjermundbu silhouette
    out.push(E(hx, hy - 1.2, 4.4, 3.8, 'steel', { fl: 0.1 }));
    out.push(P([hx - 4.4, hy - 0.4, hx + 4.4, hy - 0.4, hx + 4.2, hy + 1.3, hx - 4.2, hy + 1.3], 'steel', { bv: 0.5 }));
    out.push(E(hx + 0.4, hy + 0.5, 3.2, 1.3, 'blackIron', { fl: 0.6 }));
    out.push(X(hx - 1.6, hy + 0.2, 1, 0.9, '#efe6d0', { em: true, glow: false }), X(hx + 1.6, hy + 0.2, 1, 0.9, '#efe6d0', { em: true, glow: false }));
    out.push(K(hx, hy - 4.6, hx, hy - 0.5, 0.45, 0.45, 'silver', { occ: false }));
    out.push(K(hx, hy + 1.6, hx, hy + 4, 0.35, 0.35, 'mail'));
  } else {
    if (armor === 'light') {
      // hood
      out.push(E(hx - 0.4, hy - 1.4, 4.4, 3.8, cloakMat, { fl: 0.1 }));
      out.push(P([hx - 4.4, hy - 1.2, hx - 4.6, hy + 4, hx - 2.6, hy + 4.4, hx - 2.8, hy - 0.6], cloakMat));
      out.push(E(hx + 1.2, hy + 0.4, 2.8, 3, 'skin', { fl: 0.25 }));
      out.push(P([hx - 1.4, hy - 2.2, hx + 3.6, hy - 2.6, hx + 3.2, hy - 1.2, hx - 0.8, hy - 0.8], hair));
    } else if (armor === 'medium') {
      out.push(E(hx - 3, hy + 0.6, 1.3, 2.6, hair));
      // spangenhelm with nasal guard
      out.push(P([hx - 4.2, hy - 0.6, hx - 3.2, hy - 4, hx, hy - 6, hx + 3.2, hy - 4, hx + 4.2, hy - 0.6], 'iron', { bv: 1.4 }));
      out.push(K(hx - 4.2, hy - 0.8, hx + 4.2, hy - 0.8, 0.55, 0.55, 'bronze'));
      out.push(K(hx + 1.3, hy - 0.8, hx + 1.3, hy + 1.8, 0.45, 0.4, 'iron', { occ: false }));
    } else {
      // bare-headed: a cap of hair swept back
      out.push(P([hx - 4.3, hy - 0.2, hx - 3.8, hy - 3.4, hx - 0.6, hy - 4.9, hx + 2.8, hy - 4.2, hx + 4, hy - 2.4, hx + 1.4, hy - 2.6, hx - 1.4, hy - 2], hair, { bv: 1.1 }));
    }
    out.push(X(hx + 0.1, hy + 0.3, 0.9, 1, '#1d1416'), X(hx + 2.4, hy + 0.3, 0.9, 1, '#1d1416'));
    if (!fem && armor !== 'light') out.push(P([hx - 1.2, hy + 2.4, hx + 3.4, hy + 2.4, hx + 2.6, hy + 4.6, hx + 0.6, hy + 5], hair)); // beard
    if (!fem && armor === 'light') out.push(P([hx - 0.4, hy + 2.6, hx + 3.6, hy + 2.4, hx + 2.6, hy + 4.4, hx + 0.8, hy + 4.6], hair));
    if (fem) out.push(X(hx + 1.2, hy + 2.6, 1.4, 0.5, 'skin:2'));
  }

  // shield on the back arm (drawn over the body, it faces us)
  if (off === 'round') {
    out.push(E(10.4, ty + 1.4, 4.6, 5.4, 'wood', { fl: 0.65 }));
    out.push(K(10.4, ty - 3.8, 10.4, ty + 6.6, 0.55, 0.55, 'woolRed', { fl: 0.6 }));
    out.push(K(6, ty + 1.4, 14.8, ty + 1.4, 0.55, 0.55, 'woolRed', { fl: 0.6 }));
    out.push(E(10.4, ty + 1.4, 1.4, 1.4, 'iron'));
  } else if (off === 'tower') {
    // a tall iron-faced board, rimmed in bronze: the tower silhouette reads from across the room
    out.push(P([6.2, ty - 6, 14.4, ty - 6, 14.6, ty + 6.4, 10.4, ty + 9, 6, ty + 6.4], 'iron', { bv: 1.3, n: [0.05, -0.05, 1] }));
    out.push(K(6.4, ty - 5.8, 14.2, ty - 5.8, 0.5, 0.5, 'bronze', { occ: false }));
    out.push(K(10.4, ty - 5.2, 10.4, ty + 8, 0.45, 0.45, 'bronze', { occ: false }));
    out.push(E(10.4, ty + 0.6, 1.3, 1.3, 'bronze'));
  }

  // weapon arm and weapon
  if (wk === 'bow') {
    // a recurve bow in the back hand, the string drawn by the front
    const bx = 9.6;
    out.push(K(bx + 1.4, ty - 9, bx - 0.4, ty - 3, 0.6, 0.7, 'wood'), K(bx - 0.4, ty - 3, bx - 0.4, ty + 3, 0.75, 0.75, 'woodDark'), K(bx - 0.4, ty + 3, bx + 1.4, ty + 9, 0.7, 0.6, 'wood'));
    out.push(K(bx + 1.6, ty - 9, bx + 1.6, ty + 9, 0.18, 0.18, 'linen', { occ: false, ol: false }));
    out.push(E(bx - 0.2, ty, 1.2, 1.2, 'skin'));
    out.push(K(20, ty - 3.4, 21.6, ty + 2.6, 1.3, 1.1, sleeve));
    out.push(E(21.6, ty + 3, 1.2, 1.2, 'skin'));
    // quiver
    out.push(K(19.6, ty - 6.8, 22.4, ty + 0.4, 1.2, 1.1, 'leatherDark'));
    out.push(X(19.8, ty - 8.4, 0.6, 1.6, 'linen:4'), X(21, ty - 8.8, 0.6, 1.6, 'linen:4'));
  } else {
    const hxw = wk === 'staff' ? 21.4 : 21.8;
    const hyw = ty + 2.8;
    out.push(K(20, ty - 3.4, hxw, hyw - 0.8, 1.35, 1.15, sleeve));
    out.push(weapon(wk, hxw + 0.2, hyw, f));
    out.push(E(hxw + 0.1, hyw - 0.2, 1.25, 1.25, armor === 'heavy' ? 'iron' : 'skin'));
  }
  return out;
}
