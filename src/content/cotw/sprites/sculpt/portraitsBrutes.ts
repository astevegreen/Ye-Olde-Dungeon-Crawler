import { E, K, P, X, Lt, breath, sway, hash2, type PrimTree } from './kit';
import { BAND, FULL, strand, type Out } from './portraitKit';
import './materials';

/* Wave 9e, group D: the brutes. The Cave Troll, the Ogre, the Orc. Conventions: portraitKit.ts. */

// ================================================================ CAVE TROLL
/**
 * The troll of the fells, as the folk tell it: a hump of a back grown over with moss and
 * young firs like a boulder on the hillside, a great drooping nose, small mean eyes, tusks
 * thrust up from an underslung jaw. It comes out only by night; it turns its face to the
 * moon in its cave mouth.
 */
export function caveTrollPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const o: Out = [];
  const BG = 'scr_gCaveTroll', SKY = 'scr_caveTrollSky', HI = 'scr_caveTrollHide', HD = 'scr_caveTrollHead', MO = 'scr_caveTrollMoss';
  const LI = 'scr_caveTrollLichen', TU = 'scr_caveTrollTusk', MW = 'scr_caveTrollMaw', FI = 'scr_caveTrollFir';
  // the cave, and its mouth at the upper left: the night sky, the moon
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(P([-1, -1, 66, -1, 60, 6, 52, 10, 44, 18, 36, 26, 26, 34, 14, 42, 4, 50, -1, 54], SKY, { ink: BAND[2] }));
  o.push(P([-1, -1, 42, -1, 37, 6, 29, 12, 20, 19, 11, 25, -1, 30], SKY, { ink: BAND[3] }));
  o.push(P([-1, -1, 22, -1, 18, 6, 10, 11, -1, 13], SKY, { ink: BAND[4] }));
  o.push(E(10, 7, 4.6, 4.6, 'scr_caveTrollMoon', { fl: 1, ink: -0.04 }));
  o.push(P([-1, 9, 6, 8.2, 14, 9.2, 20, 8.8, 17, 10.6, 7, 11.2, -1, 10.8], SKY, { ink: BAND[3] })); // a rag of cloud across it
  for (const [x, y, i] of [[28, 3, 0], [40, 2, 1], [23, 16, 2], [4, 34, 3], [33, 10, 1], [14, 28, 2]]) {
    const on = (f + i) % 4 === 0;
    o.push(X(x, y, on ? 1 : 0.7, on ? 1 : 0.7, 'scr_caveTrollMoon:' + (on ? 5 : 3), { em: true }));
  }
  // the rock lip of the mouth, craggy
  for (const [x, y, w] of [[60, 5, 3], [44, 17, 2.6], [26, 33, 3], [8, 47, 2.4]]) o.push(P([x - w, y + 2, x + w * 0.4, y - w, x + w, y + 2.4], BG, { ink: BAND[1] }));

  const by = -b * 0.5;
  // the hump: a mound of a back rising behind the head, mossed like a boulder on the fell
  o.push(E(76, 40, 30, 38, HI, { fl: 0.2, ink: -0.62 }));
  o.push(E(74, 19, 26, 13, MO, { fl: 0.2, ink: -0.52 }));
  for (const [x, y, rx, ry, k] of [[54, 22, 8, 6, -0.42], [62, 12, 9, 6, -0.42], [75, 7, 10, 6, -0.46], [88, 11, 9, 7, -0.52]]) o.push(E(x, y, rx, ry, MO, { fl: 0.2, ink: k }));
  for (const [x, y, r, k] of [[60, 18, 1.6, -0.34], [80, 12, 1.5, -0.42]]) o.push(E(x, y, r * 1.3, r * 0.8, LI, { fl: 0.4, ink: k })); // lichen
  // young firs rooted in the moss, black against the sky
  const fir = (x: number, y: number, h: number, lean: number): Out => {
    const out: Out = [K(x, y, x + lean * h, y - h, 0.7, 0.4, 'woodDark', { ink: -0.4 })];
    for (let i = 0; i < 3; i++) {
      const t = 0.2 + i * 0.26, cx = x + lean * h * t, cy = y - h * t, w = (1 - t) * h * 0.34 + 1;
      out.push(P([cx - w, cy + h * 0.14, cx + w, cy + h * 0.14, cx + lean * h * 0.12 + s * 0.15, cy - h * 0.3], FI, { ink: -0.2 }));
    }
    return out;
  };
  o.push(fir(60, 13, 12, -0.08), fir(77, 7, 7, 0.05), fir(90, 11, 7, 0.12));
  // the near shoulder at the right, the far one low at the left
  o.push(P([58, 97, 64, 84, 78, 74, 98, 68, 98, 97], HI, { bv: 5, fl: 0.2, ink: -0.48 }));
  o.push(P([-2, 97, -2, 84, 10, 80, 22, 88, 24, 97], HI, { bv: 4, fl: 0.2, ink: -0.58 }));

  // the head, slung low and turned toward the moon
  const hx = 54, hy = 54 + by;
  // the near ear, long, swept back
  o.push(P([hx + 22, hy - 12, hx + 30, hy - 18, hx + 40, hy - 26, hx + 36, hy - 14, hx + 30, hy - 4, hx + 24, hy], HD, { bv: 1.4, ink: -0.4 }));
  o.push(P([hx + 24, hy - 9, hx + 31, hy - 15, hx + 36, hy - 20, hx + 33, hy - 12, hx + 26, hy - 3], HD, { ink: -0.7 }));
  // the head in one mass, the face toward the left; jaw and chin thrust out under it
  o.push(P([hx - 10, hy - 30, hx - 20, hy - 24, hx - 23, hy - 18, hx - 22, hy - 12, hx - 18, hy - 4, hx - 16, hy + 6, hx - 18, hy + 16, hx - 24, hy + 22, hx - 28, hy + 28, hx - 24, hy + 34, hx - 10, hy + 38, hx + 12, hy + 36, hx + 24, hy + 26, hx + 29, hy + 8, hx + 27, hy - 12, hx + 20, hy - 26, hx + 8, hy - 32], HD, { bv: 6, fl: 0.1, ink: -0.08 }));
  o.push(E(hx - 2, hy + 31, 22, 8, HD, { fl: 0.3, ink: -0.42 })); // under the jaw
  o.push(E(hx - 22, hy + 29, 9, 7, HD, { fl: 0.2, ink: -0.06 })); // the chin
  o.push(E(hx + 9, hy + 6, 13, 12, HD, { ink: -0.38 })); // the near cheek
  // the side of the head turned from the moon, in shadow
  o.push(P([hx + 6, hy - 16, hx + 20, hy - 26, hx + 27, hy - 12, hx + 29, hy + 8, hx + 24, hy + 26, hx + 12, hy + 36, hx + 4, hy + 31, hx + 8, hy + 18, hx + 4, hy + 6], HD, { bv: 4, ink: -0.56 }));
  // moss over the crown, hanging in ragged tufts on the brow
  o.push(P([hx - 13, hy - 27, hx - 4, hy - 34, hx + 10, hy - 34, hx + 22, hy - 28, hx + 28, hy - 17, hx + 24, hy - 21, hx + 21, hy - 15, hx + 17, hy - 20, hx + 12, hy - 19, hx + 9, hy - 23, hx + 4, hy - 19, hx + 1, hy - 22, hx - 5, hy - 20, hx - 8, hy - 24, hx - 11, hy - 21, hx - 15, hy - 23], MO, { bv: 2, fl: 0.2, ink: -0.36 }));
  // a small eye deep under the brow
  o.push(E(hx - 3, hy - 9, 10, 5, HD, { fl: 0.7, ink: -0.46 })); // the socket, in the shadow of the brow
  o.push(E(hx - 2, hy - 9, 6, 3.4, HD, { fl: 0.85, ink: -0.76 })); // the small eye deep in it
  if (f === 3) {
    o.push(K(hx - 7, hy - 9.4, hx + 3.6, hy - 8.6, 1, 1, HD, { ink: -0.4 }));
  } else {
    o.push(E(hx - 1.4, hy - 8.6, 2.2, 1.5, 'eyeAmber'));
    o.push(X(hx - 2.2, hy - 9.4, 1.2, 1.4, '#1c1006'));
    o.push(X(hx - 3.6, hy - 9.6, 0.7, 0.7, '#fff4d0', { em: true }));
  }
  // the brow over it, shaggy with moss, drawn down toward the nose in a scowl
  o.push(P([hx - 14, hy - 10.4, hx - 11, hy - 14, hx - 4, hy - 17, hx + 5, hy - 18.4, hx + 13, hy - 18, hx + 12, hy - 15.4, hx + 9, hy - 13.2, hx + 7, hy - 15, hx + 4, hy - 12.4, hx + 1, hy - 14, hx - 3, hy - 11.8, hx - 6, hy - 13.4, hx - 9, hy - 10.6, hx - 11, hy - 12], MO, { bv: 1.2, fl: 0.3, ink: -0.22 }));
  // the mouth, wide at the front and pinched at the corner; the lower teeth; the lip thrust out under it
  o.push(P([hx - 28, hy + 16.6, hx - 14, hy + 17.6, hx - 2, hy + 18.6, hx + 10, hy + 17.6, hx + 18, hy + 16.4, hx + 12, hy + 20.6, hx, hy + 23, hx - 14, hy + 25, hx - 28, hy + 25], MW));
  for (const [x, w, h] of [[-19, 2, 2.2], [-11, 1.8, 1.8]]) o.push(P([hx + x - w, hy + 17.4, hx + x + w, hy + 17.6, hx + x + 0.4, hy + 17.6 + h], TU, { ink: -0.34 })); // upper teeth
  for (const [x, w, h] of [[-23, 2.6, 4.2], [-16, 2.4, 3.2], [-9, 2.6, 3.8], [-2, 2.2, 2.6], [4, 1.8, 2]]) {
    const y = hy + 25 - (x + 24) * 0.08;
    o.push(P([hx + x - w / 2, y, hx + x + w / 2, y, hx + x + w * 0.3, y - h, hx + x - w * 0.4, y - h + 0.6], TU, { ink: -0.2 }));
  }
  o.push(strand(hx - 32, hy + 24, hx - 8, hy + 30.6, hx + 18, hy + 18.6, 3, 1.6, HD, 5, { fl: 0.3, ink: -0.1 }));
  // tusks up from the jaw, curving
  o.push(P([hx - 33, hy + 26, hx - 29.4, hy + 26, hx - 29, hy + 18, hx - 30.6, hy + 12, hx - 32.6, hy + 18], TU, { bv: 0.8, ink: -0.14 }));
  o.push(P([hx - 10.4, hy + 26, hx - 5.6, hy + 25.4, hx - 5.2, hy + 16, hx - 6.6, hy + 9, hx - 8.6, hy + 4.6, hx - 9, hy + 10, hx - 10.2, hy + 16], TU, { bv: 0.9, ink: -0.06 }));
  // the great nose: a long lump of a thing growing from between the brows and sagging over the mouth
  o.push(P([hx - 22, hy - 15, hx - 15, hy - 12, hx - 13, hy - 2, hx - 15, hy + 8, hx - 20, hy + 15, hx - 26, hy + 17, hx - 32, hy + 14, hx - 40, hy + 6, hx - 34, hy - 4], HD, { bv: 3, fl: 0.1, ink: -0.02 }));
  o.push(E(hx - 38, hy + 11, 9.4, 9.2, HD, { fl: 0.25, ink: 0 }));
  o.push(P([hx - 15, hy + 2, hx - 14, hy + 9, hx - 20, hy + 15, hx - 27, hy + 17, hx - 30, hy + 14, hx - 22, hy + 11], HD, { bv: 1.4, fl: 0.3, ink: -0.4 })); // its underside, in shadow
  o.push(E(hx - 34, hy + 19.4, 3.6, 1.3, MW)); // the nostril, underneath
  // warts and pits on it, like a stone in a stream
  for (const [x, y, r, k] of [[-31, -3, 2.2, 0.02], [-43, 9, 1.6, 0], [-36, 3, 1.2, 0.02], [-24, -9, 1.2, 0]]) o.push(E(hx + x, hy + y, r, r * 0.85, HD, { fl: 0.3, ink: k }));
  for (const [x, y] of [[-40, 14], [-33, 9], [-27, 4]]) o.push(E(hx + x, hy + y, 1, 0.8, HD, { fl: 0.6, ink: -0.42 }));

  // the moon, through the cave mouth: cold on the hump's rim, the brow and the nose
  o.push(Lt(10, 22, 90, '#c8d8f4', 0.8, 10));
  return o;
}

