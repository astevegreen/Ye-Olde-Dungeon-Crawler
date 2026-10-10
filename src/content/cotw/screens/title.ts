import { bake, hash2 } from '../sprites/sculpt/kit';
import { HERO_FRAMES, heroModel } from '../sprites/sculpt/hero';
import {
  Buf, C, LOOP, TAU, addc, applyVignette, clamp, dl, letter, measure, mixc, mulc, noise1, pack, paintText, particles, over, smooth, vignette,
  type Sprite, type TextMask, type TextPalette,
} from './paint';
import type { Boxes, Scene } from './scene';

// ======================================================================= TITLE
// A dark castle on a crag above a frozen fjord, an aurora over a wind-torn
// sky, snow streaming sideways. Below, on the path, one hero and one torch.
export const TP = {
  sky: ['#04060c', '#060a16', '#091021', '#0d172e', '#12203b', '#192b49', '#203656'].map(C),
  aur: ['#0b2530', '#123f4a', '#1f6a76', '#3fa1ad', '#9ae0e6'].map(C), // added onto the sky, faint to bright
  aurHi: C('#1a2560'),
  star: ['#46557a', '#8a9cc4', '#e6eeff'].map(C),
  cloud: ['#070b17', '#0b1222', '#111c33', '#1c3044', '#2b4a5a'].map(C),
  mtn: ['#0d1428', '#121b33', '#18233f', '#203050', '#2c3d60', '#43587f', '#617aa3'].map(C),
  ice: ['#0b1424', '#0f1a2e', '#132138', '#182842', '#20344f', '#2d4562'].map(C),
  crack: C('#3c5878'),
  snow: ['#0f1628', '#141d35', '#1a2643', '#213052', '#2a3c63', '#384d78', '#4b6390'].map(C),
  rock: ['#05070e', '#090d18', '#0e1422', '#141c2e', '#1d2940', '#2c3e58', '#42607a'].map(C),
  rsnow: ['#3f5478', '#6d84aa', '#a3b8d6'].map(C),
  wall: ['#04060c', '#080c17', '#0c1220', '#121a2c', '#1b2840', '#2c4058', '#46607a'].map(C),
  roofSnow: ['#5d749a', '#9db3d3', '#d2e0f0'].map(C),
  slit: C('#020308'), win: ['#3a2414', '#8a5426', '#e09a48'].map(C),
  banner: ['#0d0f1c', '#1b2036', '#2e3654'].map(C),
  path: C('#121a30'), pathLit: C('#2c3d64'), print: C('#0c1224'),
  night: C('#0a1124'), warm: C('#ff9a3c'), coldRim: C('#7fc8d4'),
  flame: ['#7a2e10', '#d8661e', '#f59a34', '#ffd27a', '#fff6d8'].map(C),
  pool: C('#ff9a40'),
  flake: ['#56698e', '#8ea2c4', '#c9d7ec', '#eef4ff'].map(C),
};
export const TITLE_PAL: TextPalette = {
  shadow: C('#020309'), outline: C('#060a14'), snow: C('#ffffff'), glint: C('#ffffff'),
  bands: [[0.16, C('#f2f8ff')], [0.42, C('#cbdcec')], [0.52, C('#93abc6')], [0.62, C('#5d7698')], [0.86, C('#aec3da')], [9, C('#dbe8f5')]],
};


export function titleLayout(IW: number, IH: number) {
  const u = IH / 256;
  const cap = Math.round(21 * u), b = Math.max(2, Math.round(3 * u)), gap = Math.max(2, Math.round(3 * u));
  const capS = Math.max(6, Math.round(7 * u)), bS = 1, gapS = Math.max(1, Math.round(1.6 * u));
  const x = Math.round(IW * 0.06), y = Math.round(IH * 0.085);
  const wBig = Math.max(measure('CASTLE', cap, b, gap), measure('WINDS', cap, b, gap));
  const y2 = y + cap + Math.round(5 * u), y3 = y2 + capS + Math.round(5 * u);
  const bottom = y3 + cap;
  return { u, cap, b, gap, capS, bS, gapS, x, y, y2, y3, w: wBig, bottom };
}

/** [x, y, brightness 0-2, twinkle phase 0-7] */
type Star = [number, number, number, number];

/** The title's view, built once per viewport; the victory and Ragnarök screens start from it. */
export interface TitleScene extends Scene {
  hz: number;
  iceB: number;
  sky: Buf;
  stars: Star[];
  /** Everything in front of the sky, 0 clear. */
  fg: Buf;
  iceMask: Uint8Array;
  snowMask: Uint8Array;
  /** The lit window high in the tall tower: x, y, w, h. */
  towerWindow: [number, number, number, number];
  /** Each banner's staff top and size. */
  banners: Array<[number, number, number]>;
  hero: { x: number; y: number };
  heroSp: Sprite[] | null;
  vig: Uint8Array;
  text: TextMask;
  /** The aurora's strength per column, this frame. */
  aurCol: Float32Array;
}

