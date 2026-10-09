import type { FxSurface, SpellFxArt } from '../../../engine';
import { clamp } from '../sprites/sculpt/kit';
import { H, eIn, eOut, flight, lerp, pen, seedAt, seed2, seg, type Pen, type Pt } from './pen';

/**
 * Blood magic (owner, 8 Oct: red and liquid, not violet spirals): the caster's own blood,
 * thrown. Drops fall from the caster as the price. A heavy teardrop flies with a stream behind
 * it that beads into drops; the drops fall, spot the floor and soak in. Impact: the glob
 * bursts in a splash crown, droplets arc out and land, runs trickle down the target into a pool
 * that spreads, ripples under late drips, darkens and soaks away. Red family only, no glow
 * beyond a faint wet sheen.
 */
const BLOOD = { msBolt: 520, msImpact: 980 };
const BL = { glint: '#ffe0dc', lit: '#ef4a52', mid: '#c41a28', body: '#9c1220', dark: '#5a0710', deep: '#26030a' };

/** A liquid drop on the lattice: round front, tail tapering behind (ux, uy) over r*s; outlined, lit top-left. */
function teardrop(P: Pen, x: number, y: number, r: number, ux: number, uy: number, s: number, wob: number): void {
  if (r < 1.3) {
    P.col(BL.mid).dot(x, y);
    P.col(BL.dark).dot(x, y + 1);
    return;
  }
  const ra = r * (1 + 0.16 * wob),
    rb = r * (1 - 0.16 * wob),
    L = r * s;
  const inside = (px: number, py: number): boolean => {
    const dx = px - x,
      dy = py - y,
      a = dx * ux + dy * uy,
      b = -dx * uy + dy * ux;
    if (a >= 0) return (a / ra) ** 2 + (b / rb) ** 2 <= 1;
    const t = -a / L;
    return t < 1 && Math.abs(b) <= rb * Math.pow(1 - t, 0.85);
  };
  const R = Math.ceil(Math.max(ra, rb, L)) + 1;
  for (let gy = Math.floor(y - R); gy <= Math.ceil(y + R); gy++) {
    for (let gx = Math.floor(x - R); gx <= Math.ceil(x + R); gx++) {
      const cx = gx + 0.5,
        cy = gy + 0.5;
      if (!inside(cx, cy)) continue;
      const rim = !inside(cx + 1, cy) || !inside(cx - 1, cy) || !inside(cx, cy + 1) || !inside(cx, cy - 1);
      const nx = (cx - x) / r,
        ny = (cy - y) / r;
      let col: string;
      if (rim) col = ny < -0.2 && nx < 0.2 ? BL.body : BL.dark;
      else if (ny > 0.25) col = BL.body;
      else if (nx < 0 && ny < 0 && nx * nx + ny * ny > 0.12) col = BL.lit;
      else col = BL.mid;
      P.col(col).cell(gx, gy);
    }
  }
  P.col(BL.glint).dot(x - ra * 0.35, y - rb * 0.45);
}

/** A falling drop: a bead that stretches upward as it speeds up. */
function fallingDrop(P: Pen, x: number, y: number, speed: number): void {
  P.col(BL.mid).dot(x, y);
  P.col(BL.lit).dot(x, y - 1);
  if (speed > 0.4) P.col(BL.body).dot(x, y - 2);
  if (speed > 0.8) P.col(BL.dark).dot(x, y - 3);
}

/** A spot on the floor, soaking in: wet red, then dark, then gone. */
function floorSpot(P: Pen, x: number, y: number, w: number, age: number, fade: number): void {
  const col = age < 140 ? BL.body : age < 320 ? BL.dark : BL.deep;
  P.alpha(fade).col(col).span(x - w / 2, x + w / 2, y);
  if (age < 140 && w >= 2) P.col(BL.lit).dot(x - w / 2 + 0.5, y);
  P.alpha(1);
}

