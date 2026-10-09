import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { DARK, VIOL, chain, rime, vEye, type FamilyVariant } from './family';
import './materials';

/** A notched blade from a grip at (x, y), leaning `ang` radians right of straight up. */
function notchedBlade(x: number, y: number, ang: number, len: number, w: number, m: string): PrimTree {
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const nx = Math.cos(ang);
  const ny = Math.sin(ang);
  const at = (t: number, s: number): [number, number] => [x + dx * t + nx * s, y + dy * t + ny * s];
  return [
    P([...at(1.1, -w), ...at(1.1, w), ...at(4.6, w * 1.05), ...at(5.4, -w * 0.15), ...at(6.2, w * 1.05), ...at(9, w), ...at(9.7, -w * 0.05), ...at(10.4, w * 0.95), ...at(len - 1.8, w * 0.85), ...at(len, 0), ...at(len - 1.8, -w * 0.9)], m, { bv: 0.8, n: [0.2, -0.1, 1] }),
    K(...at(0.9, -2.6), ...at(0.9, 2.6), 0.72, 0.72, 'bronze'),
    K(...at(0.5, 0), ...at(-1.9, 0), 0.62, 0.62, 'leatherDark'),
    E(...at(-2.5, 0), 0.95, 0.95, 'bronze'),
  ];
}

/**
 * The draugr: the barrow-corpse. Blue-grey skin, rusted mail, a bronze-rimmed helm, white
 * beard-wisps, violet eyes and rime on the shoulders; each kind carries what it died holding.
 * Kinds: `warrior` (helm, shield, notched blade), `ancient` (crown, sword, long beard, taller),
 * `pit` (miner's helm, pick, dead lantern) and `thrall` (rags, chains, the coven's rune).
 */
