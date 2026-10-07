import { describe, expect, it } from 'vitest';
import { DungeonArc } from '../../quest/dungeonArc';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Item } from '../../items/item';
import { Monster } from '../../entities/monster';
import type { TrapInstance } from '../traps';
import { placeFloorTraps, trapCountRange, TRAP_ARRIVAL_CLEARANCE, TRAP_STAIRS_CLEARANCE } from '../trapPlacement';
import { serializeMapObject, deserializeMapObject } from '../../storage/serializer';
import { SpawnSiteFilter } from '../spawnSites';
import type { TrapDefinition, TrapPlacementConfig } from '../../types/manifest';
import { cotwManifest } from '../../../content/cotw';

const PIT: TrapDefinition = { type: 'pit', name: 'Pit', damage: 10 };
const ALARM: TrapDefinition = { type: 'alarm', name: 'Alarm', damage: 0 };

function room(w = 30, h = 20): GameMap {
  const map = new GameMap(w, h, TILES.WALL);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) map.setTile(x, y, TILES.FLOOR);
  return map;
}

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('trapCountRange: bands, as floorEncounters', () => {
  const config: TrapPlacementConfig = { perFloor: [{ minFloor: 5, min: 1, max: 2 }, { minFloor: 1, min: 0, max: 1 }, { minFloor: 25, min: 2, max: 4 }] };

  it('takes the band with the greatest minFloor not deeper than the floor, whatever the order', () => {
    expect(trapCountRange(config, 1)).toEqual({ min: 0, max: 1 });
    expect(trapCountRange(config, 4)).toEqual({ min: 0, max: 1 });
    expect(trapCountRange(config, 5)).toEqual({ min: 1, max: 2 });
    expect(trapCountRange(config, 24)).toEqual({ min: 1, max: 2 });
    expect(trapCountRange(config, 49)).toEqual({ min: 2, max: 4 });
  });

  it('gives a floor shallower than every band nothing', () => {
    expect(trapCountRange({ perFloor: [{ minFloor: 3, min: 1, max: 1 }] }, 2)).toBeUndefined();
  });
});

