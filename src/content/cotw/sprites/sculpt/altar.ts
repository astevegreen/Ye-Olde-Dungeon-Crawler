import { E, K, P, X, Lt, Sh, T, breath, type Prim, type PrimTree, type Variant } from './kit';
import { block, ell, glint, rune } from './fixture';
import { SHRINES } from './altar2';
import './materials';

type Out = PrimTree[number][];
type AltarKind = 'tyr' | 'odin' | 'hel' | 'loki' | 'urdr' | keyof typeof SHRINES;

const PI = Math.PI;
/** Loki's rune never settles: the fix_chaos materials' bases, one per frame. */
const CHAOS = ['#e05cff', '#6f8cff', '#35e0c8', '#f2dc5a'];

/** The common altar: a plinth, a block and an overhanging slab (the mensa), so it reads as an altar, not a crate. */
function tableAltar(m: string, o: { bodyInk?: number } = {}): PrimTree {
  return [
    Sh(16.6, 28.5, 12.5, 2.4, 0.5),
    block(5.4, 26, 26.2, 29, 2.2, m, { bv: 0.5 }),
    block(8.2, 17.4, 23.6, 26.1, 3, m, { frontInk: o.bodyInk || -0.04 }),
    block(5, 14.4, 26.6, 17.6, 4, m, { bv: 0.6 }),
  ];
}

/** The Ancient Altar of Tyr: weathered grey stone, old blood, his sword laid across the slab, ᛏ in cold iron. */
function tyr(f: number): PrimTree {
  const p = breath(f);
  const m = 'fix_weathered';
  return [
    tableAltar(m),
    // weathering: cracks and a chipped slab edge
    X(9, 15.2, 0.5, 2.2, `${m}:1`), X(9.4, 17.3, 2.2, 0.5, `${m}:1`), X(21.8, 19, 0.5, 3.4, `${m}:1`), X(22.2, 22.2, 1.4, 0.5, `${m}:1`),
    // old blood on the stone, run down over the runes
    E(18.6, 12.8, 2.4, 0.7, 'fix_bloodDry', { fl: 0.8 }), X(18.4, 14.4, 0.8, 2.6, 'fix_bloodDry:3'), X(18.5, 17.4, 0.6, 1.6, 'fix_bloodDry:2'),
    // the sword of Tyr laid across the slab
    P([11.2, 11.6, 24.4, 11.9, 25.6, 12.5, 24.4, 13.1, 11.2, 13.4], 'steel', { bv: 0.6, n: [0, -0.6, 0.8] }),
    X(12, 11.9, 12, 0.45, 'steel:5'),
    K(10.6, 10.2, 10.9, 14.8, 0.7, 0.7, 'iron'),
    K(7.6, 12.5, 10.4, 12.5, 0.75, 0.75, 'leatherDark'),
    E(7, 12.5, 1.15, 1.15, 'iron'),
    rune('tiwaz', 15.9, 21.8, 6.6, 'fix_coldIron', { ink: p * 0.08 }),
    Lt(15.9, 22, 8, '#a9c6ff', 0.5 + 0.18 * p),
  ];
}

/** A stone raven perched on the slab, facing right (or left, flipped). */
function raven(x: number, y: number, flip: boolean): Prim[] {
  const m = 'fix_ravenStone';
  const r = [
    P([x - 1.6, y + 0.4, x - 4.4, y + 2.4, x - 3.6, y + 0.4], m, { bv: 0.4 }), // tail
    E(x, y, 2.6, 1.8, m, { a: -0.4 }),
    E(x + 2.1, y - 1.9, 1.45, 1.35, m),
    P([x + 3.3, y - 2.5, x + 5.4, y - 1.6, x + 3.3, y - 1.2], m, { bv: 0.3 }), // beak
    X(x + 2.3, y - 2.5, 0.65, 0.65, 'fix_goldWhite:5', { em: true, glow: false }),
    K(x + 0.4, y + 1.4, x + 0.6, y + 2.8, 0.45, 0.45, m),
  ];
  return flip ? T(r, { flip: true, px: x, py: y }) : r;
}

