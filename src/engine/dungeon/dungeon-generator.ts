import type { Position } from '../types';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Monster } from '../entities/monster';
import { flightRecorder } from '../debug/flightRecorder';
import { PRNG } from './prng';
import { CorridorGraph, BraidWeaver } from './corridors';
import { RoomDecorator } from './roomDecorator';
import { VaultStamper, type VaultBlueprint } from './vaultStamp';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { ItemDefinition } from '../types/manifest';

export interface RectRoom {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

export interface DungeonConfig {
  width: number;
  height: number;
  maxRooms?: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  seed?: number;
  spawnMonsters?: boolean;
  floorNumber?: number;
  vaults?: VaultBlueprint[];
  monsterCandidates?: MonsterDefinition[];
  itemCandidates?: ItemDefinition[];
  enableBraiding?: boolean;
  enableDecoration?: boolean;
}

export interface DungeonResult {
  map: GameMap;
  playerSpawn: Position;
  stairsDown: Position;
  rooms: RectRoom[];
  monsters: Monster[];
  graph?: CorridorGraph;
}

export class DungeonGenerator {
  private prng: PRNG;
  private width: number;
  private height: number;
  private maxRooms: number;
  private minRoomSize: number;
  private maxRoomSize: number;
  private spawnMonsters: boolean;
  public floorNumber?: number;
  public vaults: VaultBlueprint[];
  public monsterCandidates: MonsterDefinition[];
  public itemCandidates: ItemDefinition[];
  public enableBraiding: boolean;
  public enableDecoration: boolean;

  constructor(config: DungeonConfig) {
    this.width = config.width;
    this.height = config.height;
    this.maxRooms = config.maxRooms ?? 10;
    this.minRoomSize = config.minRoomSize ?? 5;
    this.maxRoomSize = config.maxRoomSize ?? 10;
    this.spawnMonsters = config.spawnMonsters ?? true;
    this.prng = new PRNG(config.seed);
    this.floorNumber = config.floorNumber;
    this.vaults = config.vaults ?? [];
    this.monsterCandidates = config.monsterCandidates ?? [];
    this.itemCandidates = config.itemCandidates ?? [];
    this.enableBraiding = config.enableBraiding ?? true;
    this.enableDecoration = config.enableDecoration ?? true;
  }

  public generate(): DungeonResult {
    // Attempt generation with reachability guarantee
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = this.tryGenerate();
      if (this.isReachable(result.map, result.playerSpawn, result.stairsDown)) {
        return result;
      }
    }

    // Fallback: guaranteed simple connected 2-room layout if 10 attempts failed
    return this.createFallbackDungeon();
  }

