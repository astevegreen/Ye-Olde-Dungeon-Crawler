import { E, K, P, X, Lt, breath, sway, hash2, type PrimOptions, type PrimTree } from './kit';
import { BAND, FULL, frame, strand, type Out, type Pt } from './portraitKit';
import './materials';

/* Wave 9d, group B: the walking dead (corpse family): the Skeleton, the Nár and the Silver Wight. Conventions: portraitKit.ts. */

/**
 * A barrow's oldest guest, nothing left but bone: the skull turned to you
 * with its jaw rattling, violet burning deep in the sockets and lighting the
 * bone from inside; the rusted, notched sword cocked back over its head in a
 * fist of bones, the broken shield still on the near arm.
 */
export function skeletonPortrait(f: number): PrimTree {
  const g = [1, 0.86, 1.12, 0.94][f % 4];   // the sockets flicker
  const j = [0, 0.6, 1, 0.4][f % 4];        // the jaw works
  const hb = [0, 0.15, 0.3, 0.15][f % 4];   // the skull nods with it
  const o: Out = [];
  const BG = 'scr_gSkel', B = 'scr_skelBone', PIT = 'scr_skelPit', TO = 'scr_skelTooth';
  // the barrow: a passage between standing slabs, a capstone over it, laid stones behind
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(50, 50, 52, 62, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(50, 40, 30, 34, BG, { fl: 1, ink: BAND[3] }));
  for (let i = 0; i < 16; i++) {
    const x = 14 + hash2(i, 3) * 70, y = 14 + hash2(i, 5) * 76, r = 5 + hash2(i, 7) * 4;
    o.push(E(x, y, r * 1.5, r, BG, { fl: 1, ink: (Math.hypot(x - 50, (y - 46) * 0.85) < 30 ? BAND[3] : BAND[2]) - 0.08 }));
    o.push(E(x - 0.6, y - 0.8, r * 1.32, r * 0.8, BG, { fl: 1, ink: (Math.hypot(x - 50, (y - 46) * 0.85) < 30 ? BAND[3] : BAND[2]) + 0.02 }));
  }
  o.push(P([-1, 10, 12, 12, 14, 97, -1, 97], BG, { ink: BAND[1] - 0.04 }), P([10.6, 12, 12.6, 12.2, 14.6, 97, 12.6, 97], BG, { ink: BAND[2] + 0.06 }));  // the slabs
  o.push(P([97, 8, 86, 10.6, 84, 97, 97, 97], BG, { ink: BAND[1] - 0.04 }), P([86, 10.6, 87.6, 10.4, 85.6, 97, 84, 97], BG, { ink: BAND[1] + 0.08 }));
  o.push(P([-1, -1, 97, -1, 97, 8, 72, 10, 46, 9.4, 20, 11, -1, 10], BG, { ink: BAND[1] - 0.08 })); // the capstone
  o.push(P([-1, 10, 20, 11, 46, 9.4, 72, 10, 97, 8, 97, 9, 72, 11.2, 46, 10.6, 20, 12.2, -1, 11.4], BG, { ink: BAND[2] + 0.08 }));
  // dust turning in the dark
  for (let i = 0; i < 6; i++) {
    const y = (hash2(i, 41) * 80 + f * 1.2 * (1 + (i % 2))) % 80 + 14, x = 16 + hash2(i, 43) * 66;
    o.push(X(x, y, 0.8, 0.8, BG + ':' + (i % 2 ? 4 : 5), { em: true }));
  }

  // the rusted sword, raised over the far shoulder, its blade behind the skull
  const hx = 79, hy = 70;   // the guard
  const tx = 15, ty = 1;    // the point
  const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const right: number[] = [], left: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * 0.93;
    let w = 3.3 * (1 - t * 0.45);
    if ([0.34, 0.8].some((q) => Math.abs(t - q) < 0.025)) w -= 1.4;
    right.push(hx + dx * t + nx * w, hy + dy * t + ny * w);
    let wl = 3.3 * (1 - t * 0.45);
    if ([0.16, 0.72].some((q) => Math.abs(t - q) < 0.025)) wl -= 1.3;
    left.unshift(hx + dx * t - nx * wl, hy + dy * t - ny * wl);
  }
  o.push(P([...right, tx, ty, ...left], 'scr_skelSteel', { bv: 1.6, n: [0.2, -0.3, 1], ink: -0.3 }));
  o.push(K(hx + dx * 0.03, hy + dy * 0.03, hx + dx * 0.62, hy + dy * 0.62, 0.8, 0.5, 'scr_skelSteel', { ink: -0.56 })); // fuller
  for (const [t, w, r] of [[0.1, 1.2, 1.4], [0.18, -1.3, 1], [0.7, 0.8, 1.3], [0.77, -1, 1], [0.86, 0.3, 0.9]]) o.push(E(hx + dx * t + nx * w, hy + dy * t + ny * w, r * 1.6, r, 'scr_skelRust', { a: Math.atan2(uy, ux), fl: 0.6, ink: -0.1 }));
  o.push(K(hx - nx * 2.2 + dx * 0.68, hy - ny * 2.2 + dy * 0.68, hx - nx * 1.6 + dx * 0.88, hy - ny * 1.6 + dy * 0.88, 0.45, 0.35, 'scr_skelSteel', { ink: 0.3 })); // the edge, catching the light
  o.push(K(hx + nx * 6.4, hy + ny * 6.4, hx - nx * 6.4, hy - ny * 6.4, 1.5, 1.3, 'scr_skelRust', { ink: -0.12 })); // the guard
  o.push(K(hx - ux * 1, hy - uy * 1, hx - ux * 9, hy - uy * 9, 1.4, 1.4, 'scr_skelGrip', { ink: -0.14 }));
  o.push(E(hx - ux * 10.2, hy - uy * 10.2, 2.2, 2, 'scr_skelRust', { ink: -0.1 })); // the pommel

  // the spine down the back, seen between the ribs
  for (let i = 0; i < 5; i++) {
    const y = 70 + i * 6.4;
    o.push(E(51 + i * 0.3, y, 3, 2.4, B, { ink: -0.66 }), K(47 + i * 0.3, y - 0.6, 55 + i * 0.3, y - 0.6, 0.9, 0.9, B, { ink: -0.7 }));
  }
  // the ribs: hoops from the breastbone, curving down and back round the sides
  for (let i = 0; i < 4; i++) {
    const y = 80 + i * 5.8;
    o.push(strand(57, y, 38 - i, y - 3.4 + i * 0.4, 28 + i * 0.6, y + 10 + i * 0.4, 1.5 - i * 0.06, 1.1, B, 5, { ink: -0.48 - i * 0.1 }));
    o.push(strand(59, y, 68, y - 2, 72 - i * 0.6, y + 6, 1.3, 0.9, B, 4, { ink: -0.6 - i * 0.08 }));
  }
  o.push(P([55.4, 75, 60.4, 75, 60.8, 86, 59.6, 98, 56.4, 98, 55, 86], B, { bv: 1.6, ink: -0.4 })); // breastbone
  // the neck bones
  for (let i = 0; i < 3; i++) {
    const y = 64 + i * 3.8 + hb * 0.5 * (1 - i / 3);
    o.push(E(48.6, y, 3.2, 2.1, B, { ink: -0.42 }), K(44.6, y + 0.4, 52.6, y + 0.4, 1, 1, B, { ink: -0.5 }));
  }
  // collarbones, and the knobs of the shoulders
  o.push(strand(56, 75, 40, 74.4, 25, 72.6, 2.2, 1.9, B, 4, { ink: -0.22 }));
  o.push(strand(60, 75, 68, 73, 76, 73.4, 1.8, 1.6, B, 3, { ink: -0.42 }));
  o.push(E(77, 74.4, 3.6, 3.2, B, { ink: -0.4 }));

  // the far arm, its fist up before the shoulder on the grip
  const wr = [hx - ux * 5 + 2.6, hy - uy * 5 + 3.4];
  o.push(K(98, 97, wr[0] + 1.6, wr[1] + 1.4, 1.7, 1.3, B, { ink: -0.4 }));   // radius
  o.push(K(99, 92, wr[0] + 3.2, wr[1] + 0.2, 1.4, 1.1, B, { ink: -0.48 }));  // ulna
  o.push(E(wr[0] + 1, wr[1], 3, 2.4, B, { ink: -0.3 }));                      // the wrist
  for (let i = 0; i < 4; i++) {
    const cx = hx - ux * (2.6 + i * 2), cy = hy - uy * (2.6 + i * 2);
    o.push(K(cx + nx * 2.6, cy + ny * 2.6, cx - nx * 2.4, cy - ny * 2.4, 1, 0.9, B, { ink: i % 2 ? -0.3 : -0.2 }));
    o.push(E(cx + nx * 2.6, cy + ny * 2.6, 1.1, 1.1, B, { ink: -0.14 })); // a knuckle
  }

  // the skull, turned three-quarters to the right, lowered: it looks at you from under its brow
  const ox = 52, oy = 38 + hb; // between the sockets
  const at = (x: number, y: number): Pt => [ox + x, oy + y];
  const SP = (pts: number[], m: string, op?: PrimOptions) => P(pts.map((v, i) => v + (i % 2 ? oy : ox)), m, op);
  // the lower jaw first, hanging and working: its branch up to the ear, its body forward to the chin
  o.push(K(ox - 13.4, oy + 8, ox - 12, oy + 19 + j * 0.6, 2.6, 2.8, B, { ink: -0.34 }));
  o.push(SP([-14, 17 + j * 0.6, -6, 20.6 + j, 4, 21.4 + j, 10, 20.8 + j, 10.6, 24 + j, 6, 27.4 + j, -4, 27 + j, -11.6, 23.4 + j * 0.6], B, { bv: 2.2, ink: -0.24 }));
  o.push(SP([-6.4, 17.8, 10.4, 17, 10, 21 + j, -5.8, 22 + j], PIT)); // the mouth
  for (let i = 0; i < 8; i++) {
    if (i === 4) continue;
    const [x, y] = at(-5 + i * 1.8, 19.6 + j - i * 0.06);
    o.push(X(x, y, 1.3, 1.9, TO + ':' + (i < 3 ? 3 : 2)));
  }
  // the skull: the vault, and the broad face set into its front, as wide at the cheekbones as the vault
  o.push(E(ox - 13.4, oy + 1, 9.4, 12, B, { ink: -0.2 }));                  // the skull's side, down to the ear
  o.push(E(ox - 16.6, oy + 14.4, 2, 2.8, B, { ink: -0.34 }));               // behind the ear
  o.push(E(ox - 5.4, oy - 8.6, 17, 16.4, B, { fl: 0.08, ink: -0.1 }));     // the vault
  for (const [x, y, rx, ry] of [[-12.6, -13, 4.2, 2.8], [-3, -19.4, 3.6, 2], [-8.4, -6.6, 2.2, 1.4]]) o.push(E(ox + x, oy + y, rx, ry, 'scr_skelStain', { fl: 1, ink: -0.02, occ: false })); // the barrow's earth in the bone
  o.push(SP([-12.6, -7.4, 0, -8.6, 10.4, -6.4, 13, -1, 13.4, 6.4, 12.2, 11.6, 10, 16.4, 2, 17.4, -6.8, 16.8, -10.6, 13.6, -16.4, 10.6, -16.6, 1.6], B, { bv: 3.4, n: [0.12, 0.06, 1], ink: -0.06 })); // the face
  o.push(E(ox - 15, oy + 2.4, 2.8, 5.4, B, { fl: 0.85, ink: -0.38 }));      // the temple's hollow
  o.push(K(ox - 16.8, oy + 9.8, ox - 9, oy + 11.4, 1.3, 1.8, B, { ink: -0.1 })); // the cheek's arch
  o.push(E(ox - 17.6, oy + 12.4, 1.3, 1.7, PIT));                            // the ear-hole
  // a crack through the vault
  o.push(K(ox - 9.4, oy - 24, ox - 6, oy - 20.4, 0.5, 0.45, PIT, { occ: false }), K(ox - 6, oy - 20.4, ox - 8.6, oy - 15, 0.45, 0.4, PIT, { occ: false }), K(ox - 8.6, oy - 15, ox - 6.8, oy - 10.4, 0.4, 0.3, PIT, { occ: false }));
  o.push(K(ox - 6, oy - 20.4, ox - 1.6, oy - 19, 0.35, 0.25, PIT, { occ: false }));
  // the sockets: angular and deep, the brow overhanging them, their upper rims sloping down to the nose
  o.push(SP([-11.6, -1.6, -6.4, -3.8, -0.6, -2.2, 1.4, 1.6, 0.6, 6.6, -3.6, 8.2, -8.6, 7.4, -11.6, 3.6], B, { ink: -0.34 })); // the near rim
  o.push(SP([3.2, -1.8, 7.8, -3.2, 11, -1.4, 11.2, 4, 9.6, 7.2, 5.6, 7.2, 3.2, 4.2], B, { ink: -0.42 }));                 // the far rim
  o.push(SP([-10.2, -0.4, -6, -2.2, -1.4, -0.8, 0.2, 1.8, -0.4, 5.8, -3.8, 7, -8, 6.2, -10.4, 3.2], PIT));
  o.push(SP([4.6, -0.4, 7.8, -1.6, 9.8, -0.2, 9.8, 4, 8.6, 6, 6, 6, 4.6, 3.6], PIT));
  o.push(strand(ox - 12, oy - 2.4, ox - 6.4, oy - 5.2, ox - 0.8, oy - 3, 0.8, 0.6, B, 3, { ink: 0.14, occ: false })); // the brow, catching the light
  const ei = (g - 1) * 0.5;
  o.push(E(ox - 5, oy + 3.4, 1.2, 1, 'emUnholy', { ink: ei }), E(ox + 7.2, oy + 3, 0.8, 0.9, 'emUnholy', { ink: ei }));
  o.push(X(ox - 5.4, oy + 3, 0.7, 0.7, '#f4ecff', { em: true }));
  // the nose: a dark pear
  o.push(SP([1, 9, 3.4, 8.8, 4.8, 13, 3.2, 15, 0.6, 13.8], PIT));
  o.push(E(ox - 6.8, oy + 10.8, 4.6, 2.2, B, { ink: 0.04 }), E(ox + 10.6, oy + 9.6, 1.8, 3, B, { ink: -0.28 })); // the cheekbones
  // the upper teeth, some gone
  for (let i = 0; i < 9; i++) {
    if (i === 2 || i === 7) continue;
    const [x, y] = at(-5.8 + i * 1.8, 17.4 - i * 0.08);
    o.push(X(x, y, 1.4, 2.6 - (i > 5 ? 0.4 : 0), TO + ':' + (i < 4 ? 4 : 3)));
  }
  o.push(Lt(ox - 5, oy + 3.6, 7, '#a868ff', 1.0 * g, 1.5), Lt(ox + 7.2, oy + 3.2, 5, '#a868ff', 0.9 * g, 1.5));
  o.push(Lt(ox + 1, oy + 6, 18, '#a868ff', 0.22 * g, 5));

  // the near arm and the broken shield
  o.push(E(24, 76, 5.4, 4.6, B, { ink: -0.14 }), E(27, 72.8, 3, 2, B, { ink: -0.04 })); // the shoulder
  o.push(K(23, 79, 20, 92, 2.6, 2.2, B, { ink: -0.36 }));
  // the shield, turned a little from you: a rim of rusted iron, a bite broken out of it, the boss
  const cx = 15.4, cy = 84.4, rx = 14.4, ry = 18.4;
  const disc = (r0: number, notch: number[][]): number[] => {
    const pts: number[] = [];
    for (let i = 0; i <= 22; i++) {
      const a = -Math.PI * 0.28 + (Math.PI * 2 * 0.85 * i) / 22;
      pts.push(cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0);
    }
    for (const [x, y] of notch) pts.push(cx + rx * x, cy + ry * y);
    return pts;
  };
  const bite = [[0.06, -0.62], [0.2, -0.78], [0.26, -0.5], [0.4, -0.62], [0.48, -0.42], [0.62, -0.58]];
  o.push(P(disc(1, bite), 'scr_skelRust', { bv: 1.4, ink: -0.34 }));
  o.push(P(disc(0.9, bite.map(([x, y]) => [x * 0.9, y * 0.9 + 0.04])), 'scr_skelWood', { bv: 2.6, n: [0.2, -0.12, 1], ink: -0.26 }));
  for (const x of [-7, 2, 9.6]) o.push(K(cx + x, cy - ry * 0.86 + Math.abs(x) * 0.3, cx + x - 0.4, 98, 0.35, 0.35, 'scr_skelWood', { ink: -0.5, occ: false })); // the planks
  o.push(E(cx + 0.4, cy, 4.6, 5, 'scr_skelRust', { ink: -0.3 }), E(cx - 0.2, cy - 0.8, 3, 3.2, 'scr_skelRust', { ink: -0.18 }));
  o.push(X(cx - 1.6, cy - 2.6, 1, 1, 'scr_skelRust:4'));
  return o;
}

