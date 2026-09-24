import type { Position } from '../../types';

/**
 * Character-grid primitives shared by the layout strategies (`strategies.ts`).
 *
 * A layout is drafted as a grid of single characters, then converted to a `GameMap`
 * once it is final (`toGameMap`). The grid keeps topology edits (carving, stitching,
 * flood fills) cheap and makes a layout printable as ASCII in tests.
 *
 *   '#' rock   '.' floor   '~' shallow water   'X' chasm   '+' closed door   "'" open door
 *   'B' iron bars   'P' pillar   'S' secret door   '?' vault interior (walkable, never carved)
 *
 * Every function here is deterministic: randomness comes only from the `rand` callback
 * the caller passes (the floor's PRNG), and noise is a pure hash of coordinates (§7.2).
 */
export type CharGrid = string[][];

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const DIR4: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR8: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Cells a walker can stand on or pass through (closed doors open on bump). */
export function isWalkable(c: string): boolean {
  return c === '.' || c === '+' || c === "'" || c === '~' || c === '?';
}

export function makeGrid(width: number, height: number, fill = '#'): CharGrid {
  return Array.from({ length: height }, () => new Array<string>(width).fill(fill));
}

export function inRect(rect: Rect | null | undefined, x: number, y: number): boolean {
  return !!rect && x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
}

export function isInterior(g: CharGrid, x: number, y: number): boolean {
  return x > 0 && y > 0 && y < g.length - 1 && x < g[0].length - 1;
}

/** Stable [0, 1) hash of integer coordinates. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1) over integer coordinates, `scale` cells per lattice step. */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Walk distances from (sx, sy) over walkable cells, 4-connected. `blocked` removes one
 * cell index; `secretsOpen` lets secret doors count as passages.
 */
export function walkDistances(
  g: CharGrid,
  sx: number,
  sy: number,
  opts: { blocked?: number; secretsOpen?: boolean } = {}
): Int32Array {
  const h = g.length;
  const w = g[0].length;
  const d = new Int32Array(w * h).fill(-1);
  const start = sy * w + sx;
  const queue = [start];
  d[start] = 0;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] >= 0 || j === opts.blocked) continue;
      const c = g[ny][nx];
      if (isWalkable(c) || (opts.secretsOpen && c === 'S')) {
        d[j] = d[i] + 1;
        queue.push(j);
      }
    }
  }
  return d;
}

/** Chebyshev distance from every cell to the nearest non-walkable cell. */
export function distanceToRock(g: CharGrid): Int32Array {
  const h = g.length;
  const w = g[0].length;
  const d = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isWalkable(g[y][x])) {
        d[y * w + x] = 0;
        queue.push(y * w + x);
      }
    }
  }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIR8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] < 0) {
        d[j] = d[i] + 1;
        queue.push(j);
      }
    }
  }
  return d;
}

/** 4-connected regions of plain floor ('.'), largest first. */
export function floorRegions(g: CharGrid): Position[][] {
  const h = g.length;
  const w = g[0].length;
  const seen = new Uint8Array(w * h);
  const out: Position[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || g[y][x] !== '.') continue;
      const region: Position[] = [];
      const stack: Position[] = [{ x, y }];
      seen[y * w + x] = 1;
      while (stack.length > 0) {
        const p = stack.pop()!;
        region.push(p);
        for (const [dx, dy] of DIR4) {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || g[ny][nx] !== '.') continue;
          seen[ny * w + nx] = 1;
          stack.push({ x: nx, y: ny });
        }
      }
      out.push(region);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

function isProtected(protect: readonly Rect[], x: number, y: number): boolean {
  for (const r of protect) if (inRect(r, x, y)) return true;
  return false;
}

/** Turns interior rock into `c`, never touching protected (vault) rectangles. */
export function carveRock(g: CharGrid, x: number, y: number, protect: readonly Rect[] = [], c = '.'): void {
  if (isInterior(g, x, y) && g[y][x] === '#' && !isProtected(protect, x, y)) g[y][x] = c;
}

/**
 * A wandering tunnel from `from` to `to`. `wiggle` is the chance per step of a sideways
 * step; `width` 2 carves a 2x2 brush (a readable backbone).
 */
