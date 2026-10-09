import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, H, X, bell, eIn, eOut, flight, pen, seedAt, seed2, seg, type Pen, type Tones } from './pen';

/**
 * Fire: a comet whose tail curls UP (heat rises even in flight), embers shed behind it that
 * drift up and wink out. Impact: tongues lick up from the floor, flicker at 18 fps, embers
 * rise and blink out, a scorch fades.
 */
const FIRE = { msBolt: 420, msImpact: 760 };

function fireBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.fire,
    F = flight(x0, y0, x1, y1, cs);
  const ms = FIRE.msBolt,
    tms = p * ms,
    f = Math.floor(tms / 55),
    sd = seed2(x0, y0, x1, y1, cs);
  const HOT = X.fireHot;
  const hx = F.ax + F.dx * p,
    hy = F.ay + F.dy * p;
  ctx.save();
  P.glow(hx, hy, 11, c.mid, 0.3).glow(hx, hy, 4.5, HOT, 0.35);
  // embers shed along the path: rise, sway, wink out
  const N = Math.ceil(F.D / 3);
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.5) / N;
    if (tb > p) break;
    const age = (p - tb) * ms,
      life = 150 + H(sd + i, 11) * 220;
    if (age >= life) continue;
    const k = age / life;
    if (k > 0.62 && (f + i) % 2) continue;
    const side = (H(sd + i, 12) - 0.5) * 3.4;
    const ex = F.ax + F.dx * tb - F.uy * side + Math.sin(age * 0.013 + i * 2.1) * 1.1;
    const ey = F.ay + F.dy * tb + F.ux * side - age * (0.011 + 0.012 * H(sd + i, 13));
    P.col(k < 0.25 ? HOT : k < 0.62 ? c.mid : c.edge).dot(ex, ey, 1);
  }
  // the comet: discs back along the path, each lifted more (the tail licks up)
  const grow = Math.min(1, (p * F.D) / 8 + 0.2),
    tail: Array<[number, number, number]> = [];
  for (let j = 7; j >= 0; j--) {
    const s = j * 1.4 * grow,
      lift = (j * j * 0.09 + (j ? (H(f + sd, j) - 0.5) * 1.0 : 0)) * grow;
    tail.push([hx - F.ux * s, hy - F.uy * s - lift, Math.max(0.55, 3 - j * 0.34)]);
  }
  P.col(c.edge);
  for (const t of tail) P.disc(t[0], t[1], t[2] + 0.95);
  P.col(c.mid);
  for (const t of tail) P.disc(t[0], t[1], t[2]);
  P.col(HOT);
  for (const t of tail.slice(-4)) P.disc(t[0], t[1], t[2] - 1.0);
  P.col(c.core).disc(hx + F.ux * 0.5, hy + F.uy * 0.5, 1.25);
  // flecks breaking off the top of the tail
  for (let j = 0; j < 2; j++) {
    if (H(f * 3 + j, sd) < 0.4) continue;
    const t = tail[2 + j * 2];
    P.col(j ? c.mid : c.edge).dot(t[0] + (H(f, j + 5) - 0.5) * 2, t[1] - t[2] - 1.6 - H(f, j + 7) * 1.6, 1);
  }
  ctx.restore();
}

/** One flame tongue, drawn bottom-up as rows (the retro "blitted" flame). */
function tongue(P: Pen, bx: number, by: number, h: number, w: number, ph: number, c: Tones, HOT: string): void {
  if (h < 1) return;
  const rows = Math.max(1, Math.round(h));
  for (let r = 0; r < rows; r++) {
    const tt = (r + 0.5) / rows;
    const hw = w * Math.pow(1 - tt, 0.85) * (0.72 + 0.28 * Math.min(1, tt * 4));
    const cx = bx + Math.sin(tt * 2.6 + ph) * tt * 2.2;
    const yy = by - (r + 1);
    P.col(c.edge).span(cx - hw, cx + hw, yy);
    if (hw > 1.1) P.col(c.mid).span(cx - hw + 1, cx + hw - 1, yy);
    if (tt < 0.62 && hw > 2.1) P.col(tt < 0.3 ? c.core : HOT).span(cx - hw * 0.42, cx + hw * 0.42, yy);
  }
}

