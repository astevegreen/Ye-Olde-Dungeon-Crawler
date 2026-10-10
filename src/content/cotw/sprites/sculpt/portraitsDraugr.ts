import { E, K, P, X, Lt, breath, sway, hash2, type Prim, type PrimTree } from './kit';
import { BAND, FULL, qpt, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* The draugr and its kin (waves 9a and 9d, group C): the ancient draugr, the Warrior, the Pit-Draugr and the Coven Thrall. Conventions: portraitKit.ts. */

type Kin = 'ancient' | 'warrior' | 'pit' | 'thrall';

/** Frost rime crusting a shoulder, along a quadratic from (x0, y0) to (x1, y1). */
function crust(x0: number, y0: number, x1: number, y1: number, cy: number, sd: number): Prim[] {
  const out: Prim[] = [];
  for (let x = x0; x <= x1; x += 1.6) {
    const t = (x - x0) / (x1 - x0), y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * cy + t * t * y1, h = hash2(Math.round(x * 3), sd);
    if (h > 0.18) out.push(E(x, y + 0.6, 1.2 + h * 1.8, 0.9 + h * 1.1, 'scr_rime', { fl: 0.45, ink: (h - 0.5) * 0.2 }));
    if (h > 0.7) out.push(P([x - 0.7, y, x + 0.7, y, x + (h - 0.85) * 3, y - 1.6 - h * 2], 'scr_rime', { bv: 0.5 }));
  }
  return out;
}

/** Chain links along a quadratic a -> c (control b): rings face-on and edge-on in turn. */
function chain(a: Pt, b: Pt, c: Pt, n: number, r: number, m: string): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, [x, y, tx, ty] = qpt(a, b, c, t), an = Math.atan2(ty, tx), l = Math.hypot(tx, ty) / n;
    if (i % 2) out.push(K(x - Math.cos(an) * l * 0.48, y - Math.sin(an) * l * 0.48, x + Math.cos(an) * l * 0.48, y + Math.sin(an) * l * 0.48, r * 0.42, r * 0.42, m, { ink: -0.12 }));
    else {
      out.push(E(x, y, l * 0.62, r * 1.05, m, { a: an, fl: 0.4, ink: 0.04 }));
      out.push(E(x, y, l * 0.3, r * 0.42, 'scr_gum', { a: an }));
    }
  }
  return out;
}

/** A notched blade from the grip (gx, gy) to the tip (tx, ty). */
function notchedBlade(gx: number, gy: number, tx: number, ty: number, w0: number, notches: number[], m: string): Prim {
  const dx = tx - gx, dy = ty - gy, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const right: number[] = [], left: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * 0.9;
    let w = w0 * (1 - t * 0.5);
    if (notches.some((q) => Math.abs(t - q) < 0.02)) w -= 1.6;
    right.push(gx + dx * t + nx * w, gy + dy * t + ny * w);
    let wl = w0 * (1 - t * 0.5);
    if (Math.abs(t - 0.34) < 0.018) wl -= 1.2;
    left.unshift(gx + dx * t - nx * wl, gy + dy * t - ny * wl);
  }
  return P([...right, tx, ty, ...left], m, { bv: 1.8, n: [0.2, -0.1, 1] });
}

/**
 * The draugr and its kin: one model, four kinds. 'ancient' is the barrow-corpse
 * warrior in the moonbeam that falls through his broken mound. The others differ
 * from it as their map sprites do:
 * warrior: a pointed spangenhelm with a bronze nasal, the round shield on the
 *   arm, the notched blade leaning out, beard-wisps only, a grey shroud; in
 *   the barrow's stone passage, lit by his own eyes.
 * pit: the deep-lode miner, hunched and heavy: dust-grey skin and dust-brown
 *   mail flecked with ore, a round miner's cap, the pick on his shoulder
 *   calcified with rind, the dead lantern raised in his other fist; a vein of
 *   tarnished silver in the rock behind.
 * thrall: the coven's raised slave: bare-headed, lank hair, no beard; the
 *   thrall's iron neck-ring and a chain, bare ribs under rags, the troll-wives'
 *   death-rune daubed on its chest glowing up into its face; a manacled hand;
 *   snow falling on the night of the raid.
 */
