import { hash2 } from '../sprites/sculpt/kit';
import {
  Buf, C, LOOP, TAU, addc, applyVignette, clamp, dl, letter, measure, mixc, noise1, paintText, particles, smooth, sprite, vignette,
  type Sprite, type TextMask, type TextPalette,
} from './paint';
import type { Boxes, Scene } from './scene';

// ======================================================================= DEATH
// Fallen in battle: a cold dawn, a runestone carved with Tiwaz, the warrior's
// rune; his sword planted in the snow before it, his helm at its foot.
// Huginn sits on the stone; Muninn circles. Gold on the horizon: Valhalla.
const DP = {
  sky: ['#0f1424', '#141a2d', '#1a2238', '#222c45', '#2d3954', '#3b4865', '#4f5a77', '#6a7289', '#8a8e9e'].map(C),
  glow: ['#120d05', '#22180a', '#3a2a10', '#5a4218', '#7e5e22'].map(C),
  gold: ['#a88850', '#e6cb8a', '#fff1c8'].map(C),
  star: ['#3b4560', '#6f7c9c'].map(C),
  cloud: ['#1f283e', '#2a3550', '#3a4562', '#7a6c5a', '#b39a70'].map(C),
  hill: ['#1d2438', '#242c44', '#2e3852', '#3d4865', '#56607e'].map(C),
  snow: ['#262e46', '#2f3852', '#3a4460', '#47526f', '#57627f', '#6b7692', '#838da7', '#a2aabf'].map(C),
  crest: C('#c2b28a'),
  stone: ['#1c2130', '#262c3d', '#30374a', '#3a4257', '#454e65', '#525c75', '#636e88'].map(C),
  groove: C('#191d29'), rune: ['#3a3424', '#7a6332', '#c9a453', '#f3d88e'].map(C),
  sSnow: ['#8994ab', '#b9c2d3', '#e2e8f0'].map(C),
  rim: ['#8a7a5c', '#e2c67f'].map(C),
  blade: ['#3c4250', '#6b7484', '#9aa4b2', '#d6dde6'].map(C),
  guard: ['#20242e', '#3a404c', '#5d6573'].map(C),
  grip: ['#2a1c14', '#4a3222', '#6a4a30'].map(C),
  pommel: ['#5a4222', '#9a7440', '#d4aa66'].map(C),
  cloth: ['#1f2738', '#2e3a50', '#3c4a60', '#55677f'].map(C),
  grass: ['#2c2a26', '#4a4436', '#6e6448', '#a08c5c'].map(C),
  raven: { k: C('#0a0b11'), d: C('#141724'), s: C('#27304a'), b: C('#1c1d26'), e: C('#c8d0dc'), r: C('#b89a62') },
  flake: ['#7d88a0', '#b4bdcd', '#e4e9f1'].map(C),
};
export const DEATH_PAL: TextPalette = {
  shadow: C('#05060c'), outline: C('#0a0c14'), snow: C('#f4f6fa'), glint: C('#fffbea'),
  bands: [[0.16, C('#fff3d4')], [0.42, C('#ecd39a')], [0.52, C('#c9a660')], [0.62, C('#8c6c38')], [0.86, C('#d6b774')], [9, C('#f1dca8')]],
};

function deathLayout(IW: number, IH: number) {
  const u = IH / 256;
  const cap = Math.round(16 * u), b = Math.max(2, Math.round(2.4 * u)), gap = Math.max(2, Math.round(2.6 * u)), sp = Math.round(cap * 0.85);
  const x = Math.round(IW * 0.06), y = Math.round(IH * 0.1);
  const words = ['FALLEN', 'IN', 'BATTLE'];
  const w = words.reduce((a, wd) => a + measure(wd, cap, b, gap), 0) + sp * 2;
  return { u, cap, b, gap, sp, x, y, w, words, bottom: y + cap };
}

