import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import './materials';

/*
 * The raid's three villagers, the gate-ward who dies by the cellar stairs, and the four
 * captives bound at the Siphon Altar. Each is a townsperson with a trade in hand, drawn in
 * the bible's style; a villager the coven took in the raid comes back as themselves.
 */

type Out = PrimTree[number][];

const EYE = '#1d1416';

/** Two eyes and a small mouth, on a head facing a little right. */
const face = (hx: number, hy: number, mouth = '#a0524a'): PrimTree => [
  X(hx + 0.4, hy + 0.3, 0.85, 0.95, EYE), X(hx + 2.5, hy + 0.3, 0.8, 0.95, EYE),
  X(hx + 1.4, hy + 2.6, 1.1, 0.4, mouth),
];

/**
 * Eir the Acolyte: young, in the temple's undyed robe under a grey-blue mantle, her dark
 * hair bound back with a linen band; she carries a sheaf of healing herbs, and her clay
 * broth-flask (what she gives the hero who frees her) hangs at her hip.
 */
export function eirModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 14.8;
  const hy = 8.6 + b * 0.3;
  const ty = 16.8 + b * 0.25;
  const out: Out = [Sh(16, 28.6, 8.2, 2.2)];
  out.push(
    // the braid down her back
    K(hx - 2.4, hy + 1.0, hx - 3.4, hy + 8.6, 1.1, 0.7, 'hairDark'),
    // back arm, the hand at the flask's cord
    K(11.6, 13.4, 10.8, 18.6, 1.4, 1.2, 'ally_robeWhite'), E(11.0, 19.4, 1.0, 1.0, 'skinPale'),
    // the robe to the floor, a fold down the skirt
    P([12.0, 12.4, 19.0, 12.4, 20.0, 19.6, 21.6, 27.8, 16.2, 28.6, 10.4, 27.8, 11.4, 19.6], 'ally_robeWhite', { bv: 1.2 }),
    K(16.0, 21.0, 15.4, 27.8, 0.45, 0.7, 'linen', { occ: false }),
    E(13.6, 28.3, 1.4, 0.7, 'leatherDark'), E(18.6, 28.4, 1.4, 0.7, 'leatherDark'),
    // a blue sash, and the broth-flask hung from it on a cord
    K(11.6, ty + 2.6, 19.8, ty + 2.4, 0.6, 0.6, 'wool'),
    K(11.2, ty + 2.8, 10.6 + w * 0.15, ty + 4.6, 0.2, 0.2, 'leatherDark', { occ: false }),
    E(10.6 + w * 0.15, ty + 6.0, 1.5, 1.7, 'vil_clay'), K(10.6 + w * 0.15, ty + 4.2, 10.6 + w * 0.15, ty + 4.8, 0.55, 0.5, 'vil_clay'),
    X(10.4 + w * 0.15, ty + 3.7, 0.6, 0.5, 'woodDark:3'),
    // the mantle over the shoulders, its hood down
    P([10.8, 12.0, 19.8, 11.8, 20.6, 15.0, 15.8, 16.0, 10.6, 15.2], 'vil_mantle', { bv: 0.9 }),
    E(hx - 2.6, hy + 3.4, 2.0, 1.4, 'vil_mantle'),
    // head: pale, calm, dark hair under a linen band
    E(hx + 0.2, hy, 3.4, 3.8, 'skinPale', { fl: 0.2 }),
    P([hx - 3.6, hy + 1.6, hx - 3.4, hy - 2.4, hx - 1.2, hy - 4.2, hx + 1.8, hy - 4.2, hx + 3.6, hy - 2.4, hx + 3.0, hy - 1.6, hx - 1.2, hy - 1.6, hx - 2.4, hy + 1.6], 'hairDark', { bv: 0.7 }),
    K(hx - 3.4, hy - 1.9, hx + 3.4, hy - 2.2, 0.45, 0.45, 'linen'),
    face(hx, hy),
    K(hx + 3.2, hy + 0.8, hx + 3.7, hy + 1.9, 0.5, 0.45, 'skinPale'),
    // front arm, the sheaf of herbs held to her chest
    K(19.2, 13.2, 20.8, 17.4, 1.4, 1.2, 'ally_robeWhite'), K(20.8, 17.4, 18.6, 16.2, 1.2, 1.0, 'ally_robeWhite'),
  );
  for (const [dx, dy, l] of [[-1.4, 0, 5.4], [0, -0.4, 6.4], [1.4, 0.1, 5.2], [0.6, 0.3, 4.0]]) {
    out.push(K(18.2 + dx * 0.4, 18.4, 18.2 + dx + w * 0.1, 18.4 - l + dy, 0.3, 0.25, 'vil_herb', { occ: false }));
    out.push(E(18.2 + dx + w * 0.1, 18.4 - l + dy, 0.9, 0.7, 'vil_herb'));
  }
  out.push(X(16.6, 12.8, 0.6, 0.6, '#e8d36a'), X(19.4, 12.0, 0.6, 0.6, '#e8d36a')); // a few yellow flowers
  out.push(E(18.2, 16.4, 1.0, 1.0, 'skinPale'), K(17.2, 17.6, 19.2, 17.6, 0.3, 0.3, 'linen'));
  return out;
}

