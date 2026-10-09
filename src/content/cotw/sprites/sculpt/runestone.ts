import { E, K, P, X, Lt, Sh, bolt, breath, drip, type Prim, type PrimTree, type Variant } from './kit';
import { glint, ring, rune } from './fixture';
import './materials';

/*
 * The Skaldic Runestones: one carved picture-stone per chapter of the saga, set straight in the
 * floor on packing stones (no plinth, nothing to kneel at). A carved serpent band runs round its
 * face carrying the inscription; its rune ᚱ (every stone's tile glyph) glows in the chapter's light.
 */

type Chapter = 'frost' | 'smithy' | 'dawn' | 'lament' | 'norns' | 'twilight';

/** Each chapter's stone, the paint in its band, its rune and that rune's light. */
const LOOK: Record<Chapter, { stone: string; paint: string; rune: string; light: string }> = {
  frost: { stone: 'alt_rimeStone', paint: 'alt_paintRime', rune: 'emFrost', light: '#9fe6ff' },
  smithy: { stone: 'alt_sootStone', paint: 'alt_paintOchre', rune: 'alt_ember', light: '#ff8a3a' },
  dawn: { stone: 'alt_obsidian', paint: 'gold', rune: 'fix_dawn', light: '#ffdf96' },
  lament: { stone: 'alt_veinStone', paint: 'silver', rune: 'fix_silver', light: '#dde8ff' },
  norns: { stone: 'alt_worldBark', paint: 'alt_moss', rune: 'fix_goldWhite', light: '#ffe2a0' },
  twilight: { stone: 'fix_blackStone', paint: 'alt_paintViolet', rune: 'emUnholy', light: '#a868ff' },
};

const PI = Math.PI;
const THIN = { ol: false, occ: false };
/** The face: a rough-hewn slab, broad at the foot, tapering to a lopsided crown. */
const FACE = [9.6, 28.6, 9.2, 21, 9.4, 13.6, 10.6, 8, 13, 4.2, 16.6, 2.6, 19.8, 3.6, 22, 7, 22.9, 13, 22.8, 21, 22.4, 28.6];
/** The same outline set back and up: the stone's thickness showing on the right and top. */
const BACK = FACE.map((v, i) => v + (i % 2 ? -0.6 : 0.9));
/** The serpent band's path, just inside the edge, from its head at the left foot round to its tail. */
const BAND = [11.2, 26.4, 10.7, 21, 10.9, 13.8, 11.9, 8.8, 13.9, 5.8, 16.7, 4.4, 19.2, 5.2, 20.8, 8, 21.5, 13.2, 21.3, 21, 20.8, 26.4];

/** Rune-marks along the band, about every two units: the inscription. */
const TICKS: Array<[number, number]> = [];
for (let i = 0; i + 3 < BAND.length; i += 2) {
  const [x0, y0, x1, y1] = BAND.slice(i, i + 4);
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let j = 0; j < n; j++) TICKS.push([x0 + ((x1 - x0) * (j + 0.5)) / n, y0 + ((y1 - y0) * (j + 0.5)) / n]);
}

/** The carved serpent band round the face, its head at the left foot biting toward its tail. */
function band(m: string): PrimTree {
  const out: Prim[] = [];
  for (let i = 0; i + 3 < BAND.length; i += 2) out.push(K(BAND[i], BAND[i + 1], BAND[i + 2], BAND[i + 3], 0.62, 0.62, m));
  return [
    out,
    E(12.4, 26.7, 1.35, 0.85, m, { a: 0.15 }),
    X(12.6, 26.3, 0.45, 0.45, `${m}:0`),
    K(20.8, 26.4, 19.2, 27, 0.62, 0.2, m),
    TICKS.map(([x, y]) => X(x - 0.25, y - 0.25, 0.5, 0.5, `${m}:1`)),
  ];
}

