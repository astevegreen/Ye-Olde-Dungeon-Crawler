import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { RectRoom } from './dungeon-generator';
import type { PRNG } from './prng';

export interface RoomEdge {
  roomA: number;
  roomB: number;
}

export class CorridorGraph {
  public adj: Map<number, Set<number>> = new Map();
  public edges: RoomEdge[] = [];

  constructor(roomCount: number) {
    for (let i = 0; i < roomCount; i++) {
      this.adj.set(i, new Set());
    }
  }

  public addEdge(u: number, v: number): boolean {
    if (u === v) return false;
    const neighborsU = this.adj.get(u);
    const neighborsV = this.adj.get(v);
    if (!neighborsU || !neighborsV) return false;
    if (neighborsU.has(v)) return false;

    neighborsU.add(v);
    neighborsV.add(u);
    this.edges.push({ roomA: Math.min(u, v), roomB: Math.max(u, v) });
    return true;
  }

  public hasEdge(u: number, v: number): boolean {
    return this.adj.get(u)?.has(v) ?? false;
  }

  public getDegree(u: number): number {
    return this.adj.get(u)?.size ?? 0;
  }

  public getDeadEndRooms(): number[] {
    const deadEnds: number[] = [];
    for (const [roomIndex, neighbors] of this.adj.entries()) {
      if (neighbors.size <= 1) {
        deadEnds.push(roomIndex);
      }
    }
    return deadEnds;
  }

  /**
   * Calculates the cycle rank (number of independent fundamental cycles) in the graph:
   * Cycle Rank = E - V + C (where C is connected components).
   */
  public getCycleCount(): number {
    const V = this.adj.size;
    const E = this.edges.length;
    if (V === 0) return 0;

    let components = 0;
    const visited = new Set<number>();

    for (const node of this.adj.keys()) {
      if (!visited.has(node)) {
        components++;
        const queue = [node];
        visited.add(node);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          for (const neighbor of this.adj.get(curr) ?? []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
    }

    return Math.max(0, E - V + components);
  }
}

export class BraidWeaver {
  /**
   * Carves an L-shaped corridor connecting two points.
   */
  public static carveCorridor(
    map: GameMap,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    prng: PRNG
  ): void {
    if (prng.next() < 0.5) {
      this.carveHTunnel(map, x1, x2, y1);
      this.carveVTunnel(map, y1, y2, x2);
    } else {
      this.carveVTunnel(map, y1, y2, x1);
      this.carveHTunnel(map, x1, x2, y2);
    }
  }

  public static carveHTunnel(map: GameMap, x1: number, x2: number, y: number): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      if (map.inBounds(x, y)) {
        const current = map.getTile(x, y);
        // Do not overwrite stairs, doors, or fixtures
        if (!current || current.type === 'wall') {
          map.setTile(x, y, TILES.FLOOR);
        }
      }
    }
  }

  public static carveVTunnel(map: GameMap, y1: number, y2: number, x: number): void {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      if (map.inBounds(x, y)) {
        const current = map.getTile(x, y);
        if (!current || current.type === 'wall') {
          map.setTile(x, y, TILES.FLOOR);
        }
      }
    }
  }

  /**
   * Weaves loops into the dungeon corridor graph:
   * 1. Connects dead ends (degree <= 1) to neighboring rooms.
   * 2. With 25-35% probability, connects adjacent disconnected pairs.
   * 3. Guarantees at least 2 distinct cycles if the room count >= 3.
   */
  public static braidRooms(
    map: GameMap,
    rooms: RectRoom[],
    graph: CorridorGraph,
    prng: PRNG,
    braidChance = 0.30
  ): void {
    if (rooms.length < 3) return;

    // Helper to calculate Euclidean distance squared between room centers
    const roomDistSq = (i: number, j: number): number => {
      const dx = rooms[i].centerX - rooms[j].centerX;
      const dy = rooms[i].centerY - rooms[j].centerY;
      return dx * dx + dy * dy;
    };

    // 1. First Pass: Eliminate dead ends (rooms with degree <= 1)
    const deadEnds = graph.getDeadEndRooms();
    for (const deadEnd of deadEnds) {
      if (graph.getDegree(deadEnd) > 1) continue;

      // Find candidate rooms sorted by proximity that aren't already connected
      const candidates: number[] = [];
      for (let j = 0; j < rooms.length; j++) {
        if (j !== deadEnd && !graph.hasEdge(deadEnd, j)) {
          candidates.push(j);
        }
      }
      candidates.sort((a, b) => roomDistSq(deadEnd, a) - roomDistSq(deadEnd, b));

      if (candidates.length > 0) {
        const target = candidates[0];
        this.carveCorridor(
          map,
          rooms[deadEnd].centerX,
          rooms[deadEnd].centerY,
          rooms[target].centerX,
          rooms[target].centerY,
          prng
        );
        graph.addEdge(deadEnd, target);
      }
    }

    // 2. Second Pass: Probabilistic loop weaving for nearby disconnected rooms (25–35%)
    const allPairs: Array<{ u: number; v: number; dist: number }> = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (!graph.hasEdge(i, j)) {
          allPairs.push({ u: i, v: j, dist: roomDistSq(i, j) });
        }
      }
    }
    allPairs.sort((a, b) => a.dist - b.dist);

    for (const pair of allPairs) {
      if (prng.next() < braidChance) {
        this.carveCorridor(
          map,
          rooms[pair.u].centerX,
          rooms[pair.u].centerY,
          rooms[pair.v].centerX,
          rooms[pair.v].centerY,
          prng
        );
        graph.addEdge(pair.u, pair.v);
      }
    }

    // 3. Third Pass: Guarantee at least 2 distinct cycles
    let cycles = graph.getCycleCount();
    for (const pair of allPairs) {
      if (cycles >= 2) break;
      if (!graph.hasEdge(pair.u, pair.v)) {
        this.carveCorridor(
          map,
          rooms[pair.u].centerX,
          rooms[pair.u].centerY,
          rooms[pair.v].centerX,
          rooms[pair.v].centerY,
          prng
        );
        graph.addEdge(pair.u, pair.v);
        cycles = graph.getCycleCount();
      }
    }

    // Final clean-up: Any remaining dead ends (if newly created or isolated) are connected
    const remainingDeadEnds = graph.getDeadEndRooms();
    for (const d of remainingDeadEnds) {
      const candidates: number[] = [];
      for (let j = 0; j < rooms.length; j++) {
        if (j !== d && !graph.hasEdge(d, j)) {
          candidates.push(j);
        }
      }
      candidates.sort((a, b) => roomDistSq(d, a) - roomDistSq(d, b));
      if (candidates.length > 0) {
        const target = candidates[0];
        this.carveCorridor(
          map,
          rooms[d].centerX,
          rooms[d].centerY,
          rooms[target].centerX,
          rooms[target].centerY,
          prng
        );
        graph.addEdge(d, target);
      }
    }
  }
}
