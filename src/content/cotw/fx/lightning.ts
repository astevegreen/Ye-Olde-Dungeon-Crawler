import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, H, TAU, bolt3, flight, forks, pen, seedAt, seed2, zig } from './pen';

/**
 * Lightning: never smooth. A leader jumps out in two steps, then the full forked stroke is
 * redrawn in three discrete shapes with dark frames between (the only effect that blinks).
 * Impact: a forked strike from above, ground forks redrawn three times, a crackle that jumps
 * around, then nothing.
 */
const LIGHTNING = { msBolt: 340, msImpact: 460 };

/** A stretch of the effect's life: from, to, shape, level, reach (bolt) or strike (impact). */
type Phase = [number, number, number, number, number];

function lightningBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.lightning,
    F = flight(x0, y0, x1, y1, cs);
  const sd = seed2(x0, y0, x1, y1, cs);
  // [from, to, shape, level, reach]
  const W: Phase[] = [
    [0, 0.07, 0, 1, 0.4],
    [0.07, 0.15, 0, 2, 0.78],
    [0.15, 0.34, 0, 2, 1],
    [0.44, 0.6, 1, 2, 1],
    [0.68, 0.8, 2, 0, 1],
  ];
  const w = W.find((r) => p >= r[0] && p < r[1]);
  if (!w) return;
  ctx.save();
  const s = sd + w[2] * 977,
    pts = zig(s, F.ax, F.ay, F.bx, F.by, 3.6, 2.6);
  const reach = w[4],
    cut = Math.max(2, Math.ceil(pts.length * reach));
  const main = pts.slice(0, cut);
  if (w[3] >= 2) {
    for (let i = 0; i < main.length; i += 2) P.glow(main[i][0], main[i][1], 9, c.mid, 0.16);
    P.glow(F.ax, F.ay, 8, c.core, 0.35);
    if (reach >= 1) P.glow(F.bx, F.by, 12, c.mid, 0.4);
  }
  bolt3(P, main, c, w[3]);
  if (reach >= 1) for (const fk of forks(s, pts, 3, Math.min(10, F.D * 0.25 + 3), 1.4)) bolt3(P, fk, c, w[3] >= 2 ? 1 : 0);
  ctx.restore();
}

function lightningImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.lightning,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3,
    FY = Y0 + 11;
  const ms = LIGHTNING.msImpact,
    tms = p * ms,
    sd = seedAt(x, y, cs);
  // [from, to, shape, level, strike]: the strike, a re-strike down a new path, a last dim flicker
  const W: Phase[] = [
    [0, 0.12, 0, 2, 2],
    [0.2, 0.33, 1, 2, 1],
    [0.42, 0.52, 2, 1, 0],
  ];
  const w = W.find((r) => p >= r[0] && p < r[1]);
  ctx.save();
  if (w) {
    const s = sd + w[2] * 577;
    if (w[4]) {
      // the strike from above (the first with its frame of white)
      const strike = zig(s + 3, X0 + (w[4] === 2 ? 4 : -5), Y0 - 34, X0, CY, 3.4, 2.4);
      if (w[4] === 2) P.glow(X0, CY, 22, c.core, 0.42).fglow(X0, FY, 16, 6, c.mid, 0.4);
      else P.glow(X0, CY, 15, c.mid, 0.3).fglow(X0, FY, 13, 5, c.mid, 0.3);
      bolt3(P, strike, c, 2);
      for (const fk of forks(s + 5, strike, 2, 6, 1.2)) bolt3(P, fk, c, 1);
    } else P.glow(X0, CY + 4, 14, c.mid, 0.3);
    // forks radiating over the floor and up the body
    const n = w[2] === 2 ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + H(s, k) * 0.9,
        L = (w[2] === 2 ? 8 : 11) + 6 * H(s, k + 20);
      const ex = X0 + Math.cos(a) * L,
        ey = CY + 6 + Math.sin(a) * L * 0.5;
      bolt3(P, zig(s + k * 13, X0, CY + 4, ex, ey, 2.6, 1.5), c, w[3] - (k % 2));
    }
  } else if (p > 0.56 && p < 0.84) {
    // crackle: tiny sparks that jump about, every other frame
    const f = Math.floor(tms / 34);
    if (f % 2 === 0) {
      for (let k = 0; k < 2; k++) {
        const a = H(f, sd + k) * TAU,
          r = 3 + 6 * H(f + 3, sd + k),
          sx = X0 + Math.cos(a) * r,
          sy = CY + 2 + Math.sin(a) * r * 0.8;
        bolt3(P, zig(sd + f * 7 + k, sx, sy, sx + (H(f, k + 40) - 0.5) * 7, sy + (H(f, k + 41) - 0.5) * 5, 2, 1.2), c, 1);
      }
    }
  }
  ctx.restore();
}

export const LIGHTNING_FX: SpellFxArt = { bolt: lightningBolt, impact: lightningImpact, ...LIGHTNING };
