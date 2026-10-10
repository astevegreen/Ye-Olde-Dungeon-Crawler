import { hash2 } from '../sprites/sculpt/kit';
import { Buf, C, LOOP, TAU, applyVignette, clamp, dl, letter, measure, mixc, noise1, over, paintText, particles, smooth, unpack, type TextPalette } from './paint';
import { TP, buildTitle, titleLayout, type TitleScene } from './title';
import type { Boxes, Scene } from './scene';

// ==================================================================== RAGNARÖK
// The other ending, the same view. Níðhögg is dead and the World Tree gives
// way: Surtr's fire burns beyond the mountains and lights the world from
// behind; the wolf has caught the sun, a black disc in a ring of blood; the
// stars fall; the castle burns; the fjord's ice splits over red water; ash
// comes down and embers go up. On the snow below, the hero fights one of
// Surtr's fire-giants: its burning sword comes down on his raised shield,
// sparks burst at every blow, and his axe is drawn back to answer.
const RP = {
  sky: ['#050208', '#0e040c', '#1c0710', '#2e0b14', '#481016', '#681816', '#8e2414', '#b63a16', '#da6020', '#f2913a'].map(C),
  ramp: ['#060208', '#10050b', '#1c0810', '#2c0c12', '#421214', '#5e1a16', '#862818', '#b4441c'].map(C),
  shade: C('#12060c'), ember: C('#ff6a24'), hot: C('#ffc060'),
  corona: ['#4a0a0c', '#8a1610', '#d03c18', '#ff9a40', '#fff0c8'].map(C),
  disc: C('#050104'),
  fire: ['#5a140c', '#a8300f', '#e06018', '#ffa038', '#ffe090', '#fff8e0'].map(C),
  smoke: ['#1c0a0e', '#2a1014', '#3c181a'].map(C),
  crack: ['#5a140e', '#c8461a', '#ffb048'].map(C),
  ash: ['#3c3034', '#5e4e50', '#8a7a76'].map(C),
  star: ['#ff9a50', '#ffd8a8', '#fff6e8'].map(C),
  banner: ['#0a0408', '#1a0a0e', '#2e1216'].map(C),
};
const RAGNAROK_PAL: TextPalette = { shadow: C('#020103'), outline: C('#0c0306'), snow: C('#fff0c8'), glint: C('#ffffff'), bands: [[0.16, C('#ffe6a8')], [0.42, C('#ffb04a')], [0.52, C('#f07424')], [0.62, C('#a82c16')], [0.86, C('#e05a24')], [9, C('#ffac58')]] };
/** One column of flame from (x, y) up h px: hottest at its base and toward the heart of its fire (core 0..1), the tip bent by the wind. */
function flameCol(F: Buf, x: number, y: number, h: number, core: number, lean: number): void {
  for (let j = -1; j < h; j++) {
    const r = Math.max(0, j) / Math.max(1, h), hv = (1 - r) * (0.42 + 0.58 * core);
    F.set(x - r * r * lean, y - j, RP.fire[hv > 0.84 ? 5 : hv > 0.66 ? 4 : hv > 0.48 ? 3 : hv > 0.28 ? 2 : 1]);
  }
}
/**
 * Shapes in a figure's own units, its feet at the origin and +x toward its
 * foe, stamped into a mask buffer at scale k (mirrored when it faces left).
 */
