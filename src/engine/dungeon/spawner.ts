import type { GameMap } from '../grid/map';
import type { Position } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
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

/**
 * Calculates depth-scaled monster combat stats according to the canonical formula:
 * - HP: Math.round(baseHP * (1 + 0.08 * (currentFloor - 1)))
 * - Attack: baseAttack + Math.floor(0.6 * (currentFloor - 1))
 * - Defense: baseDefense + Math.floor(0.4 * (currentFloor - 1))
 * - XP: Math.round(baseXP * (1 + 0.10 * (currentFloor - 1)))
 * - Affix: "Veteran <Name>" if (currentFloor - minFloor) >= 10
 *
 * When deepestFloor and playerLevel are provided, applies the hybrid depth and progression
 * scaling formula, capped strictly below frontier encounters.
 *
 * MonsterDefinition templates remain strictly immutable.
 */
export function scaleMonsterStats(
  def: MonsterDefinition,
  currentFloor: number,
  deepestFloor?: number,
  playerLevel?: number
): ScaledMonsterStats {
  const minFloor = def.minFloor ?? 1;

  if (deepestFloor === undefined && playerLevel === undefined) {
    const floorOffset = Math.max(0, currentFloor - 1);
    const hp = Math.round(def.stats.maxHp * (1 + 0.08 * floorOffset));
    const attack = def.stats.attack + Math.floor(0.6 * floorOffset);
    const defense = def.stats.defense + Math.floor(0.4 * floorOffset);
    const xpValue = Math.round(def.xpValue * (1 + 0.1 * floorOffset));

    const isVeteran = currentFloor - minFloor >= 10;
    const name = isVeteran ? `Veteran ${def.name}` : def.name;

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

  const isVeteran = currentFloor - minFloor >= 10 || scale >= 1.8;
  const name = isVeteran ? `Veteran ${def.name}` : def.name;

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
 * Whether a definition may be drawn by selectDungeonMonsterDefinition on the given floor:
 * non-boss and unlocked (minFloor <= currentFloor).
 */
export function isEligibleDungeonMonster(def: MonsterDefinition, currentFloor: number): boolean {
  return (
    !def.id.toLowerCase().includes('boss') &&
    !def.name.toLowerCase().includes('hrungnir') &&
    (def.minFloor ?? 1) <= currentFloor
  );
}

/**
 * Selects a monster definition from candidates based on floor depth and tiering:
 * - Filters to non-boss candidates where minFloor <= currentFloor
 * - Separates candidates into "recently unlocked" (highest minFloor) and "lower-tier" groups
 * - 75% chance to draw from recently unlocked group, 25% from lower-tier group
 */
export function selectDungeonMonsterDefinition(
  candidates: MonsterDefinition[],
  currentFloor: number,
  rng: () => number = Math.random
): MonsterDefinition | null {
  const eligible = candidates.filter((m) => isEligibleDungeonMonster(m, currentFloor));

  if (eligible.length === 0) {
    return null;
  }

  const maxMinFloor = Math.max(...eligible.map((m) => m.minFloor ?? 1));
  const recentGroup = eligible.filter((m) => (m.minFloor ?? 1) === maxMinFloor);
  const lowerGroup = eligible.filter((m) => (m.minFloor ?? 1) < maxMinFloor);

  if (lowerGroup.length > 0) {
    // 75% recently unlocked, 25% lower tier
    if (rng() < 0.75) {
      return recentGroup[Math.floor(rng() * recentGroup.length)];
    } else {
      return lowerGroup[Math.floor(rng() * lowerGroup.length)];
    }
  }

  return recentGroup[Math.floor(rng() * recentGroup.length)];
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
  playerLevel?: number
): Monster {
  const scaled = scaleMonsterStats(def, currentFloor, deepestFloor, playerLevel);

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
  rng: () => number = Math.random,
  densityMultiplier = 1.0
): void {
  // Start from room index 1 so room 0 remains player spawn
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const baseCount = Math.floor(rng() * 2) + 1; // 1 to 2 monsters per room
    const count = Math.max(1, Math.round(baseCount * densityMultiplier));

    for (let j = 0; j < count; j++) {
      const def = selectDungeonMonsterDefinition(candidates, currentFloor, rng);
      if (!def) continue;

      const mx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const my = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(mx, my) && !map.getEntityAt(mx, my)) {
        const randId = Math.floor(rng() * 1000000);
        const uniqueId = `mon-${currentFloor}-${i}-${j}-${randId}`;
        const monster = createScaledMonster(def, uniqueId, { x: mx, y: my }, currentFloor);
        map.addEntity(monster);
      }
    }
  }
}
