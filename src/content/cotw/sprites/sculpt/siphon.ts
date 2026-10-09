import { E, K, P, X, Lt, Sh, breath, type Prim, type PrimTree } from './kit';
import { block, ring, rune } from './fixture';
import './materials';

type Out = PrimTree[number][];

const PI = Math.PI;

/** A point on a cubic bezier (flat list of four x,y control points) at u. */
function bez(p: number[], u: number): [number, number] {
  const v = 1 - u;
  return [v * v * v * p[0] + 3 * v * v * u * p[2] + 3 * v * u * u * p[4] + u * u * u * p[6], v * v * v * p[1] + 3 * v * v * u * p[3] + 3 * v * u * u * p[5] + u * u * u * p[7]];
}

/** A chain hanging between two points, sagging by `sag`: n + 1 links alternating face-on and edge-on. */
function chain(x1: number, y1: number, x2: number, y2: number, sag: number, n: number, m: string): Prim[] {
  const out: Prim[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = x1 + (x2 - x1) * u;
    const y = y1 + (y2 - y1) * u + sag * 4 * u * (1 - u);
    out.push(i % 2 ? E(x, y, 0.42, 0.85, m) : E(x, y, 0.95, 0.55, m));
  }
  return out;
}

/**
 * The Siphon Altar of Járnviðr (floor 22), four idle frames: a chained black slab where the
 * captives bled, their life rising as a stream that turns from blood to violet as the rune-stone
 * behind drinks it.
 */
export function siphonAltarModel(f: number): PrimTree {
  const st = 'fix_blackStone';
  const bi = 'blackIron';
  const out: Out = [Sh(15.6, 28.6, 13.5, 2.4, 0.55)];
  // the rune-stone behind, drinking
  out.push(P([18.2, 24, 27.6, 24, 28.2, 12.6, 26.6, 5.4, 22.6, 3.2, 19.2, 5.2, 17.8, 12.8], st, { bv: 1.3, ink: 0.06 }));
  out.push(rune('thurisaz', 23.2, 11.4, 6.2, 'emUnholy', { ink: [0, 0.05, 0.1, 0.05][f % 4] }));
  // the slab, bound in black iron
  out.push(block(3.6, 19.4, 21.6, 28.6, 3.4, st, { frontInk: 0.04 }));
  out.push(K(6.4, 19.6, 6.4, 28.4, 0.75, 0.75, bi), K(18.8, 19.6, 18.8, 28.4, 0.75, 0.75, bi));
  out.push(K(3.8, 19.5, 21.6, 19.5, 0.7, 0.7, bi), K(3.8, 27.6, 21.6, 27.6, 0.55, 0.55, bi));
  // blood pooled on the slab, and the manacles around it
  out.push(E(12, 17.7, 4.8, 1.05, 'fix_bloodPool', { fl: 0.85 }));
  out.push(ring(6.4, 17.4, 1.3, 0.75, 0.38, 'iron'), ring(19.2, 17.1, 1.3, 0.75, 0.38, 'iron'));
  // chains: draped across the front and down to the floor
  out.push(chain(4.2, 20.8, 21, 20.8, 4.2, 15, 'iron'));
  out.push(chain(3.4, 19.6, 1.6, 28.4, 0.6, 6, 'iron'), chain(21.8, 19.6, 24, 28.6, 0.6, 6, 'iron'));
  // the siphon: blood rising, turning violet as it nears the stone
  const path = [12, 17.6, 10.4, 10.6, 17.4, 4.4, 22.6, 10];
  const N = 12;
  let prev: [number, number] | null = null;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const [x, y] = bez(path, u);
    const [x2, y2] = bez(path, Math.min(1, u + 0.01));
    const len = Math.hypot(x2 - x, y2 - y) || 1;
    const nx = -(y2 - y) / len;
    const ny = (x2 - x) / len;
    const w = 0.42 * Math.sin(u * PI * 4 - (f * PI) / 2) * Math.sin(u * PI);
    const pt: [number, number] = [x + nx * w, y + ny * w];
    const mi = Math.min(4, Math.floor(u * 4.99));
    if (prev) out.push(K(prev[0], prev[1], pt[0], pt[1], 1.25 - u * 0.5, 1.2 - u * 0.5, `fix_sip${mi}`, { ink: -0.06 }));
    prev = pt;
  }
  // motes of life carried up the stream
  for (let i = 0; i < 4; i++) {
    const u = ((i + f / 4) / 4) * 0.9 + 0.04;
    const [x, y] = bez(path, u);
    out.push(E(x - 0.9, y, 0.55, 0.55, `fix_sip${Math.min(4, Math.floor(u * 4.99))}`, { ink: 0.2 }));
  }
  out.push(Lt(23, 10.6, 12, '#a868ff', 1.0), Lt(12, 16.6, 8, '#c8304a', 0.55));
  return out;
}

/**
 * The Siphon Core (the floor-21 pylon), four idle frames: a violet crystal gripped in an iron
 * claw, its core breathing in and out, the ᛟ rune it serves cut in the plinth.
 */
export function siphonCoreModel(f: number): PrimTree {
  const bi = 'blackIron';
  const p = breath(f);
  const out: Out = [Sh(16, 28.6, 9.5, 2.3, 0.5)];
  out.push(block(9.4, 23, 22.6, 28.8, 2.2, 'stoneDark', { frontInk: 0.04 }));
  // the back strut of the frame
  out.push(K(16.6, 22.6, 17.6, 12, 0.8, 0.65, bi, { ink: -0.1 }));
  // the crystal: three facets and a pulsing core
  const A = [16, 1.8];
  const ink = (p - 0.5) * 0.12;
  out.push(P([12.6, 7, A[0], A[1], 14.8, 7.6, 14.8, 18.2, 16, 21.6, 12.6, 17.6], 'fix_crystal', { ink: 0.04 + ink }));
  out.push(P([14.8, 7.6, A[0], A[1], 17.4, 7.6, 17.4, 18.2, 16, 21.6, 14.8, 18.2], 'fix_crystal', { ink: -0.1 + ink }));
  out.push(P([17.4, 7.6, A[0], A[1], 19.4, 7, 19.4, 17.6, 16, 21.6, 17.4, 18.2], 'fix_crystal', { ink: -0.3 + ink }));
  out.push(K(16, 6, 16, 17.6, 0.55 + p * 0.3, 0.55 + p * 0.3, 'fix_crystalCore', { fl: 0.5 }));
  out.push(X(13.4, 7.8, 0.5, 6, 'fix_crystalCore:5', { em: true }));
  // the collar and claws that hold it
  out.push(E(16, 19.8, 4.6, 1.5, bi));
  out.push(K(12.2, 20, 12, 11.2, 0.75, 0.55, bi), K(12, 11.2, 13.2, 9, 0.55, 0.35, bi));
  out.push(K(19.8, 20, 20, 11.2, 0.75, 0.55, bi), K(20, 11.2, 18.8, 9, 0.55, 0.35, bi));
  out.push(K(13.2, 20.6, 10.4, 23.6, 0.8, 0.9, bi), K(18.8, 20.6, 21.6, 23.6, 0.8, 0.9, bi));
  // ᛟ on the plinth
  out.push(rune('othala', 16, 25.9, 4.4, 'emUnholy', { r: 0.5, aspect: 0.85, ink: p * 0.08 }));
  out.push(Lt(16, 11, 12, '#a868ff', 0.7 + 0.35 * p), Lt(16, 26, 5, '#a868ff', 0.5));
  return out;
}