// The ravens, drawn pixel by pixel. k black, d dark, s blue sheen, b beak, e eye.
const SIT_BODY = ['....kkkkkkssssssskk..', '.....kkkkkkksssssskkk', '.....kkkkkkkkksssskkk', '......kkkkkkkkkkkkkkk', '.......kkkkkkkk...kkk', '........kkkkk.......k', '.........k..k........', '.........k..k........', '........kk.kk........'];
const RAVEN_SIT = [
  // looking out over the snow
  ['......kkkk...........', '....kkkkkkk..........', 'bbbbkkkekkkk.........', '.bbbbkkkkkkk.........', '..kkkkkkkkkkk........', '...kkkkkkkssskk......', '....kkkkkssssssk.....', '....kkkkksssssssk....', ...SIT_BODY],
  // head bowed toward the helm
  ['.....................', '......kkkk...........', '.....kkkkkkk.........', '....kkkekkkkk........', '..bbkkkkkkkkk........', '.bbbbkkkkkssskk......', 'bbb.kkkkkssssssk.....', 'b...kkkkksssssssk....', ...SIT_BODY],
  // a shake of the feathers
  ['......kkkk...........', '....kkkkkkk..........', 'bbbbkkkekkkk.........', '.bbbbkkkkkkk.........', '..kkkkkkkkkkk.k......', '...kkkkkkkssskkk.....', '....kkkkkssssssskk...', '....kkkkksssssssk....', ...SIT_BODY],
];
const FLY_BODY = ['bbbkkekkkkkkkkkkkk......', '..bbkkkkkkkkkkkkkkkkk...', '......kkkkkkkkkkkk.kkkk.'];
const RAVEN_FLY = [
  ['...........kk...........', '..........kkk...........', '.........kkkk...kk......', '........kkkk..kkk.......', '.......kkkk.kkkk........', '......kkkkkkkkk.........', ...FLY_BODY, '', '', '', ''],
  ['', '', '', '......kkkkkkkkkkk.......', '....kkkkkkkkkkkkkkkk....', '..kkk.kkkkkkkkkk..kkkk..', ...FLY_BODY, '', '', '', ''],
  ['', '', '', '', '', '', ...FLY_BODY, '.......kkkkkkkk.........', '........kkkkkk..........', '.........kkkk.k.........', '..........kk.k.k........'],
];

/** The helm's sprite, and the rows where its band ends and its hollow's depth (the drift is drawn per frame). */
interface Helm extends Sprite {
  bandBottom: number;
  holH: number;
  cx: number;
}

interface DeathScene extends Scene {
  hz: number;
  bg: Buf;
  snowMask: Uint8Array;
  /** Tiwaz's three strokes, and its brush. */
  tiwaz: Array<[number, number, number, number]>;
  tiwazB: number;
  /** x, y, blades, height */
  tufts: Array<[number, number, number, number]>;
  sword: { x: number; tip: number; top: number; lean: number };
  helm: Helm;
  helmAt: [number, number];
  vig: Uint8Array;
  text: TextMask;
}

