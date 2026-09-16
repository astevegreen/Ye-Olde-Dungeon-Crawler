import type { TileType } from '../types';

const TILE_TO_CODE: Record<TileType, string> = {
  wall: 'W',
  floor: 'F',
  door_closed: 'C',
  door_open: 'O',
  stairs_up: 'U',
  stairs_down: 'D',
  trap: 'T',
  secret_door: 'S',
  gateway_valhalla: 'G',
  shallow_water: 'A',
  chasm: 'K',
  iron_bars: 'B',
  pillar: 'P',
  altar_tyr: 'Y',
};

const CODE_TO_TILE: Record<string, TileType> = {
  W: 'wall',
  F: 'floor',
  C: 'door_closed',
  O: 'door_open',
  U: 'stairs_up',
  D: 'stairs_down',
  T: 'trap',
  S: 'secret_door',
  G: 'gateway_valhalla',
  A: 'shallow_water',
  K: 'chasm',
  B: 'iron_bars',
  P: 'pillar',
  Y: 'altar_tyr',
};

/**
 * Encodes a 2D grid of TileTypes into a compact Run-Length Encoded (RLE) string.
 * Example: 50 walls -> "50W"
 */
export function compactTiles(tiles: TileType[][]): string {
  if (!tiles || tiles.length === 0) return '';
  const height = tiles.length;
  const width = tiles[0].length;

  let rle = '';
  let currentTile: TileType | null = null;
  let currentCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (tile === currentTile) {
        currentCount++;
      } else {
        if (currentTile !== null) {
          const code = TILE_TO_CODE[currentTile] ?? 'W';
          rle += `${currentCount}${code}`;
        }
        currentTile = tile;
        currentCount = 1;
      }
    }
  }

  if (currentTile !== null && currentCount > 0) {
    const code = TILE_TO_CODE[currentTile] ?? 'W';
    rle += `${currentCount}${code}`;
  }

  return rle;
}

/**
 * Decodes an RLE string back into a full 2D grid of TileTypes.
 */
export function decompactTiles(rle: string, width: number, height: number): TileType[][] {
  const result: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'wall' as TileType)
  );

  if (!rle) return result;

  const matches = rle.matchAll(/(\d+)([A-Z])/g);
  let totalIdx = 0;

  for (const match of matches) {
    const count = parseInt(match[1], 10);
    const code = match[2];
    const tileType = CODE_TO_TILE[code] ?? 'wall';

    for (let i = 0; i < count; i++) {
      const idx = totalIdx + i;
      const x = idx % width;
      const y = Math.floor(idx / width);
      if (y < height) {
        result[y][x] = tileType;
      }
    }
    totalIdx += count;
  }

  return result;
}

/**
 * Encodes explored tiles into a compact RLE bitstream string.
 * 'E' = Explored, 'U' = Unexplored.
 */
export function compactFov(
  width: number,
  height: number,
  isExploredFn: (x: number, y: number) => boolean
): string {
  let rle = '';
  let currentStatus: 'E' | 'U' | null = null;
  let currentCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const status: 'E' | 'U' = isExploredFn(x, y) ? 'E' : 'U';
      if (status === currentStatus) {
        currentCount++;
      } else {
        if (currentStatus !== null) {
          rle += `${currentCount}${currentStatus}`;
        }
        currentStatus = status;
        currentCount = 1;
      }
    }
  }

  if (currentStatus !== null && currentCount > 0) {
    rle += `${currentCount}${currentStatus}`;
  }

  return rle;
}

/**
 * Decodes an FOV RLE string into an array of [x, y] explored coordinate pairs.
 */
export function decompactFov(rle: string, width: number, height: number): [number, number][] {
  const exploredCoords: [number, number][] = [];
  if (!rle) return exploredCoords;

  const matches = rle.matchAll(/(\d+)([E|U])/g);
  let totalIdx = 0;

  for (const match of matches) {
    const count = parseInt(match[1], 10);
    const status = match[2];

    if (status === 'E') {
      for (let i = 0; i < count; i++) {
        const idx = totalIdx + i;
        const x = idx % width;
        const y = Math.floor(idx / width);
        if (y < height) {
          exploredCoords.push([x, y]);
        }
      }
    }
    totalIdx += count;
  }

  return exploredCoords;
}
