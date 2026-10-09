import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, H, TAU, X, bell, eIn, eOut, flight, pen, seedAt, seed2, seg, twinkle, type Pen, type Tones } from './pen';

/**
 * Shadow (unholy, drain): the only effect darker than what it touches. A dark core with a
 * violet rim; motes spiral INTO it; its trail of dark puffs shrinks toward its centre. Impact:
 * darkness swells, a violet ring collapses inward, motes spiral in, the core implodes to a
 * point.
 */
const SHADOW = { msBolt: 500, msImpact: 800 };

/** A dark hole whose violet rim is two arcs swirling into it (a whirlpool, not a ring). */
function voidCore(P: Pen, x: number, y: number, r: number, c: Tones, rimLit: boolean, spin = 0): void {
  P.col(X.voidDeep).disc(x, y, r + 0.9);
  P.col(c.core).disc(x, y, Math.max(0.6, r - 0.6));
  if (r < 2.2) {
    P.col(c.mid).ring(x, y, r, r);
    return;
  }
  const a = (spin * TAU) / 12,
    arc = Math.PI * 0.8;
  for (let h = 0; h < 2; h++) {
    const s = a + h * Math.PI,
      e = s + arc;
    P.col(c.mid).ring(x, y, r, r, s, e);
    P.alpha(0.45).ring(x, y, r, r, e, s + Math.PI).alpha(1);
    // the arc's head curls inward
    P.col(rimLit ? c.edge : c.mid).dot(x + Math.cos(e + 0.35) * (r - 1.2), y + Math.sin(e + 0.35) * (r - 1.2));
  }
}

/** A mote spiralling inward over k = 0..1, with a three-step trail. */
function inSpiral(P: Pen, x: number, y: number, R: number, k: number, a0: number, turns: number, colA: string, colB: string): void {
  for (let s = 3; s >= 0; s--) {
    const kk = k - s * 0.045;
    if (kk < 0) continue;
    const r = R * Math.pow(1 - kk, 1.15),
      a = a0 + kk * turns * TAU,
      mx = x + Math.cos(a) * r,
      my = y + Math.sin(a) * r * 0.85;
    P.alpha(s ? 0.75 - s * 0.18 : 1).col(s ? colB : colA).dot(mx, my);
  }
  P.alpha(1);
}

function shadowBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.unholy,
    F = flight(x0, y0, x1, y1, cs);
  const ms = SHADOW.msBolt,
    tms = p * ms,
    sd = seed2(x0, y0, x1, y1, cs);
  const hx = F.ax + F.dx * p,
    hy = F.ay + F.dy * p;
  ctx.save();
  P.shade(hx, hy, 12, 12, X.voidDeep, 0.62);
  // puffs of dark left behind, shrinking to nothing (they pull in, never spread)
  const N = Math.ceil(F.D / 3.4);
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.5) / N;
    if (tb > p) break;
    const age = (p - tb) * ms,
      life = 280 + 120 * H(sd + i, 91);
    if (age >= life) continue;
    const k = age / life,
      px = F.ax + F.dx * tb + (H(sd + i, 92) - 0.5) * 2,
      py = F.ay + F.dy * tb + (H(sd + i, 93) - 0.5) * 2;
    P.alpha(0.7 * (1 - k * 0.6)).col(X.voidDeep).disc(px, py, 3 * (1 - k) + 0.5);
    if (k < 0.6) P.alpha(1 - k).col(c.mid).ring(px, py, 3 * (1 - k) + 0.5, 3 * (1 - k) + 0.5, -2.4, -0.7);
  }
  P.alpha(1);
  // motes spiral in from all round
  for (let k = 0; k < 6; k++) {
    const ph = (tms / 280 + k / 6) % 1;
    inSpiral(P, hx, hy, 9, ph, k * 1.1, 0.75, c.edge, c.mid);
  }
  voidCore(P, hx, hy, 3.3 + 0.5 * Math.sin(Math.floor(tms / 60) * 1.7), c, true, Math.floor(tms / 60));
  P.alpha(1);
  ctx.restore();
}

function shadowImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.unholy,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3;
  const ms = SHADOW.msImpact,
    tms = p * ms,
    sd = seedAt(x, y, cs);
  ctx.save();
  // darkness swells over the target, then is swallowed with the core
  const dark = eOut(seg(p, 0, 0.14)) * (1 - eIn(seg(p, 0.55, 0.9)));
  P.shade(X0, CY + 2, 17 * (0.6 + 0.4 * dark), 15 * (0.6 + 0.4 * dark), X.voidDeep, 0.8 * dark);
  // a violet ring collapses inward (the reverse of a shockwave)
  const rk = seg(p, 0.05, 0.42);
  if (rk > 0 && rk < 1) {
    const R = 15 * (1 - eIn(rk)) + 2.5;
    P.alpha(0.5 + 0.5 * rk).col(c.mid).ring(X0, CY, R, R * 0.85);
    if (rk > 0.3) P.alpha(rk).col(c.edge).ring(X0, CY, R + 1.5, (R + 1.5) * 0.85, 0, TAU, 3);
  }
  P.alpha(1);
  // motes spiral in from the edge of the tile
  for (let i = 0; i < 12; i++) {
    const tb = 0.04 + i * 0.045,
      k = seg(p, tb, tb + 0.3);
    if (k <= 0 || k >= 1) continue;
    inSpiral(P, X0, CY, 14 + 3 * H(sd + i, 94), eIn(k), H(sd + i, 95) * TAU, 0.9, c.edge, c.mid);
  }
  // the core: grows, holds, implodes to a point
  const cr = eOut(seg(p, 0.05, 0.2)) * (1 - eIn(seg(p, 0.6, 0.86))) * 5;
  if (cr > 0.4) voidCore(P, X0, CY, cr, c, true, Math.floor(tms / 60) + Math.floor(p * 12));
  const pop = seg(p, 0.85, 0.95);
  if (pop > 0 && pop < 1) {
    P.col(c.edge).dot(X0, CY);
    if (pop < 0.5) twinkle(P, X0, CY, 2, c.edge, c.mid);
  }
  ctx.restore();
}

/** Drain: violet motes stream FROM the target back to the caster along a dark tether. */
function drainBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.unholy,
    F = flight(x0, y0, x1, y1, cs);
  const ms = SHADOW.msBolt,
    tms = p * ms;
  ctx.save();
  // the tether: a dark rope with a violet thread, reaching out then drawn back in
  const reach = Math.min(1, p * 4),
    letGo = seg(p, 0.8, 1);
  const n = Math.ceil(F.D / 1.5),
    wv = (t: number): number => Math.sin(t * 11 - tms / 35) * 1.6 * Math.sin(Math.PI * t);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t > reach || t < letGo) continue;
    const w = wv(t),
      px = F.ax + F.dx * t - F.uy * w,
      py = F.ay + F.dy * t + F.ux * w;
    P.alpha(0.7).col(X.voidDeep).disc(px, py, 1.5);
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t > reach || t < letGo || i % 2) continue;
    const w = wv(t);
    P.alpha(0.8).col(c.mid).dot(F.ax + F.dx * t - F.uy * w, F.ay + F.dy * t + F.ux * w);
  }
  // stolen motes stream from the target to the caster
  for (let k = 0; k < 6; k++) {
    const t = 1 - ((tms / 420 + k / 6) % 1);
    if (t > reach || t < letGo || p < 0.18) continue;
    const w = wv(t),
      mx = F.ax + F.dx * t - F.uy * w,
      my = F.ay + F.dy * t + F.ux * w;
    P.alpha(1).col(c.mid).dot(mx, my, 2);
    P.col(c.edge).dot(mx, my);
  }
  P.alpha(1);
  voidCore(P, F.ax, F.ay, 2.4 + bell(p) * 1.6, c, true, Math.floor(tms / 60));
  ctx.restore();
}

export const SHADOW_FX: SpellFxArt = { bolt: shadowBolt, impact: shadowImpact, ...SHADOW };
/** Drain draws its own tether in flight and lands as shadow does. */
export const DRAIN_FX: SpellFxArt = { bolt: drainBolt, impact: shadowImpact, ...SHADOW };
