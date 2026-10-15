import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { DARK } from './family';
import './materials';

/**
 * Vigdís of the Sól-Brand, the Zealots' leader: a Midgard farm-wife in the Zealot's robe, her
 * headscarf thrown back over flax braids, one hand raised to show the sun-brand burned into
 * her palm, the other holding the coven's sun-standard. Idle: the braids sway, the brand
 * pulses, the sun on the standard turns.
 */
export function vigdisModel(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const out: PrimTree[number][] = [Sh(16, 28.6, 9, 2.2, 0.5)];
  const hx = 15.6;
  const hy = 7.6 + b * 0.35;

  // the sun-standard, planted behind her near hand: an iron pole crowned with a sun disc
  out.push(K(22.8, 27.6, 23.4, 6.4, 0.55, 0.45, 'iron'));
  const k = f % 4;
  out.push(E(23.4, 5, 2.5, 2.5, 'emFire'), E(23.4, 5, 1.3, 1.3, 'emFireCore'));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 0.2;
    out.push(X(23.4 + Math.cos(a) * 3.2 - 0.3, 5 + Math.sin(a) * 3.2 - 0.3, 0.6, 0.6, 'emFire:4', { em: true }));
  }
  out.push(Lt(23.4, 5.2, 9, '#ff8a2c', 0.85));

  // flax braids hanging down the back, swaying
  out.push(K(hx - 2.2, hy + 1, hx - 3.4 + sw * 0.3, hy + 9.6, 0.9, 0.6, 'hairFlax'));
  out.push(K(hx + 1.4, hy + 1.6, hx + 1.8 + sw * 0.3, hy + 8.8, 0.8, 0.55, 'hairFlax'));

  // the robe: broad at the hem, charred and ember-flecked along its edge
  out.push(P([11.4, 11.6, 19.6, 11.6, 21.6, 27.8, 19.4, 27, 17, 28.4, 14.8, 27.2, 12.4, 28.4, 9.6, 27.6], 'mon1_zealRobe', { bv: 1.2 }));
  out.push(P([9.8, 25, 21.2, 25, 21.6, 27.8, 20, 26.8, 18.6, 28.4, 17, 27, 15.2, 28.4, 13.2, 27, 11.6, 28.4, 9.6, 27.6], 'mon1_char', { bv: 0.5 }));
  out.push(X(12, 24.4, 0.6, 0.6, 'emFire:3', { em: true }), X(19.4, 24.2, 0.6, 0.6, 'emFire:3', { em: true }), X(15.8, 24.6, 0.5, 0.5, 'emFire:3', { em: true }));
  out.push(K(11.8, 18.6, 19.8, 18.6, 0.6, 0.6, 'leatherDark'));
  out.push(X(15.2, 18.1, 1.2, 1, 'iron:4'));

  // the headscarf, thrown back off the head onto the shoulders
  out.push(E(hx - 1.2, hy + 3.6, 4, 2, 'mon1_zealRobe', { ink: -0.1 }));
  out.push(K(hx - 0.2, 11.6, hx + 0.2, hy + 2, 1, 0.9, 'skin'));
  // head: a weathered face, hair parted and pulled back, set mouth
  out.push(E(hx, hy, 2.7, 3, 'skin', { fl: 0.15 }));
  out.push(E(hx - 0.4, hy - 1.6, 2.8, 1.8, 'hairFlax'));
  out.push(X(hx - 0.2, hy - 0.2, 0.6, 0.6, DARK), X(hx + 1.6, hy - 0.1, 0.55, 0.55, DARK));
  out.push(X(hx - 0.1, hy - 0.1, 0.3, 0.3, '#fff1c2'), X(hx + 1.7, hy, 0.25, 0.25, '#fff1c2'));
  out.push(X(hx + 0.3, hy + 1.6, 1.4, 0.35, DARK));

  // far arm: raised, palm out, the sun-brand burning in it
  out.push(K(12, 12.6, 9, 9.4, 1.2, 1, 'mon1_zealRobe'));
  out.push(K(9, 9.4, 8.4, 6.6, 0.85, 0.7, 'skin'));
  out.push(E(8.2, 5.6, 1.3, 1.5, 'skin'));
  out.push(E(8.2, 5.6, 0.75, 0.75, 'mon1_scar'));
  out.push(E(8.2, 5.6, 0.4 + (k % 2) * 0.15, 0.4 + (k % 2) * 0.15, 'emFire', { ink: -0.25 }));
  out.push(Lt(8.2, 5.6, 5, '#ff8a2c', 0.6 + (k % 2) * 0.2));

  // near arm: down to the standard's pole, fist closed on it
  out.push(K(19, 12.6, 21.8, 16.8, 1.2, 1, 'mon1_zealRobe'));
  out.push(E(22.9, 17.4, 1.1, 1.1, 'skin'));
  return out;
}
