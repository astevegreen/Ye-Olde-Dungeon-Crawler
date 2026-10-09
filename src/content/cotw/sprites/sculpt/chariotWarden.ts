import { E, K, P, X, Lt, Sh, arc, type PrimTree } from './kit';
import './materials';

/**
 * The Sun-Chariot Warden: an iron war-chariot given legs. The car's breastwork is its chest,
 * the stolen sun-disc is the hub of the great wheel turning behind it, and its head is the
 * chariot horse's iron skull. Idle: the core pulses, the wheel turns, heat rises off the joints.
 */
export function chariotWardenModel(f: number): PrimTree {
  const pulse = [0, 0.35, 0.7, 0.35][f % 4];
  const out: PrimTree[number][] = [Sh(16, 28.6, 13.5, 2.4, 0.5)];
  const cx = 15.2;
  const cy = 17.2;
  // the wheel behind: spokes, iron rim, bronze studs; it turns one spoke-step over the loop
  const wr = 10.8;
  const rot = (f * Math.PI) / 16;
  const spoke = (i: number): number => rot + (i * Math.PI) / 4 + Math.PI / 8;
  for (let i = 0; i < 8; i++) out.push(K(cx, cy, cx + Math.cos(spoke(i)) * (wr - 0.6), cy + Math.sin(spoke(i)) * (wr - 0.6), 0.85, 0.6, 'bronze'));
  out.push(arc(cx, cy, wr, wr, 0, Math.PI * 2, 24, 1.2, 1.2, 'boss_iron'));
  for (let i = 0; i < 8; i++) out.push(E(cx + Math.cos(spoke(i)) * wr, cy + Math.sin(spoke(i)) * wr, 0.75, 0.75, 'bronze', { occ: false }));
  // legs: pillars on hooved iron feet
  out.push(K(11.6, 21.6, 11, 26.2, 2.4, 2, 'boss_iron'), K(19, 21.6, 19.8, 26.2, 2.4, 2, 'boss_iron'));
  out.push(E(10.6, 27.5, 3, 1.5, 'blackIron'), E(20.2, 27.5, 3.1, 1.5, 'blackIron'));
  // back arm
  out.push(K(8.6, 13.4, 6.4, 19.4, 2.1, 1.8, 'boss_iron', { ink: -0.08 }));
  out.push(K(6.4, 19.4, 6.4, 23.2, 1.9, 1.9, 'boss_iron', { ink: -0.08 }));
  out.push(E(6.6, 24.2, 2.3, 2.2, 'blackIron'));
  // the chariot car: curved bronze breastwork with an iron lip and rivets
  out.push(P([8.4, 12.2, 22, 12.2, 23, 16.6, 21.4, 22.2, 15.2, 24.4, 9.2, 22.2, 7.6, 16.6], 'bronze', { bv: 1.7 }));
  out.push(K(8.6, 12.4, 21.8, 12.4, 1.05, 1.05, 'blackIron'));
  for (const [rx, ry] of [[9.2, 16.4], [10.6, 21], [15.2, 23.2], [19.8, 21], [21.4, 16.4]]) out.push(X(rx - 0.45, ry - 0.45, 0.9, 0.9, 'bronze:5'));
  // the sun-disc core: a hub of white gold in a gold bezel
  const cr = 3.4 + pulse * 0.25;
  out.push(arc(cx, cy, cr + 0.9, cr + 0.9, 0, Math.PI * 2, 12, 0.7, 0.7, 'gold'));
  out.push(E(cx, cy, cr, cr, 'boss_sun'));
  out.push(E(cx - 0.3, cy - 0.3, 1.7 + pulse * 0.4, 1.7 + pulse * 0.4, 'boss_sunWhite'));
  // neck and head: the chariot horse's iron skull, bridled, with a bronze crest
  out.push(K(19, 13, 22.4, 8.6, 2.2, 1.8, 'boss_iron'));
  out.push(P([17.6, 12.4, 19.4, 8.4, 21.6, 5, 23, 4.4, 21.6, 7.6, 20.4, 11.6], 'bronze', { bv: 0.7 }));
  out.push(E(23.2, 7.6, 2.5, 2.3, 'boss_iron'));
  out.push(K(23.8, 8.2, 28.8, 10.8, 1.9, 1.25, 'boss_iron'));
  out.push(K(22.2, 5.8, 21.8, 4.2, 0.6, 0.3, 'boss_iron'), K(23.4, 5.6, 24, 4.2, 0.55, 0.3, 'boss_iron'));
  out.push(P([22.6, 5.6, 24.6, 6, 28.8, 9.4, 28.4, 10.4, 24, 8.4], 'bronze', { bv: 0.5 }));
  out.push(K(23, 9.6, 28.4, 11.6, 0.45, 0.4, 'blackIron', { occ: false }));
  out.push(X(22, 7.2, 1.6, 0.8, 'boss_sun:4', { em: true }));
  // near arm ending in an anvil fist
  out.push(E(21.8, 13.8, 2.4, 2.2, 'boss_iron'));
  out.push(K(22, 14.2, 24.8, 19, 2.3, 1.9, 'boss_iron'));
  out.push(K(24.8, 19, 25.2, 21.8, 2, 2, 'boss_iron'));
  out.push(P([22.2, 21.6, 29.8, 21.6, 29.2, 23.3, 27.8, 23.7, 28.2, 26.4, 23.2, 26.4, 23.6, 23.7, 22.6, 23.3], 'blackIron', { bv: 0.9 }));
  // forge-hot joints, breathing with the core
  const jr = 0.7 + pulse * 0.2;
  for (const [jx, jy] of [[21.8, 13.8], [24.8, 19], [11.3, 24.2], [19.4, 24.2]]) out.push(E(jx, jy, jr + 0.15, jr, 'emFire', { ink: -0.25 + pulse * 0.15 }));
  // heat shimmer rising off the joints
  const heat: Array<[number, number]> = [[21.6, 11.2], [25.4, 16.8], [8.2, 11.4]];
  heat.forEach(([x, y], i) => {
    const k = (f + i) % 4;
    if (k < 3) out.push(K(x + (k === 1 ? 0.5 : -0.3), y - k * 0.9, x + (k === 1 ? -0.3 : 0.4), y - k * 0.9 - 1.6, 0.35, 0.25, 'boss_heat', { ol: false, occ: false }));
  });
  out.push(Lt(cx, cy, 11, '#ffe2a0', 0.75 + pulse * 0.25));
  return out;
}