function shaper(buf: Buf, ox: number, oy: number, k: number, flip: boolean) {
  const T = (x: number, y: number): [number, number] => [ox + (flip ? -x : x) * k, oy + y * k];
  const disc = (x: number, y: number, r: number, c: number): void => {
    const [cx, cy] = T(x, y), R = Math.max(0.5, r * k);
    for (let yy = Math.floor(cy - R); yy <= cy + R; yy++) for (let xx = Math.floor(cx - R); xx <= cx + R; xx++) if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= R) buf.set(xx, yy, c);
  };
  const cap = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c: number): void => {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * k * 1.5));
    for (let i = 0; i <= n; i++) { const q = i / n; disc(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, r0 + (r1 - r0) * q, c); }
  };
  const limb = (pts: number[], r0: number, r1: number, c: number): void => {
    const n = pts.length / 2 - 1;
    for (let i = 0; i < n; i++) cap(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, c);
  };
  const poly = (pts: number[], c: number): void => { const out: number[] = []; for (let i = 0; i < pts.length; i += 2) out.push(...T(pts[i], pts[i + 1])); buf.poly(out, c); };
  const ell = (x: number, y: number, rx: number, ry: number, a: number, c: number): void => {
    const [cx, cy] = T(x, y), RX = rx * k, RY = ry * k, ca = Math.cos(flip ? -a : a), sa = Math.sin(flip ? -a : a), R = Math.max(RX, RY);
    for (let yy = Math.floor(cy - R); yy <= cy + R; yy++) for (let xx = Math.floor(cx - R); xx <= cx + R; xx++) {
      const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy, p = (dx * ca + dy * sa) / RX, q = (-dx * sa + dy * ca) / RY;
      if (p * p + q * q <= 1) buf.set(xx, yy, c);
    }
  };
  return { T, disc, cap, limb, poly, ell };
}
/** Smooth 2-D value noise in [0, 1], one knot every `step`. */
const noise2 = (x: number, y: number, step: number, seed: number): number => {
  const i = Math.floor(x / step), j = Math.floor(y / step), fx = x / step - i, fy = y / step - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(i * 7 + j * 131, seed), b = hash2((i + 1) * 7 + j * 131, seed), c = hash2(i * 7 + (j + 1) * 131, seed), d = hash2((i + 1) * 7 + (j + 1) * 131, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
};

function ragnarokText(IW: number, IH: number) {
  const L = titleLayout(IW, IH), mask = new Buf(IW, IH);
  const wBig = measure('RAGNARÖK', L.cap, L.b, L.gap), wS = measure('DOOM OF THE GODS', L.capS, L.bS, L.gapS), w = Math.max(wBig, wS);
  letter(mask, 'RAGNARÖK', L.x, L.y, L.cap, L.b, L.gap);
  letter(mask, 'DOOM OF THE GODS', L.x + Math.round((wBig - wS) / 2), L.y2, L.capS, L.bS, L.gapS);
  const bottom = L.y2 + L.capS, top = L.y - Math.ceil((4 * (L.cap - L.b)) / 12);
  return { L, w, bottom, text: { mask, x0: L.x - 2, y0: top - 2, x1: L.x + w + 2, y1: bottom + 2, lines: [{ y: L.y, cap: L.cap }, { y: L.y2, cap: L.capS, small: true }] } };
}

/** A roof on fire: its centre, the blaze's half-width, the roof's apex and slope, the flames' height. */
interface Blaze {
  cx: number;
  hw: number;
  ap: number;
  slope: number;
  fh: number;
}

/** The hero and the fire-giant, built once (`buildFight`). */
interface Fight {
  /** The giant's and the hero's figures, 0 clear. */
  gl: Buf;
  hl: Buf;
  /** Pixel index and heat level of each glowing seam in the giant's hide. */
  seams: number[];
  /** Where the blade meets the shield. */
  contact: [number, number];
  ground: number;
  eyes: Array<[number, number]>;
  head: { c: [number, number]; r: number };
  blade: { a: [number, number]; dir: [number, number]; len: number };
}

interface RagnarokScene extends TitleScene {
  /** The swallowed sun: x, y, radius. */
  eclipse: [number, number, number];
  /** The fire beyond the mountains, per column. */
  heat: Float32Array;
  crackPx: number[];
  slitPx: number[];
  fires: Blaze[];
  fight: Fight;
}

export function buildRagnarok(base: Scene): RagnarokScene {
  const cold: { crack: number[]; slit: number[] } = { crack: [], slit: [] };
  const sc = buildTitle(base, null);
  const { IW, IH, u } = sc, hz = sc.hz, iceB = sc.iceB;
  const X = (d: number): number => IW - (456 - d) * u, Y = (d: number): number => d * u;
  const ex = X(236), ey = Y(64), er = 8 * u;
  const eclipse: RagnarokScene['eclipse'] = [ex, ey, er];
  // the fire beyond the mountains, brightest in patches toward the crag
  const heat = new Float32Array(IW);
  for (let x = 0; x < IW; x++) heat[x] = clamp(0.3 + 0.7 * smooth(IW * 0.05, IW * 0.6, x) * (0.5 + 0.5 * noise1(x, 34 * u, 71)), 0, 1);
  const sky = new Buf(IW, IH), skyLv = new Uint8Array(IW * IH);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const down = clamp(y / (hz + 4), 0, 1), halo = clamp(1 - Math.hypot(x - ex, y - ey) / (44 * u), 0, 1);
    const lv = clamp(dl(x, y, Math.pow(down, 1.6) * (4.6 + 4.4 * heat[x]) + halo * halo * 2.4), 0, RP.sky.length - 1);
    sky.px[y * IW + x] = RP.sky[lv]; skyLv[y * IW + x] = lv;
  }
  sc.sky = sky;
  sc.stars = sc.stars.filter(([, y]) => y < IH * 0.24);
  // the night's colours burned down: silhouettes against the fire above the
  // horizon, the sky's red held in the ice, the snow dark toward the eye
  const fg = sc.fg.px, src = fg.slice();
  for (let i = 0; i < fg.length; i++) {
    const c = fg[i];
    if (!c) continue;
    if (c === TP.crack) cold.crack.push(i);
    if (c === TP.slit) cold.slit.push(i);
    const x = i % IW, y = (i / IW) | 0, [r, g, b] = unpack(c), trod = c === TP.path || c === TP.pathLit || c === TP.print;
    const lum = trod ? 0.17 : (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    let v: number;
    if (y < hz) v = lum * 4.2;
    else if (sc.iceMask[i]) v = 1.4 + lum * 7 * (0.45 + 0.55 * heat[x]) * (1 - 0.4 * (y - hz) / (iceB - hz));
    else if (sc.snowMask[i]) v = 1.6 + lum * 9 * (0.5 + 0.5 * heat[x]) * (1 - 0.35 * clamp((y - iceB) / (IH - iceB), 0, 1)); // snow holds the sky's red
    else v = lum * 5;
    fg[i] = RP.ramp[clamp(dl(x, y, v), 0, RP.ramp.length - 1)];
  }
  // every edge against the sky takes the fire: tops rimmed, cloud bellies lit
  for (let y = 1; y < hz; y++) for (let x = 0; x < IW; x++) {
    const i = y * IW + x;
    if (!src[i]) continue;
    if (!src[i - IW]) {
      const lv = skyLv[i - IW];
      if (lv >= 3) { fg[i] = mixc(RP.sky[lv], RP.hot, 0.2 + 0.05 * lv); if (src[i + IW] && lv >= 6) fg[i + IW] = mixc(fg[i + IW], RP.sky[lv], 0.5); }
    } else if (y + 1 < hz && !src[i + IW]) {
      const lv = skyLv[i + IW];
      if (lv >= 3) fg[i] = mixc(RP.sky[lv], RP.hot, 0.12);
    }
  }
  // where the castle burns: [centre, blaze half-width, roof apex, roof base, roof half-width, flame height] in design units
  const fires: Blaze[] = [[354, 17, 26, 48, 21, 34], [323, 8, 32, 54, 9, 20], [384, 7, 15, 36, 10, 22], [403, 6, 46, 62, 8, 14]]
    .map(([cx, hw, ap, base, rh, fh]) => ({ cx: X(cx), hw: hw * u, ap: Y(ap), slope: (base - ap) / rh, fh: fh * u }));
  // their glow on the sky behind, and a warm cast on the walls below
  for (const f of fires) {
    const gx = f.cx, gy = f.ap - f.fh * 0.35, R = f.fh * 1.9;
    for (let y = Math.max(0, Math.floor(gy - R)); y < Math.min(IH, gy + R); y++) for (let x = Math.max(0, Math.floor(gx - R)); x < Math.min(IW, gx + R); x++) {
      const d = Math.hypot((x - gx) / 1.15, y - gy) / R;
      if (d >= 1) continue;
      const i = y * IW + x, k = (1 - d) * (1 - d);
      if (!fg[i]) { const lv = clamp(dl(x, y, skyLv[i] + k * 3.4), 0, RP.sky.length - 1); if (lv > skyLv[i]) { sky.px[i] = RP.sky[lv]; skyLv[i] = lv; } }
      else if (y > f.ap) fg[i] = mixc(fg[i], RP.ramp[7], k * 0.55);
    }
  }
  const fight = buildFight(sc, X, Y);
  sc.text = ragnarokText(IW, IH).text;
  return { ...sc, eclipse, heat, crackPx: cold.crack, slitPx: cold.slit, fires, fight };
}

/**
 * The fight, built once: two silhouettes against the fire, rimmed where
 * they meet the light. The giant's hide is a black crust split by glowing
 * seams; the hero is dark mail, his shield's face lit by the blade on it.
 */
function buildFight(sc: TitleScene, X: (d: number) => number, Y: (d: number) => number): Fight {
  const { IW, IH, u } = sc, fg = sc.fg.px;
  const gF = [X(374), Y(243)], hF = [X(286), Y(238)], gk = 1.25 * u, hk = 1.5 * u;
  // the hero, braced under the blow: shield up, axe drawn back
  const hm = new Buf(IW, IH), h = shaper(hm, hF[0], hF[1], hk, false);
  h.poly([-2, -25, 1, -24, -3, -15, -9, -9.5, -13.5, -11.5, -11, -16, -8, -20], 1); // cloak flying back on the hot wind
  h.limb([-1, -14, -4, -7, -7.5, -0.8], 1.9, 1.5, 1); // back leg
  h.limb([2, -14, 6.5, -9, 7.5, -0.8], 2, 1.6, 1); // front leg, bent
  h.ell(-8, -0.7, 2, 0.9, 0, 1); h.ell(8.6, -0.7, 2.1, 0.9, 0, 1);
  h.poly([-2.8, -14.5, 3.4, -14.5, 4.8, -24, -2.4, -25.6], 1); // mail
  h.disc(2.2, -27.6, 2.6, 1); // helmed head
  h.poly([3.6, -28.4, 5.3, -27.4, 4.2, -25.6], 1); // nasal
  h.limb([-1, -24, -4.5, -27, -6.2, -30.6], 1.35, 1.1, 1); // the axe arm, cocked back
  h.cap(-6.2, -29.6, -9.6, -41, 0.6, 0.55, 1); // the haft
  h.poly([-10.2, -42.8, -4.4, -46, -3.2, -39.4, -7.4, -36.6], 4); // the axe's bearded head
  h.limb([3.4, -23, 7.2, -27], 1.35, 1.2, 1); // the shield arm
  h.ell(10, -31, 3.5, 6.8, -0.55, 2); // the shield, raised into the blow
  h.disc(10.6, -31.4, 1, 3); // its boss
  const contact = h.T(12, -34.5);
  // the giant, three times his height, leaning its weight into the blow
  const gm = new Buf(IW, IH), g = shaper(gm, gF[0], gF[1], gk, true);
  g.limb([-6, -44, -14, -22, -22, -1.5], 6.5, 4.6, 1); // the back leg, thrust out straight
  g.limb([5, -44, 14, -25, 16, -1.5], 7, 5, 1); // the front leg, bent toward the hero
  g.ell(-23.5, -1.6, 6.2, 2.3, 0, 1); g.ell(17.5, -1.6, 6.6, 2.4, 0, 1);
  g.ell(0, -47, 11, 8, 0.1, 1); // hips
  g.ell(5, -64, 13.5, 19, 0.38, 1); // the great chest
  g.ell(12, -80, 9.5, 6, 0.3, 1); // hunched shoulders
  g.disc(18.5, -88, 6.2, 1); // the head, thrust forward under them
  g.poly([13, -86, 25.5, -88, 24.5, -80.5, 15, -79.5], 1); // a heavy jaw
  g.limb([4, -80, 16, -74, 27.5, -67], 4.8, 3.8, 1); // the back arm
  g.limb([15, -80, 24, -73, 31, -64], 5.2, 4, 1); // the front arm
  g.disc(27.5, -67, 3.6, 1); g.disc(31, -64, 3.8, 1); // fists on the hilt
  const hands = g.T(31, -64), bl = Math.hypot(contact[0] - hands[0], contact[1] - hands[1]), dir: [number, number] = [(contact[0] - hands[0]) / bl, (contact[1] - hands[1]) / bl];
  // how close a point lies to the burning blade, 1 on it, 0 at 16u
  const nearBlade = (x: number, y: number): number => {
    const s = clamp((x - hands[0]) * dir[0] + (y - hands[1]) * dir[1], 0, bl);
    return clamp(1 - Math.hypot(x - hands[0] - dir[0] * s, y - hands[1] - dir[1] * s) / (16 * u), 0, 1);
  };
  // edges take light only where it falls: from the fire behind (their tops) and from the blade
  const rim = (top: boolean, near: number): number => near > 0.15 ? mixc(RP.ember, RP.hot, near * 0.75) : top ? mixc(RP.ember, RP.ramp[5], 0.25) : 0;
  // the giant's hide: a black crust in plates, a few seams glowing from within, hottest at the chest
  const gl = new Buf(IW, IH), seams: number[] = [], cell = 8 * u, heart = g.T(6, -64);
  const ids = new Int32Array(2), feat = (cx: number, cy: number): [number, number] => [(cx + 0.15 + 0.7 * hash2(cx, cy + 401)) * cell, (cy + 0.15 + 0.7 * hash2(cx + 57, cy + 413)) * cell];
  for (let i = 0; i < gm.px.length; i++) {
    if (!gm.px[i]) continue;
    const x = i % IW, y = (i / IW) | 0, near = nearBlade(x, y);
    if (!gm.px[i - 1] || !gm.px[i + 1] || !gm.px[i - IW] || !gm.px[i + IW]) { const c = rim(!gm.px[i - IW], near); if (c) { gl.px[i] = c; continue; } }
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let d1 = 1e9, d2 = 1e9;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const [px, py] = feat(cx + k, cy + j), d = Math.hypot(x - px, y - py), id = (cx + k) * 1000 + cy + j;
      if (d < d1) { d2 = d1; ids[1] = ids[0]; d1 = d; ids[0] = id; } else if (d < d2) { d2 = d; ids[1] = id; }
    }
    const hot = clamp(1 - Math.hypot(x - heart[0], y - heart[1]) / (46 * u), 0, 1), lo = Math.min(ids[0], ids[1]), hi = Math.max(ids[0], ids[1]);
    const vein = hash2(lo, hi) < 0.25 + 0.55 * hot;
    if (vein && d2 - d1 < 1.1) { seams.push(i, hot > 0.55 ? 3 : hot > 0.2 ? 2 : 1); gl.px[i] = RP.fire[2]; }
    else gl.px[i] = vein && d2 - d1 < 2.6 ? RP.ramp[3 + Math.round(hot * 2)] : mixc(RP.ramp[d1 < cell * 0.3 ? 1 : 0], RP.ember, near * 0.25);
  }
  const hl = new Buf(IW, IH);
  for (let i = 0; i < hm.px.length; i++) {
    const v = hm.px[i];
    if (!v) continue;
    const x = i % IW, y = (i / IW) | 0, near = Math.max(nearBlade(x, y), clamp(1 - Math.hypot(x - contact[0], y - contact[1]) / (14 * u), 0, 1));
    const out = (n: number): boolean => hm.px[n] !== v, edge = !hm.px[i - 1] || !hm.px[i + 1] || !hm.px[i - IW] || !hm.px[i + IW];
    if (v === 2) hl.px[i] = out(i - 1) || out(i + 1) || out(i - IW) || out(i + IW) ? mixc(RP.ramp[7], RP.hot, near * 0.7) : mixc(RP.ramp[clamp(dl(x, y, 4 + near * 3), 0, 7)], RP.fire[2], near * 0.3); // painted limewood, lit by the blade on it
    else if (v === 3) hl.px[i] = RP.fire[4];
    else if (v === 4) hl.px[i] = edge ? RP.fire[4] : mixc(RP.ramp[6], RP.fire[2], 0.45); // the axe's steel takes the fire
    else hl.px[i] = (edge && rim(!hm.px[i - IW], near)) || RP.ramp[near > 0.4 ? 2 : 0];
  }
  // where each stands, a shadow on the snow
  for (const [fx, fy, rx] of [[hF[0], hF[1], 13 * u], [gF[0] + 3 * u, gF[1], 32 * u]]) {
    for (let y = Math.floor(fy - 2 * u); y <= fy + 2 * u; y++) for (let x = Math.floor(fx - rx); x <= fx + rx; x++) {
      const d = Math.hypot((x - fx) / rx, (y - fy) / (2 * u)), k = y * IW + x;
      if (d < 1 && sc.snowMask[k]) fg[k] = mixc(fg[k], RP.shade, 0.75 * (1 - d * d));
    }
  }
  return {
    gl, hl, seams, contact, ground: hF[1],
    eyes: [g.T(21.5, -89.5), g.T(24, -89.8)],
    head: { c: g.T(18.5, -88), r: 6.2 * gk },
    blade: { a: hands, dir, len: bl + 4 * u },
  };
}

