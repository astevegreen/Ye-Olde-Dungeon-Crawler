import type { GameMap } from '../grid/map';
import type { FovManager } from '../fov/fov-manager';
import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import type { Position } from '../types';
import {
  selectDungeonMonsterDefinition,
  createScaledMonster,
  isEligibleDungeonMonster,
} from '../dungeon/spawner';
import { SpawnSiteFilter } from '../dungeon/spawnSites';

export interface DungeonFloorRecord {
  floorNumber: number;
  map: GameMap;
  fov?: FovManager;
  lastVisitedTick: number;
}

export interface FloorManagerConfig {
  respawnInterval?: number; // default: 50 ticks
  maxBatchSpawns?: number; // default: 5 monsters
  statScaleFactor?: number; // default: 0.05 (5% per interval, max 1.5x)
  densityLimit?: number; // default: 12 max monsters per floor
  clearedRespawnInterval?: number; // default: 60 turns
}

export interface CatchUpSimulationResult {
  ticksElapsed: number;
  spawnedCount: number;
  scaledMonsters: number;
}

/**
 * FloorManager coordinates floor transitions, stores floor records,
 * and runs bounded O(K) temporal catch-up simulations when re-entering inactive floors.
 */
/** What a monster refilling a visited floor is worth, as a share of its XP (`ProgressionConfig.respawnXpShare`). */
function respawnXpShare(engine: GameEngine): number {
  return engine.manifest?.progressionConfig?.respawnXpShare ?? 1;
}

export class FloorManager {
  private floors = new Map<number, DungeonFloorRecord>();
  public readonly respawnInterval: number;
  public readonly maxBatchSpawns: number;
  public readonly statScaleFactor: number;
  public readonly densityLimit: number;
  public readonly clearedRespawnInterval: number;

  constructor(config?: FloorManagerConfig) {
    this.respawnInterval = config?.respawnInterval ?? 50;
    this.maxBatchSpawns = config?.maxBatchSpawns ?? 5;
    this.statScaleFactor = config?.statScaleFactor ?? 0.05;
    this.densityLimit = config?.densityLimit ?? 12;
    this.clearedRespawnInterval = config?.clearedRespawnInterval ?? 60;
  }

  public hasFloor(floorNumber: number): boolean {
    return this.floors.has(floorNumber);
  }

  public getFloorRecord(floorNumber: number): DungeonFloorRecord | undefined {
    return this.floors.get(floorNumber);
  }

  /**
   * Records departure from a floor, updating lastVisitedTick on both map and record.
   */
  public recordDeparture(
    floorNumber: number,
    map: GameMap,
    fov: FovManager | undefined,
    currentTick: number
  ): void {
    map.lastVisitedTick = currentTick;
    this.floors.set(floorNumber, {
      floorNumber,
      map,
      fov,
      lastVisitedTick: currentTick,
    });
  }