/**
 * Sigrun, Olaf's daughter: her father's flaxen hair in two braids and his red wool for a
 * headscarf, a madder-red dress under a linen apron; she shields a lit tallow candle (the
 * chandler's trade), and her purse hangs at her belt.
 */
export function sigrunModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.0;
  const hy = 8.8 + b * 0.3;
  const ty = 17.0 + b * 0.25;
  const flame = [1, 0.86, 1.1, 0.94][f];
  const out: Out = [Sh(16, 28.6, 8.4, 2.2)];
  out.push(
    // the far braid, down her back
    K(hx - 2.4, hy + 2.0, hx - 3.4, hy + 8.4 + w * 0.15, 0.9, 0.6, 'hairFlax', { ink: -0.15 }),
    // back arm, hanging, the hand at the purse
    K(11.6, 13.6, 11.0, 18.6, 1.4, 1.2, 'vil_madderDark'), E(11.2, 19.4, 1.0, 1.0, 'skin'),
    // the dress, the apron over it, the purse
    P([12.0, 12.6, 19.2, 12.6, 20.2, 19.8, 21.8, 27.8, 16.2, 28.6, 10.2, 27.8, 11.2, 19.8], 'vil_madder', { bv: 1.2 }),
    P([13.2, 15.0, 18.6, 15.0, 19.4, 21.0, 19.8, 26.8, 16.2, 27.4, 12.6, 26.8, 12.6, 21.0], 'linen', { bv: 0.8 }),
    K(13.0, ty + 1.6, 19.0, ty + 1.6, 0.5, 0.5, 'leatherDark'),
    E(11.6, ty + 3.6, 1.3, 1.5, 'leather', { fl: 0.4 }), X(11.0, ty + 2.4, 1.2, 0.5, 'leatherDark:3'),
    E(13.6, 28.3, 1.4, 0.7, 'leatherDark'), E(18.6, 28.4, 1.4, 0.7, 'leatherDark'),
    // head: a ruddy round face under the red headscarf, knotted at the nape
    E(hx + 0.2, hy, 3.4, 3.7, 'skin', { fl: 0.2 }),
    P([hx - 3.8, hy + 0.8, hx - 3.6, hy - 2.6, hx - 1.4, hy - 4.4, hx + 1.8, hy - 4.4, hx + 3.8, hy - 2.4, hx + 3.4, hy - 1.2, hx - 1.4, hy - 1.4, hx - 2.6, hy + 1.2], 'woolRed', { bv: 0.8 }),
    E(hx - 3.6, hy + 0.6, 1.0, 0.8, 'woolRed'), K(hx - 3.8, hy + 1.0, hx - 4.6, hy + 3.2 + w * 0.15, 0.5, 0.35, 'woolRed'),
    X(hx - 0.8, hy - 1.4, 3.2, 0.6, 'hairFlax:3'), // a fringe under the scarf
    face(hx, hy),
    X(hx + 2.4, hy + 1.4, 1.0, 0.55, '#c8705a'), // her father's rosy cheek
    K(hx + 3.2, hy + 0.8, hx + 3.7, hy + 1.9, 0.5, 0.45, 'skin'),
    K(hx + 2.0, hy + 3.0, hx + 2.6, hy + 9.4 - w * 0.15, 0.9, 0.6, 'hairFlax'),
    X(hx + 1.9, hy + 5.0, 1.2, 0.4, 'hairFlax:2'), X(hx + 2.0, hy + 8.6, 1.2, 0.6, 'woolRed:2'),
    // front arm, the candle held out, the other hand cupped round the flame
    K(19.4, 13.4, 21.6, 17.0, 1.4, 1.2, 'vil_madder'), K(21.6, 17.0, 22.4, 14.8, 1.2, 1.0, 'vil_madder'),
  );
  const cx = 22.6;
  const cy = 14.0;
  out.push(
    E(cx, cy + 0.4, 1.6, 0.55, 'blackIron'), // the dish
    K(cx, cy, cx, cy - 3.0, 0.55, 0.5, 'ally_tallow'),
    E(cx, cy + 0.4, 1.0, 0.9, 'skin'),
    E(cx + 0.1, cy - 4.0, 0.55 * flame, 0.95 * flame, 'emFire'), X(cx - 0.1, cy - 4.2, 0.35, 0.6, 'emFireCore:5', { em: true }),
    Lt(cx, cy - 4.0, 9, '#ff8a2c', 0.8 * flame),
  );
  return out;
}