export function tunnel(
  g: CharGrid,
  rand: () => number,
  from: Position,
  to: Position,
  width: number,
  wiggle: number,
  protect: readonly Rect[] = []
): void {
  const w = g[0].length;
  const h = g.length;
  let { x, y } = from;
  const brush = (bx: number, by: number) => {
    for (let i = 0; i < width; i++) for (let j = 0; j < width; j++) carveRock(g, bx + i, by + j, protect);
  };
  for (let n = 0; (x !== to.x || y !== to.y) && n < 4000; n++) {
    brush(x, y);
    const dx = to.x - x;
    const dy = to.y - y;
    if (rand() < wiggle) {
      if (Math.abs(dx) >= Math.abs(dy)) y += rand() < 0.5 ? 1 : -1;
      else x += rand() < 0.5 ? 1 : -1;
    } else if (dx !== 0 && (dy === 0 || rand() < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy)))) {
      x += Math.sign(dx);
    } else {
      y += Math.sign(dy);
    }
    x = Math.max(1, Math.min(w - 2, x));
    y = Math.max(1, Math.min(h - 2, y));
  }
  brush(to.x, to.y);
}

/**
 * Carves the shortest path through rock from (sx, sy) to the nearest walkable cell
 * outside `exclude`, never through a protected rectangle. Returns false if none is
 * reachable.
 */
export function connectOut(
  g: CharGrid,
  sx: number,
  sy: number,
  exclude: Rect | null,
  protect: readonly Rect[] = []
): boolean {
  const w = g[0].length;
  const h = g.length;
  const prev = new Int32Array(w * h).fill(-2);
  const start = sy * w + sx;
  const queue = [start];
  prev[start] = -1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % w;
    const y = (i - x) / w;
    if (k > 0 && isWalkable(g[y][x]) && !inRect(exclude, x, y)) {
      for (let j = prev[i]; j >= 0; j = prev[j]) {
        const jx = j % w;
        const jy = (j - jx) / w;
        if (g[jy][jx] === '#') g[jy][jx] = '.';
      }
      return true;
    }
    for (const [dx, dy] of DIR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2) continue;
      const j = ny * w + nx;
      if (prev[j] !== -2 || inRect(exclude, nx, ny)) continue;
      const c = g[ny][nx];
      if ((c === '#' && !isProtected(protect, nx, ny)) || isWalkable(c)) {
        prev[j] = i;
        queue.push(j);
      }
    }
  }
  return false;
}

/**
 * Joins every walkable cell to `from` by tunnelling through rock (never through a
 * protected rectangle). Cells listed in `sealed` (secret caches) are left alone; a
 * pocket that cannot be joined is filled in, so no walkable cell is ever stranded.
 */
export function joinAll(g: CharGrid, from: Position, protect: readonly Rect[] = [], sealed?: ReadonlySet<number>): void {
  const w = g[0].length;
  const h = g.length;
  for (let guard = 0; guard < 200; guard++) {
    const d = walkDistances(g, from.x, from.y, { secretsOpen: true });
    let stray = -1;
    for (let i = 0; i < d.length && stray < 0; i++) {
      const x = i % w;
      const y = (i - x) / w;
      // Vault interiors are authored (a caged monster stays caged); only their connectors must join.
      if (d[i] < 0 && isWalkable(g[y][x]) && !sealed?.has(i) && !isProtected(protect, x, y)) stray = i;
    }
    if (stray < 0) return;
    const prev = new Int32Array(w * h).fill(-2);
    const queue = [stray];
    prev[stray] = -1;
    let joined = false;
    for (let k = 0; k < queue.length && !joined; k++) {
      const i = queue[k];
      if (d[i] >= 0) {
        for (let j = prev[i]; j >= 0; j = prev[j]) {
          const jx = j % w;
          const jy = (j - jx) / w;
          if (g[jy][jx] === '#') g[jy][jx] = '.';
        }
        joined = true;
        break;
      }
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2) continue;
        const j = ny * w + nx;
        if (prev[j] !== -2) continue;
        const c = g[ny][nx];
        if ((c === '#' && !isProtected(protect, nx, ny)) || isWalkable(c) || c === 'S') {
          prev[j] = i;
          queue.push(j);
        }
      }
    }
    if (!joined) {
      // Fill the whole unreachable pocket rather than leave it stranded.
      const sx = stray % w;
      const sy = (stray - sx) / w;
      const pocket = walkDistances(g, sx, sy);
      for (let i = 0; i < pocket.length; i++) {
        if (pocket[i] < 0) continue;
        const x = i % w;
        const y = (i - x) / w;
        if (!isProtected(protect, x, y)) g[y][x] = '#';
      }
    }
  }
}

