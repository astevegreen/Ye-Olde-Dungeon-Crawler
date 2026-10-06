import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';
import type { Position } from '../types';
import type { FloorEncounterConfig } from '../types/manifest';
import { selectDungeonMonsterDefinition, createScaledMonster, isEligibleDungeonMonster } from './spawner';
import { SpawnSiteFilter } from './spawnSites';

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
    hooks: def.hooks,
  });
}

/**
 * The wandering-monster band a floor falls in: the entry keyed by the deepest listed floor
 * not deeper than `floor` (owner Q8: bands). Undefined above the first key.
 */
function encounterBandFor(
  bands: Record<number, FloorEncounterConfig> | undefined,
  floor: number
): FloorEncounterConfig | undefined {
  let best = -Infinity;
  for (const key of Object.keys(bands ?? {})) {
    const start = Number(key);
    if (start <= floor && start > best) best = start;
  }
  return best === -Infinity ? undefined : bands![best];
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
  public checkAndSpawn(
    engine: GameEngine,
    rng: () => number = () => engine.rng()
  ): Monster | null {
    // 1. Dungeon floor check: strictly floors >= 1 (no wandering monsters in town)
    if (engine.currentFloor < 1) {
      return null;
    }

    // 2. Turn interval check: every intervalTurns (e.g. 50, 100, 150...)
    if (engine.turnCount === 0 || engine.turnCount % this.intervalTurns !== 0) {
      return null;
    }

    // 2b. The floor's cap: its band's `maxMonsters`, else the floor manager's density limit.
    // Resting for thousands of turns used to add a sleeper every few hundred, unbounded.
    const cap = encounterBandFor(engine.manifest.quest?.floorEncounters, engine.currentFloor)?.maxMonsters ?? engine.floorManager.densityLimit;
    const hostiles = engine.map.getAllEntities().filter((e) => e instanceof Monster && e.isAlive() && e.faction !== 'player').length;
    if (hostiles >= cap) {
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

    // 5. Find candidate spawn locations: out of sight, >= minDistanceToPlayer away, and
    // somewhere the hero can walk to (never a secret cache or a sealed cage).
    const candidateTiles = new SpawnSiteFilter(engine.map, {
      anchor: { x: engine.player.x, y: engine.player.y },
      minDistance: this.minDistanceToPlayer,
      hiddenFrom: engine.fov,
    }).sites();

    if (candidateTiles.length === 0) {
      return null;
    }

    // 6. Pick random candidate tile
    const spawnPos = candidateTiles[Math.floor(rng() * candidateTiles.length)];
    const uniqueId = `wandering_${eligibleDef.id}_${engine.turnCount}_${Math.floor(rng() * 10000)}`;
    const monster = createScaledMonster(
      eligibleDef,
      uniqueId,
      spawnPos,
      engine.currentFloor,
      engine.gameState?.deepestFloor,
      engine.player?.level,
      engine.manifest?.monsterScaling,
      engine.player?.difficulty,
      engine.registries
    );
    monster.aiState = 'sleeping';

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
    const encounterConfig = encounterBandFor(engine.manifest.quest?.floorEncounters, engine.currentFloor);
    // The floor's band, less any monster the floor isn't deep enough for (band 5 lists
    // wolves, which wait for floor 7).
    const listed = (encounterConfig?.monsterIds ?? [])
      .map((id) => engine.manifest.monsters.find((m) => m.id === id) ?? getMonsterDefinition(id))
      .filter((def): def is MonsterDefinition => !!def && isEligibleDungeonMonster(def, engine.currentFloor));
    if (listed.length > 0) return listed[Math.floor(rng() * listed.length)];

    // Dynamic tiered selection from manifest monsters
    const selected = selectDungeonMonsterDefinition(engine.manifest.monsters, engine.currentFloor, rng);
    if (selected) return selected;

    // Fallback: any monster the manifest doesn't keep for placement, other than the boss
    const bossMonsterId = engine.manifest.quest?.bossMonsterId;
    const nonBoss = engine.manifest.monsters.filter((m) => !m.placedOnly && m.id !== bossMonsterId);
    if (nonBoss.length > 0) {
      return nonBoss[Math.floor(rng() * nonBoss.length)];
    }

    return engine.manifest.monsters[0] ?? null;
  }
}

