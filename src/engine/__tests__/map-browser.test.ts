import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MapOverlay } from '../../rendering/map-overlay';

describe('Explored Dungeon Map & Multi-Floor Historical Browser', () => {
  function setupMultiFloorEngine() {
    const floor1Map = new GameMap(20, 20, TILES.FLOOR);
    // Add stairs down at (10, 10)
    floor1Map.setTile(10, 10, TILES.STAIRS_DOWN);

    const floor2Map = new GameMap(20, 20, TILES.FLOOR);
    floor2Map.setTile(10, 10, TILES.STAIRS_UP);

    const player = new Player({
      id: 'p1',
      name: 'Ragnar',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });

    const storedFloors = new Map<number, GameMap>();
    storedFloors.set(1, floor1Map);
    storedFloors.set(2, floor2Map);

    const engine = new GameEngine({
      map: floor1Map,
      player,
      floor: 1,
      storedFloors,
    });

    return { engine, floor1Map, floor2Map, player };
  }

  it('toggles and manages map overlay open/closed state', () => {
    const { engine } = setupMultiFloorEngine();
    const mapOverlay = new MapOverlay();

    expect(mapOverlay.isOpen).toBe(false);

    mapOverlay.open(engine);
    expect(mapOverlay.isOpen).toBe(true);
    expect(mapOverlay.viewedFloor).toBe(1);

    mapOverlay.close();
    expect(mapOverlay.isOpen).toBe(false);

    mapOverlay.toggle(engine);
    expect(mapOverlay.isOpen).toBe(true);
  });

  it('preserves explored fog-of-war across floor transitions', () => {
    const { engine } = setupMultiFloorEngine();

    // On floor 1, player updates FOV around (5, 5)
    engine.updateFov();
    expect(engine.isTileExplored(1, 5, 5)).toBe(true);
    expect(engine.isTileExplored(1, 19, 19)).toBe(false);

    // Transition to floor 2
    engine.changeFloor(2);
    expect(engine.currentFloor).toBe(2);

    // Update FOV on floor 2 at player spawn (10, 10)
    engine.updateFov();
    expect(engine.isTileExplored(2, 10, 10)).toBe(true);

    // Check that floor 1 explored tiles are still preserved in storedFov!
    expect(engine.isTileExplored(1, 5, 5)).toBe(true);
    expect(engine.isTileExplored(1, 19, 19)).toBe(false);

    // Visited floors should report [1, 2]
    expect(engine.getVisitedFloors()).toEqual([1, 2]);
  });

  it('allows multi-floor navigation without advancing energy ticks or monster AI', () => {
    const { engine, player } = setupMultiFloorEngine();
    engine.changeFloor(2);

    const initialTicks = engine.ticks;
    const initialTurnCount = engine.turnCount;
    const initialEnergy = player.energy;

    const mapOverlay = new MapOverlay();
    mapOverlay.open(engine);
    expect(mapOverlay.viewedFloor).toBe(2);

    // Navigate to previous floor (Floor 1)
    mapOverlay.prevFloor(engine);
    expect(mapOverlay.viewedFloor).toBe(1);

    // Navigate back to next floor (Floor 2)
    mapOverlay.nextFloor(engine);
    expect(mapOverlay.viewedFloor).toBe(2);

    // Handle keydown for floor cycling (< and >)
    mapOverlay.handleKeyDown({ code: 'Comma', key: '<' } as KeyboardEvent, engine);
    expect(mapOverlay.viewedFloor).toBe(1);

    mapOverlay.handleKeyDown({ code: 'Period', key: '>' } as KeyboardEvent, engine);
    expect(mapOverlay.viewedFloor).toBe(2);

    // Map navigation must consume 0 turns, 0 energy, and 0 scheduler ticks
    expect(engine.ticks).toBe(initialTicks);
    expect(engine.turnCount).toBe(initialTurnCount);
    expect(player.energy).toBe(initialEnergy);

    // Close via KeyM
    mapOverlay.handleKeyDown({ code: 'KeyM', key: 'm' } as KeyboardEvent, engine);
    expect(mapOverlay.isOpen).toBe(false);
  });

  it('enforces strict fog-of-war so unexplored tiles never leak geometry or monsters', () => {
    const { engine, floor1Map } = setupMultiFloorEngine();

    // Place a hidden monster deep in the dungeon
    const lurkingBeast = new Monster({
      id: 'beast-1',
      name: 'Shadow Stalker',
      position: { x: 18, y: 18 },
      stats: { hp: 100, maxHp: 100, attack: 20, defense: 10 },
    });
    floor1Map.addEntity(lurkingBeast);

    engine.updateFov();

    // Tile (18, 18) is unexplored
    expect(engine.isTileExplored(1, 18, 18)).toBe(false);
    expect(engine.fov.isExplored(18, 18)).toBe(false);

    // Verify helper returns false for invalid/unvisited coordinates
    expect(engine.isTileExplored(99, 0, 0)).toBe(false);
  });
});
