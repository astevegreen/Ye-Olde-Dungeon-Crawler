import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, H, TAU, bell, eOut, flight, lerp, pen, seedAt, seed2, seg, twinkle, type Pen, type Tones } from './pen';

/**
 * Holy (healing and blessing too): a four-point sparkle trailing a straight ray and slow motes
 * that RISE and fade (never wink). Impact: shafts of light fall from above, slanting with the
 * key light, pool on the floor; motes rise from the pool. Self: the same rays, and a halo ring
 * rising from the feet to the head.
 */
const HOLY = { msBolt: 420, msImpact: 880, msSelf: 1000 };

function holyBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.holy,
    F = flight(x0, y0, x1, y1, cs);
  const ms = HOLY.msBolt,
    tms = p * ms,
    sd = seed2(x0, y0, x1, y1, cs);
  const hx = F.ax + F.dx * p,
    hy = F.ay + F.dy * p;
  ctx.save();
  // motes: shed rarely, rise slowly, fade smoothly
  const N = Math.ceil(F.D / 4);
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.5) / N;
    if (tb > p) break;
    const age = (p - tb) * ms,
      life = 420;
    if (age >= life) continue;
    const k = age / life;
    const mx = F.ax + F.dx * tb + (H(sd + i, 81) - 0.5) * 3,
      my = F.ay + F.dy * tb + (H(sd + i, 82) - 0.5) * 3 - age * 0.012;
    P.glow(mx, my, 3, c.edge, 0.35 * (1 - k));
    P.alpha(1 - k).col(k < 0.3 ? c.mid : c.edge).dot(mx, my);
  }
  // a straight ray behind the head
  const L = Math.min(12, p * F.D);
  for (let s = 1; s <= L; s++) P.alpha(0.9 * (1 - s / (L + 1))).col(s < 3 ? c.core : s < 7 ? c.mid : c.edge).dot(hx - F.ux * s, hy - F.uy * s);
  P.alpha(1);
  P.glow(hx, hy, 9, c.mid, 0.4).glow(hx, hy, 3.5, c.core, 0.45);
  const arm = 2 + [0, 1, 2, 1][Math.floor(tms / 50) % 4];
  twinkle(P, hx, hy, arm, c.core, c.mid);
  P.col(c.core);
  P.dot(hx - 1, hy);
  P.dot(hx + 1, hy);
  P.dot(hx, hy - 1);
  P.dot(hx, hy + 1);
  ctx.restore();
}

/** Shafts fall from above (leading end descends), slanting down-right with the key light. */
function shafts(P: Pen, X0: number, topY: number, FY: number, p: number, c: Tones, n: number, spread: number, t0: number, w: number): void {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spread,
      a = t0 + Math.abs(i - (n - 1) / 2) * 0.05;
    const down = eOut(seg(p, a, a + 0.2)),
      fade = 1 - seg(p, 0.45 + i * 0.03, 0.88);
    if (down <= 0 || fade <= 0) continue;
    const bot = lerp(topY, FY, down),
      wide = n < 3 || i === (n - 1) / 2 ? w : w - 1;
    for (let yy = topY; yy <= bot; yy++) {
      const k = (yy - topY) / (FY - topY),
        xx = X0 + off - (FY - yy) * 0.2;
      const lead = bot - yy < 2.5 ? 1 : 0,
        a2 = fade * (0.18 + 0.7 * k);
      P.alpha(a2 * 0.5).col(c.edge).span(xx - wide, xx + wide + 1, yy);
      P.alpha(Math.min(1, a2 + lead * 0.5))
        .col(lead ? c.core : c.mid)
        .span(xx - (wide > 1 ? 1 : 0), xx + 1 + (wide > 1 ? 1 : 0), yy);
      if (wide > 1) P.alpha(a2).col(c.core).span(xx, xx + 1, yy);
    }
  }
  P.alpha(1);
}

/** Motes rising from the pool, fading, now and then catching a glint. */
function holyMotes(P: Pen, X0: number, FY: number, p: number, c: Tones, sd: number, n: number, t0: number, t1: number, spread: number): void {
  for (let i = 0; i < n; i++) {
    const tb = t0 + (t1 - t0) * (i / n),
      k = seg(p, tb, tb + 0.34);
    if (k <= 0 || k >= 1) continue;
    const mx = X0 + (H(sd + i, 83) - 0.5) * spread + Math.sin(k * 4 + i) * 0.8,
      my = FY - 1 - k * (10 + 8 * H(sd + i, 84));
    P.glow(mx, my, 3, c.mid, 0.3 * bell(k));
    P.alpha(bell(k * 0.8 + 0.2)).col(k < 0.3 ? c.core : k < 0.6 ? c.mid : c.edge).dot(mx, my);
    if (H(sd + i, 85) > 0.7 && k > 0.3 && k < 0.45) twinkle(P, mx, my, 1, c.core, c.mid);
  }
  P.alpha(1);
}

function holyImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.holy,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3,
    FY = Y0 + 11.5,
    sd = seedAt(x, y, cs);
  ctx.save();
  const pool = seg(p, 0.12, 0.26) * (1 - seg(p, 0.55, 0.95));
  P.fglow(X0, FY, 15, 5.5, c.mid, 0.45 * pool).glow(X0, CY, 14, c.mid, 0.22 * pool);
  shafts(P, X0, Y0 - 34, FY, p, c, 3, 5.5, 0.0, 2);
  // the pool's rim spreads
  const rk = seg(p, 0.16, 0.6);
  if (rk > 0 && rk < 1) P.alpha(1 - rk).col(c.edge).ring(X0, FY, 4 + rk * 9, (4 + rk * 9) * 0.36, 0, TAU, 2);
  P.alpha(1);
  holyMotes(P, X0, FY, p, c, sd, 12, 0.2, 0.68, 16);
  const gk = seg(p, 0.16, 0.4);
  if (gk > 0 && gk < 1) twinkle(P, X0 + 1, CY, Math.round(1 + 4 * bell(gk)), c.core, c.mid);
  ctx.restore();
}

function holySelf(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.holy,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    FY = Y0 + 11.5,
    sd = seedAt(x, y, cs) + 7;
  ctx.save();
  const pool = seg(p, 0.08, 0.22) * (1 - seg(p, 0.6, 1));
  P.fglow(X0, FY, 14, 5, c.mid, 0.4 * pool).glow(X0, Y0 - 3, 13, c.mid, 0.2 * pool);
  shafts(P, X0, Y0 - 30, FY, p, c, 2, 7, 0.0, 2);
  // a halo ring rises from the feet to the crown
  const hk = seg(p, 0.15, 0.75);
  if (hk > 0 && hk < 1) {
    const ry = FY - 1 - eOut(hk) * 21,
      R = 8 - hk * 3;
    P.alpha(bell(hk)).col(c.edge).ring(X0, ry, R, R * 0.33, Math.PI, TAU);
    P.col(c.core).ring(X0, ry, R, R * 0.33, 0, Math.PI);
  }
  P.alpha(1);
  holyMotes(P, X0, FY, p, c, sd, 10, 0.12, 0.7, 14);
  ctx.restore();
}

export const HOLY_FX: SpellFxArt = { bolt: holyBolt, impact: holyImpact, self: holySelf, ...HOLY };