export function buildTitle(base: Scene, tint: Tint | null = nightTint): TitleScene {
  const { IW, IH, u } = base;
  const X = (d: number): number => IW - (456 - d) * u, Y = (d: number): number => d * u;
  const hz = Math.round(Y(150)), iceB = Math.round(Y(173));

  // ---- sky (static): banded night gradient, cold near the horizon
  const sky = new Buf(IW, IH);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const v = Math.pow(clamp(y / (hz + 4), 0, 1), 1.15) * (TP.sky.length - 1);
    sky.px[y * IW + x] = TP.sky[clamp(dl(x, y, v), 0, TP.sky.length - 1)];
  }
  // stars: positions and twinkle phases
  const stars: Star[] = [];
  for (let y = 0; y < hz - 24 * u; y++) for (let x = 0; x < IW; x++) {
    const h = hash2(x * 7 + 3, y * 13 + 1);
    if (h > 0.9965) stars.push([x, y, hash2(x, y + 99) > 0.8 ? 2 : hash2(x, y + 7) > 0.5 ? 1 : 0, Math.floor(hash2(x + 5, y) * 8)]);
  }

  // ---- the foreground layer, back to front
  const fg = new Buf(IW, IH);
  // wind-torn clouds: a lumpy body at the windward right, lit on top by the
  // aurora, its tail shredded into streaks trailing left
  const clouds =[[76, 150, 300, 9, 1], [104, 20, 175, 6, 2], [124, 236, 400, 7, 3], [92, 372, 476, 6, 4], [138, 96, 250, 4, 5]];
  for (const [cy, xa, xb, th, id] of clouds) {
    const x0 = X(xa), x1 = X(xb);
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(IW, x1); x++) {
      const s = (x - x0) / (x1 - x0), yBase = Y(cy) - s * 4 * u + (noise1(x, 9 * u, id + 20) - 0.5) * 2 * u;
      if (s < 0.38) {
        // the tail: thin streaks, broken
        for (let r = 0; r < 4; r++) {
          const yy = Math.round(yBase - r * 2 * u - 0.5 * u);
          if (hash2(r, id) < 0.35 || noise1(x + r * 37, 5 * u, id + r) < 0.55 - s) continue;
          fg.set(x, yy, r === 0 ? TP.cloud[1] : TP.cloud[2]);
        }
        continue;
      }
      const body = Math.pow(clamp((s - 0.38) / 0.62, 0, 1), 0.45) * (1 - Math.pow(s, 14));
      const lump = 0.55 + 0.45 * noise1(x, 6 * u, id) + 0.25 * (noise1(x, 2.5 * u, id + 9) - 0.5);
      const t2 = th * u * body * lump;
      if (t2 < 0.8) continue;
      const ya = Math.round(yBase - t2), yb = Math.round(yBase + u * 0.8);
      for (let y = ya; y <= yb; y++) {
        const c = y === ya ? TP.cloud[4] : y === ya + 1 ? TP.cloud[3] : y < ya + 2 + u ? TP.cloud[2] : y >= yb ? TP.cloud[0] : TP.cloud[1];
        fg.set(x, y, c);
      }
    }
  }

  // mountains: a ridge per column, lit on the slopes that face the upper left
  const ridge = (seed: number, lo: number, hi: number, step: number, env: (x: number) => number): { top: Float32Array; sm: Float32Array } => {
    const pts: Array<[number, number]> = [];
    for (let x = -step * 2, i = 0; x <= IW + step * 2; i++) {
      pts.push([x, lo + (hi - lo) * hash2(i, seed) * env(x)]);
      x += step * (0.55 + hash2(i, seed + 1) * 0.9);
    }
    const top = new Float32Array(IW), sm = new Float32Array(IW);
    for (let x = 0, j = 0; x < IW; x++) {
      while (pts[j + 1][0] < x) j++;
      const [ax, ay] = pts[j], [bx, by] = pts[j + 1];
      sm[x] = ay + ((x - ax) / (bx - ax)) * (by - ay);
      top[x] = sm[x] + (noise1(x, 3 * u, seed + 2) - 0.5) * 1.6 * u;
    }
    return { top, sm };
  };
  const drawRange = (r: { top: Float32Array; sm: Float32Array }, base: number, pal: readonly number[], snowFrac: number, seed: number): void => {
    const { top, sm } = r, k = Math.ceil(2 * u);
    for (let x = 0; x < IW; x++) {
      const sl = sm[Math.min(IW - 1, x + k)] - sm[Math.max(0, x - k)];
      const lit = sl < -0.6 * k ? 2 : sl < 0.6 * k ? 1 : 0; // slopes facing the upper left catch the light
      const tY = Math.round(top[x]), depth = base - tY;
      const snowTo = tY + Math.max(1, depth * snowFrac * (0.5 + 0.7 * noise1(x, 6 * u, seed + 4)));
      for (let y = tY; y < base; y++) {
        let c: number;
        if (y < snowTo) c = lit === 2 ? pal[6] : lit === 1 ? pal[5] : pal[4];
        else { const d = (y - tY) / Math.max(1, depth); c = pal[clamp(dl(x, y, (lit === 2 ? 2.8 : lit === 1 ? 2 : 1.3) - d * 1.8), 0, 3)]; }
        fg.set(x, y, c);
      }
    }
  };
  // far range: low behind the menu, rising behind the centre and the crag
  const far = ridge(11, hz - 8 * u, hz - 50 * u, 24 * u, (x) => 0.3 + 0.7 * smooth(IW * 0.2, IW * 0.6, x));
  drawRange(far, hz, TP.mtn, 0.4, 11);
  const nearR = ridge(23, hz - 2 * u, hz - 18 * u, 16 * u, (x) => 0.35 + 0.65 * smooth(IW * 0.25, IW * 0.6, x));
  drawRange(nearR, hz, TP.mtn.map((c) => mulc(c, 0.7)), 0.28, 23);
  for (let x = 0; x < IW; x++) fg.set(x, hz, TP.ice[0]);

  // the frozen fjord: wind-polished streaks and pressure cracks
  const iceMask = new Uint8Array(IW * IH);
  for (let y = hz + 1; y < iceB; y++) for (let x = 0; x < IW; x++) {
    const d = (y - hz) / (iceB - hz);
    let v = 0.6 + d * 3.2;
    const run = hash2(Math.floor((x + y * 7) / (9 * u)), y);
    if (run > 0.82) v += 1.1; else if (run < 0.12) v -= 0.8;
    fg.set(x, y, TP.ice[clamp(dl(x, y, v), 0, 5)]);
    iceMask[y * IW + x] = 1;
  }
  for (const [a, b2, c2, sd] of [[0.04, 0.4, 0.3, 1], [0.3, 0.75, 0.65, 2], [0.12, 0.28, 0.85, 3]]) {
    let px = IW * a, py = hz + (iceB - hz) * c2;
    while (px < IW * b2) {
      const nx = px + (5 + hash2(Math.floor(px), sd) * 9) * u, ny = clamp(py + (hash2(Math.floor(px), sd + 1) - 0.5) * 3 * u, hz + 2, iceB - 2);
      fg.line(px, py, nx, ny, TP.crack);
      px = nx; py = ny;
    }
  }

  // the crag: a stepped cliff out of a snow slope, its edges roughened
  const rough = (pts: number[], amp: number, seg: number, seed: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / seg));
      for (let k = 0; k < n; k++) {
        const q = k / n, j = k === 0 ? 0 : (hash2(i * 31 + k, seed) - 0.5) * 2 * amp;
        out.push(ax + (bx - ax) * q + (-(by - ay) / L) * j, ay + (by - ay) * q + ((bx - ax) / L) * j);
      }
    }
    out.push(pts[pts.length - 2], pts[pts.length - 1]);
    return out;
  };
  const face = rough([X(264), Y(204), X(272), Y(178), X(279), Y(172), X(283), Y(158), X(290), Y(151), X(292), Y(140), X(298), Y(134), X(301), Y(121), X(308), Y(114), X(311), Y(104), X(318), Y(99), X(326), Y(96)], 1.3 * u, 3 * u, 5);
  const back = rough([X(402), Y(99), X(408), Y(106), X(412), Y(118), X(420), Y(126), X(424), Y(140), X(436), Y(147), X(446), Y(150), X(462), Y(156)], 1.3 * u, 3 * u, 6);
  const crag = [...face, X(344), Y(94), X(366), Y(92), X(388), Y(95), ...back, X(462), Y(210)];
  const cragM = new Buf(IW, IH);
  cragM.poly(crag, 1);
  const edgeL = new Int32Array(IH).fill(-1);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) if (cragM.px[y * IW + x]) { edgeL[y] = x; break; }
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    if (!cragM.px[y * IW + x]) continue;
    const above = cragM.get(x, y - 1), above2 = cragM.get(x, y - 2), dL = x - edgeL[y];
    let c: number;
    const facet = hash2(Math.floor((x / u + (y / u) * 0.55) / 6), Math.floor(y / (7 * u)));
    if (!above) c = TP.rsnow[2];
    else if (!above2) c = TP.rsnow[hash2(x, 5) > 0.4 ? 1 : 0];
    else if (dL === 0) c = TP.rock[6];
    else if (dL < 1.5 * u + facet * 4 * u) c = TP.rock[dL <= u ? 5 : 4];
    else c = TP.rock[clamp(dl(x, y, 2.5 - (dL / (70 * u)) * 1.6 + (facet > 0.82 ? 0.9 : facet < 0.18 ? -0.9 : 0)), 0, 4)];
    fg.set(x, y, c);
    iceMask[y * IW + x] = 0;
  }
  // snow caught on ledges where the rock steps back
  for (let i = 0; i < 12; i++) {
    const ly = Math.round(Y(104 + hash2(i, 31) * 60)), lx = edgeL[ly];
    if (lx < 0) continue;
    const len = Math.round((3 + hash2(i, 32) * 8) * u), off = Math.round((2 + hash2(i, 33) * 22) * u);
    for (let k = 0; k < len; k++) {
      const x = lx + off + k;
      if (!cragM.get(x, ly) || !cragM.get(x, ly + 1)) continue;
      fg.set(x, ly, TP.rsnow[k === 0 || k === len - 1 ? 0 : 1]);
      if (k > 0 && k < len - 1) fg.set(x, ly + 1, TP.rock[0]);
    }
  }
  // the climbing path, switchbacks of trodden snow up to the gate
  const climb = [X(300), Y(160), X(312), Y(151), X(303), Y(145), X(315), Y(136), X(307), Y(128), X(319), Y(119), X(314), Y(109), X(331), Y(101), X(346), Y(96)];
  for (let i = 0; i + 3 < climb.length; i += 2) fg.line(climb[i], climb[i + 1], climb[i + 2], climb[i + 3], TP.rock[5]);

  // the snowfield: a plain falling away from a slope under the crag, long soft
  // dunes and a few wind-carved ridges; darkest nearest the eye
  const snowMask = new Uint8Array(IW * IH);
  const sTop = new Int32Array(IW);
  for (let x = 0; x < IW; x++) sTop[x] = Math.round(Math.max(Y(158) + (noise1(x, 5 * u, 41) - 0.5) * 3 * u, iceB - Math.max(0, x - X(262)) * 0.24 + (noise1(x, 4 * u, 42) - 0.5) * 1.5 * u));
  for (let x = 0; x < IW; x++) for (let y = sTop[x]; y < IH; y++) {
    const xd = x / u, yd = y / u, d = clamp((y - iceB) / (IH - iceB), 0, 1);
    const dune = Math.sin(xd * 0.016 + yd * 0.045 + 1.3) * 0.55 + Math.sin(xd * 0.037 - yd * 0.03 + 0.4) * 0.3;
    let v = 4.4 - d * 2.8 + dune * 0.7 + (y < iceB ? 0.5 : 0);
    if (y === sTop[x]) v = 6; else if (y === sTop[x] + 1) v = 5.4;
    fg.set(x, y, TP.snow[clamp(dl(x, y, v), 0, 6)]);
    snowMask[y * IW + x] = 1; iceMask[y * IW + x] = 0;
  }
  // rocks breaking through the slope
  for (let i = 0; i < 6; i++) {
    const x = Math.round(X(300 + hash2(i, 51) * 150)), y = sTop[clamp(x, 0, IW - 1)] + Math.round((4 + hash2(i, 52) * 30) * u), r = (2 + hash2(i, 53) * 4) * u;
    if (y >= IH || !snowMask[y * IW + clamp(x, 0, IW - 1)]) continue;
    fg.poly([x - r, y + 1, x - r * 0.5, y - r * 0.7, x + r * 0.3, y - r * 0.9, x + r, y + 1], (px) => (px < x - r * 0.25 ? TP.rock[4] : TP.rock[2]));
    fg.line(x - r * 0.5, y - r * 0.7, x + r * 0.3, y - r * 0.9, TP.rsnow[1]);
  }
  // wind-carved ridges: a lit lip over a dark scoop
  for (let i = 0; i < 46 * u; i++) {
    const x = Math.round(hash2(i, 61) * IW), y = Math.round(iceB + 3 * u + Math.pow(hash2(i, 62), 1.3) * (IH - iceB - 3 * u));
    const len = Math.round((3 + hash2(i, 63) * 10) * u * (0.5 + (y - iceB) / (IH - iceB)));
    if (x > IW * 0.06 && x < IW * 0.46 && y > IH * 0.4 && hash2(i, 64) < 0.6) continue; // keep the menu's ground quiet
    for (let k = 0; k < len; k++) {
      const xx = x + k, yy = y - Math.round(Math.sin((k / len) * Math.PI) * u * 0.6), q = yy * IW + xx;
      if (xx >= IW || yy >= IH || !snowMask[q]) continue;
      const lvl = TP.snow.indexOf(fg.px[q]);
      if (lvl < 0) continue;
      fg.px[q] = TP.snow[Math.min(6, lvl + 1)];
      if (yy + 1 < IH && snowMask[q + IW]) fg.px[q + IW] = TP.snow[Math.max(0, lvl - 1)];
    }
  }

  // the castle
  const W = TP.wall;
  const block = (x0: number, y0: number, x1: number, y1: number): void => {
    const a = Math.round(X(x0)), b = Math.round(X(x1)), t = Math.round(Y(y0)), bt = Math.round(Y(y1));
    for (let y = t; y < bt; y++) for (let x = a; x < b; x++) {
      const d = x - a, e = b - 1 - x;
      let c = d === 0 ? W[5] : d <= Math.max(1, u) ? W[4] : e === 0 ? W[0] : W[2];
      if (c === W[2] && hash2(Math.floor(x / (3 * u)), Math.floor(y / (2 * u))) > 0.85) c = W[3];
      if (c === W[2] && ((y - t) % Math.max(3, Math.round(5 * u)) === 0) && hash2(x, y) > 0.55) c = W[1];
      fg.set(x, y, c);
    }
  };
  const merlons = (x0: number, x1: number, y: number): void => {
    const a = Math.round(X(x0)), b = Math.round(X(x1)), t = Math.round(Y(y)), mh = Math.max(2, Math.round(3 * u)), step = Math.max(4, Math.round(5 * u)), mw = Math.max(2, Math.round(3 * u));
    for (let x = a; x < b; x += step) {
      for (let k = 0; k < mw && x + k < b; k++) for (let j = 0; j < mh; j++) fg.set(x + k, t - mh + j, k === 0 ? W[5] : W[2]);
      for (let k = 0; k < mw && x + k < b; k++) fg.set(x + k, t - mh, TP.roofSnow[k === 0 ? 2 : 1]);
    }
  };
  const roof = (cx: number, base: number, half: number, apexY: number, finials: boolean): [number, number] => {
    const ax = X(cx), ay = Y(apexY), l = X(cx - half), r = X(cx + half), by = Y(base);
    fg.poly([l, by, ax, ay, r, by], (x, y): number => {
      if (x < ax - 0.5) {
        const toEdge = (x - (l + (ax - l) * (by - y - 0.5) / (by - ay)));
        return toEdge < 1.2 ? TP.roofSnow[toEdge < 0.5 ? 2 : 1] : hash2(x, y >> 1) > 0.9 ? TP.roofSnow[0] : W[3];
      }
      return x < ax + 0.5 ? W[4] : W[1];
    });
    for (let x = Math.round(l); x <= Math.round(r); x++) fg.set(x, Math.round(by), W[0]); // the eave's shadow
    if (finials) { // crossed gable boards, carved like beast heads
      fg.line(ax - 1, ay + 1, ax + 2 * u + 1, ay - 3 * u, W[2]); fg.line(ax + 1, ay + 1, ax - 2 * u - 1, ay - 3 * u, W[4]);
      fg.set(ax - 2 * u - 2, ay - 3 * u, W[4]); fg.set(ax + 2 * u + 2, ay - 3 * u, W[2]);
    }
    return [ax, ay];
  };
  block(322, 76, 402, 96);
  merlons(322, 402, 76);
  block(316, 54, 330, 98); roof(323, 54, 9, 32, false);
  block(336, 48, 372, 95); roof(354, 48, 21, 26, true);
  block(376, 36, 392, 96); const spire = roof(384, 36, 10, 15, false);
  block(397, 62, 409, 102); roof(403, 62, 8, 46, false);
  // gate, arrow slits, one warm window high in the tall tower
  fg.poly([X(343), Y(95), X(343), Y(87), X(346), Y(84), X(349), Y(87), X(349), Y(95)], TP.slit);
  for (const [x, y] of [[322, 64], [358, 60], [366, 60], [383, 44], [403, 74], [322, 82], [350, 62]]) fg.rect(Math.round(X(x)), Math.round(Y(y)), Math.max(1, Math.round(u)), Math.max(2, Math.round(4 * u)), TP.slit);
  const towerWindow: TitleScene['towerWindow'] = [Math.round(X(386)), Math.round(Y(56)), Math.max(1, Math.round(u * 1.4)), Math.max(2, Math.round(3 * u))];
  const banners: TitleScene['banners'] = [[spire[0], spire[1] - 7 * u, 1.3], [X(323), Y(32) - 5 * u, 1], [X(403), Y(46) - 5 * u, 0.85]];
  for (const [bx, by] of banners) fg.line(bx, by, bx, by + 7 * u, W[4]);

  // the trodden path across the snow, footprints in it, and where the hero stands
  const hero = { x: X(275), y: Y(214) };
  const path = [X(222), IH + 2, X(240), Y(240), X(258), Y(226), X(275), Y(214), X(286), Y(200), X(293), Y(184), X(298), Y(170), X(300), Y(161)];
  const wP = Math.max(2, Math.round(3 * u));
  for (let i = 0; i + 3 < path.length; i += 2) {
    const [ax, ay, bx, by] = [path[i], path[i + 1], path[i + 2], path[i + 3]], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * (k / n), y = ay + (by - ay) * (k / n), ww = wP * (0.6 + 0.4 * (y / IH));
      for (let j = -ww; j <= ww; j++) if (snowMask[Math.round(y) * IW + Math.round(x + j)]) fg.set(x + j, y, TP.path);
      if (snowMask[Math.round(y + 1) * IW + Math.round(x)]) fg.set(x + ww, y + 1, TP.pathLit);
    }
  }
  for (let i = 0; i < 12; i++) { // prints behind him, toward the eye
    const q = i / 12, x = hero.x - 6 * u - q * (hero.x - X(226)), y = hero.y + 4 * u + q * (IH - hero.y), side = i % 2 ? -1 : 1;
    fg.set(x + side * u, y, TP.print);
    if (u > 1.1) fg.set(x + side * u + 1, y, TP.print);
  }

  // the hero: the game's own model, night-toned, rim-lit warm by the torch
  // on his left and cold by the aurora on his right
  const heroSp = tint ? heroSprites(Math.round(25 * u), tint) : null;

  const vig = vignette(base);
  // the lettering, stamped once into a mask
  const L = titleLayout(IW, IH), mask = new Buf(IW, IH);
  letter(mask, 'CASTLE', L.x, L.y, L.cap, L.b, L.gap);
  const wS = measure('OF THE', L.capS, L.bS, L.gapS), xs = L.x + Math.round((L.w - wS) / 2);
  letter(mask, 'OF THE', xs, L.y2, L.capS, L.bS, L.gapS);
  const my = L.y2 + Math.round(L.capS / 2), dash = Math.max(6, Math.round(14 * u));
  mask.line(xs - 4 * u - dash, my, xs - 4 * u, my, 1); mask.line(xs + wS + 4 * u, my, xs + wS + 4 * u + dash, my, 1);
  mask.line(L.x, my, L.x, my, 1); mask.line(L.x + L.w - 1, my, L.x + L.w - 1, my, 1);
  letter(mask, 'WINDS', L.x + Math.round((L.w - measure('WINDS', L.cap, L.b, L.gap)) / 2), L.y3, L.cap, L.b, L.gap);
  const text: TextMask = { mask, x0: L.x - 2, y0: L.y - 2, x1: L.x + L.w + 2, y1: L.bottom + 2, lines: [{ y: L.y, cap: L.cap }, { y: L.y2, cap: L.capS, small: true }, { y: L.y3, cap: L.cap }] };
  return { ...base, hz, iceB, sky, stars, fg, iceMask, snowMask, towerWindow, banners, hero, heroSp, vig, text, aurCol: new Float32Array(IW) };
}