// ===================================================================== OGRE
/**
 * A man-eater in the Dwarven Works: it has lit a dead forge to cook on. A small bald skull
 * over a pear of a face all jowl and jaw, tiny eyes, an underbite with two pegs of teeth;
 * the leather baldric it wears on the map, and its butcher's cleaver raised, old blood on
 * the edge. The forge's mouth at the lower left is its only light.
 */
export function ogrePortrait(f: number): PrimTree {
  const b = breath(f);
  const fl = [1, 1.12, 0.94, 1.06][f % 4]; // the coals breathe
  const o: Out = [];
  const BG = 'scr_gOgre', FG = 'scr_ogreForge', SK = 'scr_ogreSkin', ST = 'scr_ogreStrap', CL = 'scr_ogreCleaver', MW = 'scr_ogreMaw', TH = 'scr_ogreTooth', BL = 'scr_ogreBlood';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(54, 40, 50, 44, BG, { fl: 1, ink: BAND[2] }));
  // dwarven courses of stone behind it, and a chain with a meat-hook
  for (const y of [12, 26, 40]) o.push(P([-1, y, 97, y - 2, 97, y - 1, -1, y + 1], BG, { ink: BAND[1] }));
  o.push(K(30, -1, 31, 14, 0.7, 0.7, BG, { ink: BAND[3] }), strand(31, 14, 28, 20, 32, 22, 0.8, 0.6, BG, 3, { ink: BAND[3] }));
  // the forge's mouth at the lower left: an arch, the glow inside, coals
  o.push(P([-1, 97, -1, 58, 8, 52, 20, 52, 30, 60, 32, 97], BG, { ink: BAND[1] }));
  o.push(P([-1, 97, -1, 62, 8, 57, 19, 57, 26, 64, 27, 97], FG, { ink: BAND[1] }));
  o.push(P([-1, 97, -1, 68, 7, 63, 17, 63, 22, 70, 23, 97], FG, { ink: BAND[2] + (fl - 1) }));
  o.push(P([-1, 97, -1, 78, 8, 74, 16, 76, 18, 97], FG, { ink: BAND[3] + (fl - 1) }));
  for (const [x, y, r, m] of [[3, 90, 3.4, 'emFire'], [10, 92, 3, 'emFireCore'], [16, 91, 2.6, 'emFire'], [6, 86, 2, 'emFireCore']] as Array<[number, number, number, string]>) o.push(E(x, y, r, r * 0.7, m, { ink: -0.2 + (fl - 1) }));
  // sparks rising
  for (let i = 0; i < 4; i++) {
    const y = 80 - ((f * 6 + i * 13) % 40), x = 6 + i * 4 + Math.sin(y * 0.3 + i) * 2;
    o.push(X(x, y, 1, 1, i % 2 ? 'emFire:4' : 'emFireCore:4', { em: true }));
  }

  const by = -b * 0.5;
  const hx = 50, hy = 44 + by;
  // the shoulders, a yoke of fat and muscle rising nearly to the ears
  o.push(P([-2, 97, -2, 90, 8, 82, 20, 72, 32, 64, hx - 12, 59 + by, hx + 12, 59 + by, 70, 63, 84, 70, 98, 78, 98, 97], SK, { bv: 7, fl: 0.15, ink: -0.32 }));
  o.push(E(hx - 15, 62 + by, 13, 8, SK, { a: -0.45, fl: 0.2, ink: -0.24 }), E(hx + 15, 62 + by, 12, 8, SK, { a: 0.45, fl: 0.2, ink: -0.36 }));
  o.push(E(37, 95, 15, 8, SK, { fl: 0.2, ink: -0.34 }), E(63, 95, 14, 8, SK, { fl: 0.2, ink: -0.42 })); // the chest
  // the baldric across the chest, its iron buckle
  o.push(P([16, 76, 24, 70, 80, 99, 69, 99], ST, { bv: 0.8, ink: -0.2 }));
  o.push(E(46, 84, 3.4, 3, 'scr_ogreIron', { fl: 0.4 }), E(46, 84, 1.8, 1.5, ST, { ink: -0.4 }));

  // ears: small, pointed back
  o.push(P([hx - 15, hy - 6, hx - 22, hy - 13, hx - 23.4, hy - 4, hx - 17, hy + 1], SK, { bv: 1.2, ink: -0.08 }));
  o.push(E(hx - 18.6, hy - 4.6, 1.6, 2.4, SK, { ink: -0.5 }));
  o.push(E(hx - 18.4, hy + 1.2, 1.6, 1.6, 'scr_ogreIron', { fl: 0.2 }), E(hx - 18.4, hy + 1.2, 0.8, 0.8, BG, { ink: BAND[1] })); // an iron ring through the lobe
  o.push(P([hx + 15, hy - 6, hx + 21, hy - 12, hx + 22, hy - 4, hx + 16.4, hy + 1], SK, { bv: 1.2, ink: -0.3 }));
  // the pear: a small bald pate over jowls and jaw
  o.push(E(hx - 1, hy - 12, 12.6, 12.4, SK, { fl: 0.15, ink: -0.04 }));
  o.push(E(hx, hy + 3, 17, 14.6, SK, { fl: 0.2, ink: -0.1 }));
  o.push(E(hx + 0.6, hy + 13, 15.6, 8.6, SK, { fl: 0.2, ink: -0.16 }));
  o.push(E(hx + 1, hy + 20, 12, 4.6, SK, { fl: 0.3, ink: -0.34 }));
  // a low brow, knotted down at the middle
  o.push(K(hx - 12, hy - 7.6, hx - 1.6, hy - 4.2, 2.8, 2.2, SK, { fl: 0.3, ink: 0.04 }), K(hx + 1.6, hy - 4.2, hx + 11, hy - 7.6, 2.2, 2, SK, { fl: 0.3, ink: -0.06 }));
  o.push(K(hx - 0.8, hy - 10.4, hx - 0.2, hy - 6.4, 0.5, 0.4, SK, { ink: -0.42, occ: false }));
  // tiny eyes, sunk in fat
  o.push(E(hx - 6, hy - 2.2, 3, 2, SK, { fl: 0.85, ink: -0.64 }), E(hx + 6, hy - 2.2, 2.7, 1.9, SK, { fl: 0.85, ink: -0.66 }));
  if (f === 2) {
    o.push(K(hx - 8.6, hy - 2.2, hx - 3.4, hy - 1.8, 0.8, 0.8, SK, { ink: -0.14 }), K(hx + 3.6, hy - 1.8, hx + 8.4, hy - 2.2, 0.8, 0.8, SK, { ink: -0.2 }));
  } else {
    o.push(E(hx - 5.6, hy - 1.8, 1.4, 1, 'eyeAmber', { ink: -0.1 }), E(hx + 6.2, hy - 1.8, 1.2, 0.9, 'eyeAmber', { ink: -0.1 }));
    o.push(X(hx - 5.8, hy - 2.4, 0.7, 1.4, '#1a0e08'), X(hx + 6, hy - 2.4, 0.6, 1.3, '#1a0e08'));
  }
  // cheeks, a squashed nose
  o.push(E(hx - 10, hy + 5, 6.4, 5.4, SK, { fl: 0.25, ink: 0.02 }), E(hx + 10.6, hy + 4.6, 5.6, 5.2, SK, { fl: 0.25, ink: -0.1 }));
  o.push(K(hx - 0.4, hy - 3.4, hx + 1, hy + 2.6, 1.8, 2.8, SK, { ink: 0.06 }));
  o.push(E(hx + 0.8, hy + 4.4, 5.2, 3.2, SK, { fl: 0.2, ink: 0.02 }));
  o.push(E(hx - 1.6, hy + 5.8, 1.4, 0.9, MW), E(hx + 3.6, hy + 5.8, 1.3, 0.8, MW));
  // the underbite: a wide mouth, the lower lip thrust out, two pegs of teeth up over it
  o.push(P([hx - 11, hy + 9.6, hx - 4, hy + 8.8, hx + 4, hy + 9, hx + 11, hy + 9.4, hx + 9, hy + 13.2, hx, hy + 14.2, hx - 9, hy + 13.4], MW));
  for (const x of [-3.4, -1, 1.4, 3.8]) o.push(P([hx + x - 1, hy + 9, hx + x + 1, hy + 9, hx + x + 0.2, hy + 10.8], TH, { ink: -0.3 }));
  o.push(strand(hx - 11.6, hy + 13, hx, hy + 16.6, hx + 11.6, hy + 12.6, 1.9, 1.7, SK, 4, { ink: -0.04 }));
  o.push(P([hx - 9.2, hy + 13.4, hx - 6.6, hy + 13.4, hx - 7.4, hy + 7], TH, { bv: 0.5 }), P([hx + 6.6, hy + 13.2, hx + 9.2, hy + 13.2, hx + 8.2, hy + 7.2], TH, { bv: 0.5, ink: -0.08 }));

  // the cleaver arm, raised
  o.push(K(76, 72, 90, 56, 9, 7.6, SK, { fl: 0.2, ink: -0.3 }));
  o.push(E(90, 56, 7.6, 7.4, SK, { fl: 0.2, ink: -0.26 }));
  o.push(K(90, 56, 82, 36, 7.2, 5.8, SK, { fl: 0.2, ink: -0.2 }));
  o.push(K(78.4, 30, 79, 18, 1.6, 1.5, 'scr_ogreHandle'));
  o.push(E(81, 33, 6, 5.4, SK, { fl: 0.2, ink: -0.12 }));
  for (let i = 0; i < 3; i++) o.push(K(77, 30.6 + i * 2.6, 83.4, 30.6 + i * 2.6, 1.2, 1.2, SK, { ink: i % 2 ? -0.12 : -0.02 }));
  // the blade: a butcher's slab, a hole to hang it by, old blood on the edge
  o.push(P([77, 20, 78, 2, 95, 0, 95, 18], CL, { bv: 1.4, n: [0.15, -0.1, 1], ink: -0.12 }));
  o.push(E(81.6, 6, 1.8, 1.8, MW));
  o.push(K(94, 1, 94.4, 17.6, 0.6, 0.6, CL, { ink: 0.4, occ: false }));
  o.push(P([90.4, 3, 94.6, 2, 94.8, 11, 92.8, 8.6, 91.2, 6], BL, { ink: -0.08 }));
  o.push(K(93.8, 11, 93.8, 14.4, 0.6, 0.5, BL, { occ: false }));

  // the forge, low at the left: ember light up the jowls and the shoulder
  o.push(Lt(6, 86, 104, '#ff8a2c', 1.4 * fl, 12));
  return o;
}

