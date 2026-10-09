import { E, K, P, X, Lt, Sh, breath, sway, type PrimTree } from './kit';
import { DARK, VIOL, chain, rime, vEye, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** Short, broad legs and heavy boots under a barrel body. */
function legs(m: string, boot: string): Out {
  return [
    K(13.2, 22.6, 12.8, 26.8, 1.75, 1.5, m), K(18.6, 22.6, 19, 26.8, 1.75, 1.5, m),
    E(12.4, 27.6, 2.3, 1.3, boot), E(19.4, 27.6, 2.3, 1.3, boot),
  ];
}

/**
 * The Cinder-Gilded Duergar: a dead smith of the works, burnt to charcoal under his plate and
 * buried in a gold death-mask. Fire still lives in the cracks; the ash beard is bound in gold
 * rings; he grips forge tongs whose jaws still glow.
 */
function cinder(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const fl = [0, 0.08, -0.04, 0.06][f];
  const hx = 16.6;
  const hy = 11.6 + b * 0.3;
  const ty = 19 + b * 0.2;
  const out: Out = [Sh(16, 28.6, 8.2, 2.2)];
  // back arm on the hip
  out.push(K(11.2, ty - 3, 9.4, ty + 1, 1.6, 1.4, 'mon3_cinderPlate'), E(9.6, ty + 1.6, 1.4, 1.3, 'mon3_char'));
  out.push(legs('mon3_char', 'blackIron'));
  // charred plate over a charcoal body, cracks lit from within
  out.push(E(15.8, ty, 5.8, 5.6, 'mon3_cinderPlate', { fl: 0.1 }));
  out.push(P([10.4, ty + 2, 21.2, ty + 2, 22, ty + 6.4, 18.6, ty + 5.4, 15.8, ty + 6.8, 13, ty + 5.4, 9.6, ty + 6.4], 'mon3_char', { bv: 0.6 }));
  out.push(K(11, ty + 2.4, 20.6, ty + 2.4, 0.8, 0.8, 'leatherDark'), X(15, ty + 1.8, 1.6, 1.3, 'gold:4'));
  out.push(K(12.4, ty - 2.6, 13.8, ty + 0.4, 0.22, 0.22, 'emFire', { ink: fl, ol: false }), K(13.8, ty + 0.4, 13.2, ty + 1.8, 0.2, 0.2, 'emFire', { ink: fl, ol: false }));
  out.push(K(19.4, ty - 1.4, 18.6, ty + 1.2, 0.2, 0.2, 'emFire', { ink: fl, ol: false }), K(11.6, ty + 3.8, 12.8, ty + 5.4, 0.2, 0.2, 'emFire', { ink: fl, ol: false }));
  // pauldrons
  out.push(E(10.8, ty - 4, 2.6, 2, 'mon3_cinderPlate'), E(20.8, ty - 4, 2.6, 2, 'mon3_cinderPlate'));
  out.push(X(10, ty - 4.6, 1.2, 0.5, 'gold:4'), X(20.4, ty - 4.6, 1.2, 0.5, 'gold:4'));
  // head: charcoal hood behind the gold mask
  out.push(E(hx - 0.6, hy - 0.4, 3.8, 3.9, 'mon3_char'));
  out.push(P([hx - 3, hy - 2.4, hx + 0.2, hy - 3.6, hx + 3.4, hy - 2.4, hx + 3.6, hy + 1.4, hx + 2.2, hy + 2.8, hx - 1.6, hy + 2.8, hx - 2.8, hy + 1.4], 'mon3_gilt', { bv: 1.4 }));
  // the mask's face: a heavy brow, a nose ridge, a mouth slot; eye slits show the dead light behind
  out.push(K(hx - 2.4, hy - 1.4, hx + 2.8, hy - 1.4, 0.45, 0.45, 'mon3_gilt', { ink: 0.08 }));
  out.push(X(hx - 2, hy - 0.9, 2, 1.1, DARK), X(hx + 0.9, hy - 0.9, 2, 1.1, DARK));
  out.push(vEye(hx - 1.4, hy - 0.8, 1, 0.8), vEye(hx + 1.5, hy - 0.8, 1, 0.8));
  out.push(K(hx + 0.4, hy - 0.8, hx + 0.6, hy + 1, 0.42, 0.5, 'mon3_gilt', { ink: 0.1 }));
  out.push(X(hx - 0.8, hy + 1.7, 2.6, 0.5, DARK));
  // ash beard in gold-ringed plaits
  out.push(P([hx - 3.2, hy + 1.6, hx + 3.6, hy + 1.6, hx + 2.8, hy + 7, hx + 1.4 + sw * 0.2, hy + 10.2, hx, hy + 7.8, hx - 1.4 + sw * 0.2, hy + 10, hx - 2.6, hy + 6.6], 'mon3_ashBeard', { bv: 0.8 }));
  out.push(K(hx + 1.4, hy + 6.2, hx + 1.5, hy + 7.4, 0.55, 0.55, 'gold'), K(hx - 1.3, hy + 6, hx - 1.3, hy + 7.2, 0.55, 0.55, 'gold'));
  out.push(X(hx - 2, hy + 3.2, 0.4, 0.4, 'emFire:4', { em: true }), X(hx + 2.2, hy + 4, 0.4, 0.4, 'emFire:4', { em: true }));
  // the forge tongs, raised; the jaws still glow from the fire they came out of
  const gx = 22.6;
  const gy = ty - 0.4;
  const jx = 27.2 + sw * 0.2;
  const jy = 5.4;
  out.push(K(20.2, ty - 3.8, 21.6, ty - 1, 1.6, 1.4, 'mon3_cinderPlate'));
  out.push(K(gx - 0.4, gy + 1.6, jx - 1.4, jy + 4.4, 0.42, 0.36, 'blackIron'), K(gx + 0.4, gy + 1.4, jx - 0.2, jy + 4.8, 0.42, 0.36, 'blackIron'));
  out.push(E(jx - 0.8, jy + 4.6, 0.7, 0.7, 'blackIron'));
  out.push(K(jx - 1.4, jy + 4.4, jx - 2.6, jy + 0.8, 0.42, 0.3, 'emFire', { ink: fl }), K(jx - 0.2, jy + 4.8, jx + 1.2, jy + 1.2, 0.42, 0.3, 'emFire', { ink: fl }));
  out.push(K(jx - 2.4, jy + 0.6, jx - 3.4, jy - 0.2, 0.3, 0.26, 'emFire', { ink: fl }), K(jx + 1, jy + 1, jx + 1.8, jy + 0.2, 0.3, 0.26, 'emFire', { ink: fl }));
  out.push(E(gx, gy, 1.4, 1.3, 'mon3_char'));
  out.push(Lt(jx - 0.4, jy + 2, 7, '#ff8a2c', 0.7), Lt(15, ty, 6, '#ff8a2c', 0.4), Lt(hx, hy - 0.6, 4, VIOL, 0.45));
  return out;
}

/**
 * The haugbui: the mound-dweller who never leaves his barrow. Squat and old, turf still on his
 * helm and shoulders, a rime beard, a fist on the long-axe planted beside him, his hoard spilled
 * at his feet.
 */
function haugbui(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const hx = 15.8;
  const hy = 10.8 + b * 0.3;
  const ty = 18.6 + b * 0.2;
  const out: Out = [Sh(16, 28.6, 8.6, 2.3)];
  // barrow cloak, earth-stained
  out.push(P([10, ty - 5, 21.6, ty - 5, 23.2 + sw * 0.3, 27.6, 20.4, 26.4, 18.2, 28.2, 15.6, 26.6, 13, 28.2, 10.6, 26.4, 8.4 + sw * 0.4, 27.6], 'mon3_barrowCloak', { bv: 1.1 }));
  out.push(legs('mon1_wrap', 'leatherDark'));
  out.push(E(15.8, ty, 5.6, 5.4, 'mon1_rustMail', { fl: 0.1 }));
  out.push(P([10.6, ty + 2, 21, ty + 2, 21.8, ty + 6.2, 18.6, ty + 5.2, 15.8, ty + 6.6, 13, ty + 5.2, 9.8, ty + 6.2], 'mon1_rustMail', { bv: 0.6 }));
  out.push(X(12.4, ty - 1, 1.2, 1, 'mon1_rust:3'), X(19.2, ty + 3.6, 1, 1, 'mon1_rust:3'));
  // turf and rime on the shoulders
  out.push(E(10.6, ty - 4.2, 2.8, 1.6, 'mon3_turf'), E(21, ty - 4.2, 2.8, 1.6, 'mon3_turf'));
  out.push(rime(10.4, ty - 5, 1.6), rime(21.2, ty - 5, 1.5));
  out.push(K(9.4, ty - 5.4, 9, ty - 7.2, 0.25, 0.1, 'mon3_grass'), K(10.4, ty - 5.6, 10.8, ty - 7.6, 0.25, 0.1, 'mon3_grass'), K(21.6, ty - 5.4, 22.2, ty - 7.2, 0.25, 0.1, 'mon3_grass'));
  // head under an old spangenhelm with a turf crown
  out.push(E(hx, hy, 3.4, 3.5, 'mon1_corpse', { fl: 0.2 }));
  out.push(P([hx - 3.9, hy - 0.2, hx - 3.2, hy - 3.6, hx, hy - 5.4, hx + 3.2, hy - 3.6, hx + 3.9, hy - 0.2], 'mon1_helm', { bv: 1.2 }));
  out.push(K(hx - 4, hy - 0.3, hx + 4, hy - 0.3, 0.6, 0.6, 'bronze'), K(hx, hy - 5, hx, hy - 0.4, 0.4, 0.4, 'bronze'));
  out.push(E(hx - 1.2, hy - 4.6, 2.2, 1, 'mon3_turf'), K(hx - 2, hy - 5.2, hx - 2.4, hy - 6.6, 0.25, 0.1, 'mon3_grass'), K(hx - 0.6, hy - 5.4, hx - 0.4, hy - 6.8, 0.25, 0.1, 'mon3_grass'));
  out.push(X(hx - 2, hy + 0.4, 1.6, 1.3, DARK), X(hx + 0.6, hy + 0.4, 1.6, 1.3, DARK));
  out.push(vEye(hx - 1.6, hy + 0.6, 0.9, 0.8), vEye(hx + 1, hy + 0.6, 0.9, 0.8), Lt(hx, hy + 1, 4.5, VIOL, 0.5));
  // rime beard, barrow-dirt in it
  out.push(P([hx - 3.2, hy + 1.8, hx + 3.2, hy + 1.8, hx + 3.4, hy + 4.8, hx + 1.8 + sw * 0.2, hy + 7.6, hx + 0.4, hy + 6.4, hx - 1 + sw * 0.2, hy + 7.8, hx - 2.6, hy + 6.4, hx - 3.6, hy + 4.6], 'hairGrey', { bv: 0.8 }));
  out.push(X(hx - 0.2, hy + 2.4, 0.5, 3.6, 'hairGrey:2'), X(hx + 1.8, hy + 3, 0.4, 3, 'hairGrey:2'), X(hx - 2, hy + 4.8, 1, 0.8, 'mon3_turf:2'));
  // the hoard he keeps: coins spilled at his feet
  for (const [x, y] of [[8.6, 28.2], [10, 28.8], [21.4, 28.9], [7.6, 27.4]]) out.push(E(x, y, 0.9, 0.45, 'gold', { fl: 0.5 }));
  // back arm, the fist on his belt
  out.push(K(11.2, ty - 3.4, 10.2, ty + 0.6, 1.5, 1.3, 'mon1_rustMail'), E(10.6, ty + 1.4, 1.3, 1.2, 'mon1_corpse'));
  // the long-axe planted head-down at his side, his fist over the butt
  const ax = 23.6;
  out.push(K(ax - 0.2, ty - 6, ax + 0.2, 26.4, 0.6, 0.6, 'woodDark'), E(ax - 0.2, ty - 6.4, 0.9, 0.8, 'bronze'));
  out.push(P([ax + 0.4, 22.6, ax + 3.8, 21.2, ax + 5, 24.4, ax + 4.4, 27.8, ax + 0.4, 26.6], 'mon1_oldSteel', { bv: 0.8 }));
  out.push(P([ax - 0.4, 23.2, ax - 2, 23.8, ax - 2, 25.6, ax - 0.4, 26], 'mon1_oldSteel', { bv: 0.5 }));
  out.push(X(ax + 2.4, 23.6, 1, 0.9, 'mon1_rust:3'));
  out.push(K(20.4, ty - 3.4, 22.6, ty - 5.2, 1.5, 1.3, 'mon1_rustMail'), E(ax - 0.2, ty - 5.4, 1.35, 1.25, 'mon1_corpse'));
  return out;
}

/**
 * The forge wretch: a living dwarf worked to the bone at the cold forges. Bald and scorched,
 * the beard burnt short, soot-blind, an iron collar and its broken chain, swinging a hammer at
 * whatever it hears.
 */
function wretch(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const hx = 18;
  const hy = 13.6 + b * 0.35;
  const ty = 20.2 + b * 0.2;
  const out: Out = [Sh(15.8, 28.6, 7.4, 2)];
  // back arm hanging
  out.push(K(11.8, ty - 2.6, 10.6, ty + 2.6, 1.15, 0.95, 'mon3_soot'), E(10.5, ty + 3.2, 1.1, 1, 'mon3_soot'));
  out.push(legs('woolBrown', 'leatherDark'));
  // bare, soot-smeared torso hunched forward; a scorched leather apron to the knee
  out.push(E(15.6, ty, 4.8, 4.9, 'mon3_soot', { a: -0.15 }));
  out.push(X(12.6, ty - 1.2, 1.6, 0.9, 'mon3_soot:1'), X(18.2, ty - 2.2, 1.2, 0.8, 'mon3_soot:1'));
  out.push(P([12.6, ty - 0.6, 19, ty - 1.4, 19.8, ty + 4.6, 16, ty + 5.4, 12, ty + 4.4], 'leatherDark', { bv: 0.7 }));
  out.push(K(12.6, ty - 0.6, 15, ty - 4.6, 0.3, 0.3, 'leatherDark'), K(19, ty - 1.4, 17.8, ty - 5, 0.3, 0.3, 'leatherDark'));
  out.push(X(14, ty + 1.4, 1.4, 1, 'mon1_char:2'), X(17.4, ty + 2.8, 1.2, 1, 'mon1_char:2'));
  out.push(X(12.8, ty - 3, 1.2, 0.5, 'mon1_scar:3'), X(14.2, ty - 2.4, 1.2, 0.5, 'mon1_scar:3'));
  // collar and broken chain
  out.push(K(hx - 3.6, hy + 3, hx + 0.8, hy + 3.4, 0.8, 0.8, 'iron'));
  out.push(chain(hx - 3.6, hy + 3.4, hx - 6 + sw * 0.3, hy + 8.4, 4));
  // bald head thrust forward, burnt-short beard
  out.push(E(hx, hy, 3, 3.1, 'mon3_wretchSkin', { fl: 0.2 }));
  out.push(X(hx - 1.6, hy - 2.4, 1.6, 0.6, 'mon3_wretchSkin:4'));
  // soot-blind: a black smear across the eyes, the eyes themselves gone milky
  out.push(K(hx - 1.6, hy - 0.4, hx + 3.2, hy - 0.2, 0.9, 0.8, 'mon1_char', { ol: false }));
  out.push(X(hx + 0.5, hy - 0.5, 0.9, 0.7, 'mon3_milk:4'), X(hx + 2.2, hy - 0.4, 0.8, 0.7, 'mon3_milk:4'));
  out.push(K(hx + 2.4, hy + 0.4, hx + 3.4, hy + 1.4, 0.6, 0.4, 'mon3_wretchSkin'));
  out.push(P([hx - 2.2, hy + 1.4, hx + 3, hy + 1.4, hx + 2.6, hy + 4, hx + 0.4, hy + 4.8, hx - 1.8, hy + 3.6], 'mon3_scorchBeard', { bv: 0.6 }));
  // front arm flung up, a smith's hammer swung blind
  const hmx = 23.2 + sw * 0.3;
  const hmy = ty - 7.4;
  out.push(K(19.4, ty - 2.6, 21.6, ty - 5.2, 1.2, 1, 'mon3_soot'), K(21.6, ty - 5.2, hmx - 0.4, hmy + 0.6, 1, 0.9, 'mon3_soot'));
  // the haft leans out along (dx, dy); the head is a block square across its top
  const dx = 0.33;
  const dy = -0.94;
  const cx = hmx + 2.6;
  const cy = hmy - 7.6;
  out.push(K(hmx - 1, hmy + 2, cx, cy, 0.5, 0.45, 'wood'));
  const corner = (u: number, w: number): number[] => [cx - dy * u + dx * w, cy + dx * u + dy * w];
  out.push(P([...corner(-2.6, -1.3), ...corner(2.6, -1.3), ...corner(2.6, 1.3), ...corner(-2.6, 1.3)], 'iron', { bv: 0.7 }));
  out.push(E(hmx - 0.3, hmy + 0.4, 1.1, 1, 'mon3_soot'));
  return out;
}

/**
 * The dwarves of the abandoned works, dead and living: broad, short-legged, bearded. Kinds:
 * `cinder` (gold death-mask, ember cracks, glowing forge tongs), `haugbui` (turf-crowned
 * barrow guardian by a planted long-axe) and `wretch` (a soot-blind thrall swinging a hammer).
 */
export function dwarfModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'haugbui': return haugbui(f);
    case 'wretch': return wretch(f);
    default: return cinder(f);
  }
}
