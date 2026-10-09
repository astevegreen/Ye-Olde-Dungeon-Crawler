import { E, K, P, X, Lt, Sh, arc, breath, sway, type PrimTree } from './kit';
import { DARK, VIOL, claws, vEye, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** A round shield with a bite broken out of its upper edge, centred at (cx, cy). */
function brokenShield(cx: number, cy: number, rx: number, ry: number): Out {
  const pts: number[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI * 0.42 + (Math.PI * 2 * 0.86 * i) / n;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  // the break: a jagged notch between the ends of the rim
  pts.push(cx + rx * 0.1, cy - ry * 0.55, cx + rx * 0.3, cy - ry * 0.75, cx + rx * 0.5, cy - ry * 0.5);
  return [
    P(pts, 'woodDark', { bv: 0.7, n: [0.1, -0.05, 1] }),
    K(cx - rx * 0.9, cy + ry * 0.1, cx + rx * 0.9, cy + ry * 0.1, 0.4, 0.4, 'mon1_rust', { fl: 0.6 }),
    E(cx, cy + ry * 0.1, 1.2, 1.2, 'mon1_rust'),
  ];
}

/**
 * The skeleton: a barrow's oldest guest, nothing left but bone. Violet in the sockets, a rusted
 * sword raised, the broken shield still on its arm; the jaw works as it idles.
 */
function skeleton(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const jaw = [0, 0.35, 0, 0.2][f];
  const hx = 17.6;
  const hy = 7.8 + b * 0.3;
  const out: Out = [Sh(16, 28.6, 6.6, 1.9)];
  // back arm and the broken shield
  out.push(
    K(13, 11.8, 11.6, 15.8, 0.5, 0.42, 'boneOld'), K(11.6, 15.8, 10.8, 19.2, 0.42, 0.36, 'boneOld'),
    brokenShield(9.6, 19.4, 3.8, 4.4),
  );
  // legs
  for (const [hip, knee, foot] of [[[14.6, 20.6], [13.8, 24.2], [13.2, 27.8]], [[17.6, 20.6], [18.6, 24.2], [19.2, 27.8]]]) {
    out.push(
      K(hip[0], hip[1], knee[0], knee[1], 0.62, 0.5, 'bone'), E(knee[0], knee[1], 0.75, 0.7, 'bone'),
      K(knee[0], knee[1], foot[0], foot[1], 0.5, 0.4, 'bone'), E(foot[0] + 0.5, foot[1] + 0.2, 1.4, 0.55, 'bone'),
    );
  }
  // pelvis and spine
  out.push(
    E(16.1, 20, 2.7, 1.4, 'bone'), X(15.2, 19.8, 0.8, 0.7, DARK), X(16.6, 19.8, 0.8, 0.7, DARK),
    K(16.2, 19.4, 16.6, 11.6, 0.42, 0.42, 'boneOld'),
  );
  // ribs: four hoops narrowing toward the waist, a sternum down the front
  for (let i = 0; i < 4; i++) {
    const y = 12.4 + i * 1.4 + b * 0.15;
    const rx = 3.4 - i * 0.35;
    out.push(arc(16.6, y - 0.8, rx, 1.5, 0.15, Math.PI - 0.15, 7, 0.38, 0.38, 'bone'));
  }
  out.push(
    K(17.2, 12.2, 17.2, 16.2, 0.4, 0.3, 'bone'),
    K(12.6, 11.4, 20.6, 11.4, 0.48, 0.48, 'bone'),
    // skull: sockets, a nose hole, teeth; the jaw hangs a little lower on the breath
    K(hx - 0.8, 11.6, hx - 0.6, hy + 2.2, 0.42, 0.42, 'boneOld'),
    E(hx - 0.2, hy - 0.4, 2.7, 2.6, 'boneOld'),
    E(hx + 0.6, hy + 1.2, 2.2, 1.6, 'boneOld', { fl: 0.2 }),
    E(hx + 0.8, hy + 2.8 + jaw, 1.7, 0.8, 'boneOld', { fl: 0.2 }),
    X(hx - 1.7, hy - 0.6, 1.3, 1.5, DARK), X(hx + 0.6, hy - 0.6, 1.2, 1.5, DARK),
    vEye(hx - 1.3, hy - 0.2, 0.6, 0.6), vEye(hx + 0.9, hy - 0.2, 0.6, 0.6), Lt(hx, hy, 4, VIOL, 0.45),
    X(hx - 0.2, hy + 1.1, 0.6, 0.7, DARK),
    X(hx - 0.2, hy + 2.2, 2.6, 0.3 + jaw, DARK), X(hx + 0.2, hy + 1.9, 0.4, 0.5, 'bone:3'), X(hx + 1, hy + 1.9, 0.4, 0.5, 'bone:3'), X(hx + 1.8, hy + 1.9, 0.4, 0.5, 'bone:3'),
  );
  // front arm and the rusted sword
  const gx = 22.6;
  const gy = 17.8;
  out.push(K(20.2, 11.6, 21.8, 15, 0.5, 0.42, 'bone'), K(21.8, 15, gx, gy, 0.42, 0.36, 'bone'));
  const tx = 26.4 + sw * 0.3;
  const ty = 5.2;
  out.push(
    P([gx - 0.6, gy - 1.6, gx + 0.7, gy - 1.2, tx + 0.3, ty + 1.4, tx, ty, tx - 0.8, ty + 1], 'mon1_oldSteel', { bv: 0.6 }),
    X(gx + 1.2, gy - 4.6, 0.9, 1, 'mon1_rust:3'), X(gx + 2.4, gy - 8.2, 0.8, 0.8, 'mon1_rust:2'),
    K(gx - 1.6, gy - 1.8, gx + 1.8, gy - 0.8, 0.45, 0.45, 'mon1_rust'), K(gx, gy - 1.2, gx - 0.6, gy + 1.4, 0.4, 0.4, 'leatherDark'),
    E(gx - 0.1, gy - 0.6, 0.9, 0.9, 'bone'),
  );
  return out;
}

/**
 * The nár: a miner's corpse from the silver veins, walking. Bloated and hunched, one arm
 * reaching, the jaw slack; tarnished silver has run black through its veins.
 */
function nar(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const hx = 20.4;
  const hy = 11.6 + b * 0.4;
  const out: Out = [Sh(16, 28.6, 7.6, 2)];
  // dangling back arm
  out.push(
    K(12.6, 13.6, 11.2, 18.8, 1.15, 0.95, 'mon3_narSkin', { ink: -0.06 }), K(11.2, 18.8, 10.8 + sw * 0.2, 22.2, 0.95, 0.8, 'mon3_narSkin', { ink: -0.06 }),
    claws(10.8 + sw * 0.2, 22.6, Math.PI * 0.55, 1.4, 'mon3_narSkin', 3, 0.3),
    // shuffling legs in rotted breeches
    K(13.8, 21.8, 12.8, 27.2, 1.35, 1.1, 'mon1_wrap'), K(18, 21.8, 19.4, 26.8, 1.35, 1.1, 'mon1_wrap'),
    E(12.4, 27.8, 1.8, 1, 'mon3_narSkin'), E(19.8, 27.6, 1.8, 1, 'leatherDark'),
    // hunched, bloated body under a torn shirt
    E(16, 17, 4.6, 5.4, 'mon3_narSkin', { a: -0.3 }),
    E(16.4, 20.2, 4, 3.2, 'mon3_narSkin'),
    P([11.8, 13.4, 19.6, 11.8, 21, 16.6, 19.2, 18.4, 18, 16.8, 16.4, 19.4, 14.6, 17.6, 12.8, 19.6, 11.4, 17], 'mon1_rag', { bv: 0.7 }),
  );
  // the black-silver veins, catching the light at a few points
  const vein = (pts: number[]): Out => {
    const o: Out = [];
    for (let i = 0; i + 3 < pts.length; i += 2) o.push(K(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], 0.2, 0.18, 'mon3_tarnish', { ol: false, occ: false }));
    return o;
  };
  out.push(
    vein([14, 20.6, 15.6, 19.6, 16.4, 21.4, 18.4, 20.4]), vein([17.2, 22.6, 18.6, 21.8, 19.4, 22.6]),
    vein([hx - 1.8, hy + 2.4, hx - 2.6, hy + 4.2, hx - 2, hy + 5.8]), vein([12.4, 15.4, 11.8, 17.4, 12.2, 19]),
    X(15.6, 19.5, 0.5, 0.5, 'silver:5'), X(18.4, 20.3, 0.4, 0.4, 'silver:5'), X(hx - 2.7, hy + 4, 0.4, 0.4, 'silver:5'),
    // head hung forward: lank hair, one eye gone, the jaw hanging open
    E(hx, hy, 2.9, 3.1, 'mon3_narSkin', { fl: 0.2 }),
    K(hx - 2.2, hy - 1.6, hx - 3 + sw * 0.2, hy + 2.6, 0.45, 0.2, 'hairDark'), K(hx - 1, hy - 2.6, hx - 1.8 + sw * 0.2, hy + 1.4, 0.4, 0.2, 'hairDark'),
    X(hx + 0.2, hy - 0.6, 1.3, 1.3, DARK), X(hx + 1.9, hy - 0.5, 1.1, 1.2, DARK),
    vEye(hx + 0.5, hy - 0.2, 0.8, 0.7), Lt(hx + 0.8, hy, 3.5, VIOL, 0.4),
    E(hx + 0.6, hy + 2.6, 1.5, 1.1, 'mon3_narSkin', { ink: -0.05 }), X(hx, hy + 2, 2, 1.2 + b * 0.3, DARK),
    // the reaching arm
    K(19.4, 15.6, 22.8, 18.8, 1.1, 0.95, 'mon3_narSkin'), K(22.8, 18.8, 26.6, 19.6 + sw * 0.3, 0.95, 0.75, 'mon3_narSkin'),
    claws(26.8, 19.7 + sw * 0.3, 0.25, 1.5, 'mon3_narSkin', 3, 0.3),
    vein([21.4, 17.4, 23.6, 19, 25.6, 19.2]),
  );
  return out;
}

/**
 * The silver wight: a miner who died guarding his lode and guards it still. Gaunt and hooded,
 * tarnished from crown to mail, his pick held upright like a halberd and one claw spread over
 * the silver-veined rock at his feet.
 */
function wight(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const hx = 17.4;
  const hy = 8.8 + b * 0.3;
  const ty = 16.2 + b * 0.2;
  const out: Out = [Sh(17, 28.6, 9.4, 2.2)];
  // the miner's pick, gripped low and raised past his shoulder
  const px = 7.4;
  const py = 7.2;
  out.push(
    K(10.8, 21.4, px, py, 0.5, 0.45, 'woodDark'),
    K(px, py, px - 3.6, py + 3, 0.7, 0.2, 'mon3_tarnish'), K(px, py, px + 3.8, py - 1, 0.7, 0.2, 'mon3_tarnish'),
    E(px, py, 0.85, 0.85, 'mon3_tarnish'), X(px + 2, py - 0.8, 0.8, 0.4, 'mon3_vein:5'),
    // back arm to the haft
    K(12.6, 12.4, 10.8, 15.6, 0.95, 0.8, 'mon3_wightShroud'), E(9.8, 16.4, 1, 0.95, 'mon3_wightSkin'),
    // long shroud in tatters over tarnished mail
    P([11.4, 11, 20.8, 11.2, 22.4, 19.6, 21.8 + sw * 0.3, 28, 19.8, 26.6, 17.6, 28.2, 15.4, 26.4, 13.2, 28.2, 11.4, 26.4, 10.4 + sw * 0.3, 27.8, 11, 19], 'mon3_wightShroud', { bv: 1 }),
    E(16.8, ty - 1, 3.4, 4.4, 'mon3_wightMail', { fl: 0.15 }),
    X(15.4, ty - 2.6, 1, 0.9, 'mon3_tarnish:2'), X(17.6, ty + 0.6, 1.2, 0.9, 'mon3_tarnish:2'),
    K(13.4, ty + 3.4, 20.4, ty + 3.2, 0.5, 0.5, 'leatherDark'), X(16.4, ty + 2.8, 1.2, 1, 'mon3_tarnish:4'),
    // the lode he keeps: a rock run through with silver
    P([18.8, 28.2, 19.4, 24, 21.8, 21.4, 25.4, 20.8, 28.4, 22.8, 29.2, 26.4, 28.2, 28.4], 'mon3_lode', { bv: 1.1 }),
    K(20.4, 25.2, 23.8, 23, 0.35, 0.25, 'mon3_vein', { ol: false }), K(23.8, 23, 27.6, 24.6, 0.3, 0.2, 'mon3_vein', { ol: false }),
    K(21.8, 27.2, 26, 26, 0.3, 0.22, 'mon3_vein', { ol: false }), X(23.6, 22.7, 0.6, 0.6, 'mon3_vein:5'), X(26.4, 25.8, 0.5, 0.5, 'mon3_vein:5'),
    // the front arm reaching down, claws spread over the rock
    K(20.4, 12.4, 22.4, 16.4, 0.95, 0.8, 'mon3_wightShroud'), K(22.4, 16.4, 23.4, 19.8, 0.7, 0.55, 'mon3_wightSkin'),
    claws(23.6, 20.4, Math.PI * 0.42, 1.6, 'mon3_wightSkin', 4, 0.26),
    // gaunt neck and long head under a hood; a tarnished circlet, sunken cheeks, thin white hair
    K(hx - 0.8, ty - 4.6, hx - 0.2, hy + 2, 0.75, 0.6, 'mon3_wightSkin'),
    P([hx - 3.8, hy + 3.4, hx - 4, hy - 1.2, hx - 1.6, hy - 4.6, hx + 2, hy - 4.6, hx + 3.6, hy - 2.2, hx + 1.4, hy - 2.4, hx - 1.4, hy - 1.2, hx - 1.6, hy + 3.4], 'mon3_wightShroud', { bv: 0.9 }),
    E(hx + 0.6, hy + 0.2, 2.4, 3.1, 'mon3_wightSkin', { fl: 0.2 }),
    K(hx - 1.4, hy - 1.6, hx + 3, hy - 1.6, 0.4, 0.4, 'mon3_tarnish'), X(hx + 1.6, hy - 2, 0.5, 0.5, 'mon3_vein:5'),
    X(hx - 0.4, hy - 0.8, 1.3, 1.4, DARK), X(hx + 1.8, hy - 0.8, 1.1, 1.4, DARK),
    vEye(hx - 0.1, hy - 0.4, 0.8, 0.8), vEye(hx + 2, hy - 0.4, 0.7, 0.8), Lt(hx + 1, hy, 4.5, VIOL, 0.5),
    X(hx - 0.2, hy + 1.2, 0.9, 0.6, 'mon3_wightSkin:1'), X(hx + 2, hy + 1.2, 0.7, 0.6, 'mon3_wightSkin:1'), X(hx + 0.4, hy + 2.4, 1.8, 0.4, DARK),
    K(hx - 2.2, hy + 0.4, hx - 2.8 + sw * 0.2, hy + 6.2, 0.35, 0.15, 'mon1_beard'), K(hx - 1.4, hy + 1.6, hx - 1.8 + sw * 0.2, hy + 6.8, 0.3, 0.12, 'mon1_beard'),
  );
  return out;
}

/**
 * The walking dead without a barrow's gear. Kinds: `skeleton` (bone, a rusted sword and a
 * broken shield), `nar` (a bloated miner's corpse, silver gone black in its veins) and `wight`
 * (a tarnished, hooded guardian over his silver lode).
 */
export function corpseModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'nar': return nar(f);
    case 'wight': return wight(f);
    default: return skeleton(f);
  }
}
