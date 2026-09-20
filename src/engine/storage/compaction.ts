import type { TileType } from '../types';

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
 * Decodes an RLE string back into a full 2D grid of TileTypes, resolving each
 * `${count}:${index};` token against the map's own `tileCodes` dictionary.
 */
export function decompactTiles(
  rle: string,
  width: number,
  height: number,
  tileCodes: string[]
): TileType[][] {
  const result: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'wall' as TileType)
  );

  if (!rle || !tileCodes || tileCodes.length === 0) return result;

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
