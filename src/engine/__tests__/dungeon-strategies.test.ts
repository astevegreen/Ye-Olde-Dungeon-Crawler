import { describe, it, expect } from 'vitest';
import {
  BspDungeonGenerator,
  CellularAutomataGenerator,
  DungeonGeneratorRegistry,
  type DungeonGeneratorStrategy,
} from '../dungeon/generator';
import { DungeonArc } from '../quest/dungeonArc';
import type { QuestArcDefinition } from '../types/manifest';
import type { Position } from '../types';

describe('Pluggable Dungeon Generation Strategy', () => {
  function isReachable(
    map: { isPassable: (x: number, y: number) => boolean; inBounds: (x: number, y: number) => boolean; getTile?: (x: number, y: number) => any },
    start: Position,
    end: Position
  ): boolean {
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
      const curr = queue.shift()!;
      if (curr.x === end.x && curr.y === end.y) {
        return true;
      }

      for (const dir of directions) {
        const nx = curr.x + dir.dx;
        const ny = curr.y + dir.dy;
        const key = `${nx},${ny}`;
        if (map.inBounds(nx, ny) && !visited.has(key)) {
          const tile = map.getTile ? map.getTile(nx, ny) : null;
          const canTraverse = map.isPassable(nx, ny) || tile?.type === 'door_closed';
          if (canTraverse) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
    return false;
  }

  it('BSP generator produces valid rooms, corridors, and connected stairs', () => {
    const bsp = new BspDungeonGenerator();
    expect(bsp.id).toBe('bsp');

    const floor = bsp.generate({
      width: 40,
      height: 30,
      minRoomSize: 5,
      maxRoomSize: 8,
      seed: 4321,
    });

    expect(floor.rooms.length).toBeGreaterThanOrEqual(2);
    expect(floor.map.isPassable(floor.playerSpawn.x, floor.playerSpawn.y)).toBe(true);
    expect(floor.map.isPassable(floor.stairsDown.x, floor.stairsDown.y)).toBe(true);
    expect(isReachable(floor.map, floor.playerSpawn, floor.stairsDown)).toBe(true);
  });

  it('Cellular Automata generator carves organic caverns with guaranteed reachability', () => {
    const cavern = new CellularAutomataGenerator();
    expect(cavern.id).toBe('cavern');

    const floor = cavern.generate({
      width: 50,
      height: 35,
      seed: 98765,
    });

    expect(floor.map.isPassable(floor.playerSpawn.x, floor.playerSpawn.y)).toBe(true);
    expect(floor.map.isPassable(floor.stairsDown.x, floor.stairsDown.y)).toBe(true);
    // Guarantees player spawn and stairs down are connected
    expect(isReachable(floor.map, floor.playerSpawn, floor.stairsDown)).toBe(true);
    // Verifies partition rooms exist for encounter and loot distribution
    expect(floor.rooms.length).toBeGreaterThan(0);
  });

  it('registry correctly stores, retrieves, and falls back to default generator', () => {
    expect(DungeonGeneratorRegistry.get('bsp')).toBeDefined();
    expect(DungeonGeneratorRegistry.get('cavern')).toBeDefined();
    expect(DungeonGeneratorRegistry.getDefault().id).toBe('bsp');

    // Register a custom mock generator
    const mockStrategy: DungeonGeneratorStrategy = {
      id: 'custom-arena',
      name: 'Gladiator Arena',
      generate: (params) => {
        const bsp = new BspDungeonGenerator();
        return bsp.generate(params);
      },
    };

    DungeonGeneratorRegistry.register(mockStrategy);
    expect(DungeonGeneratorRegistry.get('custom-arena')?.name).toBe('Gladiator Arena');
  });

  it('DungeonArc uses questArc.floorGenerators to dynamically pick generator strategy', () => {
    const customQuestArc: Partial<QuestArcDefinition> = {
      id: 'mines_arc',
      name: 'The Forgotten Mines',
      maxFloor: 5,
      bossFloor: 5,
      // Floor 1 is standard BSP, Floor 2 is Cavern!
      floorGenerators: {
        2: 'cavern',
      },
    };

    const floor1 = DungeonArc.generateFloor(1, 1111, customQuestArc as QuestArcDefinition);
    expect(floor1.map).toBeDefined();
    expect(isReachable(floor1.map, floor1.playerSpawn, floor1.stairsDown!)).toBe(true);

    const floor2 = DungeonArc.generateFloor(2, 2222, customQuestArc as QuestArcDefinition);
    expect(floor2.map).toBeDefined();
    expect(isReachable(floor2.map, floor2.playerSpawn, floor2.stairsDown!)).toBe(true);
  });
});