const twinkle = (pts: number[][], f: number, c: string): Prim[] =>
  pts.flatMap(([x, y], i) => ((i + f) % 4 === 0 ? glint(x, y, 0.8, c) : (i + f) % 4 === 2 ? [X(x - 0.3, y - 0.3, 0.6, 0.6, `${c}:5`, { em: true, glow: false })] : []));

/** What lies on the stone under its band: veins, threads, cracks. */
function under(kind: Chapter, f: number): PrimTree {
  switch (kind) {
    case 'smithy': // soot run down from the head
      return [X(13.4, 6.6, 0.6, 4.6, 'alt_sootStone:1'), X(18.6, 6, 0.5, 4.2, 'alt_sootStone:1'), X(16.3, 5.4, 0.5, 2.8, 'alt_sootStone:1')];
    case 'lament': // silver veins, and the crack that weeps
      return [
        bolt(9.6, 12.6, 13.4, 21.4, 7, 4, 0.6, 0.28, 'alt_silverVein').prims,
        bolt(22.6, 15, 18.6, 24.6, 11, 4, 0.6, 0.28, 'alt_silverVein').prims,
        bolt(12.4, 5.2, 14.6, 9.6, 5, 2, 0.5, 0.24, 'alt_silverVein').prims,
        K(19.6, 3.8, 18.4, 8, 0.3, 0.3, 'alt_veinStone', { ...THIN, ink: -0.5 }),
        K(18.4, 8, 19.4, 11.6, 0.3, 0.26, 'alt_veinStone', { ...THIN, ink: -0.5 }),
      ];
    case 'norns': { // three glowing threads, a bead of light running down each
      const out: Prim[] = [];
      (['fix_silver', 'alt_sap', 'alt_bolt'] as const).forEach((m, i) => {
        const x = (y: number): number => 13.6 + i * 2.4 + 0.45 * Math.sin(y * 0.9 + i * 2.1);
        for (let y = 5.4; y < 26; y += 2) out.push(K(x(y), y, x(y + 2), y + 2, 0.22, 0.22, m, { ...THIN, glow: false, ink: -0.1 }));
        const by = 7 + ((f + i * 2) % 4) * 5;
        out.push(E(x(by), by, 0.5, 0.5, m, THIN));
      });
      return out;
    }
    case 'twilight': // a crack up from the foot, violet light in it
      return [
        K(14.6, 28.4, 15.6, 25.6, 0.3, 0.26, 'emUnholy', { ...THIN, ink: -0.15 }),
        K(15.6, 25.6, 14.8, 22.8, 0.26, 0.24, 'emUnholy', { ...THIN, ink: -0.15 }),
        K(14.8, 22.8, 16.2, 20.2, 0.24, 0.16, 'emUnholy', { ...THIN, ink: -0.15 }),
      ];
    default:
      return [];
  }
}

