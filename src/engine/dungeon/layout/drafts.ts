import type { Position } from '../../types';
import {
  type CharGrid,
  type Rect,
  DIR4,
  DIR8,
  makeGrid,
  inRect,
  isInterior,
  isWalkable,
  valueNoise,
  hash2,
  distanceToRock,
  tunnel,
  carveBlob,
  cellularCaves,
  carveSecretCache,
  walkDistances,
  connectOut,
} from './charGrid';
import { type DraftContext, type LayoutDraft, placeChosenVaults } from './layoutStrategy';

/*
 * Layout drafts: each turns a DraftContext into a character grid plus a spawn point. They
 * are generic shapes (caves, built halls, a rift, a mine lattice, warrens, a spine); a
 * content pack picks one per floor band and tunes it through `layoutParams`
 * (`GameContentManifest.floorLayouts`). Shared params:
 *
 *   landmarkVaultIds   one of these vaults is stamped on every floor (the floor's set piece)
 *   randomVaults       false skips the usual 1–2 random eligible vaults (default true)
 *   secretCaches       how many secret-door caches to try for (default 1)
 */

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function caches(g: CharGrid, ctx: DraftContext, taken: readonly Rect[]): Set<number> {
  const sealed = new Set<number>();
  for (let i = 0; i < num(ctx.params.secretCaches, 1); i++) for (const c of carveSecretCache(g, ctx.rand, taken)) sealed.add(c);
  return sealed;
}

/** A floor cell toward the chosen side of the map, outside vaults. */
function spawnNear(g: CharGrid, ctx: DraftContext, taken: readonly Rect[], side: 'west' | 'east', pred?: (x: number, y: number) => boolean): Position | null {
  const W = g[0].length;
  const cands: Array<Position & { k: number }> = [];
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (g[y][x] !== '.' || taken.some((r) => inRect(r, x, y)) || (pred && !pred(x, y))) continue;
      if (DIR8.some(([dx, dy]) => g[y + dy][x + dx] === 'X' || g[y + dy][x + dx] === '~')) continue;
      cands.push({ x, y, k: (side === 'west' ? x : W - x) + y * 0.15 });
    }
  }
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.k - b.k);
  const c = cands[Math.floor(ctx.rand() * Math.min(12, cands.length))];
  return { x: c.x, y: c.y };
}

// ───────────────────────── caverns ─────────────────────────
/**
 * Stitched cellular caves. Params: `wallChance` (0.45), `lake` (fill the widest open
 * space with shallow water, keeping a walkable shore), `pools` (small liquid blobs),
 * `pits` (small chasms), `groves` (pillar clusters).
 */
export function draftCaverns(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params, seed } = ctx;
  const g = cellularCaves(rand, W, H, num(params.wallChance, 0.45));
  const taken: Rect[] = [];
  const vaults = placeChosenVaults(g, ctx, taken);
  if (!vaults) return null;

  if (bool(params.lake, false)) {
    const dt = distanceToRock(g);
    let best = -1;
    let bi = -1;
    for (let i = 0; i < dt.length; i++) {
      const x = i % W;
      const y = (i - x) / W;
      if (g[y][x] === '.' && dt[i] > best && !taken.some((r) => inRect(r, x, y))) {
        best = dt[i];
        bi = i;
      }
    }
    if (best >= 3) {
      const cx = bi % W;
      const cy = (bi - cx) / W;
      const rx = Math.min(10, best * 2.3);
      const ry = Math.min(7, best * 1.5);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (e < 0.72 + valueNoise(x, y, 3, seed) * 0.5 && dt[y * W + x] >= 2 && g[y][x] === '.') g[y][x] = '~';
        }
      }
    }
  }
  scatter(g, ctx, taken, num(params.pools, 0), (x, y) => carveBlob(g, x, y, 1.6 + rand() * 1.4, 1.2 + rand(), seed + x * 31 + y, '~', taken), 3);
  scatter(g, ctx, taken, num(params.pits, 0), (x, y) => { g[y][x] = 'X'; if (g[y][x + 1] === '.') g[y][x + 1] = 'X'; }, 3);
  scatter(g, ctx, taken, num(params.groves, 0), (x, y) => {
    for (let k = 0; k < 5; k++) {
      const px = x + Math.round((rand() - 0.5) * 5);
      const py = y + Math.round((rand() - 0.5) * 4);
      if (isInterior(g, px, py) && g[py][px] === '.' && DIR8.every(([dx, dy]) => g[py + dy][px + dx] === '.')) g[py][px] = 'P';
    }
  }, 3);

  const sealed = caches(g, ctx, taken);
  const spawn = spawnNear(g, ctx, taken, rand() < 0.5 ? 'west' : 'east');
  if (!spawn) return null;
  return { grid: g, spawn, vaults, sealed };
}

