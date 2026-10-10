import { hash2 } from '../sprites/sculpt/kit';
import { Buf, C, LOOP, TAU, applyVignette, clamp, dl, letter, measure, mixc, over, paintText, particles, smooth, unpack, type TextPalette } from './paint';
import { DEATH_PAL } from './death';
import { buildTitle, titleLayout, type Tint, type TitleScene } from './title';
import type { Boxes, Scene } from './scene';

// ===================================================================== VICTORY
// The title's own view at sunrise. The storm has blown itself out; the sun
// lifts beside the crag; the snow, the clouds and the castle's lit faces take
// its gold while their shadows go violet; a path of sun burns across the
// fjord; the hero stands in the morning without his torch. Title and victory
// are one place, before and after.
const VP = {
  sky: ['#0e1430', '#1a1d44', '#2c2856', '#47325f', '#6e3d62', '#9a4e62', '#c26a5e', '#df8f5e', '#f0b46a', '#f8d488'].map(C),
  sun: ['#ffe2a0', '#fff2cc', '#fffbea'].map(C),
  gold: C('#ffb45a'), rose: C('#e2706a'), shade: C('#2a2050'),
  star: ['#3a3f6a', '#6a6f9a'].map(C),
  glint: ['#c88848', '#f0c070', '#fff0c0'].map(C),
  win: C('#e09a48'), banner: ['#2a1a2a', '#4a2a3a', '#6e3e48'].map(C),
  mote: ['#f6cf8a', '#fff1cc'].map(C),
};
const VICTORY_PAL: TextPalette = { ...DEATH_PAL, bands: [[0.16, C('#fff6dc')], [0.42, C('#f6dc9c')], [0.52, C('#e0b060')], [0.62, C('#a87838')], [0.86, C('#e8c478')], [9, C('#fbe6b0')]] };
const dawnTint: Tint = (c, e) => e === 0 ? mixc(c, VP.sun[0], 0.45) : e === 1 ? mixc(mixc(c, VP.shade, 0.15), VP.gold, 0.35) : e === 3 ? mixc(mixc(c, VP.shade, 0.35), VP.rose, 0.22) : mixc(c, VP.shade, 0.32);

function victoryText(IW: number, IH: number) {
  const L = titleLayout(IW, IH), mask = new Buf(IW, IH);
  const wBig = measure('VICTORY', L.cap, L.b, L.gap), wS = measure('IN MIDGARD', L.capS, L.bS, L.gapS), w = Math.max(wBig, wS);
  letter(mask, 'VICTORY', L.x, L.y, L.cap, L.b, L.gap);
  letter(mask, 'IN MIDGARD', L.x + Math.round((wBig - wS) / 2), L.y2, L.capS, L.bS, L.gapS);
  const bottom = L.y2 + L.capS;
  return { L, w, bottom, text: { mask, x0: L.x - 2, y0: L.y - 2, x1: L.x + w + 2, y1: bottom + 2, lines: [{ y: L.y, cap: L.cap }, { y: L.y2, cap: L.capS, small: true }] } };
}

interface VictoryScene extends TitleScene {
  /** x, y, radius */
  sun: [number, number, number];
}

export function buildVictory(base: Scene): VictoryScene {
  const sc = buildTitle(base, dawnTint);
  const { IW, IH, u } = sc, hz = sc.hz;
  const X = (d: number): number => IW - (456 - d) * u;
  const sx = X(232), sy = hz - 31 * u, sr = 9 * u;
  const sun: VictoryScene['sun'] = [sx, sy, sr];
  // the dawn sky: night above, rose and gold down to the horizon, brightest round the sun
  const sky = new Buf(IW, IH);
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const d = Math.hypot((x - sx) / 1.6, y - sy) / (110 * u);
    const v = Math.pow(clamp(y / (hz + 4), 0, 1), 1.6) * 7 + clamp(1 - d, 0, 1) * 2.4;
    sky.px[y * IW + x] = VP.sky[clamp(dl(x, y, v), 0, VP.sky.length - 1)];
  }
  for (let y = Math.floor(sy - sr - 1); y <= sy + sr + 1; y++) for (let x = Math.floor(sx - sr - 1); x <= sx + sr + 1; x++) {
    const d = Math.hypot(x - sx, y - sy) / sr;
    if (d < 1) sky.set(x, y, VP.sun[d < 0.55 ? 2 : d < 0.85 ? 1 : 0]);
  }
  sc.sky = sky;
  sc.stars = sc.stars.filter(([, y]) => y < IH * 0.2);
  // the night's colours graded to dawn: shadows toward violet, lit faces toward gold
  const fg = sc.fg.px;
  for (let i = 0; i < fg.length; i++) {
    const c = fg[i];
    if (!c) continue;
    const [r, g, b] = unpack(c), lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const k = smooth(0.06, 0.55, lum), near = 1 - clamp(Math.abs((i % IW) - sx) / (IW * 0.7), 0, 1);
    let o = mixc(c, VP.shade, 0.3 * (1 - k));
    o = mixc(o, k > 0.5 ? VP.gold : VP.rose, k * (0.4 + 0.25 * near));
    fg[i] = mixc(o, VP.sun[1], k * 0.15);
  }
  // the sun catches the top edge of whatever stands near it
  for (let x = Math.max(0, Math.floor(sx - 46 * u)); x < Math.min(IW, sx + 46 * u); x++) {
    const k = 1 - Math.abs(x - sx) / (46 * u);
    for (let y = 0; y <= hz; y++) {
      const q = y * IW + x;
      if (!fg[q]) continue;
      fg[q] = mixc(fg[q], VP.sun[0], 0.35 + 0.5 * k);
      if (y + 1 < IH && fg[q + IW]) fg[q + IW] = mixc(fg[q + IW], VP.gold, 0.4 * k);
      break;
    }
  }
  sc.text = victoryText(IW, IH).text;
  return { ...sc, sun };
}