function bloodBolt(ctx: FxSurface, x0: number, y0: number, x1: number, y1: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    F = flight(x0, y0, x1, y1, cs);
  const ms = BLOOD.msBolt,
    tms = p * ms,
    sd = seed2(x0, y0, x1, y1, cs);
  const sag = clamp(F.D * 0.1, 2, 8);
  // a heavy glob: it rises a little and sags (arc), and starts slow (the throw)
  const pos = (t: number): Pt => [F.ax + F.dx * t, F.ay + F.dy * t - Math.sin(Math.PI * t) * sag];
  const travel = (q: number): number => eIn(q) * 0.25 + q * 0.75;
  const hp = travel(p),
    [hx, hy] = pos(hp);
  const fade = 1 - seg(p, 0.86, 1);
  ctx.save();
  // the price: drops fall from the caster to a small spot at their feet
  const cFloor = F.ay + 14.5;
  for (let i = 0; i < 3; i++) {
    const k = seg(p, i * 0.11, i * 0.11 + 0.22);
    if (k <= 0) continue;
    const dx = F.ax + (H(sd + i, 41) - 0.5) * 3 - F.ux * 1.5;
    if (k < 1) fallingDrop(P, dx, lerp(F.ay + 1, cFloor - 0.5, eIn(k)), k);
    else floorSpot(P, dx, cFloor, 2, (p - (i * 0.11 + 0.22)) * ms, fade);
  }
  const pool = eOut(seg(p, 0.2, 0.5)) * fade;
  if (pool > 0.1) {
    P.alpha(fade).col(BL.dark).ell(F.ax - F.ux * 1.5, cFloor + 0.4, 1.5 + 2 * pool, 0.6 + 0.6 * pool);
    P.alpha(1);
  }
  // the stream behind the glob: a rope while fresh, then beads that fall and spot the floor
  const N = Math.ceil(F.D / 1.2);
  for (let i = 0; i < N; i++) {
    const tb = (i + 0.5) / N;
    if (tb > hp - 0.02) break;
    // when the head passed tb (invert travel by search: monotone, so a few bisection steps)
    let lo = 0,
      hi = 1;
    for (let s = 0; s < 12; s++) {
      const m = (lo + hi) / 2;
      if (travel(m) < tb) lo = m;
      else hi = m;
    }
    const age = (p - lo) * ms;
    const [sx, sy] = pos(tb);
    if (age < 80) {
      const rr = 1.9 * (1 - age / 80) + 0.6;
      P.col(BL.body).ell(sx, sy + 0.4, rr, rr);
      P.col(BL.mid).ell(sx, sy - 0.2, rr * 0.7, rr * 0.6);
      continue;
    }
    // only some of the rope survives as beads, unevenly spaced; they fall to the floor under the line of flight
    if (i % 4 || H(sd + i, 44) < 0.3) continue;
    const fall = 0.0002 * (age - 80) * (age - 80),
      floorY = F.ay + F.dy * tb + 14.5,
      jx = (H(sd + i, 42) - 0.5) * 1.5;
    if (sy + fall < floorY) fallingDrop(P, sx + jx, sy + fall, seg(fall, 0, 6));
    else {
      const land = 80 + Math.sqrt((floorY - sy) / 0.0002);
      floorSpot(P, sx + jx, floorY, 1 + Math.round(H(sd + i, 43) * 2), age - land, fade);
    }
  }
  // the head: a teardrop pointing along its flight, wobbling, with a faint wet sheen
  const [ax, ay] = pos(Math.max(0, hp - 0.03));
  let vx = hx - ax,
    vy = hy - ay;
  const vl = Math.hypot(vx, vy) || 1;
  vx /= vl;
  vy /= vl;
  P.glow(hx, hy, 6, BL.lit, 0.12);
  const grow = eOut(seg(p, 0, 0.12));
  teardrop(P, hx, hy, 1.4 + 1.9 * grow, vl > 0.05 ? vx : F.ux, vl > 0.05 ? vy : F.uy, 1.7, Math.sin(Math.floor(tms / 50) * 1.4));
  ctx.restore();
}

/** A pool lobe: x offset, y offset, x radius, y radius. */
type Lobe = [number, number, number, number];