/**
 * A miner's corpse from the silver veins, walking (nár: the dead body, the
 * word Völuspá uses for the corpses Níðhögg sucks on Nástrǫnd). Bloated and
 * hunched in its torn shirt, the head lolling forward, the jaw slack; one eye
 * gone, the other a violet ember that lights its swollen face; tarnished
 * silver run black through its veins; one arm reaching out of the drift.
 */
export function narPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.9, 1.1, 0.96][f % 4];
  const o: Out = [];
  const BG = 'scr_gNar', SK = 'scr_narSkin', LI = 'scr_narLip', VN = 'scr_narVein', HR = 'scr_narHair', RG = 'scr_narRag', PIT = 'scr_narPit';
  // the drift: rock, a cap-beam and its props, a black vein of tarnished silver in the wall
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(50, 46, 56, 54, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(48, 42, 32, 30, BG, { fl: 1, ink: BAND[3] }));
  o.push(P([-1, -1, 97, -1, 97, 8, -1, 10], BG, { ink: BAND[1] - 0.06 }), P([-1, 10, 97, 8, 97, 9.4, -1, 11.4], BG, { ink: BAND[2] + 0.06 })); // the cap-beam
  o.push(P([86, 9, 93, 9, 94, 97, 87, 97], BG, { ink: BAND[1] - 0.04 }), P([86, 9, 87.4, 9, 88.4, 97, 87, 97], BG, { ink: BAND[2] + 0.02 })); // a prop
  let vx = 58, vy = 12;
  for (let i = 0; i < 6; i++) {
    const nx = vx + 4 + hash2(i, 61) * 5, ny = vy + 3 + hash2(i, 63) * 4;
    o.push(K(vx, vy, nx, ny, 0.7, 0.6, BG, { ink: BAND[1] - 0.1 }));
    if (i % 2) o.push(X(nx - 0.5, ny - 0.5, 1, 1, BG + ':5', { em: true }));
    vx = nx; vy = ny;
  }
  // drips from the beam
  for (const [x, ph] of [[24, 0], [70, 2]]) o.push(E(x, 12 + ((f + ph) % 4) * 5, 0.5, 0.9, BG, { fl: 1, ink: BAND[4] }));

  const by = -b * 0.5;
  // the hunched back in the torn shirt, humped up behind the head, which hangs forward out of it
  o.push(P([-1, 97, -1, 38, 8, 32.6, 18, 30.4 + by * 0.5, 28, 32 + by, 36, 38 + by, 42, 50 + by, 54, 62 + by, 70, 60 + by, 80, 68, 84, 97], RG, { bv: 10, n: [-0.12, -0.22, 1], ink: -0.34 }));
  // folds dragged round the hump and down
  o.push(strand(-1, 46, 14, 38, 32, 44, 0.8, 0.6, RG, 4, { ink: -0.62, occ: false }));
  o.push(strand(-1, 60, 16, 52, 36, 58, 0.9, 0.7, RG, 4, { ink: -0.62, occ: false }));
  o.push(strand(30, 40, 22, 60, 26 + s * 0.3, 97, 1, 1.5, RG, 4, { ink: -0.66, occ: false }));
  o.push(strand(8, 64, 12, 80, 8, 97, 0.9, 1.3, RG, 4, { ink: -0.64, occ: false }));
  // the chest: the shirt torn open on the bloated breast
  // the shirt torn open at the throat on a V of swollen chest
  o.push(P([38, 64 + by, 58, 62 + by, 52, 82], SK, { bv: 3, n: [0, -0.1, 1], ink: -0.44 }));
  o.push(strand(36, 62 + by, 45, 72, 52, 84, 1.1, 0.8, RG, 3, { ink: -0.2 }), strand(60, 60 + by, 55, 72, 52, 84, 1.1, 0.8, RG, 3, { ink: -0.3 }));
  o.push(strand(46, 70, 49, 75, 48, 80, 0.45, 0.4, VN, 3, { occ: false }));
  o.push(strand(28, 80, 34, 88, 30, 97, 0.9, 1.2, RG, 3, { ink: -0.64, occ: false })); // a fold under the breast

  // the reaching arm, from the far shoulder out of the dark toward you
  const el: Pt = [72, 79], wr: Pt = [81, 71 + s * 0.2];
  o.push(K(60, 66 + by, el[0], el[1], 6.4, 5.6, RG, { ink: -0.42 }));
  o.push(K(el[0] - 1, el[1], wr[0], wr[1], 4.6, 3.8, SK, { ink: -0.2 }));
  o.push(P([el[0] - 5, el[1] - 4, el[0] + 1, el[1] - 6, el[0] + 3, el[1] - 1, el[0] - 1, el[1] + 5], RG, { bv: 1.4, ink: -0.38 })); // the sleeve's torn end
  o.push(strand(el[0] + 2, el[1] - 2, el[0] + 5, el[1] - 5, wr[0] - 1, wr[1] - 1.4, 0.4, 0.35, VN, 3, { occ: false }));
  o.push(X(el[0] + 4.6, el[1] - 4.4, 1, 1, 'silver:5'));
  // the hand: the back of it, four hooked fingers, black nails
  const hx = wr[0] + 4, hy = wr[1] - 0.4;
  o.push(E(hx, hy, 5.4, 4.4, SK, { a: -0.3, ink: -0.08 }));
  const fing = [[-1.6, -3.6, 0.1, 6.4], [0.4, -1.4, 0.35, 7], [1.2, 1.2, 0.6, 6.4], [0.6, 3.6, 0.85, 5]];
  for (const [dx, dy, a, l] of fing) {
    const kx = hx + 3.6 + dx, ky = hy + dy, mx = kx + Math.cos(a - 0.3) * l * 0.55, my = ky + Math.sin(a - 0.3) * l * 0.55;
    const tx = mx + Math.cos(a + 0.9) * l * 0.5, ty = my + Math.sin(a + 0.9) * l * 0.5;
    o.push(K(kx, ky, mx, my, 1.3, 1.15, SK, { ink: -0.06 }), E(mx, my, 1.15, 1.15, SK, { ink: 0.04 }));
    o.push(K(mx, my, tx, ty, 1.1, 0.9, SK, { ink: -0.1 }));
    o.push(K(tx, ty, tx + Math.cos(a + 1.4) * 2, ty + Math.sin(a + 1.4) * 2, 0.75, 0.2, 'scr_narNail'));
  }
  o.push(K(hx - 2, hy + 2.6, hx + 1.4, hy + 6.4, 1.3, 1, SK, { ink: -0.2 })); // the thumb, hanging
  o.push(strand(hx - 3.6, hy - 1, hx, hy - 2, hx + 3.6, hy - 1.6, 0.35, 0.3, VN, 3, { occ: false }));

  // the head, hung forward out of the hunch and lolling a little: we see the crown, the face low on it
  const H = frame(49, 37 + by, 0.16);
  const jb = b * 0.3;
  o.push(H.P([-17, -6, -8, -16, 4, -18, 2, -6, -13, 8, -18, 16], HR, { bv: 2, ink: -0.3 })); // lank hair hanging behind
  o.push(H.E(-3, -7, 15, 14.6, SK, { fl: 0.1, ink: -0.12 }));                 // the skull
  o.push(H.E(1, 5, 13.4, 12.4, SK, { fl: 0.15, ink: -0.08 }));                // the swollen face
  o.push(H.E(-7.6, 9, 6.6, 7, SK, { ink: -0.06 }));                           // the near cheek, puffed
  o.push(H.E(10.4, 7, 4.4, 8.4, SK, { fl: 0.5, ink: -0.44 }));                // the far cheek, turned away
  o.push(H.E(0, 29.6 + jb, 9.4, 3.6, SK, { ink: -0.56 }));                    // the shadow under the jaw
  // the jaw, dropped open and hanging
  o.push(H.P([-9.6, 12, 9, 11, 8.6, 19, 4.6, 28.4 + jb, -3.6, 29.2 + jb, -9, 22.6], SK, { bv: 3.6, n: [0, 0.2, 1], ink: -0.16 }));
  o.push(H.P([-4.6, 13.4, 0.6, 12.4, 5.8, 13, 6.4, 17, 4.8, 23.2 + jb, 0.6, 25 + jb, -3.2, 24 + jb, -5.2, 19], PIT));
  o.push(H.E(0.6, 23.2 + jb, 3.4, 1.7, LI, { ink: -0.56 }));                   // the swollen tongue, lolling
  o.push(strand(...H.pt(-5.2, 13.8), ...H.pt(0.6, 11.6), ...H.pt(6.8, 13), 0.8, 0.6, LI, 3, { ink: -0.38 }));     // the upper lip, thin
  o.push(strand(...H.pt(-5.4, 20), ...H.pt(-0.6, 28 + jb), ...H.pt(6, 21 + jb), 1.3, 0.9, LI, 3, { ink: -0.34 })); // the lower lip, hanging
  for (const [x, w, h] of [[-3.4, 1.7, 1.5], [-1.5, 1.6, 1.8], [2.4, 1.6, 1.3]]) o.push(H.P([x, 13, x + w, 13, x + w, 13 + h, x, 13 + h * 0.8], 'scr_narTooth', { ink: -0.34 }));
  o.push(H.P([2.4, 24.4 + jb, 3.8, 24.4 + jb, 3.6, 22.6 + jb, 2.6, 22.6 + jb], 'scr_narTooth', { ink: -0.46 }));
  // the nose, swollen and flattened
  o.push(H.K(1.6, -0.6, 2.6, 5.4, 1.6, 2.3, SK, { ink: -0.04 }), H.E(2.6, 6.6, 3.4, 2.4, SK, { ink: -0.02 }));
  o.push(H.E(0.8, 7.8, 0.8, 0.6, PIT), H.E(4.2, 7.6, 0.8, 0.6, PIT));
  // the brow, swollen, and the eye gone from the far socket
  o.push(H.K(-11, -3, 10, -3.4, 2.6, 2.1, SK, { ink: -0.02 }));
  o.push(H.E(7.2, 1.4, 3.8, 3.6, SK, { fl: 0.7, ink: -0.58 }));
  o.push(H.E(7.4, 1.8, 2.7, 2.6, PIT));
  o.push(H.K(5, 4.8, 10, 4.2, 0.5, 0.4, SK, { ink: -0.64, occ: false })); // the torn lid beneath it
  // the near eye: a puffed lid, a bag under it, the violet ember between
  o.push(H.E(-5.2, 1.4, 4.8, 3.4, SK, { fl: 0.7, ink: -0.58 }));
  o.push(H.E(-5, 1.6, 1.8, 1.25, 'emUnholy', { ink: (g - 1) * 0.5 }));
  o.push(H.X(-5.6, 1, 0.8, 0.8, '#f4ecff', { em: true }));
  o.push(H.E(-5.2, -0.5, 5, 1.8, LI, { ink: -0.14 }));                         // the swollen upper lid
  o.push(H.E(-5.4, 4.4, 4.4, 1.6, LI, { ink: -0.28 }));                        // the bag beneath
  // lank wet hair plastered over the crown and down the near side
  o.push(H.P([-18, -4, -14, -18, -3, -23.8, 8, -22, 14, -15, 7, -17.4, -1, -16, -7, -11, -11, -2, -12.6, 8, -17, 12], HR, { bv: 1.6, ink: -0.12 }));
  for (const [x0, y0, x1, y1, x2, y2] of [[-13, 0, -16, 10, -15, 22], [-10, -7, -11, 6, -10.6, 18], [-4, -14, -4.6, -7, -3.4, 0], [3, -16, 4.8, -11, 3.6, -5.6]]) {
    const [a0, a1] = H.pt(x0, y0), [c0, c1] = H.pt(x1, y1), [e0, e1] = H.pt(x2 + s * 0.3, y2);
    o.push(strand(a0, a1, c0, c1, e0, e1, 1.1, 0.35, HR, 4, { ink: -0.14 }));
  }
  // the veins: black where the silver has run in them, catching the light at points
  const vein = (pts: number[], r: number): void => { for (let i = 0; i + 3 < pts.length; i += 2) { const [a, c] = H.pt(pts[i], pts[i + 1]), [d, e] = H.pt(pts[i + 2], pts[i + 3]); o.push(K(a, c, d, e, r, r * 0.85, VN, { occ: false })); } };
  vein([11, -11, 9, -7, 11.4, -4, 10.4, -1], 0.45);
  vein([-12, 4, -10, 8, -11.6, 12, -10, 16], 0.42);
  vein([-10, 8, -7, 9.6], 0.32);
  vein([7.6, 14, 8.6, 19, 6.6, 24, 7.4, 28], 0.45);
  vein([-4, -14, -1, -11, -2, -8], 0.35);
  for (const [x, y] of [[9.6, -7.2], [8.2, 18.6]]) o.push(H.X(x - 0.5, y - 0.5, 1, 1, 'silver:4'));

  // its one eye lights its face
  { const [ex, ey] = H.pt(-5, 1.6); o.push(Lt(ex, ey, 15, '#8a52e8', 0.62 * g, 4)); }
  return o;
}