/** Runs `apply` at up to `count` open cells at least `clearance` from rock, outside vaults. */
function scatter(g: CharGrid, ctx: DraftContext, taken: readonly Rect[], count: number, apply: (x: number, y: number) => void, clearance: number): void {
  if (count <= 0) return;
  const W = g[0].length;
  const dt = distanceToRock(g);
  const spots: Position[] = [];
  for (let i = 0; i < dt.length; i++) {
    const x = i % W;
    const y = (i - x) / W;
    if (dt[i] >= clearance && g[y][x] === '.' && !taken.some((r) => inRect(r, x, y))) spots.push({ x, y });
  }
  for (let k = 0; k < count && spots.length > 0; k++) {
    const p = spots.splice(Math.floor(ctx.rand() * spots.length), 1)[0];
    apply(p.x, p.y);
  }
}

// ───────────────────────── halls ─────────────────────────
/**
 * A symmetric built plan: a colonnaded great hall inside a 2-wide ring road, with rooms
 * along every side and doors onto the ring. Params: `centralPit` (a 2x2 chasm in the
 * top- or bottom-centre room, e.g. a forge), `crossDoors` (chance of doors between
 * neighbouring rooms, 0.55). Needs at least 45x32.
 */
export function draftHalls(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params } = ctx;
  if (W < 45 || H < 32) return null;
  const g = makeGrid(W, H);
  const mir = (x: number) => W - 1 - x;
  const rect = (x1: number, y1: number, x2: number, y2: number, c = '.') => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = c;
  };
  const door = () => (rand() < 0.8 ? '+' : "'");
  const rooms: Rect[] = [];
  const cx = Math.floor((W - 1) / 2);
  const cy = Math.floor(H / 2);

  // Ring road: 2 wide, 9 cells in from each side (8-wide rooms, a wall), 7 from top and bottom.
  const rx1 = 11;
  const rx2 = mir(11);
  const ry1 = 8;
  const ry2 = H - 1 - 8;
  for (let x = rx1; x <= rx2; x++) g[ry1][x] = g[ry1 + 1][x] = g[ry2 - 1][x] = g[ry2][x] = '.';
  for (let y = ry1; y <= ry2; y++) g[y][rx1] = g[y][rx1 + 1] = g[y][rx2 - 1] = g[y][rx2] = '.';

  // Great hall, centred, with a colonnade on two rows.
  const hw = Math.min(8, Math.floor((rx2 - rx1 - 12) / 2));
  const hh = Math.min(5, Math.floor((ry2 - ry1 - 8) / 2));
  const hx1 = cx - hw;
  const hx2 = cx + hw;
  const hy1 = cy - hh;
  const hy2 = cy + hh;
  rect(hx1, hy1, hx2, hy2);
  rooms.push({ x1: hx1, y1: hy1, x2: hx2, y2: hy2 });
  for (let d = 2; d <= hw - 2; d += 2) for (const y of [hy1 + 2, hy2 - 2]) g[y][cx - d] = g[y][cx + d] = 'P';
  // Axial passages from the ring to four hall doors.
  for (let y = ry1 + 2; y < hy1 - 1; y++) g[y][cx] = '.';
  g[hy1 - 1][cx] = door();
  for (let y = hy2 + 2; y < ry2 - 1; y++) g[y][cx] = '.';
  g[hy2 + 1][cx] = door();
  for (let x = rx1 + 2; x < hx1 - 1; x++) g[cy][x] = g[cy][mir(x)] = '.';
  g[cy][hx1 - 1] = g[cy][hx2 + 1] = door();

  const addPair = (x1: number, y1: number, x2: number, y2: number, doors: Array<[number, number]>, stubs: Array<[number, number]>, p: number) => {
    if (rand() > p) return;
    for (const m of [false, true]) {
      const X1 = m ? mir(x2) : x1;
      const X2 = m ? mir(x1) : x2;
      rect(X1, y1, X2, y2);
      rooms.push({ x1: X1, y1, x2: X2, y2 });
      for (const [sx, sy] of stubs) g[sy][m ? mir(sx) : sx] = '.';
      for (const [dx, dy] of doors) g[dy][m ? mir(dx) : dx] = door();
    }
  };
  // Side rooms (8 wide) facing the ring, two per side.
  const s1 = { y1: ry1 + 2, y2: cy - 3 };
  const s2 = { y1: cy + 3, y2: ry2 - 2 };
  addPair(2, s1.y1, 9, s1.y2, [[10, Math.floor((s1.y1 + s1.y2) / 2)]], [], 1);
  addPair(2, s2.y1, 9, s2.y2, [[10, Math.floor((s2.y1 + s2.y2) / 2)]], [], 0.85);
  // Corner rooms reach the side rooms through a short passage.
  addPair(2, 2, 9, ry1 - 2, [[5, ry1 + 1]], [[5, ry1 - 1], [5, ry1]], 0.8);
  addPair(2, ry2 + 2, 9, H - 3, [[5, ry2 - 1]], [[5, ry2 + 1], [5, ry2]], 0.8);
  // Top and bottom rooms open onto the ring.
  const topRooms: Rect[] = [];
  const bottomRooms: Rect[] = [];
  const split = rand() < 0.5;
  const spans: Array<[number, number]> = split ? [[rx1, rx1 + 5], [rx1 + 7, cx - 5]] : [[rx1, cx - 5]];
  for (const [a, b] of spans) {
    if (b - a < 4) continue;
    addPair(a, 2, b, ry1 - 2, [[Math.floor((a + b) / 2), ry1 - 1]], [], 0.9);
    addPair(a, ry2 + 2, b, H - 3, [[Math.floor((a + b) / 2), ry2 + 1]], [], 0.9);
  }
  const centre = (y1: number, y2: number, doorY: number, list: Rect[]) => {
    rect(cx - 3, y1, cx + 3, y2);
    const r = { x1: cx - 3, y1, x2: cx + 3, y2 };
    rooms.push(r);
    list.push(r);
    g[doorY][cx] = door();
  };
  centre(2, ry1 - 2, ry1 - 1, topRooms);
  centre(ry2 + 2, H - 3, ry2 + 1, bottomRooms);

  // Doors between side-by-side rooms close loops.
  const crossDoors = num(params.crossDoors, 0.55);
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (g[y][x] !== '#') continue;
      const ew = g[y][x - 1] === '.' && g[y][x + 1] === '.' && g[y - 1][x] === '#' && g[y + 1][x] === '#';
      if (!ew) continue;
      const inA = rooms.some((r) => inRect(r, x - 1, y));
      const inB = rooms.some((r) => inRect(r, x + 1, y));
      const midRow = rooms.find((r) => inRect(r, x - 1, y));
      if (inA && inB && midRow && y === Math.floor((midRow.y1 + midRow.y2) / 2) && hash2(Math.min(x, mir(x)), y, ctx.seed) < crossDoors) {
        g[y][x] = door();
        g[y][mir(x)] = door();
      }
    }
  }

  if (bool(params.centralPit, false)) {
    const r = rand() < 0.5 ? topRooms[0] : bottomRooms[0];
    const py = Math.floor((r.y1 + r.y2) / 2) - 1;
    g[py][cx] = g[py][cx + 1] = g[py + 1][cx] = g[py + 1][cx + 1] = 'X';
  }

  const taken: Rect[] = [];
  const vaults = placeChosenVaults(g, ctx, taken, { maxOpen: 0.5 });
  if (!vaults) return null;
  const west = rand() < 0.5;
  const spawnRoom = rooms.find((r) => r.x1 === (west ? 2 : mir(9)) && r.y1 === s1.y1)!;
  const spawn = { x: Math.floor((spawnRoom.x1 + spawnRoom.x2) / 2), y: Math.floor((spawnRoom.y1 + spawnRoom.y2) / 2) };
  if (g[spawn.y][spawn.x] !== '.') return null;
  const sealed = caches(g, ctx, taken);
  return { grid: g, spawn, rooms: rooms.filter((r) => !taken.some((t) => inRect(t, r.x1, r.y1))), vaults, sealed };
}

