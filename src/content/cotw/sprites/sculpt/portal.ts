import { E, K, P, X, Lt, Sh, type PrimTree, type Variant } from './kit';
import { block, ell, rune } from './fixture';
import './materials';

type Out = PrimTree[number][];

const PI = Math.PI;

/** The Split Root, the way down: a rift torn through the World Root, sickly light swirling inward between the torn halves. */
function splitRoot(f: number): PrimTree {
  const out: Out = [Sh(16, 28.6, 13.5, 2.4, 0.55)];
  // the rift: dark-edged sickly light, swirling inward
  out.push(E(16, 16.6, 7.2, 12.2, 'fix_rootGlow', { ink: -0.42, fl: 0.7 }));
  out.push(E(16, 17.4, 5.2, 9.4, 'fix_rootGlow', { ink: -0.2, fl: 0.6 }));
  for (let arm = 0; arm < 2; arm++) {
    let prev: number[] | null = null;
    for (let k = 0; k < 9; k++) {
      const th = arm * PI + (f * PI) / 4 + k * 0.62;
      const rr = 0.12 + k * 0.1;
      const pt = [16 + Math.cos(th) * rr * 5.4, 17.4 + Math.sin(th) * rr * 9.8];
      if (prev) out.push(K(prev[0], prev[1], pt[0], pt[1], 0.75 - k * 0.05, 0.7 - k * 0.05, k < 4 ? 'fix_rootCore' : 'fix_rootGlow', { ink: k < 4 ? -0.05 : 0.06 }));
      prev = pt;
    }
  }
  out.push(E(16, 17.4, 1.5, 2.4, 'fix_rootCore'));
  // the two halves of the root, torn apart
  const bark = 'bark';
  const L = [[6, 29.4, 4.4], [5.2, 22, 4], [6.6, 14, 3.4], [9.8, 7.2, 2.8], [13.8, 3.2, 1.7]];
  const R = [[26.4, 29.4, 4.4], [27.2, 22, 4], [25.8, 14, 3.4], [22.6, 7.4, 2.8], [18.8, 3.8, 1.7]];
  for (const side of [L, R]) for (let i = 0; i < side.length - 1; i++) out.push(K(side[i][0], side[i][1], side[i + 1][0], side[i + 1][1], side[i][2], side[i + 1][2], bark));
  // the raw split wood along the tear, lit by the rift
  const rawL = [[8.4, 28.6], [8.2, 21.8], [9.4, 14.2], [11.8, 8.4], [14.6, 4.6]];
  const rawR = [[23.8, 28.6], [24.2, 21.8], [23, 14.2], [20.6, 8.6], [18.2, 5]];
  for (const side of [rawL, rawR]) for (let i = 0; i < side.length - 1; i++) out.push(K(side[i][0], side[i][1], side[i + 1][0], side[i + 1][1], 1.05, 0.9, 'fix_rawWood'));
  // splinters reaching into the rift
  out.push(
    P([9.2, 12.4, 12.4, 13.6, 9.8, 14.6], 'fix_rawWood'), P([8.6, 19.6, 11.4, 21.2, 8.8, 22], 'fix_rawWood'),
    P([22.8, 11.8, 20, 13.4, 22.4, 14.2], 'fix_rawWood'), P([23.6, 23, 20.8, 24.6, 23.6, 25.4], 'fix_rawWood'),
    P([13.6, 5, 16, 6.8, 14.2, 7.2], 'fix_rawWood'), P([18.6, 5.4, 16.6, 7.6, 18.8, 7.6], 'fix_rawWood'),
  );
  // rootlets spread over the floor
  out.push(K(4, 28, 0.6, 29.6, 1.4, 0.5, bark), K(28.2, 28, 31.4, 29.4, 1.4, 0.5, bark), K(10, 29.2, 13.4, 30, 0.9, 0.4, bark));
  out.push(Lt(16, 17, 13, '#c8d84a', 0.95), Lt(16, 26, 7, '#c8d84a', 0.5));
  return out;
}