/**
 * Brandr, Gunther's apprentice: a lanky lad with a shock of red hair and no beard yet,
 * sleeves rolled, a scorched leather apron over a grey shirt, soot on his cheek; he holds
 * up the rime-bit chisel he came out for, its frosted edge catching the light, a hammer in
 * the other hand.
 */
export function brandrModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 8.2 + b * 0.35;
  const ty = 16.8 + b * 0.3;
  const glint = [0.2, 0.5, 0.9, 0.5][f];
  const out: Out = [Sh(16.2, 28.6, 8.6, 2.2)];
  out.push(
    // back arm, the hammer hanging from the fist
    K(11.8, 13.2, 11.0, 18.4, 1.3, 1.1, 'ally_shirt'), K(11.0, 17.0, 10.8, 19.0, 1.1, 1.0, 'skin'),
    E(10.8, 19.6, 1.05, 1.05, 'skin'),
    K(10.8, 19.6, 10.4 + w * 0.1, 24.0, 0.35, 0.3, 'wood'),
    K(9.0 + w * 0.1, 24.2, 11.8 + w * 0.1, 24.0, 0.8, 0.8, 'iron'),
    // long legs in brown breeches, wrapped boots
    K(13.8, 21.6, 13.4, 26.8, 1.6, 1.4, 'woolBrown'), K(17.8, 21.6, 18.6, 26.8, 1.6, 1.4, 'woolBrown'),
    E(13.0, 27.6, 2.0, 1.2, 'leatherDark'), E(19.0, 27.6, 2.0, 1.2, 'leatherDark'),
    // the shirt, and the scorched leather apron over it
    E(15.8, ty, 5.0, 5.8, 'ally_shirt', { fl: 0.12 }),
    P([12.6, 13.4, 19.0, 13.4, 19.8, 20.0, 19.6, 23.8, 12.2, 23.8, 11.8, 20.0], 'leather', { bv: 0.8 }),
    K(12.0, ty + 1.6, 19.8, ty + 1.6, 0.4, 0.4, 'leatherDark'),
    X(13.6, 19.6, 1.6, 1.0, 'ally_soot:3'), X(16.8, 21.6, 1.4, 0.9, 'ally_soot:3'), // scorch marks
    K(13.0, 13.4, 14.2, 11.6, 0.3, 0.3, 'leatherDark', { occ: false }), K(18.6, 13.4, 17.4, 11.6, 0.3, 0.3, 'leatherDark', { occ: false }),
    // head: young, long-faced, a shock of red hair, soot on the cheek
    E(hx, hy, 3.3, 3.8, 'skin', { fl: 0.2 }),
    P([hx - 3.6, hy + 0.8, hx - 3.8, hy - 2.4, hx - 2.0, hy - 4.6, hx + 0.2, hy - 4.2, hx + 1.6, hy - 5.0, hx + 3.6, hy - 3.0, hx + 3.4, hy - 1.6, hx + 1.4, hy - 2.2, hx - 1.0, hy - 1.4, hx - 2.6, hy + 1.2], 'hairRed', { bv: 0.7 }),
    face(hx, hy),
    X(hx + 1.8, hy + 1.4, 1.4, 0.6, 'ally_soot:4'),
    K(hx + 3.0, hy + 0.8, hx + 3.6, hy + 1.9, 0.5, 0.45, 'skin'),
    // front arm, bare to the elbow, raised with the chisel
    K(19.4, 13.0, 21.4, 16.0, 1.3, 1.1, 'ally_shirt'), K(21.4, 16.0, 22.6, 12.6, 1.1, 1.0, 'skin'),
    E(22.8, 12.0, 1.05, 1.05, 'skin'),
  );
  const cx = 22.9;
  out.push(
    K(cx, 12.8, cx, 10.4, 0.45, 0.45, 'wood'),
    K(cx, 10.4, cx, 6.6, 0.42, 0.36, 'steel'),
    P([cx - 0.5, 6.8, cx + 0.5, 6.8, cx + 0.7, 5.2, cx - 0.7, 5.2], 'steel', { bv: 0.3 }),
    X(cx - 0.7, 5.0, 1.4, 0.5, 'vil_frost:3'),
    X(cx - 0.3, 5.4, 0.4, 0.4, 'emFrost:5', { em: true, glow: false }),
    Lt(cx, 5.8, 3, '#9fe6ff', 0.2 + glint * 0.15),
  );
  return out;
}