describe('placeFloorTraps on a hand-built floor', () => {
  const context = { arrival: { x: 2, y: 2 }, stairsDown: { x: 27, y: 17 }, rooms: [], keepOut: [] };
  const exactly = (n: number): TrapPlacementConfig => ({ perFloor: [{ minFloor: 1, min: n, max: n }] });

  it('places the count, hidden, with deterministic ids, never beside each other or near the arrival and stairs', () => {
    const map = room();
    const traps = placeFloorTraps(map, 7, [PIT], exactly(6), context, seq([0.37, 0.81, 0.12, 0.55, 0.93, 0.04, 0.66]));
    expect(traps.map((t) => t.id)).toEqual(['trap-7-1', 'trap-7-2', 'trap-7-3', 'trap-7-4', 'trap-7-5', 'trap-7-6']);
    expect(map.getAllTraps()).toHaveLength(6);
    for (const t of traps) {
      expect(t.revealed).toBe(false);
      expect(map.getTile(t.x, t.y)?.type).toBe('floor');
      expect(Math.hypot(t.x - 2, t.y - 2)).toBeGreaterThanOrEqual(TRAP_ARRIVAL_CLEARANCE);
      expect(Math.max(Math.abs(t.x - 27), Math.abs(t.y - 17))).toBeGreaterThanOrEqual(TRAP_STAIRS_CLEARANCE);
      for (const o of traps) {
        if (o !== t) expect(Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y))).toBeGreaterThan(1);
      }
    }
  });

  it('keeps out of keep-out rects, item cells, occupied cells and non-floor tiles', () => {
    const map = room(12, 12);
    // Leave only a few legal cells: wall the left half, an item, a vault rect, water.
    for (let y = 1; y < 11; y++) for (let x = 1; x < 6; x++) map.setTile(x, y, TILES.SHALLOW_WATER);
    map.addItemAt(10, 10, new Item({ id: 'rock', name: 'Rock', category: 'misc', weight: 1, bulk: 1, identified: true }));
    map.addEntity(new Monster({ id: 'rat', name: 'Rat', position: { x: 8, y: 8 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } }));
    const keepOut = [{ x1: 6, y1: 1, x2: 10, y2: 5 }];
    const traps = placeFloorTraps(map, 3, [PIT], exactly(30), { arrival: { x: 1, y: 1 }, rooms: [], keepOut }, seq([0.5, 0.25, 0.75]));
    expect(traps.length).toBeGreaterThan(0);
    for (const t of traps) {
      expect(map.getTile(t.x, t.y)?.type).toBe('floor');
      expect(t.x >= 6 && t.x <= 10 && t.y >= 1 && t.y <= 5).toBe(false);
      expect(t.x === 10 && t.y === 10).toBe(false);
      expect(t.x === 8 && t.y === 8, 'a trap under the rat').toBe(false);
    }
  });

  it('fills passages (cells in no room) before rooms', () => {
    const map = room();
    const rooms = [{ x1: 1, y1: 1, x2: 28, y2: 14 }]; // rows 15-18 are "passage"
    const traps = placeFloorTraps(map, 2, [PIT], exactly(3), { ...context, rooms }, seq([0.3, 0.6, 0.9, 0.1]));
    expect(traps).toHaveLength(3);
    for (const t of traps) expect(t.y).toBeGreaterThan(14);
  });

  it('draws only definitions the floor allows, by weight, and copies their numbers', () => {
    const deep: TrapDefinition = { type: 'teleport', name: 'Rune', minFloor: 8, concealment: 18, disarmDifficulty: 16 };
    const shallow = placeFloorTraps(room(), 7, [deep, ALARM], exactly(5), context, seq([0.2, 0.7, 0.4, 0.9, 0.1, 0.5]));
    expect(new Set(shallow.map((t) => t.type))).toEqual(new Set(['alarm']));

    const weighted = placeFloorTraps(room(), 9, [{ ...deep, weight: 0 }, ALARM], exactly(4), context, seq([0.99, 0.01, 0.5]));
    expect(new Set(weighted.map((t) => t.type))).toEqual(new Set(['alarm']));

    const copied = placeFloorTraps(room(), 9, [deep], exactly(1), context, seq([0.5]))[0];
    expect(copied).toMatchObject({ type: 'teleport', definitionId: 'teleport', concealment: 18, disarmDifficulty: 16 });
  });

  it('places nothing without a band, a definition, or a positive count', () => {
    expect(placeFloorTraps(room(), 1, [PIT], { perFloor: [{ minFloor: 2, min: 3, max: 3 }] }, context, seq([0.5]))).toEqual([]);
    expect(placeFloorTraps(room(), 1, [], exactly(3), context, seq([0.5]))).toEqual([]);
    expect(placeFloorTraps(room(), 1, [PIT], exactly(0), context, seq([0.5]))).toEqual([]);
  });

  it('a floor with traps round-trips through a save: positions, numbers and revealed/disarmed state', () => {
    const map = room();
    const traps = placeFloorTraps(map, 6, [PIT, ALARM], exactly(4), context, seq([0.31, 0.62, 0.93, 0.14, 0.45]));
    traps[0].revealed = true;
    traps[1].disarmed = true;
    traps[2].triggered = true;
    traps[3].concealment = 17;
    const back = deserializeMapObject(JSON.parse(JSON.stringify(serializeMapObject(map))));
    const key = (t: TrapInstance) =>
      `${t.id}|${t.type}|${t.x},${t.y}|${t.damage}|${t.concealment}|${t.disarmDifficulty}|${t.revealed}|${t.triggered}|${t.disarmed}`;
    expect(back.getAllTraps().map(key).sort()).toEqual(traps.map(key).sort());
  });
});

