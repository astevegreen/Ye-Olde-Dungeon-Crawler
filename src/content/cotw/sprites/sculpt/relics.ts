import { E, K, P, X, Lt, Sh, T, arc, type PrimTree } from './kit';
import { loop, rot, rp, shLine, type Out } from './itemKit';

/** Níðhögg's Fang: the dragon's shed tooth made a blade; a bead of bile swells and drips at the point. */
export function fangModel(f: number): PrimTree {
  const out: Out = [];
  const tooth = [13.2, 19.2, 12.8, 15.0, 13.4, 11.0, 14.8, 7.6, 17.2, 5.0, 20.0, 3.8, 18.6, 6.8, 17.6, 9.6, 17.4, 12.8, 17.8, 16.0, 18.4, 19.2];
  out.push(P(tooth, 'item_fang', { bv: 2.0, n: [-0.1, 0, 1] }));
  out.push(P([13.2, 19.2, 13.0, 17.0, 17.9, 17.0, 18.4, 19.2], 'item_fangRoot', { bv: 0.8 }));
  out.push(K(15.6, 15.8, 15.4, 11.6, 0.26, 0.26, 'item_fangRoot', { occ: false, ol: false }), K(15.4, 11.6, 16.4, 8.2, 0.24, 0.22, 'item_fangRoot', { occ: false, ol: false }), K(16.4, 8.2, 18.4, 5.6, 0.22, 0.18, 'item_fangRoot', { occ: false, ol: false }));
  out.push(K(13.0, 19.8, 18.4, 19.8, 0.95, 0.95, 'blackIron'));
  out.push(K(15.6, 20.4, 15.6, 25.6, 1.05, 0.95, 'leatherDark'));
  for (let y = 21.2; y < 25.2; y += 1.3) out.push(K(14.6, y + 0.4, 16.6, y - 0.4, 0.26, 0.26, 'linen', { occ: false, ol: false }));
  out.push(E(15.6, 26.4, 1.4, 1.1, 'blackIron'));
  const deg = 34, s = 0.95;
  const laid = rot(T(out, { s, px: 16, py: 16 }), deg);
  // the bead and its drip hang straight down in world space
  const tip = rp(16 + (20.0 - 16) * s, 16 + (3.8 - 16) * s, deg);
  const swell = [0, 0.15, 0.3, 0.05][f % 4];
  const bead: Out = [
    E(tip[0] + 0.2, tip[1] + 0.9 + swell * 0.6, 1.0 + swell * 0.4, 1.15 + swell * 0.7, 'emPoison'),
    X(tip[0] - 0.2, tip[1] + 0.5 + swell * 0.5, 0.7, 0.7, '#e2ff9a', { em: true }),
  ];
  if (f % 4 === 3) bead.push(E(tip[0] + 0.2, tip[1] + 4.2, 0.55, 0.7, 'emPoison'));
  const a = rp(16, 16 + (4 - 16) * s, deg), b = rp(16, 16 + (27.4 - 16) * s, deg);
  return [shLine(a[0], a[1], b[0], b[1], 1.6, 0.4), laid, bead, Lt(tip[0], tip[1] + 1.2, 9, '#95dc4c', 0.85 + swell * 0.4)];
}