/**
 * Hallvard the Gate-Ward, as the hero finds him at grey dawn: an old guard sitting against
 * the cellar wall, frost creeping across his mail, his grey beard rimed; his spear leans on
 * his shoulder and the town's shield lies at his side. One hand presses a wound, the other
 * rests open on his knee for the hero to take. His breath still smokes, barely.
 */
export function hallvardModel(f: number): PrimTree {
  const b = breath(f) * 0.5; // slow, shallow
  const hx = 13.6;
  const hy = 12.6 + b * 0.25;
  const out: Out = [Sh(15.4, 27.8, 11.0, 2.4)];
  // the shield, lying at his left side, propped on its rim
  const sx = 6.4;
  const sy = 23.4;
  out.push(
    E(sx, sy, 4.0, 4.4, 'ally_shieldBlue', { fl: 0.65 }),
    P([sx, sy - 4.2, sx + 3.1, sy - 2.6, sx + 3.8, sy, sx + 3.1, sy + 2.6, sx, sy + 4.2], 'linen', { bv: 0.3, n: [0, 0, 1] }),
    E(sx + 0.2, sy, 1.2, 1.2, 'iron'),
    X(sx - 2.4, sy - 2.6, 1.6, 0.7, 'vil_frost:4'), X(sx + 1.0, sy + 2.6, 1.4, 0.6, 'vil_frost:4'),
  );
  // the spear, leaning on his shoulder: butt in the snow by his boots, the blade high
  out.push(
    K(23.0, 27.6, 9.0, 5.6, 0.42, 0.38, 'wood'),
    P([8.0, 2.6, 9.3, 3.6, 9.6, 5.6, 8.6, 6.2, 7.6, 5.6, 7.2, 3.8], 'steel', { bv: 0.4 }),
    K(8.6, 6.6, 9.6, 6.0, 0.35, 0.35, 'bronze'),
  );
  out.push(
    // far leg drawn up, knee high
    K(13.4, 23.4, 17.8, 19.8, 1.9, 1.6, 'woolBrown'), K(17.8, 19.8, 19.0, 26.0, 1.6, 1.4, 'woolBrown'),
    E(19.8, 26.8, 2.2, 1.2, 'leatherDark'),
    // near leg out along the ground
    K(13.6, 24.6, 19.8, 25.4, 2.0, 1.7, 'woolBrown'), K(19.8, 25.4, 24.2, 26.2, 1.7, 1.5, 'woolBrown'),
    E(25.6, 26.0, 1.4, 2.0, 'leatherDark'),
    // the mail shirt, slumped against the wall, belted
    E(12.6, 19.8, 5.4, 5.4, 'mail', { fl: 0.12 }),
    P([7.6, 21.6, 17.8, 21.8, 18.2, 25.2, 7.4, 25.0], 'mail', { bv: 0.7 }),
    K(7.6, 21.6, 17.8, 21.8, 0.7, 0.7, 'leatherDark'), X(12.2, 21.0, 1.4, 1.2, 'iron:4'),
    // frost on the mail
    X(9.0, 16.6, 2.2, 0.8, 'vil_frost:4'), X(8.4, 19.0, 1.4, 1.6, 'vil_frost:4'), X(15.0, 17.2, 1.6, 0.7, 'vil_frost:4'),
    X(10.4, 23.0, 1.8, 0.7, 'vil_frost:4'), X(15.8, 23.6, 1.2, 0.6, 'vil_frost:4'),
    // the blue cloak bunched behind his shoulders
    P([7.2, 15.0, 17.4, 14.6, 17.0, 17.0, 12.2, 17.6, 7.0, 17.2], 'wool', { bv: 0.9 }),
    E(16.6, 15.4, 0.9, 0.9, 'bronze'),
    // the back hand pressed to his side, blood under it
    X(15.0, 19.2, 2.2, 2.0, '#6e1e1c'), X(15.6, 21.0, 0.8, 1.4, '#6e1e1c'),
    K(10.4, 16.2, 13.6, 19.6, 1.5, 1.2, 'mail'), E(15.6, 19.8, 1.15, 1.0, 'skin'),
  );
  out.push(
    // head, bowed: the grey beard on his chest, then the helm, its rim frosted
    E(hx, hy, 3.4, 3.5, 'skin', { fl: 0.2 }),
    P([hx - 2.6, hy + 0.8, hx + 3.8, hy + 1.2, hx + 3.4, hy + 4.8, hx + 1.2, hy + 6.0, hx - 1.4, hy + 5.0, hx - 2.6, hy + 2.8], 'hairGrey', { bv: 0.9 }),
    K(hx + 0.4, hy + 0.6, hx + 1.2, hy + 0.6, 0.25, 0.25, 'blackIron', { occ: false }),
    K(hx + 2.4, hy + 0.6, hx + 3.2, hy + 0.6, 0.25, 0.25, 'blackIron', { occ: false }), // eyes half shut
    X(hx - 0.6, hy + 4.2, 1.6, 0.7, 'vil_frost:4'), X(hx + 1.6, hy + 2.6, 1.0, 0.5, 'vil_frost:4'),
    P([hx - 3.6, hy - 0.4, hx - 3.2, hy - 3.0, hx - 1.2, hy - 4.6, hx + 0.8, hy - 4.9, hx + 2.8, hy - 4.2, hx + 3.8, hy - 2.4, hx + 3.9, hy - 0.4], 'iron', { bv: 1.0 }),
    K(hx - 3.6, hy - 0.4, hx + 3.9, hy - 0.4, 0.5, 0.5, 'bronze'),
    X(hx - 2.8, hy - 3.0, 1.4, 0.6, 'vil_frost:4'), X(hx + 1.6, hy - 0.8, 1.2, 0.5, 'vil_frost:4'),
    K(hx + 3.3, hy - 0.4, hx + 3.5, hy + 1.8, 0.4, 0.3, 'iron'),
    // the front arm on his knee, the hand open
    K(16.4, 16.0, 17.4, 19.4, 1.5, 1.2, 'mail'), K(17.4, 19.4, 20.4, 19.0, 1.2, 1.0, 'mail'),
    E(21.4, 19.2, 1.2, 0.9, 'skin'),
  );
  // the last breaths, a faint smoke from the beard
  const puffs = [
    [],
    [[hx + 5.0, hy + 2.6, 0.7, 0.5]],
    [[hx + 5.4, hy + 2.2, 0.9, 0.6], [hx + 6.6, hy + 1.2, 0.6, 0.45]],
    [[hx + 6.8, hy + 0.8, 0.55, 0.4]],
  ][f];
  out.push(puffs.map((p) => E(p[0], p[1], p[2], p[3], 'ally_breath', { ol: false, occ: false })));
  return out;
}

