import type { Position } from '../../types';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import type { TileDefinition } from '../../types';
import { Monster } from '../../entities/monster';
import { PRNG } from '../prng';
import { VaultStamper, type VaultBlueprint } from '../vaultStamp';
import type { RectRoom } from '../dungeon-generator';
import type { DungeonGenParams, DungeonGeneratorStrategy, GeneratedFloorData } from '../generator';
import {
  type CharGrid,
  type Rect,
  DIR4,
  inRect,
  isWalkable,
  walkDistances,
  connectOut,
  joinAll,
} from './charGrid';

/** A vault chosen for a draft: where its blueprint sits and whether it is the floor's forced vault. */
export interface VaultPlan {
  blueprint: VaultBlueprint;
  x: number;
  y: number;
  rect: Rect;
  forced: boolean;
}

/** What a draft function hands back: the grid plus where things go. */
export interface LayoutDraft {
  grid: CharGrid;
  spawn: Position;
  /** Limits where the down stairs may go (e.g. the far bank of a rift). */
  stairsFilter?: (x: number, y: number) => boolean;
  /** Rooms the draft built itself (halls). Organic drafts leave this out and get virtual rooms. */
  rooms?: Rect[];
  vaults: VaultPlan[];
  /** Secret-cache cells: reachable only through a secret door. */
  sealed?: ReadonlySet<number>;
}

export interface DraftContext {
  rand: () => number;
  width: number;
  height: number;
  /** Stable per-floor seed for coordinate noise. */
  seed: number;
  params: Readonly<Record<string, unknown>>;
  gen: DungeonGenParams;
}

export type LayoutDraftFn = (ctx: DraftContext) => LayoutDraft | null;

const ATTEMPTS = 8;

/**
 * A `DungeonGeneratorStrategy` backed by a character-grid draft (ARCHITECTURE.md §3: a
 * generic layout capability; which floors use it is content's `floorLayouts`).
 *
 * The runner owns what every strategy must guarantee: forced and random vaults stamp
 * through `VaultStamper`, every walkable cell joins the network, the down stairs are
 * reachable from the spawn, the spawn is never in a vault or a hazard, and the result
 * carries `RectRoom[]` for population. A draft that can't meet those after a few
 * attempts falls back to `fallback` (rooms and corridors).
 */
export class LayoutStrategy implements DungeonGeneratorStrategy {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly draft: LayoutDraftFn,
    private readonly fallback: (params: DungeonGenParams) => GeneratedFloorData
  ) {}

  public generate(params: DungeonGenParams): GeneratedFloorData {
    const prng = new PRNG(params.seed);
    const rand = () => prng.next();
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const ctx: DraftContext = {
        rand,
        width: params.width,
        height: params.height,
        seed: Math.floor(rand() * 0x7fffffff),
        params: params.layoutParams ?? {},
        gen: params,
      };
      const draft = this.draft(ctx);
      if (!draft) continue;
      const result = finishDraft(draft, ctx);
      if (result) return result;
    }
    return this.fallback(params);
  }
}

// ───────────────────────── vault placement ─────────────────────────

