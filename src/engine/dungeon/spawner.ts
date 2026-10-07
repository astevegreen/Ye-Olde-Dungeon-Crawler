import type { GameMap } from '../grid/map';
import type { Position, GameDifficulty } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { MonsterScalingConfig } from '../types/monsterScaling';
import type { EngineRegistries } from '../registries';
import { Monster } from '../entities/monster';

export interface ScaledMonsterStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpValue: number;
  name: string;
}

/**
 * Calculates a relative hybrid scale factor based on current floor depth (D),
 * deepest floor reached (Dmax), and player character level (L).
 *
 * Invariants:
 * 1. Frontier floors (D = Dmax) scale at peak difficulty: 1.0 + (Dmax - 1) * 0.15
 * 2. Earlier floors (D < Dmax) scale with depth and player progression:
 *    1.0 + (D - 1) * 0.10 + (L - 1) * 0.03 + (Dmax - D) * 0.02
 * 3. Strict Frontier Invariant:
 *    Earlier floor scale is strictly capped below frontier floor scale:
 *    scale <= frontierScale * 0.88
 */
export function calculateHybridScaleFactor(
  currentFloor: number,
  deepestFloor: number = currentFloor,
  playerLevel: number = 1
): number {
  const D = Math.max(1, currentFloor);
  const Dmax = Math.max(D, deepestFloor);
  const L = Math.max(1, playerLevel);

  const frontierScale = 1.0 + (Dmax - 1) * 0.15;

  if (D >= Dmax) {
    return frontierScale;
  }

  const rawScale = 1.0 + (D - 1) * 0.10 + (L - 1) * 0.03 + (Dmax - D) * 0.02;
  const maxAllowed = frontierScale * 0.88;

  return Math.min(rawScale, maxAllowed);
}

const DEFAULT_BOSS_TAGS = ['boss', 'miniboss'];

/**
 * Resolves a `MonsterPowerTier` list into the step-function multiplier effective at
 * `floor` — the highest tier at or below it, ascending-order input, no interpolation.
 */
function tierMultiplier(tiers: MonsterScalingConfig['tiers'], floor: number): number {
  let result = tiers[0]?.multiplier ?? 1.0;
  for (const t of tiers) {
    if (floor >= t.floor) result = t.multiplier;
    else break;
  }
  return result;
}

/**
 * Combines a `MonsterScalingConfig`'s zone-tier step function with a difficulty's two
 * knobs (ARCHITECTURE.md §3): `basePowerMultiplier` shifts every monster uniformly
 * (including at the very first tier), `scalingRateMultiplier` scales only the growth
 * *above* 1.0 that the tier curve contributes. A boss/miniboss-tagged monster's
 * multiplier is floored at `tier * bossPowerFloorMultiplier` regardless of the two
 * knobs, so a low-difficulty base power can't trivialize a guarded fight.
 */
export function resolveMonsterPowerMultiplier(
  config: MonsterScalingConfig,
  floor: number,
  difficulty: GameDifficulty,
  isBossTagged: boolean
): number {
  const tier = tierMultiplier(config.tiers, floor);
  const d = config.difficulty[difficulty] ?? config.difficulty.medium;
  let multiplier = d.basePowerMultiplier * (1 + (tier - 1) * d.scalingRateMultiplier);
  if (isBossTagged && d.bossPowerFloorMultiplier) {
    multiplier = Math.max(multiplier, tier * d.bossPowerFloorMultiplier);
  }
  return multiplier;
}

/**
 * Calculates depth-scaled monster combat stats. Three branches, in priority order:
 *
 * 1. `scalingConfig` given: zone-tiered, difficulty-scaled step function
 *    (ARCHITECTURE.md §3) — `resolveMonsterPowerMultiplier` above; defense takes the
 *    multiplier raised to the pack's `defenseExponent` (default 1).
 * 2. Neither `scalingConfig` nor `deepestFloor`/`playerLevel` given: the original flat
 *    per-floor curve — HP: `round(baseHP * (1 + 0.08 * (currentFloor - 1)))`, Attack:
 *    `baseAttack + floor(0.6 * (currentFloor - 1))`, Defense: `baseDefense + floor(0.4
 *    * (currentFloor - 1))`, XP: `round(baseXP * (1 + 0.10 * (currentFloor - 1)))`.
 *    This is the fallback for any manifest that doesn't supply `monsterScaling`
 *    (e.g. `warcraft`), kept byte-for-byte unchanged for backward compatibility.
 * 3. `deepestFloor`/`playerLevel` given, no `scalingConfig`: the pre-existing hybrid
 *    depth/progression formula (`calculateHybridScaleFactor`).
 *
 * "Veteran <Name>" affix (the pack's `veteranPrefix` word with a scaling config):
 * `(currentFloor - minFloor) >= 10`, in every branch, for
 * ordinary monsters only (`scaledName`). Scale alone doesn't earn it: every monster on a
 * deep floor is scaled well past 1.8x, so that rule named nearly all of them.
 * MonsterDefinition templates remain immutable.
 */
