import type { FxSurface, SpellFxArt } from '../../../engine';
import { clamp } from '../sprites/sculpt/kit';
import { FALL, H, X, eIn, eOut, flight, lerp, pen, seedAt, seed2, seg, type Pen, type Pt, type Tones } from './pen';

/**
 * Poison: a wobbling bile glob LOBBED in an arc, drips falling from it. Impact: it splats into
 * a puddle, droplets fly and fall, bubbles rise and pop, drips fall from the target into the
 * pool.
 */
const POISON = { msBolt: 540, msImpact: 900 };

/** The bile glob: a wobbling ellipse of cells, lit top-left, darker underneath. */
function glob(P: Pen, x: number, y: number, r: number, wob: number, c: Tones): void {
  const rx = r * (1 + 0.2 * wob),
    ry = r * (1 - 0.2 * wob),
    R = Math.ceil(Math.max(rx, ry)) + 1;
  for (let gy = Math.floor(y - R); gy <= Math.ceil(y + R); gy++) {
    for (let gx = Math.floor(x - R); gx <= Math.ceil(x + R); gx++) {
      const nx = (gx + 0.5 - x) / rx,
        ny = (gy + 0.5 - y) / ry,
        d = Math.hypot(nx, ny);
      if (d > 1) continue;
      let col: string;
      if (d > 0.7) col = c.edge;
      else if (nx < -0.05 && ny < -0.05 && d > 0.25 && d < 0.62) col = c.core;
      else if (ny > 0.3) col = X.bile;
      else col = c.mid;
      P.col(col).cell(gx, gy);
    }
  }
  P.col('#ffffff').dot(x - rx * 0.38, y - ry * 0.45);
}

function bubble(P: Pen, x: number, y: number, r: number, popK: number, c: Tones): void {
  if (popK > 0) {
    // the pop: a ring of four flecks, then gone
    const s = r + 1 + popK * 1.5;
    P.col(c.core);
    P.dot(x - s, y);
    P.dot(x + s, y);
    P.dot(x, y - s);
    P.dot(x, y + s * 0.7);
    return;
  }
  if (r < 1.2) {
    P.col(c.mid).dot(x, y);
    return;
  }
  P.col(c.mid).ring(x, y, r, r);
  P.col(c.core).dot(x - r * 0.4, y - r * 0.5);
}

function poisonBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.poison,
    F = flight(x0, y0, x1, y1, cs);
  const ms = POISON.msBolt,
    tms = p * ms,
    sd = seed2(x0, y0, x1, y1, cs);
  const arc = clamp(F.D * 0.22, 5, 20);
  const at = (t: number): Pt => [F.ax + F.dx * t, F.ay + F.dy * t - Math.sin(Math.PI * t) * arc];
  const [hx, hy] = at(p);
  ctx.save();
  // drips detach from the glob and fall, stretching as they speed up
  const N = Math.ceil(F.D / 4.5);
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.6) / N;
    if (tb > p) break;
    const age = (p - tb) * ms;
    if (age > 300) continue;
    const [bx, by] = at(tb),
      fall = 0.00012 * age * age;
    const dx = bx + (H(sd + i, 61) - 0.5) * 2,
      dy = by + 3 + fall;
    P.col(c.mid).dot(dx, dy);
    if (age > 90) P.col(c.edge).dot(dx, dy - 1);
    if (age > 180) P.col(c.edge).dot(dx, dy - 2);
  }
  // a faint trail of spatter right behind
  for (let s = 1; s <= 3; s++) {
    const t = p - s * 0.035;
    if (t <= 0) break;
    const [tx, ty] = at(t);
    P.col(s === 1 ? c.mid : c.edge).dot(tx, ty, s === 1 ? 2 : 1);
  }
  P.glow(hx, hy, 7, c.mid, 0.18);
  const wob = Math.sin(Math.floor(tms / 45) * 1.3);
  glob(P, hx, hy, 3.8, wob, c);
  ctx.restore();
}

function poisonImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.poison,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3,
    FY = Y0 + 11.5;
  const sd = seedAt(x, y, cs);
  ctx.save();
  // the puddle spreads, sits, shrinks
  const pr = eOut(seg(p, 0.06, 0.2)) * (1 - eIn(seg(p, 0.72, 1)));
  if (pr > 0.05) {
    const rx = 10 * pr,
      ry = 3.4 * pr;
    P.col(X.bileDark).ell(X0, FY, rx + 1, ry + 1);
    P.col(c.edge).ell(X0, FY, rx, ry);
    P.col(X.bile).ell(X0 - 0.5, FY - 0.4, rx * 0.8, ry * 0.65);
    P.col(c.mid).ell(X0 - 1.5, FY - 0.8, rx * 0.45, ry * 0.35);
    P.col(c.core).dot(X0 - rx * 0.4, FY - ry * 0.5);
    P.fglow(X0, FY, 12, 4, c.mid, 0.16 * pr);
  }
  // the splat on the target
  if (p < 0.2) {
    const k = p / 0.2;
    glob(P, X0, CY + k * 2, 3.2 + k * 1.5, 0.8 + k, c);
    P.alpha(1);
  }
  // droplets flung out: up and over, then down onto the floor
  for (let i = 0; i < 8; i++) {
    const k = seg(p, 0.03, 0.3 + H(sd + i, 71) * 0.1);
    if (k <= 0 || k >= 1) continue;
    const a = Math.PI + (i / 7) * Math.PI + (H(sd + i, 72) - 0.5) * 0.3,
      sp = 7 + 6 * H(sd + i, 73);
    const dx = X0 + Math.cos(a) * sp * k,
      dy = CY + Math.sin(a) * sp * 0.8 * k + 26 * k * k;
    P.col(k < 0.5 ? c.core : c.mid).dot(dx, Math.min(dy, FY));
  }
  // bubbles rise from the pool and pop
  for (let i = 0; i < 9; i++) {
    const tb = 0.16 + i * 0.065,
      life = 0.2 + 0.08 * H(sd + i, 74),
      k = seg(p, tb, tb + life);
    if (k <= 0 || k >= 1) continue;
    const bx = X0 + (H(sd + i, 75) - 0.5) * 14,
      by = FY - 1 - eOut(k) * (5 + 9 * H(sd + i, 76));
    const wob = Math.sin(k * 9 + i) * 1.2,
      pop = seg(k, 0.84, 1);
    bubble(P, bx + wob, by, 0.9 + k * (1.8 + 1.2 * H(sd + i, 77)), pop, c);
  }
  // drips fall from the target into the pool
  for (let i = 0; i < 5; i++) {
    const tb = 0.18 + i * 0.12,
      k = seg(p, tb, tb + 0.16);
    if (k <= 0 || k >= 1) continue;
    const dx = X0 + (H(sd + i, 78) - 0.5) * 8,
      sy = CY + (H(sd + i, 79) - 0.5) * 6;
    const dy = lerp(sy, FY - 1, eIn(k));
    P.col(c.mid).dot(dx, dy);
    P.col(c.edge).dot(dx, dy - 1);
    if (k > 0.5) P.col(c.edge).dot(dx, dy - 2);
  }
  ctx.restore();
}

export const POISON_FX: SpellFxArt = { bolt: poisonBolt, impact: poisonImpact, ...POISON };