function bloodImpact(ctx: FxSurface, x: number, y: number, p: number, cs: number): void {
  const P = pen(ctx, cs),
    u = P.u;
  const X0 = x / u,
    Y0 = y / u,
    CY = Y0 - 3,
    FY = Y0 + 11.5;
  const ms = BLOOD.msImpact,
    sd = seedAt(x, y, cs);
  const end = 1 - seg(p, 0.9, 1);
  ctx.save();
  // the pool: spreads in lobes, holds, darkens as it clots, then soaks away
  const pr = eOut(seg(p, 0.16, 0.6)) * (1 - 0.55 * eIn(seg(p, 0.78, 1)));
  if (pr > 0.05) {
    const lob: Lobe[] = [
      [0, 0, 9, 2.9],
      [(H(sd, 51) - 0.5) * 9, 0.7, 5, 1.9],
      [(H(sd, 52) - 0.5) * 11, -0.4, 4, 1.5],
    ];
    P.alpha(end);
    for (const [ox, oy, rx, ry] of lob) P.col(BL.deep).ell(X0 + ox * pr, FY + oy, rx * pr + 1, ry * pr + 0.8);
    for (const [ox, oy, rx, ry] of lob) P.col(BL.dark).ell(X0 + ox * pr, FY + oy, rx * pr, ry * pr);
    for (const [ox, oy, rx, ry] of lob) P.col(BL.body).ell(X0 + ox * pr - 0.4, FY + oy - 0.3, rx * pr * 0.78, ry * pr * 0.62);
    P.col(BL.mid).ell(X0 - 1.5 * pr, FY - 0.6, 4.5 * pr, 1.1 * pr);
    // the wet sheen: a lit streak on the near side of the pool, gone once it clots
    const wet = 1 - seg(p, 0.7, 0.85);
    if (wet > 0) {
      P.alpha(end * wet).col(BL.lit).span(X0 - 5 * pr, X0 - 1 * pr, FY - 1.2);
      P.col(BL.glint).dot(X0 - 4 * pr, FY - 1.2);
    }
    // clotting: the pool darkens toward black-red
    const clot = seg(p, 0.66, 0.9);
    if (clot > 0) for (const [ox, oy, rx, ry] of lob) P.alpha(end * clot * 0.75).col(BL.deep).ell(X0 + ox * pr, FY + oy, rx * pr, ry * pr);
    P.alpha(1);
    P.fglow(X0, FY, 11, 3.6, BL.lit, 0.1 * pr * wet);
  }
  // the glob arrives and squashes flat against the target
  if (p < 0.13) {
    const k = p / 0.13;
    teardrop(P, X0 - 1.5 * k, CY + k, 3.3 + 1.6 * k, 1, 0, 1.6 - k, 2.2 * k);
    P.glow(X0, CY, 8, BL.lit, 0.2 * (1 - k));
  }
  // the splash crown: spikes thrown up and out, their tips breaking off as drops
  for (let i = 0; i < 9; i++) {
    const k = seg(p, 0.05, 0.24 + H(sd + i, 53) * 0.05);
    if (k <= 0 || k >= 1) continue;
    const a = -Math.PI * (0.05 + 0.9 * (i / 8)) + (H(sd + i, 54) - 0.5) * 0.35,
      L = (7 + 5 * H(sd + i, 55)) * eOut(k);
    const tx = X0 + Math.cos(a) * L,
      ty = CY + Math.sin(a) * L * 0.9 + 6 * k * k;
    const from = k < 0.55 ? 1.5 : 1.5 + (L - 1.5) * seg(k, 0.55, 1);
    P.col(k < 0.4 ? BL.lit : BL.mid).line(X0 + Math.cos(a) * from, CY + Math.sin(a) * from * 0.9 + 6 * k * k * (from / Math.max(L, 1)), tx, ty);
    P.col(BL.lit).dot(tx, ty, k < 0.5 ? 2 : 1);
  }
  // flung droplets: up and out, then down to spot the floor
  for (let i = 0; i < 10; i++) {
    const t0 = 0.08 + H(sd + i, 56) * 0.06,
      k = seg(p, t0, t0 + 0.34);
    if (k <= 0) continue;
    const a = Math.PI + (i / 9) * Math.PI + (H(sd + i, 57) - 0.5) * 0.4,
      sp = 8 + 7 * H(sd + i, 58);
    const dx = X0 + Math.cos(a) * sp * k,
      fy = FY + (H(sd + i, 59) - 0.5) * 3;
    const dy = CY + Math.sin(a) * sp * 0.8 * k + 30 * k * k;
    if (dy < fy && k < 1) fallingDrop(P, dx, dy, seg(k, 0.3, 1));
    else floorSpot(P, dx, fy, 1 + Math.round(H(sd + i, 60)), (p - (t0 + 0.34 * 0.7)) * ms, end * (1 - seg(p, 0.82, 0.95)));
  }
  // runs: blood trickles down the target, slow then quick, into the pool
  for (let i = 0; i < 4; i++) {
    const t0 = 0.1 + i * 0.07,
      k = seg(p, t0, t0 + 0.32);
    if (k <= 0) continue;
    const rx = X0 + (H(sd + i, 61) - 0.5) * 9,
      sy = CY + (H(sd + i, 62) - 0.5) * 5;
    const hy = lerp(sy, FY - 0.5, eIn(k)),
      dry = seg(p, 0.62, 0.9);
    for (let yy = sy; yy < hy - 1; yy += 1) {
      const wig = Math.round(Math.sin((yy - sy) * 0.6 + i) * 0.6);
      P.alpha(end * (1 - dry))
        .col((yy | 0) % 4 === 0 && dry < 0.2 ? BL.mid : BL.body)
        .dot(rx + wig, yy);
    }
    P.alpha(1);
    if (k < 1) {
      P.col(BL.mid).dot(rx, hy, 2);
      P.col(BL.lit).dot(rx - 0.5, hy - 0.5);
    }
  }
  // late drips fall from the target; each one rings the pool
  for (let i = 0; i < 3; i++) {
    const t0 = 0.46 + i * 0.13,
      k = seg(p, t0, t0 + 0.1);
    if (k <= 0) continue;
    const dx = X0 + (H(sd + i, 63) - 0.5) * 6;
    if (k < 1) {
      fallingDrop(P, dx, lerp(CY + 2, FY - 0.5, eIn(k)), k);
      continue;
    }
    const rk = seg(p, t0 + 0.1, t0 + 0.24);
    if (rk > 0 && rk < 1) P.alpha(end * (1 - rk)).col(BL.lit).ring(dx, FY, 1 + 3.5 * rk, 0.5 + 1.1 * rk).alpha(1);
  }
  ctx.restore();
}

export const BLOOD_FX: SpellFxArt = { bolt: bloodBolt, impact: bloodImpact, ...BLOOD };
