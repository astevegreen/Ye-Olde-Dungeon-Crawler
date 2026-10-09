import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { limb, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/**
 * A beautiful woman from the front; from behind, a hollow log and a cow's tail. The 3/4 view
 * turns her back toward us so both show. The old one (`old`) has gone mostly to bark: hunched,
 * twig crown, root hem.
 */
function huldra(f: number, v: FamilyVariant): PrimTree {
  const old = v.kind === 'old';
  const b = breath(f);
  const sw = sway(f);
  const skin = old ? 'mon2_oldSkin' : 'mon2_hSkin';
  const hair = old ? 'mon2_oldHair' : 'mon2_hHair';
  const gown = old ? 'mon2_barkGown' : 'mon2_moss';
  const ln = old ? 1.5 : 0; // hunch: everything above the hips leans forward
  const hx = 17.2 + ln * 1.2;
  const hy = 6.4 + ln * 1.3 + b * 0.3;
  const out: Out = [Sh(15.4, 28.6, 7.6, 2.2)];

  // the cow's tail, out from under the back of the gown; the tuft flicks
  const tx = sw * 0.45;
  if (old) {
    out.push(limb([12.2, 18.8, 8.8, 19.6, 6, 22.2, 4.4 + tx, 25.4], 0.9, 0.45, 'bark'));
    out.push(E(4.2 + tx, 26.4, 1.4, 1.9, 'mon2_lichen', { a: 0.25 }));
    out.push(K(4.2 + tx, 25.6, 2.8 + tx, 27.2, 0.35, 0.2, 'mon2_lichen'));
  } else {
    out.push(limb([12.4, 18.6, 9.2, 19.8, 6.8, 22.6, 5.8 + tx * 0.6, 25.4], 0.8, 0.5, 'mon2_tail'));
    out.push(E(5.6 + tx, 26.5, 1.3, 1.95, 'hairDark', { a: 0.2 }));
  }

  // gown: long, the hem trailing behind; the old one's turns to bark and roots
  out.push(P([13.2 + ln * 0.5, 14.2, 19.2 + ln * 0.6, 14.2, 20.6, 21, 22.2, 28.2, 16, 28.9, 9.6, 28.4, 11.4, 21.2], gown, { bv: 1.3 }));
  if (old) {
    out.push(K(10.4, 28, 7, 28.7, 0.7, 0.2, 'bark'), K(21.2, 28.1, 24.8, 28.8, 0.7, 0.2, 'bark'), K(14, 28.6, 12.4, 29.6, 0.6, 0.2, 'bark'));
    out.push(E(18.4, 25.4, 1.6, 1, 'mon2_lichen'), E(12.4, 22.6, 1.2, 0.8, 'mon2_lichen'));
  } else {
    out.push(K(11.2, 27.6, 21.8, 27.6, 0.45, 0.45, 'woolGreen', { ink: -0.05 }));
  }

  // torso: bare shoulders over a laced bodice
  const tx0 = 16.4 + ln * 0.8;
  out.push(E(tx0, 11.8 + ln * 0.8, 2.9, 3.2, skin, { a: ln * 0.15 }));
  out.push(E(tx0 - 0.2, 13.6 + ln * 0.6, 3.1, 2.6, gown, { fl: 0.1 }));

  // the hollow back: bark rim, rotten dark inside, a shelf of fungus
  const bx = 12.8 + ln * 0.3;
  out.push(E(bx, 16.6, old ? 3.3 : 2.9, old ? 6.8 : 6, 'mon2_rim', { fl: 0.2 }));
  out.push(E(bx - 0.5, 17, old ? 2.2 : 1.8, old ? 5.4 : 4.6, 'mon2_hollow', { fl: 1.7 }));
  out.push(E(bx - 0.9, 17.4, old ? 1.3 : 1, old ? 4.2 : 3.4, 'mon2_hollow', { fl: 1.8, ink: -0.22, occ: false }));
  out.push(E(bx - 0.4, 21, old ? 1.4 : 1.1, 0.6, 'mon2_lichen'));
  out.push(E(bx + 2, 19.8, 1.2, 0.5, 'mon2_fungus', { fl: 0.3 }), E(bx + 1.8, 14.8, 0.9, 0.4, 'mon2_fungus', { fl: 0.3 }));
  if (old) out.push(E(bx + 1.9, 12, 1, 0.45, 'mon2_fungus', { fl: 0.3 }));

  // long hair down the back, parted over the near shoulder above the hollow
  out.push(K(hx - 2.2, hy + 0.4, 13.6 + ln * 0.5, 11.6, 2.3, 1.3, hair));
  out.push(K(13.6 + ln * 0.5, 11.4, 12.4 + ln * 0.5, 12.6 + sw * 0.2, 1.3, 0.5, hair));
  // neck
  out.push(K(hx - 0.3, hy + 2.2, tx0 + 0.3, 9.8 + ln, 0.95, 0.95, skin));

  // head: hair mass behind, face toward us
  out.push(E(hx - 1.1, hy - 0.5, 3.2, 3.3, hair));
  out.push(E(hx + 0.4, hy + 0.4, 2.4, 2.8, skin, { fl: 0.2 }));
  out.push(P([hx - 1.8, hy - 3.2, hx + 2.6, hy - 2.7, hx + 2.9, hy - 1.3, hx + 0.6, hy - 1.7, hx - 0.6, hy + 0.6], hair));
  out.push(X(hx + 0.7, hy + 0.1, 0.9, 0.8, 'eyeAmber:3'), X(hx + 2.1, hy + 0.05, 0.7, 0.8, 'eyeAmber:3'));
  if (old) {
    // a long bark nose, a twig crown: the antler shape of her silhouette
    out.push(K(hx + 2.2, hy + 0.6, hx + 3.6, hy + 2, 0.55, 0.3, skin));
    out.push(limb([hx - 1, hy - 2.6, hx - 2.6, hy - 5.6, hx - 4.6, hy - 6.8], 0.6, 0.25, 'bark'));
    out.push(K(hx - 2.4, hy - 5.2, hx - 1.6, hy - 7.4, 0.35, 0.15, 'bark'), K(hx - 3.6, hy - 6.2, hx - 4.6, hy - 4.6, 0.3, 0.15, 'bark'));
    out.push(limb([hx + 0.4, hy - 2.8, hx + 0.6, hy - 5.8, hx + 2, hy - 7.4], 0.5, 0.2, 'bark'));
    out.push(E(hx - 1.8, hy - 2.6, 1.1, 0.6, 'mon2_lichen'));
  } else {
    out.push(X(hx + 1.4, hy + 2, 0.9, 0.45, 'skin:2'));
    out.push(X(hx - 2.4, hy - 2.4, 0.9, 0.9, 'mon2_flower:4'), X(hx - 0.8, hy - 3.3, 0.8, 0.8, 'mon2_flower:4'), X(hx - 3.2, hy - 0.6, 0.8, 0.8, 'mon2_flower:3'));
  }

  // the beckoning arm
  const ax = 18.2 + ln * 1.4;
  const ay = 10.8 + ln * 0.9;
  const bk = sw * 0.35;
  const arm = old ? 'bark' : skin;
  out.push(K(ax, ay, ax + 2.4, ay + 3.6, 0.95, 0.75, arm));
  out.push(K(ax + 2.4, ay + 3.6, ax + 4.6, ay + 1.4 + bk, 0.75, 0.6, arm));
  if (old) {
    // twig fingers, reaching
    out.push(K(ax + 4.6, ay + 1.4 + bk, ax + 7, ay + 0.2 + bk, 0.35, 0.12, 'bark'), K(ax + 4.6, ay + 1.4 + bk, ax + 6.8, ay + 1.8 + bk, 0.35, 0.12, 'bark'), K(ax + 4.6, ay + 1.4 + bk, ax + 5.6, ay - 0.8 + bk, 0.3, 0.12, 'bark'));
  } else {
    out.push(E(ax + 5, ay + 0.8 + bk, 0.85, 1, skin));
    out.push(K(ax + 5.4, ay + 0.2 + bk, ax + 6, ay - 0.8 + bk * 1.6, 0.3, 0.25, skin));
  }
  return out;
}

/** The fetch that walks ahead of a doomed man: a translucent white stag whose legs fade into mist, crowned with faintly golden antlers. */
function fylgja(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const m = 'mon2_fetch';
  const fade = 'mon2_fetchFade';
  const gold = 'mon2_fetchGold';
  const ant = 'mon2_antler';
  const out: Out = [Sh(14.6, 28.6, 8.6, 2, 0.2)];
  const ms = sw * 0.3;
  // a short flagged tail, and pale motes of the fetch drifting off behind
  out.push(K(8.6, 14.8, 6.8, 13.6 - ms, 0.9, 0.5, m));
  const mt = [[5, 15.6], [3.4, 13.6], [2.2, 17.2], [4.4, 19]];
  for (let i = 0; i < 3; i++) {
    const p = mt[(i + f) % 4];
    out.push(X(p[0] - i * 0.3, p[1] - f * 0.2, i ? 0.5 : 0.7, i ? 0.5 : 0.7, '#e6eef4', { em: true }));
  }
  // far legs: slender, fading below the knee
  out.push(K(18.8, 18.6, 19.6, 22.8, 0.95, 0.7, m, { ink: -0.1 }), K(19.6, 22.8, 19.2, 28, 0.6, 0.35, fade, { ink: -0.1 }));
  out.push(K(10.6, 18.4, 10.8, 22.6, 1.1, 0.7, m, { ink: -0.1 }), K(10.8, 22.6, 11.4, 28, 0.6, 0.35, fade, { ink: -0.1 }));
  // far antler, spreading forward
  const ah = b * 0.15;
  const ay = ah;
  out.push(limb([23.4, 6.6 + ay, 24.2, 4 + ay, 25.6, 2.6 + ay, 27.6, 2.2 + ay], 0.5, 0.25, ant, { ink: -0.14 }));
  out.push(K(24.3, 4.2 + ay, 23.8, 1.4 + ay, 0.3, 0.14, ant, { ink: -0.14 }), K(25.8, 2.8 + ay, 26.6, 1.4 + ay, 0.28, 0.12, ant, { ink: -0.14 }));
  // body: deep chest, light rump, a white flag of a tail
  out.push(K(7.6, 13.4, 6.6, 11.8, 0.8, 0.45, m));
  out.push(E(9.2, 15.6, 3.2, 3.3, m));
  out.push(E(13.8, 15.8 + b * 0.2, 5.8, 3.4, m));
  out.push(E(18.6, 15.8 + b * 0.2, 3.3, 3.9, m));
  // near legs: a knee forward, a hock back
  out.push(K(20, 18.4, 20.8, 22.8, 1, 0.7, m), K(20.8, 22.8, 20.6, 28, 0.6, 0.35, fade));
  out.push(K(8.8, 17.6, 7.6, 22.4, 1.2, 0.7, m), K(7.6, 22.4, 8.6, 28, 0.6, 0.35, fade));
  out.push(X(19.8, 27.6, 1.4, 0.6, `${gold}:2`), X(7.8, 27.6, 1.4, 0.6, `${gold}:2`));
  // neck, head, ears
  out.push(K(19, 14, 22.6, 9.6 + ah, 2.3, 1.5, m));
  out.push(P([21.6, 8.2 + ah, 18.8, 7.6 + ah, 19.6, 8.8 + ah, 21.6, 9.4 + ah], m, { ink: -0.06 }));
  out.push(E(23, 8.6 + ah, 2, 1.7, m, { a: 0.4 }));
  out.push(K(23.6, 9 + ah, 26.2, 11.2 + ah, 1.25, 0.7, m));
  out.push(X(23.4, 8.3 + ah, 0.8, 0.6, `${gold}:4`));
  // near antler: the wide crown is the fetch's one shape. Its two top tines lean back, and
  // the far one is shorter, so no tip touches the cell's top row
  out.push(limb([22.4, 7 + ay, 21.8, 4.4 + ay, 20.2, 2.6 + ay, 17.8, 1.8 + ay, 16, 2.6 + ay], 0.62, 0.25, ant));
  out.push(K(22.2, 6 + ay, 24.4, 4.8 + ay, 0.36, 0.14, ant), K(21.4, 3.8 + ay, 22.6, 1.6 + ay, 0.34, 0.13, ant), K(19.6, 2.4 + ay, 18.4, 1.4 + ay, 0.3, 0.12, ant));
  const tw = [[24.6, 4.6], [22.6, 1.6], [18.4, 1.4], [15.8, 2.6], [23.8, 1.4], [26.6, 1.4], [27.8, 2.1]];
  for (let i = 0; i < 3; i++) {
    const t = tw[(i * 2 + f) % tw.length];
    out.push(X(t[0] - 0.3, t[1] - 0.3 + ay, 0.7, 0.7, `${gold}:4`));
  }
  out.push(Lt(21.6, 3.4, 8, '#ffe3a0', 0.7));
  return out;
}

/** The fiddler of the falls, seated on a wet stone in his own pool. He never moves; only the bow does. */
function nacken(f: number): PrimTree {
  const sw = sway(f);
  const b = breath(f);
  const sk = 'mon2_nSkin';
  const hr = 'mon2_wetHair';
  const out: Out = [Sh(16, 28.6, 10, 2, 0.3)];
  out.push(E(16, 28.2, 12.6, 2.6, 'mon2_water', { fl: 0.85 }));
  out.push(E(14.6, 25, 7.8, 4.4, 'mon2_rockWet', { fl: 0.2 }));
  out.push(E(8.8, 26.8, 3.4, 2.2, 'mon2_rockWet'));
  // far leg
  out.push(K(13.4, 20.4, 17.4, 20.6, 1.6, 1.4, sk, { ink: -0.1 }), K(17.4, 20.8, 17.2, 26.8, 1.3, 1, sk, { ink: -0.1 }), E(17.8, 27.4, 1.4, 0.8, sk, { ink: -0.1 }));
  // hair down the back
  out.push(K(14.2, 8.8, 12.2, 16.6 + b * 0.2, 2.5, 1.2, hr));
  // torso, leaning into the fiddle
  out.push(E(14.4, 15.6 + b * 0.15, 3.4, 4.8, sk, { a: 0.12 }));
  // near leg
  out.push(K(13.8, 21, 19.2, 21.2, 1.8, 1.5, sk), K(19.2, 21.4, 20, 27, 1.4, 1.1, sk), E(20.8, 27.6, 1.6, 0.8, sk));
  // far arm along the fiddle neck
  out.push(K(16.4, 12.2, 19.8, 16, 0.95, 0.8, sk, { ink: -0.08 }), K(19.8, 16, 22.4, 15.2, 0.8, 0.7, sk, { ink: -0.08 }));
  // head tilted onto the fiddle
  out.push(E(15.6, 8.4, 2.9, 2.7, hr));
  out.push(E(16.6, 9.4, 2.5, 2.8, sk, { a: 0.25 }));
  out.push(K(17.4, 7.2, 18.4, 12.2, 0.95, 0.45, hr));
  out.push(X(17.2, 9.2, 0.9, 0.6, '#d8f6ee', { em: true }));
  // fiddle under the chin, neck out to the far hand
  out.push(E(18.8, 12.6, 2.4, 1.6, 'mon2_fiddle', { a: 0.5 }), E(20.6, 13.7, 1.8, 1.25, 'mon2_fiddle', { a: 0.5 }));
  out.push(K(21.6, 14.4, 24.4, 15.9, 0.45, 0.4, 'woodDark'), E(24.8, 16.1, 0.75, 0.75, 'woodDark'));
  out.push(X(19.6, 12.6, 0.5, 1.2, 'linen:4'));
  out.push(E(22.6, 15.3, 0.75, 0.75, sk, { ink: -0.08 }));
  // bow arm: the bow slides across the strings frame by frame
  const d = 4.4 + sw * 1.1;
  const hx = 19.6 - 0.47 * d;
  const hy = 13.2 + 0.88 * d;
  out.push(K(13.4, 12.4, 12.8, 17.2, 1.05, 0.9, sk), K(12.8, 17.2, hx, hy, 0.9, 0.75, sk));
  out.push(K(hx, hy, hx + 0.47 * 12.5, hy - 0.88 * 12.5, 0.28, 0.2, 'woodDark'));
  out.push(K(hx + 0.4, hy, hx + 0.4 + 0.47 * 11.6, hy - 0.88 * 11.6 + 0.2, 0.15, 0.15, 'linen', { ol: false, occ: false }));
  out.push(E(hx, hy, 0.85, 0.85, sk));
  // river glints on the pool, a drip off the hair
  const G4 = [[6.4, 28.4], [24.6, 28.8], [27.4, 27.9], [10.8, 29.4], [21, 29.3]];
  for (let i = 0; i < 3; i++) {
    const g = G4[(i + f) % G4.length];
    out.push(X(g[0], g[1], 1.1, 0.35, '#e8fbff', { em: true }));
  }
  out.push(X(11.6, 18 + f * 0.9, 0.4, 0.6, '#cfeef6', { em: true, glow: false }));
  out.push(Lt(16, 29.4, 10, '#7fc8e0', 0.4));
  return out;
}

/**
 * The wild vættir: land-spirits that look like people or beasts until they turn. Kinds:
 * `huldra`, `old` (the hollow-back), `fylgja` (the fetch-stag) and `nacken` (the fiddler).
 */
export function huldraModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'fylgja': return fylgja(f);
    case 'nacken': return nacken(f);
    default: return huldra(f, v);
  }
}