/** Shard of the Hearth-Tear: a splinter of Sól's chariot, sunlight trapped in jagged crystal. */
export function hearthTearModel(f: number): PrimTree {
  const pulse = [0, 0.06, 0.12, 0.06][f % 4];
  /* A crystal is straight lines: three prism faces (lit, front, shadowed) running parallel
   * up to a faceted point, a snapped base. The core is a seam of white-gold in the front face. */
  const prism = (cx: number, by: number, ty: number, w: number, deg: number, core: boolean): PrimTree => {
    const l = cx - w / 2, r = cx + w / 2, a = cx - w * 0.2, b = cx + w * 0.22, tx = cx + w * 0.06, sy = ty + w * 1.0;
    const out: Out = [
      P([l, by - 0.4, l, sy + 0.4, tx, ty, a, sy, a, by + 0.5], 'item_sunglass', { n: [-0.62, -0.15, 0.77] }),
      P([a, by + 0.5, a, sy, tx, ty, b, sy + 0.3, b, by - 0.2, cx, by + 0.7], 'item_sunglass', { n: [-0.05, -0.2, 0.98] }),
      P([b, by - 0.2, b, sy + 0.3, tx, ty, r, sy + 0.9, r, by - 0.8], 'item_sunglass', { n: [0.6, -0.1, 0.79] }),
    ];
    if (core) {
      out.push(P([tx, ty + 0.4, b - 0.3, sy + 2, cx + 0.5, by - 4, cx, by - 1.2, a + 0.4, by - 5, a + 0.5, sy + 1.6], 'item_suncore', { ink: pulse }));
      out.push(E(cx, (sy + by) / 2 + 1, w * 0.18 + pulse * 2, w * 0.5 + pulse * 3, 'item_suncore', { ink: pulse + 0.12 }));
    }
    return rot(out, deg, cx, by);
  };
  const sp = [[19.2, 4.6], [13.4, 13.2], [19.6, 12.0], [9.2, 15.4]][f % 4];
  return [
    Sh(15.8, 24.6, 8.8, 2.0, 0.36),
    prism(10.6, 24.2, 13.6, 3.4, -26, false),
    prism(21.6, 24.6, 17.6, 2.6, 30, false),
    prism(16.0, 24.4, 4.6, 6.0, 12, true),
    X(sp[0] - 0.4, sp[1] - 0.4, 0.8, 0.8, '#ffffff', { em: true }),
    Lt(16.4, 15.0, 11, '#ffd27a', 0.6 + pulse * 1.5),
  ];
}

/* Wave 8: the five relics that kept their flat recipes. Each tells its own story in shape first,
 * so it reads at 32 px before its colours do. */

/**
 * Sól-Shard Focus: not a raw splinter like the Hearth-Tear but a worked thing. A clear crystal
 * cut to a long lozenge stands in a rayed gilt sun-disc on a wound grip; a coin of the chariot's
 * glare sits at its girdle, and the cut throws it out as a star at the point.
 */
export function solFocusModel(f: number): PrimTree {
  const pulse = [0, 0.06, 0.12, 0.06][f % 4];
  const out: Out = [];
  // the grip, wound in gold wire, and a pommel
  out.push(K(16, 23.0, 16, 28.0, 1.1, 1.0, 'leatherDark'));
  for (let y = 24.0; y < 27.8; y += 1.25) out.push(K(14.8, y + 0.35, 17.2, y - 0.35, 0.24, 0.24, 'gold', { occ: false, ol: false }));
  out.push(E(16, 28.9, 1.5, 1.3, 'gold'));
  // the sun-disc the crystal stands in: eight rays round a boss
  const star: number[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * 2 * Math.PI - Math.PI / 2, r = i % 2 ? 3.4 : 5.6;
    star.push(16 + r * Math.cos(t), 20.6 + r * Math.sin(t));
  }
  out.push(P(star, 'gold', { bv: 1.3 }), E(16, 20.6, 2.4, 2.4, 'item_amber', { fl: 0.35 }));
  // the lozenge: four faces round a girdle, lit, half-lit, half-lit, dark
  const T0: [number, number] = [16.2, 2.6], B0: [number, number] = [16.0, 19.4], L: [number, number] = [11.6, 11.0], C: [number, number] = [15.7, 12.3], R: [number, number] = [20.4, 10.8];
  const face = (pts: Array<[number, number]>, n: [number, number, number]): PrimTree[number] => P(pts.flat(), 'relic_prism', { n });
  out.push(
    face([T0, L, C], [-0.6, -0.42, 0.68]), face([T0, C, R], [0.42, -0.5, 0.76]),
    face([L, B0, C], [-0.45, 0.4, 0.8]), face([C, B0, R], [0.6, 0.45, 0.66]),
  );
  // the glare at the girdle
  out.push(E(C[0], C[1], 1.9 + pulse * 2, 1.9 + pulse * 2, 'relic_sun'), E(C[0] - 0.35, C[1] - 0.35, 0.8, 0.8, 'item_suncore', { glow: false }));
  // gilt claws over the crystal's foot
  for (const s of [-1, 1]) out.push(K(16 + s * 3.3, 19.6, 16 + s * 3.0, 16.0, 0.6, 0.42, 'gold'), K(16 + s * 3.0, 16.0, 16 + s * 2.0, 15.0, 0.42, 0.26, 'gold'));
  const deg = 36, sc = 1;
  const at = (x: number, y: number): [number, number] => rp(16 + (x - 16) * sc, 16 + (y - 16) * sc, deg);
  const p0 = at(16, 3.6), p1 = at(16, 29.4), tip = at(T0[0], T0[1]), core = at(C[0], C[1]);
  // the star at the point stays upright in world space
  const fl = [0.9, 1.3, 1.7, 1.3][f % 4];
  return [
    shLine(p0[0], p0[1], p1[0], p1[1], 1.9, 0.38),
    rot(T(out, { s: sc, px: 16, py: 16 }), deg),
    X(tip[0] - fl, tip[1] - 0.25, fl * 2, 0.5, '#fff8e0', { em: true }),
    X(tip[0] - 0.25, tip[1] - fl, 0.5, fl * 2, '#fff8e0', { em: true }),
    Lt(core[0], core[1], 10, '#ffaa36', 0.65 + pulse * 1.5),
  ];
}

