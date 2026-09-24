import type { TerrainArtConfig, TileZoneBand } from '../../engine';

/**
 * Neighbour-aware terrain selection (ARCHITECTURE.md §3, pack-neutral presentation). Pure:
 * given a view of the map and the pack's `atlas.terrain` config, `terrainLayers` names the
 * sprite keys to blit for one cell, bottom first. The key grammar is documented on
 * `TerrainArtConfig` (src/engine/types/manifest.ts); a pack opts in by declaring styles and
 * drawing the recipes. Returning null sends the cell down the one-recipe-per-type path.
 */
export interface TerrainView {
  readonly width: number;
  readonly height: number;
  /** Tile type at a cell, undefined outside the map. */
  typeAt(x: number, y: number): string | undefined;
}

/** The zone (or town building) suffix recipe keys carry at a cell, if any. */
export type SuffixAt = (x: number, y: number) => string | undefined;

const BASE_OF: Record<string, string> = {
  wall: 'wall',
  secret_door: 'wall',
  floor: 'floor',
  shallow_water: 'water',
  chasm: 'chasm',
  pillar: 'pillar',
  iron_bars: 'bars',
};

export function terrainBase(tileType: string): string {
  return BASE_OF[tileType] ?? tileType;
}

const isRock = (t: string | undefined) => t === undefined || t === 'wall' || t === 'secret_door';
const isDoor = (t: string | undefined) => t === 'door_closed' || t === 'door_open';

/** A door set in an east–west wall line (rock on both sides), drawn face-on in that line. */
export function isFaceDoor(view: TerrainView, x: number, y: number): boolean {
  return isRock(view.typeAt(x - 1, y)) && isRock(view.typeAt(x + 1, y));
}

/**
 * Solid for wall shapes: rock, secret doors (drawn exactly as rock, so they never show) and
 * face-on doors, which sit in the wall line. Outside the map counts as rock.
 */
export function isWallSolid(view: TerrainView, x: number, y: number): boolean {
  const t = view.typeAt(x, y);
  return isRock(t) || (isDoor(t) && isFaceDoor(view, x, y));
}

/** N=1, E=2, S=4, W=8: set where that neighbour is solid. */
export function wallMask(view: TerrainView, x: number, y: number): number {
  return (
    (isWallSolid(view, x, y - 1) ? 1 : 0) |
    (isWallSolid(view, x + 1, y) ? 2 : 0) |
    (isWallSolid(view, x, y + 1) ? 4 : 0) |
    (isWallSolid(view, x - 1, y) ? 8 : 0)
  );
}

/** The `tileZoneBands` key for a floor, or undefined above the first band. */
export function zoneForFloor(floor: number, bands: readonly TileZoneBand[] | undefined): string | undefined {
  if (!bands || bands.length === 0 || floor <= 0) return undefined;
  let key = bands[0].zoneKey;
  for (const band of bands) {
    if (floor >= band.floor) key = band.zoneKey;
    else break;
  }
  return key;
}

