import { IDLE_FRAME_MS } from '../atlas/idle-frames';
import { mixColor, withAlpha, type ThemeTokens } from '../theme';

/**
 * Map markers: what the map draws over the art to say who is a target, who is on your side,
 * what you are looking at, where a blow will land, and where you are walking. They are UI,
 * so they are crisp lines and flat shapes on a dark keyline, never a glow (glow belongs to
 * spells), and each cue has a shape that reads without colour:
 *   hostile  angular: mitred corners and ticks pointing in; contracts on a beat.
 *   ally     rounded corners, no ticks, still; and a ring turning under the feet.
 *   look     thin square corners in neutral white; drifts outward and back.
 *   danger   a diagonal hatch that crawls, and one edge round the whole zone.
 *
 * Every function takes the tile's top-left corner and size in canvas pixels, and `t`, the
 * draw's clock in ms: 0 holds the still rest pose (Reduce motion). Motion advances in whole
 * idle frames (`IDLE_FRAME_MS`), the ambient redraw's tick, so it reads as steady poses
 * rather than a stutter. Ambient, never tactical (§4): no marker holds input.
 */

/** The theme roles the markers draw in. */
export type MarkerTheme = Pick<
  Required<ThemeTokens>,
  'markerInk' | 'hostile' | 'ally' | 'look' | 'danger' | 'path' | 'hpEnemy' | 'hpAlly' | 'hpTrack' | 'sensedItem'
>;

export interface ScreenPoint {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

/** A line weight that stays crisp: 2 px at 32 px tiles, 4 at 96. */
const lineWeight = (cs: number): number => Math.max(1, Math.round(1 + cs / 32));
const snap = (v: number, w: number): number => Math.round(v) + (w % 2 ? 0.5 : 0);

/** The idle frame the clock is in. */
const frameOf = (t: number): number => Math.max(0, Math.floor(t / IDLE_FRAME_MS));

/** A 0..1 wave over `frames` idle frames, sampled once a frame; near 0 at rest. */
function beat(t: number, frames: number): number {
  return 0.5 - 0.5 * Math.cos((((frameOf(t) % frames) + 0.5) / frames) * TAU);
}

/** A filled polygon (flat x, y pairs) with a dark keyline round it. */
function keyed(ctx: CanvasRenderingContext2D, pts: readonly number[], fill: string, ink: string, keyW = 2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  ctx.strokeStyle = withAlpha(ink, 0.8);
  ctx.lineWidth = keyW;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A flat point list turned about (ox, oy) by `q` quarter turns. */
function rot(pts: readonly number[], ox: number, oy: number, q: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    let dx = pts[i] - ox;
    let dy = pts[i + 1] - oy;
    for (let k = 0; k < q; k++) [dx, dy] = [-dy, dx];
    out.push(ox + dx, oy + dy);
  }
  return out;
}

/**
 * An enemy pointed at: four mitred corners, each arm cut to a point, and two ticks pinching
 * in from the sides (none on top, where its health bar sits). The frame contracts a pixel on
 * a beat of four idle frames, as if taking aim.
 */
export function drawHostileBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const w = lineWeight(cs);
  const L = Math.round(cs * 0.25);
  const ins = Math.round(beat(t, 4) * Math.max(1, cs / 32));
  const cx = x + cs / 2;
  const cy = y + cs / 2;
  const x0 = x + ins;
  const y0 = y + ins;
  const corner = [x0, y0, x0 + L, y0, x0 + L - w, y0 + w, x0 + w, y0 + w, x0 + w, y0 + L - w, x0, y0 + L];
  const tk = Math.max(2, Math.round(cs * 0.07));
  const tick = [cx - tk, y0, cx + tk, y0, cx, y0 + Math.round(tk * 1.5)];
  ctx.save();
  for (let q = 0; q < 4; q++) keyed(ctx, rot(corner, cx, cy, q), theme.hostile, theme.markerInk);
  for (const q of [1, 3]) keyed(ctx, rot(tick, cx, cy, q), theme.hostile, theme.markerInk);
  ctx.restore();
}