/**
 * Petrified World-Bark tower shield: a tall board of the World-Tree's taproot gone to stone,
 * rimmed in its own twisted root, its grain flowing round a knot (the boss) where the sap still
 * glows. Roots break out of the rim at its foot.
 */
export function barkTowerModel(f: number): PrimTree {
  const pulse = [0, 0.08, 0.16, 0.08][f % 4];
  const deep = { occ: false, ol: false };
  const chain = (pts: number[], r: number, m: string, o = deep): Out => {
    const c: Out = [];
    for (let i = 0; i + 3 < pts.length; i += 2) c.push(K(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r, r * 0.85, m, o));
    return c;
  };
  const outer = [9.4, 7.6, 11.4, 5.2, 14.0, 4.0, 16, 3.8, 18.0, 4.0, 20.6, 5.2, 22.6, 7.6, 22.9, 15.0, 22.5, 22.2, 19.8, 24.9, 16, 26.2, 12.2, 24.9, 9.5, 22.2, 9.1, 15.0];
  const inner = [10.9, 8.2, 12.4, 6.5, 14.4, 5.6, 16, 5.4, 17.6, 5.6, 19.6, 6.5, 21.1, 8.2, 21.4, 15.0, 21.0, 21.6, 18.9, 23.6, 16, 24.6, 13.1, 23.6, 11.0, 21.6, 10.6, 15.0];
  // the rim: the slab's own root, twisted round its edge
  const rim: Out = [];
  const n = outer.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = (outer[i * 2] + inner[i * 2]) / 2, ay = (outer[i * 2 + 1] + inner[i * 2 + 1]) / 2;
    const bx = (outer[j * 2] + inner[j * 2]) / 2, by = (outer[j * 2 + 1] + inner[j * 2 + 1]) / 2;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    rim.push(K(ax, ay, mx, my, 0.82, 0.7, 'relic_petriDeep', { ink: 0.1, occ: false }), K(mx, my, bx, by, 0.7, 0.82, 'relic_petriDeep', { ink: -0.04, occ: false }));
  }
  const parts: Out = [
    // roots breaking out of the rim at the foot, one trailing along the floor, one curled under
    K(11.6, 23.4, 9.0, 25.4, 0.95, 0.6, 'relic_petriDeep'), K(9.0, 25.4, 6.6, 26.0, 0.6, 0.28, 'relic_petriDeep'),
    K(9.4, 25.2, 8.6, 27.2, 0.4, 0.2, 'relic_petriDeep'),
    P(outer, 'relic_petriDeep', { bv: 1.0 }),
    P(inner, 'relic_petri', { bv: 1.2 }),
    // the grain, flowing round the knot
    chain([12.6, 8.0, 12.2, 12.6, 12.4, 17.6, 13.0, 22.8], 0.38, 'relic_petriDeep'),
    chain([14.6, 6.8, 13.6, 11.6, 13.4, 17.6, 14.6, 23.6], 0.4, 'relic_petriDeep'),
    chain([17.4, 6.8, 18.6, 11.6, 18.8, 17.6, 17.6, 23.6], 0.4, 'relic_petriDeep'),
    chain([19.6, 8.0, 20.0, 12.6, 19.8, 17.6, 19.2, 22.8], 0.38, 'relic_petriDeep'),
    rim,
    // the knot for a boss, ringed where the branch grew, the sap alive in its split
    arc(16.1, 14.8, 3.9, 4.3, 0, 2 * Math.PI, 16, 0.22, 0.22, 'relic_petriDeep', { ink: 0.05, ...deep }),
    E(16.1, 14.8, 2.9, 3.2, 'relic_petriDeep', { fl: 0.15 }),
    E(16.0, 14.6, 2.0, 2.35, 'relic_petri', { ink: 0.08 }),
    P([16.1, 12.4, 16.85, 14.6, 16.2, 16.9, 15.5, 14.7], 'relic_sap', { ink: pulse }),
    // quartz grown in the cracks
    X(12.0, 10.0, 0.6, 0.6, 'relic_quartz:5'), X(19.4, 19.8, 0.6, 0.6, 'relic_quartz:5'), X(13.8, 21.0, 0.5, 0.5, 'relic_quartz:4'),
    Lt(16, 14.6, 9, '#c4e05a', 0.45 + pulse * 2),
  ];
  return [Sh(17.2, 24.8, 9.6, 3.0, 0.36), rot(T(parts, { sy: 0.96, py: 16 }), -9, 16, 16)];
}