function draugrKin(f: number, kind: Kin): PrimTree {
  const anc = kind === 'ancient', war = kind === 'warrior', pit = kind === 'pit', thr = kind === 'thrall';
  const b = breath(f), s = sway(f);
  const g = [1, 0.78, 1.22, 0.9][f % 4];
  const o: Out = [];
  const SK = pit ? 'scr_pitSkin' : 'scr_corpse', ML = pit ? 'scr_pitMail' : 'scr_rustMail', BR = pit ? 'scr_pitBeard' : 'scr_beard';
  const CL = war ? 'scr_warShroud' : pit ? 'scr_pitShroud' : 'scr_cloakDark';
  const BD = war ? 'scr_gDraugrWar' : pit ? 'scr_gPitDraugr' : thr ? 'scr_gThrall' : 'scr_gDraugr';
  const hd = pit ? 5 : thr ? 3 : war ? 1 : 0; // the head sits lower: the pit-draugr hunched, the thrall bowed
  o.push(P(FULL, BD, { ink: BAND[1] }));
  if (anc) {
    o.push(E(30, 22, 74, 68, BD, { fl: 1, ink: BAND[2] }));
    // the moonbeam, and dust turning in it
    o.push(P([4, 0, 36, 0, 90, 96, 56, 96], BD, { ink: BAND[3] }));
    o.push(P([12, 0, 26, 0, 80, 96, 66, 96], BD, { ink: BAND[3] + 0.1 }));
    for (let i = 0; i < 10; i++) {
      const y = (hash2(i, 23) * 96 + f * 1.4 * (1 + (i % 3))) % 96;
      const x = 20 + y * 0.56 + (hash2(i, 21) - 0.5) * 24;
      o.push(X(x, y, 0.6, 0.6, BD + ':' + (i % 3 ? 4 : 5), { em: true }));
    }
  } else if (war) {
    // the barrow's passage: courses of dry stone, the dark of the mound beyond
    // dry-stone courses: rough slabs, the joints dark between them
    for (let r = 0; r < 8; r++) {
      const y0 = r * 12.4 - 3, y1 = y0 + 11;
      let x = -8 + (r % 2) * 9 + hash2(r, 1) * 5;
      for (let c = 0; x < 100; c++) {
        const w = 13 + hash2(c, r + 7) * 10, ch = 2.2, j = (k: number): number => (hash2(c * 7 + k, r * 5) - 0.5) * 1.6;
        const x1 = x + w, d = Math.hypot(x + w / 2 - 54, ((y0 + y1) / 2 - 40) * 1.2);
        o.push(P([x + ch, y0 + j(1), x1 - ch, y0 + j(2), x1, y0 + ch, x1 + j(3) * 0.5, y1 - ch, x1 - ch, y1 + j(4) * 0.4, x + ch, y1, x, y1 - ch, x + j(5) * 0.5, y0 + ch], BD, { ink: (d < 36 ? BAND[2] + 0.08 : BAND[2] - 0.02) + hash2(r, c + 3) * 0.05 }));
        x = x1 + 1.2;
      }
    }
  } else if (pit) {
    // the rock in tilted strata; the tarnished silver vein runs between two of them, black with tarnish, the metal showing in specks
    for (const [y, ink] of [[-4, BAND[2] - 0.06], [18, BAND[2] + 0.02], [40, BAND[2] - 0.03], [62, BAND[2] + 0.02], [84, BAND[2] - 0.05]]) {
      o.push(P([-1, y + 22, 97, y - 18, 97, 97, -1, 97], BD, { ink }));
    }
    const vline = (x: number): number => 62 - x * (40 / 98), vw = (x: number): number => 2.2 + Math.sin(x * 0.21) * 1.1 + Math.sin(x * 0.57) * 0.5;
    const vtop: number[] = [], vbot: number[] = [];
    for (let x = -1; x <= 97; x += 7) { vtop.push(x, vline(x) - vw(x)); vbot.unshift(x, vline(x) + vw(x) * 0.6); }
    o.push(P([...vtop, ...vbot], 'scr_pitVein', { ink: -0.86 }));
    for (let x = 3; x < 97; x += 7) o.push(E(x + hash2(x, 3) * 3, vline(x) + 0.4, 1.4 + hash2(x, 5), 0.6, 'scr_pitVein', { fl: 0.6, ink: -0.8 + hash2(x, 7) * 0.06 }));
    for (const [i, x] of [[0, 6], [1, 15], [2, 27], [0, 38], [1, 47], [2, 81]]) o.push(X(x - 0.5, vline(x) - 1.1, 1, 1, 'scr_pitVein:' + (i === f % 3 ? 5 : 2), { em: true }));
    // the pit-props: a cap-beam overhead and a post at the right
    o.push(P([-1, 3, 97, 1, 97, 9, -1, 11], BD, { ink: BAND[3] - 0.02 }), P([-1, 9.6, 97, 7.6, 97, 9, -1, 11], BD, { ink: BAND[2] - 0.04 }));
    o.push(P([88, 8, 96, 8, 97, 97, 89, 97], BD, { ink: BAND[3] - 0.06 }), P([88, 8, 90, 8, 91, 97, 89, 97], BD, { ink: BAND[3] + 0.04 }));
  } else {
    // the night of the raid: the town's gables against the snow-cloud, snow falling
    o.push(E(50, 30, 66, 54, BD, { fl: 1, ink: BAND[2] }));
    o.push(E(48, 12, 92, 30, BD, { fl: 1, ink: BAND[3] - 0.04 })); // the snow-cloud's belly, paler than the roofs
    // two longhouse gables, their bargeboards crossed above the ridge, snow along the eaves
    for (const [cx, cy, w] of [[12, 34, 19], [84, 28, 17]]) {
      o.push(P([cx - w, cy + w * 1.05, cx, cy, cx + w, cy + w * 1.05, cx + w, 97, cx - w, 97], BD, { ink: BAND[1] - 0.04 }));
      o.push(K(cx - w - 1, cy + w * 1.1, cx + 3.4, cy - 3.6, 0.9, 0.9, BD, { ink: BAND[1] + 0.08 }), K(cx + w + 1, cy + w * 1.1, cx - 3.4, cy - 3.6, 0.9, 0.9, BD, { ink: BAND[1] + 0.08 }));
      o.push(K(cx - w, cy + w * 1.05 - 1.2, cx - 1, cy - 1, 0.8, 0.8, BD, { ink: BAND[4] }));
      o.push(P([cx - 2, cy + w * 0.9, cx + 2, cy + w * 0.9, cx + 2, cy + w * 0.9 + 3.6, cx - 2, cy + w * 0.9 + 3.6], BD, { ink: BAND[1] - 0.1 })); // a shuttered vent
    }
    for (let i = 0; i < 14; i++) {
      const y = (hash2(i, 51) * 96 + f * (1.6 + (i % 3) * 0.5)) % 96;
      const x = hash2(i, 53) * 96 + Math.sin(y * 0.15 + i) * 1.5;
      o.push(X(x, y, i % 4 ? 0.7 : 1, i % 4 ? 0.7 : 1, BD + ':' + (i % 3 ? 4 : 5), { em: true }));
    }
  }

  const by = -b * 0.45;
  if (thr) {
    // the bare chest: ribs under the skin, rags over the shoulder
    o.push(P([30, 74 + by, 68, 74 + by, 70, 97, 28, 97], SK, { bv: 6, n: [0, -0.1, 1], ink: -0.12 }));
    for (let i = 0; i < 4; i++) {
      const y = 80 + i * 4.6 + by * 0.6;
      o.push(strand(36 + i * 0.6, y - 1, 41, y + 1.8, 46, y + 0.2, 0.7, 0.5, SK, 3, { ink: -0.42, occ: false }));
      o.push(strand(62 - i * 0.6, y - 1, 57, y + 1.8, 52, y + 0.2, 0.7, 0.5, SK, 3, { ink: -0.46, occ: false }));
    }
    o.push(K(49, 77, 49, 97, 1.2, 1.4, SK, { ink: -0.36, occ: false })); // the sternum's hollow
    // the daubed rune: an upturned elk-sedge, death's mark
    const ri = (g - 1) * 0.4, rx = 49, ry = 84 + by * 0.6;
    o.push(K(rx, ry - 6, rx, ry + 6, 0.8, 0.9, 'scr_thrallHex', { ink: ri }));
    o.push(K(rx, ry - 0.6, rx + 4, ry + 5.4, 0.75, 0.8, 'scr_thrallHex', { ink: ri }), K(rx, ry - 0.6, rx - 4, ry + 5.4, 0.75, 0.8, 'scr_thrallHex', { ink: ri }));
    o.push(K(rx + 0.4, ry + 6, rx + 0.6, ry + 9 + (f % 2), 0.45, 0.3, 'scr_thrallHex', { ink: ri - 0.2 })); // a drip of it
    // the far shoulder, bare and bony
    o.push(P([60, 76 + by, 72, 74, 86, 77, 98, 84, 98, 97, 66, 97], SK, { bv: 6, n: [0, -0.15, 1], ink: -0.14 }));
    o.push(E(84, 81, 7, 5.4, SK, { fl: 0.3, ink: -0.08 })); // the point of it
    o.push(K(57, 75.4 + by, 80, 77.4, 1.2, 1, SK, { ink: 0.04 })); // the collarbone
    // a torn tunic hanging off the near shoulder, its hem ragged across the ribs
    const hem: number[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; hem.push(30 + t * 10 + (i % 2 ? 2.6 : -1.2), 72 + t * 25 + (i % 2 ? -1 : 1)); }
    o.push(P([-2, 97, -2, 82, 10, 76, 22, 72, ...hem, 36, 97], 'scr_thrallRag', { bv: 4, n: [0, -0.15, 1] }));
    o.push(K(6, 80, 4, 97, 0.8, 1.1, 'scr_thrallRag', { ink: -0.24 }), K(18, 76, 20, 97, 0.8, 1.1, 'scr_thrallRag', { ink: -0.24 })); // its folds
    o.push(K(30, 85, 26, 89, 1.6, 0.5, 'scr_thrallRag', { ink: -0.12 }), K(37, 95, 32, 97, 1.4, 0.5, 'scr_thrallRag', { ink: -0.12 })); // torn strips
  } else {
    // under the cloak: the hauberk at the chest
    o.push(P([34, 72 + by, 64, 72 + by, 62, 97, 36, 97], ML, { bv: 3 }));
    if (pit) {
      for (const [x, y] of [[41, 85], [45, 90], [56, 88], [52, 80], [38, 93]]) o.push(X(x, y, 1, 1, 'scr_pitOre:4'));
    } else {
      for (const [x, y, r] of [[42, 86, 1.4], [44, 88, 1], [55, 91, 1.2], [52, 80, 0.9]]) o.push(E(x, y, r * 1.4, r, 'scr_rust', { fl: 0.6 }));
    }
  }
  // withered neck, tendons standing out
  const nr = thr ? 0.8 : 1;
  o.push(K(51, 58 + hd + by, 49.5, 73 + by, 6.4 * nr, 7.6 * nr, SK, { ink: -0.08 }));
  o.push(K(53.5, 61 + hd + by, 52.8, 73 + by, 0.9, 1.1, SK, { ink: 0.1 }));
  o.push(K(47, 62 + hd + by, 46, 73 + by, 0.8, 1, SK, { ink: -0.26 }));
  if (thr) {
    // the thrall's iron neck-ring, a chain hanging from it
    o.push(strand(42, 66 + by, 50, 70.6 + by, 58, 66.4 + by, 1.7, 1.7, 'scr_thrallIron', 4, { ink: -0.04 }));
    o.push(E(50.6, 71.2 + by, 1.8, 1.6, 'scr_thrallIron', { ink: 0.1 }));
    o.push(chain([50.8, 72.6 + by], [52 + s * 0.3, 77 + by], [55 + s * 0.6, 83 + by], 4, 0.95, 'scr_thrallIron'));
  } else {
    o.push(strand(36, 78 + by, 49, 72 + by, 63, 78 + by, 4, 4, ML, 4)); // mail collar
    // a tattered cloak over the shoulders
    const sh = pit ? -7 : 0; // the pit-draugr's shoulders, heaped up round his neck
    o.push(P([-2, 97, -2, 84 + sh, 14, 77 + sh, 30, 74 + sh, 38, 74 + by + sh * 0.6, 41, 84, 37, 97], CL, { bv: 7, n: [0, -0.15, 1] }));
    o.push(P([60, 97, 58, 84, 61, 74 + by + sh * 0.6, 70, 75 + sh, 84, 79 + sh, 98, 86 + sh, 98, 97], CL, { bv: 7, n: [0, -0.15, 1] }));
    o.push(K(37, 82, 33, 97, 1, 1.4, CL, { ink: -0.22 }), K(62, 82, 66, 97, 1, 1.4, CL, { ink: -0.22 }));
    if (anc) {
      // a ring brooch pinning it
      o.push(E(64.5, 81, 2.8, 2.6, 'scr_bronzeOld', { fl: 0.5, ink: -0.08 }));
      o.push(K(61.6, 78.2, 67.6, 84.2, 0.55, 0.5, 'scr_bronzeOld', { ink: 0.06 }));
    }
  }
  // the back of the skull, and lank white hair falling from under the helm
  o.push(E(43, 45 + hd + by, 8.5, 10, SK, { fl: 0.2, ink: -0.2 }));
  o.push(P([36, 36 + hd + by, 44, 36 + hd + by, 43, 50 + hd, 39, 60 + hd + s * 0.3, 35, 56 + hd, 34, 44 + hd], BR, { bv: 2.4, ink: -0.22 }));
  o.push(strand(37, 52 + hd, 35 + s * 0.3, 60 + hd, 37.5 + s * 0.8, 67 + hd, 1, 0.3, BR, 4, { ink: -0.2 }));
  o.push(strand(41, 50 + hd, 41.5 + s * 0.3, 58 + hd, 40 + s * 0.8, 64 + hd, 0.8, 0.25, BR, 4, { ink: -0.3 }));
  if (war) {
    // the round shield on his arm: iron rim, planks, rusted straps, the bronze boss; rime on its top
    const sx = 18, sy = 80 + by * 0.5, srx = 19, sry = 20.5;
    o.push(E(sx, sy, srx, sry, 'scr_helm', { fl: 0.5 }));
    o.push(E(sx + 0.3, sy + 0.2, srx - 2.2, sry - 2.2, 'scr_warWood', { fl: 0.75 }));
    for (const px of [-11, -5.4, 0.2, 5.8, 11.4]) {
      const h = (sry - 2.4) * Math.sqrt(Math.max(0, 1 - (px / (srx - 2.2)) ** 2));
      o.push(K(sx + px, sy - h, sx + px, sy + h, 0.3, 0.3, 'scr_warWood', { ink: -0.42, occ: false }));
    }
    o.push(K(sx, sy - sry + 2.4, sx, sy + sry - 2.4, 1.5, 1.5, 'scr_rust', { fl: 0.4 }), K(sx - srx + 2.4, sy, sx + srx - 2.4, sy, 1.5, 1.5, 'scr_rust', { fl: 0.4 }));
    for (const [dx, dy] of [[0, -12], [0, 12], [-12, 0], [12, 0]]) o.push(E(sx + dx, sy + dy, 0.8, 0.8, 'scr_bronzeOld', { ink: 0.04 }));
    o.push(E(sx, sy, 5.6, 5.6, 'scr_bronzeOld', { fl: 0.1, ink: -0.06 }));
    o.push(E(sx - 0.4, sy - 0.4, 3.6, 3.6, 'scr_bronzeOld', { fl: 0.3, ink: 0.06 }));
    o.push(P([sx + 13, sy - 14.6, sx + 16.6, sy - 9.6, sx + 12.6, sy - 10.6], 'scr_gum')); // a hack in the rim
    o.push(crust(sx - 15, sy - 11.6, sx + 14, sy - 13.6, sy - 23.4, 13));
  }
  // skull and face
  const fx = 53.5, fy = 47.5 + hd + by;
  if (thr) {
    // no helm: the bare crown, the lank hair combed down over it
    o.push(E(fx - 2, fy - 8, 13.4, 12.4, SK, { fl: 0.2, ink: -0.04 }));
  }
  o.push(E(fx, fy, 12.6, 15.6, SK, { fl: 0.18 }));
  o.push(E(fx + 3, fy + 9.6, 9.4, 6.4, SK, { fl: 0.25 })); // lean jaw, jutting
  o.push(E(fx - 8.2, fy - 3, 3.4, 6, SK, { fl: 0.7, ink: -0.26 })); // sunken temple
  o.push(E(fx - 3.6, fy + 6.8, 4.8, 3.8, SK, { fl: 0.8, ink: -0.34 })); // hollow cheek
  o.push(E(fx - 3, fy + 2.6, 5.4, 1.7, SK, { fl: 0.35, ink: 0.16 })); // cheekbone
  o.push(E(fx + 8.8, fy + 5, 2.4, 3.4, SK, { fl: 0.5, ink: -0.2 })); // far cheek in shadow
  o.push(K(fx - 9, fy - 5.4, fx + 10.4, fy - 6, 2.4, 1.9, SK, { ink: 0.05 })); // brow ridge
  // deep sockets, the violet eyes
  const ey = fy - 1.6;
  o.push(E(fx - 3.6, ey, 4.4, 3.3, SK, { fl: 0.85, ink: -0.62 }));
  o.push(E(fx + 6.6, ey, 2.9, 2.9, SK, { fl: 0.85, ink: -0.62 }));
  const ei = (g - 1) * 0.4;
  o.push(E(fx - 3.3, ey + 0.3, 2, 1.35, 'emUnholy', { ink: ei }));
  o.push(E(fx + 6.8, ey + 0.3, 1.35, 1.2, 'emUnholy', { ink: ei }));
  o.push(X(fx - 4, ey - 0.3, 1.2, 1, '#f4ecff', { em: true }), X(fx + 6.4, ey - 0.3, 0.8, 0.9, '#f4ecff', { em: true }));
  o.push(Lt(fx + 1.5, ey + 1, anc ? 20 : war ? 26 : 22, '#a868ff', (thr ? 0.8 : 1.05) * g, 3.5));
  // a lipless grin
  o.push(P([fx - 3.4, fy + 8.6, fx + 9, fy + 7.8, fx + 8.4, fy + 11.2, fx - 2.8, fy + 11.8], 'scr_gum'));
  for (let i = 0; i < 7; i++) o.push(X(fx - 2.6 + i * 1.7, fy + 8.6 - i * 0.12, 1.2, 1.6, 'boneOld:' + (i < 2 ? 3 : 4)));
  for (let i = 0; i < 6; i++) o.push(X(fx - 1.8 + i * 1.7, fy + 10.2 - i * 0.12, 1.2, 1.3, 'boneOld:2'));
  o.push(X(fx + 2.2, fy + 4.4, 1.3, 1, 'scr_gum:0'), X(fx + 5.2, fy + 4.3, 1.1, 1, 'scr_gum:0')); // the nose: two dark pits
  if (anc) {
    // a matted beard, and wisps of it stirring
    o.push(P([fx - 6, fy + 10, fx + 2, fy + 12.6, fx + 9, fy + 10, fx + 7, fy + 17, fx + 3 + s * 0.4, fy + 24, fx - 1 + s * 0.4, fy + 21, fx - 5, fy + 16], 'scr_beard', { bv: 2.6, ink: -0.1 }));
    const wisps = [[-3.4, 15, -6, 21, -4.6, 27, 0.9], [1, 20, 0, 26, 2.4, 31, 0.8], [5, 18, 8, 22, 7.4, 28, 0.75]];
    for (const [x0, y0, x1, y1, x2, y2, r] of wisps) o.push(strand(fx + x0, fy + y0, fx + x1 + s * 0.4, fy + y1, fx + x2 + s, fy + y2, r, 0.25, 'scr_beard', 4, { ink: -0.04 }));
  } else if (!thr) {
    // only wisps of beard, hanging from the chin
    const wl = pit ? 0.7 : 1;
    const wisps = [[-3.6, 13.4, -5.6, 19, -5, 27, 0.75, -0.16], [0.4, 15, -0.6, 22, 1, 30, 0.8, -0.04], [3.4, 15.4, 4.4, 21, 3.6, 26, 0.55, 0], [6.6, 14.2, 8.6, 19, 8.2, 25, 0.65, -0.1], [-1.4, 14.6, -2.6, 19, -1.8, 23, 0.5, -0.22]];
    for (const [x0, y0, x1, y1, x2, y2, r, ink] of wisps) o.push(strand(fx + x0, fy + y0, fx + x1 + s * 0.4, fy + y0 + (y1 - y0) * wl, fx + x2 + s, fy + y0 + (y2 - y0) * wl, r, 0.2, BR, 4, { ink }));
  }
  const hcx = 51, hcy = 33.5 + hd + by, hrx = 16, hry = 19.5;
  const rim = (t: number) => qpt([hcx - hrx, hcy], [hcx + 1, hcy + 4.6], [hcx + hrx, hcy - 0.6], t);
  if (anc) {
    // helm: a tall, slightly peaked dome (upper half only), bronze rim, iron nasal
    const dome: number[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI, c = Math.cos(a);
      dome.push(hcx + c * hrx + (1 - Math.abs(c)) * 1.6, hcy + Math.sin(a) * hry * (1 + 0.12 * (1 - Math.abs(c))));
    }
    for (let i = 7; i >= 1; i--) { const [x, y] = rim(i / 8); dome.push(x, y); }
    o.push(P(dome, 'scr_helm', { bv: 9, n: [0, -0.12, 1] }));
    o.push(strand(hcx - 3, hcy - 21, hcx + 6, hcy - 12, fx + 4, hcy + 2.5, 1.2, 1.4, 'scr_helm', 4, { ink: 0.08 })); // the ridge
    for (const [x, y, r] of [[hcx - 9, hcy - 13, 1], [hcx - 12.5, hcy - 8.5, 0.8], [hcx - 4, hcy - 18, 0.7]]) o.push(E(x, y, r * 1.3, r, 'scr_rime', { fl: 0.5, ink: -0.18 })); // rime where the moon falls
    o.push(E(hcx + 9, hcy - 8, 1.6, 1.1, 'scr_rust', { fl: 0.6 }), E(hcx + 10.4, hcy - 5.8, 0.9, 0.8, 'scr_rust', { fl: 0.6 }));
    o.push(strand(hcx - hrx, hcy, hcx + 1, hcy + 4.6, hcx + hrx, hcy - 0.6, 2.1, 2.1, 'scr_bronzeOld', 6, { fl: 0.3 }));
    o.push(K(fx + 4, hcy + 2.4, fx + 4.3, fy + 4, 1.7, 1.25, 'scr_helm', { ink: 0.04 }));
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) { const [x, y] = rim(t); o.push(X(x - 0.5, y - 0.9, 1, 1, 'scr_bronzeOld:5')); }
  } else if (war) {
    // a pointed spangenhelm: iron plates on a bronze frame, a bronze nasal
    const Hh = 26, ax = hcx + 1.6, ay = hcy - Hh;
    const cone: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = -1 + i / 10, k = Math.pow(1 - Math.abs(u), 0.7);
      cone.push(hcx + u * hrx + (1 - Math.abs(u)) * 1.6, hcy - (u > 0 ? 0.6 * u : 0) - Hh * k);
    }
    for (let i = 7; i >= 1; i--) { const [x, y] = rim(i / 8); cone.push(x, y); }
    o.push(P(cone, 'scr_helm', { bv: 8, n: [0, -0.12, 1] }));
    for (const [t, bend] of [[0.2, -3], [0.52, 0.6], [0.84, 2.4]]) {
      const [x, y] = rim(t);
      o.push(strand(x, y - 1, (x + ax) / 2 + bend, (y + ay) / 2 - 1, ax, ay + 1, 1.2, 0.8, 'scr_bronzeOld', 4, { fl: 0.3, ink: -0.06 }));
      for (const k of [0.3, 0.62]) { const [rx2, ry2] = qpt([x, y - 1], [(x + ax) / 2 + bend, (y + ay) / 2 - 1], [ax, ay + 1], k); o.push(X(rx2 - 0.5, ry2 - 0.5, 1, 1, 'scr_bronzeOld:5')); }
    }
    for (const [x, y, r] of [[hcx - 8, hcy - 10, 1], [hcx - 11.5, hcy - 5.5, 0.8], [hcx - 3, hcy - 17, 0.7]]) o.push(E(x, y, r * 1.3, r, 'scr_rime', { fl: 0.5, ink: -0.18 }));
    o.push(E(hcx + 8, hcy - 9, 1.8, 1.2, 'scr_rust', { fl: 0.6 }), E(hcx + 11, hcy - 4.6, 1, 0.9, 'scr_rust', { fl: 0.6 }), E(hcx - 6, hcy - 3.4, 1.2, 0.9, 'scr_rust', { fl: 0.6 }));
    o.push(strand(hcx - hrx, hcy, hcx + 1, hcy + 4.6, hcx + hrx, hcy - 0.6, 2.3, 2.3, 'scr_bronzeOld', 6, { fl: 0.3 }));
    o.push(K(fx + 4, hcy + 2.4, fx + 4.2, fy + 1.6, 1.5, 1.1, 'scr_bronzeOld', { ink: -0.34 }));
    o.push(K(fx + 3.4, hcy + 3, fx + 3.6, fy + 0.6, 0.4, 0.4, 'scr_bronzeOld', { ink: 0.02, occ: false })); // its lit edge
    for (const t of [0.1, 0.3, 0.7, 0.9]) { const [x, y] = rim(t); o.push(X(x - 0.5, y - 0.9, 1, 1, 'scr_bronzeOld:5')); }
  } else if (pit) {
    // a miner's cap: a low iron bowl, dented, a bronze band, the dust of the lode on it
    const cap: number[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI, c = Math.cos(a);
      cap.push(hcx + c * (hrx + 1), hcy + Math.sin(a) * 15.5);
    }
    for (let i = 7; i >= 1; i--) { const [x, y] = rim(i / 8); cap.push(x, y); }
    o.push(P(cap, 'scr_pitHelm', { bv: 9, n: [0, -0.12, 1] }));
    o.push(E(hcx + 6, hcy - 10, 3.4, 2.2, 'scr_pitHelm', { fl: 0.7, ink: -0.3, a: 0.4 })); // a dent
    for (const [x, y, r] of [[hcx - 8, hcy - 10, 1.2], [hcx - 12.5, hcy - 4.6, 0.9]]) o.push(E(x, y, r * 2.2, r, 'scr_pitRind', { fl: 0.6, ink: -0.16, a: -0.4 }));
    o.push(strand(hcx - hrx - 1, hcy, hcx + 1, hcy + 4.6, hcx + hrx + 1, hcy - 0.6, 2.4, 2.4, 'scr_bronzeOld', 6, { fl: 0.3, ink: -0.08 }));
    for (const t of [0.15, 0.5, 0.85]) { const [x, y] = rim(t); o.push(X(x - 0.5, y - 0.9, 1, 1, 'scr_bronzeOld:5')); }
  } else {
    // lank hair from the crown, combed down over the bare skull
    o.push(E(fx - 6, fy - 13, 3.6, 2.4, SK, { fl: 0.6, ink: -0.18, a: -0.5 }), E(fx + 4, fy - 15, 2.4, 1.6, SK, { fl: 0.6, ink: -0.14 })); // blotches of the grave on the scalp
    for (const [x0, y0, x1, y1, x2, y2, r, ink] of [[49, -19.4, 39, -17, 34, -2, 1.1, -0.08], [51.6, -20, 44, -15, 38.6, 8, 0.9, 0], [54.4, -19.8, 47.6, -13, 43, 2, 0.75, -0.12], [47, -18.6, 37.6, -12, 36, 16, 0.9, -0.24],
      [57, -19.4, 62.4, -17, 65.4, -9, 0.75, -0.18], [55.6, -19.6, 58, -13, 56.4, -5.6, 0.6, -0.06]]) {
      o.push(strand(x0, fy + y0, x1 + s * 0.3, fy + y1, x2 + s * 0.6, fy + y2, r, 0.22, BR, 5, { ink }));
    }
  }

  if (thr) {
    // a manacled fist, holding a captive's chain taut off to the right
    const gx = 76, gy = 84 + by * 0.4;
    o.push(chain([gx + 0.6, 99], [gx + 1.2, gy + 2], [gx + 2, gy - 4], 6, 1.2, 'scr_thrallIron'));
    o.push(chain([gx + 2, gy - 4], [gx + 6, gy - 14 + s * 0.3], [99, gy - 17], 7, 1.2, 'scr_thrallIron'));
    o.push(K(gx - 15, 99, gx - 4, gy + 9, 5.2, 4, SK, { ink: -0.06 })); // the bare forearm
    o.push(K(gx - 12.4, gy + 15.4, gx - 6.6, gy + 11.6, 3.4, 3.4, 'scr_thrallIron', { fl: 0.25 })); // the manacle
    o.push(K(gx - 12.2, gy + 12.6, gx - 7.4, gy + 9.4, 0.5, 0.5, 'scr_thrallIron', { ink: 0.3, occ: false })); // its lit edge
    o.push(chain([gx - 9, gy + 16], [gx - 9 + s * 0.4, gy + 20], [gx - 8 + s * 0.8, 99], 4, 1, 'scr_thrallIron'));
    o.push(E(gx - 3.6, gy + 7.6, 3.4, 5, SK, { fl: 0.3, ink: -0.12 })); // back of the hand
    for (let i = 0; i < 4; i++) {
      const y = gy + 3.4 + i * 2.6, l = 4.6 - i * 0.3;
      o.push(K(gx - 4.2, y + 0.2, gx + l - i * 0.2, y - 0.4 + i * 0.1, 1.3, 1.2, SK, { ink: i % 2 ? -0.04 : 0.04 }));
      o.push(E(gx + l - i * 0.2 - 0.4, y - 0.4, 1.15, 1.1, SK, { ink: 0.14 }));
      o.push(K(gx + l - i * 0.2 + 0.2, y + 0.4, gx + l - i * 0.2 - 0.6, y + 1.6, 0.5, 0.25, 'boneOld', { ink: -0.14 })); // a long grave-nail
    }
    o.push(K(gx - 3.6, gy + 1.8, gx + 2.6, gy + 2.6, 1.2, 1, SK, { ink: 0.1 })); // thumb
    o.push(crust(0, 83, 30, 75 + by, 76, 1));
    o.push(Lt(49, 80, 44, '#8c84ff', 0.85 * g, 10));
    return o;
  }

  if (pit) {
    // the dead lantern, raised in the far fist: iron cap and cage, cold glass, no flame
    const lx = 16 + s * 0.3, ly = 60;
    o.push(K(-4, 98, 10, 66, 6.4, 5, ML, { ink: -0.06 })); // the sleeve
    o.push(K(10, 66, 15, 58.6, 3.4, 3, SK, { ink: -0.1 })); // the wrist
    o.push(K(lx, ly - 2, lx, ly + 2, 0.5, 0.5, 'iron'));
    o.push(P([lx - 3.4, ly + 2, lx + 3.4, ly + 2, lx + 5.2, ly + 5, lx - 5.2, ly + 5], 'iron', { bv: 1 }));
    o.push(E(lx, ly + 11.5, 5, 6.6, 'scr_pitGlass', { fl: 0.3 }));
    o.push(E(lx - 1.4, ly + 9.4, 1.6, 2.4, 'scr_pitGlass', { fl: 0.5, ink: 0.24 })); // the cold sheen
    o.push(E(lx + 0.6, ly + 14, 1.2, 1.6, 'scr_pitGlass', { fl: 0.6, ink: -0.3 })); // the burnt-out wick
    o.push(K(lx, ly + 5, lx, ly + 18, 0.6, 0.6, 'iron'), K(lx - 4.6, ly + 5.2, lx - 4.4, ly + 17.8, 0.55, 0.55, 'iron'), K(lx + 4.6, ly + 5.2, lx + 4.4, ly + 17.8, 0.55, 0.55, 'iron'));
    o.push(P([lx - 5.4, ly + 17.6, lx + 5.4, ly + 17.6, lx + 3.8, ly + 20.4, lx - 3.8, ly + 20.4], 'iron', { bv: 1 }));
    o.push(E(lx + 1.4, ly - 2.6, 3.4, 3, SK, { fl: 0.3, ink: -0.06 })); // the fist on its ring
    for (let i = 0; i < 3; i++) o.push(K(lx - 1.4, ly - 4.4 + i * 1.9, lx + 3.6, ly - 4 + i * 1.9, 1, 0.95, SK, { ink: i % 2 ? -0.06 : 0.04 }));
  }

  // the notched sword, rising from his fist (the warrior's leans out; the pit-draugr shoulders a pick)
  const gx = war ? 74 : 76, gy = war ? 86 : 84;
  const tx = war ? 94 : 87.5, ty = war ? 16 : 5;
  const dx = tx - gx, dy = ty - gy, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  if (pit) {
    // the pick: an ash haft, its iron head calcified with rind
    o.push(K(gx + 1, 99, gx + 4.6, 14, 2.1, 1.8, 'woodDark', { ink: -0.06 }));
    const pa: Pt = [58, 24], pc: Pt = [79, 2], pb: Pt = [99, 21];
    const top: number[] = [], bot: number[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, [x, y, tx2, ty2] = qpt(pa, pc, pb, t), l = Math.hypot(tx2, ty2), w = 0.4 + 3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7);
      top.push(x + (ty2 / l) * w, y - (tx2 / l) * w); bot.unshift(x - (ty2 / l) * w, y + (tx2 / l) * w);
    }
    o.push(P([...top, ...bot], 'scr_pitHelm', { bv: 2, n: [0.1, -0.2, 1] }));
    for (const [t, r] of [[0.2, 1.6], [0.33, 1.2], [0.62, 1.8], [0.76, 1.3]]) { const [x, y] = qpt(pa, pc, pb, t); o.push(E(x + hash2(r * 9, 3) - 0.5, y + 0.6, r * 1.4, r, 'scr_pitRind', { fl: 0.5, ink: -0.06 })); }
    o.push(K(gx + 3, 18, gx + 6.4, 9, 2.8, 2.6, 'iron', { ink: -0.1 })); // the eye of the head
    o.push(E(gx + 2.6, 40, 2.4, 1.6, 'scr_pitRind', { fl: 0.5, ink: -0.12 }), E(gx + 2.2, 52, 1.8, 1.2, 'scr_pitRind', { fl: 0.5, ink: -0.16 }));
  } else {
    o.push(notchedBlade(gx, gy, tx, ty, war ? 3.6 : 3.3, war ? [0.18, 0.4, 0.55, 0.7] : [0.22, 0.43, 0.6], 'scr_blade'));
    o.push(K(gx + dx * 0.04, gy + dy * 0.04, gx + dx * 0.66, gy + dy * 0.66, 0.8, 0.5, 'scr_blade', { ink: -0.32 })); // fuller
    for (const [t, w, r] of [[0.3, -1, 0.8], [0.315, -0.3, 0.5], [0.53, 0.9, 0.6], [0.12, 1.4, 0.55]]) o.push(E(gx + dx * t + nx * w, gy + dy * t + ny * w, r, r * 1.4, 'scr_rust', { fl: 0.7, a: 0.15 }));
    o.push(K(gx + dx * 0.7 - nx * 2.1, gy + dy * 0.7 - ny * 2.1, gx + dx * 0.85 - nx * 1.5, gy + dy * 0.85 - ny * 1.5, 0.45, 0.4, 'scr_blade', { ink: 0.5 })); // the moon on the edge
    o.push(K(gx - 8.5, gy + 1.8, gx + 8.5, gy - 1.6, 2, 1.7, war ? 'scr_bronzeOld' : 'scr_helm'));
  }
  // a mail sleeve, and a corpse's fist on the grip
  o.push(K(gx - 13, 99, gx - 4, gy + 10, 7.2, 5.2, ML));
  o.push(E(gx - 3.6, gy + 7.6, 3.4, 5, SK, { fl: 0.3, ink: -0.12 })); // back of the hand
  for (let i = 0; i < 4; i++) {
    const y = gy + 3.4 + i * 2.6, l = 4.6 - i * 0.3;
    o.push(K(gx - 4.2, y + 0.2, gx + l - i * 0.2, y - 0.4 + i * 0.1, 1.45, 1.35, SK, { ink: i % 2 ? -0.04 : 0.04 }));
    o.push(E(gx + l - i * 0.2 - 0.4, y - 0.4, 1.3, 1.25, SK, { ink: 0.14 }));
  }
  o.push(K(gx - 3.6, gy + 1.8, gx + 2.6, gy + 2.6, 1.3, 1.1, SK, { ink: 0.1 })); // thumb
  // frost rime crusting the cloak's shoulders
  if (war) o.push(crust(62, 75 + by, 96, 86.5, 76.5, 7));
  else if (pit) o.push(crust(28, 68 + by, 40, 71 + by, 66, 1), crust(62, 70 + by, 96, 79.5, 69.5, 7));
  else o.push(crust(0, 84.5, 36, 74.5 + by, 74.5, 1), crust(62, 75 + by, 96, 86.5, 76.5, 7));
  const gl = (war ? [[72, 75.6], [80, 77.4], [88, 81], [33, 61]] : pit ? [[70, 70.6], [80, 72.2], [36, 67.6], [90, 75.4]] : [[14, 77.4], [26, 74], [72, 75.6], [6, 80.4]])[f % 4];
  o.push(X(gl[0], gl[1] - 1.2, 1, 1, '#ffffff', { em: true }));
  if (anc) {
    // cold moonlight from above-left
    o.push(Lt(4, -6, 100, '#9cc4ff', 0.5, 34));
  } else if (war) {
    o.push(Lt(4, -6, 90, '#9cc4ff', 0.32, 34));
  } else {
    // the vein's cold sheen, from above-left
    o.push(Lt(14, 18, 60, '#c8d4e4', 0.4, 24));
  }
  return o;
}

/** A barrow-corpse warrior in the moonbeam that falls through his broken mound. */
export function draugrPortrait(f: number): PrimTree {
  return draugrKin(f, 'ancient');
}

/** A barrow's warrior risen: spangenhelm, round shield and notched blade, in the barrow's stone passage. */
export function draugrWarriorPortrait(f: number): PrimTree {
  return draugrKin(f, 'warrior');
}

/** The miner who never came up: hunched, in ore-flecked mail, the dead lantern raised, the pick calcified on his shoulder. */
export function pitDraugrPortrait(f: number): PrimTree {
  return draugrKin(f, 'pit');
}

/** The troll-wives' raised slave: bare ribs, the iron thrall-collar, the death-rune glowing on its chest, snow falling. */
export function covenThrallPortrait(f: number): PrimTree {
  return draugrKin(f, 'thrall');
}
