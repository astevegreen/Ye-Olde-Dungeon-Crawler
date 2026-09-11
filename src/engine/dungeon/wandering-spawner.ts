import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';
import type { Position } from '../types';
import { selectDungeonMonsterDefinition, createScaledMonster } from './spawner';

/**
 * Creates a runtime Monster instance from an immutable MonsterDefinition,
 * honoring the Definition vs. Instance separation.
 */
export function createMonsterFromDefinition(
  def: MonsterDefinition,
  id: string,
  position: Position
): Monster {
  return new Monster({
    id,
    name: def.name,
    position,
    stats: { ...def.stats },
    speed: def.speed,
    resistances: def.resistances,
    statusImmunities: def.statusImmunities,
    definitionId: def.id,
    aiType: def.aiType,
    aiState: 'sleeping',
    spells: def.spells,
    onHitAffliction: def.onHitAffliction,
    fleeHealthPercent: def.fleeHealthPercent,
    xpValue: def.xpValue,
    lootTable: def.lootTable,
  });
}

/**
 * Dynamic wandering monster spawner.
 * Periodically spawns level-appropriate wandering monsters in unobserved tiles outside player FOV on dungeon floors.
 */
export class WanderingMonsterSpawner {
  public intervalTurns: number;
  public spawnChance: number;
  public minDistanceToPlayer: number;

  constructor(options?: {
    intervalTurns?: number;
    spawnChance?: number;
    minDistanceToPlayer?: number;
  }) {
    this.intervalTurns = options?.intervalTurns ?? 50;
    this.spawnChance = options?.spawnChance ?? 0.15;
    this.minDistanceToPlayer = options?.minDistanceToPlayer ?? 8;
  }

  /**
   * Evaluates conditions and spawns a wandering monster if eligible.
   */
  public checkAndSpawn(engine: GameEngine, rng: () => number = Math.random): Monster | null {
    // 1. Dungeon floor check: strictly floors >= 1 (no wandering monsters in town)
    if (engine.currentFloor < 1) {
      return null;
    }

    // 2. Turn interval check: every intervalTurns (e.g. 50, 100, 150...)
    if (engine.turnCount === 0 || engine.turnCount % this.intervalTurns !== 0) {
      return null;
    }

    // 3. Probability roll
    if (rng() > this.spawnChance) {
      return null;
    }

    // 4. Determine eligible monster definition
    const eligibleDef = this.selectMonsterDefinition(engine, rng);
    if (!eligibleDef) {
      return null;
    }

    // 5. Find candidate spawn locations outside player FOV and >= minDistanceToPlayer
    const candidateTiles: Position[] = [];
    const px = engine.player.x;
    const py = engine.player.y;

    for (let y = 1; y < engine.map.height - 1; y++) {
      for (let x = 1; x < engine.map.width - 1; x++) {
        if (!engine.map.isPassable(x, y)) continue;
        if (engine.map.getEntityAt(x, y)) continue;

        // Must be outside line of sight
        if (engine.fov.isVisible(x, y)) continue;

        // Euclidean distance check
        const dist = Math.hypot(x - px, y - py);
        if (dist >= this.minDistanceToPlayer) {
          candidateTiles.push({ x, y });
        }
      }
    }

    if (candidateTiles.length === 0) {
      return null;
    }

    // 6. Pick random candidate tile
    const spawnPos = candidateTiles[Math.floor(rng() * candidateTiles.length)];
    const uniqueId = `wandering_${eligibleDef.id}_${Date.now()}_${Math.floor(rng() * 10000)}`;
    const monster = createScaledMonster(eligibleDef, uniqueId, spawnPos, engine.currentFloor);

    // 7. Enqueue into engine map & scheduler
    const added = engine.addEntity(monster);
    if (!added) {
      return null;
    }

    // 8. Faint atmospheric audio cue
    engine.log('You hear skittering footsteps echoing in the distant dark...');
    return monster;
  }

  private selectMonsterDefinition(engine: GameEngine, rng: () => number): MonsterDefinition | null {
    const encounterConfig = engine.manifest.quest?.floorEncounters?.[engine.currentFloor];
    const monsterIds = encounterConfig?.monsterIds;
    if (monsterIds && monsterIds.length > 0) {
      const chosenId = monsterIds[Math.floor(rng() * monsterIds.length)];
      const fromManifest = engine.manifest.monsters.find((m) => m.id === chosenId);
      if (fromManifest) return fromManifest;
      const fromBestiary = getMonsterDefinition(chosenId);
      if (fromBestiary) return fromBestiary;
    }

    // Dynamic tiered selection from manifest monsters
    const selected = selectDungeonMonsterDefinition(engine.manifest.monsters, engine.currentFloor, rng);
    if (selected) return selected;

    // Fallback: pick any non-boss monster from manifest
    const bossMonsterId = engine.manifest.quest?.bossMonsterId;
    const nonBoss = engine.manifest.monsters.filter(
      (m) => !m.id.toLowerCase().includes('boss') && m.id !== bossMonsterId
    );
    if (nonBoss.length > 0) {
      return nonBoss[Math.floor(rng() * nonBoss.length)];
    }

    return engine.manifest.monsters[0] ?? null;
  }
}