// ───────────────────────── rift ─────────────────────────
/**
 * Caves split end to end by a river of chasm (a pack's art can make it lava), with walkable
 * banks and `bridges` (3) crossings. The player starts on one side; the stairs are on the other.
 */
export function draftRift(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params, seed } = ctx;
  const g = cellularCaves(rand, W, H, num(params.wallChance, 0.43));
  // Vaults first, clear of the river's corridor, so a large forced vault always fits a bank.
  const taken: Rect[] = [];
  const mid = H / 2;
  const vaults = placeChosenVaults(g, ctx, taken, { where: (_x, y, _w, h) => y + h + 1 < mid - 4 || y - 1 > mid + 4 });
  if (!vaults) return null;
  const phase = rand() * Math.PI * 2;
  const amp = 2.4 + rand() * 2.4;
  const freq = 0.09 + rand() * 0.05;
  const band: Array<[number, number]> = [];
  for (let x = 0; x < W; x++) {
    let c = Math.round(mid + Math.sin(x * freq + phase) * amp + (valueNoise(x, 3, 5, seed) - 0.5) * 3);
    const w = 2 + (valueNoise(x, 9, 6, seed) > 0.62 ? 1 : 0);
    // Bend around any vault standing over this column.
    for (const r of taken) {
      if (x < r.x1 - 1 || x > r.x2 + 1) continue;
      if (r.y2 < mid) c = Math.max(c, r.y2 + 3);
      else c = Math.min(c, r.y1 - w);
    }
    band[x] = [c - 1, c - 2 + w];
    if (x > 0 && x < W - 1) for (let y = c - 1; y < c - 1 + w; y++) if (!taken.some((r) => inRect(r, x, y))) g[y][x] = 'X';
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (g[y][x] === '#' && !taken.some((r) => inRect(r, x, y)) && DIR4.some(([dx, dy]) => g[y + dy][x + dx] === 'X') && rand() < 0.8) g[y][x] = '.';
    }
  }
  const north = (x: number, y: number) => x > 0 && x < W - 1 && y < band[x][0] - 1;
  const south = (x: number, y: number) => x > 0 && x < W - 1 && y > band[x][1] + 1;
  const bridge = (bx: number) => {
    const r: Rect = { x1: bx, x2: bx + 1, y1: Math.min(band[bx][0], band[bx + 1][0]), y2: Math.max(band[bx][1], band[bx + 1][1]) };
    for (let x = bx; x <= bx + 1; x++) for (let y = band[x][0]; y <= band[x][1]; y++) g[y][x] = '.';
    connectOut(g, bx, r.y1 - 1, r, taken);
    connectOut(g, bx, r.y2 + 1, r, taken);
    for (const y of [r.y1 - 1, r.y2 + 1]) if (g[y][bx] === '#' && !taken.some((t) => inRect(t, bx, y))) g[y][bx] = '.';
  };
  const count = Math.max(2, Math.min(4, num(params.bridges, 3)));
  for (let i = 0; i < count; i++) {
    const f = (i + 1) / (count + 1);
    bridge(Math.max(3, Math.min(W - 5, Math.round(W * f + (rand() - 0.5) * 6))));
  }

  const startNorth = rand() < 0.5;
  const near = startNorth ? north : south;
  const far = startNorth ? south : north;
  const spawn = spawnNear(g, ctx, taken, rand() < 0.5 ? 'west' : 'east', near);
  if (!spawn) return null;
  const sealed = caches(g, ctx, taken);
  // The far bank must be reachable across a bridge; add crossings until it is.
  for (let t = 0; t < 4; t++) {
    const d = walkDistances(g, spawn.x, spawn.y);
    let crosses = false;
    for (let i = 0; i < d.length && !crosses; i++) {
      const x = i % W;
      const y = (i - x) / W;
      if (d[i] >= 0 && g[y][x] === '.' && far(x, y)) crosses = true;
    }
    if (crosses) break;
    bridge(4 + Math.floor(rand() * (W - 9)));
  }
  return { grid: g, spawn, stairsFilter: far, vaults, sealed };
}