describe('generated cotw floors hide traps (manifest.trapPlacement)', () => {
  const FLOORS = Array.from({ length: 49 }, (_, i) => i + 1);
  const SEEDS = [1, 2, 3, 4];
  const noTraps = { ...cotwManifest, trapPlacement: undefined };

  it('each trap unlocks at the depth the owner set: pits 1, darts 3, alarms 5, teleport runes 8', () => {
    const unlocks = Object.fromEntries(cotwManifest.traps!.map((d) => [d.type, d.minFloor ?? 1]));
    expect(unlocks).toEqual({ pit: 1, arrow: 3, alarm: 5, teleport: 8 });
  });

  it('every floor 1-49 hides a count inside its band, on legal sites, and the stairs stay reachable', () => {
    let total = 0;
    for (const floor of FLOORS) {
      const range = trapCountRange(cotwManifest.trapPlacement!, floor)!;
      for (const seed of SEEDS) {
        const r = DungeonArc.generateFloor(floor, seed * 7919, cotwManifest.quest, cotwManifest);
        const traps = r.map.getAllTraps();
        const where = `floor ${floor} seed ${seed}`;
        expect(traps.length, where).toBeGreaterThanOrEqual(range.min);
        expect(traps.length, where).toBeLessThanOrEqual(range.max);
        total += traps.length;
        const reach = new SpawnSiteFilter(r.map, { anchor: r.playerSpawn, minDistance: 0 });
        for (const t of traps) {
          expect(r.map.getTile(t.x, t.y)?.type, where).toBe('floor');
          expect(r.map.getItemsAt(t.x, t.y), where).toEqual([]);
          expect(r.map.getEntityAt(t.x, t.y), where).toBeNull();
          expect(reach.reaches(t.x, t.y), `${where}: a trap behind a secret door or in a cage`).toBe(true);
          expect(Math.hypot(t.x - r.playerSpawn.x, t.y - r.playerSpawn.y), where).toBeGreaterThanOrEqual(TRAP_ARRIVAL_CLEARANCE);
          if (r.stairsDown) {
            expect(Math.max(Math.abs(t.x - r.stairsDown.x), Math.abs(t.y - r.stairsDown.y)), where).toBeGreaterThanOrEqual(TRAP_STAIRS_CLEARANCE);
          }
          const def = cotwManifest.traps!.find((d) => d.type === t.type)!;
          expect(floor, `${where}: ${t.type} above its minFloor`).toBeGreaterThanOrEqual(def.minFloor ?? 1);
        }
        if (r.stairsDown) expect(reach.reaches(r.stairsDown.x, r.stairsDown.y), where).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(FLOORS.length * SEEDS.length);
  }, 60_000);

  it('the same seed hides the same traps, and the monsters and items are those of a floor without traps', () => {
    for (const floor of [2, 9, 17, 33, 46]) {
      const a = DungeonArc.generateFloor(floor, 4242, cotwManifest.quest, cotwManifest);
      const b = DungeonArc.generateFloor(floor, 4242, cotwManifest.quest, cotwManifest);
      const plain = DungeonArc.generateFloor(floor, 4242, cotwManifest.quest, noTraps);
      const trapKey = (m: GameMap) => m.getAllTraps().map((t) => `${t.id}@${t.x},${t.y}:${t.type}`);
      expect(trapKey(a.map)).toEqual(trapKey(b.map));
      expect(plain.map.getAllTraps()).toEqual([]);
      const monsters = (m: GameMap) => m.getAllEntities().map((e) => `${e.id}@${e.x},${e.y}:${e.hp}`).sort();
      const items = (m: GameMap) => m.getAllGroundItems().flatMap((p) => p.items.map((i) => `${i.id}@${p.x},${p.y}`)).sort();
      expect(monsters(a.map)).toEqual(monsters(plain.map));
      expect(items(a.map)).toEqual(items(plain.map));
    }
  });
});
