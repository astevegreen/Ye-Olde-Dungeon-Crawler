import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { TrapDefinition, TrapPlacementConfig } from '../types/manifest';
import { TrapInstance } from './traps';
import { SpawnSiteFilter } from './spawnSites';

type Rect = { x1: number; y1: number; x2: number; y2: number };

/** Where a generated floor's traps may not go, besides what the site rule already keeps out. */
export interface TrapSiteContext {
  /** Where the hero arrives (the up stairs): traps keep `TRAP_ARRIVAL_CLEARANCE` away. */
  arrival: Position;
  /** The down stairs: traps keep `TRAP_STAIRS_CLEARANCE` away. */
  stairsDown?: Position;
  /** The floor's rooms; a cell in none of them is a passage, filled first. */
  rooms: ReadonlyArray<Rect>;
  /** Vault and threshold rooms: no trap inside. */
  keepOut: ReadonlyArray<Rect>;
}

/** The least straight-line distance from the arrival to a trap. */
export const TRAP_ARRIVAL_CLEARANCE = 6;
/** The least Chebyshev distance from the down stairs to a trap. */
export const TRAP_STAIRS_CLEARANCE = 3;

/** The count range for `floor`: the band with the greatest `minFloor` not deeper than it. */
export function trapCountRange(config: TrapPlacementConfig, floor: number): { min: number; max: number } | undefined {
  let best: TrapPlacementConfig['perFloor'][number] | undefined;
  for (const band of config.perFloor) {
    if (band.minFloor <= floor && (!best || band.minFloor > best.minFloor)) best = band;
  }
  return best ? { min: best.min, max: Math.max(best.min, best.max) } : undefined;
}

/**
 * Hides a generated floor's traps (`manifest.trapPlacement`): a count from the floor's band,
 * each a definition the floor allows (`TrapDefinition.minFloor`/`maxFloor`, by `weight`),
 * on a site the hero walks to without a secret door — plain floor, empty of items and
 * creatures, out of vaults and the threshold, clear of the arrival and the down stairs,
 * and never beside another trap. Passages before rooms, as Castle of the Winds hid them.
 * `rng` is the floor's own trap stream, so the monster and item draws are unchanged.
 * Ids are `trap-<floor>-<n>`. Returns the traps placed (fewer when sites run out).
 */
export function placeFloorTraps(
  map: GameMap,
  floor: number,
  definitions: ReadonlyArray<TrapDefinition>,
  config: TrapPlacementConfig,
  context: TrapSiteContext,
  rng: () => number
): TrapInstance[] {
  const range = trapCountRange(config, floor);
  const eligible = definitions.filter(
    (d) => (d.minFloor ?? 1) <= floor && (d.maxFloor === undefined || floor <= d.maxFloor) && (d.weight ?? 1) > 0
  );
  if (!range || range.max <= 0 || eligible.length === 0) return [];
  const count = range.min + Math.floor(rng() * (range.max - range.min + 1));
  if (count <= 0) return [];

  const inside = (rects: ReadonlyArray<Rect>, x: number, y: number) =>
    rects.some((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
  const filter = new SpawnSiteFilter(map, { anchor: context.arrival, minDistance: TRAP_ARRIVAL_CLEARANCE });
  const passages: Position[] = [];
  const roomCells: Position[] = [];
  for (const site of filter.sites()) {
    const { x, y } = site;
    if (map.getTile(x, y)?.type !== 'floor') continue;
    if (map.getItemsAt(x, y).length > 0 || map.getTrapAt(x, y)) continue;
    if (inside(context.keepOut, x, y)) continue;
    const down = context.stairsDown;
    if (down && Math.max(Math.abs(x - down.x), Math.abs(y - down.y)) < TRAP_STAIRS_CLEARANCE) continue;
    (inside(context.rooms, x, y) ? roomCells : passages).push(site);
  }

  const placed: TrapInstance[] = [];
  const candidates = [...shuffle(passages, rng), ...shuffle(roomCells, rng)];
  const totalWeight = eligible.reduce((sum, d) => sum + (d.weight ?? 1), 0);
  for (const { x, y } of candidates) {
    if (placed.length >= count) break;
    if (placed.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= 1)) continue;
    const def = pickWeighted(eligible, totalWeight, rng);
    const trap = new TrapInstance({
      id: `trap-${floor}-${placed.length + 1}`,
      definitionId: def.type,
      type: def.type,
      x,
      y,
      damage: def.damage,
      concealment: def.concealment,
      disarmDifficulty: def.disarmDifficulty,
      customMessage: def.message,
    });
    map.addTrap(trap);
    placed.push(trap);
  }
  return placed;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickWeighted(defs: ReadonlyArray<TrapDefinition>, total: number, rng: () => number): TrapDefinition {
  let roll = rng() * total;
  for (const d of defs) {
    roll -= d.weight ?? 1;
    if (roll < 0) return d;
  }
  return defs[defs.length - 1];
}