export function draugrModel(f: number, v: FamilyVariant): PrimTree {
  const kind = v.kind || 'warrior';
  const b = breath(f);
  const sw = sway(f);
  const anc = kind === 'ancient';
  const pit = kind === 'pit';
  const thr = kind === 'thrall';
  const hx = anc ? 16.4 : pit ? 18.6 : thr ? 18.2 : 17.8;
  const hy = (anc ? 8.6 : pit ? 10.8 : thr ? 11 : 9.6) + b * 0.3;
  const ty = 17.4 + b * 0.2;
  const body = thr ? 'mon1_rag' : 'mon1_rustMail';
  const tw = pit ? 5 : 4.5;
  const o: PrimTree[number][] = [Sh(16, 28.6, anc ? 8.2 : 7.4, 2.2)];

  // grave cloak
  if (anc) o.push(P([10.2, 12, 21.8, 12, 23.8 + sw * 0.3, 27.8, 21.2, 26.6, 18.8, 28.4, 16.2, 26.8, 13.6, 28.4, 11.2, 26.8, 8.4 + sw * 0.4, 27.8], 'mon1_royal', { bv: 1.2, ink: -0.03 }));
  else if (!thr) o.push(P([11.8, 12.6, 20, 12.6, 21.6 + sw * 0.3, 25.4, 19.8, 24, 18.4, 26.6, 16.6, 24.4, 14.8, 27, 13, 24.6, 10.6 + sw * 0.4, 26], 'mon1_shroud', { bv: 1, ink: -0.04 }));

  // back arm
  if (kind === 'warrior') o.push(K(12.6, 13.6, 10.8, 18.6, 1.2, 1, body));
  else if (anc) o.push(K(12.2, 13.6, 15.4, 16.6, 1.25, 1.05, body));
  else if (pit) {
    o.push(K(12.2, 13.8, 10.8, 19.6, 1.25, 1.05, body), E(10.7, 20.2, 1.1, 1.1, 'mon1_corpse'));
    // the dead lantern: cold glass, no flame
    const lx = 10.7 + sw * 0.2;
    const ly = 21.4;
    o.push(K(10.7, 20.6, lx, ly, 0.28, 0.28, 'iron'));
    o.push(P([lx - 1.2, ly, lx + 1.2, ly, lx + 1.8, ly + 1, lx - 1.8, ly + 1], 'iron', { bv: 0.4 }));
    o.push(E(lx, ly + 2.7, 1.6, 1.8, 'mon1_deadGlass', { fl: 0.3 }));
    o.push(K(lx, ly + 1, lx, ly + 4.5, 0.28, 0.28, 'iron'), K(lx - 1.5, ly + 1.1, lx - 1.4, ly + 4.4, 0.26, 0.26, 'iron'), K(lx + 1.5, ly + 1.1, lx + 1.4, ly + 4.4, 0.26, 0.26, 'iron'));
    o.push(P([lx - 1.8, ly + 4.4, lx + 1.8, ly + 4.4, lx + 1.2, ly + 5.4, lx - 1.2, ly + 5.4], 'iron', { bv: 0.4 }));
  } else {
    o.push(K(12.9, 13.8, 11.8, 20.4, 0.95, 0.75, 'mon1_corpse'), E(11.7, 21.1, 0.95, 1.1, 'mon1_corpse'));
    o.push(K(11.1, 19.6, 12.5, 19.8, 0.55, 0.55, 'iron'));
  }

  // legs
  const legM = thr ? 'mon1_corpse' : 'mon1_wrap';
  const lr = thr ? 1.05 : 1.5;
  o.push(K(14.2, 21.4, 13.4, 26.8, lr, lr * 0.8, legM), K(17.8, 21.4, 18.8, 26.8, lr, lr * 0.8, legM));
  if (thr) o.push(E(13.3, 27.6, 1.5, 0.9, 'mon1_corpse'), E(19.2, 27.6, 1.5, 0.9, 'mon1_corpse'));
  else o.push(E(13.1, 27.6, 1.9, 1.2, 'leatherDark'), E(19.3, 27.6, 1.9, 1.2, 'leatherDark'));

  // torso
  if (thr) {
    o.push(E(16, ty - 0.4, 3.7, 5.2, 'mon1_corpse', { fl: 0.1 }));
    for (const yy of [-2.8, -1.4, 0]) o.push(X(14.2, ty + yy, 2.4, 0.5, 'mon1_corpse:1'));
    o.push(P([12.4, ty + 2.4, 19.6, ty + 2.4, 20.2, ty + 6.4, 18.4, ty + 5.4, 16.6, ty + 7, 15, ty + 5.4, 12.6, ty + 6.6], 'mon1_rag', { bv: 0.6 }));
    // the troll-witch's daubed rune: an upturned elk-sedge, death's mark
    o.push(K(16.8, ty - 3.4, 16.8, ty + 0.8, 0.34, 0.34, 'mon1_hex'), K(16.8, ty - 1, 18.4, ty + 0.8, 0.3, 0.3, 'mon1_hex'), K(16.8, ty - 1, 15.2, ty + 0.8, 0.3, 0.3, 'mon1_hex'));
    o.push(Lt(16.8, ty - 1, 4, '#8c84ff', 0.45));
  } else {
    o.push(E(16, ty, tw, 5.8, body, { fl: 0.1 }));
    o.push(P([16 - tw + 0.4, ty + 3, 16 + tw - 0.4, ty + 3, 16 + tw + 0.4, ty + 7, 19.4, ty + 6.2, 17.8, ty + 7.4, 16.1, ty + 6.4, 14.4, ty + 7.4, 12.8, ty + 6.4, 16 - tw - 0.4, ty + 7], body, { bv: 0.6 }));
    o.push(K(16 - tw + 0.4, ty + 2.6, 16 + tw - 0.4, ty + 2.6, 0.75, 0.75, 'leatherDark'), X(15.6, ty + 2, 1.4, 1.2, 'bronze:3'));
    if (pit) for (const [x, y] of [[13.4, -1.6], [17.8, 0.4], [14.6, 4.6], [18.8, 5.4], [12.8, 3.6]]) o.push(X(x, ty + y, 0.7, 0.7, 'mon1_ore:4'));
    else o.push(X(13.6, ty - 1.4, 1.2, 1, 'mon1_rust:3'), X(17.6, ty + 0.4, 1, 1.2, 'mon1_rust:2'), X(14.6, ty + 4.6, 1.4, 0.8, 'mon1_rust:3'), X(18.4, ty + 4, 1, 1, 'mon1_rust:3'));
  }

  // frost rime on the shoulders
  if (thr) o.push(rime(13.2, 13, 1.6), rime(19.2, 12.9, 1.5));
  else o.push(rime(12.4, 12.8, 2.3), rime(19.8, 12.6, 2.2));

  // head
  if (anc) o.push(P([hx - 3.2, hy - 1.4, hx - 0.6, hy - 2.6, hx - 1.4, hy + 6.4, hx - 4.6 + sw * 0.3, hy + 7.4], 'mon1_beard', { bv: 0.8 }));
  o.push(K(hx - 0.8, 13.2, hx - 0.4, hy + 2, 1.15, 1, 'mon1_corpse'));
  o.push(E(hx, hy, 3.3, 3.7, 'mon1_corpse', { fl: 0.2 }));
  o.push(X(hx - 0.2, hy - 0.4, 1.4, 1.5, DARK), X(hx + 2, hy - 0.4, 1.2, 1.5, DARK));
  o.push(vEye(hx, hy - 0.1, 1, 0.9), vEye(hx + 2.2, hy - 0.1, 0.8, 0.9), Lt(hx + 1.2, hy, 4.5, VIOL, 0.5));
  o.push(X(hx + 2.4, hy + 0.6, 0.8, 1.6, 'mon1_corpse:2'));
  o.push(X(hx + 0.8, hy + 1.8, 2.4, 1, DARK), X(hx + 1.2, hy + 1.8, 0.5, 0.5, 'bone:4'), X(hx + 2.4, hy + 1.8, 0.5, 0.5, 'bone:4'));

  // headgear
  if (kind === 'warrior') {
    o.push(P([hx - 3.8, hy - 0.6, hx - 3, hy - 3.9, hx + 0.2, hy - 6, hx + 3, hy - 3.9, hx + 3.8, hy - 0.6], 'mon1_helm', { bv: 1.3 }));
    o.push(K(hx - 4, hy - 0.7, hx + 4, hy - 0.7, 0.6, 0.6, 'bronze'), K(hx + 1.3, hy - 0.8, hx + 1.3, hy + 1.4, 0.45, 0.4, 'bronze', { occ: false }));
    o.push(X(hx - 1.8, hy - 3.4, 1, 0.8, 'mon1_rust:2'), X(hx + 1, hy - 4.2, 0.8, 0.6, 'mon1_rust:3'));
  } else if (pit) {
    o.push(E(hx - 0.2, hy - 1.2, 3.9, 3.1, 'mon1_helm', { fl: 0.15 }));
    o.push(K(hx - 4.1, hy - 0.4, hx + 4, hy - 0.4, 0.65, 0.65, 'bronze'));
  } else if (anc) {
    o.push(K(hx - 3.6, hy - 2.1, hx + 3.6, hy - 2.1, 0.75, 0.75, 'mon1_verdigris'));
    // spikes kept short enough that the taller ancient's crown stays inside the cell
    o.push(P([hx - 3.7, hy - 1.7, hx - 3.5, hy - 4.3, hx - 2.3, hy - 2.9, hx - 1, hy - 5.1, hx + 0.4, hy - 3, hx + 1.7, hy - 5.3, hx + 2.9, hy - 2.9, hx + 3.9, hy - 4.2, hx + 3.8, hy - 1.7], 'mon1_verdigris', { bv: 0.5 }));
    o.push(X(hx - 1.2, hy - 3.9, 0.7, 0.7, 'gold:4'), X(hx + 1.5, hy - 4.1, 0.7, 0.7, 'gold:4'));
  } else {
    o.push(K(hx - 2.4, hy - 3, hx - 4.4 + sw * 0.2, hy + 2, 0.5, 0.25, 'mon1_beard'), K(hx - 0.6, hy - 3.6, hx - 3 + sw * 0.2, hy - 0.8, 0.4, 0.2, 'mon1_beard'));
    o.push(K(hx - 2.6, hy + 3.4, hx + 1.4, hy + 3.7, 0.75, 0.75, 'iron'));
    o.push(chain(hx - 0.2, hy + 4.2, hx + 0.6 + sw * 0.2, hy + 7.6, 3));
  }

  // beard
  if (anc) o.push(P([hx - 0.8, hy + 2, hx + 3.4, hy + 1.8, hx + 3.2, hy + 6.6, hx + 2.2 + sw * 0.3, hy + 11.2, hx + 1.2, hy + 8.8, hx + 0.2 + sw * 0.3, hy + 10.8, hx - 0.6, hy + 6], 'mon1_beard', { bv: 0.8 }));
  else if (!thr) {
    const wisp = pit ? 0.8 : 1;
    o.push(K(hx - 0.2, hy + 2.6, hx - 0.6 + sw * 0.2, hy + 2.6 + 3.6 * wisp, 0.55, 0.2, 'mon1_beard'));
    o.push(K(hx + 1.2, hy + 2.8, hx + 1.2 + sw * 0.25, hy + 2.8 + 4.6 * wisp, 0.65, 0.2, 'mon1_beard'));
    o.push(K(hx + 2.6, hy + 2.6, hx + 3.2 + sw * 0.2, hy + 2.6 + 3 * wisp, 0.5, 0.2, 'mon1_beard'));
  }

  // shield (warrior), on the back arm and facing us
  if (kind === 'warrior') {
    o.push(E(10.4, ty + 1.2, 4.7, 5.5, 'mon1_helm', { fl: 0.65 }));
    o.push(E(10.4, ty + 1.2, 4.1, 4.9, 'woodDark', { fl: 0.65 }));
    o.push(K(10.4, ty - 3.4, 10.4, ty + 5.8, 0.55, 0.55, 'mon1_rust', { fl: 0.6 }), K(6.6, ty + 1.2, 14.2, ty + 1.2, 0.5, 0.5, 'mon1_rust', { fl: 0.6 }));
    o.push(E(10.4, ty + 1.2, 1.5, 1.5, 'bronze'));
    o.push(P([7.6, ty - 3.2, 9, ty - 4.8, 10.2, ty - 3.8, 11.4, ty - 5, 12.8, ty - 3.4, 11, ty - 2.6, 9, ty - 2.6], 'mon1_rime', { bv: 0.4 }));
  }

  // front arm and weapon
  if (kind === 'warrior') {
    o.push(K(20, ty - 3.2, 21, ty + 0.2, 1.3, 1.15, body));
    o.push(K(21, ty + 0.2, 22.6, ty + 2.6, 0.95, 0.8, 'mon1_corpse'));
    o.push(notchedBlade(23, ty + 3, 0.42 + sw * 0.015, 13.4, 1.05, 'mon1_oldSteel'));
    o.push(E(23, ty + 3, 1.15, 1.15, 'mon1_corpse'));
  } else if (anc) {
    const sx = 17.4;
    o.push(K(20, 13.6, 18.4, 16.8, 1.3, 1.1, body));
    o.push(P([sx - 1.3, ty + 1.4, sx + 1.3, ty + 1.4, sx + 1.1, 26.8, sx, 28.6, sx - 1.1, 26.8], 'mon1_oldSteel', { bv: 0.9, n: [0.15, -0.1, 1] }));
    o.push(X(sx - 0.25, ty + 2.4, 0.5, 7.4, 'mon1_oldSteel:1'));
    o.push(K(sx - 3.4, ty + 0.9, sx + 3.4, ty + 0.9, 0.8, 0.8, 'mon1_verdigris'));
    o.push(K(sx, ty + 0.4, sx, ty - 3.4, 0.7, 0.7, 'leatherDark'), E(sx, ty - 4, 1.15, 1.15, 'mon1_verdigris'));
    o.push(E(sx - 0.3, ty - 2.4, 1.3, 1.2, 'mon1_corpse'), E(sx + 0.2, ty - 0.7, 1.35, 1.2, 'mon1_corpse'));
  } else if (pit) {
    o.push(K(20, ty - 3.4, 21.8, ty + 1.4, 1.3, 1.1, body));
    const px = 22.6;
    const py = ty + 2.4;
    o.push(K(px - 0.4, py + 4, px + 1.6, py - 12, 0.65, 0.6, 'woodDark'));
    o.push(P([px - 3.6, py - 8.6, px - 1.2, py - 11.4, px + 1.6, py - 12.8, px + 4.4, py - 12.4, px + 7.4, py - 10.4, px + 4.2, py - 11, px + 1.8, py - 10.6, px - 0.8, py - 10.2], 'mon1_helm', { bv: 0.6 }));
    o.push(E(px + 0.1, py - 0.2, 1.2, 1.2, 'mon1_corpse'));
  } else {
    o.push(K(19.4, ty - 3.4, 21.2, ty + 2.2, 0.95, 0.8, 'mon1_corpse'), K(21.2, ty + 2.2, 22.4, ty + 4.6, 0.8, 0.7, 'mon1_corpse'));
    o.push(K(21.6, ty + 3.4, 23, ty + 3.2, 0.6, 0.6, 'iron'));
    o.push(E(22.6, ty + 5.1, 1, 1.1, 'mon1_corpse'));
    o.push(chain(22.9, ty + 5.8, 23.6 + sw * 0.4, 27, 7));
  }
  return anc ? T(o, { sx: 1.04, sy: 1.08 }) : o;
}
