import { describe, it, expect, beforeEach } from 'vitest';
import { FloorManager } from '../floorManager';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import type { GameContentManifest } from '../../types/manifest';

describe('Inactive Floor Simulation & Temporal Catch-Up (floorManager.ts)', () => {
  let floorManager: FloorManager;
  let engine: GameEngine;
  let player: Player;
  let mapFloor1: GameMap;

  beforeEach(() => {
    floorManager = new FloorManager({
      respawnInterval: 50,
      maxBatchSpawns: 5,
      statScaleFactor: 0.05,
      densityLimit: 12,
    });

    mapFloor1 = new GameMap(25, 25, TILES.FLOOR);
    player = new Player({
      id: 'tester',
      name: 'Tester',
      position: { x: 5, y: 5 },
    });

    engine = new GameEngine({
      map: mapFloor1,
      player,
      floor: 1,
      floorManager,
    });
  });

  describe('Departure and Timestamp Tracking', () => {
    it('records departure and sets lastVisitedTick on map and record', () => {
      floorManager.recordDeparture(1, mapFloor1, undefined, 120);

      expect(mapFloor1.lastVisitedTick).toBe(120);
      expect(floorManager.hasFloor(1)).toBe(true);

      const record = floorManager.getFloorRecord(1);
      expect(record).toBeDefined();
      expect(record?.floorNumber).toBe(1);
      expect(record?.lastVisitedTick).toBe(120);
      expect(record?.map).toBe(mapFloor1);
    });
  });

  describe('Catch-Up Simulation Mechanics', () => {
    it('returns zero spawns and scaling if elapsed ticks are less than respawn interval', () => {
      floorManager.recordDeparture(1, mapFloor1, undefined, 100);

      // Revisit 25 ticks later (threshold is 50)
      const result = floorManager.simulateCatchUp(1, 125, engine);

      expect(result.ticksElapsed).toBe(25);
      expect(result.spawnedCount).toBe(0);
      expect(result.scaledMonsters).toBe(0);
      expect(mapFloor1.lastVisitedTick).toBe(125);
    });

    it('town floor (0) is immune to catch-up spawns and monster scaling', () => {
      const townMap = new GameMap(20, 20, TILES.FLOOR);
      floorManager.recordDeparture(0, townMap, undefined, 100);

      // Revisit 500 ticks later
      const result = floorManager.simulateCatchUp(0, 600, engine);

      expect(result.ticksElapsed).toBe(500);
      expect(result.spawnedCount).toBe(0);
      expect(result.scaledMonsters).toBe(0);
    });

    it('spawns catch-up monsters bounded by maxBatchSpawns when elapsed time is large', () => {
      floorManager.recordDeparture(1, mapFloor1, undefined, 100);

      // 400 ticks elapsed = 8 potential intervals, but maxBatchSpawns is 5
      const result = floorManager.simulateCatchUp(1, 500, engine);

      expect(result.ticksElapsed).toBe(400);
      expect(result.spawnedCount).toBe(5); // Capped at maxBatchSpawns = 5

      // Verified monsters were added to map
      const monsters = mapFloor1.getAllEntities().filter((e) => e instanceof Monster);
      expect(monsters.length).toBe(5);

      // Verified spawned monsters are located at least 8 tiles away from player at (5, 5)
      for (const m of monsters) {
        const dist = Math.hypot(m.x - player.x, m.y - player.y);
        expect(dist).toBeGreaterThanOrEqual(8);
      }
    });

    it('scales living monsters on inactive floor up to capped multiplier', () => {
      const existingOrc = new Monster({
        id: 'veteran-orc',
        name: 'Veteran Orc',
        position: { x: 12, y: 12 },
        stats: { hp: 40, maxHp: 40, attack: 10, defense: 4 },
      });
      mapFloor1.addEntity(existingOrc);

      floorManager.recordDeparture(1, mapFloor1, undefined, 100);

      // 100 ticks elapsed = 2 batches = 1.0 + 2 * 0.05 = 1.10x multiplier
      const result = floorManager.simulateCatchUp(1, 200, engine);

      expect(result.scaledMonsters).toBe(1);
      expect(existingOrc.maxHp).toBe(Math.round(40 * 1.1));
      expect(existingOrc.attack).toBe(Math.round(10 * 1.1));
    });

    it('respects densityLimit and does not over-spawn beyond floor capacity', () => {
      // Pre-fill map with 10 living monsters (densityLimit is 12)
      for (let i = 0; i < 10; i++) {
        mapFloor1.addEntity(
          new Monster({
            id: `filler-${i}`,
            name: 'Goblin',
            position: { x: 10 + (i % 3), y: 10 + Math.floor(i / 3) },
            stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
          })
        );
      }

      floorManager.recordDeparture(1, mapFloor1, undefined, 100);

      // 500 ticks elapsed would normally spawn 5, but only 2 slots remain before 12
      const result = floorManager.simulateCatchUp(1, 600, engine);

      expect(result.spawnedCount).toBe(2);
      const totalMonsters = mapFloor1.getAllEntities().filter((e) => e instanceof Monster);
      expect(totalMonsters.length).toBe(12);
    });
  });

  describe('Catch-up spawns respect floor depth', () => {
    it('never draws a boss or a deeper-floor monster onto a shallow floor', () => {
      const def = (id: string, minFloor: number): MonsterDefinition => ({
        id,
        name: id,
        minFloor,
        stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
        speed: 100,
        aiType: 'melee',
        fleeHealthPercent: 0,
        xpValue: 5,
        lootTable: [],
      });
      const catalog = [def('rat', 1), def('deep_troll', 18), def('boss_giant', 25)];
      const depthEngine = new GameEngine({
        map: mapFloor1,
        player,
        floor: 2,
        floorManager,
        manifest: { id: 'depth-test', name: 'depth-test', monsters: catalog } as GameContentManifest,
      });

      for (let visit = 0; visit < 10; visit++) {
        floorManager.recordDeparture(2, mapFloor1, undefined, visit * 1000);
        floorManager.simulateCatchUp(2, visit * 1000 + 400, depthEngine);
        for (const e of mapFloor1.getAllEntities()) if (e instanceof Monster) mapFloor1.removeEntity(e);
      }

      const spawnedIds = new Set<string>();
      floorManager.recordDeparture(2, mapFloor1, undefined, 20000);
      floorManager.simulateCatchUp(2, 20400, depthEngine);
      for (const e of mapFloor1.getAllEntities()) if (e instanceof Monster) spawnedIds.add(e.definitionId);
      expect(spawnedIds.size).toBeGreaterThan(0);
      expect([...spawnedIds]).toEqual(['rat']);
    });
  });

  describe('Engine Integration & Floor Transition Loop', () => {
    it('records departure and simulates catch-up seamlessly during changeFloor', () => {
      const mapFloor2 = new GameMap(25, 25, TILES.FLOOR);
      engine.storedFloors.set(2, mapFloor2);

      // Start on floor 1 at turn 0
      expect(engine.currentFloor).toBe(1);

      // Transition to floor 2
      engine.changeFloor(2);
      expect(engine.currentFloor).toBe(2);
      expect(floorManager.hasFloor(1)).toBe(true);
      expect(floorManager.getFloorRecord(1)?.lastVisitedTick).toBe(0);

      // Simulate player exploring floor 2 for 200 turns
      engine.turnCount = 200;

      // Return to floor 1
      engine.changeFloor(1);
      expect(engine.currentFloor).toBe(1);

      // Floor 1 should have experienced catch-up simulation (200 ticks elapsed / 50 = 4 batches)
      expect(floorManager.getFloorRecord(1)?.lastVisitedTick).toBe(200);
      const floor1Monsters = mapFloor1.getAllEntities().filter((e) => e instanceof Monster);
      expect(floor1Monsters.length).toBe(4);
    });
  });
});