/** The floor's vaults in placement order: forced first, then one landmark, then 1–2 random eligible ones. */
export function chooseVaults(ctx: DraftContext): Array<{ blueprint: VaultBlueprint; forced: boolean; required: boolean }> {
  const { gen, rand } = ctx;
  const all = gen.vaults ?? [];
  const floor = gen.floorNumber ?? 1;
  const out: Array<{ blueprint: VaultBlueprint; forced: boolean; required: boolean }> = [];
  const used = new Set<string>();
  if (gen.forcedVaultId) {
    const forced = all.find((v) => v.id === gen.forcedVaultId);
    if (forced) {
      out.push({ blueprint: forced, forced: true, required: true });
      used.add(forced.id);
    }
  }
  const landmarkIds = (ctx.params.landmarkVaultIds as string[] | undefined) ?? [];
  const landmarks = landmarkIds.map((id) => all.find((v) => v.id === id)).filter((v): v is VaultBlueprint => !!v && !used.has(v.id));
  if (landmarks.length > 0) {
    const pick = landmarks[Math.floor(rand() * landmarks.length)];
    out.push({ blueprint: pick, forced: false, required: false });
    used.add(pick.id);
  }
  if (ctx.params.randomVaults !== false) {
    const eligible = all.filter(
      (v) =>
        !used.has(v.id) &&
        !v.scriptedOnly &&
        !landmarkIds.includes(v.id) &&
        (v.minFloor ?? 1) <= floor &&
        (!v.maxFloor || v.maxFloor >= floor)
    );
    const count = eligible.length > 0 ? 1 + Math.floor(rand() * 2) : 0;
    for (let i = 0; i < count; i++) {
      const pick = eligible[Math.floor(rand() * eligible.length)];
      if (used.has(pick.id)) continue;
      out.push({ blueprint: pick, forced: false, required: false });
      used.add(pick.id);
    }
  }
  return out;
}

export interface VaultSiteRules {
  /** Largest share of the footprint (plus a 1-cell margin) that may already be open. */
  maxOpen?: number;
  /** Extra acceptance test on the footprint's top-left corner and size. */
  where?: (x: number, y: number, w: number, h: number) => boolean;
}

/**
 * Stamps a blueprint's characters into the grid and carves each connector out to the
 * nearest walkable cell. Interior walkable cells become '?', which carving never touches.
 */
export function placeVault(
  g: CharGrid,
  ctx: DraftContext,
  blueprint: VaultBlueprint,
  taken: Rect[],
  rules: VaultSiteRules = {}
): VaultPlan | null {
  const W = g[0].length;
  const H = g.length;
  const bh = blueprint.layout.length;
  const bw = blueprint.layout[0]?.length ?? 0;
  if (bw + 6 >= W || bh + 6 >= H) return null;
  const maxOpen = rules.maxOpen ?? 0.45;
  for (let t = 0; t < 160; t++) {
    const x = 2 + Math.floor(ctx.rand() * (W - bw - 4));
    const y = 2 + Math.floor(ctx.rand() * (H - bh - 4));
    const rect: Rect = { x1: x, y1: y, x2: x + bw - 1, y2: y + bh - 1 };
    if (taken.some((r) => r.x1 - 2 <= rect.x2 && r.x2 + 2 >= rect.x1 && r.y1 - 2 <= rect.y2 && r.y2 + 2 >= rect.y1)) continue;
    if (rules.where && !rules.where(x, y, bw, bh)) continue;
    let open = 0;
    let hazard = false;
    for (let yy = y - 1; yy <= y + bh; yy++) {
      for (let xx = x - 1; xx <= x + bw; xx++) {
        const c = g[yy][xx];
        if (c === 'X' || c === '~' || c === 'S' || c === '?') hazard = true;
        if (c !== '#') open++;
      }
    }
    if (hazard || open > (bw + 2) * (bh + 2) * maxOpen) continue;

    const connectors: Position[] = [];
    for (let r = 0; r < bh; r++) {
      for (let c = 0; c < bw; c++) {
        const ch = blueprint.layout[r][c] ?? '#';
        g[y + r][x + c] = gridCharFor(ch, blueprint.legend);
        if (ch === '@') connectors.push({ x: x + c, y: y + r });
      }
    }
    const protect = [...taken, rect];
    for (const p of connectors) {
      const [ox, oy] = outwardOf(p, rect);
      if (g[oy]?.[ox] === '#') g[oy][ox] = '.';
      connectOut(g, ox, oy, rect, protect);
    }
    taken.push(rect);
    return { blueprint, x, y, rect, forced: false };
  }
  return null;
}