// ───────────────────────── lattice ─────────────────────────
/**
 * Straight 1-wide drifts on a grid, spanning-connected then partly looped, with chambers
 * at some junctions and dead-end drifts (about half end in a secret cache). Params:
 * `chamberChance` (0.3), `sump` (a liquid pool in the largest chamber).
 */
export function draftLattice(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params, seed } = ctx;
  const g = makeGrid(W, H);
  const cols = Math.max(4, Math.round((W - 8) / 7) + 1);
  const rows = Math.max(3, Math.round((H - 8) / 7) + 1);
  const xs = Array.from({ length: cols }, (_, i) => Math.round(4 + (i * (W - 9)) / (cols - 1)) + (i > 0 && i < cols - 1 ? Math.floor(rand() * 3) - 1 : 0));
  const ys = Array.from({ length: rows }, (_, j) => Math.round(4 + (j * (H - 9)) / (rows - 1)) + (j > 0 && j < rows - 1 ? Math.floor(rand() * 3) - 1 : 0));
  const parent = Array.from({ length: cols * rows }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const segs: Array<[number, number, number, number]> = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < cols - 1) segs.push([i, j, i + 1, j]);
      if (j < rows - 1) segs.push([i, j, i, j + 1]);
    }
  }
  for (let k = segs.length - 1; k > 0; k--) {
    const t = Math.floor(rand() * (k + 1));
    [segs[k], segs[t]] = [segs[t], segs[k]];
  }
  const used = new Set<string>();
  const take = (s: [number, number, number, number]) => {
    used.add(s.join());
    parent[find(s[1] * cols + s[0])] = find(s[3] * cols + s[2]);
    const [ax, ay, bx, by] = [xs[s[0]], ys[s[1]], xs[s[2]], ys[s[3]]];
    if (ax === bx) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) g[y][ax] = '.';
    else for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) g[ay][x] = '.';
  };
  for (const s of segs) if (rand() < (s[1] === s[3] ? 0.74 : 0.42)) take(s);
  for (const s of segs) if (!used.has(s.join()) && find(s[1] * cols + s[0]) !== find(s[3] * cols + s[2])) take(s);

  const chambers: Rect[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (rand() > num(params.chamberChance, 0.3)) continue;
      const w = 5 + Math.floor(rand() * 3);
      const h = 3 + Math.floor(rand() * 2);
      const x1 = Math.max(2, Math.min(W - w - 2, xs[i] - (w >> 1)));
      const y1 = Math.max(2, Math.min(H - h - 2, ys[j] - (h >> 1)));
      for (let y = y1; y < y1 + h; y++) for (let x = x1; x < x1 + w; x++) g[y][x] = '.';
      chambers.push({ x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 });
    }
  }
  const oi = 1 + Math.floor(rand() * (cols - 2));
  const oj = Math.floor(rand() * (rows - 1));
  const ox = xs[oi] + 3;
  const oy = ys[oj] + 3;
  carveBlob(g, ox, oy, 4.6, 3.2, seed);
  if (bool(params.sump, false)) for (let y = oy; y <= oy + 1; y++) for (let x = ox - 1; x <= ox + 1; x++) if (g[y][x] === '.') g[y][x] = '~';

  // Doors where a drift meets a chamber through a 1-wide mouth.
  for (const r of chambers) {
    for (let x = r.x1; x <= r.x2; x++) {
      for (const y of [r.y1 - 1, r.y2 + 1]) {
        if (g[y]?.[x] === '.' && g[y][x - 1] === '#' && g[y][x + 1] === '#' && rand() < 0.5) g[y][x] = '+';
      }
    }
  }

  const taken: Rect[] = [];
  const vaults = placeChosenVaults(g, ctx, taken);
  if (!vaults) return null;

  // Dead-end drifts; about half end in a secret door and a 3x3 cache.
  const sealed = new Set<number>();
  for (let t = 0, made = 0; t < 80 && made < 5; t++) {
    const i = Math.floor(rand() * cols);
    const j = Math.floor(rand() * rows);
    const [dx, dy] = DIR4[Math.floor(rand() * 4)];
    const len = 3 + Math.floor(rand() * 3);
    const x = xs[i];
    const y = ys[j];
    let clear = true;
    for (let k = 1; k <= len + 4 && clear; k++) {
      const qx = x + dx * k;
      const qy = y + dy * k;
      if (qx < 2 || qy < 2 || qx > W - 3 || qy > H - 3) {
        clear = false;
        break;
      }
      for (let s = -1; s <= 1; s++) {
        const px = qx + (dy ? s : 0);
        const py = qy + (dx ? s : 0);
        if (g[py][px] !== '#' || taken.some((r) => inRect(r, px, py))) {
          clear = false;
          break;
        }
      }
    }
    if (!clear) continue;
    for (let k = 1; k <= len; k++) g[y + dy * k][x + dx * k] = '.';
    if (rand() < 0.55) {
      g[y + dy * (len + 1)][x + dx * (len + 1)] = 'S';
      const cx = x + dx * (len + 3);
      const cy = y + dy * (len + 3);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          g[cy + b][cx + a] = '.';
          sealed.add((cy + b) * W + cx + a);
        }
      }
    }
    made++;
  }
  const west = rand() < 0.5;
  const spawn = { x: xs[west ? 0 : cols - 1], y: ys[Math.floor(rand() * rows)] };
  if (g[spawn.y][spawn.x] !== '.') return null;
  return { grid: g, spawn, vaults, sealed };
}

