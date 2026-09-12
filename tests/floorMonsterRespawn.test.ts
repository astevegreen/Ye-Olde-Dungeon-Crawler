import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { Monster } from '../src/engine/entities/monster';
import { FloorManager } from '../src/engine/world/floorManager';
import { WaitAction } from '../src/engine/actions/wait';
import { DeathResolver } from '../src/engine/combat/deathResolver';
import { COTW_MANIFEST } from '../src/content/cotw';

describe('Time-Based Floor Monster Respawning & Turn Tracking', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let floorManager: FloorManager;

  beforeEach(() => {
    map = new GameMap(30, 30, TILES.FLOOR);
    player = new Player({
      id: 'player_1',
      name: 'Hero',
      position: { x: 5, y: 5 },
    });

    floorManager = new FloorManager({
      respawnInterval: 50,
      clearedRespawnInterval: 60,
      maxBatchSpawns: 3,
      densityLimit: 6,
    });

    engine = new GameEngine({
      map,
      player,
      floor: 1,
      floorManager,
      manifest: COTW_MANIFEST,
    });
  });

  it('increments floorTurnCount when player takes turns on dungeon floor (floor >= 1)', () => {
    expect(engine.map.floorTurnCount).toBe(0);

    const result = engine.handlePlayerAction(new WaitAction(player));
    expect(result.success).toBe(true);
    expect(engine.turnCount).toBe(1);
    expect(engine.map.floorTurnCount).toBe(1);

    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.turnCount).toBe(2);
    expect(engine.map.floorTurnCount).toBe(2);
  });

  it('marks floor as cleared when all living monsters are slain', () => {
    const goblin = new Monster({
      id: 'goblin_1',
      name: 'Goblin',
      position: { x: 10, y: 10 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 },
    });
    engine.addEntity(goblin);

    expect(engine.map.isCleared).toBe(false);

    // Slay the goblin
    DeathResolver.resolveDeath(engine, player, goblin);

    expect(engine.map.isCleared).toBe(true);
    expect(engine.map.lastRespawnTurn).toBe(engine.map.floorTurnCount);
  });

  it('does not respawn monsters before clearedRespawnInterval turns have elapsed', () => {
    engine.map.isCleared = true;
    engine.map.lastRespawnTurn = 0;
    engine.map.floorTurnCount = 59; // Below 60 interval

    const spawned = floorManager.checkClearedFloorRespawn(engine);
    expect(spawned.length).toBe(0);
  });

  it('respawns sleeping monsters outside FOV when clearedRespawnInterval has elapsed', () => {
    engine.map.isCleared = true;
    engine.map.lastRespawnTurn = 0;
    engine.map.floorTurnCount = 60; // Meets 60 interval

    const spawned = floorManager.checkClearedFloorRespawn(engine);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.length).toBeLessThanOrEqual(3); // Capped by maxBatchSpawns = 3

    for (const m of spawned) {
      // Must be dormant sleeping
      expect(m.aiState).toBe('sleeping');
      // Must be at least 8 tiles away from player at (5, 5)
      const dist = Math.hypot(m.x - player.x, m.y - player.y);
      expect(dist).toBeGreaterThanOrEqual(8);
      // Must not be visible in player FOV
      expect(engine.fov.isVisible(m.x, m.y)).toBe(false);
    }

    // Floor clearance resets to false because monsters now populate the floor
    expect(engine.map.isCleared).toBe(false);
    expect(engine.map.lastRespawnTurn).toBe(60);
  });

  it('respects densityLimit and stops respawning when floor capacity is reached', () => {
    engine.map.isCleared = true;
    engine.map.lastRespawnTurn = 0;
    engine.map.floorTurnCount = 60;

    // Pre-populate with 6 monsters (densityLimit is 6)
    for (let i = 0; i < 6; i++) {
      engine.addEntity(
        new Monster({
          id: `existing_${i}`,
          name: 'Orc',
          position: { x: 20 + (i % 2), y: 20 + Math.floor(i / 2) },
          stats: { hp: 15, maxHp: 15, attack: 4, defense: 1 },
        })
      );
    }

    const spawned = floorManager.checkClearedFloorRespawn(engine);
    expect(spawned.length).toBe(0);
  });

  it('wakes sleeping respawned monster when revealed by player FOV', () => {
    const sleeper = new Monster({
      id: 'sleeper_1',
      name: 'Cave Stalker',
      position: { x: 6, y: 5 }, // 1 tile to the right of player at (5, 5)
      stats: { hp: 15, maxHp: 15, attack: 3, defense: 1 },
      aiState: 'sleeping',
    });
    engine.addEntity(sleeper);

    expect(sleeper.aiState).toBe('sleeping');

    // Update FOV with player adjacent
    engine.updateFov();

    expect(sleeper.aiState).toBe('hunting');
  });

  it('town floor (floor 0) is immune to cleared floor respawning', () => {
    engine.currentFloor = 0;
    engine.map.isCleared = true;
    engine.map.lastRespawnTurn = 0;
    engine.map.floorTurnCount = 100;

    const spawned = floorManager.checkClearedFloorRespawn(engine);
    expect(spawned.length).toBe(0);
  });
});