/** Places every chosen vault; returns null if a required (forced) one doesn't fit. */
export function placeChosenVaults(g: CharGrid, ctx: DraftContext, taken: Rect[], rules: VaultSiteRules = {}): VaultPlan[] | null {
  const plans: VaultPlan[] = [];
  for (const choice of chooseVaults(ctx)) {
    const plan =
      placeVault(g, ctx, choice.blueprint, taken, rules) ??
      (choice.required ? placeVault(g, ctx, choice.blueprint, taken, { ...rules, maxOpen: 1 }) : null);
    if (!plan) {
      if (choice.required) return null;
      continue;
    }
    plan.forced = choice.forced;
    plans.push(plan);
  }
  return plans;
}

function gridCharFor(ch: string, legend?: Record<string, string>): string {
  if (legend?.[ch] !== undefined) return '?';
  switch (ch) {
    case '#':
    case '~':
    case 'X':
    case '+':
    case 'B':
    case 'P':
      return ch;
    case '@':
      return '.';
    default:
      return '?';
  }
}

function outwardOf(p: Position, rect: Rect): [number, number] {
  if (p.x === rect.x1) return [p.x - 1, p.y];
  if (p.x === rect.x2) return [p.x + 1, p.y];
  if (p.y === rect.y1) return [p.x, p.y - 1];
  return [p.x, p.y + 1];
}

// ───────────────────────── finishing ─────────────────────────

const CHAR_TILES: Record<string, TileDefinition> = {
  '#': TILES.WALL,
  '.': TILES.FLOOR,
  '?': TILES.FLOOR,
  '~': TILES.SHALLOW_WATER,
  X: TILES.CHASM,
  '+': TILES.DOOR_CLOSED,
  "'": TILES.DOOR_OPEN,
  B: TILES.IRON_BARS,
  P: TILES.PILLAR,
  S: TILES.SECRET_DOOR,
};

function finishDraft(draft: LayoutDraft, ctx: DraftContext): GeneratedFloorData | null {
  const { grid: g, spawn } = draft;
  const W = g[0].length;
  const H = g.length;
  const gen = ctx.gen;
  const vaultRects = draft.vaults.map((v) => v.rect);
  const inVault = (x: number, y: number) => vaultRects.some((r) => inRect(r, x, y));

  if (gen.forcedVaultId && !draft.vaults.some((v) => v.forced)) return null;
  if (g[spawn.y]?.[spawn.x] !== '.' || inVault(spawn.x, spawn.y)) return null;

  joinAll(g, spawn, vaultRects, draft.sealed);

  // Every walkable cell outside the vaults joins the network (secret doors open).
  const reach = walkDistances(g, spawn.x, spawn.y, { secretsOpen: true });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isWalkable(g[y][x]) && !inVault(x, y) && reach[y * W + x] < 0) return null;
    }
  }
  for (const v of draft.vaults) {
    let entered = false;
    for (let y = v.rect.y1; y <= v.rect.y2 && !entered; y++) {
      for (let x = v.rect.x1; x <= v.rect.x2; x++) if (reach[y * W + x] >= 0) { entered = true; break; }
    }
    if (!entered) return null;
  }

  // Down stairs: the farthest plain floor walkable without secrets, outside vaults.
  const walk = walkDistances(g, spawn.x, spawn.y);
  let stairs: Position | null = null;
  let best = -1;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const d = walk[y * W + x];
      if (g[y][x] !== '.' || d <= best || inVault(x, y) || draft.sealed?.has(y * W + x)) continue;
      if (draft.stairsFilter && !draft.stairsFilter(x, y)) continue;
      if (DIR4.some(([dx, dy]) => g[y + dy][x + dx] === 'X')) continue;
      best = d;
      stairs = { x, y };
    }
  }
  if (!stairs || best < Math.min(W, H) / 2) return null;

  const map = new GameMap(W, H, TILES.WALL);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) map.setTile(x, y, CHAR_TILES[g[y][x]] ?? TILES.FLOOR);

  const monsters: Monster[] = [];
  let forcedVaultChestSpawns: Position[] | undefined;
  let forcedVaultNpcSpawns: Position[] | undefined;
  for (const plan of draft.vaults) {
    const stamped = VaultStamper.stamp(
      map,
      plan.blueprint,
      plan.x,
      plan.y,
      gen.floorNumber ?? 1,
      gen.monsterCandidates ?? [],
      gen.itemCandidates ?? [],
      ctx.rand,
      gen.scalingConfig,
      gen.difficulty,
      gen.registries
    );
    if (plan.forced) {
      forcedVaultChestSpawns = stamped.chestSpawns;
      forcedVaultNpcSpawns = stamped.npcSpawns;
    }
  }
  for (const e of map.getAllEntities()) if (e instanceof Monster) monsters.push(e);

  const rooms = buildRooms(g, spawn, draft.rooms, vaultRects, draft.sealed);
  return {
    map,
    playerSpawn: { ...spawn },
    stairsDown: stairs,
    stairsUp: { ...spawn },
    rooms,
    monsters,
    forcedVaultChestSpawns,
    forcedVaultNpcSpawns,
    vaultRects: vaultRects.map((r) => ({ ...r })),
  };
}