  /**
   * Runs bounded O(K) catch-up simulation for an inactive floor upon re-entry.
   * Respawns monsters up to batch cap and scales attributes based on elapsed ticks.
   */
  public simulateCatchUp(
    floorNumber: number,
    currentTick: number,
    engine: GameEngine
  ): CatchUpSimulationResult {
    const record = this.floors.get(floorNumber);
    if (!record) {
      return { ticksElapsed: 0, spawnedCount: 0, scaledMonsters: 0 };
    }

    const lastTick = record.lastVisitedTick ?? record.map.lastVisitedTick ?? 0;
    const ticksElapsed = Math.max(0, currentTick - lastTick);

    // Update timestamp immediately
    record.lastVisitedTick = currentTick;
    record.map.lastVisitedTick = currentTick;

    // If floor is town (0) or elapsed ticks less than interval, no simulation needed
    if (floorNumber === 0 || ticksElapsed < this.respawnInterval) {
      return { ticksElapsed, spawnedCount: 0, scaledMonsters: 0 };
    }

    // Strictly bounded batch calculation (O(K))
    const potentialBatches = Math.floor(ticksElapsed / this.respawnInterval);
    const batches = Math.min(this.maxBatchSpawns, potentialBatches);

    if (batches <= 0) {
      return { ticksElapsed, spawnedCount: 0, scaledMonsters: 0 };
    }

    const map = record.map;
    let spawnedCount = 0;
    let scaledMonsters = 0;

    // Stat scale multiplier: capped between 1.0 and 1.5
    const multiplier = Math.min(1.5, 1.0 + batches * this.statScaleFactor);

    // 1. Raise living monsters to this visit's multiplier, in total: a survivor already scaled
    // that far by an earlier return is left alone, so repeated returns never compound. Its XP
    // rises with it.
    const livingMonsters = map.getAllEntities().filter((e) => e instanceof Monster && e.isAlive()) as Monster[];
    for (const monster of livingMonsters) {
      if (multiplier <= monster.catchUpScale) continue;
      const ratio = multiplier / monster.catchUpScale;
      const targetHp = Math.round(monster.baseMaxHpValue * ratio);
      monster.hp = Math.min(targetHp, Math.round(monster.hp * ratio));
      monster.maxHp = targetHp;
      monster.attack = Math.round(monster.baseAttackValue * ratio);
      monster.xpValue = Math.round(monster.xpValue * ratio);
      monster.catchUpScale = multiplier;
      scaledMonsters++;
    }

    // 2. Batch respawn monsters outside player FOV up to density limit
    const currentDensity = livingMonsters.length;
    const availableSlots = Math.max(0, this.densityLimit - currentDensity);
    const spawnsToPerform = Math.min(batches, availableSlots);

    if (spawnsToPerform > 0) {
      // Every site on the floor (stride 2 for speed) at least 8 from where the hero arrives
      // (`changeFloor` places the hero first): a scan that stopped at the first few filled
      // only the top rows.
      const playerPos: Position = engine.player ? { x: engine.player.x, y: engine.player.y } : { x: 10, y: 10 };
      const candidateTiles = new SpawnSiteFilter(map, { anchor: playerPos, minDistance: 8 }).sites(2);

      // Pick monster definitions appropriate for manifest or floor
      const monsterCatalog = engine.manifest?.monsters ?? [];
      const rng = () => engine.rng();

      for (let i = 0; i < spawnsToPerform && candidateTiles.length > 0; i++) {
        const tileIdx = Math.floor(rng() * candidateTiles.length);
        const tile = candidateTiles.splice(tileIdx, 1)[0];
        const mId = `catchup-m-${floorNumber}-${currentTick}-${i}`;

        // Same depth-gated draw as the cleared-floor respawn and initial population:
        // a uniform draw from the whole catalog put floor-25 bosses on floor 2.
        if (monsterCatalog.length > 0) {
          const def = selectDungeonMonsterDefinition(monsterCatalog, floorNumber, rng);
          if (!def) continue;
          const monster = createScaledMonster(
            def,
            mId,
            tile,
            floorNumber,
            engine.gameState?.deepestFloor,
            engine.player?.level,
            engine.manifest?.monsterScaling,
            engine.player?.difficulty,
            engine.registries
          );
          monster.maxHp = Math.round(monster.maxHp * multiplier);
          monster.hp = monster.maxHp;
          monster.attack = Math.round(monster.attack * multiplier);
          monster.xpValue = Math.round(monster.xpValue * multiplier * respawnXpShare(engine));
          monster.catchUpScale = multiplier;
          map.addEntity(monster);
          spawnedCount++;
          continue;
        }

        // No catalog (bare test engines): a generic depth-scaled stalker.
        const scaledHp = Math.round((15 + floorNumber * 4) * multiplier);
        const newMonster = new Monster({
          id: mId,
          name: 'Dungeon Stalker',
          position: tile,
          definitionId: 'catchup_monster',
          stats: {
            hp: scaledHp,
            maxHp: scaledHp,
            attack: Math.round((3 + floorNumber * 2) * multiplier),
            defense: Math.round(Math.floor(floorNumber / 2) * multiplier),
          },
          speed: 100,
          aiType: 'melee',
          aiState: 'sleeping',
          xpValue: Math.round(15 * multiplier * respawnXpShare(engine)),
        });

        map.addEntity(newMonster);
        spawnedCount++;
      }
    }

    // A refilled floor is no longer cleared: the cleared-floor timer must not refill it a
    // second time on the next turn (R-ai-8). Its interval restarts from this visit.
    if (spawnedCount > 0) {
      map.isCleared = false;
      map.lastRespawnTurn = map.floorTurnCount;
    }

    return {
      ticksElapsed,
      spawnedCount,
      scaledMonsters,
    };
  }