/** The chapter's mark over the band: a crown, a broken hammer, the sun-wheel, mercury, lightning. */
function over(kind: Chapter, f: number): PrimTree {
  switch (kind) {
    case 'frost': // a rime crust on the crown, icicles, the Frost King's crown carved below
      return [
        P([10.1, 8.2, 12.6, 3.9, 16.6, 2.1, 20.1, 3.2, 22.4, 6.9, 21.3, 9.2, 19.4, 6, 16.7, 5, 13.9, 6.4, 11.4, 9.8], 'alt_rime', { bv: 0.6 }),
        K(11.4, 9.6, 11.6, 12.2, 0.42, 0.1, 'alt_rime'), K(21.2, 9, 21, 12, 0.42, 0.1, 'alt_rime'), K(14.4, 6.2, 14.5, 7.8, 0.35, 0.1, 'alt_rime'),
        P([13.2, 24.6, 13.2, 21.8, 14.6, 23.2, 16.2, 21.2, 17.8, 23.2, 19.2, 21.8, 19.2, 24.6], 'alt_paintRime', { bv: 0.4 }),
        twinkle([[12.8, 5], [19.8, 4.6], [21.8, 18.6]], f, 'fix_star'),
      ];
    case 'smithy': // the anvil of the Accord, and the gouge struck through Thrym's rune
      return [
        P([12.2, 21, 13.4, 20.6, 19.6, 20.6, 19.6, 21.8, 17.8, 21.8, 17.8, 23.2, 18.9, 23.6, 18.9, 24.6, 13.7, 24.6, 13.7, 23.6, 14.8, 23.2, 14.8, 21.8, 13.4, 21.8], 'alt_paintOchre', { bv: 0.35 }),
        K(12, 18.8, 20.2, 11.6, 0.36, 0.36, 'alt_sootStone', { ink: -0.4 }),
      ];
    case 'dawn': { // Sól's wheel, turning
      const a0 = (f * PI) / 8;
      return [
        ring(16, 23.1, 2.3, 2.3, 0.38, 'gold', 12),
        [0, 1, 2, 3].map((k) => K(16, 23.1, 16 + 2.1 * Math.cos(a0 + (k * PI) / 2), 23.1 + 2.1 * Math.sin(a0 + (k * PI) / 2), 0.3, 0.3, 'gold')),
        E(16, 23.1, 0.7, 0.7, 'fix_dawnCore'),
      ];
    }
    case 'lament': // mercury weeping from the crack and the rune, running down, pooling at the foot
      return [
        K(19.4, 11.6, 19.6, 16.4, 0.26, 0.2, 'alt_mercury', THIN),
        K(14.2, 19.4, 14.1, 21.6, 0.24, 0.18, 'alt_mercury', THIN),
        drip(19.6, 16.6, 8.4, f, 0, 'alt_mercury', 0.55),
        drip(14.1, 21.8, 5, f, 2, 'alt_mercury', 0.5),
        E(16.8, 28.9, 2.8, 0.55, 'alt_mercury', { fl: 0.6 }),
      ];
    case 'norns': // moss at the foot of the living bark
      return [E(11, 27.6, 1.6, 0.9, 'alt_moss'), E(20.8, 27.8, 1.8, 0.9, 'alt_moss')];
    case 'twilight': // lightning crackles across the face, then sparks
      return f % 2 === 0
        ? bolt(16.6, 11.4, f ? 21.2 : 11, 5.4, 3 + f * 7, 3, 0.8, 0.22, 'alt_bolt').prims
        : glint(f === 1 ? 19.6 : 12.4, f === 1 ? 7.4 : 8.2, 0.8, 'alt_bolt');
    default:
      return [];
  }
}

/**
 * A Skaldic Runestone, four idle frames: a carved picture-stone on its packing stones, the serpent
 * band round its face, ᚱ glowing in its chapter's light. An unknown kind draws the Frost King's.
 */
export function runestoneModel(f: number, v: Variant & { kind: Chapter }): PrimTree {
  const kind = LOOK[v.kind] ? v.kind : 'frost';
  const L = LOOK[kind];
  const p = breath(f);
  const ink = kind === 'smithy' ? [0, 0.1, 0.04, 0.14][f % 4] : p * 0.08; // the smithy's ember flickers
  return [
    Sh(16.4, 28.7, 9.5, 2.2, 0.5),
    P(BACK, L.stone, { n: [0.7, -0.2, 0.7], bv: 0.4 }),
    P(FACE, L.stone, { bv: 0.8 }),
    under(kind, f),
    band(L.paint),
    rune('raidho', 16.2, 15.4, 7.4, L.rune, { ink, r: 0.6 }),
    over(kind, f),
    // packing stones at its foot
    E(10.6, 28.4, 1.9, 1.1, 'stone'), E(21.8, 28.5, 2, 1, 'stone'), E(14, 29, 1.4, 0.7, 'stoneDark'), E(18.8, 29.1, 1.3, 0.7, 'stone'),
    Lt(16.2, 15.4, 9, L.light, 0.55 + 0.18 * p),
  ];
}
