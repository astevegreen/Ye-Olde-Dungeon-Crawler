import { E, K, P, X, Sh, T, type PrimTree } from './kit';
import { RAD, glint, lay, loop, rot, type ItemVariant, type Out } from './itemKit';

/* Small goods: jewellery, packs and purses, coins, gems and keys. */

/** One band, four makers: gold with a clear stone, a silver serpent, an iron rune-ring, bone. */
export function ringModel(_f: number, v: ItemVariant): PrimTree {
  const k = v.kind || 'gold';
  const out: Out = [Sh(16.6, 23.6, 5.6, 1.8, 0.4)];
  const cx = 16, cy = 17.6, rx = 4.6, ry = 5.2;
  if (k === 'gold') {
    // a gold band standing on edge, a clear stone set high in a claw bezel
    out.push(loop(cx, cy, rx, ry, 1.2, 'gold', 30));
    out.push(E(cx, 12.8, 2.4, 1.4, 'gold'));
    out.push(P([cx - 2.2, 11.6, cx - 1.4, 9.4, cx + 1.4, 9.4, cx + 2.2, 11.6, cx, 13.6], 'item_crystal', { bv: 0.7 }));
    out.push(P([cx - 1.4, 9.4, cx + 1.4, 9.4, cx + 0.8, 10.6, cx - 0.8, 10.6], 'item_crystal', { n: [0, -0.6, 0.8] }));
    out.push(X(cx - 1.0, 10.2, 0.8, 0.8, 'item_glint:5', { em: true, glow: false }));
    return out;
  }
  if (k === 'serpent') {
    // a silver snake coiled into a ring, its head reared over its own tail
    out.push(loop(cx, cy, rx, ry, 1.05, 'silver', 26, {}, 0.78, 1.70));
    const ht = 1.70 * 2 * Math.PI, hx = cx + rx * Math.cos(ht), hy = cy + ry * Math.sin(ht);
    out.push(K(cx + 0.9, 12.5, cx - 0.6, 12.6, 0.95, 0.3, 'silver'));
    out.push(K(hx, hy, cx + 3.4, 10.6, 1.05, 0.9, 'silver'));
    out.push(E(cx + 3.9, 10.0, 2.1, 1.35, 'silver', { a: -0.35 }));
    out.push(X(cx + 4.0, 9.3, 0.8, 0.7, '#14161c'));
    for (let t = 0.86; t < 1.64; t += 0.1) {
      const a = t * 2 * Math.PI;
      out.push(X(cx + rx * Math.cos(a) - 0.25, cy + ry * Math.sin(a) - 0.25, 0.5, 0.5, 'silver:2'));
    }
    return out;
  }
  if (k === 'rune') {
    // iron rune-ring: thick, broad and flat, cut with dark (unlit) staves
    out.push(loop(cx, cy, rx + 0.2, ry + 0.2, 1.95, 'iron', 30, { fl: 0.6 }));
    for (const t of [0.06, 0.14, 0.22, 0.30, 0.38, 0.46, 0.62, 0.7, 0.78, 0.86, 0.94]) {
      const a = t * 2 * Math.PI;
      const x = cx + (rx + 0.2) * Math.cos(a), y = cy + (ry + 0.2) * Math.sin(a), nx = Math.cos(a) * 1.1, ny = Math.sin(a) * 1.1;
      out.push(K(x - nx, y - ny, x + nx, y + ny, 0.3, 0.3, 'item_void', { occ: false, ol: false }));
    }
    return out;
  }
  // bone ring: chunky and uneven, a carved knuckle where the stone would be
  out.push(loop(cx, cy, rx, ry, (t) => 1.4 + 0.3 * Math.sin(t * 3) + 0.15 * Math.cos(t * 5), 'bone', 30));
  out.push(E(cx + 0.3, 12.2, 2.4, 1.9, 'bone'), E(cx - 0.5, 11.6, 0.6, 0.6, 'boneOld'), E(cx + 1.1, 11.6, 0.6, 0.6, 'boneOld'));
  out.push(K(cx - 3.8, 20.2, cx - 2.6, 21.6, 0.24, 0.24, 'boneOld', { occ: false, ol: false }));
  return out;
}

