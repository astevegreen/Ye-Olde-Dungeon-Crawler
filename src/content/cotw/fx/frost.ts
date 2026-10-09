import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, H, X, eIn, eOut, flight, lerp, pen, seedAt, seed2, seg, twinkle, type Pen, type Tones } from './pen';

/**
 * Frost: a shard pointing at its target, its facets turning in 8 stepped frames; mist left
 * behind SINKS. Impact: a six-point star snaps out, its tips crack off and fly, mist sinks and
 * settles on the floor, rime glitters on the tile and fades.
 */
const FROST = { msBolt: 460, msImpact: 820 };

/** A faceted diamond pointing along (ux, uy): long ahead (Lf), short behind (Lb), W wide. */
function shard(P: Pen, hx: number, hy: number, ux: number, uy: number, Lf: number, Lb: number, W: number, side: number, c: Tones): void {
  const R = Math.ceil(Math.max(Lf, Lb, W)) + 1;
  for (let gy = Math.floor(hy - R); gy <= Math.ceil(hy + R); gy++) {
    for (let gx = Math.floor(hx - R); gx <= Math.ceil(hx + R); gx++) {
      const px = gx + 0.5 - hx,
        py = gy + 0.5 - hy,
        lx = px * ux + py * uy,
        ly = -px * uy + py * ux;
      const d = Math.abs(lx) / (lx >= 0 ? Lf : Lb) + Math.abs(ly) / W;
      if (d > 1) continue;
      let col: string;
      if (d > 0.74) col = c.edge;
      else if (ly * side < 0) col = lx > 0 && Math.abs(ly) < 0.9 ? c.core : X.mist;
      else col = c.mid;
      P.col(col).cell(gx, gy);
    }
  }
}

function frostBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.frost,
    F = flight(x0, y0, x1, y1, cs);
  const ms = FROST.msBolt,
    tms = p * ms,
    sd = seed2(x0, y0, x1, y1, cs);
  const hx = F.ax + F.dx * p,
    hy = F.ay + F.dy * p;
  ctx.save();
  // mist left behind: drops away under the path, spreads, thins
  const N = Math.ceil(F.D / 4);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.5) / N;
    if (tb > p) break;
    const age = (p - tb) * ms,
      life = 190 + 120 * H(sd + i, 41);
    if (age >= life) continue;
    const k = age / life;
    const mx = F.ax + F.dx * tb + (H(sd + i, 42) - 0.5) * 2;
    const my = F.ay + F.dy * tb + (H(sd + i, 43) - 0.5) * 1.5 + 1 + k * 6;
    P.alpha(0.42 * (1 - k)).col(c.mid).ell(mx, my, 1.2 + k * 2.2, 0.7 + k * 0.4);
  }
  ctx.globalCompositeOperation = 'source-over';
  P.alpha(1);
  // glints where it passed
  const NG = Math.max(2, Math.ceil(F.D / 7));
  for (let i = 0; i < NG; i++) {
    const tb = (i + 0.3) / NG;
    if (tb > p) break;
    const age = (p - tb) * ms;
    if (age > 170) continue;
    const gx = F.ax + F.dx * tb + (H(sd + i, 44) - 0.5) * 5,
      gy = F.ay + F.dy * tb + (H(sd + i, 45) - 0.5) * 5;
    if (age < 80) twinkle(P, gx, gy, 1, c.core, c.mid);
    else P.col(c.mid).dot(gx, gy);
  }
  // the shard itself
  P.glow(hx, hy, 8, c.mid, 0.3);
  const spin = Math.floor(tms / 55) % 8,
    w = Math.abs(Math.cos((spin * Math.PI) / 4));
  shard(P, hx, hy, F.ux, F.uy, 7, 4, 1.2 + 1.7 * w, spin < 4 ? 1 : -1, c);
  ctx.restore();
}

function frostImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.frost,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3,
    FY = Y0 + 12;
  const ms = FROST.msImpact,
    tms = p * ms,
    f = Math.floor(tms / 60),
    sd = seedAt(x, y, cs);
  ctx.save();
  // rime: glitter spreads over the floor, then fades
  const rimeR = eOut(seg(p, 0.22, 0.45)),
    rimeA = 1 - seg(p, 0.7, 1);
  if (rimeR > 0 && rimeA > 0) {
    const rx = 13,
      ry = 5;
    for (let gy = Math.floor(FY - 1 - ry); gy <= Math.ceil(FY - 1 + ry); gy++) {
      for (let gx = Math.floor(X0 - rx); gx <= Math.ceil(X0 + rx); gx++) {
        const d = Math.hypot((gx + 0.5 - X0) / rx, (gy + 0.5 - (FY - 1)) / ry);
        if (d > rimeR) continue;
        const hv = H(gx * 3 + sd, gy * 5 + 1);
        if (hv > 0.3 * (1 - d * 0.6)) continue;
        P.alpha(rimeA * (hv < 0.05 ? 1 : 0.7))
          .col(hv < 0.05 ? c.core : hv < 0.14 ? c.mid : X.rimeDeep)
          .cell(gx, gy);
      }
    }
    P.alpha(rimeA);
    for (let i = 0; i < 3; i++) {
      const rx2 = X0 + (H(sd + i, 51) - 0.5) * 18,
        ry2 = FY - 1 + (H(sd + i, 52) - 0.5) * 6;
      if (Math.hypot((rx2 - X0) / 13, (ry2 - FY + 1) / 5) < rimeR && (f + i) % 5) twinkle(P, rx2, ry2, 1, c.core, c.mid);
    }
    P.alpha(1);
  }
  // mist sinks and settles into a flat bank
  for (let i = 0; i < 10; i++) {
    const tb = 0.16 + i * 0.035,
      k = seg(p, tb, tb + 0.5);
    if (k <= 0) continue;
    const fade = 1 - seg(p, 0.72 + H(sd + i, 53) * 0.1, 1);
    if (fade <= 0) continue;
    const sx = (H(sd + i, 54) - 0.5) * 12,
      sy = CY + (H(sd + i, 55) - 0.5) * 8;
    const mx = X0 + sx * (1 + eOut(k) * 0.8),
      my = lerp(sy, FY - 1.5, eOut(k));
    P.alpha(0.3 * fade * Math.min(1, k * 4)).col(X.mist).ell(mx, my, 2 + k * 2.2, 1.6 * (1 - k * 0.55) + 0.4);
  }
  P.alpha(1);
  P.glow(X0, CY, 12, c.mid, 0.34 * (1 - seg(p, 0.05, 0.5)));
  // the six-point star snaps out (0-.28) then its spokes fade
  const grow = eOut(seg(p, 0, 0.2)),
    starA = 1 - seg(p, 0.32, 0.44);
  if (starA > 0) {
    P.alpha(starA);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3,
        ca = Math.cos(a),
        sa = Math.sin(a),
        L = 2 + 8 * grow;
      P.col(c.mid).line(X0, CY, X0 + ca * L, CY + sa * L, 1);
      if (L > 5) {
        const bx = X0 + ca * L * 0.55,
          by = CY + sa * L * 0.55;
        for (const s of [-1, 1]) {
          const b = a + s * 1.0;
          P.col(c.mid).line(bx, by, bx + Math.cos(b) * 2.2, by + Math.sin(b) * 2.2, 1);
        }
      }
      if (p < 0.3) shard(P, X0 + ca * L, CY + sa * L, ca, sa, 2.4, 1.4, 1.35, 1, c);
    }
    P.col(c.core).disc(X0, CY, 1.6);
    P.alpha(1);
  }
  // tips crack off and fly outward, tumbling in stepped frames
  const fly = seg(p, 0.28, 0.66);
  if (fly > 0 && fly < 1) {
    P.alpha(1 - seg(fly, 0.65, 1));
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3 + (H(sd + k, 56) - 0.5) * 0.3,
        dist = 10 + eOut(fly) * 11;
      const tum = a + Math.floor(fly * 6 + k) * (Math.PI / 4);
      shard(P, X0 + Math.cos(a) * dist, CY + Math.sin(a) * dist + eIn(fly) * 3, Math.cos(tum), Math.sin(tum), 2.3 - fly, 1.2, 1.2, 1, c);
      // a chip between each pair of tips
      const b = a + Math.PI / 6,
        d2 = 6 + eOut(fly) * 14;
      P.col(fly < 0.5 ? c.core : c.mid).dot(X0 + Math.cos(b) * d2, CY + Math.sin(b) * d2 + eIn(fly) * 4);
    }
    P.alpha(1);
  }
  if (p < 0.07) P.col(c.core).disc(X0, CY, 3.2 * (1 - p / 0.07) + 1);
  ctx.restore();
}

export const FROST_FX: SpellFxArt = { bolt: frostBolt, impact: frostImpact, ...FROST };
