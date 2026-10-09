import { E, K, P, X, Lt, Sh, type PrimOptions, type PrimTree } from './kit';
import './materials';

/**
 * Sköll of the Void Bone: the wolf that chases the sun, starved to bone, crouched with its
 * haunch high over a black bone of the void rimmed in violet, ribs bare, a mane of black
 * smoke streaming up off its neck. Idle: the jaw gnaws, the mane drifts.
 */
export function skollModel(f: number): PrimTree {
  const g = [0, 0.7, 1.2, 0.5][f % 4]; // gnaw: the lower jaw works
  const out: PrimTree[number][] = [Sh(16, 28.6, 14.5, 2.2, 0.5)];
  // the smoke mane behind everything, streaming up and back off the neck
  const d = [0, 0.6, 1, 0.4][f % 4];
  const d2 = [0.6, 0, 0.5, 1][f % 4];
  out.push(E(14.6, 15.2, 5.2, 2.6, 'boss_smoke', { ink: -0.04 }));
  // chains of puffs that shrink and thin as they rise, then lean back: smoke, not fins; kept left of the ears
  const wisps: Array<[number, number, number, number, number, number]> = [[11.4, 14.8, 4.6, 6, 1.9, d], [14.8, 14.2, 6, 9.4, 2.3, d2], [18.2, 14.8, 6.2, 11, 2.3, d]];
  wisps.forEach(([x0, y0, dx, h, r, dd], i) => {
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const px = x0 - dx * t * t + Math.sin(t * 3 + i) * 0.6 * dd;
      const py = y0 - h * Math.sin(t * Math.PI * 0.5) + dd * 0.5 * t;
      const pr = r * (1 - t * 0.62);
      const ink = (i === 1 ? 0.08 : 0) - t * 0.06;
      out.push(E(px, py, pr, pr * 0.9, k < 3 ? 'boss_smoke' : 'boss_smokeThin', { ink, fl: 0.85, occ: false, ol: k < 3 }));
    }
  });
  // tail: a low bare whip of vertebrae trailing smoke
  out.push(K(5.6, 15.8, 3, 19.4, 0.9, 0.6, 'boneOld'), K(3, 19.4, 1.8, 23.4, 0.6, 0.35, 'boneOld'));
  out.push(E(1.8 + d * 0.3, 24.2, 1, 1.4, 'boss_smokeThin', { ol: false }));
  // far legs
  out.push(K(9.4, 17.4, 12.2, 22.6, 1.5, 1, 'boss_voidHide', { ink: -0.12 }), K(12.2, 22.6, 9.8, 27.2, 0.9, 0.7, 'boneOld', { ink: -0.12 }));
  out.push(K(19.6, 19.4, 20.8, 27, 1.1, 0.8, 'boneOld', { ink: -0.12 }));
  // haunch raised high, spine sloping down to low shoulders
  out.push(E(8.6, 17.2, 3.9, 3.6, 'boss_voidHide'));
  out.push(K(9.6, 18.4, 13, 20, 1.6, 1.2, 'boss_voidHide', { ink: -0.08 }));
  out.push(E(16.2, 19.8, 4.8, 3.4, 'boss_voidHide', { ink: -0.14 }));
  for (let i = 0; i < 5; i++) {
    const rx = 13.2 + i * 1.5;
    out.push(K(rx, 16.8 + i * 0.15, rx + 0.9, 22.2 - i * 0.2, 0.42, 0.32, 'bone', { occ: false }));
  }
  out.push(K(5.6, 14.6, 12, 15.4, 0.7, 0.6, 'bone'), K(12, 15.4, 19.4, 17.2, 0.6, 0.6, 'bone'));
  for (const vx of [7, 9, 11, 13.4, 15.6, 17.8]) out.push(X(vx - 0.4, 13.9 + (vx - 7) * 0.22, 0.8, 0.8, 'bone:4'));
  // near hind leg, coiled to spring
  out.push(K(8.2, 17.6, 12.4, 22, 2.3, 1.3, 'boss_voidHide'));
  out.push(K(12.4, 22, 8, 26.2, 1.05, 0.8, 'bone'));
  out.push(K(8, 26.2, 11.4, 27.9, 0.85, 0.7, 'bone'));
  // neck, low and forward
  out.push(K(18, 17.6, 22.4, 20, 2.3, 1.8, 'boss_voidHide'));
  // ears pricked back, the wolf's cue, standing clear of the smoke
  out.push(P([21, 18.4, 22.8, 17.8, 20.6, 13.6], 'boss_voidHide', { bv: 0.5, ink: 0.18 }));
  out.push(P([22.6, 18, 24.2, 18.4, 23.4, 14.2], 'boss_voidHide', { bv: 0.5, ink: 0.24 }));
  // the skull-head
  out.push(E(23.4, 20, 2.8, 2.4, 'bone'));
  // the void bone, black under a violet aura: one end pinned by the paw, the other clamped across the jaws
  const [ax, ay, bx, by] = [19.4, 27.2, 28.8, 23.8];
  const bone = (m: string, r: number, ry: number, o: PrimOptions) => [
    K(ax, ay, bx, by, r, r, m, o),
    E(ax - 0.2, ay - 0.6, r, ry, m, o),
    E(ax + 0.3, ay + 0.5, r, ry, m, o),
    E(bx - 0.3, by - 0.6, r, ry, m, o),
    E(bx + 0.3, by + 0.4, r, ry, m, o),
  ];
  out.push(bone('emUnholy', 1.2, 1.1, { ink: -0.3 }));
  out.push(bone('boss_voidCore', 0.82, 0.76, { ink: -0.6, glow: false }));
  // the lower jaw works across the near side of the bone; the muzzle clamps down
  out.push(K(23.8, 22.6 + g * 0.3, 27.8, 24.6 + g * 0.9, 1, 0.7, 'boneOld'));
  out.push(K(23.6, 20.8, 28.8, 22.6, 1.75, 1.05, 'bone'));
  out.push(X(25.8, 22.8, 0.6, 0.9 + g * 0.3, 'bone:5'), X(27.6, 23.2, 0.6, 0.8 + g * 0.3, 'bone:5'));
  out.push(X(29.2, 21.8, 0.8, 0.8, '#1a1222'));
  out.push(X(23.8, 18.8, 1.6, 1.2, '#120b18'));
  out.push(X(24.2, 19, 1.1, 0.8, 'emUnholy:4', { em: true }));
  out.push(K(21.4, 18.2, 25.8, 18.8, 0.5, 0.4, 'bone', { ink: 0.06, occ: false }));
  // near foreleg pinning the bone's far end
  out.push(K(19.4, 19.6, 20.2, 24.8, 1.5, 1, 'boss_voidHide'));
  out.push(K(20.2, 24.8, 20, 26.2, 1, 0.8, 'bone'));
  out.push(E(20.6, 26.4, 1.8, 0.9, 'bone'));
  out.push(Lt(24.6, 25.8, 5, '#a868ff', 0.35));
  out.push(Lt(24.4, 18.6, 3.5, '#a868ff', 0.35));
  return out;
}