  /**
   * Periodically checks if an active cleared floor (currentFloor >= 1) should respawn
   * a batch of dormant sleeping monsters outside the player's FOV.
   */
  public checkClearedFloorRespawn(engine: GameEngine): Monster[] {
    if (engine.currentFloor < 1) {
      return [];
    }

    const map = engine.map;
    const livingMonsters = map.getAllEntities().filter(
      (e) => e instanceof Monster && e.isAlive()
    ) as Monster[];

    // If floor has no living monsters, mark it as cleared and record turn
    if (livingMonsters.length === 0) {
      if (!map.isCleared) {
        map.isCleared = true;
        map.lastRespawnTurn = map.floorTurnCount;
      }
    }

    // Only cleared floors trigger batch respawn
    if (!map.isCleared) {
      return [];
    }

    const turnsSinceRespawn = map.floorTurnCount - (map.lastRespawnTurn ?? 0);
    if (turnsSinceRespawn < this.clearedRespawnInterval) {
      return [];
    }

    // Density check
    const currentDensity = livingMonsters.length;
    const availableSlots = Math.max(0, this.densityLimit - currentDensity);
    if (availableSlots <= 0) {
      return [];
    }

    // Every attempt past this point restarts the interval, even if nothing ends up spawning
    // (no eligible definitions, no candidate tiles, or addEntity rejecting). Otherwise a
    // failed attempt would repeat the full-map scan below on every subsequent turn.
    map.lastRespawnTurn = map.floorTurnCount;

    const monsterCatalog = engine.manifest?.monsters ?? [];
    if (!monsterCatalog.some((def) => isEligibleDungeonMonster(def, engine.currentFloor))) {
      return [];
    }

    const spawnsToPerform = Math.min(this.maxBatchSpawns, availableSlots);
    const candidateTiles = new SpawnSiteFilter(map, {
      anchor: engine.player ? { x: engine.player.x, y: engine.player.y } : { x: 0, y: 0 },
      minDistance: 8,
      hiddenFrom: engine.fov,
    }).sites();

    if (candidateTiles.length === 0) {
      return [];
    }

    const rng = () => engine.rng();
    const spawned: Monster[] = [];

    for (let i = 0; i < spawnsToPerform && candidateTiles.length > 0; i++) {
      const tileIdx = Math.floor(rng() * candidateTiles.length);
      const tile = candidateTiles.splice(tileIdx, 1)[0];

      const def = selectDungeonMonsterDefinition(monsterCatalog, engine.currentFloor, rng);
      if (!def) continue;

      const mId = `respawn-${engine.currentFloor}-${map.floorTurnCount}-${i}-${Math.floor(rng() * 10000)}`;
      const monster = createScaledMonster(
        def,
        mId,
        tile,
        engine.currentFloor,
        engine.gameState?.deepestFloor,
        engine.player?.level,
        engine.manifest?.monsterScaling,
        engine.player?.difficulty,
        engine.registries
      );
      monster.aiState = 'sleeping';
      monster.xpValue = Math.round(monster.xpValue * respawnXpShare(engine));

      const added = engine.addEntity(monster);
      if (added) {
        spawned.push(monster);
      }
    }

    if (spawned.length > 0) {
      map.isCleared = false;
      engine.log('You sense hostile presence returning to the shadowy halls...');
    }

    return spawned;
  }
}