/** A cord lying in a loop above the pendant, whose shape names it: Mjölnir, the valknut, amber. */
export function amuletModel(_f: number, v: ItemVariant): PrimTree {
  const k = v.kind || 'hammer';
  const out: Out = [Sh(16.6, 24.8, 6.4, 1.9, 0.38)];
  // the cord lies in a loose, lopsided loop above the pendant
  const cord = [[16, 14.6], [13.6, 13.2], [11.2, 10.8], [11.0, 8.2], [13.2, 6.4], [16.4, 6.2], [19.6, 7.4], [21.0, 9.8], [20.2, 12.4], [18.0, 13.6], [16, 14.6]];
  for (let i = 0; i < cord.length - 1; i++) out.push(K(cord[i][0], cord[i][1], cord[i + 1][0], cord[i + 1][1], 0.4, 0.4, 'leather', { occ: false }));
  if (k === 'hammer') {
    // Mjölnir: a stubby handle and ring above a broad, flared head: an inverted T
    out.push(loop(16, 15.0, 0.95, 0.95, 0.4, 'silver', 10));
    out.push(K(16, 16.0, 16, 19.4, 1.0, 0.85, 'silver'));
    out.push(P([11.0, 19.0, 21.0, 19.0, 21.8, 18.4, 22.4, 22.6, 20.8, 22.0, 11.2, 22.0, 9.6, 22.6, 10.2, 18.4], 'silver', { bv: 1.0 }));
    out.push(X(12.4, 20.0, 0.8, 0.8, 'silver:2'), X(14.6, 20.0, 0.8, 0.8, 'silver:2'), X(16.8, 20.0, 0.8, 0.8, 'silver:2'), X(19.0, 20.0, 0.8, 0.8, 'silver:2'));
    return out;
  }
  if (k === 'valknut') {
    // three interlocked triangles in bronze
    out.push(loop(16, 15.0, 0.8, 0.8, 0.36, 'bronze', 10));
    const cx = 16, cy = 20.8;
    for (let i = 0; i < 3; i++) {
      const o = (90 + i * 120) * RAD, ox = Math.cos(o) * 1.2, oy = Math.sin(o) * 1.2;
      const pts = [0, 1, 2].map((j) => { const t = (-90 + j * 120) * RAD; return [cx + ox + Math.cos(t) * 4.0, cy + oy + Math.sin(t) * 4.0]; });
      for (let j = 0; j < 3; j++) out.push(K(pts[j][0], pts[j][1], pts[(j + 1) % 3][0], pts[(j + 1) % 3][1], 0.5, 0.5, 'bronze'));
    }
    return out;
  }
  // amber drop in a silver cap
  out.push(K(16, 16.6, 16, 19.6, 0.7, 2.6, 'item_amber'));
  out.push(E(16, 21.2, 3.0, 3.1, 'item_amber'));
  out.push(E(16, 16.4, 1.0, 0.75, 'silver'), loop(16, 15.1, 0.8, 0.8, 0.34, 'silver', 10));
  out.push(X(15.6, 20.6, 0.8, 0.8, 'item_amber:1'));
  out.push(glint(14.6, 19.2, 14.8, 18.4, 0.38));
  return out;
}

/** Three sizes of leather: a rucksack under its bedroll, a drawstring purse, a belt pouch. */
export function packModel(_f: number, v: ItemVariant): PrimTree {
  const k = v.kind || 'backpack';
  if (k === 'backpack') {
    // a leather rucksack under its bedroll, flap buckled shut
    const parts = [
      P([10.0, 10.6, 22.0, 10.6, 23.4, 22.6, 16.0, 24.0, 8.6, 22.6], 'leather', { bv: 2.4 }),
      K(8.8, 13.4, 8.4, 21.6, 0.6, 0.6, 'leatherDark'),
      P([9.8, 10.2, 22.2, 10.2, 22.6, 16.4, 16.0, 17.8, 9.4, 16.4], 'leatherDark', { bv: 1.4 }),
      K(16, 14.6, 16, 19.8, 0.62, 0.62, 'leatherDark'),
      X(15.3, 17.0, 1.4, 1.2, 'bronze:4'),
      K(8.2, 9.2, 23.8, 9.2, 2.2, 2.2, 'woolBrown'),
      E(23.9, 9.2, 0.9, 2.1, 'woolBrown', { ink: -0.15 }),
      K(11.4, 6.8, 11.4, 11.6, 0.5, 0.5, 'leatherDark'), K(20.6, 6.8, 20.6, 11.6, 0.5, 0.5, 'leatherDark'),
    ];
    return [Sh(16.8, 24.6, 8.6, 2.2, 0.42), rot(parts, -8, 16, 20)];
  }
  if (k === 'purse') {
    // drawstring purse, a coin showing at its neck
    const parts = [
      E(16, 19.6, 4.9, 4.4, 'leather', { fl: 0.2 }),
      E(16.6, 14.6, 1.6, 0.9, 'gold'),
      P([12.6, 15.2, 13.4, 12.6, 14.8, 14.0, 16.0, 12.0, 17.4, 13.8, 18.8, 12.4, 19.6, 15.0, 18.0, 16.4, 14.0, 16.4], 'leather', { bv: 0.8 }),
      K(13.8, 16.0, 18.2, 16.0, 0.48, 0.48, 'item_twine'),
      K(18.0, 16.2, 20.4, 18.8, 0.3, 0.25, 'item_twine'), E(20.6, 19.0, 0.6, 0.6, 'item_twine'),
    ];
    return [Sh(16.8, 23.6, 5.6, 1.8, 0.42), rot(parts, 10, 16, 22)];
  }
  // belt pouch on a length of belt, bone toggle
  const parts = [
    K(5.8, 13.4, 26.2, 10.8, 0.95, 0.95, 'leatherDark', { fl: 0.5 }),
    P([5.0, 11.6, 7.8, 11.2, 8.2, 15.2, 5.4, 15.6], 'bronze', { bv: 0.5 }),
    P([5.9, 12.4, 7.2, 12.2, 7.4, 14.4, 6.1, 14.6], 'item_void'),
    P([11.0, 12.0, 21.0, 12.0, 21.0, 20.6, 19.4, 22.4, 12.6, 22.4, 11.0, 20.6], 'leather', { bv: 1.6 }),
    P([10.6, 11.4, 21.4, 11.4, 21.0, 16.6, 16.0, 18.0, 11.0, 16.6], 'leatherDark', { bv: 1.2 }),
    K(14.8, 17.6, 17.2, 17.6, 0.55, 0.55, 'horn'),
  ];
  return [Sh(16.8, 23.4, 7.2, 1.9, 0.42), rot(parts, -6, 16, 20)];
}