/**
 * The Antler-Crowned Mask of the Iviðja: her bleached wooden face, the petrified stag antlers
 * branching wide off its brow, the elk-rune cut in its forehead, moss at the temple. Her
 * rune-light still flickers in the empty eyes.
 */
export function antlerMaskModel(f: number): PrimTree {
  const glow = [0, 0.1, 0.2, 0.05][f % 4];
  const antler = (s: number): Out => {
    const x = (v: number): number => 16 + s * (v - 16);
    const seg = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number): PrimTree[number] => K(x(x1), y1, x(x2), y2, r1, r2, 'horn');
    return [
      seg(11.8, 10.8, 8.4, 8.8, 1.0, 0.8), seg(8.4, 8.8, 5.8, 5.8, 0.8, 0.58), seg(5.8, 5.8, 5.2, 3.2, 0.58, 0.3),
      seg(10.0, 9.8, 9.9, 6.0, 0.58, 0.26), seg(7.2, 7.4, 8.0, 3.8, 0.5, 0.24), seg(6.6, 6.8, 3.2, 6.8, 0.5, 0.24),
    ];
  };
  const groove = { ink: -0.34, occ: false, ol: false };
  const eye = (s: number): Out => {
    const x = (v: number): number => 16 + s * (v - 16);
    return [
      P([x(11.8), 13.9, x(15.1), 14.5, x(14.8), 16.6, x(12.3), 16.1], 'item_void'),
      E(x(14.0), 15.7, 0.3 + glow * (s > 0 ? 0.7 : 0.35), 0.28 + glow * 0.4, 'emArcane', { ink: (s > 0 ? glow : -glow) - 0.1 }),
      // a cheek groove under each eye
      K(x(12.0), 17.4, x(13.4), 20.2, 0.24, 0.22, 'relic_mask', groove),
    ];
  };
  const parts: Out = [
    antler(1), antler(-1),
    // the face: flat brow, high hard cheekbones, a narrow chin
    P([11.8, 10.2, 16, 9.6, 20.2, 10.2, 21.8, 12.6, 21.2, 17.4, 19.2, 22.0, 16, 25.2, 12.8, 22.0, 10.8, 17.4, 10.2, 12.6], 'relic_mask', { bv: 1.6 }),
    K(11.0, 13.0, 21.0, 13.0, 0.55, 0.55, 'relic_mask', { ink: 0.08, occ: false }),
    eye(1), eye(-1),
    K(16, 13.6, 16, 19.2, 0.5, 0.8, 'relic_mask', { ink: 0.12, occ: false }),
    X(15.0, 19.4, 0.6, 0.4, '#141018'), X(16.4, 19.4, 0.6, 0.4, '#141018'),
    // a grim cut slot of a mouth
    P([13.4, 20.9, 18.6, 20.9, 17.9, 22.0, 14.1, 22.0], 'item_void'),
    // Algiz, the elk-sedge, cut in the brow
    K(16, 12.2, 16, 10.4, 0.26, 0.26, 'relic_mask', groove), K(16, 11.4, 14.9, 10.3, 0.24, 0.24, 'relic_mask', groove), K(16, 11.4, 17.1, 10.3, 0.24, 0.24, 'relic_mask', groove),
    // moss at the temple, a strip of bark tied at the jaw
    E(21.2, 11.4, 1.7, 1.15, 'boss_moss'), E(20.4, 12.3, 0.9, 0.7, 'boss_moss'),
    K(10.8, 15.2, 10.0, 20.4, 0.55, 0.42, 'bark'), K(10.0, 20.4, 10.6, 22.4, 0.42, 0.3, 'bark'),
    Lt(16, 15.4, 7, '#6aa6ff', 0.35 + glow * 1.5),
  ];
  return [Sh(16.6, 25.6, 8.4, 2.0, 0.38), rot(parts, -5, 16, 17)];
}

