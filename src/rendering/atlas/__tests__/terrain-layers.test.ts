import { describe, it, expect } from 'vitest';
import type { TerrainArtConfig } from '../../../engine';
import { terrainLayers, contactShadowSides, wallMask, zoneForFloor, type TerrainView } from '../terrain-layers';
import { applyMemoryStyle, isFlatTerrainKey } from '../sprite-atlas';

const TYPES: Record<string, string> = {
  '#': 'wall',
  S: 'secret_door',
  '.': 'floor',
  '~': 'shallow_water',
  X: 'chasm',
  '+': 'door_closed',
  "'": 'door_open',
  P: 'pillar',
  '>': 'stairs_down',
  f: 'fountain',
};

function view(rows: string[]): TerrainView {
  return {
    width: rows[0].length,
    height: rows.length,
    typeAt: (x, y) => (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length ? undefined : TYPES[rows[y][x]]),
  };
}

const ART: TerrainArtConfig = {
  styles: {
    floor: { kind: 'field', tones: 3, details: 2, detailRate: 0 },
    wall: { kind: 'wall', faces: 2 },
    water: { kind: 'area', macro: true },
    chasm: { kind: 'area' },
  },
};

/** The pack draws every styled base and door for zone "ice", and one unsuffixed prop. */
const hasZoned = (key: string) => /^(floor|wall|water|chasm|door_closed|door_open)_ice~/.test(key) || key === 'fountain~prop';
const zone = () => 'ice';