/** A low heap, mostly gold with silver and copper mixed in, one coin on its edge. */
export function coinsModel(): PrimTree {
  const coin = (x: number, y: number, m: string): Out => [E(x, y + 0.5, 2.3, 1.25, m, { ink: -0.22, fl: 0.5 }), E(x, y, 2.3, 1.2, m, { fl: 0.8 })];
  const heap: Array<[number, number, string]> = [
    [11.0, 20.6, 'gold'], [15.0, 21.4, 'item_copper'], [19.4, 21.0, 'gold'], [22.4, 20.0, 'silver'],
    [13.0, 18.6, 'gold'], [17.2, 19.0, 'gold'], [20.6, 18.4, 'gold'],
    [9.8, 18.4, 'silver'], [15.2, 16.8, 'gold'], [18.8, 16.6, 'item_copper'],
    [13.4, 15.0, 'gold'], [17.0, 14.8, 'gold'], [15.4, 13.2, 'gold'],
  ];
  heap.sort((a, b) => a[1] - b[1]);
  return [
    Sh(16.6, 22.6, 8.6, 2.0, 0.42),
    E(21.6, 15.0, 1.0, 2.2, 'gold', { fl: 0.6, a: 0.25 }),
    heap.map(([x, y, m]) => coin(x, y, m)),
    X(14.6, 12.6, 0.8, 0.8, 'gold:5'),
  ];
}

/** A clear brilliant cut: bright crown, darker pavilion, one hard sparkle. */
export function gemModel(): PrimTree {
  const G1 = [10.6, 15], G2 = [21.4, 15], T1 = [13.4, 12.0], T2 = [18.6, 12.0], I1 = [14.4, 13.4], I2 = [17.6, 13.4], C1 = [13.0, 15], C2 = [19.0, 15], B = [16, 23.4];
  const F = (pts: number[][], n: [number, number, number]): PrimTree[number] => P(pts.flat(), 'item_crystal', { n });
  const parts = [
    F([G1, C1, B], [-0.6, 0.25, 0.75]),
    F([C1, [16, 15], B], [-0.15, 0.3, 0.94]),
    F([[16, 15], C2, B], [0.3, 0.3, 0.9]),
    F([C2, G2, B], [0.62, 0.25, 0.74]),
    F([G1, T1, I1, C1], [-0.6, -0.45, 0.66]),
    F([I1, I2, C2, C1], [0, -0.2, 0.98]),
    F([T2, G2, C2, I2], [0.62, -0.35, 0.7]),
    F([T1, T2, I2, I1], [-0.1, -0.7, 0.7]),
    X(13.2, 13.0, 0.6, 2.2, 'item_glint:4', { em: true, glow: false }), X(12.4, 13.8, 2.2, 0.6, 'item_glint:4', { em: true, glow: false }),
  ];
  return [Sh(16.6, 23.4, 4.4, 1.6, 0.42), rot(T(parts, { s: 1.15, px: 16, py: 17 }), -10, 16, 18)];
}

/** An old iron key: ring bow, collared shank, a toothed bit. */
export function keyModel(): PrimTree {
  const c = 16;
  const out: Out = [];
  out.push(loop(c, 7.6, 2.8, 2.8, 0.85, 'iron', 16));
  out.push(K(c - 1.4, 11.2, c + 1.4, 11.2, 0.6, 0.6, 'iron'));
  out.push(K(c, 10.4, c, 23.4, 0.75, 0.75, 'iron'));
  out.push(P([c, 19.2, c + 3.6, 19.2, c + 3.6, 20.5, c + 2.5, 20.5, c + 2.5, 21.7, c + 3.6, 21.7, c + 3.6, 23.6, c, 23.6], 'iron', { bv: 0.5 }));
  return lay(out, -45, 4.0, 24.2, 1.2);
}