export function buildDeath(base: Scene): DeathScene {
  const { IW, IH, u } = base;
  const X = (d: number): number => IW - (456 - d) * u, Y = (d: number): number => d * u;
  const hz = Math.round(Y(170));
  const gx = X(332), gy = hz;
  const bg = new Buf(IW, IH);
  // sky: cold dawn, the glow gathered behind the stone
  for (let y = 0; y <= hz; y++) for (let x = 0; x < IW; x++) {
    const v = Math.pow(y / hz, 1.25) * (DP.sky.length - 1);
    let c = DP.sky[clamp(dl(x, y, v), 0, DP.sky.length - 1)];
    const d = Math.hypot((x - gx) / (190 * u), (y - gy) / (78 * u));
    if (d < 1) { const lv = clamp(dl(x, y, Math.pow(1 - d, 1.3) * 5), 0, 5); if (lv) c = addc(c, DP.glow[lv - 1]); }
    bg.px[y * IW + x] = c;
  }
  // last stars
  for (let y = 0; y < hz * 0.42; y++) for (let x = 0; x < IW; x++) if (hash2(x * 5 + 1, y * 11 + 4) > 0.997) bg.set(x, y, DP.star[hash2(x, y) > 0.7 ? 1 : 0]);
  // banks of cloud broken into drifts: puffed dark tops, flat bases caught
  // gold by the sun still below the rim
  for (const [cy, xa, xb, th, id] of [[124, 170, 476, 9, 1], [140, 40, 250, 5, 2], [100, 280, 476, 7, 3], [150, 330, 476, 4, 4], [74, 340, 456, 5, 5], [112, -10, 120, 4, 6]]) {
    const x0 = X(xa), x1 = X(xb);
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(IW, x1); x++) {
      const s = (x - x0) / (x1 - x0);
      const k = Math.pow(Math.sin(Math.PI * s), 0.6) * (0.4 + 0.6 * noise1(x, 9 * u, id)) * smooth(0.28, 0.5, noise1(x, 22 * u, id + 20));
      const t2 = th * u * k; if (t2 < 0.9) continue;
      const yc = Y(cy) + (noise1(x, 30 * u, id + 7) - 0.5) * 3 * u;
      const puff = (noise1(x, 3.5 * u, id + 11) - 0.3) * t2 * 0.55;
      const ya = Math.round(yc - t2 * 0.7 - puff), yb = Math.round(yc + t2 * 0.3);
      const near = 1 - clamp(Math.abs(x - gx) / (210 * u), 0, 1);
      for (let y = ya; y <= yb; y++) {
        const rel = (y - ya) / Math.max(1, yb - ya);
        let c = DP.cloud[dl(x, y, 0.6 + rel * 1.1) >= 1 ? 1 : 0];
        if (rel > 0.7) c = DP.cloud[dl(x, y, 1 + near * 0.9) >= 2 ? 2 : 1];
        if (y === yb) { const g = dl(x, y, 0.5 + near * 2.6); c = g >= 3 ? DP.cloud[4] : g >= 2 ? DP.cloud[3] : DP.cloud[2]; }
        else if (y === yb - 1 && near > 0.4) c = DP.cloud[dl(x, y, near * 1.7) >= 1 ? 3 : 2];
        bg.set(x, y, c);
      }
    }
  }
  // the horizon: a thread of gold under the glow
  for (let x = 0; x < IW; x++) {
    const near = 1 - Math.abs(x - gx) / (170 * u);
    if (near <= 0) continue;
    const lv = clamp(dl(x, hz, near * 2.4), 0, 2);
    bg.set(x, hz, DP.gold[lv]); if (lv >= 1) bg.set(x, hz - 1, DP.gold[lv - 1]);
  }
  // low far hills, left and far right
  const hillTop = (x: number): number => {
    const xr = 456 - (IW - x) / u;
    const left = (1 - smooth(140, 250, xr)) * (8 + 7 * Math.sin(xr * 0.03 + 1) + 4 * Math.sin(xr * 0.09));
    const right = smooth(405, 440, xr) * (7 + 3 * Math.sin(xr * 0.1));
    return hz - Math.max(left, right, 0) * u;
  };
  for (let x = 0; x < IW; x++) {
    const tY = Math.round(hillTop(x)), sl = hillTop(x + 2) - hillTop(x - 2);
    for (let y = tY; y < hz; y++) {
      const lit = sl > 0.3; // faces the dawn on the right
      bg.set(x, y, y === tY ? DP.hill[lit ? 4 : 3] : y < tY + 2 * u ? DP.hill[lit ? 3 : 2] : DP.hill[clamp(dl(x, y, 1.6 - (y - tY) / (10 * u)), 0, 2)]);
    }
  }
  // the snowfield: long soft dunes, lit toward the dawn, gilded at the crests near it
  const snowMask = new Uint8Array(IW * IH);
  for (let y = hz + 1; y < IH; y++) for (let x = 0; x < IW; x++) {
    const xd = x / u, yd = y / u, d = (y - hz) / (IH - hz);
    const dune = Math.sin(xd * 0.018 + yd * 0.11 + 0.4) * 0.8 + Math.sin(xd * 0.041 - yd * 0.06 + 2) * 0.45;
    const slope = Math.cos(xd * 0.018 + yd * 0.11 + 0.4) * 0.8;
    const near = 1 - clamp(Math.abs(x - gx) / (150 * u), 0, 1) * 1;
    let v = 5.6 - d * 3.6 + dune * 0.7 + slope * 0.5 + near * (1 - d) * 1.4;
    let c = DP.snow[clamp(dl(x, y, v), 0, 7)];
    const wk = clamp(dl(x, y, near * near * (1 - d) * 3.2 + slope * 0.3), 0, 3);
    if (wk) c = mixc(c, DP.crest, [0, 0.1, 0.2, 0.32][wk]);
    bg.set(x, y, c);
    snowMask[y * IW + x] = 1;
  }
  // mist lying on the far snow
  for (let y = hz + 1; y < hz + 8 * u; y++) for (let x = 0; x < IW; x++) if (dl(x, y, (1 - (y - hz) / (8 * u)) * 0.9) >= 1) bg.set(x, y, mixc(bg.get(x, y), DP.sky[7], 0.45));
  // a ship-setting of small stones far off on the left: the old graves
  for (let i = 0; i < 9; i++) {
    const q = i / 8, sx = X(150) + Math.cos(Math.PI * q) * -44 * u, sy = hz + 6 * u + Math.sin(Math.PI * q) * 3 * u, hh = Math.max(2, Math.round((2 + (i === 0 || i === 8 ? 2 : 0)) * u));
    bg.rect(sx, sy - hh, Math.max(1, Math.round(u)), hh, DP.hill[2]); bg.set(sx, sy - hh, DP.hill[4]);
  }

  // the stone's long shadow, falling toward the eye
  const sb = Y(214);
  bg.poly([X(304), sb, X(350), sb, X(296), IH + 2, X(214), IH + 2], (x, y, old) => (snowMask[y * IW + x] ? mixc(old, DP.snow[0], 0.6) : 0));

  // the runestone
  const stonePts = [X(303), Y(216), X(299), Y(182), X(300), Y(148), X(304), Y(122), X(311), Y(106), X(320), Y(97), X(332), Y(92), X(343), Y(95), X(351), Y(104), X(355), Y(121), X(356), Y(150), X(355), Y(186), X(352), Y(216)];
  const sm = new Buf(IW, IH); sm.poly(stonePts, 1);
  const isS = (x: number, y: number): boolean => sm.get(x, y) === 1;
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    if (!isS(x, y)) continue;
    let r = 0; while (isS(x + r + 1, y) && r < 3) r++;
    let l = 0; while (isS(x - l - 1, y) && l < 3) l++;
    let c: number;
    const g = hash2(x >> 1, y >> 1), gr = g > 0.86 ? 1 : g < 0.14 ? -1 : 0;
    const yy = (y - Y(92)) / (Y(216) - Y(92));
    if (r === 0) c = DP.rim[1]; else if (r === 1) c = DP.rim[0];
    else if (l === 0) c = DP.stone[0];
    else c = DP.stone[clamp(dl(x, y, 3.6 - yy * 1.4 + gr + (r < 3 ? 0.6 : 0)), 1, 6)];
    bg.set(x, y, c);
    snowMask[y * IW + x] = 0;
  }
  // snow on its shoulders
  for (let x = 0; x < IW; x++) {
    let top = -1; for (let y = 0; y < IH; y++) if (isS(x, y)) { top = y; break; }
    if (top < 0 || top > Y(126)) continue;
    const depth = Math.round((2 + hash2(x, 61) * 2.2) * u * (top < Y(104) ? 1.2 : 0.7));
    for (let j = 0; j < depth; j++) if (isS(x, top + j) && isS(x + 1, top + j)) bg.set(x, top + j, DP.sSnow[j === 0 ? 2 : j < depth - 1 ? 1 : 0]);
  }
  // the carved band: a serpent following the stone's edge, runes along it
  const cx0 = X(327.5), cy0 = Y(170);
  const inset = (k: number): number[] => {
    const pts: number[] = [];
    for (let i = 2; i < stonePts.length - 2; i += 2) pts.push(cx0 + (stonePts[i] - cx0) * k, cy0 + (stonePts[i + 1] - cy0) * (k + (1 - k) * 0.45));
    return pts;
  };
  const outer = inset(0.8), inner = inset(0.64), mid = inset(0.72);
  bg.polyline(outer, DP.groove); bg.polyline(inner, DP.groove);
  // runes in the band
  let acc = 0;
  for (let i = 0; i + 3 < mid.length; i += 2) {
    const ax = mid[i], ay = mid[i + 1], bx = mid[i + 2], by = mid[i + 3], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += 1) {
      acc += 1;
      if (acc % Math.round(6 * u) !== 0) continue;
      const x = ax + (bx - ax) * (s / L), y = ay + (by - ay) * (s / L), kind = Math.floor(hash2(Math.round(acc), 71) * 6);
      if (kind === 5) continue; // a word gap
      const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx, hh = 1.6 * u, br = 1.5 * u;
      bg.line(x - nx * hh, y - ny * hh, x + nx * hh, y + ny * hh, DP.groove);
      if (kind === 1) bg.line(x - nx * hh, y - ny * hh, x + tx * br, y + ty * br, DP.groove); // a branch from the top
      if (kind === 2) bg.line(x, y, x + tx * br - nx * hh, y + ty * br - ny * hh, DP.groove);
      if (kind === 3) { bg.line(x - nx * hh * 0.3, y - ny * hh * 0.3, x + tx * br, y + ty * br, DP.groove); bg.line(x + nx * hh * 0.3, y + ny * hh * 0.3, x + tx * br, y + ty * br, DP.groove); }
      if (kind === 4) bg.line(x - nx * hh, y - ny * hh, x - tx * br, y - ty * br, DP.groove);
    }
  }
  // the serpent's head at the base of the band, on the left
  { const hx = outer[0] - u, hy = Y(206); bg.poly([hx - 2 * u, hy, hx + 5 * u, hy - 2 * u, hx + 7 * u, hy + 1 * u, hx + 2 * u, hy + 3 * u], DP.groove); bg.set(hx + 3 * u, hy, DP.stone[5]); }
  // Tiwaz, the warrior's rune, carved in the centre: it glows gold in a slow pulse
  const tiwaz: DeathScene['tiwaz'] = [[X(327.5), Y(124), X(327.5), Y(190)], [X(327.5), Y(124), X(317), Y(140)], [X(327.5), Y(124), X(338), Y(140)]];
  const tiwazB = Math.max(2, Math.round(2 * u));
  for (const [a, b2, c2, d2] of tiwaz) bg.line(a, b2, c2, d2, DP.groove, tiwazB + 2);

  // grass tufts poking through, and small stones
  const tufts: DeathScene['tufts'] = [];
  for (let i = 0; i < 30; i++) {
    const x = Math.round(hash2(i, 81) * IW), y = Math.round(hz + 12 * u + Math.pow(hash2(i, 82), 0.6) * (IH - hz - 12 * u));
    if (!snowMask[y * IW + x] || (x > X(240) && x < X(370) && y < Y(236)) || (x > X(232) && x < X(296))) continue;
    if (x < IW * 0.5 && y < IH * 0.9) continue; // the epitaph's ground stays bare
    tufts.push([x, y, 3 + Math.floor(hash2(i, 83) * 3), (4 + hash2(i, 84) * 6) * u * (0.6 + (y - hz) / (IH - hz))]);
  }
  for (let i = 0; i < 7; i++) {
    const x = Math.round(hash2(i, 91) * IW), y = Math.round(hz + 20 * u + hash2(i, 92) * (IH - hz - 24 * u)), r = (1.5 + hash2(i, 93) * 2.5) * u;
    if (!snowMask[y * IW + x]) continue;
    bg.poly([x - r, y, x - r * 0.6, y - r * 0.7, x + r * 0.5, y - r * 0.8, x + r, y], DP.stone[2]);
    bg.line(x - r * 0.6, y - r * 0.7, x + r * 0.5, y - r * 0.8, DP.sSnow[1]);
  }

  // the sword, planted; its hilt is drawn per frame for the cloth on it
  const sword = { x: X(279), tip: Y(232), top: Y(168), lean: 3 * u };
  // the helm, baked from a small model so it shades like the game's sprites
  const helm = helmSprite(u);
  const helmAt: [number, number] = [X(254), Y(226)];

  const vig = vignette(base);
  const L = deathLayout(IW, IH), mask = new Buf(IW, IH);
  let x = L.x;
  for (const wd of L.words) x += letter(mask, wd, x, L.y, L.cap, L.b, L.gap) + L.sp;
  // a carved rule under the words, where the epitaph begins: a line, a lozenge, end ticks
  const ry = L.bottom + Math.round(8 * u), mx = L.x + Math.round(L.w / 2), dm = Math.max(2, Math.round(2 * u));
  mask.line(L.x, ry, mx - dm - 3, ry, 1); mask.line(mx + dm + 3, ry, L.x + L.w - 1, ry, 1);
  mask.poly([mx - dm - 0.5, ry + 0.5, mx + 0.5, ry - dm + 0.5, mx + dm + 1.5, ry + 0.5, mx + 0.5, ry + dm + 1.5], 1);
  mask.line(L.x, ry - 2, L.x, ry + 2, 1); mask.line(L.x + L.w - 1, ry - 2, L.x + L.w - 1, ry + 2, 1);
  const text: TextMask = { mask, x0: L.x - 2, y0: L.y - 2, x1: L.x + L.w + 2, y1: ry + 3, lines: [{ y: L.y, cap: L.cap }, { y: ry - 2, cap: 4, plain: true }] };
  return { ...base, hz, bg, snowMask, tiwaz, tiwazB, tufts, sword, helm, helmAt, vig, text };
}