function drawFight(F: Buf, sc: RagnarokScene, t: number): void {
  const { IW, u } = sc, fx = sc.fight, ph = TAU * (t / LOOP), fs = Math.floor(t / 125) % 8;
  // the sword's light on the snow round their feet
  const [cx, cy] = fx.contact, gy = fx.ground, pulse = 0.85 + 0.15 * Math.sin(ph * 4);
  for (let y = Math.floor(gy - 9 * u); y <= gy + 9 * u; y++) for (let x = Math.floor(cx - 40 * u); x <= cx + 40 * u; x++) {
    const k = y * IW + x;
    if (x < 0 || x >= IW || !sc.snowMask[k]) continue;
    const d = Math.hypot((x - cx) / (40 * u), (y - gy) / (9 * u));
    if (d >= 1) continue;
    const lv = clamp(dl(x, y, (1 - d) * 3.4 * pulse), 0, 3);
    if (lv) F.px[k] = mixc(F.px[k], RP.fire[2], [0, 0.14, 0.26, 0.4][lv]);
  }
  over(F, fx.gl);
  // the seams breathe, hottest at the heart of it
  for (let i = 0; i < fx.seams.length; i += 2) {
    const k = fx.seams[i], lv = fx.seams[i + 1], fl = Math.sin(ph * 2 + ((k % IW) >> 3) * 1.7 + (((k / IW) | 0) >> 3));
    F.px[k] = RP.fire[clamp(lv + (fl > 0.6 ? 1 : fl < -0.6 ? -1 : 0), 1, 4)];
  }
  for (const [ex, ey] of fx.eyes) { F.set(ex, ey, RP.fire[5]); F.set(ex + 1, ey, RP.fire[4]); }
  // a head of fire
  { const { c: [hx, hy], r } = fx.head;
    for (let x = Math.floor(hx - r * 1.05); x <= hx + r * 1.05; x++) {
      const off = (x - hx) / r, top = hy - Math.sqrt(Math.max(0, 1 - off * off)) * r;
      const tongue = 0.35 + 0.65 * noise1(x + fs * 1.7 * u, 1.8 * u, 77 + fs);
      flameCol(F, x, top + u, (6 + 12 * (1 - Math.abs(off))) * u * tongue, 1 - Math.abs(off), 4 * u);
    } }
  over(F, fx.hl);
  // the blade, burning along its length, laid on the shield
  const { a: [ax, ay], dir: [dx, dy], len } = fx.blade, nx = -dy, ny = dx;
  for (let s = -4 * u; s < len; s += 0.5) {
    const x = ax + dx * s, y = ay + dy * s;
    if (s < 0) { F.set(x, y, RP.ramp[2]); continue; } // the pommel and grip, in the fists
    if (s < 1.2 * u) { for (let w = -3 * u; w <= 3 * u; w += 0.5) F.set(x + nx * w, y + ny * w, RP.ramp[3]); continue; } // the guard
    const wdt = 1.3 * u * (1 - 0.6 * smooth(len - 6 * u, len, s));
    for (let w = -wdt; w <= wdt; w += 0.5) F.set(x + nx * w, y + ny * w, Math.abs(w) < wdt * 0.45 ? RP.fire[5] : RP.fire[4]);
    if ((Math.round(s) & 1) === 0) {
      const tongue = 0.3 + 0.7 * noise1(s + fs * 2 * u, 2 * u, 91 + fs);
      flameCol(F, x + nx * wdt, y - wdt, (2.5 + 3.5 * tongue) * u * (0.4 + 0.6 * (s / len)), 0.5, 2.5 * u);
    }
  }
  // the clash: a flash and a burst of sparks at every blow, four to a loop
  const bq = (t % 1000) / 1000, burst = Math.floor(t / 1000);
  if (bq < 0.08) {
    const r = (2.4 - bq * 12) * u;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) F.set(x, y, RP.fire[5]);
  }
  for (let i = 0; i < 14; i++) {
    const life = 0.35 + 0.4 * hash2(i, burst + 51);
    if (bq > life) continue;
    const a = -Math.PI * (0.05 + 0.9 * hash2(i, burst + 52)) + (hash2(i, burst + 55) > 0.75 ? Math.PI * 0.6 : 0), sp = (14 + 20 * hash2(i, burst + 53)) * u, q = bq / life;
    const x = cx + Math.cos(a) * sp * bq, y = cy + Math.sin(a) * sp * bq + 30 * u * bq * bq;
    const col = RP.fire[q < 0.3 ? 5 : q < 0.65 ? 4 : 3];
    F.set(x, y, col);
    F.set(x - Math.cos(a) * u, y - Math.sin(a) * u - 2 * bq * u, mixc(F.get(x, y), col, 0.5));
  }
}

