import { describe, it, expect } from 'vitest';
import { DungeonGenerator } from '../dungeon-generator';
import { CorridorGraph } from '../corridors';

describe('Dungeon Corridor Braiding & Loop Weaving', () => {
  it('eliminates 100% dead-end topologies across 100 seeded dungeon generations', () => {
    let totalFloorsTested = 0;

    for (let seed = 1000; seed < 1100; seed++) {
      const generator = new DungeonGenerator({
        width: 50,
        height: 35,
        maxRooms: 10,
        minRoomSize: 5,
        maxRoomSize: 10,
        seed,
        spawnMonsters: false,
        enableBraiding: true,
      });

      const result = generator.generate();
      expect(result.rooms.length).toBeGreaterThanOrEqual(3);

      // Construct corridor graph by checking adjacency between rooms
      const graph = new CorridorGraph(result.rooms.length);

      // Check connections: two rooms are connected if a walkable floor path exists between them
      for (let i = 0; i < result.rooms.length; i++) {
        for (let j = i + 1; j < result.rooms.length; j++) {
          const r1 = result.rooms[i];
          const r2 = result.rooms[j];

          // BFS on map to verify path between r1 and r2
          const queue = [{ x: r1.centerX, y: r1.centerY }];
          const visited = new Set<string>();
          visited.add(`${r1.centerX},${r1.centerY}`);
          let reached = false;

          while (queue.length > 0) {
            const curr = queue.shift()!;
            if (curr.x === r2.centerX && curr.y === r2.centerY) {
              reached = true;
              break;
            }

            const neighbors = [
              { x: curr.x + 1, y: curr.y },
              { x: curr.x - 1, y: curr.y },
              { x: curr.x, y: curr.y + 1 },
              { x: curr.x, y: curr.y - 1 },
            ];

            for (const n of neighbors) {
              const k = `${n.x},${n.y}`;
              if (!visited.has(k) && result.map.inBounds(n.x, n.y)) {
                const t = result.map.getTile(n.x, n.y);
                if (t && (t.passable || t.type.includes('door'))) {
                  visited.add(k);
                  queue.push(n);
                }
              }
            }
          }

          if (reached) {
            graph.addEdge(i, j);
          }
        }
      }

      // Verify both result.graph and the mapped corridor graph
      expect(result.graph).toBeDefined();
      expect(result.graph!.getDeadEndRooms().length).toBe(0);
      expect(result.graph!.getCycleCount()).toBeGreaterThanOrEqual(2);

      // In a braided dungeon with >= 3 rooms, dead-end rooms (degree <= 1) are eliminated
      const deadEnds = graph.getDeadEndRooms();
      expect(deadEnds.length).toBe(0);

      // Verify that at least 2 distinct cycles exist in the topology
      const cycleCount = graph.getCycleCount();
      expect(cycleCount).toBeGreaterThanOrEqual(2);

      totalFloorsTested++;
    }

    expect(totalFloorsTested).toBe(100);
  });
});
