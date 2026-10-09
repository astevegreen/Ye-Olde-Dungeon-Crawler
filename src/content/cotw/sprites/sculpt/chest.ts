import { E, K, P, X, Lt, Sh, type Prim, type PrimTree, type Variant } from './kit';
import { glint, ring } from './fixture';
import './materials';

type Out = PrimTree[number][];

/**
 * A chest's geometry: a box (front x0..x1 by y0..y1, depth d receding up and a little right)
 * and a barrel lid lidH tall, thrown back lidOpen when open.
 */
interface Chest {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  d: number;
  lidH: number;
  lidOpen?: number;
  band: string;
  wood: string;
  /** Open and empty: the inside reads darker. */
  dark?: boolean;
}

/** The box: its shadowed right side, its planked front and a band along the foot. */
function chestBody(o: Chest): Prim[] {
  const wd = o.wood;
  const { x0, x1, y0, y1, d } = o;
  const ex = d * 0.3;
  return [
    P([x1, y0, x1 + ex, y0 - d, x1 + ex, y1 - d, x1, y1], wd, { n: [0.7, -0.2, 0.7], bv: 0.4 }),
    P([x0, y0, x1, y0, x1, y1, x0, y1], wd, { bv: 0.8 }),
    X(x0 + 0.5, y0 + (y1 - y0) * 0.36, x1 - x0 - 1, 0.45, `${wd}:1`),
    X(x0 + 0.5, y0 + (y1 - y0) * 0.68, x1 - x0 - 1, 0.45, `${wd}:1`),
    K(x0 + 0.2, y1 - 0.6, x1 - 0.2, y1 - 0.6, 0.55, 0.55, o.band),
  ];
}

function lidGeom(o: Chest): { ex: number; yt: number; t: number; tx: number } {
  const ex = o.d * 0.3;
  const yt = o.y0 - o.lidH;
  const t = o.d * 0.8;
  return { ex, yt, t, tx: ex * 0.8 };
}

/** A shut barrel lid: its rounded end cap, its curved top catching the light, its front. */
function closedLid(o: Chest): Prim[] {
  const wd = o.wood;
  const { x0, x1, y0, d } = o;
  const { ex, yt, t, tx } = lidGeom(o);
  return [
    P([x1, y0, x1 + ex, y0 - d, x1 + ex, yt - t + 1.4, x1 + tx, yt - t, x1 + 0.4, yt + 0.2], wd, { n: [0.7, -0.35, 0.6], bv: 0.5 }),
    P([x0 + 0.4, yt + 0.4, x1, yt + 0.4, x1 + tx, yt - t, x0 + 0.9 + tx, yt - t], wd, { n: [0, -0.9, 0.45], bv: 0.7 }),
    X(x0 + 0.8 + tx * 0.5, yt - t * 0.5, x1 - x0 - 0.8, 0.4, `${wd}:2`),
    P([x0, y0, x1, y0, x1, yt + 0.4, x0, yt + 0.4], wd, { bv: 1.2, n: [0, -0.12, 1] }),
  ];
}

/** The lid thrown back, its inside toward us, over the open box's dark back wall and floor. */
function openLid(o: Chest): Prim[] {
  const wd = o.wood;
  const { x0, x1, y0, d } = o;
  const ex = d * 0.3;
  const back = y0 - d;
  const open = o.lidOpen ?? 0;
  return [
    P([x0 + ex, back + 0.4, x1 + ex, back + 0.4, x1 + ex + 1.2, back - open, x0 + ex + 1.2, back - open], wd, { n: [0, 0.25, 1], bv: 0.7, ink: -0.16 }),
    X(x0 + ex + 1, back - open * 0.5, x1 - x0 - 1, 0.45, `${wd}:1`),
    K(x0 + ex + 1.3, back - open + 0.3, x1 + ex + 1.1, back - open + 0.3, 0.55, 0.55, o.band),
    P([x0, y0, x1, y0, x1 + ex, back, x0 + ex, back], 'fix_chestIn', { n: [0, 0.4, 1], ink: o.dark ? -0.3 : -0.12 }),
    P([x0 + 0.6, y0, x1 - 0.2, y0, x1 + ex - 0.4, back + 1.2, x0 + ex + 0.6, back + 1.2], 'fix_chestIn', { n: [0, -0.2, 1], ink: o.dark ? -0.42 : -0.25 }),
  ];
}

/** Iron straps down the front at each x; on a shut chest they run on over the lid. */
function straps(o: Chest, xs: number[], closed: boolean): Prim[] {
  const out: Prim[] = [];
  const { yt, t, tx } = lidGeom(o);
  for (const x of xs) {
    out.push(K(x, o.y0, x, o.y1 - 0.4, 0.62, 0.62, o.band, { fl: 0.4 }));
    if (closed) out.push(K(x, o.y0, x, yt + 0.6, 0.62, 0.62, o.band, { fl: 0.4 }), K(x, yt + 0.6, x + tx * 0.9, yt - t + 0.5, 0.6, 0.6, o.band, { fl: 0.4 }));
  }
  return out;
}