/**
 * The hero, baked by the game's own model with a single outline ring, then
 * night-toned: the silhouette's left edge (toward the torch) warm, its right
 * edge (toward the aurora) cold. Edges are found per row on the silhouette,
 * so gaps inside the figure stay dark.
 */
/** The title's toning: e = 0 the silhouette's left edge, 1 next to it, 2 inside, 3 its right edge. */
/** Tones a hero pixel by where it sits in its row (`heroSprites`). */
export type Tint = (c: number, e: number) => number;
const nightTint: Tint = (c, e) => e === 0 ? mixc(c, TP.warm, 0.35) : e === 1 ? mixc(mixc(c, TP.night, 0.2), TP.warm, 0.42) : e === 3 ? mixc(mixc(c, TP.night, 0.5), TP.coldRim, 0.38) : mixc(c, TP.night, 0.5);
export function heroSprites(R: number, tint: Tint): Sprite[] {
  const v = { g: 'm', armor: 'medium', weapon: 'axe', off: 'none' } as const, out: Sprite[] = [];
  for (let f = 0; f < HERO_FRAMES; f++) {
    const d = bake(heroModel, { frame: f, variant: v, px: R, rings: 1 });
    const W = R, H = R, px = new Uint32Array(W * H);
    const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] >= 140;
    for (let y = 0; y < H; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < W; x++) if (solid(x, y)) { if (first < 0) first = x; last = x; }
      for (let x = first; x >= 0 && x <= last; x++) {
        if (!solid(x, y)) continue;
        const k = y * W + x, c = pack(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]);
        px[k] = tint(c, x === first ? 0 : x === first + 1 ? 1 : x === last && x - first > 3 ? 3 : 2);
      }
    }
    out.push({ w: W, h: H, px });
  }
  return out;
}