/**
 * The fallen hero's spangenhelm, tipped back in the snow, shaded pixel by pixel:
 * an iron bowl lit gold from the dawn on the right, bronze spangen strips and
 * brow band, the nasal over the dark hollow where his face was, snow on the crown.
 * Returns the sprite plus the rows where its band ends (the drift is drawn per frame).
 */
const HP = {
  iron: ['#1d2029', '#2c313d', '#3f4654', '#59616f', '#7d8592', '#b3b9c2'].map(C),
  bronze: ['#4e331b', '#835a2d', '#b88444', '#e3b86f'].map(C),
  hollow: C('#05060a'), inner: C('#11131b'), innerLit: C('#2b2629'),
  k: C('#090b11'), gold: C('#ebcf8a'), snow: C('#dfe6f0'), snowD: C('#a9b3c6'),
};
function helmSprite(u: number): Helm {
  const R = Math.round(11 * u), W = 2 * R + 5, cx = R + 2;
  const domeH = Math.round(12.5 * u), bandH = Math.max(2, Math.round(2 * u)), holH = Math.max(4, Math.round(5 * u));
  const H = domeH + bandH + holH + 4, y0 = 1;
  const px = new Uint32Array(W * H), part = new Uint8Array(W * H); // part: 1 dome, 2 band, 3 hollow, 4 nasal
  const put = (x: number, y: number, c: number, p: number): void => { if (x >= 0 && y >= 0 && x < W && y < H) { px[y * W + x] = c; part[y * W + x] = p; } };
  // the bowl: an ogive, lit from the right and above
  for (let r = 0; r < domeH; r++) {
    const yy = (r + 0.5) / domeH, hw = (R - 0.5) * Math.pow(Math.sin((yy * Math.PI) / 2), 0.85);
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const nx = (x - cx) / Math.max(1, hw), y = y0 + r;
      let lvl = clamp(dl(x, y, 1.9 + nx * 1.9 + (1 - yy) * 1.1), 0, 4), c = HP.iron[lvl];
      if (nx > 0.28 && nx < 0.62 && yy > 0.3 && yy < 0.62) c = HP.iron[5];
      const sx = Math.abs(x - cx - 0.5);
      if (sx < 1) c = x <= cx ? HP.bronze[1] : HP.bronze[2]; // the centre strip
      else if (Math.abs(x - (cx - hw * 0.68)) < 0.5) c = HP.bronze[0]; // the side strips
      else if (Math.abs(x - (cx + hw * 0.66)) < 0.5) c = HP.bronze[2];
      put(x, y, c, 1);
    }
  }
  // the brow band, a little proud of the bowl, riveted
  for (let r = 0; r < bandH; r++) {
    const y = y0 + domeH + r;
    for (let x = cx - R; x <= cx + R; x++) {
      const right = x > cx;
      let c = r === 0 ? HP.bronze[right ? 3 : 2] : HP.bronze[right ? 2 : 1];
      if (x === cx - R) c = HP.bronze[0];
      if (r === bandH - 1 && (x - cx) % 4 === 0) c = HP.bronze[3];
      put(x, y, c, 2);
    }
  }
  // the hollow, seen past the rim as the helm tips back; dawn finds its inner left wall
  const hy0 = y0 + domeH + bandH;
  for (let r = 0; r < holH; r++) {
    const yy = (r + 0.5) / holH, hw = (R - 0.6) * Math.sqrt(1 - yy * yy);
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const c = r === 0 ? HP.hollow : x < cx - hw * 0.45 && r < holH - 1 ? HP.innerLit : HP.inner;
      put(x, hy0 + r, c, 3);
    }
  }
  // the nasal, over band and hollow
  for (let y = y0 + domeH - 1; y < hy0 + holH - 1; y++) {
    const tip = y >= hy0 + holH - 2;
    put(cx, y, tip ? HP.iron[3] : HP.iron[4], 4);
    if (!tip) put(cx + 1, y, HP.iron[5], 4);
  }
  // outline round the outside, a gold rim inside the lit right edge
  const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && part[y * W + x] > 0;
  const out = px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled(x, y)) continue;
    if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out[y * W + x] = HP.k;
  }
  for (let y = y0; y < hy0; y++) {
    let x = W - 1;
    while (x > 0 && !filled(x, y)) x--;
    if (filled(x, y)) out[y * W + x] = y < hy0 - bandH ? HP.gold : mixc(out[y * W + x], HP.gold, 0.6);
  }
  // a skin of snow settled on the crown and the windward shoulder
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < hy0 && !filled(x, y)) y++;
    if (y >= hy0 - bandH || x > cx + 2) continue;
    if (hash2(x, 77) > 0.25) { out[(y - 1) * W + x] = HP.snow; if (hash2(x, 78) > 0.5) out[y * W + x] = HP.snowD; }
  }
  return { w: W, h: H, px: out, bandBottom: hy0, holH, cx };
}