/** An irregular ellipse of `c`, edges roughened by coordinate noise. Only rock (or floor, when `c` isn't floor) changes. */
export function carveBlob(
  g: CharGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  c = '.',
  protect: readonly Rect[] = []
): void {
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (!isInterior(g, x, y) || isProtected(protect, x, y)) continue;
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e > 0.78 + valueNoise(x, y, 2.5, seed) * 0.44) continue;
      if (g[y][x] === '#' || (c !== '.' && g[y][x] === '.')) g[y][x] = c;
    }
  }
}

/**
 * Cellular-automaton caves (B5678/S45678), then pockets are stitched to the largest cave
 * with tunnels instead of being deleted, so the whole floor stays in play.
 */
export function cellularCaves(rand: () => number, width: number, height: number, wallChance: number): CharGrid {
  let solid: number[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : rand() < wallChance ? 1 : 0
    )
  );
  for (let step = 0; step < 5; step++) {
    const next = solid.map((row) => row.slice());
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += solid[y + dy][x + dx];
        next[y][x] = n >= 5 ? 1 : 0;
      }
    }
    solid = next;
  }
  const g = makeGrid(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!solid[y][x]) g[y][x] = '.';

  const regions = floorRegions(g);
  for (const region of regions) if (region.length < 10) for (const p of region) g[p.y][p.x] = '#';
  const kept = regions.filter((r) => r.length >= 10);
  const main: Position[] = kept[0] ? kept[0].slice() : [];
  for (let k = 1; k < kept.length; k++) {
    let best = Infinity;
    let a: Position = kept[k][0];
    let b: Position = main[0];
    for (let s = 0; s < 36; s++) {
      const p = kept[k][Math.floor(rand() * kept[k].length)];
      for (let t = 0; t < main.length; t += 3) {
        const q = main[t];
        const dd = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
        if (dd < best) {
          best = dd;
          a = p;
          b = q;
        }
      }
    }
    tunnel(g, rand, a, b, rand() < 0.5 ? 2 : 1, 0.25);
    main.push(...kept[k]);
  }
  return g;
}

/**
 * Cuts a 3x3 cache into solid rock behind a secret door off a walkable cell, keeping a
 * full ring of rock around it. Returns the cache cells' indices (empty if none fit).
 */
export function carveSecretCache(g: CharGrid, rand: () => number, protect: readonly Rect[] = []): Set<number> {
  const w = g[0].length;
  const h = g.length;
  const cache = new Set<number>();
  for (let t = 0; t < 500; t++) {
    const x = 3 + Math.floor(rand() * (w - 6));
    const y = 3 + Math.floor(rand() * (h - 6));
    if (g[y][x] !== '#' || isProtected(protect, x, y)) continue;
    for (const [dx, dy] of DIR4) {
      const approach = g[y - dy][x - dx];
      if (approach !== '.') continue;
      const cx = x + dx * 2;
      const cy = y + dy * 2;
      let fits = true;
      for (let a = -2; a <= 2 && fits; a++) {
        for (let b = -2; b <= 2; b++) {
          const qx = cx + a;
          const qy = cy + b;
          if (qx < 1 || qy < 1 || qx > w - 2 || qy > h - 2 || g[qy][qx] !== '#' || isProtected(protect, qx, qy)) {
            fits = false;
            break;
          }
        }
      }
      if (!fits) continue;
      g[y][x] = 'S';
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          g[cy + b][cx + a] = '.';
          cache.add((cy + b) * w + cx + a);
        }
      }
      return cache;
    }
  }
  return cache;
}
