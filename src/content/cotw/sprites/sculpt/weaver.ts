import { E, K, P, X, Lt, Sh, arc, breath, type PrimTree } from './kit';
import { limb } from './family';
import './materials';

/**
 * Malice-Weaver: a spider's legs and a cluster of eyes under a bare brain that pulses
 * rune-blue and thinks at you; the sorcery is in the sac. One kind.
 */
export function weaverModel(f: number): PrimTree {
  const b = breath(f);
  const ch = 'mon2_chitin';
  const pu = b * 0.45;
  const out: PrimTree[number][] = [Sh(16, 28.6, 12.4, 2.2)];
  // a leg: up to a high knee, down and out, a last joint splayed to the floor
  const leg = (p: number[], ink: number) => limb(p, 0.95, 0.3, ch, { ink });
  // far legs
  out.push(leg([20.4, 18.6, 24.8, 9.6, 28.4, 17, 29.6, 24.6], -0.18), leg([19.6, 18.8, 21.4, 12, 23, 19, 23.6, 25.2], -0.18));
  out.push(leg([18, 19, 14.6, 11.6, 13, 18.6, 13.6, 25], -0.18), leg([17.2, 19, 9.4, 10.4, 4.6, 17, 2.6, 24.4], -0.18));
  // chitin cup holding the brain
  out.push(P([6.4, 15.4, 18.6, 15.8, 17.2, 19.6, 8.8, 19.8], ch, { bv: 1 }));
  // the brain-sac
  out.push(E(12.6, 13.8, 6.2 + pu, 5.4 + pu, 'mon2_brain'));
  out.push(limb([7.6, 12.8, 9.4, 11.4, 11.2, 12.8, 13, 11, 15, 12.4, 17, 11.4], 0.32, 0.25, 'mon2_brainFold'));
  out.push(limb([8.2, 15.6, 10, 14.2, 12.2, 15.6, 14.2, 14, 16.4, 15.2], 0.3, 0.22, 'mon2_brainFold'));
  out.push(limb([10.4, 9.6, 12.4, 10.2, 14.4, 9.2], 0.28, 0.2, 'mon2_brainFold'));
  out.push(E(11.4, 10.6, 1.6, 0.9, 'mon2_holyCore', { ink: -0.25 }));
  out.push(arc(12.6, 15.4, 6.6, 1.6, 0.1, Math.PI - 0.1, 8, 0.55, 0.55, ch));
  // stalk and head
  out.push(E(17, 18.6, 2.2, 2, ch));
  // near legs (behind the head on the right, in front on the left)
  out.push(leg([18.4, 20.8, 14.4, 15.4, 11.6, 22, 10.4, 28.2], 0), leg([17.6, 20.4, 11, 12.4, 5.6, 19.6, 3.4, 27.6], 0));
  out.push(leg([20.4, 21, 22.6, 15, 25, 22, 25.6, 28.2], 0), leg([21.4, 20.6, 25.4, 12.6, 29.2, 20.4, 30.4, 27.6], 0));
  out.push(E(21, 19.8, 3.4, 2.8, ch));
  out.push(K(22.6, 21.4, 23.2, 24, 0.75, 0.2, ch), K(23.8, 21, 24.8, 23.4, 0.7, 0.2, ch));
  out.push(X(22.9, 23.6, 0.5, 0.6, 'bone:4'), X(24.5, 23, 0.5, 0.6, 'bone:4'));
  // the eye cluster
  out.push(E(22.4, 18.2, 0.95, 0.95, 'emArcane'), E(24, 18.6, 0.85, 0.85, 'emArcane'));
  out.push(X(20.8, 17.4, 0.65, 0.65, 'emArcane:4'), X(22.8, 16.8, 0.6, 0.6, 'emArcane:4'), X(24.4, 17.2, 0.55, 0.55, 'emArcane:4'), X(22.2, 19.6, 0.55, 0.55, 'emArcane:3'), X(23.8, 19.8, 0.5, 0.5, 'emArcane:3'));
  out.push(Lt(12.6, 13.8, 13, '#6aa6ff', 0.95));
  return out;
}