export function paintDeath(sc: DeathScene, t: number): void {
  const { IW, u } = sc, F = sc.frame, ph = TAU * (t / LOOP);
  const X = (d: number): number => IW - (456 - d) * u, Y = (d: number): number => d * u;
  F.px.set(sc.bg.px);
  // Tiwaz breathes gold
  const pulse = 0.5 - 0.5 * Math.cos(ph);
  for (const [a, b, c, d] of sc.tiwaz) {
    F.line(a, b, c, d, DP.rune[pulse > 0.66 ? 2 : pulse > 0.25 ? 1 : 0], sc.tiwazB);
    if (pulse > 0.8) F.line(a, b, c, d, DP.rune[3], 1);
  }
  // grass, nodding in the wind off the sea
  const sway = Math.sin(ph * 2) > 0 ? 1 : 0;
  for (const [x, y, n, hh] of sc.tufts) {
    const lit = x > X(250) ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const o = i - (n - 1) / 2, bx = Math.round(x + o * 0.9 * u), ht = hh * (0.55 + 0.45 * hash2(x + i, y));
      const bend = -(0.4 + sway * 0.5 + hash2(x, i) * 0.6) * u + o * 0.7 * u; // bowed downwind, fanned
      const mx = bx + bend * 0.25, my = y - ht * 0.55, tx = bx + bend + o * 0.4 * u, ty = y - ht;
      F.line(bx, y, mx, my, DP.grass[1]);
      F.line(mx, my, tx, ty, DP.grass[2]);
      F.set(tx, ty, DP.grass[2 + lit]);
    }
    // snow drifted round its foot
    for (let k = -2; k <= 2; k++) F.set(x + k, y + (Math.abs(k) > 1 ? 1 : 0), mixc(F.get(x + k, y + 3), DP.snow[7], Math.abs(k) > 1 ? 0.2 : 0.4));
  }
  // the helm, half sunk in the drift
  { const hs = sc.helm, hx = Math.round(sc.helmAt[0]), hy = Math.round(sc.helmAt[1]), half = hs.w / 2, base = hy + hs.holH + 1;
    // its long dawn shadow, thrown towards us and to the left
    for (let y = base - 2; y <= base + 1; y++) for (let x = Math.round(hx - half * 2.4); x < hx + half * 0.6; x++) {
      const q = (hx + half * 0.6 - x) / (half * 3), k = (0.42 - Math.abs(y - base + 0.5) * 0.08) * (1 - q * 0.6);
      if (dl(x, y, k * 4) > 0) F.set(x, y, mixc(F.get(x, y), DP.snow[0], 0.5));
    }
    F.blit(hs, hx - hs.cx, hy - hs.bandBottom);
    // the drift: a soft lip along the rim, heaped against the windward left,
    // in the ground's own snow so it grows out of the field
    for (let x = Math.round(hx - half * 1.7); x <= hx + half * 1.6; x++) {
      const tt = (x - hx) / half;
      const hd = hs.holH * 0.95 * Math.exp(-(((tt + 0.5) / 0.5) ** 2)) + 2.2 * u * Math.exp(-((tt / 0.95) ** 4));
      if (hd < 0.6) continue;
      const top = Math.round(base + 1 - hd);
      for (let y = top; y <= base + 1; y++) F.set(x, y, y === top ? (tt < 0.2 ? DP.snow[7] : DP.snow[6]) : y === top + 1 ? mixc(F.get(x, y + 8), DP.snow[7], 0.35) : F.get(x, y + 8));
    }
  }
  // the sword, planted
  { const s = sc.sword, len = s.tip - s.top, bw = Math.max(3, Math.round(3.6 * u));
    const xAt = (y: number): number => s.x + s.lean * (1 - (y - s.top) / len);
    const bladeTop = s.top + 13 * u;
    for (let y = Math.round(bladeTop); y < s.tip; y++) {
      const x0 = Math.round(xAt(y) - bw / 2), wy = y > s.tip - 4 * u ? Math.max(1, bw - Math.round((y - (s.tip - 4 * u)) / u)) : bw;
      for (let i = 0; i < wy; i++) F.set(x0 + i, y, i === 0 ? DP.blade[3] : i === wy - 1 ? DP.rim[1] : i === Math.floor(wy / 2) && y < s.tip - 10 * u ? DP.blade[0] : DP.blade[2 - (i > wy / 2 ? 1 : 0)]);
    }
    // nicks in the edge
    for (const q of [0.3, 0.52]) { const y = Math.round(bladeTop + (s.tip - bladeTop) * q); F.set(Math.round(xAt(y) - bw / 2), y, DP.blade[0]); }
    const gyy = Math.round(bladeTop - 1), gx = xAt(gyy), gw = Math.round(7 * u);
    for (let i = -gw; i <= gw; i++) { F.set(gx + i, gyy, i === -gw || i === gw ? DP.guard[2] : DP.guard[1]); F.set(gx + i, gyy + 1, DP.guard[0]); }
    F.set(gx + gw, gyy, DP.rim[1]);
    for (let y = Math.round(s.top + 4 * u); y < gyy; y++) { const x0 = Math.round(xAt(y) - 1); F.set(x0, y, DP.grip[((y >> 1) & 1) ? 2 : 1]); F.set(x0 + 1, y, DP.grip[((y >> 1) & 1) ? 1 : 0]); F.set(x0 + 2, y, DP.rim[0]); }
    const px0 = xAt(s.top), py0 = s.top;
    F.poly([px0 - 3 * u, py0 + 4 * u, px0 - 2.4 * u, py0 + 1.2 * u, px0, py0, px0 + 2.4 * u, py0 + 1.2 * u, px0 + 3 * u, py0 + 4 * u], (x, y) => (x > px0 + 1.4 * u ? DP.rim[1] : y < py0 + 1.6 * u ? DP.pommel[2] : DP.pommel[1]));
    // a strip of his cloak tied at the guard, lifting in the wind
    const cl = Math.round(14 * u), cw = Math.max(2, Math.round(2.4 * u));
    for (let i = 0; i < cl; i++) {
      const wave = Math.round(Math.sin(ph * 2 - i * 0.55 / u) * Math.min(2, i / (3 * u)) * u + i * 0.35);
      const ww = Math.max(1, Math.round(cw * (1 - i / cl * 0.5)));
      if (i > cl - 3 && ((i + Math.floor(t / 250)) & 1)) continue;
      for (let j = 0; j < ww; j++) F.set(gx - gw + 2 - i, gyy + 1 + j + wave, DP.cloth[j === 0 ? 3 : j === ww - 1 ? 0 : 2]);
    }
    F.rect(gx - gw + 1, gyy, 2, 3, DP.cloth[1]);
    // snow drifted against the blade
    for (let i = -3; i <= 3; i++) F.set(xAt(s.tip) + i * u, s.tip - (3 - Math.abs(i)) * 0.5 * u, DP.snow[6]);
  }
  // Huginn on the stone: looks out, bows his head toward the helm, ruffles
  { const ph4 = t / LOOP, f = ph4 < 0.38 ? 0 : ph4 < 0.64 ? 1 : ph4 > 0.82 && ph4 < 0.9 ? 2 : 0;
    const sp = sprite(RAVEN_SIT[f], DP.raven, DP.raven.r);
    const sx = Math.round(X(317)), sy = Math.round(Y(93) - sp.h + 2);
    F.blit(sp, sx, sy);
  }
  // Muninn circles above, flapping and gliding
  { const a = ph, ex = X(306) + Math.cos(a) * 60 * u, ey = Y(44) + Math.sin(a) * 13 * u;
    const goingLeft = Math.sin(a) > 0; // dx/dt = -sin(a)
    const flap = Math.floor(t / 140) % 4, glide = Math.floor(t / 1000) % 2 === 1;
    const f = glide ? 1 : [0, 1, 2, 1][flap];
    const sp = sprite(RAVEN_FLY[f], DP.raven);
    F.blit(sp, ex - sp.w / 2, ey - 7, !goingLeft);
  }
  // gentle snow
  particles(F, t, { count: Math.round(70 * u), seed: 501, n: 3, kx: 0, ky: 1, sway: 3 * u, wob: 2, cols: [DP.flake[0], DP.flake[1]], len: 1 });
  applyVignette(F, sc.vig);
  particles(F, t, { count: Math.round(22 * u), seed: 602, n: 2, kx: 0, ky: 1, sway: 5 * u, wob: 1, cols: [DP.flake[2], DP.flake[1]], len: 1, big: true });
  paintText(F, sc.text, t, DEATH_PAL);
}

/** The epitaph stays clear of the helm and sword. */
export function deathBoxes(IW: number, IH: number): Boxes {
  const u = IH / 256, X = (d: number): number => IW - (456 - d) * u;
  const L = deathLayout(IW, IH), top = L.bottom + Math.round(16 * L.u), cw = Math.min(IW * 0.42, X(236) - L.x);
  return { text: [L.x, L.y, L.w, L.bottom - L.y], calm: [L.x, top, Math.round(cw), Math.round(IH * 0.9) - top] };
}