function hashCell(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const a = hashCell(x0, y0, seed);
  const b = hashCell(x0 + 1, y0, seed);
  const c = hashCell(x0, y0 + 1, seed);
  const d = hashCell(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function terrainLayers(
  view: TerrainView,
  x: number,
  y: number,
  suffixAt: SuffixAt,
  art: TerrainArtConfig,
  has: (key: string) => boolean
): string[] | null {
  const type = view.typeAt(x, y);
  if (type === undefined) return null;
  const base = terrainBase(type);

  // The zone-suffixed key if the pack draws it, else the bare base.
  const key = (b: string, sx: number, sy: number, part: string): string | null => {
    const suffix = suffixAt(sx, sy);
    if (suffix !== undefined && has(`${b}_${suffix}~${part}`)) return `${b}_${suffix}~${part}`;
    return has(`${b}~${part}`) ? `${b}~${part}` : null;
  };

  const field = (b: string): string | null => {
    const style = art.styles[b];
    if (style?.kind !== 'field') return null;
    const tones = Math.max(1, style.tones ?? 1);
    const macro = !!style.macro;
    const sx = macro ? x >> 1 : x;
    const sy = macro ? y >> 1 : y;
    const q = macro ? `q${(x & 1) + 2 * (y & 1)}` : '';
    const details = style.details ?? 0;
    if (details > 0 && hashCell(sx, sy, 11) < (style.detailRate ?? 0.1)) {
      const d = key(b, x, y, `${q}d${Math.floor(hashCell(sx, sy, 13) * details)}`);
      if (d) return d;
    }
    const tone = Math.min(tones - 1, Math.floor(smoothNoise(sx, sy, macro ? 3.2 : 5, 7) * tones));
    return key(b, x, y, `${q}t${tone}`);
  };

  const floorUnder = () => field('floor');
  const style = art.styles[base];

  if (style?.kind === 'field') {
    const f = field(base);
    return f ? [f] : null;
  }

  if (style?.kind === 'wall') {
    const m = wallMask(view, x, y);
    const open = (bit: number) => (m & bit) === 0;
    const layers: string[] = [];
    const push = (k: string | null) => {
      if (k) layers.push(k);
    };
    if (open(4)) {
      const faces = Math.max(1, style.faces ?? 1);
      const f = key(base, x, y + 1, `face${Math.floor(hashCell(x, y, 3) * faces)}`) ?? key(base, x, y, 'face0');
      if (!f) return null;
      layers.push(f);
      if (open(1)) push(key(base, x, y, 'rimN'));
      if (open(2)) push(key(base, x, y, 'edgeE'));
      if (open(8)) push(key(base, x, y, 'edgeW'));
    } else {
      const top = key(base, x, y, 'top');
      if (!top) return null;
      layers.push(top);
      if (open(1)) push(key(base, x, y, 'rimN'));
      if (open(2)) push(key(base, x, y, 'rimE'));
      if (open(8)) push(key(base, x, y, 'rimW'));
      if (!open(4) && !open(2) && !isWallSolid(view, x + 1, y + 1)) push(key(base, x, y, 'cornerSE'));
      if (!open(4) && !open(8) && !isWallSolid(view, x - 1, y + 1)) push(key(base, x, y, 'cornerSW'));
    }
    if (!open(1) && !open(2) && !isWallSolid(view, x + 1, y - 1)) push(key(base, x, y, 'cornerNE'));
    if (!open(1) && !open(8) && !isWallSolid(view, x - 1, y - 1)) push(key(base, x, y, 'cornerNW'));
    return layers;
  }

  if (style?.kind === 'area') {
    const q = style.macro ? (x & 1) + 2 * (y & 1) : 0;
    const body = key(base, x, y, `q${q}`);
    if (!body) return null;
    const layers = [body];
    const same = (nx: number, ny: number) => view.typeAt(nx, ny) === type;
    for (const [dx, dy, side] of [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']] as const) {
      if (!same(x + dx, y + dy)) {
        const e = key(base, x, y, `edge${side}`);
        if (e) layers.push(e);
      }
    }
    return layers;
  }

  if (type === 'door_closed' || type === 'door_open') {
    if (isFaceDoor(view, x, y)) {
      const face = key(base, x, y + 1, 'face') ?? key(base, x, y, 'face');
      return face ? [face] : null;
    }
    const under = floorUnder();
    const side = key(base, x, y, 'side');
    return under && side ? [under, side] : null;
  }

  const prop = key(base, x, y, 'prop');
  const under = floorUnder();
  return prop && under ? [under, prop] : null;
}

/** Which sides of a cell get a contact shadow: rock (and secret doors) north, west and east. Doors never cast one. */
export function contactShadowSides(view: TerrainView, x: number, y: number): { n: boolean; w: boolean; e: boolean } | null {
  const t = view.typeAt(x, y);
  if (t === undefined || isRock(t) || t === 'chasm' || (isDoor(t) && isFaceDoor(view, x, y))) return null;
  const rock = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < view.width && ny < view.height && isRock(view.typeAt(nx, ny));
  return { n: rock(x, y - 1), w: rock(x - 1, y), e: rock(x + 1, y) };
}
