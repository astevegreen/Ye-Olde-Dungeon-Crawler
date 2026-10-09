import { E, K, P, X, Lt, Sh, arc, breath, type PrimTree } from './kit';
import './materials';

/**
 * Iviðja, the Ironwood troll-witch: a tall gaunt troll-wife under the antler-crowned mask,
 * cloaked in bark and moss, roots coiling up her arms, rune-light gathering at her
 * fingertips. Idle: the roots coil, the light pulses, a rune turns in her palm.
 */
export function ividjaModel(f: number): PrimTree {
  const b = breath(f);
  const out: PrimTree[number][] = [Sh(15.6, 28.6, 9.5, 2.2, 0.5)];
  // long grey hair behind
  out.push(P([13.4, 5.6, 17, 5, 16.4, 12, 13.6, 19, 11.4, 15.8, 12.4, 10], 'hairGrey', { ink: -0.18 }));
  // the bark cloak: narrow at the shoulders, ragged at the hem, hanging in folds
  out.push(P([12.6, 9.4, 18.8, 9.4, 20.4, 18, 21.6, 27.4, 20.2, 26.6, 19, 28.4, 17.2, 26.8, 15.4, 28.6, 13.6, 26.8, 11.8, 28.4, 10.2, 27, 11, 18], 'bark', { bv: 1.2 }));
  out.push(K(13, 12, 11.4, 26.8, 0.9, 1.6, 'bark'));
  out.push(K(15.6, 12.4, 15.4, 27.4, 0.9, 1.7, 'bark'));
  out.push(K(18.2, 12, 19.8, 26.6, 0.9, 1.5, 'bark'));
  out.push(K(14.2, 13, 13.4, 27, 0.35, 0.5, 'bark', { ink: -0.3, occ: false }), K(17, 13, 17.6, 27, 0.35, 0.5, 'bark', { ink: -0.3, occ: false }));
  out.push(E(15.4, 10.4 - b * 0.15, 4.2, 2.3, 'boss_moss'));
  out.push(P([11.2, 10.6, 13.4, 11.6, 12.8, 15, 12, 13.6, 11.4, 16.4], 'boss_moss'));
  // back arm: long, hanging, claws past the knee, root-bound
  out.push(K(11.6, 11, 9.8, 17.4, 1.2, 1, 'boss_trollWife', { ink: -0.08 }));
  out.push(K(9.8, 17.4, 9.2, 21.6, 1, 0.8, 'boss_trollWife', { ink: -0.08 }));
  for (const [ex, ey] of [[8.2, 24], [9.2, 24.6], [10.4, 23.8]]) out.push(K(9.3, 21.8, ex, ey, 0.4, 0.2, 'boss_trollWife', { ink: -0.1 }));
  const rc = (f % 4) * 0.9;
  out.push(K(9.8, 14.4 + rc * 0.5, 11.8, 15.4 + rc * 0.5, 0.45, 0.45, 'boss_root', { occ: false }));
  out.push(K(9, 18.4 + rc * 0.4, 10.6, 19.4 + rc * 0.4, 0.45, 0.45, 'boss_root', { occ: false }));
  // the head: antlers first, so the mask sits in front of their roots
  const hx = 17.2;
  const hy = 6.8 - b * 0.2;
  const antlers: Array<[number, number, number, number, number, number]> = [
    [hx - 1.2, hy - 2.2, hx - 4.8, hy - 4.2, 0.85, 0.55], [hx - 4.8, hy - 4.2, hx - 8.6, hy - 4.6, 0.55, 0.3],
    [hx - 4.2, hy - 4, hx - 5, hy - 6.6, 0.45, 0.22], [hx - 6.6, hy - 4.5, hx - 7.6, hy - 6.8, 0.4, 0.2],
    [hx - 8.4, hy - 4.6, hx - 9.4, hy - 3, 0.35, 0.2],
    [hx + 1, hy - 2.4, hx + 4.2, hy - 4.6, 0.85, 0.55], [hx + 4.2, hy - 4.6, hx + 8.2, hy - 5.2, 0.55, 0.3],
    [hx + 3.6, hy - 4.4, hx + 4.2, hy - 6.8, 0.45, 0.22], [hx + 6, hy - 5, hx + 6.6, hy - 7.2, 0.4, 0.2],
    [hx + 8, hy - 5.2, hx + 9.2, hy - 3.6, 0.35, 0.2],
  ];
  for (const [x1, y1, x2, y2, r1, r2] of antlers) out.push(K(x1, y1, x2, y2, r1, r2, 'horn'));
  out.push(E(hx - 0.4, hy - 0.2, 2.8, 3.1, 'boss_trollWife', { ink: -0.1 }));
  out.push(P([hx - 1.4, hy - 3, hx + 1.8, hy - 3, hx + 3.2, hy - 0.6, hx + 3, hy + 2.2, hx + 1.6, hy + 4.4, hx + 0.4, hy + 3.6, hx - 1, hy + 0.6], 'boss_mask', { bv: 0.9 }));
  out.push(X(hx + 0.1, hy - 1.1, 1.2, 1.1, '#141018'), X(hx + 1.9, hy - 1, 1, 1, '#141018'));
  out.push(X(hx + 0.4, hy - 0.8, 0.6, 0.6, 'emArcane:4', { em: true }), X(hx + 2.1, hy - 0.7, 0.6, 0.55, 'emArcane:4', { em: true }));
  out.push(K(hx + 0.6, hy + 1.4, hx + 2.6, hy + 1, 0.25, 0.25, 'boss_mask', { ink: -0.3, occ: false }));
  out.push(K(hx - 0.6, hy - 2.6, hx - 0.8, hy + 0.4, 0.3, 0.3, 'boss_mask', { ink: -0.25, occ: false }));
  // near arm reaching out, root-bound, fingers spread on the rune-light
  out.push(E(19.4, 11, 1.8, 1.7, 'boss_moss'));
  out.push(K(19.6, 11.4, 22.4, 15.4, 1.25, 1, 'boss_trollWife'));
  out.push(K(22.4, 15.4, 25.4, 12.6, 1, 0.8, 'boss_trollWife'));
  out.push(K(20, 12.4 + rc * 0.3, 21.6, 11.6 + rc * 0.3, 0.45, 0.45, 'boss_root', { occ: false }));
  out.push(K(21.8, 14.6 - rc * 0.2, 23, 13.6 + rc * 0.3, 0.45, 0.45, 'boss_root', { occ: false }));
  out.push(K(23.4, 14.6 - rc * 0.3, 23.8, 12.8, 0.4, 0.4, 'boss_root', { occ: false }));
  const tips: Array<[number, number]> = [[26.8, 9.4], [27.8, 10.8], [28, 12.6]];
  for (const [ex, ey] of tips) out.push(K(25.4, 12.6, ex, ey, 0.4, 0.22, 'boss_trollWife'));
  out.push(K(25.2, 12.8, 25.6, 9, 0.35, 0.2, 'boss_trollWife'));
  [...tips, [25.6, 8.8]].forEach(([ex, ey], i) => {
    const s = 0.45 + ((i + f) % 2) * 0.15 + b * 0.1;
    out.push(E(ex, ey, s, s, 'emArcane'));
  });
  // a rune turning in the palm's light
  const rr = 1.6 + b * 0.35;
  out.push(arc(28.2, 9.6, rr, rr, f * 0.4, f * 0.4 + 4.2, 5, 0.22, 0.22, 'emArcane', { ink: -0.25, occ: false, ol: false }));
  out.push(Lt(26.8, 10.6, 8, '#6aa6ff', 0.65 + b * 0.25));
  return out;
}
