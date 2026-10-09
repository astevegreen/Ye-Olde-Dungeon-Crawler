import { E, K, P, X, Lt, Sh, arc, breath, drip, type PrimTree } from './kit';
import './materials';

/** Ventral scutes up the neck: centre, rotation and size. */
const PLATES: ReadonlyArray<[number, number, number, number]> = [
  [14.7, 19.8, -0.33, 1.35],
  [13.8, 17.5, -0.33, 1.3],
  [13.2, 15.2, 0, 1.25],
  [13.4, 13, 0.3, 1.15],
  [14.1, 11, 0.5, 1.05],
  [15.3, 9.6, 0.95, 0.95],
  [16.6, 8.8, 0.95, 0.85],
];

/**
 * Níðhögg, the Root-Gnawer, the end of the game: a lean black wyrm coiled at the root of the
 * world, rearing with Yggdrasil's splintered root clamped in its jaws, belly lit by the bile
 * it has drunk, rag wings folded. Idle: the coil shifts, bile drips, the eye pulses.
 */
export function nidhoggModel(f: number): PrimTree {
  const b = breath(f);
  const c = [0, 0.3, 0.5, 0.2][f % 4];
  const pulse = [0, 0.5, 1, 0.5][f % 4];
  const out: PrimTree[number][] = [Sh(16, 28.4, 15, 2.6, 0.55)];
  // tattered wing, folded high behind the neck
  out.push(P([12.4, 12, 8.4, 2.4, 5, 3.8, 1.8, 9.8, 1.2, 17.6, 3.2, 15.4, 3.8, 20.4, 5.8, 17.2, 7.2, 21.4, 8.6, 17.6, 10.6, 19.6, 12.6, 16], 'boss_wing', { bv: 1 }));
  out.push(K(12.6, 13, 8.4, 2.4, 1.1, 0.7, 'scaleBlack'));
  out.push(K(8.4, 2.4, 1.8, 9.6, 0.6, 0.3, 'scaleBlack'), K(8.4, 2.4, 3.2, 15, 0.55, 0.3, 'scaleBlack'), K(8.4, 2.4, 6, 17, 0.5, 0.3, 'scaleBlack'));
  out.push(P([8.4, 2.4, 7.2, 0.9, 9.4, 1.8], 'horn'));
  // back of the coil, with a ridge of spines
  const cx = 15.6;
  const cy = 22.4;
  const rx = 12;
  const ry = 3.6;
  out.push(arc(cx, cy - c * 0.3, rx, ry, Math.PI, Math.PI * 2, 10, 2.5, 2.5, 'scaleBlack'));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (1.1 + i * 0.16);
    const sx = cx + rx * Math.cos(a);
    const sy = cy - c * 0.3 + ry * Math.sin(a) - 2.2;
    out.push(P([sx - 0.8, sy + 0.6, sx + 0.8, sy + 0.4, sx - 0.4, sy - 1.4], 'scaleBlack', { bv: 0.3 }));
  }
  // the neck rising in an S
  out.push(K(12.2, 21.4, 9.8, 14.4, 3.6, 3.1, 'scaleBlack'));
  out.push(K(9.8, 14.4, 11.6, 9.2, 3.1, 2.7, 'scaleBlack'));
  out.push(K(11.6, 9.2, 16, 6, 2.7, 2.4, 'scaleBlack'));
  // ventral scutes: separate plates, each lit from within by the bile, dark seams between
  const bi = -0.3 + pulse * 0.12;
  for (const [px, py, a, r] of PLATES) out.push(E(px, py, r * 0.92, 0.7, 'boss_bileBelly', { a, ink: bi }));
  // dorsal spines up the back of the neck
  for (const [sx, sy, a] of [[8, 16.6, 0], [7.6, 12.6, 0.3], [9, 8.8, 0.7], [11.6, 5.4, 1]]) {
    out.push(P([sx + 0.4, sy + 1.2, sx + 1.2 - a * 0.6, sy - 0.6 + a * 0.4, sx - 1.6, sy - 0.2 - a], 'scaleBlack', { bv: 0.4 }));
  }
  // crest of horns like broken roots, swept back
  const hy = 5.4 - b * 0.3;
  out.push(K(16.6, hy - 1.2, 9.6, hy - 2.4, 1.15, 0.45, 'boss_rootHorn'));
  out.push(K(12.6, hy - 1.9, 11.4, hy - 4, 0.45, 0.2, 'boss_rootHorn'));
  out.push(K(17.8, hy - 2.2, 13.8, hy - 3.75, 1, 0.4, 'boss_rootHorn'));
  out.push(K(16.4, hy - 2.7, 15.6, hy - 4, 0.4, 0.2, 'boss_rootHorn'));
  out.push(K(19.4, hy - 2.4, 19, hy - 3.85, 0.8, 0.35, 'boss_rootHorn'));
  out.push(K(15.6, hy - 0.2, 10.6, hy - 1.2, 0.85, 0.3, 'boss_rootHorn'));
  out.push(K(12.4, hy - 0.9, 11.2, hy + 0.8, 0.35, 0.2, 'boss_rootHorn'));
  // the head: a long wedge, jaws wide on the root
  out.push(P([19.6, hy + 2.2, 28, hy + 4.4, 29.4, hy + 7, 20.6, hy + 5], 'boss_maw'));
  out.push(P([19.4, hy + 3, 27.6, hy + 5.2, 28.6, hy + 7.2, 25.4, hy + 7.2, 19.8, hy + 5.2], 'scaleBlack', { bv: 0.6, ink: -0.04 }));
  out.push(E(18.8, hy, 3.7, 3, 'scaleBlack', { a: 0.2 }));
  out.push(P([18.2, hy - 2.4, 23, hy - 1.6, 30, hy + 2.4, 29.6, hy + 3.8, 21.6, hy + 3, 17.6, hy + 1.6], 'scaleBlack', { bv: 0.8 }));
  out.push(K(18.6, hy - 2, 24, hy - 1, 0.55, 0.45, 'scaleBlack', { ink: 0.14, occ: false }));
  for (const tx of [22.2, 24, 25.8, 27.6]) out.push(P([tx - 0.45, hy + 2.7 + (tx - 22) * 0.12, tx + 0.45, hy + 2.9 + (tx - 22) * 0.12, tx, hy + 4.2 + (tx - 22) * 0.12], 'bone'));
  for (const tx of [23.4, 26.4]) out.push(P([tx - 0.4, hy + 5.6 + (tx - 22) * 0.2, tx + 0.4, hy + 5.6 + (tx - 22) * 0.2, tx, hy + 4.4 + (tx - 22) * 0.2], 'bone'));
  // the root it gnaws: splintered, its fibres hanging from the jaws
  out.push(K(20.6, hy + 4.4, 30.4, hy + 4.2, 0.9, 0.7, 'boss_fibre'));
  out.push(K(29.4, hy + 4.3, 30.9, hy + 3.2, 0.45, 0.25, 'boss_fibre'), K(29.6, hy + 4.4, 30.9, hy + 5.6, 0.4, 0.2, 'boss_fibre'));
  out.push(K(23.6, hy + 4.8, 23, hy + 9.4, 0.35, 0.2, 'boss_fibre'));
  out.push(K(25.2, hy + 4.8, 25.8, hy + 8.2, 0.3, 0.18, 'boss_fibre'));
  out.push(K(28, hy + 4.8, 28.8, hy + 9.8, 0.35, 0.2, 'boss_fibre'));
  // eye under a heavy brow, pulsing
  const er = 0.12 * pulse;
  out.push(X(20.9 - er, hy - 0.9 - er, 1.6 + er * 2, 1.1 + er * 2, 'emPoison:4', { em: true }));
  out.push(X(21.8, hy - 0.7, 0.6, 0.6, '#e2ff9a', { em: true }));
  // bile drooling from the jaw
  out.push(drip(26.8, hy + 7.2, 8, f, 0, 'boss_bile', 0.55));
  out.push(drip(21.8, hy + 5.4, 9.4, f, 2, 'boss_bile', 0.45));
  // front of the coil, and the tail tip curling up at the right
  out.push(arc(cx, cy + c * 0.3, rx, ry, 0, Math.PI, 12, 2.6, 2.6, 'scaleBlack'));
  out.push(K(4.2, 23.2, 6.2, 25.6, 2.4, 2.4, 'scaleBlack'));
  out.push(K(27.6, 22.6 + c * 0.3, 30.2, 18.8, 2, 1, 'scaleBlack'));
  out.push(K(30.2, 18.8, 29, 16.2, 1, 0.35, 'scaleBlack'));
  out.push(P([29.6, 18, 31, 16.6, 30.4, 19.4], 'scaleBlack', { bv: 0.3 }));
  out.push(Lt(14.4, 14.4, 9, '#95dc4c', 0.5 + pulse * 0.15));
  out.push(Lt(14, 27, 9, '#95dc4c', 0.3 + pulse * 0.1, 2));
  out.push(Lt(21.8, hy - 0.4, 5, '#95dc4c', 0.45 + pulse * 0.2));
  return out;
}