  private tryGenerate(): DungeonResult {
    const map = new GameMap(this.width, this.height, TILES.WALL);
    const rooms: RectRoom[] = [];
    const monsters: Monster[] = [];
    const vaultRoomIndices = new Set<number>();
    const allConnectors: Position[] = [];

    // 1. Vault Stamping Pass (1–2 vaults if floorNumber >= 3)
    if (this.floorNumber !== undefined && this.vaults && this.vaults.length > 0) {
      const eligible = this.vaults.filter(
        (v) => (v.minFloor ?? 1) <= this.floorNumber! && (!v.maxFloor || v.maxFloor >= this.floorNumber!)
      );
      if (eligible.length > 0) {
        const vaultCount = Math.min(2, Math.floor(this.prng.next() * 2) + 1); // 1 or 2
        for (let vi = 0; vi < vaultCount; vi++) {
          const blueprint = eligible[Math.floor(this.prng.next() * eligible.length)];
          const vH = blueprint.layout.length;
          const vW = blueprint.layout[0]?.length ?? 0;
          if (vW + 4 >= this.width || vH + 4 >= this.height) continue;

          for (let attempt = 0; attempt < 25; attempt++) {
            const vx = this.prng.nextInt(2, this.width - vW - 2);
            const vy = this.prng.nextInt(2, this.height - vH - 2);

            const vRoom: RectRoom = {
              x1: vx,
              y1: vy,
              x2: vx + vW - 1,
              y2: vy + vH - 1,
              centerX: Math.floor(vx + vW / 2),
              centerY: Math.floor(vy + vH / 2),
            };

            if (rooms.some((other) => this.roomIntersects(vRoom, other, 2))) {
              continue;
            }

            const stamped = VaultStamper.stamp(
              map,
              blueprint,
              vx,
              vy,
              this.floorNumber,
              this.monsterCandidates,
              this.itemCandidates,
              () => this.prng.next()
            );
            vaultRoomIndices.add(rooms.length);
            rooms.push(vRoom);
            allConnectors.push(...stamped.connectors);
            break;
          }
        }
      }
    }

    // 2. Standard BSP Room Carving
    for (let r = 0; r < this.maxRooms * 2 && rooms.length < this.maxRooms; r++) {
      const w = this.prng.nextInt(this.minRoomSize, this.maxRoomSize);
      const h = this.prng.nextInt(this.minRoomSize, this.maxRoomSize);
      const x = this.prng.nextInt(1, this.width - w - 2);
      const y = this.prng.nextInt(1, this.height - h - 2);

      const newRoom: RectRoom = {
        x1: x,
        y1: y,
        x2: x + w,
        y2: y + h,
        centerX: Math.floor(x + w / 2),
        centerY: Math.floor(y + h / 2),
      };

      // Check overlap with existing rooms (1 tile padding)
      const overlaps = rooms.some((other) => this.roomIntersects(newRoom, other, 1));
      if (overlaps) {
        continue;
      }

      // Carve room floor
      this.carveRoom(map, newRoom);
      rooms.push(newRoom);
    }

    if (rooms.length === 0) {
      return this.createFallbackDungeon();
    }

    // 3. Corridor Carving & Braiding
    const graph = new CorridorGraph(rooms.length);
    for (let i = 1; i < rooms.length; i++) {
      BraidWeaver.carveCorridor(
        map,
        rooms[i - 1].centerX,
        rooms[i - 1].centerY,
        rooms[i].centerX,
        rooms[i].centerY,
        this.prng
      );
      graph.addEdge(i - 1, i);
    }

    // Connect vault entrance connectors outward to nearest room centers
    for (const conn of allConnectors) {
      let nearestRoom = rooms[0];
      let minDist = Infinity;
      for (const rm of rooms) {
        const d = Math.hypot(rm.centerX - conn.x, rm.centerY - conn.y);
        if (d < minDist) {
          minDist = d;
          nearestRoom = rm;
        }
      }
      BraidWeaver.carveCorridor(map, conn.x, conn.y, nearestRoom.centerX, nearestRoom.centerY, this.prng);
    }

    if (this.enableBraiding) {
      BraidWeaver.braidRooms(map, rooms, graph, this.prng, 0.30);
    }

    // 4. Doors at entry junctions
    this.placeDoors(map, rooms);

    // 5. Room Cover & Architecture Decoration (Pillars, Colonnades, Partitions)
    if (this.enableDecoration) {
      const nonVaultRooms = rooms.filter((_, idx) => !vaultRoomIndices.has(idx));
      RoomDecorator.decorateRooms(map, nonVaultRooms, this.prng);
    }

    const playerSpawn: Position = {
      x: rooms[0].centerX,
      y: rooms[0].centerY,
    };

    const lastRoom = rooms[rooms.length - 1];
    const stairsDown: Position = {
      x: lastRoom.centerX,
      y: lastRoom.centerY,
    };

    // Place exit stairs
    map.setTile(stairsDown.x, stairsDown.y, TILES.STAIRS_DOWN);

    // Spawn monsters in non-starting rooms
    if (this.spawnMonsters) {
      this.populateMonsters(map, rooms, monsters);
    }

    // Collect any monsters already added to map during vault stamping
    for (const ent of map.getAllEntities()) {
      if (ent instanceof Monster && !monsters.includes(ent)) {
        monsters.push(ent);
      }
    }

    return {
      map,
      playerSpawn,
      stairsDown,
      rooms,
      monsters,
      graph,
    };
  }

  private roomIntersects(r1: RectRoom, r2: RectRoom, padding: number): boolean {
    return (
      r1.x1 - padding <= r2.x2 &&
      r1.x2 + padding >= r2.x1 &&
      r1.y1 - padding <= r2.y2 &&
      r1.y2 + padding >= r2.y1
    );
  }