// ====================================================================== ORC
/**
 * An orc warrior of the Rime Hollows, the first brute a hero meets: an iron cap riveted
 * low, its brow dipped to a point between the eyes; amber eyes, a notched ear, a black
 * braid; the jaw thrust out on two tusks. A mail coif, a wolfskin, iron pauldrons, the
 * bearded axe upright. A torch jammed in the ice lights its near side; the far side and
 * the eyes under the brim stay dark.
 */
export function orcPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const fl = [1, 1.14, 0.9, 1.06][f % 4];
  const o: Out = [];
  const BG = 'scr_gOrc', HA = 'scr_orcTorchHalo', IC = 'scr_orcIce', SK = 'scr_orcSkin', HE = 'scr_orcHelm', ML = 'scr_orcMail', HR = 'scr_orcHair';
  const TU = 'scr_orcTusk', MW = 'scr_orcMaw', AX = 'scr_orcAxe', HF = 'scr_orcHaft';
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(58, 52, 46, 48, BG, { fl: 1, ink: BAND[2] }));
  // the torch's warmth on the ice
  o.push(E(10, 18, 22, 20, HA, { fl: 1, ink: BAND[1] }), E(10, 18, 12, 11, HA, { fl: 1, ink: BAND[2] }));
  // icicles from the roof, and the ice wall at the right
  for (let i = 0; i < 9; i++) {
    const x = 3 + i * 11 + hash2(i, 41) * 4, w = 1.6 + hash2(i, 43) * 1.6, l = 6 + hash2(i, 47) * 12;
    o.push(P([x - w, -1, x + w, -1, x + w * 0.2, l], IC, { ink: BAND[2] + (i % 2) * 0.1 }));
  }
  o.push(P([74, -1, 97, -1, 97, 97, 90, 97, 88, 60, 80, 30], IC, { ink: BAND[1] }), P([86, 8, 97, 4, 97, 40, 92, 36], IC, { ink: BAND[2] }));
  // the torch, jammed in a crack of the ice
  o.push(P([0, 50, 5, 42, 8, 46, 3, 54], BG, { ink: BAND[1] }));
  o.push(K(4, 46, 9, 27, 1.5, 1.9, 'woodDark', { ink: -0.1 }));
  o.push(K(8, 30, 9.6, 25, 2.2, 2.4, 'scr_orcStrap', { ink: -0.1 }));
  const tf = [0, 1, -1, 0.5][f % 4];
  o.push(P([5, 26, 13, 26, 14 + tf * 0.4, 20, 12 + tf, 13, 10.6, 16, 9 - tf * 0.5, 7, 7.4, 15, 5.6 + tf * 0.3, 18], 'emFire', { ink: 0 }));
  o.push(P([7, 26, 11.6, 26, 11.6, 21, 10 + tf * 0.5, 16, 8, 21], 'emFireCore', { ink: 0 }));
  for (let i = 0; i < 3; i++) o.push(X(8 + i * 2 + Math.sin(f + i) * 1.4, 5 - ((f * 3 + i * 5) % 8), 1, 1, 'emFireCore:4', { em: true }));

  const by = -b * 0.5;
  const hx = 48, hy = 46 + by;
  // the braid, hanging behind the near ear
  o.push(strand(hx - 15, hy - 2, hx - 22, hy + 10, hx - 20 + s * 0.3, hy + 26, 2.2, 1.8, HR, 5, { ink: -0.2 }));
  for (let i = 1; i < 6; i++) { const t = i / 6, x = hx - 15 + (-7 + 2 * t) * t * 2 + s * 0.3 * t, y = hy - 2 + 28 * t; o.push(K(x - 1.8, y - 0.6, x + 1.4, y + 1, 0.6, 0.6, HR, { ink: 0.06, occ: false })); }
  o.push(E(hx - 20.6 + s * 0.3, hy + 22, 2.4, 1.6, HE, { fl: 0.3 }));
  // mail to the jaw, a wolfskin over the shoulders against the cold, iron pauldrons
  o.push(P([-2, 97, -2, 86, 12, 74, 30, 70, 66, 70, 84, 74, 98, 86, 98, 97], ML, { bv: 5, ink: -0.38 }));
  o.push(P([hx - 27, hy + 28, hx - 18, hy + 12, hx - 10, hy + 19, hx, hy + 23, hx + 10, hy + 19, hx + 18, hy + 12, hx + 27, hy + 28], ML, { bv: 3, ink: -0.4 }));
  o.push(P([8, 88, 12, 78, 17, 76, 20, 72, 25, 73, 28, 69, 33, 71, 37, 68, 42, 70, 47, 67.6, 52, 70, 57, 68, 62, 71, 67, 69, 71, 73, 76, 72, 80, 76, 85, 77, 89, 88, 70, 86, 64, 88.4, 58, 85.6, 52, 88, 46, 85.4, 40, 88.2, 34, 85.8, 28, 87.6], 'scr_orcFur', { bv: 2.4, fl: 0.2, ink: -0.2 }));
  o.push(P([-2, 90, 8, 86, 22, 85, 30, 90, 28, 98, -2, 98], HE, { bv: 2.4, fl: 0.3, ink: -0.36 }), P([-2, 80, 4, 74, 14, 71, 24, 73, 28, 79, 22, 84, 10, 86, -2, 88], HE, { bv: 3, fl: 0.3, ink: -0.22 }));
  o.push(P([98, 90, 88, 86, 74, 85, 66, 90, 68, 98, 98, 98], HE, { bv: 2.4, fl: 0.3, ink: -0.5 }), P([98, 80, 92, 74, 82, 71, 72, 73, 68, 79, 74, 84, 86, 86, 98, 88], HE, { bv: 3, fl: 0.3, ink: -0.4 }));
  for (const [x, y] of [[6, 77.6], [13, 74.6], [21, 75.6]]) o.push(X(x, y, 1, 1, 'scr_orcHelm:4'));
  // ears, short and swept back under the cap; the near one notched in some old fight
  o.push(P([hx - 15, hy - 2, hx - 20, hy - 5, hx - 24.6, hy - 9, hx - 22.4, hy - 2, hx - 19, hy + 3, hx - 15, hy + 5], SK, { bv: 1.4, ink: -0.3 }));
  o.push(P([hx - 16, hy, hx - 20, hy - 3, hx - 22.4, hy - 5.6, hx - 20.6, hy - 0.6, hx - 17, hy + 2.4], SK, { ink: -0.62 }));
  o.push(P([hx - 21.6, hy - 6.6, hx - 23.6, hy - 7.6, hx - 22.8, hy - 4.8], BG, { ink: BAND[2] }));
  o.push(P([hx + 15, hy - 2, hx + 20, hy - 5, hx + 24.4, hy - 8.6, hx + 22.2, hy - 2, hx + 19, hy + 2.6, hx + 15, hy + 4.6], SK, { bv: 1.4, ink: -0.5 }));
  // the skull and the heavy jaw, broad at the hinge; the far side of the face, from the torch, in shadow
  o.push(E(hx, hy - 4, 15.4, 14.6, SK, { fl: 0.15, ink: -0.2 }));
  o.push(P([hx - 15.4, hy - 1, hx - 18.2, hy + 10, hx - 17, hy + 18, hx - 10, hy + 24, hx, hy + 25.6, hx + 10, hy + 24, hx + 17, hy + 18, hx + 18.2, hy + 10, hx + 15.4, hy - 1], SK, { bv: 3.4, fl: 0.2, ink: -0.2 }));
  // the near half of the face takes the torchlight, the far half falls away into shadow
  o.push(P([hx - 15.4, hy - 2, hx - 1, hy - 2, hx + 1, hy + 8, hx, hy + 17, hx - 1, hy + 25.4, hx - 10, hy + 24, hx - 17, hy + 18, hx - 18.2, hy + 10], SK, { bv: 2, fl: 0.5, ink: 0.2 }));
  o.push(P([hx + 4, hy - 2, hx + 15.6, hy - 2, hx + 18.2, hy + 10, hx + 17, hy + 18, hx + 10, hy + 24, hx + 2, hy + 25.4, hx + 4, hy + 17, hx + 6, hy + 8], SK, { bv: 3, fl: 0.4, ink: -0.56 }));
  o.push(E(hx - 1, hy + 22.6, 6, 2.6, SK, { fl: 0.3, ink: -0.08 })); // the jutting chin
  o.push(E(hx - 12, hy + 13, 4, 5, SK, { fl: 0.7, ink: -0.3 })); // the hollow under the cheekbone
  o.push(K(hx - 16, hy + 5, hx - 6, hy + 7.4, 1.6, 1.1, SK, { fl: 0.3, ink: 0.14 })); // the near cheekbone, in the torchlight
  // the iron cap, riveted low, a ridge over the crown; its brim dipped to a point over the nose
  o.push(P([hx - 18, hy - 7, hx - 17, hy - 14, hx - 12.4, hy - 20, hx - 6, hy - 23.6, hx - 0.4, hy - 25, hx + 5.4, hy - 23.6, hx + 11.6, hy - 20, hx + 16.4, hy - 14, hx + 17.6, hy - 7], HE, { bv: 5, fl: 0.2, ink: -0.1 }));
  o.push(K(hx - 0.6, hy - 24.4, hx - 0.2, hy - 8, 0.8, 1, HE, { ink: 0.02 }));
  // under the brim the face falls into shadow; the eyes glint out of it
  o.push(P([hx - 16.6, hy - 6, hx + 16.6, hy - 6, hx + 15.4, hy + 1.6, hx + 6, hy + 4.6, hx, hy + 5.4, hx - 6, hy + 4.4, hx - 15.6, hy + 1.6], SK, { bv: 2, fl: 0.6, ink: -0.66 }));
  o.push(P([hx - 18, hy - 9, hx - 8, hy - 7.4, hx, hy - 4, hx + 8, hy - 7.4, hx + 17.8, hy - 9, hx + 17.6, hy - 5, hx + 8, hy - 3.6, hx + 1.2, hy + 2.4, hx - 1.2, hy + 2.4, hx - 8, hy - 3.6, hx - 17.6, hy - 5], HE, { bv: 1, ink: -0.04 }));
  for (const [x, y] of [[-13, -6.8], [-6.6, -5.4], [6.6, -5.4], [13, -6.8]]) o.push(X(hx + x - 0.5, hy + y - 0.5, 1, 1, 'scr_orcHelm:4'));
  // small amber eyes, glaring; the brows knotted in a snarl under the nasal
  o.push(E(hx - 7.4, hy + 1.4, 3.6, 2, SK, { fl: 0.85, ink: -0.74 }), E(hx + 7.4, hy + 1.2, 3.2, 1.8, SK, { fl: 0.85, ink: -0.8 }));
  if (f === 1) {
    o.push(K(hx - 9.8, hy + 1.6, hx - 5, hy + 1.8, 0.7, 0.7, SK, { ink: -0.36 }), K(hx + 5, hy + 1.4, hx + 9.6, hy + 1.2, 0.7, 0.7, SK, { ink: -0.5 }));
  } else {
    o.push(E(hx - 7, hy + 1.6, 1.8, 1, 'eyeAmber'), E(hx + 7.2, hy + 1.4, 1.6, 0.9, 'eyeAmber', { ink: -0.16 }));
    o.push(X(hx - 7.3, hy + 1, 0.9, 1.1, '#1a1006'), X(hx + 6.9, hy + 0.8, 0.9, 1.1, '#1a1006'));
    o.push(X(hx - 8.4, hy + 0.9, 0.6, 0.6, '#fff4d0', { em: true }));
  }
  o.push(K(hx - 3.4, hy + 2.4, hx - 1.8, hy + 4.6, 0.5, 0.5, SK, { ink: -0.7, occ: false }), K(hx + 3.4, hy + 2.4, hx + 1.8, hy + 4.6, 0.5, 0.5, SK, { ink: -0.74, occ: false }));
  o.push(K(hx - 12, hy - 2.4, hx - 10, hy + 0.4, 0.5, 0.5, SK, { ink: -0.1, occ: false }), K(hx - 6.6, hy + 4.4, hx - 4.6, hy + 9, 0.5, 0.5, SK, { ink: 0.1, occ: false })); // an old scar across the near eye
  // a broad flat snout, wrinkled back; the snarl lines beside it
  o.push(E(hx, hy + 7.6, 5, 3.2, SK, { fl: 0.3, ink: -0.04 }), E(hx + 2.6, hy + 8, 2.6, 2.8, SK, { fl: 0.4, ink: -0.4 }));
  o.push(E(hx - 2.4, hy + 9, 1.4, 1, MW), E(hx + 2.4, hy + 9, 1.4, 1, MW));
  o.push(K(hx - 6, hy + 5.4, hx - 9.4, hy + 14, 0.5, 0.5, SK, { ink: -0.46, occ: false }), K(hx + 6, hy + 5.4, hx + 9.4, hy + 14, 0.5, 0.5, SK, { ink: -0.7, occ: false }));
  // the snarl: the corners dragged down, the upper lip lifted off the fangs; the jaw thrust out on two tusks
  o.push(P([hx - 9, hy + 17.4, hx - 6.4, hy + 13.4, hx - 2.4, hy + 11.8, hx + 2.4, hy + 12, hx + 6.6, hy + 13.8, hx + 9, hy + 17.6, hx + 5, hy + 16.6, hx, hy + 16.4, hx - 5, hy + 16.6], MW));
  for (const [x, y, h, w] of [[-5.6, 13.6, 3, 1.1], [-2.4, 12.2, 1.6, 0.9], [0, 12.2, 1.6, 0.9], [2.4, 12.4, 1.6, 0.9], [5.6, 14, 2.6, 1]]) o.push(P([hx + x - w, hy + y, hx + x + w, hy + y, hx + x, hy + y + h], TU, { ink: x > 0 ? -0.36 : -0.14 }));
  for (const x of [-3.4, -1.1, 1.2, 3.4]) o.push(P([hx + x - 0.9, hy + 16.6, hx + x + 0.9, hy + 16.6, hx + x, hy + 15], TU, { ink: x > 0 ? -0.5 : -0.3 }));
  o.push(strand(hx - 9.6, hy + 17.4, hx, hy + 4.6, hx + 9.6, hy + 17.6, 0.9, 0.9, SK, 5, { ink: -0.06 }));
  o.push(strand(hx - 8.4, hy + 17.4, hx, hy + 17.4, hx + 8.4, hy + 17.6, 1.7, 1.5, SK, 4, { fl: 0.3, ink: -0.04 }));
  o.push(P([hx - 10.8, hy + 18, hx - 7.6, hy + 18, hx - 8.4, hy + 13, hx - 10.4, hy + 9, hx - 11.2, hy + 13], TU, { bv: 0.8, ink: -0.06 }));
  o.push(P([hx + 7.6, hy + 18, hx + 10.8, hy + 18, hx + 11.2, hy + 13, hx + 10.4, hy + 9.2, hx + 8.4, hy + 13], TU, { bv: 0.8, ink: -0.34 }));

  // the bearded axe, upright in its fist
  o.push(K(87, 99, 86, 6, 1.7, 1.5, HF));
  o.push(P([85, 4, 91, 3, 96, 1, 97, 12, 96, 26, 93, 33, 90, 25, 87, 17], AX, { bv: 1.4, n: [0.2, -0.1, 1] }));
  o.push(strand(96.4, 2, 97.6, 16, 93.6, 32, 0.6, 0.5, 'silver', 4, { occ: false }));
  o.push(K(85, 6, 87, 18, 1.6, 1.6, AX, { ink: -0.2 }));
  o.push(E(87, 86, 5.4, 6.2, SK, { fl: 0.2, ink: -0.2 }));
  for (let i = 0; i < 3; i++) o.push(K(82.6, 83 + i * 2.6, 90.6, 83.4 + i * 2.6, 1.2, 1.2, SK, { ink: i % 2 ? -0.24 : -0.14 }));

  // the torch, high at the left
  o.push(Lt(10, 16, 96, '#ff9a46', 1.3 * fl, 16));
  return o;
}