export function scaleMonsterStats(
  def: MonsterDefinition,
  currentFloor: number,
  deepestFloor?: number,
  playerLevel?: number,
  scalingConfig?: MonsterScalingConfig,
  difficulty?: GameDifficulty
): ScaledMonsterStats {
  const minFloor = def.minFloor ?? 1;

  if (scalingConfig) {
    const bossTags = scalingConfig.bossTags ?? DEFAULT_BOSS_TAGS;
    const isBossTagged = (def.tags ?? []).some((t) => bossTags.includes(t));
    const scale = resolveMonsterPowerMultiplier(scalingConfig, currentFloor, difficulty ?? 'medium', isBossTagged);

    const hp = Math.max(def.stats.hp, Math.round(def.stats.maxHp * scale));
    const attack = Math.max(def.stats.attack, Math.round(def.stats.attack * scale));
    const defenseScale = Math.pow(scale, scalingConfig.defenseExponent ?? 1);
    const defense = Math.max(def.stats.defense, Math.round(def.stats.defense * defenseScale));
    // XP follows the zone tier alone (Q4 "B", Q25): a kill is worth the same on every
    // difficulty and the boss guard raises a fight, not its reward.
    const xpValue = Math.max(def.xpValue, Math.round(def.xpValue * tierMultiplier(scalingConfig.tiers, currentFloor)));

    const name = scaledName(def, currentFloor - minFloor >= 10, bossTags, scalingConfig.veteranPrefix);

    return { hp, maxHp: hp, attack, defense, xpValue, name };
  }

  if (deepestFloor === undefined && playerLevel === undefined) {
    const floorOffset = Math.max(0, currentFloor - 1);
    const hp = Math.round(def.stats.maxHp * (1 + 0.08 * floorOffset));
    const attack = def.stats.attack + Math.floor(0.6 * floorOffset);
    const defense = def.stats.defense + Math.floor(0.4 * floorOffset);
    const xpValue = Math.round(def.xpValue * (1 + 0.1 * floorOffset));

    const name = scaledName(def, currentFloor - minFloor >= 10);

    return {
      hp,
      maxHp: hp,
      attack,
      defense,
      xpValue,
      name,
    };
  }

  const scale = calculateHybridScaleFactor(currentFloor, deepestFloor, playerLevel);
  const hp = Math.max(def.stats.hp, Math.round(def.stats.maxHp * scale));
  const attack = Math.max(def.stats.attack, Math.round(def.stats.attack * scale));
  const defense = Math.max(def.stats.defense, Math.round(def.stats.defense * scale));
  const xpValue = Math.max(def.xpValue, Math.round(def.xpValue * scale));

  const name = scaledName(def, currentFloor - minFloor >= 10);

  return {
    hp,
    maxHp: hp,
    attack,
    defense,
    xpValue,
    name,
  };
}

/**
 * A scaled monster's name: "<prefix> <Name>" (the pack's `veteranPrefix`, else "Veteran")
 * for an ordinary monster met well past where it first appears, never for a unique one
 * (`placedOnly`, or tagged as a boss), whose name is its own.
 */
function scaledName(
  def: MonsterDefinition,
  veteran: boolean,
  bossTags: readonly string[] = DEFAULT_BOSS_TAGS,
  prefix = 'Veteran'
): string {
  const unique = def.placedOnly || (def.tags ?? []).some((t) => bossTags.includes(t));
  return veteran && !unique ? `${prefix} ${def.name}` : def.name;
}

/**
 * Whether a definition may be drawn by selectDungeonMonsterDefinition on the given floor:
 * not `placedOnly` (bosses, minibosses and other uniques appear only where content places
 * them), and unlocked (minFloor <= currentFloor).
 */
export function isEligibleDungeonMonster(def: MonsterDefinition, currentFloor: number): boolean {
  return !def.placedOnly && (def.minFloor ?? 1) <= currentFloor;
}

/** Floors after unlocking at which a monster's draw weight has fallen to half. */
const SPAWN_FRESHNESS_FLOORS = 6;