  private carveRoom(map: GameMap, room: RectRoom): void {
    for (let y = room.y1; y <= room.y2; y++) {
      for (let x = room.x1; x <= room.x2; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
  }



  private placeDoors(map: GameMap, rooms: RectRoom[]): void {
    // Look for single-tile corridor choke points leading into rooms
    for (const room of rooms) {
      // Top and bottom room edges
      for (let x = room.x1; x <= room.x2; x++) {
        this.checkAndPlaceDoor(map, x, room.y1 - 1);
        this.checkAndPlaceDoor(map, x, room.y2 + 1);
      }
      // Left and right room edges
      for (let y = room.y1; y <= room.y2; y++) {
        this.checkAndPlaceDoor(map, room.x1 - 1, y);
        this.checkAndPlaceDoor(map, room.x2 + 1, y);
      }
    }
  }

  private checkAndPlaceDoor(map: GameMap, x: number, y: number): void {
    if (!map.inBounds(x, y)) return;
    const currentTile = map.getTile(x, y);
    if (!currentTile || currentTile.type !== 'floor') return;

    const north = map.getTile(x, y - 1);
    const south = map.getTile(x, y + 1);
    const west = map.getTile(x - 1, y);
    const east = map.getTile(x + 1, y);

    // Horizontal doorway: North and South are walls, West and East are floors
    const isHorizontalChoke =
      north?.type === 'wall' &&
      south?.type === 'wall' &&
      west?.type === 'floor' &&
      east?.type === 'floor';

    // Vertical doorway: West and East are walls, North and South are floors
    const isVerticalChoke =
      west?.type === 'wall' &&
      east?.type === 'wall' &&
      north?.type === 'floor' &&
      south?.type === 'floor';

    if (isHorizontalChoke || isVerticalChoke) {
      // 80% closed doors, 20% open doors
      const doorTile = this.prng.next() < 0.2 ? TILES.DOOR_OPEN : TILES.DOOR_CLOSED;
      map.setTile(x, y, doorTile);
    }
  }

  private populateMonsters(map: GameMap, rooms: RectRoom[], monsters: Monster[]): void {
    let monsterId = 1;
    // Skip room 0 (safe player spawn room)
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      const count = this.prng.nextInt(1, 2);

      for (let m = 0; m < count; m++) {
        const mx = this.prng.nextInt(room.x1, room.x2);
        const my = this.prng.nextInt(room.y1, room.y2);

        // Do not spawn on stairs or existing entities
        const tile = map.getTile(mx, my);
        if (!tile || !tile.passable || tile.type === 'stairs_down') {
          continue;
        }
        if (map.getEntityAt(mx, my)) {
          continue;
        }

        let defId: string;
        if (i === 1 && m === 0) {
          // Guarantee a Kobold Shaman in the first monster room for tactical magic encounters
          defId = 'kobold_shaman';
        } else {
          const roll = this.prng.next();
          if (roll < 0.25) {
            defId = 'kobold';
          } else if (roll < 0.45) {
            defId = 'skeleton';
          } else if (roll < 0.65) {
            defId = 'giant_rat';
          } else if (roll < 0.85) {
            defId = 'kobold_shaman';
          } else if (roll < 0.95) {
            defId = 'goblin';
          } else {
            defId = 'ogre';
          }
        }

        const monster = this.spawnDefinedMonster(defId, `monster-${monsterId++}`, { x: mx, y: my });
        if (!monster) continue;
        map.addEntity(monster);
        monsters.push(monster);
      }
    }
  }

  private isReachable(map: GameMap, start: Position, target: Position): boolean {
    const queue: Position[] = [start];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === target.x && current.y === target.y) {
        return true;
      }

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const key = `${nx},${ny}`;

        if (map.inBounds(nx, ny) && !visited.has(key)) {
          const tile = map.getTile(nx, ny);
          // Closed doors are interactable/passable for reachability check
          if (tile && (tile.passable || tile.type === 'door_closed')) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    return false;
  }

  private createFallbackDungeon(): DungeonResult {
    const map = new GameMap(this.width, this.height, TILES.WALL);
    const room1: RectRoom = {
      x1: 3,
      y1: 3,
      x2: 9,
      y2: 8,
      centerX: 6,
      centerY: 5,
    };
    const room2: RectRoom = {
      x1: 15,
      y1: 3,
      x2: 21,
      y2: 8,
      centerX: 18,
      centerY: 5,
    };

    this.carveRoom(map, room1);
    this.carveRoom(map, room2);
    BraidWeaver.carveHTunnel(map, room1.centerX, room2.centerX, 5);

    map.setTile(room1.x2 + 1, 5, TILES.DOOR_CLOSED);

    const playerSpawn: Position = { x: room1.centerX, y: room1.centerY };
    const stairsDown: Position = { x: room2.centerX, y: room2.centerY };
    map.setTile(stairsDown.x, stairsDown.y, TILES.STAIRS_DOWN);

    const monsters: Monster[] = [];
    if (this.spawnMonsters && this.monsterCandidates.length > 0) {
      const candidate = this.monsterCandidates[this.prng.nextInt(0, this.monsterCandidates.length - 1)];
      const monster = this.spawnDefinedMonster(candidate.id, 'fallback-monster', {
        x: room2.centerX,
        y: room2.centerY - 1,
      });
      if (monster) {
        map.addEntity(monster);
        monsters.push(monster);
      }
    }

    const fallbackGraph = new CorridorGraph(2);
    fallbackGraph.addEdge(0, 1);

    return {
      map,
      playerSpawn,
      stairsDown,
      rooms: [room1, room2],
      monsters,
      graph: fallbackGraph,
    };
  }

  /**
   * `Monster.createFromDefinition` throws on an unregistered ID. Generation also runs outside
   * the action pipeline (character creation, UI-confirmed floor changes), so a missing
   * definition is skipped and recorded instead of crashing generation or faking a creature.
   */
  private spawnDefinedMonster(defId: string, id: string, position: Position): Monster | null {
    try {
      return Monster.createFromDefinition(defId, id, position);
    } catch (err) {
      flightRecorder.recordWarning(`Skipped spawning unregistered monster definition '${defId}'`, {
        source: 'DungeonGenerator',
        definitionId: defId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
