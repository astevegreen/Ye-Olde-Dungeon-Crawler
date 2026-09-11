import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { Position } from '../types';
import type { RectRoom } from './dungeon-generator';
import type { TownReturnType } from '../townReturn/types';
import { ItemFactory } from '../items/factory';

export class TownReturnDispatcher {
  /**
   * Determines which town-return shortcut spawns on the given floor.
   * Returns null for floors < 5 or floors >= maxFloor (boss floor).
   */
  public static getShortcutTypeForFloor(floor: number, maxFloor: number = 25): TownReturnType | null {
    if (floor < 5 || floor >= maxFloor) {
      return null;
    }

    const cycle = (floor - 5) % 3;
    switch (cycle) {
      case 0:
        return 'runic_conduit';
      case 1:
        return 'valkyrie_sprint';
      case 2:
        return 'dwarven_winch';
      default:
        return null;
    }
  }

  /**
   * Spawns an interactive town-return fixture on the map in a dead-end alcove or corner room.
   */
  public static spawnShortcutFixture(
    map: GameMap,
    floor: number,
    maxFloor: number,
    rooms: RectRoom[],
    playerSpawn: Position,
    stairsDown?: Position
  ): { type: TownReturnType; position: Position } | null {
    const shortcutType = this.getShortcutTypeForFloor(floor, maxFloor);
    if (!shortcutType) return null;

    const targetPos = this.findAlcoveOrCornerLocation(map, rooms, playerSpawn, stairsDown);
    if (!targetPos) return null;

    switch (shortcutType) {
      case 'runic_conduit':
        map.setTile(targetPos.x, targetPos.y, TILES.RUNIC_CONDUIT);
        break;
      case 'valkyrie_sprint':
        map.setTile(targetPos.x, targetPos.y, TILES.VALKYRIE_SPRINT);
        break;
      case 'dwarven_winch': {
        map.setTile(targetPos.x, targetPos.y, TILES.DWARVEN_WINCH);
        // Spawn 2-3 heavy cobblestone ballast piles nearby to assist player with weight balance
        this.spawnBallastNearby(map, targetPos);
        break;
      }
    }

    return { type: shortcutType, position: targetPos };
  }

  /**
   * Searches for a dead-end alcove (3 walls adjacent) or room corner in secondary rooms.
   */
  public static findAlcoveOrCornerLocation(
    map: GameMap,
    rooms: RectRoom[],
    playerSpawn: Position,
    stairsDown?: Position
  ): Position | null {
    // 1. Separate secondary rooms (excluding rooms containing spawn and stairs)
    const secondaryRooms = rooms.filter((r) => {
      const containsSpawn =
        playerSpawn.x >= r.x1 && playerSpawn.x <= r.x2 && playerSpawn.y >= r.y1 && playerSpawn.y <= r.y2;
      const containsExit =
        stairsDown &&
        stairsDown.x >= r.x1 &&
        stairsDown.x <= r.x2 &&
        stairsDown.y >= r.y1 &&
        stairsDown.y <= r.y2;
      return !containsSpawn && !containsExit;
    });

    const candidateRooms = secondaryRooms.length > 0 ? secondaryRooms : rooms;

    let bestPos: Position | null = null;
    let bestScore = -1; // 3 walls = 300, 2 walls = 200, 1 wall = 100

    for (const room of candidateRooms) {
      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          const tile = map.getTile(x, y);
          if (!tile || tile.type !== 'floor') continue;

          // Don't place on top of existing stairs or entities
          if (map.getEntityAt(x, y)) continue;
          if (x === playerSpawn.x && y === playerSpawn.y) continue;
          if (stairsDown && x === stairsDown.x && y === stairsDown.y) continue;

          // Count adjacent orthogonal walls
          const neighbors = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
          ];
          const wallCount = neighbors.filter(
            (n) => !map.inBounds(n.x, n.y) || map.getTile(n.x, n.y)?.type === 'wall'
          ).length;

          // Prefer dead-end alcoves (3 walls), then corners (2 walls)
          let score = wallCount * 100;
          // Slight distance tie-breaker from player spawn
          score += Math.min(50, Math.floor(Math.hypot(x - playerSpawn.x, y - playerSpawn.y)));

          if (score > bestScore) {
            bestScore = score;
            bestPos = { x, y };
          }
        }
      }
    }

    // Fallback: If no room tile found, scan any valid floor tile with at least 1 adjacent wall
    if (!bestPos) {
      for (let y = 1; y < map.height - 1; y++) {
        for (let x = 1; x < map.width - 1; x++) {
          const tile = map.getTile(x, y);
          if (tile?.type === 'floor') {
            if ((x !== playerSpawn.x || y !== playerSpawn.y) && (!stairsDown || x !== stairsDown.x || y !== stairsDown.y)) {
              return { x, y };
            }
          }
        }
      }
    }

    return bestPos;
  }

  private static spawnBallastNearby(map: GameMap, center: Position): void {
    const offsets = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: -1 },
    ];

    const weights = [2000, 3500, 4500, 6000];
    let dropped = 0;
    for (const off of offsets) {
      if (dropped >= weights.length) break;
      const bx = center.x + off.dx;
      const by = center.y + off.dy;
      const tile = map.getTile(bx, by);
      if (tile && tile.type === 'floor' && !map.getEntityAt(bx, by)) {
        const ballast = ItemFactory.createScrapCobblestone(
          `ballast-${bx}-${by}-${dropped}`,
          weights[dropped]
        );
        map.addItemAt(bx, by, ballast);
        dropped++;
      }
    }
  }
}