/**
 * `RectRoom[]` for population, spawn room first. Built rooms are used as they are;
 * organic floor is cut into a coarse grid and each cell with enough floor becomes a
 * virtual room around its walkable tiles. Vaults stamp their own guards, so they're out.
 */
export function buildRooms(
  g: CharGrid,
  spawn: Position,
  built: Rect[] | undefined,
  vaults: readonly Rect[],
  sealed?: ReadonlySet<number>
): RectRoom[] {
  const W = g[0].length;
  const H = g.length;
  const rooms: RectRoom[] = [];
  const centerOf = (r: Rect): Position => {
    const cx = Math.floor((r.x1 + r.x2) / 2);
    const cy = Math.floor((r.y1 + r.y2) / 2);
    let best: Position = { x: cx, y: cy };
    let bestD = Infinity;
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (g[y][x] !== '.') continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  };
  const push = (r: Rect) => {
    const c = centerOf(r);
    rooms.push({ ...r, centerX: c.x, centerY: c.y });
  };

  if (built && built.length > 0) {
    for (const r of built) if (!vaults.some((v) => inRect(v, r.x1, r.y1))) push(r);
  } else {
    const cellW = 9;
    const cellH = 8;
    for (let gy = 1; gy < H - 1; gy += cellH) {
      for (let gx = 1; gx < W - 1; gx += cellW) {
        let x1 = Infinity;
        let y1 = Infinity;
        let x2 = -1;
        let y2 = -1;
        let n = 0;
        for (let y = gy; y < Math.min(H - 1, gy + cellH); y++) {
          for (let x = gx; x < Math.min(W - 1, gx + cellW); x++) {
            if (g[y][x] !== '.' || vaults.some((v) => inRect(v, x, y)) || sealed?.has(y * W + x)) continue;
            n++;
            x1 = Math.min(x1, x);
            y1 = Math.min(y1, y);
            x2 = Math.max(x2, x);
            y2 = Math.max(y2, y);
          }
        }
        if (n >= 10 && x2 - x1 >= 2 && y2 - y1 >= 2) push({ x1, y1, x2, y2 });
      }
    }
  }

  const home = rooms.findIndex((r) => spawn.x >= r.x1 && spawn.x <= r.x2 && spawn.y >= r.y1 && spawn.y <= r.y2);
  if (home > 0) rooms.unshift(rooms.splice(home, 1)[0]);
  else if (home < 0) {
    rooms.unshift({
      x1: Math.max(1, spawn.x - 2),
      y1: Math.max(1, spawn.y - 2),
      x2: Math.min(W - 2, spawn.x + 2),
      y2: Math.min(H - 2, spawn.y + 2),
      centerX: spawn.x,
      centerY: spawn.y,
    });
  }
  return rooms;
}
