import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { WanderingMonsterSpawner } from '../wandering-spawner';
import { cotwManifest } from '../../../content/cotw';
import { WaitAction } from '../../actions/wait';

describe('Dynamic Wandering Monster Spawner', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let spawner: WanderingMonsterSpawner;

  beforeEach(() => {
    // Large 30x30 room
    map = GameMap.createBoxRoom(30, 30);
    player = new Player({
      id: 'hero',
      name: 'Ragnar',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    engine = new GameEngine({
      map,
      player,
      floor: 1,
      manifest: cotwManifest,
    });
    spawner = new WanderingMonsterSpawner({
      intervalTurns: 50,
      spawnChance: 1.0, // 100% for deterministic testing
      minDistanceToPlayer: 8,
    });
  });

  it('does not spawn wandering monsters on Town floor (floor 0)', () => {
    engine.currentFloor = 0;
    engine.turnCount = 50;

    const spawned = spawner.checkAndSpawn(engine, () => 0.1);
    expect(spawned).toBeNull();
  });

  it('does not spawn when turn count is not a multiple of intervalTurns', () => {
    engine.currentFloor = 1;
    engine.turnCount = 49;

    const spawned = spawner.checkAndSpawn(engine, () => 0.1);
    expect(spawned).toBeNull();
  });

  it('does not spawn when probability roll fails', () => {
    const pickySpawner = new WanderingMonsterSpawner({
      intervalTurns: 50,
      spawnChance: 0.15,
      minDistanceToPlayer: 8,
    });
    engine.currentFloor = 1;
    engine.turnCount = 50;

    // Roll 0.5 > 0.15 spawn chance
    const spawned = pickySpawner.checkAndSpawn(engine, () => 0.5);
    expect(spawned).toBeNull();
  });

  it('spawns a monster outside player FOV and >= minDistance away on eligible turn', () => {
    engine.currentFloor = 1;
    engine.turnCount = 50;

    // Fixed mock RNG returning 0.05
    const spawned = spawner.checkAndSpawn(engine, () => 0.05);

    expect(spawned).not.toBeNull();
    if (!spawned) return;

    // Must be in map and scheduler
    expect(engine.map.getEntityById(spawned.id)).toBe(spawned);
    expect(engine.scheduler.getEntities().some((e) => e.id === spawned.id)).toBe(true);

    // Distance check
    const dist = Math.hypot(spawned.x - player.x, spawned.y - player.y);
    expect(dist).toBeGreaterThanOrEqual(8);

    // Must be outside current player FOV
    expect(engine.fov.isVisible(spawned.x, spawned.y)).toBe(false);

    // Message logged
    expect(engine.messages.some((m) => m.includes('skittering footsteps'))).toBe(true);
  });

  it('spawns wandering monster seamlessly via GameEngine.handlePlayerAction on turn 50', () => {
    // Configure engine spawner for 100% spawn chance
    engine.wanderingSpawner.intervalTurns = 50;
    engine.wanderingSpawner.spawnChance = 1.0;
    engine.wanderingSpawner.minDistanceToPlayer = 6;

    // Initial entity count is 1 (player)
    expect(engine.map.getAllEntities()).toHaveLength(1);

    // Fast forward to turn 49
    engine.turnCount = 49;

    // Action 50: Wait
    engine.handlePlayerAction(new WaitAction(player));

    expect(engine.turnCount).toBe(50);
    // Spawner triggered and added new wandering monster
    expect(engine.map.getAllEntities().length).toBeGreaterThan(1);
  });
});