/** Odin's galdr altar: runestone, two stone ravens on the slab, a knotwork band, ᚨ in gold-white. */
function odin(f: number): PrimTree {
  const p = breath(f);
  const m = 'runestone';
  return [
    tableAltar(m),
    raven(8.6, 10.6, false),
    raven(24.2, 10.1, true),
    // a knotwork band carved along the slab front
    X(7, 15.7, 17.6, 0.5, `${m}:1`),
    rune('ansuz', 16.2, 21.8, 6.6, 'fix_goldWhite', { ink: p * 0.08 }),
    Lt(16.2, 22, 8, '#ffe2a0', 0.5 + 0.18 * p),
  ];
}

/** Hel's skull: the dark half first, then the bone half laid over its left side. */
function halfSkull(x: number, y: number): Prim[] {
  return [
    E(x, y, 3.5, 3.2, 'fix_helFlesh'),
    P([x - 2.6, y + 1, x + 2.8, y + 1, x + 2.2, y + 3.9, x - 2, y + 3.9], 'fix_helFlesh', { bv: 0.6 }),
    P(ell(x, y, 3.5, 3.2, PI / 2, PI * 1.5, 14).concat([x, y - 3.2]), 'bone', { bv: 1.2 }),
    P([x - 2.6, y + 1, x, y + 1, x, y + 3.9, x - 2, y + 3.9], 'bone', { bv: 0.5 }),
    X(x - 2.3, y - 0.2, 1.4, 1.5, '#1a1022'), // empty socket
    X(x + 0.9, y - 0.2, 1.4, 1.5, 'emUnholy:4', { em: true }), // the dead half sees
    X(x - 0.3, y + 1.6, 0.6, 0.9, '#1a1022'),
    X(x - 1.8, y + 3, 0.5, 0.8, '#1a1022'), X(x - 0.8, y + 3, 0.5, 0.8, '#1a1022'),
    X(x + 0.4, y + 3, 0.5, 0.8, '#0e0a14'), X(x + 1.4, y + 3, 0.5, 0.8, '#0e0a14'),
  ];
}

/** Hel's galdr altar: black stone, her half-skull on the slab, a crack splitting it like its lady, ᛉ in violet. */
function hel(f: number): PrimTree {
  const p = breath(f);
  const m = 'fix_blackStone';
  return [
    tableAltar(m, { bodyInk: 0.02 }),
    T(halfSkull(16.6, 9.6), { s: 1.3, px: 16.6, py: 13.6 }),
    Lt(18, 9.2, 5, '#a868ff', 0.6),
    X(16.4, 14.6, 0.5, 3, `${m}:1`),
    rune('algiz', 16, 21.8, 6.6, 'emUnholy', { ink: p * 0.08 }),
    Lt(16, 22, 8, '#a868ff', 0.6 + 0.18 * p),
  ];
}