/**
 * Ingrid of the Mill: a broad, strong woman, dusted with flour, a kerchief over her hair and
 * her sleeves pushed up; she shoulders a sack of meal, the other fist on her hip.
 */
export function ingridModel(f: number): PrimTree {
  const b = breath(f);
  const hx = 15.2;
  const hy = 9.0 + b * 0.3;
  const ty = 17.0 + b * 0.25;
  const out: Out = [Sh(16, 28.6, 9.0, 2.3)];
  // the meal sack on her far shoulder, behind her head, its tied neck to the back
  const sx = 9.8;
  const sy = 10.6 + b * 0.2;
  out.push(
    E(sx, sy, 4.4, 3.0, 'vil_flour', { fl: 0.2 }),
    P([sx - 2.8, sy - 2.2, sx - 4.2, sy - 4.2, sx - 2.4, sy - 4.8, sx - 1.2, sy - 2.6], 'vil_flour', { bv: 0.4 }),
    K(sx - 2.9, sy - 2.6, sx - 1.3, sy - 2.9, 0.35, 0.35, 'leatherDark'),
    X(sx - 0.8, sy - 0.8, 2.6, 1.0, 'linen:2'),
    // the back arm up, the hand over the sack
    K(11.6, 13.6, 9.6, 12.8, 1.6, 1.3, 'woolBrown'), E(9.0, 12.6, 1.1, 1.1, 'skin'),
    // the brown dress, wide in the skirt, a flour-white apron
    P([11.4, 12.6, 19.8, 12.6, 21.0, 19.8, 22.6, 27.8, 16.2, 28.6, 9.6, 27.8, 10.6, 19.8], 'woolBrown', { bv: 1.2 }),
    P([12.6, 15.4, 19.4, 15.4, 20.2, 21.2, 20.6, 27.0, 16.2, 27.6, 12.0, 27.0, 12.0, 21.2], 'vil_flour', { bv: 0.8 }),
    K(12.2, ty + 1.4, 19.8, ty + 1.4, 0.5, 0.5, 'linen'),
    X(13.4, 22.4, 1.2, 0.8, 'linen:3'), X(17.6, 24.6, 1.4, 0.7, 'linen:3'),
    E(13.4, 28.3, 1.5, 0.7, 'leatherDark'), E(18.8, 28.4, 1.5, 0.7, 'leatherDark'),
    // head: broad and ruddy, flour on her nose, a linen kerchief tied over her hair
    E(hx + 0.2, hy, 3.6, 3.7, 'skin', { fl: 0.2 }),
    P([hx - 3.8, hy + 1.0, hx - 3.8, hy - 2.4, hx - 1.4, hy - 4.4, hx + 1.8, hy - 4.4, hx + 3.8, hy - 2.4, hx + 3.6, hy - 1.0, hx - 1.4, hy - 1.4, hx - 2.4, hy + 1.6], 'linen', { bv: 0.8 }),
    X(hx - 3.4, hy + 0.8, 1.0, 1.6, 'ally_hairBrown:2'),
    face(hx, hy),
    X(hx + 3.0, hy + 1.0, 0.7, 0.5, 'vil_flour:4'),
    K(hx + 3.2, hy + 0.8, hx + 3.7, hy + 1.9, 0.5, 0.45, 'skin'),
    // the near arm, sleeve pushed up, a fist on her hip
    K(19.6, 13.4, 21.8, 17.0, 1.6, 1.3, 'woolBrown'), K(21.8, 17.0, 20.6, 19.4, 1.3, 1.1, 'skin'),
    E(20.2, 19.8, 1.1, 1.1, 'skin'),
  );
  return out;
}

