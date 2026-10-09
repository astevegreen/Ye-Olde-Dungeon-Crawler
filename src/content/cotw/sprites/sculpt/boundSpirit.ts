import { E, K, P, X, Lt, Sh, T, arc, sway, type Prim, type PrimTree } from './kit';
import { links, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/**
 * Captive of the Chariot: a spirit of Sól's light, kneeling, its arms dragged down by black
 * chains to iron stakes. The sun-wheel behind it is broken; the light leaks between the links.
 */
function captive(f: number): PrimTree {
  const pl = [0, 0.05, 0.09, 0.05][f];
  const out: Out = [Sh(16, 28.6, 12, 2.2, 0.35)];
  // broken sun-wheel
  const cx = 16.4;
  const cy = 10.8;
  for (let i = 0; i < 9; i++) {
    if (i === 2 || i === 7) continue;
    const a = Math.PI + 0.22 + (i * (Math.PI - 0.44)) / 8;
    const r0 = 5.6;
    const r1 = i % 2 ? 7.6 : 9.2;
    out.push(P([cx + Math.cos(a - 0.11) * r0, cy + Math.sin(a - 0.11) * r0, cx + Math.cos(a + 0.11) * r0, cy + Math.sin(a + 0.11) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], 'mon2_ray', { ink: pl - 0.3 }));
  }
  out.push(arc(cx, cy, 5.1, 5.1, Math.PI + 0.05, Math.PI * 1.4, 4, 0.45, 0.45, 'mon2_ray', { ink: -0.32 }));
  out.push(arc(cx, cy, 5.1, 5.1, Math.PI * 1.55, Math.PI * 1.95, 4, 0.45, 0.45, 'mon2_ray', { ink: -0.32 }));
  // iron stakes driven into the floor, rings on top
  out.push(E(4.6, 28, 2, 0.8, 'stoneDark'), E(27.4, 28, 2, 0.8, 'stoneDark'));
  out.push(K(4.6, 28, 4.6, 24.2, 0.75, 0.55, 'iron'), K(27.4, 28, 27.4, 24.2, 0.75, 0.55, 'iron'));
  out.push(E(4.6, 23.6, 1.1, 1, 'blackIron', { fl: 0.3 }), E(27.4, 23.6, 1.1, 1, 'blackIron', { fl: 0.3 }));
  // kneeling body of light: shins folded under, knees forward
  out.push(K(19.4, 26.4, 11.6, 27.2, 1.3, 1.1, 'emHoly', { ink: pl - 0.16 }));
  out.push(K(13.6, 22, 19.8, 25.4, 2.4, 1.6, 'emHoly', { ink: pl - 0.1 }));
  out.push(E(16, 17.8, 3.6, 5, 'emHoly', { ink: pl }));
  out.push(E(16.4, 16.8, 1.8, 2.6, 'mon2_holyCore', { ink: pl }));
  out.push(K(12.8, 14.6, 8.6, 17.6, 1.15, 0.9, 'emHoly', { ink: pl - 0.04 }), K(19.4, 14.4, 23.4, 17.6, 1.15, 0.9, 'emHoly', { ink: pl - 0.04 }));
  out.push(E(17, 11, 2.5, 2.7, 'emHoly', { ink: pl }));
  out.push(X(17.5, 11.5, 0.9, 0.35, 'gold:2'), X(18.9, 11.4, 0.7, 0.35, 'gold:2'));
  // the chains: wrist to stake, across the chest, around the thighs
  out.push(links([8.2, 17.8, 6.2, 21, 4.6, 23.6], 'blackIron', 1));
  out.push(links([23.8, 17.8, 25.8, 21, 27.4, 23.6], 'blackIron', 1));
  out.push(links([12, 13.8, 20.4, 20.4], 'blackIron', 1));
  out.push(links([20.2, 14, 12, 20.6], 'blackIron', 1));
  out.push(links([11, 23.4, 21.4, 24.6], 'blackIron', 1));
  // shackles and the collar, cracked through with light
  out.push(E(8.3, 17.6, 1.25, 1.45, 'blackIron'), E(23.7, 17.6, 1.25, 1.45, 'blackIron'));
  out.push(K(14.4, 13.4, 19, 13.4, 1, 1, 'blackIron'));
  out.push(X(16.4, 12.8, 0.4, 1.2, 'mon2_holyCore:4'), X(8.2, 17, 0.35, 1.1, 'mon2_holyCore:4'), X(23.6, 17.2, 0.35, 1.1, 'mon2_holyCore:4'));
  out.push(Lt(16, 17, 12, '#ffe9b0', 0.4));
  return out;
}

/** Choke-Damp Phantasm: the gas that killed a mine crew, wearing its last victim's face, his lamp still swinging inside it. */
function chokedamp(f: number): PrimTree {
  const bob = [0, -0.4, -0.6, -0.3][f];
  const sw = sway(f);
  const g = 'mon2_gas';
  const g2 = 'mon2_gasDeep';
  const h = 'mon2_gasHole';
  const out: Out = [Sh(16, 28.6, 6.5, 1.6, 0.22)];
  const lx = 24.6;
  const ly = 19.6 + sw * 0.25; // the lamp swings from the wisp-hand
  const L: Prim[] = [
    // the tail: the gas thins and curls to the floor
    K(14.2, 18.6, 10.8 + sw * 0.4, 24.2, 3.4, 1.2, g2),
    K(10.8 + sw * 0.4, 24.2, 13.4, 27.2, 1.2, 0.3, g2),
    // wisps streaming off the skull
    K(13.2, 9.4, 6.4 - sw * 0.3, 10.6 + sw * 0.2, 1.8, 0.3, g2),
    K(12.8, 13, 7 - sw * 0.3, 15.8, 1.4, 0.25, g2),
    K(14.6, 7.2, 9.6 - sw * 0.2, 6.6, 1, 0.2, g2),
    // body and the reaching arm
    E(15.4, 16.6, 5.8, 4, g, { a: -0.3 }),
    E(12.4, 19.4, 4, 2.4, g2, { a: 0.4 }),
    K(19.4, 15.6, 23.8, 18.4, 1.9, 0.9, g),
    // a gas skull: brow, cheek, the jaw hanging open
    E(16.8, 10.6, 4.4, 4, g),
    E(17.6, 14.4, 2.6, 2.4, g),
    K(13.2, 15.2, 20.2, 12.4, 0.45, 0.3, 'mon2_gasLight', { occ: false }),
    K(12.6, 9.6, 15.4, 7, 0.4, 0.25, 'mon2_gasLight', { occ: false }),
    E(15.4, 10.4, 1.35, 1.75, h, { a: 0.35 }),
    E(19, 10.2, 1.2, 1.6, h, { a: -0.3 }),
    X(15.3, 10.5, 0.75, 0.75, 'emPoison:4'), X(18.7, 10.3, 0.7, 0.7, 'emPoison:4'),
    E(17.8, 14.6, 1.25, 2.1, h),
    // the dead miner's lamp, glass cracked, guttering
    K(lx - 0.6, ly - 1.8, lx, ly - 0.4, 0.22, 0.22, 'iron', { ol: false }),
    E(lx, ly, 1.4, 0.6, 'bronze'),
    K(lx, ly + 0.8, lx + 0.1, ly + 2.8, 1.1, 1.1, 'mon2_lampGlass', { ink: [0, -0.14, 0.04, -0.08][f] }),
    K(lx - 0.9, ly + 0.6, lx - 0.8, ly + 2.9, 0.22, 0.22, 'blackIron'), K(lx + 0.9, ly + 0.6, lx + 1, ly + 2.9, 0.22, 0.22, 'blackIron'),
    X(lx - 0.2, ly + 1, 0.4, 1.4, `${h}:1`),
    E(lx + 0.1, ly + 3.4, 1.5, 0.65, 'bronze'),
    // a coil of gas wrapped round it
    K(lx - 2.2, ly + 1.4, lx + 2, ly + 2.6, 0.7, 0.4, g),
    Lt(lx, ly + 1.8, 6, '#e8c860', 0.6),
    Lt(17, 10.4, 6, '#95dc4c', 0.35),
  ];
  return [out, T(L, { dy: bob })];
}

/** Bound and broken spirits, held where they died or were taken. Kinds: `captive` (chained in light) and `damp` (trapped in the gas that made it). */
export function boundSpiritModel(f: number, v: FamilyVariant): PrimTree {
  return v.kind === 'damp' ? chokedamp(f) : captive(f);
}
