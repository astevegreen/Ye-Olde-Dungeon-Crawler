import type { Position } from '../types';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Monster } from '../entities/monster';
import { PRNG } from './prng';
import { DungeonGenerator, type RectRoom } from './dungeon-generator';
import type { VaultBlueprint } from './vaultStamp';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { ItemDefinition } from '../types/manifest';

export interface DungeonGenParams {
  width: number;
  height: number;
  floorNumber?: number;
  seed?: number;
  maxRooms?: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  spawnMonsters?: boolean;
  vaults?: VaultBlueprint[];
  monsterCandidates?: MonsterDefinition[];
  itemCandidates?: ItemDefinition[];
}

export interface GeneratedFloorData {
  map: GameMap;
  playerSpawn: Position;
  stairsDown: Position;
  stairsUp?: Position;
  rooms: RectRoom[];
  monsters: Monster[];
}

export interface DungeonGeneratorStrategy {
  readonly id: string;
  readonly name: string;
  generate(params: DungeonGenParams): GeneratedFloorData;
}

/**
 * Standard BSP / Rooms & Corridors Dungeon Generation Strategy.
 * Classic rectangular architecture used in Castle of the Winds dungeons.
 */
export class BspDungeonGenerator implements DungeonGeneratorStrategy {
  public readonly id = 'bsp';
  public readonly name = 'Rooms and Corridors (BSP)';

  public generate(params: DungeonGenParams): GeneratedFloorData {
    const generator = new DungeonGenerator({
      width: params.width,
      height: params.height,
      maxRooms: params.maxRooms ?? 10,
      minRoomSize: params.minRoomSize ?? 5,
      maxRoomSize: params.maxRoomSize ?? 10,
      seed: params.seed,
      spawnMonsters: params.spawnMonsters ?? false,
      floorNumber: params.floorNumber,
      vaults: params.vaults,
      monsterCandidates: params.monsterCandidates,
      itemCandidates: params.itemCandidates,
    });

    const result = generator.generate();
    return {
      map: result.map,
      playerSpawn: result.playerSpawn,
      stairsDown: result.stairsDown,
      stairsUp: result.playerSpawn,
      rooms: result.rooms,
      monsters: result.monsters,
    };
  }
}

/**
 * Cellular Automata Cave / Mine Generation Strategy.
 * Generates organic, winding natural caverns and subterranean grottos with guaranteed reachability.
 */
export class CellularAutomataGenerator implements DungeonGeneratorStrategy {
  public readonly id = 'cavern';
  public readonly name = 'Natural Caverns (Cellular Automata)';

  public generate(params: DungeonGenParams): GeneratedFloorData {
    const prng = new PRNG(params.seed);
    const { width, height } = params;

    // Retry loop to ensure valid cave generation with connected paths
    for (let attempt = 0; attempt < 10; attempt++) {
      const map = new GameMap(width, height, TILES.WALL);
      const grid: boolean[][] = []; // true = wall, false = floor

      // 1. Initial random distribution (46% initial walls)
      for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            grid[y][x] = true;
          } else {
            grid[y][x] = prng.next() < 0.46;
          }
        }
      }

      // 2. Cellular Automata Smoothing Iterations (4 rounds)
      for (let step = 0; step < 4; step++) {
        const nextGrid: boolean[][] = [];
        for (let y = 0; y < height; y++) {
          nextGrid[y] = [];
          for (let x = 0; x < width; x++) {
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
              nextGrid[y][x] = true;
              continue;
            }

            let wallCount = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (grid[y + dy][x + dx]) {
                  wallCount++;
                }
              }
            }

            // Standard B5678/S45678 cave rule
            nextGrid[y][x] = wallCount >= 5;
          }
        }
        for (let y = 0; y < height; y++) {
          grid[y] = nextGrid[y];
        }
      }

      // Carve floors into GameMap
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (!grid[y][x]) {
            map.setTile(x, y, TILES.FLOOR);
          }
        }
      }

      // 3. Flood Fill to find largest connected component
      const visited = new Set<string>();
      const regions: Position[][] = [];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const key = `${x},${y}`;
          if (map.isPassable(x, y) && !visited.has(key)) {
            const region: Position[] = [];
            const queue: Position[] = [{ x, y }];
            visited.add(key);

            while (queue.length > 0) {
              const curr = queue.shift()!;
              region.push(curr);

              const neighbors: Position[] = [
                { x: curr.x + 1, y: curr.y },
                { x: curr.x - 1, y: curr.y },
                { x: curr.x, y: curr.y + 1 },
                { x: curr.x, y: curr.y - 1 },
              ];

              for (const n of neighbors) {
                const nKey = `${n.x},${n.y}`;
                if (map.inBounds(n.x, n.y) && map.isPassable(n.x, n.y) && !visited.has(nKey)) {
                  visited.add(nKey);
                  queue.push(n);
                }
              }
            }

            regions.push(region);
          }
        }
      }

      if (regions.length === 0) continue;

      // Sort regions by tile count descending
      regions.sort((a, b) => b.length - a.length);
      const largestRegion = regions[0];

      // If largest region is too small (< 20% of map), re-roll
      if (largestRegion.length < (width * height) * 0.15) {
        continue;
      }

      // Fill in all smaller disconnected regions with solid walls
      for (let i = 1; i < regions.length; i++) {
        for (const pt of regions[i]) {
          map.setTile(pt.x, pt.y, TILES.WALL);
        }
      }

      // 4. Select playerSpawn and stairsDown at maximal separation
      const playerSpawn = largestRegion[0];
      let maxDist = 0;
      let stairsDown = largestRegion[largestRegion.length - 1];

      for (let i = 1; i < largestRegion.length; i++) {
        const pt = largestRegion[i];
        const d = Math.hypot(pt.x - playerSpawn.x, pt.y - playerSpawn.y);
        if (d > maxDist) {
          maxDist = d;
          stairsDown = pt;
        }
      }

      // 5. Partition largestRegion into virtual rooms for monster/loot distribution
      const rooms: RectRoom[] = [];
      const partitionCount = Math.min(10, Math.max(4, Math.floor(largestRegion.length / 40)));
      const clusterStep = Math.floor(largestRegion.length / partitionCount);

      for (let i = 0; i < partitionCount; i++) {
        const center = largestRegion[Math.min(largestRegion.length - 1, i * clusterStep)];
        rooms.push({
          x1: Math.max(1, center.x - 2),
          y1: Math.max(1, center.y - 2),
          x2: Math.min(width - 2, center.x + 2),
          y2: Math.min(height - 2, center.y + 2),
          centerX: center.x,
          centerY: center.y,
        });
      }

      return {
        map,
        playerSpawn,
        stairsDown,
        stairsUp: playerSpawn,
        rooms,
        monsters: [],
      };
    }

    // Fallback: If 10 iterations fail, fall back to BSP
    const bsp = new BspDungeonGenerator();
    return bsp.generate(params);
  }
}

export class DungeonGeneratorRegistry {
  private static strategies: Map<string, DungeonGeneratorStrategy> = new Map();

  public static register(strategy: DungeonGeneratorStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static get(id: string): DungeonGeneratorStrategy | undefined {
    return this.strategies.get(id);
  }

  public static getAll(): DungeonGeneratorStrategy[] {
    return Array.from(this.strategies.values());
  }

  public static getDefault(): DungeonGeneratorStrategy {
    return this.strategies.get('bsp') ?? new BspDungeonGenerator();
  }
}

// Register default strategies
DungeonGeneratorRegistry.register(new BspDungeonGenerator());
DungeonGeneratorRegistry.register(new CellularAutomataGenerator());