/**
 * Torstein the Cooper: stocky and dark-bearded in a slate tunic and a leather apron, an iron
 * barrel hoop over one shoulder and his mallet in the other hand.
 */
export function torsteinModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.4;
  const hy = 8.6 + b * 0.35;
  const ty = 17.0 + b * 0.3;
  const out: Out = [Sh(16.2, 28.6, 9.6, 2.3)];
  out.push(
    // the hoop, slung on the back shoulder
    E(10.6, 17.0, 3.6, 5.2, 'iron', { fl: 0.85 }),
    E(10.6, 17.0, 2.9, 4.5, 'iron', { fl: 0.85, ink: 0.3 }),
    // back arm, the hand on the hoop
    K(11.6, 13.4, 10.6, 17.0, 1.7, 1.4, 'cloak'), E(10.4, 17.6, 1.1, 1.1, 'skin'),
    // legs and boots
    K(13.4, 21.8, 12.8, 26.6, 1.9, 1.6, 'woolBrown'), K(18.0, 21.8, 18.8, 26.6, 1.9, 1.6, 'woolBrown'),
    E(12.8, 27.5, 2.3, 1.3, 'leatherDark'), E(19.2, 27.5, 2.3, 1.3, 'leatherDark'),
    // the slate tunic, the leather apron over it
    E(15.8, ty, 6.2, 6.0, 'cloak', { fl: 0.12 }),
    P([9.8, ty + 2.4, 21.8, ty + 2.4, 22.4, ty + 6.0, 9.2, ty + 6.0], 'cloak', { bv: 0.7 }),
    P([12.6, 13.8, 19.4, 13.8, 20.4, ty + 3.0, 20.0, ty + 7.0, 12.0, ty + 7.0, 11.6, ty + 3.0], 'leather', { bv: 0.8 }),
    K(10.0, ty + 1.8, 21.6, ty + 1.8, 0.6, 0.6, 'leatherDark'),
    X(13.2, ty + 4.4, 1.0, 0.6, 'wood:3'), // shavings caught in the apron
    // head: a square dark beard, a woollen cap
    E(hx, hy, 3.7, 3.8, 'skin', { fl: 0.2 }),
    P([hx - 2.8, hy + 1.6, hx - 0.2, hy + 1.8, hx + 0.6, hy + 2.6, hx + 2.6, hy + 2.6, hx + 3.2, hy + 1.8, hx + 4.0, hy + 1.8, hx + 3.8, hy + 4.8, hx + 1.4, hy + 5.6, hx - 1.6, hy + 5.0, hx - 2.8, hy + 3.0], 'ally_hairBrown', { bv: 0.8 }),
    X(hx + 0.4, hy + 0.2, 0.9, 0.9, EYE), X(hx + 2.6, hy + 0.2, 0.9, 0.9, EYE),
    K(hx - 0.2, hy - 0.6, hx + 1.6, hy - 0.8, 0.3, 0.3, 'ally_hairBrown'), K(hx + 2.2, hy - 0.8, hx + 3.6, hy - 0.6, 0.3, 0.3, 'ally_hairBrown'),
    E(hx + 3.8, hy + 1.0, 0.95, 0.85, 'skin'),
    P([hx - 3.8, hy - 1.0, hx - 3.4, hy - 3.4, hx - 0.8, hy - 4.8, hx + 2.2, hy - 4.6, hx + 3.8, hy - 2.6, hx + 3.8, hy - 1.0], 'woolGreen', { bv: 0.8 }),
    K(hx - 3.8, hy - 1.0, hx + 3.8, hy - 1.0, 0.55, 0.55, 'woolGreen'),
    // front arm, the mallet held low
    K(20.4, 13.2, 22.2, 17.4, 1.7, 1.4, 'cloak'), K(22.2, 17.4, 22.6, 20.0, 1.4, 1.2, 'skin'),
    E(22.8, 20.6, 1.15, 1.15, 'skin'),
    K(22.8, 21.0, 23.4 + w * 0.1, 25.0, 0.4, 0.35, 'wood'),
    K(21.8 + w * 0.1, 25.6, 25.0 + w * 0.1, 25.2, 1.2, 1.2, 'woodDark'),
  );
  return out;
}

