import { describe, it, expect } from 'vitest';
import type { TerrainArtConfig } from '../../../engine';
import { terrainLayers, type TerrainView } from '../terrain-layers';
import { TerrainLayerCache } from '../terrain-cache';

const TYPES: Record<string, string> = {
  '#': 'wall',
  S: 'secret_door',
  '.': 'floor',
  '~': 'shallow_water',
  '+': 'door_closed',
  "'": 'door_open',
  P: 'pillar',
};

/** A map whose cells the test rewrites in place, as the engine does when a door opens. */
function grid(rows: string[]): { view: TerrainView; set(x: number, y: number, ch: string): void } {
  const cells = rows.map((r) => [...r]);
  return {
    view: {
      width: cells[0].length,
      height: cells.length,
      typeAt: (x, y) => (y < 0 || y >= cells.length || x < 0 || x >= cells[0].length ? undefined : TYPES[cells[y][x]]),
    },
    set: (x, y, ch) => {
      cells[y][x] = ch;
    },
  };
}

const ART: TerrainArtConfig = {
  styles: {
    floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.2 },
    wall: { kind: 'wall', faces: 2 },
    water: { kind: 'area', macro: true },
  },
};
const has = (key: string) => /^(floor|wall|water|door_closed|door_open|pillar)_ice~/.test(key);
const zone = () => 'ice';

/** Every cell of the view through the cache, next to what a fresh call works out. */
function compare(cache: TerrainLayerCache, view: TerrainView, x0 = 0, y0 = 0, cols = view.width, rows = view.height) {
  cache.begin(['floor'], view, x0, y0, cols, rows);
  const cached: Array<readonly string[] | null> = [];
  const fresh: Array<string[] | null> = [];
  for (let y = y0; y < y0 + rows; y++) {
    for (let x = x0; x < x0 + cols; x++) {
      cached.push(cache.get(view, x, y, zone, ART, has));
      fresh.push(terrainLayers(view, x, y, zone, ART, has));
    }
  }
  return { cached, fresh };
}

const ROOM = ['#########', '#..~~...#', '#..~~.P.#', '####+####', '#.......#', '###S#####', '#.......#', '#########'];

describe('TerrainLayerCache (R-rend-16)', () => {
  it('gives every cell the layers an uncached call gives, frame after frame', () => {
    const { view } = grid(ROOM);
    const cache = new TerrainLayerCache();
    const first = compare(cache, view);
    expect(first.cached).toEqual(first.fresh);
    // The second frame is served from the cache: the very same arrays come back.
    const again = compare(cache, view);
    expect(again.cached).toEqual(first.fresh);
    expect(again.cached[10]).toBe(first.cached[10]);
  });

  it('draws a door open on the frame after it opens', () => {
    const map = grid(ROOM);
    const cache = new TerrainLayerCache();
    compare(cache, map.view);
    expect(cache.get(map.view, 4, 3, zone, ART, has)).toEqual(['door_closed_ice~face']);

    map.set(4, 3, "'");
    const after = compare(cache, map.view);
    expect(cache.get(map.view, 4, 3, zone, ART, has)).toEqual(['door_open_ice~face']);
    expect(after.cached).toEqual(after.fresh);
  });

  it('turns a found secret door from rock into a door, and its walls with it', () => {
    const map = grid(ROOM);
    const cache = new TerrainLayerCache();
    const before = compare(cache, map.view);
    expect(cache.get(map.view, 3, 5, zone, ART, has)?.[0]).toMatch(/^wall_ice~/);

    map.set(3, 5, '+');
    const after = compare(cache, map.view);
    expect(after.cached).toEqual(after.fresh);
    expect(after.cached).not.toEqual(before.cached);
    expect(cache.get(map.view, 3, 5, zone, ART, has)).toEqual(['door_closed_ice~face']);
  });

  it('reaches a wall two columns from the change, through the door between them', () => {
    // The door at (1,1) is face-on only while rock lies either side of it; whether the wall
    // at (0,1) shows an open east side depends on the cell at (2,1), two columns away.
    const map = grid(['#####', '#+..#', '#...#', '#####']);
    const cache = new TerrainLayerCache();
    compare(cache, map.view);
    const open = cache.get(map.view, 0, 1, zone, ART, has);

    map.set(2, 1, '#');
    const after = compare(cache, map.view);
    expect(after.cached).toEqual(after.fresh);
    expect(cache.get(map.view, 0, 1, zone, ART, has)).not.toEqual(open);
  });

  it('catches a change made while the cell was off screen', () => {
    const map = grid(['############', '#..........#', '#..+.......#', '############']);
    const cache = new TerrainLayerCache();
    // Cache the left of the map, look at the right, change the left there, come back.
    compare(cache, map.view, 0, 0, 5, 4);
    compare(cache, map.view, 8, 0, 4, 4);
    map.set(3, 2, "'");
    map.set(1, 1, '#');
    const back = compare(cache, map.view, 0, 0, 5, 4);
    expect(back.cached).toEqual(back.fresh);
  });

  it('starts afresh on another floor, and works out cells outside the view without keeping them', () => {
    const a = grid(ROOM);
    const b = grid(ROOM.map((row) => row.replace(/~/g, '.')));
    const cache = new TerrainLayerCache();
    cache.begin(['floor 1'], a.view, 0, 0, 9, 8);
    const pool = cache.get(a.view, 3, 1, zone, ART, has);
    cache.begin(['floor 2'], b.view, 0, 0, 9, 8);
    expect(cache.get(b.view, 3, 1, zone, ART, has)).toEqual(terrainLayers(b.view, 3, 1, zone, ART, has));
    expect(cache.get(b.view, 3, 1, zone, ART, has)).not.toEqual(pool);

    cache.begin(['floor 2'], b.view, 0, 0, 3, 3);
    b.set(5, 6, '#');
    expect(cache.get(b.view, 5, 6, zone, ART, has)).toEqual(terrainLayers(b.view, 5, 6, zone, ART, has));
  });
});