// ───────────────────────── warrens ─────────────────────────
/**
 * Knot chambers joined by a 2-wide backbone (a minimum spanning tree) plus 1-wide side
 * tunnels that close loops. Params: `chambers` (8), `grove` (ring the largest chamber
 * with pillars around a 2x2 pool).
 */
export function draftWarrens(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params, seed } = ctx;
  const g = makeGrid(W, H);
  const want = num(params.chambers, 8);
  const ch: Array<{ x: number; y: number; rx: number; ry: number }> = [];
  for (let t = 0; t < 800 && ch.length < want; t++) {
    const x = 6 + rand() * (W - 12);
    const y = 5 + rand() * (H - 10);
    if (ch.every((c) => Math.hypot(c.x - x, c.y - y) >= 11)) ch.push({ x, y, rx: 3 + rand() * 2.4, ry: 2.3 + rand() * 1.5 });
  }
  if (ch.length < 3) return null;
  ch.forEach((c, i) => carveBlob(g, c.x, c.y, c.rx, c.ry, seed + i));
  const inTree = new Set([0]);
  const edges: Array<[number, number, number]> = [];
  while (inTree.size < ch.length) {
    let best = Infinity;
    let e: [number, number] = [0, 0];
    for (const a of inTree) {
      ch.forEach((c, b) => {
        if (inTree.has(b)) return;
        const d = Math.hypot(ch[a].x - c.x, ch[a].y - c.y);
        if (d < best) {
          best = d;
          e = [a, b];
        }
      });
    }
    inTree.add(e[1]);
    edges.push([e[0], e[1], 2]);
  }
  ch.forEach((c, a) => {
    const others = ch.map((o, b) => [Math.hypot(o.x - c.x, o.y - c.y), b] as const).filter(([, b]) => b !== a).sort((p, q) => p[0] - q[0]);
    const b = others[1]?.[1];
    if (b !== undefined && rand() < 0.4 && !edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) edges.push([a, b, 1]);
  });
  const at = (c: { x: number; y: number }) => ({ x: Math.round(c.x), y: Math.round(c.y) });
  for (const [a, b, w] of edges) tunnel(g, rand, at(ch[a]), at(ch[b]), w, 0.36);

  let big = 0;
  ch.forEach((c, i) => {
    if (c.rx * c.ry > ch[big].rx * ch[big].ry) big = i;
  });
  if (bool(params.grove, false)) {
    const k = ch[big];
    const kx = Math.round(k.x);
    const ky = Math.round(k.y);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const x = Math.round(k.x + Math.cos(a) * (k.rx - 1.4));
      const y = Math.round(k.y + Math.sin(a) * (k.ry - 1.1));
      if (g[y][x] === '.' && DIR8.every(([dx, dy]) => isWalkable(g[y + dy][x + dx]))) g[y][x] = 'P';
    }
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (g[ky + dy][kx + dx] === '.') g[ky + dy][kx + dx] = '~';
  }
  ch.forEach((c, i) => {
    if (i === big || c.rx < 4 || rand() > 0.6) return;
    const x = Math.round(c.x + (rand() < 0.5 ? -1.5 : 1.5));
    const y = Math.round(c.y);
    if (g[y][x] === '.' && DIR8.every(([dx, dy]) => isWalkable(g[y + dy][x + dx]))) g[y][x] = 'P';
  });

  const taken: Rect[] = [];
  const vaults = placeChosenVaults(g, ctx, taken);
  if (!vaults) return null;
  const sealed = caches(g, ctx, taken);
  const spawn = spawnNear(g, ctx, taken, rand() < 0.5 ? 'west' : 'east');
  if (!spawn) return null;
  return { grid: g, spawn, vaults, sealed };
}