/** An ally pointed at: four rounded corners in the ally colour, no ticks, no motion: calm. */
export function drawAllyBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, theme: MarkerTheme): void {
  const w = lineWeight(cs);
  const r = Math.round(cs * 0.24);
  const i = w / 2 + 1;
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [x + i + r, y + i + r, Math.PI],
    [x + cs - i - r, y + i + r, Math.PI * 1.5],
    [x + cs - i - r, y + cs - i - r, 0],
    [x + i + r, y + cs - i - r, Math.PI * 0.5],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? theme.ally : withAlpha(theme.markerInk, 0.8);
    ctx.lineWidth = pass ? w : w + 2;
    for (const [ax, ay, a] of corners) {
      ctx.beginPath();
      ctx.arc(ax, ay, r, a, a + Math.PI / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Under an ally's feet: a gold ring on the floor, broken in four, turning slowly. Drawn
 * before the sprite, so the feet stand in it. A quarter turn looks the same, so it turns in
 * six 15° steps, one an idle frame (a full turn in about six seconds).
 */
export function drawAllyRing(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const cx = x + cs / 2;
  const cy = y + cs * 0.87;
  const rx = cs * 0.36;
  const ry = cs * 0.115;
  const w = Math.max(1, Math.round(cs / 20));
  const turn = (frameOf(t) % 6) * (TAU / 24);
  const span = TAU / 4 - 0.5;
  ctx.save();
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? theme.ally : withAlpha(theme.markerInk, 0.6);
    ctx.lineWidth = pass ? w : w + 2;
    for (let k = 0; k < 4; k++) {
      const a = turn + (k * TAU) / 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a, a + span);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * What the Look mode points at: thin square corners in neutral white over a faint wash,
 * drifting outward a pixel and back over five idle frames: you are looking, not aiming.
 */
export function drawLookReticle(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const w = Math.max(1, Math.round(cs / 40));
  const L = Math.round(cs * 0.26);
  const o = Math.round(beat(t, 5) * Math.max(1, cs / 48));
  const odd = w % 2 ? 1 : 0;
  const x0 = snap(x + 1 - o, w);
  const y0 = snap(y + 1 - o, w);
  const x1 = snap(x + cs - 1 + o, w) - odd;
  const y1 = snap(y + cs - 1 + o, w) - odd;
  const segs = [
    [x0, y0 + L, x0, y0, x0 + L, y0],
    [x1 - L, y0, x1, y0, x1, y0 + L],
    [x1, y1 - L, x1, y1, x1 - L, y1],
    [x0 + L, y1, x0, y1, x0, y1 - L],
  ];
  ctx.save();
  ctx.fillStyle = withAlpha(theme.look, 0.07);
  ctx.fillRect(x, y, cs, cs);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? theme.look : withAlpha(theme.markerInk, 0.7);
    ctx.lineWidth = pass ? w : w + 2;
    for (const s of segs) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
      ctx.lineTo(s[4], s[5]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * The tiles a blow will strike: hatched in diagonals that crawl toward the bottom-left a
 * pixel an idle frame, pulsing over six frames, with one edge line round the outside of the
 * whole zone. Seams between its tiles are left open, so a run of tiles reads as one shape.
 */
export function drawDangerZone(ctx: CanvasRenderingContext2D, tiles: readonly ScreenPoint[], cs: number, t: number, theme: MarkerTheme): void {
  if (tiles.length === 0) return;
  const key = (x: number, y: number): string => `${Math.round(x)},${Math.round(y)}`;
  const zone = new Set(tiles.map((p) => key(p.x, p.y)));
  const p = beat(t, 6);
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const tile of tiles) {
    bx0 = Math.min(bx0, tile.x);
    by0 = Math.min(by0, tile.y);
    bx1 = Math.max(bx1, tile.x + cs);
    by1 = Math.max(by1, tile.y + cs);
  }
  const clipToZone = (): void => {
    ctx.beginPath();
    for (const tile of tiles) ctx.rect(tile.x, tile.y, cs, cs);
    ctx.clip();
  };

  // The wash and the hatch, inside the zone.
  ctx.save();
  clipToZone();
  ctx.fillStyle = withAlpha(theme.danger, 0.1 + 0.08 * p);
  ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  const sp = Math.max(6, Math.round(cs / 4.5));
  const crawl = Math.max(1, Math.round((sp * 0.6 * IDLE_FRAME_MS) / 1000));
  const off = (frameOf(t) * crawl) % sp;
  const H = by1 - by0;
  ctx.strokeStyle = withAlpha(theme.danger, 0.34 + 0.22 * p);
  ctx.lineWidth = Math.max(1, Math.round(cs / 22));
  ctx.beginPath();
  for (let k = -H - sp; k < bx1 - bx0 + sp; k += sp) {
    const sx = bx0 + k + off;
    ctx.moveTo(sx, by1);
    ctx.lineTo(sx + H, by0);
  }
  ctx.stroke();
  ctx.restore();

  // The edge: every tile side with no zone tile beyond it. Stroked on the boundary at
  // double width and clipped, so the line lies inside the zone and concave corners close;
  // the keyline is the same trick clipped to the outside.
  const edges = dangerEdges(tiles, cs, zone, key);
  const strokeEdges = (width: number, style: string): void => {
    ctx.lineCap = 'square';
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.beginPath();
    for (const e of edges) {
      ctx.moveTo(e[0], e[1]);
      ctx.lineTo(e[2], e[3]);
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx0 - cs, by0 - cs, bx1 - bx0 + cs * 2, by1 - by0 + cs * 2);
  for (const tile of tiles) ctx.rect(tile.x, tile.y, cs, cs);
  ctx.clip('evenodd');
  strokeEdges(2 * Math.max(1, Math.round(cs / 40)), withAlpha(theme.markerInk, 0.6));
  ctx.restore();
  ctx.save();
  clipToZone();
  strokeEdges(lineWeight(cs) * 2, withAlpha(theme.danger, 0.8 + 0.2 * p));
  ctx.restore();
}

/** The outer sides of a zone of tiles, as [x0, y0, x1, y1] segments. */
function dangerEdges(
  tiles: readonly ScreenPoint[],
  cs: number,
  zone: ReadonlySet<string>,
  key: (x: number, y: number) => string
): Array<[number, number, number, number]> {
  const edges: Array<[number, number, number, number]> = [];
  for (const { x, y } of tiles) {
    if (!zone.has(key(x, y - cs))) edges.push([x, y, x + cs, y]);
    if (!zone.has(key(x, y + cs))) edges.push([x, y + cs, x + cs, y + cs]);
    if (!zone.has(key(x - cs, y))) edges.push([x, y, x, y + cs]);
    if (!zone.has(key(x + cs, y))) edges.push([x + cs, y, x + cs, y + cs]);
  }
  return edges;
}

/**
 * Over an attacker winding up: a hazard triangle with a drawn '!'. It jabs upward for one
 * idle frame in three (the bible's 700 ms swing would stutter at the ambient tick).
 */
export function drawWindupWarning(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const h = Math.max(12, Math.round(cs * 0.36));
  const w = Math.round(h * 1.15);
  const jab = frameOf(t) % 3 === 1 ? Math.round(Math.max(1, h * 0.14)) : 0;
  const cx = Math.round(x + cs / 2);
  const base = Math.round(y + h * 0.35) - jab;
  const top = base - h;
  ctx.save();
  keyed(ctx, [cx, top, cx + w / 2, base, cx - w / 2, base], theme.hostile, theme.markerInk, 3);
  const bw = Math.max(2, Math.round(h * 0.15));
  ctx.fillStyle = theme.look;
  ctx.fillRect(cx - Math.floor(bw / 2), top + Math.round(h * 0.34), bw, Math.round(h * 0.34));
  ctx.fillRect(cx - Math.floor(bw / 2), top + Math.round(h * 0.76), bw, bw);
  ctx.restore();
}

/**
 * The walking path, as tile centres from the next step to the goal: a small arrowhead on
 * each step pointing at the next, a pulse running down them toward the goal one step an
 * idle frame, and a diamond at the goal. Parchment white: it is your intent, not a spell.
 */
export function drawPath(ctx: CanvasRenderingContext2D, pts: readonly ScreenPoint[], cs: number, t: number, theme: MarkerTheme): void {
  if (pts.length === 0) return;
  const n = pts.length;
  const s = Math.max(4, Math.round(cs * 0.13));
  const w = Math.max(1.5, Math.round(cs / 18));
  const head = frameOf(t) % (n + 3);
  const unlit = mixColor(theme.path, theme.markerInk, 0.43);
  ctx.save();
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const px = -uy;
    const py = ux;
    const near = Math.max(0, 1 - Math.abs(head - i) / 2.5);
    keyed(
      ctx,
      [
        a.x + ux * s * 1.2, a.y + uy * s * 1.2,
        a.x - ux * s * 0.8 + px * s * 0.7, a.y - uy * s * 0.8 + py * s * 0.7,
        a.x - ux * s * 0.3, a.y - uy * s * 0.3,
        a.x - ux * s * 0.8 - px * s * 0.7, a.y - uy * s * 0.8 - py * s * 0.7,
      ],
      mixColor(unlit, theme.path, near),
      theme.markerInk
    );
  }
  const g = pts[n - 1];
  const d = Math.round(cs * 0.17 + beat(t, 4) * Math.max(1, cs / 32));
  ctx.beginPath();
  ctx.moveTo(g.x, g.y - d);
  ctx.lineTo(g.x + d, g.y);
  ctx.lineTo(g.x, g.y + d);
  ctx.lineTo(g.x - d, g.y);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(theme.markerInk, 0.6);
  ctx.lineWidth = w + 2;
  ctx.stroke();
  ctx.strokeStyle = theme.path;
  ctx.lineWidth = w;
  ctx.stroke();
  const pp = Math.max(2, Math.round(cs / 16));
  ctx.fillStyle = theme.path;
  ctx.fillRect(Math.round(g.x - pp / 2), Math.round(g.y - pp / 2), pp, pp);
  ctx.restore();
}

/**
 * A creature's health while it is hurt (0 < frac < 1): an enemy's bar is cut at a slant
 * (angular), an ally's is a pill (round), and quarter notches let the amount read without
 * colour. Nothing at full health or none.
 */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cs: number,
  frac: number,
  side: 'enemy' | 'ally',
  theme: MarkerTheme
): void {
  if (!(frac > 0 && frac < 1)) return;
  const W = Math.round(cs * 0.72);
  const H = Math.max(3, Math.round(cs / 13));
  const bx = Math.round(x + (cs - W) / 2);
  const by = Math.round(y + Math.max(1, cs * 0.04));
  const enemy = side !== 'ally';
  const sk = enemy ? Math.max(1, Math.round(H * 0.7)) : 0;
  ctx.save();
  ctx.beginPath();
  if (enemy) {
    ctx.moveTo(bx + sk, by);
    ctx.lineTo(bx + W, by);
    ctx.lineTo(bx + W - sk, by + H);
    ctx.lineTo(bx, by + H);
    ctx.closePath();
  } else {
    const r = H / 2;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + W - r, by);
    ctx.arc(bx + W - r, by + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bx + r, by + H);
    ctx.arc(bx + r, by + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  }
  ctx.strokeStyle = withAlpha(theme.markerInk, 0.85);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.stroke();
  ctx.fillStyle = theme.hpTrack;
  ctx.fill();
  ctx.clip();
  const fw = Math.max(1, Math.round(W * frac));
  ctx.fillStyle = enemy ? theme.hpEnemy : theme.hpAlly;
  ctx.fillRect(bx, by, fw, H);
  if (H >= 4) {
    ctx.fillStyle = withAlpha(theme.look, 0.28);
    ctx.fillRect(bx, by, fw, Math.max(1, Math.round(H / 4)));
  }
  if (W >= 20) {
    ctx.fillStyle = withAlpha(theme.markerInk, 0.7);
    for (let q = 1; q < 4; q++) ctx.fillRect(bx + Math.round((W * q) / 4), by, Math.max(1, Math.round(cs / 48)), H);
  }
  ctx.restore();
}

/**
 * A creature sensed through walls: a diamond core as wide as a small creature, and four ticks
 * closing on its sides from the tile's corners, a ping every five idle frames. Seeing one
 * through a wall is a gameplay cue, so the core keeps the old mark's footprint (18 px at 32).
 */
export function drawSensedCreature(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const cx = Math.round(x + cs / 2);
  const cy = Math.round(y + cs / 2);
  const ph = (frameOf(t) % 5) / 5;
  const tip = cs * (0.42 - 0.16 * ph);
  const tk = Math.max(2, Math.round(cs * 0.08));
  const base = tip + tk * 1.6;
  const s = Math.SQRT1_2;
  // The top-left tick, on the diagonal and pointing in; the others are its quarter turns.
  const tick = [cx - (base + tk) * s, cy - (base - tk) * s, cx - (base - tk) * s, cy - (base + tk) * s, cx - tip * s, cy - tip * s];
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * (1 - ph);
  for (let q = 0; q < 4; q++) keyed(ctx, rot(tick, cx, cy, q), theme.hostile, theme.markerInk);
  ctx.globalAlpha = 1;
  const d = Math.max(2, Math.round(cs * 0.28));
  keyed(ctx, [cx, cy - d, cx + d, cy, cx, cy + d, cx - d, cy], theme.hostile, theme.markerInk);
  ctx.restore();
}

/** An object sensed through walls: a diamond outline with a dot, breathing over six idle frames, as wide as the old mark. */
export function drawSensedItem(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, t: number, theme: MarkerTheme): void {
  const cx = Math.round(x + cs / 2);
  const cy = Math.round(y + cs / 2);
  const d = Math.round(cs * (0.27 + 0.04 * beat(t, 6)));
  const w = lineWeight(cs);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d, cy);
  ctx.closePath();
  ctx.strokeStyle = withAlpha(theme.markerInk, 0.7);
  ctx.lineWidth = w + 2;
  ctx.stroke();
  ctx.strokeStyle = theme.sensedItem;
  ctx.lineWidth = w;
  ctx.stroke();
  const pp = 2 * Math.max(1, Math.round(cs / 20));
  ctx.fillStyle = theme.sensedItem;
  ctx.fillRect(cx - Math.floor(pp / 2), cy - Math.floor(pp / 2), pp, pp);
  ctx.restore();
}
