import type { FxSurface, SpellFxArt } from '../../../engine';
import { FALL, TAU, eOut, eOut3, flight, pen, rune, sat, seg, twinkle, type Pen, type Tones } from './pen';

/**
 * Arcane: a bright rune-star with three points orbiting it, leaving a helix of dots. Impact: a
 * rune circle snaps open around the target and turns, an inner ring counter-turns, three
 * points race round it. Self: a rune circle turns on the floor while points spiral up the
 * caster.
 */
const ARCANE = { msBolt: 460, msImpact: 820, msSelf: 1000 };

function star4(P: Pen, x: number, y: number, c: Tones, big: boolean): void {
  P.col(c.mid);
  P.dot(x - 1, y);
  P.dot(x + 1, y);
  P.dot(x, y - 1);
  P.dot(x, y + 1);
  if (big) {
    P.col(c.edge);
    P.dot(x - 2, y);
    P.dot(x + 2, y);
    P.dot(x, y - 2);
    P.dot(x, y + 2);
  }
  P.col(c.core).dot(x, y);
}

function arcaneBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.arcane,
    F = flight(x0, y0, x1, y1, cs);
  const ms = ARCANE.msBolt,
    tms = p * ms;
  const hx = F.ax + F.dx * p,
    hy = F.ay + F.dy * p;
  ctx.save();
  P.glow(hx, hy, 10, c.mid, 0.42).glow(hx, hy, 4, c.core, 0.3);
  // orbit points: each trails the positions it held over the last frames (a helix behind)
  for (let s = 9; s >= 0; s--) {
    const tt = tms - s * 14;
    if (tt < 0) continue;
    const pp = tt / ms,
      cx = F.ax + F.dx * pp,
      cy = F.ay + F.dy * pp;
    for (let k = 0; k < 3; k++) {
      const a = (tt / 220) * TAU + (k * TAU) / 3,
        r = 5 * Math.min(1, tt / 60);
      const ox = Math.cos(a) * r,
        oy = Math.sin(a) * r * 0.85;
      if (s === 0) {
        P.alpha(1);
        P.glow(cx + ox, cy + oy, 2.5, c.mid, 0.5);
        twinkle(P, cx + ox, cy + oy, 1, c.core, c.mid);
      } else P.alpha(0.95 - s * 0.08).col(s < 4 ? c.mid : c.edge).dot(cx + ox, cy + oy);
    }
  }
  P.alpha(1);
  star4(P, hx, hy, c, Math.floor(tms / 60) % 2 === 0);
  ctx.restore();
}

/** A ring of rune marks (sq < 1 lays it on the floor); `back` = only the far (true) or near (false) half. */
function runeCircle(P: Pen, x: number, y: number, R: number, sq: number, turn: number, n: number, c: Tones, a: number, back?: boolean): void {
  P.alpha(a * 0.85).col(c.mid);
  if (back === undefined) P.ring(x, y, R, R * sq);
  else P.ring(x, y, R, R * sq, back ? Math.PI : 0, back ? TAU : Math.PI);
  for (let i = 0; i < n; i++) {
    const an = turn + (i * TAU) / n,
      sn = Math.sin(an);
    if (back !== undefined && (sn < 0) !== back) continue;
    const gx = x + Math.cos(an) * R,
      gy = y + sn * R * sq;
    P.alpha(a).col(back ? c.edge : c.core);
    rune(P, gx, gy, i * 3 + 1);
  }
  P.alpha(1);
}

function arcaneImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.arcane,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 2;
  const ms = ARCANE.msImpact,
    tms = p * ms;
  ctx.save();
  const open = eOut3(seg(p, 0, 0.2)),
    fade = 1 - seg(p, 0.7, 1),
    R = 4 + 8 * open * (1 - 0.15 * seg(p, 0.7, 1));
  P.glow(X0, CY, 15, c.mid, 0.28 * fade + 0.3 * (1 - seg(p, 0, 0.15)));
  // turning in stepped increments (48 per turn), like a sprite rotating
  const turn = (Math.floor(tms / 40) * TAU) / 48;
  if (fade > 0) {
    runeCircle(P, X0, CY, R, 1, turn, 6, c, fade);
    P.alpha(fade * 0.9).col(c.edge);
    for (let i = 0; i < 8; i++) {
      const a = -turn * 1.6 + (i * TAU) / 8;
      P.dot(X0 + Math.cos(a) * R * 0.5, CY + Math.sin(a) * R * 0.5);
    }
    // three points race round the ring
    for (let k = 0; k < 3; k++) {
      for (let s = 3; s >= 0; s--) {
        const a = ((tms - s * 18) / 260) * TAU + (k * TAU) / 3;
        P.alpha(fade * (1 - s * 0.22)).col(s ? c.mid : c.core).dot(X0 + Math.cos(a) * (R + 2), CY + Math.sin(a) * (R + 2));
      }
    }
    P.alpha(1);
  }
  if (p < 0.12) star4(P, X0, CY, c, true);
  // as it closes, the points fly off
  const out = seg(p, 0.72, 1);
  if (out > 0 && out < 1)
    for (let k = 0; k < 6; k++) {
      const a = turn + (k * TAU) / 6,
        r = R + 2 + eOut(out) * 8;
      P.alpha(1 - out).col(c.mid).dot(X0 + Math.cos(a) * r, CY + Math.sin(a) * r);
    }
  P.alpha(1);
  ctx.restore();
}

/** A point climbing the caster: x, y, trail step, in front of the body, climb 0-1. */
type Climber = [number, number, number, boolean, number];

function arcaneSelf(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    c = FALL.arcane,
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    FY = Y0 + 11;
  const ms = ARCANE.msSelf,
    tms = p * ms;
  ctx.save();
  const open = eOut3(seg(p, 0, 0.2)),
    fade = 1 - seg(p, 0.72, 1),
    R = 4 + 9 * open;
  const turn = (Math.floor(tms / 40) * TAU) / 48;
  P.fglow(X0, FY, 15, 5.5, c.mid, 0.3 * fade);
  if (fade > 0) runeCircle(P, X0, FY, R, 0.36, turn, 6, c, fade, true);
  // points spiral up the caster: front half drawn after the circle's back
  const pts: Climber[] = [];
  for (let k = 0; k < 3; k++) {
    for (let s = 4; s >= 0; s--) {
      const tt = tms - s * 22 - k * 110;
      if (tt < 0) continue;
      const kk = sat(tt / (ms * 0.75)),
        a = (tt / 300) * TAU + k * 2.1;
      pts.push([X0 + Math.cos(a) * 8 * (1 - kk * 0.4), FY - 2 - kk * 22 + Math.sin(a) * 2.6, s, Math.sin(a) >= 0, kk]);
    }
  }
  for (const q of pts) if (!q[3]) P.alpha((1 - q[4]) * (1 - q[2] * 0.2) * 0.6).col(c.edge).dot(q[0], q[1]);
  if (fade > 0) runeCircle(P, X0, FY, R, 0.36, turn, 6, c, fade, false);
  for (const q of pts) if (q[3]) P.alpha((1 - q[4] * 0.8) * (1 - q[2] * 0.2)).col(q[2] ? c.mid : c.core).dot(q[0], q[1]);
  P.alpha(1);
  ctx.restore();
}

export const ARCANE_FX: SpellFxArt = { bolt: arcaneBolt, impact: arcaneImpact, self: arcaneSelf, ...ARCANE };