// ───────────────────────── spine ─────────────────────────
/**
 * A 2-wide spine passage west to east, with curved ribs branching into chambers, some
 * joined by side passages. Params: `pits` (chambers holding a 2-wide chasm, 2), `pool`
 * (a round chamber with a pool at the east end).
 */
export function draftSpine(ctx: DraftContext): LayoutDraft | null {
  const { rand, width: W, height: H, params, seed } = ctx;
  const g = makeGrid(W, H);
  const mid = Math.floor(H / 2) - 1;
  const phase = rand() * Math.PI * 2;
  const sp = (x: number) => mid + Math.round(Math.sin(x * 0.22 + phase) * 1.3);
  for (let x = 3; x <= W - 4; x++) {
    g[sp(x)][x] = '.';
    g[sp(x) + 1][x] = '.';
  }
  const tips: Array<{ x: number; y: number; s: number }> = [];
  const ribs = Math.floor((W - 14) / 6);
  for (let k = 0; k < ribs; k++) {
    const x0 = 7 + k * 6 + Math.floor(rand() * 2);
    const sides = [k % 2 ? 1 : -1];
    if (rand() < 0.45) sides.push(-sides[0]);
    for (const s of sides) {
      let x = x0;
      let y = sp(x0) + (s < 0 ? -1 : 2);
      const len = Math.floor(H / 5) + Math.floor(rand() * 4);
      for (let i = 0; i < len; i++) {
        if (isInterior(g, x, y) && g[y][x] === '#') g[y][x] = '.';
        y = Math.max(3, Math.min(H - 4, y + s));
        if (i % 3 === 2) x = Math.min(W - 4, x + 1);
      }
      const cy = Math.max(4, Math.min(H - 5, y + s * 1.5));
      carveBlob(g, x, cy, 3 + rand(), 2 + rand() * 0.6, seed + k * 7 + s);
      tips.push({ x, y: cy, s });
    }
  }
  for (const s of [-1, 1]) {
    const t = tips.filter((q) => q.s === s).sort((a, b) => a.x - b.x);
    for (let i = 1; i < t.length; i++) {
      if (rand() < 0.5) tunnel(g, rand, { x: Math.round(t[i - 1].x), y: Math.round(t[i - 1].y) }, { x: Math.round(t[i].x), y: Math.round(t[i].y) }, 1, 0.25);
    }
  }
  if (bool(params.pool, false)) {
    const ex = W - 8;
    const ey = sp(ex) + 0.5;
    carveBlob(g, ex, ey, 4.4, 3.8, seed + 99);
    for (let y = Math.round(ey) - 1; y <= Math.round(ey); y++) for (let x = ex - 1; x <= ex + 1; x++) if (g[y][x] === '.') g[y][x] = '~';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.round(ex + Math.cos(a) * 3.2);
      const y = Math.round(ey + Math.sin(a) * 2.6);
      if (g[y]?.[x] === '.' && DIR8.every(([dx, dy]) => isWalkable(g[y + dy][x + dx]))) g[y][x] = 'P';
    }
  }
  const pits = num(params.pits, 2);
  for (const t of tips.slice(1, 1 + pits)) {
    const x = Math.round(t.x);
    const y = Math.round(t.y);
    if (g[y][x] === '.' && g[y][x + 1] === '.') g[y][x] = g[y][x + 1] = 'X';
  }

  const taken: Rect[] = [];
  const vaults = placeChosenVaults(g, ctx, taken);
  if (!vaults) return null;
  const sealed = caches(g, ctx, taken);
  const spawn = { x: 3, y: sp(3) };
  return { grid: g, spawn, vaults, sealed };
}