/**
 * How likely a monster is to be drawn on a floor: 1 the floor it unlocks, easing off over
 * the next few floors and falling away steeply after (half at SPAWN_FRESHNESS_FLOORS, about
 * a tenth at twice that). A floor's mix is led by the monsters of its own stretch of the
 * dungeon, with older ones thinning out, and no one monster takes most of the draws however
 * few unlock nearby.
 */
export function dungeonSpawnWeight(def: MonsterDefinition, currentFloor: number): number {
  const age = Math.max(0, currentFloor - (def.minFloor ?? 1)) / SPAWN_FRESHNESS_FLOORS;
  return 1 / (1 + age * age * age);
}

/**
 * Draws a monster definition for a floor from the eligible candidates, weighted by
 * `dungeonSpawnWeight`. One rng draw per pick.
 */
export function selectDungeonMonsterDefinition(
  candidates: MonsterDefinition[],
  currentFloor: number,
  rng: () => number
): MonsterDefinition | null {
  const eligible = candidates.filter((m) => isEligibleDungeonMonster(m, currentFloor));
  if (eligible.length === 0) return null;

  const weights = eligible.map((m) => dungeonSpawnWeight(m, currentFloor));
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll < 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

/**
 * Instantiates a runtime Monster from a template with depth-scaled attributes,
 * preserving template immutability.
 */
export function createScaledMonster(
  def: MonsterDefinition,
  id: string,
  position: Position,
  currentFloor: number,
  deepestFloor?: number,
  playerLevel?: number,
  scalingConfig?: MonsterScalingConfig,
  difficulty?: GameDifficulty,
  _registries?: EngineRegistries
): Monster {
  const scaled = scaleMonsterStats(def, currentFloor, deepestFloor, playerLevel, scalingConfig, difficulty);

  return new Monster({
    id,
    name: scaled.name,
    position,
    stats: {
      hp: scaled.hp,
      maxHp: scaled.maxHp,
      attack: scaled.attack,
      defense: scaled.defense,
    },
    speed: def.speed,
    resistances: def.resistances,
    statusImmunities: def.statusImmunities,
    definitionId: def.id,
    aiType: def.aiType,
    aiState: 'sleeping',
    spells: def.spells ? [...def.spells] : undefined,
    spellCooldown: def.spellCooldown,
    onHitAffliction: def.onHitAffliction,
    fleeHealthPercent: def.fleeHealthPercent,
    xpValue: scaled.xpValue,
    lootTable: def.lootTable ? [...def.lootTable] : [],
    hooks: def.hooks,
    tags: def.tags ? [...def.tags] : undefined,
    targetingMode: def.targetingMode,
  });
}

/**
 * Populates dungeon rooms with depth-appropriate, scaled monsters.
 */
export function populateDungeonFloor(
  map: GameMap,
  rooms: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  currentFloor: number,
  candidates: MonsterDefinition[],
  rng: () => number,
  densityMultiplier = 1.0,
  scalingConfig?: MonsterScalingConfig,
  difficulty?: GameDifficulty,
  registries?: EngineRegistries,
  /** Where a monster may stand (`SpawnSiteFilter.allows`); else any passable, empty tile. */
  allows?: (x: number, y: number) => boolean
): void {
  const effectiveCandidates =
    candidates.length > 0
      ? candidates
      : registries
      ? registries.monsters.getAll()
      : [];

  // Start from room index 1 so room 0 remains player spawn
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const baseCount = Math.floor(rng() * 2) + 1; // 1 to 2 monsters per room
    const count = Math.max(1, Math.round(baseCount * densityMultiplier));

    for (let j = 0; j < count; j++) {
      const def = selectDungeonMonsterDefinition(effectiveCandidates, currentFloor, rng);
      if (!def) continue;

      // A pack monster brings its pack, and the pack is the room's population (Q14).
      const [fewest, most] = def.pack?.size ?? [1, 1];
      const members = def.pack ? fewest + Math.floor(rng() * (most - fewest + 1)) : 1;
      for (let k = 0; k < members; k++) {
        const mx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
        const my = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

        if (allows ? allows(mx, my) : map.isPassable(mx, my) && !map.getEntityAt(mx, my)) {
          const randId = Math.floor(rng() * 1000000);
          const uniqueId = k === 0 ? `mon-${currentFloor}-${i}-${j}-${randId}` : `mon-${currentFloor}-${i}-${j}-${k}-${randId}`;
          const monster = createScaledMonster(
            def,
            uniqueId,
            { x: mx, y: my },
            currentFloor,
            undefined,
            undefined,
            scalingConfig,
            difficulty,
            registries
          );
          map.addEntity(monster);
        }
      }
      if (def.pack) break;
    }
  }
}
