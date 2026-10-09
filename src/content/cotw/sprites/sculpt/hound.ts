import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { calmEye, kinTag } from './ally';
import type { FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** Fenrir-kin Battle-Hound: a big grey-black war-hound under the biggest pack. */
function battle(f: number, b: number, w: number, flick: number): Out {
  const C = 'ally_furWar';
  const D = 'ally_furWarDark';
  const L = 'ally_furWarPale';
  const ink = { ink: -0.16 };
  const out: Out = [Sh(16.2, 28.6, 11.4, 2.3)];
  out.push(
    // tail: a sabre curve held high, wagging
    K(6.4, 14.2, 3.8, 11.0, 1.6, 1.35, C), K(3.8, 11.0, 3.4 + w * 0.6, 7.4, 1.35, 1.0, C), K(3.4 + w * 0.6, 7.4, 4.2 + w * 1.2, 5.0, 1.0, 0.45, D),
    // far legs
    K(11.8, 19.2, 10.6, 24.2, 1.6, 1.1, D, ink), K(10.6, 24.2, 11.4, 27.4, 1.05, 0.9, D, ink), E(12.2, 27.7, 1.6, 0.8, D, ink),
    K(22.2, 19.0, 22.6, 27.3, 1.6, 1.1, D, ink), E(23.4, 27.6, 1.6, 0.8, D, ink),
    // body: deep chest, tucked belly, pale chest
    E(8.8, 15.8, 4.1, 4.3, C), E(14.6, 15.6, 7.0, 3.9, C), E(20.4, 16.8 - b * 0.15, 4.3, 5.4 + b * 0.3, C),
    E(22.8, 18.2, 2.0, 3.6, L, { occ: false }),
    // near hind leg
    E(9.8, 18.0, 3.5, 4.2, C, { a: 0.3 }),
    K(10.6, 21.0, 8.4, 24.8, 1.8, 1.15, C), K(8.4, 24.8, 9.2, 27.9, 1.1, 1.0, D), E(10.0, 28.2, 1.85, 0.9, D),
    // near front leg
    K(20.2, 19.0, 20.4, 25.0, 1.95, 1.3, C), K(20.4, 25.0, 20.8, 27.6, 1.3, 1.2, D), E(21.5, 28.2, 1.9, 0.9, D),
  );
  // the biggest pack: saddlebag on the flank, bedroll on top, studded girth
  out.push(
    P([10.8, 12.4, 16.4, 12.4, 16.7, 17.6, 15.6, 18.8, 11.8, 18.8, 10.6, 17.6], 'leather', { bv: 1.0 }),
    P([10.6, 12.2, 16.6, 12.2, 16.4, 14.6, 13.6, 15.4, 10.8, 14.6], 'leatherDark', { bv: 0.6 }),
    X(13.1, 14.4, 1.0, 1.2, 'bronze:4'),
    K(9.6, 10.8, 16.4, 10.8, 2.0, 2.0, 'woolBrown'), E(16.4, 10.8, 1.1, 2.0, 'linen', { fl: 0.5 }),
    K(11.8, 8.7, 11.8, 12.8, 0.5, 0.5, 'leatherDark'), K(14.8, 8.7, 14.8, 12.8, 0.5, 0.5, 'leatherDark'),
    K(17.4, 11.6, 18.4, 21.4, 1.0, 1.0, 'ally_collar'), K(18.0, 12.8, 21.4, 13.6, 0.75, 0.75, 'ally_collar'),
  );
  for (const y of [14.2, 16.6, 19.0]) out.push(X(17.5 + (y - 12) * 0.1, y, 0.75, 0.75, 'steel:5'));
  out.push(
    // neck and head
    K(20.4, 15.0, 23.2, 10.4, 3.8, 2.8, C),
    P([24.6, 7.4, 26.4, 3.0, 27.0, 7.0], D), // far ear
    E(24.4, 9.4, 3.3, 3.0, C),
    K(26.0, 10.2, 29.6, 11.0, 2.0, 1.35, L), K(25.6, 11.8, 28.8, 12.0, 1.2, 0.8, C),
    X(26.6, 11.55, 2.6, 0.4, 'ally_nose:1'),
    E(29.7, 10.4, 0.95, 0.85, 'ally_nose'),
    K(26.3, 9.2, 27.7, 12.0, 0.34, 0.34, 'ally_scar', { occ: false }), K(27.7, 9.6, 28.5, 11.0, 0.3, 0.3, 'ally_scar', { occ: false }),
    P([22.0, 7.8, 22.9 - flick, 3.0 + flick * 0.7, 24.7, 7.0], D, { bv: 0.5 }), // near ear
    X(22.6, 5.8 + flick * 0.5, 0.6, 1.4, 'ally_furWarPale:2'),
    calmEye(25.2, 8.4),
    // collar and kin-tag
    K(19.8, 11.2, 24.0, 14.2, 0.9, 0.9, 'ally_collar'),
    X(20.7, 11.6, 0.7, 0.7, 'steel:5'), X(22.3, 12.7, 0.7, 0.7, 'steel:5'),
    kinTag(24.2, 14.4, f),
  );
  return out;
}

/**
 * Frost-Ward Hound: broad and heavy, a thick white-blue coat, the plume tail curled over the
 * back, an iron chest-plate on the harness, frost on its breath.
 */
function frost(f: number, b: number, w: number, flick: number): PrimTree {
  const C = 'ally_furFrost';
  const D = 'ally_furFrostDark';
  const L = 'ally_furFrostPale';
  const ink = { ink: -0.16 };
  const tw = w * 0.35;
  const out: Out = [Sh(15.6, 28.6, 11.6, 2.4)];
  out.push(
    // far legs, thick
    K(11.2, 20, 10.4, 27.3, 2.0, 1.5, D, ink), E(11.2, 27.6, 1.9, 0.9, D, ink),
    K(21.6, 19, 21.8, 27.3, 2.0, 1.5, D, ink), E(22.6, 27.6, 1.9, 0.9, D, ink),
    // body: barrel-broad
    E(8.8, 16.6, 4.8, 5.0, C), E(14.4, 16.4, 8.2, 5.4, C), E(19.8, 16.8 - b * 0.15, 4.8, 5.6 + b * 0.3, C),
    E(14.6, 20.6, 6.2, 1.6, D, { occ: false, ink: -0.05 }),
    // near hind leg: heavy thigh, short shank
    E(9.6, 18.8, 3.9, 4.4, C, { a: 0.25 }),
    K(9.8, 21.8, 8.6, 25.4, 2.1, 1.55, C), K(8.6, 25.4, 9.2, 27.8, 1.5, 1.4, C), E(10.2, 28.1, 2.2, 1.0, L),
    // near front leg: a pillar
    K(19.4, 18.4, 19.8, 27.4, 2.3, 1.7, C), E(20.6, 28.1, 2.2, 1.0, L),
    // the curled plume tail lies over the back
    K(6.6, 14.2, 5.0 + tw, 10.0, 2.0, 1.9, C), K(5.0 + tw, 10.0, 6.8 + tw, 7.2, 1.9, 1.7, L), K(6.8 + tw, 7.2, 10.0 + tw, 7.6, 1.7, 1.3, L), K(10.0 + tw, 7.6, 11.0 + tw * 0.5, 10.0, 1.3, 0.8, C),
    // harness girth
    K(16.0, 11.2, 16.8, 21.6, 1.0, 1.0, 'ally_collar'),
    X(15.9, 15, 1.2, 1.4, 'iron:4'),
    // ruff: the thick fur collar
    E(21.0, 12.4, 4.6, 5.2, C, { a: 0.35 }),
    P([17.4, 14.6, 18.6, 18.0, 19.6, 16.0, 20.6, 19.0, 21.6, 16.4, 23.0, 18.4, 23.4, 14.2], C, { bv: 0.6 }),
  );
  out.push(
    // head: broad skull, short muzzle, small thick ears
    P([24.2, 7.0, 25.6, 4.4, 26.6, 7.2], D), // far ear
    E(24.0, 9.6, 3.7, 3.3, C),
    E(21.8, 10.6, 2.0, 2.8, L, { occ: false }), // pale cheek ruff
    K(26.0, 10.6, 28.9, 11.2, 2.3, 1.65, L), K(25.6, 12.3, 28.2, 12.5, 1.3, 0.9, C),
    X(26.4, 12.0, 2.4, 0.4, 'ally_nose:1'),
    E(29.2, 10.7, 1.0, 0.9, 'ally_nose'),
    P([21.6, 7.8, 22.6 - flick * 0.8, 4.4 + flick * 0.6, 24.2, 7.0], D, { bv: 0.7 }), // near ear
    calmEye(24.7, 8.6),
    // collar over the ruff
    K(19.6, 10.0, 23.6, 14.6, 0.95, 0.95, 'ally_collar'),
    // the iron chest-plate carries the kin rune
    P([21.2, 15.0, 24.8, 15.4, 25.2, 19.4, 23.2, 21.6, 21.0, 20.0], 'iron', { bv: 0.9, n: [0.25, -0.1, 1] }),
    X(22.6, 16.6, 0.6, 3.2, 'emKin:4'), X(23.2, 16.8, 0.7, 0.6, 'emKin:4'), X(23.2, 18.2, 0.7, 0.6, 'emKin:4'), X(21.9, 17.5, 0.7, 0.6, 'emKin:4'),
    Lt(22.9, 18.2, 5.5, '#f0c062', 0.45 + b * 0.12),
    X(23.7, 14.3, 0.7, 1.3, 'gold:4'), // the ring that hangs the plate from the collar
  );
  // frost breath, added after the shift: a puff that grows, drifts down and thins
  const puffs = [
    [[29.2, 12.9, 0.9, 0.7]],
    [[29.7, 13.2, 1.3, 0.95], [30.9, 14.5, 0.6, 0.5]],
    [[30.3, 13.6, 1.7, 1.15], [31.3, 12.3, 0.5, 0.4]],
    [[30.9, 14.3, 1.3, 0.9]],
  ][f];
  const mist = puffs.map((p) => E(p[0], p[1], p[2], p[3], 'ally_breath', { ol: false, occ: false, ink: 0.15 }));
  return [T(out, { dx: -1.2 }), mist];
}

/**
 * Ember-Fang Wolf: lean and fast, a rust coat with a wolf's pale mask, ember fangs and an
 * ember-lit mane tip. Still an ally: kin collar, ears up, tail carried level and wagging.
 */
function ember(f: number, b: number, w: number, flick: number): Out {
  const C = 'ally_furRust';
  const D = 'ally_furRustDark';
  const L = 'ally_furRustPale';
  const ink = { ink: -0.16 };
  const fl = [0, 0.5, 1, 0.3][f]; // ember flicker
  const out: Out = [Sh(15.6, 28.6, 11.4, 2.0)];
  out.push(
    // tail: bushy, carried level behind like a banner, wagging
    K(6.4, 14.6, 3.4, 12.4 + w * 0.4, 1.6, 2.2, C), K(3.4, 12.4 + w * 0.4, 2.2, 9.8 + w * 1.0, 2.2, 0.7, D),
    // far legs, long and thin
    K(11.2, 19.4, 9.0, 24.2, 1.35, 0.9, D, ink), K(9.0, 24.2, 9.8, 27.4, 0.9, 0.75, D, ink), E(10.6, 27.6, 1.4, 0.7, D, ink),
    K(22.0, 19.0, 22.6, 27.2, 1.35, 0.9, D, ink), E(23.4, 27.5, 1.45, 0.7, D, ink),
    // body: deep chest, tucked waist, dark saddle, cream underside
    E(8.6, 16.0, 3.7, 3.9, C), E(14.2, 15.8, 6.2, 3.0, C), E(19.8, 16.6 - b * 0.15, 3.9, 4.7 + b * 0.25, C),
    E(11.6, 13.8, 5.2, 1.5, D, { occ: false, ink: 0.06 }),
    E(21.6, 18.4, 2.0, 3.0, L, { occ: false }),
    // near hind leg: a sprinter's angle
    E(9.4, 18.0, 3.2, 3.8, C, { a: 0.35 }),
    K(10.2, 20.6, 7.6, 24.6, 1.5, 0.95, C), K(7.6, 24.6, 8.4, 27.9, 0.95, 0.85, D), E(9.2, 28.1, 1.6, 0.8, D),
    // near front leg
    K(20.0, 18.6, 20.6, 27.6, 1.6, 1.0, C), K(20.4, 24.6, 20.6, 27.6, 1.0, 0.95, D), E(21.4, 28.1, 1.6, 0.8, D),
    // thick neck, head carried level with the shoulders
    K(19.8, 15.0, 23.4, 12.4, 3.4, 2.6, C),
    // the mane: a dark ruff swept back from the skull over the shoulders...
    P([24.2, 9.8, 21.4, 9.4, 18.4, 10.4, 15.4, 11.4, 13.0, 12.6, 15.6, 13.0, 15.0, 13.8, 18.2, 14.0, 21.0, 14.4, 23.4, 12.8], D, { bv: 0.7 }),
  );
  // ...whose trailing tip burns: three ember tongues swept back
  for (const [x, y, s] of [[18.4, 10.4, 0.75], [16.4, 11.0, 1.0], [14.4, 11.8, 0.85]]) {
    const t = s * (1 + fl * 0.25);
    out.push(P([x + 0.9, y + 0.9, x - 1.6 * t, y - 1.7 * t, x - 1.1, y + 1.1], 'emFire'));
  }
  out.push(
    P([17.0, 11.4, 15.2 - fl * 0.4, 9.8 - fl * 0.3, 15.4, 11.9], 'emFireCore'),
    Lt(15.8, 11.0, 7, '#ff8a2c', 0.65 + fl * 0.15),
    // head: a wedge with a pale mask, ears set back
    P([24.0, 10.2, 25.4, 6.4, 26.2, 10.0], D), // far ear
    E(24.8, 11.6, 3.0, 2.6, C),
    E(24.6, 13.1, 1.9, 1.3, L, { occ: false }),
    K(26.4, 12.2, 29.8, 13.2, 1.8, 0.85, C), K(26.4, 13.7, 29.0, 13.7, 1.0, 0.6, L),
    X(26.8, 13.2, 2.4, 0.4, 'ally_nose:1'),
    E(29.9, 12.7, 0.8, 0.7, 'ally_nose'),
    // ember fangs hang over the closed jaw
    X(28.8, 13.4, 0.55, 1.2, 'emFireCore:4'), X(27.6, 13.4, 0.5, 0.9, 'emFire:3'),
    P([22.4, 10.6, 23.2 - flick, 6.2 + flick * 0.8, 24.8, 9.8], D, { bv: 0.5 }), // near ear
    X(23.1, 7.8 + flick * 0.6, 0.6, 1.4, 'ally_furRustPale:2'),
    calmEye(25.4, 10.8),
    // collar and kin-tag
    K(20.0, 11.8, 22.8, 15.4, 0.85, 0.85, 'ally_collar'),
    kinTag(23.0, 15.4, f, 0.95),
  );
  return out;
}

/**
 * The companion hounds, facing the way the hero faces. Kinds: `battle` (the Fenrir-kin
 * Battle-Hound under its pack), `frost` (the Frost-Ward Hound, plume tail and chest-plate) and
 * `ember` (the Ember-Fang Wolf, its mane tip burning). Enemy wolves snarl head-down with raised
 * hackles; these never do.
 */
export function houndModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const w = sway(f);
  const flick = f === 2 ? 1 : 0; // the near ear flicks back on one frame
  if (v.kind === 'frost') return frost(f, b, w, flick);
  if (v.kind === 'ember') return ember(f, b, w, flick);
  return battle(f, b, w, flick);
}
