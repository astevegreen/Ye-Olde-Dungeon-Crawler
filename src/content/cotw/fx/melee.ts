import type { FxSurface, MeleeFxArt } from '../../../engine';
import { FALL, H, TAU, X, eIn, eOut, pen, seedAt, seg, twinkle, type Pen } from './pen';

/**
 * Melee is steel: colourless. Hit: a white crescent swept across the target, thickest
 * mid-arc, retracting from its tail, with a two-frame white flash. Crit: a bigger crescent
 * crossed by a second, sparks, an ember-red tint. Miss: a thin grey whiff arc that passes
 * beside the target.
 */
const MELEE_MS = 300;

/** Attacker to target; a zero-length direction reads as pointing right. */
type Dir = readonly [number, number];
const RIGHT: Dir = [1, 0];
const aim = (dir: Dir): Dir => (dir[0] === 0 && dir[1] === 0 ? RIGHT : dir);

/** Crescent colours, outer edge first: the cutting edge, the body, the trailing rim. */
type Steel = readonly [string, string, string];

/** An arc centred (cx, cy), swept a0 -> a1; cells between fractions tail..head. */
function crescent(P: Pen, cx: number, cy: number, R: number, thick: number, a0: number, a1: number, head: number, tail: number, cols: Steel): void {
  const Rm = R + thick,
    span = a1 - a0;
  for (let gy = Math.floor(cy - Rm); gy <= Math.ceil(cy + Rm); gy++) {
    for (let gx = Math.floor(cx - Rm); gx <= Math.ceil(cx + Rm); gx++) {
      const dx = gx + 0.5 - cx,
        dy = gy + 0.5 - cy,
        r = Math.hypot(dx, dy);
      if (r > Rm || r < R - thick) continue;
      let a = Math.atan2(dy, dx) - a0;
      a = ((a % TAU) + TAU) % TAU;
      if (span < 0) a = a === 0 ? 0 : a - TAU;
      const s = a / span;
      if (s < tail || s > head || s < 0 || s > 1) continue;
      const th = thick * Math.pow(Math.sin(Math.PI * s), 0.75);
      const o = r - R; // + is the outer, cutting edge
      if (o > th * 0.5 || o < -th * 0.5) continue;
      const lead = head - s < 0.18;
      P.col(o > th * 0.1 || lead ? cols[0] : o > -th * 0.25 ? cols[1] : cols[2]).cell(gx, gy);
    }
  }
}

function swing(P: Pen, X0: number, Y0: number, dir: Dir, p: number, R: number, thick: number, flip: number, cols: Steel, offs?: number): void {
  const dl = Math.hypot(dir[0], dir[1]) || 1,
    ux = dir[0] / dl,
    uy = dir[1] / dl,
    ang = Math.atan2(uy, ux);
  const cx = X0 - ux * R * 0.72 + (offs ? -uy * offs : 0),
    cy = Y0 - uy * R * 0.72 + (offs ? ux * offs : 0);
  const half = 1.05,
    a0 = ang - half * flip,
    a1 = ang + half * flip;
  // the head sweeps in 16% of the time; the arc then hangs, full, before it retracts from the tail
  const head = eOut(seg(p, 0, 0.16)),
    tail = Math.max(0, head - 0.8) + eIn(seg(p, 0.3, 0.8)) * 0.45 + seg(p, 0.3, 0.8) * 0.55;
  if (tail >= head) return;
  crescent(P, cx, cy, R, thick * (1 - 0.45 * seg(p, 0.35, 0.8)), a0, a1, head, tail, cols);
}

function meleeHit(ctx: FxSurface, x: number, y: number, p: number, cs: number, dirIn: Dir, crit: boolean): void {
  const P = pen(ctx, cs),
    u = P.u,
    c = FALL.physical;
  const X0 = x / u,
    Y0 = y / u - 2,
    ms = MELEE_MS,
    tms = p * ms,
    sd = seedAt(x, y, cs);
  const dir = aim(dirIn);
  ctx.save();
  // the two-frame white flash
  if (tms < 66) {
    P.glow(X0, Y0, crit ? 20 : 15, c.core, crit ? 0.55 : 0.45);
    twinkle(P, X0, Y0, crit ? 4 : 3, c.core, c.mid);
  }
  if (crit) {
    // ember-red tint, brief
    const tk = seg(p, 0.05, 0.42);
    if (tk > 0 && tk < 1) {
      P.shade(X0, Y0 + 2, 16, 14, X.ember, 0.24 * (1 - tk));
      P.glow(X0, Y0, 14, X.ember, 0.28 * (1 - tk));
    }
    // sparks fly on through the target
    const dl = Math.hypot(dir[0], dir[1]) || 1,
      ang = Math.atan2(dir[1] / dl, dir[0] / dl);
    for (let i = 0; i < 10; i++) {
      const k = seg(p, 0.03, 0.5 + H(sd + i, 101) * 0.25);
      if (k <= 0 || k >= 1 || (k > 0.6 && (Math.floor(tms / 40) + i) % 2)) continue;
      const a = ang + (H(sd + i, 102) - 0.5) * 2.2,
        sp = 10 + 10 * H(sd + i, 103),
        d = sp * eOut(k);
      const sx = X0 + Math.cos(a) * d,
        sy = Y0 + Math.sin(a) * d + 7 * k * k;
      const col = k < 0.25 ? c.core : k < 0.55 ? X.fireHot : X.ember;
      P.col(col).line(sx, sy, sx - Math.cos(a) * 2 * (1 - k), sy - Math.sin(a) * 2 * (1 - k) - 1.4 * k, 1);
    }
    swing(P, X0, Y0, dir, seg(p, 0, 0.9), 14, 4.6, 1, [c.core, c.mid, X.steelPale]);
    swing(P, X0, Y0, dir, seg(p, 0.1, 1), 12, 3.6, -1, [c.core, c.mid, X.steelPale], 2);
  } else {
    swing(P, X0, Y0, dir, p, 11.5, 3.8, 1, [c.core, c.mid, X.steelPale]);
  }
  ctx.restore();
}

function meleeMiss(ctx: FxSurface, x: number, y: number, p: number, cs: number, dirIn: Dir): void {
  const P = pen(ctx, cs),
    u = P.u,
    c = FALL.physical;
  const dir = aim(dirIn);
  const dl = Math.hypot(dir[0], dir[1]) || 1,
    ux = dir[0] / dl,
    uy = dir[1] / dl;
  // falls short: the arc cuts the air on the attacker's side of the target
  const X0 = x / u - ux * 12,
    Y0 = y / u - 2 - uy * 12;
  ctx.save();
  const fade = 1 - seg(p, 0.5, 0.9);
  // a grey whiff and a fainter motion line inside it
  P.alpha(0.9 * fade);
  swing(P, X0, Y0, dir, seg(p, 0, 0.9), 9, 2.6, 1, [X.steelPale, X.steelPale, c.edge]);
  P.alpha(0.45 * fade);
  swing(P, X0, Y0, dir, seg(p, 0.05, 0.95), 6, 1.2, 1, [c.edge, c.edge, c.edge]);
  P.alpha(1);
  ctx.restore();
}

export const MELEE_FX: MeleeFxArt = {
  hit: (ctx, x, y, p, cs, dir) => meleeHit(ctx, x, y, p, cs, dir, false),
  crit: (ctx, x, y, p, cs, dir) => meleeHit(ctx, x, y, p, cs, dir, true),
  miss: meleeMiss,
  ms: MELEE_MS,
};