/**
 * Sigrid the Weaver: grey-haired and straight-backed in a green shawl with a red border, a
 * distaff of fleece under her arm; she spins as she stands, the thread running down to a
 * turning drop-spindle.
 */
export function sigridModel(f: number): PrimTree {
  const b = breath(f);
  const hx = 14.8;
  const hy = 8.6 + b * 0.3;
  const ty = 16.8 + b * 0.25;
  const spin = [0, 0.6, 0, -0.6][f];
  const out: Out = [Sh(16, 28.6, 8.4, 2.2)];
  out.push(
    // the distaff, tucked under the back arm, its head of fleece above the shoulder
    K(12.0, 20.6, 9.0, 6.6, 0.3, 0.3, 'wood'),
    E(9.0, 6.4, 1.8, 2.6, 'vil_fleece', { fl: 0.2 }),
    // back arm, pinning the distaff
    K(11.6, 13.4, 10.8, 18.6, 1.4, 1.2, 'woolGreen'), E(11.2, 19.2, 1.0, 1.0, 'skin'),
    // a long blue-grey dress
    P([12.0, 12.4, 19.0, 12.4, 20.0, 19.6, 21.4, 27.8, 16.2, 28.6, 10.6, 27.8, 11.4, 19.6], 'wool', { bv: 1.2 }),
    K(16.0, 21.0, 15.4, 27.8, 0.45, 0.7, 'cloak', { occ: false }),
    E(13.6, 28.3, 1.4, 0.7, 'leatherDark'), E(18.6, 28.4, 1.4, 0.7, 'leatherDark'),
    // the shawl, crossed over the chest, its border red
    P([10.6, 12.0, 20.0, 11.8, 20.8, 15.0, 17.4, ty + 2.6, 15.6, ty + 3.4, 13.8, ty + 2.6, 10.4, 15.2], 'woolGreen', { bv: 0.9 }),
    K(13.8, ty + 2.6, 17.4, ty + 2.6, 0.4, 0.4, 'woolRed', { occ: false }),
    K(10.4, 15.2, 13.8, ty + 2.6, 0.35, 0.35, 'woolRed', { occ: false }), K(20.8, 15.0, 17.4, ty + 2.6, 0.35, 0.35, 'woolRed', { occ: false }),
    // head: lined, grey hair in a bun
    E(hx - 2.4, hy - 1.4, 1.8, 1.8, 'hairGrey'),
    E(hx + 0.2, hy, 3.3, 3.7, 'skin', { fl: 0.2 }),
    P([hx - 3.4, hy + 1.6, hx - 3.4, hy - 2.4, hx - 1.2, hy - 4.0, hx + 1.8, hy - 4.0, hx + 3.4, hy - 2.2, hx + 2.6, hy - 1.6, hx - 1.4, hy - 1.4, hx - 2.4, hy + 1.6], 'hairGrey', { bv: 0.7 }),
    X(hx + 0.4, hy + 0.4, 0.85, 0.8, EYE), X(hx + 2.5, hy + 0.4, 0.8, 0.8, EYE),
    X(hx + 1.4, hy + 2.6, 1.1, 0.35, '#8c4a44'),
    K(hx + 3.0, hy + 0.8, hx + 3.5, hy + 1.9, 0.5, 0.45, 'skin'),
    // front arm, the hand drawing the thread from the fleece
    K(19.2, 13.2, 21.2, 16.6, 1.4, 1.2, 'woolGreen'), K(21.2, 16.6, 21.6, 13.4, 1.2, 1.0, 'skin'),
    E(21.6, 12.8, 1.0, 1.0, 'skin'),
    // the thread: fleece to fingers, fingers down to the spindle
    K(10.4, 7.0, 21.2, 12.6, 0.12, 0.12, 'vil_yarn', { occ: false, ol: false }),
    K(21.8, 13.4, 22.4, 21.6, 0.12, 0.12, 'vil_yarn', { occ: false, ol: false }),
  );
  // the drop-spindle, turning: a cop of yarn on the shaft and a whorl below
  const sx = 22.4;
  out.push(
    K(sx, 21.6, sx, 26.6, 0.25, 0.22, 'wood'),
    E(sx, 23.2, 0.9, 1.3, 'vil_yarn'),
    E(sx, 25.4, 1.6, 0.55, 'woodDark'),
    X(sx - 0.4 + spin, 25.1, 0.6, 0.4, 'wood:4'),
  );
  return out;
}

