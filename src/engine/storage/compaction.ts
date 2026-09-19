import type { TileType } from '../types';

const TILE_TO_CODE: Record<string, string> = {
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
 * Legacy tile encoder for schema <= 10 saves and unmigrated BulkArchive floors.
 * Preserved per ARCHITECTURE.md §5 and §8.1.
 */
function legacyCompactTiles(tiles: TileType[][]): string {
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
 * Legacy tile decoder for schema <= 10 saves and unmigrated BulkArchive floors.
 * Preserved per ARCHITECTURE.md §5 and §8.1.
 */
function legacyDecompactTiles(rle: string, width: number, height: number): TileType[][] {
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
 * Legacy tile codec bundle.
 */
export const legacyTileCodec = {
  TILE_TO_CODE,
  CODE_TO_TILE,
  compactTiles: legacyCompactTiles,
  decompactTiles: legacyDecompactTiles,
};

/**
 * Kept as an alias to legacyCompactTiles because existing migration steps in migrator.ts
 * (v1 -> v2) call compactTiles, and ARCHITECTURE.md §5 forbids changing existing migration steps.
 */
export const compactTiles = legacyCompactTiles;

/**
 * Encodes a 2D grid of TileTypes into a dictionary-based Run-Length Encoded (RLE) string.
 * Tokens are encoded as `${count}:${index};` where `index` points into the returned `tileCodes` array.
 */
export function compactTilesWithDictionary(tiles: TileType[][]): { tilesRle: string; tileCodes: string[] } {
  if (!tiles || tiles.length === 0) {
    return { tilesRle: '', tileCodes: [] };
  }

  const height = tiles.length;
  const width = tiles[0].length;
  const tileCodes: string[] = [];
  const codeMap = new Map<string, number>();

  const getCodeIdx = (tile: TileType): number => {
    let idx = codeMap.get(tile);
    if (idx === undefined) {
      idx = tileCodes.length;
      tileCodes.push(tile);
      codeMap.set(tile, idx);
    }
    return idx;
  };

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
          const idx = getCodeIdx(currentTile);
          rle += `${currentCount}:${idx};`;
        }
        currentTile = tile;
        currentCount = 1;
      }
    }
  }

  if (currentTile !== null && currentCount > 0) {
    const idx = getCodeIdx(currentTile);
    rle += `${currentCount}:${idx};`;
  }

  return { tilesRle: rle, tileCodes };
}

/**
 * Decodes an RLE string back into a full 2D grid of TileTypes.
 * If tileCodes dictionary is provided, decodes `${count}:${index};` tokens against it.
 * If tileCodes is absent or empty, falls back to legacy single-letter decoding for backward compatibility.
 */
export function decompactTiles(
  rle: string,
  width: number,
  height: number,
  tileCodes?: string[]
): TileType[][] {
  if (!tileCodes || tileCodes.length === 0 || !rle.includes(':')) {
    return legacyTileCodec.decompactTiles(rle, width, height);
  }

  const result: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'wall' as TileType)
  );

  if (!rle) return result;

  const matches = rle.matchAll(/(\d+):(\d+)/g);
  let totalIdx = 0;

  for (const match of matches) {
    const count = parseInt(match[1], 10);
    const codeIdx = parseInt(match[2], 10);
    const tileType = (tileCodes[codeIdx] ?? 'wall') as TileType;

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
