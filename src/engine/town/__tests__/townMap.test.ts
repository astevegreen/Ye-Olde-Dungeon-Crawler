import { describe, it, expect } from 'vitest';
import { TownMapGenerator } from '../townMap';
import { TILES } from '../../grid/tile';
import type { TownLayoutDefinition } from '../../types/manifest';

describe('TownMapGenerator', () => {
  it('generates a town map with default dimensions and fallback layout', () => {
    const generator = new TownMapGenerator(20, 15);
    const result = generator.generate();

    expect(result.map.width).toBe(20);
    expect(result.map.height).toBe(15);
    expect(result.playerSpawn).toEqual({ x: 5, y: 5 });
    expect(result.stairsDown).toEqual({ x: 10, y: 7 }); // Math.floor(20/2), Math.floor(15/2)
    expect(result.npcs).toHaveLength(0);
    expect(result.merchants.size).toBe(0);
    
    // Check that stairs down are placed
    expect(result.map.getTile(10, 7)).toBe(TILES.STAIRS_DOWN);
  });

  it('carves out a courtyard leaving border walls', () => {
    const generator = new TownMapGenerator(10, 10);
    const result = generator.generate();

    // Check borders are walls
    expect(result.map.getTile(0, 0)).toBe(TILES.WALL);
    expect(result.map.getTile(9, 9)).toBe(TILES.WALL);
    
    // Check inside is mostly floor (except the stairs down at 5,5)
    expect(result.map.getTile(1, 1)).toBe(TILES.FLOOR);
    expect(result.map.getTile(2, 2)).toBe(TILES.FLOOR);
  });

  describe('with layout provided', () => {
    const mockLayout: TownLayoutDefinition = {
      name: 'Test Town',
      width: 30,
      height: 20,
      playerSpawn: { x: 2, y: 2 },
      stairsDown: { x: 28, y: 18 },
      buildings: [
        {
          name: 'Test Building',
          bounds: { x1: 5, y1: 5, x2: 10, y2: 10 },
          door: { x: 7, y: 10, isOpen: false }
        }
      ],
      npcs: [
        {
          id: 'npc1',
          name: 'Bob',
          role: 'merchant',
          position: { x: 7, y: 7 },
          greeting: 'Hello!',
          merchantConfig: {
            id: 'shop1',
            name: 'Bob Shop',
            greeting: 'Buy something!',
            initialInventory: []
          }
        },
        {
          id: 'npc2',
          name: 'Alice',
          role: 'villager',
          position: { x: 15, y: 15 },
          greeting: 'Hi'
        }
      ]
    };

    it('uses layout dimensions when provided', () => {
      const generator = new TownMapGenerator(50, 50, mockLayout);
      expect(generator.width).toBe(30);
      expect(generator.height).toBe(20);
    });

    it('generates the map with buildings and correct tiles', () => {
      const generator = new TownMapGenerator(30, 20, mockLayout);
      const result = generator.generate();

      // Check building walls
      expect(result.map.getTile(5, 5)).toBe(TILES.WALL);
      expect(result.map.getTile(10, 10)).toBe(TILES.WALL);
      
      // Check building door
      expect(result.map.getTile(7, 10)).toBe(TILES.DOOR_CLOSED);

      // Check player spawn and stairs
      expect(result.playerSpawn).toEqual({ x: 2, y: 2 });
      expect(result.stairsDown).toEqual({ x: 28, y: 18 });
      expect(result.map.getTile(28, 18)).toBe(TILES.STAIRS_DOWN);
    });

    it('generates npcs and merchants', () => {
      const generator = new TownMapGenerator(30, 20, mockLayout);
      const result = generator.generate();

      expect(result.npcs).toHaveLength(2);
      expect(result.npcs[0].name).toBe('Bob');
      expect(result.npcs[1].name).toBe('Alice');

      // Check merchant is created
      expect(result.merchants.size).toBe(1);
      expect(result.merchants.has('shop1')).toBe(true);
      
      // Check NPCs are added to the map entities
      const entityAtBob = result.map.getEntityAt(7, 7);
      expect(entityAtBob).not.toBeNull();
      expect(entityAtBob?.id).toBe('npc1');
    });

    it('builds buildings with open doors if configured', () => {
      const layoutWithOpenDoor: TownLayoutDefinition = {
        ...mockLayout,
        buildings: [
          {
            name: 'Test Building',
            bounds: { x1: 5, y1: 5, x2: 10, y2: 10 },
            door: { x: 7, y: 10, isOpen: true }
          }
        ],
        npcs: []
      };

      const generator = new TownMapGenerator(30, 20, layoutWithOpenDoor);
      const result = generator.generate();

      expect(result.map.getTile(7, 10)).toBe(TILES.DOOR_OPEN);
    });
  });
});