/**
 * The Marrow-Gnawed Ring: a dragon's vertebra, spine and wings still on it, the marrow channel
 * worn into a finger-hole. Teeth have scalloped its arch, and a world-root's corruption has
 * wound round the band and will not let go.
 */
export function marrowRingModel(f: number): PrimTree {
  const cx = 16, cy = 18.2, rx = 5.4, ry = 5.6;
  const creep = (f % 4) * 0.035;
  // thick below (the body), thinner over the arch, scalloped where it was gnawed
  const bite = (t: number): number => Math.exp(-(((t - 5.45) / 0.45) ** 2));
  const thick = (t: number): number => 1.5 + 0.7 * Math.max(0, Math.sin(t)) - bite(t) * (0.45 + 0.4 * Math.abs(Math.sin(t * 8)));
  const at = (t: number, d: number): [number, number] => [cx + (rx + d) * Math.cos(t), cy + (ry + d) * Math.sin(t)];
  const out: Out = [Sh(16.8, 24.8, 7.2, 1.9, 0.4)];
  // the vertebra's spine and wings, behind the band
  out.push(
    K(cx + 0.6, cy - ry + 0.6, cx + 2.6, 5.0, 1.55, 0.5, 'relic_dragonBone'),
    K(cx - rx + 1.0, cy - 2.4, cx - rx - 3.0, cy - 4.6, 1.25, 0.55, 'relic_dragonBone'),
    K(cx + rx - 1.0, cy - 2.4, cx + rx + 3.2, cy - 4.2, 1.25, 0.55, 'relic_dragonBone'),
  );
  out.push(loop(cx, cy, rx, ry, thick, 'relic_dragonBone', 36));
  // the marrow stain round the inside of the channel
  for (let i = 0; i < 24; i++) {
    const t0 = (i / 24) * 2 * Math.PI, t1 = ((i + 1) / 24) * 2 * Math.PI;
    const p0 = at(t0, -thick(t0) + 0.4), p1 = at(t1, -thick(t1) + 0.4);
    out.push(K(p0[0], p0[1], p1[0], p1[1], 0.34, 0.34, 'relic_marrow', { occ: false, ol: false }));
  }
  // tooth pits along the gnawed arch
  for (const t of [5.12, 5.4, 5.68]) { const p = at(t, 0.15); out.push(E(p[0], p[1], 0.4, 0.34, 'relic_marrow', { ol: false })); }
  // the corrupt root: wound over the band from the arch round the left side, then off onto the floor
  for (let i = 0; i < 6; i++) {
    const t0 = 2.0 + creep + i * 0.42, t1 = t0 + 0.3;
    const p0 = at(t0, thick(t0) * 0.95), p1 = at(t1, -thick(t1) * 0.95);
    out.push(K(p0[0], p0[1], p1[0], p1[1], 0.42, 0.4, 'relic_rootRot'));
  }
  const tail = at(2.0 + creep, thick(2.0) * 0.95);
  out.push(
    K(tail[0], tail[1], tail[0] - 3.0, tail[1] + 2.6, 0.42, 0.3, 'relic_rootRot'),
    K(tail[0] - 3.0, tail[1] + 2.6, tail[0] - 5.0, tail[1] + 2.4 - creep * 6, 0.3, 0.16, 'relic_rootRot'),
    K(tail[0] - 3.0, tail[1] + 2.6, tail[0] - 4.0, tail[1] + 4.0, 0.26, 0.14, 'relic_rootRot'),
    X(cx + 2.4, cy + ry + 0.6, 0.8, 0.6, 'relic_dragonBone:5'),
  );
  return out;
}