export function paintVictory(sc: VictoryScene, t: number): void {
  const { IW, u } = sc, F = sc.frame, ph = TAU * (t / LOOP);
  F.px.set(sc.sky.px);
  // the last stars, going out
  const e8 = Math.floor(t / 500);
  for (const [x, y, lvl, p] of sc.stars) if ((e8 + p) % 8 !== 0) F.px[y * IW + x] = VP.star[lvl > 0 ? 1 : 0];
  // the sun's corona breathes
  const [sx, sy, sr] = sc.sun, cr = sr * (1.55 + 0.12 * Math.sin(ph));
  for (let y = Math.floor(sy - cr); y <= sy + cr; y++) for (let x = Math.floor(sx - cr); x <= sx + cr; x++) {
    const d = Math.hypot(x - sx, y - sy);
    if (d <= sr || d > cr) continue;
    const lv = dl(x, y, (1 - (d - sr) / (cr - sr)) * 2);
    if (lv > 0) F.set(x, y, mixc(F.get(x, y), VP.sun[0], lv === 1 ? 0.25 : 0.5));
  }
  over(F, sc.fg);
  // a path of sun across the fjord, glittering
  for (let y = sc.hz + 1; y < sc.iceB; y++) {
    if ((y - sc.hz) % 2) continue; // glints lie on alternate rows, like ripples
    const d = (y - sc.hz) / (sc.iceB - sc.hz), half = (1.5 + d * 8) * u;
    for (let x = Math.floor(sx - half); x <= sx + half; x++) {
      const k = y * IW + x;
      if (x < 0 || x >= IW || !sc.iceMask[k]) continue;
      // short horizontal glints that come and go, densest down the middle
      const e = 1 - Math.abs(x - sx) / half, tw = hash2(Math.floor(x / (3 * u)), y * 7 + Math.floor(t / 250));
      if (tw > 0.4 + 0.5 * (1 - e)) F.px[k] = VP.glint[tw > 0.88 && e > 0.6 ? 2 : tw > 0.62 ? 1 : 0];
    }
  }
  // the window, steady now
  { const [wx, wy, ww, wh] = sc.towerWindow; F.rect(wx, wy, ww, wh, VP.win); }
  // the banners hang in the still air, stirring
  for (const [bx, by, sz] of sc.banners) {
    const len = Math.round(8 * u * sz), hw = Math.max(2, Math.round(3 * u * sz));
    for (let j = 0; j < len; j++) {
      const sway = Math.round(Math.sin(ph - (j * 0.5) / u) * Math.min(1, j / (4 * u)) * 0.8 * u);
      const ww = j > len - 2 * u ? Math.max(1, hw - 1) : hw; // a notched fly end
      for (let i = 0; i < ww; i++) F.set(bx - 1 - i + sway, by + j, i === 0 ? VP.banner[2] : VP.banner[i === ww - 1 ? 0 : 1]);
    }
  }
  // the hero, and his long morning shadow thrown away from the sun
  const hs = sc.heroSp, hx = sc.hero.x, hy = sc.hero.y;
  if (hs) {
    const sp = hs[Math.floor(t / 500) % hs.length], R = sp.w;
    for (let i = 1; i < 16 * u; i++) { const x = Math.round(hx + 2 * u + i), y = Math.round(hy + 0.6 * u + i * 0.1), k = y * IW + x; if (sc.snowMask[k]) F.px[k] = mixc(F.px[k], VP.shade, 0.6 - i / (34 * u)); }
    F.blit(sp, Math.round(hx - R / 2), Math.round(hy - (R * 28.6) / 32));
  }
  // diamond dust drifting down through the light
  particles(F, t, { count: Math.round(14 * u), seed: 707, n: 2, kx: 0, ky: 1, sway: 4 * u, wob: 1, cols: [VP.mote[0]], len: 1 });
  applyVignette(F, sc.vig);
  particles(F, t, { count: Math.round(6 * u), seed: 808, n: 2, kx: 0, ky: 1, sway: 5 * u, wob: 1, cols: VP.mote, len: 1 });
  paintText(F, sc.text, t, VICTORY_PAL);
}

/** The dialog stays clear of the sun. */
export function victoryBoxes(IW: number, IH: number): Boxes {
  const u = IH / 256, X = (d: number): number => IW - (456 - d) * u;
  const V = victoryText(IW, IH), top = V.bottom + Math.round(16 * u), cw = Math.min(IW * 0.42, X(220) - V.L.x);
  return { text: [V.L.x, V.L.y, V.w, V.bottom - V.L.y], calm: [V.L.x, top, Math.round(cw), Math.round(IH * 0.9) - top] };
}