describe('terrainLayers', () => {
  it('gives a wall with open floor to the south a face, and rims on its other open sides', () => {
    const v = view(['###', '#.#', '...', '...']);
    // (1,0): floor to the south → face; north is off-map (solid).
    expect(terrainLayers(v, 1, 0, zone, ART, hasZoned)).toEqual([expect.stringMatching(/^wall_ice~face[01]$/)]);
    // (0,1): solid south? no — (0,2) is floor → face, plus an east edge (floor at (1,1)).
    const side = terrainLayers(v, 0, 1, zone, ART, hasZoned)!;
    expect(side[0]).toMatch(/^wall_ice~face[01]$/);
    expect(side).toContain('wall_ice~edgeE');
  });

  it('gives a wall with rock to the south a top, with rims toward open sides and inner-corner pieces', () => {
    const v = view(['#####', '##.##', '#...#', '#####']);
    // (1,1): south (1,2) is floor → face. (1,0): south (1,1) is rock → top, and its SE diagonal (2,1) is floor.
    const top = terrainLayers(v, 1, 0, zone, ART, hasZoned)!;
    expect(top[0]).toBe('wall_ice~top');
    expect(top).toContain('wall_ice~cornerSE');
    // (2,3): bottom wall, floor north → top with a north rim.
    expect(terrainLayers(v, 2, 3, zone, ART, hasZoned)).toEqual(['wall_ice~top', 'wall_ice~rimN']);
  });

  it('draws a secret door exactly like the rock around it', () => {
    const plain = view(['#####', '#...#', '#####']);
    const secret = view(['##S##', '#...#', '#####']);
    expect(terrainLayers(secret, 2, 0, zone, ART, hasZoned)).toEqual(terrainLayers(plain, 2, 0, zone, ART, hasZoned));
    expect(wallMask(secret, 1, 0)).toBe(wallMask(plain, 1, 0));
  });

  it('sets a door between rock east and west in the wall line, and a door in a north-south line over the floor', () => {
    const v = view(['##.##', '##+##', '..+..', '##.##']);
    expect(terrainLayers(v, 2, 1, zone, ART, hasZoned)).toEqual(['door_closed_ice~face']);
    const side = terrainLayers(view(['#.#', '.+.', '#.#']), 1, 1, zone, ART, hasZoned)!;
    expect(side[0]).toMatch(/^floor_ice~t[012]$/);
    expect(side[1]).toBe('door_closed_ice~side');
  });

  it('never casts a contact shadow from a door, so a corridor joins its room without a break', () => {
    const v = view(['##+##', '##.##']);
    expect(contactShadowSides(v, 2, 1)).toEqual({ n: false, w: true, e: true });
    expect(contactShadowSides(view(['###', '#.#']), 1, 1)).toEqual({ n: true, w: true, e: true });
  });

  it('blends an area: edges only toward neighbours of another type', () => {
    const v = view(['....', '.~~.', '.~~.', '....']);
    const tl = terrainLayers(v, 1, 1, zone, ART, hasZoned)!;
    expect(tl).toEqual(['water_ice~q3', 'water_ice~edgeN', 'water_ice~edgeW']);
    const br = terrainLayers(v, 2, 2, zone, ART, hasZoned)!;
    expect(br).toEqual(['water_ice~q0', 'water_ice~edgeE', 'water_ice~edgeS']);
  });

  it('keeps a floor tone stable per cell and clusters tones across neighbours', () => {
    const v = view(Array.from({ length: 20 }, () => '.'.repeat(20)));
    const a = terrainLayers(v, 5, 5, zone, ART, hasZoned);
    expect(terrainLayers(v, 5, 5, zone, ART, hasZoned)).toEqual(a);
    let same = 0;
    for (let x = 0; x < 19; x++) {
      if (terrainLayers(v, x, 7, zone, ART, hasZoned)![0] === terrainLayers(v, x + 1, 7, zone, ART, hasZoned)![0]) same++;
    }
    expect(same).toBeGreaterThan(10); // smooth noise, not per-cell static
  });

  it('draws props over the floor, preferring the zone recipe and falling back to the bare one', () => {
    const v = view(['.P.', '.f.']);
    const has = (k: string) => hasZoned(k) || k === 'pillar_ice~prop';
    expect(terrainLayers(v, 1, 0, zone, ART, has)![1]).toBe('pillar_ice~prop');
    expect(terrainLayers(v, 1, 1, zone, ART, has)![1]).toBe('fountain~prop');
  });

  it('returns null when the pack lacks a recipe, sending the cell down the one-recipe path', () => {
    const v = view(['.>.']);
    expect(terrainLayers(v, 1, 0, zone, ART, hasZoned)).toBeNull();
    expect(terrainLayers(v, 0, 0, zone, { styles: {} }, hasZoned)).toBeNull();
  });

  it('maps a floor to its zone band key', () => {
    const bands = [{ floor: 1, zoneKey: 'a', label: 'A' }, { floor: 10, zoneKey: 'b', label: 'B' }];
    expect(zoneForFloor(3, bands)).toBe('a');
    expect(zoneForFloor(10, bands)).toBe('b');
    expect(zoneForFloor(0, bands)).toBeUndefined();
  });
});

describe('memory styling', () => {
  it('treats only terrain keys as flat', () => {
    expect(isFlatTerrainKey('wall_ice~top')).toBe(true);
    expect(isFlatTerrainKey('wolf')).toBe(false);
  });

  it('keeps hue, flattens contrast and darkens a cell', () => {
    // A 2x1 "cell" of two blues of different lightness.
    const data = new Uint8ClampedArray([40, 60, 120, 255, 80, 100, 160, 255]);
    applyMemoryStyle(data, 2, [{ ox: 0, oy: 0, size: 1 }, { ox: 1, oy: 0, size: 1 }], { desaturate: 0.5, flatten: 0, darken: 0.3 });
    expect(data[2]).toBeGreaterThan(data[0]); // still bluish
    expect(data[2]).toBeLessThan(120); // darker
    const flat = new Uint8ClampedArray([40, 40, 40, 255, 120, 120, 120, 255]);
    applyMemoryStyle(flat, 2, [{ ox: 0, oy: 0, size: 2 }], { desaturate: 0, flatten: 1, darken: 0 });
    expect(flat[0]).toBe(flat[4]); // fully flattened to the cell mean
  });
});