/**
 * Duergar Lodestone: a black magnetite pebble with one face dressed flat and cut with the
 * duergar marks Ivalda's tongs carry, inlaid in silver. Its attunement has faded to a last
 * flicker of her cold forge-fire, but it still drags iron to it: filings bristle at one pole.
 */
export function lodestoneModel(f: number): PrimTree {
  const ember = [0, 0.5, 1, 0][f % 4];
  const inlay = (x1: number, y1: number, x2: number, y2: number): Out => [
    K(x1, y1, x2, y2, 0.48, 0.48, 'stoneDark', { ink: -0.3, occ: false, ol: false }),
    K(x1, y1, x2, y2, 0.22, 0.22, 'silver', { occ: false, ol: false }),
  ];
  // iron filings stood on end in a bristling beard round the north pole, combed along the field
  const filings: Out = [];
  for (let i = 0; i < 11; i++) {
    const t = -1.25 + i * 0.25, len = 1.5 + ((i * 7) % 4) * 0.3;
    const bx = 21.2 + Math.cos(t) * 2.6, by = 17.2 + Math.sin(t) * 3.9, bend = t * 0.7;
    filings.push(K(bx, by, bx + Math.cos(bend) * len, by + Math.sin(bend) * len, 0.2, 0.15, 'blackIron', { occ: false }));
  }
  const parts: Out = [
    filings,
    // the stone: an octahedron worn to a pebble, its dressed face up, a shadowed facet to the right
    P([8.6, 18.8, 9.8, 15.0, 12.8, 12.6, 18.0, 11.8, 22.4, 13.2, 24.0, 17.0, 22.8, 20.8, 18.4, 22.8, 12.6, 22.6, 9.6, 21.4], 'relic_lodestone', { bv: 2.0 }),
    P([10.8, 15.6, 13.4, 13.4, 18.4, 12.8, 21.6, 14.6, 19.4, 17.8, 12.4, 18.2], 'relic_lodestone', { n: [-0.2, -0.62, 0.76], bv: 0.5 }),
    P([19.4, 17.8, 21.6, 14.6, 23.8, 17.0, 22.6, 20.6, 18.6, 22.4], 'relic_lodestone', { n: [0.55, 0.3, 0.78], bv: 0.4 }),
    // Ivalda's marks: the hooked stave from her apron, the barred tally of her tongs
    inlay(12.9, 14.2, 13.1, 17.6), inlay(13.1, 17.6, 14.7, 16.6),
    inlay(15.9, 14.0, 19.6, 13.6),
    inlay(16.5, 14.0, 16.6, 16.0), inlay(17.7, 13.9, 17.8, 15.9), inlay(18.9, 13.8, 19.0, 15.8),
  ];
  // the last of the attunement: a cold spark that wakes in the stave and goes out
  if (ember) parts.push(E(13.0, 15.9 - ember * 0.6, 0.3 + ember * 0.15, 0.36 + ember * 0.2, 'emFrost', { ink: -0.2 + ember * 0.2 }), Lt(13.0, 15.7, 6, '#9fe6ff', 0.3 * ember));
  return [Sh(16.6, 23.8, 10.6, 2.2, 0.42), rot(T(parts, { s: 1.2, px: 16, py: 18 }), -6, 16, 18)];
}