/** A hasp plate with its keyhole, centred at (x, y). */
function lock(x: number, y: number, m = 'bronze', big = false): Prim[] {
  const w = big ? 2.2 : 1.5;
  const h = big ? 3.2 : 2.4;
  return [P([x - w, y - h / 2, x + w, y - h / 2, x + w, y + h / 2 - 0.5, x, y + h / 2 + 0.5, x - w, y + h / 2 - 0.5], m, { bv: 0.5 }), X(x - 0.3, y - 0.4, 0.6, 1.3, '#120c0a')];
}

/** The vault chest: wider, black iron and dark planks, gold-studded straps, a gold lock; a glint on one frame. */
function vault(f: number): PrimTree {
  const o: Chest = { x0: 4, x1: 26.6, y0: 18.6, y1: 28, d: 4, lidH: 5.4, band: 'blackIron', wood: 'fix_plankDark' };
  const out: Out = [Sh(16.4, 28.6, 13.5, 2.4, 0.55)];
  out.push(E(5.2, 28.3, 1.5, 1, 'blackIron'), E(25.4, 28.3, 1.5, 1, 'blackIron'));
  const xs = [7, 11.6, 20.8, 25.2];
  out.push(chestBody(o), closedLid(o), straps(o, xs, true));
  out.push(K(o.x0 + 0.1, o.y0, o.x1 - 0.1, o.y0, 0.75, 0.75, 'blackIron'));
  // gold studs along the straps
  for (const x of xs) for (const y of [15.6, 21.4, 25.2]) out.push(X(x - 0.4, y - 0.4, 0.8, 0.8, 'gold:5'));
  // corner caps
  out.push(P([4, 18.6, 6.6, 18.6, 4, 21.4], 'blackIron', { bv: 0.4 }), P([26.6, 18.6, 24, 18.6, 26.6, 21.4], 'blackIron', { bv: 0.4 }));
  out.push(lock(16.3, o.y0 + 1.1, 'gold', true));
  out.push(ring(16.3, 23.4, 1.2, 1, 0.35, 'gold', 8));
  if (f % 4 === 1) out.push(glint(14.4, 17.4, 1, 'fix_dawnCore'));
  return out;
}

/**
 * The chests, four idle frames. State is drawn, not badged: `closed` is lid shut and banded;
 * `gold` the lid thrown back on a hoard that glints; `empty` the lid back on a dark, empty box;
 * `vault` the wider black-iron, gold-studded vault chest. Any other state draws `closed`.
 */
export function chestModel(f: number, v: Variant & { state: 'closed' | 'gold' | 'empty' | 'vault' }): PrimTree {
  const state = v.state || 'closed';
  if (state === 'vault') return vault(f);
  const o: Chest = { x0: 6.4, x1: 24.4, y0: 19.2, y1: 27.8, d: 3.6, lidH: 4.4, lidOpen: 8.2, band: 'iron', wood: 'fix_plank' };
  const out: Out = [Sh(16.4, 28.2, 11, 2.3, 0.5)];
  if (state === 'closed') {
    out.push(chestBody(o), closedLid(o), straps(o, [9.6, 21.2], true));
    out.push(K(o.x0 + 0.1, o.y0, o.x1 - 0.1, o.y0, 0.55, 0.55, 'blackIron'));
    out.push(lock(15.4, o.y0 + 0.4));
    return out;
  }
  out.push(openLid({ ...o, dark: state === 'empty' }));
  if (state === 'gold') {
    out.push(E(15.6, 18.2, 7.6, 2.8, 'gold', { fl: 0.3 }));
    out.push(E(11.2, 17, 1.5, 0.8, 'gold'), E(19.4, 16.6, 1.6, 0.85, 'gold'), E(14.8, 15.6, 1.5, 0.8, 'gold'));
    // a goblet sunk in the hoard
    out.push(K(21.4, 17.6, 21.4, 15.2, 0.45, 0.45, 'gold'), E(21.4, 14.4, 1.5, 1.2, 'gold'), X(20.6, 13.8, 1.6, 0.5, 'gold:5'));
    const gl = [[12.4, 16.6], [17.6, 16], [15, 18.4], [20.8, 13.9]];
    gl.forEach(([x, y], i) => out.push((i + f) % 4 === 0 ? glint(x, y, 1.1, 'fix_dawnCore') : X(x - 0.25, y - 0.25, 0.5, 0.5, 'gold:5')));
    out.push(Lt(15.6, 16.4, 9, '#ffcf6a', 0.6));
  }
  out.push(chestBody(o), straps(o, [9.6, 21.2], false));
  out.push(K(o.x0 + 0.1, o.y0, o.x1 - 0.1, o.y0, 0.55, 0.55, 'blackIron'));
  out.push(lock(15.4, o.y0 + 1.3));
  return out;
}
