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

  it("draws a floor's listed wanderers only once the floor is deep enough for them", () => {
    // cotw lists wolf (minFloor 7) for floor 5, and root_wraith (27) and bark_husk_miner (30)
    // for floor 26. Every roll on those floors must give a monster of that depth.
    const pick = (floor: number, roll: number) => {
      engine.currentFloor = floor;
      const select = (spawner as unknown as { selectMonsterDefinition: (e: GameEngine, r: () => number) => { id: string; minFloor?: number } | null })
        .selectMonsterDefinition.bind(spawner);
      return select(engine, () => roll);
    };
    for (const floor of [5, 26]) {
      const drawn = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const def = pick(floor, i / 100)!;
        expect(def.minFloor ?? 1, `${def.id} on floor ${floor}`).toBeLessThanOrEqual(floor);
        drawn.add(def.id);
      }
      expect(drawn.size).toBeGreaterThan(0);
    }
  });

  it('R-ai-12 · a band holds from its floor down to the next one (owner Q8: bands)', () => {
    const pick = (floor: number, roll: number) => {
      engine.currentFloor = floor;
      const select = (spawner as unknown as { selectMonsterDefinition: (e: GameEngine, r: () => number) => { id: string } | null })
        .selectMonsterDefinition.bind(spawner);
      return select(engine, () => roll)!.id;
    };
    const drawn = (floor: number) => new Set(Array.from({ length: 20 }, (_, i) => pick(floor, i / 20)));
    // Floors 2-4 draw from band 1 (rats and kobolds), not the whole catalog.
    expect([...drawn(3)].sort()).toEqual(['giant_rat', 'kobold']);
    // Floor 8 is in band 5, and deep enough for its wolves.
    expect(drawn(8)).toEqual(new Set(['kobold', 'skeleton', 'wolf']));
    // Floor 6 is in band 5 too, before the wolves unlock.
    expect(drawn(6)).toEqual(new Set(['kobold', 'skeleton']));
  });

  it('R-ai-12 · no wanderer comes once the floor holds its band’s maxMonsters', () => {
    engine.currentFloor = 1; // band 1: maxMonsters 7
    engine.turnCount = 50;
    let n = 0;
    const rng = () => ((n++ * 0.6180339) % 1); // a fresh roll each draw, so ids differ
    for (let i = 0; i < 7; i++) {
      expect(spawner.checkAndSpawn(engine, rng), `wanderer ${i + 1}`).not.toBeNull();
    }
    expect(engine.map.getAllEntities().filter((e) => e.type === 'monster')).toHaveLength(7);
    expect(spawner.checkAndSpawn(engine, rng)).toBeNull();
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