/** Loki's galdr altar: a twisted standing stone wound by a serpent, ᛚ in a colour that never settles. */
function loki(f: number): PrimTree {
  const c = `fix_chaos${f % 4}`;
  const m = 'runestone';
  const s = 'fix_serpent';
  return [
    Sh(16.4, 28.5, 11, 2.4, 0.5),
    block(7, 25.6, 25.4, 29, 2, 'fix_weathered', { bv: 0.5 }),
    // the coils that pass behind the stone
    K(22, 22.5, 10.4, 18.2, 1.35, 1.3, s, { ink: -0.12 }),
    K(21.6, 15.4, 11, 11.8, 1.25, 1.2, s, { ink: -0.12 }),
    // the twisted standing stone
    P([10.4, 26.2, 22, 26.2, 22.6, 21, 21, 15.8, 22, 10.2, 20, 5.6, 15.4, 4.8, 12.4, 8, 13.4, 13.4, 11.4, 19.6], m, { bv: 1.6 }),
    X(14.4, 12.8, 5.2, 0.5, `${m}:1`), X(13.2, 20.4, 6.4, 0.5, `${m}:1`), // the twist's grooves
    // the coils across the front
    K(9.4, 24.6, 22.8, 20.4, 1.45, 1.35, s),
    K(9.8, 17.6, 22.4, 13.6, 1.35, 1.25, s),
    // head reared over the stone, jaws open
    K(10.6, 11.4, 12.2, 6.4, 1.2, 1.1, s),
    K(12.2, 6.4, 15.6, 3.6, 1.1, 1.0, s),
    E(17.6, 3.6, 2.6, 1.6, s, { a: 0.12 }),
    P([18.4, 4.6, 21.4, 6.6, 18, 5.6], s, { bv: 0.3 }),
    X(19.6, 4.9, 0.4, 0.9, 'bone:4'),
    X(17.9, 2.7, 0.7, 0.6, 'eyeAmber:4', { em: true, glow: false }),
    // tail on the plinth
    K(22.6, 25.2, 25.6, 24.4, 1.0, 0.4, s),
    rune('laguz', 16.9, 9.7, 6.2, c, { r: 0.68 }),
    Lt(16.6, 10.4, 6.5, CHAOS[f % 4], 0.45),
  ];
}

/** Urðr's Pool: a pale stone basin of still, starlit water; two stars burn bright each frame. ᚢ in silver. */
function urdr(f: number): PrimTree {
  const m = 'fix_paleStone';
  const p = breath(f);
  const stars = [[11.6, 15.4], [14.6, 14.4], [17.2, 16.2], [20.4, 14.8], [22.6, 16], [9.6, 16.4], [18.8, 13.8], [13.2, 16.6]];
  const out: Out = [
    Sh(16, 28.4, 12, 2.4, 0.5),
    E(16, 27.4, 7.6, 2, 'stone'),
    P([12.4, 27.4, 19.6, 27.4, 18.2, 21, 13.8, 21], 'stone', { bv: 1.4 }),
    P(ell(16, 15.5, 11.6, 8.2, 0, PI, 18), m, { bv: 2.6 }), // the bowl
    P(ell(16, 15.5, 11.6, 3.7), m, { n: [0, -0.93, 0.37], bv: 0.8 }), // its rim
    P(ell(16, 15.3, 9.6, 2.7), 'stoneDark', { n: [0, 0.3, 1] }), // the inner wall
    P(ell(16, 15.9, 9.4, 2.3), 'fix_starWater', { ink: -0.32 }), // still water
    P(ell(15, 16.1, 5.6, 1.1), 'fix_starWater', { ink: -0.18 }), // a sheen of starlight
  ];
  stars.forEach(([x, y], i) => {
    const k = (i + f) % 4;
    if (k === 0) out.push(glint(x, y, 0.9));
    else if (k === 2) out.push(X(x - 0.3, y - 0.3, 0.6, 0.6, 'fix_star:5', { em: true }));
    else out.push(X(x - 0.25, y - 0.25, 0.5, 0.5, 'fix_starWater:5', { em: true, glow: false }));
  });
  out.push(
    rune('uruz', 16, 20.1, 5, 'fix_silver', { ink: p * 0.08, r: 0.55 }),
    Lt(16, 15.8, 14, '#9fb8ff', 0.55 + 0.1 * p),
    Lt(16, 20, 6, '#dde8ff', 0.6),
  );
  return out;
}

const ALTARS: Record<AltarKind, (f: number) => PrimTree> = { tyr, odin, hel, loki, urdr, ...SHRINES };

/**
 * The altars, four idle frames. Each god gets a silhouette, not a letter: a sword on Tyr's slab,
 * Odin's ravens, Hel's half-skull, Loki's serpent stone, Urðr's starlit pool; and the shrines of
 * altar2.ts: Verðandi's loom, Skuld's mirror, Ratatoskr's roost, a duergar barrow. The rune is the
 * one light. An unknown kind draws Tyr's.
 */
export function altarModel(f: number, v: Variant & { kind: AltarKind }): PrimTree {
  return (ALTARS[v.kind] ?? tyr)(f);
}