function aurora(sc: TitleScene, t: number, buf: Buf): void {
  const { IW, IH, u } = sc, ph = TAU * ((t % LOOP) / LOOP);
  for (let x = 0; x < IW; x++) {
    const xr = 456 - (IW - x) / u; // design units, right-anchored like the castle
    const env = smooth(40, 230, xr) * (0.7 + 0.3 * Math.sin(xr * 0.017 + 0.6)) * (1 - 0.35 * smooth(430, 470, xr));
    sc.aurCol[x] = 0;
    if (env <= 0.02) continue;
    const yb = (60 + 20 * Math.sin(xr * 0.011 + 0.9) + 7 * Math.sin(xr * 0.031 + 2.1) + 1.6 * Math.sin(xr * 0.06 + ph)) * u;
    const L = (34 + 18 * Math.sin(xr * 0.023 + 0.3)) * u;
    const ray = 0.5 + 0.5 * Math.sin(xr * 0.41 + 2.4 * Math.sin(xr * 0.045 + ph) + ph);
    const ray2 = 0.5 + 0.5 * Math.sin(xr * 0.13 - ph + 1.7);
    const I = env * (0.3 + 0.45 * ray + 0.25 * ray2);
    sc.aurCol[x] = I;
    const top = Math.max(0, Math.floor(yb - L)), bot = Math.min(IH - 1, Math.ceil(yb + 5 * u));
    for (let y = top; y <= bot; y++) {
      let v: number;
      if (y <= yb) { const d = (yb - y) / L; v = I * Math.pow(1 - d, 1.5) * (d < 0.06 ? 1.3 : 1); }
      else v = env * 0.55 * (1 - (y - yb) / (5 * u));
      const lv = Math.min(5, dl(x, y, v * 5.2));
      const k = y * IW + x;
      if (lv > 0) buf.px[k] = addc(buf.px[k], TP.aur[lv - 1]);
      else if (y < yb - L * 0.55 && v > 0.01 && ((x + y) & 1) === 0 && I > 0.5) buf.px[k] = addc(buf.px[k], TP.aurHi);
    }
  }
  // a second, fainter curtain behind and higher, on the left of the first
  for (let x = 0; x < IW; x++) {
    const xr = 456 - (IW - x) / u;
    const env = smooth(150, 230, xr) * (1 - smooth(300, 380, xr)) * 0.55;
    if (env <= 0.02) continue;
    const yb = (34 + 10 * Math.sin(xr * 0.02 + 2.2)) * u, L = 22 * u;
    const ray = 0.5 + 0.5 * Math.sin(xr * 0.33 + ph * 2 + 1.1);
    for (let y = Math.max(0, Math.floor(yb - L)); y <= yb; y++) {
      const lv = Math.min(3, dl(x, y, env * (0.4 + 0.6 * ray) * (1 - (yb - y) / L) * 3.4));
      if (lv > 0) { const k = y * IW + x; buf.px[k] = addc(buf.px[k], TP.aur[lv - 1]); }
    }
  }
}