/** A burn left on the floor: ragged dark ellipse with dying cinders. */
function scorch(P: Pen, x: number, y: number, rx: number, ry: number, a: number, sd: number, cinders: number, c: Tones): void {
  const ctx = P.ctx;
  if (a <= 0) return;
  ctx.fillStyle = X.scorch;
  for (let gy = Math.floor(y - ry - 1); gy <= Math.ceil(y + ry + 1); gy++) {
    for (let gx = Math.floor(x - rx - 1); gx <= Math.ceil(x + rx + 1); gx++) {
      const d = Math.hypot((gx + 0.5 - x) / rx, (gy + 0.5 - y) / ry),
        hv = H(gx * 7 + sd, gy * 13);
      if (d > 1.12 || (d > 0.78 && hv < (d - 0.78) * 2.6)) continue;
      ctx.globalAlpha = a * (d < 0.55 ? 0.62 : 0.4);
      ctx.fillRect(gx * P.u, gy * P.u, P.u, P.u);
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    if (cinders <= H(sd + i, 66)) continue;
    const ex = x + (H(sd + i, 67) - 0.5) * rx * 1.3,
      ey = y + (H(sd + i, 68) - 0.5) * ry * 1.1;
    P.col(cinders > 0.5 ? c.mid : c.edge).dot(ex, ey, 1);
  }
}

function fireImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.fire,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    FY = Y0 + 12;
  const ms = FIRE.msImpact,
    tms = p * ms,
    f = Math.floor(tms / 55),
    sd = seedAt(x, y, cs);
  const HOT = X.fireHot;
  ctx.save();
  // scorch first: it is on the floor, under the flames
  scorch(P, X0, FY - 0.5, 9.5, 3.4, seg(p, 0.1, 0.28) * (1 - seg(p, 0.6, 1)), sd, 1 - seg(p, 0.5, 0.95), c);
  const heat = seg(p, 0, 0.08) * (1 - seg(p, 0.42, 0.92));
  P.fglow(X0, FY - 1, 17, 6.5, c.mid, 0.42 * heat).glow(X0, Y0 - 3, 14, c.mid, 0.26 * heat);
  // ignition: the fireball bursts into a ragged flare, flecks thrown out and up
  if (p < 0.16) {
    const k = p / 0.16,
      r = 3.4 * (1 - k * 0.55),
      lob: Array<[number, number, number]> = [
        [0, 0, 1],
        [-1.8, -1.6, 0.7],
        [1.6, -2.6, 0.62],
        [0.4, -4, 0.45],
      ];
    P.col(c.edge);
    for (const b of lob) P.disc(X0 + b[0], Y0 - 3 + b[1] - k * 2, r * b[2] + 1);
    P.col(c.mid);
    for (const b of lob) P.disc(X0 + b[0], Y0 - 3 + b[1] - k * 2, r * b[2]);
    if (k < 0.65) {
      P.col(HOT).disc(X0 - 0.3, Y0 - 3.4 - k * 2, r * 0.55);
      P.col(c.core).disc(X0 - 0.5, Y0 - 3.2 - k * 2, r * 0.25);
    }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.48 + (H(sd + i, 25) - 0.5) * 0.3,
        d = 3 + eOut(k) * (6 + 4 * H(sd + i, 26));
      P.col(k < 0.45 ? HOT : c.mid).dot(X0 + Math.cos(a) * d, Y0 - 3 + Math.sin(a) * d - k * 2);
    }
  }
  // tongues licking up from the floor
  const T = 5;
  for (let i = 0; i < T; i++) {
    const off = (i - (T - 1) / 2) * 3.7 + (H(sd + i, 21) - 0.5) * 1.6;
    const tall = (14 + 9 * H(sd + i, 22)) * (1 - Math.abs(off) / 16);
    const a = 0.03 + Math.abs(i - 2) * 0.035,
      end = 0.62 + H(sd + i, 24) * 0.16;
    const env = eOut(seg(p, a, a + 0.16)) * (1 - eIn(seg(p, end - 0.28, end)));
    if (env <= 0.03) continue;
    const flick = 0.82 + 0.34 * H(f + i * 17, sd);
    tongue(P, X0 + off, FY, tall * env * flick, (2.3 + 1.1 * H(sd + i, 23)) * (0.55 + 0.45 * env), f * 1.25 + i * 2.1, c, HOT);
    // a lick that breaks off above the tip
    if (H(f * 5 + i, sd + 3) > 0.55)
      P.col(H(f, i) > 0.5 ? c.mid : c.edge).dot(X0 + off + Math.sin(f * 1.25 + i * 2.1 + 2.6) * 2.2, FY - tall * env * flick - 1.5 - H(f, i + 9) * 2, 1);
  }
  // embers: rise from the flames, sway, blink out
  for (let i = 0; i < 16; i++) {
    const tb = 0.08 + 0.62 * (i / 16) + H(sd + i, 31) * 0.04;
    const age = (p - tb) * ms,
      life = 260 + 300 * H(sd + i, 32);
    if (age < 0 || age > life) continue;
    const k = age / life;
    if (k > 0.62 && (f + i) % 2) continue;
    const ex = X0 + (H(sd + i, 33) - 0.5) * 17 + Math.sin(age * 0.011 + i) * 1.7;
    const ey = FY - 4 - H(sd + i, 34) * 7 - age * (0.02 + 0.017 * H(sd + i, 35));
    P.col(k < 0.25 ? HOT : k < 0.62 ? c.mid : c.edge).dot(ex, ey, 1);
  }
  // a thread of smoke as the fire dies
  for (let i = 0; i < 3; i++) {
    const k = seg(p, 0.55 + i * 0.07, 1);
    if (k <= 0 || k >= 1) continue;
    P.alpha(0.45 * bell(k)).col(X.smoke).disc(X0 + (i - 1) * 4 + Math.sin(k * 5 + i) * 1.2, FY - 5 - k * 11, 1.2 + k * 1.3);
  }
  P.alpha(1);
  ctx.restore();
}

export const FIRE_FX: SpellFxArt = { bolt: fireBolt, impact: fireImpact, ...FIRE };
