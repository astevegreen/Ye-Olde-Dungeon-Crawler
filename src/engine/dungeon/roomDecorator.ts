import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { RectRoom } from './dungeon-generator';
import type { PRNG } from './prng';

export class RoomDecorator {
  /**
   * Decorates eligible procedural rooms (width >= 7 and height >= 7) with pillars,
   * colonnades, and tactical cover geometry while preserving door clearance and reachability.
   */
  public static decorateRooms(
    map: GameMap,
    rooms: RectRoom[],
    prng: PRNG,
    floorNumber: number = 1
  ): void {
    // Skip room 0 (safe player spawn room)
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      const w = room.x2 - room.x1 + 1;
      const h = room.y2 - room.y1 + 1;

      if (w < 7 || h < 7) {
        continue;
      }

      this.decorateSingleRoom(map, room, w, h, prng, floorNumber);
    }
  }

  private static decorateSingleRoom(
    map: GameMap,
    room: RectRoom,
    w: number,
    h: number,
    prng: PRNG,
    floorNumber: number
  ): void {
    const doorways = this.findRoomDoorways(map, room);
    const isDoorZone = (x: number, y: number): boolean => {
      return doorways.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
    };
    const isReservedZone = (x: number, y: number): boolean => {
      if (Math.abs(x - room.centerX) <= 1 && Math.abs(y - room.centerY) <= 1) {
        return true;
      }
      return isDoorZone(x, y);
    };

    // Zone Scatter Pass 1: Shallow Water Ice Puddles / Drainage
    // Floors 1–9 (Rime Hollows): Scatter cracked ice puddles (shallow water)
    if (floorNumber >= 1 && floorNumber <= 9 && prng.next() < 0.4) {
      const puddleX = prng.next() < 0.5 ? room.x1 + 2 : Math.max(room.x1 + 2, room.x2 - 3);
      const puddleY = prng.next() < 0.5 ? room.y1 + 2 : Math.max(room.y1 + 2, room.y2 - 3);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const tx = puddleX + dx;
          const ty = puddleY + dy;
          if (tx > room.x1 && tx < room.x2 && ty > room.y1 && ty < room.y2) {
            if (!isDoorZone(tx, ty)) {
              map.setTile(tx, ty, TILES.SHALLOW_WATER);
            }
          }
        }
      }
    }

    // Floors 26–33 (Tarnished Silver Veins): Mine drainage runoff
    if (floorNumber >= 26 && floorNumber <= 33 && prng.next() < 0.3) {
      const puddleX = prng.next() < 0.5 ? room.x1 + 2 : Math.max(room.x1 + 2, room.x2 - 3);
      const puddleY = prng.next() < 0.5 ? room.y1 + 2 : Math.max(room.y1 + 2, room.y2 - 3);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const tx = puddleX + dx;
          const ty = puddleY + dy;
          if (tx > room.x1 && tx < room.x2 && ty > room.y1 && ty < room.y2) {
            if (!isDoorZone(tx, ty)) {
              map.setTile(tx, ty, TILES.SHALLOW_WATER);
            }
          }
        }
      }
    }

    // Zone Tactical Hazards / Fissures:
    // Floors 18–25 (Obsidian Siphon): Chasm heat fissures
    if (floorNumber >= 18 && floorNumber <= 25 && prng.next() < 0.35) {
      const isHorizontal = prng.next() < 0.5;
      const fissureLen = 2 + (prng.next() < 0.5 ? 1 : 0);
      if (isHorizontal) {
        const fy = prng.next() < 0.5 ? room.y1 + 2 : room.y2 - 2;
        const startX = room.x1 + 2;
        for (let x = startX; x < startX + fissureLen && x <= room.x2 - 2; x++) {
          if (!isReservedZone(x, fy)) {
            map.setTile(x, fy, TILES.CHASM);
          }
        }
      } else {
        const fx = prng.next() < 0.5 ? room.x1 + 2 : room.x2 - 2;
        const startY = room.y1 + 2;
        for (let y = startY; y < startY + fissureLen && y <= room.y2 - 2; y++) {
          if (!isReservedZone(fx, y)) {
            map.setTile(fx, y, TILES.CHASM);
          }
        }
      }
      return;
    }

    // Floors 43+ (Maw of Malice & The Rotting Root): Abyssal Void Fissures
    if (floorNumber >= 43 && prng.next() < 0.35) {
      const isHorizontal = prng.next() < 0.5;
      const fissureLen = 2 + (prng.next() < 0.5 ? 1 : 0);
      if (isHorizontal) {
        const fy = prng.next() < 0.5 ? room.y1 + 2 : room.y2 - 2;
        const startX = room.x1 + 2;
        for (let x = startX; x < startX + fissureLen && x <= room.x2 - 2; x++) {
          if (!isReservedZone(x, fy)) {
            map.setTile(x, fy, TILES.CHASM);
          }
        }
      } else {
        const fx = prng.next() < 0.5 ? room.x1 + 2 : room.x2 - 2;
        const startY = room.y1 + 2;
        for (let y = startY; y < startY + fissureLen && y <= room.y2 - 2; y++) {
          if (!isReservedZone(fx, y)) {
            map.setTile(fx, y, TILES.CHASM);
          }
        }
      }
      return;
    }

    // Architectural Style 1: Grand Hall Colonnade (2x2 Pillars) for w >= 9 && h >= 9
    const grandHallChance =
      floorNumber >= 10 && floorNumber <= 25 ? 0.75 : floorNumber <= 9 ? 0.3 : 0.6;
    if (w >= 9 && h >= 9 && prng.next() < grandHallChance) {
      const pillarOffsets = [
        { x: room.x1 + 2, y: room.y1 + 2 },
        { x: room.x2 - 3, y: room.y1 + 2 },
        { x: room.x1 + 2, y: room.y2 - 3 },
        { x: room.x2 - 3, y: room.y2 - 3 },
      ];

      for (const p of pillarOffsets) {
        // Check 2x2 clearance from doors and center
        let canPlace = true;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (isReservedZone(p.x + dx, p.y + dy)) {
              canPlace = false;
            }
          }
        }
        if (canPlace) {
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              map.setTile(p.x + dx, p.y + dy, TILES.PILLAR);
            }
          }
        }
      }
      return;
    }

    // Architectural Style 2: Medium Room 1x1 Pillars for w >= 7 && h >= 7
    const mediumPillarChance =
      (floorNumber >= 18 && floorNumber <= 25) || (floorNumber >= 34 && floorNumber <= 42)
        ? 0.7
        : floorNumber <= 9
        ? 0.25
        : 0.5;
    if (prng.next() < mediumPillarChance) {
      const singlePillars = [
        { x: room.x1 + 2, y: room.y1 + 2 },
        { x: room.x2 - 2, y: room.y1 + 2 },
        { x: room.x1 + 2, y: room.y2 - 2 },
        { x: room.x2 - 2, y: room.y2 - 2 },
      ];

      for (const p of singlePillars) {
        if (!isReservedZone(p.x, p.y)) {
          map.setTile(p.x, p.y, TILES.PILLAR);
        }
      }
      return;
    }

    // Architectural Style 3: Interior Tactical Partitions (Walls or Iron Bars in Dwarven Works)
    if (w >= 8 && h >= 8) {
      const isHorizontal = prng.next() < 0.5;
      const partitionTile =
        floorNumber >= 10 && floorNumber <= 17 && prng.next() < 0.5
          ? TILES.IRON_BARS
          : TILES.WALL;

      if (isHorizontal) {
        const wallY = prng.next() < 0.5 ? room.y1 + 2 : room.y2 - 2;
        const startX = room.x1 + 2;
        const length = Math.min(3, w - 4);
        for (let x = startX; x < startX + length; x++) {
          if (!isReservedZone(x, wallY)) {
            map.setTile(x, wallY, partitionTile);
          }
        }
      } else {
        const wallX = prng.next() < 0.5 ? room.x1 + 2 : room.x2 - 2;
        const startY = room.y1 + 2;
        const length = Math.min(3, h - 4);
        for (let y = startY; y < startY + length; y++) {
          if (!isReservedZone(wallX, y)) {
            map.setTile(wallX, y, partitionTile);
          }
        }
      }
    }
  }

  private static findRoomDoorways(
    map: GameMap,
    room: RectRoom
  ): Array<{ x: number; y: number }> {
    const doorways: Array<{ x: number; y: number }> = [];

    // Check top and bottom boundaries
    for (let x = room.x1; x <= room.x2; x++) {
      const top = map.getTile(x, room.y1 - 1);
      if (top && (top.type.includes('door') || top.type === 'floor')) {
        doorways.push({ x, y: room.y1 });
      }
      const bot = map.getTile(x, room.y2 + 1);
      if (bot && (bot.type.includes('door') || bot.type === 'floor')) {
        doorways.push({ x, y: room.y2 });
      }
    }

    // Check left and right boundaries
    for (let y = room.y1; y <= room.y2; y++) {
      const left = map.getTile(room.x1 - 1, y);
      if (left && (left.type.includes('door') || left.type === 'floor')) {
        doorways.push({ x: room.x1, y });
      }
      const right = map.getTile(room.x2 + 1, y);
      if (right && (right.type.includes('door') || right.type === 'floor')) {
        doorways.push({ x: room.x2, y });
      }
    }

    return doorways;
  }
}