export function paintTitle(sc: TitleScene, t: number): void {
  const { IW, IH, u } = sc, F = sc.frame, ph = TAU * (t / LOOP);
  F.px.set(sc.sky.px);
  // stars twinkle in eighths of the loop
  const e8 = Math.floor(t / 500);
  for (const [x, y, lvl, p] of sc.stars) {
    const tw = (e8 + p) % 8 === 0 ? -1 : (e8 + p) % 8 === 4 && lvl < 2 ? 1 : 0;
    const l = clamp(lvl + tw, 0, 2);
    F.px[y * IW + x] = TP.star[l];
    if (lvl === 2 && tw >= 0) { F.set(x - 1, y, TP.star[0]); F.set(x + 1, y, TP.star[0]); F.set(x, y - 1, TP.star[0]); F.set(x, y + 1, TP.star[0]); }
  }
  aurora(sc, t, F);
  over(F, sc.fg);
  // the aurora on the ice
  for (let y = sc.hz + 1; y < sc.iceB; y++) for (let x = 0; x < IW; x++) {
    const k = y * IW + x;
    if (!sc.iceMask[k]) continue;
    const d = (y - sc.hz) / (sc.iceB - sc.hz), I = sc.aurCol[x];
    if (I < 0.1) continue;
    const streak = hash2(x, Math.floor(y / 2) + Math.floor(t / 250)) > 0.45 ? 1 : 0.35;
    const lv = Math.min(3, dl(x, y, I * (1 - d * 0.8) * streak * 2.6));
    if (lv > 0) F.px[k] = addc(F.px[k], TP.aur[lv - 1]);
  }
  // the window high in the tower flickers
  { const [wx, wy, ww, wh] = sc.towerWindow, fl = hash2(Math.floor(t / 200), 3); F.rect(wx, wy, ww, wh, TP.win[fl > 0.85 ? 0 : fl > 0.3 ? 1 : 2]); }
  // banners streaming left in the gale
  for (const [bx, by, sz] of sc.banners) {
    const len = Math.round(9 * u * sz), hh = Math.max(2, Math.round(3 * u * sz));
    for (let i = 0; i < len; i++) {
      const taper = Math.max(1, Math.round(hh * (1 - i / len * 0.75)));
      const wave = Math.round(Math.sin(ph * 2 - i * 0.7 / u) * Math.min(1.5, i / (3 * u)) * u);
      if (i > len - 3 && ((i + Math.floor(t / 125)) & 1)) continue; // the ragged fly end snaps
      for (let j = 0; j < taper; j++) F.set(bx - 1 - i, by + j + wave, j === 0 ? TP.banner[2] : TP.banner[j === taper - 1 ? 0 : 1]);
    }
  }
  // the hero, his torch, and the light it throws on the snow
  const hs = sc.heroSp, hx = sc.hero.x, hy = sc.hero.y;
  const step = Math.floor(t / 125), fl = hash2(step, 7), fl2 = hash2(step, 11);
  if (hs) {
    const sp = hs[Math.floor(t / 500) % hs.length], R = sp.w;
    const ox = Math.round(hx - R / 2), oy = Math.round(hy - (R * 28.6) / 32);
    const hand = [ox + (11.2 * R) / 32, oy + (20.2 * R) / 32];
    const tip = [hand[0] - 1.6 * u, hand[1] - 6.5 * u];
    // warm pool on the snow, flickering
    const pr = 1 + (fl - 0.5) * 0.08, rx = 30 * u * pr, ry = 8 * u * pr, pcx = tip[0] + 2 * u, pcy = hy + u;
    for (let y = Math.floor(pcy - ry); y <= pcy + ry; y++) for (let x = Math.floor(pcx - rx); x <= pcx + rx; x++) {
      const k = y * IW + x;
      if (x < 0 || y < 0 || x >= IW || y >= IH || !sc.snowMask[k]) continue;
      const d = Math.hypot((x - pcx) / rx, (y - pcy) / ry);
      if (d >= 1) continue;
      const lv = clamp(dl(x, y, (1 - d) * 3.2), 0, 3);
      if (lv) F.px[k] = mixc(F.px[k], TP.pool, [0, 0.12, 0.24, 0.38][lv]);
    }
    // a long cold shadow thrown away from the torch, to the right
    for (let i = 1; i < 10 * u; i++) { const x = Math.round(hx + 2 * u + i), y = Math.round(hy + 0.6 * u + i * 0.12); const k = y * IW + x; if (sc.snowMask[k]) F.px[k] = mixc(F.px[k], TP.night, 0.55 - i / (24 * u)); }
    F.blit(sp, ox, oy);
    F.line(hand[0], hand[1], tip[0], tip[1], C('#3a2a1c'));
    // the flame: ember orange, bent left by the wind
    const fh = Math.round((4 + fl * 2.2) * Math.max(1, u * 0.9)), fx = Math.round(tip[0]), fy = Math.round(tip[1]);
    for (let j = 0; j < fh; j++) {
      const r = j / fh, wdt = r < 0.25 ? 2 : r < 0.7 ? 1.5 : 1, lean = Math.round(-r * r * (2 + fl2 * 1.5) * u);
      for (let i = -Math.floor(wdt); i <= Math.floor(wdt - 0.5); i++) {
        const core = Math.abs(i) < 1 && r < 0.55;
        F.set(fx + i + lean, fy - j, core ? TP.flame[r < 0.25 ? 4 : 3] : TP.flame[r < 0.5 ? 2 : 1]);
      }
    }
    F.set(fx - 1, fy + 1, TP.flame[1]); F.set(fx + 1, fy + 1, TP.flame[0]);
    // sparks torn off downwind
    for (let i = 0; i < 4; i++) {
      const q = ((t / LOOP) * 4 + hash2(i, 41)) % 1;
      const sx = fx - q * 26 * u - hash2(i, 42) * 3, sy = fy - 2 * u - q * 9 * u + Math.sin(q * TAU * 2 + i) * u;
      F.set(sx, sy, TP.flame[q < 0.3 ? 3 : q < 0.65 ? 2 : 1]);
    }
  }
  // sideways snow: far dust, mid streaks, a few near streaks
  particles(F, t, { count: Math.round(60 * u), seed: 101, kx: 1, ky: 0, sway: 2 * u, wob: 2, cols: [TP.flake[0]], len: 2 });
  particles(F, t, { count: Math.round(50 * u), seed: 202, kx: 2, ky: 1, cols: [TP.flake[1], TP.flake[2]], len: Math.max(3, Math.round(3 * u)), slope: -0.25 });
  applyVignette(F, sc.vig);
  particles(F, t, { count: Math.round(14 * u), seed: 303, kx: 3, ky: 1, cols: [TP.flake[3], TP.flake[2]], len: Math.max(3, Math.round(5 * u)), slope: -0.3, big: u > 1.2 });
  paintText(F, sc.text, t, TITLE_PAL);
}

/** The menu stays clear of the hero's light pool, however narrow the screen. */
export function titleBoxes(IW: number, IH: number): Boxes {
  const u = IH / 256, X = (d: number): number => IW - (456 - d) * u;
  const L = titleLayout(IW, IH), top = L.bottom + Math.round(14 * L.u), cw = Math.min(IW * 0.4, X(256) - L.x);
  return { text: [L.x, L.y, L.w, L.bottom - L.y], calm: [L.x, top, Math.round(cw), Math.round(IH * 0.93) - top] };
}
