import type { GameMap } from '../grid/map';
import type { Position } from '../types';

/**
 * Where loot lies (tracker 5.7, N22: "chests and items in more sensible places"). A loot tile is
 * open floor: walkable, empty of actors and other loot, and not a door, stairs, water, a trap or a
 * fixture (a tile with an interaction). Chests also stand against a wall, in a corner or an alcove
 * where the room has one; loose items never lie in a 1-wide passage.
 */
type Room = { x1: number; y1: number; x2: number; y2: number };

const SIDES = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

function isWater(map: GameMap, x: number, y: number): boolean {
  const tile = map.getTile(x, y);
  return Boolean(tile?.type.includes('water') || map.surfaces?.getCell(x, y)?.surface?.type === 'water');
}

/** Open floor a thing may lie on, by itself or dropped by a monster. */
function isOpenFloor(map: GameMap, x: number, y: number): boolean {
  const tile = map.getTile(x, y);
  if (!tile || !tile.passable || tile.walkable === false) return false;
  if (tile.isDoor || tile.isOpenDoor || tile.isClosedDoor || tile.type.startsWith('door')) return false;
  if (tile.isStairs || tile.type.startsWith('stairs')) return false;
  if (tile.interactionHandlerId || tile.type === 'trap' || map.getTrapAt(x, y)) return false;
  return !isWater(map, x, y);
}

/** How many of its four sides are blocked (walls, pillars, the edge). */
function blockedSides(map: GameMap, x: number, y: number): number {
  return SIDES.filter(([dx, dy]) => !map.isPassable(x + dx, y + dy)).length;
}

/** Blocked on two opposite sides: a 1-wide passage, a corridor or a doorway's throat. */
function isPassage(map: GameMap, x: number, y: number): boolean {
  const n = !map.isPassable(x, y - 1);
  const s = !map.isPassable(x, y + 1);
  const w = !map.isPassable(x - 1, y);
  const e = !map.isPassable(x + 1, y);
  return (n && s) || (w && e);
}

/**
 * A tile in the room for a chest or a loose drop, or null when the room has none. One rng draw.
 * `exclude` holds "x,y" keys of cells the loot must not use (a secret cache's).
 */
export function pickLootTile(
  map: GameMap,
  room: Room,
  rng: () => number,
  kind: 'chest' | 'loose',
  exclude?: ReadonlySet<string>
): Position | null {
  const tiles: Array<Position & { walls: number }> = [];
  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      if (!isOpenFloor(map, x, y) || map.getEntityAt(x, y) || map.getItemsAt(x, y).length > 0) continue;
      if (exclude?.has(`${x},${y}`) || isPassage(map, x, y)) continue;
      tiles.push({ x, y, walls: blockedSides(map, x, y) });
    }
  }
  if (tiles.length === 0) return null;
  let pool = tiles;
  if (kind === 'chest') {
    // A corner or an alcove where there is one, else against a wall, else wherever.
    const tucked = tiles.filter((t) => t.walls >= 2);
    const walled = tiles.filter((t) => t.walls >= 1);
    pool = tucked.length > 0 ? tucked : walled.length > 0 ? walled : tiles;
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  return { x: pick.x, y: pick.y };
}

/**
 * Where a monster's drop lands: where it died, unless that is a door, stairs, water or a fixture;
 * then the nearest open floor within 2 tiles (the death tile if there is none).
 */
export function dropTile(map: GameMap, x: number, y: number): Position {
  if (isOpenFloor(map, x, y)) return { x, y };
  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isOpenFloor(map, x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
  }
  return { x, y };
}
