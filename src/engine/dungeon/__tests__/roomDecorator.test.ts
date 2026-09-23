import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { PRNG } from '../prng';
import { RoomDecorator } from '../roomDecorator';
import { DungeonGenerator } from '../dungeon-generator';
import type { RectRoom } from '../dungeon-generator';
import { COTW_ROOM_DECORATION } from '../../../content/cotw/floorBands';

describe('RoomDecorator — Zone-Specific Tactical Architecture & Theming', () => {
  function createTestMapAndRoom(w: number = 10, h: number = 10): { map: GameMap; room: RectRoom } {
    const map = new GameMap(w + 10, h + 10, TILES.WALL);
    const room: RectRoom = {
      x1: 2,
      y1: 2,
      x2: 2 + w - 1,
      y2: 2 + h - 1,
      centerX: Math.floor(2 + (w - 1) / 2),
      centerY: Math.floor(2 + (h - 1) / 2),
    };
    // Carve room floor
    for (let y = room.y1; y <= room.y2; y++) {
      for (let x = room.x1; x <= room.x2; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    // Set a doorway tile on top wall
    map.setTile(room.centerX, room.y1 - 1, TILES.DOOR_CLOSED);
    return { map, room };
  }

  it('skips room 0 (safe player spawn room)', () => {
    const { map, room } = createTestMapAndRoom(10, 10);
    const prng = new PRNG(12345);

    // Only room 0 in the list
    RoomDecorator.decorateRooms(map, [room], prng, 1, COTW_ROOM_DECORATION);

    // All room tiles should still be FLOOR
    for (let y = room.y1; y <= room.y2; y++) {
      for (let x = room.x1; x <= room.x2; x++) {
        expect(map.getTile(x, y)?.type).toBe('floor');
      }
    }
  });

  it('skips rooms smaller than 7x7', () => {
    const { map, room } = createTestMapAndRoom(6, 6);
    const prng = new PRNG(12345);
    const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };

    RoomDecorator.decorateRooms(map, [dummyRoom0, room], prng, 1, COTW_ROOM_DECORATION);

    for (let y = room.y1; y <= room.y2; y++) {
      for (let x = room.x1; x <= room.x2; x++) {
        expect(map.getTile(x, y)?.type).toBe('floor');
      }
    }
  });

  it('scatters shallow water ice puddles on floor 1..9 (Rime Hollows)', () => {
    let foundWater = false;
    for (let seed = 1; seed <= 50; seed++) {
      const { map, room } = createTestMapAndRoom(10, 10);
      const prng = new PRNG(seed);
      const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };

      RoomDecorator.decorateRooms(map, [dummyRoom0, room], prng, 3, COTW_ROOM_DECORATION);

      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          if (map.getTile(x, y)?.type === 'shallow_water') {
            foundWater = true;
            break;
          }
        }
        if (foundWater) break;
      }
      if (foundWater) break;
    }
    expect(foundWater).toBe(true);
  });

  it('places iron bars partitions on floor 10..17 (Dwarven Works)', () => {
    let foundIronBars = false;
    for (let seed = 1; seed <= 50; seed++) {
      const { map, room } = createTestMapAndRoom(8, 8);
      const prng = new PRNG(seed);
      const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };

      RoomDecorator.decorateRooms(map, [dummyRoom0, room], prng, 12, COTW_ROOM_DECORATION);

      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          if (map.getTile(x, y)?.type === 'iron_bars') {
            foundIronBars = true;
            break;
          }
        }
        if (foundIronBars) break;
      }
      if (foundIronBars) break;
    }
    expect(foundIronBars).toBe(true);
  });

  it('places chasm fissures on floor 18..25 (Obsidian Siphon)', () => {
    let foundChasm = false;
    for (let seed = 1; seed <= 50; seed++) {
      const { map, room } = createTestMapAndRoom(10, 10);
      const prng = new PRNG(seed);
      const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };

      RoomDecorator.decorateRooms(map, [dummyRoom0, room], prng, 20, COTW_ROOM_DECORATION);

      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          if (map.getTile(x, y)?.type === 'chasm') {
            foundChasm = true;
            break;
          }
        }
        if (foundChasm) break;
      }
      if (foundChasm) break;
    }
    expect(foundChasm).toBe(true);
  });

  it('places no zone terrain (water, chasms, iron bars) when the pack declares no bands', () => {
    for (let floor = 1; floor <= 50; floor += 3) {
      for (let seed = 100; seed <= 110; seed++) {
        const { map, room } = createTestMapAndRoom(10, 10);
        const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };
        RoomDecorator.decorateRooms(map, [dummyRoom0, room], new PRNG(seed), floor);
        for (let y = room.y1; y <= room.y2; y++) {
          for (let x = room.x1; x <= room.x2; x++) {
            expect(['shallow_water', 'chasm', 'iron_bars']).not.toContain(map.getTile(x, y)?.type);
          }
        }
      }
    }
  });

  it('never places impassable obstacles in the door zone or room center', () => {
    for (let floor = 1; floor <= 50; floor += 7) {
      for (let seed = 100; seed <= 120; seed++) {
        const { map, room } = createTestMapAndRoom(10, 10);
        const prng = new PRNG(seed);
        const dummyRoom0: RectRoom = { x1: 0, y1: 0, x2: 1, y2: 1, centerX: 0, centerY: 0 };

        RoomDecorator.decorateRooms(map, [dummyRoom0, room], prng, floor, COTW_ROOM_DECORATION);

        // Door zone: tile directly below top door (room.centerX, room.y1)
        const doorStep = map.getTile(room.centerX, room.y1);
        expect(doorStep?.passable).toBe(true);

        // Center tile
        const centerTile = map.getTile(room.centerX, room.centerY);
        expect(centerTile?.passable).toBe(true);
      }
    }
  });

  function isReachable(map: GameMap, start: { x: number; y: number }, target: { x: number; y: number }): boolean {
    const queue = [{ x: start.x, y: start.y }];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.x === target.x && curr.y === target.y) {
        return true;
      }
      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];
      for (const n of neighbors) {
        const k = `${n.x},${n.y}`;
        if (!visited.has(k) && map.inBounds(n.x, n.y)) {
          const t = map.getTile(n.x, n.y);
          if (t && (t.passable || t.type.includes('door'))) {
            visited.add(k);
            queue.push(n);
          }
        }
      }
    }
    return false;
  }

  it('DungeonGenerator integrates floorNumber and generates valid reachable layouts across zones', () => {
    const testFloors = [1, 5, 12, 20, 28, 38, 45, 50];
    for (const floorNumber of testFloors) {
      const generator = new DungeonGenerator({
        width: 40,
        height: 30,
        maxRooms: 8,
        minRoomSize: 6,
        maxRoomSize: 10,
        seed: 42 + floorNumber,
        floorNumber,
        spawnMonsters: false,
        enableDecoration: true,
      });

      const result = generator.generate();
      expect(result.rooms.length).toBeGreaterThanOrEqual(3);
      // Verify reachability between spawn and stairs down
      expect(isReachable(result.map, result.playerSpawn, result.stairsDown)).toBe(true);
    }
  });
});
