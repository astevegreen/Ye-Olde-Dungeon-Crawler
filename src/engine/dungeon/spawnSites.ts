import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import type { FovManager } from '../fov/fov-manager';

export interface SpawnSiteRules {
  /** Where the hero is (or arrives): sites must be reachable from here and not too near it. */
  anchor: Position;
  /** The least straight-line distance from the anchor. */
  minDistance: number;
  /** When given, a site must be out of this view (a wanderer is never seen arriving). */
  hiddenFrom?: FovManager;
}

/**
 * The one rule for where a monster may be put, at generation and at run time alike:
 * population, wanderers, revisit catch-up and the cleared-floor respawn (R-ai-5, -7, -16).
 * A site is passable and empty, not a staircase, out of the anchor's clear radius, and
 * reachable from the anchor without a secret door. That last test keeps monsters out of
 * secret caches (since R-ai-4 the only cells a secret door hides) and out of sealed vault
 * cages, where one could never path out. Reach is walked once per filter.
 */
export class SpawnSiteFilter {
  private readonly reach: Uint8Array;

  constructor(
    private readonly map: GameMap,
    private readonly rules: SpawnSiteRules
  ) {
    this.reach = reachableWithoutSecrets(map, rules.anchor);
  }

  /** Whether the hero can walk from the anchor to (x, y) without a secret door. */
  public reaches(x: number, y: number): boolean {
    const { map } = this;
    return x >= 0 && y >= 0 && x < map.width && y < map.height && this.reach[y * map.width + x] === 1;
  }

  public allows(x: number, y: number): boolean {
    const { map, rules } = this;
    if (!this.reaches(x, y)) return false;
    if (!map.isPassable(x, y) || map.getEntityAt(x, y)) return false;
    const type = map.getTile(x, y)?.type;
    if (type === 'stairs_up' || type === 'stairs_down') return false;
    if (Math.hypot(x - rules.anchor.x, y - rules.anchor.y) < rules.minDistance) return false;
    if (rules.hiddenFrom?.isVisible(x, y)) return false;
    return true;
  }

  /** Every allowed site, scanned with a stride (2 is plenty for picking a few). */
  public sites(stride = 1): Position[] {
    const out: Position[] = [];
    for (let y = 1; y < this.map.height - 1; y += stride) {
      for (let x = 1; x < this.map.width - 1; x += stride) if (this.allows(x, y)) out.push({ x, y });
    }
    return out;
  }
}

/** Cells reachable from `from` by 4-way steps over walkable tiles and doors, secret doors shut. */
function reachableWithoutSecrets(map: GameMap, from: Position): Uint8Array {
  const W = map.width;
  const H = map.height;
  const seen = new Uint8Array(W * H);
  if (from.x < 0 || from.y < 0 || from.x >= W || from.y >= H) return seen;
  const queue = [from.y * W + from.x];
  seen[queue[0]] = 1;
  for (let k = 0; k < queue.length; k++) {
    const x = queue[k] % W;
    const y = (queue[k] - x) / W;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (seen[j]) continue;
      const tile = map.getTile(nx, ny);
      if (!tile || !(tile.walkable || tile.type === 'door_closed' || tile.type === 'door_open')) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

const DIR4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