/**
 * Young Leif: a boy of ten in a blue tunic a size too big and a belt cinched twice round,
 * his flax hair every which way, a wooden sword in his fist and his chin up.
 */
export function leifModel(f: number): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const hx = 15.2;
  const hy = 8.6 + b * 0.3;
  const ty = 16.8 + b * 0.25;
  const out: Out = [];
  out.push(
    // back arm, a fist at his side
    K(11.8, 13.4, 11.2, 18.4, 1.4, 1.2, 'wool'), E(11.2, 19.2, 1.1, 1.1, 'skin'),
    // legs apart, braced, in brown hose and too-big boots
    K(13.8, 21.8, 12.4, 26.6, 1.7, 1.5, 'woolBrown'), K(17.8, 21.8, 19.4, 26.6, 1.7, 1.5, 'woolBrown'),
    E(12.0, 27.5, 2.4, 1.4, 'leather'), E(19.8, 27.5, 2.4, 1.4, 'leather'),
    // the tunic, long and loose
    P([12.0, 12.6, 19.6, 12.6, 20.8, 19.8, 21.4, 23.6, 10.4, 23.6, 11.0, 19.8], 'wool', { bv: 1.0 }),
    K(11.0, ty + 2.4, 20.6, ty + 2.4, 0.55, 0.55, 'leather'),
    K(19.6, ty + 2.6, 20.2, ty + 5.4, 0.35, 0.25, 'leather'), // the belt's long tail
    // head: round, freckled, the hair in tufts
    E(hx, hy, 3.8, 3.9, 'skin', { fl: 0.2 }),
    P([hx - 4.0, hy + 1.0, hx - 4.2, hy - 2.0, hx - 3.0, hy - 4.0, hx - 1.6, hy - 3.6, hx - 0.8, hy - 5.0, hx + 0.6, hy - 4.0, hx + 2.0, hy - 5.0, hx + 2.6, hy - 3.6, hx + 4.0, hy - 3.4, hx + 3.8, hy - 1.4, hx + 1.0, hy - 2.2, hx - 1.6, hy - 1.4, hx - 2.8, hy + 1.4], 'hairFlax', { bv: 0.7 }),
    face(hx, hy, '#8c4a44'),
    X(hx + 1.6, hy + 1.4, 0.4, 0.4, '#a0603e'), X(hx + 2.6, hy + 1.6, 0.4, 0.4, '#a0603e'), // freckles
    E(hx + 3.8, hy + 0.9, 0.95, 0.85, 'skin'),
    // front arm, the wooden sword held up
    K(19.6, 13.2, 21.8, 16.4, 1.4, 1.2, 'wool'), K(21.8, 16.4, 22.4, 13.6, 1.2, 1.0, 'skin'),
    E(22.4, 13.0, 1.1, 1.1, 'skin'),
    K(21.0, 12.2, 23.8, 12.4, 0.45, 0.45, 'woodDark'),
    K(22.6 + w * 0.05, 11.8, 23.8 + w * 0.1, 4.2, 0.6, 0.45, 'wood'),
  );
  // a boy, drawn at the grown townsfolk's scale and shrunk about his feet
  return [Sh(16, 28.6, 7.2, 1.9), T(out, { s: 0.84, py: 28.6 })];
}