/** The Path of Light, the way home: a rune arch on a threshold step holding a rippling curtain of dawn. */
function pathOfLight(f: number): PrimTree {
  const st = 'runestone';
  const out: Out = [Sh(16, 28.8, 13.5, 2.3, 0.5)];
  const cx = 16;
  const cy = 13.4;
  const ri = 6.6;
  const ro = 11;
  // threshold step
  out.push(block(4.6, 26.8, 27.4, 29.2, 1.6, st, { bv: 0.4 }));
  // the curtain of light: a door-shaped field with moving strands
  const door = [cx - ri, 27.2].concat(ell(cx, cy, ri, ri, PI, PI * 2, 16)).concat([cx + ri, 27.2]);
  out.push(P(door, 'fix_dawn', { ink: -0.5 }));
  const inner = [cx - ri + 1.6, 27.2].concat(ell(cx, cy + 0.8, ri - 1.6, ri - 1.6, PI, PI * 2, 14)).concat([cx + ri - 1.6, 27.2]);
  out.push(P(inner, 'fix_dawn', { ink: -0.34 }));
  for (let i = -1; i < 6; i++) {
    const x = cx - ri + 0.9 + i * 2.6 + (f * 2.6) / 4;
    if (x < cx - ri + 0.9 || x > cx + ri - 0.9) continue;
    const top = cy - Math.sqrt(Math.max(0, ri * ri - (x - cx) * (x - cx))) + 1.4;
    let prev: number[] | null = null;
    for (let k = 0; k <= 5; k++) {
      const y = top + ((26.6 - top) * k) / 5;
      const xx = x + Math.sin(y * 0.55 + f * (PI / 2) + i) * 0.5;
      if (prev) out.push(K(prev[0], prev[1], xx, y, 0.4, 0.4, 'fix_dawnCore', { ink: -0.12 }));
      prev = [xx, y];
    }
  }
  out.push(E(cx, 19, 1.6, 4.6, 'fix_dawnCore', { ink: -0.04, fl: 0.4 }));
  out.push(K(cx - ri + 0.6, 27, cx + ri - 0.6, 27, 0.45, 0.45, 'fix_dawnCore', { ink: -0.04 })); // light pooling on the sill
  // mortar behind the arch, then the voussoirs
  out.push(P(ell(cx, cy, ro + 0.2, ro + 0.2, PI, PI * 2, 20).concat(ell(cx, cy, ri - 0.2, ri - 0.2, PI * 2, PI, 14)), 'stoneDark'));
  const n = 7;
  const gap = 0.035;
  for (let i = 0; i < n; i++) {
    const a0 = PI + (PI * i) / n + gap;
    const a1 = PI + (PI * (i + 1)) / n - gap;
    const pts = ell(cx, cy, ro, ro, a0, a1, 4).concat(ell(cx, cy, ri, ri, a1, a0, 3));
    out.push(P(pts, st, { bv: 0.9, ink: i === 3 ? 0.06 : 0 }));
  }
  // pillars of stacked blocks
  for (const [x0, x1] of [[cx - ro, cx - ri], [cx + ri, cx + ro]]) {
    out.push(P([x0, cy, x1, cy, x1, 27, x0, 27], st, { bv: 0.9 }));
    out.push(X(x0 + 0.3, 18, x1 - x0 - 0.6, 0.5, `${st}:1`), X(x0 + 0.3, 22.8, x1 - x0 - 0.6, 0.5, `${st}:1`));
  }
  // runes cut into the arch and pillars, lit gold-white
  const g = 'fix_goldWhite';
  out.push(rune('ansuz', cx, 5, 2.8, g, { r: 0.42 }));
  out.push(rune('tiwaz', cx - 7.6, 8.2, 3, g, { r: 0.42 }), rune('uruz', cx + 7.6, 8.2, 3, g, { r: 0.42 }));
  out.push(rune('algiz', cx - 8.8, 15.8, 3, g, { r: 0.42 }), rune('othala', cx + 8.8, 15.8, 3, g, { r: 0.42, aspect: 0.8 }));
  out.push(rune('laguz', cx - 8.8, 20.6, 3, g, { r: 0.42 }), rune('thurisaz', cx + 8.8, 20.6, 3, g, { r: 0.42 }));
  out.push(Lt(cx, 17, 13, '#ffe2a0', 0.9), Lt(cx, 26, 7, '#fff2cc', 0.5));
  return out;
}

/**
 * The portals, four idle frames. Ways out are doors, not discs: `root` is the rift torn through
 * the World Root, swirling down; `light` the rune arch holding a rippling curtain of dawn, the
 * way home. Any other kind draws the root.
 */
export function portalModel(f: number, v: Variant & { kind: 'root' | 'light' }): PrimTree {
  return v.kind === 'light' ? pathOfLight(f) : splitRoot(f);
}