export function paintRagnarok(sc: RagnarokScene, t: number): void {
  const { IW, IH, u } = sc, F = sc.frame, ph = TAU * (t / LOOP);
  F.px.set(sc.sky.px);
  // the last stars, guttering
  const e8 = Math.floor(t / 500);
  for (const [x, y, lvl, p] of sc.stars) if ((e8 + p) % 4 !== 0 && lvl > 0) F.px[y * IW + x] = mixc(F.px[y * IW + x], RP.star[1], lvl > 1 ? 0.6 : 0.3);
  // the stars fall: three in a loop, each a streak with a fading tail
  for (let i = 0; i < 3; i++) {
    const q = (t - 300 - i * 1330 + LOOP) % LOOP / 520;
    if (q < 0 || q > 1) continue;
    const x0 = IW * (0.42 + 0.17 * i + 0.05 * hash2(i, 91)), y0 = IH * (0.04 + 0.05 * hash2(i, 92)), dx = -0.55, len = (34 + 14 * hash2(i, 93)) * u;
    const hx = x0 + dx * len * q, hy = y0 + len * q;
    for (let k = 0; k < 14 * u; k++) {
      const x = hx - dx * k * 0.9, y = hy - k * 0.9, f = k / (14 * u);
      if (y < 0 || y >= sc.hz) continue;
      F.set(x, y, mixc(F.get(x, y), RP.star[f < 0.15 ? 2 : f < 0.5 ? 1 : 0], (1 - f) * (q > 0.8 ? (1 - q) * 5 : 1)));
    }
  }
  // the swallowed sun: a black disc, a bright bead at its rim, a ragged corona of blood
  const [ex, ey, er] = sc.eclipse;
  for (let y = Math.floor(ey - er * 2.8); y <= ey + er * 2.8; y++) for (let x = Math.floor(ex - er * 2.8); x <= ex + er * 2.8; x++) {
    const d = Math.hypot(x - ex, y - ey), a = Math.atan2(y - ey, x - ex);
    if (d <= er) { F.set(x, y, d > er - 1 ? RP.corona[3] : RP.disc); continue; }
    const ray = 0.55 + 0.3 * Math.sin(a * 7 + 1.5 * Math.sin(a * 3 + ph) + ph) + 0.15 * Math.sin(a * 17 - ph * 2);
    const I = 1 - (d - er) / (er * (0.5 + 1.6 * ray));
    if (I <= 0) continue;
    const lv = clamp(dl(x, y, I * 4.2), 0, 4);
    if (lv > 0) F.set(x, y, mixc(F.get(x, y), RP.corona[lv - 1], lv > 2 ? 0.9 : 0.6));
  }
  { const ba = -2.3 + 0.08 * Math.sin(ph), bx = ex + Math.cos(ba) * er, by = ey + Math.sin(ba) * er, br = 1.6 * u * (0.85 + 0.15 * Math.sin(ph * 2));
    for (let y = Math.floor(by - br * 2); y <= by + br * 2; y++) for (let x = Math.floor(bx - br * 2); x <= bx + br * 2; x++) {
      const d = Math.hypot(x - bx, y - by);
      if (d < br) F.set(x, y, RP.corona[4]); else if (d < br * 2 && Math.hypot(x - ex, y - ey) > er) F.set(x, y, mixc(F.get(x, y), RP.fire[4], 0.5 * (2 - d / br)));
    } }
  // smoke boiling up off the fires and leaning away on the hot wind, lit
  // from below; it climbs one billow per loop and meets itself again
  const qL = t / LOOP, rise = 26 * u;
  for (const f of sc.fires) {
    const y0 = f.ap - f.fh * 0.55, reach = f.fh * 2.2 + 60 * u;
    for (let y = Math.floor(y0); y > Math.max(0, y0 - reach); y--) {
      const up = y0 - y, cx = f.cx - up * 0.62 - Math.sin(up / (11 * u) - ph) * 1.5 * u, hw = f.hw * 0.75 + up * 0.3;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const e = 1 - Math.pow(Math.abs(x - cx) / hw, 2);
        if (e <= 0) continue;
        const xs = x - cx, n = noise2(xs, up - qL * rise, 6 * u, 31) * (1 - qL) + noise2(xs, up - qL * rise + rise, 6 * u, 31) * qL;
        const dens = (n * 0.85 + 0.25) * e * (1 - up / reach);
        if (dens < 0.24) continue;
        const lit = clamp(1 - up / (f.fh * 1.6), 0, 1), base = RP.smoke[dens > 0.62 ? 0 : dens > 0.45 ? 1 : 2];
        F.set(x, y, mixc(F.get(x, y), lit > 0 ? mixc(base, RP.fire[lit > 0.6 ? 1 : 0], lit * 0.8) : base, clamp((dens - 0.22) * 2.4, 0, 0.95)));
      }
    }
  }
  over(F, sc.fg);
  // the ice: the fire's light on it in broken streaks, and its cracks glowing
  for (let y = sc.hz + 1; y < sc.iceB; y++) {
    const d = (y - sc.hz) / (sc.iceB - sc.hz);
    for (let x = 0; x < IW; x++) {
      const k = y * IW + x;
      if (!sc.iceMask[k]) continue;
      const tw = hash2(Math.floor(x / (4 * u)), y * 5 + Math.floor(t / 250));
      if (tw > 0.97 - 0.3 * sc.heat[x] * (1 - d)) F.px[k] = mixc(F.px[k], RP.fire[tw > 0.985 ? 3 : 2], 0.55);
    }
  }
  const cs = Math.floor(t / 250);
  for (const k of sc.crackPx) {
    const x = k % IW, hot = hash2(Math.floor(x / (6 * u)), cs) > 0.55;
    F.px[k] = RP.crack[hot ? 2 : 1];
    for (const o of [-IW, IW]) if (sc.iceMask[k + o]) F.px[k + o] = mixc(F.px[k + o], RP.crack[hot ? 1 : 0], 0.6);
  }
  // the castle burns: windows and slits glowing, flames on the roofs
  for (const k of sc.slitPx) F.px[k] = RP.fire[hash2(k % IW >> 1, cs) > 0.6 ? 3 : 2];
  { const [wx, wy, ww, wh] = sc.towerWindow; F.rect(wx, wy, ww, wh, RP.fire[hash2(3, cs) > 0.4 ? 4 : 3]); }
  const fs = Math.floor(t / 125) % 8;
  for (const f of sc.fires) {
    for (let x = Math.floor(f.cx - f.hw); x <= f.cx + f.hw; x++) {
      const off = Math.abs(x - f.cx), roofY = f.ap + off * f.slope, prof = Math.pow(1 - Math.pow(off / f.hw, 2), 0.7);
      const tongue = 0.35 + 0.65 * noise1(x + fs * 1.7 * u, 2.2 * u, 61 + fs), fh = f.fh * prof * tongue;
      flameCol(F, x, roofY, fh, 1 - off / f.hw, 4 * u);
      // licks of flame torn off the tips
      if (hash2(x, fs + 11) > 0.86) for (let j = 0; j < 2 * u; j++) F.set(x - (fh / f.fh) * 4 * u - u, roofY - fh - 2 * u - j, RP.fire[j < u ? 2 : 1]);
    }
  }
  // the banners streaming in the hot wind, their fly ends alight
  for (const [bx, by, sz] of sc.banners) {
    const len = Math.round(9 * u * sz), hh = Math.max(2, Math.round(3 * u * sz));
    for (let i = 0; i < len; i++) {
      const taper = Math.max(1, Math.round(hh * (1 - (i / len) * 0.75)));
      const wave = Math.round(Math.sin(ph * 2 - (i * 0.7) / u) * Math.min(1.5, i / (3 * u)) * u);
      const burning = i > len - 3 * u;
      if (burning && ((i + Math.floor(t / 125)) & 1) && i > len - 2) continue;
      for (let j = 0; j < taper; j++) F.set(bx - 1 - i, by + j + wave, burning ? RP.fire[hash2(i + j, cs) > 0.5 ? 3 : 2] : j === 0 ? RP.banner[2] : RP.banner[j === taper - 1 ? 0 : 1]);
    }
  }
  drawFight(F, sc, t);
  // ash coming down, embers going up
  particles(F, t, { count: Math.round(40 * u), seed: 909, n: 2, kx: 0.5, ky: 1, sway: 3 * u, wob: 1, cols: [RP.ash[0], RP.ash[1]], len: 1 });
  particles(F, t, { count: Math.round(22 * u), seed: 919, n: 2, kx: 0.6, ky: -1, sway: 4 * u, wob: 2, cols: [RP.fire[2], RP.fire[3]], len: 1 });
  applyVignette(F, sc.vig);
  particles(F, t, { count: Math.round(8 * u), seed: 929, n: 2, kx: 0.8, ky: -1, sway: 5 * u, wob: 1, cols: [RP.fire[3], RP.fire[4]], len: 1, big: u > 1.2 });
  particles(F, t, { count: Math.round(10 * u), seed: 939, n: 1, kx: 0.6, ky: 1, sway: 4 * u, wob: 1, cols: [RP.ash[2]], len: 1, big: u > 1.2 });
  paintText(F, sc.text, t, RAGNAROK_PAL);
}

/** The dialog stays clear of what has swallowed the sun. */
export function ragnarokBoxes(IW: number, IH: number): Boxes {
  const u = IH / 256, X = (d: number): number => IW - (456 - d) * u;
  const V = ragnarokText(IW, IH), top = V.bottom + Math.round(16 * u), cw = Math.min(IW * 0.42, X(206) - V.L.x);
  return { text: [V.L.x, V.L.y, V.w, V.bottom - V.L.y], calm: [V.L.x, top, Math.round(cw), Math.round(IH * 0.9) - top] };
}