/**
 * A miner who died guarding his lode and guards it still: the haugbúi of the
 * Silver Veins. Gaunt and hooded, his skin gone the grey of tarnished silver,
 * a tarnished circlet on his brow, thin white hair and beard; violet in the
 * sockets, the gaze that sees along every vein. His pick upright like a
 * halberd, one claw spread over the lode at his feet, whose silver burns
 * white and lights him from below.
 */
export function silverWightPortrait(f: number): PrimTree {
  const b = breath(f), s = sway(f);
  const g = [1, 0.92, 1.08, 0.96][f % 4];
  const o: Out = [];
  const BG = 'scr_gWight', SK = 'scr_wightSkin', SH = 'scr_wightShroud', ML = 'scr_wightMail', TN = 'scr_wightTarn';
  const BD = 'scr_wightBeard', PIT = 'scr_wightPit', LD = 'scr_wightLode', VN = 'scr_wightVein';
  // the lode-chamber: rock, a few dead veins in the wall, the glow rising off the lode
  o.push(P(FULL, BG, { ink: BAND[1] }));
  o.push(E(54, 52, 54, 52, BG, { fl: 1, ink: BAND[2] }));
  o.push(E(60, 70, 34, 30, BG, { fl: 1, ink: BAND[3] }));
  for (const [x0, y0, x1, y1, x2, y2] of [[74, -1, 82, 14, 97, 22], [-1, 30, 8, 36, 4, 50], [80, 34, 88, 40, 97, 38]]) o.push(strand(x0, y0, x1, y1, x2, y2, 0.7, 0.5, BG, 4, { ink: BAND[2] + 0.1 }));
  o.push(X(85.5, 17.5, 1, 1, BG + ':4', { em: true }), X(5.5, 41.5, 1, 1, BG + ':4', { em: true }));

  const by = -b * 0.5;
  // the shroud over the shoulders, open on the mail
  o.push(P([-1, 97, 2, 76, 14, 62, 30, 56 + by, 70, 56 + by, 84, 62, 94, 74, 97, 97], SH, { bv: 6, n: [-0.1, -0.2, 1], ink: -0.44 }));
  o.push(P([36, 97, 37, 66, 50, 61 + by, 63, 66, 64, 97], ML, { bv: 3, n: [0, -0.1, 1], ink: -0.26 }));
  for (const [x, y, w, h] of [[42, 72, 3, 2], [55, 68, 2, 3], [47, 82, 4, 2], [58, 86, 3, 2]]) o.push(X(x, y, w, h, TN + ':2'));
  o.push(strand(35, 62 + by, 38, 80, 34, 97, 1.6, 2, SH, 4, { ink: -0.22 }), strand(65, 62 + by, 64, 80, 67, 97, 1.6, 2, SH, 4, { ink: -0.4 })); // the shroud's edges
  o.push(strand(26, 64, 28, 80, 26, 97, 0.9, 1.2, SH, 3, { ink: -0.62, occ: false }), strand(80, 66, 78, 82, 82, 97, 0.9, 1.2, SH, 3, { ink: -0.62, occ: false })); // folds
  // the near arm down to the haft, in its sleeve
  o.push(K(22, 62, 19, 74.6, 5, 4.4, SH, { ink: -0.38 }));
  o.push(K(15.4, 73.4, 23, 75.4, 1.4, 1.4, SH, { ink: -0.62 }));                      // the frayed cuff
  // the pick, upright at his side like a halberd: the haft, the tarnished head
  const px = 13 + s * 0.2, py = 9;
  o.push(K(14, 97, px, py, 1.7, 1.5, 'scr_wightHaft', { ink: -0.2 }));
  o.push(K(px, py, px - 12, py + 9, 2.2, 0.5, TN, { ink: -0.06 }), K(px, py, px + 12, py - 4, 2.2, 0.5, TN, { ink: -0.06 }));
  o.push(K(px - 1, py - 1.6, px - 10, py + 6, 0.5, 0.3, TN, { ink: 0.3, occ: false })); // its worn edge
  o.push(E(px, py, 2.4, 2.6, TN, { ink: 0.02 }));
  o.push(X(px + 4.5, py - 3.2, 1, 1, VN + ':4', { em: true }));                       // a fleck of silver on it
  // the near hand round the haft
  o.push(E(17.6, 79.6, 3.4, 4, SK, { ink: -0.2 }));                                   // the back of the hand
  for (let i = 0; i < 4; i++) {
    const y = 77.2 + i * 2;
    o.push(K(17.4, y, 12.4, y + 0.5, 0.9, 0.85, SK, { ink: -0.1 - i * 0.05 }), E(12.6, y + 0.7, 0.95, 0.95, SK, { ink: -0.06 - i * 0.05 })); // fingers curled round the haft
    o.push(E(17.6, y, 0.95, 0.95, SK, { ink: 0.02 - i * 0.05 }));                     // the knuckle
  }
  o.push(K(18.6, 76.4, 12.6, 75.8, 1, 0.8, SK, { ink: 0 }));                          // the thumb across the top

  // the head under the hood
  const H = frame(49, 36 + by, -0.04);
  const hstr = (a: Pt, c: Pt, e: Pt, r0: number, r1: number, m: string, n: number, op?: PrimOptions) => strand(...H.pt(...a), ...H.pt(...c), ...H.pt(...e), r0, r1, m, n, op);
  o.push(H.P([-19, -2, -15, -19, -5, -27, 8, -27, 18, -18, 21, -2, 20, 14, 24, 26, -22, 26, -21, 12], SH, { bv: 6, n: [-0.1, -0.15, 1], ink: -0.28 })); // the hood
  o.push(H.P([-13, -4, -10, -16, -1, -21, 9, -19, 14, -8, 15, 8, 13, 22, -13, 22, -15, 8], PIT));                    // its dark
  // thin white hair falling from under it
  const hair: Array<[Pt, Pt, Pt]> = [[[-10, -10], [-12.6, 2], [-13.4, 16]], [[-8.4, -12], [-9.6, 2], [-11, 12]], [[10, -10], [12.6, 2], [12.6, 14]]];
  for (const [a, c, e] of hair) o.push(hstr(a, c, [e[0] + s * 0.3, e[1]], 0.55, 0.2, BD, 4, { ink: -0.42 }));
  o.push(H.K(0, 12, 0.4, 22, 3.4, 3.8, SK, { ink: -0.5 }));                             // the gaunt neck
  o.push(H.E(0, -6, 9.4, 9.4, SK, { fl: 0.1, ink: -0.1 }));                             // the brow and crown
  o.push(H.E(0.6, 2.4, 8.2, 12.4, SK, { fl: 0.15, ink: -0.08 }));                       // the long face
  o.push(H.P([-7, 6, 7.4, 6, 4.4, 14.4, 0.8, 16.6, -2.8, 14.6], SK, { bv: 2.6, n: [0, 0.25, 1], ink: -0.06 })); // the jaw, the pointed chin
  // cheekbones high and hard, the cheeks fallen in beneath
  o.push(H.E(-5, 7.6, 2.4, 3.6, SK, { fl: 0.6, ink: -0.5 }), H.E(6, 7.4, 1.8, 3.2, SK, { fl: 0.6, ink: -0.56 }));
  o.push(H.E(-5.4, 2.6, 3, 1.8, SK, { ink: 0.02 }), H.E(6.2, 2.4, 2.4, 1.6, SK, { ink: -0.06 }));
  // the tarnish on him, as on old silver
  for (const [x, y, rx, ry] of [[-5, -10.6, 2.2, 1.3], [7, -4.6, 1.3, 2], [4.6, 12.2, 1.4, 1]]) o.push(H.E(x, y, rx, ry, TN, { fl: 1, ink: -0.1, occ: false }));
  o.push(H.K(-6.8, -3.4, 7.8, -3.6, 1.8, 1.6, SK, { ink: 0.02 }));                      // the brow ridge
  // deep sockets, violet in them
  o.push(H.E(-3.6, -0.2, 3, 2.4, PIT), H.E(4.2, -0.2, 2.6, 2.3, PIT));
  o.push(H.E(-3.4, 0, 1.15, 0.95, 'emUnholy', { ink: (g - 1) * 0.5 }), H.E(4.2, 0, 1, 0.9, 'emUnholy', { ink: (g - 1) * 0.5 - 0.06 }));
  o.push(H.X(-3.9, -0.5, 0.7, 0.7, '#f4ecff', { em: true }));
  // the long nose, the nostrils rotted to a slit
  o.push(H.K(0.4, -1.6, 1, 5.4, 0.9, 1.3, SK, { ink: 0.06 }));
  o.push(H.E(1, 6.4, 1.5, 0.7, PIT));
  // the mouth, lips drawn back off the teeth in a thin hard line
  o.push(H.K(-3.4, 10.6, 4.4, 10.4, 0.75, 0.65, PIT));
  for (const x of [-2.2, -0.6, 1, 2.6]) o.push(H.X(x, 9.6, 1, 0.8, 'scr_skelTooth:2'));
  // the tarnished circlet on his brow, a bead of silver set in it
  o.push(hstr([-9.2, -6.6], [0.4, -8.6], [9.6, -6.8], 1, 1, TN, 5, { ink: 0.04 }));
  o.push(H.E(0.4, -8, 1.3, 1.4, VN, { ink: -0.1 }));
  o.push(H.X(-6, -8, 1, 1, TN + ':4'), H.X(6.4, -8.2, 1, 1, TN + ':4'));
  // the thin white beard, hanging in wisps over the mail
  const beard: Array<[Pt, Pt, Pt, number, number]> = [[[-5.6, 11], [-8.4, 18], [-7.6, 28], 0.6, -0.34], [[-3, 13.6], [-2, 22], [-4.4, 31], 0.7, -0.22], [[-0.6, 15.4], [1.8, 24], [-0.2, 34], 0.75, -0.16], [[1.6, 15.6], [3.4, 22], [2.4, 29], 0.6, -0.26], [[4, 13.4], [7, 19], [6.4, 27], 0.6, -0.3], [[6.2, 9.6], [8.8, 15], [9.6, 21], 0.45, -0.42]];
  for (const [a, c, e, r, k] of beard) {
    o.push(hstr(a, c, [e[0] + s * 0.3, e[1]], r, 0.15, BD, 5, { ink: k }));
  }

  // the lode he keeps: a rock run through with silver, at his feet in front of him
  o.push(P([46, 97, 50, 84, 58, 76, 72, 72, 86, 73, 97, 79, 97, 97], LD, { bv: 4, n: [0.05, -0.3, 1], ink: -0.5 }));
  o.push(P([58, 76, 72, 72, 86, 73, 97, 79, 97, 84, 84, 80, 70, 79, 60, 82], LD, { bv: 2, ink: -0.36 })); // its top, catching its own light
  o.push(P([46, 97, 50, 84, 56, 88, 60, 97], LD, { bv: 2, ink: -0.66 }));               // its shadowed face
  const veins: Array<[Pt, Pt, Pt]> = [[[52, 88], [60, 80], [70, 82]], [[70, 82], [78, 77], [90, 80]], [[60, 92], [70, 88], [82, 92]], [[82, 92], [88, 88], [97, 90]], [[64, 76], [68, 79], [70, 82]]];
  for (const [a, c, e] of veins) o.push(strand(...a, ...c, ...e, 0.8, 0.6, VN, 4, { ink: -0.06, occ: false }));
  for (const [x, y, k] of [[59, 80, 0], [78, 77, 1], [70, 88, 2], [88, 88, 3]]) o.push(X(x - 0.5, y - 0.5, 1, 1, (f + k) % 4 === 0 ? VN + ':3' : '#ffffff', { em: true })); // the silver glints, one at a time dimming
  // the far arm reaching down, the claw spread over the rock
  o.push(K(72, 60, 75, 71, 5.6, 4.6, SH, { ink: -0.4 }));
  o.push(K(75, 70.6, 73, 75, 2.4, 2.2, SK, { ink: -0.12 }));
  o.push(E(72, 76.6, 4.2, 2.8, SK, { a: 0.2, ink: -0.18 }));
  for (const [dx, a, l] of [[-3.6, 2.3, 7], [-1.2, 1.95, 8], [1.2, 1.6, 8.4], [3.4, 1.25, 7]]) {
    const kx = 72 + dx, ky = 77.4, mx = kx + Math.cos(a) * l * 0.55, my = ky + Math.sin(a) * l * 0.55;
    const tx = mx + Math.cos(a - 0.5) * l * 0.45, ty = my + Math.sin(a - 0.5) * l * 0.45 + 1;
    o.push(K(kx, ky, mx, my, 1.05, 0.9, SK, { ink: -0.2 }), E(mx, my, 1, 1, SK, { ink: -0.12 }));
    o.push(K(mx, my, tx, ty, 0.85, 0.6, SK, { ink: -0.2 }));
    o.push(K(tx, ty, tx + Math.cos(a - 0.2) * 1.8, ty + Math.sin(a - 0.2) * 1.8, 0.55, 0.15, TN));
  }
  // the silver's light, up into his face
  o.push(Lt(62, 76, 76, '#cfdcff', 0.66 * g, 14));
  return o;
}
